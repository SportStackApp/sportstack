"""Fail-closed preflight for one due RevSports fixture.

The preflight fetches only the fixture's round page, confirms the current start
time, and updates the fixture start before any exact-match result scrape runs.
If the fixture cannot be verified, this script fails and the result scraper is
not allowed to run.
"""

from __future__ import annotations

import importlib.util
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from bs4 import BeautifulSoup

try:
    from inspect_supabase_storage_usage import require_env, validate_target
    from select_due_fixture_scrapes import parse_timestamp, validate_source_url
except ModuleNotFoundError:
    from scripts.inspect_supabase_storage_usage import require_env, validate_target
    from scripts.select_due_fixture_scrapes import parse_timestamp, validate_source_url


ROOT = Path(__file__).resolve().parents[1]
SCRAPER_PATH = ROOT / "scraper" / "scraper.py"
EXPECTED_DEV_PROJECT_REF = "icqegnpjbizccjebjfhb"


@dataclass(frozen=True)
class PreflightDecision:
    changed: bool
    expected_finish: datetime
    should_scrape: bool


def _load_scraper_module():
    """Load the existing round-card parser without running its CLI entrypoint."""

    spec = importlib.util.spec_from_file_location("sportstack_match_scraper", SCRAPER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load the RevSports round-card parser")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def build_round_url(
    portal_url: str,
    competition_id: str,
    grade_id: str,
    round_number: str,
) -> str:
    """Build and validate the one allowed RevSports round-page URL."""

    identifiers = (competition_id, grade_id, round_number)
    if any(re.fullmatch(r"\d+", str(value or "")) is None for value in identifiers):
        raise RuntimeError("Fixture is missing safe RevSports round identifiers")
    candidate = (
        f"{portal_url.rstrip('/')}/games/{competition_id}/{grade_id}"
        f"/round/{round_number}"
    )
    safe_url = validate_source_url(
        candidate,
        portal_url=portal_url,
        path_suffix_pattern=r"/games/\d+/\d+/round/\d+",
    )
    if not safe_url:
        raise RuntimeError("Unsafe RevSports round URL")
    return safe_url


def parse_revsports_start(game_date: str, game_time: str, timezone_name: str) -> datetime:
    """Convert the local RevSports date/time to an aware UTC timestamp."""

    try:
        local_timezone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError as error:
        raise RuntimeError(f"Unknown association timezone: {timezone_name}") from error
    try:
        local_start = datetime.strptime(
            f"{game_date} {game_time}",
            "%Y-%m-%d %H:%M",
        ).replace(tzinfo=local_timezone)
    except ValueError as error:
        raise RuntimeError("RevSports round card has an invalid start date or time") from error
    return local_start.astimezone(timezone.utc)


def decide_preflight(
    *,
    current_start: datetime,
    current_exact_end: datetime | None,
    fresh_start: datetime,
    duration_minutes: int,
    as_of: datetime,
) -> PreflightDecision:
    """Preserve an exact duration when rescheduled, otherwise use the hierarchy."""

    timestamps = (current_start, fresh_start, as_of)
    if any(value.tzinfo is None or value.utcoffset() is None for value in timestamps):
        raise ValueError("Preflight timestamps must be timezone-aware")
    if current_exact_end is not None:
        if current_exact_end.tzinfo is None or current_exact_end.utcoffset() is None:
            raise ValueError("Exact fixture end must be timezone-aware")
        exact_duration = current_exact_end - current_start
        if exact_duration <= timedelta(0):
            raise RuntimeError("Exact fixture end is not after its start")
        expected_finish = fresh_start + exact_duration
    else:
        safe_duration = duration_minutes if 30 <= duration_minutes <= 240 else 90
        expected_finish = fresh_start + timedelta(minutes=safe_duration)

    return PreflightDecision(
        changed=fresh_start != current_start,
        expected_finish=expected_finish,
        should_scrape=as_of >= expected_finish,
    )


def extract_fixture_context(html: str, round_url: str, match_url: str) -> dict[str, Any]:
    """Find the exact fixture card; missing or incomplete context fails closed."""

    scraper = _load_scraper_module()
    soup = BeautifulSoup(html, "html.parser")
    matching_link = next(
        (
            anchor
            for anchor in soup.find_all("a", href=True)
            if scraper.normalize_url(anchor["href"], round_url) == match_url
        ),
        None,
    )
    if matching_link is None:
        raise RuntimeError("Fixture is missing from its current RevSports round page")
    card = scraper.find_fixture_card(matching_link, match_url, round_url)
    details = scraper.extract_round_card_details(card, round_url)
    if not details.get("round_date") or not details.get("round_time"):
        raise RuntimeError("Could not verify the fixture start from its RevSports round card")
    return details


def _write_output(name: str, value: str) -> None:
    if "\n" in value or "\r" in value:
        raise RuntimeError(f"Unsafe multiline workflow output: {name}")
    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as output:
            output.write(f"{name}={value}\n")
    else:
        print(f"{name}={value}")


def main() -> None:
    from supabase import create_client

    fixture_id = require_env("FIXTURE_ID")
    portal_url = require_env("PORTAL_URL")
    match_url = require_env("TARGET_MATCH_URL")
    competition_id = require_env("TARGET_COMPETITION_ID")
    grade_id = require_env("TARGET_GRADE_ID")
    round_number = require_env("TARGET_ROUND_NUMBER")
    timezone_name = os.getenv("TARGET_TIMEZONE", "Australia/Melbourne").strip()
    try:
        duration_minutes = int(os.getenv("TARGET_DURATION_MINUTES", "90"))
    except ValueError:
        duration_minutes = 90

    safe_match_url = validate_source_url(
        match_url,
        portal_url=portal_url,
        path_suffix_pattern=r"/game/\d+",
    )
    if not safe_match_url:
        raise RuntimeError("Unsafe targeted match URL")
    round_url = build_round_url(
        portal_url,
        competition_id,
        grade_id,
        round_number,
    )

    supabase_url = require_env("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY"
    )
    if not service_key:
        raise RuntimeError("Missing SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY")
    expected_ref = os.getenv(
        "EXPECTED_SUPABASE_PROJECT_REF",
        EXPECTED_DEV_PROJECT_REF,
    )
    validate_target(supabase_url, expected_ref)

    client = create_client(supabase_url, service_key)
    fixture_rows = (
        client.table("fixtures")
        .select("id,fixture_date,scheduled_end_at,status,revsports_match_url")
        .eq("id", fixture_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not fixture_rows:
        raise RuntimeError("Fixture no longer exists in SportStack")
    fixture = fixture_rows[0]
    if str(fixture.get("revsports_match_url") or "") != safe_match_url:
        raise RuntimeError("Fixture RevSports URL changed after target selection")
    if str(fixture.get("status") or "").upper() == "COMPLETED":
        _write_output("should_scrape", "false")
        _write_output("result", "already-completed")
        return

    scraper = _load_scraper_module()
    session = scraper.make_session()
    response = session.get(round_url, timeout=20)
    response.raise_for_status()
    safe_response_url = validate_source_url(
        response.url,
        portal_url=portal_url,
        path_suffix_pattern=r"/games/\d+/\d+/round/\d+",
    )
    if not safe_response_url:
        raise RuntimeError("RevSports round request redirected outside the expected page")
    details = extract_fixture_context(response.text, safe_response_url, safe_match_url)

    current_start = parse_timestamp(fixture.get("fixture_date"))
    current_exact_end = parse_timestamp(fixture.get("scheduled_end_at"))
    if current_start is None:
        raise RuntimeError("Fixture has no valid SportStack start time")
    fresh_start = parse_revsports_start(
        str(details["round_date"]),
        str(details["round_time"]),
        timezone_name,
    )
    now = datetime.now(timezone.utc)
    decision = decide_preflight(
        current_start=current_start,
        current_exact_end=current_exact_end,
        fresh_start=fresh_start,
        duration_minutes=duration_minutes,
        as_of=now,
    )

    apply_update = os.getenv("APPLY_SCHEDULE_UPDATE", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "y",
    }
    if decision.changed:
        if apply_update:
            update_result = (
                client.table("fixtures")
                .update({"fixture_date": fresh_start.isoformat()})
                .eq("id", fixture_id)
                .execute()
            )
            if not update_result.data:
                raise RuntimeError("Fixture start update did not affect a row")
            print(
                "RevSports start changed; SportStack fixture updated while preserving "
                "any exact duration.",
                file=sys.stderr,
            )
        else:
            print("RevSports start changed; dry-run left SportStack unchanged.", file=sys.stderr)

    local_start = fresh_start.astimezone(ZoneInfo(timezone_name))
    _write_output("should_scrape", "true" if decision.should_scrape else "false")
    _write_output("result", "due" if decision.should_scrape else "postponed")
    _write_output("game_date", local_start.strftime("%Y-%m-%d"))
    _write_output("game_time", local_start.strftime("%H:%M"))
    _write_output("verified_start_at", fresh_start.isoformat())
    _write_output("expected_finish_at", decision.expected_finish.isoformat())

    print(
        f"Preflight {'allows' if decision.should_scrape else 'postpones'} the exact-game scrape; "
        f"expected finish {decision.expected_finish.isoformat()}.",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()

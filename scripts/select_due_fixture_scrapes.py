"""Select exact RevSports fixtures due for a small post-match refresh.

The selector is read-only. It uses SportStack fixture times and each
association's default match duration, then returns a GitHub Actions matrix.
Completed fixtures stop being selected. Uncompleted fixtures are retried at a
bounded interval for a short period so a late RevSports result is still found.
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse

EXPECTED_DEV_PROJECT_REF = "icqegnpjbizccjebjfhb"
MAX_TARGET_AGE = timedelta(hours=12)
RETRY_INTERVAL = timedelta(minutes=45)
MAX_TARGETS = 50

ASSOCIATION_CONFIG = {
    "Hockey Ballarat": {
        "portal_url": "https://www.revolutionise.com.au/hockeyballarat",
        "output_dir": "data/hockey-ballarat-targeted",
        "source_name": "hockey-ballarat",
    },
    "Sunraysia Hockey Association": {
        "portal_url": "https://www.sunraysiahockey.com.au",
        "output_dir": "data/sunraysia-targeted",
        "source_name": "sunraysia",
    },
    "Wimmera Hockey Association": {
        "portal_url": "https://www.revolutionise.com.au/wimmeraha",
        "output_dir": "data/wimmera-targeted",
        "source_name": "wimmera",
    },
}


def parse_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return None
    return parsed.astimezone(timezone.utc)


def validate_source_url(
    value: Any,
    *,
    portal_url: str,
    path_suffix_pattern: str,
) -> str:
    """Return a canonical same-portal URL or an empty string.

    Fixture context originates in the database, so every URL is treated as
    untrusted before a scraper is allowed to request it.
    """

    if not value:
        return ""
    candidate = urlparse(str(value).strip())
    portal = urlparse(portal_url)
    portal_prefix = portal.path.rstrip("/")
    expected_path = rf"{re.escape(portal_prefix)}{path_suffix_pattern}"
    try:
        candidate_port = candidate.port
    except ValueError:
        return ""
    is_safe = (
        candidate.scheme == "https"
        and candidate.netloc == portal.netloc
        and candidate.hostname == portal.hostname
        and candidate.username is None
        and candidate.password is None
        and candidate_port is None
        and re.fullmatch(expected_path, candidate.path) is not None
        and not candidate.params
        and not candidate.query
        and not candidate.fragment
    )
    return str(value).strip() if is_safe else ""


def _duration_minutes(association: dict[str, Any]) -> int:
    try:
        duration = int(association.get("default_match_duration_minutes") or 90)
    except (TypeError, ValueError):
        return 90
    return duration if 30 <= duration <= 240 else 90


def select_due_targets(
    fixtures: list[dict[str, Any]],
    source_rows: list[dict[str, Any]],
    associations: list[dict[str, Any]],
    *,
    as_of: datetime,
    max_targets: int = MAX_TARGETS,
) -> list[dict[str, str]]:
    """Return safe targeted-scrape matrix rows ordered by expected finish."""

    if as_of.tzinfo is None or as_of.utcoffset() is None:
        raise ValueError("as_of must be timezone-aware")
    as_of = as_of.astimezone(timezone.utc)

    sources_by_url = {
        str(row.get("match_url") or ""): row
        for row in source_rows
        if row.get("match_url")
    }
    associations_by_name = {
        str(row.get("name") or ""): row
        for row in associations
        if row.get("name")
    }
    selected: list[tuple[datetime, dict[str, str]]] = []

    for fixture in fixtures:
        if str(fixture.get("status") or "").upper() == "COMPLETED":
            continue
        fixture_url = str(fixture.get("revsports_match_url") or "").strip()
        source = sources_by_url.get(fixture_url)
        if source is None:
            continue
        association_name = str(source.get("association_name") or "").strip()
        config = ASSOCIATION_CONFIG.get(association_name)
        association = associations_by_name.get(association_name)
        if config is None or association is None:
            continue

        fixture_start = parse_timestamp(fixture.get("fixture_date"))
        if fixture_start is None:
            continue
        expected_finish = parse_timestamp(fixture.get("scheduled_end_at"))
        if expected_finish is None:
            expected_finish = fixture_start + timedelta(
                minutes=_duration_minutes(association)
            )
        age = as_of - expected_finish
        if age < timedelta(0) or age > MAX_TARGET_AGE:
            continue

        last_seen = parse_timestamp(source.get("last_seen_at"))
        retry_threshold = max(expected_finish, as_of - RETRY_INTERVAL)
        if last_seen is not None and last_seen > retry_threshold:
            continue

        portal_url = str(config["portal_url"])
        safe_match_url = validate_source_url(
            fixture_url,
            portal_url=portal_url,
            path_suffix_pattern=r"/game/\d+",
        )
        if not safe_match_url:
            continue

        raw_data = source.get("raw_data")
        raw = raw_data if isinstance(raw_data, dict) else {}
        home_team_url = validate_source_url(
            raw.get("home_team_url"),
            portal_url=portal_url,
            path_suffix_pattern=r"/games/team/\d+/\d+",
        )
        away_team_url = validate_source_url(
            raw.get("away_team_url"),
            portal_url=portal_url,
            path_suffix_pattern=r"/games/team/\d+/\d+",
        )
        if not home_team_url or not away_team_url:
            continue
        venue_url = validate_source_url(
            raw.get("revsports_venue_url"),
            portal_url=portal_url,
            path_suffix_pattern=r"/venues/\d+/\d+",
        )

        game_id_match = re.search(r"/game/(\d+)$", safe_match_url)
        if game_id_match is None:
            continue

        selected.append(
            (
                expected_finish,
                {
                    "fixture_id": str(fixture.get("id") or ""),
                    "game_id": game_id_match.group(1),
                    "match_url": safe_match_url,
                    "association_name": association_name,
                    "portal_url": portal_url,
                    "output_dir": str(config["output_dir"]),
                    "source_name": str(config["source_name"]),
                    "competition_name": str(source.get("competition_name") or ""),
                    "grade": str(source.get("grade") or ""),
                    "round_name": str(source.get("round_name") or ""),
                    "competition_id": str(raw.get("revsports_competition_id") or ""),
                    "grade_id": str(raw.get("revsports_grade_id") or ""),
                    "home_team_url": home_team_url,
                    "away_team_url": away_team_url,
                    "home_team_label": str(
                        raw.get("home_team_label")
                        or source.get("home_team_name")
                        or ""
                    ),
                    "away_team_label": str(
                        raw.get("away_team_label")
                        or source.get("away_team_name")
                        or ""
                    ),
                    "game_date": str(source.get("game_date") or ""),
                    "game_time": str(source.get("game_time") or "")[:5],
                    "venue": str(source.get("venue_name") or ""),
                    "pitch": str(source.get("pitch_name") or ""),
                    "venue_url": venue_url,
                    "venue_id": str(raw.get("revsports_venue_id") or ""),
                    "umpire_1": str(raw.get("umpire_1") or ""),
                    "umpire_2": str(raw.get("umpire_2") or ""),
                },
            )
        )

    selected.sort(key=lambda item: (item[0], item[1]["game_id"]))
    return [target for _, target in selected[:max_targets]]


def _fetch_in_batches(client: Any, table: str, columns: str, field: str, values: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for start in range(0, len(values), 100):
        batch = values[start : start + 100]
        rows.extend(
            client.table(table).select(columns).in_(field, batch).execute().data
            or []
        )
    return rows


def main() -> None:
    from supabase import create_client

    try:
        from inspect_supabase_storage_usage import require_env, validate_target
    except ModuleNotFoundError:
        from scripts.inspect_supabase_storage_usage import require_env, validate_target

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

    now = datetime.now(timezone.utc)
    client = create_client(supabase_url, service_key)
    fixtures = (
        client.table("fixtures")
        .select(
            "id,fixture_date,scheduled_end_at,status,revsports_match_url"
        )
        .gte("fixture_date", (now - MAX_TARGET_AGE - timedelta(hours=4)).isoformat())
        .lte("fixture_date", now.isoformat())
        .execute()
        .data
        or []
    )
    match_urls = sorted(
        {
            str(row.get("revsports_match_url") or "")
            for row in fixtures
            if row.get("revsports_match_url")
        }
    )
    source_rows = _fetch_in_batches(
        client,
        "source_revsports_matches",
        "match_url,association_name,competition_name,grade,round_name,"
        "game_date,game_time,venue_name,pitch_name,home_team_name,"
        "away_team_name,last_seen_at,raw_data",
        "match_url",
        match_urls,
    )
    associations = (
        client.table("associations")
        .select("name,default_match_duration_minutes")
        .execute()
        .data
        or []
    )
    targets = select_due_targets(
        fixtures,
        source_rows,
        associations,
        as_of=now,
    )
    payload = json.dumps({"include": targets}, separators=(",", ":"))
    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as output:
            output.write(f"matrix={payload}\n")
            output.write(f"count={len(targets)}\n")
    else:
        print(payload)
    print(f"Selected {len(targets)} due fixture(s).", file=sys.stderr)


if __name__ == "__main__":
    main()

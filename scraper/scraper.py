"""
Match Scraper - Headless (GitHub Actions version)
============================================================
Scrapes match results and player appearances from RevSports.
Runs without a GUI. Configure via environment variables below.

Output:
  ../data/{association}_results.csv
  ../data/{association}_results.json
  ../data/{association}_quality_report.txt

Version: 2026-06-15-final-clean-appearance-key-v1

Important model:
  - Round page is the fixture source.
  - Team page is used to split club_name and team.
  - Player match card is used for player attendance/goals/cards.
  - CSV keeps club/team separately so Supabase can map using
    association + competition_name + grade + club_name + team + revsports_team_id.
"""

from __future__ import annotations

import csv
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

VERSION = "2026-06-15-final-clean-appearance-key-v1"

# ----------------------------------------------------------------------------
# CONFIG
# ----------------------------------------------------------------------------

PORTAL_URL = os.getenv("PORTAL_URL", "https://www.revolutionise.com.au/hockeyballarat")
ASSOCIATION_NAME = os.getenv("ASSOCIATION_NAME", "Hockey Ballarat")
ONLY_GRADES = os.getenv("ONLY_GRADES", "")
ONLY_ROUNDS = os.getenv("ONLY_ROUNDS", "")
ONLY_TEAM = os.getenv("ONLY_TEAM", "")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "../data")
DELAY = float(os.getenv("SCRAPE_DELAY", "0.8") or "0.8")
UPSERT_SUPABASE = os.getenv("UPSERT_SUPABASE", "false").strip().lower() in {"1", "true", "yes", "y"}
UPSERT_SUPABASE_V2 = os.getenv("UPSERT_SUPABASE_V2", "false").strip().lower() in {"1", "true", "yes", "y"}

only_grades = [g.strip() for g in ONLY_GRADES.split(",") if g.strip()] or None
only_rounds = [r.strip() for r in ONLY_ROUNDS.split(",") if r.strip()] or None
only_team = ONLY_TEAM.strip() or None

OUTPUT_COLUMNS = [
    "association",
    "competition_name",
    "grade",
    "round",
    "game_date",
    "game_time",
    "venue",
    "pitch",
    "home_club_name",
    "home_team",
    "home_team_label",
    "home_team_url",
    "home_revsports_team_id",
    "away_club_name",
    "away_team",
    "away_team_label",
    "away_team_url",
    "away_revsports_team_id",
    "home_score",
    "away_score",
    "is_bye",
    "umpire_1",
    "umpire_2",
    "team_side",
    "club_name",
    "team",
    "team_label",
    "team_url",
    "revsports_team_id",
    "player_name",
    "jersey",
    "is_goalkeeper",
    "is_captain",
    "attended",
    "is_fillin",
    "is_removed",
    "revsports_player_id",
    "goals",
    "green_cards",
    "yellow_cards",
    "red_cards",
    "match_url",
    "scraped_at",
    "appearance_key",
    "revsports_competition_id",
    "revsports_grade_id",
    "revsports_venue_id",
    "revsports_venue_url",
    "revsports_match_id",
]

QUALITY_WARNINGS: list[str] = []


# ----------------------------------------------------------------------------
# SMALL HELPERS
# ----------------------------------------------------------------------------

def clean_text(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def build_appearance_key(row: dict) -> str:
    """Build one stable identity string per scraped appearance row.

    The key is used as the Supabase upsert key. It avoids name-only matching
    so same-named players on the same team can stay separate when RevSports
    player IDs are available.
    """
    match_url = clean_text(row.get("match_url"))
    player_name = clean_text(row.get("player_name"))
    player_id = clean_text(row.get("revsports_player_id"))
    team_id = clean_text(row.get("revsports_team_id"))
    team_url = clean_text(row.get("team_url"))
    team_side = clean_text(row.get("team_side"))
    club_name = clean_text(row.get("club_name"))
    team = clean_text(row.get("team"))
    jersey = clean_text(row.get("jersey"))

    if team_id:
        team_identity = team_id
    elif team_url:
        team_identity = team_url
    else:
        team_identity = f"{team_side}/{club_name}/{team}"

    # Fixture-only placeholder row, used when RevSports does not expose players.
    if player_name == "NO_PLAYERS":
        return f"{match_url}|fixture-only"

    # Normal case: RevSports gives each player a unique player ID.
    if player_id:
        return f"{match_url}|{team_identity}|{player_id}"

    # Fallback for rare no-ID player rows. Status fields are deliberately
    # excluded so status changes update the same row instead of creating a
    # second appearance.
    return f"{match_url}|{team_identity}|{player_name.lower()}|{jersey}"


def bool_text(value):
    if value is None:
        return ""
    return "TRUE" if bool(value) else "FALSE"


def bool_from_text(value) -> bool:
    if isinstance(value, bool):
        return value
    return clean_text(value).upper() == "TRUE"


def int_or_none(value):
    value_text = clean_text(value)
    if not value_text or not re.match(r"^\d+$", value_text):
        return None
    return int(value_text)


def max_numeric_text(*values):
    nums = [n for n in (int_or_none(v) for v in values) if n is not None]
    return str(max(nums)) if nums else ""


def nullable_text(value):
    value_text = clean_text(value)
    return value_text or None


def nullable_int(value):
    return int_or_none(value)


def nullable_time_text(value):
    value_text = clean_text(value)
    if not value_text:
        return None
    return f"{value_text}:00" if re.match(r"^\d{1,2}:\d{2}$", value_text) else value_text


def nullable_bool(value):
    if value in (None, ""):
        return None
    return bool_from_text(value)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_url(href: str, page_url: str) -> str:
    if not href:
        return ""
    if href.startswith("http"):
        return href
    parsed = urlparse(page_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    return base + href if href.startswith("/") else base + "/" + href


def path_matches(href: str, pattern: str) -> bool:
    return bool(re.search(pattern, urlparse(href).path))


def extract_revsports_team_id(team_url: str) -> str:
    """Extract team ID from /games/team/{competition_id}/{team_id}."""
    match = re.search(r"/games/team/\d+/(\d+)$", urlparse(team_url or "").path)
    return match.group(1) if match else ""


def extract_player_id_from_row(row) -> str:
    link = row.find("a", href=True)
    if not link:
        return ""
    match = re.search(r"/statistics/([A-Za-z0-9]+)", link["href"])
    return match.group(1) if match else ""


def build_team_label(club_name: str, team_name: str) -> str:
    club_name = clean_text(club_name)
    team_name = clean_text(team_name)
    if club_name and team_name and club_name.lower() == team_name.lower():
        return club_name
    if club_name and team_name:
        return f"{club_name} {team_name}".strip()
    return club_name or team_name


def split_people(text: str) -> list[str]:
    text = clean_text(text)
    if not text:
        return []
    people = [clean_text(p) for p in re.split(r";|\n", text)]
    blocked = {"umpire", "umpires", "details", "venue", "date & time", "match card", "subvenue"}
    return [
        p
        for p in people
        if p
        and p.lower() not in blocked
        and not re.match(r"^round\s+\d+", p, flags=re.IGNORECASE)
    ]


def format_date_from_round_text(text: str) -> str:
    """Convert 'Sun 17 May 2026' to '2026-05-17'."""
    text = clean_text(text)
    try:
        return datetime.strptime(text, "%a %d %b %Y").strftime("%Y-%m-%d")
    except ValueError:
        return text


def role_flag(role_text: str, pattern: str) -> bool:
    """Return True when a RevSports bracket label contains a role word."""
    return bool(re.search(pattern, clean_text(role_text), flags=re.IGNORECASE))


def unknown_role_part(role_text: str) -> str:
    """Return any bracket role text that is not recognised as goalkeeper or captain.

    The role column is not written to the CSV. This helper only lets the
    quality report warn us when RevSports starts using a new bracket value.
    """
    role_text = clean_text(role_text)
    if not role_text:
        return ""

    # Remove the role words we understand, then see if anything is left.
    unknown = re.sub(
        r"\bgoal\s*keeper\b|\bgoalkeeper\b|\bkeeper\b|\bgk\b|\bcaptain\b",
        " ",
        role_text,
        flags=re.IGNORECASE,
    )
    unknown = re.sub(r"[\/\\,;&+|()\[\]{}:_-]+", " ", unknown)
    return clean_text(unknown)


# ----------------------------------------------------------------------------
# MERGE / QUALITY HELPERS
# ----------------------------------------------------------------------------


def normalise_boolean_columns(rows: list[dict]) -> list[dict]:
    for row in rows:
        for field in ["attended", "is_goalkeeper", "is_captain", "is_fillin", "is_removed"]:
            value = row.get(field)
            row[field] = "" if value is None or value == "" else bool_text(bool_from_text(value))
    return rows


def merge_by_appearance_key(rows: list[dict]) -> list[dict]:
    """Collapse duplicate raw rows that describe the same player appearance.

    RevSports can list a player once in the roster and again in the match-card
    stats. The appearance_key correctly identifies those as the same player in
    the same match, so this merge keeps the best data from both rows before the
    CSV/JSON/Supabase upload step.
    """
    import collections

    boolean_or_fields = {"attended", "is_captain", "is_goalkeeper"}
    numeric_stats = {"goals", "green_cards", "yellow_cards", "red_cards"}

    def is_true(value) -> bool:
        if isinstance(value, bool):
            return value
        return clean_text(value).lower() in {"true", "1", "yes", "y"}

    groups = collections.OrderedDict()
    for row in normalise_boolean_columns(rows):
        key = clean_text(row.get("appearance_key"))
        groups.setdefault(key, []).append(row)

    merged_rows: list[dict] = []

    for key, group in groups.items():
        if len(group) == 1:
            merged_rows.append(group[0])
            continue

        out = dict(group[0])
        all_fields = set()
        for row in group:
            all_fields.update(row.keys())

        for field in all_fields:
            values = [row.get(field) for row in group]

            if field in boolean_or_fields:
                # Any row says yes -> yes.
                out[field] = bool_text(any(is_true(v) for v in values))

            elif field == "is_fillin":
                # Only true if every source row says true. If one row is the
                # normal roster row, the merged player is not a fill-in.
                present = [is_true(v) for v in values if clean_text(v) != ""]
                out[field] = bool_text(bool(present) and all(present))

            elif field == "is_removed":
                # Handled after stats/attended are merged.
                continue

            elif field in numeric_stats:
                nums = [n for n in (int_or_none(v) for v in values) if n is not None]
                out[field] = str(max(nums)) if nums else ""

            else:
                # Text/context fields: keep the first non-blank value.
                non_blank = [v for v in values if clean_text(v) != ""]
                out[field] = non_blank[0] if non_blank else out.get(field, "")

        has_stats = any((int_or_none(out.get(field)) or 0) > 0 for field in numeric_stats)
        attended = is_true(out.get("attended"))
        removed_seen = any(is_true(row.get("is_removed")) for row in group)

        # If there is evidence the player played or recorded stats, do not mark
        # the merged row as removed.
        final_removed = False if attended or has_stats else removed_seen
        out["is_removed"] = bool_text(final_removed)
        if final_removed:
            out["attended"] = "FALSE"

        flags = []
        if bool_from_text(out.get("is_fillin")):
            flags.append("fill-in")
        if bool_from_text(out.get("is_removed")):
            flags.append("removed")
        flag_text = f" ({', '.join(flags)})" if flags else ""

        QUALITY_WARNINGS.append(
            "Merged duplicate player appearance: "
            f"{out.get('player_name', '')} - {out.get('club_name', '')} - {out.get('team', '')} - "
            f"{out.get('match_url', '')}{flag_text}; {len(group)} source rows became 1 row."
        )

        merged_rows.append(out)

    return merged_rows


def validate_appearance_keys(rows: list[dict]) -> None:
    """Fail loudly if appearance_key is missing or duplicated after merging."""
    seen: set[str] = set()
    duplicates: set[str] = set()
    blank_lines: list[int] = []

    for line_number, row in enumerate(rows, start=2):
        key = clean_text(row.get("appearance_key"))
        if not key:
            blank_lines.append(line_number)
            continue
        if key in seen:
            duplicates.add(key)
        seen.add(key)

    if blank_lines or duplicates:
        parts = []
        if blank_lines:
            parts.append(f"blank appearance_key on CSV line(s): {blank_lines[:20]}")
        if duplicates:
            sample = sorted(duplicates)[:10]
            parts.append(f"duplicate appearance_key value(s): {sample}")
        raise RuntimeError("Appearance key validation failed - " + "; ".join(parts))


def run_quality_check(csv_rows: list[dict], output_dir: str, association: str) -> int:
    required_fixture = [
        "association",
        "competition_name",
        "grade",
        "round",
        "game_date",
        "match_url",
        "appearance_key",
    ]
    required_player = ["team_side", "club_name", "team_url", "revsports_team_id", "player_name"]
    numeric = ["home_score", "away_score", "goals", "green_cards", "yellow_cards", "red_cards", "jersey"]
    boolean = ["attended", "is_goalkeeper", "is_captain", "is_fillin", "is_removed"]

    issues: list[str] = []
    warnings: list[str] = list(QUALITY_WARNINGS)

    seen_appearance_keys: set[str] = set()
    duplicate_appearance_keys: set[str] = set()
    for row in csv_rows:
        key = clean_text(row.get("appearance_key"))
        if key in seen_appearance_keys:
            duplicate_appearance_keys.add(key)
        elif key:
            seen_appearance_keys.add(key)
    for key in sorted(duplicate_appearance_keys)[:20]:
        issues.append(f"Duplicate appearance_key after merge: {key}")

    for i, row in enumerate(csv_rows, start=2):
        is_fixture_only = clean_text(row.get("player_name")) == "NO_PLAYERS"

        is_bye = bool_from_text(row.get("is_bye"))
        for field in required_fixture:
            if field == "game_date" and is_bye:
                continue
            value = clean_text(row.get(field, ""))
            if not value or value.lower() == "details" or value == "0":
                issues.append(f"Line {i}: missing or junk required fixture field '{field}'")

        if not is_fixture_only:
            for field in required_player:
                value = clean_text(row.get(field, ""))
                if not value or value.lower() == "details" or value == "0":
                    issues.append(f"Line {i}: missing or junk required player/team field '{field}'")

            if not clean_text(row.get("revsports_player_id")):
                warnings.append(
                    f"Line {i}: player has no revsports_player_id: "
                    f"{row.get('player_name', '')} - {row.get('club_name', '')} - {row.get('team', '')} - {row.get('match_url', '')}"
                )

        for field in numeric:
            value = clean_text(row.get(field, ""))
            if value and not re.match(r"^\d+$", value):
                issues.append(f"Line {i}: field '{field}' is not numeric: {value!r}")

        for field in boolean:
            value = clean_text(row.get(field, ""))
            if value and value.upper() not in {"TRUE", "FALSE"}:
                issues.append(f"Line {i}: field '{field}' is not TRUE/FALSE: {value!r}")

    # Use team_side rather than team name because team names may be non-unique.
    fixture_groups: dict[str, list[dict]] = {}
    for row in csv_rows:
        fixture_groups.setdefault(clean_text(row.get("match_url")), []).append(row)

    for match_url, fixture_rows in fixture_groups.items():
        if not match_url or not fixture_rows:
            continue
        first = fixture_rows[0]
        home_score = int_or_none(first.get("home_score"))
        away_score = int_or_none(first.get("away_score"))
        if home_score is None or away_score is None:
            continue

        home_goal_total = sum(int_or_none(r.get("goals")) or 0 for r in fixture_rows if clean_text(r.get("team_side")) == "home")
        away_goal_total = sum(int_or_none(r.get("goals")) or 0 for r in fixture_rows if clean_text(r.get("team_side")) == "away")

        if home_goal_total != home_score or away_goal_total != away_score:
            warnings.append(
                "RevSports goal total mismatch: "
                f"{match_url} - score "
                f"{first.get('home_club_name', '')} {first.get('home_team', '')} {home_score} - {away_score} "
                f"{first.get('away_club_name', '')} {first.get('away_team', '')}; "
                f"listed player goals home {home_goal_total} - away {away_goal_total}."
            )

    lines = [
        f"DATA QUALITY REPORT - {association}",
        f"Generated: {datetime.now().isoformat()}",
        "-" * 60,
        f"Rows checked: {len(csv_rows):,}",
        f"Issues found: {len(issues):,}",
        f"Warnings found: {len(warnings):,}",
        "",
    ]

    if issues:
        lines.append("ISSUES")
        lines.append("-" * 60)
        lines.extend(issues[:100])
        if len(issues) > 100:
            lines.append(f"...plus {len(issues) - 100} more issues")
        lines.append("")
    else:
        lines.append("No issues found by the basic checker.")
        lines.append("")

    if warnings:
        lines.append("WARNINGS")
        lines.append("-" * 60)
        lines.extend(warnings[:150])
        if len(warnings) > 150:
            lines.append(f"...plus {len(warnings) - 150} more warnings")
    else:
        lines.append("No warnings found.")

    report_text = "\n".join(lines)
    print("\n" + report_text)

    assoc_slug = association.lower().replace(" ", "_")
    report_path = os.path.join(output_dir, f"{assoc_slug}_quality_report.txt")
    os.makedirs(output_dir, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_text)
    print(f"Quality report saved: {report_path}")

    return len(issues)


# ----------------------------------------------------------------------------
# SUPABASE V2 SOURCE WRITER
# ----------------------------------------------------------------------------

def batched(items: list, size: int = 200):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def source_value(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def fetch_existing_rows(client, table_name: str, key_column: str, keys: list[str]) -> dict[str, dict]:
    existing: dict[str, dict] = {}
    clean_keys = sorted({k for k in keys if k})
    for key_batch in batched(clean_keys, 200):
        result = client.table(table_name).select("*").in_(key_column, key_batch).execute()
        for row in result.data or []:
            existing[str(row.get(key_column))] = row
    return existing


def add_changes(
    changes: list[dict],
    existing: dict | None,
    new_row: dict,
    tracked_fields: list[str],
    scrape_run_id: str,
    source_table: str,
    source_key: str,
) -> None:
    if not existing:
        return

    for field in tracked_fields:
        old_value = source_value(existing.get(field))
        new_value = source_value(new_row.get(field))
        if old_value != new_value:
            changes.append({
                "scrape_run_id": scrape_run_id,
                "source_table": source_table,
                "source_row_id": existing.get("id"),
                "source_key": source_key,
                "field_name": field,
                "old_value": old_value,
                "new_value": new_value,
                "change_type": "updated",
            })


def build_source_match_rows(csv_rows: list[dict], scrape_run_id: str) -> list[dict]:
    rows_by_url: dict[str, dict] = {}
    for row in csv_rows:
        match_url = clean_text(row.get("match_url"))
        if not match_url or match_url in rows_by_url:
            continue

        round_name = nullable_text(row.get("round"))
        round_number = None
        if round_name:
            match = re.search(r"\d+", round_name)
            round_number = int(match.group(0)) if match else None

        rows_by_url[match_url] = {
            "scrape_run_id": scrape_run_id,
            "association_name": clean_text(row.get("association")) or ASSOCIATION_NAME,
            "competition_name": nullable_text(row.get("competition_name")),
            "grade": nullable_text(row.get("grade")),
            "round_name": round_name,
            "round_number": round_number,
            "match_url": match_url,
            "game_date": nullable_text(row.get("game_date")),
            "game_time": nullable_time_text(row.get("game_time")),
            "venue_name": nullable_text(row.get("venue")),
            "pitch_name": nullable_text(row.get("pitch")),
            "home_club_name": nullable_text(row.get("home_club_name")),
            "home_team_name": nullable_text(row.get("home_team")),
            "home_revsports_team_id": nullable_text(row.get("home_revsports_team_id")),
            "away_club_name": nullable_text(row.get("away_club_name")),
            "away_team_name": nullable_text(row.get("away_team")),
            "away_revsports_team_id": nullable_text(row.get("away_revsports_team_id")),
            "home_score": nullable_int(row.get("home_score")),
            "away_score": nullable_int(row.get("away_score")),
            "umpire_1": nullable_text(row.get("umpire_1")),
            "umpire_2": nullable_text(row.get("umpire_2")),
            "raw_data": {key: row.get(key) for key in OUTPUT_COLUMNS if key in row},
            "last_seen_at": utc_now_iso(),
            "scraped_at": utc_now_iso(),
        }

    return list(rows_by_url.values())


def build_source_match_team_rows(csv_rows: list[dict], match_ids_by_url: dict[str, str]) -> list[dict]:
    rows_by_key: dict[str, dict] = {}
    for row in csv_rows:
        match_url = clean_text(row.get("match_url"))
        match_id = match_ids_by_url.get(match_url)
        if not match_id:
            continue

        team_specs = [
            {
                "side": "home",
                "club_name": nullable_text(row.get("home_club_name")),
                "team_name": nullable_text(row.get("home_team")),
                "team_label": nullable_text(row.get("home_team_label")),
                "revsports_team_id": nullable_text(row.get("home_revsports_team_id")),
                "team_url": nullable_text(row.get("home_team_url")),
                "score": nullable_int(row.get("home_score")),
            },
            {
                "side": "away",
                "club_name": nullable_text(row.get("away_club_name")),
                "team_name": nullable_text(row.get("away_team")),
                "team_label": nullable_text(row.get("away_team_label")),
                "revsports_team_id": nullable_text(row.get("away_revsports_team_id")),
                "team_url": nullable_text(row.get("away_team_url")),
                "score": nullable_int(row.get("away_score")),
            },
        ]

        for spec in team_specs:
            if not any(spec.get(field) for field in ("club_name", "team_name", "team_label", "revsports_team_id", "team_url")):
                continue
            key = f"{match_id}|{spec['side']}"
            if key not in rows_by_key:
                rows_by_key[key] = {
                    "match_id": match_id,
                    **spec,
                    "raw_data": {
                        "match_url": match_url,
                        "association": row.get("association"),
                        "competition_name": row.get("competition_name"),
                        "grade": row.get("grade"),
                    },
                    "last_seen_at": utc_now_iso(),
                    "scraped_at": utc_now_iso(),
                }

    return list(rows_by_key.values())


def build_source_appearance_rows(
    csv_rows: list[dict],
    scrape_run_id: str,
    match_ids_by_url: dict[str, str],
    match_team_ids_by_key: dict[str, str],
) -> list[dict]:
    rows = []
    for row in csv_rows:
        if clean_text(row.get("player_name")) == "NO_PLAYERS":
            continue

        match_url = clean_text(row.get("match_url"))
        match_id = match_ids_by_url.get(match_url)
        side = clean_text(row.get("team_side"))
        match_team_id = match_team_ids_by_key.get(f"{match_id}|{side}") if match_id else None

        rows.append({
            "scrape_run_id": scrape_run_id,
            "match_id": match_id,
            "match_team_id": match_team_id,
            "appearance_key": clean_text(row.get("appearance_key")),
            "team_side": side or None,
            "club_name": nullable_text(row.get("club_name")),
            "team_name": nullable_text(row.get("team")),
            "revsports_team_id": nullable_text(row.get("revsports_team_id")),
            "player_name": clean_text(row.get("player_name")),
            "revsports_player_id": nullable_text(row.get("revsports_player_id")),
            "jersey": nullable_text(row.get("jersey")),
            "attended": nullable_bool(row.get("attended")),
            "is_goalkeeper": bool_from_text(row.get("is_goalkeeper")),
            "is_captain": bool_from_text(row.get("is_captain")),
            "is_fillin": bool_from_text(row.get("is_fillin")),
            "is_removed": bool_from_text(row.get("is_removed")),
            "goals": nullable_int(row.get("goals")) or 0,
            "green_cards": nullable_int(row.get("green_cards")) or 0,
            "yellow_cards": nullable_int(row.get("yellow_cards")) or 0,
            "red_cards": nullable_int(row.get("red_cards")) or 0,
            "raw_data": {key: row.get(key) for key in OUTPUT_COLUMNS if key in row},
            "last_seen_at": utc_now_iso(),
            "scraped_at": utc_now_iso(),
        })

    return rows


def build_external_entity_rows(csv_rows: list[dict]) -> list[dict]:
    entities: dict[tuple[str, str, str], dict] = {}

    def stable_external_id(*parts: str) -> str:
        return "|".join(clean_text(part) for part in parts if clean_text(part))

    for row in csv_rows:
        association = clean_text(row.get("association")) or ASSOCIATION_NAME
        competition = nullable_text(row.get("competition_name"))
        grade = nullable_text(row.get("grade"))
        venue = nullable_text(row.get("venue"))
        pitch = nullable_text(row.get("pitch"))
        match_url = clean_text(row.get("match_url"))

        if grade:
            grade_id = stable_external_id(association, competition or "", "grade", grade)
            entities[("grade", grade_id, grade)] = {
                "source": "revsports",
                "entity_type": "grade",
                "external_id": grade_id,
                "external_name": grade,
                "association_name": association,
                "competition_name": competition,
                "grade": grade,
                "source_url": match_url or None,
                "raw_data": {"synthetic_external_id": True},
                "last_seen_at": utc_now_iso(),
            }

        if venue:
            venue_id = stable_external_id(association, "venue", venue)
            entities[("venue", venue_id, venue)] = {
                "source": "revsports",
                "entity_type": "venue",
                "external_id": venue_id,
                "external_name": venue,
                "association_name": association,
                "competition_name": competition,
                "grade": grade,
                "source_url": match_url or None,
                "raw_data": {"synthetic_external_id": True},
                "last_seen_at": utc_now_iso(),
            }

        if venue and pitch:
            pitch_id = stable_external_id(association, "pitch", venue, pitch)
            entities[("pitch", pitch_id, pitch)] = {
                "source": "revsports",
                "entity_type": "pitch",
                "external_id": pitch_id,
                "external_name": pitch,
                "association_name": association,
                "competition_name": competition,
                "grade": grade,
                "source_url": match_url or None,
                "raw_data": {"synthetic_external_id": True, "venue_name": venue},
                "last_seen_at": utc_now_iso(),
            }

        if match_url:
            entities[("match", match_url, match_url)] = {
                "source": "revsports",
                "entity_type": "match",
                "external_id": match_url,
                "external_name": match_url,
                "association_name": association,
                "competition_name": competition,
                "grade": grade,
                "source_url": match_url,
                "raw_data": {"round": row.get("round"), "game_date": row.get("game_date")},
                "last_seen_at": utc_now_iso(),
            }

        for side in ("home", "away"):
            team_id = clean_text(row.get(f"{side}_revsports_team_id"))
            team_name = clean_text(row.get(f"{side}_team"))
            club_name = clean_text(row.get(f"{side}_club_name"))
            if club_name:
                club_id = stable_external_id(association, "club", club_name)
                entities[("club", club_id, club_name)] = {
                    "source": "revsports",
                    "entity_type": "club",
                    "external_id": club_id,
                    "external_name": club_name,
                    "association_name": association,
                    "competition_name": competition,
                    "grade": grade,
                    "club_name": club_name,
                    "source_url": nullable_text(row.get(f"{side}_team_url")) or match_url or None,
                    "raw_data": {"synthetic_external_id": True},
                    "last_seen_at": utc_now_iso(),
                }
            if team_id and team_name:
                entities[("team", team_id, team_name)] = {
                    "source": "revsports",
                    "entity_type": "team",
                    "external_id": team_id,
                    "external_name": team_name,
                    "association_name": association,
                    "competition_name": competition,
                    "grade": grade,
                    "club_name": club_name or None,
                    "team_name": team_name,
                    "source_url": nullable_text(row.get(f"{side}_team_url")),
                    "raw_data": {"team_label": row.get(f"{side}_team_label")},
                    "last_seen_at": utc_now_iso(),
                }

        player_id = clean_text(row.get("revsports_player_id"))
        player_name = clean_text(row.get("player_name"))
        if player_id and player_name and player_name != "NO_PLAYERS":
            entities[("player", player_id, player_name)] = {
                "source": "revsports",
                "entity_type": "player",
                "external_id": player_id,
                "external_name": player_name,
                "association_name": association,
                "competition_name": competition,
                "grade": grade,
                "club_name": nullable_text(row.get("club_name")),
                "team_name": nullable_text(row.get("team")),
                "raw_data": {"jersey": row.get("jersey"), "is_fillin": row.get("is_fillin")},
                "last_seen_at": utc_now_iso(),
            }

    return list(entities.values())


def log_source_changes(client, scrape_run_id: str, match_rows: list[dict], team_rows: list[dict], appearance_rows: list[dict]) -> int:
    changes: list[dict] = []

    existing_matches = fetch_existing_rows(
        client,
        "source_revsports_matches",
        "match_url",
        [row["match_url"] for row in match_rows],
    )
    for row in match_rows:
        add_changes(
            changes,
            existing_matches.get(row["match_url"]),
            row,
            [
                "game_date",
                "game_time",
                "venue_name",
                "pitch_name",
                "home_club_name",
                "home_team_name",
                "away_club_name",
                "away_team_name",
                "home_score",
                "away_score",
                "umpire_1",
                "umpire_2",
            ],
            scrape_run_id,
            "source_revsports_matches",
            row["match_url"],
        )

    existing_appearances = fetch_existing_rows(
        client,
        "source_revsports_player_appearances",
        "appearance_key",
        [row["appearance_key"] for row in appearance_rows],
    )
    for row in appearance_rows:
        add_changes(
            changes,
            existing_appearances.get(row["appearance_key"]),
            row,
            [
                "team_side",
                "club_name",
                "team_name",
                "revsports_team_id",
                "player_name",
                "revsports_player_id",
                "jersey",
                "attended",
                "is_goalkeeper",
                "is_captain",
                "is_fillin",
                "is_removed",
                "goals",
                "green_cards",
                "yellow_cards",
                "red_cards",
            ],
            scrape_run_id,
            "source_revsports_player_appearances",
            row["appearance_key"],
        )

    # Team rows use a composite unique key, so fetch by match IDs and compare in memory.
    match_ids = sorted({row["match_id"] for row in team_rows if row.get("match_id")})
    existing_teams: dict[str, dict] = {}
    for id_batch in batched(match_ids, 200):
        result = client.table("source_revsports_match_teams").select("*").in_("match_id", id_batch).execute()
        for row in result.data or []:
            existing_teams[f"{row.get('match_id')}|{row.get('side')}"] = row
    for row in team_rows:
        key = f"{row.get('match_id')}|{row.get('side')}"
        add_changes(
            changes,
            existing_teams.get(key),
            row,
            ["club_name", "team_name", "team_label", "revsports_team_id", "team_url", "score"],
            scrape_run_id,
            "source_revsports_match_teams",
            key,
        )

    for change_batch in batched(changes, 200):
        client.table("source_revsports_change_log").insert(change_batch).execute()

    return len(changes)


def upsert_revsports_v2_source(client, csv_rows: list[dict], quality_issue_count: int) -> None:
    if not csv_rows:
        raise RuntimeError("UPSERT_SUPABASE_V2 is true, but there are no rows to upsert.")
    if quality_issue_count:
        raise RuntimeError(f"UPSERT_SUPABASE_V2 is true, but the quality check found {quality_issue_count} issue(s).")

    run_started_at = utc_now_iso()
    run_row = {
        "source": "revsports",
        "scraper_name": "fixtures_match_cards",
        "association_name": ASSOCIATION_NAME,
        "started_at": run_started_at,
        "status": "running",
        "rows_found": len(csv_rows),
        "source_config": {
            "portal_url": PORTAL_URL,
            "only_grades": only_grades,
            "only_rounds": only_rounds,
            "only_team": only_team,
            "version": VERSION,
        },
    }
    run_result = client.table("source_scrape_runs").insert(run_row).execute()
    scrape_run_id = run_result.data[0]["id"]

    try:
        match_rows = build_source_match_rows(csv_rows, scrape_run_id)
        existing_change_count = log_source_changes(client, scrape_run_id, match_rows, [], [])

        for batch in batched(match_rows, 200):
            client.table("source_revsports_matches").upsert(batch, on_conflict="match_url").execute()

        match_ids_by_url = {}
        for batch in batched([row["match_url"] for row in match_rows], 200):
            result = client.table("source_revsports_matches").select("id, match_url").in_("match_url", batch).execute()
            for row in result.data or []:
                match_ids_by_url[row["match_url"]] = row["id"]

        team_rows = build_source_match_team_rows(csv_rows, match_ids_by_url)
        appearance_rows = []
        team_change_count = log_source_changes(client, scrape_run_id, [], team_rows, [])

        for batch in batched(team_rows, 200):
            client.table("source_revsports_match_teams").upsert(batch, on_conflict="match_id,side").execute()

        match_team_ids_by_key = {}
        match_ids = sorted({row["match_id"] for row in team_rows if row.get("match_id")})
        for batch in batched(match_ids, 200):
            result = client.table("source_revsports_match_teams").select("id, match_id, side").in_("match_id", batch).execute()
            for row in result.data or []:
                match_team_ids_by_key[f"{row['match_id']}|{row['side']}"] = row["id"]

        appearance_rows = build_source_appearance_rows(csv_rows, scrape_run_id, match_ids_by_url, match_team_ids_by_key)
        appearance_change_count = log_source_changes(client, scrape_run_id, [], [], appearance_rows)

        for batch in batched(appearance_rows, 200):
            client.table("source_revsports_player_appearances").upsert(batch, on_conflict="appearance_key").execute()

        external_rows = build_external_entity_rows(csv_rows)
        external_with_ids = [row for row in external_rows if row.get("external_id")]
        for batch in batched(external_with_ids, 200):
            client.table("external_entities").upsert(batch, on_conflict="source,entity_type,external_id").execute()

        rows_written = len(match_rows) + len(team_rows) + len(appearance_rows) + len(external_with_ids)
        change_count = existing_change_count + team_change_count + appearance_change_count
        client.table("source_scrape_runs").update({
            "status": "success",
            "finished_at": utc_now_iso(),
            "rows_written": rows_written,
        }).eq("id", scrape_run_id).execute()

        print(
            "OK: Supabase V2 source upsert complete - "
            f"{len(match_rows)} matches, {len(team_rows)} match teams, "
            f"{len(appearance_rows)} appearances, {len(external_with_ids)} external entities, "
            f"{change_count} change log row(s)."
        )

    except Exception as e:
        client.table("source_scrape_runs").update({
            "status": "failed",
            "finished_at": utc_now_iso(),
            "error_message": str(e)[:1000],
        }).eq("id", scrape_run_id).execute()
        raise


# ----------------------------------------------------------------------------
# HTTP / PAGE PARSERS
# ----------------------------------------------------------------------------

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
    })
    return s


def get_soup(session: requests.Session, url: str) -> BeautifulSoup:
    print(f"  Fetching: {url}")
    time.sleep(DELAY)
    resp = session.get(url, timeout=20)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for hidden in soup.select(".d-none, .d-lg-none"):
        hidden.decompose()
    return soup


def split_venue_and_pitch(venue_line: str, pitch_line: str | None = None) -> tuple[str, str]:
    venue_line = clean_text(venue_line)
    pitch_line = clean_text(pitch_line)
    if pitch_line:
        return venue_line, pitch_line
    if " - " in venue_line:
        venue, pitch = venue_line.split(" - ", 1)
        return clean_text(venue), clean_text(pitch)
    return venue_line, "Full Pitch"


def split_club_and_team(full_name: str, grade_name: str = "") -> tuple[str, str]:
    """Split team page heading using: competition - club grade team.

    Everything after the dot/bullet contains club + known grade + team.
    Everything before the known grade is club. Everything after is team.
    If either side is blank, reuse the other side so club and team both stay usable.
    """
    full_name = clean_text(full_name)
    for separator in ["\u00b7", "\u2022", "|"]:
        if separator in full_name:
            full_name = clean_text(full_name.split(separator, 1)[-1])
            break

    grade_name = clean_text(grade_name)
    if grade_name:
        # Prefer a word-boundary style match so "Men" does not match inside another word.
        pattern = re.compile(rf"(?<!\S){re.escape(grade_name)}(?!\S)", re.IGNORECASE)
        match = pattern.search(full_name)
        if not match:
            match = re.search(re.escape(grade_name), full_name, flags=re.IGNORECASE)
        if match:
            club = clean_text(full_name[:match.start()])
            team = clean_text(full_name[match.end():])
            if not club and team:
                club = team
            if club and not team:
                team = club
            return club, team

    # Fallback: repeated prefix pattern, e.g. Waratahs Waratahs Men.
    words = full_name.split()
    max_prefix = min(4, len(words) // 2)
    for n in range(1, max_prefix + 1):
        if words[:n] == words[n:2 * n]:
            club = " ".join(words[:n])
            team = " ".join(words[n:])
            return club, team

    return "", full_name


def get_team_name_from_draws_page(session: requests.Session, team_url: str, grade_name: str) -> tuple[str, str]:
    try:
        soup = get_soup(session, team_url)
        for tag in ["h2", "h1", "h3"]:
            heading = soup.find(tag)
            if heading:
                full_text = heading.get_text(" ", strip=True)
                club, team = split_club_and_team(full_text, grade_name)
                return club, team
    except Exception as e:
        print(f"    WARNING: Could not fetch team page {team_url}: {e}")
    return "", ""


def get_all_grades(session: requests.Session, base_url: str) -> list[dict]:
    games_url = base_url.rstrip("/") + "/games"
    try:
        soup = get_soup(session, games_url)
    except Exception as e:
        print(f"WARNING: Could not fetch grades page: {e}")
        return []

    grades, seen = [], set()
    current_competition = "Unknown Competition"

    for tag in soup.find_all(True):
        if tag.name in ("h2", "h3", "h4", "strong", "p", "div"):
            child_grade_links = [
                a for a in tag.find_all("a", href=True)
                if path_matches(normalize_url(a["href"], games_url), r"/games/\d+/\d+$")
            ]
            text = tag.get_text(" ", strip=True)
            if text and not child_grade_links and 10 < len(text) < 160:
                if any(kw in text for kw in ["Competition", "Season", "Winter", "Summer", "Indoor", "Outdoor", "2026", "2025", "2024"]):
                    current_competition = text

        if tag.name == "a" and tag.get("href"):
            href = normalize_url(tag["href"], games_url)
            if href not in seen and path_matches(href, r"/games/\d+/\d+$"):
                seen.add(href)
                name = clean_text(tag.get_text(" ", strip=True))
                if name:
                    comp_id = ""
                    grade_id = ""
                    match_ids = re.search(r"/games/(\d+)/(\d+)$", urlparse(href).path)
                    if match_ids:
                        comp_id = match_ids.group(1)
                        grade_id = match_ids.group(2)
                    grades.append({
                        "name": name,
                        "url": href,
                        "competition_name": current_competition,
                        "competition_id": comp_id,
                        "grade_id": grade_id,
                    })

    return grades


def get_rounds(session: requests.Session, grade_url: str) -> list[dict]:
    try:
        soup = get_soup(session, grade_url)
    except Exception as e:
        print(f"  WARNING: Could not fetch rounds page: {e}")
        return []

    rounds, seen = [], set()
    for a in soup.find_all("a", href=True):
        href = normalize_url(a["href"], grade_url)
        if href not in seen and path_matches(href, r"/games/\d+/\d+/round/\d+"):
            seen.add(href)
            label = clean_text(a.get_text(" ", strip=True))
            if label:
                comp_id = ""
                grade_id = ""
                rnd_num = ""
                match_ids = re.search(r"/games/(\d+)/(\d+)/round/(\d+)", urlparse(href).path)
                if match_ids:
                    comp_id = match_ids.group(1)
                    grade_id = match_ids.group(2)
                    rnd_num = match_ids.group(3)
                rounds.append({
                    "round_label": label,
                    "url": href,
                    "competition_id": comp_id,
                    "grade_id": grade_id,
                    "round_number": rnd_num,
                })
    return rounds


def find_fixture_card(link_tag, game_url: str, round_url: str):
    node = link_tag
    for _ in range(12):
        node = node.parent
        if node is None or not hasattr(node, "find_all"):
            break
        anchors = [normalize_url(a["href"], round_url) for a in node.find_all("a", href=True)]
        text = node.get_text("\n", strip=True)
        has_current_game = game_url in anchors
        has_team_links = any(path_matches(h, r"/games/team/\d+/\d+$") for h in anchors)
        has_date_time = bool(re.search(r"\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+\w+\s+\d{4}\b", text))
        if has_current_game and (has_team_links or has_date_time):
            return node
    return None


def extract_round_card_details(card, round_url: str) -> dict:
    """Extract fixture-level context from the round page card.

    This is the main fixture source: visible team labels, team URLs, date/time,
    venue/pitch, score, and umpires.
    """
    details = {
        "team_urls": [],
        "team_labels": [],
        "round_date": "",
        "round_time": "",
        "round_venue": "",
        "round_pitch": "",
        "round_home_score": "",
        "round_away_score": "",
        "round_umpires": [],
        "round_venue_url": "",
        "round_venue_id": "",
    }
    if card is None:
        return details

    for hidden in card.select(".d-none, .d-lg-none"):
        hidden.decompose()

    for a in card.find_all("a", href=True):
        href = normalize_url(a["href"], round_url)
        if path_matches(href, r"/games/team/\d+/\d+$"):
            label = clean_text(a.get_text(" ", strip=True))
            if href not in details["team_urls"]:
                details["team_urls"].append(href)
                details["team_labels"].append(label)
        elif path_matches(href, r"/venues/\d+/\d+$"):
            details["round_venue_url"] = href
            venue_match = re.search(r"/venues/\d+/(\d+)$", urlparse(href).path)
            if venue_match:
                details["round_venue_id"] = venue_match.group(1)

    raw_text = card.get_text("\n", strip=True)
    lines = [clean_text(l) for l in raw_text.split("\n") if clean_text(l)]
    team_label_set = set(details["team_labels"])

    # Date/time.
    for i, line in enumerate(lines):
        if re.match(r"^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+\w+\s+\d{4}$", line):
            details["round_date"] = format_date_from_round_text(line)
            if i + 1 < len(lines) and re.match(r"^\d{1,2}:\d{2}$", lines[i + 1]):
                details["round_time"] = lines[i + 1]
            break

    # Score.
    score_match = re.search(r"\b(\d+)\s*-\s*(\d+)\b", raw_text)
    if score_match:
        details["round_home_score"] = score_match.group(1)
        details["round_away_score"] = score_match.group(2)

    # Umpires.
    for i, line in enumerate(lines):
        if line.lower() in {"umpire", "umpires"}:
            umpire_bits = []
            for candidate in lines[i + 1:i + 5]:
                low = candidate.lower()
                if low in {"details", "venue", "date & time", "match card"}:
                    break
                if re.match(r"^round\s+\d+", candidate, flags=re.IGNORECASE):
                    break
                if candidate in team_label_set:
                    break
                if re.match(r"^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+\w+\s+\d{4}$", candidate):
                    break
                umpire_bits.append(candidate)
            details["round_umpires"] = split_people("; ".join(umpire_bits))[:2]
            break

    # Venue and pitch. Use the area between date/time and team labels/score/umpires.
    collecting = False
    location_lines = []
    for line in lines:
        lower = line.lower()
        if re.match(r"^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+\w+\s+\d{4}$", line):
            collecting = True
            continue
        if collecting and re.match(r"^\d{1,2}:\d{2}$", line):
            continue
        if collecting:
            if line in team_label_set:
                break
            if re.match(r"^\d+\s*-\s*\d+$", line):
                break
            if lower in {"umpire", "umpires", "details", "byes"}:
                break
            location_lines.append(line)

    cleaned_location = []
    for line in location_lines:
        line = clean_text(line).strip(" -")
        if line and line not in cleaned_location:
            cleaned_location.append(line)

    if cleaned_location:
        details["round_venue"], details["round_pitch"] = split_venue_and_pitch(
            cleaned_location[0], cleaned_location[1] if len(cleaned_location) > 1 else None
        )

    return details


def build_bye_match_url(association: str, competition: str, grade: str, round_label: str, team_url: str, team_label: str) -> str:
    team_id = extract_revsports_team_id(team_url)
    team_key = team_id or team_url or team_label
    return "|".join([
        "revsports-bye",
        clean_text(association),
        clean_text(competition),
        clean_text(grade),
        clean_text(round_label),
        clean_text(team_key),
    ])


def extract_bye_entries(soup: BeautifulSoup, round_url: str) -> list[dict]:
    """Find teams listed under a RevSports Byes section on the round page."""
    entries: list[dict] = []
    seen: set[str] = set()

    def add_team_link(anchor) -> None:
        href = normalize_url(anchor["href"], round_url)
        if href in seen or not path_matches(href, r"/games/team/\d+/\d+$"):
            return
        seen.add(href)
        entries.append({
            "team_url": href,
            "team_label": clean_text(anchor.get_text(" ", strip=True)),
        })

    for label_node in soup.find_all(string=re.compile(r"^\s*byes?\s*$", re.IGNORECASE)):
        label_parent = label_node.parent
        if label_parent is None:
            continue

        # First try the smallest nearby container that only appears to describe byes.
        node = label_parent
        for _ in range(5):
            if node is None or not hasattr(node, "find_all"):
                break
            team_links = [
                a for a in node.find_all("a", href=True)
                if path_matches(normalize_url(a["href"], round_url), r"/games/team/\d+/\d+$")
            ]
            game_links = [
                a for a in node.find_all("a", href=True)
                if path_matches(normalize_url(a["href"], round_url), r"/game/\d+$")
            ]
            if team_links and not game_links:
                for anchor in team_links:
                    add_team_link(anchor)
                break
            node = node.parent

        # Fallback for layouts where "Byes" is followed by sibling links.
        for sibling in label_parent.find_next_siblings():
            sibling_text = clean_text(sibling.get_text(" ", strip=True)) if hasattr(sibling, "get_text") else clean_text(sibling)
            if re.match(r"^(?:round\s+\d+|details|umpires?|venue|date & time)$", sibling_text, flags=re.IGNORECASE):
                break
            if hasattr(sibling, "find_all"):
                for anchor in sibling.find_all("a", href=True):
                    add_team_link(anchor)
            if len(entries) >= 12:
                break

    return entries


def get_game_links(session: requests.Session, round_url: str) -> list[dict]:
    try:
        soup = get_soup(session, round_url)
    except Exception as e:
        print(f"    WARNING: Skipping round (could not fetch): {e}")
        return []

    games = []
    seen = set()

    for a in soup.find_all("a", href=True):
        href = normalize_url(a["href"], round_url)
        if href in seen:
            continue
        seen.add(href)

        if path_matches(href, r"/game/\d+$"):
            fixture_card = find_fixture_card(a, href, round_url)
            card_details = extract_round_card_details(fixture_card, round_url)
            games.append({"game_url": href, **card_details})

    for bye in extract_bye_entries(soup, round_url):
        games.append({"is_bye": True, **bye})

    return games


# ----------------------------------------------------------------------------
# MATCH SCRAPER
# ----------------------------------------------------------------------------

def scrape_match(
    session: requests.Session,
    game_url: str,
    grade_name: str = "",
    team_urls: list[str] | None = None,
    team_labels: list[str] | None = None,
    round_venue: str = "",
    round_pitch: str = "",
    round_venue_url: str = "",
    round_venue_id: str = "",
    round_date: str = "",
    round_time: str = "",
    round_home_score: str = "",
    round_away_score: str = "",
    round_umpires: list[str] | None = None,
) -> dict:
    soup = get_soup(session, game_url)

    match = {
        "url": game_url,
        "date": round_date or "",
        "time": round_time or "",
        "venue": round_venue or "",
        "pitch": round_pitch or "",
        "round_venue_url": round_venue_url or "",
        "round_venue_id": round_venue_id or "",
        "home_club_name": "",
        "home_team": "",
        "home_team_label": "",
        "home_team_url": "",
        "home_revsports_team_id": "",
        "away_club_name": "",
        "away_team": "",
        "away_team_label": "",
        "away_team_url": "",
        "away_revsports_team_id": "",
        "home_score": round_home_score or "",
        "away_score": round_away_score or "",
        "umpires": list(round_umpires or []),
        "teams": [],
    }

    # Fallback: discover team links from match page if the round page did not provide them.
    team_page_urls = list(team_urls or [])
    if not team_page_urls:
        seen_team_urls = set()
        for a in soup.find_all("a", href=True):
            href = normalize_url(a["href"], game_url)
            if href not in seen_team_urls and path_matches(href, r"/games/team/\d+/\d+$"):
                seen_team_urls.add(href)
                team_page_urls.append(href)

    team_labels = list(team_labels or [])

    team_info: list[dict] = []
    for i, team_url in enumerate(team_page_urls[:2]):
        club_name, team_name = get_team_name_from_draws_page(session, team_url, grade_name)
        team_label = clean_text(team_labels[i]) if i < len(team_labels) else ""
        if not team_label:
            team_label = build_team_label(club_name, team_name)

        info = {
            "team_side": "home" if i == 0 else "away",
            "club_name": club_name,
            "team_name": team_name,
            "team_label": team_label,
            "team_url": team_url,
            "revsports_team_id": extract_revsports_team_id(team_url),
        }
        team_info.append(info)
        print(
            f"      -> Side: {info['team_side']}  Club: '{club_name}'  "
            f"Team: '{team_name}'  RevSports Team ID: {info['revsports_team_id']}"
        )

    if len(team_info) >= 1:
        home = team_info[0]
        match.update({
            "home_club_name": home["club_name"] or home["team_name"],
            "home_team": home["team_name"] or home["club_name"],
            "home_team_label": home["team_label"],
            "home_team_url": home["team_url"],
            "home_revsports_team_id": home["revsports_team_id"],
        })
    if len(team_info) >= 2:
        away = team_info[1]
        match.update({
            "away_club_name": away["club_name"] or away["team_name"],
            "away_team": away["team_name"] or away["club_name"],
            "away_team_label": away["team_label"],
            "away_team_url": away["team_url"],
            "away_revsports_team_id": away["revsports_team_id"],
        })

    # Match page fallback for date/time, venue/pitch, and umpires.
    page_text = soup.get_text(" ", strip=True)
    if not match["date"] or not match["time"]:
        dm = re.search(r"((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+\w+\s+\d{4})\s+(\d{1,2}:\d{2})", page_text)
        if dm:
            match["date"] = format_date_from_round_text(dm.group(1))
            match["time"] = dm.group(2)

    lines = [clean_text(l) for l in soup.get_text("\n").split("\n") if clean_text(l)]
    STOP = {"venue", "date & time", "match card", "umpires", "umpire", "subvenue"}
    for i, line in enumerate(lines):
        ll = line.lower()
        if ll == "venue" and not match["venue"]:
            for k in range(i + 1, min(i + 5, len(lines))):
                if lines[k].lower() not in STOP:
                    match["venue"], match["pitch"] = split_venue_and_pitch(lines[k])
                    break
        if ll == "subvenue" and not match["pitch"]:
            for k in range(i + 1, min(i + 4, len(lines))):
                if lines[k].lower() not in STOP:
                    match["pitch"] = lines[k]
                    break
        if ll in {"umpire", "umpires"} and not match["umpires"]:
            umpire_bits = []
            for k in range(i + 1, min(i + 5, len(lines))):
                if lines[k].lower() in STOP:
                    break
                if re.match(r"^round\s+\d+", lines[k], flags=re.IGNORECASE):
                    break
                umpire_bits.append(lines[k])
            match["umpires"] = split_people("; ".join(umpire_bits))[:2]

    if not match["home_score"] or not match["away_score"]:
        score_cards = soup.find_all("div", style=lambda s: s and "5rem" in s)
        score_values = []
        for card in score_cards:
            text = clean_text(card.get_text(" ", strip=True))
            if re.match(r"^\d+$", text):
                score_values.append(text)
        if len(score_values) >= 2:
            match["home_score"] = score_values[0]
            match["away_score"] = score_values[1]

    # Match card tables: table 0 = home, table 1 = away.
    tables = soup.find_all("table", class_="table")
    for i, table in enumerate(tables):
        if i < len(team_info):
            info = team_info[i]
        else:
            side = "home" if i == 0 else "away"
            info = {
                "team_side": side,
                "club_name": "",
                "team_name": "",
                "team_label": "",
                "team_url": "",
                "revsports_team_id": "",
            }

        players = []
        in_fillins = False
        in_removed = False

        for row in table.find_all("tr")[1:]:
            cells = row.find_all("td")
            if not cells:
                continue
            name_text = cells[0].get_text(" ", strip=True)
            if not clean_text(name_text):
                continue
            norm = clean_text(name_text).lower()

            if "fill-in" in norm:
                in_fillins = True
                in_removed = False
                continue
            if "removed from team" in norm:
                in_removed = True
                in_fillins = False
                continue
            if any(j in norm for j in ["goals", "green card", "yellow card", "red card"]):
                continue

            attended = (not in_removed) and (in_fillins or bool(row.find(class_=re.compile(r"\bfa-check\b"))))

            name_clean = re.sub(r"^\d+\.\s*", "", clean_text(name_text))
            jersey = ""
            jm = re.search(r"\(#(\d+)\)", name_clean)
            if jm:
                jersey = jm.group(1)

            role_text = ""
            rm = re.search(r"\(([^#\d][^)]*)\)", name_clean)
            if rm:
                role_text = clean_text(rm.group(1))

            is_goalkeeper = role_flag(role_text, r"\bgoal\s*keeper\b|\bgoalkeeper\b|\bkeeper\b|\bgk\b")
            is_captain = role_flag(role_text, r"\bcaptain\b")

            player_name = re.sub(r"\s*\([^)]*\)", "", name_clean).strip()
            if not player_name:
                continue
            if "," in player_name:
                last, first = player_name.split(",", 1)
                player_name = f"{first.strip()} {last.strip()}"

            unknown_role = unknown_role_part(role_text)
            if role_text and unknown_role:
                QUALITY_WARNINGS.append(
                    "Unknown player role value: "
                    f"{role_text!r} (unknown part: {unknown_role!r}) - "
                    f"Player: {player_name} - "
                    f"Team: {info.get('club_name', '')} {info.get('team_name', '')} - "
                    f"Match: {game_url}"
                )

            players.append({
                "name": player_name,
                "jersey": jersey,
                "is_goalkeeper": is_goalkeeper,
                "is_captain": is_captain,
                "attended": attended,
                "is_fillin": in_fillins,
                "is_removed": in_removed,
                "revsports_player_id": extract_player_id_from_row(row),
                "goals": cells[1].get_text(strip=True) if len(cells) > 1 else "",
                "green_cards": cells[2].get_text(strip=True) if len(cells) > 2 else "",
                "yellow_cards": cells[3].get_text(strip=True) if len(cells) > 3 else "",
                "red_cards": cells[4].get_text(strip=True) if len(cells) > 4 else "",
            })

        if players:
            match["teams"].append({**info, "players": players})

    return match


def scrape_bye_match(session: requests.Session, game_info: dict, grade: dict, rnd: dict) -> dict:
    team_url = clean_text(game_info.get("team_url"))
    team_label = clean_text(game_info.get("team_label"))
    club_name, team_name = get_team_name_from_draws_page(session, team_url, grade["name"]) if team_url else ("", "")
    if not team_label:
        team_label = build_team_label(club_name, team_name)

    match_url = build_bye_match_url(
        ASSOCIATION_NAME,
        grade.get("competition_name", ASSOCIATION_NAME),
        grade["name"],
        rnd["round_label"],
        team_url,
        team_label,
    )

    team = {
        "team_side": "home",
        "club_name": club_name or team_name,
        "team_name": team_name or club_name,
        "team_label": team_label,
        "team_url": team_url,
        "revsports_team_id": extract_revsports_team_id(team_url),
        "players": [],
    }

    return {
        "url": match_url,
        "date": "",
        "time": "",
        "venue": "",
        "pitch": "",
        "round_venue_url": "",
        "round_venue_id": "",
        "home_club_name": team["club_name"],
        "home_team": team["team_name"],
        "home_team_label": team["team_label"],
        "home_team_url": team["team_url"],
        "home_revsports_team_id": team["revsports_team_id"],
        "away_club_name": "",
        "away_team": "",
        "away_team_label": "BYE",
        "away_team_url": "",
        "away_revsports_team_id": "",
        "home_score": "",
        "away_score": "",
        "umpires": [],
        "teams": [team],
        "is_bye": True,
    }


# ----------------------------------------------------------------------------
# ROW BUILDING / OUTPUT
# ----------------------------------------------------------------------------

def base_fixture_row(association: str, grade: dict, rnd: dict, match: dict, game_url: str) -> dict:
    match_id = ""
    if game_url and "/game/" in game_url:
        match_id_match = re.search(r"/game/(\d+)$", urlparse(game_url).path)
        if match_id_match:
            match_id = match_id_match.group(1)

    return {
        "association": association,
        "competition_name": grade.get("competition_name", association),
        "grade": grade["name"],
        "round": rnd["round_label"],
        "game_date": match.get("date", ""),
        "game_time": match.get("time", ""),
        "venue": match.get("venue", ""),
        "pitch": match.get("pitch", ""),
        "home_club_name": match.get("home_club_name", ""),
        "home_team": match.get("home_team", ""),
        "home_team_label": match.get("home_team_label", ""),
        "home_team_url": match.get("home_team_url", ""),
        "home_revsports_team_id": match.get("home_revsports_team_id", ""),
        "away_club_name": match.get("away_club_name", ""),
        "away_team": match.get("away_team", ""),
        "away_team_label": match.get("away_team_label", ""),
        "away_team_url": match.get("away_team_url", ""),
        "away_revsports_team_id": match.get("away_revsports_team_id", ""),
        "home_score": match.get("home_score", ""),
        "away_score": match.get("away_score", ""),
        "is_bye": bool_text(match.get("is_bye", False)),
        "umpire_1": match.get("umpires", [""])[0] if len(match.get("umpires", [])) > 0 else "",
        "umpire_2": match.get("umpires", ["", ""])[1] if len(match.get("umpires", [])) > 1 else "",
        "match_url": game_url,
        "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "revsports_competition_id": grade.get("competition_id") or rnd.get("competition_id") or "",
        "revsports_grade_id": grade.get("grade_id") or rnd.get("grade_id") or "",
        "revsports_venue_id": match.get("round_venue_id") or "",
        "revsports_venue_url": match.get("round_venue_url") or "",
        "revsports_match_id": match_id,
    }


def should_include_team(team: dict) -> bool:
    if not only_team:
        return True
    needle = only_team.lower()
    haystack = " ".join([
        clean_text(team.get("club_name")),
        clean_text(team.get("team_name")),
        clean_text(team.get("team_label")),
    ]).lower()
    return needle in haystack



def normalise_round_value(value: str) -> str:
    """Make round filters forgiving: '1' and 'Round 1' both match."""
    value = str(value or "").strip().lower()
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"^round\s+", "", value)
    return value


def round_matches_filter(round_label: str, selected_rounds: list[str] | None) -> bool:
    """Return True when the current round matches the user's filter."""
    if not selected_rounds:
        return True

    round_label_normalised = normalise_round_value(round_label)

    selected_rounds_normalised = {
        normalise_round_value(selected_round)
        for selected_round in selected_rounds
    }

    return round_label_normalised in selected_rounds_normalised

def main():
    print("=" * 60)
    print("Hockey Results Scraper - Headless")
    print(f"Version:     {VERSION}")
    print(f"Started:     {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Portal:      {PORTAL_URL}")
    print(f"Association: {ASSOCIATION_NAME}")
    print(f"Grades:      {only_grades or 'All'}")
    print(f"Rounds:      {only_rounds or 'All'}")
    print(f"Team:        {only_team or 'All'}")
    print("=" * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    QUALITY_WARNINGS.clear()
    session = make_session()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    fixtures_lookup = {}
    missing_fixtures_counter = 0

    # fixture_id links a scraped player row back to the fixtures table so the app can show "who played in this game" when someone clicks on a fixture.
    if supabase_url and supabase_key:
        try:
            from supabase import create_client
            print("\nFetching fixtures from Supabase...")
            client_temp = create_client(supabase_url, supabase_key)
            fixtures_data = client_temp.table("fixtures").select("id, revsports_match_url").execute().data or []
            for f in fixtures_data:
                url = f.get("revsports_match_url")
                if url:
                    fixtures_lookup[url] = f.get("id")
            print(f"Loaded {len(fixtures_lookup)} fixtures for matching.")
        except Exception as e:
            print(f"WARNING: Could not fetch fixtures from Supabase: {e}")

    all_results = []
    csv_rows = []

    grades = get_all_grades(session, PORTAL_URL)
    print(f"\nFound {len(grades)} grades.")

    for grade in grades:
        if only_grades and grade["name"] not in only_grades:
            print(f"[Grade] {grade['name']} - skipped")
            continue
        print(f"\n[Grade] {grade['name']}")

        rounds = get_rounds(session, grade["url"])
        print(f"  {len(rounds)} rounds.")

        for rnd in rounds:
            if only_rounds and not round_matches_filter(rnd["round_label"], only_rounds):
                print(f"  [Round] {rnd['round_label']} - skipped")
                continue
            print(f"\n  [Round] {rnd['round_label']}")

            games = get_game_links(session, rnd["url"])
            print(f"    {len(games)} games.")

            for game_info in games:
                try:
                    if game_info.get("is_bye"):
                        match = scrape_bye_match(session, game_info, grade, rnd)
                        game_url = match["url"]
                    else:
                        game_url = game_info["game_url"]
                        match = scrape_match(
                            session,
                            game_url,
                            grade_name=grade["name"],
                            team_urls=game_info.get("team_urls", []),
                            team_labels=game_info.get("team_labels", []),
                            round_venue=game_info.get("round_venue", ""),
                            round_pitch=game_info.get("round_pitch", ""),
                            round_venue_url=game_info.get("round_venue_url", ""),
                            round_venue_id=game_info.get("round_venue_id", ""),
                            round_date=game_info.get("round_date", ""),
                            round_time=game_info.get("round_time", ""),
                            round_home_score=game_info.get("round_home_score", ""),
                            round_away_score=game_info.get("round_away_score", ""),
                            round_umpires=game_info.get("round_umpires", []),
                        )
                    match["grade"] = grade["name"]
                    match["round"] = rnd["round_label"]
                    all_results.append(match)

                    teams = match.get("teams", [])
                    has_players = any(len(t.get("players", [])) > 0 for t in teams)

                    if has_players:
                        for team in teams:
                            if not should_include_team(team):
                                continue
                            for player in team["players"]:
                                row = base_fixture_row(ASSOCIATION_NAME, grade, rnd, match, game_url)
                                row.update({
                                    "team_side": team.get("team_side", ""),
                                    "club_name": team.get("club_name", ""),
                                    "team": team.get("team_name", ""),
                                    "team_label": team.get("team_label", ""),
                                    "team_url": team.get("team_url", ""),
                                    "revsports_team_id": team.get("revsports_team_id", ""),
                                    "player_name": player.get("name", ""),
                                    "jersey": player.get("jersey", ""),
                                    "is_goalkeeper": player.get("is_goalkeeper", False),
                                    "is_captain": player.get("is_captain", False),
                                    "attended": player.get("attended"),
                                    "is_fillin": player.get("is_fillin"),
                                    "is_removed": player.get("is_removed"),
                                    "revsports_player_id": player.get("revsports_player_id", ""),
                                    "goals": player.get("goals", ""),
                                    "green_cards": player.get("green_cards", ""),
                                    "yellow_cards": player.get("yellow_cards", ""),
                                    "red_cards": player.get("red_cards", ""),
                                })
                                csv_rows.append(row)
                    else:
                        row = base_fixture_row(ASSOCIATION_NAME, grade, rnd, match, game_url)
                        row.update({
                            "team_side": "home" if match.get("is_bye") else "",
                            "club_name": match.get("home_club_name", "") if match.get("is_bye") else "",
                            "team": match.get("home_team", "") if match.get("is_bye") else "NO_PLAYERS",
                            "team_label": match.get("home_team_label", "") if match.get("is_bye") else "NO_PLAYERS",
                            "team_url": match.get("home_team_url", "") if match.get("is_bye") else "",
                            "revsports_team_id": match.get("home_revsports_team_id", "") if match.get("is_bye") else "",
                            "player_name": "NO_PLAYERS",
                            "jersey": "",
                            "is_goalkeeper": "FALSE",
                            "is_captain": "FALSE",
                            "attended": "",
                            "is_fillin": "FALSE",
                            "is_removed": "FALSE",
                            "revsports_player_id": "",
                            "goals": "",
                            "green_cards": "",
                            "yellow_cards": "",
                            "red_cards": "",
                        })
                        csv_rows.append(row)

                    print(
                        f"    OK: {match.get('home_club_name','?')} {match.get('home_team','')} "
                        f"{match.get('home_score','?')} - {match.get('away_score','?')} "
                        f"{match.get('away_club_name','?')} {match.get('away_team','')}"
                        f"  @ {match.get('venue','?')} / {match.get('pitch','?')}"
                    )

                except Exception as e:
                    print(f"    ERROR: {game_info.get('game_url') or game_info.get('team_url')} - {e}")

    quality_issue_count = 0

    if csv_rows:
        # Stamp stable row identity before merging and writing output.
        for _row in csv_rows:
            _row["appearance_key"] = build_appearance_key(_row)

        before_merge = len(csv_rows)
        csv_rows = merge_by_appearance_key(csv_rows)
        validate_appearance_keys(csv_rows)
        merged_count = before_merge - len(csv_rows)
        if merged_count:
            print(f"\nINFO: Merged {merged_count} duplicate player appearance row(s).")

    assoc_slug = ASSOCIATION_NAME.lower().replace(" ", "_")
    csv_path = os.path.join(OUTPUT_DIR, f"{assoc_slug}_results.csv")
    if csv_rows:
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(csv_rows)
        fixture_only = sum(1 for r in csv_rows if r.get("player_name") == "NO_PLAYERS")
        player_rows = len(csv_rows) - fixture_only
        print(f"\nOK: CSV: {csv_path}  ({len(csv_rows)} rows - {player_rows} player rows, {fixture_only} fixture-only rows)")
        quality_issue_count = run_quality_check(csv_rows, OUTPUT_DIR, ASSOCIATION_NAME)
    else:
        print("\nWARNING: No matches scraped - CSV not written.")

    json_path = os.path.join(OUTPUT_DIR, f"{assoc_slug}_results.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"OK: JSON: {json_path}  ({len(all_results)} matches)")

    # Supabase upsert remains off by default. Before turning this on, make sure
    # public.revsports_players has an appearance_key text column with a unique
    # constraint/index, plus the is_goalkeeper and is_captain boolean columns.
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not UPSERT_SUPABASE:
        print("\nINFO: UPSERT_SUPABASE is not true - skipping Supabase upsert.")
    elif not supabase_url or not supabase_key:
        raise RuntimeError("UPSERT_SUPABASE is true, but SUPABASE_URL or SUPABASE_SERVICE_KEY is missing.")
    elif not csv_rows:
        raise RuntimeError("UPSERT_SUPABASE is true, but there are no rows to upsert.")
    elif quality_issue_count:
        raise RuntimeError(f"UPSERT_SUPABASE is true, but the quality check found {quality_issue_count} issue(s).")
    else:
        try:
            from supabase import create_client
            client = create_client(supabase_url, supabase_key)

            def clean_row(row: dict) -> dict:
                nonlocal missing_fixtures_counter
                cleaned = {}
                for k, v in row.items():
                    if k == "is_bye":
                        continue
                    cleaned[k] = None if v == "" or v is None else v

                for field in ["home_score", "away_score", "goals", "green_cards", "yellow_cards", "red_cards"]:
                    if cleaned.get(field) is not None:
                        try:
                            cleaned[field] = int(cleaned[field])
                        except (ValueError, TypeError):
                            cleaned[field] = None

                for field in ["attended", "is_goalkeeper", "is_captain", "is_fillin", "is_removed"]:
                    if cleaned.get(field) is not None:
                        cleaned[field] = str(cleaned[field]).strip().lower() == "true"

                # fixture_id links a scraped player row back to the fixtures table so the app can show "who played in this game" when someone clicks on a fixture.
                match_url = row.get("match_url")
                if match_url:
                    match_url = clean_text(match_url)
                    if match_url in fixtures_lookup:
                        cleaned["fixture_id"] = fixtures_lookup[match_url]
                    else:
                        missing_fixtures_counter += 1
                else:
                    missing_fixtures_counter += 1

                return cleaned

            cleaned_rows = [clean_row(r) for r in csv_rows]
            batch_size = 200
            total_batches = (len(cleaned_rows) + batch_size - 1) // batch_size
            total_upserted = 0
            print(f"\nINFO: Upserting {len(cleaned_rows)} rows to Supabase in {total_batches} batches...")

            for i in range(0, len(cleaned_rows), batch_size):
                batch = cleaned_rows[i:i + batch_size]
                batch_num = (i // batch_size) + 1
                print(f"  Upserting batch {batch_num} of {total_batches}...")
                try:
                    client.table("revsports_players").upsert(
                        batch,
                        on_conflict="appearance_key",
                    ).execute()
                    total_upserted += len(batch)
                except Exception as e:
                    print(f"  ERROR: Batch {batch_num} failed: {e}")
                    raise

            print(f"OK: Supabase upsert complete - {total_upserted} rows processed.")
            if missing_fixtures_counter > 0:
                print(f"WARNING: {missing_fixtures_counter} rows had no matching fixture — check if fixture import has run for this round yet")

        except Exception as e:
            print(f"ERROR: Supabase upsert error: {e}")
            raise

    if not UPSERT_SUPABASE_V2:
        print("\nINFO: UPSERT_SUPABASE_V2 is not true - skipping Supabase V2 source upsert.")
    elif not supabase_url or not supabase_key:
        raise RuntimeError("UPSERT_SUPABASE_V2 is true, but SUPABASE_URL or SUPABASE_SERVICE_KEY is missing.")
    else:
        try:
            from supabase import create_client
            client = create_client(supabase_url, supabase_key)
            print("\nINFO: Writing scrape output to Supabase V2 source tables...")
            upsert_revsports_v2_source(client, csv_rows, quality_issue_count)
        except Exception as e:
            print(f"ERROR: Supabase V2 source upsert error: {e}")
            raise

    print(f"\nDone! {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()



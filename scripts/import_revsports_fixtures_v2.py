"""
Import RevSports V2 staged matches into SportStack fixtures.

This uses:
- source_revsports_matches as the fixture source
- external_entities + external_entity_links as the mapping source

Default mode is dry-run. Use --apply to write fixtures.
"""

from __future__ import annotations

import argparse
import os
from collections import Counter
from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

from supabase import create_client

PAGE_SIZE = 1000


def normalise(value: Any) -> str:
    return str(value or "").strip().lower()


def clean(value: Any) -> str:
    return str(value or "").strip()


def fetch_all(client: Any, table: str, columns: str = "*") -> list[dict]:
    rows: list[dict] = []
    for start in range(0, 100000, PAGE_SIZE):
        result = client.table(table).select(columns).range(start, start + PAGE_SIZE - 1).execute()
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
    return rows


def int_or_none(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def fixture_datetime(match: dict) -> str | None:
    date_value = clean(match.get("game_date"))
    if not date_value:
        return None

    time_value = clean(match.get("game_time")) or "00:00:00"
    if len(time_value) == 5:
        time_value = f"{time_value}:00"

    local_naive_str = f"{date_value}T{time_value}"
    local_dt = datetime.fromisoformat(local_naive_str).replace(
        tzinfo=ZoneInfo("Australia/Melbourne")
    )
    utc_dt = local_dt.astimezone(ZoneInfo("UTC"))
    return utc_dt.isoformat()


def is_bye_match(match: dict) -> bool:
    raw_data = match.get("raw_data") or {}
    raw_bye = str(raw_data.get("is_bye") or "").strip().lower()
    return (
        str(match.get("match_url") or "").startswith("revsports-bye|")
        or raw_bye in {"1", "true", "yes", "y"}
    )


def bye_fixture_notes(match: dict) -> str:
    """Describe a bye without pretending it has a match venue or start time."""
    raw_data = match.get("raw_data") or {}
    locations = clean(raw_data.get("bye_round_locations"))
    if locations:
        return f"BYE — Round locations: {locations}"
    return "BYE"


def load_mappings(client: Any) -> dict[str, Any]:
    entities = fetch_all(
        client,
        "external_entities",
        "id,entity_type,external_id,external_name,association_name,competition_name,grade,club_name,team_name,raw_data",
    )
    links = fetch_all(
        client,
        "external_entity_links",
        "external_entity_id,target_table,target_id,status",
    )
    link_by_entity = {
        row["external_entity_id"]: row
        for row in links
        if row.get("status") == "matched" and row.get("target_id")
    }

    teams_by_revsports_id: dict[str, str] = {}
    teams_by_context: dict[tuple[str, str, str, str, str], str] = {}
    competitions_by_context: dict[tuple[str, str], str] = {}
    divisions_by_context: dict[tuple[str, str, str], str] = {}
    venues_by_context: dict[tuple[str, str], str] = {}
    pitches_by_context: dict[tuple[str, str, str], str] = {}

    for entity in entities:
        link = link_by_entity.get(entity["id"])
        if not link:
            continue

        target_id = link["target_id"]
        entity_type = entity.get("entity_type")
        association = normalise(entity.get("association_name"))
        competition = normalise(entity.get("competition_name"))
        grade = normalise(entity.get("grade"))

        if entity_type == "competition":
            competitions_by_context[(association, normalise(entity.get("external_name") or entity.get("competition_name")))] = target_id
            competitions_by_context[(association, competition)] = target_id

        if entity_type == "grade":
            divisions_by_context[(association, competition, normalise(entity.get("external_name") or entity.get("grade")))] = target_id
            divisions_by_context[(association, competition, grade)] = target_id

        if entity_type == "team":
            external_id = clean(entity.get("external_id"))
            if external_id:
                teams_by_revsports_id[external_id] = target_id

            teams_by_context[(
                association,
                competition,
                grade,
                normalise(entity.get("club_name")),
                normalise(entity.get("team_name") or entity.get("external_name")),
            )] = target_id

        if entity_type == "venue":
            venues_by_context[(association, normalise(entity.get("external_name")))] = target_id

        if entity_type == "pitch":
            raw_data = entity.get("raw_data") or {}
            venue_name = raw_data.get("venue_name") or ""
            if not venue_name and entity.get("external_id"):
                parts = str(entity["external_id"]).split("|")
                if len(parts) >= 4:
                    venue_name = parts[-2]
            pitches_by_context[(association, normalise(venue_name), normalise(entity.get("external_name")))] = target_id

    competitions = fetch_all(client, "competitions", "id,season_id")
    season_by_competition = {row["id"]: row.get("season_id") for row in competitions}

    teams = fetch_all(client, "teams", "id,division_id")
    team_divisions = fetch_all(client, "team_divisions", "team_id,division_id")
    division_ids_by_team: dict[str, set[str]] = {}
    for team in teams:
        if team.get("id") and team.get("division_id"):
            division_ids_by_team.setdefault(team["id"], set()).add(team["division_id"])
    for relation in team_divisions:
        if relation.get("team_id") and relation.get("division_id"):
            division_ids_by_team.setdefault(relation["team_id"], set()).add(relation["division_id"])

    return {
        "teams_by_revsports_id": teams_by_revsports_id,
        "teams_by_context": teams_by_context,
        "competitions_by_context": competitions_by_context,
        "divisions_by_context": divisions_by_context,
        "venues_by_context": venues_by_context,
        "pitches_by_context": pitches_by_context,
        "season_by_competition": season_by_competition,
        "division_ids_by_team": division_ids_by_team,
    }


def resolve_team(match: dict, side: str, mappings: dict[str, Any]) -> str | None:
    revsports_id = clean(match.get(f"{side}_revsports_team_id"))
    if revsports_id and revsports_id in mappings["teams_by_revsports_id"]:
        return mappings["teams_by_revsports_id"][revsports_id]

    return mappings["teams_by_context"].get((
        normalise(match.get("association_name")),
        normalise(match.get("competition_name")),
        normalise(match.get("grade")),
        normalise(match.get(f"{side}_club_name")),
        normalise(match.get(f"{side}_team_name")),
    ))


def team_is_in_division(team_id: str | None, division_id: str | None, mappings: dict[str, Any]) -> bool:
    if not team_id or not division_id:
        return False
    return division_id in mappings["division_ids_by_team"].get(team_id, set())


def resolve_venue_and_pitch(match: dict, mappings: dict[str, Any]) -> tuple[str | None, str | None, bool]:
    """Resolve location fields, including RevSports rows with the venue in the pitch field."""
    association = normalise(match.get("association_name"))
    venue_name = normalise(match.get("venue_name"))
    pitch_name = normalise(match.get("pitch_name"))

    venue_id = mappings["venues_by_context"].get((association, venue_name))
    pitch_id = mappings["pitches_by_context"].get((association, venue_name, pitch_name))
    used_pitch_as_venue = False

    # Some RevSports pages put a valid venue name in the pitch field and a
    # malformed display value in the venue field. Only use this fallback when
    # the pitch value exactly matches a known venue for the same association.
    if not venue_id and pitch_name:
        venue_id = mappings["venues_by_context"].get((association, pitch_name))
        if venue_id:
            pitch_id = None
            used_pitch_as_venue = True

    return venue_id, pitch_id, used_pitch_as_venue


def build_rows(matches: list[dict], mappings: dict[str, Any]) -> tuple[list[dict], list[dict], Counter]:
    rows: list[dict] = []
    skipped: list[dict] = []
    stats: Counter = Counter(scanned=len(matches))

    for match in matches:
        is_bye = is_bye_match(match)
        home_team_id = resolve_team(match, "home", mappings)
        away_team_id = None if is_bye else resolve_team(match, "away", mappings)

        association = normalise(match.get("association_name"))
        competition = normalise(match.get("competition_name"))
        grade = normalise(match.get("grade"))
        competition_id = mappings["competitions_by_context"].get((association, competition))
        division_id = mappings["divisions_by_context"].get((association, competition, grade))
        venue_id, pitch_id, used_pitch_as_venue = resolve_venue_and_pitch(match, mappings)
        season_id = mappings["season_by_competition"].get(competition_id)
        resolved_fixture_date = fixture_datetime(match)

        if is_bye:
            if resolved_fixture_date:
                stats["bye_date_resolved"] += 1
            if clean((match.get("raw_data") or {}).get("bye_round_locations")):
                stats["bye_locations_recorded"] += 1

        if competition_id:
            stats["competition_resolved"] += 1
        else:
            stats["missing_competition"] += 1
        if division_id:
            stats["division_resolved"] += 1
        else:
            stats["missing_division"] += 1
        if venue_id:
            stats["venue_resolved"] += 1
            if used_pitch_as_venue:
                stats["venue_from_pitch_field"] += 1
        else:
            stats["missing_venue"] += 1
        if pitch_id:
            stats["pitch_resolved"] += 1
        elif clean(match.get("pitch_name")) and not used_pitch_as_venue:
            stats["missing_pitch"] += 1
        if season_id:
            stats["season_resolved"] += 1
        else:
            stats["missing_season"] += 1

        blockers: list[str] = []
        if not home_team_id or (not is_bye and not away_team_id):
            blockers.append("missing_team_mapping")
        if not competition_id:
            blockers.append("missing_competition_mapping")
        if not division_id:
            blockers.append("missing_division_mapping")
        if not season_id:
            blockers.append("missing_season_mapping")
        if not is_bye and not resolved_fixture_date:
            blockers.append("missing_fixture_date")
        if home_team_id and division_id and not team_is_in_division(home_team_id, division_id, mappings):
            blockers.append("home_team_outside_division")
        if not is_bye and away_team_id and division_id and not team_is_in_division(away_team_id, division_id, mappings):
            blockers.append("away_team_outside_division")

        if blockers:
            for blocker in blockers:
                stats[f"skipped_{blocker}"] += 1
            skipped.append({
                "match_url": match.get("match_url"),
                "reason": ",".join(blockers),
                "home_team": match.get("home_team_name"),
                "home_revsports_team_id": match.get("home_revsports_team_id"),
                "away_team": match.get("away_team_name"),
                "away_revsports_team_id": match.get("away_revsports_team_id"),
                "competition": match.get("competition_name"),
                "grade": match.get("grade"),
                "association": match.get("association_name"),
            })
            continue

        home_score = int_or_none(match.get("home_score"))
        away_score = int_or_none(match.get("away_score"))

        fixture_row = {
            "home_team_id": home_team_id,
            "away_team_id": away_team_id,
            "venue_id": venue_id,
            "pitch_id": pitch_id,
            "division_id": division_id,
            "season_id": season_id,
            "fixture_date": resolved_fixture_date,
            "status": "SCHEDULED" if is_bye else ("COMPLETED" if home_score is not None and away_score is not None else "SCHEDULED"),
            "home_score": home_score,
            "away_score": away_score,
            "round_number": int_or_none(match.get("round_number")),
            "round_name": match.get("round_name"),
            "revsports_match_url": match.get("match_url"),
            "updated_at": datetime.now(UTC).isoformat(),
        }
        if is_bye:
            fixture_row["notes"] = bye_fixture_notes(match)
        rows.append(fixture_row)
        if is_bye:
            stats["byes"] += 1
        stats["resolved"] += 1

    return rows, skipped, stats


def upsert_fixtures(client: Any, rows: list[dict]) -> int:
    total = 0
    for start in range(0, len(rows), 200):
        batch = rows[start:start + 200]
        client.table("fixtures").upsert(batch, on_conflict="revsports_match_url").execute()
        total += len(batch)
    return total


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Write resolved fixtures to the fixtures table.")
    parser.add_argument("--association", help="Limit the import to one exact association name.")
    parser.add_argument("--match-url", help="Limit the import to one exact RevSports match URL.")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY.")

    client = create_client(url, key)
    matches = fetch_all(client, "source_revsports_matches")
    if args.association:
        matches = [
            match for match in matches
            if normalise(match.get("association_name")) == normalise(args.association)
        ]
    if args.match_url:
        matches = [match for match in matches if clean(match.get("match_url")) == clean(args.match_url)]
    if (args.association or args.match_url) and not matches:
        raise SystemExit("No staged RevSports matches matched the requested filter.")

    mappings = load_mappings(client)
    rows, skipped, stats = build_rows(matches, mappings)

    print("RevSports V2 fixture import")
    print("Mode:", "APPLY" if args.apply else "DRY RUN")
    print("Stats:", dict(stats))
    print("Rows ready:", len(rows))
    print("Rows skipped:", len(skipped))
    if skipped[:10]:
        print("Skipped samples:")
        for sample in skipped[:10]:
            print(sample)

    if args.apply:
        if skipped:
            raise SystemExit(
                f"Refusing a partial fixture import: {len(skipped)} row(s) are blocked by required mappings."
            )
        total = upsert_fixtures(client, rows)
        print("Upserted fixtures:", total)
    else:
        print("Dry run only. No database writes.")


if __name__ == "__main__":
    main()

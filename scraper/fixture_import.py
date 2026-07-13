"""
fixture_import.py
-----------------
Reads scraped match data from revsports_players staging table,
resolves team/venue/grade references to SportStack UUIDs using
the mapping tables, then upserts into the native `fixtures` table.

Conflict key: revsports_match_url (one fixture per scraped game URL)

Associations handled: Hockey Ballarat, Sunraysia Hockey Association, Wimmera Hockey Association
"""

import argparse
import logging
import os
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from supabase import Client, create_client

# --- Logging setup ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-6s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("fixture_import.log"),
    ],
)
log = logging.getLogger(__name__)

# --- Supabase connection ---
# Load from environment variables (set these in PowerShell before running)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise EnvironmentError(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.\n"
        "In PowerShell, run:\n"
        '  $env:SUPABASE_URL = [System.Environment]::GetEnvironmentVariable("SUPABASE_URL","User")\n'
        '  $env:SUPABASE_SERVICE_ROLE_KEY = [System.Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY","User")'
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Associations to process ---
ASSOCIATIONS = [
    "Hockey Ballarat",
    "Sunraysia Hockey Association",
    "Wimmera Hockey Association",
]

SAMPLE_LIMIT = 10
READ_PAGE_SIZE = 500
VERIFY_READ_BATCH_SIZE = 50
VERIFY_FIXTURE_FIELDS = (
    "home_team_id",
    "away_team_id",
    "division_id",
    "season_id",
    "home_score",
    "away_score",
    "status",
)


def normalise(value: Any) -> str:
    """Normalise RevSports text fields for safer mapping lookups."""
    return str(value or "").strip()


def mapping_keys(*parts: Any) -> list[tuple[str, ...]]:
    """Return mapping keys with exact and lower-cased text variants."""
    exact = tuple(normalise(part) for part in parts)
    lowered = tuple(part.lower() for part in exact)
    return [exact] if exact == lowered else [exact, lowered]


def first_present(row: dict, names: list[str]) -> Any:
    """Return the first non-empty value from a row for possible schema variants."""
    for name in names:
        value = row.get(name)
        if value not in (None, ""):
            return value
    return None


def load_team_mappings() -> dict:
    """
    Returns mapping dictionaries for RevSports team IDs and fallback team text.
    RevSports team IDs are preferred because team names can repeat or change.
    """
    log.info("Loading team mappings...")
    rows = supabase.table("revsports_team_mappings").select("revsports_team_id, revsports_team_name, grade, team_id").execute().data
    by_id = {}
    by_name = {}
    for row in rows:
        if row["team_id"]:
            revsports_team_id = normalise(row.get("revsports_team_id"))
            if revsports_team_id:
                by_id[revsports_team_id] = row["team_id"]
            for key in mapping_keys(row["revsports_team_name"], row["grade"]):
                by_name[key] = row["team_id"]
    log.info(f"  Loaded {len(by_id)} team ID mapping keys and {len(by_name)} team text mapping keys")
    return {"by_id": by_id, "by_name": by_name}


def load_venue_mappings() -> dict:
    """
    Returns a dict keyed by revsports_venue_name -> sportstack venue_id.
    """
    log.info("Loading venue mappings...")
    rows = supabase.table("revsports_venue_mappings").select("revsports_venue_name, venue_id").execute().data
    mapping = {}
    for row in rows:
        if row["venue_id"]:
            for key in mapping_keys(row["revsports_venue_name"]):
                mapping[key[0]] = row["venue_id"]
    log.info(f"  Loaded {len(mapping)} venue mapping keys")
    return mapping


def load_pitch_mappings() -> dict:
    """
    Returns a dict keyed by (revsports_venue_name, revsports_pitch_name) -> sportstack pitch_id.
    Pitch names are only reliable when paired with their venue.
    """
    log.info("Loading pitch mappings...")
    rows = supabase.table("revsports_pitch_mappings").select("revsports_venue_name, revsports_pitch_name, pitch_id").execute().data
    mapping = {}
    for row in rows:
        if row["pitch_id"]:
            for key in mapping_keys(row["revsports_venue_name"], row["revsports_pitch_name"]):
                mapping[key] = row["pitch_id"]
    log.info(f"  Loaded {len(mapping)} pitch mapping keys")
    return mapping


def load_grade_mappings() -> dict:
    """Return grade/association mapping keys to division IDs."""
    log.info("Loading grade/division mappings...")
    rows = supabase.table("revsports_grade_mappings").select("*").execute().data
    mapping = {}
    for row in rows:
        division_id = row.get("division_id")
        grade = first_present(row, ["revsports_grade", "grade", "division_name", "revsports_division"])
        association = first_present(row, ["association", "association_name"])
        if not division_id or not grade:
            continue
        for key in mapping_keys(association, grade):
            mapping[key] = division_id
        for key in mapping_keys(None, grade):
            mapping.setdefault(key, division_id)

        # Register a stable ID-based key so grades can be matched by RevSports
        # grade ID, not just by name. The namespaced tuple avoids colliding with
        # the (association, grade) name keys registered above.
        grade_id = row.get("revsports_grade_id")
        if grade_id:
            mapping[("revsports_grade_id", str(grade_id).strip())] = division_id
    log.info(f"  Loaded {len(mapping)} grade/division mapping keys")
    return mapping


def load_competition_mappings() -> dict:
    """Return competition/association mapping keys to season IDs.

    The live handoff confirms revsports_competition_mappings.competition_id targets
    seasons.id, so this script treats that mapped value as season_id.
    """
    log.info("Loading competition/season mappings...")
    rows = supabase.table("revsports_competition_mappings").select("*").execute().data
    mapping = {}
    for row in rows:
        season_id = first_present(row, ["season_id", "competition_id"])
        competition = first_present(row, ["revsports_competition_name", "revsports_competition", "competition", "competition_name", "season", "season_name"])
        association = first_present(row, ["association", "association_name"])
        if not season_id or not competition:
            continue
        for key in mapping_keys(association, competition):
            mapping[key] = season_id
        for key in mapping_keys(None, competition):
            mapping.setdefault(key, season_id)
    log.info(f"  Loaded {len(mapping)} competition/season mapping keys")
    return mapping


def load_team_division_lookup() -> dict:
    """Return team_id -> candidate division IDs from teams and team_divisions."""
    log.info("Loading team/division relationships...")
    lookup: dict[str, set[str]] = defaultdict(set)

    teams = supabase.table("teams").select("id, division_id").execute().data
    for team in teams:
        if team.get("division_id"):
            lookup[team["id"]].add(team["division_id"])

    team_divisions = supabase.table("team_divisions").select("team_id, division_id").execute().data
    for row in team_divisions:
        if row.get("team_id") and row.get("division_id"):
            lookup[row["team_id"]].add(row["division_id"])

    compact = {team_id: divisions for team_id, divisions in lookup.items() if divisions}
    log.info(f"  Loaded division relationships for {len(compact)} teams")
    return compact


def load_team_context_lookup(team_divisions: dict[str, set[str]]) -> dict:
    """Return unique team lookups scoped by association, division, club and team text."""
    log.info("Loading team context lookup...")
    teams = supabase.table("teams").select("id, name, club_id, division_id").execute().data
    clubs = supabase.table("clubs").select("id, name, association_id").execute().data
    associations = supabase.table("associations").select("id, name").execute().data

    club_by_id = {club["id"]: club for club in clubs}
    association_by_id = {association["id"]: association for association in associations}
    candidates: dict[tuple[str, ...], set[str]] = defaultdict(set)

    def add_candidate(key_parts: tuple[Any, ...], team_id: str):
        for key in mapping_keys(*key_parts):
            candidates[key].add(team_id)

    for team in teams:
        team_id = team.get("id")
        club = club_by_id.get(team.get("club_id"))
        association = association_by_id.get(club.get("association_id")) if club else None
        if not team_id or not club or not association:
            continue

        divisions = set(team_divisions.get(team_id, set()))
        if team.get("division_id"):
            divisions.add(team["division_id"])
        if not divisions:
            continue

        association_name = association.get("name")
        club_name = club.get("name")
        team_name = team.get("name")
        for division_id in divisions:
            add_candidate((association_name, division_id, club_name, team_name), team_id)
            add_candidate((association_name, division_id, "", team_name), team_id)

    unique = {key: next(iter(team_ids)) for key, team_ids in candidates.items() if len(team_ids) == 1}
    ambiguous = {key: len(team_ids) for key, team_ids in candidates.items() if len(team_ids) > 1}
    log.info(f"  Loaded {len(unique)} unique team context keys and {len(ambiguous)} ambiguous keys")
    return {"unique": unique, "ambiguous": ambiguous}


def load_seasons() -> list[dict]:
    """Load seasons for date/year fallback reporting only."""
    log.info("Loading seasons for fallback checks...")
    return supabase.table("seasons").select("id, association_id, name, year, start_date, end_date").execute().data


def load_scraped_games(association: str) -> list:
    """
    Fetches one row per unique match_url from revsports_players for the given association.
    We only need game-level columns (not player-level), so we deduplicate by match_url.
    """
    log.info(f"Loading scraped games for {association}...")

    # Fetch all columns so dry-run reporting can identify optional RevSports source
    # fields such as competition/year without failing when staging schema differs.
    rows = []
    start = 0
    while True:
        page = (
            supabase.table("revsports_players")
            .select("*")
            .eq("association", association)
            .order("id")
            .range(start, start + READ_PAGE_SIZE - 1)
            .execute()
            .data
            or []
        )
        rows.extend(page)
        if len(page) < READ_PAGE_SIZE:
            break
        start += len(page)

    page_count = max(1, (len(rows) + READ_PAGE_SIZE - 1) // READ_PAGE_SIZE)
    log.info(f"  Loaded {len(rows)} staging rows across {page_count} pages")

    # Deduplicate: keep one row per match_url
    seen = {}
    for row in rows:
        url = row.get("match_url")
        if url and url not in seen:
            seen[url] = row

    games = list(seen.values())
    log.info(f"  Found {len(games)} unique games")
    return games


def resolve_division_id(game: dict, association: str, home_id: str | None, away_id: str | None, grade_map: dict, team_divisions: dict) -> tuple[str | None, str | None]:
    # Prefer matching by stable RevSports grade ID; fall back to name below.
    grade_id = game.get("revsports_grade_id")
    if grade_id:
        id_key = ("revsports_grade_id", str(grade_id).strip())
        if id_key in grade_map:
            return grade_map[id_key], "grade_id"

    grade = game.get("grade")
    for key in mapping_keys(association, grade) + mapping_keys(None, grade):
        if key in grade_map:
            return grade_map[key], "grade_mapping"

    home_divisions = team_divisions.get(home_id, set()) if home_id else set()
    away_divisions = team_divisions.get(away_id, set()) if away_id else set()
    shared = home_divisions & away_divisions
    if len(shared) == 1:
        return next(iter(shared)), "team_divisions_shared"
    if len(home_divisions) == 1 and not away_divisions:
        return next(iter(home_divisions)), "home_team_division"
    if len(away_divisions) == 1 and not home_divisions:
        return next(iter(away_divisions)), "away_team_division"
    if len(shared) > 1:
        return None, "ambiguous_team_divisions"
    return None, "no_grade_or_team_division_mapping"


def resolve_season_id(game: dict, association: str, competition_map: dict, seasons: list[dict]) -> tuple[str | None, str | None]:
    competition = first_present(game, ["revsports_competition_name", "competition", "competition_name", "season", "season_name"])
    for key in mapping_keys(association, competition) + mapping_keys(None, competition):
        if key in competition_map:
            return competition_map[key], "competition_mapping"

    year = first_present(game, ["season_year", "competition_year", "year"])
    game_date = game.get("game_date")
    if not year and game_date:
        try:
            year = int(str(game_date)[:4])
        except ValueError:
            year = None

    year_matches = [season for season in seasons if year and season.get("year") == int(year)]
    if len(year_matches) == 1:
        return year_matches[0]["id"], "season_year_unique"
    if len(year_matches) > 1:
        return None, "ambiguous_season_year"
    return None, "no_competition_or_season_year_mapping"


def resolve_pitch_id(game: dict, pitch_map: dict) -> tuple[str | None, str | None]:
    venue = game.get("venue")
    pitch = game.get("pitch")
    if not pitch:
        return None, "no_pitch_in_scraped_row"

    for key in mapping_keys(venue, pitch):
        if key in pitch_map:
            return pitch_map[key], "pitch_mapping"
    return None, "no_pitch_mapping"


def resolve_team_id(team_map: dict, revsports_team_id: Any, team_name: Any, grade: Any) -> tuple[str | None, str | None]:
    scraped_team_id = normalise(revsports_team_id)
    if scraped_team_id and scraped_team_id in team_map["by_id"]:
        return team_map["by_id"][scraped_team_id], "revsports_team_id"

    name_lookup = team_map["by_name"]
    team_id = name_lookup.get((normalise(team_name), normalise(grade))) or name_lookup.get((normalise(team_name).lower(), normalise(grade).lower()))
    if team_id:
        return team_id, "team_name_grade"
    return None, "no_team_mapping"


def team_matches_division(team_id: str | None, division_id: str | None, team_divisions: dict[str, set[str]]) -> bool:
    if not team_id or not division_id:
        return True
    return division_id in team_divisions.get(team_id, set())


def resolve_team_by_context(
    team_context_lookup: dict,
    association: str,
    division_id: str | None,
    club_name: Any,
    team_name: Any,
) -> tuple[str | None, str]:
    if not division_id:
        return None, "no_division_for_team_context"

    unique = team_context_lookup["unique"]
    ambiguous = team_context_lookup["ambiguous"]
    lookup_keys = []
    lookup_keys.extend(mapping_keys(association, division_id, club_name, team_name))
    lookup_keys.extend(mapping_keys(association, division_id, "", team_name))
    if normalise(team_name) != normalise(club_name):
        lookup_keys.extend(mapping_keys(association, division_id, club_name, club_name))
        lookup_keys.extend(mapping_keys(association, division_id, "", club_name))

    for key in lookup_keys:
        if key in unique:
            return unique[key], "club_team_division"
    for key in lookup_keys:
        if key in ambiguous:
            return None, "ambiguous_club_team_division"
    return None, "no_club_team_division_mapping"


def ensure_team_matches_division(
    team_id: str | None,
    team_source: str | None,
    game: dict,
    side: str,
    association: str,
    division_id: str | None,
    team_divisions: dict[str, set[str]],
    team_context_lookup: dict,
) -> tuple[str | None, str | None, bool]:
    if team_matches_division(team_id, division_id, team_divisions):
        return team_id, team_source, False

    fallback_id, fallback_source = resolve_team_by_context(
        team_context_lookup,
        association,
        division_id,
        game.get(f"{side}_club_name"),
        game.get(f"{side}_team"),
    )
    if fallback_id and team_matches_division(fallback_id, division_id, team_divisions):
        return fallback_id, fallback_source, True

    return None, f"{team_source or 'team_mapping'}_outside_division", True


def safe_sample(game: dict, association: str, reason: str) -> dict:
    """Return a safe unresolved sample without secrets or player details."""
    return {
        "association": association,
        "reason": reason,
        "match_url": game.get("match_url"),
        "competition": first_present(game, ["revsports_competition_name", "competition", "competition_name", "season", "season_name"]),
        "grade": game.get("grade"),
        "home_club": game.get("home_club_name"),
        "home_team": game.get("home_team"),
        "home_revsports_team_id": game.get("home_revsports_team_id"),
        "away_club": game.get("away_club_name"),
        "away_team": game.get("away_team"),
        "away_revsports_team_id": game.get("away_revsports_team_id"),
        "venue": game.get("venue"),
        "pitch": game.get("pitch"),
        "game_date": game.get("game_date"),
        "season_year": first_present(game, ["season_year", "competition_year", "year"]),
    }


def build_fixture_rows(
    games: list,
    team_map: dict,
    venue_map: dict,
    pitch_map: dict,
    grade_map: dict,
    competition_map: dict,
    team_divisions: dict,
    team_context_lookup: dict,
    seasons: list[dict],
    association: str,
) -> tuple[list, list, dict]:
    """
    For each game, resolve home_team, away_team, venue, pitch, division and season to SportStack UUIDs.
    Returns (resolved_rows, skipped_rows, dry_run_report).
    """
    resolved = []
    skipped = []
    stats = Counter(scanned=len(games))
    unresolved_reasons = Counter()
    samples = []

    for game in games:
        url = game["match_url"]
        grade = game.get("grade", "")
        home_name = game.get("home_team", "")
        away_name = game.get("away_team", "")
        venue_name = game.get("venue", "")

        # Look up IDs
        home_id, home_source = resolve_team_id(team_map, game.get("home_revsports_team_id"), home_name, grade)
        away_id, away_source = resolve_team_id(team_map, game.get("away_revsports_team_id"), away_name, grade)
        venue_id = venue_map.get(normalise(venue_name)) or venue_map.get(normalise(venue_name).lower())

        division_id, division_source = resolve_division_id(game, association, home_id, away_id, grade_map, team_divisions)
        season_id, season_source = resolve_season_id(game, association, competition_map, seasons)
        pitch_id, pitch_source = resolve_pitch_id(game, pitch_map)

        home_id, home_source, home_rechecked = ensure_team_matches_division(
            home_id,
            home_source,
            game,
            "home",
            association,
            division_id,
            team_divisions,
            team_context_lookup,
        )
        away_id, away_source, away_rechecked = ensure_team_matches_division(
            away_id,
            away_source,
            game,
            "away",
            association,
            division_id,
            team_divisions,
            team_context_lookup,
        )
        if home_rechecked:
            stats["home_team_rechecked_against_division"] += 1
        if away_rechecked:
            stats["away_team_rechecked_against_division"] += 1

        if division_id:
            stats["division_resolved"] += 1
        else:
            unresolved_reasons[f"division:{division_source}"] += 1
            if len(samples) < SAMPLE_LIMIT:
                samples.append(safe_sample(game, association, f"division:{division_source}"))
        if season_id:
            stats["season_resolved"] += 1
        else:
            unresolved_reasons[f"season:{season_source}"] += 1
            if len(samples) < SAMPLE_LIMIT:
                samples.append(safe_sample(game, association, f"season:{season_source}"))
        if pitch_id:
            stats["pitch_resolved"] += 1
        elif pitch_source != "no_pitch_in_scraped_row":
            unresolved_reasons[f"pitch:{pitch_source}"] += 1
            if len(samples) < SAMPLE_LIMIT:
                samples.append(safe_sample(game, association, f"pitch:{pitch_source}"))

        # Skip if any required mapping is missing
        if not home_id:
            unresolved_reasons[f"home_team:{home_source}"] += 1
            if len(samples) < SAMPLE_LIMIT:
                samples.append(safe_sample(game, association, f"home_team:{home_source}"))
            log.info(f"  No valid team mapping for home team '{home_name}' (grade: {grade}, source: {home_source})")
            log.info(f"    {url}")
            skipped.append({"reason": f"home team '{home_name}'", "url": url})
            continue

        if not away_id:
            unresolved_reasons[f"away_team:{away_source}"] += 1
            if len(samples) < SAMPLE_LIMIT:
                samples.append(safe_sample(game, association, f"away_team:{away_source}"))
            log.info(f"  No valid team mapping for away team '{away_name}' (grade: {grade}, source: {away_source})")
            log.info(f"    {url}")
            skipped.append({"reason": f"away team '{away_name}'", "url": url})
            continue

        # Venue is optional — log a warning but don't skip
        if not venue_id:
            log.info(f"  No venue mapping for '{venue_name}' — will import without venue")

        # Build the fixture date+time string
        # game_date/game_time are in Melbourne LOCAL time (from RevSports).
        # We must convert to UTC before storing, since fixture_date is a
        # "timestamp with time zone" column and Postgres assumes UTC for
        # bare timestamp strings.
        game_date = game.get("game_date", "")
        game_time = game.get("game_time") or "00:00"
        # game_time from scraper may be "HH:MM" or "HH:MM:SS"
        if len(game_time) == 5:
            game_time = f"{game_time}:00"

        if game_date:
            local_naive_str = f"{game_date}T{game_time}"
            local_dt = datetime.fromisoformat(local_naive_str).replace(
                tzinfo=ZoneInfo("Australia/Melbourne")
            )
            utc_dt = local_dt.astimezone(ZoneInfo("UTC"))
            fixture_datetime = utc_dt.isoformat()
        else:
            fixture_datetime = None

        # Parse scores (may be None for future/unplayed games)
        home_score = game.get("home_score")
        away_score = game.get("away_score")

        # Determine status
        if home_score is not None and away_score is not None:
            status = "COMPLETED"
        else:
            status = "SCHEDULED"

        # Parse round — scraper stores it as e.g. "Round 1", "Round 12"
        round_raw = game.get("round", "") or ""
        round_parts = round_raw.strip().split()
        round_number = None
        round_name = round_raw.strip() or None
        if len(round_parts) == 2 and round_parts[0].lower() == "round":
            try:
                round_number = int(round_parts[1])
            except ValueError:
                pass

        resolved.append({
            "home_team_id": home_id,
            "away_team_id": away_id,
            "venue_id": venue_id,           # may be None — that's OK
            "pitch_id": pitch_id,           # may be None — that's OK
            "division_id": division_id,
            "season_id": season_id,
            "fixture_date": fixture_datetime,
            "home_score": home_score,
            "away_score": away_score,
            "status": status,
            "round_number": round_number,   # e.g. 1, 2, 3
            "round_name": round_name,       # e.g. "Round 1"
            "revsports_match_url": url,     # conflict key — ensures no duplicates
            "_resolved_home_team_source": home_source,
            "_resolved_away_team_source": away_source,
            "_resolved_division_source": division_source,
            "_resolved_season_source": season_source,
            "_resolved_pitch_source": pitch_source,
        })

    report = {"stats": stats, "unresolved_reasons": unresolved_reasons, "samples": samples}
    return resolved, skipped, report


def printable_rows(rows: list[dict]) -> list[dict]:
    """Remove internal dry-run-only fields before writes."""
    return [{key: value for key, value in row.items() if not key.startswith("_")} for row in rows]


def upsert_fixtures(rows: list) -> int:
    """
    Upserts fixture rows into the fixtures table.
    Uses revsports_match_url as the conflict key so re-running is safe.
    Returns count of upserted rows.
    """
    if not rows:
        return 0

    # Supabase upsert in batches of 200 to avoid request size limits
    BATCH_SIZE = 200
    total_upserted = 0

    for i in range(0, len(rows), BATCH_SIZE):
        batch = printable_rows(rows[i : i + BATCH_SIZE])
        supabase.table("fixtures").upsert(batch, on_conflict="revsports_match_url").execute()
        verify_fixture_batch(batch)
        total_upserted += len(batch)
        log.info(f"  Upserted and verified batch {i // BATCH_SIZE + 1}: {len(batch)} rows")

    return total_upserted


def verify_fixture_batch(batch: list[dict]) -> None:
    """Confirm every attempted fixture upsert persisted its core mapped fields."""
    expected_by_url = {row["revsports_match_url"]: row for row in batch}
    columns = ",".join(("revsports_match_url", *VERIFY_FIXTURE_FIELDS))
    urls = list(expected_by_url)
    actual_rows = []
    for start in range(0, len(urls), VERIFY_READ_BATCH_SIZE):
        url_batch = urls[start : start + VERIFY_READ_BATCH_SIZE]
        actual_rows.extend(
            supabase.table("fixtures")
            .select(columns)
            .in_("revsports_match_url", url_batch)
            .execute()
            .data
            or []
        )
    actual_by_url = {row["revsports_match_url"]: row for row in actual_rows}
    failures = []

    for url, expected in expected_by_url.items():
        actual = actual_by_url.get(url)
        if not actual:
            failures.append(f"missing fixture: {url}")
            continue

        mismatched_fields = [
            field
            for field in VERIFY_FIXTURE_FIELDS
            if actual.get(field) != expected.get(field)
        ]
        if mismatched_fields:
            failures.append(f"field mismatch ({', '.join(mismatched_fields)}): {url}")

    if failures:
        sample = "; ".join(failures[:5])
        raise RuntimeError(
            f"Fixture upsert verification failed for {len(failures)} row(s): {sample}"
        )


def log_report(label: str, report: dict):
    stats = report["stats"]
    log.info(f"{label} dry-run report:")
    log.info(f"  fixture rows scanned: {stats['scanned']}")
    log.info(f"  can resolve division_id: {stats['division_resolved']}")
    log.info(f"  can resolve season_id: {stats['season_resolved']}")
    log.info(f"  can resolve pitch_id: {stats['pitch_resolved']}")
    log.info(f"  home teams rechecked against division: {stats['home_team_rechecked_against_division']}")
    log.info(f"  away teams rechecked against division: {stats['away_team_rechecked_against_division']}")
    if report["unresolved_reasons"]:
        log.info("  unresolved by reason:")
        for reason, count in sorted(report["unresolved_reasons"].items()):
            log.info(f"    {reason}: {count}")
    if report["samples"]:
        log.info("  sample unresolved rows (safe fields only):")
        for sample in report["samples"]:
            log.info(f"    {sample}")


def build_backfill_report(
    team_map: dict,
    venue_map: dict,
    pitch_map: dict,
    grade_map: dict,
    competition_map: dict,
    team_divisions: dict,
    team_context_lookup: dict,
    seasons: list[dict],
) -> dict:
    """Prepare a dry-run-only report for existing fixtures before any backfill update."""
    fixtures = supabase.table("fixtures").select("id, revsports_match_url, division_id, season_id, pitch_id").execute().data
    fixture_urls = {row.get("revsports_match_url") for row in fixtures if row.get("revsports_match_url")}
    aggregate = {"stats": Counter(scanned=len(fixtures)), "unresolved_reasons": Counter(), "samples": []}

    staged_by_url = {}
    for association in ASSOCIATIONS:
        for game in load_scraped_games(association):
            if game.get("match_url") in fixture_urls:
                staged_by_url[game["match_url"]] = (association, game)

    for fixture in fixtures:
        url = fixture.get("revsports_match_url")
        staged = staged_by_url.get(url)
        if not staged:
            aggregate["unresolved_reasons"]["fixture:no_matching_staging_row"] += 1
            continue
        association, game = staged
        _, _, report = build_fixture_rows(
            [game],
            team_map,
            venue_map,
            pitch_map,
            grade_map,
            competition_map,
            team_divisions,
            team_context_lookup,
            seasons,
            association,
        )
        aggregate["stats"]["division_resolved"] += report["stats"]["division_resolved"]
        aggregate["stats"]["season_resolved"] += report["stats"]["season_resolved"]
        aggregate["stats"]["pitch_resolved"] += report["stats"]["pitch_resolved"]
        aggregate["unresolved_reasons"].update(report["unresolved_reasons"])
        for sample in report["samples"]:
            if len(aggregate["samples"]) < SAMPLE_LIMIT:
                aggregate["samples"].append(sample)

    return aggregate


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import RevSports fixtures into SportStack.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Report fixture, division, season and pitch resolution counts without writing to the DB (default).")
    mode.add_argument("--apply", action="store_true", help="Write fixture fields to the DB, including resolved division_id, season_id and pitch_id.")
    parser.add_argument("--backfill-dry-run", action="store_true", help="Also report division_id/season_id/pitch_id resolvability for existing fixtures before any update.")
    return parser.parse_args()


def run():
    args = parse_args()
    dry_run = not args.apply

    log.info("=" * 60)
    log.info("SportStack Fixture Import — starting")
    log.info("Mode: %s", "DRY RUN (no DB writes)" if dry_run else "APPLY (writes fixture fields)")
    log.info("=" * 60)

    # Load mappings once (shared across associations)
    team_map = load_team_mappings()
    venue_map = load_venue_mappings()
    pitch_map = load_pitch_mappings()
    grade_map = load_grade_mappings()
    competition_map = load_competition_mappings()
    team_divisions = load_team_division_lookup()
    team_context_lookup = load_team_context_lookup(team_divisions)
    seasons = load_seasons()

    grand_total_upserted = 0
    grand_total_skipped = 0
    grand_report = {"stats": Counter(), "unresolved_reasons": Counter(), "samples": []}

    for association in ASSOCIATIONS:
        log.info(f"\n--- Processing: {association} ---")

        games = load_scraped_games(association)
        resolved, skipped, report = build_fixture_rows(
            games,
            team_map,
            venue_map,
            pitch_map,
            grade_map,
            competition_map,
            team_divisions,
            team_context_lookup,
            seasons,
            association,
        )

        log.info(f"  Resolved import rows: {len(resolved)} | Skipped import rows: {len(skipped)}")
        log_report(association, report)

        grand_report["stats"].update(report["stats"])
        grand_report["unresolved_reasons"].update(report["unresolved_reasons"])
        for sample in report["samples"]:
            if len(grand_report["samples"]) < SAMPLE_LIMIT:
                grand_report["samples"].append(sample)

        if dry_run:
            upserted = 0
            log.info("  Dry run only — no fixture rows upserted")
        else:
            upserted = upsert_fixtures(resolved)
            log.info(f"  Done. Upserted: {upserted} | Skipped: {len(skipped)}")

        grand_total_upserted += upserted
        grand_total_skipped += len(skipped)

    log.info("\n" + "=" * 60)
    log_report("TOTAL", grand_report)

    if args.backfill_dry_run:
        backfill_report = build_backfill_report(
            team_map,
            venue_map,
            pitch_map,
            grade_map,
            competition_map,
            team_divisions,
            team_context_lookup,
            seasons,
        )
        log.info("\n" + "=" * 60)
        log_report("Existing fixtures backfill", backfill_report)
        log.info("Backfill dry run only — no fixture rows updated")

    log.info(f"COMPLETE — Total upserted: {grand_total_upserted} | Total skipped: {grand_total_skipped}")
    log.info("=" * 60)


if __name__ == "__main__":
    run()

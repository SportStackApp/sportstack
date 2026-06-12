"""
fixture_import.py
-----------------
Reads scraped match data from revsports_players staging table,
resolves team/venue/grade references to SportStack UUIDs using
the mapping tables, then upserts into the native `fixtures` table.

Conflict key: revsports_match_url (one fixture per scraped game URL)

Associations handled: Hockey Ballarat, Sunraysia Hockey Association, Wimmera Hockey Association
"""

import os
import logging
from supabase import create_client, Client

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


def load_team_mappings() -> dict:
    """
    Returns a dict keyed by (revsports_team_name, grade) -> sportstack team_id.
    A single RevSports team name can appear multiple times with different grades,
    so we always include grade in the lookup key.
    """
    log.info("Loading team mappings...")
    rows = supabase.table("revsports_team_mappings").select("revsports_team_name, grade, team_id").execute().data
    mapping = {}
    for row in rows:
        if row["team_id"]:
            key = (row["revsports_team_name"], row["grade"])
            mapping[key] = row["team_id"]
    log.info(f"  Loaded {len(mapping)} team mappings")
    return mapping


def load_venue_mappings() -> dict:
    """
    Returns a dict keyed by revsports_venue_name -> sportstack venue_id.
    """
    log.info("Loading venue mappings...")
    rows = supabase.table("revsports_venue_mappings").select("revsports_venue_name, venue_id").execute().data
    mapping = {row["revsports_venue_name"]: row["venue_id"] for row in rows if row["venue_id"]}
    log.info(f"  Loaded {len(mapping)} venue mappings")
    return mapping


def load_scraped_games(association: str) -> list:
    """
    Fetches one row per unique match_url from revsports_players for the given association.
    We only need game-level columns (not player-level), so we deduplicate by match_url.
    """
    log.info(f"Loading scraped games for {association}...")

    # Fetch all rows for this association (we'll deduplicate in Python)
    rows = (
        supabase.table("revsports_players")
        .select("match_url, grade, game_date, game_time, venue, home_team, away_team, home_score, away_score, round")
        .eq("association", association)
        .execute()
        .data
    )

    # Deduplicate: keep one row per match_url
    seen = {}
    for row in rows:
        url = row.get("match_url")
        if url and url not in seen:
            seen[url] = row

    games = list(seen.values())
    log.info(f"  Found {len(games)} unique games")
    return games


def build_fixture_rows(games: list, team_map: dict, venue_map: dict) -> tuple[list, list]:
    """
    For each game, resolve home_team, away_team, and venue to SportStack UUIDs.
    Returns (resolved_rows, skipped_rows).
    """
    resolved = []
    skipped = []

    for game in games:
        url = game["match_url"]
        grade = game.get("grade", "")
        home_name = game.get("home_team", "")
        away_name = game.get("away_team", "")
        venue_name = game.get("venue", "")

        # Look up IDs
        home_id = team_map.get((home_name, grade))
        away_id = team_map.get((away_name, grade))
        venue_id = venue_map.get(venue_name)

        # Skip if any required mapping is missing
        if not home_id:
            log.info(f"  No team mapping for home team '{home_name}' (grade: {grade})")
            log.info(f"    {url}")
            skipped.append({"reason": f"home team '{home_name}'", "url": url})
            continue

        if not away_id:
            log.info(f"  No team mapping for away team '{away_name}' (grade: {grade})")
            log.info(f"    {url}")
            skipped.append({"reason": f"away team '{away_name}'", "url": url})
            continue

        # Venue is optional — log a warning but don't skip
        if not venue_id:
            log.info(f"  No venue mapping for '{venue_name}' — will import without venue")

        # Build the fixture date+time string
        game_date = game.get("game_date", "")
        game_time = game.get("game_time") or "00:00"
        # game_time from scraper may be "HH:MM" or "HH:MM:SS"
        if game_date:
            fixture_datetime = f"{game_date}T{game_time}:00" if len(game_time) == 5 else f"{game_date}T{game_time}"
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
            "fixture_date": fixture_datetime,
            "home_score": home_score,
            "away_score": away_score,
            "status": status,
            "round_number": round_number,   # e.g. 1, 2, 3
            "round_name": round_name,       # e.g. "Round 1"
            "revsports_match_url": url,     # conflict key — ensures no duplicates
        })

    return resolved, skipped


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
        batch = rows[i : i + BATCH_SIZE]
        result = (
            supabase.table("fixtures")
            .upsert(batch, on_conflict="revsports_match_url")
            .execute()
        )
        total_upserted += len(batch)
        log.info(f"  Upserted batch {i // BATCH_SIZE + 1}: {len(batch)} rows")

    return total_upserted


def run():
    log.info("=" * 60)
    log.info("SportStack Fixture Import — starting")
    log.info("=" * 60)

    # Load mappings once (shared across associations)
    team_map = load_team_mappings()
    venue_map = load_venue_mappings()

    grand_total_upserted = 0
    grand_total_skipped = 0

    for association in ASSOCIATIONS:
        log.info(f"\n--- Processing: {association} ---")

        games = load_scraped_games(association)
        resolved, skipped = build_fixture_rows(games, team_map, venue_map)

        log.info(f"  Resolved: {len(resolved)} | Skipped: {len(skipped)}")

        upserted = upsert_fixtures(resolved)
        log.info(f"  Done. Upserted: {upserted} | Skipped: {len(skipped)}")

        grand_total_upserted += upserted
        grand_total_skipped += len(skipped)

    log.info("\n" + "=" * 60)
    log.info(f"COMPLETE — Total upserted: {grand_total_upserted} | Total skipped: {grand_total_skipped}")
    log.info("=" * 60)


if __name__ == "__main__":
    run()

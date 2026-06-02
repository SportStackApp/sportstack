"""
Player History Scraper
========================
Uses the RevSports player IDs from revsports_player_registry to visit
each player's personal career history page and pull season-by-season stats.

Run once after the registry scraper has been run, then once per season.
Covers all associations where player IDs have been collected.

Requires:
    pip install playwright beautifulsoup4 supabase
    python -m playwright install chromium

Usage:
    python history_scraper.py

Environment variables:
    SUPABASE_URL          — your Supabase project URL
    SUPABASE_SERVICE_KEY  — your Supabase service role key (bypasses RLS)
"""

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import os, sys, time
from datetime import datetime

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────

# Base URLs per association — used to build the history page URL per player
ASSOCIATION_BASE_URLS = {
    "Hockey Ballarat":           "https://www.revolutionise.com.au/hockeyballarat",
    "Sunraysia Hockey Association": "https://www.sunraysiahockey.com.au",
}

# Delay between each player page request — be polite to the server
DELAY             = 0.8   # seconds
PAGE_LOAD_TIMEOUT = 15000 # milliseconds

# ─────────────────────────────────────────────
# SUPABASE — FETCH PLAYER LIST
# ─────────────────────────────────────────────

def fetch_players_from_registry():
    """
    Fetch all unique players from revsports_player_registry.
    Returns a list of dicts with revsports_player_id and association.

    We deduplicate by player ID — the same player may appear in multiple
    competitions (e.g. Sunraysia Grass + Indoor) but their history page
    is the same regardless of competition.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        print("✗ SUPABASE_URL or SUPABASE_SERVICE_KEY not set.")
        return []

    try:
        from supabase import create_client
        client = create_client(supabase_url, supabase_key)

        # Fetch all players — paginate in batches of 1000 to get everyone
        all_rows  = []
        page_size = 1000
        offset    = 0

        while True:
            result = (
                client.table("revsports_player_registry")
                .select("revsports_player_id, association, player_name")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            rows = result.data
            if not rows:
                break
            all_rows.extend(rows)
            if len(rows) < page_size:
                break
            offset += page_size

        # Deduplicate by player ID — keep the first occurrence
        seen    = set()
        players = []
        for row in all_rows:
            pid = row["revsports_player_id"]
            if pid not in seen:
                seen.add(pid)
                players.append(row)

        print(f"  Found {len(players)} unique players in registry.")
        return players

    except Exception as e:
        print(f"✗ Could not fetch players from registry: {e}")
        return []


# ─────────────────────────────────────────────
# SCRAPING
# ─────────────────────────────────────────────

def scrape_player_history(page, player):
    """
    Visit one player's career history page and return a list of season rows.

    History page URL format:
      [base_url]/games/statistics/history/[revsports_player_id]

    Table columns: Season | Matches played | Goals | Goals per match |
                   Green Card | Green Card per match | Yellow Card |
                   Yellow Card per match | Red Card | Red Card per match
    """
    player_id   = player["revsports_player_id"]
    association = player["association"]
    name        = player.get("player_name", player_id)

    base_url    = ASSOCIATION_BASE_URLS.get(association)
    if not base_url:
        print(f"    ⚠ No base URL for association: {association} — skipping {name}")
        return []

    history_url = f"{base_url.rstrip('/')}/games/statistics/history/{player_id}"

    try:
        time.sleep(DELAY)
        page.goto(history_url, timeout=PAGE_LOAD_TIMEOUT)
        page.wait_for_load_state("networkidle", timeout=PAGE_LOAD_TIMEOUT)
        html = page.content()

    except Exception as e:
        print(f"    ✗ Could not load history for {name}: {e}")
        return []

    soup    = BeautifulSoup(html, "html.parser")
    seasons = []

    for row in soup.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 2:
            continue  # Header row — skip

        # First cell is the season year — must be a 4-digit number
        year_text = cells[0].get_text(strip=True)
        if not year_text.isdigit() or len(year_text) != 4:
            continue

        def cell_int(i):
            if i < len(cells):
                try:
                    return int(cells[i].get_text(strip=True))
                except ValueError:
                    return 0
            return 0

        # Columns: Season | Matches | Goals | Goals/match |
        #          Green | Green/match | Yellow | Yellow/match | Red | Red/match
        # We skip the "per match" columns — only store totals
        seasons.append({
            "revsports_player_id": player_id,
            "association":         association,
            "season_year":         int(year_text),
            "season_attended":     cell_int(1),
            "season_goals":        cell_int(2),
            "season_green_cards":  cell_int(4),
            "season_yellow_cards": cell_int(6),
            "season_red_cards":    cell_int(8),
            "scraped_at":          datetime.now().isoformat(),
        })

    return seasons


# ─────────────────────────────────────────────
# SUPABASE UPSERT
# ─────────────────────────────────────────────

def upsert_to_supabase(all_seasons):
    """Upsert all season rows into revsports_player_history. Safe to re-run."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        print("\n⚠ SUPABASE_URL or SUPABASE_SERVICE_KEY not set — skipping upsert.")
        return

    if not all_seasons:
        print("\n⚠ No season rows to upsert.")
        return

    try:
        from supabase import create_client
        client      = create_client(supabase_url, supabase_key)
        BATCH_SIZE  = 200
        total       = len(all_seasons)
        num_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
        upserted    = 0

        print(f"\n⏳ Upserting {total} season rows in {num_batches} batch(es)...")

        for i in range(0, total, BATCH_SIZE):
            batch     = all_seasons[i:i + BATCH_SIZE]
            batch_num = (i // BATCH_SIZE) + 1
            print(f"  Batch {batch_num} of {num_batches}...")
            try:
                # on_conflict: update if same player + same year already exists
                client.table("revsports_player_history").upsert(
                    batch, on_conflict="revsports_player_id,season_year"
                ).execute()
                upserted += len(batch)
            except Exception as e:
                print(f"  ✗ Batch {batch_num} failed: {e}")

        print(f"✅ Upsert complete — {upserted} rows.")

    except Exception as e:
        print(f"✗ Supabase error: {e}")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Player History Scraper")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Step 1 — Get player list from Supabase registry
    print("\nFetching player list from registry...")
    players = fetch_players_from_registry()

    if not players:
        print("No players found — run player_registry_scraper.py first.")
        return

    # Step 2 — Scrape history for each player
    all_seasons = []

    with sync_playwright() as p:
        print("\nLaunching headless browser...")
        browser = p.chromium.launch(headless=True)
        page    = browser.new_page()

        total_players = len(players)
        for i, player in enumerate(players, 1):
            name = player.get("player_name", player["revsports_player_id"])
            print(f"  [{i}/{total_players}] {name}")

            seasons = scrape_player_history(page, player)
            all_seasons.extend(seasons)

            # Show a summary for this player
            if seasons:
                years = [s["season_year"] for s in seasons if s["season_attended"] > 0]
                total_games = sum(s["season_attended"] for s in seasons)
                total_goals = sum(s["season_goals"] for s in seasons)
                print(f"    → {len(seasons)} seasons | {total_games} games | {total_goals} goals")
            else:
                print(f"    → No history found")

        browser.close()
        print("\nBrowser closed.")

    print(f"\n{'='*60}")
    print(f"Grand total: {len(all_seasons)} season rows across {len(players)} players")
    print(f"{'='*60}")

    # Step 3 — Upsert to Supabase
    upsert_to_supabase(all_seasons)
    print(f"\nDone! {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()

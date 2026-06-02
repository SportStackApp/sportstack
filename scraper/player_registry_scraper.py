"""
Player Registry Scraper
========================
Scrapes the season-wide Team Statistics page on RevSports for each
association/competition. Builds a master list of every player with their
unique RevSports player ID, season totals, and competition name.

Uses Playwright to open a real browser — needed because the stats page
loads player data via JavaScript (plain requests can't see it).
Also handles JavaScript pagination by clicking through each page.

Run once per season (or at season start) to populate revsports_player_registry.

Requires:
    pip install playwright beautifulsoup4 supabase
    python -m playwright install chromium

Usage:
    python player_registry_scraper.py

Environment variables:
    SUPABASE_URL          — your Supabase project URL
    SUPABASE_SERVICE_KEY  — your Supabase service role key (bypasses RLS)
"""

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import re, os, sys, time
from datetime import datetime

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────

COMPETITIONS = [
    {
        "association":    "Hockey Ballarat",
        "base_url":       "https://www.revolutionise.com.au/hockeyballarat",
        "competition_id": "26298",
    },
    {
        "association":    "Sunraysia Hockey Association",
        "base_url":       "https://www.sunraysiahockey.com.au",
        "competition_id": "26075",   # Grass Field
    },
    {
        "association":    "Sunraysia Hockey Association",
        "base_url":       "https://www.sunraysiahockey.com.au",
        "competition_id": "25775",   # Indoor
    },
    # WHA — URL and competition ID not yet confirmed
]

PAGE_LOAD_TIMEOUT = 15000  # milliseconds
PAGE_TURN_DELAY   = 1.0    # seconds between page clicks

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def extract_player_id(href):
    """
    Extract the RevSports player ID from a player profile link.
    Example: /hockeyballarat/games/statistics/XeRO3I87?competition_id=26298
    Returns: "XeRO3I87"
    """
    match = re.search(r"/statistics/([A-Za-z0-9]+)", href)
    return match.group(1) if match else None


def split_name(raw_name, association):
    """
    Splits a player display name into first_name, last_name, full_name.

    Hockey Ballarat — "First(s) I." e.g. "Aaron M.", "Aamber kaur G."
      last word minus full stop = last name, rest = first name

    Sunraysia — "Surname, Firstname" e.g. "Chapman, Thomas"
      split on comma, swap order
    """
    raw_name = raw_name.strip()

    if "sunraysia" in association.lower():
        if "," in raw_name:
            parts      = raw_name.split(",", 1)
            last_name  = parts[0].strip()
            first_name = parts[1].strip()
        else:
            first_name = raw_name
            last_name  = ""
    else:
        words      = raw_name.split()
        last_name  = words[-1].rstrip(".")
        first_name = " ".join(words[:-1])

    return first_name, last_name, f"{first_name} {last_name}".strip()


def get_competition_name(page, base_url, competition_id):
    """
    Visit the games page and find the competition name that sits above
    the Statistics link for the given competition ID.

    The page structure is:
      <heading>Competition Name</heading>
      ...
      <a href=".../team-stats/26298">Statistics</a>
    """
    games_url = base_url.rstrip("/") + "/games"
    try:
        page.goto(games_url, timeout=PAGE_LOAD_TIMEOUT)
        page.wait_for_load_state("networkidle", timeout=PAGE_LOAD_TIMEOUT)
        soup = BeautifulSoup(page.content(), "html.parser")

        # Find the statistics link for this competition ID
        for a in soup.find_all("a", href=True):
            if f"team-stats/{competition_id}" in a["href"]:
                # Walk up the DOM to find the competition name in a parent element
                parent = a.find_parent()
                for _ in range(6):
                    if parent is None:
                        break
                    text = parent.get_text(" ", strip=True)
                    # The competition name sits just before "Download Statistics"
                    if "Download Statistics" in text:
                        # Strip "Download Statistics" and everything after it
                        name = text.split("Download Statistics")[0].strip()
                        if name:
                            return name
                    parent = parent.find_parent()
    except Exception as e:
        print(f"  ⚠ Could not fetch competition name: {e}")

    return f"Competition {competition_id}"  # Fallback if scraping fails


def parse_players_from_html(html, association, competition_id, competition_name, seen_ids):
    """
    Parse all player rows from one page of the stats table.
    Returns a list of new player dicts (skips any already in seen_ids).

    Column order: # | Name | Attended | Goals | Green | Yellow | Red
    """
    soup    = BeautifulSoup(html, "html.parser")
    players = []

    for row in soup.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 3:
            continue

        link = row.find("a", href=True)
        if not link:
            continue

        player_id = extract_player_id(link["href"])
        if not player_id or player_id in seen_ids:
            continue
        seen_ids.add(player_id)

        raw_name = cells[1].get_text(strip=True)
        if not raw_name:
            continue

        first_name, last_name, player_name = split_name(raw_name, association)

        def cell_int(i):
            if i < len(cells):
                try:
                    return int(cells[i].get_text(strip=True))
                except ValueError:
                    return 0
            return 0

        players.append({
            "revsports_player_id": player_id,
            "competition_id":      competition_id,
            "association":         association,
            "player_name":         player_name,
            "first_name":          first_name,
            "last_name":           last_name,
            "season_attended":     cell_int(2),
            "season_goals":        cell_int(3),
            "season_green_cards":  cell_int(4),
            "season_yellow_cards": cell_int(5),
            "season_red_cards":    cell_int(6),
            "scraped_at":          datetime.now().isoformat(),
        })

        print(f"    ✓ {first_name:20s} {last_name:12s}  ID: {player_id}  "
              f"Played: {cell_int(2)}  Goals: {cell_int(3)}")

    return players


# ─────────────────────────────────────────────
# SCRAPING
# ─────────────────────────────────────────────

def scrape_registry(page, competition):
    """
    Scrape all pages of the team stats page for one competition.
    First fetches the competition name from the games page,
    then clicks through each pagination page to collect all players.
    """
    association    = competition["association"]
    base_url       = competition["base_url"].rstrip("/")
    competition_id = competition["competition_id"]
    stats_url      = f"{base_url}/games/team-stats/{competition_id}"

    print(f"\n{'='*60}")
    print(f"Association:    {association}")
    print(f"Competition ID: {competition_id}")
    print(f"{'='*60}")

    # ── Get competition name from the games page ──────────────
    print(f"  Fetching competition name...")
    competition_name = get_competition_name(page, base_url, competition_id)
    print(f"  Competition: {competition_name}")

    # ── Load the stats page ───────────────────────────────────
    try:
        print(f"  Loading stats page...")
        page.goto(stats_url, timeout=PAGE_LOAD_TIMEOUT)
        page.wait_for_selector("table tr", timeout=PAGE_LOAD_TIMEOUT)
        print(f"  Page loaded.")
    except Exception as e:
        print(f"  ✗ Could not load stats page: {e}")
        return []

    all_players = []
    seen_ids    = set()

    # ── Detect total pages ────────────────────────────────────
    html       = page.content()
    soup       = BeautifulSoup(html, "html.parser")
    paginate   = soup.find("div", id="dataTable_paginate")
    page_links = []
    if paginate:
        for a in paginate.find_all("a", class_="page-link"):
            text = a.get_text(strip=True)
            if text.isdigit():
                page_links.append(int(text))
    total_pages = max(page_links) if page_links else 1
    print(f"  Found {total_pages} page(s) of results.\n")

    # ── Page 1 ────────────────────────────────────────────────
    print(f"  [Page 1 of {total_pages}]")
    players = parse_players_from_html(page.content(), association, competition_id, competition_name, seen_ids)
    all_players.extend(players)
    print(f"  → {len(players)} players")

    # ── Remaining pages ───────────────────────────────────────
    for page_num in range(2, total_pages + 1):
        try:
            print(f"\n  [Page {page_num} of {total_pages}]")
            page.click(f"#dataTable_paginate a.page-link >> text={page_num}")
            time.sleep(PAGE_TURN_DELAY)
            page.wait_for_selector("table tr", timeout=PAGE_LOAD_TIMEOUT)
            players = parse_players_from_html(page.content(), association, competition_id, competition_name, seen_ids)
            all_players.extend(players)
            print(f"  → {len(players)} players")
        except Exception as e:
            print(f"  ✗ Error on page {page_num}: {e}")
            break

    print(f"\n  Total: {len(all_players)} players for {competition_name}")
    return all_players


# ─────────────────────────────────────────────
# SUPABASE UPSERT
# ─────────────────────────────────────────────

def upsert_to_supabase(all_players):
    """Upsert all players into revsports_player_registry. Safe to re-run."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        print("\n⚠ SUPABASE_URL or SUPABASE_SERVICE_KEY not set — skipping upsert.")
        return

    if not all_players:
        print("\n⚠ No players to upsert.")
        return

    try:
        from supabase import create_client
        client      = create_client(supabase_url, supabase_key)
        BATCH_SIZE  = 200
        total       = len(all_players)
        num_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
        upserted    = 0

        print(f"\n⏳ Upserting {total} players in {num_batches} batch(es)...")

        for i in range(0, total, BATCH_SIZE):
            batch     = all_players[i:i + BATCH_SIZE]
            batch_num = (i // BATCH_SIZE) + 1
            print(f"  Batch {batch_num} of {num_batches}...")
            try:
                client.table("revsports_player_registry").upsert(
                    batch, on_conflict="revsports_player_id,competition_id"
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
    print("Player Registry Scraper")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    all_players = []

    with sync_playwright() as p:
        print("\nLaunching headless browser...")
        browser = p.chromium.launch(headless=True)
        page    = browser.new_page()

        for competition in COMPETITIONS:
            players = scrape_registry(page, competition)
            all_players.extend(players)

        browser.close()
        print("\nBrowser closed.")

    print(f"\n{'='*60}")
    print(f"Grand total: {len(all_players)} players across all competitions")
    print(f"{'='*60}")

    upsert_to_supabase(all_players)
    print(f"\nDone! {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()

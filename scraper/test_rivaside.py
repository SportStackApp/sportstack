"""
test_rivaside.py
─────────────────────────────────────────────────────────────
Debug script for the 2 Rivaside/Wanderers U13 Girls matches
that produce blank club_name in the scraper output.

Run from the sportstack/scraper/ directory:
    python test_rivaside.py

What this does:
  1. Fetches each problem match page
  2. Prints the raw HTML heading it finds
  3. Finds the team draws page URLs from the match page
  4. Fetches each team draws page and prints its heading
  5. Runs split_club_and_team() and shows the result
  6. Shows exactly where the split is succeeding or failing
"""

import time
import requests
from bs4 import BeautifulSoup

# ── The 2 problem match URLs ──────────────────────────────────
PROBLEM_URLS = [
    "https://www.sunraysiahockey.com.au/game/2496540",
    "https://www.sunraysiahockey.com.au/game/2496543",
]

# Grade name as stored by the scraper
GRADE_NAME = "U13 Girls"

DELAY = 1  # seconds between requests — be polite to the server


# ── Copied directly from scraper.py ──────────────────────────

def make_session():
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


def get_soup(session, url):
    print(f"  Fetching: {url}")
    time.sleep(DELAY)
    resp = session.get(url, timeout=15)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def split_club_and_team(full_name, grade_name=""):
    """
    Current version from scraper.py — copy this here and edit to test changes.
    Everything to the left of grade_name (after stripping the · prefix) = club.
    Everything to the right = team name.
    """
    # Step 1: strip the competition prefix if present
    if "·" in full_name:
        full_name = full_name.split("·", 1)[-1].strip()

    print(f"    After · strip  : {repr(full_name)}")
    print(f"    Looking for    : {repr(grade_name)}")

    # Step 2-4: split on grade name
    if grade_name and grade_name in full_name:
        idx  = full_name.index(grade_name)
        club = full_name[:idx].strip()
        team = full_name[idx + len(grade_name):].strip()
        if not team:
            team = grade_name
        print(f"    ✅ Split found at index {idx}")
        return club, team

    print(f"    ❌ Grade name not found — falling back to repeated-word method")

    # Step 5: fallback — find the first repeated word
    words = full_name.split()
    seen  = {}
    for i, word in enumerate(words):
        if word in seen:
            print(f"    Fallback split on repeated word: {repr(word)} at index {i}")
            return " ".join(words[:i]), " ".join(words[i:])
        seen[word] = i

    return "", full_name


# ── Main debug loop ───────────────────────────────────────────

def debug_match(session, match_url):
    print()
    print("=" * 60)
    print(f"MATCH: {match_url}")
    print("=" * 60)

    soup = get_soup(session, match_url)

    # Find the page heading
    for tag in ["h1", "h2", "h3"]:
        heading = soup.find(tag)
        if heading:
            print(f"  Match page <{tag}>: {repr(heading.get_text(strip=True))}")
            break

    # Find team draws page links (URLs matching /games/team/)
    team_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/games/team/" in href:
            full_url = href if href.startswith("http") else "https://www.sunraysiahockey.com.au" + href
            if full_url not in team_links:
                team_links.append(full_url)

    print(f"  Team draws URLs found: {len(team_links)}")
    for url in team_links:
        print(f"    {url}")

    # Fetch each team draws page and try to split
    for team_url in team_links:
        print()
        print(f"  ── Team draws page: {team_url}")
        try:
            team_soup = get_soup(session, team_url)
            for tag in ["h2", "h1", "h3"]:
                heading = team_soup.find(tag)
                if heading:
                    raw = heading.get_text(strip=True)
                    print(f"    Heading: {repr(raw)}")
                    club, team = split_club_and_team(raw, GRADE_NAME)
                    print(f"    → club: {repr(club)}")
                    print(f"    → team: {repr(team)}")
                    break
        except Exception as e:
            print(f"    ERROR fetching team page: {e}")


if __name__ == "__main__":
    session = make_session()
    for url in PROBLEM_URLS:
        debug_match(session, url)

    print()
    print("Done.")

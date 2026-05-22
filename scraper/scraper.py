"""
Hockey Results Scraper — Headless (GitHub Actions version)
============================================================
Runs without a GUI. Configure the variables below, or set them
as GitHub Actions environment variables.

Output: data/hockey_results.csv  and  data/hockey_results.json
"""

import requests
from bs4 import BeautifulSoup
import json, csv, time, re, os
from datetime import datetime
from urllib.parse import urlparse

# ─────────────────────────────────────────────
# CONFIG — edit these or set as GitHub secrets/env vars
# ─────────────────────────────────────────────

PORTAL_URL  = os.getenv("PORTAL_URL", "https://www.revolutionise.com.au/hockeyballarat")
ONLY_GRADES = os.getenv("ONLY_GRADES", "")   # Comma-separated, e.g. "Division 1 Men,Womens"
ONLY_ROUNDS = os.getenv("ONLY_ROUNDS", "")   # Comma-separated, e.g. "Round 1,Round 2"
ONLY_TEAM   = os.getenv("ONLY_TEAM",   "")   # Partial match, e.g. "Grampians"
OUTPUT_DIR  = os.getenv("OUTPUT_DIR",  "../data")DELAY       = 0.8

# Parse comma-separated env vars into lists (empty string = all)
only_grades = [g.strip() for g in ONLY_GRADES.split(",") if g.strip()] or None
only_rounds = [r.strip() for r in ONLY_ROUNDS.split(",") if r.strip()] or None
only_team   = ONLY_TEAM.strip() or None

# ─────────────────────────────────────────────
# SCRAPING
# ─────────────────────────────────────────────

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


def normalize_url(href, page_url):
    if href.startswith("http"):
        return href
    parsed = urlparse(page_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    return base + href if href.startswith("/") else base + "/" + href


def path_matches(href, pattern):
    return bool(re.search(pattern, urlparse(href).path))


def get_all_grades(session, base_url):
    games_url = base_url.rstrip("/") + "/games"
    soup = get_soup(session, games_url)
    grades, seen = [], set()
    for a in soup.find_all("a", href=True):
        href = normalize_url(a["href"], games_url)
        if href not in seen and path_matches(href, r"/games/\d+/\d+$"):
            seen.add(href)
            name = a.get_text(strip=True)
            if name:
                grades.append({"name": name, "url": href})
    return grades


def get_rounds(session, grade_url):
    soup = get_soup(session, grade_url)
    rounds, seen = [], set()
    for a in soup.find_all("a", href=True):
        href = normalize_url(a["href"], grade_url)
        if href not in seen and path_matches(href, r"/games/\d+/\d+/round/\d+"):
            seen.add(href)
            label = a.get_text(strip=True)
            if label:
                rounds.append({"round_label": label, "url": href})
    return rounds


def get_game_links(session, round_url):
    soup = get_soup(session, round_url)
    game_urls, seen = [], set()
    for a in soup.find_all("a", href=True):
        href = normalize_url(a["href"], round_url)
        if href not in seen and path_matches(href, r"/game/\d+$"):
            seen.add(href)
            game_urls.append(href)
    return game_urls


def scrape_match(session, game_url):
    soup = get_soup(session, game_url)
    for hidden in soup.select(".d-none, .d-lg-none"):
        hidden.decompose()

    match = {
        "url": game_url,
        "date": None, "time": None, "venue": None,
        "home_team": None, "away_team": None,
        "home_score": None, "away_score": None,
        "umpires": [], "teams": [],
    }

    # Date & time
    page_text = soup.get_text(" ", strip=True)
    dm = re.search(
        r"((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+\w+\s+\d{4})\s+(\d{1,2}:\d{2})",
        page_text
    )
    if dm:
        match["date"] = dm.group(1).strip()
        match["time"] = dm.group(2).strip()

    # Venue, umpires, scores — line-by-line
    STOP = {"venue", "date & time", "match card", "umpires", "umpire"}
    lines = [l.strip() for l in soup.get_text("\n").split("\n") if l.strip()]
    for i, line in enumerate(lines):
        ll = line.lower()
        if ll == "venue" and match["venue"] is None:
            for k in range(i + 1, min(i + 4, len(lines))):
                if lines[k].lower() not in STOP:
                    match["venue"] = lines[k]; break
        if ll in ("umpire", "umpires") and not match["umpires"]:
            for k in range(i + 1, min(i + 5, len(lines))):
                if lines[k].lower() in STOP: break
                match["umpires"].append(lines[k])
        if any(kw in ll for kw in ("won!", "draw", "forfeit", "walkover", "bye")):
            remaining = lines[i + 1:]
            found = 0
            for j, item in enumerate(remaining):
                if re.match(r"^\d+$", item):
                    if found == 0:
                        match["home_score"] = item
                        if j + 1 < len(remaining): match["home_team"] = remaining[j + 1]
                    elif found == 1:
                        match["away_score"] = item
                        if j + 1 < len(remaining): match["away_team"] = remaining[j + 1]
                    found += 1
                    if found == 2: break

    # Match card
    tables = soup.find_all("table", class_="table")
    for table in tables:
        heading = table.find_previous(["h2", "h3", "h4", "h5", "h6"])

        if heading:
            # RevSports headings contain two parts: club name then team name.
            # e.g. "EGC" + "EGC Gold" — we want just the last part (team name)
            # and the first part (club name) stored separately.
            text_nodes = [s.strip() for s in heading.strings if s.strip()]
            club_name = text_nodes[0] if len(text_nodes) >= 2 else ""
            team_name = text_nodes[-1] if text_nodes else "Unknown"
        else:
            club_name = ""
            team_name = "Unknown"

        players = []
        in_fillins = False
        for row in table.find_all("tr")[1:]:
            cells = row.find_all("td")
            if not cells: continue
            name_text = cells[0].get_text(" ", strip=True)
            if not name_text.strip(): continue
            norm = " ".join(name_text.split()).lower()
            if "fill-in" in norm:
                in_fillins = True; continue
            if any(j in norm for j in ["removed from team", "goals",
                                        "green card", "yellow card", "red card"]):
                in_fillins = False; continue
            attended = in_fillins or bool(row.find(class_=re.compile(r"\bfa-check\b")))
            name_clean = re.sub(r"^\d+\.\s*", "", name_text).strip()
            if not name_clean: continue
            jersey = None
            jm = re.search(r"\(#(\d+)\)", name_clean)
            if jm: jersey = jm.group(1)
            role = None
            rm = re.search(r"\(([^#\d][^)]*)\)", name_clean)
            if rm: role = rm.group(1).strip()
            player_name = re.sub(r"\s*\([^)]*\)", "", name_clean).strip()
            if not player_name: continue
            players.append({
                "name": player_name, "jersey": jersey, "role": role,
                "attended": attended,
                "goals":         cells[1].get_text(strip=True) if len(cells) > 1 else "",
                "green_cards":   cells[2].get_text(strip=True) if len(cells) > 2 else "",
                "yellow_cards":  cells[3].get_text(strip=True) if len(cells) > 3 else "",
                "red_cards":     cells[4].get_text(strip=True) if len(cells) > 4 else "",
            })
        if players:
            # Store both club_name and team_name for each team
            match["teams"].append({
                "team_name": team_name,
                "club_name": club_name,
                "players": players,
            })

    if match["home_team"] is None and len(match.get("teams", [])) >= 1:
        match["home_team"] = match["teams"][0]["team_name"]
    if match["away_team"] is None and len(match.get("teams", [])) >= 2:
        match["away_team"] = match["teams"][1]["team_name"]

    return match


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Hockey Results Scraper — Headless")
    print(f"Started:  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Portal:   {PORTAL_URL}")
    print(f"Grades:   {only_grades or 'All'}")
    print(f"Rounds:   {only_rounds or 'All'}")
    print(f"Team:     {only_team or 'All'}")
    print("=" * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    session = make_session()
    all_results, csv_rows = [], []

    grades = get_all_grades(session, PORTAL_URL)
    print(f"\nFound {len(grades)} grades.")

    for grade in grades:
        if only_grades and grade["name"] not in only_grades:
            print(f"[Grade] {grade['name']} — skipped"); continue
        print(f"\n[Grade] {grade['name']}")

        rounds = get_rounds(session, grade["url"])
        print(f"  {len(rounds)} rounds.")

        for rnd in rounds:
            if only_rounds and rnd["round_label"] not in only_rounds:
                print(f"  [Round] {rnd['round_label']} — skipped"); continue
            print(f"\n  [Round] {rnd['round_label']}")

            game_urls = get_game_links(session, rnd["url"])
            print(f"    {len(game_urls)} games.")

            for game_url in game_urls:
                try:
                    match = scrape_match(session, game_url)
                    match["grade"] = grade["name"]
                    match["round"] = rnd["round_label"]
                    all_results.append(match)

                    for team in match.get("teams", []):
                        if only_team and only_team.lower() not in team["team_name"].lower():
                            continue
                        for player in team["players"]:
                            csv_rows.append({
                                "grade": grade["name"],
                                "round": rnd["round_label"],
                                "date": match["date"],
                                "time": match["time"],
                                "venue": match["venue"],
                                "home_team": match["home_team"],
                                "away_team": match["away_team"],
                                "home_score": match["home_score"],
                                "away_score": match["away_score"],
                                "umpire_1": match["umpires"][0] if len(match["umpires"]) > 0 else "",
                                "umpire_2": match["umpires"][1] if len(match["umpires"]) > 1 else "",
                                "team": team["team_name"],       # e.g. "EGC Gold"
                                "club_name": team["club_name"],  # e.g. "EGC"
                                "player_name": player["name"],
                                "jersey": player["jersey"],
                                "role": player["role"],
                                "attended": player["attended"],
                                "goals": player["goals"],
                                "green_cards": player["green_cards"],
                                "yellow_cards": player["yellow_cards"],
                                "red_cards": player["red_cards"],
                                "match_url": game_url,
                                "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            })

                    print(f"    ✓ {match.get('home_team','?')} {match.get('home_score','?')}"
                          f" – {match.get('away_score','?')} {match.get('away_team','?')}")

                except Exception as e:
                    print(f"    ✗ ERROR: {game_url} — {e}")

    # Save CSV
    csv_path = os.path.join(OUTPUT_DIR, "hockey_results.csv")
    if csv_rows:
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=csv_rows[0].keys())
            writer.writeheader()
            writer.writerows(csv_rows)
        print(f"\n✅ CSV: {csv_path}  ({len(csv_rows)} rows)")

    # Save JSON
    json_path = os.path.join(OUTPUT_DIR, "hockey_results.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"✅ JSON: {json_path}  ({len(all_results)} matches)")

    print(f"\nDone! {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()

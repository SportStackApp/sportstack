"""
Match Scraper — Headless (GitHub Actions version)
============================================================
Scrapes match results and player appearances from RevSports.
Runs without a GUI. Configure via environment variables below.

Output: ../data/hockey_results.csv  and  ../data/hockey_results.json

Changes from original:
  - Added ASSOCIATION_NAME and competition_name capture from games page
  - Extracts revsports_player_id from each player's link on the match card
  - Adds association, competition_name, revsports_player_id to every row
"""

import requests
from bs4 import BeautifulSoup
import json, csv, time, re, os, sys
from datetime import datetime
from urllib.parse import urlparse

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# ─────────────────────────────────────────────
# CONFIG — edit these or set as GitHub secrets/env vars
# ─────────────────────────────────────────────

PORTAL_URL       = os.getenv("PORTAL_URL",       "https://www.revolutionise.com.au/hockeyballarat")
ASSOCIATION_NAME = os.getenv("ASSOCIATION_NAME", "Hockey Ballarat")
ONLY_GRADES      = os.getenv("ONLY_GRADES",      "")   # Comma-separated
ONLY_ROUNDS      = os.getenv("ONLY_ROUNDS",      "")   # Comma-separated
ONLY_TEAM        = os.getenv("ONLY_TEAM",        "")   # Partial match
OUTPUT_DIR       = os.getenv("OUTPUT_DIR",       "../data")
DELAY            = 0.8

only_grades = [g.strip() for g in ONLY_GRADES.split(",") if g.strip()] or None
only_rounds = [r.strip() for r in ONLY_ROUNDS.split(",") if r.strip()] or None
only_team   = ONLY_TEAM.strip() or None

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def split_venue_and_pitch(venue_line, pitch_line=None):
    """
    Splits a venue string into a clean (venue, pitch) pair.

    PATTERN A — Separate pitch line exists:
      venue = venue_line, pitch = pitch_line

    PATTERN B — Pitch merged into venue with " - ":
      e.g. "Prince of Wales Park - 1/2 Pitch North"
      venue = "Prince of Wales Park", pitch = "1/2 Pitch North"

    PATTERN C — No pitch info at all:
      venue = venue_line, pitch = "Full Pitch"
    """
    if pitch_line:
        return venue_line.strip(), pitch_line.strip()
    if " - " in venue_line:
        parts = venue_line.split(" - ", 1)
        return parts[0].strip(), parts[1].strip()
    return venue_line.strip(), "Full Pitch"


def split_club_and_team(full_name, grade_name=""):
    """
    Splits a heading like "Blaze Under 11 Open U11 Blaze Red" into
    club = "Blaze" and team = "U11 Blaze Red" using the grade name as separator.
    Falls back to finding the first repeated word if grade not found.
    """
    if grade_name and grade_name in full_name:
        idx  = full_name.index(grade_name)
        club = full_name[:idx].strip()
        team = full_name[idx + len(grade_name):].strip()
        if not team:
            team = grade_name
        return club, team
    words = full_name.split()
    seen  = {}
    for i, word in enumerate(words):
        if word in seen:
            return " ".join(words[:i]), " ".join(words[i:])
        seen[word] = i
    return "", full_name


def get_team_name_from_draws_page(session, team_url, grade_name):
    """Visit a team draws page and extract clean club + team name from heading."""
    try:
        soup = get_soup(session, team_url)
        for tag in ["h2", "h1", "h3"]:
            heading = soup.find(tag)
            if heading:
                full_text = heading.get_text(strip=True)
                if "·" in full_text:
                    full_text = full_text.split("·", 1)[-1].strip()
                club, team = split_club_and_team(full_text, grade_name)
                return club, team
    except Exception as e:
        print(f"    ⚠ Could not fetch team page {team_url}: {e}")
    return "", "Unknown"


def extract_player_id_from_row(row, game_url):
    """
    Extract the RevSports player ID from the player link in a match card row.

    Each player name on a match page is a link, e.g.:
      <a href="/hockeyballarat/games/statistics/qzrbDcZ?competition_id=26298">Aaron M.</a>

    We extract the alphanumeric ID between /statistics/ and the next ? or end.
    Returns None if no link or ID found.
    """
    link = row.find("a", href=True)
    if not link:
        return None
    match = re.search(r"/statistics/([A-Za-z0-9]+)", link["href"])
    return match.group(1) if match else None


def get_competition_name(session, base_url):
    """
    Visit the games page and scrape the competition name from the heading
    that sits above the Statistics link.

    Returns a fallback string if not found.
    """
    games_url = base_url.rstrip("/") + "/games"
    try:
        soup = get_soup(session, games_url)
        for a in soup.find_all("a", href=True):
            if "team-stats" in a["href"]:
                # Walk up the DOM to find the competition name
                parent = a.find_parent()
                for _ in range(6):
                    if parent is None:
                        break
                    text = parent.get_text(" ", strip=True)
                    if "Download Statistics" in text:
                        name = text.split("Download Statistics")[0].strip()
                        if name:
                            return name
                    parent = parent.find_parent()
    except Exception as e:
        print(f"  ⚠ Could not fetch competition name: {e}")
    return ASSOCIATION_NAME  # Fallback to association name


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
    base   = f"{parsed.scheme}://{parsed.netloc}"
    return base + href if href.startswith("/") else base + "/" + href


def path_matches(href, pattern):
    return bool(re.search(pattern, urlparse(href).path))


def find_fixture_card(link_tag, game_url, round_url):
    node = link_tag
    for _ in range(12):
        node = node.parent
        if node is None or not hasattr(node, "find_all"):
            break
        anchors       = [normalize_url(a["href"], round_url) for a in node.find_all("a", href=True)]
        text          = node.get_text("\n", strip=True)
        has_game      = game_url in anchors
        has_teams     = any(path_matches(h, r"/games/team/\d+/\d+$") for h in anchors)
        has_date_time = bool(re.search(r"\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+\w+\s+\d{4}\b", text))
        if has_game and (has_teams or has_date_time):
            return node
    return None


def get_round_card_venue_and_pitch(card):
    if card is None:
        return None, None
    for hidden in card.select(".d-none, .d-lg-none"):
        hidden.decompose()
    team_link_texts = {
        a.get_text(" ", strip=True)
        for a in card.find_all("a", href=True)
        if path_matches(a["href"], r"/games/team/\d+/\d+$")
    }
    lines          = [l.strip() for l in card.get_text("\n").split("\n") if l.strip()]
    location_lines = []
    collecting     = False
    for line in lines:
        lower = line.lower()
        if lower in {"details", "umpire", "umpires", "byes"}: break
        if line in team_link_texts: break
        if re.match(r"^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+\w+\s+\d{4}$", line):
            collecting = True; continue
        if collecting and re.match(r"^\d{1,2}:\d{2}$", line): continue
        if collecting:
            if re.match(r"^\d+\s*-\s*\d+$", line) or re.match(r"^\d+$", line): break
            if lower.startswith("umpires"): break
            location_lines.append(line)
    cleaned = []
    for line in location_lines:
        line = re.sub(r"\s+", " ", line).strip(" -")
        if line and line not in cleaned:
            cleaned.append(line)
    if not cleaned:
        return None, None
    return split_venue_and_pitch(cleaned[0], cleaned[1] if len(cleaned) > 1 else None)


def get_all_grades(session, base_url):
    games_url = base_url.rstrip("/") + "/games"
    try:
        soup = get_soup(session, games_url)
    except Exception as e:
        print(f"⚠ Could not fetch grades page: {e}")
        return []
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
    try:
        soup = get_soup(session, grade_url)
    except Exception as e:
        print(f"  ⚠ Could not fetch rounds page: {e}")
        return []
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
    try:
        soup = get_soup(session, round_url)
    except Exception as e:
        print(f"    ⚠ Skipping round (could not fetch): {e}")
        return []
    games, current_team_urls, seen = [], [], set()
    for a in soup.find_all("a", href=True):
        href = normalize_url(a["href"], round_url)
        if href in seen: continue
        seen.add(href)
        if path_matches(href, r"/games/team/\d+/\d+$"):
            current_team_urls.append(href)
        elif path_matches(href, r"/game/\d+$"):
            fixture_card = find_fixture_card(a, href, round_url)
            round_venue, round_pitch = get_round_card_venue_and_pitch(fixture_card)
            games.append({
                "game_url":    href,
                "team_urls":   current_team_urls[:2],
                "round_venue": round_venue,
                "round_pitch": round_pitch,
            })
            current_team_urls = []
    return games


def scrape_match(session, game_url, grade_name="", team_urls=None,
                 round_venue=None, round_pitch=None):
    """
    Scrape a single match page and return all player rows with full context.
    Now also extracts revsports_player_id from each player's link.
    """
    soup = get_soup(session, game_url)
    for hidden in soup.select(".d-none, .d-lg-none"):
        hidden.decompose()

    match = {
        "url": game_url,
        "date": None, "time": None,
        "venue": round_venue, "pitch": round_pitch,
        "home_team": None, "away_team": None,
        "home_score": None, "away_score": None,
        "umpires": [], "teams": [],
    }

    # ── Date & time ──────────────────────────────────────────
    page_text = soup.get_text(" ", strip=True)
    dm = re.search(
        r"((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+\w+\s+\d{4})\s+(\d{1,2}:\d{2})",
        page_text
    )
    if dm:
        date_str = dm.group(1).strip()
        try:
            match["date"] = datetime.strptime(date_str, "%a %d %B %Y").strftime("%Y-%m-%d")
        except ValueError:
            match["date"] = date_str
        match["time"] = dm.group(2).strip()

    # ── Team names from draws pages ───────────────────────────
    team_page_urls = team_urls or []
    if not team_page_urls:
        seen_team_urls = set()
        for a in soup.find_all("a", href=True):
            href = normalize_url(a["href"], game_url)
            if href not in seen_team_urls and path_matches(href, r"/games/team/\d+/\d+$"):
                seen_team_urls.add(href)
                team_page_urls.append(href)

    team_info = []
    for team_url in team_page_urls[:2]:
        club, team = get_team_name_from_draws_page(session, team_url, grade_name)
        team_info.append({"club_name": club, "team_name": team, "url": team_url})
        print(f"      → Club: '{club}'  Team: '{team}'")

    if len(team_info) >= 1: match["home_team"] = team_info[0]["team_name"]
    if len(team_info) >= 2: match["away_team"] = team_info[1]["team_name"]

    # ── Umpires & scores ─────────────────────────────────────
    STOP  = {"venue", "date & time", "match card", "umpires", "umpire"}
    lines = [l.strip() for l in soup.get_text("\n").split("\n") if l.strip()]
    for i, line in enumerate(lines):
        ll = line.lower()
        if ll == "venue" and match["venue"] is None:
            for k in range(i + 1, min(i + 4, len(lines))):
                if lines[k].lower() not in STOP:
                    match["venue"], match["pitch"] = split_venue_and_pitch(lines[k])
                    break
        if ll in ("umpire", "umpires") and not match["umpires"]:
            for k in range(i + 1, min(i + 5, len(lines))):
                if lines[k].lower() in STOP: break
                match["umpires"].append(lines[k])
        if any(kw in ll for kw in ("won!", "draw", "forfeit", "walkover", "bye")):
            found = 0
            for item in lines[i + 1:]:
                if re.match(r"^\d+$", item):
                    if found == 0: match["home_score"] = item
                    elif found == 1: match["away_score"] = item
                    found += 1
                    if found == 2: break

    # ── Match card tables — one per team ─────────────────────
    tables = soup.find_all("table", class_="table")
    for i, table in enumerate(tables):
        if i < len(team_info):
            club_name = team_info[i]["club_name"]
            team_name = team_info[i]["team_name"]
        else:
            heading   = table.find_previous(["h2", "h3", "h4", "h5", "h6"])
            raw_name  = heading.get_text(strip=True) if heading else "Unknown"
            club_name, team_name = split_club_and_team(raw_name, grade_name)

        players    = []
        in_fillins = False
        in_removed = False

        for row in table.find_all("tr")[1:]:
            cells = row.find_all("td")
            if not cells: continue
            name_text = cells[0].get_text(" ", strip=True)
            if not name_text.strip(): continue
            norm = " ".join(name_text.split()).lower()

            if "fill-in" in norm:
                in_fillins = True; in_removed = False; continue
            if "removed from team" in norm:
                in_removed = True; in_fillins = False; continue
            if any(j in norm for j in ["goals", "green card", "yellow card", "red card"]):
                continue

            attended   = (not in_removed) and (
                in_fillins or bool(row.find(class_=re.compile(r"\bfa-check\b")))
            )
            name_clean = re.sub(r"^\d+\.\s*", "", name_text).strip()
            if not name_clean: continue

            jersey = None
            jm     = re.search(r"\(#(\d+)\)", name_clean)
            if jm: jersey = jm.group(1)

            role = None
            rm   = re.search(r"\(([^#\d][^)]*)\)", name_clean)
            if rm: role = rm.group(1).strip()

            player_name = re.sub(r"\s*\([^)]*\)", "", name_clean).strip()
            if not player_name: continue

            # Extract RevSports player ID from the player's link in this row
            # Each name is a link like: /games/statistics/qzrbDcZ?competition_id=...
            revsports_player_id = extract_player_id_from_row(row, game_url)

            players.append({
                "name":                player_name,
                "jersey":              jersey,
                "role":                role,
                "attended":            attended,
                "is_fillin":           in_fillins,
                "is_removed":          in_removed,
                "revsports_player_id": revsports_player_id,  # NEW
                "goals":               cells[1].get_text(strip=True) if len(cells) > 1 else "",
                "green_cards":         cells[2].get_text(strip=True) if len(cells) > 2 else "",
                "yellow_cards":        cells[3].get_text(strip=True) if len(cells) > 3 else "",
                "red_cards":           cells[4].get_text(strip=True) if len(cells) > 4 else "",
            })

        if players:
            match["teams"].append({
                "team_name": team_name,
                "club_name": club_name,
                "players":   players,
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
    print("Match Scraper — Headless")
    print(f"Started:     {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Portal:      {PORTAL_URL}")
    print(f"Association: {ASSOCIATION_NAME}")
    print(f"Grades:      {only_grades or 'All'}")
    print(f"Rounds:      {only_rounds or 'All'}")
    print(f"Team:        {only_team or 'All'}")
    print("=" * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    session = make_session()

    # Fetch competition name from the games page
    print("\nFetching competition name...")
    competition_name = get_competition_name(session, PORTAL_URL)
    print(f"Competition: {competition_name}")

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

            games = get_game_links(session, rnd["url"])
            print(f"    {len(games)} games.")

            for game_info in games:
                try:
                    match = scrape_match(
                        session,
                        game_info["game_url"],
                        grade_name=grade["name"],
                        team_urls=game_info["team_urls"],
                        round_venue=game_info.get("round_venue"),
                        round_pitch=game_info.get("round_pitch"),
                    )
                    match["grade"] = grade["name"]
                    match["round"] = rnd["round_label"]
                    all_results.append(match)

                    for team in match.get("teams", []):
                        if only_team and only_team.lower() not in team["team_name"].lower():
                            continue
                        for player in team["players"]:
                            csv_rows.append({
                                "association":         ASSOCIATION_NAME,
                                "competition_name":    competition_name,
                                "grade":               grade["name"],
                                "round":               rnd["round_label"],
                                "game_date":           match["date"],
                                "game_time":           match["time"],
                                "venue":               match["venue"],
                                "pitch":               match["pitch"],
                                "home_team":           match["home_team"],
                                "away_team":           match["away_team"],
                                "home_score":          match["home_score"],
                                "away_score":          match["away_score"],
                                "umpire_1":            match["umpires"][0] if len(match["umpires"]) > 0 else "",
                                "umpire_2":            match["umpires"][1] if len(match["umpires"]) > 1 else "",
                                "team":                team["team_name"],
                                "club_name":           team["club_name"],
                                "player_name":         player["name"],
                                "jersey":              player["jersey"],
                                "role":                player["role"],
                                "attended":            player["attended"],
                                "is_fillin":           player["is_fillin"],
                                "is_removed":          player["is_removed"],
                                "revsports_player_id": player["revsports_player_id"],  # NEW
                                "goals":               player["goals"],
                                "green_cards":         player["green_cards"],
                                "yellow_cards":        player["yellow_cards"],
                                "red_cards":           player["red_cards"],
                                "match_url":           game_info["game_url"],
                                "scraped_at":          datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                            })

                    print(f"    ✓ {match.get('home_team','?')} {match.get('home_score','?')}"
                          f" – {match.get('away_score','?')} {match.get('away_team','?')}"
                          f"  @ {match.get('venue','?')} / {match.get('pitch','?')}")

                except Exception as e:
                    print(f"    ✗ ERROR: {game_info['game_url']} — {e}")

    # ── Save CSV ─────────────────────────────────────────────
    csv_path = os.path.join(OUTPUT_DIR, "hockey_results.csv")
    if csv_rows:
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=csv_rows[0].keys())
            writer.writeheader()
            writer.writerows(csv_rows)
        print(f"\n✅ CSV: {csv_path}  ({len(csv_rows)} rows)")
    else:
        print("\n⚠ No rows scraped — CSV not written.")

    # ── Save JSON ─────────────────────────────────────────────
    json_path = os.path.join(OUTPUT_DIR, "hockey_results.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"✅ JSON: {json_path}  ({len(all_results)} matches)")

    # ── Upsert to Supabase ────────────────────────────────────
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        print("\n⚠ SUPABASE_URL or SUPABASE_SERVICE_KEY not set — skipping upsert.")
    elif not csv_rows:
        print("\n⚠ No rows to upsert.")
    else:
        try:
            from supabase import create_client
            client = create_client(supabase_url, supabase_key)

            def clean_row(row):
                cleaned = {}
                for k, v in row.items():
                    cleaned[k] = None if v == "" or v is None else v
                for field in ["home_score", "away_score", "goals",
                               "green_cards", "yellow_cards", "red_cards"]:
                    if cleaned.get(field) is not None:
                        try:    cleaned[field] = int(cleaned[field])
                        except: cleaned[field] = None
                for field in ["attended", "is_fillin", "is_removed"]:
                    if cleaned.get(field) is not None:
                        cleaned[field] = str(cleaned[field]).strip().lower() == "true"
                return cleaned

            cleaned_rows = [clean_row(r) for r in csv_rows]
            BATCH_SIZE   = 200
            total        = len(cleaned_rows)
            num_batches  = (total + BATCH_SIZE - 1) // BATCH_SIZE
            upserted     = 0

            print(f"\n⏳ Upserting {total} rows in {num_batches} batch(es)...")

            for i in range(0, total, BATCH_SIZE):
                batch     = cleaned_rows[i:i + BATCH_SIZE]
                batch_num = (i // BATCH_SIZE) + 1
                print(f"  Batch {batch_num} of {num_batches}...")
                try:
                    client.table("revsports_players").upsert(
                        batch,
                        on_conflict="match_url,player_name,team,is_fillin"
                    ).execute()
                    upserted += len(batch)
                except Exception as e:
                    print(f"  ✗ Batch {batch_num} failed: {e}")

            print(f"✅ Supabase upsert complete — {upserted} rows.")

        except Exception as e:
            print(f"✗ Supabase error: {e}")

    print(f"\nDone! {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()

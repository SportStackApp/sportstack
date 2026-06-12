"""
Match Scraper — Headless (GitHub Actions version)
============================================================
Scrapes match results and player appearances from RevSports.
Runs without a GUI. Configure via environment variables below.

Output: ../data/{association}_results.csv  and  ../data/{association}_results.json

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

def run_quality_check(csv_rows: list[dict], output_dir: str, association: str) -> int:
    """
    Scans all scraped rows for data quality issues.
    Prints a report to console and writes it to a .txt file in output_dir.
    Returns the number of rows with issues.
    """
    from datetime import datetime as dt

    # ── Rules ────────────────────────────────────────────────────────────────
    # Each entry: (column_name, rule, description)
    # Rules: "required" = must not be empty
    #        "numeric"  = must be a number if not empty
    #        "boolean"  = must be True/False/true/false/0/1 if not empty
    #        "date"     = must look like a date (YYYY-MM-DD or DD/MM/YYYY)

    RULES = [
        ("association",          "required", "Must never be empty"),
        ("competition_name",     "required", "Must never be empty"),
        ("grade",                "required", "Must never be empty"),
        ("round",                "required", "Must never be empty"),
        ("home_team",            "required", "Must never be empty"),
        ("away_team",            "required", "Must never be empty"),
        ("team",                 "required", "Must never be empty"),
        ("player_name",          "required", "Must never be empty"),
        ("revsports_player_id",  "required", "Must never be empty"),
        ("club_name",            "required", "Must never be empty"),
        ("game_date",            "date",     "Must look like a date"),
        ("home_score",           "numeric",  "Must be a number if not empty"),
        ("away_score",           "numeric",  "Must be a number if not empty"),
        ("goals",                "numeric",  "Must be a number if not empty"),
        ("green_cards",          "numeric",  "Must be a number if not empty"),
        ("yellow_cards",         "numeric",  "Must be a number if not empty"),
        ("red_cards",            "numeric",  "Must be a number if not empty"),
        ("jersey",               "numeric",  "Must be a number if not empty"),
        ("attended",             "boolean",  "Must be True/False if not empty"),
        ("is_fillin",            "boolean",  "Must be True/False if not empty"),
        ("is_removed",           "boolean",  "Must be True/False if not empty"),
    ]

    def is_numeric(val):
        try:
            float(str(val))
            return True
        except (ValueError, TypeError):
            return False

    def is_boolean(val):
        return str(val).strip().lower() in ("true", "false", "1", "0", "yes", "no", "")

    def is_date(val):
        if not val or str(val).strip() == "":
            return True  # empty is allowed — game may not have a date yet
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y"):
            try:
                dt.strptime(str(val).strip(), fmt)
                return True
            except ValueError:
                continue
        return False

    # ── Scan rows ────────────────────────────────────────────────────────────
    column_issues = {col: [] for col, _, _ in RULES}  # col -> list of row indices

    for i, row in enumerate(csv_rows):
        for col, rule, _ in RULES:
            val = row.get(col, "")
            failed = False
            if rule == "required":
                failed = (val is None or str(val).strip() == "")
            elif rule == "numeric":
                failed = (val not in (None, "") and not is_numeric(val))
            elif rule == "boolean":
                failed = (val not in (None, "") and not is_boolean(val))
            elif rule == "date":
                failed = not is_date(val)
            if failed:
                column_issues[col].append(i)

    # ── Build report ─────────────────────────────────────────────────────────
    total_rows    = len(csv_rows)
    bad_row_idxs  = set(idx for idxs in column_issues.values() for idx in idxs)
    total_bad     = len(bad_row_idxs)
    pct           = (total_bad / total_rows * 100) if total_rows else 0

    lines = [
        f"DATA QUALITY REPORT — {association}",
        f"Generated: {dt.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "─" * 60,
        f"Total rows scraped : {total_rows:,}",
        f"Rows with issues   : {total_bad:,}  ({pct:.1f}%)",
        "",
        "COLUMN ISSUES:",
    ]

    any_issues = False
    for col, rule, desc in RULES:
        count = len(column_issues[col])
        if count > 0:
            any_issues = True
            lines.append(f"  {col:<25} — {count} row(s) failing '{rule}' rule")

    if not any_issues:
        lines.append("  ✅ No issues found — all columns look clean!")

    # Sample up to 5 bad rows
    if bad_row_idxs:
        lines.append("")
        lines.append("SAMPLE PROBLEM ROWS (first 5):")
        for idx in sorted(bad_row_idxs)[:5]:
            row = csv_rows[idx]
            bad_cols = [col for col, idxs in column_issues.items() if idx in idxs]
            lines.append(
                f"  Row {idx+1:>4}: grade={row.get('grade','?')!r:20} "
                f"team={row.get('team','?')!r:20} "
                f"player={row.get('player_name','?')!r:20} "
                f"| BAD COLUMNS: {', '.join(bad_cols)}"
            )

    lines.append("")
    lines.append("─" * 60)
    report_text = "\n".join(lines)

    # ── Print to console ─────────────────────────────────────────────────────
    print("\n" + report_text)

    # ── Write to file ────────────────────────────────────────────────────────
    import os
    assoc_slug   = association.lower().replace(" ", "_")
    report_path  = os.path.join(output_dir, f"{assoc_slug}_quality_report.txt")
    os.makedirs(output_dir, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_text)
    print(f"📋 Quality report saved: {report_path}")

    return total_bad


# Fix Windows console encoding so emoji and arrow characters print correctly
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# ─────────────────────────────────────────────
# CONFIG — edit these or set as GitHub secrets/env vars
# ─────────────────────────────────────────────

PORTAL_URL       = os.getenv("PORTAL_URL",       "https://www.revolutionise.com.au/hockeyballarat")
ASSOCIATION_NAME = os.getenv("ASSOCIATION_NAME", "Hockey Ballarat")   # stamps every row
ONLY_GRADES      = os.getenv("ONLY_GRADES",      "")   # Comma-separated, e.g. "Division 1 Men,Womens"
ONLY_ROUNDS      = os.getenv("ONLY_ROUNDS",      "")   # Comma-separated, e.g. "Round 1,Round 2"
ONLY_TEAM        = os.getenv("ONLY_TEAM",        "")   # Partial match, e.g. "Grampians"
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
    Splits a team draws page heading into club and team name.

    RevSports headings look like:
      "2026 - Grass Field Competition - Oval 4 · Rivaside U13 Girls Rivaside/Wanderers Under 13 Girls"

    Strategy:
      1. Strip everything up to and including the · character
      2. Search for the grade name in what remains
      3. Everything left of the grade = club
      4. Everything right of the grade = team name
      5. Fallback: find the first repeated word
    """
    # Step 1: strip the competition prefix if present
    if "·" in full_name:
        full_name = full_name.split("·", 1)[-1].strip()

    # Step 2-4: split on grade name
    if grade_name and grade_name in full_name:
        idx  = full_name.index(grade_name)
        club = full_name[:idx].strip()
        team = full_name[idx + len(grade_name):].strip()
        if not team:
            team = grade_name
        return club, team

    # Step 5: fallback — find the first repeated word
    words = full_name.split()
    seen  = {}
    for i, word in enumerate(words):
        if word in seen:
            return " ".join(words[:i]), " ".join(words[i:])
        seen[word] = i

    return "", full_name


def get_team_name_from_draws_page(session, team_url, grade_name):
    """
    Visit a team draws page and extract clean club + team name from the heading.
    The full heading includes competition and pitch info before the · character —
    split_club_and_team handles stripping that before parsing club and team.
    """
    try:
        soup = get_soup(session, team_url)
        for tag in ["h2", "h1", "h3"]:
            heading = soup.find(tag)
            if heading:
                full_text = heading.get_text(strip=True)
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
        anchors = [normalize_url(a["href"], round_url) for a in node.find_all("a", href=True)]
        text = node.get_text("\n", strip=True)
        has_current_game = game_url in anchors
        has_team_links = any(path_matches(h, r"/games/team/\d+/\d+$") for h in anchors)
        has_date_time = bool(re.search(
            r"\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+\w+\s+\d{4}\b", text,
        ))
        if has_current_game and (has_team_links or has_date_time):
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
    collecting = False
    for line in lines:
        lower = line.lower()
        if lower in {"details", "umpire", "umpires", "byes"}:
            break
        if line in team_link_texts:
            break
        if re.match(r"^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+\w+\s+\d{4}$", line):
            collecting = True
            continue
        if collecting and re.match(r"^\d{1,2}:\d{2}$", line):
            continue
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
    venue_line = cleaned[0]
    pitch_line = cleaned[1] if len(cleaned) > 1 else None
    return split_venue_and_pitch(venue_line, pitch_line)


def get_all_grades(session, base_url):
    games_url = base_url.rstrip("/") + "/games"
    try:
        soup = get_soup(session, games_url)
    except Exception as e:
        print(f"⚠ Could not fetch grades page: {e}")
        return []

    grades, seen = [], set()
    current_competition = "Unknown Competition"

    # Walk every element in document order so we can track competition headings
    for tag in soup.find_all(True):
        # Detect a competition heading — it's a block-level element (h2, h3, div, p, strong)
        # that contains text but NO grade links itself, and sits above the grade links
        if tag.name in ("h2", "h3", "h4", "strong", "p", "div"):
            # Only treat it as a competition name if it has direct text and no child <a> grade links
            child_grade_links = [
                a for a in tag.find_all("a", href=True)
                if path_matches(normalize_url(a["href"], games_url), r"/games/\d+/\d+$")
            ]
            text = tag.get_text(" ", strip=True)
            if text and not child_grade_links and len(text) > 10 and len(text) < 120:
                # Heuristic: competition names are reasonably long but not paragraphs
                # Only update if it looks like a season/competition title
                if any(kw in text for kw in ["Competition", "Season", "Winter", "Summer", "Indoor", "Outdoor", "2026", "2025", "2024"]):
                    current_competition = text

        # Detect grade links
        if tag.name == "a" and tag.get("href"):
            href = normalize_url(tag["href"], games_url)
            if href not in seen and path_matches(href, r"/games/\d+/\d+$"):
                seen.add(href)
                name = tag.get_text(strip=True)
                if name:
                    grades.append({
                        "name": name,
                        "url": href,
                        "competition_name": current_competition,
                    })

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
    games = []
    current_team_urls = []
    seen = set()
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

    Each player dict includes:
      - is_fillin:  True if the player appears under the Fill-ins section
      - is_removed: True if the player appears under the Removed from team section
      Both default to False for regular squad players.
    """
    soup = get_soup(session, game_url)
    for hidden in soup.select(".d-none, .d-lg-none"):
        hidden.decompose()

    match = {
        "url": game_url,
        "date": None, "time": None,
        "venue": round_venue,
        "pitch": round_pitch,
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
            match["date"] = datetime.strptime(date_str, "%a %d %b %Y").strftime("%Y-%m-%d")
        except ValueError:
            match["date"] = date_str
        match["time"] = dm.group(2).strip()

    # ── Team names from draws pages ───────────────────────────
    if team_urls:
        team_page_urls = team_urls
    else:
        team_page_urls = []
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

    if len(team_info) >= 1:
        match["home_team"] = team_info[0]["team_name"]
    if len(team_info) >= 2:
        match["away_team"] = team_info[1]["team_name"]

    # ── Umpires & scores ─────────────────────────────────────
    STOP = {"venue", "date & time", "match card", "umpires", "umpire"}
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
        # Score extraction is handled below via HTML score cards, not plain text.
        # Plain text scanning was unreliable — forfeit/BYE pages contain numbers
        # like jersey numbers that caused false positives.

    # ── Score extraction via HTML score cards ────────────────
    # RevSports renders scores inside large card divs with font-size: 5rem.
    # These elements are empty on unplayed, forfeit, and BYE games.
    score_cards = soup.find_all("div", style=lambda s: s and "5rem" in s)
    score_values = []
    for card in score_cards:
        text = card.get_text(strip=True)
        if re.match(r"^\d+$", text):
            score_values.append(int(text))
    if len(score_values) >= 2:
        match["home_score"] = score_values[0]
        match["away_score"] = score_values[1]

    # ── Match card tables — one per team ─────────────────────
    tables = soup.find_all("table", class_="table")
    for i, table in enumerate(tables):
        if i < len(team_info):
            club_name = team_info[i]["club_name"]
            team_name = team_info[i]["team_name"]
        elif team_info:
            # More tables than teams — reuse the last known team entry
            # (avoids trying to split a match-page heading that lacks the · separator)
            club_name = team_info[-1]["club_name"]
            team_name = team_info[-1]["team_name"]
        else:
            club_name = ""
            team_name = "Unknown"

        players = []
        in_fillins = False   # Tracks whether we're inside the Fill-ins section
        in_removed = False   # Tracks whether we're inside the Removed from team section

        for row in table.find_all("tr")[1:]:
            cells = row.find_all("td")
            if not cells: continue
            name_text = cells[0].get_text(" ", strip=True)
            if not name_text.strip(): continue
            norm = " ".join(name_text.split()).lower()

            # ── Section header rows ───────────────────────────
            # These rows mark the start of a new section — not actual players
            if "fill-in" in norm:
                # Entering the Fill-ins section
                in_fillins = True
                in_removed = False
                continue
            if "removed from team" in norm:
                # Entering the Removed from team section
                in_removed = True
                in_fillins = False
                continue
            if any(j in norm for j in ["goals", "green card", "yellow card", "red card"]):
                # Stats header row — skip it
                continue

            # ── Player row ────────────────────────────────────
            # Fill-ins always attended. Removed players did not.
            # Regular players attended if they have a tick (fa-check icon).
            attended = (not in_removed) and (
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

            # Normalise "Surname, Firstname" format (used by Sunraysia match pages)
            # into "Firstname Surname" to match the registry format
            if "," in player_name:
                parts = player_name.split(",", 1)
                player_name = f"{parts[1].strip()} {parts[0].strip()}"

            # Extract RevSports player ID from the player's link in this row
            # Each name is a link like: /games/statistics/qzrbDcZ?competition_id=...
            revsports_player_id = extract_player_id_from_row(row, game_url)

            players.append({
                "name":                player_name,
                "jersey":              jersey,
                "role":                role,
                "attended":            attended,
                "is_fillin":           in_fillins,   # True = player is a fill-in for this game
                "is_removed":          in_removed,   # True = player was removed from team list
                "revsports_player_id": revsports_player_id,
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
    print("Hockey Results Scraper — Headless")
    print(f"Started:     {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Portal:      {PORTAL_URL}")
    print(f"Association: {ASSOCIATION_NAME}")
    print(f"Grades:      {only_grades or 'All'}")
    print(f"Rounds:      {only_rounds or 'All'}")
    print(f"Team:        {only_team or 'All'}")
    print("=" * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    session = make_session()

    # Competition name is now tracked per-grade inside get_all_grades()
    # get_competition_name() is kept as a fallback but no longer used as the sole source

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

                    # Build CSV rows — one per player if player data exists,
                    # or one "fixture-only" row per match if player cards are hidden (e.g. WHA).
                    teams = match.get("teams", [])
                    has_players = any(len(t.get("players", [])) > 0 for t in teams)

                    if has_players:
                        # Normal case — one row per player per team
                        for team in teams:
                            if only_team and only_team.lower() not in team["team_name"].lower():
                                continue
                            for player in team["players"]:
                                csv_rows.append({
                                    "association":         ASSOCIATION_NAME,
                                    "competition_name":    grade.get("competition_name", ASSOCIATION_NAME),
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
                                    "revsports_player_id": player["revsports_player_id"],
                                    "goals":               player["goals"],
                                    "green_cards":         player["green_cards"],
                                    "yellow_cards":        player["yellow_cards"],
                                    "red_cards":           player["red_cards"],
                                    "match_url":           game_info["game_url"],
                                    "scraped_at":          datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                })
                    else:
                        # Fixture-only case — player cards not accessible (e.g. WHA login-protected).
                        # Write one row per match with fixture data and blank player columns.
                        csv_rows.append({
                            "association":         ASSOCIATION_NAME,
                            "competition_name":    grade.get("competition_name", ASSOCIATION_NAME),
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
                            "team":                "NO_PLAYERS",
                            "club_name":           "",
                            "player_name":         "NO_PLAYERS",
                            "jersey":              None,
                            "role":                None,
                            "attended":            None,
                            "is_fillin":           False,
                            "is_removed":          False,
                            "revsports_player_id": None,
                            "goals":               None,
                            "green_cards":         None,
                            "yellow_cards":        None,
                            "red_cards":           None,
                            "match_url":           game_info["game_url"],
                            "scraped_at":          datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        })

                    print(f"    ✓ {match.get('home_team','?')} {match.get('home_score','?')}"
                          f" – {match.get('away_score','?')} {match.get('away_team','?')}"
                          f"  @ {match.get('venue','?')} / {match.get('pitch','?')}")

                except Exception as e:
                    print(f"    ✗ ERROR: {game_info['game_url']} — {e}")

    # ── Save CSV ─────────────────────────────────────────────
    # Build a safe filename prefix from the association name
    # e.g. "Hockey Ballarat" → "hockey_ballarat"
    assoc_slug = ASSOCIATION_NAME.lower().replace(" ", "_")
    csv_path   = os.path.join(OUTPUT_DIR, f"{assoc_slug}_results.csv")
    if csv_rows:
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=csv_rows[0].keys())
            writer.writeheader()
            writer.writerows(csv_rows)
        fixture_only = sum(1 for r in csv_rows if r.get("player_name") == "NO_PLAYERS")
        player_rows  = len(csv_rows) - fixture_only
        print(f"\n✅ CSV: {csv_path}  ({len(csv_rows)} rows — {player_rows} player rows, {fixture_only} fixture-only rows)")
        # ── Run data quality check ────────────────────────────
        run_quality_check(csv_rows, OUTPUT_DIR, ASSOCIATION_NAME)
    else:
        print("\n⚠ No matches scraped — CSV not written.")

    # ── Save JSON ─────────────────────────────────────────────
    json_path = os.path.join(OUTPUT_DIR, f"{assoc_slug}_results.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"✅ JSON: {json_path}  ({len(all_results)} matches)")

    # ── Upsert to Supabase ────────────────────────────────────
    # Reads SUPABASE_URL and SUPABASE_SERVICE_KEY from environment variables.
    # On your PC: set these as Windows environment variables.
    # On GitHub Actions: set these as repository secrets.
    # If either is missing, this step is skipped with a warning.

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        print("\n⚠ SUPABASE_URL or SUPABASE_SERVICE_KEY not set — skipping upsert.")
    elif not csv_rows:
        print("\n⚠ No rows to upsert — skipping.")
    else:
        try:
            from supabase import create_client

            # Connect to Supabase using the service role key (bypasses RLS)
            client = create_client(supabase_url, supabase_key)

            # Clean and convert each row before upserting
            def clean_row(row):
                cleaned = {}
                for k, v in row.items():
                    # Replace empty strings with None (Supabase prefers null over "")
                    if v == "" or v is None:
                        cleaned[k] = None
                    else:
                        cleaned[k] = v

                # Convert numeric fields from string to int where possible
                for field in ["home_score", "away_score", "goals",
                               "green_cards", "yellow_cards", "red_cards"]:
                    if cleaned.get(field) is not None:
                        try:
                            cleaned[field] = int(cleaned[field])
                        except (ValueError, TypeError):
                            cleaned[field] = None

                # Convert boolean fields (CSV stores them as strings "True"/"False")
                for field in ["attended", "is_fillin", "is_removed"]:
                    if cleaned.get(field) is not None:
                        cleaned[field] = str(cleaned[field]).strip().lower() == "true"

                return cleaned

            cleaned_rows = [clean_row(r) for r in csv_rows]

            # Upsert in batches of 200 to avoid timeouts
            # on_conflict means: if match_url + player_name + team already exists,
            # update that row instead of inserting a duplicate
            BATCH_SIZE = 200
            total_batches = (len(cleaned_rows) + BATCH_SIZE - 1) // BATCH_SIZE
            total_upserted = 0

            print(f"\n⏳ Upserting {len(cleaned_rows)} rows to Supabase in {total_batches} batches...")

            for i in range(0, len(cleaned_rows), BATCH_SIZE):
                batch = cleaned_rows[i:i + BATCH_SIZE]
                batch_num = (i // BATCH_SIZE) + 1
                print(f"  Upserting batch {batch_num} of {total_batches}...")
                try:
                    client.table("revsports_players").upsert(
                        batch,
                        on_conflict="match_url,player_name,team,is_fillin"
                    ).execute()
                    total_upserted += len(batch)
                except Exception as e:
                    print(f"  ✗ Batch {batch_num} failed: {e}")

            print(f"✅ Supabase upsert complete — {total_upserted} rows processed.")

        except Exception as e:
            print(f"✗ Supabase upsert error: {e}")

    print(f"\nDone! {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()

"""
Match Scraper â€” Headless (GitHub Actions version)
============================================================
Scrapes match results and player appearances from RevSports.
Runs without a GUI. Configure via environment variables below.

Output:
  ../data/{association}_results.csv
  ../data/{association}_results.json
  ../data/{association}_quality_report.txt

Version: 2026-06-14-team-fields-v3

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
from datetime import datetime
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

VERSION = "2026-06-14-team-fields-v3"

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# CONFIG
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

PORTAL_URL = os.getenv("PORTAL_URL", "https://www.revolutionise.com.au/hockeyballarat")
ASSOCIATION_NAME = os.getenv("ASSOCIATION_NAME", "Hockey Ballarat")
ONLY_GRADES = os.getenv("ONLY_GRADES", "")
ONLY_ROUNDS = os.getenv("ONLY_ROUNDS", "")
ONLY_TEAM = os.getenv("ONLY_TEAM", "")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "../data")
DELAY = float(os.getenv("SCRAPE_DELAY", "0.8") or "0.8")
UPSERT_SUPABASE = os.getenv("UPSERT_SUPABASE", "false").strip().lower() in {"1", "true", "yes", "y"}

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
]

QUALITY_WARNINGS: list[str] = []


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# SMALL HELPERS
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def clean_text(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


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
    if club_name and team_name:
        return f"{club_name} {team_name}".strip()
    return club_name or team_name


def split_people(text: str) -> list[str]:
    text = clean_text(text)
    if not text:
        return []
    people = [clean_text(p) for p in re.split(r";|\n", text)]
    return [p for p in people if p and p.lower() not in {"umpire", "umpires", "details"}]


def format_date_from_round_text(text: str) -> str:
    """Convert 'Sun 17 May 2026' to '2026-05-17'."""
    text = clean_text(text)
    try:
        return datetime.strptime(text, "%a %d %b %Y").strftime("%Y-%m-%d")
    except ValueError:
        return text


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# MERGE / QUALITY HELPERS
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def player_identity_key(row: dict) -> tuple[str, str, str]:
    """Collapse duplicate normal/fill-in/removed appearances.

    Use RevSports team ID when available because team names may not be unique.
    Fallback to team_side + club/team when needed.
    """
    player_id = clean_text(row.get("revsports_player_id"))
    player_identity = player_id if player_id else clean_text(row.get("player_name")).lower()

    team_identity = clean_text(row.get("revsports_team_id"))
    if not team_identity:
        team_identity = "|".join([
            clean_text(row.get("team_side")),
            clean_text(row.get("club_name")),
            clean_text(row.get("team")),
            clean_text(row.get("team_url")),
        ])

    return (clean_text(row.get("match_url")), team_identity, player_identity)


def merge_two_player_rows(base: dict, extra: dict) -> dict:
    merged = dict(base)

    for field in [
        "jersey",
        "revsports_player_id",
        "player_name",
        "club_name",
        "team",
        "team_label",
        "team_url",
        "revsports_team_id",
        "team_side",
    ]:
        if not clean_text(merged.get(field)) and clean_text(extra.get(field)):
            merged[field] = extra.get(field, "")

    for field in ["goals", "green_cards", "yellow_cards", "red_cards"]:
        merged[field] = max_numeric_text(merged.get(field), extra.get(field))

    final_is_fillin = bool_from_text(merged.get("is_fillin")) or bool_from_text(extra.get("is_fillin"))
    final_is_removed = bool_from_text(merged.get("is_removed")) or bool_from_text(extra.get("is_removed"))

    if final_is_removed:
        final_attended = False
    else:
        final_attended = bool_from_text(merged.get("attended")) or bool_from_text(extra.get("attended")) or final_is_fillin

    merged["attended"] = bool_text(final_attended)
    merged["is_fillin"] = bool_text(final_is_fillin)
    merged["is_removed"] = bool_text(final_is_removed)
    return merged


def normalise_boolean_columns(rows: list[dict]) -> list[dict]:
    for row in rows:
        for field in ["attended", "is_fillin", "is_removed"]:
            value = row.get(field)
            row[field] = "" if value is None or value == "" else bool_text(bool_from_text(value))
    return rows


def merge_duplicate_player_appearances(rows: list[dict]) -> list[dict]:
    merged_by_key = {}
    order = []
    merge_counts = {}

    for row in normalise_boolean_columns(rows):
        if clean_text(row.get("player_name")) == "NO_PLAYERS" or (
            not clean_text(row.get("player_name")) and not clean_text(row.get("revsports_player_id"))
        ):
            synthetic_key = (clean_text(row.get("match_url")), "fixture-only", f"{len(order)}")
            merged_by_key[synthetic_key] = row
            order.append(synthetic_key)
            continue

        key = player_identity_key(row)
        if key not in merged_by_key:
            merged_by_key[key] = row
            order.append(key)
        else:
            merge_counts[key] = merge_counts.get(key, 1) + 1
            merged_by_key[key] = merge_two_player_rows(merged_by_key[key], row)

    for key, count in merge_counts.items():
        row = merged_by_key[key]
        flags = []
        if bool_from_text(row.get("is_fillin")):
            flags.append("fill-in")
        if bool_from_text(row.get("is_removed")):
            flags.append("removed")
        flag_text = f" ({', '.join(flags)})" if flags else ""
        QUALITY_WARNINGS.append(
            "Merged duplicate player appearance: "
            f"{row.get('player_name', '')} Â· {row.get('club_name', '')} Â· {row.get('team', '')} Â· "
            f"{row.get('match_url', '')}{flag_text}; {count} source rows became 1 row."
        )

    return [merged_by_key[key] for key in order]


def run_quality_check(csv_rows: list[dict], output_dir: str, association: str) -> int:
    required_fixture = [
        "association",
        "competition_name",
        "grade",
        "round",
        "game_date",
        "home_club_name",
        "away_club_name",
        "match_url",
    ]
    required_player = ["team_side", "club_name", "team_url", "revsports_team_id", "player_name"]
    numeric = ["home_score", "away_score", "goals", "green_cards", "yellow_cards", "red_cards", "jersey"]
    boolean = ["attended", "is_fillin", "is_removed"]

    issues: list[str] = []
    warnings: list[str] = list(QUALITY_WARNINGS)

    for i, row in enumerate(csv_rows, start=2):
        is_fixture_only = clean_text(row.get("player_name")) == "NO_PLAYERS"

        for field in required_fixture:
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
                    f"{row.get('player_name', '')} Â· {row.get('club_name', '')} Â· {row.get('team', '')} Â· {row.get('match_url', '')}"
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
                f"{match_url} Â· score "
                f"{first.get('home_club_name', '')} {first.get('home_team', '')} {home_score} - {away_score} "
                f"{first.get('away_club_name', '')} {first.get('away_team', '')}; "
                f"listed player goals home {home_goal_total} - away {away_goal_total}."
            )

    lines = [
        f"DATA QUALITY REPORT â€” {association}",
        f"Generated: {datetime.now().isoformat()}",
        "â”€" * 60,
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
    print(f"ðŸ“‹ Quality report saved: {report_path}")

    return len(issues)


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# HTTP / PAGE PARSERS
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    """Split team page heading using: competition Â· club grade team.

    Everything after the dot/bullet contains club + known grade + team.
    Everything before the known grade is club. Everything after is team.
    If there is nothing after the grade, team is blank.
    """
    full_name = clean_text(full_name)
    if "Â·" in full_name:
        full_name = clean_text(full_name.split("Â·", 1)[-1])

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
        print(f"    âš  Could not fetch team page {team_url}: {e}")
    return "", ""


def get_all_grades(session: requests.Session, base_url: str) -> list[dict]:
    games_url = base_url.rstrip("/") + "/games"
    try:
        soup = get_soup(session, games_url)
    except Exception as e:
        print(f"âš  Could not fetch grades page: {e}")
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
                    grades.append({"name": name, "url": href, "competition_name": current_competition})

    return grades


def get_rounds(session: requests.Session, grade_url: str) -> list[dict]:
    try:
        soup = get_soup(session, grade_url)
    except Exception as e:
        print(f"  âš  Could not fetch rounds page: {e}")
        return []

    rounds, seen = [], set()
    for a in soup.find_all("a", href=True):
        href = normalize_url(a["href"], grade_url)
        if href not in seen and path_matches(href, r"/games/\d+/\d+/round/\d+"):
            seen.add(href)
            label = clean_text(a.get_text(" ", strip=True))
            if label:
                rounds.append({"round_label": label, "url": href})
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


def get_game_links(session: requests.Session, round_url: str) -> list[dict]:
    try:
        soup = get_soup(session, round_url)
    except Exception as e:
        print(f"    âš  Skipping round (could not fetch): {e}")
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

    return games


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# MATCH SCRAPER
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def scrape_match(
    session: requests.Session,
    game_url: str,
    grade_name: str = "",
    team_urls: list[str] | None = None,
    team_labels: list[str] | None = None,
    round_venue: str = "",
    round_pitch: str = "",
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
            f"      â†’ Side: {info['team_side']}  Club: '{club_name}'  "
            f"Team: '{team_name}'  RevSports Team ID: {info['revsports_team_id']}"
        )

    if len(team_info) >= 1:
        home = team_info[0]
        match.update({
            "home_club_name": home["club_name"],
            "home_team": home["team_name"],
            "home_team_label": home["team_label"],
            "home_team_url": home["team_url"],
            "home_revsports_team_id": home["revsports_team_id"],
        })
    if len(team_info) >= 2:
        away = team_info[1]
        match.update({
            "away_club_name": away["club_name"],
            "away_team": away["team_name"],
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

            player_name = re.sub(r"\s*\([^)]*\)", "", name_clean).strip()
            if not player_name:
                continue
            if "," in player_name:
                last, first = player_name.split(",", 1)
                player_name = f"{first.strip()} {last.strip()}"

            players.append({
                "name": player_name,
                "jersey": jersey,
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


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# ROW BUILDING / OUTPUT
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def base_fixture_row(association: str, grade: dict, rnd: dict, match: dict, game_url: str) -> dict:
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
        "umpire_1": match.get("umpires", [""])[0] if len(match.get("umpires", [])) > 0 else "",
        "umpire_2": match.get("umpires", ["", ""])[1] if len(match.get("umpires", [])) > 1 else "",
        "match_url": game_url,
        "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
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
    print("Hockey Results Scraper â€” Headless")
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

    all_results = []
    csv_rows = []

    grades = get_all_grades(session, PORTAL_URL)
    print(f"\nFound {len(grades)} grades.")

    for grade in grades:
        if only_grades and grade["name"] not in only_grades:
            print(f"[Grade] {grade['name']} â€” skipped")
            continue
        print(f"\n[Grade] {grade['name']}")

        rounds = get_rounds(session, grade["url"])
        print(f"  {len(rounds)} rounds.")

        for rnd in rounds:
            if only_rounds and not round_matches_filter(rnd["round_label"], only_rounds):
                print(f"  [Round] {rnd['round_label']} â€” skipped")
                continue
            print(f"\n  [Round] {rnd['round_label']}")

            games = get_game_links(session, rnd["url"])
            print(f"    {len(games)} games.")

            for game_info in games:
                try:
                    match = scrape_match(
                        session,
                        game_info["game_url"],
                        grade_name=grade["name"],
                        team_urls=game_info.get("team_urls", []),
                        team_labels=game_info.get("team_labels", []),
                        round_venue=game_info.get("round_venue", ""),
                        round_pitch=game_info.get("round_pitch", ""),
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
                                row = base_fixture_row(ASSOCIATION_NAME, grade, rnd, match, game_info["game_url"])
                                row.update({
                                    "team_side": team.get("team_side", ""),
                                    "club_name": team.get("club_name", ""),
                                    "team": team.get("team_name", ""),
                                    "team_label": team.get("team_label", ""),
                                    "team_url": team.get("team_url", ""),
                                    "revsports_team_id": team.get("revsports_team_id", ""),
                                    "player_name": player.get("name", ""),
                                    "jersey": player.get("jersey", ""),
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
                        row = base_fixture_row(ASSOCIATION_NAME, grade, rnd, match, game_info["game_url"])
                        row.update({
                            "team_side": "",
                            "club_name": "",
                            "team": "NO_PLAYERS",
                            "team_label": "NO_PLAYERS",
                            "team_url": "",
                            "revsports_team_id": "",
                            "player_name": "NO_PLAYERS",
                            "jersey": "",
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
                        f"    âœ“ {match.get('home_club_name','?')} {match.get('home_team','')} "
                        f"{match.get('home_score','?')} â€“ {match.get('away_score','?')} "
                        f"{match.get('away_club_name','?')} {match.get('away_team','')}"
                        f"  @ {match.get('venue','?')} / {match.get('pitch','?')}"
                    )

                except Exception as e:
                    print(f"    âœ— ERROR: {game_info['game_url']} â€” {e}")

    if csv_rows:
        before_merge = len(csv_rows)
        csv_rows = merge_duplicate_player_appearances(csv_rows)
        merged_count = before_merge - len(csv_rows)
        if merged_count:
            print(f"\nâ„¹ Merged {merged_count} duplicate player appearance row(s).")

    assoc_slug = ASSOCIATION_NAME.lower().replace(" ", "_")
    csv_path = os.path.join(OUTPUT_DIR, f"{assoc_slug}_results.csv")
    if csv_rows:
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(csv_rows)
        fixture_only = sum(1 for r in csv_rows if r.get("player_name") == "NO_PLAYERS")
        player_rows = len(csv_rows) - fixture_only
        print(f"\nâœ… CSV: {csv_path}  ({len(csv_rows)} rows â€” {player_rows} player rows, {fixture_only} fixture-only rows)")
        run_quality_check(csv_rows, OUTPUT_DIR, ASSOCIATION_NAME)
    else:
        print("\nâš  No matches scraped â€” CSV not written.")

    json_path = os.path.join(OUTPUT_DIR, f"{assoc_slug}_results.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"âœ… JSON: {json_path}  ({len(all_results)} matches)")

    # Supabase upsert remains off by default. This v3 schema includes new fields, so
    # make sure the Supabase table has matching columns before turning this on.
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not UPSERT_SUPABASE:
        print("\nâ„¹ UPSERT_SUPABASE is not true â€” skipping Supabase upsert.")
    elif not supabase_url or not supabase_key:
        print("\nâš  SUPABASE_URL or SUPABASE_SERVICE_KEY not set â€” skipping upsert.")
    elif not csv_rows:
        print("\nâš  No rows to upsert â€” skipping.")
    else:
        try:
            from supabase import create_client
            client = create_client(supabase_url, supabase_key)

            def clean_row(row: dict) -> dict:
                cleaned = {}
                for k, v in row.items():
                    cleaned[k] = None if v == "" or v is None else v

                for field in ["home_score", "away_score", "goals", "green_cards", "yellow_cards", "red_cards"]:
                    if cleaned.get(field) is not None:
                        try:
                            cleaned[field] = int(cleaned[field])
                        except (ValueError, TypeError):
                            cleaned[field] = None

                for field in ["attended", "is_fillin", "is_removed"]:
                    if cleaned.get(field) is not None:
                        cleaned[field] = str(cleaned[field]).strip().lower() == "true"

                return cleaned

            cleaned_rows = [clean_row(r) for r in csv_rows]
            batch_size = 200
            total_batches = (len(cleaned_rows) + batch_size - 1) // batch_size
            total_upserted = 0
            print(f"\nâ³ Upserting {len(cleaned_rows)} rows to Supabase in {total_batches} batches...")

            for i in range(0, len(cleaned_rows), batch_size):
                batch = cleaned_rows[i:i + batch_size]
                batch_num = (i // batch_size) + 1
                print(f"  Upserting batch {batch_num} of {total_batches}...")
                try:
                    client.table("revsports_players").upsert(
                        batch,
                        on_conflict="match_url,revsports_team_id,revsports_player_id",
                    ).execute()
                    total_upserted += len(batch)
                except Exception as e:
                    print(f"  âœ— Batch {batch_num} failed: {e}")

            print(f"âœ… Supabase upsert complete â€” {total_upserted} rows processed.")

        except Exception as e:
            print(f"âœ— Supabase upsert error: {e}")

    print(f"\nDone! {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()



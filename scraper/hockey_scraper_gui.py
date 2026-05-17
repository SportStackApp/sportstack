"""
Hockey Results Scraper — GUI
==============================
A point-and-click interface to scrape match data from any
Revolutionise Sport hockey portal.

REQUIREMENTS:
  pip install requests beautifulsoup4

HOW TO RUN:
  python hockey_scraper_gui.py
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog
import threading
import os
import requests
from bs4 import BeautifulSoup
import json
import csv
import time
import re
from datetime import datetime
from urllib.parse import urlparse

# ─────────────────────────────────────────────
# KNOWN ASSOCIATIONS — add more here as needed
# ─────────────────────────────────────────────
KNOWN_ASSOCIATIONS = {
    "Hockey Ballarat":  "https://www.revolutionise.com.au/hockeyballarat",
    "Sunraysia Hockey": "https://www.sunraysiahockey.com.au",
    "Custom URL…":      "",
}

DELAY_SECONDS = 0.8  # Pause between requests

# ─────────────────────────────────────────────
# SCRAPING CORE — domain-agnostic
# Works with both revolutionise.com.au portals
# and associations with their own custom domains.
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


def get_soup(session, url, log=None):
    """Fetch a URL and return a BeautifulSoup object."""
    if log:
        log(f"  Fetching: {url}")
    time.sleep(DELAY_SECONDS)
    resp = session.get(url, timeout=15)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def normalize_url(href, page_url):
    """
    Turn any href into a full absolute URL.
    Handles relative paths like /games/123 by prepending the page's domain.
    """
    if href.startswith("http"):
        return href
    parsed = urlparse(page_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    return base + href if href.startswith("/") else base + "/" + href


def path_matches(href, pattern):
    """Match a regex pattern against just the path portion of a URL."""
    path = urlparse(href).path
    return bool(re.search(pattern, path))


def get_all_grades(session, base_url, log=None):
    """
    Visits the /games page and returns all grade links.
    Works for any Revolutionise portal regardless of domain.
    """
    games_url = base_url.rstrip("/") + "/games"
    soup = get_soup(session, games_url, log)

    grades = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = normalize_url(a["href"], games_url)
        # Grade URLs end in /games/NUMBER/NUMBER
        if href not in seen and path_matches(href, r"/games/\d+/\d+$"):
            seen.add(href)
            name = a.get_text(strip=True)
            if name:
                grades.append({"name": name, "url": href})

    return grades


def get_rounds(session, grade_url, log=None):
    """Returns all round links for a grade."""
    soup = get_soup(session, grade_url, log)
    rounds = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = normalize_url(a["href"], grade_url)
        # Round URLs contain /games/N/N/round/N
        if href not in seen and path_matches(href, r"/games/\d+/\d+/round/\d+"):
            seen.add(href)
            label = a.get_text(strip=True)
            if label:
                rounds.append({"round_label": label, "url": href})
    return rounds


def get_game_links(session, round_url, log=None):
    """Returns all individual match page links for a round."""
    soup = get_soup(session, round_url, log)
    game_urls = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = normalize_url(a["href"], round_url)
        # Match detail URLs end in /game/NUMBER (singular)
        if href not in seen and path_matches(href, r"/game/\d+$"):
            seen.add(href)
            game_urls.append(href)
    return game_urls


def scrape_match(session, game_url, log=None):
    """
    Scrapes one match detail page.
    Returns a dict with date, teams, scores, umpires, player lists.
    """
    soup = get_soup(session, game_url, log)

    # Remove Bootstrap hidden elements (prevents duplicate rows)
    for hidden in soup.select(".d-none, .d-lg-none"):
        hidden.decompose()

    match = {
        "url": game_url,
        "date": None, "time": None, "venue": None,
        "home_team": None, "away_team": None,
        "home_score": None, "away_score": None,
        "umpires": [], "teams": [],
    }

    # -- Date & Time (regex search on full page text) --
    page_text = soup.get_text(" ", strip=True)
    dm = re.search(
        r"((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+\w+\s+\d{4})\s+(\d{1,2}:\d{2})",
        page_text
    )
    if dm:
        match["date"] = dm.group(1).strip()
        match["time"] = dm.group(2).strip()

    # -- Venue, Umpires, Scores (line-by-line text parsing) --
    STOP = {"venue", "date & time", "match card", "umpires", "umpire"}
    lines = [l.strip() for l in soup.get_text("\n").split("\n") if l.strip()]

    for i, line in enumerate(lines):
        ll = line.lower()

        if ll == "venue" and match["venue"] is None:
            for k in range(i + 1, min(i + 4, len(lines))):
                if lines[k].lower() not in STOP:
                    match["venue"] = lines[k]
                    break

        if ll in ("umpire", "umpires") and not match["umpires"]:
            for k in range(i + 1, min(i + 5, len(lines))):
                if lines[k].lower() in STOP:
                    break
                match["umpires"].append(lines[k])

        if ("won!" in ll or "draw" in ll or "forfeit" in ll
                or "walkover" in ll or "bye" in ll):
            remaining = lines[i + 1:]
            found = 0
            for j, item in enumerate(remaining):
                if re.match(r"^\d+$", item):
                    if found == 0:
                        match["home_score"] = item
                        if j + 1 < len(remaining):
                            match["home_team"] = remaining[j + 1]
                    elif found == 1:
                        match["away_score"] = item
                        if j + 1 < len(remaining):
                            match["away_team"] = remaining[j + 1]
                    found += 1
                    if found == 2:
                        break

    # -- Match Card --
    tables = soup.find_all("table", class_="table")
    for table in tables:
        heading = table.find_previous(["h2", "h3", "h4", "h5", "h6"])
        team_name = heading.get_text(strip=True) if heading else "Unknown"

        players = []
        in_fillins = False  # Tracks whether we're inside a Fill-ins section
        for row in table.find_all("tr")[1:]:
            cells = row.find_all("td")
            if not cells:
                continue
            name_text = cells[0].get_text(" ", strip=True)
            if not name_text.strip():
                continue
            norm = " ".join(name_text.split()).lower()

            # "Fill-ins" is a section header row — not a player.
            # Set a flag so we know the rows that follow are fill-ins.
            if "fill-in" in norm:
                in_fillins = True
                continue  # Skip the header row itself

            # Other junk/header rows — reset fill-in flag and skip
            if any(j in norm for j in ["removed from team", "goals",
                                        "green card", "yellow card", "red card"]):
                in_fillins = False
                continue

            # Fill-in players are automatically attended (no tick needed)
            # Regular players need a tick icon to be marked attended
            attended = in_fillins or bool(row.find(class_=re.compile(r"\bfa-check\b")))
            name_clean = re.sub(r"^\d+\.\s*", "", name_text).strip()
            if not name_clean:
                continue
            jersey = None
            jm = re.search(r"\(#(\d+)\)", name_clean)
            if jm:
                jersey = jm.group(1)
            role = None
            rm = re.search(r"\(([^#\d][^)]*)\)", name_clean)
            if rm:
                role = rm.group(1).strip()
            player_name = re.sub(r"\s*\([^)]*\)", "", name_clean).strip()
            if not player_name:
                continue
            players.append({
                "name": player_name, "jersey": jersey, "role": role,
                "attended": attended,
                "goals":        cells[1].get_text(strip=True) if len(cells) > 1 else "",
                "green_cards":  cells[2].get_text(strip=True) if len(cells) > 2 else "",
                "yellow_cards": cells[3].get_text(strip=True) if len(cells) > 3 else "",
                "red_cards":    cells[4].get_text(strip=True) if len(cells) > 4 else "",
            })
        if players:
            match["teams"].append({"team_name": team_name, "players": players})

    # Fallback team names from match card if score section failed
    if match["home_team"] is None and len(match.get("teams", [])) >= 1:
        match["home_team"] = match["teams"][0]["team_name"]
    if match["away_team"] is None and len(match.get("teams", [])) >= 2:
        match["away_team"] = match["teams"][1]["team_name"]

    return match


# ─────────────────────────────────────────────
# MAIN SCRAPE RUNNER
# ─────────────────────────────────────────────

def run_scrape(base_url, only_grades, only_rounds, only_team,
               output_path, log, on_done, stop_event=None):
    def is_stopped():
        return stop_event is not None and stop_event.is_set()
    """
    Runs the full scrape with the given filters.
    Designed to run in a background thread so the GUI stays responsive.
    """
    session = make_session()
    all_results = []
    csv_rows = []

    try:
        log("\n=== Starting scrape ===")
        log(f"Portal:  {base_url}")
        log(f"Grades:  {only_grades or 'All'}")
        log(f"Rounds:  {only_rounds or 'All'}")
        log(f"Team:    {only_team or 'All'}")
        log(f"Output:  {output_path}\n")

        grades = get_all_grades(session, base_url, log)
        if not grades:
            log("ERROR: No grades found. Check the portal URL.")
            on_done(False)
            return

        log(f"Found {len(grades)} grades total.\n")

        for grade in grades:
            if is_stopped():
                log("\n⏹  Stopped.")
                break
            if only_grades and grade["name"] not in only_grades:
                log(f"[Grade] {grade['name']} — skipped")
                continue
            log(f"[Grade] {grade['name']}")

            rounds = get_rounds(session, grade["url"], log)
            log(f"  {len(rounds)} rounds found.")

            for rnd in rounds:
                if only_rounds and rnd["round_label"] not in only_rounds:
                    log(f"  [Round] {rnd['round_label']} — skipped")
                    continue
                log(f"\n  [Round] {rnd['round_label']}")

                game_urls = get_game_links(session, rnd["url"], log)
                log(f"    {len(game_urls)} games.")

                for game_url in game_urls:
                    try:
                        match = scrape_match(session, game_url, log)
                        match["grade"] = grade["name"]
                        match["round"] = rnd["round_label"]
                        all_results.append(match)

                        for team in match.get("teams", []):
                            if only_team and only_team.lower() not in team["team_name"].lower():
                                continue
                            for player in team["players"]:
                                csv_rows.append({
                                    "grade":       grade["name"],
                                    "round":       rnd["round_label"],
                                    "date":        match["date"],
                                    "time":        match["time"],
                                    "venue":       match["venue"],
                                    "home_team":   match["home_team"],
                                    "away_team":   match["away_team"],
                                    "home_score":  match["home_score"],
                                    "away_score":  match["away_score"],
                                    "umpire_1":    match["umpires"][0] if len(match["umpires"]) > 0 else "",
                                    "umpire_2":    match["umpires"][1] if len(match["umpires"]) > 1 else "",
                                    "team":        team["team_name"],
                                    "player_name": player["name"],
                                    "jersey":      player["jersey"],
                                    "role":        player["role"],
                                    "attended":    player["attended"],
                                    "goals":       player["goals"],
                                    "green_cards": player["green_cards"],
                                    "yellow_cards":player["yellow_cards"],
                                    "red_cards":   player["red_cards"],
                                    "match_url":   game_url,
                                })

                        log(
                            f"    ✓ {match.get('home_team','?')} "
                            f"{match.get('home_score','?')} – "
                            f"{match.get('away_score','?')} "
                            f"{match.get('away_team','?')}"
                        )

                    except Exception as e:
                        log(f"    ✗ ERROR: {game_url} — {e}")

        # Save CSV
        if csv_rows:
            try:
                with open(output_path, "w", newline="", encoding="utf-8") as f:
                    writer = csv.DictWriter(f, fieldnames=csv_rows[0].keys())
                    writer.writeheader()
                    writer.writerows(csv_rows)
                log(f"\n✅ CSV saved: {output_path}  ({len(csv_rows)} rows)")
            except PermissionError:
                # File is locked — save with a timestamp instead
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                fallback = output_path.replace(".csv", f"_{ts}.csv")
                with open(fallback, "w", newline="", encoding="utf-8") as f:
                    writer = csv.DictWriter(f, fieldnames=csv_rows[0].keys())
                    writer.writeheader()
                    writer.writerows(csv_rows)
                log(f"\n⚠️  Original file was locked — saved as: {fallback}")
                output_path = fallback

        # Save JSON alongside the CSV
        json_path = output_path.replace(".csv", ".json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(all_results, f, indent=2, ensure_ascii=False)
        log(f"✅ JSON saved: {json_path}  ({len(all_results)} matches)")

        log("\n=== Done! ===")
        on_done(True)

    except Exception as e:
        log(f"\nFATAL ERROR: {e}")
        on_done(False)


# ─────────────────────────────────────────────
# GUI
# ─────────────────────────────────────────────

class ScraperApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Hockey Results Scraper")
        self.resizable(True, True)
        self.minsize(700, 620)
        self.configure(padx=16, pady=12)

        self._grades = []        # Loaded grade list [{name, url}]
        self._rounds = []        # Loaded round list after preview
        self._running = False
        self._stop_event = threading.Event()  # Set this to signal the scrape to stop

        self._build_ui()

    # ── Build UI ─────────────────────────────

    def _build_ui(self):
        # Title
        tk.Label(self, text="Hockey Results Scraper",
                 font=("Segoe UI", 15, "bold")).grid(
            row=0, column=0, columnspan=3, sticky="w", pady=(0, 4))
        tk.Label(self, text="Scrape match data from any Revolutionise Sport hockey portal.",
                 fg="gray").grid(row=1, column=0, columnspan=3, sticky="w", pady=(0, 12))

        # ── Section: Association ──
        self._section("Portal / Association", row=2)

        tk.Label(self, text="Association:").grid(row=3, column=0, sticky="w")
        self.assoc_var = tk.StringVar(value=list(KNOWN_ASSOCIATIONS.keys())[0])
        assoc_menu = ttk.Combobox(self, textvariable=self.assoc_var,
                                  values=list(KNOWN_ASSOCIATIONS.keys()),
                                  state="readonly", width=28)
        assoc_menu.grid(row=3, column=1, sticky="ew", padx=(6, 0))
        assoc_menu.bind("<<ComboboxSelected>>", self._on_assoc_change)

        tk.Label(self, text="Portal URL:").grid(row=4, column=0, sticky="w", pady=(6, 0))
        self.url_var = tk.StringVar(value=list(KNOWN_ASSOCIATIONS.values())[0])
        self.url_entry = tk.Entry(self, textvariable=self.url_var, width=55)
        self.url_entry.grid(row=4, column=1, columnspan=2, sticky="ew",
                            padx=(6, 0), pady=(6, 0))

        tk.Button(self, text="Load grades ▶", command=self._load_grades,
                  bg="#1a6b3a", fg="white", font=("Segoe UI", 10, "bold"),
                  relief="flat", padx=10).grid(
            row=4, column=2, sticky="e", padx=(8, 0), pady=(6, 0))

        # ── Section: Filters ──
        self._section("Filters  (hold Ctrl to select multiple)", row=5)

        # Grade filter
        tk.Label(self, text="Grades:").grid(row=6, column=0, sticky="nw", pady=(4, 0))
        grade_frame = tk.Frame(self)
        grade_frame.grid(row=6, column=1, sticky="ew", padx=(6, 0))
        self.grade_list = tk.Listbox(grade_frame, selectmode=tk.MULTIPLE,
                                     height=6, exportselection=False,
                                     font=("Segoe UI", 9))
        self.grade_list.pack(side="left", fill="both", expand=True)
        sb1 = tk.Scrollbar(grade_frame, command=self.grade_list.yview)
        sb1.pack(side="right", fill="y")
        self.grade_list.configure(yscrollcommand=sb1.set)
        tk.Label(self, text="(none = all)", fg="gray", font=("Segoe UI", 8)).grid(
            row=6, column=2, sticky="nw", padx=(6, 0))

        # Round filter
        tk.Label(self, text="Rounds:").grid(row=7, column=0, sticky="nw", pady=(8, 0))
        round_frame = tk.Frame(self)
        round_frame.grid(row=7, column=1, sticky="ew", padx=(6, 0), pady=(8, 0))
        self.round_list = tk.Listbox(round_frame, selectmode=tk.MULTIPLE,
                                     height=5, exportselection=False,
                                     font=("Segoe UI", 9))
        self.round_list.pack(side="left", fill="both", expand=True)
        sb2 = tk.Scrollbar(round_frame, command=self.round_list.yview)
        sb2.pack(side="right", fill="y")
        self.round_list.configure(yscrollcommand=sb2.set)
        tk.Label(self, text="(none = all)", fg="gray", font=("Segoe UI", 8)).grid(
            row=7, column=2, sticky="nw", padx=(6, 0), pady=(8, 0))

        # Team filter
        tk.Label(self, text="Team name\n(partial OK):").grid(
            row=8, column=0, sticky="w", pady=(8, 0))
        self.team_var = tk.StringVar()
        tk.Entry(self, textvariable=self.team_var, width=40).grid(
            row=8, column=1, sticky="ew", padx=(6, 0), pady=(8, 0))
        tk.Label(self, text='e.g. "Grampians"', fg="gray",
                 font=("Segoe UI", 8)).grid(row=8, column=2, sticky="w",
                                             padx=(8, 0), pady=(8, 0))

        # ── Section: Output ──
        self._section("Output file", row=9)

        tk.Label(self, text="Save CSV as:").grid(row=10, column=0, sticky="w")
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        default_name = f"hockey_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        self.out_var = tk.StringVar(value=os.path.join(desktop, default_name))
        tk.Entry(self, textvariable=self.out_var, width=40).grid(
            row=10, column=1, sticky="ew", padx=(6, 0))
        tk.Button(self, text="Browse…", command=self._browse_output).grid(
            row=10, column=2, sticky="e", padx=(8, 0))

        # ── Run button ──
        btn_row = tk.Frame(self)
        btn_row.grid(row=11, column=0, columnspan=3, sticky="ew", pady=(14, 6))
        btn_row.columnconfigure(0, weight=1)

        self.run_btn = tk.Button(
            btn_row, text="▶  Run scraper", command=self._run,
            bg="#1a6b3a", fg="white", font=("Segoe UI", 11, "bold"),
            relief="flat", padx=16, pady=6)
        self.run_btn.grid(row=0, column=0, sticky="ew", padx=(0, 6))

        self.stop_btn = tk.Button(
            btn_row, text="■  Stop", command=self._stop,
            bg="#8b1a1a", fg="white", font=("Segoe UI", 11, "bold"),
            relief="flat", padx=16, pady=6, state="disabled")
        self.stop_btn.grid(row=0, column=1, sticky="ew")

        # ── Log area ──
        self._section("Progress log", row=12)
        self.log_box = scrolledtext.ScrolledText(
            self, height=12, font=("Consolas", 9), state="disabled",
            bg="#1e1e1e", fg="#d4d4d4", insertbackground="white")
        self.log_box.grid(row=13, column=0, columnspan=3,
                          sticky="nsew", pady=(4, 0))

        # Make log area expand with window
        self.rowconfigure(13, weight=1)
        self.columnconfigure(1, weight=1)

    def _section(self, text, row):
        """Draw a section header label with a divider line."""
        frame = tk.Frame(self, height=1, bg="#cccccc")
        frame.grid(row=row, column=0, columnspan=3, sticky="ew",
                   pady=(12, 4))
        tk.Label(self, text=text.upper(),
                 font=("Segoe UI", 8), fg="#888888").grid(
            row=row, column=0, columnspan=3, sticky="w")

    # ── Actions ──────────────────────────────

    def _on_assoc_change(self, event=None):
        name = self.assoc_var.get()
        url = KNOWN_ASSOCIATIONS.get(name, "")
        self.url_var.set(url)
        # Clear grade/round lists since they belong to the old portal
        self.grade_list.delete(0, tk.END)
        self.round_list.delete(0, tk.END)
        self._grades = []

    def _load_grades(self):
        """Fetch the grade list from the portal in a background thread."""
        base_url = self.url_var.get().strip()
        if not base_url:
            messagebox.showwarning("No URL", "Please enter a portal URL first.")
            return

        self.grade_list.delete(0, tk.END)
        self.round_list.delete(0, tk.END)
        self._grades = []
        self._log("Loading grades from: " + base_url)

        def fetch():
            try:
                session = make_session()
                grades = get_all_grades(session, base_url, self._log)
                self._grades = grades
                self.after(0, self._populate_grades)
            except Exception as e:
                self._log(f"ERROR loading grades: {e}")

        threading.Thread(target=fetch, daemon=True).start()

    def _populate_grades(self):
        self.grade_list.delete(0, tk.END)
        for g in self._grades:
            self.grade_list.insert(tk.END, g["name"])
        self._log(f"Loaded {len(self._grades)} grades. Select grades then load rounds.")
        # Also populate rounds for all grades
        self._load_all_rounds()

    def _load_all_rounds(self):
        """Load all rounds across all grades so the round filter is populated."""
        base_url = self.url_var.get().strip()

        def fetch():
            try:
                session = make_session()
                all_round_labels = set()
                for grade in self._grades:
                    rounds = get_rounds(session, grade["url"], self._log)
                    for r in rounds:
                        all_round_labels.add(r["round_label"])
                sorted_rounds = sorted(all_round_labels,
                                       key=lambda x: int(re.search(r"\d+", x).group())
                                       if re.search(r"\d+", x) else 0)
                self.after(0, lambda: self._populate_rounds(sorted_rounds))
            except Exception as e:
                self._log(f"ERROR loading rounds: {e}")

        threading.Thread(target=fetch, daemon=True).start()

    def _populate_rounds(self, round_labels):
        self.round_list.delete(0, tk.END)
        for label in round_labels:
            self.round_list.insert(tk.END, label)
        self._log(f"Loaded {len(round_labels)} rounds. You're ready to run.")

    def _browse_output(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
            initialfile=self.out_var.get(),
        )
        if path:
            self.out_var.set(path)

    def _stop(self):
        """Signal the running scrape to stop after the current match."""
        self._stop_event.set()
        self._log("\n⏹  Stop requested — finishing current match then stopping…")
        self.stop_btn.configure(state="disabled")

    def _run(self):
        if self._running:
            return

        base_url = self.url_var.get().strip()
        if not base_url:
            messagebox.showwarning("No URL", "Please enter a portal URL.")
            return
        if not self.out_var.get().strip():
            messagebox.showwarning("No output", "Please set an output file name.")
            return

        # Read selected grades (empty selection = all)
        sel_grades = [self.grade_list.get(i)
                      for i in self.grade_list.curselection()]
        only_grades = sel_grades if sel_grades else None

        # Read selected rounds
        sel_rounds = [self.round_list.get(i)
                      for i in self.round_list.curselection()]
        only_rounds = sel_rounds if sel_rounds else None

        only_team = self.team_var.get().strip() or None
        output_path = self.out_var.get().strip()

        self._running = True
        self._stop_event.clear()  # Reset stop signal
        self.run_btn.configure(state="disabled", text="Running…")
        self.stop_btn.configure(state="normal")

        def on_done(success):
            self._running = False
            self.run_btn.configure(state="normal", text="▶  Run scraper")
            self.stop_btn.configure(state="disabled")
            if success:
                messagebox.showinfo("Done!", f"Scrape complete.\nCSV saved to:\n{output_path}")

        threading.Thread(
            target=run_scrape,
            args=(base_url, only_grades, only_rounds, only_team,
                  output_path, self._log, lambda s: self.after(0, lambda: on_done(s)),
                  self._stop_event),
            daemon=True,
        ).start()

    def _log(self, text):
        """Append a line to the log box (thread-safe via self.after)."""
        def _append():
            self.log_box.configure(state="normal")
            self.log_box.insert(tk.END, text + "\n")
            self.log_box.see(tk.END)
            self.log_box.configure(state="disabled")
        self.after(0, _append)


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────

if __name__ == "__main__":
    app = ScraperApp()
    app.mainloop()

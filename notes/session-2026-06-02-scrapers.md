# SportStack — Session Notes
**Date:** 2 June 2026
**Topic:** RevSports Scraper Build — Player Registry, History Scraper, Match Scraper Upgrade

---

## ✅ What We Completed

### New Supabase Tables

| Table | Rows | Status |
|---|---|---|
| `revsports_player_registry` | 727 | ✅ Full HB + Sunraysia |
| `revsports_player_history` | 30 | ⚠️ Test only — full run needed |
| `revsports_players` | ~4,236 existing | ⚠️ No player IDs on old rows — backfill needed |

**`revsports_player_registry`** — one row per player per competition/season. Source of truth for player identity and RevSports IDs. Key columns: `revsports_player_id`, `competition_id`, `association`, `player_name`, `first_name`, `last_name`, season stats, `profile_id` (for SportStack matching).

**`revsports_player_history`** — one row per player per season year. Stores career stats going back to 2020+. Key columns: `revsports_player_id`, `association`, `season_year`, season stats.

---

### Scrapers Built / Updated

All scrapers live at:
`C:\Users\mulla\Projects\SportStackApp\sportstack\scraper\`

#### `player_registry_scraper.py` ✅ New
- Visits Team Statistics page for each competition
- Scrapes every player's name, RevSports ID, and season stats
- Uses **Playwright** to click through JavaScript pagination (DataTables)
- Handles two name formats:
  - Hockey Ballarat: `Aaron M.` → first=`Aaron`, last=`M`
  - Sunraysia: `Chapman, Thomas` → first=`Thomas`, last=`Chapman`
- Competitions configured: HB (26298), Sunraysia Grass (26075), Sunraysia Indoor (25775)
- WHA not yet added (URL/competition ID TBC)

#### `scraper.py` ✅ Upgraded (match scraper)
- Added `ASSOCIATION_NAME` config variable
- Added `get_competition_name()` — auto-fetches name from games page heading
- Added `extract_player_id_from_row()` — gets `revsports_player_id` from player link in match card
- New fields per row: `association`, `competition_name`, `revsports_player_id`
- Restored `is_fillin` and `is_removed` flags
- Still uses `requests` + BeautifulSoup (not Playwright — match pages are plain HTML)

#### `history_scraper.py` ✅ New
- Reads all players from `revsports_player_registry`
- Visits each player's history page: `[base_url]/games/statistics/history/[revsports_player_id]`
- Captures: season year, matches played, goals, green/yellow/red cards
- Tested on 5 players → 30 rows written successfully
- Full run (727 players, ~10 min at 0.8s delay) not yet done — recommended via GitHub Actions

#### `hockey_scraper_gui.py` 🗑️ Deleted

---

### Playwright Installed Locally
```
pip install playwright
python -m playwright install chromium
```
Chromium location: `C:\Users\mulla\AppData\Local\ms-playwright\`
Required for: `player_registry_scraper.py` and `history_scraper.py`
NOT required for: `scraper.py` (match scraper uses plain HTTP requests)

---

## 🔜 Next Session Priorities

### 1. GitHub Actions Setup (Priority 1)
Automate all three scrapers to run on schedule via GitHub Actions.

| Scraper | Schedule |
|---|---|
| `player_registry_scraper.py` | Once per season (manual trigger) |
| `scraper.py` | Weekly (scheduled) |
| `history_scraper.py` | Once per season (manual trigger) |

Secrets needed in GitHub repo:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `PORTAL_URL`
- `ASSOCIATION_NAME`

Playwright step required in workflow YAML:
```yaml
- name: Install Playwright
  run: pip install playwright && python -m playwright install chromium
```

### 2. Backfill `revsports_player_id` on Old Rows (Priority 2)
4,236 existing rows in `revsports_players` have no player ID.
Fix: SQL join on `player_name + association` from registry → backfill the ID column.

### 3. Full History Scrape (Priority 3)
Run `history_scraper.py` across all 727 players. Recommend doing this via GitHub Actions, not locally.

### 4. Add WHA (Priority 4)
Once WHA competition URL and ID are confirmed, add to `COMPETITIONS` list in `player_registry_scraper.py`.

### 5. Player Matching Algorithm (Priority 5)
Link `revsports_player_id` values to SportStack `profiles` table:
1. Exact ID match (already matched rows)
2. Full name + club — Sunraysia (high confidence)
3. Name + club + division — Hockey Ballarat (good confidence)
4. Flag remainder for manual review

---

## 🔧 Key Technical Notes

- **Playwright vs requests:** Stats and history pages need Playwright (JavaScript-rendered). Match pages use plain requests.
- **Pagination:** Stats page uses JavaScript DataTables — Playwright clicks each page number button.
- **Competition name:** Auto-scraped from games page heading (above the "Statistics" link).
- **Name format:** HB = last word minus full stop = last name. Sunraysia = split on comma, swap order.
- **Env vars in PowerShell:** Must be loaded explicitly each session:
  `$env:SUPABASE_URL = [System.Environment]::GetEnvironmentVariable("SUPABASE_URL","User")`
- **Upsert conflict keys:**
  - Registry: `revsports_player_id, competition_id`
  - History: `revsports_player_id, season_year`
  - Match: `match_url, player_name, team, is_fillin`

---

## Association URLs

| Association | Draws & Results | Stats Page |
|---|---|---|
| Hockey Ballarat | revolutionise.com.au/hockeyballarat/games | /games/team-stats/26298 |
| Sunraysia | sunraysiahockey.com.au/games | /games/team-stats/26075 and /25775 |
| WHA | TBC | TBC |

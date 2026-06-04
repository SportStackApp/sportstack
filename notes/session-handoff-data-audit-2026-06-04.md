# SportStack — Session Handoff
**Date:** 4 June 2026
**Topic:** Data Audit — Associations, Divisions, Teams + Scraper Improvements

---

## What Was Completed This Session

### 1. Database Audit — Associations, Clubs, Divisions, Teams

Audited all three associations (Hockey Ballarat, Sunraysia, Wimmera) against the most recently scraped CSVs. The audit covered:
- Associations → Divisions → Teams
- Associations → Clubs → Teams

**Hockey Ballarat findings:**
- EGC Blue and EGC Gold in Under 11 Open — initially flagged as incorrect but confirmed by real fixtures. Keep.
- `Bobcats White` team row — orphaned (no division, no fixtures, no references). Deleted.
- `White` (Bobcats, Under 11 Open) is the correct row and remains.
- Placeholder clubs `HB` and `WHA` with no teams — noted, not yet actioned.

**Sunraysia findings:**
- Outdoor divisions and teams largely correct.
- Indoor competition (7 teams) was completely missing from the database — noted as outstanding.
- `Rivaside Under 16 Mixed` — name mismatch vs database (no "Mixed" qualifier). Noted.
- Two Under 16 Girls teams (`Rivaside/Koowinda`, `Waratahs/Koowinda`) assigned to placeholder club `SHA` — confirmed as combined teams, intentional.

**Wimmera:**
- Not yet audited this session — outstanding.

---

### 2. Supabase Migration — `revsports_unmatched_items` Table

New table created to capture scraped RevSports teams/grades that have no matching SportStack record.

| Column | Notes |
|---|---|
| `association` | e.g. `Sunraysia Hockey Association` |
| `competition_name` | From scraper |
| `grade` | e.g. `Indoor Mixed` |
| `team` | e.g. `Koowinda Indoor` |
| `club_name` | Blank = unknown/unstructured |
| `status` | `unmatched` / `mapped` / `ignored` / `added` |
| `mapped_team_id` | FK to `teams` — set when manually linked |
| `first_seen_at` / `last_seen_at` | Timestamps — upserted on each scrape run |

Unique constraint on `(association, competition_name, grade, team)` — upsert safe.

---

### 3. Frontend Changes

**`AdminDashboard.tsx`**
- Added count query against `revsports_unmatched_items` where `status = 'unmatched'`
- Added yellow alert card that appears when count > 0, linking to `/admin/revsports-unmatched`

**`RevSportsUnmatched.tsx`** (new file)
- Page at `/admin/revsports-unmatched`
- Shows all unmatched items in a table: Association, Competition, Grade, Team, Club, First Seen, Actions
- Action dropdown: "Mark as ignored" (sets status to `ignored`) or "Go to admin to add" (links to `/admin/teams`)
- Shows green success card when list is empty
- Route registered in `App.tsx`

---

### 4. Scraper — `scraper.py` Improvements

All changes committed to `dev` branch.

**Fix 1 — Competition name tracking per grade**
`get_all_grades()` now walks the page in document order and tracks which competition heading each grade sits under. Fixes the Sunraysia bug where all grades were incorrectly labelled as `"2026 - Indoor Competition - Irymple Leisure Centre"` regardless of which competition they belonged to.

**Fix 2 — Association-prefixed output filenames**
All output files now use a slug built from `ASSOCIATION_NAME`:
- `{assoc_slug}_results.csv` (was `hockey_results.csv`)
- `{assoc_slug}_results.json` (was `hockey_results.json`)
- `{assoc_slug}_unmatched.csv` (new)
- `{assoc_slug}_quality_report.txt` (new)

**Fix 3 — Unmatched items CSV + Supabase upsert**
After the main CSV is written, the scraper now:
1. Identifies rows where `club_name` is blank or "Unknown"
2. Writes them to `{assoc_slug}_unmatched.csv`
3. Upserts them to `revsports_unmatched_items` in Supabase (updates `last_seen_at` on repeat runs)

**Fix 4 — Data quality report**
`run_quality_check()` function added. Runs after every scrape. Checks all 21 columns against rules (required, numeric, boolean, date). Prints report to console (visible in GitHub Actions log) and saves to `{assoc_slug}_quality_report.txt`.

Rules summary:
| Rule | Columns |
|---|---|
| Required (never empty) | `association`, `competition_name`, `grade`, `round`, `home_team`, `away_team`, `team`, `player_name`, `revsports_player_id`, `club_name` |
| Numeric (if not empty) | `home_score`, `away_score`, `goals`, `green_cards`, `yellow_cards`, `red_cards`, `jersey` |
| Boolean (if not empty) | `attended`, `is_fillin`, `is_removed` |
| Date | `game_date` |

---

### 5. GitHub Actions Workflows — Schedule Updated

All four workflow files rewritten and saved to `.github/workflows/`.

| Workflow | New Schedule |
|---|---|
| `scrape-hb.yml` | 2am AEST daily + hourly Sat/Sun 8:00am–8:00pm (on the hour) |
| `scrape-sunraysia.yml` | 2am AEST daily + hourly Sat/Sun 7:30am–7:30pm (on the half hour) + Fri 4:30pm–10:30pm |
| `player-registry.yml` | 2am AEST nightly every day |
| `player-history.yml` | Sunday night 2am AEST + Wednesday night 3am AEST |

Staggering: HB runs on the hour (:00), Sunraysia on the half hour (:30) — avoids simultaneous git push conflicts.

**Note:** Workflow changes must be merged to `main` to take effect (GitHub Actions reads from the default branch).

---

## Outstanding / Next Session

### Priority 1 — Wimmera data audit
Not yet done. Need Wimmera CSV from latest scrape to compare against database teams and divisions.

### Priority 2 — Sunraysia indoor divisions
Indoor competition has 7 teams but no divisions exist in SportStack for it. Needs:
- New divisions added (e.g. "Indoor Mixed", "Walking Hockey — Mixed Social")
- Indoor team rows created per club
- Decision on whether Walking Hockey is in scope for SportStack

### Priority 3 — Placeholder clubs cleanup
`HB` (Hockey Ballarat) and `WHA` (Wimmera Hockey Association) exist as clubs with no teams. Likely safe to delete — confirm first.

### Priority 4 — Merge dev → main
All scraper and workflow changes are on `dev`. Need to merge to `main` to activate the new GitHub Actions schedule and deploy frontend changes.

### Priority 5 — Trigger test scrape
Run a manual Sunraysia scrape to confirm:
- Competition names now correctly split between outdoor and indoor
- Walking hockey captured as unmatched item
- Quality report generates and saves correctly
- Unmatched items appear in admin dashboard

### Priority 6 — Wimmera scraper workflow
No `scrape-wimmera.yml` exists yet. Need WHA RevSports URL to create it.

---

## Key IDs & References

| Item | Value |
|---|---|
| Supabase project | `svierarfcolhcfjpmwck` |
| Deleted team | `Bobcats White` — id `298824bf-e310-4073-b045-70c9a1dc8e38` |
| EGC Blue Under 11 | id `6fd50aa3` — confirmed real, keep |
| EGC Gold Under 11 | id `9b8a4c32` — confirmed real, keep |
| Sunraysia Grass competition ID | `26075` |
| Sunraysia Indoor competition ID | `25775` |

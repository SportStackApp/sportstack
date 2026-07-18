# SportStack — Session Handoff
**Date:** 5 June 2026
**Topic:** Scraper Data Alignment, Database Cleanup & Fixture Reset

---

## What Was Completed This Session

### 1. Scraper vs SportStack Gap Analysis

Reviewed all CSV columns from the scraper against what SportStack tables need. Key finding: the scraper is far more complete than expected.

**Scraper already provides:**
- `association`, `competition_name`, `grade`, `round`, `game_date`, `game_time`
- `venue`, `pitch` (both present in CSV — no manual entry needed)
- `home_team`, `away_team`, `home_score`, `away_score`
- `club_name`, `player_name`, `jersey`, `role`, `attended`, `is_fillin`
- `revsports_player_id`, `goals`, `green_cards`, `yellow_cards`, `red_cards`
- `umpire_1`, `umpire_2` (name text only — no profile link yet)
- `match_url` — will become the unique key for upserts

**Genuine gaps (not blockers for current testing):**
- Player email — placeholder accounts already exist (`player.[id]@placeholder.sportstack.com.au`)
- Player DOB / Hockey Vic number — not on RevSports, needs association export later
- Umpire identity linking — names are scraped but not linked to SportStack profiles yet
- Club logos / colours — cosmetic, one-off manual entry per club

---

### 2. Supabase Player Data — Old Rows Deleted

`revsports_players` had 4 scrape batches going back to 23 May. The first 160 rows (May 23, May 30, June 2) were old test scrapes with no `association` and no `revsports_player_id`.

**Deleted:** 160 old dirty rows
**Remaining:** 10,972 rows — all from June 4, all clean

---

### 3. Grade Mappings Cleaned Up

`revsports_grade_mappings` had 36 duplicate rows with `association = NULL` left over from old scrape runs. Also, all rows had `status = 'unmatched'` even when `division_id` was set — a bug.

**Fixed:**
- Deleted all 36 null-association duplicate rows
- Updated all rows with a `division_id` to `status = 'matched'`
- Result: 9 clean grade mapping rows, all matched

---

### 4. SHA Seasons Split Into Two

Sunraysia runs two separate competitions — Grass Field and Indoor. SportStack previously had one generic "2026 Season" for SHA.

**Changes made:**
- Renamed existing SHA season → `2026 Grass Field Competition`
- Created new SHA season → `2026 Indoor Competition`
- Renamed HB season → `2026 Winter Competition` (to match scraper's `competition_name`)

**All seasons now:**
| Association | Season | Active |
|---|---|---|
| Hockey Ballarat | 2026 Winter Competition | Yes |
| Sunraysia Hockey Association | 2026 Grass Field Competition | Yes |
| Sunraysia Hockey Association | 2026 Indoor Competition | Yes |
| Wimmera Hockey Association | 2026 Season | Yes |

---

### 5. Three Missing SHA Divisions Added

| Division added | Season | Gender |
|---|---|---|
| U11 Mixed | Grass Field Competition | Mixed |
| U13 Girls | Grass Field Competition | Female |
| Indoor Mixed | Indoor Competition | Mixed |

---

### 6. All 12 Grade Mappings Now Complete and Matched

---

### 7. HB and SHA Fixtures Wiped — Ready for Scraper Import

Old HB and SHA fixtures deleted along with all associated Umpire Match Voting test data. All 50 Umpire Match Voting submissions were from `test+` prefixed accounts. Last Umpire Match Voting entry was 1 June 2026.

**Deleted:**
- 7 Umpire Match Voting edit rows
- 116 Umpire Match Voting line rows
- 50 Umpire Match Voting submission rows
- 114 HB fixtures
- 90 SHA fixtures

**Remaining:** 177 WHA fixtures only (untouched)

---

## Current State of Key Tables

| Table | Rows | Status |
|---|---|---|
| `revsports_players` | 10,972 | Clean — June 4 data only |
| `revsports_player_registry` | 727 | Clean |
| `revsports_player_history` | 30 | Test only — full run needed |
| `revsports_grade_mappings` | 12 | All matched |
| `revsports_club_mappings` | 10 | All matched |
| `revsports_team_mappings` | 86 | All matched |
| `revsports_venue_mappings` | 5 | All matched |
| `revsports_pitch_mappings` | 9 | All matched |
| `revsports_competition_mappings` | 0 | Empty — needs populating |
| `fixtures` | 177 | WHA only — HB and SHA wiped |
| `profiles` | 712 | Placeholder accounts for all players |
| `seasons` | 4 | All correctly named |
| `divisions` | 21 | 3 new SHA divisions added |

---

## Outstanding — Next Session

### Priority 1 — Build fixture import script
Write a Python script that:
1. Reads `hockey_ballarat_results.csv` and `sunraysia_hockey_association_results.csv`
2. Deduplicates to one row per unique game (currently one row per player per game)
3. Runs each row through all mapping tables to resolve SportStack IDs
4. Upserts into `fixtures` using `revsports_match_url` as the unique conflict key
5. Skips rows where mapping is missing — logs to `revsports_unmatched_items`

**Key fields to populate:**
- `home_team_id` / `away_team_id` — via `revsports_team_mappings`
- `division_id` — via `revsports_grade_mappings`
- `season_id` — via `revsports_competition_mappings`
- `venue_id` / `pitch_id` — via venue/pitch mappings
- `fixture_date` — combine `game_date` + `game_time`
- `home_score` / `away_score`
- `round_number` — parse from `round` field (e.g. "Round 2" -> 2)
- `revsports_match_url` — the unique key (add column via migration first)

### Priority 2 — Add `revsports_match_url` column to fixtures table
Migration needed before import script runs.

### Priority 3 — Populate `revsports_competition_mappings`
Currently empty. Needs rows mapping scraper competition names to SportStack season IDs.

### Priority 4 — Nav badge for unmapped items
Copilot prompt was drafted this session. Add amber pill badge next to "RevSports Mappings" in sidebar showing total unmapped count. Hides when 0.

### Priority 5 — Fix status update bug in mappings page
When a mapping is saved, `status` stays as `'unmatched'` even when an ID is selected. Needs to flip to `'matched'` on save.

### Priority 6 — Run full history scrape
`revsports_player_history` only has 30 test rows. Full run across 727 players needed via GitHub Actions.

---

## Key Technical Notes

- `revsports_match_url` is the only reliable unique identifier linking scraper data to a specific game — use as upsert conflict key
- SHA Indoor competition has only one grade: `Indoor Mixed`
- `revsports_competition_mappings` uses column `competition_id` (not `season_id`)
- Umpire Match Voting delete order for fixtures: `player_vote_edits` -> `player_vote_lines` -> `player_vote_submissions` -> `fixtures`
- WHA fixtures cover full season (Rounds 1-15, 177 games) — imported from spreadsheet, do not touch
- Placeholder player emails follow pattern: `player.[revsports_player_id]@placeholder.sportstack.com.au`

# RevSports Mapping — ID Strategy Decisions

**Date:** 24 June 2026
**Context:** Part of the project health review. Core question: should the name-only mapping tables use RevSports numeric IDs instead of fragile name text, to prevent silent mismaps (the "Gold bug" class)?

---

## Key realisation: the scraper already captures the IDs

`scraper.py` already pulls RevSports IDs straight out of the page URLs and stores them on every row of `revsports_players`:
- `revsports_competition_id` — from `/games/{comp}/...`
- `revsports_grade_id` — from `/games/{comp}/{gradeId}`
- `revsports_venue_id` + `revsports_venue_url` — from the venue link `/venues/{comp}/{venueId}`

Coverage: grade ID on 100% of rows (9,933), venue ID on 99% (9,825). So no re-scrape is needed — the IDs are already in the database. The only gap was that the mapping tables and `fixture_import.py` weren't using them.

---

## GRADE — DECISION: match by ID. (Column + backfill DONE; importer change PENDING)

**Decision:** Match grades by `revsports_grade_id`, not name.

**Why:** Grade names genuinely clash across associations — e.g. "Women" is grade 26290 in Sunraysia but 22776 in Wimmera. Grades feed the `fixtures` table, so a silent mismap is high-impact. This is the one mapping table with real name-clash risk.

**Done this session:**
- Added `revsports_grade_id` column to `revsports_grade_mappings`.
- Backfilled it from `revsports_players` — all 18 mapping rows now carry their ID (0 missing). Backfill was unambiguous: every grade name maps to exactly one ID within its association.
- Migration: `supabase/migrations/20260624020000_add_revsports_grade_id_to_grade_mappings.sql`

**Still to do:**
- Update `fixture_import.py` `load_grade_mappings()` (and the match step) to resolve grade by `revsports_grade_id` first, falling back to name. (Antigravity code change — not yet done.)
- Commit the migration + the importer change to `dev`.

---

## VENUE & PITCH — DECISION: keep name + pitch-text matching. Do NOT add IDs.

**Decision:** Do not add RevSports IDs to `revsports_venue_mappings` or `revsports_pitch_mappings`.

**Why:**
1. **No pitch ID exists in the source.** Pitch is always free text ("Full Pitch", "1/2 Pitch North", "North End", "Pitch 2-Turf"). ID-based matching for pitches is simply impossible.
2. **Venue names are all unique** in the data, so name matching is already safe for venues — there's no collision risk like grades have.
3. **The RevSports "venue ID" is inconsistent**, because it reflects how each association entered their data, not a clean underlying model:
   - **WHA** — venues only, no pitches at all (even where grounds have multiple fields).
   - **Sunraysia** and **HB's John Vernon Field** — one venue, pitch as a text label within it (the sensible model).
   - **HB's Prince of Wales Park** — split into three separate "venue" entries (18277 = Full Pitch, 18279 = 1/2 Pitch North, 18280 = 1/2 Pitch South). This is an anomaly / data-entry choice, not the norm.

**Correct conceptual model (Aaron's call):** a venue + a pitch name/number as an attribute of that venue. There is no pitch identifier in RevSports to rely on, so pitch will always be text.

**Verified clean:** Prince of Wales Park's three pitch values all have pitch mapping rows, so the 634 half-pitch games resolve correctly (not silently dropped):
| Pitch | Games | RevSports venue ID | Mapped |
|---|---|---|---|
| Full Pitch | 4,036 | 18277 | yes |
| 1/2 Pitch North | 400 | 18279 | yes |
| 1/2 Pitch South | 234 | 18280 | yes |

---

## COMPETITION — note for later

`revsports_competition_mappings` already HAS a `revsports_competition_id` column, and `revsports_players` carries the competition ID on every row — but `fixture_import.py` still matches competitions by name. Wiring the importer to use the existing ID is a small future task (low risk, since competition names are currently unique).

---

## Net summary

- **Grade** was the only mapping table with genuine name-clash risk → being fixed (column + backfill done; importer change still pending).
- **Venue / pitch** stay name + pitch-text based **by design** — no pitch ID exists, and venue names don't collide.
- **Competition** has an ID ready to use whenever the importer is updated.
- No scraper changes and no re-scrape needed — the IDs were already being captured.

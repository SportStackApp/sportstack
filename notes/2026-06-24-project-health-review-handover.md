# SportStack — Session Handover

**Date:** 24 June 2026
**Type:** Full project health review + two confirmed fixes shipped
**Method:** Live Supabase queries + local code/doc reads, verified independently (not just trusting AI tool summaries).

---

## TL;DR for next session

Two real bugs fixed and shipped to `dev` this session: the Roles & Teams save bug, and grade mismatch risk in fixture import. Database is fundamentally healthy. Next priority is the votes-privacy RLS gap (#3 below).

---

## What was DONE and SHIPPED this session (all on `dev`)

### 1. Fixed: `admin_save_user_roles` save bug — CONFIRMED FIXED
- Cause: 4 conflicting overloaded versions of the function existed at once; Postgres couldn't reliably resolve which to call.
- Fix: backed up all 4 definitions, dropped the 3 stale ones, kept the version the app actually calls: `admin_save_user_roles(uuid, text[], jsonb, jsonb, uuid[], jsonb)`.
- Verified: only the correct version remains in the database.
- **Still TODO (Aaron):** test the Roles & Teams screen in the app — change a user's roles, save, refresh, confirm it persists.
- Files: `supabase/migrations/20260624010000_drop_stale_admin_save_user_roles_overloads.sql`, `notes/2026-06-24-admin_save_user_roles-backup.sql` (full restorable backup of all 4 versions). Committed: `5188752`.

### 2. Fixed: Grade mapping mismatch risk — CONFIRMED FIXED
- Found: the scraper already captures real RevSports IDs (grade, venue, competition) from page URLs — they were sitting in `revsports_players` unused. No re-scrape was needed.
- Risk: grade NAMES clash across associations (e.g. "Women" = grade 26290 in Sunraysia, 22776 in Wimmera) — name-only matching could silently mismap divisions, which feed `fixtures`.
- Fix: added `revsports_grade_id` column to `revsports_grade_mappings`, backfilled all 18 rows (100%, zero ambiguity). Updated `fixture_import.py` (`load_grade_mappings()` + `resolve_division_id()`) to match by grade ID first, falling back to name — verified via Antigravity dry-run: 532/535 fixtures resolved (unchanged), 500 now via the stable `grade_id` path.
- Verified independently: read the actual diff in `fixture_import.py`, confirmed the ID-key registration and the guarded lookup (`if id_key in grade_map`) are correct and safe.
- Files: `supabase/migrations/20260624020000_add_revsports_grade_id_to_grade_mappings.sql`, `scraper/fixture_import.py` (modified). Committed: `b88d7ec`.

### 3. Decision made: venue & pitch stay name-based — NOT a bug, documented
- Investigated using Aaron's screenshots of the RevSports source pages.
- Finding: **no pitch ID exists anywhere in RevSports** — pitch is always free text. The "venue ID" RevSports exposes is actually pitch-level, and associations use it inconsistently:
  - WHA: venues only, no pitch breakdown at all.
  - Sunraysia + HB's John Vernon Field: one venue, pitch as a text label (the sensible model).
  - HB's Prince of Wales Park: split into 3 separate "venue" IDs (18277 Full, 18279 North, 18280 South) — a HB data-entry anomaly, not the RevSports norm.
- Decision (Aaron's call, agreed): keep venue + pitch as name/text matching. Adding venue IDs would be messy (3→1 collapse for POW) and pitch IDs don't exist to add.
- Verified safe: all 3 POW Park pitch values have mapping rows — the 634 half-pitch games (400 North + 234 South) resolve correctly, nothing falling through.
- Documented in: `notes/2026-06-24-revsports-mapping-id-decisions.md`. Committed: `b88d7ec`.

### 4. Fixed: stale `project-brief.md` — CONFIRMED FIXED
- Was missing ~13 live routes (coaching, MVP voting, umpire portal, RevSports admin pages) and described MVP voting as "planned" when it's built and live.
- Updated routes list and wording. This file is read first by AI coding tools, so the staleness was feeding them a wrong map of the app.
- Committed: `4e6bd3f`.

### 5. Rescued: Profile Merge Tool — now version controlled
- Found ~1,885 lines of working code sitting untracked, only on Aaron's machine (not backed up to GitHub): `MergeProfilesDialog.tsx`, `EditUserDetailsDialog.tsx`, `get-user-emails` Edge Function, `admin_merge_profiles` migration, modified `UsersManagement.tsx`.
- Scanned for hardcoded secrets first (clean — service key read via `Deno.env.get()`, the correct pattern).
- Committed: `4e6bd3f`.

---

## Confirmed findings — NOT yet fixed (priority order for next session)

### 🟠 #3 — Votes privacy is screen-only, not enforced in the database
RLS is enabled on `mvp_votes`, but the policy "Admins full access - mvp_votes" grants `ALL` (including SELECT) to 5 roles: SUPER_ADMIN, ASSOCIATION_ADMIN, CLUB_ADMIN, COACH, TEAM_MANAGER. Per the Analytics design, Club Admin/Coach/Team Manager should only see the aggregate leaderboard — but this policy lets them read every individual vote row directly via the API, bypassing the UI restriction.
- **Proper fix (2 parts, not a quick toggle):** (a) build a totals-only leaderboard aggregate view/function that never exposes who-voted-for-whom; (b) then restrict raw `mvp_votes` SELECT to Super/Association Admin only.
- **Caution:** check how the Analytics screen currently reads votes for those 3 roles before touching RLS — it may read raw votes in the browser, and tightening naively could blank the leaderboard for them.
- Severity: medium (needs a logged-in user with one of those 3 roles deliberately querying the API).

### 🟠 #4 — 8 duplicate profile name-groups, no UI to merge them yet
Ben S (×4); Claire B, Hamish S, Hayden S, Lachlan M, Nick T, Reuben P, Riley K (×2 each).
The `admin_merge_profiles` DB function exists and was used successfully once before (Jason H → Jason Harris) — but the Stage 2 React UI to drive it (`MergeProfilesDialog.tsx`) was only just rescued into git this session, not yet wired up/tested for these 8.

### 🟢 #5 — Smaller items
- **10 real unmapped players** (of the original 384 "unlinked" — 335 were bye/blank rows, a phantom, not a bug). The 10 are reachable on `/admin/revsports-mappings` → Players (the page literally named "Unmatched" is a UX trap — it only has team/competition columns and is empty; it does NOT surface players).
- **Lineup promotion** — dry-run ready (~3,668 attended appearances: HB 2,002 + Sunraysia 1,666), `--apply` not yet run. Decision pending.
- **Wimmera scraper gap** — has fixtures but zero player appearances; stats are behind a login the scraper can't reach yet.
- **Competition mapping** — already has a `revsports_competition_id` column and the data has the ID, but `fixture_import.py` still matches by name. Same pattern as the grade fix, much smaller risk (names don't currently clash) — easy follow-up whenever.
- **`/admin/revsports-unmatched` page label** — misleading name, consider relabelling or adding a player section.

---

## Key facts for next session

- **Live counts (24 June 2026):** 728 profiles, 9,933 revsports_players, 579 fixtures, 135 mvp_votes, 1,227 team_memberships, 682 user_roles.
- **No orphaned records found anywhere** — votes, memberships, roles all point to real rows. Genuinely healthy.
- **RLS enabled on all key tables** — but enabled ≠ correctly scoped (see #3 above).
- **Scraper already captures RevSports grade ID, venue ID, and competition ID** on every row of `revsports_players` (100%, 99%, ~100% coverage respectively) — no re-scrape needed for ID-based matching projects. The gap was always in the mapping tables / importer, not the scraper.
- **`revsports_player_registry` and `revsports_player_history`** are separate Playwright-based scrapers (season stats + career history) — not reviewed in depth this session, flagged as untouched territory if doing a deeper pipeline pass later.

---

## Commits this session (all on `dev`, none yet merged to `main`)
1. `4e6bd3f` — project-brief refresh + Profile Merge Tool rescue + handover note
2. `5188752` — admin_save_user_roles fix (dropped 3 stale overloads) + backup
3. `b88d7ec` — grade ID matching in fixture_import.py + migration + decision doc

Nothing has been merged to `main` / deployed to Vercel yet — that's a separate, deliberate step whenever Aaron's ready.

---

## Recommended next session starting point
1. Test the Roles & Teams save fix in the app (quick, confirms #1 actually works end-to-end).
2. Tackle #3 (votes privacy) — start by checking how Analytics currently reads votes for Club Admin/Coach/Team Manager, before touching RLS.
3. Or: wire up the Profile Merge Tool UI and clean the 8 duplicate profiles (#4).

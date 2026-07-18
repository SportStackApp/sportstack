# SportStack — Session Handover

**Date:** 24 June 2026 (afternoon/evening session)
**Type:** Verify previous fixes, close out the Player MVP Voting privacy gap, deploy to production, resolve duplicate-profile backlog
**Continues from:** `2026-06-24-project-health-review-handover.md` (this morning's session)

---

## TL;DR for next session

Two real fixes confirmed and deployed to production today: `admin_save_user_roles` save bug (tested ✅) and the Player MVP Voting privacy RLS gap (built, tested across all 5 roles ✅, deployed ✅). The duplicate-profile backlog from this morning's review turned out to be a false alarm — 7 of 8 flagged names are genuinely different real people, and the 8th (Ben S) is a data gap between two scraper pipelines, not a duplicate. A delete was attempted on 3 "Ben S" profiles and correctly blocked by a foreign key constraint — no data was lost.

---

## What was DONE and SHIPPED this session

### 1. Confirmed: `admin_save_user_roles` save bug fix works end-to-end
- Tested live in the app: changed a role assignment for Aaron Mullane, saved, refreshed, reopened — change persisted correctly.
- This closes out the fix from this morning's session.

### 2. Fixed + tested + deployed: Player MVP Voting privacy RLS gap
- **Problem:** RLS policy on `mvp_votes` granted full read access (including who-voted-for-whom) to 5 roles: SUPER_ADMIN, ASSOCIATION_ADMIN, CLUB_ADMIN, COACH, TEAM_MANAGER. Per Aaron's stated Player MVP Voting rule, only Super Admin and Association Admin should see individual choice content — Club Admin/Coach/Team Manager should only see Player MVP Voting *submission status* ("voted: yes/no"), and Players should only see their own historic choices.
- **Investigation before fixing:** confirmed via codebase search that Club Admin/Coach/Team Manager have no nav link to the screens that read raw Player MVP Voting rows from `mvp_votes` (`Analytics.tsx`, `MvpVotingAdmin.tsx`) — those are Super Admin/Association Admin only in the UI. The Player MVP Voting page Club/Team roles actually use (`MvpVotes.tsx`) reads from `mvp_vote_submissions` instead, which was already correctly scoped (all 5 roles can read submission status only, no individual choice content). This meant tightening `mvp_votes` was low-risk — nothing the app shows those 3 roles depends on it.
- **Fix applied:** dropped the old "Admins full access" policy, replaced with one limited to SUPER_ADMIN + ASSOCIATION_ADMIN only.
- **Backup taken first:** `notes/2026-06-24-mvp_votes-policy-backup.sql` has the original policy text, restorable if needed.
- **Tested live across all 5 roles via screenshots:** Player and Team Manager only see the basic Player MVP Voting page (no privacy issue). Club Admin has no Player MVP Voting/Analytics nav item at all. Association Admin and Super Admin both see the full historical "Individual Votes Log", correctly marked with a "RESTRICTED: VISIBLE TO SUPER AND ASSOCIATION ADMINS ONLY" badge that the UI already had — now the database actually enforces what that badge promises.
- Files: `supabase/migrations/20260624030000_restrict_mvp_votes_to_super_and_association_admin.sql`, `notes/2026-06-24-mvp_votes-policy-backup.sql`. Committed: `69fddc9`.

### 3. Deployed to production
- Merged `dev` → `main` (6 commits, including this morning's `admin_save_user_roles` fix, grade ID matching fix, Profile Merge Tool, project-brief refresh, and today's Player MVP Voting privacy fix).
- Pushed and confirmed live via Vercel MCP: deployment `dpl_2KhhM3ZQp8CCi2hPbLTHohHueqZy`, target `production`, state `READY`, commit `4a4278d`.
- `dev` and `main` are now fully in sync (both at `4a4278d` before the next commit below).
- Added `scratch/` (Aaron's one-off debug `.cjs` scripts) to `.gitignore` — keeps them off git permanently without needing to remember each time.

### 4. Investigated and resolved the 8-name duplicate-profile backlog — turned out to be a false alarm
- **Rule applied throughout:** different RevSports player ID + different club = different real person, not a duplicate. Same name alone isn't enough evidence (Aaron confirmed this from real-world knowledge of the comps — regional hockey has many genuinely different people sharing a first name + surname initial).
- **7 of 8 confirmed as different real people**, no merge needed: Claire B, Hamish S, Hayden S, Lachlan M, Nick T, Reuben P, Riley K. Each pair has a different RevSports ID and a different club (or, for Riley K, same club but Aaron confirmed from direct knowledge they're two different real players).
- **Ben S (×4 profiles) — near-miss caught, no data lost:**
  - Initial read: 3 of 4 "Ben S" profiles looked like empty placeholder accounts (no club/grade/appearances in `revsports_players`, no roles, no voting records in the tables checked at the time, no team memberships, never logged in). The historical record did not say which module's tables were checked.
  - A delete was attempted on these 3 profiles + their `auth.users` rows.
  - **The delete was correctly BLOCKED by a foreign key constraint** (`revsports_player_registry_profile_id_fkey`) before any data was removed.
  - Investigating the constraint revealed all 3 profiles have real season stats in `revsports_player_registry` (a season-totals table from the separate Playwright-based registry scraper, not reviewed in this morning's health review) — 6-7 games attended each, matching the same 3 real players (Ben S, Ben Schwedes, Ben Sturmfels) seen with full match data in `revsports_players`.
  - **Conclusion: these are the correct profiles for 3 real players**, not duplicates or junk. They're simply missing club/grade info specifically in the `revsports_players` table — likely a gap between the match-by-match scraper and the season-registry scraper, not a duplicate-profile problem.
  - **No deletion was performed. `profiles` table is untouched.**
- Files: `notes/2026-06-24-duplicate-profile-investigation.md` (full detail per name). Committed: `813763e` (on `dev`, not yet merged to `main` — docs-only, no urgency).

---

## Confirmed findings — NOT yet addressed (carried over / new)

### 🟢 New: Ben S scraper data gap (low priority, not urgent)
3 real player profiles (`XeRO3I8`, `Vz3w9fw`, `Ke6Peum`) have complete season totals in `revsports_player_registry` but incomplete club/grade data in `revsports_players`. Worth investigating why these two scraper pipelines disagree for these specific 3 players — could indicate a small mapping or scrape-timing issue. Not blocking anything currently.

### 🟠 Carried over from this morning — still not fixed
- **6 duplicate name-groups (#4 in this morning's handover) — RESOLVED, see above.** No longer needs action.
- **10 real unmapped players** — reachable on `/admin/revsports-mappings` → Players.
- **Lineup promotion `--apply`** — dry-run ready (~3,668 attended appearances), not yet run.
- **Wimmera scraper gap** — has fixtures but zero player appearances (stats behind a login the scraper can't reach yet).
- **Competition mapping** — has `revsports_competition_id` column + data, but `fixture_import.py` still matches by name (low risk, names don't currently clash).
- **`/admin/revsports-unmatched` page label** — misleading name, the table is empty and unmatched players are actually on the Mappings page.

---

## Key facts for next session

- **Production is now in sync with `dev`** as of commit `4a4278d` (before today's docs-only commit `813763e`).
- **The Profile Merge Tool remains functionally untested against a fresh duplicate** in this session — no genuine new duplicate was found to test it on. It already worked once before (Jason H → Jason Harris, an earlier session). No urgency to find a new test case.
- **Vercel + GitHub MCP tools were used directly this session** to confirm deployment status without needing Aaron to check the dashboards manually — confirmed `target: production`, `state: READY`.
- **A near-miss was caught by the database, not by manual review** — worth remembering that foreign key constraints are a real safety net, but shouldn't be relied on as the *only* check before a delete. Checking all referencing tables before deleting (not just the obvious one) is the better habit going forward.

---

## Commits this session
1. `69fddc9` (dev) — Player MVP Voting privacy RLS fix + policy backup + gitignore scratch/
2. `4a4278d` (dev + main, via merge) — deploy of all 6 pending commits to production
3. `813763e` (dev only) — duplicate profile investigation notes

---

## Recommended next session starting point
1. If curious: look at the Ben S scraper gap (`revsports_players` vs `revsports_player_registry` mismatch for 3 profiles) — low priority, not blocking.
2. Otherwise, pick up the carried-over items from this morning's review: lineup promotion `--apply`, Wimmera scraper login access, or the 10 real unmapped players.
3. Merge `813763e` (docs-only) to `main` whenever convenient — no urgency, just housekeeping.

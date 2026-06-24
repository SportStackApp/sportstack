# SportStack — Project Health Review Handover

**Date:** 24 June 2026
**Type:** Full project health check (database, data pipeline, features, screen-to-table links)
**Method:** Live Supabase queries + local code/doc reads. Findings verified against actual schema and data, not assumed.

---

## Summary

A full sweep across four zones. The database is fundamentally healthy (no orphaned records, RLS enabled everywhere). The main risks are: one confirmed live bug, a class of name-only mapping tables, and a votes-privacy rule that exists on screen but not in the database. One fix was made this session (project brief refreshed).

Baseline counts at time of review: 728 profiles, 9,933 revsports_players, 579 fixtures, 135 mvp_votes, 1,227 team_memberships, 682 user_roles.

---

## Findings by severity

### High

**1. `admin_save_user_roles` has 4 conflicting versions (CONFIRMED, NOT FIXED)**
Four overloaded copies of this function exist at once, with different parameter sets:
- `(p_user_id, p_roles, p_coach_teams, p_manager_teams)`
- `(p_user_id, p_roles, p_coach_teams, p_manager_teams, p_association_admin_associations, p_club_admin_clubs)`
- `(p_user_id, p_roles, p_coach_scopes jsonb, p_manager_scopes jsonb, p_association_admin_associations, p_club_admin_clubs)`
- `(p_user_id, p_roles, p_coach_scopes jsonb, p_manager_scopes jsonb, p_association_admin_associations, p_club_admin_scopes jsonb)`

This is the cause of the "Roles & Teams save reports success but doesn't persist" bug — Postgres can't reliably resolve which version to call. Fix: identify the correct (current) signature, drop the other three. Low risk.

**2. Six mapping tables match by name only — "Gold bug" class (NOT FIXED)**
These have no RevSports numeric ID column, so a name change or duplicate name silently mismaps:
`revsports_grade_mappings`, `revsports_venue_mappings`, `revsports_pitch_mappings`, `revsports_club_mappings`, `revsports_association_mappings`, `revsports_umpire_mappings`.
- **Grade and venue are the dangerous two** (they feed fixtures).
- `revsports_competition_mappings` already HAS `revsports_competition_id`, but the import script ignores it — wire it up.
- Related parked item (`known-issues.md`): duplicate team names in fixture import cause silent wrong-team assignment. Same family of problem.

### Medium

**3. Votes-privacy restriction is screen-only, NOT enforced in the database (CONFIRMED, NOT FIXED)**
RLS is enabled on `mvp_votes` (4 policies), but the policy "Admins full access - mvp_votes" is set to `ALL` and applies to five roles: SUPER_ADMIN, ASSOCIATION_ADMIN, CLUB_ADMIN, COACH, TEAM_MANAGER.
Per the Analytics design, CLUB_ADMIN / COACH / TEAM_MANAGER should only see the leaderboard — but this policy lets them read every individual vote row directly via the API, bypassing the UI.
- Severity: medium. Not public; needs a logged-in user with one of those roles querying the API directly.
- Proper fix (two parts, NOT a quick toggle): (a) serve the leaderboard via a totals-only aggregate view/function that never exposes who-voted-for-whom; (b) then restrict raw `mvp_votes` SELECT to Super/Association Admin only.
- Caution: the leaderboard for those roles is likely built by reading raw votes in the browser. Tightening RLS naively could blank the leaderboard. Check how Analytics reads votes before changing policies.

**4. 8 duplicate profile name-groups (NOT ACTIONABLE IN-APP YET)**
Ben S (x4); Claire B, Hamish S, Hayden S, Lachlan M, Nick T, Reuben P, Riley K (x2 each).
The `admin_merge_profiles` database function exists (Stage 1 done), but the Stage 2 React UI to run it is not built — so these can't be cleaned up in-app yet.

**5. The "384 unlinked scraped players" — diagnosed, mostly a phantom (NOT A BUG)**
Of 384 revsports_players with no profile_id:
- 335 are bye / `NO_PLAYERS` / blank rows with no RevSports ID — legitimately exempt, not real players.
- 49 appearances = only 10 real people. All 10 have a RevSports ID but no row in `revsports_player_mappings`, which is why no profile link was made. Normal "awaiting mapping" backlog, not corruption. None are Wimmera.
- The 10: Hannah F. (SOBHC), Anthony D. (SOBHC), Demi Atkinson (Rivaside), Kate Madden (Waratahs), abbiegail peters (Koowinda), Willem McGregor (Koowinda), Cooper P. (Blaze), Kayd Divola (Rivaside), Max F. (Blaze), Michael Fotheringham (Rivaside).
- They ARE reachable: the RevSports Mappings page (`/admin/revsports-mappings` -> Players) lists every scraped player by RevSports ID with no "already matched" filter, so they appear there to be mapped.
- Minor oddity: the two SOBHC players have a last-seen date of 23 Aug 2026 (future) — possibly season-registration rows rather than match appearances. Worth a glance later.

### Healthy / clean (verified)

- No orphaned records: mvp_votes (player + voter), team_memberships (user + team), user_roles (user) all point to real rows.
- RLS enabled on all key tables (profiles, mvp_votes, mvp_voting_sessions, team_memberships, user_roles, revsports_players, fixtures).
- `admin_merge_profiles` and `is_super_admin()` exist and look correct (`is_super_admin()` takes no args).
- V2 fixture import is clean: docs report 574/574 imported, 0 skipped. Reconciles with the live 579 total (574 + 5 old Wimmera rows deliberately left alone).

### Docs / UX flags

- **project-brief.md was stale — FIXED this session.** It was missing ~13 live routes and described the MVP voting module as "planned". Updated to list all current routes and mark MVP voting as built/live. The AI tools read this file first, so the staleness was feeding them a wrong map.
- **"Unmatched" page UX trap.** `/admin/revsports-unmatched` reads the `revsports_unmatched_items` table, which only has team/competition/grade columns (no player fields) and is currently empty. It does NOT surface unmatched players — those live on the Mappings page. Consider relabelling, or adding a player section, so the name isn't misleading.

---

## Pipeline state (scraper -> app)

- V2 fixture import: live and healthy.
- Lineup promotion: dry-run planner ready (~3,668 attended appearances ready — Hockey Ballarat 2,002 + Sunraysia 1,666; 0 blockers). `--apply` NOT run yet (approval-gated). Decision pending.
- Wimmera gap: has fixtures but zero player appearances. RevSports keeps Wimmera player stats behind a login; scraper needs authenticated support before Wimmera MVP voting / line-ups can work.

---

## Change made this session

- Edited `docs/project-brief.md` (routes section + MVP wording). Backup at `docs/project-brief.md.bak`.
- **Uncommitted.** This is a docs file (not `.yml`), so it goes to the `dev` branch first, then merges to `main`. Delete the `.bak` before committing so it isn't staged.

---

## Recommended next actions (priority order)

1. Fix `admin_save_user_roles` — drop the 3 stale versions, keep the correct one. (Quick, confirmed.)
2. Add RevSports ID columns to the name-only mapping tables (grade + venue first); make the competition import use the ID column it already has.
3. Votes privacy: build a totals-only leaderboard aggregate, then tighten `mvp_votes` SELECT to Super/Association Admin. (Check Analytics' read path first.)
4. Build the profile-merge UI (Stage 2), then merge the 8 duplicate profiles.
5. Map the 10 unmatched players via Mappings -> Players.
6. Decide on running lineup-promotion `--apply`.
7. Wimmera authenticated scraping (larger piece of work).
8. Optional: relabel the "Unmatched" page.
9. Commit the project-brief update to `dev`; delete the `.bak`.

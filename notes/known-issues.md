# SportsStack — Known Issues & Parked Tasks

## Duplicate Team Names in Fixture Import
**Logged:** 14 April 2026  
**Status:** Resolved on Dev — 1 August 2026; owner smoke test pending

**Problem:**  
If two clubs within the same association both have a team with the same name (e.g. both have a "Division 1 Open"), the fixture importer silently picks the first match it finds. This could assign a game to the wrong team with no warning.

**Resolution:**
- The template now supplies exact `Club - Division - Team` labels.
- A short team name is accepted only when it is unique in the selected association and admin scope.
- Ambiguous names, mixed divisions, missing seasons and duplicate spreadsheet rows block the whole import.
- Imported fixtures now save their division and season links.

## Existing Duplicate Team Membership Data

**Logged:** 1 August 2026
**Status:** Parked — needs a separate read-only review and approved cleanup plan

**Problem:**
A Dev read-only audit found 202 repeated user/team membership keys. Of these, 200 contain a Primary
and Secondary row and two contain two Secondary rows. It also found 44 users with more than one
Primary membership across teams.

**Current protection:**
- New membership-request approvals are serialised and atomic.
- Approval stops when the requested user/team already has duplicate rows.
- No existing membership was changed or deleted during the audit.

**Next step:**
Prepare a per-person dry-run report that identifies the intended row to keep. Any cleanup is a
separate destructive data task and needs Aaron's approval.

## Email Template Polish
**Logged:** 30 June 2026  
**Status:** Parked - do when revisiting claim/reset/welcome email flows

**Problem:**  
The Supabase emails for password resets, placeholder claim links, and welcome messages are plain and need a more polished SportStack look.

**To do:**
- Improve the password reset email template.
- Improve the placeholder claim link email template.
- Improve the welcome/invite email template.
- Keep the wording clear about what action the user needs to take.
- Make the templates visually consistent with SportStack branding.

## Permission, Modules, and Parked Feedback Items
**Logged:** 3 July 2026  
**Status:** Parked - include in the permission/module re-scope

**Do:**
- Add separate permission concepts for Player MVP Voting submission/result visibility and Umpire Match Voting submission/result visibility, plus committee access and committee president access.
- Allow module enable/disable rules at association, club, division, and team level.
- Keep inheritance clear: parent permissions flow down, but child scopes can be excluded or overridden with warning prompts.
- Decide Club Admin visibility separately for Player MVP Voting submissions/results and Umpire Match Voting submissions/results; do not apply one module's rule to the other or hard-code both to Super Admin and Association Admin only.

**Do not:**
- Add one-off hard-coded permission checks that will need to be unwound during the re-scope.
- Treat module inheritance as only a Super Admin setting.
- Rebuild address structure or pitch rotation as part of small feedback fixes.

## Production Scraper Storage Retention Rollout

**Logged:** 30 July 2026
**Status:** Prepared on `dev` - Production approval still required

**Current position:**
- Production `scrape-backups` contained 1,013 objects using 1,593,506,009 bytes during the read-only
  audit.
- The new exact-fixture refresh, nightly full catch-up, weekly compressed backup and 12-month
  monthly retention routine are prepared on `dev`.
- The revised read-only projection identifies 969 objects using 1,533,329,605 bytes as deletion
  candidates and keeps 44 objects using 60,176,404 bytes.
- No Production schedule or Storage object has been changed by the preparation task.

**Approval gates:**
- Review and approve the exact workflow promotion from `dev` to `main` because it changes
  Production scraper schedules and secret usage paths.
- Run a fresh Production retention dry run after promotion.
- Approve the exact deletion object count, byte count and SHA-256 before the guarded apply.

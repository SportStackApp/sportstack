# SportsStack — Known Issues & Parked Tasks

## 🟡 Duplicate Team Names in Fixture Import
**Logged:** 14 April 2026  
**Status:** Parked — needs decision before bulk import goes live

**Problem:**  
If two clubs within the same association both have a team with the same name (e.g. both have a "Division 1 Open"), the fixture importer silently picks the first match it finds. This could assign a game to the wrong team with no warning.

**Options discussed:**
- **Option A** — Enforce unique team names within an association (database constraint)
- **Option B** — Require `Club – Team Name` format in the import file column (e.g. `Koowinda – Division 1 Open`)
- **Option C** — Show a warning in the import preview table when a duplicate name match is detected, and ask the user to resolve it manually

**Recommendation:** Option C is the safest short-term fix — it doesn't change existing data or the template format, but flags the problem visibly at import time.

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
- The new consolidated schedule, compressed backup format and bounded retention policy are prepared
  on `dev`.
- No Production schedule or Storage object has been changed by the preparation task.

**Approval gates:**
- Review and approve the exact workflow promotion from `dev` to `main` because it changes
  Production scraper schedules and secret usage paths.
- Run a fresh Production retention dry run after promotion.
- Approve the exact deletion object count, byte count and SHA-256 before the guarded apply.

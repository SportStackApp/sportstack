# B1 Primary-team actual-role walkthrough — 7 September 2026

## Result

The Development walkthrough passed with the disposable Codex Player and Codex Team Manager
accounts. Production was not changed.

- The Player requested Lucas HC as Primary while Pumas was the existing Primary in the same
  association.
- The warning correctly said Pumas would become Secondary and Primary memberships in other
  associations would not change.
- The destination Team Manager could see and approve the request after the Requests route fix.
- Approval completed immediately without a separate player-confirmation action.
- Lucas HC became Primary, Pumas became Secondary and refresh preserved the result.
- Fresh browser console and failed-request checks were empty after the successful run.
- Dev served `v2026.09.07+ed68664`; Dev Quality run `34079182660` passed.

## Defects found and repaired

1. `team_manager` was supported by the page and database but omitted from the Requests route gate.
   Commit `fde9a93` adds the narrow route/navigation access and passed Dev Quality `34078570755`.
2. The legacy registered-club guard rejected the trusted membership-trigger sync when the Primary
   moved between clubs in the same association. Additive migration
   `20260907131500_allow_derived_registered_club_sync.sql` permits only the nested trigger update
   when the new club matches an active Primary membership. Direct profile changes remain guarded.
   Commit `ed68664` passed Dev Quality `34079182660`.

The second repair passed apply, repeat, rollback, protected-count and no-leak checks on staging and
Development. The private guard has an empty search path and no anonymous, authenticated or service
role execute grant.

## Confirmed policy

- One active Primary team per person per association.
- A person may be Primary in multiple associations.
- A player-submitted request records consent.
- Destination Team Manager or Club Admin approval completes the change immediately.
- Legacy `ADMIN_APPROVED` requests may still require player confirmation.
- Only Super Admin may change account-wide Player or Voter roles.

## Frozen candidate

- Production base: `a1d23c741b79de02c32763a879597192a1c1ebd5`
- Candidate: `3d9bc530b04ada938da751d68b1fea908371c5b0`
- Changed paths: 38
- Binary patch SHA-256: `c51d468e2015189488b4689acc691acf725f021a51b64ffbce51556cf5fd0216`
- Vercel deployment: `6301360025` — successful, HTTP 200

Candidate checks passed: 13 focused Python policy tests, 96 tracked Python tests, five Vitest
files/21 tests, TypeScript, Production build and `git diff --check`.

The candidate contains no workflow or Edge Function changes. Fresh Production drift/backup checks
and exact owner approval remain mandatory before release.

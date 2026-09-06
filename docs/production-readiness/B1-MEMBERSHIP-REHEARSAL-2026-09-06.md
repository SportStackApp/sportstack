# B1c Primary-Team Membership Workflow Rehearsal

Date: 6 September 2026

## Outcome

B1c is applied and recorded on Development. It replaces direct browser writes to primary-team
change requests with six hardened database functions, keeps request reads limited to the player or
the destination team's authorised administrators, and makes the final membership change atomic.

The exact migration passed a fresh Production-derived first apply, repeat apply, role test and
transactional rollback. Production was inspected read-only and was not changed.

## What changed

Migration `20260906095820_b1_membership_workflow_compatibility.sql`:

- installs the request, approve, confirm, cancel and decline lifecycle plus its scope helper;
- pins all six `SECURITY DEFINER` functions to an empty search path;
- grants execution only to `authenticated` and `service_role`;
- removes direct authenticated request-table writes and all anonymous table access;
- keeps two authenticated read policies: own requests and destination-scoped administrator reads;
- serialises requests and final membership changes, rejects duplicate target memberships, and
  changes only active primary memberships;
- masks unrelated request IDs with the same not-found response before checking lifecycle state.

Historical duplicate memberships were measured but deliberately not changed.

## Rehearsal evidence

The verified 6 September Production backup was mounted read-only in a fresh local PostgreSQL
container. Managed Auth and Storage rows were omitted because their service-owned schemas vary by
local image version; application data restored without error. B1a and B1b were applied first, then
the exact final B1c migration.

| Gate | Result |
|---|---:|
| First B1c apply | Pass |
| Repeat B1c apply | Pass |
| Transactional rollback to Production-derived B1a+B1b | Pass |
| Self request/read/cancel | Pass |
| Scoped Club Admin read/approve/decline | Pass |
| Player confirmation and membership transition | Pass |
| Unrelated read/approve/confirm/cancel/decline denial | Pass |
| Terminal request state masking | Pass |

Protected counts stayed at 757 profiles, 1,260 memberships and six primary-team requests.

## Live environment result

Development now records migration `20260906095820`. The hosted runtime test passed inside a rolled-
back transaction and the database error-level lint passed. Development has six hardened functions,
two SELECT policies, no anonymous request-table access and authenticated SELECT only.

Production remains on its existing baseline: zero B1c functions and four historical request
policies. Its canonical aggregate inventory is unchanged from before the Dev apply. Production has
six requests, including one `ADMIN_APPROVED` request; the current data has no pending or invalid-
status request. No Production migration, function, policy, grant or row was changed.

The known historical data remains: both environments have 44 users with multiple active primary
memberships, and all 44 were previously established as placeholder profiles. Cleanup is destructive
and remains a separate owner-approved task.

## Security and quality

The completed diff security review reported zero findings. It reproduced one low-impact error-
message side channel, rejected it as non-reportable because request IDs are high entropy and no row
or mutation access was gained, and the migration was still hardened before Dev.

- Static migration and grant verifier: pass.
- Focused changed-script lint: pass.
- Vitest: 46 files and 181 tests pass.
- TypeScript: pass.
- Production build: pass.
- Full lint: 346 errors and 77 warnings, exactly matching the existing baseline; no new lint debt.

Machine-readable evidence is in `B1-MEMBERSHIP-REHEARSAL-2026-09-06.json`.

## Next release stage

B1d is next: reconcile the application allow-list against the Production baseline, then rehearse the
complete B1a-B1d package in a hosted Production-compatible environment. Main and Production remain
unchanged until those gates pass and Aaron gives a new explicit Production approval.

# B1 security compatibility rehearsal — 6 September 2026

## Outcome

The B1b security bridge is deployed to Development. The exact additive migration passed
first apply, repeat apply, runtime access checks and rollback against an isolated
Production-derived database with the already deployed B1a foundation.

A rollback-only check against the live Development database also passed. It confirmed that the
only deliberate change to current Development behaviour is binding the authenticated
`can_manage_module_scope` lookup to the signed-in user. Production was not changed.

Development records migration version `20260906075102`. The hosted runtime denial and legitimate
Super Admin paths pass. Profiles remained 755, memberships 1,259, primary-team requests five and
permission catalogue rows 22 across the application. Database lint and the error-level security
and performance advisers report no issues.

The frozen candidate also passes 46 Vitest files/181 tests, TypeScript, the Production build and
focused lint. Full lint remains the existing 346-error/77-warning repository baseline, with no
finding in the new B1b scripts.

## Exact candidate

- Migration: `20260906075102_b1_security_compatibility.sql`
- SHA-256: `45960fb9e3b8661d22fac956ec4ae7cc0aab3afe9ec239e94fd6a6816465c74d`
- Functions checked: 38
- RLS policies checked: 11
- Tables directly readable by authenticated users: 5
- Functions executable by authenticated users: 18
- Anonymous B1 table and function access: none

The bridge curates the final B1 security functions, initial permission catalogue, RLS policies,
integrity triggers and minimum grants. It is repeat-safe and preserves later Development
extensions outside the B1b ownership boundary.

## Rehearsal evidence

The verified Production public-data backup was restored to a PostgreSQL container with no host
port. The backup file was 58,342,020 bytes with SHA-256
`0e4e677d86ec3fc5efe1c40d3077c68b040e45d53575a6023f33712a0e15738e`. It contains personal
information and is deliberately not part of Git.

| Check | Result |
| --- | --- |
| Exact first apply | Passed |
| Exact repeat apply | Passed |
| Transactional rollback | Passed |
| Runtime permission checks | Passed |
| Unrelated signed-in user probing another administrator | Denied |
| Legitimate Super Admin self-path | Passed |
| Live Dev rollback compatibility check | Passed |

Protected row counts were unchanged through first and repeat application:

| Table | Before | After first apply | After repeat |
| --- | ---: | ---: | ---: |
| `profiles` | 757 | 757 | 757 |
| `team_memberships` | 1,260 | 1,260 | 1,260 |
| `primary_change_requests` | 6 | 6 | 6 |

The logical backup does not faithfully restore hosted Supabase Auth and Storage. A local-only Auth
scaffold was used for the foreign-key dependency, so the later complete B1 package still needs its
planned hosted Production-compatible rehearsal.

## Security review

The complete six-file pre-remediation review found one low-severity information-disclosure issue:
an authenticated user could ask whether another user managed a supplied scope. The migration
generator now requires authenticated callers to query their own user ID, with an explicit
service-role exception for trusted server work. The isolated runtime test confirms the unrelated
user path is denied and the valid Super Admin path still works.

## Release boundary

This evidence does not authorise Production. B1c membership workflows, B1d application allow-list,
the complete hosted rehearsal and an independent review remain required before an exact Production
package can be presented to Aaron for approval.

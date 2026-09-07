# B1 hosted Production-compatible rehearsal — 7 September 2026

## Result

The disposable `SportStack-staging` project (`fdkgcwacuqoswnatvubv`) was reset under Aaron's exact
approval and rebuilt from the Production schema backup plus the six additive B1 migrations. Apply,
repeat, rollback and actual-role allow/deny checks passed. Main and Production were not changed.

The original application candidate was frozen at commit `5994385f403d4a8188de49e14762ac6097f018fa`.
Generated hosted types, 19 Vitest tests, TypeScript, Production build and focused lint passed. Full
lint contains the inherited Production baseline of 229 errors and 50 warnings. No workflow or B1
Edge Function is included.

## Follow-up role-boundary hardening

Aaron confirmed that only Super Admin may add or remove account-wide Player/Voter roles. The
seventh additive migration, `20260907101500_b1_restrict_account_wide_simple_roles.sql`, was applied
on top of the rehearsed six-migration staging database. Actual-role tests proved lower-admin
add/remove denial, unchanged lower-admin saves, Super Admin add/remove, preserved team-scoped Player
membership and restricted internal-function grants. The transaction rolled back all test data.

The final candidate is `a076174f317a4fbdc66c50e312b7257624ad33b0`, with binary patch SHA-256
`c58dc1ed7020f0cf67806f33bc58b6450bd9b4be2f9bf44bc30e54c2db0293af`. Focused boundary tests,
87 tracked Python tests, TypeScript, Production build and the candidate Vercel deployment pass. A
fresh independent post-fix review found no confirmed issue.

## Hosted smoke test

- Association → Club → Division → Team scope selection passed.
- Club Admin and Team Manager modes persisted after refresh; Team Manager used `team_manager`.
- Roles, module controls and advanced permissions loaded for authorised scope.
- Disabled Player MVP access failed closed and restored correctly through inheritance.
- Team Manager was redirected away from the Roles & Modules page.
- External email was disabled. All disposable data and both test users were removed; final counts
  were zero.

Evidence screenshots are retained in the isolated rehearsal folder as
`TEAM_MANAGER_PERSISTENCE.png` and `ROLES_MODULES_HOSTED.png`.

## Adviser and rollback review

Database adviser notices were inherited Production findings, expected authenticated
`SECURITY DEFINER` RPC notices, expected direct-access denial for the private session table, or
non-blocking performance work. B1 actual-role denial tests passed and B1 functions have no anonymous
grants. See the [Supabase database linter guidance](https://supabase.com/docs/guides/database/database-linter).

Before Production, take a fresh backup and independently review the exact candidate, migration
order and rollback points. Application rollback is to Production commit `a1d23c7`; database
recovery uses the fresh backup because migration history must not be rewritten.

## Actual-role Primary-team follow-up

The later Development walkthrough completed the deferred Player-to-Team-Manager flow. Aaron
confirmed one Primary per association, multiple Primaries across different associations, player
request as consent and immediate completion after destination Team Manager or Club Admin approval.

The walkthrough exposed and closed two issues: Team Manager Requests route access and a legacy
registered-club guard blocking the trusted cross-club membership sync. The final Production-based
candidate is `3d9bc530b04ada938da751d68b1fea908371c5b0`, with binary patch SHA-256
`c51d468e2015189488b4689acc691acf725f021a51b64ffbce51556cf5fd0216`. Candidate deployment
`6301360025` is successful and returns HTTP 200. Staging and Dev runtime verification, 13 focused
Python tests, 96 tracked Python tests, five Vitest files/21 tests, TypeScript and Production build
pass.

Still required: fresh Production pre-flight and verified backup, and a new exact Production
approval for candidate `3d9bc53`.

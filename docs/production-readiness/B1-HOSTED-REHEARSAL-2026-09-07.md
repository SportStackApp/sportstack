# B1 hosted Production-compatible rehearsal — 7 September 2026

## Result

The disposable `SportStack-staging` project (`fdkgcwacuqoswnatvubv`) was reset under Aaron's exact
approval and rebuilt from the Production schema backup plus the six additive B1 migrations. Apply,
repeat, rollback and actual-role allow/deny checks passed. Main and Production were not changed.

The exact application candidate is frozen locally at commit
`5994385f403d4a8188de49e14762ac6097f018fa`. Generated hosted types, 19 Vitest tests, TypeScript,
Production build and focused lint pass. Full lint contains the inherited Production baseline of 229
errors and 50 warnings. No workflow or B1 Edge Function is included.

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

Still required: the B1c owner walkthrough, Aaron's decision on cross-organisation Primary-team
semantics, independent review, and a new exact Production approval.

# Contributing

## Branch rules

- Non-workflow changes must go to `dev` first, then be merged to `main` when ready.
- Changes under `.github/workflows/*.yml` may target `main`, but only with care because `main` can trigger production deployment behaviour.
- Use short, descriptive branch names such as `fix/...`, `feat/...`, or `chore/...`.

## Commit format

Use:

```text
type(scope): summary
```

Examples:

- `docs(repo): add handoff documentation`
- `fix(fixtures): handle missing venue names`
- `feat(player-mvp): add Player MVP Voting session status filter`

## Pull request checklist

Before requesting review, confirm:

- [ ] The branch target follows the branch rules above.
- [ ] The PR scope is small and focused.
- [ ] User-facing text uses Australian English.
- [ ] No secrets, `.env`, `.env.local`, service keys, or private tokens are committed.
- [ ] Supabase service-role credentials are not exposed to frontend code.
- [ ] Any database work was verified against the live schema and uses an additive migration.
- [ ] Owner confirmation was obtained for destructive DB operations, schema migrations, RLS/auth/Edge Function changes, role enum changes, secrets, or deployment-sensitive work.
- [ ] Required checks were run: `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
- [ ] Relevant manual smoke testing was completed or clearly listed for the owner.

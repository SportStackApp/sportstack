# Contributing

## Branch rules

- App changes must go to `dev` first, then be merged to `main` for staging.
- Production release requires explicit owner approval, then `main` is merged to `prod`.
- A push to `prod` triggers the Vercel production deployment.
- Changes under `.github/workflows/*.yml` need separate care: scheduled workflows run from the
  default `main` branch and may use either Dev or Production Supabase secrets. Confirm the target
  secrets and get owner approval before merging workflow changes to `main`.
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

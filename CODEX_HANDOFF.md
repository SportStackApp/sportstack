# Codex Handoff

Last updated: 2026-07-30

Future agents should start by reading these files in order:

1. `AGENTS.md` — repository rules, safety constraints, release path and testing expectations.
2. `docs/current-state.md` — current implementation, deployment and owner-test status.
3. `docs/project-brief.md` — concise product and architecture context.
4. `docs/scraper-operations.md` — current scraper, backup and retention routine.
5. `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md` — fuller technical context when needed.

## Current release state

- The fault-tolerant fixture scraper and match-duration package was promoted through `dev`, `main`
  and `prod` on 30 July 2026 at `398f386` after Aaron approved the Production release.
- The consolidated Production scraper workflow is active on GitHub's default branch. Vercel
  Production completed successfully, the public site returned 200, signed-out `/dashboard`
  redirected to `/login`, and the deployed bundle referenced Production Supabase only.
- The approved Production compatibility release is complete. The 16 migrations, two Edge Functions,
  scheduled notification jobs and final Git promotion were completed on 29 July 2026.
- Production signed-in owner smoke testing remains the main release follow-up.
- `supabase/pending-migrations/lock_down_mvp_voting_access.sql` remains parked and excluded.

## Scraper storage state

- Read-only checks on 30 July found 181,040,447 bytes in Dev `scrape-backups` and 1,593,506,009
  bytes across 1,013 Production `scrape-backups` objects.
- The Production excess is caused by the old hourly weekend workflows saving separate raw backup
  files after every run.
- The released routine selects exact fixtures every 15 minutes after their calculated finish,
  verifies the current RevSports round-card start before scraping, retries late results, runs one
  nightly full catch-up and never backs up the small targeted runs.
- Calculated finish now uses exact fixture finish, division duration, association default, then a
  90-minute fallback. The additive duration migration is applied and verified in Dev and
  Production; all existing divisions remain blank and inherit their association setting.
- Routine match backups are weekly. Retention keeps the latest, nearest 1/2/4-week snapshots, then
  one per month for 12 months. Production dry-run `30529006936` keeps 44 of 1,013 existing objects
  and identifies 969 objects using 1,533,329,605 bytes as deletion candidates. Its exact plan
  SHA-256 is `0f76b636191078b6e5c6fe971110058d4ad8560142617398299069fa2ee549c2`.
- No Production file has been deleted. Retention apply still requires Aaron's separate exact
  destructive confirmation.

## Local repository cleanup

- The previous eight local stashes were preserved in the verified bundle
  `C:\Users\mulla\AppData\Local\SportStack\backups\local-git\sportstack-stashes-20260730-144716.bundle`.
- The live stash list was then cleared. Keep the bundle until the scraper-routine work is accepted.

## Best next owner test

1. Complete the signed-in Production smoke test for Dashboard, Communications, availability,
   Profile, Player MVP administration, Umpire Match Voting administration and key admin pages.
2. Review the exact guarded retention totals in `docs/scraper-operations.md` and approve or reject
   the separate Production deletion.

Keep Player MVP Voting and Umpire Match Voting separate. Hockey Trace and Safety Hub write forms
remain parked.

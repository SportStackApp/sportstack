# Codex Handoff

Last updated: 2026-07-30

Future agents should start by reading these files in order:

1. `AGENTS.md` — repository rules, safety constraints, release path and testing expectations.
2. `docs/current-state.md` — current implementation, deployment and owner-test status.
3. `docs/project-brief.md` — concise product and architecture context.
4. `docs/scraper-operations.md` — current scraper, backup and retention routine.
5. `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md` — fuller technical context when needed.

## Current release state

- Before the current Dev-only scraper-routine work, local and remote `dev`, `main` and `prod` were
  aligned at `53561de` with a clean working tree and no open pull request.
- The scraper-routine package is being completed on `dev`; `main` and `prod` remain unchanged until
  Aaron separately approves the Production-capable workflow promotion.
- The approved Production compatibility release is complete. The 16 migrations, two Edge Functions,
  scheduled notification jobs and final Git promotion were completed on 29 July 2026.
- Production signed-in owner smoke testing remains the main release follow-up.
- `supabase/pending-migrations/lock_down_mvp_voting_access.sql` remains parked and excluded.

## Scraper storage state

- Read-only checks on 30 July found 181,040,447 bytes in Dev `scrape-backups` and 1,593,506,009
  bytes in Production `scrape-backups`.
- The Production excess is caused by the old hourly weekend workflows saving separate raw backup
  files after every run.
- The current Dev change selects exact fixtures every 15 minutes after their calculated finish,
  verifies the current RevSports round-card start before scraping, retries late results, runs one
  nightly full catch-up and never backs up the small targeted runs.
- Calculated finish now uses exact fixture finish, division duration, association default, then a
  90-minute fallback. The additive duration migration is applied to Dev only; existing divisions
  remain blank and inherit their association setting.
- Routine match backups are weekly. Retention keeps the latest, nearest 1/2/4-week snapshots, then
  one per month for 12 months. The read-only projection keeps 44 of 1,013 existing objects and
  identifies 969 objects using 1,533,329,605 bytes as deletion candidates.
- No Production file has been deleted and no Production schedule has changed yet. Promotion of the
  workflow change to `main`, and the exact Production deletion plan, require separate approval.

## Local repository cleanup

- The previous eight local stashes were preserved in the verified bundle
  `C:\Users\mulla\AppData\Local\SportStack\backups\local-git\sportstack-stashes-20260730-144716.bundle`.
- The live stash list was then cleared. Keep the bundle until the scraper-routine work is accepted.

## Best next owner test

1. Complete the signed-in Production smoke test for Dashboard, Communications, availability,
   Profile, Player MVP administration, Umpire Match Voting administration and key admin pages.
2. Review `docs/scraper-operations.md`, especially the Production schedule and retention tiers.
3. After the Dev checks pass, approve or reject the separate `main` workflow promotion and guarded
   Production retention apply.

Keep Player MVP Voting and Umpire Match Voting separate. Hockey Trace and Safety Hub write forms
remain parked.

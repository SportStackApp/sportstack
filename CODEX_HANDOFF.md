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
- The approved Production compatibility release is complete. The 16 migrations, two Edge Functions,
  scheduled notification jobs and final Git promotion were completed on 29 July 2026.
- Production signed-in owner smoke testing remains the main release follow-up.
- `supabase/pending-migrations/lock_down_mvp_voting_access.sql` remains parked and excluded.

## Scraper storage state

- Read-only checks on 30 July found 181,040,447 bytes in Dev `scrape-backups` and 1,593,506,009
  bytes in Production `scrape-backups`.
- The Production excess is caused by the old hourly weekend workflows saving separate raw backup
  files after every run.
- The current Dev change consolidates Production scheduling, compresses future backups, adds a
  bounded retention policy and makes legacy workflows manual-only.
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

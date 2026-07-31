# Codex Handoff

Last updated: 2026-07-31

Future agents should start by reading these files in order:

1. `AGENTS.md` — repository rules, safety constraints, release path and testing expectations.
2. `docs/current-state.md` — current implementation, deployment and owner-test status.
3. `docs/project-brief.md` — concise product and architecture context.
4. `docs/scraper-operations.md` — current scraper, backup and retention routine.
5. `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md` — fuller technical context when needed.

## Current release state

- A guarded, backup-first Umpire Portal Production release script and runbook are prepared for
  `dev` and `main` staging. The script is pinned to the exact Production Supabase project, two
  approved migrations, one Edge Function and the Production Vercel setting. Vercel CLI 58.4.4 is
  installed locally.
- A 30-day Supabase token has been created and verified against both SportStack projects and a
  read-only Production migration listing. The existing Production Turnstile keys are also staged
  with Windows user encryption. No database password was copied, reset or stored; Production DB
  access uses an isolated temporary CLI work directory while the repository stays linked to Dev.
- The isolated dry-run rebuilt 157 live Production history records as empty temporary placeholders
  and confirmed only the two approved Umpire Portal migrations are pending. This prevents older
  filename drift from replaying historical migrations.
- Vercel access remains pending because Aaron must complete the provider's browser authentication.
  After that login, create the scoped team token, finish the encrypted access file and run the
  read-only Production preflight.
- The public Umpire Portal frontend remains on `dev` and `main` only. Production Supabase, Vercel
  settings and `prod` remain unchanged pending the access preflight and approved release execution.
- The fault-tolerant fixture scraper and match-duration package was promoted through `dev`, `main`
  and `prod` on 30 July 2026 at `398f386` after Aaron approved the Production release.
- The follow-up release and storage records brought `dev`, `main` and `prod` to `682b8ea` on
  30 July 2026.
- The consolidated Production scraper workflow is active on GitHub's default branch. Vercel
  Production completed successfully, the public site returned 200, signed-out `/dashboard`
  redirected to `/login`, and the deployed bundle referenced Production Supabase only.
- The approved Production compatibility release is complete. The 16 migrations, two Edge Functions,
  scheduled notification jobs and final Git promotion were completed on 29 July 2026.
- Production signed-in owner smoke testing remains the main release follow-up.
- `supabase/pending-migrations/lock_down_mvp_voting_access.sql` remains parked and excluded.

## Scraper storage state

- The Production excess caused by old hourly weekend backups is resolved. Approved cleanup run
  `30530191487` removed 969 objects using 1,533,329,605 bytes.
- Production `scrape-backups` now contains the intended 44 recovery objects using 60,176,404 bytes.
  Post-delete workflow and database checks agreed, with no approved candidate left behind.
- The released routine selects exact fixtures every 15 minutes after their calculated finish,
  verifies the current RevSports round-card start before scraping, retries late results, runs one
  nightly full catch-up and never backs up the small targeted runs.
- Calculated finish now uses exact fixture finish, division duration, association default, then a
  90-minute fallback. The additive duration migration is applied and verified in Dev and
  Production; all existing divisions remain blank and inherit their association setting.
- Routine match backups are weekly. Retention keeps the latest, nearest 1/2/4-week snapshots, then
  one per month for 12 months. The organisation-wide Supabase GB-hour graph may take time to reflect
  the lower stored total.

## Obsidian note continuity

- Committed repository Markdown is authoritative. Its generated, read-only Hermes mirror is
  `Projects/SportStack Repository`, with `_Index.md` as the entry point.
- The curated Vault notes own only the project boundary, priorities, action register and operating
  procedure. They link back to the generated mirror for changing implementation and release detail.
- `AGENTS.md` requires a refresh/read at the start of meaningful work and a sync plus `-Check` after
  the canonical note changes are pushed to `dev`.
- The current-user Windows task `SportStack Obsidian Note Sync` runs daily at 7:00 pm local time and
  catches up after missed runs. It reads `origin/dev`, so feature branches and uncommitted files
  cannot become the published record.

## Local repository cleanup

- The previous eight local stashes were preserved in the verified bundle
  `C:\Users\mulla\AppData\Local\SportStack\backups\local-git\sportstack-stashes-20260730-144716.bundle`.
- The live stash list was then cleared. Keep the bundle until the scraper-routine work is accepted.

## Best next owner test

1. Complete Vercel browser authentication, create the scoped Vercel token, finish the encrypted
   local access file and run the read-only Production preflight.
2. Complete the approved Umpire Portal Production release, then smoke-test both Umpire Portal login
   choices and one clearly marked test ballot.
3. Complete the wider signed-in Production smoke test for Dashboard, Communications, availability,
   Profile, Player MVP administration, Umpire Match Voting administration and key admin pages.

Keep Player MVP Voting and Umpire Match Voting separate. Hockey Trace and Safety Hub write forms
remain parked.

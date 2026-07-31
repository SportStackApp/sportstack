# Codex Handoff

Last updated: 2026-08-01

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
- Vercel browser authentication is complete. A verified 30-day SportStack team token is stored in
  the existing Windows-encrypted Production access file outside the repository. Direct Vercel API
  and CLI project checks both passed without exposing the token.
- The unfinished `scraper/fixture_import.py` worktree copy was proven to contain duplicated conflict
  text only, backed up outside the repository and restored exactly to the committed implementation.
  The full 94-test Python suite, TypeScript and production build passed afterward.
- The Production preflight now stops at the branch-alignment gate. It found `dev` nine commits ahead of
  `main`, and the reviewed package includes a workflow capable of selecting Production targets.
  Explicit owner approval is required before that package can move to `main`. No Production action
  was attempted.
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

## Active development order

- The locked 14-block order is recorded in `docs/development-plan.md`.
- Block 1 is complete: the unfinished RevSports importer was safely recovered and verified.
- Block 2 is at its staging approval gate. Its future address is
  `hb.sportstackapp.com.au`, but connecting the domain, changing DNS and promoting Production remain
  separately approval-gated.
- Block 3 is implemented on Dev pending owner smoke testing. The Dev database now has four reusable
  field templates linked to the four existing formations, scoped RLS and least-privilege grants.
  The app adds persistent cropped icons, safer line-up saves, team selection, formation-change
  protection and mobile tap instructions.
- Block 4 repository preparation is complete. `hb.sportstackapp.com.au` is mapped to the public
  Umpire Portal inside this SportStack app, with safe hostname routing, origin preparation and a
  live-rollout checklist in `docs/domain-migration-plan.md`. Vercel, DNS, Supabase Auth, Turnstile,
  redirects and Production are unchanged and approval-gated.
- Block 5 is implemented on Dev pending owner smoke testing. Signed-in menus now follow a consistent
  everyday workflow, expose existing competition and import pages to Super Admin, explicitly scope
  association and club admin choices, and use separate Player MVP Voting and Umpire Match Voting
  names. The route inventory and contextual-page decisions are in `docs/navigation-audit.md`.
- Block 6 is implemented on Dev pending owner smoke testing. The daily dashboard now labels the
  selected team's Primary, Secondary or Fill-in relationship, presents clearer home/away fixture
  information and uses accessible, save-locked availability controls only on eligible fixtures.
  Failed fixture/calendar requests are no longer shown as genuine empty data.
- Do not merge or cherry-pick `chore/domain-structure` commit `3a7d6cc`; it contains the superseded
  assumption that `hb` belongs to the separate ignored Hockey Ballarat module. The corrected work
  is being landed directly on `dev`.

## Local repository cleanup

- The previous eight local stashes were preserved in the verified bundle
  `C:\Users\mulla\AppData\Local\SportStack\backups\local-git\sportstack-stashes-20260730-144716.bundle`.
- The live stash list was then cleared. Keep the bundle until the scraper-routine work is accepted.

## Best next owner test

1. Approve or decline the reviewed `dev` to `main` staging package that includes the
   Production-capable scraper workflow.
2. Sign in to Dev and smoke-test one custom icon, one saved field template and one fixture line-up
   formation change/save/reload.
3. After the required Production approval, complete the Umpire Portal release and smoke-test both login
   choices and one clearly marked test ballot.
4. Complete the wider signed-in Production smoke test for Dashboard, Communications, availability,
   Profile, Player MVP administration, Umpire Match Voting administration and key admin pages.

Keep Player MVP Voting and Umpire Match Voting separate. Hockey Trace and Safety Hub write forms
remain parked.

# SportStack Current State

Last updated: 2026-07-18

This file is the short, current project status for ChatGPT, Codex, and Aaron.

Update this file after every meaningful Codex task, pull request, schema change, deployment, or confirmed live-data check. If this file conflicts with older handoff documents, this file wins unless Aaron says otherwise.

## Source of truth order

1. `AGENTS.md`
2. `docs/current-state.md`
3. `CODEX_HANDOFF.md`
4. `docs/project-brief.md`
5. `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md`
6. `PROJECT_SCOPE_UI_UX_AND_IMPLEMENTATION_PLAN.md`
7. Latest pull requests and commits
8. Live Supabase check

## Current priority

Keep work focused on the existing SportStack web app and the next MVP voting/data-quality work.

Near-term priority areas:

- MVP voting flow reliability
- Admin data quality and import flows
- RevSports scraper/import alignment
- Team, club, association, division, venue, fixture, and player management
- Safe, clear admin workflows

## Current stack

SportStack is a React + TypeScript + Vite single-page app using Tailwind CSS, shadcn/ui, React Router, Supabase, and Vercel.

The backend is Supabase: Postgres, Auth, Storage, Row Level Security, and Edge Functions. RevSports data is scraped by Python scripts and GitHub Actions, staged into `revsports_*` tables, mapped, then imported into live app tables.

## Confirmed operating rules

- Non-workflow changes should go to `dev` first, then merge to `main` when ready.
- Pushes to `main` can deploy to Vercel.
- Treat the live Supabase project as real production data.
- Do not expose `.env`, `.env.local`, Supabase service-role keys, private voting tokens, or other secrets.
- Confirm with Aaron before destructive database work, schema migrations, RLS/auth changes, Edge Function changes, role enum changes, secrets work, or deployment-sensitive work.
- Use Australian English in user-facing text.
- Use `DD/MM/YYYY` dates and respect the association timezone where relevant.

## Recently changed

Recent repo evidence shows MVP voter access and app feedback work landed after the older handoff documents were written.

Known recent themes:

- Voter-only MVP session discovery was adjusted.
- Primary/secondary voter team switching was added.
- App metadata was renamed to SportStack.
- `app_feedback` support was added.
- Some older lint issues may still exist outside the touched files.

## Known broken / uncertain

Treat these as current caution areas unless a newer live check proves otherwise:

- Older handoff docs may be stale in places.
- MVP voting status differs across docs: some say built/live, others say partial. Check current code, latest PRs, and live data before planning voting work.
- Email sending/reminders for MVP voting need confirmation before assuming they are fully implemented.
- Fixture `division_id` / `season_id` reliability needs confirmation before joining fixtures directly to divisions.
- Live Supabase schema can drift from migration files, so verify live schema before database-dependent work.
- Edge Functions in the repo and deployed Edge Functions may be out of sync.
- There is no formal automated test suite yet.

## Current Codex handoff template

After each Codex task, update this section or append a dated entry below.

### Latest handoff entry

Date: 2026-07-18

What changed:

- Released the Safety Hub database foundation and read-only frontend connection
  for `/admin/safety-risk`.
- Added the approved Safety Hub tables, expanded fields, linked-record model,
  scoped RLS, audit triggers and organisation settings foundation.
- Connected dashboard totals, registers, associated-record summaries, matrix
  settings and audit history to scoped Supabase reads.
- Kept Risk, Action, QI and Bright Idea forms local-only with `Validate draft`;
  this release does not enable live form writes.
- Added Safety Hub navigation for Club Admin.
- Made Owner optional for Risk, Action and QI drafts. Registers and detail
  drawers separately show the database `created_by` person as `Added by`.
- The 25 matrix values remain provisional and are not recorded as approved.
- Dev contains one clearly labelled `[DEV TEST]` linked Safety Hub chain.
  Production Safety Hub record, link and review tables remain empty.

Files changed:

- `src/components/layout/AppLayout.tsx`
- `src/pages/admin/SafetyRiskModule.tsx`
- `src/integrations/supabase/types.ts`
- `supabase/migrations/20260718181341_safety_hub_database_integration.sql`
- `docs/safety-hub-database-integration-plan.md`
- `docs/current-state.md`

Checks run:

- Focused ESLint passed for the changed frontend files.
- `npx tsc --noEmit` passed.
- `npm run build` passed with the existing large-chunk warning.
- Browser checks passed for scoped dashboard data, linked records, matrix
  guidance, audit details, optional Owner validation and `Added by`.
- A clean browser reload produced no new console errors.
- Full-repository lint remains at the existing 583 unrelated problems.

What Aaron should test next:

- Open Production `/admin/safety-risk` as Super Admin, Association Admin and
  Club Admin.
- Confirm Club Admin can see Safety Hub in the sidebar and only records for
  their club.
- Confirm the Production registers are empty until real committee records are
  deliberately added.
- Confirm forms still show `Validate draft` and do not save records.

Risk level:

- High for the wider package because the approved additive schema and RLS
  migration was already applied to Production.
- Low for this release action: no new Production data write or form-write
  enablement is included.

### Previous handoff entry

Date: 2026-07-13

What changed:

- Released the approved mock-only Safety Hub prototype baseline for `/admin/safety-risk`.
- Added the demo-data warning, nine dashboard KPI cards, Bright Idea submission entry point, sectioned Action form, detailed Matrix & Guidance tabs, and expanded Audit History filters and drawer detail.
- Improved the active tab contrast in light and dark mode and kept the tab bar visible as one horizontally scrollable row.
- Added expandable association summaries to Risk, Action, QI and Bright Idea rows, grouped into associated risks, actions, QI items and Bright Ideas.
- Improved desktop, tablet and mobile drawer/register behaviour, including tablet overflow and compact row controls.
- Parked organisation-scoped settings for matrix wording, rating responses, review guidance and editable risk categories as a later package.
- This approval covers the visual mock prototype only. It does not approve a database schema, permissions, RLS design, live data model or final matrix values.
- No Safety Hub Supabase read/write, migration, RLS/Auth change or Edge Function change is included.

Files changed:

- `src/pages/admin/SafetyRiskModule.tsx`
- `src/components/layout/AppLayout.tsx`
- `docs/current-state.md`

Checks run:

- `npx eslint src/pages/admin/SafetyRiskModule.tsx src/components/layout/AppLayout.tsx` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed with the existing old Browserslist-data and large-chunk warnings.
- Desktop, tablet and mobile browser checks passed in the final prototype review.
- `npm run lint` still reports 611 existing unrelated repository problems; the focused Safety Hub lint has no issues.

Risk level:

- Low. Mock-only frontend and documentation changes.
- No database migration is included.

### Previous handoff entry

Date: 2026-07-11

What changed:

- Added the next mock-only Safety Hub form prototype round.
- The `/admin/safety-risk` Add record button now opens a prototype form menu for:
  - Add Risk
  - Add Action
  - Add QI Item
  - Submit Bright Idea
  - Committee Bright Idea Review
  - Record Risk Review
- Added a five-step Add/Edit Risk wizard:
  - Basics
  - Risk Event
  - Inherent Risk
  - Controls & Residual Risk
  - Treatment & Review
- Added calculated inherent and residual ratings using the same 5 x 5 mock matrix shown on Matrix & Guidance.
- Added Action, QI, Bright Idea, committee review, and risk review prototype forms.
- Added linked-record form entry points from record drawers:
  - Risk drawer can open Edit Risk, Add linked Action, Add linked QI, and Record Review.
  - Action drawer can open Edit Action and Add linked QI.
  - QI drawer can open Edit QI and Add linked Action.
  - Bright Idea drawer can open Committee Review, linked QI, and linked Action flows.
- Linked forms prefill visible record IDs, for example Add linked Action from `R-001` shows `R-001` as the risk link.
- Added clear validation messages for required fields.
- Added an unsaved-draft warning before closing a changed form.
- Prototype saves validate locally and show a confirmation toast/banner only. They do not create, update, or delete live data.
- No live Supabase data is read or written by these forms.
- No migration was added or applied.

Files changed:

- `src/pages/admin/SafetyRiskModule.tsx`
- `docs/current-state.md`

Checks run:

- `npx tsc --noEmit` passed.
- `npx eslint src/pages/admin/SafetyRiskModule.tsx` passed.
- `npm run build` passed.
- Browser smoke check passed for `/admin/safety-risk`:
  - Add record menu opened.
  - Blank Action save showed validation messages.
  - `R-001` drawer opened Add linked Action with `R-001` prefilled.
  - Closing a changed form showed the unsaved-draft warning.
- Browser console still showed the existing app-startup `claimPlaceholderProfile` Edge Function non-2xx error; this was not introduced by the Safety Hub page.
- `npm run lint` still fails on existing unrelated lint issues across older `modules/*`, older admin/coaching files, Supabase function code, and `tailwind.config.ts`.

What Aaron should test next:

- Open `/admin/safety-risk`.
- Click Add record and open each prototype form.
- In Add Risk, step through all five wizard steps and check field names/order.
- From `R-001`, open Add linked Action and confirm the risk link is obvious before saving.
- From a QI row, open Add linked Action and confirm the QI link is obvious before saving.
- From a Bright Idea row, open Committee Review and check the decision/conversion wording.
- Type into any form, press Close, and confirm the unsaved-draft warning is clear.

Risk level:

- Low. UI prototype only.
- No database migration, no RLS/auth change, no Edge Function change, no live data write, and no deployment action.

### Previous handoff entry

Date: 2026-07-11

What changed:

- Adjusted `/admin/safety-risk` back to the approved first-round Safety Hub approach: local mock UI only.
- Removed direct Supabase reads and writes from the Safety Hub page for this prototype round.
- Added the planned seven Safety Hub areas:
  - Dashboard
  - Risk Register
  - Actions
  - QI Register
  - Bright Ideas
  - Matrix & Guidance
  - Audit History
- Added representative mock records for risks, actions, QI items, Bright Ideas, audit events, and the 5 x 5 matrix.
- Added dashboard KPI cards, alert chips, charts, compact register tables, filters, loading state, empty state, linked-record badges, and a right-side detail drawer.
- Updated the admin navigation label to `Safety Hub` while keeping the existing `/admin/safety-risk` route.
- The Add record button is visible but disabled until the next form-prototype package.
- No live Supabase data is read or written by this page.
- No migration was added or applied.

Files changed:

- `src/pages/admin/SafetyRiskModule.tsx`
- `src/components/layout/AppLayout.tsx`
- `docs/current-state.md`

Checks run:

- `npx tsc --noEmit` passed.
- `npx eslint src/pages/admin/SafetyRiskModule.tsx` passed.
- `npm run build` passed.
- Browser smoke check passed for `/admin/safety-risk`: the page rendered, all seven tabs appeared, the Bright Ideas tab showed mock rows, and the `R-001` detail drawer opened.
- Browser console showed an existing app-startup `claimPlaceholderProfile` Edge Function non-2xx error on reload; this was not introduced by the Safety Hub page.
- `npm run lint` still fails on existing unrelated lint issues across older `modules/*`, older admin/coaching files, Supabase function code, and `tailwind.config.ts`.

What Aaron should test next:

- Open `/admin/safety-risk`.
- Check each tab: Dashboard, Risk Register, Actions, QI Register, Bright Ideas, Matrix & Guidance, and Audit History.
- Open a few rows and confirm the right-side detail drawer feels easier than a wide spreadsheet.
- Check the risk table filters and search.
- Confirm the sidebar/admin menu label now says `Safety Hub`.

Risk level:

- Low. UI prototype only.
- No database migration, no RLS/auth change, no Edge Function change, no live data write, and no deployment action.

### Previous handoff entry

Date: 2026-07-07

What changed:

- Added first real SportStack integration surfaces for the Lovable-origin modules:
  - `/admin/safety-risk`
  - `/admin/umpire-voting`
  - `/coaching/trace`
- Safety/Risk merges Hockey Risk Guard and Hockey Safety Hub into one admin module.
- Safety/Risk uses the existing live `rg_*` table shape rather than importing duplicate Lovable auth/layout/schema.
- Umpire Voting removes Ballarat branding and uses the current SportStack umpire vote path: `player_vote_submissions` and `player_vote_lines`.
- Umpire Voting adds admin review, approval/reopen actions, scoped filters, and a leaderboard.
- Hockey Trace Lab is explicitly experimental and in-memory only. It supports CSV upload, demo replay, pitch path display, basic event detection, confidence filtering, and session stats.
- Added a local draft migration for module feature flags and future Hockey Trace persistence.
- The draft migration is additive only and does not create duplicate fixture, team, round, division, club, association, venue, or pitch tables.
- No live migration was applied.
- No Edge Function was deployed.
- No destructive database action was taken.

Files changed:

- `src/App.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/lib/tracePlayback.ts`
- `src/pages/admin/SafetyRiskModule.tsx`
- `src/pages/admin/UmpireVotingModule.tsx`
- `src/pages/coaching/HockeyTraceLab.tsx`
- `supabase/migrations/20260707120000_sportstack_modules_integration.sql`
- `docs/current-state.md`

Checks run:

- Read-only live Supabase schema check confirmed existing SportStack `fixtures`, `teams`, `divisions`, `clubs`, `associations`, `venues`, `pitches`, `rg_*`, and umpire/player-vote tables.
- `npx tsc --noEmit` passed.
- Focused ESLint passed for the touched files.
- `npm run build` passed.
- Local HTTP route checks returned `200` for `/admin/safety-risk`, `/admin/umpire-voting`, and `/coaching/trace`.
- Browser visual verification through the in-app browser timed out before returning page state.
- `npm run lint` still fails on existing unrelated lint issues across old `modules/*`, older admin/coaching files, `src/pages/umpire/UmpireVoteSubmit.tsx`, Supabase function code, and `tailwind.config.ts`.

What Aaron should test next:

- Open `/admin/safety-risk` and check the Register, Actions, QI, Matrix, and Audit tabs.
- Add one low-risk test risk only if you are happy to write to live `rg_risk_register`.
- Open `/admin/umpire-voting`, filter by association/division, and check the review queue and leaderboard.
- Do not approve or reopen real umpire submissions until you choose a safe test record.
- Open `/coaching/trace`, upload a small CSV or use the demo replay, and check whether the pitch replay concept feels right.

Risk level:

- Medium. App-code changes plus one local draft migration.
- The migration has not been applied and needs a Supabase RLS/security review before live use.

### Previous handoff entry

Date: 2026-07-07

What changed:

- Refined the protected module preview route at `/admin/module-preview`.
- Removed Field Hockey Ace from the preview because the current SportStack formation/line-up work is already further along.
- Added/expanded SportStack-style mock previews for the four current local modules:
  - Hockey Risk Guard
  - Hockey Safety Hub
  - Ballarat Umpire Hub
  - Hockey Trace Playback
- Hockey Risk Guard now shows a denser risk register, action/QI board, and admin metrics.
- Hockey Safety Hub now shows a simpler safety snapshot and fast-edit register.
- Ballarat Umpire Hub now shows an umpire vote flow plus admin leaderboard/review surface.
- Hockey Trace Playback now shows session upload, GPS/motion/heart-rate intake, pitch replay, sensor event detection, and confidence indicators.
- All preview data is mock data only.
- No database migration was added.
- No live Supabase or deployment action was taken.

Files changed:

- `src/pages/admin/ModuleLayoutPreview.tsx`
- `docs/current-state.md`

Checks run:

- `npx tsc --noEmit` passed.
- `npm run build` passed.
- Browser check passed at `/admin/module-preview`; all four tabs loaded and no horizontal page overflow was detected.
- `npx eslint src/App.tsx src/pages/admin/ModuleLayoutPreview.tsx` passed.
- `npm run lint` still fails on existing unrelated lint issues across older app files and local module folders, including the newly added `modules/Ballarat Umpire Hub` source.

What Aaron should test next:

- Open `/admin/module-preview`.
- Click Risk Guard, Safety Hub, Umpire Hub, and Trace Playback.
- Check which module feels closest to the eventual real SportStack workflow.
- For Hockey Trace Playback, focus on whether the replay map, event list, and upload cards feel like the right early direction.

Risk level:

- Low. Local UI preview only.
- No schema migration is included.

### Previous handoff entry

Date: 2026-07-06

What changed:

- Added a protected admin preview route for the Lovable-origin modules in `modules/`.
- The preview is available at `/admin/module-preview`.
- It uses mock data only and does not import the modules' separate Supabase clients, auth flows, or migrations.
- The page shows preliminary SportStack-style layout previews for:
  - Field Hockey Ace
  - Hockey Risk Guard
  - Hockey Safety Hub
- No database migration was added.
- No live Supabase or deployment action was taken.

Files changed:

- `src/App.tsx`
- `src/pages/admin/ModuleLayoutPreview.tsx`
- `docs/current-state.md`

Checks run:

- `npx tsc --noEmit` passed.
- `npm run build` passed.
- Browser check passed at `/admin/module-preview`; tabs loaded and the preview no longer had horizontal page overflow.
- `npx eslint src/App.tsx src/pages/admin/ModuleLayoutPreview.tsx` passed.
- `npm run lint` still fails on existing unrelated lint issues across older `modules/*`, older admin/coaching files, Supabase function code, and `tailwind.config.ts`.

What Aaron should test next:

- Open `/admin/module-preview`.
- Click the Risk Guard, Safety Hub, and Field Ace tabs.
- Check whether the Risk Guard dashboard/table layout or Field Ace pitch/preference idea is closest to what you want brought into the real SportStack app.

Risk level:

- Low. Local UI preview only.
- No schema migration is included.

### Previous handoff entry

Date: 2026-07-06

What changed:

- Scrape backup workflow output was moved away from Git commits and into Supabase Storage.
- Added a helper script that uploads `.csv`, `.json`, and `.txt` scraper backup files to a private Supabase Storage bucket named `scrape-backups`.
- The helper creates the bucket if it does not already exist.
- The five scrape workflows now use read-only repository permissions and upload backup files after each scrape instead of running `git add`, `git commit`, and `git push`.
- This should stop scheduled scrape output from repeatedly moving `main` ahead of `dev`.
- No app UI code was changed.
- No database migration was added.

Files changed:

- `.github/workflows/player-history.yml`
- `.github/workflows/player-registry.yml`
- `.github/workflows/scrape-hb.yml`
- `.github/workflows/scrape-sunraysia.yml`
- `.github/workflows/scrape-wha.yml`
- `scripts/upload_scrape_backups_to_storage.py`
- `docs/current-state.md`

Checks run:

- `python -m py_compile scripts/upload_scrape_backups_to_storage.py` passed.
- Searched workflows and confirmed the scrape workflows no longer contain `git add`, `git commit`, `git push`, or `contents: write`.

What Aaron should test next:

- After this is pushed, manually run one small scraper workflow from GitHub Actions.
- Confirm the workflow uploads files into Supabase Storage bucket `scrape-backups`.
- Confirm the workflow does not create a new `scrape(...)` commit on `main`.

Risk level:

- Medium. This changes GitHub Actions behaviour and will create/use a private Supabase Storage bucket during the next scraper run.
- No schema migration is included.

### Previous handoff entry

Date: 2026-07-05

What changed:

- Local MVP voting admin follow-up fixes were added but not deployed live yet.
- Pending voters now have a per-person "Resend" button in the Voter Status table.
- The per-person resend calls `mvp-voting-email-reminders` with `session_id` and `profile_id`; the Edge Function still checks server-side that the profile is eligible and has not voted.
- Submitted voters now show a clearer "Withdraw" action. It uses the existing vote-withdraw flow: delete that voter's vote rows, delete their submission row, and write an `mvp_vote_audit` entry.
- The Edge Function now throttles email sends and retries Resend `429` rate-limit responses before recording a failure.
- No database migration was added for these fixes.
- No live Edge Function redeploy or Vercel deploy has been done for these local fixes yet.

Files changed:

- `src/pages/admin/MvpVotingAdmin.tsx`
- `supabase/functions/mvp-voting-email-reminders/index.ts`
- `docs/current-state.md`

Checks run:

- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `npx eslint supabase/functions/mvp-voting-email-reminders/index.ts` passed.
- `npx eslint src/pages/admin/MvpVotingAdmin.tsx` still fails on pre-existing `no-explicit-any` issues and one pre-existing hook dependency warning in that file.

What Aaron should test next:

- After deploy, open `/admin/mvp-voting`, open one session, and confirm pending voters show a per-person "Resend" button.
- Click one pending voter's "Resend" button and confirm only one email event is created for that profile.
- Confirm submitted voters show "Withdraw", then withdraw one known test vote and confirm that voter moves back to pending.

Risk level:

- Medium. This changes live email send behaviour once the Edge Function is redeployed and changes the admin UI once the app is deployed.
- No schema migration is included.

### Previous handoff entry

Date: 2026-07-05

What changed:

- Live Supabase Step 1 for MVP voting email reminders was completed.
- Deployed the `mvp-voting-email-reminders` Edge Function to project `svierarfcolhcfjpmwck`; it is active with `verify_jwt = false` because the function performs its own admin/cron authentication.
- Applied the live migration recorded by Supabase as `20260705091329_mvp_voting_email_reminders`.
- Live now has `public.mvp_voting_email_events`, RLS enabled, the scheduled-event duplicate-protection index, `pg_cron`, `pg_net`, `supabase_vault`, and an active cron job named `mvp-voting-email-reminders` running every 15 minutes.
- Verification after deployment showed `mvp_voting_email_events` had 0 rows, so no reminder email events had been recorded by the setup step.
- The Vault secret `mvp_reminder_cron_secret` was not present after Step 1.
- The local Supabase CLI account returned 403 for listing Functions and Secrets, so Edge Function secrets still need to be set or verified from a Supabase account with enough project privileges.

Files changed:

- `docs/current-state.md`

Checks run:

- Live Supabase migration list confirmed the migration is recorded.
- Live Supabase Edge Function list confirmed `mvp-voting-email-reminders` is active.
- Live SQL confirmed the email events table, cron/net/vault extensions, and active cron job exist.
- Live SQL confirmed the email events table had 0 rows immediately after setup.

What Aaron should test next:

- Do not click "Resend to Non-Voters" yet.
- Set or verify the remaining live secrets first: `RESEND_API_KEY`, `MVP_REMINDER_FROM_EMAIL`, `SPORTSTACK_APP_URL`, `SPORTSTACK_CRON_SECRET`, and matching Vault secret `mvp_reminder_cron_secret`.
- After secrets are confirmed, test on one small known MVP voting session before relying on scheduled reminders.

Risk level:

- Medium-high until secrets are configured and a small live send is tested.
- Cron is active, but it should fail closed until the cron secret matches and Resend secrets are present.

### Previous handoff entry

Date: 2026-07-05

What changed:

- Local branch `feat/mvp-voting-email-reminders` adds the MVP voting email reminder backend pieces.
- Added a new Supabase Edge Function `mvp-voting-email-reminders`.
- The function can send:
  - an opening email when a voting session is open,
  - a 3-day reminder at 6:00pm Australia/Melbourne time based on `closes_at`,
  - a 24-hour reminder based on `closes_at`,
  - a manual resend to non-voters from the admin detail screen.
- Reminder recipients are the current login-based eligible voter set: attended `revsports_players` rows with linked `profile_id`, excluding submitted voters in `mvp_vote_submissions`.
- Added a local migration for `mvp_voting_email_events` tracking plus a Supabase Cron job that calls the Edge Function every 15 minutes.
- The admin MVP Voting "Resend to Non-Voters" button now calls the Edge Function instead of showing the old mock message.
- Review follow-up: scheduled emails now claim a `sending` row before calling Resend, so repeated or overlapping cron runs cannot send the same opening/3-day/24-hour email twice.
- Review follow-up: the 3-day reminder no longer skips itself when it is close to the opening email; it remains 3 calendar days before `closes_at` at 6:00pm Australia/Melbourne time.
- Review follow-up: the RLS policy avoids enum-name drift by checking `ur.role::text = 'ASSOCIATION_ADMIN'`.

Files changed:

- `src/pages/admin/MvpVotingAdmin.tsx`
- `supabase/config.toml`
- `supabase/functions/mvp-voting-email-reminders/index.ts`
- `supabase/migrations/20260705174040_mvp_voting_email_reminders.sql`
- `docs/current-state.md`

Checks run:

- `npx tsc --noEmit` passed.
- `npm run build` passed.
- Review follow-up checks: `npx tsc --noEmit` passed again and `npm run build` passed again.
- `npx eslint src/pages/admin/MvpVotingAdmin.tsx` still fails on existing `no-explicit-any` errors and one existing hook-dependency warning in that file.
- `deno check supabase/functions/mvp-voting-email-reminders/index.ts` could not run because Deno is not installed locally.

What Aaron should test next:

- Do not test live email sending until the Edge Function is deployed, the migration is applied, and the required secrets are set.
- After live setup, open `/admin/mvp-voting`, open an `OPEN` session, and use "Resend to Non-Voters" on a small known session first.
- Confirm the toast says how many emails were sent, skipped, and failed.

Risk level:

- High until live setup is reviewed. This includes a database migration, Supabase Cron, an Edge Function, and outbound email through Resend.
- No live Supabase migration, Edge Function deploy, Cron activation, or secret changes have been applied by this local coding pass.

Required live setup before release:

- Set Edge Function secrets: `RESEND_API_KEY`, `MVP_REMINDER_FROM_EMAIL`, `SPORTSTACK_APP_URL`, and `SPORTSTACK_CRON_SECRET`.
- Add the matching Supabase Vault secret named `mvp_reminder_cron_secret`.
- Apply the migration and deploy the Edge Function only after a final review.

### Previous handoff entry

Date: 2026-07-05

What changed:

- Formation Library remains the front door for saved formations, templates, and assets.
- `/coaching/formations` now opens the Formation Library; `/coaching/formations/builder` keeps the existing Formation Builder workbench.
- `/coaching/formations/templates/builder` opens the new Template Builder for reusable surface/template setup.
- Library cards show surface previews, position counts, owner level, default/hidden badges, search, owner/status filters, and tabs for Formations, Templates, and Assets.
- Builder links now support opening a selected formation from the library.
- Formation Builder's left mini-library panel was removed and replaced with a Canvas tools panel focused on position placement.
- Builder library-management controls were removed from the Builder: show hidden, favourite, hide/unhide, delete, and formation switching.
- Builder technical template controls were removed from the visible canvas area: surface image upload, rows, columns, and boundary sliders.
- Canvas tools now include read-only template summary, add-position fields, empty-template quick-pick messaging, show-grid toggle, snap-to-grid toggle, and front-end-only marker size.
- Position markers can be selected from the canvas or the positions list, dragged on the canvas, and highlighted while selected.
- Builder now warns about unsaved changes before leaving, creating a new formation, or changing template.
- Shared surface canvas behaviour now supports rotation, zoom in, zoom out, fit, reset, click placement, and drag placement.
- Template Builder includes template/surface controls, surface image selection/upload, grid and boundary settings, marker-size default, and a quick-pick placeholder where backend support is still missing.
- Library now combines surface images and icons under an Assets tab with front-end filters.
- Builder and Template Builder now save local front-end drafts so unsaved work can be restored after a window/tab refresh.
- Canvas zoom now keeps the canvas container stable and zooms the surface inside the scrollable viewport.
- Formation saves now keep copied surface/grid/boundary settings on the formation and clear the template link when the column is available, so later template changes do not alter saved formations.
- Formation and Template Builder toolbars show a saved timestamp after a successful save.
- Formation Library Assets now has separate type filters and ownership filters, including a Symbols placeholder.
- Formation Library now includes an Add asset dialog with type selection, upload preview, and icon/symbol focus controls as a front-end placeholder.
- Formation and template cards now show Delete buttons with confirmation, but real live deletion is blocked until backend usage checks are added.
- Template Builder now supports front-end local quick-pick position tiles that Formation Builder can load for the selected template.
- Formation Builder's positions list is more compact and no longer shows grid/percentage coordinates.
- Tidy-up pass: rotated canvas markers keep normal orientation, canvas zoom no longer leaves a large empty viewport at zoomed-out sizes, asset cards now show Delete, and Template Builder quick-pick inputs start blank.
- MVP vote casting page now shows a scoreboard-style match header with team logos/banners, score, round, time, pitch/venue, and date, and the duplicated "Round Round" label was removed from the visible page.
- MVP vote scoreboard now loads fixture score/date first, then team branding, venue, and pitch separately so one missing relationship does not blank the whole banner.
- MVP vote scoreboard now has a stronger sports-graphic layout, missing-score `VS` fallback, clickable score panels, and a goal-scorer dialog.
- Goal-scorer detail uses existing imported player goal counts when available. Timed goal events are not available yet, so scorer minutes remain future backend/import work.
- MVP vote scoreboard polish pass removed the visible duplicate division label, uses association context in the top pill when available, adds a clickable-score hint, and tightens team logo/name spacing.
- Backend migration `20260705044608_add_team_logo_url` added `teams.logo_url` for team-specific scoreboard logos and was applied to live Supabase.
- Admin Teams management now includes a team logo URL field, preview, and table thumbnail so team logos can be set without touching schema again.
- App version bumped to `v2026.07.05.0051`.

Files changed:

- `src/App.tsx`
- `src/components/formation/SurfaceCanvas.tsx`
- `src/lib/formationLocalState.ts`
- `src/pages/coaching/FormationLibrary.tsx`
- `src/pages/coaching/FormationBuilder.tsx`
- `src/pages/coaching/TemplateBuilder.tsx`
- `src/components/lineup/HockeyPitch.tsx`
- `src/pages/MvpVoteCast.tsx`
- `src/pages/admin/TeamsManagement.tsx`
- `src/lib/appVersion.ts`
- `supabase/migrations/20260705044608_add_team_logo_url.sql`
- `docs/current-state.md`

Checks run:

- `npx tsc --noEmit` passed.
- Focused ESLint passed with existing React hook dependency warnings only.
- `npm run build` passed.
- `npm run lint` was run and still fails on existing unrelated lint errors across older `modules/*` and other untouched files.
- Browser smoke check passed: Library loaded with Add asset/Create template/Create formation, formation cards showed Open/Delete, Assets showed separate Asset type and Ownership filters plus Symbols, Add asset opened the preview dialog, Formation Builder opened with Canvas tools and no mini-library controls, compact positions no longer showed grid coordinates, and Template Builder showed the quick-pick section. Tidy-up pass also passed TypeScript and focused ESLint before build.

What Aaron should test next:

- Open `/coaching/formations`.
- Check the Formation Library tabs: Formations, Templates, Assets.
- Open a template into Template Builder, add a quick-pick position, save, then create/open a formation from that template and confirm the quick-pick appears in Canvas tools.
- Search for a formation and open it into the builder.
- Confirm the Builder left panel says Canvas tools, not Library.
- Confirm there is no show hidden, favourite, hide, delete, formation-switching list, surface upload, row/column input, or boundary slider in the Builder.
- Add a custom position, place it on the surface, drag it, select it from the marker and compact positions list, then save and reopen the formation if you are happy to change that saved formation.
- Make an unsaved edit, switch away long enough for the app/browser to refresh, and confirm the draft restores when you return.

Risk level:

- Medium. App-code only. No database migration, no generated Supabase type edits, and no real Library delete operation added.

## How to update this file

When Codex finishes a task, add a dated entry with:

- What changed
- Files changed
- Checks run
- What Aaron should test next
- Risk level
- Any unknowns that still need confirmation

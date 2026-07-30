# SportStack Current State

Last updated: 2026-07-30

This file is the short, current project status for ChatGPT, Codex, and Aaron.

Update this file after every meaningful Codex task, pull request, schema change, deployment, or confirmed live-data check. If this file conflicts with older handoff documents, this file wins unless Aaron says otherwise.

## Voting terminology

- **Player MVP Voting** is the player-to-player module. **Player MVP** is its short UI label. Suggested future namespace: `player_mvp`.
- **Umpire Match Voting** is the official completed-fixture workflow in which assigned or authorised umpires submit votes for eligible people associated with the fixture. **Umpire Votes** is its short UI label. Suggested future namespace: `umpire_match_votes`.
- They are separate modules with separate audiences, permissions, workflows, submissions, and results. Avoid generic "Voting", "Votes", "the voting module", and "the MVP module" wording when it could mean either.
- Current Player MVP Voting uses `mvp_*`. Current active Umpire Match Voting uses the historically misleading `player_vote_*` family, including `player_vote_submissions`, `player_vote_lines`, and `player_vote_edits`.
- Older or exported `vote_submissions`, `vote_lines`, and `vote_edits` identifiers belong to Umpire Match Voting. These exact unprefixed names are not present in the current repository code or generated Supabase types; this snapshot-specific absence must not be read as meaning they never existed.
- The separate `umpire_vote_*` generated types describe an umpire-related or umpire-rating schema. Its current product purpose remains **UNKNOWN — needs confirmation**.
- Current Umpire Match Voting fields and schema names are player-specific in places. That is an implementation or legacy naming limitation, not a restriction of the product definition to players.
- Dated entries below preserve historical UI labels such as "MVP Votes", "Voting Sessions", "Umpire Voting", and "Vote Submissions". Read those labels using the canonical module mapping above.

## Source of truth order

1. `AGENTS.md`
2. `docs/current-state.md`
3. `CODEX_HANDOFF.md`
4. `docs/project-brief.md`
5. `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md`
6. `PROJECT_SCOPE_UI_UX_AND_IMPLEMENTATION_PLAN.md`
7. Latest pull requests and commits
8. Live Supabase checks

## Current priority

SportStack and its supporting processes are Aaron's primary focus, representing approximately 90%
of planned work. Keep effort on the existing SportStack web app, its data/import reliability,
deployment path and the daily dashboard, availability and communications owner-test cycle.

Near-term priority areas:

- Primary-team player dashboard and availability reliability
- Team lobby plus club and association broadcasts
- Player MVP Voting flow reliability
- Admin data quality and import flows
- RevSports scraper/import alignment
- Team, club, association, division, venue, fixture, and player management
- Safe, clear admin workflows

## Current stack

SportStack is a React + TypeScript + Vite single-page app using Tailwind CSS, shadcn/ui, React Router, Supabase, and Vercel.

The backend is Supabase: Postgres, Auth, Storage, Row Level Security, and Edge Functions. RevSports data is scraped by Python scripts and GitHub Actions, staged into `revsports_*` tables, mapped, then imported into live app tables.

## Confirmed deployment environments

| Stage | Git branch | Public address | Supabase project |
|---|---|---|---|
| Development | `dev` | `https://dev.sportstackapp.com.au` | SportStack Dev `icqegnpjbizccjebjfhb` |
| Main/staging | `main` | `https://main.sportstackapp.com.au` | SportStack Dev `icqegnpjbizccjebjfhb` |
| Production | `prod` | `https://sportstack.grampianshockey.com.au` | SportStack Production `svierarfcolhcfjpmwck` |

- All three addresses are public and returned HTTP 200 on 22 July 2026.
- `dev` and `main` deliberately share the Dev database. Production is separate.
- `prod` is the Vercel Production Branch. `main` is a staging/preview branch and does not publish
  the production domain.
- Supabase Auth allows the custom Dev/main addresses in the Dev project and the production
  address in the Production project.
- `www.sportstackapp.com.au` was not changed and is not part of the current rollout.

## Confirmed operating rules

- App changes go to `dev` first, then `main` for staging, then `prod` after explicit production
  approval.
- Routine tested work, commits and pushes on `dev` and `main`, including intentional staging
  promotions, are owner-pre-approved. Verify branch divergence and the exact promotion set first.
- A push to `prod` triggers the public Vercel production deployment.
- Workflow files are a special case: scheduled GitHub Actions run from the default `main` branch
  and select Dev or Production using different secret names. Confirm the target before changing
  them.
- Treat Production data as real. Dev/main share one non-production database and can affect each
  other's test data.
- Do not expose `.env`, `.env.local`, Supabase service-role keys, private Player MVP Voting tokens, or other secrets.
- Non-destructive work on Development is pre-approved. Additive Dev-only migrations, RLS/Auth,
  Edge Function and role-enum work may proceed with live-schema verification, dry-run or rollback
  testing and documented results.
- Still confirm before destructive database work, secrets work, any `prod` promotion and every
  Production change. Force-pushes, history rewrites, branch deletion and check bypass remain
  separately restricted.
- GitHub API inspection on 29 July 2026 found no classic branch protection or repository rulesets
  on `dev`, `main` or `prod`. The production boundary is currently procedural until a reviewed
  remote `prod` protection policy is approved and applied.
- Bounded unattended work follows `docs/overnight-agent-plan.md`. Every run must recheck branch
  divergence and must not promote `dev` to `main` automatically.
- Use Australian English in user-facing text.
- Use `DD/MM/YYYY` dates and respect the association timezone where relevant.

## Recently changed

The approved Production compatibility release completed on 29 July 2026. Local and remote `dev`,
`main` and `prod` were confirmed aligned at `53561de` before the 30 July Dev-only scraper-routine
work began.

Known recent themes:

- Production now contains the released communications, availability, profile, Player MVP Voting,
  Umpire Match Voting and Safety Hub read-only compatibility package.
- Player MVP reminder and SportStack notification Edge Functions and schedules are active.
- Production scraper backups still need a guarded retention pass; no Production object has been
  deleted during the 30 July audit.
- The repository-wide lint backlog remains separate from focused changed-file checks.

## Known broken / uncertain

Treat these as current caution areas unless a newer live check proves otherwise:

- Older handoff docs may be stale in places.
- Player MVP Voting is built and live. Older dated notes that describe mock email buttons or manual
  session opening are historical and must not override the current release record.
- Player MVP reminder calls are deployed and scheduled; email delivery should still be monitored
  through normal logs and owner testing.
- Fixture `division_id` / `season_id` reliability needs confirmation before joining fixtures directly to divisions.
- Live Supabase schema can drift from migration files, so verify live schema before database-dependent work.
- Edge Functions in the repo and deployed Edge Functions may be out of sync.
- Supabase Storage Size is an organisation-wide GB-hour average. Check per-project object totals
  before assuming a dashboard warning reflects the current live byte count.
- There is no formal automated browser suite yet. Focused Python tests cover scraper and Storage
  safety tooling.

## Current Codex handoff template

After each Codex task, update this section or append a dated entry below.

### Latest handoff entry

Date: 2026-07-30

What changed:

- Added a SportStack public Hockey Ballarat Umpire Portal landing at `/umpire` and a three-step
  public flow at `/umpire/public-vote`: Match Info, Player Votes and Confirm.
- The Umpire Portal landing offers **Umpire Login without account** for the editable public flow
  and **Login with account** for normal SportStack authentication followed by the same public flow.
- Account sign-in returns to `/umpire/public-vote?account=1`, fills the submitter name and email
  from the SportStack account and makes both fields read-only. It does not enter the protected app.
- Safe internal return paths survive email/password and Google login. Existing placeholder-claim
  checking still runs on sign-in.
- The Match Info step records the public submitter's name/email and supports either self-submission
  or submission on behalf of another umpire with a required reason.
- The player search combines 448 current Hockey Ballarat SportStack profiles with distinct names
  from pending, non-deleted Umpire Match Voting submissions. Pending spellings stop being offered
  after the corresponding submission is approved, while new free-text names remain allowed.
- Player name or number is required, not both. Number-only entries show a warning that the number
  may not identify the player reliably.
- The public round selector shows each round's earliest and latest fixture dates in Australian
  `DD/MM/YYYY` format so umpires can identify the correct round more easily.
- The public player picker opens after the first typed character with no separate search button.
  Suggestions show the player's name and primary club/team only; manual or unresolved names use
  the short `Needs admin review.` message.
- Junior fixtures use the four-line 2/1 male and 2/1 female ballot. Senior and Masters fixtures use
  the 3/2/1 ballot. The server derives the scheme and points instead of trusting browser values.
- Applied the additive `public_umpire_portal` migration to SportStack Dev only. It adds public
  submitter/reference/idempotency fields, vote scheme line keys, hashed rate-limit events and a
  service-role-only atomic insert function.
- Deployed Dev `public-umpire-match-voting` version 2 with JWT gateway verification off because it
  performs its own origin, fixture, association, Turnstile, rate-limit and payload checks. Official
  Cloudflare test keys are limited to local, Dev and main/staging; Production fails closed without
  separately approved real configuration.
- Updated Umpire Match Voting administration to label public portal submissions and show the
  public reference, submitter email and unverified identity status.
- Production, `prod`, DNS and `sportstackapp.com.au` remain unchanged.
- A live audit found the intended voter-default migration was not installed and both current
  `handle_new_user()` functions created only profiles. A forward-only Dev migration restores one
  unscoped `VOTER` role for future accounts without backfilling existing users. Deliberate active
  team assignment can still add the separate `PLAYER` role.

Checks run:

- Dev live-schema audit and transaction rollback dry-run passed before the migration was applied.
- Dev recorded additive migration `20260730124436_restore_default_voter_role`. Post-apply checks
  confirmed the fixed search path and that browser roles cannot execute `handle_new_user()`.
- A rollback-only functional sign-up test created a profile and exactly one unscoped `VOTER` role,
  with no `PLAYER` role. The test transaction was rolled back and left no test account or role.
- A read-only Production audit found the voter default is not yet enforced there. Production was
  not changed; enabling it remains a separate explicitly approved release step.
- Supabase advisors reported no new finding tied to `handle_new_user()`; the existing unrelated
  security and performance advisory backlog remains.
- Dev `/umpire` returned HTTP 200 after deployment. Its deployed bundle contains both new login
  labels and the SportStack Dev Supabase project reference, with no Production project reference.
- The corrected account path, encoded login return URL and account-mode public form all returned
  HTTP 200 on Dev. The deployed bundle contains the public account route and locked-identity copy.
- Dev function checks returned 168 eligible Hockey Ballarat fixtures, the expected Junior ballot,
  448 association profiles and 16 distinct unresolved pending name spellings for the sampled flow.
- Anonymous and authenticated roles cannot execute the atomic insert function or access the
  rate-limit table; only `service_role` can execute the insert function.
- `npx tsc --noEmit`, focused changed-file ESLint and `npm run build` pass. Repository-wide lint
  still fails on the existing legacy backlog. The usual browser verification command is not
  installed on this Windows profile, so Aaron's visual Dev smoke test remains required.

What Aaron should test next:

- On Dev, open `/umpire` and confirm **Umpire Login without account** opens the public flow.
- Sign out, choose **Login with account**, sign in normally and confirm it lands on the public vote
  form with the account name and email filled and uneditable.
- Confirm Round -> Division -> Fixture, Junior and Senior vote cards, SportStack/Pending player
  suggestions, manual names, number-only warning, team selection and the final review screen.
- Submit one clearly marked test ballot, then review it in `/admin/umpire-voting` and approve it
  only after linking/correcting each player.

### Previous handoff entry

Date: 2026-07-29

What changed:

- Completed the approved Production compatibility gate before the Git `prod` promotion.
- Created and independently verified a restricted three-file Production logical backup: roles,
  schema and 46 MB of data. The database password was kept out of files, logs and the repository.
- Applied all 16 approved Production migrations in order. The guarded Umpire Match Voting backfill
  linked 250 of the 271 vote lines and produced the expected 492 audit records.
- Corrected the readiness note's stale schema names. Current source uses
  `profiles.theme_preference` and `app_feedback_attachments.storage_path`; it does not expect
  `profiles.account_theme` or `app_feedback.attachment_paths`.
- Deployed Production `mvp-voting-email-reminders` version 6 and the new
  `sportstack-notification-dispatch` version 1.
- Enabled the one-minute Player MVP reminder schedule and 15-minute SportStack notification
  dispatcher schedule. Their Vault credentials were verified by presence only and were not read.
- Kept `supabase/pending-migrations/lock_down_mvp_voting_access.sql` parked and excluded.
- This handoff entry accompanies the approved final fast-forward from `main` to `prod`.

Checks run:

- Production remained `ACTIVE_HEALTHY` on Postgres 17 throughout the database work.
- The fresh guarded preflight matched 271 vote lines, checksum
  `64e69e27af02befeae361a75c9046f6c`, one audit actor, seven existing edit rows and no duplicate
  non-empty profile RevSports IDs.
- All 16 migration history records exist. All expected tables, corrected columns and functions are
  present; all new public tables have RLS enabled.
- Anonymous execution is denied for the sensitive release functions. Service-only notification
  functions retain service-role-only execution; the signed-in admin functions retain their
  intended internal role checks.
- Unauthorised HTTP tests returned 401 for both deployed functions. Current Player MVP scheduled
  calls return 200 in Production logs.
- Supabase security and performance advisers were rerun. The wider old adviser backlog remains
  separate; newly created indexes correctly appear unused before normal Production traffic.
- The staging landing page loaded as SportStack and a signed-out `/dashboard` request redirected
  to `/login`. No signed-in staging session was available in Chrome.
- Before this release documentation commit, `origin/dev` and `origin/main` were aligned at
  `3f531a0`; `origin/prod` remained the direct ancestor at `426935d`, 44 commits behind.

What Aaron should test next:

- After the accompanying `prod` deployment is ready, sign into Production and check Dashboard,
  Communications, availability, Profile, Player MVP administration, Umpire Match Voting
  administration and the key admin pages.
- Confirm the Supabase usage warning separately before 22 August 2026; the organisation currently
  exceeds the Free-plan file-storage allowance.

Risk level:

- High. This release includes additive Production schema/RLS changes, a guarded data backfill, two
  Edge Function deployments, scheduled jobs and the approved public app deployment.
- Recovery uses the verified logical backup for a genuine database recovery event and a normal Git
  revert or Vercel redeploy for the app. Do not force-push Production history.

### Previous handoff entries

Date: 2026-07-29

What changed:

- Refreshed the current GitHub branch state and confirmed the release history remained linear:
  `prod` was an ancestor of `main`, and `main` was an ancestor of `dev`.
- Fast-forwarded local `dev` to current `origin/dev`, then promoted the complete approved Dev
  history to `main` without creating a merge commit or rewriting history.
- Local `dev`, local `main`, `origin/dev` and `origin/main` now all point to commit `142a730`.
- Reviewed the changed `Dev Supabase Scrapers` workflow before promotion. It uses only
  `DEV_SUPABASE_*` secrets, keeps the existing schedule and exposes Storage cleanup only as a
  manually selected action guarded by exact object count, byte count and plan SHA-256.
- Left `prod` at commit `426935d`. Production Supabase, Production Storage and the production
  website were not changed.

Checks run:

- `npx tsc --noEmit` passed.
- `npm run build` passed with the existing large-chunk warning.
- All 31 focused Storage diagnostic, retention and SQL migration-safety tests passed.
- Full `npm run lint` still reports the documented repository-wide baseline of 433 errors and
  89 warnings; no new lint work was included in this branch promotion.
- Git divergence verification returned `0 0` for `origin/dev...origin/main`.
- Vercel reported the Main deployment successful, and both the Dev and Main public addresses
  returned HTTP 200.

What Aaron should test next:

- Open `https://main.sportstackapp.com.au` and complete a short staging smoke test of the player
  dashboard, Communications, team switching, Profile and the main admin pages.
- Keep Production testing and promotion separate until the full 41-commit Production release is
  reviewed and explicitly approved.

Risk level:

- Medium. This promotes the accumulated Dev application, migration, Edge Function and Dev-only
  workflow source into staging. No migration or Edge Function was deployed by this task, and no
  Production resource was touched.

Date: 2026-07-29

What changed:

- Investigated the failed `Dev Supabase Scrapers` fixture import from GitHub Actions logs. The
  installed Player MVP Voting trigger function used invalid `pg_catalog.greatest(...)`, causing
  fixture upserts to fail with SQLSTATE `42883`.
- Added the forward-only migration
  `20260729010000_fix_mvp_initial_close_at_greatest.sql`; it replaces the invalid call with
  PostgreSQL's valid unqualified `greatest(...)` expression and preserves the hardened function
  privileges. The historical migration was not rewritten. The exact additive migration was
  transaction-rehearsed, applied to hosted SportStack Dev project `icqegnpjbizccjebjfhb`, verified
  in the installed function definition and recorded in Dev migration history.
- Manual Dev workflow run `30422373959` then completed successfully. Hockey Ballarat, Sunraysia and
  Wimmera all scraped, uploaded their backups and verified 534 fixture upserts. The complete run log
  contains no SQLSTATE `42883`, `pg_catalog.greatest` occurrence or Python traceback. One Player MVP
  session opened during the run and had a valid future close time tied to the next fixture.
- Added a manual Dev-only Storage metadata diagnostic to `dev-scrapers.yml`. It accepts only the
  canonical SportStack Dev Supabase URL, rejects redirects and every mutation endpoint, and omits
  individual object names and secret values from its report.
- A late independent review found that the first diagnostic version could follow a redirect with
  credential headers and could mistake an object with nullable metadata for a folder. Run
  `30372402203` was cancelled, follow-up commit `3a2afca` corrected both defects, and corrected run
  `30373160637` completed successfully.
- The corrected read-only run measured 791,008,706 bytes across 537 Dev Storage objects
  (0.736684 GiB). The `scrape-backups` bucket accounts for 785,438,860 bytes across 524 objects;
  Hockey Ballarat is 435,878,127 bytes, Sunraysia 330,456,412 bytes, Wimmera 15,439,496 bytes,
  player history 2,009,724 bytes and player registry 1,655,101 bytes. No object was deleted.
- Supabase documents Storage Size as an organisation-level GB-hours metric: effectively the
  billing-period average, with all projects shown by default. The screenshot's approximately
  1.18 GB therefore does not conflict with Dev's 0.791 GB live byte count; the remaining split
  between other projects and earlier usage is unconfirmed until dashboard authentication is
  available.
- Added a manual-only, Dev-only, read-only scrape-backup retention planner in verified commit
  `0d5c900`. It keeps every run from the latest seven days, one earliest run per source in each of
  days 8-14 and 15-21, and the earliest available run per source/calendar month thereafter.
  Non-canonical paths fail closed and are retained; public output contains aggregates and a plan
  digest but no object paths. That commit had no delete/apply capability.
- Retention dry-run `30424114628` succeeded against `scrape-backups`. It measured 815,903,576 bytes
  across 543 objects and 201 runs. The plan keeps 165,434,680 bytes across 113 objects and 47 runs,
  and identifies 650,468,896 bytes across 430 objects and 154 runs as deletion candidates
  (620.335 MiB, 79.72%). It safely retained all unparseable objects; the count was zero. No object
  was changed or deleted. Plan SHA-256:
  `4dc5d0cb73a77f05124a1cfa9267946ee4ca184da4b5b98835b0c1e7f6fdea7d`.
- Added the separate guarded Dev-only cleanup path in verified commit `5bde29c`. It is manual-only,
  uses only `DEV_*` secrets, fixes the exact Dev project and `scrape-backups` bucket, rejects
  redirects and malformed or duplicate inventory records, and permits one bulk DELETE attempt only
  after a fresh plan exactly matches the approved object count, bytes and SHA-256. It always performs
  post-delete inventory; an unverifiable outcome fails explicitly and must not be retried
  automatically. Workflow-wide concurrency prevents overlap with scraper uploads.
- Guarded apply run `30429657407` exactly matched the approved plan and completed successfully. It
  deleted 650,468,896 bytes across 430 objects and 154 runs. Built-in verification found zero
  approved deletion objects remaining and zero approved retained objects missing, leaving
  165,434,680 bytes across 113 objects and 47 runs.
- Independent read-only post-cleanup run `30429923749` confirmed the same 113 objects, 47 runs and
  165,434,680 bytes, with zero further deletion candidates and zero candidate bytes. The empty-plan
  SHA-256 is `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`.

Checks run:

- All 59 Python tests and Python compilation checks passed, including canonical target, redirect
  rejection, mutation-route rejection, recursive pagination, nullable-metadata object counting
  and output privacy regressions, strict timestamp grammar, unambiguous plan hashing, exact apply
  guards, malformed and duplicate inventory rejection, uncertain DELETE handling and post-delete
  retained/deleted-set verification.
- PostgreSQL 16 behavioural validation, workflow YAML parsing, `git diff --check`,
  `npx tsc --noEmit` and literal `bun run build` passed.
- Independent fail-closed reviews first identified and then verified fixes for lenient
  non-canonical timestamp parsing, slash normalisation and incomplete post-delete unknown-outcome
  handling. The final destructive implementation received PASS with no blocking security or logic
  concern before commit, push or execution.
- Full `bun run lint` remains at the known repository-wide baseline of 229 errors and 50 warnings;
  the incident changes did not attempt unrelated lint cleanup.

Deployment state:

- Incident-remediation commits and retention commits `0d5c900` and `5bde29c` are pushed to
  `origin/dev`.
- The additive SQL repair is applied and verified on hosted Dev only. Local Supabase CLI state is
  explicitly linked to Dev through the dedicated `sportstack-dev` profile; no blind migration push
  was used.
- The affected normal Dev fixture-import path has been rerun successfully and SQLSTATE `42883` no
  longer blocks fixture upserts.
- `main`, `prod`, Production Supabase, Production Storage and Production deployment remain
  untouched.

What Aaron should test next:

- Review apply run `30429657407` and independent inventory run `30429923749` in GitHub Actions.
- Confirm the Supabase Storage dashboard trends down after its organisation-level GB-hours window
  catches up. Keep cleanup manual; do not schedule destructive retention without a separate policy
  and approval.

Risk level:

- Medium. The additive database migration was applied to Dev and verified through a successful
  fixture-import rerun. The separately approved Dev Storage cleanup deleted only the exact reviewed
  430-object plan and independently verified all 113 retained objects remain. No database row,
  Production Storage object or other Production resource was changed.

Date: 2026-07-25

What changed:

- Removed the dashboard `Needs attention` strip because the notification bell is the single
  attention surface. Removed Player `Statistics` navigation and the duplicate Team dashboard
  shortcut that made the personal and entity dashboards look like two versions of the same page.
- Replaced sequential scope updates with one atomic Association -> Club -> Division -> Team
  update. Stale player-header requests are ignored, Lucas HC now remains selected, and parent
  entity routes no longer fight the active player team context.
- Added the player Division cascade button and `/divisions/:id`. The Division dashboard now shows
  full-division KPIs, ladder, upcoming fixtures and association updates using both direct team
  division links and the `team_divisions` mapping table.
- Made preferred-position panels smaller and sourced their choices from starting positions in
  team-owned formations. The coaching profile uses the same source. Primary, Secondary and
  Fill-in badges now use clearly different emerald, violet and amber colours.
- Added read-only RLS support for active Primary, Secondary and Permanent members to see their
  own team's formation position definitions. Existing administration and coaching write access
  is unchanged.

Checks run:

- Dev rollback-only RLS probes passed: Aaron could read temporary Lucas HC team positions, an
  unrelated Pumas player saw zero rows, and the temporary formation and position were rolled
  back. No test rows remain.
- Supabase security and performance advisers found no new member-policy warning after the read
  rule was consolidated into the existing scoped policy. The older wider adviser backlog remains
  separate.
- Focused ESLint passed with zero errors and one existing Fast Refresh warning.
- `npx tsc --noEmit` and `npm run build` passed. Full `npm run lint` still reports the known wider
  repository backlog of 433 errors and 89 warnings outside this change.
- Live Dev browser checks passed at desktop and 375-pixel mobile widths. Pumas remained the
  primary landing team, Lucas HC remained selected after switching, the Association header did
  not flicker, Division 1 showed its KPI/ladder data, there was no horizontal mobile overflow,
  and the browser console was clean.

Deployment state:

- Commit `c379329` was pushed to `origin/dev`, and Vercel reported the Dev deployment successful.
- The two additive RLS migrations are registered in SportStack Dev. No row data was changed or
  deleted. Generated TypeScript types did not change because these migrations contain policies
  only.
- `main`, `prod`, Production Auth and Production data remain untouched.

What Aaron should test next:

- In Dev Player mode, switch Pumas -> Lucas HC -> Pumas and confirm each selection remains stable.
- Open each team's Division button and check its KPIs, complete ladder and upcoming fixtures.
- Open Profile and check that the position sections are compact and the Primary/Secondary badges
  are easy to tell apart in light mode.
- Pumas and Lucas HC currently have no team-owned formation positions, so the empty messages are
  expected. Configure a team formation position when ready, then confirm only that team's options
  appear on the player and coaching profiles.

Risk level:

- Medium. This includes additive Dev RLS changes. No destructive database action or Production
  change was performed.

Date: 2026-07-24

What changed:

- Consolidated the 16 open owner-feedback items into one feature branch covering the daily
  dashboard, calendar availability, profile and coaching history, Player MVP history, entity
  dashboards, membership labels, theme persistence, chat clarity, feedback photos, build labels
  and Users-page performance.
- Changed the Users page to load a maximum of 50 profiles per server request, then fetch roles,
  memberships, invites and Auth email addresses only for the visible page.
- Added player navigation to their Team, Club and Association dashboards. Fill-ins can open only
  the fixture-scoped Team dashboard; parent entity dashboards remain unavailable to them.
- Added a larger themed entity banner, useful KPIs and official updates to Association, Club and
  Team dashboards using Association -> Club -> Team colour and image inheritance.
- Added team-specific player position preferences and team-specific coach assessments, plus
  linked RevSports match history on player and coaching profiles.
- Added a Player MVP `My history` view and excluded old sessions that have no team ownership.
- Added profile-completion attention and bell prompts, cross-team calendar markers, availability
  deselection, clearer chat composition, consistent Primary/Secondary/Fill-in badges and a visible
  Dev/Main/Production build label.
- Applied three additive migrations to SportStack Dev only. They add the saved account theme,
  team-scoped player position preferences, the missing feedback-photo table, private membership
  scope checks, tighter access policies and supporting indexes. No data was deleted or rewritten.
- Regenerated the Supabase TypeScript types from the confirmed Dev schema and removed the
  temporary migration-era type casts.

Checks run:

- Read-only Dev dry-run: 0 player position preferences need backfill; the one coach assessment is
  already team-scoped; three legacy feedback photos would be linked into the attachment table.
- Static PostgreSQL parsing passed for all three additive migrations.
- Dev rollback-only access tests passed for player position preferences, coach assessments,
  account theme changes and feedback attachments. Unrelated users and teams were denied, and all
  test rows rolled back successfully.
- The three existing feedback photos were preserved and linked. No player-position rows required
  backfill, and the existing coach assessment remained unchanged.
- Supabase security and performance advisers reported no relevant warning after the policy and
  index hardening. Four informational unused-index notices remain on new or lightly used tables.
- Focused ESLint, `npx tsc --noEmit` and `npm run build` passed.
- Full `npm run lint -- --quiet` still reports 451 known repository-wide legacy errors outside
  this change; the focused changed-file lint is clean.
- Signed-out desktop and 390-pixel mobile browser checks passed with no error overlay or horizontal
  overflow. Only the two existing React Router future-version warnings appeared.
- Live Dev currently gives Aaron the `PLAYER` and Pumas-scoped `COACH` roles. No role was changed.

Deployment state:

- SportStack Dev schema has the three approved migrations and regenerated local types.
- App commit `eb904e5` was pushed to `origin/dev`, and GitHub reported the Vercel deployment as
  successful.
- `https://dev.sportstackapp.com.au` returns HTTP 200 and its current bundle contains the new
  Needs attention, Player MVP My history and preferred-position features.
- `main`, `prod`, Production Auth and Production data remain untouched.

What Aaron should test next:

- Sign into Dev, switch to Player mode and confirm Pumas opens as the primary team.
- Check the combined dashboard banner, all-team calendar markers and the next two availability
  prompts; click the selected availability choice again and confirm it clears.
- Save different preferred positions for Pumas and Lucas HC, refresh and confirm both persist.
- Open Team, Club and Association dashboards and check the inherited banner and colours.
- Check Player MVP `Current` and `My history`, save the light/dark theme, then refresh.
- As an administrator, check the first and second 50-person Users pages and submit feedback with
  more than one photo.

Risk level:

- Medium. This includes additive Dev schema and RLS changes. No destructive database work was
  performed, and no test data was left behind.

Date: 2026-07-24

What changed:

- Added a durable registered-club field so PRIMARY means the player's registered club,
  SECONDARY means an ongoing team at another club, and FILL_IN remains fixture-specific.
- Added fixture-scoped fill-ins with team dashboard, Team Chat and published line-up access from
  selection until one hour after the calculated match end. Player MVP eligibility remains until
  that fixture's Player MVP Voting session closes.
- Added a separate **Find a fill-in** line-up action. It shows current selections, previous
  fill-ins and their games first, then lets an authorised coach or manager search real players.
- Fixed the team roster profile query so linked players show their names instead of
  `UNKNOWN PLAYER`, and badges now follow the registered-club meaning.
- Added a larger team dashboard banner and full app theme inheritance: Association default,
  Club override, then Team override.
- Applied the additive fill-in/theme migration to SportStack Dev, deployed version 3 of
  `mvp-voting-email-reminders`, regenerated Supabase types, and deployed Dev commit `1ff0785`.
- Left `main`, `prod`, Production Auth and Production data untouched.

Checks run:

- The migration and SQL assertions passed in a disposable local Supabase Postgres database.
- Live rollback-only RLS checks proved a current fill-in can read the correct Team Chat and
  line-up, an unrelated player cannot, expired access is removed, and Player MVP eligibility
  remains. Dev returned to zero fill-in rows and the real fixture was unchanged.
- The migration registered 684 unambiguous profiles. Three profiles with active PRIMARY teams
  across more than one club and 46 profiles without an active PRIMARY team were left unchanged.
- Supabase advisers found no new fill-in/theme security warning. Two new empty-table indexes are
  reported as unused, which is expected before the first fill-in is recorded; the wider adviser
  backlog remains separate.
- Focused ESLint passed with zero errors and nine existing warnings. `npx tsc --noEmit` and
  `npm run build` passed. Full lint still reports the known wider backlog of 467 errors and
  95 warnings.
- Vercel marked Dev commit `1ff0785` READY. Signed-out desktop and 390-pixel mobile checks had no
  console errors or horizontal overflow. The live bundle contains the fill-in and theme build,
  points to SportStack Dev Supabase and does not reference Production Supabase.

Risk level:

- Medium. This includes additive Dev schema, RLS and Edge Function changes. Production was not
  touched, and the live security checks left no test data behind.

Remaining follow-up:

- Aaron should complete the authenticated owner test on `dev.sportstackapp.com.au`, especially
  the Pumas default, roster names, fill-in finder, expiry behaviour and theme cascade.
- The data-quality clean-up items in `docs/data-quality-audit-2026-07-23.md` remain reporting
  only and need separate approval before repair.

Date: 2026-07-23

What changed:

- Built the primary-team daily dashboard with a compact combined team banner, attention strip,
  upcoming fixtures, inline availability, calendar, official updates and team activity.
- Rebuilt `/chat` as Communications with separate Team Chat, Club Updates and Association
  Updates, including replies, mentions, reactions, unread state, delegated publishing,
  moderation and soft-delete history.
- Added player-controlled availability/broadcast notification preferences and club/team
  reminder settings. Teams remain disabled until deliberately enabled.
- Added and applied four additive Dev migrations for communications, reminder processing,
  live availability-enum alignment, fixture association scope and adviser hardening.
- Deployed the `sportstack-notification-dispatch` Edge Function to SportStack Dev and scheduled
  it every 15 minutes. The manual endpoint check returned HTTP 200.
- Backfilled `team_memberships.activated_at` for 1,235 active Dev memberships. No fixture or
  player data was repaired, merged or deleted.
- Regenerated the Supabase TypeScript types from SportStack Dev.
- Cleared Aaron Mullane's stale Dev-only `banned_until = infinity` Auth flag, which was blocking
  Auth user loading, and successfully sent the requested password-reset email. His account still
  has only the PLAYER role, with Pumas primary and Lucas HC secondary.
- Left `main`, `prod`, Production Auth and Production data untouched.

Checks run:

- The complete migration set and SQL assertions passed in a disposable local Supabase Postgres
  database; the disposable container was removed afterwards.
- Live Dev RLS checks proved an active member can use their own team lobby and cannot read or
  insert into an unrelated team's lobby. The allowed insert test was rolled back.
- A second reminder claim returned no work, confirming duplicate prevention for the test state.
- Supabase security and performance advisers were run. New missing-index and duplicate-policy
  findings were cleared; the remaining adviser items are the existing wider-project backlog.
- Focused ESLint, `npx tsc --noEmit` and `npm run build` passed. Full `npm run lint` still reports
  the known wider backlog of 472 errors and 95 warnings outside this change.
- Vercel deployed Dev commit `670211b` successfully. The public Dev address returned HTTP 200,
  had no browser console errors, fit the mobile viewport without horizontal overflow and loaded
  a bundle that references the Dev Supabase project, not Production.
- The password-recovery endpoint returned HTTP 200 after the Dev Auth correction.

Risk level:

- Medium. This includes additive Dev schema, RLS, cron and Edge Function changes. All new tables
  have RLS and direct cross-team checks passed. Production was not touched.

Remaining follow-up:

- Complete the owner test on `dev.sportstackapp.com.au`, then record any faults through the
  existing feedback tool.
- The data-quality clean-up items in `docs/data-quality-audit-2026-07-23.md` remain reporting
  only and need separate approval before repair.

Date: 2026-07-22

What changed:

- Completed a full health check of Git, SportStack Dev Supabase, and the Dev/Main Vercel
  deployments.
- Committed the remaining source and handoff files from completed July work.
- Merged the independent `main` history into `dev`, then fast-forwarded `main` so both branches
  point to the same commit.
- Left `prod`, Production Supabase, and the production website untouched.
- Kept `supabase/pending-migrations/lock_down_mvp_voting_access.sql` parked; it was not moved into
  the active migration sequence or applied.

Checks run:

- `npx tsc --noEmit` passed.
- `npm run build` passed.
- All 28 placeholder-planner unit tests passed and its Python files compiled.
- `npm run lint` still reports the known repository-wide backlog: 486 errors and 95 warnings,
  mainly in older code and bundled modules.
- Both Dev and Main public addresses returned HTTP 200 and their Vercel deployments reached
  `READY`.
- SportStack Dev Supabase is `ACTIVE_HEALTHY`; the expected July migrations, functions, and
  Player MVP/Umpire identity fields are present.

Remaining follow-up:

- Local migration filenames and the Dev migration-history timestamps differ for several July
  migrations. Do not run a blind `supabase db push`; reconcile the history only after Aaron
  approves database administration work.
- Supabase advisors still report an existing security and performance backlog. Permission/RLS
  fixes need their own reviewed task and Aaron's approval before any schema change is applied.

Risk level:

- Low for Git and staging deployment alignment. No database migration, RLS/auth change, Edge
  Function deployment, Production database action, or `prod` push was performed.

Date: 2026-07-22

What changed:

- Added and verified Hostinger DNS for `dev.sportstackapp.com.au` and
  `main.sportstackapp.com.au`.
- Connected the Vercel branch aliases: `dev` to the Dev address, `main` to the Main address and
  `prod` to `sportstack.grampianshockey.com.au` as Production.
- Confirmed the Vercel Preview environment used by `dev` and `main` points to SportStack Dev
  Supabase, while Vercel Production points to the separate SportStack Production Supabase.
- Updated Supabase Auth Site URL and redirect allow lists for the three custom addresses and local
  development.
- Disabled Vercel Authentication for previews so Dev and Main are publicly accessible.
- Left `www.sportstackapp.com.au` unchanged.

Checks run:

- Public HTTP checks returned 200 for all three custom addresses.
- The deployed Dev and Main bundles reference Supabase project `icqegnpjbizccjebjfhb`.
- The deployed Production bundle references Supabase project `svierarfcolhcfjpmwck`.
- Current Dev, Main and Production deployments are `READY` in Vercel.

Risk level:

- Low for this documentation update. The live DNS, Vercel and Supabase Auth configuration was
  already completed and verified; no database schema or data change is included here.

Date: 2026-07-20

What changed:

- Replaced the Umpire Match Voting scope row with searchable multi-select
  filters for Association, Season, Club, Division, Team and Round.
- Added OR-within and AND-between filter matching so KPI tiles, round bars,
  fixture lists, submissions and leaderboard share the same granular scope.
- Added parent-to-child resets and fixture-driven option narrowing. Team stays
  disabled until a Division is selected.
- Added an explicit `Unassigned season` option for fixtures with no
  `season_id`; no season is inferred for those fixtures.
- Removed the Senior/Junior division-type filter.
- Kept Association, Club and Team options inside the signed-in admin's existing
  scope without changing RLS or permissions.
- No database, email, Player MVP Voting, Production or `main` change was made.

Files changed:

- `src/components/admin/AdminMultiSelectFilter.tsx`
- `src/pages/admin/UmpireVotingModule.tsx`
- `docs/current-state.md`

Checks run:

- Focused ESLint, `npx tsc --noEmit` and `npm run build` passed.
- Full `npm run lint` continues to report the existing 486 repository-wide
  errors outside these files.
- Automated browser interaction could not be completed because the local server
  was unavailable and the external Dev preview is protected by Vercel sign-in.
- Vercel confirmed the pushed Dev deployment reached `READY`.

Deployment state:

- Included in Dev commit `6e79779` and pushed to `origin/dev`.
- Vercel reports the Dev branch deployment as ready at
  `sportstack-git-dev-sportstackapps-projects.vercel.app`.
- Not promoted to `main` or Production.

Date: 2026-07-20

What changed:

- Corrected the Umpire Match Voting dashboard so its primary KPI tiles count
  eligible past fixtures rather than submission records.
- Added four mutually exclusive fixture measures: 451 past fixtures, 376
  missing votes, 73 pending approval and 2 approved in the current all-scope
  SportStack Dev snapshot.
- Added a scrollable fixture list from each primary tile and a round-filtered
  missing-fixture list from every round row.
- Kept the four active historical submissions without a fixture visible as a
  separate `Unlinked submissions` KPI instead of including them in the pending
  fixture total.
- Defined eligible past fixtures as non-bye fixtures whose scheduled start has
  passed, excluding cancelled and postponed fixtures. Each fixture is counted
  once.
- No database row, schema, migration, Player MVP Voting, email function or
  Production change was made.

Files changed:

- `src/pages/admin/UmpireVotingModule.tsx`
- `docs/current-state.md`

Checks run:

- Read-only Dev SQL confirmed the all-scope fixture split is exactly
  451 = 376 missing + 73 pending + 2 approved.
- `npx tsc --noEmit`, focused ESLint and `npm run build` passed.
- Desktop and mobile browser checks passed for the KPI totals, all-missing list,
  round-filtered missing list, dialog scrolling and page width. No browser
  console errors were recorded.
- Full `npm run lint -- --quiet` still reports the same 486 existing
  repository-wide errors outside this change.

Deployment state:

- Included in Dev commit `5893cce` and pushed to `origin/dev`.
- Vercel reports the Dev deployment as ready at
  `sportstack-git-dev-sportstackapps-projects.vercel.app`.
- Not promoted to `main` or Production.

Date: 2026-07-19

What changed:

- Added nullable Umpire Match Voting identity links from
  `player_vote_lines.profile_id` to `profiles.id` in SportStack Dev.
- Added one guarded admin review function that saves player, number and fixture
  team corrections with signed-in admin audit records. Approval is blocked
  while any active vote line is missing a linked profile or fixture team.
- Backfilled Dev with 250 profile links across 143 profiles and corrected 242
  historical names across 78 submissions. The import created 492 audit entries.
- Left 15 intentional skips and 6 manual-review lines unchanged.
- Added roster-first linked-player search and editable player, number and team
  fields to the Umpire Match Voting submission and admin review flows.
- Changed the Umpire Match Voting leaderboard to group by `profile_id`, with
  the legacy name/team/number key retained only as a fallback.
- Production, Player MVP Voting, email functions, vote points and existing
  submission statuses were not changed.

Files changed:

- `src/components/umpire/UmpireLinkedPlayerPicker.tsx`
- `src/lib/umpireLinkedPlayers.ts`
- `src/pages/umpire/UmpireVoteSubmit.tsx`
- `src/pages/admin/UmpireVotingModule.tsx`
- `src/integrations/supabase/types.ts`
- `supabase/migrations/20260719091405_add_umpire_vote_player_identity.sql`
- `supabase/migrations/20260719091412_backfill_umpire_vote_player_identity.sql`
- `supabase/migrations/20260719093832_fix_umpire_vote_review_search_path.sql`
- `docs/current-state.md`

Checks run:

- Dev backfill counts and duplicate-name identities were verified directly.
- Guarded save, approval, invalid-team and admin-scope database tests passed
  inside rolled-back transactions.
- Browser checks passed for linked search, full search, prefill, approval
  blocking, audit history, all-linked approval readiness and narrow-screen
  scrolling. No browser console errors were recorded.
- `npx tsc --noEmit` and `npm run build` passed.
- Focused lint passed for the new picker, linked-player helper and admin module.
  Full `npm run lint` still reports pre-existing repository-wide issues.

Deployment state:

- The three migrations are applied only to SportStack Dev.
- Local source changes are not committed, pushed or promoted to Production.

Date: 2026-07-18

What changed:

- Repaired the production placeholder-claim path so an approved email match can
  never be copied into `profiles.revsports_player_id`.
- Added row locks, conflicting-ID protection, one-active-claim safeguards and
  transfer support for all current Player MVP Voting profile references.
- Corrected the transfer order so the active-membership trigger cannot create a
  duplicate scoped Player role during a merge.
- Applied `fix_placeholder_claim_id_transfer` and
  `fix_placeholder_claim_role_transfer_order` to Dev and Production.
- Safely merged David Jochinke's approved placeholder into his existing Auth
  profile in Production. His RevSports ID `WQrnNSO`, active primary Pumas
  membership, Voter role, scoped Player role, RevSports link and existing
  Player MVP email event now belong to the real profile.
- Preserved the old placeholder as an empty archived record and retained the
  claim review and audit history. No email was sent by this repair.
- The local source changes, migrations and handoff update are not committed or
  pushed.

Files changed:

- `supabase/functions/send-profile-access-link/index.ts`
- `supabase/migrations/20260718081517_fix_placeholder_claim_flow.sql`
- `supabase/migrations/20260718082102_qualify_placeholder_claim_review_columns.sql`
- `supabase/migrations/20260718092223_fix_placeholder_claim_id_transfer.sql`
- `supabase/migrations/20260718092932_fix_placeholder_claim_role_transfer_order.sql`
- `docs/current-state.md`

Checks run:

- The first new migration passed a transaction-only syntax check before it was
  applied.
- The transfer-order follow-up migration passed its guarded replacement check
  before it was applied.
- A comprehensive Dev transaction tested email match values, ID transfer,
  team/role trigger behaviour, Player MVP references, duplicate email events,
  audit history, repeated calls and conflicting IDs; all synthetic records were
  rolled back.
- An exact Production simulation using David's two real profile IDs passed and
  was rolled back before the permanent merge.
- The permanent merge ran inside one guarded transaction and committed only
  after every expected transfer passed.
- A complete foreign-key scan confirmed the old placeholder is referenced only
  by the retained claim review and audit history.
- A repeated claim was safely rejected as `no_match` in a rolled-back
  transaction and did not alter David's real profile.
- The merge function has a fixed search path and can be executed by
  `service_role` only; Public, anonymous and authenticated roles cannot execute
  it.
- Both active-claim unique indexes and both Production migration-history rows
  were confirmed.
- Supabase security and performance advisers found no new blocking issue for
  the merge function. The service-only claim tables retain informational RLS and
  unindexed-foreign-key notices.
- A fresh Production browser reload showed one visible David Jochinke row with
  the active Pumas membership and Player and Voter roles. A second controlled
  reload produced no new console errors.
- Recent Edge Function activity showed successful responses. The older failed
  placeholder-claim responses remain in the 24-hour log and browser history.

What Aaron should test next:

- Refresh Production `/admin/users`.
- Confirm David Jochinke now shows RevSports ID `WQrnNSO`, Pumas, Player and
  Voter on the single visible real-account row.
- Select that row and send the access link. Because it is now an existing real
  account, the production flow should send a password-reset email.

Risk level:

- High because two schema migrations and one approved live profile merge were
  completed in Production.
- No profile, vote, email-history or audit record was deleted.
- No frontend deployment, commit or push was included.

### Previous handoff entry

Date: 2026-07-18

What changed:

- Applied the Safety Hub database integration migration to SportStack Dev and
  Production after both preflight checks passed.
- Added `rg_risk_settings`, `rg_bright_ideas` and `rg_record_links`.
- Expanded the existing Risk, BE SMART Action, QI, review, comment, matrix,
  guidance, dropdown and audit tables for the approved prototype workflows.
- Attached all 25 existing matrix cells to one provisional global settings
  profile. The matrix values remain provisional and are not recorded as
  approved.
- Replaced broad signed-in-user Safety Hub access with scoped RLS for Super
  Admin, Association Admin and Club Admin.
- Added immutable audit, review and comment controls and field-level audit
  triggers. Signed-in users have no hard-delete access to Safety Hub records and
  cannot insert directly into the audit table.
- Refreshed the generated Supabase TypeScript types from the Dev schema.
- Added one clearly labelled `[DEV TEST]` Bright Idea to QI to Risk to Action
  chain in Dev only, with four links, one overdue review and one audited control
  update.
- Connected the local Safety Hub dashboard, registers, associated-record
  summaries, matrix and audit history to scoped, read-only Supabase queries.
- Prototype forms remain local-only, use `Validate draft`, and do not write to
  Supabase.
- Added the missing Safety Hub navigation entry for Club Admin mode.
- Made Owner optional in Risk, Action and QI prototype validation. Registers,
  associated-record summaries and detail drawers now show the record owner and
  the separate database `created_by` person as `Added by`.
- Production remains empty across the Safety Hub Risk, Action, QI, Bright Idea,
  link and review tables.
- Dev recorded migration `20260718085105 safety_hub_database_integration`.
- Production recorded migration
  `20260718085414 safety_hub_database_integration`.

Files changed:

- `src/components/layout/AppLayout.tsx`
- `src/pages/admin/SafetyRiskModule.tsx`
- `src/integrations/supabase/types.ts`
- `supabase/migrations/20260718181341_safety_hub_database_integration.sql`
- `docs/safety-hub-database-integration-plan.md`
- `docs/current-state.md`

Checks run:

- Dev and Production preflight checks both confirmed zero unscoped Safety Hub
  records and zero unexpected Safety Hub policies.
- Post-migration checks passed in both environments: three new tables, all
  expected expanded columns, one global settings profile, 25 scoped matrix
  cells, RLS on all 12 Safety Hub tables and 32 scoped policies.
- Authenticated users cannot hard-delete Risks or Bright Ideas and cannot write
  directly to the audit table.
- The Dev seed was verified directly: one Risk, Action, QI item and Bright Idea,
  four links, one review and six seed-related audit rows.
- Browser checks passed for the Dev dashboard, linked Risk summaries, Bright
  Idea draft form, matrix colours and guidance, and the audit detail drawer.
- A new Risk draft validated successfully with no Owner, while `Added by`
  remained visible as the current signed-in user. The live Risk register and
  drawer showed `Added by Admin Sportstack`.
- A clean browser reload produced no new Safety Hub errors. The existing React
  Router future-flag warnings remain.
- Supabase security advisers reported no Safety Hub findings in either
  environment.
- Performance advisers reported non-blocking Safety Hub items: 22 unindexed
  foreign keys, 42 unused indexes on the empty schema and two duplicate indexes.
  No index was dropped because that requires separate approval.
- The migration SQL parsed successfully with `pglast`.
- Focused Safety Hub ESLint, `npx tsc --noEmit` and `npm run build` passed. The
  build retained the existing large-chunk warning.
- `npm run lint` still reports the existing repository total of 583 problems
  (488 errors and 95 warnings).

What Aaron should test next:

- Open `/admin/safety-risk` as Super Admin and confirm the `[DEV TEST]` records
  are visible when the scope is All accessible organisations or Grampians
  Hockey Club.
- Expand `R-001` and confirm the linked Action, QI item and Bright Idea appear.
- Confirm `Submit a Bright Idea` opens a form with `Validate draft`, not a save
  action.
- Switch to Club Admin mode and confirm Safety Hub now appears in the sidebar
  under Safety, then open it and confirm only that club's records are visible.
- Before form writes are enabled, complete the same read-only checks with a real
  Club Admin account so Supabase RLS is tested rather than only the local role
  switcher.

Risk level:

- Medium for this continuation. It adds Dev-only test records and a local
  read-only frontend connection.
- The previously approved Production schema and RLS migration remains the
  high-risk part of the wider package.
- No Production record data, frontend deployment, commit or push was included.

### Previous handoff entry

Date: 2026-07-18

What changed:

- Fixed the production placeholder access-link flow for existing accounts and newly invited accounts.
- The access-link Edge Function no longer copies a placeholder's unique RevSports ID before the approved claim merge.
- Replaced unsupported `min(uuid)` calls in `claim_placeholder_profile(uuid)` and qualified claim-review columns that conflicted with the function's output names.
- Applied `fix_placeholder_claim_flow` and `qualify_placeholder_claim_review_columns` to production.
- Deployed production `send-profile-access-link` version 5 with JWT verification still enabled.
- Kept direct RPC execution restricted to `service_role`; `anon` and `authenticated` cannot execute it.
- No production email was sent during verification.

Files changed:

- `supabase/functions/send-profile-access-link/index.ts`
- `supabase/migrations/20260718081517_fix_placeholder_claim_flow.sql`
- `supabase/migrations/20260718082102_qualify_placeholder_claim_review_columns.sql`
- `docs/current-state.md`

Checks run:

- `npx tsc --noEmit` passed.
- `npm run build` passed.
- Focused Edge Function ESLint passed.
- A full synthetic production claim passed inside a transaction and was rolled back, leaving no test user or data.
- Post-deployment verification confirmed both migrations, Edge Function version 5, corrected SQL, and unchanged execution restrictions.
- Supabase advisors reported no errors. Existing informational and warning notices remain outside this fix.
- Full-repository lint still reports 583 pre-existing unrelated problems.

What Aaron should test next:

- Refresh production `/admin/users` and resend the claim link that previously failed.
- Confirm the email arrives, then use the link and sign in to complete the placeholder merge.

Risk level:

- Medium. Two production database migrations and one production Edge Function deployment are included.
- No Vercel deployment or frontend change is included.

### Previous handoff entry

Date: 2026-07-18

What changed:

- Added a RevSports placeholder planner that is read-only by default and produces a CSV report for unmatched external players.
- Added a guarded, manual apply path that requires one RevSports player ID, an explicit confirmation flag, and a separate non-production Supabase project.
- The apply path refuses the known live SportStack project, re-reads the source before writing, and only accepts a safe `create_placeholder` or `link_existing` result.
- It creates or reuses one exact-ID profile, one appropriate team membership, and one matched external profile link without using display-name matching.
- Validated Max F. (`XereEs8`) against SportStack Dev project `icqegnpjbizccjebjfhb`.
- The first apply created one placeholder/Auth shell, one active `FILL_IN` membership for Blaze, and one matched external link.
- The second apply safely stopped because the player was already linked. No duplicate profile, Auth shell, membership, or link was created.
- The final dry-run reported `skip` / `already linked`.
- The same-name Max F. profile with a different RevSports ID remained unchanged.
- Player MVP Voting and Umpire Match Voting counts remained unchanged.
- No production Supabase write, migration, RLS/Auth policy change, role change, Edge Function change, workflow change, scraper wiring, commit, push, or deployment was included.

Files changed:

- `scripts/revsports_placeholder_plan.py`
- `tests/test_revsports_placeholder_plan.py`
- `docs/revsports-post-mapping-next-steps.md`
- `docs/current-state.md`

Checks run:

- `python -m unittest tests.test_revsports_placeholder_plan` passed all 28 tests.
- `python -m py_compile scripts/revsports_placeholder_plan.py` passed.
- The initial Dev dry-run returned one safe `create_placeholder` row for `XereEs8`, with exact external team ID `417788`, Blaze team ID `d76b45d9-9cc4-42de-a724-de9c0dcd95d6`, and `FILL_IN` membership.
- Post-apply verification confirmed one placeholder profile, one Auth shell, one active `FILL_IN` membership, one matched external link, and zero `PRIMARY` memberships.
- Player MVP Voting counts remained at 630 sessions, 85 submissions, and 255 votes.
- Umpire Match Voting counts remained at 83 submissions, 271 lines, and 7 edits.

What Aaron should test next:

- Review the focused staged diff before committing.
- No further database apply is needed for Max F.; the Dev validation is complete.
- Keep the generated CSV reports local and do not include them in the commit.

Risk level:

- Medium. The default mode is read-only, but the explicitly confirmed apply mode uses a service-role credential and creates Auth/profile, membership, and external-link records.
- Apply is manual, limited to one player, and blocked for the known live SportStack project.
- No database migration is included.

### Previous handoff entry

Date: 2026-07-16

What changed:

- Standardised repository documentation on **Player MVP Voting** and **Umpire Match Voting** as separate modules with separate audiences, permissions, workflows, submissions, and results.
- Added the central terminology, short UI labels, suggested future namespaces, current route/component/service mapping, and documentation-only follow-up identifiers to `docs/project-brief.md`.
- Documented that active Umpire Match Voting code uses the historical `player_vote_submissions`, `player_vote_lines`, and `player_vote_edits` names.
- Reconciled the schema snapshots: older or exported unprefixed `vote_submissions`, `vote_lines`, and `vote_edits` identifiers belong to Umpire Match Voting, although those exact names are not present in the current repository or generated types.
- Kept the separate `umpire_vote_*` schema as **UNKNOWN — needs confirmation** because its generated columns describe umpire ratings rather than the active Umpire Match Voting workflow.
- Clarified that player-specific fields and names in the current Umpire Match Voting implementation do not restrict the product definition to players.
- Preserved historical UI wording where changing it would make the record inaccurate, with canonical clarification notes added around it.
- Left `notes/session-2026-05-30.md` unchanged because it contains invalid legacy Windows-1252 bytes that the repository patch tool cannot safely edit. Its three "MVP Voting" references mean Player MVP Voting.
- No application code, schema, migration, RLS/Auth, Edge Function, environment, package, deployment, `main` branch, commit, or push change was made by this documentation pass.

Files changed:

- `AGENTS.md`
- `README.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `CODEX_HANDOFF_EXTRAS.md`
- `docs/current-state.md`
- `docs/project-brief.md`
- `docs/revsports-data-model-v2.md`
- `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md`
- `PROJECT_SCOPE_UI_UX_AND_IMPLEMENTATION_PLAN.md`
- `source-assets/brand/CHECKLIST.md`
- `notes/known-issues.md`
- `notes/2026-06-21-mvp-voting-review-handover.md`
- `notes/2026-06-21-revsports-linking-fix-handover.md`
- `notes/2026-06-24-duplicate-profile-investigation.md`
- `notes/2026-06-24-evening-session-handover.md`
- `notes/2026-06-24-project-health-review-handover.md`
- `notes/2026-06-25-evening-session-handover.md`
- `notes/2026-06-26-committee-hub-module-plan.md`
- `notes/session-2026-05-21.md`
- `notes/session-2026-06-05-data-alignment.md`
- `notes/session-2026-06-20-fixture-linking-revsports-ids.md`
- `notes/session-4-handover.md`
- `notes/session-handoff-umpire-voting-ui.md`

Checks run:

- Final terminology audit passed all 13 required mapping and preferred-label checks and found no document that restricts Umpire Match Voting to players. The three references in the unchanged legacy-encoded `notes/session-2026-05-30.md` mean Player MVP Voting.
- Local-link check passed across all 40 Markdown files found in the repository; no missing targets were found.
- Markdown fence check passed across all 40 files with no unbalanced code fences.
- The central `docs/project-brief.md#voting-modules` terminology and identifier mapping exists.
- `git diff --check` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed with the existing large-chunk warning.
- The final `npm run lint -- --quiet` check still reports the same 488 existing errors; warnings were suppressed. The earlier full lint run reported 583 problems (488 errors and 95 warnings). No lintable source file was changed by this documentation pass.

What Aaron should test next:

- No app or database test is required for this documentation-only change.
- Review `docs/project-brief.md#voting-modules`, especially the `player_vote_*` and `umpire_vote_*` distinction and the parked follow-up identifiers.

Risk level:

- Low. Documentation only; no database migration or deployment-sensitive change is included.

### Previous handoff entry

Date: 2026-07-16

What changed:

- Upgraded `/coaching/trace` into a browser-only real-data playground for TraceLab CSV files.
- Added separate/replacement imports for Metadata, heart rate, pedometer, activity, phone GPS, watch GPS and wrist motion, all aligned with `seconds_elapsed`.
- Added a background browser worker with progress and cancellation. Wrist motion is reduced from raw readings into one-second summaries and raw rows are not retained.
- Added combined summary cards, replay controls and Overview, GPS, Movement and Data quality tabs.
- Kept phone and watch sources clearly separated, retained poor GPS samples with Fair/Poor warnings, and labelled movement peaks only as `High movement`.
- Kept the pitch display explicitly relative and not field calibrated.
- Supplied training data confirmed approximately 66 minutes, 765 heart-rate readings (84 minimum, 125 average, 170 maximum), 106 phone steps, 3,965 phone GPS points, 1,095 watch GPS points and 397,223 wrist rows reduced to 3,965 summaries.
- No Supabase write, migration, RLS/Auth change, Edge Function, generated type, package or lockfile change was included.

Files changed:

- `src/pages/coaching/HockeyTraceLab.tsx`
- `src/lib/tracePlayback.ts`
- `src/workers/traceImport.worker.ts`
- `docs/current-state.md`

Checks run:

- Focused ESLint passed for all three TraceLab source files.
- `npx tsc --noEmit` passed.
- `npm run build` passed and produced the separate TraceLab worker bundle.
- `npm run lint` was run and still fails on the existing unrelated repository lint debt (583 problems); the focused TraceLab lint passes.
- The built worker parsed the seven supplied real CSV files successfully, including the 141 MB wrist file, and matched the expected row counts and heart-rate/step values.
- Unsupported files, missing headers and invalid rows were checked against the built worker and returned unused/error/skipped quality reports as expected.
- Signed-in desktop and 390 x 844 mobile browser checks passed for the demo, tabs, GPS preview, replay controls, clear-session behaviour and page width. No app runtime error was present before the blocked Chrome upload attempt.

What Aaron should test next:

- In Chrome, enable `Allow access to file URLs` for the ChatGPT Chrome Extension, then open `/coaching/trace` and select the seven supplied CSV files.
- Confirm the real summary values above, switch between the Phone and Watch GPS routes, then test Play, Restart, the timeline slider and Cancel during a fresh WristMotion import.
- Re-import `HeartRate.csv` once and confirm its row count remains 765 rather than doubling.

Risk level:

- Low-to-medium. This is local browser processing only, with no database or deployment change. The remaining unknown is the final end-to-end Chrome file selection because the extension currently blocks local file access until that setting is enabled.

### Previous handoff entry

Date: 2026-07-14

What changed:

- After Aaron's explicit approval, applied only the enum migration `add_mvp_result_disputed_status` to the live SportStack Supabase project.
- Live `public.mvp_session_status` now contains `PENDING`, `OPEN`, `CLOSED` and `RESULT_DISPUTED`.
- Supabase recorded the live migration as version `20260713230947`; its reviewed local source remains `supabase/migrations/20260713133335_add_mvp_result_disputed_status.sql` with SHA-256 `99D92C4BB9B44CE712A55F16081FCCFF6A2D510CFFB4D38697EB19CB8C286614`.
- The fresh Player MVP Voting preflight found 630 sessions, 84 submissions and 252 vote rows. There are 286 PENDING, 340 OPEN and 4 CLOSED sessions; 27 OPEN sessions close in the future and 313 are expired.
- All Player MVP Voting duplicate, orphan and three-choice integrity checks returned zero blockers. The 37-session increase since the previous snapshot did not add submissions or vote rows.
- Verification confirmed zero Player MVP Voting sessions currently use `RESULT_DISPUTED`; the migration changed the enum only and did not update Player MVP Voting rows.
- Existing MVP policies remain unchanged at this gate. The additive expansion and later access-lockdown migrations have not been applied.
- No Edge Function, generated types, app code, Vercel deployment, email, commit or push was included.

Files changed in this gate:

- `docs/current-state.md`
- Live database migration only; the reviewed local enum migration file was not altered.

Checks run:

- Confirmed the live SportStack project is healthy in `ap-southeast-2` on PostgreSQL 17.
- Confirmed `RESULT_DISPUTED` was absent and the migration name was not in live history immediately before applying it.
- Confirmed the enum value casts successfully after the migration and that Player MVP Voting session, submission and vote-row counts remained unchanged.
- Rechecked the current MVP policy names and roles before the migration; no policy was changed.

What Aaron should test next:

- No player or admin test is required yet because the enum has no visible behaviour by itself.
- The next rollout gate is the additive `expand_team_mvp_voting` migration and requires separate approval. Do not deploy the Edge Function or app at that gate unless separately approved.
- Before any future CLI `db push`, reconcile the platform-recorded migration version with the older local timestamp so later migrations cannot be applied out of order.

Risk level:

- Low-to-medium. This was one additive enum value with no row changes, but PostgreSQL enum values are intentionally retained rather than removed during rollback.

### Previous handoff entry

Date: 2026-07-13

What changed:

- Built the complete Player MVP Voting reliability and team-control package locally.
- Added three ordered migrations for `RESULT_DISPUTED`, team-owned Player MVP Voting session history/notifications, secure command functions, scoped RLS and the later access lockdown.
- Added team-aware Player MVP Voting, result checks and disputes, scoped admin lifecycle controls, completion/reminder controls, protected Player MVP Analytics results, notification deep links/realtime badge refresh and team-aware reminder processing.
- Retired the public token Player MVP Voting screen with a sign-in handoff while preserving the old token tables and legacy history.
- Kept old fixture-wide sessions as history/audit only; they are never assigned a guessed team.
- Kept `src/integrations/supabase/types.ts` unchanged. It must be regenerated only after the approved additive migration is applied.
- No migration was applied live, no Edge Function was deployed, no email was sent, no Vercel deployment was triggered, and nothing was committed or pushed.
- A read-only live Player MVP Voting check remained at 593 sessions, 84 submissions and 252 vote rows, with three rows per submission and no duplicate or orphan blockers.

Files changed for this package:

- `supabase/migrations/20260713133335_add_mvp_result_disputed_status.sql`
- `supabase/migrations/20260713133341_expand_team_mvp_voting.sql`
- `supabase/pending-migrations/lock_down_mvp_voting_access.sql`
- `supabase/functions/mvp-voting-email-reminders/index.ts`
- `src/lib/mvpVoting.ts`
- `src/pages/MvpVoteCast.tsx`
- `src/pages/MvpVotes.tsx`
- `src/pages/admin/MvpVotingAdmin.tsx`
- `src/pages/admin/Analytics.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/App.tsx`
- `docs/current-state.md`

Checks run:

- All three migrations applied in order to a disposable Supabase-style PostgreSQL 17 database and passed lifecycle, ballot, dispute, legacy cutover, grant/RLS and reminder-scheduler checks. The disposable database was then removed.
- Migration parsing, Edge Function type checking, focused MVP ESLint, `npx tsc --noEmit`, `npm run build` and `git diff --check` passed.
- Analytics has no new MVP ESLint errors; its 25 existing `any` errors and four existing hook warnings remain.
- Full `npm run lint` still reports 583 unrelated/existing repository problems: 488 errors and 95 warnings.
- Browser smoke testing passed for the retired token route, signed-out MVP redirect and 390 px layout without horizontal overflow.
- Signed-in player/admin browser flows were not run because the required migrations are deliberately not live.

What Aaron should test next:

- Review this local package first. The first approved live step is a fresh read-only blocker/count check, followed by separate approval for the enum-only migration.
- Do not enable a team or test signed-in team rounds until the additive migration, regenerated types, updated reminder function and `dev` app deployment have each been approved and completed.

Risk level:

- High. This package contains three unapplied database migrations, RLS/grant changes, secure database functions and an undeployed Edge Function update.
- Result-check rows are intentionally immutable. A future profile merge/delete involving a result reporter will need an audited merge process rather than deleting that history.

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

### Safety Hub final visual follow-up

Date: 2026-07-16

What changed:

- Strengthened the Matrix & Guidance colour hierarchy in light and dark mode so Low, Medium, High and Very High ratings are clearly distinct, with orange High cells and deeper red Very High cells.
- Made matrix row and column headings, rating labels, selected guidance tabs and guidance definition terms easier to scan.
- Completed the expanded linked-record summaries with compact column headings, three-line title wrapping and clearer owner, due, review, decision and status information.
- Reduced the Audit History date controls while retaining full-width mobile controls.
- Kept the Safety Hub as a mock-only prototype. This note does not approve final matrix values, a database schema, permissions, RLS, or a live data model.

Files changed:

- `src/pages/admin/SafetyRiskModule.tsx`
- `docs/current-state.md`

Checks run:

- `npx eslint src/pages/admin/SafetyRiskModule.tsx` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed with the existing large-chunk warning.
- `npm run lint` still reports 583 existing unrelated repository problems; the focused Safety Hub lint has no issues.
- Browser checks passed for the matrix, expanded linked records and audit filters in light and dark mode at desktop, tablet and mobile widths, with no document-level horizontal overflow.

What Aaron should test next:

- Open `/admin/safety-risk`, compare the matrix in light and dark mode, expand `R-001`, and check the Audit History date filters.
- Confirm the final visual result before approving the separate `dev` to `main` Go Live step.

Risk level:

- Low. Mock-only frontend and documentation changes.
- No database migration, Supabase read/write, RLS/auth change, Edge Function change or deployment action.

### Previous handoff entry

Date: 2026-07-13

What changed:

- Applied Aaron's six review comments to `/admin/umpire-voting`:
  - Confirmed the Association -> Club -> Division -> Team filter is staged and resets lower levels when an upper level changes.
  - Team choices and team displays now use `Club - Division - Team` labels to distinguish duplicate short team names.
  - Fixture cells now show the home and away teams on separate lines.
  - Umpire Match Voting rows now show the recorded player number beside the player name, including number `0` where it exists.
  - The review dialog now stays within the viewport and scrolls internally.
  - Submission history is compact, scrollable and resolves `changed_by_id` to the admin's profile name.
- Future Umpire Match Voting Approve and Reopen actions now add one `player_vote_edits` audit row with the signed-in admin, timestamp and status change.
- Read the live feedback log. No feedback entries directly mention the Umpire Match Voting page. Related open themes cover the standard cascade, players remaining visible when not linked to a user, broader voting filters and round-completion visibility; those generic feedback items did not identify which voting module they meant.
- Audited historical-player matching against the live schema:
  - 259 distinct historical Umpire Match Voting identities
  - 17 unique exact profile-name matches
  - 2 ambiguous exact matches
  - 240 with no exact profile-name match
- Confirmed the Umpire Match Voting table `player_vote_lines` has no profile-link column. A reviewed player-matching workflow and additive migration are still required before historical Umpire Match Voting records can be linked safely to current or placeholder profiles.
- No historical Umpire Match Voting names, profile records, placeholders or statuses were changed during this pass.
- No emails were sent or called. No migration, RLS/Auth change, Edge Function change, environment change, deployment or `main` branch action was made.

Files changed:

- `src/components/admin/AdminCascadeFilters.tsx`
- `src/pages/admin/UmpireVotingModule.tsx`
- `docs/current-state.md`

Checks run:

- Focused ESLint passed for both touched TypeScript files.
- `npx tsc --noEmit` passed.
- `npm run build` passed with the existing old Browserslist-data and large-chunk warnings.
- Browser smoke testing passed for the complete cascade, full team labels, two-line fixtures, recorded player numbers and named edit history.
- At 1647 x 794, the review dialog stayed 16 px inside the viewport with no document-level horizontal overflow.
- At 390 x 844, the review dialog stayed inside the viewport with no document-level horizontal overflow.
- Umpire Match Voting Approve/Reopen was deliberately not clicked, so the new workflow audit write was not tested against live data.
- Final read-only live verification remained at 83 submissions: 77 pending active, 2 approved active, 4 deleted and 7 edit-history rows.
- The browser console still reports the existing unrelated `claimPlaceholderProfile` Edge Function non-2xx error.
- `npm run lint` still reports the same 611 pre-existing issues across archived reference modules and unrelated app files.

What Aaron should test next:

- Refresh `/admin/umpire-voting` and select Hockey Ballarat -> EGC -> Division 2 Open.
- Open Team and confirm the choices read `EGC - Division 2 Open - Blue` and `EGC - Division 2 Open - Gold`.
- Open the Umpire Match Voting "Vote Submissions" tab and confirm each fixture is two lines and recorded player numbers appear beside names.
- Review the approved Round 3 Division 2 Open Blaze vs Pumas submission and confirm the compact history names Aaron Mullane as the editor.
- Do not use Umpire Match Voting Approve/Reopen only to test the history because that changes live data.

Risk level:

- Medium. The UI is low risk, but future Approve/Reopen actions now include an additional live audit-row insert.
- No database migration is included.

Parked follow-up:

- Import the registered-player list into the existing profile/placeholder workflow, then design a reviewed matcher using full name, team/division and player number.
- Preserve the historical Umpire Match Voting name and number even after a profile link is added, and never auto-link ambiguous matches.

### Previous handoff entry

Date: 2026-07-13

What changed:

- Imported the archived Ballarat Umpire Match Voting history into the live SportStack Supabase project after Aaron's explicit approval.
- The guarded import added:
  - 81 new `player_vote_submissions` rows
  - 268 new `player_vote_lines` rows
  - 7 new `player_vote_edits` rows
- Kept the two previously imported sample submissions instead of duplicating them.
- Restored the four missing Umpire Match Voting lines on the partial Under 16 sample submission.
- Corrected one existing Umpire Match Voting line and both existing sample submission headers where duplicate team names had pointed to teams from the wrong divisions.
- Final live Umpire Match Voting totals are 83 submissions, 271 vote lines and 7 edit-history rows.
- All 83 Umpire Match Voting submissions, 271 vote lines and 7 edits match the archived source with no missing or ambiguous records.
- Linked 75 submissions to unique current SportStack fixtures. Eight submissions remain intentionally unlinked because no safe live fixture match exists; their round, division and team context is preserved.
- Preserved source approval, deletion, proxy and submission timestamps.
- Did not import archived Auth users, passwords, sessions or tokens, and did not create users or fixtures.
- No emails were sent. No email function was called and the three Umpire Match Voting `player_vote_*` tables have no database triggers.
- No schema migration, RLS/Auth change, Edge Function change, environment change, deployment or `main` branch action was made.

Files changed:

- `docs/current-state.md`

Checks run:

- Source dump SHA-256: `F29594C4541BC1DE80647C9B9DA87C212ACC12E3EA7BFF005025B19E75C6B5C2`.
- Final live verification confirmed:
  - 83 uniquely matched submissions
  - 271 uniquely matched vote lines
  - 7 matched edit-history rows
  - 0 missing or ambiguous records
  - 0 status mismatches
  - 0 fixture, division, round or team mismatches
  - 0 email/database triggers on the imported tables
- `npx tsc --noEmit` passed.
- `npm run build` passed with the existing old Browserslist-data and large-chunk warnings.
- `npm run lint` still reports the same 611 pre-existing issues across archived reference modules and unrelated app files.
- `git diff --check` passed with line-ending warnings only.

What Aaron should test next:

- Refresh `/admin/umpire-voting`.
- Check the Dashboard totals, then select Hockey Ballarat and a season before reviewing outstanding fixtures.
- Open the Umpire Match Voting "Vote Submissions" tab and confirm the Round 4 Division 1 Open Lucas HC vs EGC sample has three vote lines.
- Confirm the Round 5 Under 16 Open Blaze vs EGC sample now has four vote lines.
- Check a known approved Umpire Match Voting submission, a proxy submission and the deleted-submissions filter.

Risk level:

- Medium. This was a confirmed live data import.
- No database migration is included.

### Previous handoff entry

Date: 2026-07-12

What changed:

- Strengthened the Safety Hub tab bar in light and dark mode:
  - The full bar now has a clearer background, border and shadow.
  - The selected tab now uses a solid primary-colour background with white text.
  - Follow-up review changed the tabs to one horizontally scrollable row, fixed them below the SportStack header, and removed the overlapping sticky Safety Hub title behaviour.
- Follow-up tablet review prevented wide register content from expanding the whole app page by allowing the shared main content area to shrink correctly.
- Compact tablet register controls now keep both the view-details icon and association chevron visible, while desktop keeps the full `View details` label.
- Added the same expandable association behaviour to Risk Register rows that already existed in the Actions, QI and Bright Ideas registers.
- Kept one expanded row at a time, with mouse, Enter and Space support.
- Reworked all expanded association summaries into compact grouped sections:
  - Associated risks
  - Associated actions
  - Associated QI items
  - Associated Bright Ideas
- Each associated record is shown as one quick-scan line with the most useful fields for that record type, including owner, rating, review or due timing, decision and status where relevant.
- Follow-up review narrowed the association summary grid so all status information remains visible at tablet width and changed undecided Bright Ideas from `-` to `Decision: Not decided`.
- Empty groups state clearly that there are no associated records of that type.
- Mock relationship chains are followed so an originating Bright Idea can remain visible when it became a QI item linked to a risk or action.
- Parked a future Safety Hub settings requirement:
  - Association and club administrators will need scope-appropriate settings for likelihood and consequence definitions, rating-response guidance and review guidance.
  - Risk categories must be addable and editable for each relevant organisation scope.
  - The future design still needs decisions about inheritance, local overrides, permissions and database storage.
- No Safety Hub settings screen, Supabase work or live persistence was added in this pass.
- This note does not approve a database schema, permissions or RLS design, live data model, final matrix values, or the future settings ownership rules.

Files changed:

- `src/pages/admin/SafetyRiskModule.tsx`
- `src/components/layout/AppLayout.tsx`
- `docs/current-state.md`

Checks run:

- `npx tsc --noEmit` passed.
- `npx eslint src/pages/admin/SafetyRiskModule.tsx` passed.
- `npm run build` passed with the existing old Browserslist-data and large-chunk warnings.
- `npm run lint` still reports 611 existing unrelated problems across reference modules and older app files; the focused Safety Hub lint has no issues.
- Browser smoke checks passed at 1285 x 912 in light and dark mode.
- Follow-up responsive checks passed at 900 px tablet and 390 px mobile width with no document-level horizontal overflow.
- At 900 px, the tab strip stayed at 900 px or narrower, both Risk Register row controls remained visible, and the tab strip stayed below the 56 px SportStack header while scrolling.
- Risk and QI association summaries, one-row-at-a-time behaviour, keyboard expansion, and separate `View details` behaviour passed browser checks.

What Aaron should test next:

- Open `/admin/safety-risk` and compare the selected tab in light and dark mode.
- Check the page at tablet width and confirm the page itself does not scroll sideways; the tab strip should remain one row and scroll horizontally only when needed.
- Expand `R-001` and confirm its associated actions, QI item and originating Bright Idea are easy to scan.
- Expand `QI-001` and confirm its associated risk and action appear under separate headings.
- Expand `R-006` and confirm the empty association messages make it clear that no actions, QI items or Bright Ideas are linked.
- Select `View details` and confirm the drawer opens without collapsing the association summary.

Risk level:

- Low. Mock-only Safety Hub UI and documentation changes.
- No database migration, Supabase read/write, RLS/auth change, Edge Function change or deployment action.

Parked follow-up:

- Plan the organisation-scoped Safety Hub settings model and admin screen in a separate approved package before database integration.
- Keep the existing app-wide page-remount/session-refresh investigation separate because it affects shared routing and context providers.

### Previous handoff entry

Date: 2026-07-12

What changed:

- Started the approved frontend/read-only Umpire Match Voting implementation phase for `/admin/umpire-voting`.
- Added an Umpire Match Voting dashboard with:
  - Outstanding past fixtures
  - Pending approval
  - Approved Umpire Match Voting submissions
  - Proxy submissions
  - Logged player-name corrections
  - Deleted submissions
- Added per-round Approved / Pending / Missing fixture status bars.
- Added shared season, round, senior/junior, and Association -> Club -> Division -> Team filters.
- Expanded the Umpire Match Voting submissions table with submitted-for, submitted-by, source, status, vote lines, and submitted date context.
- Corrected existing admin proxy source detection and the edit-history original-value display.
- Improved tablet/mobile overflow so the submissions table scrolls inside its own panel without widening the whole page.
- Expanded junior division detection in the frontend Umpire Match Voting scheme helper.
- No emails were sent. No email, reminder, notification, or Edge Function action was added or called.
- No live data was changed during testing.
- No migration, schema, RLS, Auth, Edge Function, environment, deployment, or `main` branch change was made.

Files changed:

- `src/pages/admin/UmpireVotingModule.tsx`
- `src/lib/umpireVoteSchemes.ts`
- `docs/current-state.md`

Checks run:

- Read-only live Supabase schema checks confirmed the current fixture and `player_vote_*` columns.
- `npx tsc --noEmit` passed.
- `npx eslint src/pages/admin/UmpireVotingModule.tsx src/lib/umpireVoteSchemes.ts` passed.
- `npm run build` passed.
- Signed-in browser smoke checks passed at the normal viewport and at 390 px mobile width.
- `npm run lint` still fails on 611 existing issues across old `modules/*` and unrelated legacy app files. The files changed in this task pass focused lint.

What Aaron should test next:

- Open `/admin/umpire-voting`.
- Check the Dashboard counts and per-round bars against a known round.
- Try the season, round, division type, and scope filters.
- Open the Umpire Match Voting "Vote Submissions" tab and confirm the submitted-for, submitted-by, and source labels are correct.
- Open one safe submission with Review, but do not approve or reopen it unless that live change is intended.
- Check the page once on mobile or a narrow browser window.

Risk level:

- Low. Frontend and read-only dashboard work only.
- Existing Approve/Reopen actions remain available, but they were not used during this task.
- No database migration or backend change is included.

### Previous handoff entry

Date: 2026-07-11

What changed:

- Paused the Safety Hub prototype freeze for one more focused mock-only Task A pass.
- Removed the visible `Links` column from:
  - Actions
  - QI Register
  - Bright Ideas
- Added expandable linked-record rows for Actions, QI items, and Bright Ideas:
  - Only one row expands at a time.
  - Clicking the same row again collapses it.
  - Rows support keyboard Enter and Space.
  - `View details` opens the drawer without toggling the row.
  - Rows with no links show `No linked records`.
- Changed linked-record handling in the prototype so source relationships display as read-only context rather than editable link ID fields.
- Removed ordinary drawer link-management buttons so users are not shown a normal edit/move-link path.
- Added `Entered in error` as a prototype correction status for wrong records.
- Improved Safety Hub contrast in dark and light mode:
  - Chart tooltips now use theme-aware background, border, and text.
  - Chart axes and hover areas now use theme-aware colours.
  - Matrix cells, rating badges, priority badges, decision badges, status badges, due-date badges, alert chips, guidance tabs, and table hover/expanded-row backgrounds now have clearer light/dark variants.
- Improved light-mode left-sidebar contrast by using primary-sidebar foreground colours for section headings, navigation labels, mode controls, feedback/logout links, and the SportStack version text.
- Identified the page-remount/session-refresh issue as a separate medium-risk app task. No auth, route, or provider changes were made in this pass.
- No Supabase work was done.
- No database schema, RLS/permission design, live data model, or final risk matrix values are approved by this note.

Files changed:

- `src/pages/admin/SafetyRiskModule.tsx`
- `src/components/layout/AppLayout.tsx`
- `docs/current-state.md`

Checks run:

- `npx tsc --noEmit` passed.
- `npx eslint src/pages/admin/SafetyRiskModule.tsx src/components/layout/AppLayout.tsx` passed.

What Aaron should test next:

- Open `/admin/safety-risk`.
- Open the Actions, QI Register, and Bright Ideas tabs.
- Click rows to expand/collapse linked records.
- Use Enter and Space on a focused row to expand/collapse it.
- Click `View details` and confirm it opens the drawer without expanding/collapsing the row.
- Open Add Action and Add QI Item and confirm linked source records are read-only.
- Check Dashboard charts and Matrix & Guidance in dark and light mode.
- Check the left navigation in light mode.

Risk level:

- Low. UI prototype and layout contrast only.
- No database migration, no RLS/auth change, no Edge Function change, no live data read/write, and no deployment action.

Parked follow-up:

- Preventing focus/session remounts should be handled separately in `AuthContext`, `ProtectedRoute`, and `TeamContext`.
- That task is medium risk because it affects app-wide routing/loading behaviour.

### Previous handoff entry

Date: 2026-07-11

What changed:

- Completed the final mock-only Safety Hub freeze pass for `/admin/safety-risk`.
- The visual prototype is now the approved mock baseline for future planning.
- Added a clear demo-data banner stating the records are not live committee records.
- Expanded the dashboard to nine KPI cards:
  - Total risks
  - High / Very High risks
  - Total actions
  - Overdue actions
  - Due within 30 days
  - Total QI items
  - QI awaiting decision
  - Bright Ideas awaiting review
  - Risk reviews overdue
- Added a prominent `Submit a Bright Idea` button on the Bright Ideas tab.
- Reworked the Action form into clearer sections:
  - Basics and links
  - BE - Baseline and Evaluate
  - SMART treatment
  - Responsibility, resources and due date
  - Review and save note
- Made drawer action buttons sticky and adjusted the drawer width for desktop while keeping it full-width on smaller screens.
- Reworked Matrix & Guidance into readable tabs for likelihood, consequences, ratings and responses, reviews, and categories.
- Added mock Audit History filters for date range, user, record type, record ID, and action type.
- Expanded the audit drawer to show organisation scope, related record, previous value, new value, reason, and related record detail.
- No Supabase work was done.
- No database schema, RLS/permission design, live data model, or final risk matrix values are approved by this note.

Files changed:

- `src/pages/admin/SafetyRiskModule.tsx`
- `docs/current-state.md`

Checks run:

- `npx tsc --noEmit` passed.
- `npx eslint src/pages/admin/SafetyRiskModule.tsx` passed.
- `npm run build` passed.
- `npm run lint` still fails on existing unrelated lint issues across older `modules/*`, older admin/coaching files, `src/pages/umpire/UmpireVoteSubmit.tsx`, Supabase function code, and `tailwind.config.ts`.

What Aaron should test next:

- Open `/admin/safety-risk`.
- Check Dashboard cards and the demo-data banner.
- Open the Bright Ideas tab and use `Submit a Bright Idea`.
- Open Add record -> Add action and check the sectioned Action form.
- Open Matrix & Guidance and check each guidance tab.
- Open Audit History, try each filter, then open an audit row and check the drawer detail.
- Check the drawer on desktop and tablet widths.

Risk level:

- Low. UI prototype only.
- No database migration, no RLS/auth change, no Edge Function change, no live data read/write, and no deployment action.

### Previous handoff entry

Date: 2026-07-11

What changed:

- Completed the short Package 1 Safety Hub revision pass requested after screenshot review.
- Kept `/admin/safety-risk` as a mock-only prototype.
- Prevented register IDs from wrapping by using wider non-wrapping ID cells and badges.
- Simplified the global Add record menu to:
  - Add risk
  - Add action
  - Add QI item
  - Submit Bright Idea
- Moved contextual activities into record drawers:
  - Bright Idea review now opens from a Bright Idea drawer.
  - Risk review now opens from a Risk drawer.
  - Link management now opens from the selected Risk, Action, QI item, or Bright Idea.
- Added a mock Manage Linked Records form for connecting existing risk, action, QI, and Bright Idea records.
- Added missing drawer actions:
  - Bright Ideas can create linked risks, QI items, actions, or link an existing record.
  - QI items can create linked risks/actions, link existing risks/actions, and open the originating Bright Idea.
  - Actions have one Manage links option.
- Made linked-record pills and linked-record drawer cards clickable where the mock record exists.
- Made register rows clickable, while keeping the Open button.
- Expanded Risk Register filters with owner, review due, and scope filters.
- Replaced placeholder Matrix & Guidance text with detailed likelihood, consequence, response, category, review-frequency, and inherent/residual guidance.
- Added light full-cell rating colours to the matrix.
- Changed due-state display from `Current` to `On track` while keeping the mock data value unchanged.
- Made the Safety Hub title area, tab bar, and drawer header sticky for tablet-style scrolling.
- Clarified Bright Idea decision display so pending decisions show as no decision yet instead of a second workflow status.

Files changed:

- `src/pages/admin/SafetyRiskModule.tsx`
- `docs/current-state.md`

Checks run:

- `npx tsc --noEmit` passed.
- `npx eslint src/pages/admin/SafetyRiskModule.tsx` passed.
- `npm run build` passed.
- Build still reports the existing Browserslist age and large chunk warnings.
- `npm run lint` still fails on existing unrelated lint issues across older `modules/*`, older admin/coaching files, `src/pages/umpire/UmpireVoteSubmit.tsx`, Supabase function code, and `tailwind.config.ts`.

What Aaron should test next:

- Open `/admin/safety-risk` on tablet width.
- Confirm IDs such as `R-001`, `QI-001`, `A-001`, and `BI-001` stay on one line.
- Confirm the Add record menu only shows the four new-record options.
- Open a Risk and use Record review and Manage links from the drawer.
- Open a Bright Idea and check Review idea, Create linked risk/QI/action, and Link existing record.
- Open a QI item linked to a Bright Idea and check View originating Bright Idea.
- Click anywhere on register rows and linked-record pills to confirm the right drawer opens.
- Review Matrix & Guidance for wording and missing club-specific examples.

Risk level:

- Low. UI prototype only.
- No database migration, no RLS/auth change, no Edge Function change, no live data read/write, and no deployment action.

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
- Umpire Match Voting removes Ballarat branding and uses the current SportStack data path: `player_vote_submissions` and `player_vote_lines`.
- Umpire Match Voting adds admin review, approval/reopen actions, scoped filters, and a leaderboard.
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
- Ballarat Umpire Hub now shows an Umpire Match Voting flow plus its admin leaderboard/review surface.
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

- Local Player MVP Voting admin follow-up fixes were added but not deployed live yet.
- Pending voters now have a per-person "Resend" button in the Voter Status table.
- The per-person Player MVP Voting resend calls `mvp-voting-email-reminders` with `session_id` and `profile_id`; the Edge Function still checks server-side that the profile is eligible and has not submitted.
- Submitted Player MVP voters now show a clearer "Withdraw" action. It uses the existing Player MVP Voting withdrawal flow: delete that voter's `mvp_votes` rows, delete their `mvp_vote_submissions` row, and write an `mvp_vote_audit` entry.
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

- Live Supabase Step 1 for Player MVP Voting email reminders was completed.
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
- After secrets are confirmed, test on one small known Player MVP Voting session before relying on scheduled reminders.

Risk level:

- Medium-high until secrets are configured and a small live send is tested.
- Cron is active, but it should fail closed until the cron secret matches and Resend secrets are present.

### Previous handoff entry

Date: 2026-07-05

What changed:

- Local branch `feat/mvp-voting-email-reminders` adds the Player MVP Voting email reminder backend pieces.
- Added a new Supabase Edge Function `mvp-voting-email-reminders`.
- The function can send:
  - an opening email when a Player MVP Voting session is open,
  - a 3-day reminder at 6:00pm Australia/Melbourne time based on `closes_at`,
  - a 24-hour reminder based on `closes_at`,
  - a manual resend to non-voters from the admin detail screen.
- Reminder recipients are the current login-based eligible voter set: attended `revsports_players` rows with linked `profile_id`, excluding submitted voters in `mvp_vote_submissions`.
- Added a local migration for `mvp_voting_email_events` tracking plus a Supabase Cron job that calls the Edge Function every 15 minutes.
- The historical Player MVP Voting admin "Resend to Non-Voters" button now calls the Edge Function instead of showing the old mock message.
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
- After live setup, open the Player MVP Voting admin route `/admin/mvp-voting`, open an `OPEN` session, and use "Resend to Non-Voters" on a small known session first.
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
- The Player MVP Voting casting page now shows a scoreboard-style match header with team logos/banners, score, round, time, pitch/venue, and date, and the duplicated "Round Round" label was removed from the visible page.
- The Player MVP Voting scoreboard now loads fixture score/date first, then team branding, venue, and pitch separately so one missing relationship does not blank the whole banner.
- The Player MVP Voting scoreboard now has a stronger sports-graphic layout, missing-score `VS` fallback, clickable score panels, and a goal-scorer dialog.
- Goal-scorer detail uses existing imported player goal counts when available. Timed goal events are not available yet, so scorer minutes remain future backend/import work.
- The Player MVP Voting scoreboard polish pass removed the visible duplicate division label, uses association context in the top pill when available, adds a clickable-score hint, and tightens team logo/name spacing.
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

## 20 July 2026 - Player MVP automatic opening and reminder timing

What changed:

- Added local migration `20260720100536_auto_open_team_mvp_voting.sql`.
- When a scraper write first changes a fixture to `COMPLETED` with both final scores, Player MVP Voting now opens automatically for each enabled team side.
- A first-cycle round closes at that team's next future `SCHEDULED` fixture start. If no later fixture is scheduled, it falls back to 72 hours after opening.
- Added partial home-team/date and away-team/date fixture indexes for the next-match lookup, and consistent team lock ordering for concurrent scraper writes.
- Repeated updates to an already completed fixture do not reopen an existing round or bulk-open older pending rounds.
- Manual first opening uses the same database-calculated close time. Reopen and corrected-result resolution remain capped at 72 hours.
- The existing reminder scheduler is changed from every 15 minutes to every minute without creating a second job.
- Scheduled email reminders now run at opening, 24 hours after opening and 72 hours after opening. A reminder is skipped if the voting round has already closed.
- Deployed `mvp-voting-email-reminders` version 5 to live Supabase with `verify_jwt = false`; its existing code continues to enforce cron-secret and scoped-admin authentication.
- The Player MVP admin dialog no longer asks for a first-opening close time. Reopen and corrected-result dialogs still allow an earlier close within 72 hours.

Files changed:

- `supabase/migrations/20260720100536_auto_open_team_mvp_voting.sql`
- `supabase/functions/mvp-voting-email-reminders/index.ts`
- `src/pages/admin/MvpVotingAdmin.tsx`
- `docs/current-state.md`

Checks run:

- Focused ESLint passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `npm run lint` still fails on known unrelated legacy errors elsewhere in the repository.
- Static PostgreSQL parsing passed for the new migration.
- Local browser smoke check passed: the first-open dialog explains the next-match rule and has no close-time input; the reopen dialog still defaults to 72 hours and allows an earlier close.
- Live Edge Function verification passed: version 5 is `ACTIVE`, the deployed source contains the new timing, and an unauthorised scheduler request was rejected with HTTP `401` without sending email.
- A temporary local Supabase start was attempted, but Windows blocked configured port `54322` before any migration ran. Database execution remains unverified until the approved Supabase rollout.

What Aaron should test next:

- After the separately approved migration, finalise one test fixture for an enabled team.
- Confirm the team-owned round opens automatically and closes at that team's next scheduled fixture start.
- Confirm an opening email is sent, followed by the 24-hour reminder when the round remains open.
- Use a round whose next fixture is more than 72 hours away to confirm the 72-hour reminder.
- Reopen a closed round and confirm its default close is 72 hours later.

Risk level:

- High until database and email behaviour are tested against Supabase. Includes one additive migration and an Edge Function change.
- Edge Function version 5 is live. No migration was applied, generated Supabase types were not edited, and nothing was pushed.

## 21 July 2026 - Separate Player MVP email setting

What changed:

- Added a separate `teams.mvp_notifications_enabled` setting with a default of on, preserving the existing email behaviour.
- Player MVP Voting can stay enabled while opening and reminder emails are disabled for that team.
- Added a scoped, audited database command for changing the email setting. Direct team-table changes remain guarded.
- The Player MVP admin page now shows separate switches for voting access and email notifications.
- Automatic opening, scheduled reminders, bulk reminders and per-person resends all respect the email setting.
- Turning emails off does not close a voting round, block a ballot or change stored votes.

Files changed:

- `supabase/migrations/20260721085522_add_team_mvp_notification_setting.sql`
- `supabase/functions/mvp-voting-email-reminders/index.ts`
- `src/pages/admin/MvpVotingAdmin.tsx`
- `docs/current-state.md`

Checks run:

- Read-only preflight checks confirmed Dev and Production had `mvp_enabled` but not the new email setting.
- Focused ESLint, `npx tsc --noEmit` and `npm run build` passed.
- Static PostgreSQL parsing passed for the new migration.
- Full `npm run lint -- --quiet` still reports the same 486 unrelated repository-wide errors.
- The in-app browser was blocked from reopening the localhost page, so the new settings still need the planned Dev browser smoke test.
- Dev transaction tests confirmed direct writes are blocked, the scoped command can turn emails off and on, and the test rolls back without changing session counts.
- Dev Edge Function version 2 is active, contains the notification and three-day checks, and rejects an unauthorised scheduled request with HTTP `401`.
- Supabase advisers reported no blocking issue from this change. The expected scoped `SECURITY DEFINER` warning and newly unused-index notices remain informational for this staged rollout.

Deployment state:

- Both migrations are applied to SportStack Dev only.
- `mvp-voting-email-reminders` version 2 is deployed to SportStack Dev only with its existing custom authentication.
- The Dev project has no Player MVP cron job, so automatic timed emails are not scheduled there. Manual opening and reminder calls remain available for testing.
- Production and `main` remain unchanged.
- Included in Dev commit `d318548` and pushed to `origin/dev`.
- Vercel reports the Dev deployment as `READY` at `sportstack-git-dev-sportstackapps-projects.vercel.app`; a protected-page fetch returned HTTP `200` with the SportStack app shell.

What Aaron should test next:

- Keep Player MVP Voting on, turn email notifications off and confirm players can still vote.
- Confirm opening, scheduled, bulk and per-person reminder emails are skipped while emails are off.
- Turn emails back on and confirm a manual reminder can be sent.
- Confirm turning Player MVP Voting off still closes pending and open rounds as before.

Risk level:

- Medium. Additive schema and Edge Function changes are included, but no destructive database work is required.

## 30 July 2026 - Scraper schedule and Storage retention preparation

What changed:

- Replaced the overlapping Production schedules with one consolidated, bounded workflow prepared
  on `dev`. The five old Production workflows are now manual-only fallbacks.
- Added a fixture-aware selector that checks every 15 minutes, calculates each expected finish from
  `scheduled_end_at` or the association default duration, and scrapes only that exact RevSports
  match URL. Incomplete results retry every 45 minutes for up to 12 hours.
- Added one nightly full catch-up across all three associations. Targeted runs stay temporary and
  are never uploaded to Storage; only the full run after Sunday matches gets a routine match backup.
- Future backups use one compressed `.tar.gz` object per selected source run.
- Added weekly read-only Storage reports and a guarded retention policy that keeps the latest,
  nearest 1-week, 2-week and 4-week snapshots, then one per month for up to 12 months.
- Generalised the Storage diagnostic and retention scripts for the exact known Dev and Production
  project references. Production deletion also requires an exact confirmation phrase.
- Updated current handoff, release, overnight and historical-note guidance.
- Archived all eight local stashes into the verified Git bundle recorded in the handoff, then
  cleared the stash list so the repository can return to a clean state.

Live read-only audit:

- Dev `scrape-backups`: 124 objects and 181,040,447 bytes.
- Production `scrape-backups`: 1,013 objects and 1,593,506,009 bytes.
- The revised policy projected 969 Production deletion candidates using 1,533,329,605 bytes,
  leaving 44 objects using 60,176,404 bytes. This projection is not approval to delete.
- Live timing checks found 38 scheduled fixtures finishing in the next three days and no fixture
  due at the time of the read-only audit.
- No Production Storage object, database row, schedule, secret or deployment was changed.

Files changed:

- `.github/workflows/dev-scrapers.yml`
- `.github/workflows/production-scrapers.yml`
- `.github/workflows/player-history.yml`
- `.github/workflows/player-registry.yml`
- `.github/workflows/scrape-hb.yml`
- `.github/workflows/scrape-sunraysia.yml`
- `.github/workflows/scrape-wha.yml`
- `scraper/scraper.py`
- `scraper/fixture_import.py`
- `scraper/requirements-supabase.txt`
- `scraper/requirements-match.txt`
- `scraper/requirements-browser.txt`
- `scripts/inspect_supabase_storage_usage.py`
- `scripts/retain_scrape_backups.py`
- `scripts/select_due_fixture_scrapes.py`
- `scripts/upload_scrape_backups_to_storage.py`
- `tests/test_inspect_supabase_storage_usage.py`
- `tests/test_retain_scrape_backups.py`
- `tests/test_select_due_fixture_scrapes.py`
- `tests/test_scraper_workflow_routine.py`
- `tests/test_upload_scrape_backups_to_storage.py`
- `docs/scraper-operations.md`
- `CODEX_HANDOFF.md`
- `CODEX_HANDOFF_EXTRAS.md`
- `docs/overnight-agent-plan.md`
- `docs/production-release-readiness-2026-07-29.md`
- `docs/safety-hub-database-integration-plan.md`
- `notes/README.md`
- `notes/known-issues.md`

Checks run:

- 77 Python tests passed.
- All seven GitHub workflow files passed YAML parsing and `actionlint` validation.
- A real public one-fixture scrape fetched only the selected match and its two teams, producing 16
  player rows with no Supabase writes and no quality warnings.
- `npx tsc --noEmit` passed.
- `npm run build` passed with the existing large-chunk warning.
- `npm run lint` was run and still reports the existing repository-wide backlog of 433 errors and
  89 warnings in older untouched files.

What Aaron should test next:

- Review `docs/scraper-operations.md` and confirm the exact-fixture, nightly catch-up and sparse
  retention routine.
- If approved, promote the workflow package to `main`, then run the read-only Production Storage
  diagnostic and retention dry run.
- Approve the exact new count, bytes and SHA-256 separately before any Production deletion.

Risk level:

- Medium while prepared on `dev`. No migration or data deletion is included. Promotion to `main`
  would activate Production-capable schedules and requires explicit owner approval.

## 30 July 2026 - Fault-tolerant fixture timing and match durations

What changed:

- Added the nullable, range-checked `divisions.default_match_duration_minutes` setting to Dev.
  Existing divisions remain null and inherit their association setting; no duration was guessed or
  backfilled.
- Match finish now resolves from exact fixture finish, division duration, association default, then
  a 90-minute system fallback. Fill-in access expiry uses the same hierarchy plus its existing grace
  period.
- Division, association and fixture administration now expose the relevant duration or exact-finish
  setting. Moving a fixture start preserves an existing exact duration unless a new finish is saved.
- Added a fail-closed targeted-scrape preflight. It fetches only the selected fixture's current
  RevSports round page, updates a moved start, postpones an early scrape, and blocks the result
  scrape when verification fails.
- Regenerated the public Supabase TypeScript types from the connected Dev project.
- Kept the nightly full catch-up, targeted-run no-backup rule, weekly compressed backups and sparse
  retention policy unchanged.

Environment boundary:

- The additive migration was applied only to SportStack Dev `icqegnpjbizccjebjfhb` and verified
  with rollback-only duration, rescheduling and fill-in-expiry assertions.
- `main`, `prod`, Production Supabase, Production Storage and the existing Production schedule were
  not changed. Promotion of the Production-capable workflow remains a separate approval step.

Checks run:

- All 83 Python tests passed, including duration hierarchy, moved-start preservation, fail-closed
  preflight, retry limits, workflow safety and backup-retention guards.
- All seven workflow files passed YAML parsing and `actionlint` 1.7.12.
- A read-only public smoke test found fixture `2563943` on its current round page and verified its
  01/08/2026 08:00 Melbourne start without any Supabase write.
- The Dev schema has zero configured division overrides after migration. New private functions use
  fixed search paths and retain owner-only execution.
- `npx tsc --noEmit` and `npm run build` passed. The build retains its existing large-chunk warning.
- The required full `npm run lint` still reports the unchanged repository baseline of 433 errors
  and 89 warnings. The three changed admin files retain their existing 20 errors and 7 warnings;
  no new lint category was introduced by this change.

What Aaron should test next:

- On Dev, set one test division to 70 minutes, leave another blank, and confirm the displayed
  inherited duration.
- Edit a future fixture with an exact finish, then move only its start and confirm the same duration
  is preserved.
- Keep `main`, `prod` and Production retention untouched until the separate promotion and deletion
  approvals.

Risk level:

- Medium. This includes an additive Dev schema and RLS change plus prepared workflow behaviour.
  It includes no data backfill, Production write or Storage deletion.

## 30 July 2026 - Fault-tolerant scraper Production release

What changed:

- Created and independently verified a fresh three-file Production logical backup before schema
  work at `C:\Users\mulla\AppData\Local\SportStack\backups\prod\2026-07-30-pre-fixture-timing-398f386`.
- Applied Production migration `add_division_match_durations` and verified the column, constraint,
  four triggers, scoped Division write policy, fixed function privileges and migration history.
- Re-ran rollback-only live assertions for division duration, exact fixture finish, moved-start
  duration preservation and fill-in access expiry. All 21 existing division overrides remain null.
- Fast-forwarded `398f386` through `dev`, `main` and `prod` without force-pushing. The consolidated
  Production scraper workflow is now active on GitHub's default branch.
- Verified successful staging and Production Vercel deployments. Production returned HTTP 200,
  signed-out `/dashboard` redirected to `/login`, the browser reported no console errors, and the
  deployed bundle referenced Production Supabase but not Dev Supabase.
- Ran read-only Production Storage diagnostic `30528787498` and retention dry-run `30529006936`.
  No Storage object was deleted during those read-only runs.
- After Aaron supplied the exact destructive confirmation, guarded apply `30530191487` removed the
  approved 969 old scraper-backup objects using 1,533,329,605 bytes.

Storage cleanup outcome:

- Production `scrape-backups` now has 44 retained objects using 60,176,404 bytes. The three other
  app-data buckets were excluded and remain unchanged.
- Workflow post-delete verification found zero approved deletion candidates remaining and zero
  retained objects missing. An independent database query matched the 44-object/60,176,404-byte
  result.
- Exact plan SHA-256:
  `0f76b636191078b6e5c6fe971110058d4ad8560142617398299069fa2ee549c2`.

Checks run:

- All 83 Python tests passed and all seven workflows passed `actionlint` 1.7.12 before release.
- `npx tsc --noEmit` and `npm run build` passed before release; the existing large-chunk warning
  remains unchanged.
- Production migration metadata and transaction/rollback functional checks passed after apply.
- Supabase security and performance advisors were rerun; the existing unrelated backlog remains,
  with no finding tied to the new private functions or duration column.

What Aaron should test next:

- Complete the signed-in Production smoke test for the duration fields and key administration pages.
- Allow the Supabase organisation-wide GB-hour Storage graph time to reflect the completed cleanup.

Risk level:

- High for the completed Production release because it included an additive Production migration,
  workflow schedule activation, public deployment and an approved permanent deletion of old backup
  objects. The 44 intended recovery objects remain present.

## 30 July 2026 - Obsidian note continuity

What changed:

- Added a one-way, verified sync from committed SportStack Markdown to the Hermes Obsidian Vault.
  The repository remains authoritative; the generated Vault mirror is read-only.
- Added a tracked whitelist so only root Markdown and Markdown under `docs/` and `notes/` is copied,
  plus the extensionless Planner note. Secrets, environment files, data, SQL and backup files are
  excluded.
- Added a generated Vault index and hash manifest, a verification-only mode and a local audit log.
- Added a daily Windows task named `SportStack Obsidian Note Sync`. It runs at 7:00 pm local time,
  catches up when the computer was unavailable and publishes from `origin/dev` rather than the
  current working branch.
- Added the mandatory start/close-out routine to `AGENTS.md`: refresh and read the Vault before
  meaningful work, update the repository notes during work, then sync and verify after pushing.

Files changed:

- `AGENTS.md`
- `CODEX_HANDOFF.md`
- `config/obsidian-note-sync.json`
- `docs/current-state.md`
- `notes/README.md`
- `scripts/register-obsidian-note-sync-task.ps1`
- `scripts/sync-sportstack-notes-to-obsidian.ps1`

Checks run:

- Both PowerShell scripts passed parser validation and the JSON configuration parsed successfully.
- A temporary Obsidian vault completed an exact 44-file sync and independent hash/manifest check.
- A deliberate mirror edit failed verification as designed; the next sync repaired it and the
  follow-up check passed.
- The Windows task registered successfully and reports its next daily run.
- The real Hermes Vault mirror was refreshed from the committed `origin/dev` notes and passed
  `-Check` verification.
- `npx tsc --noEmit` and `npm run build` passed. The existing large-chunk build warning remains.
- The required full `npm run lint` retained the unrelated repository baseline of 433 errors and
  89 warnings. This documentation/PowerShell-only change adds no linted application source.

What Aaron should test next:

- Open `Projects/SportStack Repository/_Index` in Obsidian and follow one link to a repository note.

Risk level:

- Low. This adds documentation tooling and a reversible current-user scheduled task. It makes no
  application, database, Supabase Storage, secret or Production change.

## How to update this file

When Codex finishes a task, add a dated entry with:

- What changed
- Files changed
- Checks run
- What Aaron should test next
- Risk level
- Any unknowns that still need confirmation

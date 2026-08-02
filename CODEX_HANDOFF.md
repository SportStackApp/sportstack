# Codex Handoff

Last updated: 2026-08-02

Future agents should start by reading these files in order:

1. `AGENTS.md` — repository rules, safety constraints, release path and testing expectations.
2. `docs/current-state.md` — current implementation, deployment and owner-test status.
3. `docs/project-brief.md` — concise product and architecture context.
4. `docs/scraper-operations.md` — current scraper, backup and retention routine.
5. `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md` — fuller technical context when needed.

## Current release state

- The 2 August unattended Dev pass is recorded in `docs/owner-test-matrix.md`. It traversed the
  primary permission, navigation, Fixtures, Communications, Player MVP Voting, Umpire Match Voting,
  Coaching/Profile, Formation, Safety Hub and Committee screens without changing test data. The
  detailed matrix distinguishes read-only passes, partial failures and actual-role/write tests that
  are still required.
- Commits `879d184` and `5514996` add frontend guards against the cascade replacing a deliberate
  Super Admin selection. Unit, focused lint, TypeScript, build, Dev Quality runs `30746490223` and
  `30747852160`, and both Vercel deployments passed. Fresh deployed build `5514996` still redirects
  `/admin` to `/dashboard` and restores Team Manager after Super Admin is selected. The remaining
  session-context/navigation cause is open; do not record this workflow as passed.
- The unattended pass found remaining product gaps: mode labels and direct-route restriction can
  disagree with Viewing as; scoped user rows show global rather than contextual roles; My Dashboard
  still misformats byes; the Fixtures calendar is only a grid view; legacy chat edits have no
  revisions; Umpire Match Voting search is too broad; and Squad/Roster do not provide the complete
  coach selection and distribution workflow. Source review confirms Player MVP Analytics already
  has the requested three URL-backed tabs.
- Exact source causes are now recorded: the Umpire ballot uses stored roles rather than active mode,
  `/admin/analytics` lacks a direct module gate, the Admin badge uses the highest stored role,
  Dashboard duplicates the bye formatter with unconditional fallbacks, and Umpire suggestions load
  active memberships from every team in both fixture clubs. The user Edit Details action is an
  in-page dialog, so its observed Dashboard return belongs to the remaining mode/navigation reset.
- Read-only Dev checks found no configured permission groups, sets, assignments, overrides or
  module flags, and no communication revision rows. Membership integrity totals remain 201
  duplicate groups, 44 multiple-Primary users and 490 immutable snapshot rows. No database write,
  cleanup, `main`, `prod`, Production, domain or redirect change was made during the unattended pass.
- Current quality checks pass: development-plan lint, TypeScript, production build and all 125
  Python tests. Full repository lint remains at its known 362-error/76-warning baseline.

- The locked Owner-Test remediation package is implemented against SportStack Dev and mapped in
  `docs/owner-test-matrix.md` for integrated owner testing. It covers scoped administration and
  audit, state persistence, cascade/navigation, Fixtures and Communications, both voting modules,
  Coaching/Profile, Safety Hub and Committee Management. `main`, `prod`, Production Supabase, DNS
  and redirects are unchanged.
- All additive Dev migrations in the remediation package are applied. All new public tables have RLS, new administrative
  functions reject anonymous execution, and private committee uploads are limited to 20 MB.
- The 2 August permission extension adds scoped named groups, reusable module-access sets,
  assignments to roles/groups/users and reasoned direct exceptions. Rolled-back Dev tests passed
  for group denial, direct-user precedence, Club Admin hierarchy and clean rollback. The existing
  `is_super_admin()` helper was schema-qualified for reliable use inside hardened functions.
- The actual Admin Sportstack account is now signed into Dev and confirmed as a real `SUPER_ADMIN`.
  The secure `provision-dev-test-account` Edge Function is active as version 6 with JWT verification
  enabled. It validates the live Auth session and current Super Admin role, creates accounts once
  and refuses to reset an existing identity; no authentication bypass was added.
- The first owner test found a stale `public.app_role` cast in `admin_save_user_roles`. Dev actually
  uses `public.user_role_enum`; migration `20260801131220_fix_admin_role_enum_reference.sql` fixed
  that single reference. The corrected save passed its rolled-back Dev transaction check.
- Follow-up migrations `20260802105000_transactional_dev_account_and_role_guards.sql`,
  `20260802106000_mode_aware_permission_management.sql` and
  `20260802107000_mode_aware_permission_listing.sql`, plus
  `20260802108000_harden_permission_group_assignments.sql`,
  `20260802109000_authorise_dev_test_provisioning_session.sql` and
  `20260802110000_mode_aware_runtime_permissions.sql`, passed rollback compile/runtime checks and
  are applied to Dev. Duplicate role rejection, function-access checks and mode isolation passed.
  Mode-aware permission reads and writes are implemented, and group assignments enforce exact
  scope and member hierarchy; the actual-role browser matrix is still pending.
- Migrations `20260802113500_session_bound_permission_context.sql`,
  `20260802114000_enforce_committee_safety_module_access.sql` and
  `20260802115000_enforce_voting_module_access.sql` are applied to Dev. Matching Dev commit
  `a06ae9a` is live, `mvp-voting-email-reminders` version 4 and
  `public-umpire-match-voting` version 5 are active, and their HTTP boundary checks passed.
- Seven isolated Dev test accounts now exist for Association Admin, Club Admin, Team Manager,
  Coach, Player, Umpire and Voter testing. No credentials are stored in the repository. The safe
  duplicate-provisioning check returned `409` without resetting or rescoping the existing account.
- The historical-membership snapshot contains 201 duplicate user/team groups and 44 users with
  multiple active Primary memberships (490 captured rows). New invalid writes are blocked; no
  historical row was changed and cleanup still requires separate approval.
- Quality status for the package: baseline-aware development-plan lint, TypeScript, production
  build and 30 focused migration/security tests pass. Repository-wide lint remains a separate baseline
  of 362 errors and 76 warnings.

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
- The Production preflight now stops at the branch-alignment gate. The development-plan package is
  ahead of `main`, and the reviewed package includes a workflow capable of selecting Production targets.
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
- Block 7 is implemented on Dev pending owner smoke testing. Communications now displays the exact
  selected audience, confirms Club and Association broadcasts before publishing, preserves older
  message deep links, resets permission/reminder state between scopes and reports load/save errors
  without showing stale or false-empty data.
- Block 8 is implemented on Dev pending owner smoke testing. Player MVP Voting's existing atomic
  3-2-1 path passed a live integrity audit. Signed-in Umpire Match Voting now lists completed fixtures
  only, validates the full ballot and writes its header plus lines atomically through the new
  `submit_umpire_match_vote` function. Browser direct inserts are revoked; Production is unchanged.
- Block 9 is implemented on Dev pending owner smoke testing. Fixture import and manual fixture
  editing now preserve division/season scope and block ambiguous team matches. Membership-request
  approval and unused-venue deletion are atomic, server-authorised Dev functions. A read-only audit
  found existing duplicate membership data; it was documented without changing any existing row.
- Block 10 is implemented on Dev pending owner smoke testing. Roles & modules now includes live,
  inherited module controls at association, club, division and team scope. Scoped administrators
  can confirm an enable/disable override or restore inheritance; module routes and navigation use
  the effective setting. Existing modules default to enabled and Hockey Trace defaults to disabled.
- Block 11 is implemented on Dev pending owner smoke testing. Association and club committees now
  support custom positions, President designation, eight position permissions, dated appointments,
  governance document links and qualification/expiry records. Committee data is private to scoped
  administrators and current members; Dev contains no committee records yet.
- Block 12 is implemented on Dev pending owner smoke testing. Committees now have atomic polls with
  free-text, choose-one, choose-multiple and Yes / No / Abstain questions; reusable agenda templates;
  meetings with minutes, decisions and assigned actions; current-member-only chat; and append-only
  activity history. Voting and chat require an active appointment with the explicit position
  permission, including for administrators.
- Block 13 is implemented on Dev pending owner smoke testing. The live Safety Hub forms now save
  Risk, BE SMART Action, QI, Bright Idea, committee-review, risk-review and permanent-link records
  atomically behind existing scoped RLS. Audit history remains append-only. Committee meeting
  decisions can link only to real Safety Hub records inside the committee's association/club scope.
- Block 14 is implemented on Dev with ongoing monitoring. Dev Quality now checks focused plan lint,
  TypeScript, the production build, 100 Python regression tests and all workflow definitions on
  each `dev` push and relevant pull request. Remote run `30654055573` passed at `978737b`.
- The 1 August read-only monitoring snapshot found the latest Dev scraper and five latest scheduled
  Production scraper runs successful. Notification cron jobs reported successful latest runs, and
  Production retained the expected 44 scraper backups using 60,176,404 bytes.
- Do not merge or cherry-pick `chore/domain-structure` commit `3a7d6cc`; it contains the superseded
  assumption that `hb` belongs to the separate ignored Hockey Ballarat module. The corrected work
  is being landed directly on `dev`.

## Local repository cleanup

- The previous eight local stashes were preserved in the verified bundle
  `C:\Users\mulla\AppData\Local\SportStack\backups\local-git\sportstack-stashes-20260730-144716.bundle`.
- The live stash list was then cleared. Keep the bundle until the scraper-routine work is accepted.

## Best next owner test

1. Use the prepared isolated Dev accounts to follow `docs/owner-test-matrix.md` one line at a time.
2. Start with the new permission groups, module sets, role/group/user assignments and direct exceptions,
   then confirm Club Admin user visibility and higher-role protection.
3. Test multi-team cascade selection, Team Overview, tabs, filters, drafts, refresh and incognito
   theme persistence.
4. Test Fixtures/bye display, chat history/pagination, Player MVP identity and status, and Umpire
   Match Voting number-only validation.
5. Test one disposable Safety Hub matrix/link workflow and one Committee meeting, upload, agenda,
   minutes and linked-record workflow.
6. Keep the 201 duplicate membership groups unchanged until Aaron approves the exact cleanup report.
7. Only after acceptance, promote the reviewed package to `main`. Production and domain work remain
   separately approval-gated.

Keep Player MVP Voting and Umpire Match Voting separate. Hockey Trace remains experimental and
disabled by default.

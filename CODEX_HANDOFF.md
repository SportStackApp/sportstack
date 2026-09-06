# Codex Handoff

Last updated: 2026-09-06

## 6 September — B1c membership workflow deployed to Development

- Migration `20260906095820_b1_membership_workflow_compatibility.sql` is applied and recorded on
  Development. It converges the Production and Dev primary-team request models on six hardened
  lifecycle RPCs, two read-only RLS policies, no anonymous table access and authenticated SELECT
  only. Browser mutation is RPC-only.
- The exact final migration passed first apply, repeat apply, role allow/deny tests and rollback on
  a fresh Production-derived B1a+B1b database. Protected counts remained 757 profiles, 1,260
  memberships and six requests. Hosted Dev compatibility, apply, runtime and database lint pass.
- The completed security review has zero reportable findings. A small request-state error side
  channel was nevertheless removed before Dev, and runtime verification no longer emits selected
  identifiers to logs.
- Full verification passes: static migration checks, focused lint, 46 Vitest files/181 tests,
  TypeScript and Production build. Full lint stays at its existing 346-error/77-warning baseline.
- Production was inspected read-only and its canonical B1c inventory is unchanged. B1d application
  allow-list reconciliation and a complete hosted B1 rehearsal are next. Evidence:
  `docs/production-readiness/B1-MEMBERSHIP-REHEARSAL-2026-09-06.md`.

## 6 September — B1b security bridge rehearsed

- New additive migration `20260906075102_b1_security_compatibility.sql` installs the curated B1
  security functions, permission seed, RLS policies, integrity triggers and minimum grants after
  B1a. Static verification covers 38 functions and 11 policies and confirms no anonymous B1
  access.
- The exact migration passed first apply, repeat apply, runtime permission checks and rollback
  against an isolated Production-derived database. Profiles remained 757, memberships 1,260 and
  primary-team requests six. A live Development rollback-only compatibility check also passed.
- The security review's only finding was a low-severity cross-user scope-status probe. The bridge
  now binds authenticated callers to their own user ID while retaining an explicit service-role
  path. Both the denial path and legitimate Super Admin path pass at runtime.
- Development records migration `20260906075102`. Its hosted runtime denial and legitimate Super
  Admin paths, database lint and error-level security/performance advisers pass. Dev Quality run
  `34024930224` and deployment `6291396626` pass at `4647165`, with matching deployment and
  Dev-alias app shells. B1c membership workflow, B1d application allow-list and the
  complete hosted rehearsal remain required. Production was not changed. Evidence:
  `docs/production-readiness/B1-SECURITY-REHEARSAL-2026-09-06.md`.

## 6 September — B1a dormant foundation rehearsed

- Read-only live comparison confirmed Production lacks 12 B1-owned tables, one private sequence and
  their later security layer. The corrected 878-row map now includes collision-free constraints,
  indexes and stable function-grant identities; no table data or credential was captured.
- New additive migration `20260906063905_b1_foundation_compatibility.sql` creates only those dormant
  structures. It excludes functions, policies, triggers, catalogue/application data and browser
  grants, and it does not replace Production's existing primary-team policies or helper functions.
- A Production-derived local restore passed first apply, repeat apply and transactional rollback.
  Profiles (757), memberships (1,260) and primary-team requests (6) remained unchanged. A local Dev
  repeat comparison matched all 10,382 public/private catalogue entries, so existing Dev behaviour
  is unchanged. Development now records migration `20260906063905`; Production's migration history
  remains unchanged.
- Final B1a implementation/audit commit `d70fc287` passed Dev Quality run `34019337864`. GitHub deployment `6290411884`
  succeeded, and its deployment URL and the Dev alias returned identical app-shell hashes.
- The backup has managed Auth/Storage restore limitations. The complete package still requires B1b
  security, B1c membership workflow, B1d application allow-list, a hosted Production-compatible
  rehearsal and independent review before a Production approval request. Production is unchanged.
- Evidence: `docs/production-readiness/B1-FOUNDATION-REHEARSAL-2026-09-06.md`.

## 6 September — Main-to-Production reconciliation Stage 1 complete

- Production remains unchanged at `a1d23c7`. Read-only evidence was captured without table data or
  credential output.
- Main `af21ae3` is 266 commits and 438 paths ahead of the shared history with Production, while
  Production has one unique commit. The 115 changed migration paths are 114 Main-only plus the
  Production-only tally baseline, not 115 additions.
- Remote Production history has 159 versions and Main has 186 migration files, with only eight
  matching version names. A direct historical migration push or bulk history repair is unsafe.
- The complete migration CSV classifies all 115 changed paths. The current direct-apply allow-list
  is empty: the next deliverable is a new additive B1 compatibility bridge built from live schema
  comparison and rehearsed against a fresh Production-derived copy.
- Production's 11 deployed Edge Functions include eight source-drift cases or branch mismatches;
  `bulk-import-players` is deployed but absent from Git. Preserve deployed versions until each
  function is reconciled. No function deployment is currently approved.
- GitHub's default branch is Main, so scheduled scraper workflows operate from Main rather than
  Prod. The latest six Production scraper runs are green, but the named-final blank-round fix is
  still Dev-only and the workflow remains a separate approval package.
- Authoritative evidence: `docs/production-readiness/MAIN-PRODUCTION-RECONCILIATION-MAP-2026-09-06.md`
  and its 115-row CSV register. The sanitised raw schema/function evidence remains uncommitted under
  `outputs/production-reconciliation-2026-09-06-detail`.
- Audit/map validation, 46 Vitest files/181 tests, TypeScript, Production build and focused lint
  pass. Full lint is currently 346 errors/77 warnings, three errors above the older 343-error
  baseline; the new audit scripts have no lint errors.

## 6 September — eligible Dev material promoted to Main

- Main now contains the reviewed Player MVP lifecycle release tools, release evidence and current
  backlog documentation through source Dev commit `2d7ed63`; promotion base `a5417f2` passed
  TypeScript and the Production build.
- Application source, migrations and Edge Functions are identical between Dev and Main. Four
  scraper-related files remain deliberately Dev-only: the Production scraper workflow, the
  named-finals schedule helper and two focused tests. They require a separate workflow review.
- Production was untouched.

## 6 September — Player MVP lifecycle repair released to Production

- Production is now at `a1d23c7`. Aaron approved the refreshed exact package after a legitimate
  new Pumas `AUTO_OPEN` row and its 13 configured opening emails were inspected and incorporated
  into the guarded baseline.
- The release created and hash-verified roles, schema and data backups at
  `C:\Users\mulla\AppData\Local\SportStack\backups\prod\2026-09-06-105953-pre-player-mvp-lifecycle-a1d23c7`,
  then applied only migration `20260905131718` and fast-forwarded `prod` without rewriting history.
- Production now has zero overdue `OPEN` sessions, 360 `CLOSED` sessions, 396 audit rows, one
  closure job and two deadline triggers. Notifications remained 24 and Player MVP email events
  remained 341 during release.
- The Production bundle contains `a1d23c7`, retains the Player MVP tally and references only the
  Production Supabase project. Separate Verify mode passes and database advisers return no
  error-level finding.
- Aaron confirmed past-deadline sessions show only as **Closed**, all expected Pumas rounds are
  present and the Production builder preview otherwise behaves as expected. No real-player
  presentation has been published. The next-fix queue now prioritises the builder draft resetting
  after leaving its tab, SportStack-name display and the Annabelle Fill-in identity investigation;
  the zero-ballot, finals labels and presentation-polish requests are also recorded.

## 5 September — lean readiness candidate is staged, not Production-ready

- Dev is deployed at `b8687ec`; Main staging is deployed at `e6fda0f`; Production remains unchanged
  at `15223e9`. Dev Quality `33969370123` and both recorded Vercel deployments passed.
- Production commit `15223e9` is now an ancestor of the Dev/Main history without replacing the more
  complete Dev Player MVP implementation. The later additive lifecycle migration restores the
  closure function, one-minute job and deadline triggers after either tally migration path.
- Live Dev has zero overdue open Player MVP sessions, 362 closed sessions, one closure job and two
  triggers. Re-running the closer processed zero rows. Notifications remained 957 and Player MVP
  email events remained 34.
- The Production-derived rehearsal closed exactly 355 overdue sessions, increased audit rows from
  40 to 395, and left 24 notifications, 328 Player MVP email events and 96 email-on team settings
  unchanged. Transaction rollback and isolated real-apply tests passed. The local restore had 29
  managed Auth/Storage compatibility errors and used a local-only Storage scaffold; treat it as
  application-data lifecycle proof, not a fully faithful hosted restore.
- The frozen candidate passed 46 Vitest files/181 tests, TypeScript, Production build, tally feature
  verification and the 343-error/77-warning lint limit. Main passed the focused tally checks.
- The blank named-final scraper fix remains Dev-only. Main has no change from its prior version in
  the four affected scraper workflow/script/test paths. The latest four Production scraper runs
  failed with blank round numbers, so the Production workflow remains red and excluded.
- Do not merge Main directly to Production. The delta is 259 commits and 434 paths, including 115
  added migrations, 15 Edge Function files and three workflows. The broad Production-derived
  sequence is blocked at `20260801013000_harden_field_template_grants.sql` because
  `public.field_templates` does not exist in Production. Build a curated Production-baseline release
  branch and an explicit migration map first.
- Actual Coordinator-role browser acceptance is still blocked because the controlled browser is
  signed out and the reserved account helper cannot create that direct permission bundle.
- The current inventory, required exclusions, reconciliation counts and rollback steps are in
  `docs/production-readiness/SPORTSTACK-PRODUCTION-READINESS-PACKET-2026-09-05.md`. Exact allow-lists
  are not frozen. Production needs a fresh owner approval only after all relevant packet blockers
  and readiness gates are resolved or explicitly deferred.

## 5 September — Player MVP presentation is the immediate owner priority

- The narrow Player MVP tally slice is live in Production at `15223e9`. The guarded release created
  and verified a logical backup, applied only migration `20260905040425`, fast-forwarded `prod` and
  passed the independent Production bundle/schema verification. No Edge Function, workflow, DNS,
  secret or external-email change was included.
- Aaron's first Production smoke found 15 Pumas sessions past their deadline but still stored as
  `OPEN` (426 votes); only one session is stored as `CLOSED` (42 votes). The admin page derives a
  closed/expired display from the deadline, while the tally builder requires real `CLOSED` status.
  `EXPIRED` is not an enum value. No real presentation has been published and smoke is paused.
- Root cause: the broad Dev refine migration supplies the closure function, vote/submission guards
  and one-minute cron, but the narrow Production migration intentionally omitted all closure
  behaviour to avoid changing 355 existing overdue sessions during the tally-only release. Prepare
  and rehearse a small additive follow-up, then seek separate explicit Production approval.
- Dev end-to-end tally acceptance is complete through `5338c0a`. One labelled Pumas presentation was
  published to the reserved Player only, opened from its in-app notification, denied to the reserved
  Voter, tested at three viewports, then withdrawn with an audit reason. External email stayed
  `NOT_QUEUED`; both test accounts were signed out and reset.
- Fixes `40409af`, `6c87ae1`, `1bb7621` and `5338c0a` remove the confirmed tally
  accessibility/overflow defects, expected-denial 406/console noise and stale unavailable state
  when a presentation route changes in place. Dev Quality `33938772306`, Vercel, 46 files/181
  Vitest tests, tally verifier, TypeScript and build pass; full lint is the unchanged 343/77 baseline.
- Production remains missing the tally schema. At the tested application commit, the broad Dev
  difference is 243 commits, 114 migrations, 15 Edge Function files and 3 workflows; it would also
  touch 355 overdue sessions
  and 96 email flags. Do not promote it as the tally release.
- The narrow package is frozen at `15223e9b` on
  `codex/player-mvp-tally-production-slice`, directly from Production `682b8ea`. It uses manual
  publication, rule-based commentary and in-app notification only, with one consolidated additive
  migration and no Edge Function or workflow.
- Docker recovered. A focused local Production-dependency reset and transactional rehearsal passed
  manager build/preview/publish/withdraw, recipient access, unrelated denial, RLS/grants, one in-app
  notification, Storage scope, rollback and unchanged sentinel data. Supabase schema lint, focused
  lint, 2 files/11 tests, TypeScript and the Production build pass. Full baseline lint is 229/50.
- The isolated hosted `SportStack-staging` Supabase project `fdkgcwacuqoswnatvubv` now has the
  dependency rehearsal baseline, exact candidate migration and a staging-only scaffold hardening
  migration. The hosted transactional suite passed and rolled back to zero presentation,
  notification and helper rows. All public tables have RLS; the tally tables deny direct
  authenticated writes. Adviser output has no RLS-disabled error: 14 scaffold-only no-policy INFO
  items, six intentional authenticated `SECURITY DEFINER` tally RPC warnings, and performance INFO
  only. Production was not touched.
- The Production smoke identities are Admin Sportstack as manager, with Chloe Wilson and Aaron
  Mullane as recipients. Both recipients are active, non-placeholder Pumas members. Aaron's personal
  account has only the Player role, so it cannot run the builder. Aaron accepted the unchanged
  dependency debt for this narrow release on 5 September; remediation remains separate. The
  original release gate was satisfied by Aaron's exact approval; the lifecycle repair is a new
  approval-gated Production package.
- `scripts/release-player-mvp-tally-production.ps1` is the only release script for this narrow
  slice; do not use the older Umpire Portal script. It pins the base/candidate commits, 14 changed
  paths, migration blob and Production project; defaults to read-only Preflight; requires the exact
  release phrase; creates and verifies roles/schema/data backups before migration; applies only the
  tally migration; then fast-forwards `prod` and verifies the bundle. Local Git/public-site checks
  pass and its two negative safety tests stop correctly. Current Production Vercel rollback target
  is `dpl_BxfnnYSLbrrgkxTsuu5mgxf5vV5S` at `682b8ea`.
- The tally-specific access file is configured outside the repository with Windows encryption. Its
  token can see healthy SportStack Production, and `Preflight` passed through access, isolated link,
  schema drift, migration dry-run and backup-readiness checks. That pre-flight itself made no
  Production change.
- The candidate does not change dependencies. `npm audit --omit=dev` on the Production baseline
  reports 14 existing runtime-tree findings (1 low, 1 moderate, 12 high); `xlsx` has no npm fix.
  Keep the exposure/upgrade review separate from this narrow release and do not bulk-update blindly.

## 5 September 2026 — readiness work package 3 deployed to Dev

- Replaced Fixture Management's browser-wide active-dialog key with expiring account/role-mode/
  cascade-scoped session state. Delete confirmations are never restored. This remembers dialog
  identity only, not unsaved Add/Edit form fields; the legacy key is removed.
- Replaced the signed-in Umpire Match ballot's account-only raw JSON with a validated expiring draft
  per account in native sessionStorage. Tabs have independent storage even when a copied tab starts
  with the same key/value. Actual-helper Chromium checks passed copy/edit/clear/refresh isolation.
  Successful hierarchy/fixture/player loads validate saved IDs; failed loads retain work. Reset and
  successful submit clear this tab only; unfinished work has a leave-page warning, not browser-restart
  durability.
- Replaced Chat's text-only local draft with a validated account/channel envelope containing text,
  reply ID, Important and mention IDs. Failed validation keeps saved IDs; confirmed invalid IDs clear.
  Old replies outside the first message page are checked separately. Scoped channel/message requests
  reject late results; Cancel Reply keeps text; saved-message editing keeps the new-message draft.
- Actual shared-control browser measurements passed 44 px and no overflow at phone, tablet and
  desktop sizes. These are isolated local components, not signed-in route or Safari acceptance.
- Final code checks pass: 45 Vitest files/180 tests, 153 Python unittests, five Umpire source checks,
  locked development-plan lint, TypeScript and Production-mode build. Full lint remains existing
  debt at 343 errors/77 warnings. Independent source review and seven actual-Chat isolated browser
  checks pass. Source `464d809` passed Dev Quality `33928475268` and Vercel. Dev and its commit
  preview serve the same `/assets/index-DWsFbnAl.js` bundle (HTTP 200, expected commit present). Actual-role
  deployed acceptance is still blocked; local mocks do not prove live permissions or delivery.
  No migration is included; Main, `prod` and Production remain untouched.

Full timing, package and evidence record: `docs/production-readiness/2026-09-05-readiness-run.md`.
The six-hour run was interrupted; resumed work completed the open batch and verification, not a
new overnight budget. Remaining work stays in the single consolidated plan.
The signed-out `/chat` route redirects to Login with the correct return URL and no observed page
errors. Authenticate a disposable account in the explicitly controlled browser to unblock live tests.

## 5 September 2026 — readiness work package 2 deployed to Dev

- Added accessible two-way sorting to every meaningful data column in Associations, Competitions,
  Clubs, Divisions, Teams and Venues. Related entities use their displayed names and numeric fields
  retain numeric ordering; sorting happens before pagination.
- Logo and Actions are explicit non-sortable columns. Division Age Group uses one formatter for
  both display and sorting, with a regression covering equal labels with different visible bounds.
- Focused tests, 42 Vitest files/164 tests, locked development-plan lint, TypeScript and Production
  build pass. Replacing obsolete competition casts reduced the full lint baseline from 349
  errors/77 warnings to 343 errors/77 warnings. Independent review found no blocker. Dev Quality
  run `33895737532` and Vercel passed for commit `7134f49`; authenticated browser verification remains.
- No migration is included. Main, `prod` and Production were not changed.

## 5 September 2026 — readiness work package 1

- Added a fail-closed direct-route assignment gate for unassigned and pending normal accounts,
  without removing Dashboard/Profile or discipline-only access. Pending-signup processing is
  de-duplicated when authentication and routing initialise together.
- Replaced all browser status transitions for primary-team changes with scoped server functions.
  Dev migrations `20260904153312_make_primary_team_change_atomic.sql`,
  `20260904155953_harden_primary_team_change_writes.sql` and
  `20260904160251_scope_primary_team_change_reads.sql` passed rollback, forged-write, authorised
  workflow, scoped-admin visibility and unrelated-admin denial checks. They are applied to Dev only.
- Added seven-day, account/owner/record-scoped draft storage for line-ups, formations and templates.
  Line-ups restore roster nickname choices, assignments, bench order and moved positions; missing
  formations safely return players to the bench. Failed loads cannot erase a valid draft or carry
  state between teams. Successful saves and explicit discards clear only the matching draft.
- Added Player MVP candidate regression coverage proving unmatched imported teammates remain on the
  ballot. Named shout-out visibility is still awaiting Aaron's audience decision.
- Applied the first shared form sizing batch: 44 px ordinary Input/Select controls, 40 px Safety
  filters and narrow-phone stacking for confirmed Fixtures, Committee, Coordination and Discipline
  date/time pairs. This does not complete the 42-control visual audit or site-wide sorting rollout.
- Live Dev feedback remains 35 CLOSED and 53 REVIEWED. The controlled automated browser is signed
  out, so deployed actual-role/responsive acceptance is still required. Do not close the affected
  P0 feedback or promote this candidate to Main on source evidence alone.
- Production, `prod`, Production data, functions, secrets and DNS were not changed.
- Deployed source `3a52bd9` passed Dev Quality `33893606813`; actual-role acceptance remains open.

## 5 September 2026 — single active plan and feedback reconciliation

- Replaced the dated multi-phase backlog with one active plan at
  `docs/consolidated-open-items-plan.md`. It now orders P0 access/privacy checks, shared
  form/table/persistence repairs, P1 product defects, acceptance cycles, lower-priority consistency
  work, data cleanup, staging and Production approval.
- Dev feedback retains all 88 records: 0 OPEN, 53 REVIEWED and 35 CLOSED. Every reviewed item has a
  category, priority, backlog reference and reason; none was falsely closed during reconciliation.
- `notes/known-issues.md` is evidence only and `docs/production-readiness/PLAN.md` is a detailed
  release reference only. Neither is a competing priority plan.
- Production and `prod` remain untouched.

## 4 September 2026 — Pumas placeholder and Dev Auth repair

- Reconciled five registered Pumas placeholders in place in Dev: their existing IDs and all known
  membership, RevSports-link and line-up references remain attached. The five profiles now use the
  confirmed identity data and real Auth emails. No email was sent.
- Restored David Jochinke's confirmed details after the failed admin save had partially written an
  incorrect date of birth. Pumas now has zero primary placeholders.
- Two secondary Pumas fill-ins remain legitimate unclaimed Lucas HC profiles in both Dev and
  Production. The roster picker now includes active members and previous fill-ins regardless of
  claim status, so these records are not hidden or removed.
- Normalised 731 Dev-only `banned_until = infinity` records to supported 100-year bans after a
  successful rollback rehearsal. All remain banned through 2126. This removes the Supabase Auth
  scan failure from Users and other Auth-admin paths without enabling any account.
- Added repository source and tests for `update-user-details`; deployed Dev version 7 matches the
  tracked source and keeps JWT verification enabled. Auth is validated before profile writes and an
  email change is rolled back after a profile failure. The admin dialog now surfaces response-body
  errors. The function is now Super Admin-only, matching the caller restriction already enforced by
  the Users screen.
- A disposable actual Super Admin smoke passed read, save, re-read and cleanup against the deployed
  function; no disposable account remains. The locked helper `dev-auth-admin-smoke` returns 410 and
  requires JWT, but CLI deletion was denied with HTTP 403. It is safe but should be removed from the
  Dev Supabase dashboard to eliminate function-inventory noise.
- Verification passes: focused lint, 35 Vitest files/136 tests, TypeScript and Production build.
  Full lint remains at the accepted 349-error/77-warning baseline.
- Production and `prod` remain untouched. Big Brain sync and validation passed for 67 files at
  `D:\AI-Workspace\Memory\Big Brain`; the saved `SPORTSTACK_OBSIDIAN_VAULT` user setting now uses
  that vault.

## 31 August 2026 — Player MVP Vote Tally Dev/Main readiness run

- Dev and Main now serve `1924404642710bf570e9bde424a09e34be181658`
  (`v2026.08.31+1924404`). The accessibility repair separates the embedded preview region from the
  one full-screen `main`, corrects heading hierarchy, names the speed/reduced-motion controls,
  shortens live announcements and makes a round jump resume playback. Finished playback now uses a
  disabled Finished control while Replay remains available.
- Deployed testing passes the embedded preview and full-screen Player route at 1440x900, 820x1180
  and 390x844 with no horizontal overflow and zero confirmed Axe violations. Pause/resume, replay,
  skip, speed, round jump, keyboard focus, reduced motion, final persistence, 3-2-1 scoring, ranking
  and podium behaviour pass.
- Disposable Dev presentation `096a67db-0cf4-4ea2-80db-eb1f75f5d942` proved notification deep-link
  access for the intended Player and denial for an unrelated Voter. Main presentation
  `770a6607-5f4c-4355-a9dd-456f9bee1124` proved the signed-in Main application bundle. Both were
  withdrawn with audit reasons and remain retained as withdrawn Dev rows.
- The reserved Player and Voter temporary passwords were rotated again after testing without
  revealing or retaining the replacement values. Temporary automation auth profiles and all four
  run-specific browser sessions were removed. No normal account was changed.
- Automated evidence passes: migration verifier, focused tally tests, focused lint, 33 Vitest
  files/129 tests, TypeScript, Production build and Dev Quality `33393069833`. Full lint matches the
  accepted 349-error/77-warning baseline.
- Production remains untouched. Live read-only reconciliation proves Production lacks the three
  tally tables, the eight public tally functions and `mvp-tally-commentary`; its dispatcher is v1
  and reminders v6 compared with Dev v8/v7. Main is 228 commits/398 paths/111 migration files/12
  Edge Function files/three workflows ahead of `prod`.
- Do not cherry-pick only the tally. Use
  `docs/production-readiness/PLAYER-MVP-TALLY-PRODUCTION-RELEASE-PACKET-2026-09-01.md` and its exact
  inventory appendix. The next safe step is an isolated Production-schema rehearsal and exact
  migration/function allow-list review, followed by Aaron's separate Production approval.

## 31 August 2026 — readiness inventory and completed Dev consistency batch

- Added current route, table and form registers under `docs/production-readiness/`; major open
  consistency gaps remain visible rather than being inferred as passes.
- Local Dev fixes cover the shared Viewing-as name/sidebar contrast, duplicate Safety donut
  accessibility, Player MVP Analytics operational sorting, Expense sorting and per-user
  browser-session filter persistence.
- Error Logs and Feedback now have typed two-way sorting for every data column, labelled fixed
  control columns, keyboard-operable Error details and corrected support-page heading hierarchy.
  Shared scope selectors and Feedback row status selectors are named, with repaired local contrast.
- Read-only Production scraper diagnosis proves that finals labels lose their numeric round value.
  The protected repair package is documented separately and was not implemented.
- Commits through `68192c4` are deployed. Analytics, Expense and support-table sorting pass their
  signed-in checks; Expense search persists through refresh without entering the URL; desktop and
  mobile Safety Hub report zero Axe WCAG A/AA violations. Feedback's deployed audit has no control,
  contrast or heading violation after the final support build.
- Vitest (33 files/128 tests), TypeScript, Production build and Dev Quality runs `33317078740` and
  `33317202053` and the support-table Dev Quality runs pass. Full lint improved to 349 errors/77
  warnings. Main, `prod`, databases and Production are unchanged.

## 30 August 2026 — walk-away consistency cycle and repair

- The completed signed-in Dev cycle found zero Blocker/High, four Medium and one Low defect. Existing
  sorting, RevSports filters, Quick Actions and repaired line-up interactions passed their checks.
- READY-011 to READY-015 cover the new defects: fixture team choice reset, cramped mobile pitch,
  Club Admin Player MVP route block, unlabelled formation select and blank legacy role label.
- Commits `99dff2c` and `bdc8867` are deployed on Dev. The latter keeps portrait marker centres
  within safe mobile insets. Commit `3a4ffd4` labels the mobile navigation and icon-only bench
  removal buttons after the live accessibility run found them unnamed.
- Signed-in closure passes at 390x844 and 1569x912: Pumas persists after refresh, Formation and
  Line-up team are named, there is no horizontal overflow or marker-label collision, and the final
  Axe WCAG A/AA run has zero violations. Two tool-incomplete Radix/contrast checks remain noted.
- Actual-role checks pass for all seven reserved disposable Dev identities. Club Admin reaches the
  club-scoped Individual Votes Log; Association Admin remains aggregate-only; Team Manager, Umpire
  and Voter reach their expected modules and are redirected away from Roles & modules. Current-cycle
  evidence also covers Coach and Player. No normal account was changed.
- Current checks pass: 33 Vitest files/128 tests, focused lint, TypeScript, Production build, Dev
  Quality runs `33297236883` and `33298089720`, and deployed-bundle checks. Full lint remains at
  350 errors/78 warnings. No Main, `prod`, Production or database change is included.

## 30 August 2026 — walk-away Dev-account operating rule

- Aaron reaffirmed that the seven reserved disposable Dev identities on **Roles & modules → Dev
  test accounts** are available for unattended actual-role testing. Hands-off password resets and
  recoverable Dev-only test changes are authorised for those identities.
- Temporary credentials must remain ephemeral and must never be committed, copied into Big Brain,
  included in screenshots or exposed in logs/chat.
- On 30 August, an Umpire temporary password was briefly unmasked in internal automation output.
  Codex immediately replaced it with an undisclosed random value through the authenticated Dev
  account and closed every automation browser session. Treat the earlier temporary value as invalid.
- A walk-away run is not ready until `npx agent-browser` proves control of a signed-in Dev browser,
  opens a protected route and completes one harmless interaction in the exact intended role/scope.
  A signed-in Codex in-app tab does not prove that the separate automation browser is authenticated.
- Production, `prod`, normal accounts, secrets, destructive cleanup and unrecoverable changes remain
  outside this standing authority.

## 30 August 2026 — READY-004 combined playing-position display

- Profile Team Player Details and Coaching Position Ratings now show one Playing position catalogue
  with combined choices such as Defender - Left, Midfielder - Centre and Attacker - Right.
- Area-only, side-only and Goalkeeper choices remain available. New paired choices use one stable
  `POSITION_<AREA>_<SIDE>` code and the appropriate canonical group.
- Existing separate preferences/assessments remain visible and were not guessed into pairs or
  rewritten. No data migration or backfill is included.
- Automated checks pass: 30 Vitest files/118 tests, TypeScript, Production build and focused lint.
  Full lint remains at the existing 350-error/78-warning baseline. Commit `6c3d87c` is deployed on
  Dev; Dev Quality, Vercel and deployed-bundle checks pass.
- Signed-in save/reload acceptance remains open; `main`, `prod` and Production are unchanged.

## 30 August 2026 — READY-005/006 coaching rating and card details

- Clicking an active coaching rating now clears it, while a different 1–4 value replaces it. Save
  failure restores the prior screen state and existing coaching notes are retained.
- Dev migration `20260830122500_allow_cleared_coach_position_assessments.sql` makes assessment null
  an explicit cleared state and enforces null or 1–4. All eight existing rows passed preflight. A
  temporary null update and rollback left zero null rows afterwards.
- The Cards summary is now a labelled button that opens the affected games and exact green, yellow
  and red card counts for the selected period.
- Automated checks pass: 30 Vitest files/117 tests, TypeScript, Production build and focused lint.
  Full lint remains at the existing 350-error/78-warning baseline. Commit `7b955e3` is deployed on
  Dev; Dev Quality, Vercel, deployed-bundle and signed-out return-path checks pass.
- Signed-in owner acceptance remains open; `main`, `prod` and Production are unchanged.

## 30 August 2026 — READY-002/003/007 pitch interaction repair

- Pitch players now open the same on-screen history as bench/reserve players. All games from the
  fixture's calendar year are shown newest first instead of only five.
- The dotted drag handle is removed. The entire marker is draggable, retaining the original grab
  offset so its centre does not jump to the cursor. A small movement threshold prevents a drag from
  also acting as a click.
- Selected pitch markers use a prominent amber ring. A normal marker click selects the position and
  opens that player's history.
- Automated checks pass: 29 Vitest files/115 tests, TypeScript, Production build and focused lint.
  Full lint remains at the existing 350-error/78-warning baseline. Commit `a08fad1` is deployed on
  Dev; Dev Quality, Vercel, deployed-bundle and signed-out return-path checks pass.
- No migration or live-data write is included. Aaron's signed-in click/drag/save/refresh acceptance
  remains open. Main, `prod` and Production are unchanged.

## 30 August 2026 — READY-001 roster selection safeguard

- The saved Pumas vs Blaze line-up contains 13 roster rows and 13 assignments. The old roster
  dialog excluded three selected placeholder-linked profiles while still counting them, which could
  remove them when the visible partial list was applied.
- The dialog now merges all saved selections into the normal candidate list and blocks Apply if a
  selected profile cannot be resolved. Regression tests cover selected-placeholder retention and
  unresolved-selection detection.
- Automated checks pass: 28 Vitest files/113 tests, TypeScript, Production build and focused lint.
  Full lint remains at the existing 350-error/78-warning baseline.
- **Passed and closed:** Aaron confirmed all 13 players were visible and selected, and that Apply,
  Save and refresh retained the roster and assignments. No migration or live-data write is included.
  Main, `prod` and Production remain unchanged.

## 29 August 2026 — Production readiness programme

- `docs/production-readiness/PLAN.md` now defines the full repair, consistency, missing-test,
  walk-away, Main and Production sequence. The measurable future release ledger is
  `docs/production-readiness/GATES.md`, and the unattended template is
  `docs/production-readiness/WALK-AWAY-CHARTER.md`.
- The known High application finding is the roster picker hiding selected placeholder-linked
  players and risking their removal on save. The latest Production scraper failure is also an
  operational High item. Both must close before a Production proposal.
- No application code, database object, live data, recurring automation, Main, `prod` or Production
  system changed in this planning pass. Production remains separately approval-gated.

## 29 August 2026 — admin, line-up and coaching improvement batch

- Branch: `dev`. Production and `prod` untouched. Main staging waits for owner acceptance.
- Dev migration applied: `20260829074811_admin_lineup_coaching_improvements.sql`.
- New schema: `profiles.preferred_name`, `profiles.nickname`, canonical formation area/side,
  fixture roster selections, fixture position overrides and author-private coach fixture notes.
- Line-up now uses Roster pop-up -> working Line-up column -> starting pitch/bench. It supports
  nickname display, recent match history and fixture-only marker movement/reset. Suggest is removed.
- Admin feedback implemented across navigation, Quick Actions, fixtures, Player MVP sessions,
  RevSports Review, analytics access and Safety Hub tables.
- RevSports investigation confirmed one old `In8n` venue parse plus two half-pitch-as-venue rows and
  their three pitch counterparts. All six are ignored in Dev; no row was deleted.
- Automated result: 28 Vitest files/111 tests pass; TypeScript and build pass; focused lint passes.
  Full lint reproduces existing debt at 350 errors/78 warnings. Supabase adviser output contains the
  established broad backlog and no missing RLS policy on the three new tables.
- Remaining acceptance: signed-in owner smoke on deployed Dev. Big Brain sync and check passed. Coach
  Narrative and app-wide preferred-name precedence are intentionally parked.

Future agents should start by reading these files in order:

1. `AGENTS.md` — repository rules, safety constraints, release path and testing expectations.
2. `docs/current-state.md` — current implementation, deployment and owner-test status.
3. `docs/consolidated-open-items-plan.md` — the single active implementation and cleanup priority.
4. `docs/project-brief.md` — concise product and architecture context.
5. `docs/scraper-operations.md` — current scraper, backup and retention routine.
6. `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md` — fuller technical context when needed.

## 29 August 2026 Player MVP tally presentation refinements

- Commits `1faf79f` and follow-up `71af047` are deployed on Dev and Main staging. Dev Quality runs
  `33235803032` and `33236928385` and both final
  Vercel deployments passed. Production and `prod` were not changed.
- Player MVP sessions now close automatically at their deadline through the private one-minute
  `close-due-player-mvp-voting` job. Unresolved incorrect-result checks become **Result concern**;
  the derived **Expired** status and copy were removed.
- A counted Dev dry run found 347 overdue sessions. Rollback verification passed before the additive
  migration was applied. All 347 were reconciled with actor-free audit entries; a repeat run
  processed zero, and the scheduled job's latest run succeeded.
- The tally builder now lists ordered rounds with state, ballot/eligible counts and exact disabled
  reasons. Closed, undisputed rounds require at least one ballot at save, preview, schedule and
  publish time.
- Appearance now includes scoped 2 MB PNG/JPG/WebP logo uploads, background descriptions, nine
  speeds and a top 3-50 or All leaderboard limit with cutoff ties.
- Playback uses full linked profile names, clickable rounds, speed-scaled six-second summaries and
  saved positive commentary. AI receives anonymous player tokens and aggregate totals only, has a
  five-second preview budget, and falls back to local rules.
- Owner testing found one player duplicated by two historical active Secondary membership rows.
  The builder now collapses overlapping membership rows by profile, prefers Primary over Secondary
  when both exist, and also deduplicates at the browser boundary before saving. No membership row
  was deleted or edited. The live Pumas audience now returns Reuben once.
- The final podium was changed from three narrow truncated boxes to full-width vertical cards with
  full names, avatars, place labels and points; tied podium players remain included.
- The transactional Dev database suite, nine focused logic tests, focused lint, TypeScript and
  build passed. Full lint remains at the known unrelated 359-error/78-warning baseline.
- Authenticated owner testing is still required for logo upload/removal, the complete preview,
  AI/fallback wording, publishing, player notification access and unrelated-player denial.

## 29 August 2026 desktop UI/UX walk-away review

- Dev and Main staging are aligned after reviewing the former 14-commit gap. No workflow or
  migration file was part of the promotion, and Production was not touched.
- Commits `72a3504` and `f5d3066` add accessible names to password visibility buttons, scoped
  Sign-up selectors, signed-in and public Umpire Match Voting selectors, and Fixture Management
  edit/delete icon buttons.
- Live Dev and Main browser snapshots expose the repaired names. The public no-login Umpire Match
  Voting form retained its entered name and email after a tab switch; no ballot was submitted.
- Authenticated focus persistence, including Roles & Permissions and other unsaved forms/searches,
  remains a priority check but is **Blocked** without a signed-in isolated-browser session. A true
  Windows focus event also could not be produced by the browser tool.
- Remaining public findings are authentication-page landmarks/headings, colour contrast and
  possibly stale Grampians Hockey/2024 landing branding. These were recorded rather than expanded
  into a larger visual redesign.
- Local verification passed focused and development-plan lint, TypeScript, build, all 87 Vitest
  tests and 153 Python tests. Dev Quality runs `33204772148` and `33205037798` passed. Full lint
  remains the known 359-error/78-warning baseline. No migration or retained test data.

## 28 August 2026 approved target access-control design

- `docs/access-control-model.md` now records Aaron's approved target design for scopes,
  responsibilities, permission sets, capabilities, paid-module entitlements, independent
  **Working as** contexts and temporary workflow assignments.
- The document includes the 15 agreed permission matrices and the approved membership, Primary and
  Secondary Team, Fill-in, exemption, Umpire rostering, voting, Committee, Incident and Discipline,
  Safety, communication, personal-information, audit, handover and account-closure rules.
- The existing Working as selector is retained as the initial UI; its visual redesign remains
  parked. Competition Coordinator and Safety Coordinator are deliberately excluded for now.
- This is a documentation-only target model. Current implementation differences remain and must be
  verified against the live Dev schema and app before a compatibility or migration plan is written.
- No code, schema, live data, module entitlement, deployment, Main, Production or domain was
  changed.

## 21 August 2026 Dev catch-up run

- Dev is pushed and deployed through `08b30f9`. Main and Production were intentionally left
  unchanged for a later staging/release decision.
- `a6f2354` resolves the transitive `nanoid` advisory. `7cbf2c1` completes Player Explorer totals,
  saved-filter lifecycle, persistence, Team Manager query scope and Admin-menu overflow.
- `ba76f5c`, `3c1c203`, `54b3ea9` and `bd04a9c` label Fixture byes and make Fixture dialogs explicit-
  close with per-tab focus restoration. `cd9da2f` stabilises scoped workflows and contextual Users
  roles. `7068c94` implements the requested Umpire Match Voting export, leaderboard, sorting and
  association player-picker package.
- `08b30f9` fixes live dashboard communication counts by querying
  `communication_channels.scope_type` instead of the non-existent `channel_type`. A post-deploy
  club-dashboard load produced no later instance of that error in PostgreSQL logs.
- Deployed Player Explorer Team Manager search, Club Admin contextual Users, scope transitions,
  Fixture bye/dialog behaviour and the principal Umpire Match Voting views passed. Communications,
  Coordination, Committee Management, Safety Hub, Expense Hub and Incident and Discipline passed
  read-only route smokes.
- Separate actual-role browser sessions and the final reserved Umpire Reset/password action are
  **Blocked** by browser credential policy. Do not convert the completed Viewing-as and SQL/RLS
  evidence into an actual-role Pass. Tablet/mobile testing is also blocked by the fixed authenticated
  viewport.
- Final gates: Vitest 23 files/87 tests, Python 153 tests, seven root scripts by exit status,
  development-plan lint, TypeScript, build and zero-vulnerability npm audit passed. Full lint is
  unchanged at 359 errors/78 warnings. The build keeps its existing Browserslist, SheetJS import
  and large-chunk warnings. `test_teams_data.js` still prints a missing `teams.team_type` response
  without failing, so retain the root investigation-script cleanup item.
- Remaining acceptance work: actual-role sessions when an owner can confirm the credential action;
  full disposable Coordination, Committee, Safety and Discipline write workflows; Team Chat
  broadcast-author/deep-link regression; and tablet/mobile coverage in a controllable browser.
- No migration is included in the 21 August code batch. No Production system, domain, secret or
  historical membership row was touched.

## 20 August 2026 Dev Umpire test-account reset repair

- The reserved Dev Umpire account already existed, so Create correctly returned a conflict. Reset
  failed with `user_roles_umpire_association_scope_check` because the older provisioning function
  still wrote an Association + Club + Team Umpire role after Umpire became Association-only.
- Additive Dev migration `20260820213845_fix_dev_umpire_account_scope.sql` preserves the wrapper
  called by the deployed Edge Function and routes Umpire through a corrected service-role-only
  helper. Other reserved test roles continue through the established legacy path.
- The corrected path writes exactly one Association-only Umpire role and keeps the selected team as
  an active Primary membership. Reserved-identity, actor and scope-chain validation remain enforced;
  anonymous and authenticated browser execution remains denied.
- Dry-run rollback and live transactional SQL regression checks passed. The migration is active on
  SportStack Dev only and required no Edge Function deployment. Validation rolled back its data.
- Next owner action: click **Reset account** for the reserved Umpire account. A success toast and
  working sign-in are the remaining browser acceptance evidence. Production is untouched.

## 20 August 2026 Umpire Match Voting owner feedback

- Umpire Match Voting administration data and correction passed owner testing.
- The consolidated plan now requires one Excel export with separate Seniors and Juniors sheets,
  using distinct vote-scheme columns instead of one combined Votes cell. `xlsx` is already present.
- The unfiltered leaderboard should show the association top 10. Division filtering should render
  a separate full leaderboard per selected division, allowing one player to appear independently
  in multiple division lists with division-only totals.
- Submission-table headings should toggle ascending/descending sorting. Round keeps its displayed
  label but sorts by linked fixture date; legacy unlinked rows fall back to numeric round and then
  submitted date.
- Existing vote-scheme and scheme-line fields should support the export without a migration.
  Legacy junior rows without line keys must use neutral A/B slots rather than guessed gender.
- Ballot default suggestions passed owner testing with linked fixture players only. The required
  follow-up is a deliberate two-level picker: type-ahead stays fixture-linked, while the magnifying
  glass opens a searchable association-wide player list scoped to the selected fixture/voting
  record, with team/division context and no cross-association results. Retain manual unlisted entry.
- No code, schema or live data changed in this planning pass.

## 20 August 2026 Player MVP emails default off on Dev

- Team Manager owner testing passed the Player MVP Voting enable switch and found that the separate
  email switch still inherited its old default-on value.
- Live Dev had 95 inherited on values, one explicit off value and no audited explicit email opt-in.
  Additive migration `20260820203326_default_player_mvp_notifications_off.sql` sets the future
  default to off and moves inherited values off while preserving any audited opt-in.
- All 96 Dev teams now have Player MVP emails off. The Blue team retains Player MVP Voting on. The
  two switches remain independent and a transactional active-Team-Manager toggle test passed.
- The UI fallback now also treats the setting as off, and
  `supabase/tests/player_mvp_notification_defaults.sql` protects the default and backfill rule.
- Owner refresh testing passed: Blue retained **Player MVP Voting is on** and **Email notifications
  are off**. An email-disabled Blue round opened successfully, appeared as Open with 0/14
  completed, and kept reminder/resend actions disabled. Aaron accepted the remaining ballot and
  result behaviour without extending the disposable test. Production and `prod` remain unchanged.

## 20 August 2026 Dev private-helper permission repair

- Owner testing found Player MVP Voting failing for a real Team Manager with `permission denied for
  function player_mvp_session_allowed_for_current_session`. Live logs showed the same root cause in
  Communications, fixture management and Incident and Discipline.
- The broad private-schema revoke in `20260817100200_create_coordination_module.sql` had removed
  earlier explicit authenticated grants. Live policy, wrapper and migration inspection identified
  36 exact helpers required by Player MVP Voting, Umpire Match Voting, Communications, Fixtures,
  Safety Hub, Incident and Discipline, session-bound module checks and Player MVP audit paths.
- Additive Dev migration `20260820182455_restore_private_helper_permissions.sql` restores only those
  signed-in grants. It also removes inherited anonymous execution from six later SECURITY DEFINER
  Coordination helpers; the directly policy-used helper keeps authenticated execution and the
  other five remain internal.
- The rollback test and `supabase/tests/private_helper_permissions.sql` pass. A real active Team
  Manager session now passes its Player MVP scope check, affected RLS reads execute without function
  permission errors, and unauthenticated context returns no protected rows. No table, policy,
  function body or data row changed.
- Retest Player MVP Voting, Communications, Fixtures, Safety Hub, Incident and Discipline and
  Umpire Match Voting in the browser. The Player Explorer timeout is separate and remains open.
- Dev only. Production, `prod`, domains, secrets and historical records were not changed.

## 20 August 2026 consolidated open-items audit

- The single active priority list is now `docs/consolidated-open-items-plan.md`.
- Repository inspection found a clean `dev` checkout at `d79067b`, matching `origin/dev` and
  `origin/main` at the audit start. `origin/prod` remains at `682b8ea` and behind Main; recheck the
  exact divergence before any release.
- GitHub has no open issues or pull requests. The latest Dev Quality, Dev scraper and Production
  scraper workflow runs all passed. GitHub Projects could not be inventoried because the active
  token lacks `read:project`; whether a project board is used remains `UNKNOWN — needs confirmation`.
- Live Dev read-only checks reconfirmed 201 duplicate membership groups, 44 multiple-Primary users
  and 490 snapshot rows. Adviser review found 115 security warnings and 181 performance warnings;
  these were added as a careful triage stream, not treated as safe bulk-cleanup targets.
- Quality checks passed TypeScript, the production build and focused plan lint. Full lint remains at
  its recorded 359-error/78-warning baseline. `npm audit --omit=dev` now reports one high-severity
  transitive `nanoid` 3.3.17 advisory through PostCSS; it needs a reviewed dependency/lockfile update.
- The plan places acceptance testing first, confirmed repairs second, database/data cleanup third,
  documentation cleanup fourth and the Production decision last. No application code, database
  object, data row, Production system, domain or secret changed during the audit.

## 19 August 2026 Player Explorer permission repair

- The signed-in Dev owner check exposed `permission denied for function
  player_explorer_external_entity_in_scope`. Live privileges confirmed that all five private Player
  Explorer helpers had lost `authenticated` execution.
- Root cause was the broad `revoke all on all functions in schema private from
  public,anon,authenticated` in the later Coordination foundation migration. The original Player
  Explorer migration had correctly granted the permissions before that reset occurred.
- Additive Dev migration `20260819193617_restore_player_explorer_function_permissions.sql` restores
  only the five required `authenticated` and `service_role` grants while keeping `public` and
  `anon` denied. No function body, RLS policy, table or data row changed.
- The exact grant set passed a rollback test before live application. Post-apply Dev checks
  confirmed authenticated helper execution and fail-closed zero-row access without a signed-in
  user. Main and Production remain unchanged.
- The next owner refresh reached the database but timed out on the unfiltered
  `source_revsports_player_appearances` freshness query. API logs showed the other opening requests
  returned 200. `PlayerExplorer.tsx` now calculates freshness from the scoped V2 matches it already
  loads, removing that unnecessary full-table RLS scan without changing data or access rules.

## 19 August 2026 scoped Umpire and Coordinator access

- Dev migration `20260819071731_scoped_umpire_and_coordinator_access.sql` is active. It makes
  `UMPIRE` association-only, treats that role as offer eligibility without a capability record,
  and keeps `SUPERVISING_UMPIRE` separate.
- The dry-run, rollback and post-apply checks confirm 17 Umpire rows for 17 people, all exactly
  Hockey Ballarat association scope. The four portal-origin decisions and all other evidence are in
  `docs/umpire-scope-backfill-2026-08-19.md`. No team membership or profile data changed.
- User Management atomically saves roles, Umpire association scopes and protected Coordinator
  responsibilities. Umpire Coordinator is association-only; Technical Bench and Volunteer
  Coordinator support association or club scope. The fixed bundles cannot be edited through the
  generic permission controls.
- Direct Coordinator permission resolution is exact and does not depend on gaining an admin role.
  Club Technical Bench access covers both positions when either fixture team is from the assigned
  club. The database filters returned position data to the Coordinator's authorised type.
- The three `UMPIRE_ADMIN` rows remain unchanged and display as **Legacy Umpire Admin**. New legacy
  assignments and automatic conversions are rejected.
- Both Coordination SQL suites and all nine focused frontend tests pass after the migration.
  TypeScript and the production build pass. Full lint remains at the documented baseline of 360
  errors and 78 warnings; signed-in Dev role smoke checks remain the completion gate for this task.
- `main` and Production were not changed.

## 17 August 2026 Coordination Module implementation

- The first signed-in Dev owner check found `/coordination` incorrectly fail-closed for Super Admin.
  The older shared module resolver did not recognise the new module key. Additive migration
  `20260817101100_allow_coordination_module_access.sql` makes Coordination default-enabled, permits
  scoped feature-flag overrides and preserves authenticated-only function grants. The administrator
  module controls now include Coordination. The rollback, live default and scoped override tests pass.
- That access retest exposed circular RLS expansion between offer batches and recipients. Additive
  migration `20260817101200_fix_coordination_offer_rls_recursion.sql` moves the reciprocal lookups
  into private, authenticated helpers. Direct SELECT checks under the authenticated role and the
  signed-in Coordination browser load now cover this regression.
- The confirmed design in `docs/coordination-module-discovery.md` is implemented on `dev`.
  `/coordination` consolidates fixture positions, recipient work, Umpire Matrix, volunteer
  activities and roster-review flags.
- Migrations `20260817100124` through `20260817101000` add Coordination availability states,
  scoped capabilities/invitations, configurable positions, multi-recipient offers, reminders,
  explicit confirmation, assignments, replacement/reconfirmation, activities, supervision, Matrix
  history, roster checks, RLS/grants, supporting indexes, protected confirmed-duty availability and
  pre-email invitation authorisation.
- The existing notification dispatcher now handles Coordination work and is ACTIVE on Dev as
  version 7. New JWT-protected `coordination-invite` is ACTIVE as version 2; it proves scoped
  permission before any account email can be sent.
- Workflow rules are database enforced: no assignment before coordinator confirmation, one current
  assignment per position, hard time-overlap rejection, mandatory replacement note, original
  assignment retained until replacement confirmation, self-supervision rejection and roster
  mismatch with no voting effect.
- Tests passed: rollback migration test; workflow SQL; security/roles SQL; six focused frontend
  tests; changed-file lint; TypeScript; build; signed-out browser route with no console error; and
  401 responses from both Edge Functions without credentials. An ordering defect found by the
  replacement test and a missing menu-icon import found by the browser test were fixed and retested.
- Full lint remains the pre-existing 360-error/78-warning baseline. Test transactions left zero
  Dev activities, positions, offers, assignments, replacements or capability invitations.
- No historical mapping backfill, `main`, Production, domain or secret change occurred. Permanent
  sensitive-note retention still requires approval before Production. Signed-in Super Admin access
  and all four standard positions passed on Kangaroos v Revengers. Continue one owner workflow test
  at a time.

## 16 August 2026 Player Explorer scoped access

- `/admin/player-explorer` now admits Super Admin, Association Admin, Club Admin, Team Manager and
  Coach modes. Fixed filter rows show the immutable Association, Association + Club, or Association
  + Club + Team boundary; entity options below are narrowed to that scope.
- Dev migration `20260816213409_scope_player_explorer_access.sql` adds private session-bound helpers
  and SELECT policies for V2 matches, appearances and only the relevant external identity rows. It
  also makes the original Super Admin reads active-mode-aware so **Viewing as** cannot retain global
  access. No table or source-data row changed.
- Live Dev impersonation returned 4,532 Association Admin, 147 Club Admin and 147 Team Manager
  appearances with zero outside-scope rows. Anonymous access returned zero; genuine Super Admin
  mode retained all 800 matches and 12,395 appearances. The existing Coach test context currently
  has no V2 rows, so a signed-in Coach owner check remains.
- Lower roles receive manual search, sorting, copy and CSV export. Saved/recurring searches remain
  Super Admin-only because the scheduler does not yet store an immutable role-scope snapshot.
- The migration passed a full rollback and scoped-read test before Dev application. No new Player
  Explorer security advisor warning appeared. Eighteen focused tests, focused lint, TypeScript and
  build pass. Production and Main remain unchanged.

## 16 August 2026 Player Explorer result export and sorting

- `/admin/player-explorer` now has clickable headings for Player, Identity, Teams, Games, Goals and
  each card total. A second selection reverses the sort direction; paging uses the sorted order.
- **Copy results** produces tab-separated data for spreadsheet paste. **Download CSV** exports the
  complete searched and sorted result set rather than only the visible page. The export includes
  identifiers, identity state, teams, statistics, rounds and latest game date, with spreadsheet
  formula-value protection.
- This frontend-only change required no database, RLS, Edge Function or scheduler change. Fifteen
  focused tests, focused lint, TypeScript and build pass; full lint remains the known baseline debt.
  Signed-in Dev owner verification remains the final interaction check.

## 15 August 2026 Player Explorer sequences, saved searches and schedules

- `/admin/player-explorer` now supports ordered division movement rules. The initial sequence UI asks
  for a first division and minimum game count, followed by a second division and minimum game count.
  The shared evaluator uses distinct matches ordered by `game_date` and `game_time`; it does not
  claim a same-day transition when either time is missing.
- Super Admins can save and reload filters and select Manual, Daily, Weekly or Monthly. Scheduled
  searches always produce both an in-app notification and an email. The first automatic run occurs
  after one full selected interval; changing the schedule to Manual pauses future runs without
  deleting the saved filter.
- Dev migration `20260815103000_player_explorer_saved_and_scheduled_searches.sql` adds owner-scoped
  `player_explorer_saved_searches`, protected `player_explorer_search_runs`, RLS, explicit grants,
  schedule preparation and the service-role-only `claim_due_player_explorer_searches(integer)` RPC.
  Its full SQL passed a rollback test before being applied to Dev.
- Existing Edge Function `sportstack-notification-dispatch` was extended rather than adding another
  cron job. Dev version 6 is ACTIVE. It loads current RevSports V2 data, runs the shared application
  evaluator, stores up to 50 result summaries, inserts the in-app result and sends via the existing
  Resend configuration with an idempotency key.
- Live verification: anonymous table access and authenticated run-history writes/claim execution are
  blocked; service claim is allowed; rolled-back due-work claiming succeeded; unauthorised Edge call
  returned 401; authorised no-work call returned 200 with zero sends/failures; no new Player Explorer
  security advisor finding.
- Ten focused tests, focused changed-file lint, TypeScript and production build pass. Full lint remains
  known repository debt. `agent-browser` is unavailable on this PC, so the remaining check is Aaron's
  signed-in Dev Super Admin visual flow. No Production system was changed.

## 14 August 2026 Dev to Main staging promotion

- Aaron explicitly approved promotion of the full Dev backlog, including activation from Main of
  the V2 importer changes in the scheduled Production scraper workflow. Main was fast-forwarded
  without a merge commit or force-push.
- The exact promoted application commit was `c50eb87d6a08e84d9ccfee12978dbb6a8a475de6`.
  Vercel deployment `dpl_3C9JfKKRK6BUDMc8KQo4oicHYu4s` reached `READY` for Main.
- `https://main.sportstackapp.com.au` returned HTTP 200. A signed-out discipline case request
  redirected to login with its return path preserved and no browser console errors. The deployed
  bundle contains the complete post-referral workflow and Rule 7.26 guidance, references SportStack
  Dev Supabase `icqegnpjbizccjebjfhb`, and does not reference Production Supabase.
- Release checks passed on the actual Dev tip: focused development-plan lint, TypeScript, build,
  52 JavaScript tests and 149 Python regression tests. The unrelated untracked committee migration
  remained untouched. The `prod` branch was not changed.

## 14 August 2026 Player Explorer Stage 2

- A read-only Super Admin Player Explorer is implemented at `/admin/player-explorer` under the
  Data Quality menu. Its Looker-style filter rows treat season, competition, Association, Club,
  Division/grade, Team, Round and Game date as fields alongside games, goals and card totals.
  Numeric/date filters support From/To `between` values, and filters can be combined through
  All/Any conditions inside All/Any groups.
- The browser uses the existing publishable Supabase client and live RLS. It fetches clean scope and
  match metadata, then attended/non-removed V2 appearances in 50-match chunks on the first search
  and caches them for later filter changes. Aggregation is application-side by
  `revsports_player_id`; distinct matches count as games. In an All conditions group, totals are
  calculated from rows matching that group's scope fields.
- Identity display checks both `profiles.revsports_player_id` and matched
  `external_entities`/`external_entity_links`. Conflicts are labelled and left unresolved. The page
  does not reuse the legacy `revsports_players` history helper.
- Live Dev still has 800 V2 matches, 12,395 appearance rows and 7,809 usable rows. The relevant
  source/external SELECT policies remain Super Admin-only. No migration, RLS change, Edge Function,
  Production change or feature-data write was made.
- Eight focused Vitest checks, focused lint, TypeScript and the production build pass for the
  grouped-filter refinement. Full lint remains at its known 360-error/78-warning baseline. The
  signed-in Dev owner smoke test remains; current Wimmera appearance coverage is still incomplete.
- Dev commit `0063b2b` deployed successfully and Dev Quality passed. Browser verification saw the
  expected Dev version and no console errors, but the connected Codex test account is Association
  Admin-only and correctly redirected away from the Super Admin route.

## 14 August 2026 complete post-referral discipline workflow

- The Dev Outcome tab now covers the remaining standard flow: Notice Pack, Hearing Record,
  Determination and Sanctions, Appeal Pathway and Final Closure. It explains and links the relevant
  HV Rules. Every save is an append-only revision, and simulations are visibly separated from real
  proceeding records.
- Real Notice `ISSUED` is blocked until Tribunal Preparation is `READY`. The database rechecks the
  coordinator role, stage order and required safeguards. A final appeal requires an independent
  three-member Appeal Board, eligible Chair, affected people heard, a new hearing on the merits and
  a majority basis. Closure after a proved charge requires a decision-notification reference,
  sanctions-register treatment and administrative-fee treatment.
- Additive Dev migrations `20260813182611 discipline_phase2_completion_workflow` and
  `20260813183733 harden_discipline_phase2_appeal_and_closure` are applied. The table has RLS and
  assigned-case read access; the authenticated write function rechecks Case Coordinator access.
  Rolled-back stage-order, readiness, appeal and closure tests passed.
- Case `HB-DIS-2026-0016` was taken through all five stages in `SIMULATION` mode. Closure revision 2
  satisfies the strengthened controls. No real email, Tribunal, finding, sanction, appeal,
  publication or closure occurred; the real case remains `REFERRED` with `closed_at` null.
- Rule 7.26 is explained as a separate future pathway for a suspension longer than 12 months, after
  at least 12 months has been served. It is not a normal closure stage. The HB equivalents for
  appeal recipient, fee/delegation, publication and retention still need formal local confirmation.
- Production, `main`, `prod`, domains and secrets were not changed.

## 13 August 2026 Tribunal Preparation continuation

- Dev commit `95dd3df` adds the first Phase 2 screen after a Tribunal referral. It records referral
  authority, receiving body/contact, HB presenter, hearing logistics, Chair treatment and three
  proposed Tribunal seats. It explains and links the HV Rule 7.17 source and HB addendum.
- Readiness is database-calculated, not a UI claim. It requires formal authority mapping, a hearing
  time/place, at least two accepted independent members, an accepted Chair and either confirmed
  eligibility to engage in legal practice in Victoria or a cited formal HB variation. Free-text
  identity is supported, but acceptance requires a linked SportStack account.
- Dev case `HB-DIS-2026-0016` was completed through this screen as a workflow exercise. It saved as
  `SETUP`, with three unaccepted placeholder seats, no hearing, no formal authority confirmation and
  no accepted Chair. The notes make clear that no real appointment, invitation or notice occurred.
- Live Dev migrations `20260813132301 discipline_tribunal_preparation` and
  `20260813133852 harden_discipline_tribunal_preparation` are applied. The second restores the
  authenticated grant for the private-helper-dependent save RPC and adds all missing foreign-key
  indexes. Rolled-back live tests passed coordinator-only writes, member visibility and cleanup.
- Focused lint, 13 discipline tests, TypeScript, build and diff checks passed before deployment.
  Vercel deployment `dpl_BXKA2d8mA39ChMutTG9Bq4visuyW` is `READY` on the Dev alias for exact commit
  `95dd3dffb70992dd6b44d2b3f5409a6a1c8f37cc`. Production, `main`, `prod`, domains and secrets were
  not changed. The next build is the Tribunal Notice Pack; it may prepare drafts but must not issue
  a formal notice while the current readiness items remain unresolved.

## 13 August 2026 Incident 007 review-panel continuation

- Dev commits `8e5b9d1` and `a72a9a0` replace the single Decision Maker form with a three-person
  independent review panel. The screen explains the HB local-safeguard status and links the HV
  Rules, HB addendum and Sport Integrity Australia investigation guidance.
- Each member record has free-text name, mandatory email, searchable optional account link,
  suitability facts, affiliations/interests, conflict descriptors, separate actual/perceived
  questions, a conflict result and invitation state. Acceptance requires a linked account. A Case
  Coordinator or investigator on the case cannot be appointed as a panel member.
- Panel votes are append-only revisions. Before finalisation, RLS returns only the signed-in
  member's own vote; the Case Coordinator receives no vote content. All three current votes are
  required and the database permits only a 2-1 or 3-0 majority. A three-way split is blocked. The
  complete panel vote record becomes visible after finalisation.
- The walkthrough exposed that a signed report may contain findings without one overall outcome
  recommendation. Migration `20260813130941 allow_no_investigator_outcome_recommendation` and the
  UI now preserve that as null instead of forcing an inaccurate yes/no answer.
- Dev case `HB-DIS-2026-0016` is now `REFERRED`. The deployed coordinator screen saved three
  reserved Codex accounts as clearly labelled simulated reviewers. Three audited simulated votes
  produced a 3-0 `TRIBUNAL_REFERRAL`. The authority, member checks, reasons and outcome all state
  that this was a Dev workflow exercise, not a real appointment, merits decision or sanction. No
  email or other notification was sent.
- Rolled-back database tests passed member exclusion, readiness, private voting, a 2-1 majority,
  post-final vote visibility and the null-recommendation path. Focused lint, nine discipline tests,
  TypeScript and build pass. Full lint remains baseline debt at 360 errors and 78 warnings.
- Four additive review-panel migrations are live on SportStack Dev as `20260813124625`,
  `20260813125316`, `20260813125705` and `20260813130941`. The new tables have RLS, explicit grants,
  covered foreign keys and role-checking authenticated RPCs. Production, `main`, `prod`, domains and
  secrets remain untouched.
- Vercel deployment `dpl_nvum4aYqAtC3WFAKr8uwj1vQWzoE` is `READY` on the Dev alias for exact commit
  `7aec329e84ec56bc9f4da6d0f822292e96462968`. The signed-in final screen shows `REFERRED`, the
  complete panel, all linked account labels, the three simulated reasons and the 3-0 majority.

## 12 August 2026 Incident & Discipline Phase 1

Aaron approved a Dev-first implementation with content accuracy at least as important as page
structure. The hidden direct-address portal is implemented at `/discipline`, `/discipline/new` and
`/discipline/cases/:caseId`. It is intentionally absent from normal navigation. Production,
`main`, `prod`, domains, secrets and Production Supabase were not changed.

### Rule verification and product boundary

- The checked source set is the HB March 2026 addendum, HV 2026 Competition Rules, Regulations and
  Schedules, the linked Incident Report Form, the HB policies page and site-linked Hockey Australia
  Complaints, Disputes and Discipline Policy. Exact official addresses and SHA-256 hashes are in
  `docs/incident-discipline-phase1.md`.
- Phase 1 stops at an HB close or referral decision. Tribunal, mediation, appeal, suspension and
  publication workflows remain Phase 2. The app records guidance but never decides guilt or applies
  a penalty automatically.
- The revised intake explains Rule 7 and every jurisdiction option, links the official sources and
  requires a factual pathway reason. Immediate safety is recorded as an overlay: it no longer marks
  a Rule 7 case `REFERRED` unless an explicit external/policy referral pathway is selected. The
  linked national policy remains visibly subject to HB adoption/contact confirmation.
- Fixture, competition, grade, round, home team, away team, venue, person and club suggestions are
  association-scoped and retain free-text fallback. The original report remains evidence; multiple
  neutral allegations and optional descriptive tags are saved atomically in the same case.
- Corrected source interpretation: direct finals timing applies only when the relevant club is
  participating in that competition; 2026 investigation appeals are Rules 7.22-7.25; and direct
  Tribunal screening includes Level 3 language, vilification, Level 3 violent conduct and the
  listed unfair public personal attack.
- The current Schedules show `$500` for contempt while the linked form says `$250`. The Schedules
  amount is guidance with a visible conflict warning, not an automatic fine. The business-day
  definition and all unresolved HB local treatments keep the rule pack at `REVIEW_REQUIRED`.
- Preliminary Screening now deals with one allegation at a time, displays its saved wording and
  descriptor tags, requires explicit factual answers and records unclear combinations as Amber
  human review. Green/Amber/Red are explained as pathway-planning states only. Previous assessments,
  penalty guidance and rule-source warnings remain visible and are not overwritten.
- Investigation Setup now explains Rule 7.12 and the difference between internal and independent
  external investigation. It records one accountable lead, optional support investigators,
  appointment date/time and authority, training/experience, four disclosure areas, separate
  actual/perceived conflict answers, predefined operating descriptors, the independence decision
  and its factual basis/safeguards. Earlier checks remain visible.
- Support investigators and the conflict descriptors are explicitly labelled as HB operating tools,
  not quoted Rule 7 requirements. The HB addendum does not settle the local equivalent of the HV
  CEO/delegate appointment authority, so that mapping remains visibly unapproved and the actual
  authorising person/body must be recorded.

### Dev implementation and security

- Ten additive local migration files from `20260812110000` to `20260812235915` are applied to
  Dev. The first seven live migrations used application-time versions `20260812004524` through
  `20260812011829`; the exact local-to-live mapping for all ten files is in
  `docs/incident-discipline-phase1.md`. They add
  29 `discipline_*` tables, rule/deadline/config data, append-only audit and revision records, a
  private 20 MB `discipline-evidence` bucket and role-checking database functions. Generated
  Supabase TypeScript types were refreshed.
- The two intake usability migrations are live as `20260812064047 improve_discipline_intake_guidance`
  and `20260812064352 index_discipline_intake_links`. They add 34 reusable tags, optional links to
  existing SportStack records, association-scoped suggestion data and covered foreign-key indexes.
- Investigator setup migration `20260812140314 improve_discipline_investigator_setup` is live on
  Dev. It adds investigation type, appointment authority/reference and conflict descriptors, blocks
  direct authenticated inserts and exposes one secured atomic function. Accepted appointments align
  lead/support case access; a replacement decision records the check without granting access.
- Every exposed discipline table has RLS. Existing admin or committee status does not reveal case
  contents; an active case assignment is required. Portal/config access remains separate from case
  access. Creating a case atomically creates its initial people/allegation, assigns the creator as
  Case Coordinator and starts the applicable deadlines.
- The separate portal layout exposes only Cases, New case where allowed, Profile and Sign out.
  Dedicated accounts can be marked `DISCIPLINE_ONLY`; normal SportStack addresses then redirect to
  the discipline portal. This is an app restriction, not a total database sandbox, because existing
  SportStack shared directory information remains readable by signed-in users.
- The client uses authenticated security-definer RPCs intentionally. Each write rechecks the
  signed-in user and required association/case role. Supabase advisers show no discipline anonymous
  RPC warning and no discipline table without RLS; authenticated-RPC warnings are expected and
  documented. New indexes are only flagged as unused because they have no workload yet.

### Verification and remaining gate

- Migration dry-runs passed before every Dev apply. Rolled-back live tests passed case
  assignment/removal isolation, Easter public-holiday calculations, direct-finals deadlines, all
  Language/Physical/Vilification/Other classification branches and Amber fallback, atomic intake,
  natural-justice blocking, authorised override, immutable SHA-256 report snapshot and audit data.
- The sign-off test exposed an unqualified pgcrypto `digest` call; additive migration
  `20260812116000_incident_discipline_report_hash.sql` fixed it and the complete test then passed.
- A new rolled-back Dev check returned 232 fixture, 38 team, 451 person and 34 tag suggestions. It
  created a two-allegation Rule 7 test with an immediate-safety flag, confirmed the case remained
  `REGULAR`/`DRAFT`, confirmed both case and allegation tag assignments, and left zero test records.
- A separate rolled-back Dev investigator workflow test assigned an accepted lead and support role,
  retained no access for an actual-conflict replacement, rejected an invalid actual-conflict/
  managed combination and left zero test cases. Function grants are authenticated-only, direct
  table insert is revoked and the fixed empty function search path was verified live.
- Focused ESLint, five investigator validation tests, TypeScript, the production build and
  `git diff --check` pass. Full repository lint remains at its existing baseline of 360 errors and
  78 warnings. React review found no new Screen 3 correctness or accessibility error; its remaining
  Screen 3 advice is maintainability-only because the guided form is large.
- Vercel deployment `dpl_BZbwC86F3y6JrFGfV3HZHqdURQMb` is `READY` for exact Screen 3 commit
  `e8018598a4a6d4d30cd0ff61293379005f3537df` and owns `dev.sportstackapp.com.au`. The address
  returned 200; its deployed bundle contains the Screen 3 wording and Dev Supabase reference, with
  no Production project reference. The signed-in Cases page rendered without a console error or
  horizontal overflow. No assigned case exists for that account, so visual form acceptance remains
  the next owner test.
- The unauthenticated local browser check correctly redirected `/discipline` to sign-in. Vercel
  deployment `dpl_HU2QXTrCJmoEzMrRfKawDZnTUpfY` was `READY` for exact preliminary-screening commit
  `e6b73dfe19ce55da7512296b12f15ee1a6970fdf` and was verified through the Dev alias. The Dev address
  returned HTTP 200; the bundle contained the new Screen 2 guidance, pointed to SportStack Dev
  Supabase and did not contain the Production Supabase project reference. A fresh signed-in browser
  snapshot rendered the revised intake form, pathway
  guidance, tags, predictive inputs and multi-allegation controls without a framework error. The
  next owner acceptance test requires a disposable Dev case because the signed-in account currently
  has no assigned cases. Create one disposable case and stop when its workspace opens.
  Later documentation-only Dev commits may change the displayed build label without changing the
  feature package.
- On 13 August, a read-only realistic rehearsal used the latest de-identified `IN0007` report and
  related correspondence without committing names or private correspondence. SportStack's fixture
  suggestion resolved the source inconsistency about team order as Home `Lucas HC`, Away `Gold`,
  Round 13, Division 2 Open. The deployed intake kept two alleged acts and their descriptor tags
  separate, rendered at 390 px without overflow or console warnings, and exposed the complete
  jurisdiction help. Read-only rule matching treated reported late contact as possible Level 1
  physical guidance but sent the reported bite to Amber because biting does not safely match an
  exact listed physical row. A reported later threat and prior-match history remain evidence or
  possible separately particularised allegations, not assumed facts within the bite allegation.
  No case was submitted because `docs/overnight-agent-plan.md` prohibits unattended live database
  writes; live Dev still has zero discipline cases.

## 11 August 2026 guided Committee workflow

Aaron approved the full Dev-only implementation of the guided Committee and subcommittee plan.
Commit `deea6c0` (`feat(committee): add guided setup workflow`) is pushed to `origin/dev`. Vercel
deployment `dpl_5TWrcvoBeJPPYEUFD3HzTvLmMhTo` is READY for exact commit
`deea6c00613712950e6a204b1152ca5994f6b6c2`; the Dev alias displayed
`v2026.08.11+deea6c0`. Production, `main`, `prod`, Production Supabase, domains and secrets were not
changed.

### Delivered

- A reusable large five-step guided pop-up now handles purpose, structure, details, optional
  positions/members and final review. Main committees support the agreed purpose presets and
  authorised Association or Club scope.
- Top-level committees can create one level of standing or temporary subcommittees. Children show
  under the parent with breadcrumbs, inherit its organisation, cannot create another level and
  keep private meetings, documents, minutes, polls and chat separate.
- The people step supports suggested and custom positions, four access presets, scoped candidate
  search, optional appointments and **Skip roles and members for now**. Presidents forums can
  preview and confirm current scoped Club Presidents; this is a fixed snapshot, not future syncing.
- Draft answers are versioned in session storage, survive reload/window switching, and require
  confirmation before discard. Submission is guarded against double clicks and step-specific
  errors are shown inline.
- Committee listing and existing appointment controls now respect scoped candidates and private
  child visibility, including a child whose parent is not visible to the ordinary appointed member.

### Dev database and security

- Applied additive Dev migrations `20260811090305_guided_committee_workflow` and
  `20260811091322_fix_guided_committee_creation_returning`. They extend `committees` with parent,
  lifecycle and close fields; restrict parent deletion; preserve closed records; block a parent
  close while children are active; and enforce inherited scope, one-level nesting and in-scope
  appointments.
- `create_committee_with_setup(jsonb,jsonb)` is authenticated, security-invoker and creates the
  committee, positions and appointments in one transaction. The follow-up migration generates IDs
  before inserts because the initial dry-run exposed an `INSERT ... RETURNING`/RLS conflict.
- Rolled-back access suites passed for Club Admin, Association Admin, parent setup manager,
  ordinary parent member and explicitly appointed child member. Atomic failure, President matching
  and fixed snapshot, inherited scope, one-level nesting, close retention and active-child close
  guard all passed. Zero rollback committees remain.
- Post-migration Supabase advisers remain at the existing broad baseline of 77 security and 493
  performance notices. The new atomic create function did not add a security-definer warning.
  Candidate and create-authorisation helpers intentionally bind authenticated users to their
  current role/scope and still require later individual adviser review with the existing baseline.

### Verification and remaining owner checks

- All 26 Vitest tests, the four focused Committee tests, changed-file ESLint, TypeScript, build and
  `git diff --check` pass. Full lint remains known baseline debt at 360 errors and 78 warnings.
- Authenticated Dev smoke passed the latest build, first two workflow steps, saved-answer recovery
  after reload, discard confirmation and a 390 px mobile layout. It did not create a real record.
- Owner/session testing remains for: the full Review/create write; Association Admin, Club Admin,
  Super Admin and parent setup-manager UI access; a real standing and temporary child; keyboard-only
  completion; President preview wording; and explicit private-member access in separate sessions.
- Exact next owner test: open **Create Committee**, choose any purpose and continue to **Review**
  without pressing the final create button. Confirm whether the wording and visual flow are clear.

## 10 August 2026 Dev repair and Supabase hardening snapshot

Aaron approved the complete Dev-only repair batch and a deeper Supabase review. Commit `a77f01a`
is pushed to `origin/dev`, Vercel deployment `dpl_EkW4715qFjkTmfzwCwHRwndRW9qn` is READY, and
`https://dev.sportstackapp.com.au` displayed build `v2026.08.10+a77f01a`. Production, `main`,
`prod`, domains, secrets and Production Supabase were not changed.

### Completed repairs

- **Club Admin scope follow-up (`77422f1`):** Aaron's actual AM account showed only a Grampians
  Hockey Club Admin assignment but the header offered every Hockey Ballarat club and retained Blaze.
  The database correctly rejected Blaze. The deployed UI now filters club options from the active
  role's authorised IDs, replaces an invalid retained club with the first assigned club, redirects
  an unauthorised club route, and starts a role change without reusing the previous role's scope.
  Vercel deployment `dpl_5VMTTeGKRFUvXLxHQxUyDYEDsCS9` is READY for exact commit `77422f1`.
  Aaron confirmed the refreshed AM Club Admin selector now behaves correctly. No database migration
  or role row change was needed.
- **AM Player multi-team owner pass:** In Player mode, Aaron confirmed both the Primary Pumas team
  and Secondary Lucas HC team are available. Lucas HC loaded and remained selected without bouncing
  back. This passes the normal Player multi-team switch; a separate account with multiple Team
  Manager role assignments is still needed to close the Team Manager-specific variant.
- Communications now retains account/channel drafts across a full reload, merges edited messages
  without duplication, paginates older messages in batches of 50, and explains that legacy edits
  may have no recorded earlier version. Three focused pagination/merge tests cover the behaviour.
  Aaron confirmed an unsent Team Chat draft survives `Ctrl + Shift + R` on Dev. He also opened an
  edited message and confirmed the dialog shows the current version plus the earlier version with
  its editor and timestamp.
- The top scope switcher now resolves all Team Manager team assignments from the complete role and
  TeamContext data instead of a fragile nested query. A real multi-club login retest is still needed.
- Coach line-up view has explicit **Remove player** and **Clear position** actions.
- Committee Meetings uses neutral wording when there are no recorded meetings, avoiding conflict
  with past meetings visible in Calendar.
- Public Umpire Match Voting candidate loading and submission validation are restricted to the
  selected fixture's two teams, selected fill-ins, line-up assignments and recorded appearances.
  Dev Edge Function `public-umpire-match-voting` version 9 is ACTIVE. A live Round 13 fixture search
  loaded the fixture candidate pool with no browser console error; no ballot was submitted.
- Dependencies were updated, including React Router, Vite and SheetJS. `npm audit` now reports zero
  vulnerabilities.

### Dev Supabase result

- Migration `20260810090000_harden_functions_and_rls_performance.sql` was first run inside a full
  transaction and rolled back successfully. It was then applied to Dev and recorded live as
  `20260810064248_harden_functions_and_rls_performance`.
- The migration fixes two mutable function search paths, removes browser-role execution from six
  trigger-only security-definer functions, converts 61 RLS auth calls to one-time init-plan form,
  and adds 33 missing foreign-key indexes. It contains no delete, drop, truncate or data rewrite.
- Security adviser notices reduced from 85 to 75. Performance adviser notices reduced from 554 to
  493. The actionable `auth_rls_initplan` group reduced from 61 to zero and the missing foreign-key
  index group reduced from 164 to 131.
- Remaining notices were deliberately not blanket-fixed: public ballot RPCs require anonymous
  access, authenticated RPC helpers require individual access review, policy consolidation can
  change permissions, and index/table cleanup would require destructive drops. Supabase leaked
  password protection remains a dashboard Auth setting to enable separately.

### Verification

- Focused changed-file ESLint, `git diff --check`, `npx tsc --noEmit` and `npm run build`: pass.
- Latest Club Admin follow-up: Vitest 22/22, focused permission-context Python 23/23, TypeScript and
  build pass. The earlier complete Python result remains 167 tests plus 29 subtests.
- Full `npm run lint` remains baseline debt at 360 errors and 78 warnings; changed files are clean.
- Vercel deployed the exact `a77f01a` commit and the Dev alias showed the matching build.

### Still open before Dev acceptance

1. Use real disposable Team Manager, Coach and Player sessions to retest the multi-club switcher,
   line-up removal and read-only line-up behaviour. Chrome automation was unavailable during the
   final pass, so these are not marked as owner/session passes.
2. Create one controlled eligible Player MVP Voting round and complete the ballot/history/analytics
   flow with email disabled.
3. Finish the remaining Safety Hub and Committee write/upload checks and responsive tablet/mobile
   review. The broader Roles & modules redesign remains parked by owner decision.
4. Review the remaining Supabase adviser groups separately before any destructive cleanup. Enable
   leaked-password protection in the Dev Auth dashboard when convenient.

## 9 August 2026 unattended Dev test snapshot

Aaron approved a Dev-only unattended actual-role and module test run. Non-blocking defects were
recorded rather than fixed. Production, `main`, `prod`, live domains, secrets and real-user
communications were not changed.

### Release and verification position

- `dev` and `origin/dev` now include commit `e38150d` (`fix(fixtures): preserve local time on admin
  save`). Vercel deployed that exact commit successfully and Dev Quality passed.
- The blocker was an unchanged Association Admin fixture edit shifting `12:15 pm` to `10:15 pm`
  because the local wall-clock value was written as UTC. The repair converts fixture form values
  through the association timezone. A browser retest kept Bobcats vs Pumas at `12:15 pm`; the Dev
  row remained `2026-08-23 02:15:00+00`.
- Verification passed: focused fixture lint, `npx tsc --noEmit`, `npm run build`, 16 Vitest tests,
  148 Python tests, `git diff --check`, Dev Quality and Vercel READY. Full lint remains the existing
  baseline of 360 errors and 78 warnings.
- No migration is included. The four documentation files changed during owner testing were
  deliberately preserved and extended in a separate documentation continuation.

### Actual-role and workflow results

| Area | Result | Evidence / remaining work |
|---|---|---|
| Team Manager route restriction | **Pass** | Direct `/admin/fixtures` returned to `/dashboard`; no fixture editor was exposed. |
| Coach | **Pass** | Correct navigation, Fixtures, Squad (25), Roster (25), Coach line-up controls and direct-admin redirect. |
| Player | **Pass** | Restricted navigation, availability persistence and click-again clearing, plus read-only published line-up. |
| Player -> Coach -> Player line-up | **Pass** | Player availability reached Coach selection; Coach assigned and saved Goalie; Player saw the published read-only position. The exact test assignment was removed and verified absent. |
| Association Admin | **Pass after blocker fix** | Correct association scope, fixture management access and unchanged fixture save. |
| Dashboard/fixtures | **Pass** | Scope links, branding, list/calendar views, byes, results and completed-game participants/statistics loaded. |
| Communications | **Partial** | Existing chat, navigation retention and notification deep-link/read state passed. A full reload clears an unsent draft; the legacy edited message opens an empty revision history; only seven messages meant earlier-page loading could not be exercised. Nothing was published. |
| Multi-club Team Manager | **Fail — parked** | Adding a temporary Lucas HC Team Manager assignment did not provide a club-switch control; the account stayed on Grampians/Pumas. The exact temporary role was removed and verified absent. |
| Player MVP Voting | **Partial** | The real Player route is correctly restricted but shows no rounds because the disposable player has no attended or selected fill-in match. No ballot or analytics write was made; eligible-player end-to-end testing remains. |
| Umpire Match Voting | **Historical fail — superseded 20 August** | The earlier account reached the ballot but candidate presentation was unsuitable. Current owner testing confirms default suggestions are fixture-linked. The approved follow-up keeps those suggestions and adds a deliberate magnifying-glass search across the selected association only. |
| Safety Hub | **Pass, read-only** | Dashboard, Risk Register, Actions, QI Register, Bright Ideas, Matrix/Guidance, Audit History and the guided add-risk form loaded without a write. |
| Committee Management | **Pass with display note** | Calendar, Polls, Chat, Minutes and all administration tabs loaded. Calendar shows a past `Test meeting`, while Meetings says no meetings are scheduled; discuss whether that wording is intentional. Nothing was posted or changed. |

The line-up screen did not expose an obvious way to unassign a saved player; the exact Dev test row
was removed safely through its known identifier. Treat a product-facing Remove/Clear action as a
discussion item, not as evidence that cleanup failed.

### Health-check findings

- `npm audit --omit=dev`: 11 production dependency advisories — 10 high and one moderate. Direct
  packages include `react-router-dom` (fix available) and `xlsx` (no automated fix); review as a
  dedicated dependency update rather than mixing it into owner-test fixes.
- Dev Supabase: 86 applied migrations; all 16 Edge Functions report ACTIVE; the latest 100 Edge
  requests were HTTP 200. Recent Auth warnings were two deliberate invalid disposable-account
  login attempts and one disabled Google-provider attempt.
- Supabase database advisors remain baseline debt: 85 security notices (69 WARN) and 554
  performance notices (239 WARN). Dominant items are executable security-definer functions,
  unindexed foreign keys, multiple permissive policies, unused indexes and RLS init-plan costs.
  Review each against intended RPC/RLS behaviour before changing anything.
- The disposable Umpire account password was rotated after testing. No temporary credential was
  added to repository notes or retained as test evidence.

### Recommended next order

1. Review the parked findings with Aaron: multi-club scope switching, chat reload/history,
   line-up unassign, Committee meeting wording and Umpire suggestion scope.
2. Prepare an eligible Dev-only Player MVP round and complete ballot, history and analytics tests
   without sending email.
3. Run the remaining communication pagination test with at least 51 clearly disposable messages,
   or cover it with a focused automated test instead of publishing to real users.
4. Plan dependency and Supabase-advisor remediation as separate reviewed batches.
5. Only after Aaron accepts Dev, audit `dev` -> `main` divergence and promote the exact intended
   commits. Production remains separately approval-gated.

## 8 August 2026 transfer snapshot

This section is the current transfer brief. The longer sections below preserve implementation and
release detail from earlier work, but some older "pending deployment" wording has been superseded by
this snapshot.

### Repository and release position

- Checkout: `C:\Users\mulla\Projects\SportStackApp\sportstack`.
- Current branch: `dev` at `6246a48`, matching `origin/dev`.
- `origin/dev` is 70 commits ahead of `origin/main`.
- `origin/main` is 12 commits ahead of `origin/prod`.
- `origin/main` ends at `4bcb4fc`; `origin/prod` ends at `682b8ea`.
- No `main`, `prod`, Production Supabase, Production Vercel, DNS, domain, redirect or secret change
  was made during this consolidation.
- Two pre-existing local changes are intentionally unfinished and must be preserved:
  - `src/pages/admin/UsersManagement.tsx`
  - `notes/known-issues.md`
- The generated Obsidian mirror was refreshed from `origin/dev` at `6246a48` on 8 August. It cannot
  include these uncommitted files or this handoff update until they are committed and pushed.

### Active Codex task inventory reviewed

The Codex task list was reviewed on 8 August. Only this consolidation task was actively running.
The following SportStack tasks are the active or parked workstreams that another harness should
carry forward; unrelated Personal, Work and Grampians Hockey chats were excluded.

| Workstream | Current position | What remains |
|---|---|---|
| Owner-test remediation and current Dev plan | The 14-block package is implemented on Dev. Permission, navigation, dashboard, communications, both voting modules, formation, committee and Safety Hub work has extensive automated/read-only evidence. | Complete the actual-role and signed-in workflow matrix in `docs/owner-test-matrix.md`; record Pass, Fail or Needs discussion; only then decide whether Dev is accepted for `main`. |
| Users page reliability | Oversized PostgREST profile requests were fixed, committed and deployed to Dev as `6246a48`. The owner confirmed the Users page loads. | Continue the matrix from Club Admin scope. Retest Super Admin and scoped users. Resolve the rejected-mode visual mismatch where an unauthorised club such as Blaze can remain displayed. |
| Club Admin user protection | Aaron confirmed higher-level accounts may remain visible to Club Admin. On deployed `f3486b0`, Edit Details was disabled for protected higher/peer admin accounts and enabled for ordinary in-scope club users. | Treat edit protection, not account invisibility, as the acceptance rule in future tests. |
| Permissions review boundary | On 8 August Aaron discontinued the current Roles & modules review and parked the broader permission model/UI for a later dedicated pass. Existing server/RLS controls stay active. The Club Admin direct route loaded, but its menu link was absent and the club-selector check was not completed. | During other testing, fix permission failures that cause incorrect access or block the current workflow; record non-blockers for the later review. For every new feature, explicitly decide view/create/edit/approve/publish/export/manage access needs. |
| Focus persistence and scoped role display | Deployed commit `f3486b0` keeps the confirmed Users page mounted during focus rechecks. Aaron confirmed Edit Details and unsaved text survive switching windows, and the Coach row shows its Pumas scope instead of `Unassigned`. Intentional navigation may still reset page state. | Users acceptance is complete. Keep checking scoped rows during the actual-role matrix. |
| Wider focus persistence audit | Roles & Permissions still visibly refreshes when focus returns, despite the Users modal fix. Aaron chose not to interrupt the role matrix for another focus change. | Record other affected screens, then handle them together as a separate follow-up. Include an unsaved form and Safety Hub dialog, while keeping initial/revoked access fail-closed. |
| Fixtures and match presentation | Bye handling, calendar navigation, result colours/scores, completed-match participants/stats, competition ordering and Super/Association Admin-only fixture editing are on Dev through `4cc7070`. | Deployed owner retest across Association Admin, Club/Team views, byes and a scraped completed fixture. My Dashboard's separate bye formatting and any remaining availability duplicates need regression checks. |
| Team Manager scheduled fixture detail | Commits `df5b0ec` and `7d7e67f` fixed the crash, aligned availability with generated enum values, made unselected controls readable, used **Maybe** consistently, persisted responses and added click-again clearing. Dev Quality/build/148 Python tests passed, and Aaron confirmed the complete deployed behaviour. | Availability acceptance is complete. Continue the actual Team Manager lineup workflow. No migration. |
| Actual Team Manager line-up | On deployed `7d7e67f`, the Pumas Team Manager opened the Bobcats vs Pumas line-up with Coach editing controls. Player view remained visible but removed editing controls, and returning to Coach restored them. No line-up data was changed. | Team Manager line-up acceptance is complete; continue with the actual Coach account. |
| Expense Hub Stage 1 and Stage 2 | Manual expense tracking, private attachments, exports, CSV/OFX imports, PDF statement/invoice extraction, OpenAI-to-Claude fallback, approval tracking and AI activity are on Dev through `701edab`. Dev migrations/functions/RLS checks passed. | Signed-in owner smoke test using de-identified files. Before any Production release, separately approve provider privacy/region, billing limits and Production deployment. |
| Umpire Portal Production release | Public portal work and the guarded backup-first release tooling are prepared. Encrypted 30-day Vercel/Supabase access was previously verified. Production remains unchanged. | Revalidate token expiry and branch/preflight state. Production release, Turnstile/Vercel settings, migrations, function deploy and `prod` promotion require a fresh explicit owner approval. |
| Domain rollout | Corrected repository preparation is on Dev: future `hb.sportstackapp.com.au` routes to the SportStack Umpire Portal while current hosts stay unchanged. | Live Vercel, DNS, Supabase Auth redirects, Turnstile, deployment and redirect work remain separately approval-gated. Never merge/cherry-pick superseded `chore/domain-structure` commit `3a7d6cc`. |
| Coordination Module | The confirmed design is implemented on Dev. Fixture staffing, offers, reminders, explicit coordinator confirmation, replacements, availability, volunteer activities, Umpire Matrix, supervision and non-blocking Umpire Match Voting roster flags are live. The first owner check exposed and fixed a missing shared module-resolver key; Coordination now defaults on and has scoped administrator controls. | Continue one signed-in owner workflow test at a time. Keep Main and Production unchanged until Dev acceptance and separate release approval. |
| Historical membership cleanup | New bad writes are blocked. An immutable snapshot records 201 duplicate user/team groups, 44 users with multiple Primary memberships and 490 affected rows. | Produce an exact per-person keep/remove dry run. Any cleanup is destructive and requires separate approval. |
| RevSports fixture mapping | Import safety and the main recovery block are complete. | Do not backfill fixture foreign keys yet: 162 Wimmera fixtures still lack an unambiguous `season_id` mapping. Re-run the dry-run and resolve mappings before proposing writes. |
| Production follow-up and operations | July Production compatibility release, scraper reliability release and storage cleanup completed. Forty-four intended recovery objects remained after cleanup. | Complete signed-in Production smoke testing and continue monitoring email/reminder jobs, scraper runs and organisation Storage GB-hours. Production checks remain read-only unless separately approved. |
| Parked product work | Action-level fine-grained permissions, email-template polish, advanced persistence coverage and broader visual polish remain intentionally parked. Aaron supplied a permissions UI reference: predefined/custom roles on the left, grouped screen/action/module permissions on the right, and assigned members visible. Hockey Trace remains experimental and disabled by default. | Treat the reference as a future scoped role-template and permission-matrix redesign. Preserve Association -> Club -> Division -> Team scope, inheritance, audit and server/RLS enforcement. Prioritise only after the owner-test package and release gates are closed unless Aaron explicitly changes scope. |

### What has already been delivered

- **29-30 July:** completed the approved Production compatibility release, deployed 16 migrations
  and two Edge Functions, enabled notification schedules, released the fault-tolerant scraper and
  reduced Production scraper backups to the intended 44 recovery objects.
- **31 July-1 August:** recovered the RevSports importer, added the guarded Production release path,
  locked the 14-block plan, and implemented formation/line-up, domain preparation, navigation,
  dashboard/availability, communications, voting reliability, core administration, scoped module
  permissions, Committee Management, Safety Hub writes and Dev quality automation.
- **2-3 August:** added session-bound/mode-aware permission enforcement, disposable actual-role Dev
  accounts, route/menu guards and a broad owner-test evidence matrix. Follow-up fixes covered role
  labels, Umpire Match Voting draft/context handling, fixture/availability deduplication,
  notification author exclusion and state retention.
- **4 August:** completed the fixture/calendar presentation batch, Expense Hub Stages 1 and 2, and
  the `/admin/users` broad-query fix now deployed at `6246a48`.

Recent commit history is the strongest concise record of landed work. Start at `6246a48` and review
back through `18aa428` for the owner-test package and `682b8ea` for the last Production-aligned
baseline.

### Known open defects and cautions

- The actual-role browser matrix is not complete. A Viewing-as preview is useful but is not proof
  of the same permissions as a separate account.
- A rejected role/mode switch can leave the wrong club visible even though the backend correctly
  denies access.
- Umpire Match Voting candidate search must be regression-tested against only the fixture's valid
  people; older evidence found overly broad club membership suggestions.
- Broadcast recipient queries previously included the author. A fix landed, but end-to-end
  notification regression testing remains required.
- Live Supabase schema can differ from migration history. Check the live Dev schema before any
  database-dependent change.
- There is no complete automated signed-in browser suite. Desktop evidence exists; tablet/mobile
  integrated testing remains incomplete.
- Full repository lint has known debt. The latest read-only takeover run reported 360 errors and
  78 warnings; TypeScript, production build, 10 Expense Hub tests and 144 Python regression tests
  passed. Separate existing lint debt from regressions in changed files.
- `docs/current-state.md`, `docs/owner-test-matrix.md` and some curated Vault notes contain dated
  status wording. Use dates and commit evidence; do not treat an older "pending deployment" line as
  newer than this snapshot.

### Recommended takeover order

1. Run `git status --short --branch` and preserve the two existing local changes.
2. Read the local diff in `UsersManagement.tsx` and `notes/known-issues.md`; do not overwrite it.
3. Continue `docs/owner-test-matrix.md` from the Users/Club Admin checkpoint using the prepared
   disposable Dev accounts. Temporary credentials must remain ephemeral.
4. Test the local focus-preservation/scoped-role change. If it passes, run the required checks, review the
   exact diff, then commit and push only the intended files to `dev`.
5. Work through fixtures, communications, Player MVP Voting, Umpire Match Voting, Formation,
   Expense Hub, Safety Hub and Committee Management with clearly marked disposable Dev data.
6. Update the matrix and current-state notes with evidence, not assumptions.
7. Present failures and owner-judgement items to Aaron. Promote accepted Dev work to `main` only
   after reviewing divergence and the exact commit set.
8. Keep `prod`, Production systems, domains, secrets and destructive membership cleanup behind
   their separate approval gates.

### Useful transfer references

- `docs/development-plan.md` — planned blocks and implementation state.
- `docs/owner-test-matrix.md` — line-by-line verification checklist and execution order.
- `notes/known-issues.md` — defects and parked work, including the local persistence addition.
- `docs/domain-migration-plan.md` — domain preparation, live rollout and rollback gates.
- `docs/production-release-process.md` — guarded Production release tooling.
- `docs/scraper-operations.md` — scraper schedules, backup and retention routines.

### Documentation state

- This handoff is intentionally the main 8 August transfer snapshot.
- `docs/current-state.md` is still the canonical implementation history and has been corrected for
  the deployed Users fix, but its long dated entries should be read chronologically.
- The curated Vault pages were last edited on 30 July and therefore lag newer Expense Hub, fixture
  and owner-test work. The generated repository mirror is current to committed `origin/dev`.
- Because this task is being completed with existing local work still uncommitted, Obsidian close-out
  remains pending until the intended files are committed and pushed to `dev`, followed by sync and
  `-Check`.

### 8 August 2026 connection readiness audit

- GitHub app access works as `SportStackApp` with administrator permission. GitHub CLI is now
  actively using `SportStackApp`; the HTTPS remote and repository-local commit identity are correct.
- The Supabase app and CLI both reach SportStack Dev and Production. This checkout remains linked to
  Dev, both projects report healthy, and the Dev Edge Function gateway correctly rejects
  unauthenticated calls to protected functions with HTTP 401.
- The Vercel app reaches the `sportstackapps-projects` team and the `sportstack` project. The latest
  Dev deployment for `6246a48` is READY. Local Vercel CLI is authenticated only to Aaron's personal
  account and the checkout has no `.vercel/project.json`; use the Vercel app for routine inspection.
  The guarded Production script retains its separate encrypted access path and cannot complete a
  preflight while the worktree is intentionally dirty.
- Dev, Main and Production public addresses return HTTP 200. The T3 collaborative browser and local
  Playwright Chromium both load Dev successfully. The pinned scraper environment is now aligned at
  `supabase 2.31.0`, `beautifulsoup4 4.15.0`, `playwright 1.61.0` and `requests 2.34.2`.
- Development environment validation, plan lint, TypeScript, production build, 10 Expense Hub tests,
  144 Python tests, Obsidian sync/check and the daily scheduled-task status pass. Full lint remains
  at its known 360-error/78-warning baseline. Docker Desktop is installed but its daemon is stopped;
  Deno is not installed.
- The latest Production scraper run `31238193085` had one failed Sunraysia target because GitHub's
  runner received HTTP 403 from a round page. The same base, game and round URLs returned HTTP 200
  locally, while the other targeted fixture jobs passed, so this is not a Supabase credential
  failure. Monitor or separately harden retry handling before treating it as resolved.
- Dev function inventory has drift: deployed `provider-key-healthcheck` and `update-user-details`
  are absent from the repository function folders, while repository folders `clear-test-data`,
  `profile-claim` and `profile-claim-admin` are not in the deployed Dev list. Reconcile this
  read-only before the next related function edit or deployment.

## Detailed implementation history

The entries below retain earlier technical detail. Where their pending/deployed wording conflicts
with the 8 August snapshot above, the newer snapshot and current Git evidence win.

- The 4 August owner retest found `/admin/users` failing for both broad Super Admin and scoped
  account views. Supabase API logs confirmed `admin_visible_profile_ids` succeeded, then the browser
  sent hundreds of returned UUIDs in one `profiles?id=in.(...)` URL and received HTTP 400. The fix
  batches authorised profile IDs into safe requests before sorting and paging. No database, user,
  role or permission data was changed. It is committed and deployed to Dev as `6246a48`; the page
  now loads and scoped owner testing continues.

- Expense Hub Stage 1 is implemented on the Dev code/database path at `/expense-hub`. It includes
  manual personal/association/club expenses, scoped suppliers/aliases/payment methods/categories,
  GST and business-use calculations, private multi-file attachments, duplicate warnings, archive/
  restore, audit snapshots, combined filtering, dashboard summaries and filter-aware Excel/PDF
  exports. Four additive Dev migrations ending `071327`, `073000`, `074800` and `080500` are active.
  Access is deny-by-default through `expense_hub_access`; Aaron has Dev owner access. Finance
  administrators need an explicit association/club grant, can edit shared records and cannot change
  original ownership. Live rollback tests and Supabase advisers passed. Production is untouched.
  The next checkpoint is Aaron's signed-in Dev workflow test described in `docs/current-state.md`.

- The fixture batch now centralises bye presentation, adds calendar previous/next/current month
  navigation, and colours historical results green/red/orange for the selected team's win/loss/draw
  with its score on the card. It expands completed fixture detail with RevSports
  participants, goals and cards joined to full SportStack profiles where linked. Regular players
  who played appear first, participating fill-ins second and remaining eligible players last.
  Admin Fixtures now mirrors active cascade values in its labelled filters, lower cascade levels
  are not predictively selected, and shared competition lists use senior/Open/Women then descending
  junior order. Fixture Management routes and navigation are limited to Super/Association Admin;
  additive Dev RLS restricts mutations to true Super Admin mode or the selected Association Admin
  scope. No fixture or membership rows were changed. Deployment and browser retesting remain required.

- The Dev feedback log was re-read on 4 August. The newest competition-ordering request is covered
  by this fixture batch, pasted feedback images were already implemented, and no additional fixture
  blocker was found. The other open feedback remains part of the longer development plan.

- The 3 August separate-account discovery found direct-route and contextual-menu failures that a
  Viewing-as preview had not safely proved: Team Manager could open broad admin pages, Coach and
  Player could reach a blank Roles & modules route, Player exposed Umpire administration, Coach
  showed Edit branding, and Umpire/Voter identities lacked team context. A local active-mode route
  gate, non-blank fail-closed screen, contextual menu filtering and Umpire/Voter scoped reset pass
  focused lint, TypeScript, build and 16 regression tests. Additive migration
  `20260803090000_scope_reserved_umpire_voter_accounts.sql` is applied and the reset Edge Function
  is active as version 8. The frontend still needs its `dev` deployment and actual-role retest.
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
  revisions; broadcast notification recipients include the author; and Umpire Match Voting search
  is too broad. Source review confirms Player MVP Analytics already has the requested three
  URL-backed tabs. It also confirms the availability-to-line-up workflow exists through My
  Dashboard, fixture detail and Line-up, but its access helper uses stored roles rather than the
  active Viewing-as mode.
- A final read-only browser check on deployed build `9949d2b` confirmed the active **Viewing as**
  preview remained Team Manager while Profile incorrectly said `Viewing as Super Admin` and the
  Lucas HC Admin Dashboard incorrectly showed a `Super Admin` badge. Source review confirmed these
  labels show the root account mode/highest stored role instead of `activeMode`; this is a display
  defect, not evidence that the active preview reset. Profile also rendered one unnamed role/scope
  line because its local role label maps omit the existing `UMPIRE_ADMIN` enum value. Back from Team
  Chat briefly restored `/admin`, then the application asynchronously replaced it with `/dashboard`.
- The Lucas HC fixture detail repeated `James V` and `Tom Batchelor` in availability. The Line-up
  page loaded Coach controls, availability labels, formation positions and Primary/Secondary
  roster relationships; no selection was saved or published.
- Exact source causes are now recorded: the Umpire ballot uses stored roles rather than active mode,
  `/admin/analytics` lacks a direct module gate, Team Manager is treated as an admin by
  `useAdminScope`, the Admin badge uses the highest stored role and Profile uses the root mode label,
  Dashboard duplicates the bye formatter with unconditional fallbacks, and Umpire suggestions load
  active memberships from every team in both fixture clubs. The user Edit Details action is an
  in-page dialog, so its observed Dashboard return belongs to the remaining mode/navigation reset.
  Communications loads the newest 50 messages, paginates earlier batches of 50, excludes the
  sender from Team Chat unread counts and records future edits in immutable revision history.
  Account theme persistence uses `profiles.theme_preference` with local storage only as fallback.
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
  Coach, Player, Umpire and Voter testing. No credentials are stored in the repository. Aaron has
  authorised hands-off password resets and recoverable Dev-only testing changes for these
  disposable identities. Migration `20260802231405_reserved_dev_test_account_lookup.sql` and
  `provision-dev-test-account` version 7 provide an explicit reset path limited to the seven exact
  metadata-marked accounts and still require a current Super Admin session.
- Temporary credentials must remain ephemeral. This standing Dev sandbox authority does not cover
  Production, `prod`, domains, secrets, force-pushes or historical membership cleanup.
- The historical-membership snapshot contains 201 duplicate user/team groups and 44 users with
  multiple active Primary memberships (490 captured rows). New invalid writes are blocked; no
  historical row was changed and cleanup still requires separate approval.
- Quality status for the package: baseline-aware development-plan lint, TypeScript, production
  build and 30 focused migration/security tests pass. Repository-wide lint remains a separate baseline
  of 362 errors and 76 warnings.
- On commit `4390b47`, 32 focused session-context, voting-module, Committee/Safety and SQL-safety
  `unittest` checks passed. Full `npm run lint` still reports the same 362-error/76-warning baseline.
  Fresh 1280 x 720 browser checks found no document-level horizontal overflow on My Dashboard,
  Fixtures, Communications, Roster, Formation Library, Safety Hub or Committee Management. Tablet
  and mobile widths remain unverified in the current fixed-width authenticated browser.

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

- Committed repository Markdown is authoritative. Its generated, read-only Big Brain mirror is
  `Projects/SportStack Repository`, with `_Index.md` as the entry point.
- The active vault is `C:\Users\mulla\OneDrive\Documents\Big Brain`.
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
## 21 August 2026 — Feedback register clean-up

What changed:

- Reconciled all 88 Development feedback rows against current code, deployed owner evidence and the
  consolidated plan.
- Closed 26 completed, stale, duplicate or test-only items with an evidence note. The register is
  now 53 Open / 35 Closed; no row was deleted.
- Fixed the duplicated **My coordination** Player navigation item and added a regression check.
- Merged genuine Open themes into `docs/consolidated-open-items-plan.md`; detailed decisions are in
  `docs/feedback-register-reconciliation-2026-08-21.md`.

What Aaron should test next:

1. In Dev Player mode, confirm **My coordination** appears once in the left navigation.
2. Use a disposable account with only a Pending team application and confirm it sees only the
   approval workflow, with no team data or Player access.

Risk level:

- Low. One navigation entry and feedback administration fields changed. No schema migration or
  Production change is included.
## 29 August 2026 - Published Player MVP tally presentations

Implemented on `dev`:

- Scoped Team Management users can build, preview, schedule, publish, withdraw and replace saved Player MVP tally presentations.
- Player recipients see a new-results card under `/mvp-votes` and watch privately at `/mvp-votes/tallies/:id` without the normal SportStack navigation.
- Published data is an anonymous, immutable snapshot. Original Player MVP votes are never updated by this feature.
- Publishing rechecks the selected sessions, vote state and explicit audience against the saved preview fingerprint.
- The Dev database has three new RLS tables, three additive migrations, secured RPCs, a one-minute `pg_cron` job and email work claimed by `sportstack-notification-dispatch` version 8.
- New public-table Data API grants are explicit: authenticated users receive SELECT only, anon receives none, and all lifecycle changes use checked RPCs.

Verification:

- Both migrations passed rolled-back Dev dry-runs; the live transactional SQL regression test passed and rolled back all synthetic data.
- Focused Vitest, ESLint, TypeScript and Vite build checks pass.
- The Dev advisor reported only the five intentional authenticated SECURITY DEFINER management RPC warnings for this feature. All new foreign-key index notices were resolved in the second migration.
- Local browser checks passed at 1440x900, 820x1180 and 390x844 with no horizontal overflow or Vite overlay. The protected route correctly redirected a signed-out browser to login.
- Full authenticated owner testing is still required because no test account password was created or accessed.

Production boundary:

- No `prod` branch, Production Supabase project, Production Edge Function or production deployment was changed.

Owner test:

1. On `https://dev.sportstackapp.com.au`, publish a short tally to one selected test player and verify the notification deep link, playback controls and unrelated-player denial.

# SportStack Current State

Last updated: 2026-08-31

This file is the short, current project status for ChatGPT, Codex, and Aaron.

Update this file after every meaningful Codex task, pull request, schema change, deployment, or confirmed live-data check. If this file conflicts with older handoff documents, this file wins unless Aaron says otherwise.

## 31 August readiness inventory and Dev consistency batch — completed on Dev

- The complete route, table and form inventories are now in `docs/production-readiness/`. They
  distinguish observed passes, source-only checks, sorting exemptions and persistence gaps rather
  than treating an arrow or saved field as proof.
- The current Dev batch gives the shared **Viewing as** selector an accessible name, removes the
  confirmed sidebar text-contrast failures and prevents the Safety donut's duplicated graphic from
  being announced as an unnamed image.
- Player MVP Analytics Vote Completion and Individual Votes Log now have stable two-way sorting.
  Expense Hub now sorts all operational data columns by their actual value and keeps filters in
  per-user browser-session storage rather than exposing search or amount values in the URL.
- Error Logs and Feedback now sort every meaningful data column in both directions. Error details
  are keyboard operable, support controls and scope selectors have accessible names, and the two
  support pages use the correct heading order and locally compliant contrast.
- The Production scraper failure is confirmed: finals labels such as **Semi Finals** lose their
  numeric RevSports round identifier before workflow fan-out. The repair is documented in
  `docs/production-readiness/PRODUCTION-SCRAPER-FAILURE-2026-08-31.md` and remains approval-gated
  because it affects a Production-capable workflow.
- Commits `db1717b`, `8b6ad73`, `6368058`, `c413edc`, `cfe794b`, `ae39443` and `68192c4` are deployed. Player MVP sorting, Expense sorting and Expense
  session-filter refresh pass in the signed-in Dev browser. Safety Hub reports zero Axe WCAG A/AA
  violations at 1440x900 and 390x844; the support-table browser checks and accessibility audit pass.
- Checks pass: 33 Vitest files/128 tests, TypeScript, Production build and Dev Quality runs
  `33317078740`, `33317202053`, `33338050802`, `33338148158`, `33338265367`, `33338415213`
  and `33338541068`.
  Full lint improved to 349 errors/77 warnings. No Main, `prod`, database or Production change is
  included.

## 30 August walk-away consistency findings and repair — completed on Dev

- A signed-in Dev walk-away cycle completed the Admin, Fixtures, RevSports Review, Player MVP,
  Safety Hub, Profile, Coaching and line-up checks. It found no Blocker or High defect, four Medium
  defects and one Low defect. Sorting, RevSports filter persistence/default-Unmatched behaviour,
  Quick Action persistence and the previously repaired line-up interactions passed.
- The five recorded defects are: line-up team choice resetting on refresh, cramped mobile line-up
  markers, Club Admin being blocked at the Player MVP analytics route, an unlabelled formation
  selector and a blank legacy role label on Profile.
- Dev commit `99dff2c` remembers the chosen fixture team for the browser session, rotates the pitch
  into portrait on small screens while preserving canonical drag coordinates, allows Club Admin
  through the route while keeping Association Admin out of individual ballots, labels the formation
  control and displays **Legacy Umpire Admin** instead of a blank role.
- Follow-up commit `bdc8867` constrains portrait marker positions to safe mobile insets. Commit
  `3a4ffd4` gives the mobile navigation button and icon-only bench removal controls accessible names.
- Signed-in Dev closure now passes. Pumas remains selected after refresh; the formation and team
  selectors have stable names; 390x844 and 1569x912 show no horizontal overflow or marker-label
  collision; and the final Axe WCAG A/AA run reports zero violations. Two Radix/contrast checks were
  tool-incomplete rather than failed and remain review notes, not inferred passes.
- Reserved disposable identities now cover Association Admin, Club Admin, Team Manager, Coach,
  Player, Umpire and Voter. Club Admin reaches its club-scoped Individual Votes Log; Association
  Admin remains aggregate-only; Team Manager, Umpire and Voter reach their expected modules and are
  redirected away from Roles & modules. No normal account was changed.
- Verification passes: 33 Vitest files/128 tests, focused lint, TypeScript, Production build, Dev
  Quality runs `33297236883` and `33298089720`, and live bundles for `bdc8867` and `3a4ffd4`. Full lint
  remains at the established 350-error/78-warning baseline. Production, `prod`, Main and the database
  are unchanged by this closure pass.

## Walk-away Dev accounts and browser pre-flight — 30 August 2026

- **Standing owner authority:** the seven reserved disposable Dev accounts for Association Admin,
  Club Admin, Team Manager, Coach, Player, Umpire and Voter are the approved identities for
  unattended actual-role testing. Aaron reaffirmed that Codex may reset these accounts and make
  recoverable Dev-only test changes without waiting for another approval.
- The accounts are managed by an actual Super Admin from **Roles & modules → Dev test accounts** at
  `/admin/roles-permissions`. Temporary credentials are ephemeral: never commit them, place them in
  Big Brain or other notes, or expose them in logs, screenshots or chat.
- **Hard pre-flight:** before Aaron walks away, run the repository-pinned browser tool through
  `npx agent-browser`, prove that the controllable browser—not only the Codex in-app browser—is
  signed into Dev, open one protected route, confirm the exact role/scope and complete one harmless
  interaction. Do not declare the unattended run ready until those checks pass.
- This authority never covers Production, `prod`, normal user accounts, destructive cleanup,
  secrets or unrecoverable changes.
- During the 30 August role cycle, one Umpire temporary password was briefly unmasked in internal
  automation output. The affected disposable-account password was immediately replaced with a new
  random value that was never displayed or retained, and all automation browser sessions were
  closed. No normal account or Production identity was involved.

## READY-004 combined playing-position display — 30 August 2026

- Profile Team Player Details and Coaching Position Ratings now use one **Playing position** list.
  Paired choices are presented as **Defender - Left**, **Midfielder - Centre**, **Attacker - Right**
  and the other matching combinations.
- Deliberate area-only, side-only and Goalkeeper choices remain available for cases where one part
  does not matter. New paired selections use a single stable position code, avoiding the ambiguity
  of separately selecting multiple areas and sides.
- Existing separate preferences and assessments are retained and remain visible; the app does not
  guess which old area belongs with which old side. No data backfill or migration is included.
- Focused lint, TypeScript, Production build and 30 Vitest files/118 tests pass. Full lint remains at
  the existing 350-error/78-warning baseline. Commit `6c3d87c` is deployed on Dev; Dev Quality,
  Vercel and deployed-bundle checks pass.
- Signed-in owner save/reload acceptance remains open. Main, `prod` and Production are unchanged.

## READY-005/006 coaching rating and card details — 30 August 2026

- Clicking an already-selected 1–4 coaching assessment now clears it; selecting a different number
  replaces it. An optimistic save failure restores the previous screen value.
- The Dev `coach_position_assessments.assessment` field now permits null as the explicit cleared
  state and has a database check allowing only null or 1–4. All eight existing values were valid.
  A temporary null update followed by rollback left all existing rows unchanged.
- The Cards summary is now an accessible button. It opens a compact list of affected games with the
  date, opponent, result and exact green/yellow/red card counts for the selected history period.
- The focused lint, TypeScript, Production build and 30 Vitest files/117 tests pass. Full lint remains
  at the existing 350-error/78-warning baseline. Commit `7b955e3` is deployed on Dev; Dev Quality,
  Vercel, deployed-bundle and signed-out return-path checks pass.
- Production is unchanged. Signed-in owner acceptance remains open.

## READY-002/003/007 pitch interaction repair — 30 August 2026

- Pitch players now open the same on-screen history as bench and reserve players. The list contains
  every game from the line-up fixture's calendar year, in the existing newest-first order, rather
  than stopping after five games.
- The small dotted drag handle is removed. Coaches drag the whole player/position marker, and the
  code preserves the original grab point so the marker no longer jumps its centre to the cursor.
- A three-pixel movement threshold separates a click from a drag. Clicking selects the position and
  player history; dragging only moves the marker. The selected marker has a prominent amber ring.
- The focused lint, TypeScript, Production build and 29 Vitest files/115 tests pass. Full lint remains
  at the existing 350-error/78-warning baseline. Dev Quality, Vercel deployment, deployed-bundle
  checks and the signed-out route/return-path smoke pass for `a08fad1`.
- No database migration or live-data write is included. Signed-in owner acceptance is still
  required before these findings close.

## READY-001 roster selection safeguard — 30 August 2026

- A read-only Dev query confirmed the reported line-up has 13 saved roster players and 13 saved
  assignments. David Jochinke, Sandon Schultz and Simon Grant are the three placeholder-linked
  profiles excluded by the old roster candidate query.
- The roster selector now loads normal non-placeholder candidates plus every already-selected
  profile. It deduplicates the combined result and blocks **Use selected roster** if any saved
  selection still cannot be resolved, preventing a partial load from silently removing players.
- The focused changed-file lint, TypeScript, Production build and 28 Vitest files/113 tests pass.
  Full lint remains at the existing 350-error/78-warning baseline.
- **Passed and closed:** Aaron confirmed all 13 players are visible and selected, and that Apply,
  Save and refresh retain the roster and assignments. No database migration or live-data write was
  included.

## Production readiness programme — 29 August 2026

- The detailed repair, consistency-audit, missing-test, walk-away, Main and Production gate plan is
  now `docs/production-readiness/PLAN.md`. `docs/consolidated-open-items-plan.md` remains the single
  priority list.
- The programme records the known roster-selection data-loss risk first, then the pitch interaction,
  player-history, combined-position, coaching-rating, card-detail and Quick Action findings.
- Table readiness means every meaningful data column has its correct two-way sort; action-only
  columns are deliberately not sortable. Form readiness uses an explicit persistence policy rather
  than retaining sensitive or invalid state indiscriminately.
- The walk-away default is Dev-only, read-only and report-only with isolated evidence. No Production
  action, recurring automation, application code, database object or live data changed in this
  planning pass.

## Admin, line-up and coaching improvement batch — 29 August 2026

- The approved Dev batch adds preferred-name and nickname storage, without yet changing ordinary
  name display precedence. Match pitch labels now use first initial plus surname, or the saved
  per-fixture nickname choice.
- Line-up building now starts from a deliberately selected match roster. The working side column is
  labelled **Line-up**, recent player game summaries open on the same screen, formation markers can
  be moved for one fixture, and **Reset positions** restores the template. The ineffective Suggest
  action is removed.
- Coaching Squad supports team selection for coaches/managers with more than one team. Formation-
  specific position duplication is replaced by canonical area and optional side traits. Author-
  private notes can be attached to a player's fixture history. The AI Coach Narrative remains a
  parked future feature and does not call an AI service yet.
- Admin navigation no longer repeats Dashboard and Fixtures in the top Admin menu. The top version
  badge is removed, the mode switcher is at the top of the sidebar, and Quick Actions are editable
  and reorderable in browser storage.
- Clickable ascending/descending table headers were added to Fixtures, Player MVP sessions,
  RevSports Review and Safety Hub register tables. RevSports filters persist for the browser
  session and default to **Unmatched**.
- Individual Player MVP ballot audit is now presented to Super Admins and Club Admins for their own
  clubs; Association Admins retain aggregate analytics only. The matching Dev RLS policy was
  changed from Association to Club scope.
- Dev migration `20260829074811_admin_lineup_coaching_improvements.sql` is applied. It adds three
  RLS-protected line-up/coaching tables, two profile fields and canonical formation-position fields.
  Live verification found all expected columns, tables and policies. Six exact stale Hockey
  Ballarat venue/pitch review rows, including `In8n`, were marked ignored; none were deleted.
- TypeScript, the production build, 28 Vitest files/111 tests and focused changed-file lint pass.
  Full lint now reports the existing repository debt at 350 errors/78 warnings. Signed-in deployed
  Dev owner testing remains required before Main staging; Production is unchanged.

## Desktop persistence and accessibility review — 29 August 2026

- The reviewed 14-commit Dev catch-up, followed by two small accessibility commits, is now aligned
  on Dev and Main staging. Production and `prod` were not changed.
- Login, Sign-up, Reset Password, signed-in and public Umpire Match Voting selectors, and Fixture
  Management edit/delete icon buttons now expose clear names to assistive technology.
- Live desktop checks confirmed the new names on Dev and Main. The public Umpire Match Voting form
  retained entered name and email text after switching browser tabs and returning; nothing was
  submitted or deleted.
- Signed-out protected routes preserved their intended return path. Fresh public Dev and Main
  browser sessions had no console errors on the tested routes.
- Authenticated role pages and a true Windows application-to-application focus switch remain
  **Blocked** because the isolated test browser had no signed-in account. Do not treat the public
  tab-switch check as proof that every authenticated form and search page retains work.
- Authentication pages still need a later landmark, heading and colour-contrast review. The Dev
  landing page still shows Grampians Hockey and a 2024 footer; whether that branding is intentional
  is **UNKNOWN — needs confirmation**.
- Focused lint, development-plan lint, TypeScript, production build, 23 Vitest files/87 tests,
  153 Python tests and both Dev Quality runs passed. Full lint reproduced the existing 359-error/
  78-warning baseline. No database migration or retained test data is included.

## Approved target access-control design - 28 August 2026

- The future scope, responsibility, permission, capability, module-entitlement and temporary-
  assignment model is documented in `docs/access-control-model.md`.
- Aaron approved the model through staged reviews covering 15 permission matrices, independent
  **Working as** contexts, membership and player participation, Committee authority, operational
  coordination, both voting modules, exemptions, Incident and Discipline, Safety Hub, unified
  communications, personal information, audit, handover and account closure.
- This is design documentation only. It does not claim that the current app or live database already
  follows the target model. No application code, database object, live data, module entitlement or
  deployment was changed.
- Implementation remains parked until a separate compatibility review maps current roles,
  permissions, routes and live Dev schema to the approved target model.

## Dev catch-up acceptance and repair run — 21 August 2026

- Dev commits `a6f2354` through `08b30f9` are pushed and deployed. They resolve the `nanoid`
  advisory; complete the Player Explorer feedback package and Team Manager performance repair;
  stabilise scoped administration; retain Fixture dialogs and label byes; refine Umpire Match
  Voting export/results/review; and correct dashboard communication-channel scope queries.
- Player Explorer passed its deployed Team Manager regression: 30 scoped players, two result pages
  and all-result totals loaded without the earlier statement timeout. Super Admin owner checks had
  already passed filters, sequence preset, saved-filter lifecycle, persistence and scheduling.
- Club Admin Viewing-as showed only context-applicable roles in Users. Scope changes settled on the
  latest authorised selection. Large-page empty browser snapshots were checked against the live DOM
  and were a browser-wrapper limitation rather than blank application pages.
- Fixtures Management displays **Bye** in the Score column. Match Details restores from per-tab
  session state when the page regains focus and closes only through an explicit action. The browser
  automation cannot emit a real Windows focus event, so the regression used a page-focus click.
- Umpire Match Voting now exports separate Seniors/Juniors sheets, supports association-wide but
  association-scoped candidate search, shows association top 10 or full per-division leaderboards,
  and sorts submission headings in both directions with chronological Round ordering.
- Communications, Coordination, Committee Management, Safety Hub, Expense Hub and Incident and
  Discipline passed read-only route smokes. Full disposable write workflows remain open.
- `entityDashboard.ts` queried a historical `communication_channels.channel_type` column that does
  not exist in live Dev. It now filters the real `scope_type` values `ASSOCIATION` and `CLUB`.
  After deployed dashboard traffic, the PostgreSQL log advanced from 14:42:57 to 14:51:35 UTC with
  no later occurrence of the old column error.
- Separate actual-role browser sessions and the final Dev Umpire Reset/password action are blocked
  by browser credential policy. Viewing-as, read-only data checks and rolled-back security tests
  pass but are not treated as equivalent actual-role evidence. Tablet/mobile integrated testing is
  also blocked by the authenticated browser's fixed viewport.
- Final gates passed 23 Vitest files/87 tests, 153 Python tests, all seven tracked root JavaScript
  scripts by process exit, development-plan lint, TypeScript, production build and
  `npm audit --omit=dev` with zero vulnerabilities. Full lint is unchanged at 359 errors and 78
  warnings. The build retains the documented stale Browserslist, mixed SheetJS import and 3.46 MB
  main-chunk warnings. `test_teams_data.js` still prints a known `teams.team_type` missing-column
  response while exiting successfully, so the root-script review remains open.
- Main, `prod`, Production, domains, secrets and historical membership data were not changed. No
  database migration is included in this 21 August code batch.

## Dev Umpire test-account reset repair — 20 August 2026

- Owner testing found that the reserved Dev Umpire account could neither be created nor reset. Create
  correctly reported that the account already existed, but Reset failed while saving its actual role.
- PostgreSQL logs identified the exact regression: the older provisioning function still tried to
  save Umpire as an Association + Club + Team role after the newer access model made Umpire an
  Association-only role.
- Additive Dev migration `20260820213845_fix_dev_umpire_account_scope.sql` keeps the public wrapper
  signature used by the existing Edge Function, routes only Umpire resets through a corrected
  service-only helper and leaves every other reserved role on the established provisioning path.
- The corrected reset stores one Association-only Umpire role and a separate active Primary team
  membership for the selected team. The helper validates the reserved identity and selected scope,
  and remains unavailable to anonymous or signed-in browser calls.
- The migration and `supabase/tests/dev_umpire_test_account_scope.sql` passed a Dev transaction
  rollback test before application and the same regression test passed live afterwards. Validation
  was rolled back and did not retain a test-data change. The owner should now click **Reset account**
  once more; the authenticated browser-to-Edge-Function result remains the final acceptance check.
- Dev database only. The Edge Function, Production, `prod`, secrets and ordinary user accounts were
  not changed.

## Umpire Match Voting owner feedback — 20 August 2026

- Umpire Match Voting administration data and submission correction passed owner testing.
- Three follow-ups are now in the consolidated plan: an Excel export with separate Seniors and
  Juniors sheets and scheme-specific vote columns; association top-10 versus separate full
  division leaderboards; and clickable ascending/descending submission-table headers.
- Round should continue displaying its familiar label but sort by the linked fixture date behind
  the scenes. Legacy unlinked rows fall back to numeric round and then submitted date.
- Current inspection confirms `xlsx` is already installed and the Umpire Match Voting schema
  already has vote-scheme and scheme-line keys. This is expected to be frontend-only, but legacy
  junior lines without a scheme-line key must use neutral A/B slots rather than guessed gender.
- Owner testing confirmed the ballot's default suggestions show only linked fixture players. Aaron
  wants the magnifying-glass action to deliberately expand into a searchable list of all players
  in the selected fixture/voting record's association, with team/division context and no cross-
  association results. Manual unlisted entry remains available for genuine exceptions.
- No application code, database object or data row changed in this planning pass.

## Player MVP emails default off on Development — 20 August 2026

- Team Manager owner testing confirmed Player MVP Voting can be enabled, but exposed that the
  separate email-notification setting still inherited its original on-by-default value.
- Live Dev contained 96 teams: 95 were on only through the original column default, no team had an
  audited explicit enable action, and Blue had just been explicitly switched off.
- Additive Dev migration `20260820203326_default_player_mvp_notifications_off.sql` changes the
  future default to off and moves inherited values to off while preserving any audited opt-in. All
  96 Dev teams are now off; Blue's Player MVP Voting setting remains on independently.
- The rollback check and `supabase/tests/player_mvp_notification_defaults.sql` pass. A transactional
  active-Team-Manager test confirmed email opt-in and opt-out work without changing Player MVP
  Voting. The UI compatibility fallback also defaults email notifications to off.
- Owner refresh testing passed: Blue retained Player MVP Voting on and email notifications off.
- An email-disabled Blue round then opened successfully, appeared in Team Voting Sessions as Open
  with 0/14 completed, and kept reminder/resend email actions disabled. Aaron accepted the
  remaining ballot and result behaviour without extending the disposable test. Production and
  `prod` are unchanged.

## Dev private-helper permission repair — 20 August 2026

- The 17 August Coordination foundation migration broadly revoked private-function execution and
  unintentionally broke existing signed-in RLS and RPC helper calls. Owner testing exposed Player
  MVP Voting, while current logs confirmed the same cause in Communications, fixture management and
  Incident and Discipline. Live inspection also found affected Safety Hub, Umpire Match Voting and
  Player MVP audit helpers.
- Additive Dev migration `20260820182455_restore_private_helper_permissions.sql` restores
  authenticated execution for the exact 36 helpers previously intended for signed-in policy or RPC
  use. It does not change a function body, RLS policy, table or application data row.
- Six SECURITY DEFINER Coordination helpers created after the broad revoke had inherited PostgreSQL's
  default anonymous execution. Anonymous access is now removed from all private functions. The one
  helper called directly by authenticated Coordination RLS retains signed-in execution; the other
  five remain internal to protected wrappers or triggers.
- The migration passed a full transaction rollback test before application. The reusable
  `supabase/tests/private_helper_permissions.sql` check passes live. A real active Team Manager
  session now passes the Player MVP team/module check, and affected authenticated RLS reads execute
  without permission errors while unauthenticated context sees no protected records.
- The current security-adviser baseline remains 115 warnings plus 16 informational notices; this
  migration introduced no new adviser warning. The Team Manager Player Explorer statement timeout
  is a separate performance defect and remains open.
- Dev database only at application time. Production, `prod`, secrets, domains and historical data
  remain unchanged.

## Consolidated open-items audit — 20 August 2026

- `docs/consolidated-open-items-plan.md` is now the single active implementation and cleanup plan.
- The audit found a clean working tree, aligned `dev`/`main` branches, no open GitHub issues or pull
  requests, and green latest Dev Quality plus Dev/Production scraper workflows.
- Live Dev still has 201 duplicate membership groups, 44 multiple-Primary users and the unchanged
  490-row snapshot. No historical row was changed.
- Live Dev advisers currently report 115 security warnings and 181 performance warnings. These are
  a triage queue; no grant, policy, function, index, Auth setting or database row was changed.
- Current dependency audit reports one high-severity transitive `nanoid` advisory through PostCSS;
  a reviewed lockfile update is required. TypeScript, production build and focused plan lint pass.
  Full lint remains at the known 359-error/78-warning baseline.
- Older plans and session notes remain evidence only where their status conflicts with the
  consolidated plan. Production, `prod`, domains, secrets and destructive cleanup remain separately
  approval-gated.

## Main staging release — 19 August 2026

- Aaron explicitly approved the full Dev-to-Main promotion, including the Production scraper
  workflow change already present on both branches.
- The two independently copied scraper recovery commits were confirmed patch-identical. Current
  Main was merged into Dev without rewriting history, preserving the approved Production workflow
  and all newer Dev application work.
- The Production workflow adds a read-only Friday fixture-mapping readiness check using the
  Production Supabase secrets. A push to Main does not itself start that scheduled job, run a
  Production scraper or deploy the Production app.
- Development-plan lint, TypeScript, the production build, 81 JavaScript tests and 152 Python tests
  passed on the aligned release. Full repository lint remains at its known baseline of 359 errors
  and 78 warnings.
- This promotion changes Main/staging and the Main-owned workflow schedule only. The `prod` branch,
  Production application and Production database remain unchanged.

## Player Explorer permission repair on Development — 19 August 2026

- Player Explorer failed after the 17 August Coordination migration broadly revoked authenticated
  execution across the private function schema. That reset unintentionally removed the five grants
  required by the existing Player Explorer Row Level Security policies.
- Additive Dev migration `20260819193617_restore_player_explorer_function_permissions.sql` restores
  execution for `authenticated` and `service_role` on only those five helpers. `anon` and `public`
  remain denied, and no helper definition, policy, table or source-data row changed.
- The migration passed a transaction rollback test before application. Live Dev verification then
  confirmed the authenticated policy path can call the helper, a session without a signed-in user
  sees zero external entities, and no new Player Explorer security-adviser finding appeared.
- The next signed-in check exposed a separate timeout in the unfiltered appearance-freshness
  request. API logs confirmed every other opening catalogue request completed. Player Explorer now
  derives the V2 freshness date from the already-loaded scoped matches instead of scanning the
  appearance table solely for one date.
- Dev only. `main` and Production remain unchanged.

## Scoped Umpire and Coordinator access on Development — 19 August 2026

- Additive Dev migration `20260819071731_scoped_umpire_and_coordinator_access.sql` makes Umpire an
  association-only role and uses it directly for Umpire offers. No separate Umpire capability
  invitation is required, and Umpire does not imply Supervising Umpire.
- The approved dry-run and rollback check covered all 17 current Umpires. All 17 now have exactly
  one Hockey Ballarat association-only Umpire row. Profiles, names, emails, team memberships and
  historical game mappings were not changed. The evidence list is in
  `docs/umpire-scope-backfill-2026-08-19.md`.
- User Management now requires an association for Umpire and provides protected Umpire
  Coordinator, Technical Bench Coordinator and Volunteer Coordinator pills. These are fixed direct
  permission bundles, not new administrator roles. The three existing `UMPIRE_ADMIN` records are
  labelled **Legacy Umpire Admin**, cannot be newly assigned and were not converted.
- Umpire Coordinator is association-only. Technical Bench and Volunteer Coordinator may be
  association- or club-scoped. A club Technical Bench Coordinator can manage both bench positions
  when either fixture team belongs to their club. Coordinator access does not grant Association
  Admin, Club Admin, sibling Coordinator or sensitive-note redaction permissions.
- Coordinators receive full Coordination navigation but see only authorised tabs and position
  actions. Ordinary Umpires continue to see personal offers and assignments.
- Both transactional Coordination SQL suites pass on Dev, including role-only Umpire offer
  eligibility, accept/decline, unrelated-association denial, exact Coordinator scopes, removal,
  duplicate rejection, club Technical Bench fixture access, and legacy-record preservation.
- All nine focused frontend tests, TypeScript and the production build pass. Full repository lint
  remains at its unchanged documented baseline of 360 errors and 78 warnings.
- Dev only. `main` and Production remain unchanged.

## Coordination Module implemented on Development — 17 August 2026

- The first signed-in owner check exposed an access gate saying Coordination was disabled for Super
  Admin. The shared module resolver had not been extended with the new `coordination` key. Dev
  migration `20260817101100_allow_coordination_module_access.sql` fixes the resolver and scoped
  feature-flag constraint; Coordination now defaults on and can be enabled or disabled through
  Roles & modules at Association, Club, Division or Team scope.
- The same browser check then found a circular offer/privacy policy that raised a loading warning.
  Dev migration `20260817101200_fix_coordination_offer_rls_recursion.sql` replaces the reciprocal
  policy subqueries with private boolean helpers and keeps the original offerer/recipient access.
- `/coordination` now provides fixture staffing, personal offers/assignments, the association
  Umpire Matrix, basic volunteer activities and Umpire Match Voting roster-review queues.
- A fixture receives two Umpire and two Technical Bench positions. One offer may go to several
  people with a private note and adjustable deadline (default 72 hours, capped at match start).
  Accepting means willing only: the position stays unfilled until the coordinator confirms one
  accepted person.
- Recipients may withdraw while waiting. Confirmed people request replacement with a mandatory
  private note; the original remains rostered until a replacement is confirmed. Confirmed duties
  cannot overlap at all.
- Reminder, expiry, notification, availability, material fixture-change reconfirmation, late roster
  correction/dispute, supervision, grade sign-off, qualification and restricted-note workflows are
  database enforced and audited.
- New users can receive an account invitation. Technical Bench, Volunteer and Supervising Umpire
  capabilities still use acceptance; Umpire eligibility comes directly from the scoped Umpire role.
- Umpire history remains association-grade based. Technical Bench warns on first duty and when an
  under-18 is not paired with an adult, using age on the fixture day without showing birth dates.
  Umpire Match Voting roster differences create a review flag only and never block or change a vote.
- The original twelve additive Dev migrations and the `coordination-invite` Edge Function are active
  as version 2. The shared notification dispatcher is active as Dev version 7. No fixture,
  assignment or historical mapping backfill was made; the later approved Umpire role-scope
  backfill is recorded above. No Production change was made.
- Both transactional SQL suites, the module-access regression check, six frontend tests, focused lint, TypeScript, production build,
  signed-out browser routing and unauthorised Edge checks pass. Full lint remains the known
  360-error/78-warning baseline. A signed-in Super Admin browser check now loads the module without
  a warning, and Kangaroos v Revengers displays both Umpire and both Technical Bench positions.
  The remaining workflow checks will continue one at a time; `main` remains unchanged.
- Existing fixture and dashboard availability now display confirmed Coordination duties by role and
  lock normal player-availability buttons until the assignment workflow clears the duty.

## Player Explorer scoped access — 16 August 2026

- Player Explorer now supports Super Admin, Association Admin, Club Admin, Team Manager and Coach
  modes. Lower roles see a fixed, locked scope at the top of the Looker-style filter builder:
  Association; Association + Club; or Association + Club + Team respectively.
- Scope is enforced twice. The UI removes wider options and cannot remove the fixed scope rows. Live
  Dev RLS separately restricts RevSports matches, appearances and identity links using the current
  signed-in Auth session and active app mode, so altering the browser cannot widen the results.
- Super Admin remains global only in genuine Super Admin mode. A Super Admin using **Viewing as** a
  lower role is restricted by the same active-session scope.
- Live read checks returned 4,532 Hockey Ballarat appearances for an Association Admin, 147
  Grampians Hockey Club appearances for a Club Admin and 147 exact-team appearances for a Team
  Manager, with zero rows outside each scope. Anonymous access returned zero rows; genuine Super
  Admin mode retained all 800 matches and 12,395 appearances.
- Lower roles have manual search, sorting, copy and CSV export. Saved and recurring searches remain
  Super Admin-only until scheduled delivery can carry and re-check an immutable scope snapshot.
- Additive Dev migration `scope_player_explorer_access` adds private fail-closed scope helpers and
  scoped SELECT policies. It creates no tables and changes no source data. Its full SQL and scoped
  read checks passed rollback tests before application. Supabase reported no new Player Explorer
  security warning; the existing unused run-history index remains informational.
- Eighteen focused Player Explorer tests, changed-file lint, TypeScript and the production build
  pass. The remaining owner check is one signed-in lower-role interaction flow, especially Coach.

## Player Explorer result export and sorting — 16 August 2026

- The Super Admin Player Explorer results table now sorts when any visible column heading is
  selected. Selecting the same heading again reverses the order; numeric columns initially sort
  highest-first and text columns initially sort A-Z.
- **Copy results** puts the complete current result set into a tab-separated format for pasting
  into Excel or Google Sheets. **Download CSV** exports the same complete result set, including
  RevSports/profile identifiers, identity status, teams, totals, rounds and latest game date.
  Result text is protected from accidental spreadsheet formula execution.
- Result search and column sorting are both applied before export. Pagination only changes what is
  visible on screen and does not limit the exported rows.
- This is a frontend-only change. It does not add or modify database tables, RLS, Edge Functions or
  scheduled searches. Fifteen focused Player Explorer tests, changed-file lint, TypeScript and the
  production build pass. Repository-wide lint remains at its known 360-error/78-warning baseline.
- The remaining owner check is the signed-in Dev flow: run a search, select a heading twice, copy
  the results into a spreadsheet and download/open the CSV.

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

## RevSports scraper reliability repair — 15 August 2026

- Production failures were traced to three incorrect Sunraysia grade-to-division links. The
  `U11 Mixed`, `U13 Girls` and `U16 Girls` source grades now point to the same divisions as their
  mapped teams: `Under 11 Open`, `Under 13 Girls` and `Under 16 Girls` respectively.
- The correction updated exactly three existing mapping rows after a guarded count check. It made
  no schema change and did not delete or recreate any fixture, team or mapping.
- A live follow-up audit reduced the affected Sunraysia import blockers from 90 matches to zero.
- Scraper backups now give the Supabase Python Storage client a real temporary archive path. This
  avoids the `SpooledTemporaryFile` type error seen after the pinned Storage client moved to 2.31.
- Dev and Production workflows now run a read-only mapping-readiness check before their routine
  match scrapes. A blocked mapping fails this early check without importing any fixture.
- All 152 Python tests passed. TypeScript and the production build passed. Repository-wide lint
  still reports the pre-existing baseline debt (438 findings); none is in these scraper files.
- Approved Production refresh `31887322210` then scraped 5,363 Sunraysia rows and imported all
  319 resolved fixtures with zero skipped. The formerly blocked game `2583904` now imports, but
  remains scheduled with no score because RevSports had not published a result at the fresh scrape.
- Read-only readiness runs `31887512718` (Dev) and `31888054208` (Production) both passed. Dev
  backup verification run `31887538981` also passed and created a new private 230,143-byte
  Sunraysia archive in `scrape-backups`.
- The scoped scraper repair is on both `dev` and `main`. It was not merged to `prod`; scheduled
  GitHub Actions use the default `main` branch and their environment-specific secret selectors.

## Main staging release — 14 August 2026

- Aaron explicitly approved the full Dev-to-Main promotion, including the Main-default-branch
  activation of the scheduled Production scraper workflow's V2 fixture importer.
- Main was fast-forwarded to exact application commit
  `c50eb87d6a08e84d9ccfee12978dbb6a8a475de6`. Vercel deployment
  `dpl_3C9JfKKRK6BUDMc8KQo4oicHYu4s` is `READY` for Main.
- The Main address returned HTTP 200. Its signed-out discipline route redirected to login with the
  requested return path and no console errors. The deployed bundle contains the post-referral
  workflow and Rule 7.26 guidance, references only the Dev Supabase project and contains no
  Production Supabase project reference.
- Focused development-plan lint, TypeScript, build, 52 JavaScript tests and 149 Python tests passed
  on the promoted tip. `origin/dev` and `origin/main` matched after the push. Production `prod` was
  not promoted.

## Incident and Discipline workflow redesign — 15 August 2026

- The Dev database now uses the corrected branch: a signed investigation report returns to
  non-conflicted Hockey Ballarat decision makers for the Rule 7.7 outcome, or is referred to the
  formal Tribunal. A qualifying final-round/finals matter can use the direct Rule 7.1 Tribunal
  branch. A separate mandatory three-person review panel is no longer required.
- Incident 007's existing review-panel records remain unchanged and are displayed as read-only
  legacy audit history.
- Every case person now has an immutable case-unique neutral reference. Signed investigation
  snapshots include the neutral people register and exclude the identity mapping from the merits
  report.
- An audited `discipline_risk_assessments` table records likelihood, severity, mitigation,
  responsibility, review timing and tags. Server functions enforce committee, investigator,
  Tribunal and appeal-stage responsibilities.
- The intake UI is compact and dialog-based: case title and private source documents appear first;
  match, people, risk and allegation details open only when requested; predictive suggestions wait
  for three characters and never prevent free text; person roles use a controlled single choice.
- Pathway, conflict and Tribunal guidance links to the checked official sources and keeps the
  unresolved Hockey Ballarat authority/adoption mapping visibly flagged.
- Local quality checks passed for focused discipline lint, TypeScript, production build and 22
  discipline tests. The repository-wide lint still has the known unrelated baseline debt.
- Dev commit `f94442ac0fd724a2c0bbc332eab85a90216b4457` deployed as Vercel deployment
  `dpl_5HMVWDSskSNDBDE6MedjdTyMWYtW` with status `READY`. The Dev alias returned HTTP 200,
  redirected signed-out access safely to login and served the redesigned bundle with only the Dev
  Supabase project reference. Signed-in owner interaction testing remains the next gate before Main.

## Player Explorer saved and scheduled searches — 15 August 2026

- The Super Admin Player Explorer is implemented at `/admin/player-explorer` and is
  listed under **Admin > Data Quality**. Association, Club and lower modes cannot open the route or
  see its menu item.
- It reads the existing RevSports V2 source tables through the signed-in browser Supabase client.
  It loads clean SportStack scope and match metadata first, requests attended/non-removed
  appearances in bounded chunks on the first search, then caches and aggregates them by
  `revsports_player_id` in the application. It does not run dynamic SQL or accept arbitrary SQL.
- The filter area now follows a Looker-style field/operator/value pattern. Season, competition,
  Association, Club, Division/grade, Team, Round and Game date are filter fields rather than fixed
  controls. Numeric and date fields support From/To `between` values. Filters can be combined as
  All/Any conditions inside clickable groups and All/Any groups across the search. In an All
  conditions group, player totals are calculated only from appearance rows matching that group's
  scope filters. Games are distinct matches; appearance statistics are summed.
- Sequence rules now support ordered movement searches such as **at least 7 games in Division 1,
  then at least 1 game in Division 2 afterwards**. Ordering uses `game_date` and `game_time`; a
  same-day transition is excluded when either time is missing because the order cannot be proved.
- Super Admins can save a filter, load it again and choose Manual, Daily, Weekly or Monthly. The
  protected `player_explorer_saved_searches` and `player_explorer_search_runs` tables are owner-only
  through RLS. Authenticated clients cannot write run history or call the service-only claim RPC.
- Recurring searches reuse the existing 15-minute `sportstack-notification-dispatch` Dev scheduler.
  Each due run evaluates the same application-side filter engine, stores a protected result summary,
  creates an in-app notification and sends the owner an email. No dynamic SQL or arbitrary SQL was
  added.
- Results show linked, placeholder, unlinked and identity-conflict states without silently choosing
  between conflicting links.
- The 14 August live Dev recheck found 800 V2 matches, 12,395 appearance rows and 7,809 usable
  attended/non-removed rows. Source and external-identity SELECT policies still require
  authenticated `is_super_admin()`. Current Wimmera appearance coverage remains incomplete.
- Ten focused aggregation/filter/identity/sequence tests, focused lint, TypeScript and the production
  build pass. Full repository lint remains baseline debt at 360 errors and 78 warnings.
- Live Dev migration `player_explorer_saved_and_scheduled_searches` is applied. Edge Function
  `sportstack-notification-dispatch` version 6 is ACTIVE; an unauthorised call returned 401 and a
  valid no-work scheduler call returned 200 with zero sends and zero failures. Supabase advisors
  reported no new Player Explorer security finding.
- The remaining owner test is the signed-in Super Admin interaction flow in Dev. The local server
  starts, but this PC is missing the installed browser-verification skill's `agent-browser`
  executable, so automated visual verification could not run. Production was not changed.

## Current priority

- **Incident & Discipline Phase 1 is implemented on Dev and awaiting owner acceptance:** the hidden
  `/discipline` portal provides assigned cases, atomic case/person/multi-allegation intake, verified
  Rule 7 deadlines, separate preliminary classification guidance, explicit case and portal access,
  investigator independence, notifications, witnesses, private immutable evidence, natural-justice
  safeguards, allegation findings, signed report snapshots, HB decisions, an append-only timeline
  and official-source citations. Intake now explains each jurisdiction pathway and Rule 7 in plain
  language; requires a factual pathway reason; links the official source documents; offers 34
  reusable jurisdiction, safety and allegation-descriptor tags; predicts association-scoped
  fixtures, teams, grades, venues, people and clubs while retaining free-text snapshots; displays
  Home/Away team wording; and keeps each separate allegation alongside the original report source.
  Preliminary Screening now explains its purpose, shows Green/Amber/Red meanings, requires explicit
  factual answers with no preselected classification, screens each allegation separately, preserves
  earlier assessments and sends unclear combinations to Amber human review. Exact Schedule wording,
  penalty-guidance limits and the direct-Tribunal source conflict remain visible.
  Investigation Setup now explains Rule 7.12, requires an explicit internal/external pathway,
  appointment authority, training/experience and separate actual/perceived conflict answers,
  supports one accountable lead plus optional support investigators, offers reusable conflict
  descriptors, preserves every check and links the official HV Rules and HB addendum. Accepted
  appointments align private case roles atomically; a replacement decision records the rejected
  check without granting investigator access. The exact HB equivalent of the HV CEO/delegate
  appointment authority remains visibly labelled as a local interpretation requiring approval.
  The HB Decision screen now records a three-person independent review panel with mandatory email,
  account linking before acceptance, suitability and conflict checks, private individual votes,
  append-only vote revisions and a database-calculated 2-1 or 3-0 majority. It explicitly labels
  three members as an HB operating safeguard rather than Rule 7 wording, and allows a report to have
  no overall outcome recommendation.
  Tribunal Preparation and the complete post-referral pathway are now implemented as the Phase 2
  extension. Tribunal Preparation explains the Rule 7.17 membership,
  Chair and independence requirements; records the HB referral authority, receiving contact,
  presenter, hearing logistics and three proposed member seats; and separates setup from readiness.
  The Outcome tab then guides the coordinator through Notice Pack, Hearing Record, Determination
  and Sanctions, Appeal Pathway and Final Closure. Every save creates an append-only revision.
  Real notice issue is blocked until Tribunal Preparation is `READY`; simulations are clearly
  separated and cannot issue email, appoint people, impose a real sanction or close the real case.
  The UI labels information as **Fact**, **Rule**, **Judgement** or
  **Local interpretation** and never decides guilt or automatically applies a penalty.
- **Accuracy corrections are locked into the Dev rule pack:** finals timing requires the relevant
  club to participate in that competition; current investigation appeals are Rules 7.22-7.25; all
  four direct-Tribunal Schedule triggers are covered; and the linked form's `$250` versus 2026
  Schedules `$500` contempt conflict remains visible. Business-day meaning, NIF adoption/contact,
  authority mappings, natural-justice safeguards, fines/fees and other local treatments remain
  `REVIEW_REQUIRED` until Hockey Ballarat approves them. See `docs/incident-discipline-phase1.md`.
- **Dev database only:** eighteen additive local migration files create 35 RLS-protected
  `discipline_*` tables, a 20 MB private evidence bucket, role-checking functions, UTC/Melbourne
  deadline calculations, 32 classification rows, 10 deadline definitions, 12 local-variation
  records and the verified 2026 Victorian holiday calendar. All migrations passed rollback dry
  runs before application to SportStack Dev. Cross-case access/revocation, regular/Easter and
  finals deadlines, every classification branch, atomic multi-allegation/tag intake and blocked/overridden report
  sign-off passed rolled-back live Dev tests. Immediate safety now remains an overlay on the selected
  internal pathway unless an explicit referral path is chosen. A sign-off test found and fixed the pgcrypto schema
  qualification before release. No rollback records remain; Production, `main` and `prod` are
  untouched.
- **Investigator workflow database evidence:** live Dev migration
  `20260812140314 improve_discipline_investigator_setup` adds the Rule 7.12 appointment fields and
  one role-checking atomic write function. Authenticated direct table inserts are revoked. A live
  rolled-back workflow test passed accepted lead/support assignment, replacement-without-access
  and invalid conflict-decision rejection, then confirmed zero test cases remained.
- **Independent review database evidence:** four live Dev migrations add panel, member and
  append-only vote records; make pre-final votes visible only to their author; cover the new foreign
  keys; and preserve a null recommendation relationship when the signed report does not propose one
  overall Rule 7.7 outcome. Rolled-back tests passed three-member readiness, role exclusion, vote
  privacy, 2-1 majority calculation, post-final visibility and the no-recommendation case.
- **Tribunal-preparation database evidence:** live Dev migrations
  `20260813132301 discipline_tribunal_preparation` and
  `20260813133852 harden_discipline_tribunal_preparation` add RLS-protected preparation/member
  records and one role-checking atomic save function. Readiness requires a formally confirmed
  authority mapping, fixed hearing details, two accepted independent members, an accepted Chair
  and either confirmed Victorian legal-practice eligibility or a recorded formal HB variation.
  The rollback workflow test passed coordinator-only writes, Tribunal-member visibility and complete
  cleanup; the hardening migration restored authenticated function access and covered all new
  foreign keys.
- **Post-referral database evidence:** live Dev migrations
  `20260813182611 discipline_phase2_completion_workflow` and
  `20260813183733 harden_discipline_phase2_appeal_and_closure` add one RLS-protected, append-only
  stage-record table and a coordinator-only save function. Database rules enforce stage order,
  simulation acknowledgement, Rule 7.18 notice safeguards, Rule 7.19-7.21 hearing/determination
  checks, the Rule 7.22-7.25 appeal pathway and closure controls. A final appeal additionally
  requires an independent three-person Appeal Board, qualified Chair, affected people heard, a new
  hearing on the merits and a majority basis. Closure after a proved charge requires a decision
  notice reference, sanctions-register treatment and administrative-fee treatment. Only a real
  closure changes the case to `CLOSED`.
- **Security review:** case content is assignment-only even for Association/Super Admin roles;
  configuration and case access are separate. Supabase reports no anonymous discipline function
  warning or discipline table without RLS. Its authenticated security-definer warnings are
  expected for the client RPC entrypoints, which re-check `auth.uid()` and the required case role.
  New foreign-key indexes are currently reported only as unused because the module has no live
  workload. The `discipline_only` route restriction is not claimed as a complete database sandbox:
  existing SportStack shared directory data remains available to signed-in accounts.
- **Dev deployment verified:** Vercel deployment `dpl_HU2QXTrCJmoEzMrRfKawDZnTUpfY` was `READY`
  for exact preliminary-screening commit `e6b73dfe19ce55da7512296b12f15ee1a6970fdf` and was verified through
  `dev.sportstackapp.com.au`. The Dev address returned HTTP 200; its deployed bundle included the
  new Screen 2 guidance plus the earlier intake guidance, tags, predictive fields and
  multi-allegation controls. It references SportStack Dev Supabase and does not reference
  Production Supabase. A fresh signed-in browser snapshot rendered the complete revised intake
  form without a framework error. Later documentation-only Dev commits may
  update the displayed build label without changing the feature package. Owner acceptance testing
  is still required one action at a time.
- **Investigation Setup deployment verified:** Vercel deployment
  `dpl_BZbwC86F3y6JrFGfV3HZHqdURQMb` is `READY` for exact Screen 3 commit
  `e8018598a4a6d4d30cd0ff61293379005f3537df` and owns the Dev alias. The Dev address returned 200;
  its bundle contains the new Screen 3 guidance and Dev Supabase reference, with no Production
  project reference. The signed-in portal rendered without console errors or horizontal overflow.
  The original empty-case owner-test checkpoint has now been superseded by the live Dev case below.
- **Review panel deployment verified:** Vercel deployment
  `dpl_nvum4aYqAtC3WFAKr8uwj1vQWzoE` is `READY` for exact commit
  `7aec329e84ec56bc9f4da6d0f822292e96462968` and owns the Dev alias. The signed-in Incident 007
  screen shows `REFERRED`, a complete three-member panel, all linked reviewer labels, the three
  simulated reasons and a 3-0 majority. The completed-state message and selected-account reload
  display were corrected during the live walkthrough.
- **Tribunal Preparation deployment verified:** Vercel deployment
  `dpl_BXKA2d8mA39ChMutTG9Bq4visuyW` is `READY` for exact commit
  `95dd3dffb70992dd6b44d2b3f5409a6a1c8f37cc` and owns the Dev alias. The signed-in Incident 007
  screen rendered the source guidance, readiness checklist, hearing preparation and three proposed
  member seats. The deployed UI saved a clearly labelled Dev exercise as `SETUP`, not `READY`.
- **13 August Incident 007 Dev case run:** authorised de-identified email material was entered only
  in the private Dev portal as `HB-DIS-2026-0016`. It retains three separate allegations, preliminary
  screening, Tim's recorded appointment/independence check, notices, witness follow-ups, evidence
  notes, natural-justice checks, three simulated findings and one immutable signed report snapshot.
  At Aaron's direction, the exercise accepted the reporter's account as true only to continue the
  workflow; every derived record says it is a simulation rather than genuine corroboration or a real
  disciplinary finding. The Lead Investigator finding forms are now read-only for the Case
  Coordinator. The deployed panel screen saved three reserved Codex Dev accounts as clearly labelled
  simulated reviewers, each with a placeholder email and no-conflict test record. Three audited
  simulated votes produced a 3-0 `TRIBUNAL_REFERRAL`, stored the report's overall recommendation
  relationship as null, and moved the case to `REFERRED`. The final screen shows the complete panel,
  individual reasons and majority. No real HB panel was appointed, no notification was sent and no
  Main, Production or `prod` system was changed. Tribunal Preparation now holds three unaccepted
  placeholder seats and explicitly unresolved authority, Chair and hearing details. A live Dev
  database read confirmed `SETUP`, no hearing time, no formal authority confirmation, zero accepted
  members and zero accepted Chairs.

- **14 August Incident 007 post-referral run:** the complete downstream pathway was exercised in
  SportStack Dev as five explicit `SIMULATION` records: Notice `ISSUED`, Hearing `COMPLETED`,
  Determination `FINAL`, Appeal `NO_APPEAL` and Closure `CLOSED`. The strengthened closure check was
  saved as append-only revision 2 with a simulated decision-notice reference, sanctions-register
  treatment and fee treatment. No email, meeting, real finding, sanction, appeal or publication was
  created. A live database read confirms the real case `HB-DIS-2026-0016` remains `REFERRED` with no
  `closed_at` value. A suspension longer than 12 months has a separate later Rule 7.26 review path
  after at least 12 months; it is explained but is not part of ordinary case closure.

- **Guided Committee and subcommittee workflow is live on Dev:** commit `deea6c0` replaces the
  single create form with a reusable five-step workflow for Association and Club committees plus
  one level of standing or temporary private subcommittees. It supports suggested purposes,
  inherited scope, editable details, optional positions/access presets/member appointments,
  current-Club-President preview and confirmation, review-before-create, saved draft recovery and
  discard protection. The Committee list now displays parent/child nesting and breadcrumbs, and
  exposes **Create subcommittee** only on active top-level committees.
- **Dev database enforcement is applied:** additive migrations
  `20260811090305_guided_committee_workflow` and
  `20260811091322_fix_guided_committee_creation_returning` add lifecycle/parent fields, restrict
  deletion, preserve closed records, prevent active-child closure, enforce one-level inherited
  scope and validate appointments. The authenticated `create_committee_with_setup` function is
  security-invoker and creates the committee, positions and appointments atomically. Full
  transaction/rollback security suites passed for Association Admin, Club Admin, parent setup
  manager and appointed/private member access, including atomic failure, President snapshot and
  close-preservation checks. No rollback test records remain.
- **Dev verification:** Vercel deployment `dpl_5TWrcvoBeJPPYEUFD3HzTvLmMhTo` is READY and the Dev
  page displayed `v2026.08.11+deea6c0`. The authenticated browser smoke test passed the first two
  guided steps, draft answer recovery after reload, discard confirmation and the responsive
  390 px layout without creating a record. All 26 Vitest tests, focused ESLint, TypeScript, build
  and diff checks pass. Full lint remains baseline debt at 360 errors and 78 warnings. The live Dev
  adviser baseline remains 77 security and 493 performance notices; the new atomic create function
  did not add a security-definer warning. Production, `main` and `prod` remain untouched. Owner UI
  write/access testing across the four intended roles is still required before staging acceptance.

- **Actual Club Admin scope leak repaired on Dev:** Aaron showed that the AM account has Club Admin
  scope only for Grampians Hockey Club, while its header offered Blaze and every other Hockey
  Ballarat club. The server rejected Blaze correctly; the selector and retained route state were
  wrong. Commit `77422f1` filters clubs by active-role scope, replaces invalid retained selections,
  redirects unauthorised club routes and prevents a new mode from inheriting the previous mode's
  unassigned scope. Vercel deployment `dpl_5VMTTeGKRFUvXLxHQxUyDYEDsCS9` is READY. Vitest 22/22,
  focused permission-context Python 23/23, TypeScript and build pass. Aaron confirmed the refreshed
  AM Club Admin selector now behaves correctly. No migration or role change.

- **AM Player multi-team switch owner pass:** Aaron confirmed Player mode offers both Primary Pumas
  and Secondary Lucas HC, and that Lucas HC loads and remains selected without bouncing back. The
  separate multi-Team-Manager-role variant remains pending.

- **10 August Dev repair deployed:** commit `a77f01a` is on `origin/dev`; Vercel deployment
  `dpl_EkW4715qFjkTmfzwCwHRwndRW9qn` is READY and the Dev alias displayed
  `v2026.08.10+a77f01a`. The batch fixes communications reload/pagination/legacy history wording,
  multi-team Team Manager scope resolution, Coach line-up removal, Committee empty wording and
  fixture-scoped Umpire Match Voting candidates. The public voting Edge Function is ACTIVE as
  version 9. Real Team Manager/Coach/Player session retests remain because Chrome automation was
  unavailable during the final pass.

- **Communications draft owner pass:** Aaron confirmed an unsent Team Chat draft survives a full
  `Ctrl + Shift + R` reload on Dev. Automated 50-message pagination/edit-merge coverage also passes;
  no message was sent for this reload test. He then opened an edited message and confirmed its
  history shows the current and earlier versions with the editor and timestamp.

- **Dev Supabase hardening applied:** additive migration
  `20260810090000_harden_functions_and_rls_performance.sql` passed a transaction/rollback dry run,
  then was recorded live as `20260810064248_harden_functions_and_rls_performance`. It fixes two
  function search paths, restricts six trigger-only security-definer functions, optimises 61 RLS
  auth calls and adds 33 foreign-key indexes. Security notices reduced 85 -> 75 and performance
  notices 554 -> 493; `auth_rls_initplan` reduced 61 -> 0 and unindexed foreign keys 164 -> 131.
  No data row, Production system or destructive object was changed. Remaining policy/index/RPC
  warnings require individual review rather than a blanket fix; leaked-password protection remains
  a Dev Auth dashboard setting.

- **Quality result:** focused changed-file lint, TypeScript, build and diff checks pass; Vitest is
  19/19; Python is 167 tests plus 29 subtests; `npm audit` is zero. Full lint is unchanged baseline
  debt at 360 errors and 78 warnings. The dependency update includes React Router 7.18.2, Vite
  8.2.1, Supabase JS 2.112.2 and SheetJS 0.20.3.

- The 9 August actual-role run is recorded in the new top section of `CODEX_HANDOFF.md`. Team
  Manager, Coach, Player, Association Admin, dashboard, fixture/calendar/completed-game, Safety Hub
  and Committee paths passed on Dev. Communications is partial, multi-club Team Manager switching
  failed, Player MVP still lacks an eligible disposable round, and Umpire Match Voting suggestions
  remain association-wide. No Production change or real-user communication occurred.

- Association Admin fixture editing exposed a data-integrity blocker: saving an unchanged local
  time wrote the wall clock as UTC and moved a `12:15 pm` fixture to `10:15 pm`. Commit `e38150d`
  now converts edit/add form values through `associations.timezone` (default
  `Australia/Melbourne`). Focused lint, TypeScript, build, all 16 Vitest tests, all 148 Python tests,
  Dev Quality and Vercel deployment passed. The deployed browser retest and live Dev row both kept
  the original instant. No migration.

- Final health checks found existing debt rather than a new regression: full lint remains 360
  errors/78 warnings; `npm audit --omit=dev` reports 10 high and one moderate production-package
  advisory; Dev Supabase reports 69 security WARN and 239 performance WARN advisor notices. All 16
  Edge Functions are ACTIVE and the latest 100 Edge requests were HTTP 200. Treat dependency and
  advisor remediation as reviewed standalone work.

- The 4 August `/admin/users` failure was fixed, committed and deployed to Dev as `6246a48`. The
  page now splits broad authorised profile sets into bounded requests instead of placing every UUID
  in one oversized PostgREST URL. The owner confirmed the page loads. Scoped role testing continues
  from the Club Admin checkpoint. Owner testing then clarified the persistence problem: navigating
  to another SportStack page may reset that page, but merely switching to another window and back
  must not close an open dialog or discard unsaved text. The focus recheck was unmounting protected
  pages while Supabase reconfirmed the existing permission context. Deployed commit `f3486b0` keeps
  the last confirmed page mounted during that background check and displays Coach/Team Manager role
  scopes when no membership row exists. Aaron confirmed the Users Edit Details dialog and unsaved
  text survive switching windows, and the Coach test row shows its Pumas scope. Roles & Permissions
  still visibly refreshes when focus returns; the broader screen-by-screen focus audit is parked
  until after the current actual-role matrix, with affected screens to be recorded as testing continues.

- The consolidated 8 August transfer state, active workstreams, past delivery summary, remaining
  gates and takeover order are recorded at the top of `CODEX_HANDOFF.md`. The generated Obsidian
  mirror was refreshed from committed `origin/dev` at `6246a48`; local uncommitted changes remain
  intentionally absent from the mirror.

- On 8 August Aaron discontinued the current Roles & modules screen review and parked the broader
  permission model/UI for a later dedicated pass. Existing active-mode, hierarchy, server and RLS
  protections remain mandatory. Permission defects that expose or block a workflow should be fixed
  when encountered; non-blocking gaps should be recorded. Every new feature now requires an explicit
  access-control decision covering the actions relevant to that feature.

- Actual Team Manager testing on deployed `f3486b0` confirmed the Pumas fixture list and scoped
  navigation, but opening a scheduled fixture crashed at the route boundary. Commit `df5b0ec`
  aligned the mismatched availability keys with generated enum values `MAYBE` and `NO_RESPONSE`,
  exhaustively type-checks the style map and passed Dev Quality, build and all 146 Python tests.
  Aaron confirmed the deployed scheduled fixture detail now displays correctly. No migration.
  Follow-up testing found the unselected Maybe button unreadable, mixed Unsure/Maybe copy and no
  way to clear a selected response. A local continuation now uses **Maybe** consistently on Dashboard
  and Fixture Detail, adds readable tinted unselected styles and matches Dashboard's safe click-again
  delete behaviour to return to **No response**. Commit `7d7e67f` passed Dev Quality, build and 148
  Python tests; Aaron confirmed the complete deployed control, persistence and clearing behaviour.
  The same actual Team Manager then opened the Pumas line-up: Coach view exposed the expected
  formation/save/fill-in/suggestion controls, Player view remained readable without editing controls,
  and switching back restored Coach controls. No line-up data was changed.

The locked Owner-Test remediation package is implemented on the Dev database and `dev` code path.
Every observation from the 31 July to 2 August review is now mapped in
`docs/owner-test-matrix.md`. The immediate priority is integrated verification using real Super
Admin, Association Admin, Club Admin, Team Manager, Coach and Player sessions before any `main`
staging promotion.

The fixture continuation now includes the previously deferred calendar and completed-match work.
Calendar view has URL-backed previous/next/current-month navigation. Historical results are green
for a selected-team win, red for a loss and orange for a draw, with the selected team's score shown
on each result card; past byes or fixtures without a score remain muted. Completed fixture detail combines SportStack profiles with RevSports
appearances and statistics, displays the score, round, goals and cards, and orders regular players,
participating fill-ins and other eligible players in that order. Admin Fixtures mirrors the active
cascade in its filter labels, and the cascade no longer predictively selects a sole lower-level
division or team. Shared competition ordering now places senior divisions first, Open before Women,
then junior groups from oldest to youngest. Fixture Management is now available only in active Super
Admin or Association Admin mode. Its Dev RLS policy also restricts writes to true Super Admin mode or
the selected Association Admin scope; Club Admin and lower modes retain read-only team Fixtures.
These changes are awaiting deployed owner retesting.

The Dev feedback log was reviewed again on 4 August. Its newest open request for consistent
senior/Open/Women/junior team ordering is covered by the shared competition ordering above, and
paste-to-feedback image support was already delivered in the existing feedback composer. The
remaining open feedback is already represented by the longer owner-test and development-plan
follow-ups; no additional fixture blocker was found.

The 2 August unattended read-only pass has now exercised the main Dev screens and recorded its
evidence in the matrix. It found genuine remaining gaps in mode labels/route restriction, scoped
role presentation, the My Dashboard bye card, true fixture calendar rendering, legacy chat
revisions, broadcast self-notification suppression and Umpire Match Voting identity filtering.
Fresh read-only browser evidence on deployed build `9949d2b` confirmed the active **Viewing as**
preview can remain Team Manager while Profile and Admin Dashboard incorrectly label the account
Super Admin. Source review confirmed Profile reads the root `modeLabel`, the Admin badge reads the
highest stored scoped role and the unnamed Profile role line is an unlabelled `UMPIRE_ADMIN` value.
These are display defects, not evidence that the active preview reset. Returning from Team Chat
briefly restores `/admin` before the app asynchronously replaces it with `/dashboard`. The Lucas HC
fixture detail also repeated two availability identities, while its Line-up screen loaded Coach
controls, availability, formation positions and roster relationships.
Source review has since confirmed that Player MVP Analytics already has the requested three
URL-backed tabs and that the availability-to-line-up workflow exists through My Dashboard, fixture
detail and Line-up. The line-up access helper still uses stored roles rather than the active
Viewing-as mode, so lower-mode restriction remains unresolved. Commits `879d184` and `5514996`
added frontend guards for deliberate Super Admin mode selection and passed unit, focused lint,
TypeScript, build, Dev Quality and Vercel deployment checks. Fresh deployed build `5514996` still
redirected `/admin` to `/dashboard` and restored Team Manager after Super Admin was selected. The
session-context/navigation cause remains open.

The first separate-account pass on 3 August confirmed Association and Club scope broadly worked,
but found that Team Manager could directly open broad administration routes, Coach and Player
could reach a blank Roles & modules page, Player navigation exposed Umpire administration, Coach
showed Edit branding, and the isolated Umpire/Voter identities had no team context. A verified
local repair now gates every administration route by the server-confirmed active mode, returns a
recoverable error instead of a blank page, filters lower-mode menus, restricts the Umpire ballot to
an Association/Super Admin mode or an actual Umpire role, and removes Edit branding from Coach and
Team Manager modes. Additive Dev migration `20260803090000_scope_reserved_umpire_voter_accounts.sql`
and `provision-dev-test-account` version 8 are active in Dev. The matching frontend deployment and
actual-role browser retest are the immediate next checkpoint.

Direct-route checks while the active preview was Team Manager also rendered Umpire Match Voting and
MVP Analytics. The Umpire ballot authorises from stored account roles, while `useAdminScope` treats
Team Manager as an admin and `/admin/analytics` has no direct module gate. Safety Hub rendered its
empty scoped screen and Committee correctly reported no accessible committees in the same preview.

A continuation on deployed build `4390b47` re-ran 32 focused session-context, voting-module,
Committee/Safety and SQL-safety checks; all passed. Full lint remains at its known 362-error and
76-warning baseline. Fresh 1280 x 720 checks found no document-level horizontal overflow on My
Dashboard, Fixtures, Communications, Roster, Formation Library, Safety Hub or Committee
Management. The authenticated in-app browser has a fixed viewport, so the current integrated
tablet/mobile pass remains unproven. Aaron has now authorised password resets for the seven
reserved disposable Dev role accounts and recoverable Dev-only testing changes. A service-only
reserved-identity lookup and explicit Super Admin reset flow are deployed to Dev, so the
actual-role browser matrix can continue without storing credentials or adding an authentication
bypass.

This package hardens scoped administration, preserves state consistently, separates Player MVP
Voting from Umpire Match Voting, and completes the tested Fixtures, Communications, Coaching,
Safety Hub and Committee workflows. It also adds recoverable route errors, immutable chat revision
history, account-backed theme preference and private committee file storage.

The pre-cleanup Dev snapshot contains 201 duplicate user/team groups and 44 users with multiple
active Primary memberships, covering 490 captured rows. New invalid memberships are rejected. No
historical membership was changed; cleanup needs a separate destructive-data approval.

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
- Disposable SportStack Dev accounts and test data are an owner-approved sandbox. Test-account
  creation/password resets and recoverable Dev-only Auth, database, RLS and Edge Function changes
  may proceed hands-off. Temporary credentials must never be committed or documented.
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

The Owner-Test remediation package now includes its complete Dev-only additive migration set and
matching frontend workflows. The 2 August extension adds reusable permission groups, module-access
sets, role/group/user assignments and direct exceptions at association, club, division and team
scope. All new administration RPCs deny anonymous execution, all new public tables have Row Level
Security enabled, and the `committee-files` bucket is private with a 20 MB limit.

Rolled-back Dev checks confirm group denial, direct-user precedence, administrator hierarchy and
zero retained validation records. Migration `20260802102000_harden_is_super_admin_search_path.sql`
schema-qualifies the existing Super Admin helper so it remains reliable inside hardened RPCs with
an empty search path.

The six follow-up migrations ending `105000`, `106000`, `107000`, `108000`, `109000` and `110000`
passed rollback compile/runtime checks and are applied to Dev. They add transactional disposable-
account and role guards, mode-aware permission reads, writes, listings and runtime resolution,
live-session provisioning authorisation, and exact group-scope/member-hierarchy checks. Duplicate
role rejection, function-access checks and mode isolation passed. The actual Admin Sportstack
`SUPER_ADMIN` account is signed in. Additive migration
`20260802231405_reserved_dev_test_account_lookup.sql` and `provision-dev-test-account` version 7
add an explicit reset operation limited to the seven exact metadata-marked Dev identities. JWT,
live-session and current Super Admin checks remain required; ordinary and Production users cannot
be targeted.

The final session/module enforcement migrations ending `113500`, `114000` and `115000` are applied
to Dev. Matching commit `a06ae9a` is live at the Dev address. `mvp-voting-email-reminders` version 4
and `public-umpire-match-voting` version 5 are active. Post-rollout checks confirmed 13 module-gate
policies, authenticated-only session/mode resolvers, the intentional public Player MVP token checks,
and the unchanged 201 duplicate groups, 44 multiple-Primary users and 490-row historical snapshot.
Seven isolated Dev role accounts are prepared; the actual-role browser matrix remains pending.

The 2 August hands-off checkpoint used the signed-in Admin Sportstack account without mutating test
data. Fixtures, Communications, both voting modules, Coaching/Profile, Formation Builder, Safety
Hub and Committee Management were traversed. Read-only Dev checks confirmed zero configured
permission groups/sets/assignments/overrides/module flags, zero stored chat revisions, 15
administration audit rows and unchanged membership integrity totals. Development-plan lint,
TypeScript, build and all 125 Python tests pass. The detailed pass/fail evidence is in
`docs/owner-test-matrix.md`.

The first owner test exposed one live-schema drift in `admin_save_user_roles`: the function retained
the old `public.app_role` name while Dev uses `public.user_role_enum`. Additive migration
`20260801131220_fix_admin_role_enum_reference.sql` corrected only that reference. A Super Admin
role save, including Association Admin scope, passed inside a rolled-back Dev transaction; no user
or role data was changed by the verification.

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
- Baseline-aware development-plan lint, TypeScript, the production build and 30 focused Python
  migration tests pass. Full repository lint remains at the separate baseline of 362 errors and
  76 warnings.

## Known broken / uncertain

Treat these as current caution areas unless a newer live check proves otherwise:

- Older handoff docs may be stale in places.
- Player MVP Voting is built and live. Older dated notes that describe mock email buttons or manual
  session opening are historical and must not override the current release record.
- Player MVP reminder calls are deployed and scheduled; email delivery should still be monitored
  through normal logs and owner testing.
- A read-only SportStack Dev check on 31 July 2026 found 638 fixtures: none are missing
  `division_id`, while 162 Wimmera fixtures are missing `season_id`. The current analyser can
  resolve 626/638 fixture divisions and 476/638 seasons from staging and mapping data. Wimmera has
  no competition-to-season mapping, so its 162 season resolutions remain ambiguous. Do not apply a
  fixture backfill until that mapping gap and the remaining division/team inconsistencies are reviewed.
- Live Supabase schema can drift from migration files, so verify live schema before database-dependent work.
- Edge Functions in the repo and deployed Edge Functions may be out of sync.
- Supabase Storage Size is an organisation-wide GB-hour average. Check per-project object totals
  before assuming a dashboard warning reflects the current live byte count.
- There is no formal authenticated browser suite yet. The Dev Quality workflow now covers focused
  development-plan lint, TypeScript, the production build, 100 Python regression tests and all
  GitHub workflow definitions; role-based browser flows still need owner smoke testing.
- Viewing-as is not yet a complete security preview: the Umpire ballot checks stored account roles
  instead of active mode, `/admin/analytics` has no direct module gate, an already-open Squad route
  can remain visible, and profile or Admin Dashboard badges can disagree with the selected
  Association Admin mode. The badge currently uses the account's highest stored role.
- The Fixtures page formats byes correctly, but My Dashboard still shows an upcoming bye as
  `Team vs Unknown` with midnight and TBD because Dashboard uses a separate formatter with
  unconditional fallbacks. The Fixtures calendar control only changes the cards to a two-column
  grid and does not render a calendar.
- Legacy edited chat messages have no stored revision rows, so the history dialog can show only the
  current version. New-edit revision capture still needs a disposable write test.
- Player MVP Analytics has the required Player Leaderboard, Vote Completion and privileged
  Individual Votes Log tabs with URL-backed views and filters. Some unlinked Player MVP and Umpire
  Match Voting identities can still fall back to shortened scraped names.
- Umpire Match Voting one-character search works, but suggestions are not sufficiently constrained:
  the loader includes active memberships from every team in both fixture clubs and infers the
  fixture side by club, so it can include unrelated players.
- Scoped user rows render every stored role rather than only roles applicable to the selected
  organisation/team. The Edit Details button is implemented as an in-page dialog; its observed
  return to Dashboard is consistent with the unresolved mode/navigation reset.
- Squad and Roster load and deduplicate visible players, but they do not yet provide the full coach
  workflow for selecting a fixture, reviewing availability, choosing the team, placing it on the
  pitch and distributing the line-up.
- The Owner-Test remediation package still needs its integrated actual-account test using the Admin
  Sportstack Super Admin control plus disposable Association Admin, Club Admin, Team Manager,
  Coach, Player and Umpire accounts, multi-team cascade state, incognito theme persistence,
  committee uploads and Safety Hub linking. Viewing-as checks alone do not close this item.
- The actual Admin Sportstack `SUPER_ADMIN` account is signed in and seven isolated Dev role
  accounts are prepared. The full actual-role browser matrix still needs to be run; Viewing-as
  checks alone do not close this item.
- Advanced permission management currently exposes only module-access keys because those are
  enforced through mode-aware route/navigation resolution and existing workflow RLS. Action-level
  catalogue keys remain hidden until each domain write path enforces them end to end.
- Historical duplicate membership cleanup remains parked. The immutable snapshot and dry-run totals
  are ready, but no row can be consolidated without Aaron approving the exact keep/remove report.
- Umpire Portal staging is waiting at an explicit approval gate: the current `dev` package includes
  a GitHub workflow that can select Production targets, so it has not been promoted to `main`.
- Formation/Lineup private-page browser smoke testing still needs an owner login. Signed-out local
  browser checks passed with no Vite overlay or console errors.
- The reorganised signed-in navigation still needs an owner smoke test in Super Admin, Association
  Admin, Club Admin, Team Manager, Player and Umpire modes.
- The dashboard and availability reliability pass still needs an owner smoke test across a Primary,
  Secondary and, where available, Fill-in fixture.
- The communications reliability pass still needs an owner smoke test for Team Chat plus one clearly
  marked Dev-only Club or Association Update.
- The voting reliability pass still needs an owner smoke test of one signed-in Umpire Match Voting
  ballot on Dev. The Dev database function and existing Player MVP Voting integrity have been
  transaction-tested and audited; Production is unchanged.
- The core-administration pass still needs an owner smoke test of fixture import/manual editing,
  membership-request approval and safe unused-venue deletion on Dev.
- A read-only Dev audit on 1 August 2026 found 202 repeated user/team membership keys and 44 users
  with more than one Primary team. No existing row was changed; a separate per-person dry run and
  approval are required before any cleanup.
- Scoped module controls need an owner smoke test across one parent and child scope. No explicit
  Dev overrides exist yet, so every current module retains its safe default behaviour.
- Committee setup needs an owner smoke test. The Dev committee tables are empty, so no real
  association/club committee, position, appointment, document or qualification has been created.
- Committee operations need an owner smoke test with appointed users. Dev has no polls, meetings,
  chat messages or operation history. Voting and chat deliberately require a current appointment
  with the matching position permission, including for scoped administrators.
- Safety Hub write workflows need an owner smoke test with disposable Dev records. The existing one
  Risk, Action, QI item, Bright Idea, review and four links were not changed during implementation.

## Current Codex handoff template

After each Codex task, update this section or append a dated entry below.

### Latest handoff entry

Date: 2026-08-01

What changed:

- Recovered and locked the 14-block development order in `docs/development-plan.md` so the same
  order is available in the repository and generated Obsidian mirror.
- Completed Block 1. The unfinished `scraper/fixture_import.py` worktree copy contained 545 added
  lines of duplicated conflict text and no removed committed lines. It was backed up outside the
  repository, restored exactly to `HEAD`, and fully verified.
- Advanced the Umpire Portal preflight to the branch-alignment gate. The development-plan package
  remains ahead of `main`; it includes a Production-capable workflow and therefore needs explicit
  approval before staging promotion. Production, DNS and redirects remain unchanged.
- Implemented the first complete Formation/Lineup reliability package: live reusable templates,
  persistent cropped custom icons, safer line-up replacement, team selection, team-scoped player
  preferences, formation-change protection and clearer mobile instructions.
- Applied the two already-committed Formation migrations to SportStack Dev after a successful
  transaction rollback test. Four templates were backfilled and linked to all four formations.
- Added and applied `20260801013000_harden_field_template_grants.sql` to Dev. Anonymous table grants
  are removed; authenticated users have only SELECT, INSERT, UPDATE and DELETE behind scoped RLS.
- Corrected the prepared domain architecture: `hb.sportstackapp.com.au` is the Umpire Portal inside
  this SportStack app, not the separate ignored Hockey Ballarat module.
- Added repository-only hostname routing so the future `hb` root shows the existing public Umpire
  Portal while all current hostnames keep their normal landing behaviour.
- Prepared the public Umpire Edge Function origin, environment labels and safe server-generated
  link fallbacks. Added the current approval, verification and rollback checklist in
  `docs/domain-migration-plan.md`.
- Read-only checks confirmed current Production, Development, Main/staging and `www` return HTTP
  200, root still returns HTTP 307 to `www`, and `hb` still has no DNS record.
- Reorganised signed-in navigation around everyday tasks and explicit role scope. Existing
  competition, bulk-import and fixture-import pages are now reachable from Super Admin navigation;
  association and club choices are deliberately restricted to their supported scope.
- Standardised navigation names for Player MVP Voting, Umpire Match Voting and Formation Library,
  added Communications to association and club menus, and added an Umpire-role ballot link.
- Recorded direct and contextual route decisions in `docs/navigation-audit.md`. Menu visibility is
  documented as a usability layer; route checks, RLS and Edge Functions remain authoritative.
- Improved the daily dashboard team context and fixture cards. The selected team now shows its
  Primary, Secondary or Fill-in relationship, and fixtures clearly show home/away, division, date,
  time, venue and published line-up state.
- Replaced clickable availability badges nested inside fixture links with accessible buttons outside
  the link. Repeat writes are blocked while saving, selecting the active choice still clears it,
  and only fixtures for which the player is eligible show availability controls.
- Added separate dashboard load-error states so a failed fixture, calendar or availability request
  is no longer presented as a genuine empty result.
- Improved Communications with an exact audience summary and a confirmation step for official Club
  and Association Updates. Enter sends only in Team Chat; official updates can use normal multiline
  text and must be published with the button and confirmation.
- Fixed message deep links so automatic bottom scrolling no longer overrides the requested older
  message. Scope permission and reminder settings are reset during each load, failures are shown
  instead of stale values, and reminder toggles are locked while saving.
- Added visible message-load retry behaviour and reaction-save errors. The React review also replaced
  repeated reply/reaction scans with indexed maps for the 150-message view.
- Completed the Block 8 reliability pass for both voting modules. Player MVP Voting already uses the
  locked `submit_mvp_ballot` transaction; the live Dev audit found all 165 submission markers have
  exactly one valid 3-2-1 ballot and no duplicate voter/session pair.
- Changed signed-in Umpire Match Voting to show completed fixtures only, validate jersey numbers,
  fixture teams and duplicate people, support the Super Admin route consistently, and use explicit
  ballot wording and error states.
- Added and applied `20260801030000_atomic_umpire_match_vote_submit.sql` to SportStack Dev. It derives
  fixture scope server-side, validates role and scheme, serialises duplicate checks and saves the
  submission header plus every vote line in one transaction. Authenticated direct table inserts are
  revoked; the existing service-role public portal path is unaffected.
- Regenerated `src/integrations/supabase/types.ts` from the live Dev schema and changed the page to use
  the generated `submit_umpire_match_vote` type directly.
- Completed the Block 9 core-administration reliability pass. Fixture import now uses exact
  Club - Division - Team labels, rejects ambiguous short names, mixed divisions, missing seasons,
  same-team and duplicate-sheet rows, and requires every row to be valid before confirmation.
- Fixture import and normal fixture add/edit now save `division_id` and `season_id`; team-only admins
  no longer receive every team in the selected club through the import page.
- Added and applied `20260801040000_atomic_membership_request_approval.sql` to Dev. The signed-in
  administrator's association/club/team scope is derived server-side, one request and membership
  change commit together, repeat approval is blocked and concurrent approvals for one person are
  serialised.
- Added and applied `20260801041000_safe_venue_delete.sql` to Dev. Venue deletion is scoped and
  atomic, and is blocked while SportStack fixtures, umpire fixtures or RevSports mappings still use
  the venue or its pitches. The page shows the blocker counts before deletion.
- Regenerated the Dev database types for both functions and removed 39 existing loose-type lint
  errors plus eight hook warnings across the four changed admin screens.
- Audited existing Dev memberships without changing them: 202 user/team keys are repeated and 44
  users have multiple Primary teams. The cleanup is parked as a separate destructive-data review.
- Completed Block 10 with the additive Dev migration
  `20260801050000_scoped_module_controls.sql`. It adds explicit module overrides at association,
  club, division and team level, closest-parent resolution, server-side scope checks and
  authenticated-only management functions.
- Reworked Roles & permissions into Roles, permissions & modules. Super, Association and Club
  administrators can now manage only their authorised organisation levels, with a warning before
  each override and a Use inherited action. Role descriptions explicitly separate Player MVP
  Voting from Umpire Match Voting.
- Added a shared module gate and navigation filtering. Player MVP Voting, Umpire Match Voting,
  Safety Hub and Hockey Trace signed-in routes use the effective organisation setting. Current
  modules default to enabled; the experimental Hockey Trace Lab defaults to disabled.
- Completed Block 11 with the additive Dev migration `20260801060000_committee_setup.sql` and the
  new Committee Management page. Association and club committees support custom positions,
  President designation and eight permissions covering setup, members, documents, polls, voting,
  meetings, minutes and chat.
- Added dated committee appointments, governance document links and member qualification records
  with optional evidence/expiry dates. Current appointments inherit their position permissions;
  scoped administrators retain management access without needing a committee appointment.
- Added Committee Management to signed-in navigation and protected the route with the inherited
  committee module setting. RLS keeps setup records private to scoped administrators and current
  committee members; anonymous table access is revoked.
- Completed Block 12 with `20260801070000_committee_operations.sql`. Committee Management now
  includes polls, reusable agenda templates, meetings, per-point minutes and decisions, assigned
  actions, current-member-only chat and append-only activity history.
- Poll creation and submission are atomic database functions. The four supported question styles
  are free text, choose one, choose multiple and Yes / No / Abstain; one user can submit only one
  complete response per poll.
- Added Dev hardening migrations to remove public API access to internal committee trigger helpers
  and cover the new foreign-key joins with indexes. Anonymous chat access remains denied and voting
  and chat require a current appointment with the explicit position permission.
- Completed Block 13 with an atomic, RLS-invoker Safety Hub workflow. Risk, BE SMART Action, QI,
  Bright Idea, committee review, risk review and permanent link forms now save live Dev records and
  refresh the registers instead of only validating browser drafts.
- Existing edit workflows require a reason, risk reviews atomically append an immutable review and
  update the current risk, and Bright Idea committee decisions can lead directly into a prefilled
  Risk, Action or QI form. The existing append-only audit triggers remain authoritative.
- Added scoped committee-decision links from each meeting agenda point to a Risk, Action, QI or
  Bright Idea. A database trigger rejects missing records and cross-association or cross-club links.
- Completed Block 14 with a Dev-only quality workflow. Each `dev` push and relevant pull request now
  runs the focused development-plan lint, TypeScript, production build, Python regression suite and
  checksum-verified `actionlint` 1.7.12 without any Supabase secret or Production target.
- Added six migration regression tests for current committee appointment permissions, private
  grants, one-response polling, Safety Hub RLS-invoker writes and same-scope committee links. The
  full Python suite now contains 100 tests.
- Completed a read-only monitoring snapshot. The latest Dev scraper run and five latest scheduled
  Production scraper runs succeeded. Dev notification dispatch and both Production notification
  schedules reported successful latest runs; no delivery event was due in the preceding 24 hours.
- Aggregate Storage remains stable: Dev has 124 scraper backups using 181,040,447 bytes; Production
  has the intended 44 retained scraper backups using 60,176,404 bytes. No object was read, changed or
  deleted.

Checks run:

- Block 1 Python discovery passed: 94 tests.
- Focused importer tests passed: 17 tests; Python compile checks passed.
- Focused lint for all four changed React/TypeScript files passed with no warnings.
- `npx tsc --noEmit` and `npm run build` passed. The existing large-bundle warning remains.
- Full repository lint still reports the known legacy backlog: 521 problems (433 errors and 88
  warnings), down from 522 before this package.
- Dev migration rollback assertions, live row/link counts, RLS policy checks and grant checks passed.
- Supabase's security adviser reports no finding for `field_templates`; unrelated existing findings
  remain outside this block.
- Domain-package focused lint, TypeScript and build passed. Deno is not installed, so standalone
  Edge Function type-checking was unavailable; focused ESLint passed for all three edited functions.
- Full repository lint remained unchanged at 521 problems after a standalone rerun.
- Navigation focused lint, TypeScript and production build passed. Full repository lint remained at
  the known 521-problem legacy backlog and added no changed-file finding.
- Dashboard focused lint, TypeScript and production build passed. Full repository lint remained at
  the same known 521-problem legacy backlog.
- Communications focused lint, TypeScript and production build passed. Full repository lint remained
  at the same known 521-problem legacy backlog.
- The Umpire Match Voting migration passed a rollback-only functional test: one complete classic
  ballot was created, a second ballot was rejected, grants were asserted and all test data/schema
  changes were rolled back before the exact migration was applied to Dev.
- Post-apply checks confirmed the function has a fixed empty search path, is executable by
  `authenticated` but not `anon`, and browser roles cannot directly insert submission headers or
  lines. No rollback-test rows or active submissions without lines exist.
- Live Dev integrity checks found 165 Player MVP submissions and 79 active Umpire Match Voting
  submissions, with zero duplicate ballot keys, missing lines, duplicate voted people or invalid
  scheme line counts. Supabase advisers reported no error; the expected warning for the intentionally
  authenticated security-definer submission function is documented.
- Umpire Match Voting focused ESLint and `npx tsc --noEmit` passed.
- The production build passed with the existing large-bundle warning. Full repository lint now
  reports 489 known legacy problems (405 errors and 84 warnings), down from 521 because this pass
  removed the Umpire Match Voting page's old loose typing.
- Both Block 9 database functions passed rollback-only functional tests before the exact migrations
  were applied to Dev. The membership test proved one atomic approval and left no synthetic rows;
  the venue test proved linked deletion is blocked and unused deletion removes its pitch atomically.
- Post-apply checks confirmed fixed empty search paths, authenticated-only execution, no anonymous
  execution and no leftover test rows. Supabase advisers reported no error; their security-definer
  warnings are expected for these deliberately authenticated functions.
- Focused ESLint for Fixture Import, Fixtures, Requests and Venues passed with no warning.
  `npx tsc --noEmit` and the production build passed. Full lint now reports 442 known legacy
  problems (366 errors and 76 warnings), down from 489 after this pass.
- The module-control migration passed a rollback test covering explicit disable, closest-scope
  resolution, clearing back to inheritance and anonymous write denial before exact Dev apply.
- Post-apply checks found zero explicit flags, SELECT-only table access for signed-in clients,
  authenticated-only management functions and fixed empty search paths. No new adviser error was
  reported; expected signed-in security-definer warnings are documented.
- Focused ESLint, TypeScript and the production build passed for the module-control UI, route gate,
  navigation and generated Dev schema types. The existing large-bundle warning remains.
- The committee setup migration passed a full rollback test covering committee, President position,
  appointment, inherited chat permission, unknown-permission denial and anonymous table denial.
- Post-apply checks found zero committee/setup rows, no anonymous read grant and fixed empty search
  paths on all four committee access helpers. Supabase reports only the expected warnings for the
  signed-in security-definer helpers used by RLS and the page permission summary.
- Committee Management focused ESLint, TypeScript and the production build passed with no changed-
  file warning. Full repository lint remains at 442 known legacy problems.
- The committee-operations migration passed a rollback-only workflow test covering all four poll
  question styles, duplicate-response blocking, template-to-meeting cloning, chat, activity history
  and anonymous chat denial before exact Dev apply.
- Post-apply checks found zero live operation rows, denied anonymous chat grants, enabled authorised
  RPC execution and confirmed Realtime publication for private committee messages. The adviser-
  identified internal audit trigger exposure was removed; expected warnings remain for deliberately
  authenticated permission and workflow functions.
- Committee operations focused ESLint, TypeScript and production build passed. The React review kept
  related reads parallel and resets operation screens when the selected committee changes.
- The Safety Hub workflow passed a rollback-only test covering record creation, permanent links,
  committee review, risk review, current-risk update and audit history. A second rollback test proved
  linked records inherit their source club scope; a third accepted a valid committee decision link
  and rejected a missing target.
- Post-apply counts remain one Risk, one Action, one QI item, one Bright Idea, one review, four links
  and ten audit rows, with zero rollback-test rows. The save function is SECURITY INVOKER, has a
  fixed empty search path, is authenticated-only and produced no Supabase adviser security finding.
- Safety Hub and Committee Meetings focused ESLint, TypeScript and production build passed. The
  existing large-bundle warning remains.
- Final local verification passed all 100 Python tests, the 32-file development-plan lint,
  `npx tsc --noEmit`, `npm run build`, `git diff --check` and all eight workflow files through
  checksum-verified `actionlint` 1.7.12.
- Dev Quality run `30654055573` passed every remote step at commit `978737b`. Vercel also reported a
  successful deployment for that commit. `https://dev.sportstackapp.com.au` returned HTTP 200 and
  its deployed bundle contained the committee and Safety Hub changes; staging remained unchanged.
- The required full `npm run lint` still reports the established repository backlog of 442 problems
  (366 errors and 76 warnings). The focused development-plan lint passes; its two documented
  exclusions contain 25 older `no-explicit-any` errors in RevSports mapping/review pages.

What Aaron should test next:

- Sign in to Dev and create one custom icon from Formation Library, then create and save one field
  template using that icon.
- Open one fixture line-up, change formation, verify selected players move to the bench, then save
  and reload the line-up.
- If authorised for both teams, switch the line-up team and confirm each side loads independently.
- No domain owner test is possible until the separately approved Vercel, DNS, Auth and Turnstile
  rollout. Do not connect `hb` from this repository-only package.
- Check the desktop menu and mobile drawer in each role mode available to your account. Confirm the
  page groups and labels are logical, then open one item from each visible group.
- On Dev, open the Primary and Secondary teams from the player team switcher. Confirm the banner
  badge, home/away fixture details and availability status are correct; change one response, then
  select it again and confirm it clears to No response.
- In Dev Communications, send and reply to one Team Chat message, open an older message from a
  dashboard link, then publish one clearly marked test Club or Association Update and verify the
  audience confirmation names the correct scope.
- In Dev Umpire mode, open Umpire Match Voting, confirm only completed fixtures are listed, enter one
  clearly marked test ballot, review it, submit once and confirm a repeat submission is blocked.
- In Dev Admin, download the fixture import template and confirm its exact team labels. Preview one
  valid row plus one duplicate or ambiguous row and confirm nothing imports until every row is valid.
- Add or edit one disposable Dev fixture and confirm its division and season remain linked after
  reload. Approve one disposable pending membership request and confirm it cannot be approved twice.
- Open a disposable unused Dev venue, confirm the dependency summary, delete it, then confirm a venue
  with fixture or RevSports links is blocked.
- In Roles & modules, choose a disposable child scope and disable Hockey Trace or another
  non-critical module. Confirm its menu and direct route are blocked, then select Use inherited and
  confirm its parent/default status returns.
- Create one clearly marked Dev association or club committee. Add President and Member positions
  with different permissions, appoint your test user, then record one disposable governance link
  and qualification with an expiry date.
- In Dev Safety Hub, create a clearly marked Risk, create a linked BE SMART Action and QI item, save
  a risk review and confirm Audit History shows the changes. Link one committee meeting decision to
  the disposable Risk and confirm a record outside the committee scope is rejected.

Risk level:

- Medium. This includes additive Dev-only schema/RLS/grant work, atomic ballot/admin/Safety Hub
  writes, module route controls, private committee workflows and a Dev-only quality workflow. No
  committee data, explicit module override, membership cleanup, Production database, deployment,
  DNS or redirect change was made.

### Previous handoff entry

Date: 2026-07-31

What changed:

- Added `scripts/release-production.ps1`, a fail-closed Production release script pinned to the
  approved public Umpire Portal package.
- The script securely stores Vercel, Supabase and Turnstile access using Windows user encryption
  outside the repository. It does not use a plain-text project `.env` file and does not change the
  repository's normal SportStack Dev Supabase link.
- Its read-only preflight checks the Git/GitHub identity, clean and linear `dev` -> `main` -> `prod`
  history, exact Supabase and Vercel targets, database access, and the pending migration allow-list.
- Release mode requires the exact owner confirmation phrase, creates and verifies a fresh
  three-file Production logical backup, and refuses any migration or Edge Function outside the
  approved Umpire Portal set.
- An interrupted release can resume after the database step only when the script verifies both
  approved migrations and the matching pre-migration backup; a separate read-only verification
  mode handles interruption after the final `prod` push.
- Added `docs/production-release-process.md` with the one-time access setup, preflight and approved
  release commands.
- Installed Vercel CLI 58.4.4 on this Windows profile so releases can use a scoped access token
  instead of repeatedly entering the browser passkey flow.
- Aaron approved access-token creation. A 30-day Supabase token named
  `codex-sportstack-prod-release-20260731` was created, encrypted with Windows user protection and
  verified against both SportStack projects plus a read-only Production migration listing.
- The existing Production Turnstile site and secret keys were also encrypted for the same Windows
  user. No database password was copied, stored or reset: an isolated temporary Supabase work
  directory successfully linked to Production while the repository link remained on Dev.
- A second live read-only dry-run rebuilt all 157 recorded Production migration versions as empty
  temporary history placeholders, then confirmed that only
  `20260730114925_public_umpire_portal.sql` and
  `20260730124436_restore_default_voter_role.sql` are pending. This handles historical filename
  drift without replaying any older migration.
- Vercel access is not configured yet because the account still requires Aaron to complete its
  browser authentication. Production remains unchanged while that login is pending.
- Production Supabase, Vercel settings, `prod`, DNS and live data remain unchanged by this setup.

Checks run:

- PowerShell syntax parsing passed for the release script.
- A disposable test confirmed the credential file is DPAPI-encrypted and does not contain the test
  tokens or Turnstile keys in plain text.
- A disposable resume test independently rechecked all three backup file sizes and SHA-256 hashes.
- The fail-closed preflight correctly refused to continue while the new script and documentation
  were uncommitted.
- After the setup commit reached both `dev` and `main`, a clean read-only preflight verified the
  exact `682b8ea` -> `74e2947` fast-forward, the two-migration/one-function allow-list and the Dev
  local Supabase link, then stopped at the intentionally missing encrypted Production access file.
- Vercel CLI installation and command help checks passed.
- `npx tsc --noEmit` and `npm run build` passed. Repository-wide `npm run lint` still reports the
  unchanged legacy baseline of 433 errors and 89 warnings outside this PowerShell/documentation
  change.

What Aaron should test next:

- Complete the Vercel browser authentication, create the scoped team token and finish the encrypted
  access file.
- Run the read-only Production preflight.
- Only after the preflight passes, use the already approved Umpire Portal release mode and complete
  the normal signed-in Production smoke test.

Risk level:

- Low for this setup. It adds local release tooling and documentation only. No database migration
  or Production change is included until the separately gated release mode is run.

### Previous handoff entry

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
- Fast-forwarded the seven Umpire Portal commits from `dev` to `main` staging. Production was not
  promoted because its database migrations, Edge Function and real Turnstile configuration are
  not yet installed; deploying the frontend alone would leave the public submission flow broken.

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
- Main staging deployed the same public account route, referenced only SportStack Dev Supabase and
  completed a read-only Match Info call for Hockey Ballarat with 168 eligible fixtures.
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

### Earlier handoff entry

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

## 3 August 2026 - contained owner-test follow-up

What changed:

- Confirmed on deployed Dev build `1d4bd20` that an actual disposable Player can clear a team
  player number and that the blank value survives reload.
- Confirmed with an actual disposable Coach that Pumas Squad and Roster each show 25 unique
  players with matching compact totals: 22 Primary, 3 Secondary and 0 Fill-in.
- Changed the Admin Dashboard badge to describe the confirmed active mode rather than the
  account's highest stored role.
- Changed the Profile "Viewing as" badge to describe the active mode while retaining all assigned
  role/scope badges separately.
- Removed two stale Games lint-suppression comments that caused the focused Dev-plan lint gate to
  report a false new-debt failure.

Checks run:

- `npx tsc --noEmit`, `npm run build`, `npm run lint:dev-plan` and `git diff --check` passed.
- Full `npm run lint` remains at its recorded unrelated baseline of 362 errors and 76 warnings.

What Aaron should test next:

- On Dev, use Super Admin "Viewing as Association Admin" and confirm the Admin Dashboard badge
  says Association Admin.
- Open Profile in that same active mode and confirm its "Viewing as" badge also says Association
  Admin while the role list still shows every assigned role.
- Use the Lucas HC My Dashboard to confirm its bye card says `Lucas HC — Bye` without midnight or
  TBD details.

Risk level:

- Low. These are contained display/documentation changes with no migration or Production change.

## 4 August 2026 - Expense Hub Stage 1

What changed:

- Added the complete manual Expense Hub workflow at `/expense-hub`: dashboard, expense register,
  entry/edit/duplicate/archive/restore, supplier aliases and defaults, payment methods, configurable
  categories, private attachments, audit history, combined filters and filter-aware Excel/PDF reports.
- Personal, association and club records remain separate. Access is denied by default and is granted
  through `expense_hub_access`; Aaron's Dev owner access is seeded. Explicit finance administrators
  can manage only their granted association or club scope and cannot change original record ownership.
- Added ten RLS-protected tables, generated business/personal/GST values, validation triggers,
  duplicate support through invoice/file hashes, export snapshots and the private 20 MB
  `expense-documents` Storage bucket. Production is unchanged.
- Added six focused calculation and supplier-matching tests plus pinned PDF, test and repeatable
  browser-check dependencies.

Files changed:

- `src/features/expense-hub/*`
- `src/pages/expense-hub/*`
- `src/App.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/integrations/supabase/types.ts`
- `supabase/migrations/20260804071327_expense_hub_stage_one.sql`
- `supabase/migrations/20260804073000_harden_expense_hub_access_and_indexes.sql`
- `supabase/migrations/20260804074800_allow_expense_finance_admin_edits.sql`
- `supabase/migrations/20260804080500_allow_expense_finance_admin_aliases.sql`
- `package.json` and `package-lock.json`

Checks run:

- All four additive migrations passed rollback dry-runs before being applied to SportStack Dev.
- Authenticated live rollback tests passed calculations, audit writes, cross-user isolation, finance
  administrator edits, immutable ownership and finance administrator supplier-alias management.
- Supabase advisers report no Expense Hub security warnings and no actionable performance warnings.
- Focused ESLint, `npx tsc --noEmit`, six Vitest checks, `npm run build` and `git diff --check` pass.
- Full `npm run lint` still fails on the existing repository backlog: 360 errors and 78 warnings in
  older app/module files. The Expense Hub source adds none.
- Unauthenticated desktop/mobile browser checks load without an error overlay and correctly return
  `/expense-hub` to login. The signed-in end-to-end owner workflow remains the next Dev check.

What Aaron should test next:

1. On Dev, open Expense Hub and create a personal supplier and payment method.
2. Add a $120.00 expense with $10.91 GST and 75% business use; expect $90.00 business and $30.00 personal.
3. Upload a PDF or image, save as Draft, edit to Ready and confirm the audit history shows the change.
4. Filter the expense, export it to Excel and PDF, then archive and restore it.
5. If organisation sharing is required immediately, nominate each finance administrator and exact
   association/club scope so an explicit access grant can be reviewed and added in Dev.

Risk level:

- Medium. This is a new financial-record module with four additive Dev database migrations and
  private Storage policies. The migrations and RLS have passed live Dev rollback tests and adviser
  checks. No Production system, branch, secret, deployment setting or domain was changed.

## 4 August 2026 - Expense Hub Stage 2 complete on Dev

What changed:

- Added Dev-only bank statement imports for CSV and OFX files. They are parsed deterministically in the browser and are not sent to an AI provider. PDF statements are securely scanned into reviewable transaction lines.
- Added transaction review decisions for business, personal and not relevant, including business-use percentage, supplier/category selection, draft expense creation and missing-evidence status.
- Added five RLS-protected Stage 2 tables for statement imports/lines, AI processing jobs, extraction results and field suggestions, plus a private 20 MB `expense-imports` bucket.
- Added authenticated `expense-document-extract` and `expense-statement-extract` Dev Edge Functions. Both use low-cost OpenAI GPT-5.6 Luna first and automatically try Claude Haiku 4.5 if OpenAI fails.
- Added strict structured output, per-field confidence, supplier name/alias/ABN matching, supplier defaults, approved-history suggestions, five-attempt limits and estimated provider cost tracking.
- Added side-by-side invoice review with editable extracted values. Users can apply checked values or retain the existing expense values; either action records field-level differences and explicit approval.
- Added an AI activity page showing scans, failures, waiting reviews, field correction rate, average confidence and estimated cost without exposing invoice content.
- AI is optional: manual expense entry and deterministic CSV/OFX imports continue to work when either provider is unavailable.
- OpenAI requests use `store: false`. Restricted raw invoice output has a 30-day retention marker and expired raw output is cleared during subsequent scans. No raw provider response is stored for PDF bank statements. Production provider privacy/region settings still require owner review before release.

Files changed:

- `src/features/expense-hub/api.ts`
- `src/features/expense-hub/ExpenseHubLayout.tsx`
- `src/features/expense-hub/statementParser.ts`
- `src/features/expense-hub/statementParser.test.ts`
- `src/features/expense-hub/utils.ts`
- `src/features/expense-hub/utils.test.ts`
- `src/pages/expense-hub/ExpenseEditorPage.tsx`
- `src/pages/expense-hub/StatementImportsPage.tsx`
- `src/pages/expense-hub/ExpenseAiActivityPage.tsx`
- `src/App.tsx`
- `src/integrations/supabase/types.ts`
- `supabase/functions/expense-document-extract/index.ts`
- `supabase/functions/expense-statement-extract/index.ts`
- `supabase/functions/_shared/expense-ai-provider.ts`
- `supabase/migrations/20260804181000_expense_hub_stage_two_foundation.sql`
- `supabase/migrations/20260804183000_harden_expense_stage_two_ownership.sql`
- `supabase/migrations/20260804190000_complete_expense_hub_stage_two.sql`
- `supabase/migrations/20260804190500_limit_expense_statement_scans.sql`
- `supabase/config.toml`

Checks run:

- Both new migrations passed transaction rollback dry-runs before being applied to SportStack Dev.
- All five Stage 2 tables have RLS enabled. Both Edge Functions require a valid JWT and returned HTTP 401 without one.
- Focused ESLint, ten Expense Hub Vitest checks, `npx tsc --noEmit`, `npm run build` and `git diff --check` pass.
- Supabase security advisers reported no Expense Hub finding; existing unrelated Dev warnings remain.

What Aaron should test next:

1. Upload one de-identified PDF bank statement and confirm every transaction appears for review.
2. Create one business draft, attach its invoice, select Scan invoice, correct a value and approve it.
3. Confirm the statement line changes from Missing evidence to Verified and the AI activity page records the cost and correction.
4. Temporarily test a poor-quality image to confirm uncertainty is shown and manual entry remains available.

Remaining release gate:

- A signed-in owner smoke test with de-identified sample files is still required before promoting Stage 2 beyond Dev.
- Provider privacy, processing region and billing limits must be approved separately before Production deployment.

Risk level:

- Medium. Stage 2 has four additive Dev migrations, private Storage and two authenticated Dev Edge Functions. Production is unchanged.

## 14 August 2026 - Coordination Module discovery specification

What changed:

- Added a docs-only technical specification for scoped fixture and volunteer coordination.
- Separated required positions, multi-recipient offer responses and confirmed assignments so one
  open position can be offered safely to several people.
- Defined required offer deadlines, materialised reminders and recipient-facing offer notes.
- Confirmed that an Umpire's acceptance records willingness only. The original offerer must select
  and confirm one accepted Umpire before SportStack creates the official assignment.
- Recorded the fail-closed rule as “no until yes”: no response, acceptance, expiry or single willing
  respondent may be treated as confirmation automatically.
- Defined a non-blocking Umpire Match Voting roster check that distinguishes confirmed mismatch,
  no roster and unverifiable identity instead of treating every uncertain identity as wrongdoing.
- Rechecked the live Dev schema read-only. The current fixture, notification, availability,
  permission, role and voting-submission records remain the intended integration points, and no
  Coordination offer or official-assignment table currently exists.

Files changed:

- `CODEX_HANDOFF.md`
- `docs/coordination-module-discovery.md`
- `docs/current-state.md`

Checks run:

- Live Dev schema metadata was queried read-only; no database data or structure was changed.
- Documentation diff and Markdown formatting checks are recorded in the task handoff.
- Application lint, TypeScript and build checks were not required because no application,
  dependency or generated source file changed.

What Aaron should review next:

1. Choose the default offer deadline and reminder timings.
2. Confirm who reviews Umpire Match Voting roster mismatch flags.

Risk level:

- Low. This is documentation and read-only discovery only. It includes no migration, Row Level
  Security change, permission grant, Dev data change or Production change.

Unknowns still needing confirmation:

- The eight decisions listed in `docs/coordination-module-discovery.md` remain open and must be
  resolved before an implementation migration is designed.

## 16 August 2026 - Discipline draft recovery and evidence withdrawal handling

What changed:

- The new-incident form now saves a private browser draft for the signed-in user and association.
  Entered details and selected source files are restored after refresh or after returning from an
  official external link. Drafts expire after seven days and are cleared after the case is created.
- Witness and evidence rows now open a compact detail dialog with an append-only withdrawal and
  decision history. A withdrawal request pauses reliance on that material without deleting or
  rewriting the original.
- Before an accepted Tribunal Chair is appointed, the Case Coordinator may decide a withdrawal
  request. Once a Chair is accepted, only that linked Chair may decide whether to exclude the
  material, retain it with limited weight or retain it for consideration.
- A pending request blocks signing the investigation report and finalising a Tribunal determination,
  while allowing other case work to continue. Excluded material can later be restored by an
  authorised decision-maker through another recorded event.
- The Dev database uses Row Level Security, denies anonymous access and direct authenticated writes,
  and records every status event in the existing case timeline.

Files changed:

- `src/features/discipline/DisciplineEvidenceHandlingDialog.tsx`
- `src/features/discipline/disciplineIntakeDraft.ts`
- `src/features/discipline/disciplineIntakeDraft.test.ts`
- `src/features/discipline/evidenceStatus.ts`
- `src/features/discipline/evidenceStatus.test.ts`
- `src/features/discipline/api.ts`
- `src/features/discipline/types.ts`
- `src/pages/discipline/NewDisciplineCase.tsx`
- `src/pages/discipline/DisciplineCaseWorkspace.tsx`
- `src/integrations/supabase/types.ts`
- `supabase/migrations/20260816204954_discipline_evidence_withdrawal_workflow.sql`
- `supabase/migrations/20260816205950_fix_discipline_pending_evidence_guard.sql`
- `supabase/migrations/20260816210103_order_discipline_evidence_status_events.sql`

Checks run:

- All three additive migrations passed transaction rollback tests before being applied to SportStack
  Dev. Role tests covered an investigator request, a blocked non-Chair decision and an accepted
  Tribunal Chair decision. No test record remains.
- Live Dev verification confirmed Row Level Security is enabled, anonymous read and function access
  are denied, and authenticated users cannot insert directly.
- Focused ESLint, TypeScript, the production build, six focused Vitest checks and `git diff --check`
  pass. Full-project lint still reports the repository's existing unrelated baseline debt.

What Aaron should test next:

1. Enter a distinctive case title on Dev, open one official policy link, return to the incident page
   and confirm the title and entered details are still present.

Risk level:

- Medium. This includes three additive Dev-only database migrations and browser-local draft storage.
  Production is unchanged.

## 16 August 2026 - Coordination Module decisions and implementation plan

What changed:

- Consolidated the owner decision review into the Coordination discovery specification and removed
  the earlier eight open product questions.
- Confirmed the full “no until yes” offer workflow: multiple recipients may accept, the offerer can
  wait or confirm at any time, and an assignment exists only after explicit confirmation.
- Confirmed 72-hour adjustable offers, normal and urgent reminder timings, mandatory in-app/email
  notices, notification delivery states, withdrawal before confirmation and mandatory-note
  replacement requests after confirmation.
- Added association Umpire Matrix requirements covering grade sign-offs, qualifications, completed
  history, supervising Umpires, historical RevSports mapping and restricted coordinator logs.
- Added Technical Bench first-duty and under-18 adult-pairing warnings, strict overlap blocking,
  role-specific fixture availability and audited warning overrides.
- Preserved Umpire Match Voting submissions unchanged when a roster mismatch is confirmed.
- Added a staged implementation plan with proposed record groups, state transitions, permission
  matrix, secure operations, verification gates, owner tests and Production boundaries.
- Rechecked relevant live Dev schema metadata read-only. Existing fixtures, date of birth,
  divisions, availability, permissions, notifications, Umpire Match Voting submissions and
  RevSports Umpire mappings remain the integration points; no Coordination tables exist.

Files changed:

- `CODEX_HANDOFF.md`
- `docs/coordination-module-discovery.md`
- `docs/coordination-module-implementation-plan.md`
- `docs/current-state.md`

Checks run:

- Live Dev metadata queries were read-only; no database record, permission or structure changed.
- Documentation consistency, whitespace and diff checks passed.
- `npx tsc --noEmit` and `npm run build` passed. The existing large-bundle warning remains.
- Full `npm run lint` retained the unrelated repository baseline of 360 errors and 78 warnings.
  This documentation-only change adds no linted application source.

What Aaron should test next:

1. Read the confirmed workflow summary in `docs/coordination-module-discovery.md` and report any
   decision that does not match the discussion before Stage 0 begins.

Risk level:

- Low. Documentation and read-only discovery only. No database migration, Row Level Security,
  permission, notification schedule, live data or Production change is included.

Unknowns still needing confirmation:

- Product decisions are complete. The Stage 0 technical checks listed in
  `docs/coordination-module-implementation-plan.md` remain required before a migration is proposed.
- Permanent storage of sensitive replacement notes requires a documented privacy and redaction
  review before Production.

## 22 August 2026 - Big Brain Obsidian vault cutover

What changed:

- Changed SportStack's default Obsidian target to
  `C:\Users\mulla\OneDrive\Documents\Big Brain`.
- Updated the four required curated-note paths to Big Brain's current Projects and Areas layout.
- Kept the generated, read-only repository mirror at `Projects/SportStack Repository` so the
  cutover did not create a duplicate mirror or remove existing notes.
- Set the current-user `SPORTSTACK_OBSIDIAN_VAULT` override to the Big Brain path and refreshed the
  daily `SportStack Obsidian Note Sync` task description.
- Updated the active repository instructions, plan, handoff and notes guide to use Big Brain.

Files changed:

- `AGENTS.md`
- `CODEX_HANDOFF.md`
- `config/obsidian-note-sync.json`
- `docs/consolidated-open-items-plan.md`
- `docs/current-state.md`
- `notes/README.md`
- `scripts/register-obsidian-note-sync-task.ps1`
- `scripts/sync-sportstack-notes-to-obsidian.ps1`

Checks run:

- Both PowerShell scripts passed parser validation and the note-sync JSON parsed successfully.
- The current-user vault override resolves to Big Brain.
- The daily Windows task re-registered successfully and reports `Ready`.
- A live `origin/dev` refresh published 55 notes to Big Brain.
- The independent note-sync `-Check` passed against Big Brain and all four curated notes exist at
  their configured locations.
- `npx tsc --noEmit` and `npm run build` passed. The existing large-chunk warning remains.
- The focused Development-plan lint check and `git diff --check` passed.
- Full `npm run lint` retained the existing unrelated baseline of 359 errors and 78 warnings. This
  documentation and PowerShell-only change adds no linted application source.

What Aaron should test next:

1. Open Big Brain in Obsidian, open `Projects/SportStack Repository/_Index`, then follow one link to
   a repository note.

Risk level:

- Low. This is a reversible documentation and local note-sync configuration change. It includes no
  database migration and does not change the SportStack app, Dev database or Production.

## 26 August 2026 - Historical Umpire Match Voting import to Dev

What changed:

- Imported 50 owner-reviewed historical Umpire Match Voting submissions and 159 vote lines into
  SportStack Dev only for Rounds 9 and 11-15.
- Stored the reconciled full player name on each vote line and linked every line to its reviewed
  SportStack profile ID. Existing profile names were not rewritten.
- Matched every imported submission to exactly one Hockey Ballarat fixture and every player team
  to one of that fixture's two teams.
- Left all imported submissions pending, unlocked and not deleted so they can be reviewed in the
  normal admin workflow.
- Held back Rounds 2 and 5 because their unresolved player identities affect the round review.
- Held back Round 10 after validation found submission `P098` attached to `Blaze Black v EGC`
  even though all four voted players were recorded for `Lucas` or `Blaze Orange`. Existing Dev
  records in Rounds 2, 5 and 10 were not changed.
- Used deterministic import IDs and retained the source submission reference in the proxy reason
  so the imported set can be identified and checked again without guessing.
- The existing coordination trigger created 50 pending `NO_ROSTER` review checks for these
  historical proxy submissions. It did not change or reject the vote records.

Files changed:

- `docs/current-state.md`

Checks run:

- Pre-import validation found exactly one fixture for each included submission, no missing profile
  links, no existing deterministic IDs and no matching existing fixture/umpire submissions.
- Post-import counts are 50 imported submissions and 159 imported vote lines: Round 9 `7/21`,
  Round 11 `9/28`, Round 12 `5/17`, Round 13 `11/36`, Round 14 `9/29`, and Round 15 `9/28`.
- Post-import validation found zero incorrect fixture-side teams, missing profiles, invalid vote
  patterns, invalid scheme-line keys or imported records in Rounds 2, 5 and 10.
- Dev now contains 134 Umpire Match Voting submissions and 433 vote lines in total.
- No application code or schema changed, so application lint, TypeScript and build checks were not
  required for this data-only import.

What Aaron should test next:

1. Open the Dev Umpire Match Voting admin page and spot-check the pending submissions in Rounds 9
   and 11-15, including the corrected Round 13 and Round 14 fixtures.

Risk level:

- Medium. This is an additive Dev database import with no migration. Production was not changed.

Unknowns still needing confirmation:

- Round 10 submission `P098` needs its correct fixture confirmed before any Round 10 historical
  records are imported.
- Rounds 2 and 5 remain held until their unresolved player identities are confirmed.

## How to update this file

When Codex finishes a task, add a dated entry with:

- What changed
- Files changed
- Checks run
- What Aaron should test next
- Risk level
- Any unknowns that still need confirmation
## 21 August 2026 — Dev feedback register reconciled

- The Development feedback register was audited against current source, deployed owner checks and
  the single consolidated plan. It now contains 53 Open and 35 Closed items; no row was deleted.
- Twenty-six completed, stale, duplicate or test-only items have auditable closure notes. The exact
  IDs and grouped remaining themes are recorded in
  `docs/feedback-register-reconciliation-2026-08-21.md`.
- Player mode no longer shows **My coordination** in both Core and Umpiring. A source regression
  check requires exactly one Player navigation entry.
- The main immediate access-control question remains explicit: a Pending team application must not
  grant team data, Player permissions or team navigation before approval.
- No database schema or Production system changed.
## 29 August 2026 - Published Player MVP tally presentations

What changed:

- Added a saved five-step Player MVP tally builder for closed, undisputed team rounds: Rounds, Audience, Appearance, Preview and Publish.
- Added private full-screen player playback with 3-2-1 reveals, live ranking bars, round summaries, shared-rank podium results, pause, resume, replay, skip, clickable rounds, nine speeds and reduced motion.
- Added explicit Primary, Secondary and participating fill-in audiences. Fill-ins start selected and can be removed as a group or individually.
- Added inherited team, club and association branding with presentation-level logo uploads, background and colour overrides.
- Added DRAFT, SCHEDULED, PUBLISHED and WITHDRAWN lifecycle controls. Published snapshots cannot be edited; corrections require a reason, withdrawal and a linked replacement.
- Added one-minute scheduled publication, deduplicated in-app notifications, Player MVP result email delivery and a player email preference.
- Added recipient-only Row Level Security, manager scope checks and controlled database operations. Browser roles have read-only table access and cannot directly change lifecycle records.
- Original Player MVP vote, submission and session records remain unchanged by presentation publication.
- Voting deadlines are now the official closing event. A private one-minute job closes overdue
  undisputed sessions, moves unresolved incorrect-result checks to **Result concern**, and records
  an actor-free `CLOSED_AT_DEADLINE` audit event. The former derived **Expired** state is removed.
- The round picker lists every round in stable fixture order with its state, ballots received,
  eligible voter count and a clear disabled reason. Closed, undisputed rounds need at least one
  ballot before they can be included.
- Appearance settings now support a scoped 2 MB PNG/JPG/WebP logo upload, background descriptions,
  speeds from 0.5x to 10x and a top 3-50 or All leaderboard limit that retains cutoff ties.
- Playback uses full linked SportStack profile names, six-second round summaries at 1x and saved
  positive commentary. Preview tries anonymous aggregate-only AI commentary for up to five seconds,
  then keeps the rule-based commentary if the provider is slow or unavailable.

Development status:

- Five additive tally migrations are applied to SportStack Dev only: the presentation foundation,
  foreign-key indexes, audience hardening, deadline/presentation refinements and audience deduplication.
- `sportstack-notification-dispatch` version 8 and `mvp-tally-commentary` version 1 are active on
  Dev. The follow-up commit `71af047` passed Dev Quality run `33236928385` and was fast-forwarded to Main;
  both Vercel deployments succeeded. Production is unchanged.
- The counted dry run found 347 overdue Dev sessions. The rollback test passed, the sessions were
  reconciled, no false manager was assigned, and a repeat run processed zero sessions.
- Transactional database tests cover automatic closure, disputes, one- and zero-ballot rounds,
  deadline vote rejection, scoped storage, full names, commentary, publication and recipient-only
  access. Nine focused logic tests, focused lint, TypeScript and build passed. Full repository lint
  remains at its known unrelated baseline of 359 errors and 78 warnings.
- The unauthenticated local route loaded without a Vite error overlay. Authenticated owner testing
  of the complete builder-to-player flow on Dev remains required.
- Owner testing found Reuben Pougnault twice because two older active Secondary membership rows
  exist for the same profile. The builder now returns every profile once without deleting those
  historical rows; linked Primary membership takes display priority over Secondary membership.
- The final podium now uses readable full-width vertical cards with full names, avatars, place
  labels and points. Cutoff ties remain supported and longer podiums scroll within the panel.

What Aaron should test next:

1. On Dev, select a team in Player MVP administration and open **Tally presentations**.
2. Confirm the rounds are ordered and show status plus ballot counts, then select a one-ballot round.
3. Upload a small logo, choose a leaderboard limit and a faster speed, preview the presentation,
   click a footer round, then publish it to a test player.
4. Sign in as that selected player, open the notification, and test full names, pause, resume, speed,
   skip and replay on a phone.
5. Confirm an unrelated player cannot open the same tally link.

Risk level:

- Medium. This includes one additional additive Dev database migration, a Dev storage bucket and one
  Dev Edge Function deployment. Production is unchanged.

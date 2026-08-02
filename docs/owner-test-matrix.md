# SportStack Owner-Test Matrix

Last updated: 2 August 2026

This is the single checklist matching the 31 July to 2 August owner review against the Dev
implementation. It separates what is present from what has actually been tested.

## Current test checkpoint

- The actual **Admin Sportstack** Super Admin account is signed in on Dev.
- Dev migrations `20260802105000_transactional_dev_account_and_role_guards.sql`,
  `20260802106000_mode_aware_permission_management.sql`,
  `20260802107000_mode_aware_permission_listing.sql` and
  `20260802108000_harden_permission_group_assignments.sql`,
  `20260802109000_authorise_dev_test_provisioning_session.sql` and
  `20260802110000_mode_aware_runtime_permissions.sql` are applied.
- `provision-dev-test-account` version 6 is deployed to Dev with JWT verification enabled. It
  validates the live authenticated session and current Super Admin role before creating an account,
  and refuses to reset an existing identity.
- Seven disposable role profiles exist for Association Admin, Club Admin, Team Manager, Coach,
  Player, Umpire and Voter testing. Their credentials were not available to the unattended browser
  session, so the separate-login actual-role workflow matrix still needs to run. No authentication
  bypass is permitted.
- Historical membership cleanup, staging acceptance and every Production/domain change remain
  outside this run.

## Hands-off Dev evidence — 2 August 2026

The unattended pass used the signed-in Admin Sportstack Super Admin account, read-only Dev database
checks and safe browser navigation. It did not submit ballots, publish messages, upload files,
change module rules, create Safety/Committee records or alter historical memberships.

| Area | Evidence collected | Result |
|---|---|---|
| Viewing-as and scope | Association Admin, Team Manager, Coach and Player modes were opened. Lower modes changed menus and scope, but Player still exposed Umpiring pages, an already-open Squad route remained accessible, and profile/Admin badges could still say Super Admin while a lower mode was selected. A fresh read-only check on deployed build `9949d2b` confirmed the mode selector was `team_manager` while Profile said `Viewing as Super Admin` and the Lucas HC Admin Dashboard showed a `Super Admin` badge. Profile also rendered one unnamed role/scope line. Source review confirmed the Umpire ballot checks stored account roles rather than the active mode, `/admin/analytics` has no direct `ModuleGate`, and the Admin badge always reads the account's highest stored role. | **Fail — mode display and route restriction remain inconsistent** |
| Deliberate Super Admin selection | Frontend guards `879d184` and `5514996` prevent the known local cascade races and pass unit, focused lint, TypeScript, build, Dev Quality and Vercel deployment checks. A fresh test on deployed build `5514996` selected Super Admin from `/admin`, waited 2.5 seconds, and observed a redirect to `/dashboard` with Team Manager restored. A later read-only Back-navigation check on build `9949d2b` returned from Team Chat to `/admin`, then the application asynchronously replaced it with `/dashboard` while Team Manager remained selected. | **Fail — session-context/navigation reset remains** |
| Scoped users and permissions | Lucas HC Admin Dashboard and its scoped user link retained the Lucas query and showed eight users. Higher-account editing was disabled. Roles & modules showed group/set/module controls and enabled scope actions only after Lucas was selected. Live Dev currently has no saved permission groups, sets, assignments, overrides or module flags. | **Read-only pass; actual-role write tests pending** |
| Scoped dashboard and user details | Admin KPI links preserve the selected URL scope, but leaving the Lucas HC Admin Dashboard and returning through navigation can reopen My Dashboard. The scoped user table renders every stored account role rather than roles applicable to the selected scope. `Edit Details` is implemented as an in-page dialog, so the observed return to Dashboard is consistent with the unresolved mode/navigation reset rather than the button's intended handler. | **Fail — return state and contextual role presentation remain** |
| Permission catalogue presentation | `AdvancedPermissionControls` filters the catalogue to `category === "MODULE"` for permission sets and direct exceptions. Action entries remain stored for future workflow integration but are not presented as enforceable controls in this release. | **Code-review pass** |
| Fixtures and byes | Fixtures shows the full competition name, `Round 15` and `Lucas HC — Bye` without midnight/TBD. My Dashboard still shows `Lucas HC vs Unknown`, midnight and TBD because Dashboard duplicates the card formatter and supplies `Unknown`/`TBD` fallbacks unconditionally. The Fixtures calendar button only changes the existing cards to a two-column grid; it does not render a calendar. | **Partial fail — two exact frontend causes confirmed** |
| Communications | Team Chat, replies, reactions, removed placeholders and the edit-history entry point loaded. Club/Association publish controls were absent in Player mode. Association tab and scope survived refresh. Source review confirms the newest 50 messages load first, the viewport opens at the newest message, earlier batches of 50 load when scrolling up, drafts persist per user/channel and the revision dialog shows each earlier version with editor and timestamp. Team-chat unread counts exclude the signed-in author and self-mentions are suppressed. Broadcast notification and email recipient queries do not currently exclude the broadcast author. The edited legacy message showed only its current version; Dev has zero `communication_message_revisions`, so earlier edits are not backfilled. | **Partial pass — legacy history and broadcast self-notification gaps** |
| Player MVP Voting | Admin sessions and detail pages showed dates, open/close status and completion. Some identities remain shortened and Player mode had no eligible attended session. Source review confirms the requested Player Leaderboard, Vote Completion and privileged Individual Votes Log tabs now exist, their view and filters persist in the URL, and linked entries prefer full SportStack profile names. | **Partial pass; eligible real-player ballot still pending** |
| Umpire Match Voting | Guided Round → Division → Fixture selection, round dates, current Round 12, completed-fixture eligibility, division scheme, inline missing-value validation, number-only warning/acknowledgement and one-character search all worked. Source review confirmed the broad suggestions come from every active membership across every team in both fixture clubs and then infer a fixture side by club, rather than limiting suggestions to the fixture roster plus the two fixture teams. No ballot was submitted. | **Partial pass — suggestion scope defect confirmed** |
| Coaching, roster, formation and profile | Squad/Roster deduplicated visible cards and showed relationship KPIs; Formation Builder panel collapse, focus mode and landscape surface worked; Team Player Details and role/scope profile sections loaded. A fresh read-only fixture check showed repeated availability identities (`James V` and `Tom Batchelor`) and the Line-up screen exposed Coach controls, availability labels, formation positions, Suggest/Save actions and Primary/Secondary roster relationships. No selection was saved or published. Source review confirms the daily workflow is implemented through My Dashboard → fixture detail → Line-up: a player sets availability, a coach/manager sees roster availability, assigns or suggests the pitch, saves and publishes, and a linked player can open the published line-up. Squad/Roster are reference views rather than the selection screen. Cards still commonly lack positions/numbers. Line-up access currently reads stored roles directly and does not apply the active Viewing-as mode, so a higher-role account can retain edit access while testing a lower mode. | **Partial pass — duplicate availability identities and active-mode restriction remain; actual-role publish workflow pending** |
| Safety Hub and Committee | Every tab loaded without a white screen. Matrix configuration exposed fixed 5×5 labels/descriptions/ratings and category controls. Committee Work/Admin split, calendar, restricted chat and private 20 MB document dialog loaded. Lucas had no Safety records and no disposable writes/uploads were made, so linked-record edits and storage authorisation remain unverified. | **Read-only pass; write-path tests pending** |
| Dev integrity and quality | All relevant inspected tables have RLS. Live counts remain 201 duplicate active membership groups, 44 multiple-Primary users and the 490-row immutable snapshot. `npm run lint:dev-plan`, `npx tsc --noEmit`, `npm run build` and all 125 Python tests passed. Full lint remains at its known 362-error/76-warning baseline. | **Automated pass; cleanup approval-gated** |

The Supabase security adviser also listed several authenticated `SECURITY DEFINER` RPCs. Code review
confirmed the permission and module writers validate `auth.uid()`, active Auth session, selected
mode, organisation scope and manageable subject hierarchy before writing. Treat the adviser output
as a focused security-review queue, not as proof that the RPCs are exploitable.

## Status key

- **DB pass:** verified against SportStack Dev with a rolled-back database test.
- **Automated pass:** verified by a repeatable database, code-quality or browser check.
- **Dev present — retest:** implementation is present, but the current Dev build still needs the
  hands-off browser workflow test.
- **Previous owner pass — regression retest:** Aaron passed the earlier workflow; confirm it was not
  affected by the remediation package.
- **Ready:** its prerequisite is complete and the hands-off check can now run.
- **Owner judgement:** Codex can collect evidence, but Aaron decides whether the wording, layout or
  business behaviour is suitable.
- **Approval-gated:** deliberately excluded from this test run.

## 1. Permissions and accounts

| Owner observation or requirement | Current position | Test status |
|---|---|---|
| Club Admin user list must match their club scope only | Scoped administration functions and list filters are present | Dev present — retest |
| Lower roles must not view or edit higher or peer admin accounts | Server hierarchy blocks Club Admin from Super, Association and Club Admin targets | DB pass |
| Viewing as must restrict data and actions, not just change the menu | Admin scope and permission screen use the active mode and selected cascade scope | Dev present — retest |
| Coach and Team Manager remain separate roles and modes | Separate role values, scopes and mode entries remain | Dev present — retest |
| Missing authentication email must not block role or team edits | Role/team save is separate from profile email validation | Dev present — retest |
| New duplicate memberships and multiple active Primary teams must be rejected | Database write guards are present | Dev present — retest |
| Existing duplicate users display once | UI deduplication is present; historical rows remain unchanged | Dev present — retest |
| Historical duplicate cleanup must not run without approval | Snapshot: 201 duplicate groups, 44 multiple-Primary users, 490 rows | Approval-gated |
| Module access can be assigned to roles, named groups or individual users | Permission groups, reusable sets, assignments and direct exceptions are present | DB pass; UI retest |
| Association, club, division and team scopes inherit correctly | Effective resolver uses the closest selected scope | DB pass; UI retest |
| A direct user exception can override a group permission | Resolver returned `DIRECT_USER` over `SET_GROUP` in a rolled-back test | DB pass |
| Every permission administration change is auditable | Save functions write to the administration audit log | DB pass; UI retest |
| Action-level permissions must not be presented as enforced before their workflows use them | Permission sets and direct exceptions filter the catalogue to enforced `MODULE` entries; future `ACTION` entries are not selectable | Code-review pass |
| Module OFF must remove normal app access while data remains protected | Most module routes use the mode-aware server resolver, but direct `/admin/analytics` is not wrapped in `ModuleGate`, and the Umpire ballot authorises stored account roles rather than the active Viewing-as mode. Underlying tables and RPCs retain their existing Supabase RLS/authorisation. | Code-review fail — direct-route repair and retest required |
| Scoped admins can author permissions only inside their authority | Association and Club Admin mode writes/listing are hierarchy-checked server-side | DB pass; actual-role UI retest |
| Test with real role accounts, not only Viewing as | Secure Dev-account provisioner v5 is deployed and the actual Admin Sportstack Super Admin is signed in | Ready — provision disposable accounts next |

Important boundary: the earlier general account could display Super Admin mode without holding the
actual `SUPER_ADMIN` database role. It remains unsuitable for security testing. Provisioning and
actual-role tests must use the signed-in Admin Sportstack Super Admin account.

## 2. Stability and state

| Owner observation or requirement | Current position | Test status |
|---|---|---|
| Safety Hub linked records, Edit and Back must not produce white screens | Route recovery boundary and repaired links/edit flows are present | Dev present — retest |
| One broken component must not blank the whole app | Recoverable route error boundary is present | Dev present — retest |
| Cascade, tabs and filters persist through navigation and refresh | URL-backed state is present in the remediated screens | Dev present — retest |
| Meaningful drafts persist through tabs, Back and refresh | Draft persistence is present in the reviewed workflows | Dev present — retest |
| Drafts reset only on save, cancel, incompatible parent change or logout | Shared persistence rule is documented and implemented per workflow | Dev present — retest |
| Child choices reset when association, club or division changes | Cascade child-reset logic is present | Dev present — retest |
| Team Chat restores its team after refresh | Chat scope restoration is present | Dev present — retest |
| Dark mode follows the account across browsers and incognito logins | `ThemeToggle` writes `profiles.theme_preference`; `ThemeAccountSync` restores that account value before using local storage as fallback | Code-review pass; cross-browser login retest pending |
| Initial login must not flash the wrong theme | Account-theme bootstrap hides the body until the saved preference is applied | Code-review pass; fresh-login visual retest pending |

## 3. Navigation, cascade and dashboards

| Owner observation or requirement | Current position | Test status |
|---|---|---|
| Use My Dashboard, entity Overview, Admin Dashboard and SportStack Admin consistently | Naming model is present | Dev present — retest |
| Clicking the team cascade opens Team Overview, including the already-selected team | Team Overview route and repeat-selection behaviour are present | Dev present — retest |
| Login and the left Dashboard item still open My Dashboard | Personal daily landing remains the default | Dev present — retest |
| Team Overview has banner, fixtures, ladder, statistics and KPIs like other entity levels | Team overview implementation is present | Dev present — retest |
| Cascade remains visible for Club Admin, Team Manager and Coach | Assigned-scope cascade is present | Dev present — retest |
| All assigned teams appear, including Lucas HC | Multi-team options use assigned scopes | Dev present — retest |
| Empty cascade controls are disabled only when there is no alternative | Conditional dropdown behaviour is present | Dev present — retest |
| Restore the logo and show Hockey Ballarat instead of HB | Full association name and logo treatment are present | Dev present — retest |
| Keep the full desktop cascade at the 1275–1294 px review widths | Responsive cascade sizing is present | Dev present — retest |
| Admin KPI links retain selected association, club, division and team | Scoped KPI links are present | Dev present — retest |
| Manage Clubs must show only clubs in the selected association | Selected-scope list links are present | Dev present — retest |
| Select Club must not display associations | Cascade labels and option sources were separated | Dev present — retest |
| Remove Quick Actions that duplicate KPI links | Duplicate actions were removed; unique members, feedback and error logs remain | Dev present — retest |
| Add banner/branding space to scoped Admin Dashboards | Branding area is present | Dev present — retest |
| Admin Dashboard badge must describe the active mode, not the account's highest role | The badge currently uses `highestScopedRole` across all stored roles, so a Super Admin previewing Association Admin still sees Super Admin | Code-review fail |
| Scoped user rows show roles applicable to the selected organisation/team | The table currently renders the user's complete deduplicated role list without contextual scope filtering | Code-review fail |
| Separate MVP Voting and Umpiring in the left menu | Player MVP Voting/Analytics and Umpire Ballot/Admin/Analytics are separate | Dev present — retest |

## 4. Fixtures, communications and notifications

| Owner observation or requirement | Current position | Test status |
|---|---|---|
| Fixture list/calendar buttons visibly switch views | The list button works, but the calendar value only changes the same cards to a two-column grid; no calendar is rendered | Code-review fail |
| Competition selector shows the full name | Selector width is increased | Dev present — retest |
| Byes display as `Team — Bye` without Unknown, midnight or TBD | Fixtures is correct; My Dashboard has a separate formatter that still emits Unknown, midnight and TBD | Partial fail |
| Use `Round 15`, not `Rd 15` | Full round wording is implemented | Dev present — retest |
| Anyone can inspect immutable edited-message history | Message revision history is present | Dev present — retest |
| Removed messages keep a placeholder and restricted audit record | Removal behaviour remains | Previous owner pass — regression retest |
| Chat opens at the newest message | Newest-message entry is present | Dev present — retest |
| Load the latest 50 messages, then 50 older messages when scrolling up | Upward pagination uses batches of 50 | Dev present — retest |
| Do not notify the person who sent the message | Team-chat unread counts exclude the author and self-mentions are suppressed; broadcast recipient queries still include the author | Partial fail — broadcast author exclusion remains |
| Team Chat, Reply, edit and removal work | Passed in the earlier owner review | Previous owner pass — regression retest |
| Club Updates can be posted/read by the correct club | Passed in the earlier owner review | Previous owner pass — regression retest |
| Club Admin cannot publish Association Updates | Passed in the earlier owner review | Previous owner pass — regression retest |
| Notifications are relevant, deep-link correctly and remain read | Passed in the earlier owner review | Previous owner pass — regression retest |
| Cover actions, votes, availability, selected-player changes and fixture changes | Notification sources are implemented | Dev present — retest |
| Cover role-specific committee, coaching and administration work | Role-aware notification sources are implemented | Dev present — retest |

## 5. Player MVP Voting

| Owner observation or requirement | Current position | Test status |
|---|---|---|
| RevSports identifies participants but the UI shows full SportStack names and team number | Linked identity display is present | Dev present — retest |
| Keep raw scraped names only for matching/audit | Raw identity remains separate | Dev present — retest |
| Exclude the voter and hide players already chosen in another selector | Selector filtering is present | Previous owner pass for self-exclusion; regression retest |
| Show full association name on the scoreboard | Full association label is present | Dev present — retest |
| Align team containers with their matching information boxes | Scoreboard alignment was updated | Dev present — retest |
| Show Open/Submitted/Closed status and time remaining inside the ballot | Ballot status panel is present | Dev present — retest |
| Remove every `Round Round N` display | Round formatter is corrected | Dev present — retest |
| Show round, date, time and venue on active and historical ballots | Fixture details are present | Dev present — retest |
| Show goals and cards beside historical players | Historical stats are present | Dev present — retest |
| Incorrect-result report names the full fixture and requires an explanation | Required report validation is present | Dev present — retest |
| Selected ballot draft survives leaving and returning without submission | Passed in the earlier owner review | Previous owner pass — regression retest |
| Split analytics into Player Leaderboard, Vote Completion and Individual Votes Log | Three tabs are present; view, scope and tab-specific filters are URL-backed. Individual Votes Log remains correctly limited to Super/Association Admin. | Code-review pass; browser retest |
| Keep Umpire Match Voting data out of MVP Analytics | Separate data and navigation remain | Dev present — retest |

## 6. Umpire Match Voting

| Owner observation or requirement | Current position | Test status |
|---|---|---|
| Umpire and player suggestions start after one character | One-character suggestions are present | Dev present — retest |
| Suggestions use full SportStack names but permit free text | Full profile names and free text are supported, but the candidate loader also includes active memberships from every team in both fixture clubs and therefore offers unrelated players | Partial fail |
| Remove separate search buttons, Roster wording and duplicate team text | Ballot fields were simplified | Dev present — retest |
| Round options show dates/date ranges and include the current started round | Round display and eligibility logic are present | Dev present — retest |
| Only eligible completed fixtures can receive votes | Completed-fixture rule remains | Dev present — retest |
| Voting scheme comes from the division and is not editable on the ballot | Division scheme lookup is present | Dev present — retest |
| Every line requires a team plus a player name or number | Inline validation is present | Dev present — retest |
| Number-only entries show a warning and require acknowledgement | Warning and acknowledgement are present | Dev present — retest |
| Missing fields explain why Next is disabled | Inline error text is present | Dev present — retest |
| Back retains entered ballot data | Passed in the earlier owner review | Previous owner pass — regression retest |
| Saved corrections appear immediately in audit history | Correction refresh is present | Dev present — retest |
| Linked corrections retain full SportStack names | Linked name display is present | Dev present — retest |
| Leaderboard filters persist and separate division totals | Persistent division breakdown is present | Dev present — retest |
| Submission is atomic and the same fixture cannot be submitted twice by the same eligible voter | Existing transaction and duplicate-vote protection remain | Previous implementation — regression retest |

## 7. Coaching, roster, formations and profile

| Owner observation or requirement | Current position | Test status |
|---|---|---|
| Each player appears once with one Primary, Secondary or Fill-in relationship | Squad/Roster deduplication is present | Dev present — retest |
| The same team cannot be assigned twice or be Primary and Secondary | New membership guards are present | Dev present — retest |
| Add compact Primary, Secondary and Fill-in KPIs | KPI cards are present | Dev present — retest |
| Show player number and preferred positions on useful cards | Team player details are present | Dev present — retest |
| Use canonical Goalkeeper, Defence/Back, Midfield and Forward/Striker groups | Shared position catalogue and aliases are present | Dev present — retest |
| Roster filters use the same position catalogue as preferences and formations | Shared filtering is present | Dev present — retest |
| Canvas Tools and Inspector independently collapse | Collapse controls are present | Dev present — retest |
| Focus mode maximises the pitch and retains small draggable position icons | Focus mode is present | Dev present — retest |
| Desktop pitch defaults to landscape and remembers later changes | Landscape default/persistence is present | Dev present — retest |
| Templates/formations/assets can be shared only inside the creator's authorised scope | Sport/association/club sharing controls are present | Dev present — retest |
| Rename Preferred Playing Positions to Team Player Details | New heading is present | Dev present — retest |
| Team-specific number and positions are editable | Team Player Details editor is present | Dev present — retest |
| Remove the unnecessary MVP Ballots profile KPI | KPI was removed | Dev present — retest |
| Profile shows active mode plus all assigned roles and scopes, not only Voter | Role/scope display is present | Dev present — retest |

## 8. Safety Hub

| Owner observation or requirement | Current position | Test status |
|---|---|---|
| Compact KPI cards and remove duplicated coloured pills | Dashboard was compacted | Dev present — retest |
| Filters wrap without clipping or horizontal overflow | Responsive filter layout is present | Dev present — retest |
| Separate Current Rating and Target Rating columns | Separate columns are present | Dev present — retest |
| Show Owner only in lists; retain Added by in details/audit | List rows were simplified | Dev present — retest |
| Reduce Risk, Action, QI, Bright Idea and Audit row height | Compact rows are present | Dev present — retest |
| Repair Action drawer header and Edit/linked-record white-screen crashes | Drawer and route handling were repaired | Dev present — retest |
| Show vertical BE SMART letters with their matching text | BE SMART layout is present | Dev present — retest |
| Link multiple Risks, Actions, QI items and Bright Ideas | General record-link model is present | Dev present — retest |
| Add or create related records later | Link/create controls are present | Dev present — retest |
| Hide automatic Added by, scope and Status from Bright Idea submission | Automatic fields are hidden but still stored/audited | Dev present — retest |
| Configure fixed 5×5 matrix labels, descriptions and all 25 ratings | Organisation matrix settings are present | Dev present — retest |
| Categories can be added, described, hidden/restored and never hard-deleted | Category archive model is present | Dev present — retest |
| Audit matrix, category and record-link changes | Audit triggers/functions are present | Dev present — retest |

## 9. Committee Management

| Owner observation or requirement | Current position | Test status |
|---|---|---|
| Separate Committee Work from Committee Administration | Two-area layout is present | Dev present — retest |
| Remove the redundant association pill and compact position cards | Scope/position presentation was simplified | Dev present — retest |
| Upload private PDF, Office, JPG and PNG files up to 20 MB | Private committee storage flow is present | Dev present — retest |
| Show chat composer only with Chat permission | Permission-gated composer is present | Dev present — retest |
| Add meeting calendar and scheduling | Calendar/scheduler are present | Dev present — retest |
| Link agenda, attendance, apologies, minutes and resulting actions | Meeting workflow is present | Dev present — retest |
| Add searchable Minutes Library | Minutes Library is present | Dev present — retest |
| Archive/hide templates rather than delete them | Template archive flow is present | Dev present — retest |
| Templates support header, description, attendance, apologies and reorderable sections/items | Extended template model is present | Dev present — retest |
| Include recurring sections, General Business and selected open actions | Agenda controls are present | Dev present — retest |
| Agenda/minutes items can link multiple Safety Hub records or start a new one | Link and create paths are present | Dev present — retest |
| Preserve free text, choose one, choose multiple and Yes/No/Abstain polls | Existing poll types remain | Previous owner review accepted layout; regression retest |

## 10. Test execution order

Codex runs items 1–21 hands-off on Dev and records **Pass**, **Fail** or **Needs discussion**, with
screenshots or database evidence where useful. Aaron only needs to make the item 22 acceptance
decision or answer a business/visual judgement that cannot be resolved from the specification.

| # | Workflow | Primary check |
|---:|---|---|
| 1 | Use the signed-in Admin Sportstack Super Admin to provision isolated Association Admin, Club Admin, Team Manager, Coach, Player and Umpire Dev accounts; retain Admin Sportstack as the real Super Admin control account | Automated browser + database |
| 2 | Create a temporary permission group, module-access set, role/group/user assignments and direct user exception; verify inheritance, explicit enable/disable, navigation, direct-route blocking, group-member removal and archived configuration | Automated browser + rolled-back database |
| 3 | Verify Association Admin security, selected-mode limits and scoped user list | Automated actual-role browser + database |
| 4 | Verify Club Admin security, scoped user list and protection of peer/higher roles | Automated actual-role browser + database |
| 4A | Using the real Association and Club Admin accounts, author allowed permission assignments and verify rejection of outside-scope groups/users, peer/higher roles and mixed parent/child scopes | Automated actual-role browser + database |
| 5 | Verify Team Manager, Coach and Player navigation, actions and cascade using their real Dev accounts | Automated actual-role browser |
| 6 | Verify multi-team cascade, Lucas HC, Team Overview and already-selected team behaviour | Automated browser |
| 7 | Verify Admin Dashboard scope, KPI links, Quick Actions and branding | Automated browser; visual suitability is owner judgement |
| 8 | Verify scope, tab, filter and draft persistence through tabs, Back and refresh; verify logout clears drafts while account theme/preferences survive login in a second private browser context | Automated browser |
| 9 | Verify fixture list/calendar, competition name, full round wording and a bye | Automated browser |
| 10 | Verify Team Chat edit history, refresh context, newest-message position, 50-message pagination and self-notification suppression | Automated browser + database evidence |
| 11 | Verify Club/Association Updates and notification coverage, deep links and persistent read state | Automated browser; real email delivery is owner-assisted if required |
| 12 | Run the joined daily workflow: Player sets availability and posts an unavailable message; Coach selects and distributes a lineup; Player changes to unavailable; Coach receives the priority alert, revises and redistributes; Player sees the replacement lineup | Automated Player + Coach browser sessions |
| 13 | Verify Player MVP active ballot, identity/number mapping, status/time, incorrect-result validation, draft retention and history | Automated browser + database evidence |
| 14 | Verify the three MVP Analytics tabs, persistent filters and absence of Umpire Match Voting data | Automated browser |
| 15 | Verify Umpire Match Ballot search, current round, division scheme, number-only warning, inline validation and Back persistence | Automated browser |
| 16 | Verify Umpire Match Voting correction history, full linked names, leaderboard division breakdown, atomic submission and duplicate protection | Automated browser + rolled-back database |
| 17 | Verify Squad, Roster, Team Player Details, deduplication, KPIs and shared position catalogue | Automated browser |
| 18 | Complete the Coach workflow: select the available team, place it on the pitch, verify collapse/focus/landscape, distribute a read-only version to the selected team, confirm it persists after refresh and confirm a later published version supersedes the earlier one | Automated Coach + Player browser; formation suitability is owner judgement |
| 19 | Verify Safety Hub compact layout, crash recovery, links, BE SMART, matrix/category configuration and audit | Automated browser + database evidence; final matrix wording is owner judgement |
| 20 | Verify Committee Work and Administration, meeting/calendar, agenda, minutes, permissions, chat and polls; verify a valid private upload plus rejection for an unauthorised committee, unsupported type and file over 20 MB | Automated browser + database/storage evidence |
| 21 | Run desktop review widths, tablet and mobile responsive checks plus the final automated regression and quality gates below | Automated browser + command checks |
| 22 | Review failures/known debt and decide whether the verified Dev package is accepted for `main` staging | Owner judgement and approval |

### Automated completion gates

Before item 22, Codex must record:

- Actual-role results for Association Admin, Club Admin, Team Manager, Coach, Player and Umpire
  disposable accounts, using Admin Sportstack as the real Super Admin control account.
- Rolled-back Dev checks for hierarchy, scope, duplicate membership/Primary guards, mode-aware
  permission administration, inheritance/direct-user precedence and administration audit entries.
- Regression results for Availability, Communications, notifications, both voting modules,
  Formations and Committee polls.
- Focused lint for changed files, full `npm run lint` with baseline debt separated,
  `npm run lint:dev-plan`, `npx tsc --noEmit`, `npm run build`, relevant Python tests and Supabase
  validation/adviser checks.
- A concise evidence report listing passed, failed, blocked and owner-judgement items. Disposable
  test records may be archived through supported app flows; no historical membership row is to be
  removed.
- Read-only evidence that the duplicate-membership snapshot/dry-run still reports 201 duplicate
  groups, 44 users with multiple active Primary memberships and 490 captured rows, with no cleanup.

### Owner-only decisions

- Whether visual layout, wording, matrix labels, formation presentation and day-to-day business
  behaviour feel right after Codex supplies evidence.
- Whether to approve the separate destructive cleanup proposal for historical duplicate
  memberships.
- Whether to accept the Dev package for `main` staging.
- Any later `prod`, Production Supabase, public deployment, domain, DNS or redirect change.

## Excluded from this run

- Historical membership cleanup.
- `main` staging promotion until owner acceptance.
- `prod`, Production Supabase and the public production deployment.
- New domains, DNS and redirects, including `hb.sportstackapp.com.au`.

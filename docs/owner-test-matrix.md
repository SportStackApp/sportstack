# SportStack Owner-Test Matrix

Last updated: 3 August 2026

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
- Additive migration `20260803090000_scope_reserved_umpire_voter_accounts.sql` is applied to Dev.
  It gives only the reserved disposable Umpire and Voter test identities a selected team context
  while retaining one isolated stored role.
- Additive migration `20260803104000_allow_umpire_role_fixture_scope.sql` is applied to Dev. It
  permits an actual Umpire role to submit for an enabled fixture in its assigned association while
  keeping the ordinary selected-cascade check for every other role and mode.
- `provision-dev-test-account` version 8 is deployed to Dev with JWT verification enabled. It
  validates the live authenticated session and current Super Admin role before creating or
  explicitly resetting one of the seven exact metadata-marked reserved Dev identities.
- Seven disposable role profiles exist for Association Admin, Club Admin, Team Manager, Coach,
  Player, Umpire and Voter testing. Aaron has authorised hands-off password resets and recoverable
  Dev-only test changes for these accounts. Credentials remain ephemeral and the separate-login
  actual-role workflow matrix is now unblocked. No authentication bypass is permitted.
- Historical membership cleanup, staging acceptance and every Production/domain change remain
  outside this run.

## Hands-off Dev evidence — 2 August 2026

The unattended pass used the signed-in Admin Sportstack Super Admin account, read-only Dev database
checks and safe browser navigation. It did not submit ballots, publish messages, upload files,
change module rules, create Safety/Committee records or alter historical memberships.

| Area | Evidence collected | Result |
|---|---|---|
| Actual-role discovery | Separate Association Admin, Club Admin, Team Manager, Coach, Player, Umpire and Voter sessions were opened. Association and Club scope were broadly correct. Team Manager could directly open broad administration routes; Coach and Player reached a blank Roles & modules route; Player navigation exposed Umpire administration; Coach showed Edit branding; and the isolated Umpire/Voter identities had no team context. Active-mode route gates, fail-closed non-blank errors, contextual menu filtering and team-scoped Umpire/Voter reset support now pass focused lint, TypeScript, build and 16 regression tests locally. | **Fix prepared — deploy and actual-role retest required** |
| Viewing-as and scope | Association Admin, Team Manager, Coach and Player previews were opened. Lower previews changed menus and scope, but Player still exposed Umpiring pages and an already-open Squad route remained accessible. A fresh read-only check on deployed build `9949d2b` confirmed the active selector was `team_manager` while Profile incorrectly said `Viewing as Super Admin` and the Lucas HC Admin Dashboard incorrectly showed a `Super Admin` badge. Source review confirmed Profile reads root `modeLabel`, the Admin badge reads the highest stored role and the unnamed Profile role/scope line is caused by its local maps omitting `UMPIRE_ADMIN`. These labels do not prove that the active preview reset. Direct navigation while previewing Team Manager rendered Umpire Match Voting and MVP Analytics: the ballot checks stored account roles, `useAdminScope` treats Team Manager as an admin and `/admin/analytics` has no direct `ModuleGate`. Safety Hub rendered its empty scoped screen and Committee correctly reported no accessible committees. | **Fail — active-preview display and direct-route restriction remain inconsistent** |
| Deliberate Super Admin selection | Frontend guards `879d184` and `5514996` prevent the known local cascade races and pass unit, focused lint, TypeScript, build, Dev Quality and Vercel deployment checks. A fresh test on deployed build `5514996` selected Super Admin from `/admin`, waited 2.5 seconds, and observed a redirect to `/dashboard` with Team Manager restored. A later read-only Back-navigation check on build `9949d2b` returned from Team Chat to `/admin`, then the application asynchronously replaced it with `/dashboard` while Team Manager remained selected. | **Fail — session-context/navigation reset remains** |
| Scoped users and permissions | Lucas HC Admin Dashboard and its scoped user link retained the Lucas query and showed eight users. Higher-account editing was disabled. Roles & modules showed group/set/module controls and enabled scope actions only after Lucas was selected. Live Dev currently has no saved permission groups, sets, assignments, overrides or module flags. | **Read-only pass; actual-role write tests pending** |
| Scoped dashboard and user details | Admin KPI links preserve selected URL scope. Aaron's actual AM account exposed a mismatch: its stored Club Admin role is only Grampians Hockey Club, but the header listed every Hockey Ballarat club and retained Blaze even though the server correctly rejected it. Commit `77422f1` filters header clubs by active-role scope, canonicalises invalid retained scope and blocks unauthorised club routes. Aaron confirmed the refreshed selector now behaves correctly. The scoped Users table still renders the complete role list rather than only context-applicable roles. | **Club selector owner pass on Dev — 10/08/2026. Contextual Users role presentation remains parked.** |
| Permission catalogue presentation | `AdvancedPermissionControls` filters the catalogue to `category === "MODULE"` for permission sets and direct exceptions. Action entries remain stored for future workflow integration but are not presented as enforceable controls in this release. | **Code-review pass** |
| Fixtures and byes | Actual Team Manager list and calendar views showed the selected Pumas scope, full competition, rounds, dates and times. Admin Fixtures displayed byes without a false opponent time/venue. Completed fixture detail showed score, participants, goals, cards and fill-in status. Association Admin unchanged-save testing found and fixed a timezone shift in `e38150d`; deployed UI and Dev DB retests preserved `12:15 pm` / `02:15+00`. | **Actual-role and blocker-retest pass on Dev — 09/08/2026** |
| Scheduled fixture detail and availability controls work for actual Team Manager | Commit `df5b0ec` fixed the scheduled-detail crash. Commit `7d7e67f` then made unselected states readable, used **Maybe** consistently on Dashboard and Fixture Detail, persisted the response through refresh and allowed the selected choice to be clicked again to return to **No response**. Aaron confirmed the complete deployed behaviour. | **Owner UI pass on Dev — 08/08/2026** |
| Communications | Team Chat, replies, reactions and removed placeholders loaded. Commit `a77f01a` adds account/channel draft persistence across full reload, explicit legacy-history wording and tested 50-message merge/pagination helpers. Three focused tests cover edits, a 51-message page and full-page detection. No real message/update was published. | **Automated repair pass; signed-in reload smoke test remains** |
| Player MVP Voting | The actual Player route exposed only Player MVP and correctly reported no voting rounds because the disposable player has no attended appearance or selected fill-in. Admin analytics foundations remain present, but no eligible ballot/analytics end-to-end write was made. | **Partial pass; eligible disposable ballot and analytics still pending** |
| Umpire Match Voting | Actual Umpire login and ballot route passed. Dev Edge Function version 9 now builds and validates candidates from the selected fixture's two teams, selected fill-ins, line-up assignments and recorded appearances. A live Round 13 candidate search loaded without browser console errors; no ballot was submitted. | **Fixture-scope repair live; actual Umpire submission regression remains** |
| Coaching, roster, formation and profile | An actual disposable Player set availability for Pumas vs Gold and the response survived reload. An actual Coach saw that named player as Available, added the player to the line-up, moved them from the bench to Goalie and saved. The saved position survived reload. A separate actual Player session opened the same line-up as View only and saw the saved Goalie. The exact disposable line-up rows were removed afterwards and the Player cleared availability through the UI. Profile correctly showed Player mode, Pumas scope, Team Player Details and no MVP Ballots KPI. On deployed build `1d4bd20`, an actual disposable Player cleared player number `997`, saved, reloaded and confirmed it remained blank. An actual disposable Coach also opened Squad and Roster: both showed 25 unique Pumas players and matching compact relationship totals of 22 Primary, 3 Secondary and 0 Fill-in. Most position details remain empty because the test data has not configured them. Formation Builder panel collapse, focus mode and landscape surface passed the earlier read-only check. Repeated availability identities (`James V` and `Tom Batchelor`), sparse card details and active Viewing-as restrictions remain separate follow-up items. | **Actual Player → Coach → read-only Player workflow and profile/Squad/Roster retest pass** |
| Safety Hub and Committee | Actual Association Admin retesting loaded every Safety Hub dashboard/register/guidance/audit tab and the guided Add Risk form without a write. Committee calendar, Polls, restricted Chat, Minutes and every administration tab loaded. Commit `a77f01a` changes the empty Meetings copy to neutral recorded-meeting wording so it does not contradict past Calendar entries. Linked-record edits, uploads and other write paths remain unverified. | **Actual-role read-only pass; wording fixed; write paths remain** |
| Responsive layout | Fresh deployed-build checks at 1280 x 720 found no document-level horizontal overflow on My Dashboard, Fixtures, Communications, Roster, Formation Library, Safety Hub or Committee Management. The authenticated in-app browser cannot change its viewport and the unrelated Chrome window was not repurposed, so tablet/mobile integrated testing remains outstanding. | **Desktop pass; tablet/mobile pending** |
| Dev integrity and quality | Commit `a77f01a` passed focused changed-file lint, TypeScript, build, 19 Vitest tests, 167 Python tests plus 29 subtests, `git diff --check`, zero-vulnerability `npm audit` and Vercel READY. Full lint remains its unchanged 360-error/78-warning baseline. Dev migration `20260810064248_harden_functions_and_rls_performance` reduced adviser totals from 85/554 to 75/493 and removed all 61 `auth_rls_initplan` notices. | **Repair, dependency and safe adviser batch pass on Dev — 10/08/2026** |

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

**Owner decision — 8 August 2026:** Discontinue the current Roles & modules screen review and park
the broader permission model/UI until a dedicated full review. Existing security boundaries remain
active and must still be tested where they directly protect another workflow. If a permission issue
causes incorrect access or blocks the workflow currently under test, deal with it then; otherwise
record it for the parked review. Every new feature must explicitly consider whether view, create,
edit, approve, publish, export or management access controls are required.

| Owner observation or requirement | Current position | Test status |
|---|---|---|
| Club Admin user list must match their club scope only | Deployed Club Admin session showed the Grampians Hockey Club scope. Protected higher/peer admin Edit Details controls were disabled, while an ordinary in-scope user's Edit Details dialog opened normally. | Owner UI pass on Dev — 08/08/2026 |
| Lower roles may view higher or peer admin accounts but must not edit them | Aaron confirmed visibility is acceptable. Server hierarchy blocks Club Admin from editing Super, Association and Club Admin targets; deployed Club Admin testing showed disabled Edit Details controls for protected accounts while ordinary club users remained editable. | Owner UI pass on Dev — 08/08/2026 |
| Viewing as must restrict data and actions, not just change the menu | Admin scope and permission screen use the active mode and selected cascade scope | Dev present — retest |
| Coach and Team Manager remain separate roles and modes | Separate role values, scopes and mode entries remain | Dev present — retest |
| Actual Team Manager line-up access follows Coach/Player view | On deployed `7d7e67f`, the actual Pumas Team Manager opened the Bobcats vs Pumas line-up with formation, Save, Find a fill-in and Suggest controls. Switching **View as** to Player kept the line-up visible while removing editing controls; switching back to Coach restored them. No data was changed. | **Owner UI pass on Dev — 09/08/2026** |
| Missing authentication email must not block role or team edits | Role/team save is separate from profile email validation | Dev present — retest |
| New duplicate memberships and multiple active Primary teams must be rejected | Database write guards are present | Dev present — retest |
| Existing duplicate users display once | UI deduplication is present; historical rows remain unchanged | Dev present — retest |
| Historical duplicate cleanup must not run without approval | Snapshot: 201 duplicate groups, 44 multiple-Primary users, 490 rows | Approval-gated |
| Module access can be assigned to roles, named groups or individual users | Permission groups, reusable sets, assignments and direct exceptions are present | UI review parked by owner — retain DB evidence |
| Association, club, division and team scopes inherit correctly | Effective resolver uses the closest selected scope | UI review parked by owner — retain DB evidence |
| A direct user exception can override a group permission | Resolver returned `DIRECT_USER` over `SET_GROUP` in a rolled-back test | DB pass |
| Every permission administration change is auditable | Save functions write to the administration audit log | UI review parked by owner — retain DB evidence |
| Action-level permissions must not be presented as enforced before their workflows use them | Permission sets and direct exceptions filter the catalogue to enforced `MODULE` entries; future `ACTION` entries are not selectable | Code-review pass |
| Module OFF must remove normal app access while data remains protected | Admin routes are wrapped in an active-mode gate before their module/page renders. The Umpire ballot additionally requires Umpire role when the active mode is Player. Underlying tables and RPCs retain their existing Supabase RLS/authorisation. | Fix prepared — deployed retest required |
| Scoped admins can author permissions only inside their authority | Association and Club Admin mode writes/listing are hierarchy-checked server-side. Club Admin direct route loaded, but the menu link was absent and the club-selection check was not completed before the review was parked. | UI review parked by owner — retain DB evidence |
| Test with real role accounts, not only Viewing as | Secure Dev-account provisioner v8 can explicitly reset the seven reserved identities, including a disposable team context for isolated Umpire/Voter testing; the actual Admin Sportstack Super Admin is signed in | In progress — discovery complete; repaired build retest pending |

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
| Team Overview has banner, fixtures, ladder, statistics and KPIs like other entity levels | Deployed build `b03938d` opened the Lucas HC Team Overview successfully with team-level content, including when the already-selected team button was clicked again. Its bye fixture still rendered as `Lucas HC vs Unknown` with midnight/TBD details. Add a small visible `Overview` label so the page type is unambiguous. | Partial pass — navigation passes; bye formatting and page label required |
| Cascade remains visible for Club Admin, Team Manager and Coach | Assigned-scope cascade is present | Dev present — retest |
| All assigned teams appear, including Lucas HC | The failed nested role query was replaced in `a77f01a` with a flat role query resolved through complete TeamContext team/club/association data. This removes the source cause without changing role rows. | **Repair deployed; real multi-club Team Manager login retest required** |
| Selecting a club or division must not predictively select a lower cascade level | Selecting Lucas HC and then Division 1 Open no longer automatically selects the only available team. Lower cascade levels remain unselected until the user or an explicit entity route chooses them. | Implemented in Dev batch — deployed retest required |
| Empty cascade controls are disabled only when there is no alternative | Conditional dropdown behaviour is present | Dev present — retest |
| Restore the logo and show Hockey Ballarat instead of HB | Full association name and logo treatment are present | Dev present — retest |
| Keep the full desktop cascade at the 1275–1294 px review widths | Responsive cascade sizing is present | Dev present — retest |
| Admin KPI links retain selected association, club, division and team | Scoped KPI links are present | Dev present — retest |
| Manage Clubs must show only clubs in the selected association | Selected-scope list links are present | Dev present — retest |
| Select Club must not display associations | Cascade labels and option sources were separated | Dev present — retest |
| Remove Quick Actions that duplicate KPI links | Duplicate actions were removed; unique members, feedback and error logs remain | Dev present — retest |
| Add banner/branding space to scoped Admin Dashboards | Branding area is present | Dev present — retest |
| Admin Dashboard badge must describe the active mode, not the account's highest role | The badge now maps from the confirmed active mode instead of the account's highest stored role | Fix prepared — deployed retest required |
| Scoped user rows show roles applicable to the selected organisation/team | The table currently renders the user's complete deduplicated role list without contextual scope filtering | Code-review fail |
| Separate MVP Voting and Umpiring in the left menu | Player MVP Voting/Analytics and Umpire Ballot/Admin/Analytics are separate | Dev present — retest |

## 4. Fixtures, communications and notifications

| Owner observation or requirement | Current position | Test status |
|---|---|---|
| Admin Fixtures Management must clearly reflect the active cascade scope | Fixture filters now mirror the active association, club, division and team cascade instead of displaying misleading `All ...` labels. The filter row is consistently labelled and responsive. | Implemented in Dev batch — deployed retest required |
| Only Super/Association Admin can edit fixtures | Fixture Management is route/menu-gated to active Super or Association Admin mode. Dev RLS permits true Super Admin mode globally and Association Admin only inside the selected association; Club Admin and lower modes use the read-only team Fixtures page. | Implemented in Dev code/database — actual-role retest required |
| Fixture list/calendar buttons visibly switch views | Calendar view has previous/next/current-month navigation and keeps historical fixtures available. Historical cards show green Win, red Loss or orange Draw plus the selected team's score; unscored past fixtures remain muted. The selected month is URL-backed. | Implemented in Dev batch — deployed retest required |
| Competition selector shows the full name | Selector width is increased | Dev present — retest |
| Byes display as `Team — Bye` without Unknown, midnight or TBD | Deployed Team Manager Fixtures passed with `Lucas HC — Bye` and no fake details. A shared display repair is prepared for Division/Team Overviews, fixture detail and Admin Fixtures without changing imported fixture rows. | Partial pass — deployed retest pending |
| Use `Round 15`, not `Rd 15` | Full round wording is implemented | Dev present — retest |
| Bye fixture detail must use bye-specific presentation | On deployed build `b03938d`, the Lucas HC bye detail showed `Lucas HC vs Unknown`, `12:00 am` and `TBD`. The prepared shared display repair uses `Lucas HC — Bye`, omits opponent/time/location fields and treats a past bye as completed for display only. | Fix prepared — deployed retest pending |
| Completed fixture detail should show scraped result, participants and match statistics | Completed fixture detail now combines SportStack profiles, fixture availability, selected fill-ins and RevSports appearances. It shows the result, round, goals/cards and orders regular participants first, participating fill-ins second and remaining eligible players last. Unlinked appearances retain the scraped-name fallback. | Implemented in Dev batch — deployed data retest required |
| Competition/division lists use consistent sporting order | Shared cascade ordering now shows senior divisions first, Open before Women at the same division, then junior age groups from oldest to youngest. Names inside the same group use natural alphabetical ordering. | Added from feedback log — deployed retest required |
| Anyone can inspect immutable edited-message history | Message revision history is present | Dev present — retest |
| Removed messages keep a placeholder and restricted audit record | Removal behaviour remains | Previous owner pass — regression retest |
| Chat opens at the newest message | Newest-message entry is present | Dev present — retest |
| Load the latest 50 messages, then 50 older messages when scrolling up | Upward pagination uses batches of 50. Focused tests cover correct merge ordering, edit replacement and 51-message pagination without publishing real-user noise. | Automated pass; signed-in smoke test remains |
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
| Suggestions use full SportStack names but permit free text | Full profile names and free text remain supported. Edge Function version 9 restricts linked suggestions and submission validation to the selected fixture's two teams, selected fill-ins, line-up assignments and recorded appearances. | Live fixture-scope search pass; submission regression remains |
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
| Each player appears once with one Primary, Secondary or Fill-in relationship | Actual Coach saw 25 unique Pumas players in both Squad and Roster | Pass |
| The same team cannot be assigned twice or be Primary and Secondary | New membership guards are present | Dev present — retest |
| Add compact Primary, Secondary and Fill-in KPIs | Actual Coach saw matching 22 Primary, 3 Secondary and 0 Fill-in totals in Squad and Roster | Pass |
| Show player number and preferred positions on useful cards | Team player details are present | Dev present — retest |
| Use canonical Goalkeeper, Defence/Back, Midfield and Forward/Striker groups | Shared position catalogue and aliases are present | Dev present — retest |
| Roster filters use the same position catalogue as preferences and formations | Shared filtering is present | Dev present — retest |
| Canvas Tools and Inspector independently collapse | Collapse controls are present | Dev present — retest |
| Focus mode maximises the pitch and retains small draggable position icons | Focus mode is present | Dev present — retest |
| Desktop pitch defaults to landscape and remembers later changes | Landscape default/persistence is present | Dev present — retest |
| Templates/formations/assets can be shared only inside the creator's authorised scope | Sport/association/club sharing controls are present | Dev present — retest |
| Rename Preferred Playing Positions to Team Player Details | New heading is present | Dev present — retest |
| Team-specific number and positions are editable | On deployed build `1d4bd20`, an actual Player cleared number `997`, saved and confirmed the blank survived reload. Position controls load, but most current team data has no configured choices. | Player-number pass; position-data retest later |
| Remove the unnecessary MVP Ballots profile KPI | Actual Player profile showed no MVP Ballots KPI | Pass |
| Profile shows active mode plus all assigned roles and scopes, not only Voter | Deployed build `b03938d` showed `Viewing as Association Admin` while retaining the complete assigned role list. The behaviour is correct; improve the role-list presentation during a later visual-polish pass. | Pass; visual polish deferred |

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
| 2 | **PARKED BY OWNER:** Full Roles & modules UI/model review, including temporary groups, sets, assignments, inheritance and exceptions | Resume only as a dedicated permission review |
| 3 | Verify Association Admin security, selected-mode limits and scoped user list | Automated actual-role browser + database |
| 4 | Verify Club Admin security, scoped user list and protection of peer/higher roles | Automated actual-role browser + database |
| 4A | **PARKED BY OWNER:** Association/Club Admin permission-authoring UI review | Existing server-side hierarchy remains mandatory; retest when the dedicated review resumes |
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

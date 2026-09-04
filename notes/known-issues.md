# SportStack — Known Issues & Parked Tasks

> This is the supporting defect and parked-item register. Current priority and sequencing come from
> `docs/consolidated-open-items-plan.md`.

## Dev placeholder identities and unsupported permanent bans

**Logged and repaired:** 4 September 2026
**Status:** Core repair complete; one Dev helper cleanup remains

Five registered Pumas identities were created through RevSports Review as new placeholders even
though confirmed real identities existed in Production. They were reconciled in place in Dev with
no email, replacement profile or lost roster reference. The roster picker now includes active team
members and previous fill-ins regardless of whether the account has been claimed.

Dev also had 731 intentionally disabled Auth users using `banned_until = infinity`. Supabase Auth
could not scan that value, causing admin-detail and email lookups to fail and allowing a profile
write to occur before the Auth failure. All 731 remain disabled using a supported 100-year ban. The
tracked `update-user-details` function now validates Auth first and rolls back an email change if a
profile write fails.

Two secondary Pumas fill-ins remain unclaimed Lucas HC placeholders in both environments because no
real account is available to merge. This is valid identity state, not a reason to hide them from a
roster. The locked Dev-only smoke helper `dev-auth-admin-smoke` should be removed from the Supabase
dashboard when an account with Function-delete permission is available; it requires JWT and returns
410 while inactive.

## Coach Narrative

**Logged:** 29 August 2026
**Status:** Parked future Coaching feature

The intended flow is a short post-game questionnaire or dictated note for a coach/team manager.
An AI-assisted draft would produce a match summary, team positives and improvement areas. Any
player-specific observation must be reviewed by the coach before it is deliberately saved against
that player's fixture history. The current batch only supplies author-private manual fixture notes
and the future `COACH_NARRATIVE` source shape. AI provider choice, speech capture, consent, retention,
editing and visibility rules are not yet designed or implemented.

## 29 August 2026 desktop UI/UX review

**Status:** Small accessibility repair deployed to Dev and Main; authenticated persistence remains open

Resolved:

- Password visibility buttons on Login, Sign-up and Reset Password now have meaningful accessible
  names and expose their pressed state.
- Sign-up, Umpire Match Voting and public proxy-ballot selectors now have meaningful accessible
  names. Fixture Management edit/delete icon buttons are also named.
- The public proxy ballot retained unsent name and email values after a browser-tab switch on Dev.

Still open or blocked:

- Aaron's requirement is that unfinished forms and search state must not disappear when switching
  to another Windows application and back. Authenticated pages, especially Roles & Permissions,
  still need a real signed-in Windows-focus matrix. This run had no isolated-browser credentials,
  so it is **Blocked**, not passed.
- Login, Sign-up and Forgot Password need a deliberate landmark, heading and colour-contrast pass.
- The public landing page still shows **GRAMPIANS HOCKEY** and `© 2024 Grampians Hockey`. Confirm
  intended branding before changing it.

No form was submitted, no record was deleted and no database migration was included.

## 21 August 2026 Dev Catch-up Results

**Status:** Confirmed repair batch deployed; controlled write and actual-role checks remain

Resolved on Dev:

- Player Explorer all-result totals, saved-filter lifecycle, page-return persistence, Use 7 then 1
  preset and Team Manager timeout.
- Contextual scoped-user role display and stable scope transitions.
- Fixture-dialog focus restoration and **Bye** score labels.
- Umpire Match Voting association player picker, Seniors/Juniors Excel sheets, division award lists
  and sortable submission headers.
- Top-right Admin menu internal scrolling, the transitive `nanoid` advisory and the dashboard's
  invalid `communication_channels.channel_type` query.

Still open or blocked:

- Separate actual-role browser regression sessions and the final Dev Umpire account Reset are
  blocked by browser credential policy. Viewing-as and rolled-back SQL/RLS evidence do not replace
  them.
- Tablet/mobile integrated testing is blocked by the authenticated in-app browser's fixed viewport.
- Full disposable write workflows remain for Coordination, Committee Management, Safety Hub and
  Incident and Discipline. Expense Hub has only a read-only smoke pass.
- Team Chat broadcast-author exclusion and notification deep links still need the targeted
  regression check. Historical membership cleanup remains separately approval-gated.
- The complete Roles and modules UX review remains parked by owner decision.

No Production system or historical record changed in this repair batch.

## Duplicate Team Names in Fixture Import
**Logged:** 14 April 2026  
**Status:** Resolved on Dev — 1 August 2026; owner smoke test pending

**Problem:**  
If two clubs within the same association both have a team with the same name (e.g. both have a "Division 1 Open"), the fixture importer silently picks the first match it finds. This could assign a game to the wrong team with no warning.

**Resolution:**
- The template now supplies exact `Club - Division - Team` labels.
- A short team name is accepted only when it is unique in the selected association and admin scope.
- Ambiguous names, mixed divisions, missing seasons and duplicate spreadsheet rows block the whole import.
- Imported fixtures now save their division and season links.

## Existing Duplicate Team Membership Data

**Logged:** 1 August 2026
**Status:** Snapshot complete — cleanup remains approval-gated

**Problem:**
A Dev read-only audit and immutable snapshot found 201 repeated user/team membership groups and 44
users with more than one active Primary membership. The snapshot preserves 490 affected rows (402
duplicate user/team rows and 88 multiple-Primary rows) before any cleanup.

**Current protection:**
- New direct administration and membership-request changes are serialised, scoped and atomic.
- Database guards reject duplicate user/team memberships and multiple active Primary teams.
- The interface deduplicates historical rows so users are not shown twice while cleanup is pending.
- Administrative changes are recorded in the scoped audit log.
- No existing membership was changed or deleted during the audit.

**Next step:**
Review the captured per-person rows and produce the exact keep/remove proposal. Applying that
proposal is a separate destructive data task and needs Aaron's approval.

## Owner-Test Remediation Verification

**Logged:** 1 August 2026
**Updated:** 3 August 2026
**Status:** Actual-role discovery complete — repaired Dev build retest and write paths remain

The locked remediation package is implemented across permissions, persistence, navigation,
Fixtures/Communications, Player MVP Voting, Umpire Match Voting, Coaching/Profile, Safety Hub and
Committee Management. Focused lint, TypeScript, build and 30 focused Python migration/security
tests pass.

The first Super Admin test found and resolved a stale role-enum reference in the Dev
`admin_save_user_roles` function. The database rollback test passes.

The actual Admin Sportstack `SUPER_ADMIN` account is now signed into Dev. Follow-up migrations
ending `105000`, `106000`, `107000`, `108000`, `109000`, `110000`, `113500`, `114000` and `115000`
passed rollback compile/runtime checks and are applied to Dev. The secure Dev-account provisioner
is active as version 7 with JWT verification, live-session validation and an explicit reset path
limited to the seven exact metadata-marked disposable Dev identities. Duplicate role rejection,
function-access checks, mode isolation and exact permission-group scope/member hierarchy
checks pass. Seven isolated Dev role accounts are prepared; the actual-role browser matrix remains
pending. Matching Dev commit `a06ae9a` and the two updated voting Edge Functions are live.

The first separate-account pass found that Team Manager could directly open broad administration
routes, Coach and Player reached a blank Roles & modules route, Player navigation exposed Umpire
administration, Coach showed Edit branding and isolated Umpire/Voter identities had no team
context. The local repair gates admin routes using the server-confirmed active mode, supplies a
recoverable non-blank failure screen, filters the lower-mode menu and supports team-scoped reserved
Umpire/Voter resets. Migration `20260803090000_scope_reserved_umpire_voter_accounts.sql` is applied
to Dev and `provision-dev-test-account` version 8 is active. The frontend deployment and
separate-account retest remain pending.

The test accounts use temporary credentials that are not stored in the repository. Aaron has
authorised password resets and recoverable Dev-only test changes for these disposable identities,
so the actual-role browser matrix can continue hands-off. Production, secrets and historical
membership cleanup remain outside this authority, and no authentication bypass is acceptable.

The 2 August hands-off pass traversed the main Dev modules without writing application data.
Commits `879d184` and `5514996` added guards for deliberate Super Admin selection and passed their
automated checks, but fresh deployed build `5514996` still redirects `/admin` to `/dashboard` and
restores Team Manager after Super Admin is selected. The remaining session-context/navigation reset
is open. The pass also confirmed these remaining gaps:

- Viewing-as labels, badges and direct-route access can disagree with the active lower preview. A
  fresh deployed-build check confirmed `team_manager` remained the active **Viewing as** value
  while Profile incorrectly said `Viewing as Super Admin` and the Lucas HC Admin Dashboard
  incorrectly showed a `Super Admin` badge. Source review confirmed Profile reads the root
  `modeLabel`, the Admin badge reads the account's highest stored role and Profile's unnamed
  role/scope line is caused by its local label maps omitting `UMPIRE_ADMIN`. These display defects do
  not prove the active preview reset.
- **Resolved and owner-confirmed on Dev in `77422f1`:** The server correctly rejected Blaze for
  an account whose Club Admin assignment is only Grampians Hockey Club, but the header had offered
  every association club and retained the rejected route. Club options now use active-role scope,
  invalid retained selections return to an assigned club, unauthorised club routes are redirected,
  and role changes no longer reuse an unassigned prior scope. Aaron confirmed the refreshed AM
  Club Admin selector now behaves correctly on 10 August 2026.
- Direct navigation while previewing Team Manager rendered Umpire Match Voting and MVP Analytics.
  The Umpire ballot checks stored account roles rather than active mode, `useAdminScope` treats Team
  Manager as an admin and `/admin/analytics` lacks a direct module gate. Safety Hub rendered its
  empty scoped screen and Committee correctly reported no accessible committees.
- Back navigation from Team Chat briefly restores `/admin`, then the application asynchronously
  replaces it with `/dashboard` while Team Manager remains selected. This confirms the reported
  Admin Dashboard return-state defect independently of the Edit Details dialog.
- My Dashboard still formats a bye as Unknown/midnight/TBD because it duplicates the Fixtures
  formatter and applies those fallbacks unconditionally.
- Fixture calendar month navigation, selected-team win/loss/draw colours and score display, plus
  completed-game player/stat display, are implemented in the current Dev batch and await deployed
  owner retesting. Fixture Management is limited to active Super/Association Admin mode and its Dev
  RLS policy scopes Association Admin writes to the selected association. Completed games can
  only show RevSports participants and statistics after that fixture has been scraped; unlinked
  appearances deliberately fall back to their raw scraped name.
- Legacy chat edits have no revision rows and therefore no earlier version to display.
- Player MVP Analytics now has the requested three URL-backed tabs. An eligible real-player ballot
  and remaining unlinked/short-name fallbacks still need browser testing.
- Umpire Match Voting search is too broad because it loads active memberships across every team in
  both fixture clubs, not only the fixture roster and two fixture teams.
- Scoped user rows show every stored role rather than only roles applicable to the selected scope.
  The Edit Details handler is an in-page dialog, so the observed Dashboard return is part of the
  unresolved mode/navigation reset rather than intended button behaviour.
- The availability → selection → pitch → distribution workflow exists through My Dashboard,
  fixture detail and Line-up rather than Squad/Roster. It loads fixture availability, supports
  coach/manager assignment or suggestions, publishes the saved line-up and exposes it to linked
  players. Its access helper still reads stored roles directly instead of the active Viewing-as
  mode, so a higher-role account can retain edit access while testing a lower mode.
- The Lucas HC fixture detail still displayed repeated availability identities for `James V` and
  `Tom Batchelor`. The Line-up screen otherwise loaded its roster, availability labels, formation
  positions and Coach controls without a write. Historical membership cleanup remains separately
  approval-gated.
- Fresh 1280 x 720 checks found no horizontal overflow on seven primary pages. Tablet/mobile
  integrated testing remains pending because the authenticated in-app browser has a fixed viewport.
- Team-chat unread counts exclude the sender and self-mentions are suppressed, but Club/Association
  broadcast notification and email recipient queries still include the author.

Read-only Dev counts remain 201 duplicate membership groups, 44 multiple-Primary users and the
490-row snapshot. Permission groups/sets/assignments/overrides/module flags and chat revisions are
currently empty, so those write paths still need disposable actual-role tests.

The detailed observation-to-test mapping is `docs/owner-test-matrix.md`.

Still required before staging:

- Test with separate real Super Admin, Association Admin, Club Admin, Team Manager, Coach and Player
  accounts; Viewing as is not sufficient.
- Test multi-team and multi-role cascade state through refresh, logout/login and incognito.
- Test committee private uploads, Safety Hub matrix/link changes and the two voting workflows with
  clearly marked disposable Dev records.
- Report repository-wide lint separately while its baseline remains 362 errors and 76 warnings.

## Whole-Site State Persistence Audit

**Logged:** 4 August 2026
**Status:** Users fix confirmed on Dev; broader screen audit parked for later

**Problem:**
When the browser loses focus and then returns to SportStack, the permission context performs a
background server recheck. The protected page was temporarily unmounted during that check. Open
dialogs therefore closed and unsaved form text was lost even though the user had not navigated away.

Intentional navigation to another SportStack page may load that page fresh. Cross-page filter
persistence is not required by this issue.

**To do:**
- Keep the last confirmed protected page mounted while focus/visibility performs a background
  permission-context check.
- Continue to fail closed during initial loading, actual sign-out, revoked roles or a newer canonical
  mode/scope from another tab.
- Confirm Users Edit Details and its unsaved text survive switching to another window and back.
- Regression-test one other unsaved form and one Safety Hub dialog after the Dev deployment.

**8 August owner test:** Deployed commit `f3486b0` passed the Users Edit Details test: the dialog
and unsaved text survived switching to Codex and back. Roles & Permissions still visibly refreshes
when focus returns. Aaron chose to record affected screens during actual-role testing and handle
the broader focus-refresh audit as a separate follow-up rather than interrupt the current matrix.

## Team Manager Scheduled Fixture Detail Crash

**Logged:** 8 August 2026
**Status:** Fixed and owner-confirmed on Dev in `df5b0ec`

The actual Team Manager Pumas fixture list loaded correctly on deployed `f3486b0`, but opening a
scheduled fixture displayed the route error boundary. `GameDetail` passed availability status
`MAYBE` into a style map whose matching key was incorrectly named `UNSURE`, then dereferenced the
missing style record. The page also used legacy client fallback `PENDING` instead of the generated
database enum value `NO_RESPONSE`.

The deployed repair uses the four generated availability values (`AVAILABLE`, `UNAVAILABLE`,
`MAYBE`, `NO_RESPONSE`) consistently and declares the style map as a complete typed record. Focused
lint, TypeScript, build, Dev Quality and all 146 Python regressions passed; repository-wide lint
remains at its existing 360-error/78-warning baseline. Aaron confirmed the scheduled fixture detail
now displays correctly. No database migration is included.

Follow-up owner testing found three availability UX issues on that detail: the unselected Maybe
button text was unreadable, the UI mixed **Unsure** and **Maybe**, and clicking the selected response
again did not clear it. Aaron chose **Maybe** as the consistent user-facing term because it matches
the database value. The local continuation uses readable tinted unselected states, updates Dashboard
and Fixture Detail to **Maybe**, and reuses the Dashboard delete-row behaviour so selecting the
active choice again returns to **No response**. The buttons now expose pressed/clear state to
assistive technology and block duplicate clicks while saving.

**Owner retest:** Aaron confirmed deployed commit `7d7e67f` has readable controls, consistent
**Maybe** wording, refresh persistence and click-again clearing back to no selected response.
The actual Pumas Team Manager also confirmed the line-up's Coach view has editing controls, Player
view is read-only, and switching back restores the controls. No line-up data was changed.

## 9 August 2026 unattended Dev findings

**Updated:** 10 August 2026
**Status:** Approved repair batch deployed to Dev; role-session acceptance checks remain

- **Fixture unchanged-save timezone shift — fixed on Dev:** Association Admin saving an unchanged
  `12:15 pm` fixture changed it to `10:15 pm`. Commit `e38150d` converts form values using the
  association timezone. Browser and Dev DB retests passed; no migration.
- **Multi-club Team Manager switching — repaired, session retest pending:** Commit `a77f01a`
  replaces the fragile nested role query with a flat role query resolved through the complete
  TeamContext lists. A real multi-club Team Manager login is still required before owner acceptance.
- **Communications persistence/history — repaired and draft owner-confirmed:** Drafts are now stored per account/channel
  across a full reload. Legacy edits with no revision rows show explanatory wording rather than an
  apparently broken empty history. Aaron confirmed an unsent Team Chat draft survives a full reload
  on Dev. He also confirmed an edited message displays its current and earlier versions with the
  editor and timestamp. Legacy messages without revision rows use the new explanatory wording.
- **Communications pagination — automated pass:** Focused tests cover edit replacement, a 51-message
  page and full-page detection without publishing disposable messages to real channels.
- **Line-up removal — repaired, session retest pending:** Coach view now exposes explicit remove-player
  and clear-position actions. No line-up data was changed during the final verification.
- **Player MVP Voting:** The disposable Player has no attended/selected match, so the eligible
  ballot and analytics flow still needs a controlled Dev-only round with email disabled.
- **Umpire Match Voting suggestion scope — repaired on Dev:** Edge Function version 9 restricts
  candidate loading and linked-profile submission validation to the selected fixture's two teams,
  selected fill-ins, line-up assignments and recorded appearances. Live fixture search passed; an
  actual Umpire submission regression remains.
- **Committee meeting wording — repaired:** Empty Meetings copy now says no meetings have been
  recorded for the committee and no longer implies that a past Calendar meeting cannot exist.
- **Repository dependency debt — resolved:** Reviewed dependency updates are on Dev and `npm audit`
  reports zero vulnerabilities.
- **Dev Supabase adviser debt — safe batch applied:** Additive migration
  `20260810090000_harden_functions_and_rls_performance.sql` passed rollback before apply. Security
  notices reduced 85 -> 75 and performance notices 554 -> 493. Remaining RPC, policy and index
  notices require individual review; destructive index/table cleanup remains approval-gated.

## Email Template Polish
**Logged:** 30 June 2026  
**Status:** Parked - do when revisiting claim/reset/welcome email flows

**Problem:**  
The Supabase emails for password resets, placeholder claim links, and welcome messages are plain and need a more polished SportStack look.

**To do:**
- Improve the password reset email template.
- Improve the placeholder claim link email template.
- Improve the welcome/invite email template.

## Permissions Screen Redesign Reference

**Logged:** 8 August 2026
**Status:** Parked design direction — no permission or code change approved

Aaron supplied a reference permission screen built around a role list and grouped permission matrix.
The useful SportStack direction is:

- show predefined and custom roles in a left-hand list;
- let authorised administrators create a named custom role with a description;
- group the right-hand permission controls by SportStack screen or feature, including module access
  and action-level rights such as view, create, edit, approve, publish and delete where applicable;
- show the members assigned to each role;
- keep built-in role definitions visibly distinct from custom roles, with safe clone/customise paths;
- retain the Association -> Club -> Division -> Team scope boundary, inheritance and server-side
  enforcement so a friendly permission matrix cannot grant authority above the administrator's scope;
- show inherited, explicitly allowed and explicitly denied states clearly, with confirmation and an
  audit record for meaningful changes.

This is food for thought for a later permissions UX/architecture block. It is not a blocker for the
current actual-role matrix and must not weaken the existing active-mode, hierarchy or RLS controls.
- Keep the wording clear about what action the user needs to take.
- Make the templates visually consistent with SportStack branding.

## Permission, Modules, and Parked Feedback Items
**Logged:** 3 July 2026  
**Updated:** 8 August 2026
**Status:** Existing controls remain active; full Roles & modules review parked by owner

**Owner direction:** Stop the current permission-screen testing and return to it as one dedicated
review. During other work, fix a permission problem immediately when it causes incorrect access or
blocks the workflow being tested; otherwise record it here. Every new feature must include an
explicit access-control decision rather than assuming all signed-in users should receive it.

**Do:**
- Add separate permission concepts for Player MVP Voting submission/result visibility and Umpire Match Voting submission/result visibility, plus committee access and committee president access.
- Allow module enable/disable rules at association, club, division, and team level.
- Keep inheritance clear: parent permissions flow down, but child scopes can be excluded or overridden with warning prompts.
- Decide Club Admin visibility separately for Player MVP Voting submissions/results and Umpire Match Voting submissions/results; do not apply one module's rule to the other or hard-code both to Super Admin and Association Admin only.

**Implemented on Dev:**
- Player MVP Voting and Umpire Match Voting are separate module keys and role descriptions.
- Association, club, division and team overrides inherit from the closest parent.
- Super and Association Admins can manage all four levels in scope; Club Admins can manage their
  club and teams. Every override has a warning and can return to inherited mode.
- Signed-in navigation and direct routes enforce the effective module setting.
- Administrators can create named groups and reusable module-access permission sets, then assign a
  set to a role, group or individual user.
- Reasoned direct user/group/role exceptions override a permission set at the same scope.
- Server functions enforce administrator hierarchy and scope, archive configuration instead of
  hard-deleting it and write every change to the administration audit log.
- Rolled-back Dev tests passed for group deny, direct-user precedence and Club Admin higher-role
  protection. No validation records were retained.
- Mode-aware permission reads, writes and listings are implemented for module visibility and
  management, alongside the existing workflow RLS.

**Still parked in this item:**
- Full Roles & modules information architecture and UX, including the supplied predefined/custom
  role list, grouped permission matrix and assigned-member reference.
- The Club Admin menu did not show Roles & modules although the direct route loaded. The club
  selector test was not completed before the review was parked.
- Action-level submission, result, View/Create/Edit/Delete/Approve/Export permissions beyond the
  existing workflow RLS. Catalogue foundations exist, but the UI hides these entries until every
  affected server workflow enforces them end to end.

**Do not:**
- Add one-off hard-coded permission checks that will need to be unwound during the re-scope.
- Treat module inheritance as only a Super Admin setting.
- Rebuild address structure or pitch rotation as part of small feedback fixes.

## Production Scraper Storage Retention Rollout

**Logged:** 30 July 2026
**Status:** Prepared on `dev` - Production approval still required

**Current position:**
- Production `scrape-backups` contained 1,013 objects using 1,593,506,009 bytes during the read-only
  audit.
- The new exact-fixture refresh, nightly full catch-up, weekly compressed backup and 12-month
  monthly retention routine are prepared on `dev`.
- The revised read-only projection identifies 969 objects using 1,533,329,605 bytes as deletion
  candidates and keeps 44 objects using 60,176,404 bytes.
- No Production schedule or Storage object has been changed by the preparation task.

**Approval gates:**
- Review and approve the exact workflow promotion from `dev` to `main` because it changes
  Production scraper schedules and secret usage paths.
- Run a fresh Production retention dry run after promotion.
- Approve the exact deletion object count, byte count and SHA-256 before the guarded apply.

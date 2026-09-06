# SportStack — Single Improvement and Production Readiness Plan

**Updated:** 6 September 2026

**Active environment:** Development (`dev`)

**Purpose:** This is the only active SportStack priority and sequencing plan.

`docs/current-state.md`, `CODEX_HANDOFF.md`, `notes/known-issues.md`, feedback records and test
artifacts provide evidence. They do not create separate competing work plans.

## Owner priority — Player MVP presentation for Grampians (5 September)

Aaron's immediate outcome is to make the Player MVP tally presentation safely available to the
Grampians team in Production. This overrides the next general form/sorting repair batch, not the
release safety gates. Unrelated improvements stay on the backlog.

**Current release position:** the one-migration lifecycle repair is live in Production at
`a1d23c7`. Its backup, migration reconciliation, database objects, public bundle and separate
verification passed. Aaron's Production builder and preview smoke also behaved as expected, subject
to the defects and enhancements recorded below. No real Player MVP presentation has been published.
The broad Main package remains blocked by historical migration drift and the actual Coordinator-role
browser check is still unavailable.

1. Revalidate the Grampians/Pumas builder, closed-round data, preview and full-screen playback on
   current Dev; test the intended disposable recipient and unrelated-account denial. Keep external
   email disabled and do not publish to normal players during Dev testing.
2. Assess the smallest dependency-complete release using the existing tally release packet.
   Do not cherry-pick only the animation. Identify every required application, database, permission,
   notification, function and scheduler change. If the package includes other app changes, their
   safety/compatibility defects remain release blockers; prioritisation does not waive them.
3. [Complete] Rehearse that exact package against an isolated Production-compatible dependency
   copy, verify data/job impacts and rollback, then freeze the release commit and allow-list.
4. [Complete] Refresh encrypted Production Supabase access and run the read-only pinned pre-flight.
   Production is healthy, only the approved tally migration is pending, and backup tooling is ready;
   no Production change or backup was created.
5. [Complete] Nominate the Production smoke identities. Admin Sportstack will run the builder, with
   Chloe Wilson and Aaron Mullane as recipients; both are active, non-placeholder Pumas members.
6. [Complete] Aaron accepted the unchanged dependency debt for this narrow release; remediate it in
   a separately tested package.
7. [Released; smoke paused] The narrow slice is live at `15223e9` and its release checks passed.
   The first owner smoke exposed 15 overdue Pumas sessions still stored as `OPEN`; the UI calls them
   expired/closed, but the tally builder correctly selects only stored `CLOSED` rows. No real
   presentation has been published.
8. [Released] Additive migration `20260905131718` makes passing the voting deadline use the single
   `CLOSED` state. Production now has zero overdue open sessions, 360 closed sessions, one closure
   job and two deadline triggers. The release changed no notification or email-event count.
9. [Complete] Production is at `a1d23c7`. The verified backup, exact 355-session reconciliation,
   396-row audit result, separate deployed-bundle verification and database adviser check passed.
   The broad Main history, scraper workflow, Edge Functions and account helpers remain excluded.
10. [Blocked] Complete the actual Coordinator permission-bundle browser test when an authenticated
    disposable Coordinator session is available. Other current role results may be reused only
    where their relevant code is unchanged.
11. [Complete through preview] Aaron confirmed past-deadline sessions show only as **Closed**, all
    expected Pumas rounds are present, and the builder preview otherwise behaves as expected. The
    high-priority draft-persistence and identity defects plus the presentation enhancements below
    remain queued. Publishing a real presentation remains a separate owner action.
12. [Stage 1 complete; B1a deployed; B1b rehearsed] The 115 changed migration paths are now mapped: 114 are
     Main-only and one is the Production-only tally baseline. Production history and Main migration
     files share only eight version names, so no historical file is approved for direct apply. Build
     and rehearse new additive B1 foundation/access compatibility bridges. The dormant B1a structure
     migration now passes Production-copy apply, repeat, rollback and Dev no-op checks. The B1b
     security bridge passes exact apply, repeat, runtime, rollback, live Dev rollback-only
     compatibility and security review. Development records the migration and its hosted runtime,
     lint and adviser checks pass; final Dev deployment verification remains. B1c membership
     workflows, B1d application allow-list and hosted rehearsal remain open. The latest six Production
     scraper schedules are green, but the named-final blank-round fix remains Dev-only and the
     workflow remains a separate approval package.

Current evidence: the full Dev cycle now passes for a labelled 9-round Pumas presentation and one
reserved Player. Notification/deep link, unrelated-Voter denial, withdrawal, desktop/tablet/mobile,
controls, keyboard, reduced motion, Axe, console and failed-request checks passed. Four confirmed
Dev defects were fixed and deployed through `5338c0a`. The first narrow tally release at `15223e9`
passed its technical checks, then owner smoke exposed the overdue-OPEN lifecycle defect. The exact
follow-up migration was rehearsed, backed up and released at `a1d23c7`; all 355 overdue sessions are
now closed and no communication count changed during release. No real-player tally presentation
has been published. See the 5 September tally packet and 6 September lifecycle packet.

The broad Main-to-Production delta remains separately blocked: 266 Main-only commits and 438 paths,
including 115 changed migration paths (114 Main-only and one Production-only), 15 Edge Function
files and three workflows. Stage 1 migration/function/workflow mapping is complete, but the B1
compatibility bridge and rehearsal, Coordinator acceptance and scraper workflow decision remain
open; the narrow lifecycle release does not waive those gates.

**Dev-to-Main alignment update:** the reviewed release tools and current evidence were promoted to
Main through source Dev commit `2d7ed63` (promotion base `a5417f2`). Application source, migrations
and Edge Functions now match. Only the Production scraper workflow, its named-finals schedule
helper and two focused tests remain deliberately Dev-only pending separate workflow approval.

## Current position

- Dev feedback contains 88 retained records: 0 OPEN, 53 REVIEWED and 35 CLOSED.
- The reviewed feedback queue is 5 P0, 16 P1, 18 P2, 5 P3 and 9 parked items.
- The whole-site persistence review has 18 findings: 1 High, 13 Medium and 4 Low.
- The form audit found 42 date controls across 16 files, with 36 px, 40 px and 44 px variants.
- The latest recorded automated code gates pass, but complete actual-role, responsive and workflow
  acceptance evidence is still missing.
- Dev and Main may be updated through the normal reviewed path. Production remains separately
  approval-gated.

### 5 September readiness work package 1 evidence

- Source and regression coverage now block unassigned and pending normal accounts from protected
  direct routes while retaining Dashboard/Profile and discipline-only entry. Actual-role browser
  acceptance remains required before the two access items can close.
- Primary-team request, approval, decline, cancellation and player confirmation now use scoped
  database functions. Direct browser status writes are blocked; scoped admins can see only requests
  they may action; the final membership change is one transaction. Dev rollback, forged-write,
  scoped-admin visibility and permission checks pass. Browser acceptance remains required before
  the workflow item can close.
- The unmatched Player MVP candidate rule now has regression coverage for imported teammates with
  no linked profile. The shout-out visibility audience remains an owner decision and was not
  changed by assumption.
- Line-up, Formation Builder and Template Builder drafts now use expiring account/owner/record-
  scoped browser storage. Stale formation drafts safely return selected players to the bench;
  failed loads cannot overwrite a valid draft or carry one team's state into another team.
- Shared Inputs and Selects now use the 44 px ordinary-control contract. Safety filters use 40 px,
  and the first confirmed narrow-phone date/time pairs now stack in Fixtures, Committee,
  Coordination and Discipline. The full 42-control visual audit is still open.
- The live Dev feedback counts were rechecked: 35 CLOSED and 53 REVIEWED. Sorting across every
  meaningful table column and the remainder of the persistence register are still open work.

### 5 September readiness work package 2 evidence

- Associations, Competitions, Clubs, Divisions, Teams and Venues now share accessible two-way
  sorting on every meaningful data column. Sorting uses the displayed organisation names and typed
  numeric values before pagination; Logo and Actions remain deliberate exemptions.
- Focused sorting tests, the 42-file/164-test Vitest suite, locked development-plan lint,
  TypeScript and Production build pass. Replacing obsolete competition casts reduced the full lint
  baseline from 349 errors/77 warnings to 343 errors/77 warnings. Authenticated deployed verification is still required,
  so the site-wide sorting contract remains open while Requests, Users, RevSports Mappings,
  RevSports Unmatched and Hockey Trace are unfinished.

### 5 September readiness work package 3 evidence

- Fixture Management no longer persists destructive confirmation targets. Add, Edit and Details
  identity now uses an expiring session envelope scoped by account, role mode and the active
  organisation, club, division and team. Unsaved Add/Edit field values are not covered.
- Signed-in Umpire Match ballot drafts now use native per-tab session storage scoped by account.
  Actual-helper Chromium tests passed copied-tab edit/clear/refresh isolation. Successful loads
  revalidate the hierarchy, fixture teams and linked players; failed loads retain work. The legacy
  account-only draft is discarded. Closing the tab is not durable storage; a leave warning is shown.
- Chat drafts now preserve reply identity, the Important flag and selected mention IDs as well as
  text. Failed validation retains them; confirmed stale IDs are removed. Scoped channel/message
  responses cannot replace another scope's data, and cancelling a reply preserves typed text.
- A delayed successful send clears only a matching persisted draft; newer drafts survive, including
  another tab's changes. The visible reset and blank autosave cannot bypass that safeguard.
- Final code checks pass: 45 Vitest files/180 tests, 153 Python unittests, five Umpire source checks,
  locked lint, TypeScript and Production-mode build. Independent source review passes; full lint
  remains at 343 errors/77 warnings. Seven isolated actual-Chat browser checks pass, including the
  delayed-send regression. Source `464d809` passed Dev Quality `33928475268`, Vercel and exact
  alias/commit-preview bundle checks. Actual-role acceptance remains required before these
  persistence findings can close.
- The actual shared controls measured 44 px without overflow at 390x844, 820x1180 and 1440x900.
  Whole-route overrides, all 42 date controls, Safari and 200% zoom remain unproven.

## Working rules

1. Fix confirmed access, privacy and data-integrity defects before visual improvements.
2. Repair shared root causes across every affected screen instead of applying one-page patches.
3. Every repair must cover the original reproduction and adjacent regression paths.
4. A feedback record stays **REVIEWED** until the deployed repair or owner acceptance is recorded.
5. Use **OPEN** only for new, untriaged feedback. Use **CLOSED** only for a verified fix, explicit
   duplicate, superseded item or deliberate owner-approved decline.
6. No destructive database cleanup or Production change occurs without Aaron's separate approval.

## In progress now

### 1. P0 access, workflow and privacy checks

Complete these first because incorrect access or hidden data can affect every later test.

- [ ] `ACCESS-ONBOARD-001` — prove that a brand-new unassigned user receives only the welcome and
  team-application workflow, with no inherited team context or inaccessible navigation.
- [ ] `ACCESS-PENDING-001` — prove that a pending team application grants no team data, permissions
  or team navigation before approval.
- [ ] `REQUESTS-WORKFLOW-001` — reproduce and repair the primary-team request that disappears after
  admin approval and player confirmation without applying the change.
- [ ] `PLAYER-MVP-PRIVACY-001` — prove exactly who can see Player MVP shout-outs and prevent
  unintended individual disclosure.
- [ ] `PLAYER-MVP-UNMATCHED-001` — keep required unmatched scraped participants visible without
  creating false registered identities.
- [ ] `PLAYER-MVP-DISPLAY-IDENTITY-001` — keep RevSports IDs for matching, but display the linked
  SportStack first and last name on Player MVP ballots and presentation data. Do not use a stale
  RevSports initial, player number or display name when a linked SportStack identity exists.

Exit gate: each flow passes with a disposable actual-role Dev account, refresh and direct-link
checks, and an audit trail where data changes.

The shared controlled-browser sign-in blocker was cleared on 5 September: Aaron signed into the
headed test session and protected admin/tally routes load. These items remain unchecked until the
appropriate disposable actual roles complete their flows; Super Admin is not substitute evidence.

### 2. Common form, table and persistence contract

Apply one consistent rule across the whole application.

- [ ] `FORM-SIZE-001` — standardise ordinary Input, Select and button controls at 44 px; filter-bar
  controls at 40 px; and deliberately compact inline/table controls at 32–36 px.
- [ ] Make every date, time and date-time field inherit its surrounding control size, add safe
  narrow-grid behaviour and remove page-specific height overrides.
- [ ] Stack paired date/time controls on narrow phones and verify Admin Users, Profile, Safety Audit,
  Fixtures, Committee, Coordination, Discipline, Expense Hub, Analytics and Coaching.
- [ ] Apply two-way ascending/descending sorting to every meaningful table column. Mark action-only
  columns explicitly non-sortable and retain the current direction indicator.
- [ ] Apply one persistence contract:
  - saved data survives refresh and sign-in;
  - meaningful unsaved work is protected from accidental navigation, focus rechecks and closure;
  - searches, filters, tabs, pagination and sorting use URL or scoped browser state where useful;
  - browser state is scoped by account, organisation, team and record so drafts cannot collide;
  - successful submit, explicit reset and deliberate discard clear the correct state.
- [ ] Repair the confirmed persistence findings covering line-up, Profile, Roles & Permissions,
  Formation Library, Fixtures, Safety Hub, Player MVP tally setup/playback, Umpire Match ballot,
  Chat drafts and shared browser preferences.
- [ ] `PLAYER-MVP-TALLY-PERSISTENCE-001` — preserve the tally builder's current step and unsaved
  selections when its tab loses focus or another tab is opened. Restore the same scoped draft on
  return, and clear it only after publish, explicit reset or deliberate discard.
- [ ] Repair mobile Fixture Management overflow and the Association → Club → Division → Team
  cascade tap/overflow defects.

Exit gate: the route, form and table registers show a result for every protected screen at desktop,
tablet and mobile sizes, with no unexplained reset or horizontal page overflow.

### 3. P1 product and data repairs

- [ ] `DASH-DATA-001`, `DASH-CASCADE-001` and `DASH-KPI-001` — correct entity counts, team KPIs and
  dashboard changes after cascade navigation.
- [ ] `REQUESTS-COUNT-001` — make the pending-request badge agree with the visible actionable list.
- [ ] `PROFILE-ONBOARDING-001` and `PROFILE-PHOTO-001` — make incomplete details obvious, route the
  reminder through notifications and reproduce the photo-change failure.
- [ ] `ROSTER-MODEL-001` — verify Primary, Secondary and Fill-in behaviour, statistics, roster search,
  line-up inclusion and time-limited Fill-in access as one workflow.
- [ ] `PLAYER-MVP-FILLIN-IDENTITY-001` — investigate why **Annabelle R** appears in Fill-ins when the
  expected person may be Annabelle Heal. Trace the RevSports correction through scrape history,
  quality scrape, mapping and import before changing any identity or historical vote data.
- [ ] `COMMITTEE-CLOSURE-001` — add strong confirmation and preservation behaviour before closing a
  committee.
- [ ] Remove the locked Dev-only `dev-auth-admin-smoke` helper when an account with Function-delete
  permission is available.

Exit gate: the original feedback entries have deployed or owner acceptance evidence and can move
from REVIEWED to CLOSED.

## Next

### 4. Complete actual-role and workflow acceptance

- [ ] Test separate real Super Admin, Association Admin, Club Admin, Team Manager, Coach, Player,
  Umpire, Voter and Coordinator accounts. Viewing-as is supporting evidence only.
- [ ] Complete tablet and mobile integrated testing with a controllable authenticated viewport.
- [ ] Retest multi-club Team Manager switching through refresh, logout/login and incognito.
- [ ] Complete Team Chat history, pagination, drafts, broadcast-author exclusion and notification
  deep-link checks.
- [ ] Reproduce Chat's partial-send failure: the message can succeed while a separate mention
  insert fails silently. Source review confirmed missing error handling; test the delivery impact
  with disposable data before deciding recovery/retry behaviour. This is not closed by draft repair.
- [ ] Complete one disposable Coordination workflow: need, offer, acceptance, confirmation,
  replacement and notification.
- [ ] Complete one disposable Committee workflow: committee, subcommittee, private upload, meeting,
  minutes, action, poll and Safety Hub link.
- [ ] Complete one disposable Safety Hub record through create, review, linked records and audit.
- [ ] Complete the guided Incident and Discipline acceptance flow using simulated data only.
- [ ] Finish the reserved Dev Umpire account reset and an actual Umpire Match Voting submission.
- [x] Complete a Player MVP ballot, tally and recipient-access cycle with external email disabled.
- [ ] Smoke-test Expense Hub using de-identified files only.

Exit gate: the acceptance report separates Passed, Failed, Blocked and Owner decision items, and no
Blocker or High defect remains for staging.

### 5. P2 and P3 consistency improvements

- [ ] `SAFETY-UI-001` — improve selected tabs, terminology weight, linked-table headings and wrapping.
- [ ] `REVSPORTS-UI-001` — use the standard cascade/filter layout and stop Refresh overflow.
- [ ] `CHAT-COMPOSER-001` and `ROSTER-READABILITY-001` — improve input affordance and small-text
  readability.
- [ ] `COACHING-PROFILE-001` — link player position preferences and complete match history.
- [ ] `PLAYER-MVP-ZERO-VOTE-ROUND-001` — let an administrator record a short reason when a closed
  round received no ballots. Keep that round in the tally presentation as a caption-only step, then
  continue to the next scoring round without changing rankings or inventing votes.
- [ ] `PLAYER-MVP-FINALS-ROUND-LABEL-001` — investigate why the semi-final and grand final scrape
  and display without round numbers. Preserve their named stage and correct chronological order;
  do not invent numeric rounds until the RevSports source and importer behaviour are confirmed.
- [ ] `PLAYER-MVP-TALLY-CONTROLS-001` — add a small, clearly labelled discard control to **Continue
  draft**, with confirmation, and add **Skip round** alongside **Skip to end**. Skip round must finish
  only the current round and show its closing caption before continuing.
- [ ] `PLAYER-MVP-MANUAL-FILLIN-001` — add an **Additional person** option at the bottom of Fill-ins so
  an administrator can enter a name that is not in the imported list. Keep manually entered people
  visibly distinct and do not create or imply a linked SportStack account.
- [ ] `PLAYER-MVP-SEASON-SUMMARY-001` — on the Appearance step, provide an on-demand season list of
  every team player with games played and total Player MVP votes. Use it to inform the Top 5, 10, 20
  or all display choice, including whether zero-vote players should be omitted.
- [ ] `PLAYER-MVP-REVEAL-CARD-001` — remove the redundant point label beneath a revealed player's
  name. Colour the vote-value marker using 3 = gold, 2 = silver and 1 = bronze.
- [ ] `PLAYER-MVP-CAPTION-001` — replace the repeated generic round caption with varied,
  data-grounded captions. Captions may use deterministic rules or reviewed AI output, but may refer
  only to players inside the chosen displayed Top N and must not invent performance claims.
- [ ] `PLAYER-MVP-MY-VOTES-001` — make the player's last presentation screen offer **Show my own
  votes**, revealing their total and each included round in which they received votes without
  exposing another player's private ballot choices.
- [ ] `PLAYER-MVP-FINAL-WINNER-001` — strengthen the final result with a celebratory winner reveal
  showing the winner's name and total, then the runner-up beneath. Use gold for first and silver for
  second; do not include third place in this final panel.
- [ ] `MEMBERSHIP-SELF-SERVICE-001` — define safe secondary-team removal with audit and confirmation.
- [ ] `TEAM-ORDERING-001` — apply one documented ordering rule across every team list.
- [ ] `EXPENSE-UX-001` — add upload progress and reusable partial/exact exclusions.
- [ ] `DIVISION-MATCH-STRUCTURE-001` — add optional match segments, breaks and calculated duration.
- [ ] `COMMITTEE-HIERARCHY-001` — add position hierarchy and appointment history.
- [ ] Clarify the ambiguous Users feedback entry `USERS-UX-CLARIFY-001` with Aaron or a screenshot.

### 6. Database and data-quality cleanup

- [ ] Review Supabase security and performance advisers individually; do not bulk-revoke working
  functions or drop indexes based only on adviser counts.
- [ ] Prepare an exact keep/remove dry run for 201 historical duplicate membership groups and 44
  people with multiple Primary memberships. Any apply is a separately approved destructive task.
- [ ] Refresh RevSports readiness reports, resolve the Wimmera season ambiguity and confirm
  authenticated player-stat collection requirements.
- [ ] Re-run the line-up promotion dry run and obtain separate approval before inserting anything.
- [ ] Reconcile live Dev migrations with repository migrations and classify legacy/backup objects.
- [ ] Confirm the purpose of the separate `umpire_vote_*` rating family before renaming or reuse.
- [ ] Obtain Hockey Ballarat decisions for Incident and Discipline rules still marked
  `REVIEW_REQUIRED`, including evidence retention and local authority rules.

Exit gate: each cleanup has a current read-only report, exact scope, rollback path and separate
approval where records could be changed or removed.

### 7. Repository and documentation cleanup

- [ ] Reduce the legacy lint baseline in small reviewed folders without hiding existing failures.
- [ ] Review the large main JavaScript chunk, SheetJS loading and stale Browserslist data.
- [ ] Reduce `docs/current-state.md` and `CODEX_HANDOFF.md` to current summaries with archive links.
- [ ] Reconcile stale entries in `notes/known-issues.md`; keep it as evidence, not another plan.
- [ ] Review the root `test_*.js` investigation scripts and the superseded local
  `chore/domain-structure` branch without merging stale work.
- [ ] Decide whether GitHub Projects will be used; do not maintain an unused duplicate board.
- [ ] Keep the generated Big Brain repository mirror read-only and run sync plus validation after
  committed documentation changes.

## Release

### 8. Dev → Main staging

- [ ] Run focused tests, full Vitest, TypeScript, Production build and lint-baseline comparison.
- [ ] Review every Dev → Main commit, migration, Edge Function and workflow change.
- [ ] Fast-forward Main only after Dev checks pass and confirm Main uses the Dev database.
- [ ] Run signed-out and signed-in Main smoke tests, including the high-risk repaired workflows.

### 9. Main → Production approval packet

- [ ] Freeze the exact Main commit and reconcile all application, migration, Edge Function, job and
  workflow differences against live Production.
- [ ] Prove backup, migration order, deployment order, rollback points and post-release smoke steps.
- [ ] Complete the existing read-only signed-in Production smoke test.
- [ ] Present the exact frozen package, unresolved risks and accepted debt to Aaron.
- [ ] Change `prod` or any Production system only after Aaron explicitly approves that exact package.
- [ ] Observe the released application and scheduled jobs through the rollback window.

Exit gate: Production matches the approved package and passes signed-out, signed-in, database,
function, workflow and scheduled-job verification.

## Parked for later

These are retained and reviewed, but they do not interrupt the current readiness sequence.

- Full Roles and modules redesign and target access-model implementation.
- Formation Library deletion, icon, position-library and asset-management redesign.
- Personal, association, club and team dashboard redesign beyond confirmed data defects.
- Environment/version navigation redesign.
- Coach Narrative AI summary, speech capture and player-observation workflow.
- Structured address lookup and broad Profile redesign.
- Domain, DNS, Turnstile and `hb.sportstackapp.com.au` rollout.
- Broad multi-sport, commercial and multi-tenant work.

## Definition of complete

SportStack is ready for Production approval only when:

- every P0 and P1 defect is fixed and verified;
- every remaining P2/P3 item is fixed or explicitly deferred by Aaron with impact recorded;
- all meaningful columns follow the sorting contract;
- all forms follow the size, persistence and sensitive-data contracts;
- actual-role desktop/mobile workflows have current evidence;
- Dev and Main match their recorded commits and required checks pass;
- the exact Production package, backup and rollback process is proven; and
- Aaron explicitly approves that frozen package.

# SportStack Consolidated Open Items Plan

Status: **active single plan**

Audited: **21 August 2026**

Audit-start baseline: **`dev` and `main` at `d79067b`; `prod` at `682b8ea`**

This is the one active implementation and cleanup plan for SportStack. Older development plans,
handoffs, session notes and module specifications remain useful evidence, but they do not create a
separate priority unless the item also appears here.

## Plain-English position

SportStack does not mainly need another large build. Most major work is already implemented on Dev
and has also reached Main staging. The main job now is to verify what is there, fix confirmed
failures, clean up known data and documentation debt, and then make a deliberate Production release
decision.

Current verified position:

- the working tree is clean;
- `dev` and `main` were aligned at the audit start; the reviewed catch-up fixes now leave Dev ahead
  for a later staging decision, while `prod` remains separately behind Main;
- GitHub has no open issues or pull requests;
- the latest Dev Quality run and the latest Dev and Production scraper workflows passed;
- all declared npm dependencies are installed and the reviewed `nanoid` resolution removes the
  20 August high-severity transitive advisory;
- the live Dev database still reports 201 duplicate membership groups, 44 people with multiple
  active Primary memberships and 490 preserved snapshot rows;
- the live Dev database adviser currently reports 115 security warnings and 181 performance
  warnings. These are a review queue, not proof that every item is a defect;
- the GitHub Projects board, if one is in use, is **UNKNOWN — needs confirmation** because the
  current GitHub token does not have `read:project` access;
- the Hermes SportStack focus and general Open Items notes were dated 30 July; this audit refreshed
  their priority pointer without duplicating the changing implementation detail.

### 21 August Dev catch-up result

- Dev acceptance and repair commits `a6f2354` through `08b30f9` are deployed on
  `https://dev.sportstackapp.com.au`; Main and Production were not changed.
- Player Explorer owner feedback, its Team Manager timeout, contextual scoped-user roles, scope
  stability, Fixture pop-up persistence and bye labels now pass the affected Dev browser checks.
- Umpire Match Voting now has the association player picker, two-sheet Excel export, award-ready
  division leaderboards and sortable submission headers requested during owner testing.
- Cross-module read-only smokes passed for Communications, Coordination, Committee Management,
  Safety Hub, Expense Hub and Incident and Discipline. No message, committee, risk, expense or
  discipline record was created for those smokes.
- A stale dashboard query against the non-existent `communication_channels.channel_type` column
  was corrected to use live `scope_type`. A fresh club-dashboard load produced no later occurrence
  of that error in the Dev PostgreSQL log.
- Separate credential-based role sessions and the final reserved Umpire Reset action are
  **Blocked** by the browser security policy. Viewing-as and rolled-back database evidence are
  recorded but are not described as equivalent to an actual-role browser pass.
- Tablet/mobile integrated testing remains **Blocked** because the authenticated in-app browser has
  a fixed viewport. Desktop and the earlier focused responsive checks remain valid.

## Focus lock

Until the first three phases below are closed:

- do not start another major module;
- fix urgent security, data-integrity or production-availability problems immediately;
- record non-urgent ideas in **Parked for later** instead of interrupting acceptance work;
- use `docs/owner-test-matrix.md` as test detail, but use this file for priority and status.

## In progress now

### Phase 1 — Establish one reliable baseline

Owner: Codex, with Aaron only for judgement or access that cannot be safely automated.

- [x] Audit the active repository, branches, GitHub issues and pull requests, workflows, current
  notes, historical plans, dependency installation, Hermes project notes and live Dev database.
- [x] Make this file the single active plan.
- [x] Update the stale Hermes SportStack focus and Open Items notes from the repository
  plan. Keep workstation tasks separate from SportStack application work.
- [x] Correct the repository's curated Vault paths after the approved Hermes folder restructure.
- [ ] Decide whether a GitHub Projects board is actually used. If it is, Aaron can grant the active
  `SportStackApp` GitHub token the `read:project` scope so its items can be reconciled here.
- [ ] Review the seven tracked root `test_*.js` investigation scripts. Move still-useful checks into
  the normal test folders and propose removal of obsolete scripts as a separate, reviewed cleanup.
- [ ] Review the superseded local `chore/domain-structure` branch. Do not merge or cherry-pick commit
  `3a7d6cc`. Delete the branch only after Aaron confirms it is no longer needed.

Exit condition: every new task starts from this plan and no older document competes as the current
priority list.

### Phase 2 — Complete acceptance testing in small batches

Run these on Development first. Record **Pass**, **Fail**, **Blocked** or **Owner decision** in
`docs/owner-test-matrix.md`. Do not mark an owner test passed without observed evidence.

#### Batch A — access, scope and everyday work

- [ ] **BLOCKED — browser credential policy:** retest Super Admin, Association Admin, Club Admin,
  Team Manager, Coach, Player, Umpire and Coordinator using separate Dev accounts rather than only
  **Viewing as**. Do not substitute the completed Viewing-as and database checks for this item.
- [x] Complete Player Explorer acceptance after the 19 August repair:
  - [x] Super Admin menu access, page loading, conditions, search, result sorting and CSV export
    passed owner testing on 20 August 2026.
  - [x] Saving a filter and retaining it after a browser refresh passed owner testing on
    20 August 2026.
  - [x] Loading a saved filter restored its original filters and results in owner testing on
    20 August 2026.
  - [x] Enabling a daily recurring schedule, showing its next run and returning it to **Manual
    only** passed Super Admin owner testing on 20 August 2026.
  - [x] A separate Association Admin Dev account could open Player Explorer, saw the manual scoped
    search notice and did not see saved or recurring controls in owner testing on 20 August 2026.
  - [x] A separate Club Admin Dev account passed the same Player Explorer access and saved-search
    restriction check in owner testing on 20 August 2026.
  - [x] A separate Team Manager Dev account passed the same Player Explorer access and saved-search
    restriction check in owner testing on 20 August 2026.
  - [x] A separate Coach Dev account passed the same Player Explorer access and saved-search
    restriction check in owner testing on 20 August 2026.
  - [x] **PASS — Team Manager timeout repaired:** the catalogue now queries only visible appearance
    source IDs for scoped roles. A deployed Team Manager search returned 30 players, two pages and
    the complete filtered totals without a timeout on 21 August 2026.
- [ ] **PARKED — owner deferred 20 August 2026:** retest multi-club Team Manager switching with a
  real multi-club Dev account.
- [x] Scoped user lists now show only roles applicable to the selected organisation or team. A
  deployed Club Admin preview excluded unrelated Grampians/Pumas roles while retaining authorised
  Lucas HC context on 21 August 2026.
- [x] Scope cascade reset integrity passed owner recording review on 20 August 2026: changing or
  clearing a parent Club removed the previous Division and Team selections.
- [x] Scope switching is visually stable. It keeps the selected Association, Club, Division or
  Team label visible while the next scope loads, prevents overlapping changes and settles on the
  latest selection. Fresh DOM checks confirmed the loaded dashboard after rapid scope changes;
  the browser wrapper's empty large-page snapshot is a test-tool limitation, not an application
  blank screen.
- [x] Fixtures Management showed the correct selected Club and Team records in owner testing on
  20 August 2026.
- [x] Fixture view, add and edit pop-ups remain recoverable when the browser loses focus or the user
  switches to another window and returns. The deployed test restored Match Details on page focus;
  explicit Close removed it.
- [x] Fixtures Management now shows **Bye** in the Score column for bye rows instead of `-`.
- [x] Fixture pop-up restoration and bye presentation passed the affected deployed checks. The
  previously accepted availability-to-line-up workflow was not changed.
- [x] A Team Manager could open a scheduled Blaze fixture and see their own availability controls
  plus the Team Availability list in owner testing on 20 August 2026.
- [ ] Retest Team Chat history, pagination and drafts, plus Club and Association broadcast author
  exclusion and notification deep links.
- [ ] **BLOCKED — fixed authenticated viewport:** complete tablet and mobile integrated checks.
  Desktop and focused responsive checks already have useful evidence.

#### Batch B — voting, coordination and governance

- [x] **PASS — Dev permission repaired:** Team Manager Player MVP session loading originally failed
  with `permission denied for function player_mvp_session_allowed_for_current_session`. After
  additive Dev migration `20260820182455_restore_private_helper_permissions.sql`, owner testing on
  20 August 2026 confirmed the page loads without the error at the correct Hockey Ballarat → EGC →
  Division 2 Open → Blue scope. Player MVP Voting and email notifications were both visibly off.
- [x] Enabling Player MVP Voting for Blue worked in owner testing. The test exposed that the separate
  email setting inherited the old on-by-default value. Dev migration
  `20260820203326_default_player_mvp_notifications_off.sql` now defaults new teams to off and moved
  all 95 inherited Dev values to off while preserving deliberate audited opt-ins. Player MVP Voting
  remains enabled independently.
- [x] Refresh persistence passed owner testing on 20 August 2026: Blue retained **Player MVP Voting
  is on** while **Email notifications are off**.
- [x] An email-disabled Player MVP round opened successfully for Blue, appeared as **Open** with
  0/14 completed, and kept reminder/resend email actions disabled. Aaron accepted the remaining
  ballot and result behaviour without extending this disposable test on 20 August 2026.
- [x] Umpire Match Voting administration data and submission correction passed owner testing on
  20 August 2026.
- [x] Umpire Match Ballot default suggestions showed only linked fixture players in owner testing
  on 20 August 2026.
- [x] Keep linked fixture players as the default type-ahead suggestions, but make the magnifying-
  glass action open a searchable association-wide player list. Scope the expanded search to the
  selected fixture/voting record's association, show useful team and division context, and never
  expose players from another association. Selecting an association player should populate the
  existing vote line normally; retain manual unlisted entry for genuine exceptions.
- [x] Replace the single combined Umpire Match Voting CSV with one Excel workbook containing
  separate **Seniors** and **Juniors** sheets. Seniors use separate 3-point, 2-point and 1-point
  columns. Juniors use four separate scheme columns for the two 2-point and two 1-point choices.
  Read the existing `vote_scheme_key` and `scheme_line_key` fields; for legacy junior rows without
  line keys, use clearly labelled A/B vote slots rather than guessing gender. Reuse the existing
  `xlsx` dependency; no database migration is expected.
- [x] Make the Umpire Match Results leaderboard award-ready by division. With no division selected,
  show the combined association top 10. With one or more divisions selected, show a separate full
  leaderboard for each division and group each player by division as well as identity, so a player
  who competes in two divisions can appear in both lists with only that division's votes.
- [x] Make Umpire Match Submissions headers clickable and toggle ascending/descending sorting for
  Round, Division, Fixture, Submitted for, Submitted by, Source, Votes, Status and Submitted. Show
  the current sort direction. Keep the displayed round label, but sort Round chronologically using
  the linked fixture date; for legacy unlinked rows, fall back to numeric round then submitted date.
- [x] A separate Association Admin Dev account opened Coordination and correctly showed only
  **My work** because that account was not assigned a Coordinator responsibility.
- [ ] **BLOCKED — final browser action:** creating the reserved Dev Umpire account correctly reported
  that it already existed, while Reset failed against the newer Association-only Umpire role rule.
  Dev migration `20260820213845_fix_dev_umpire_account_scope.sql` now saves one Association-only
  Umpire role plus the selected active Primary team membership. Dry-run and live transactional SQL
  tests pass. Browser security policy prevents the final Reset/password action without action-time
  owner confirmation.
- [ ] Test one complete Coordination workflow: staffing need, offer, acceptance, coordinator
  confirmation, replacement and notification.
- [ ] Test Committee creation, one subcommittee, private upload, meeting, minutes, action, poll and
  Safety Hub link using disposable Dev records.
- [ ] Test one disposable Safety Hub record through create, review, link and audit history.
- [x] Smoke-test Expense Hub with de-identified files only. The deployed read-only page loaded with
  no error and no file was uploaded. Provider privacy, region and billing
  decisions remain a later Production gate.

#### Batch C — Incident and Discipline

- [ ] Run the guided Dev owner acceptance flow one action at a time.
- [ ] Obtain Hockey Ballarat decisions for every rule-pack item still labelled `REVIEW_REQUIRED`,
  including local authority mappings, business-day handling and other documented local
  interpretations.
- [ ] Confirm whether private binary evidence uploads are required for the accepted release scope.
- [ ] Keep every exercise clearly simulated; do not create real findings, sanctions or notices.

Exit condition: a concise acceptance report lists passed, failed, blocked and owner-decision items.

### Phase 3 — Repair only confirmed failures

- [x] **HIGH PRIORITY — repaired the systemic Dev private-helper permission regression.** Live Dev
  inspection on 20 August 2026 confirmed that the broad private-schema revoke in
  `20260817100200_create_coordination_module.sql` removed authenticated execution from helpers used
  by RLS and session checks. The later Player Explorer repair restored only its five helpers.
  PostgreSQL/API logs also showed active permission failures for Communications, fixture management
  and Discipline helpers, with the same grant loss affecting Risk Governance, Umpire Match Voting
  and MVP audit helpers.
  - [x] Inventoried the private helpers referenced by authenticated RLS policies, signed-in RPC
    wrappers and the original explicit grant migrations.
  - [x] Applied additive Dev migration
    `20260820182455_restore_private_helper_permissions.sql`, granting `EXECUTE` only to
    `authenticated` for the 36 required helpers. No table, policy, function body or data row changed.
  - [x] Kept anonymous execution denied for every private function and removed the inherited
    anonymous grants from six later Coordination helpers. Only the Coordination helper directly
    required by authenticated RLS remains browser-executable.
  - [x] The rollback test, reusable permission regression test and real active Team Manager session
    check passed. Affected RLS reads ran without permission errors and returned only authorised
    rows. Owner browser retests remain required across the affected modules.
- [x] Resolve the `nanoid` security advisory through a reviewed dependency/lockfile update, then
  rerun `npm audit --omit=dev`, TypeScript and the production build. Do not use an unreviewed broad
  `npm audit fix`.
- [x] Complete the confirmed Player Explorer feedback package:
  - [x] Add a totals row below the results for Games, Goals, Green, Yellow and Red. Totals use
    all filtered results, not only the current page.
  - [x] Replace the generic **Use example** action with **Save filter** beside the filter controls.
  - [x] Retain **Use 7 then 1 example** as the built-in sequence preset.
  - [x] Preserve the active filter setup and search results when the user navigates away from
    Player Explorer and returns. Keep that working state until the user clears it or signs out.
  - [x] Add a clear **Delete saved filter** action with confirmation. Remove the deleted filter
    from the dropdown and clear its `savedSearch` address parameter if it was active.
- [x] Repair the confirmed top-right Admin menu overflow. Limit it to the available screen height
  and let the menu scroll internally so its bottom items remain reachable without shrinking text.
- [x] Group failures from Phase 2 by root cause so one repair can cover all affected screens.
- [x] Fix confirmed access-control and data-integrity failures before visual polish.
- [x] Run focused lint, `npm run lint:dev-plan`, `npx tsc --noEmit`, `npm run build`, relevant
  Vitest/Python/Supabase checks and the full lint baseline comparison for each repair package. Final
  results: 87 Vitest tests, 153 Python tests, focused plan lint, TypeScript, build and zero-
  vulnerability npm audit passed; full lint remained exactly 359 errors and 78 warnings.
- [x] Re-run the affected owner tests and the short cross-module read-only smoke set on Dev.
- [ ] Keep Dev and Main aligned only with reviewed, tested commits. Production remains separately
  approval-gated.

Exit condition: no known blocker remains for the accepted staging scope.

## Next cleanup work

### Phase 4 — Database and data-quality cleanup

These items must be handled separately so a broad cleanup does not damage valid data.

1. **Supabase adviser triage**
   - Classify the three anonymous `SECURITY DEFINER` Player MVP helper warnings first.
   - Review the 111 signed-in `SECURITY DEFINER` warnings against each function's internal
     authorisation checks; do not revoke working application entrypoints in bulk.
   - Decide whether Dev Auth leaked-password protection should be enabled.
   - Review 181 performance warnings by real query impact. Do not drop indexes merely because the
     new module has not accumulated usage yet.
   - Use the current Supabase database-linter guidance during review:
     `https://supabase.com/docs/guides/database/database-linter`.

2. **Historical team memberships**
   - Generate an exact per-person keep/remove dry run for the 201 duplicate groups and 44
     multiple-Primary people.
   - Confirm the proposed retained row for every person and team.
   - Take a fresh backup and recheck counts immediately before any apply.
   - Deleting or changing historical membership rows requires Aaron's separate approval.

3. **RevSports and fixture mapping**
   - Refresh the readiness reports; the committed June reports are historical snapshots.
   - Resolve the documented Wimmera season ambiguity before proposing any fixture foreign-key
     backfill.
   - Confirm authenticated Wimmera player-stat scraping requirements.
   - Re-run the line-up promotion dry run. Do not apply the proposed line-up inserts without a
     separately reviewed count and approval.

4. **Migration and legacy-object review**
   - Reconcile live Dev migration names with repository source migrations where timestamps differ.
   - Review old backup tables, RLS-without-policy tables and the separate `umpire_vote_*` rating
     family. Mark intended private/archive objects clearly before proposing any removal.
   - Keep `supabase/pending-migrations/lock_down_mvp_voting_access.sql` parked until its pilot and
     access review are accepted.

Exit condition: each cleanup has a read-only report, exact scope, rollback path and separate apply
approval where data could be changed or removed.

### Phase 5 — Documentation and repository tidy-up

- [ ] Plan the known lint baseline cleanup in small folders; the current baseline is 359 errors and
  78 warnings and is not caused by this documentation audit.
- [ ] Review the build's 3.45 MB main JavaScript chunk, the ineffective mixed static/dynamic SheetJS
  import and the stale Browserslist data as a separate performance/dependency package.
- [ ] Reduce `docs/current-state.md` to a genuinely current summary and move superseded dated detail
  to an archive without losing evidence.
- [ ] Reduce `CODEX_HANDOFF.md` to the latest handoff plus links to archived implementation history.
- [ ] Reconcile outdated statuses in `notes/known-issues.md` and close items already owner-confirmed.
- [ ] Archive old session handovers after confirming they add no unique active requirement.
- [ ] Refresh the Hermes SportStack notes after the canonical repository cleanup is committed.
- [ ] Keep the generated Hermes repository mirror read-only and verify the sync check.

Exit condition: this plan, the current-state summary, the test matrix and the known-issues register
each have one clear purpose and no conflicting current status.

## Release decision after cleanup

### Phase 6 — Staging and Production gates

- [ ] Smoke-test the aligned Main staging build after the accepted Dev batches.
- [ ] Complete the existing signed-in Production smoke test as a read-only operational check.
- [ ] Recheck current branch divergence, Vercel deployment state, Production migration difference,
  Edge Functions, scheduled jobs, backups and rollback instructions.
- [ ] Present the exact `main` to `prod` release package and risk report to Aaron.
- [ ] Promote to `prod` only after Aaron gives explicit approval for that exact package.
- [ ] Run the post-release signed-in smoke test and monitoring checks.

The domain rollout, `hb.sportstackapp.com.au`, Supabase Auth redirects, Turnstile and DNS remain a
separate approval-gated release after the normal application release is stable.

## Parked for later

These are valid ideas but are not current blockers:

- full Roles and modules UX redesign and action-level permission matrix;
- advanced whole-site focus/persistence coverage;
- email template and broader visual polish;
- structured profile addresses;
- mobile formation/pitch rotation improvements;
- push notification wiring;
- Coordination open claiming and a broader Events product;
- Hockey Trace beyond its current experimental disabled state;
- broader multi-sport or commercial/multi-tenant work;
- new domain redirects and marketing addresses;
- new major modules not already accepted into this plan.

## Superseded inputs

The following remain evidence or detailed specifications, but their status text does not override
this plan:

- `docs/development-plan.md` — the completed 1 August implementation order;
- `docs/owner-test-matrix.md` — detailed acceptance evidence and test steps;
- `notes/known-issues.md` — defect and parked-item evidence;
- `notes/project-consolidation-notes.md` — April idea list, much of it now implemented or obsolete;
- `CODEX_HANDOFF.md` and older session notes — dated implementation history;
- module-specific discovery and implementation plans — accepted scope and technical detail;
- Hermes SportStack Focus and Open Items — strategy and operations summaries that now point back to
  this repository plan.

## Definition of back on track

SportStack is back on track when:

1. the acceptance batches have evidence rather than assumed status;
2. confirmed blockers are fixed and retested;
3. data cleanup has exact dry runs and explicit approvals;
4. Main staging has passed the short smoke set;
5. Aaron can make one informed Production release decision;
6. this remains the only active plan.

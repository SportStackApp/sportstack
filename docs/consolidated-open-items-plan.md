# SportStack Consolidated Open Items Plan

Status: **active single plan**

Audited: **20 August 2026**

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
- `dev` and `main` are aligned, while `prod` remains separately behind Main;
- GitHub has no open issues or pull requests;
- the latest Dev Quality run and the latest Dev and Production scraper workflows passed;
- all declared npm dependencies are installed, but the 20 August `npm audit --omit=dev` now reports
  one high-severity transitive issue: PostCSS currently resolves `nanoid` 3.3.17 and the advisory is
  fixed in 3.3.18 or later;
- the live Dev database still reports 201 duplicate membership groups, 44 people with multiple
  active Primary memberships and 490 preserved snapshot rows;
- the live Dev database adviser currently reports 115 security warnings and 181 performance
  warnings. These are a review queue, not proof that every item is a defect;
- the GitHub Projects board, if one is in use, is **UNKNOWN — needs confirmation** because the
  current GitHub token does not have `read:project` access;
- the Hermes SportStack focus and general Open Items notes were dated 30 July; this audit refreshed
  their priority pointer without duplicating the changing implementation detail.

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

- [ ] Retest Super Admin, Association Admin, Club Admin, Team Manager, Coach, Player, Umpire and
  Coordinator using separate Dev accounts rather than only **Viewing as**.
- [ ] Complete Player Explorer acceptance after the 19 August repair:
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
- [ ] Retest multi-club Team Manager switching and the contextual role display in scoped user lists.
- [ ] Retest dashboard, team cascade, fixtures, byes, availability and the complete
  availability-to-line-up workflow.
- [ ] Retest Team Chat history, pagination and drafts, plus Club and Association broadcast author
  exclusion and notification deep links.
- [ ] Complete tablet and mobile checks; desktop checks already have useful evidence.

#### Batch B — voting, coordination and governance

- [ ] Create one email-disabled disposable Player MVP round and test the ballot, draft, analytics
  and result flow end to end.
- [ ] Test one disposable Umpire Match Voting ballot and correction flow. Confirm suggestions are
  limited to the fixture teams, selected fill-ins, line-up assignments and recorded appearances.
- [ ] Test one complete Coordination workflow: staffing need, offer, acceptance, coordinator
  confirmation, replacement and notification.
- [ ] Test Committee creation, one subcommittee, private upload, meeting, minutes, action, poll and
  Safety Hub link using disposable Dev records.
- [ ] Test one disposable Safety Hub record through create, review, link and audit history.
- [ ] Smoke-test Expense Hub with de-identified files only. Provider privacy, region and billing
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

- [ ] Resolve the `nanoid` security advisory through a reviewed dependency/lockfile update, then
  rerun `npm audit --omit=dev`, TypeScript and the production build. Do not use an unreviewed broad
  `npm audit fix`.
- [ ] Complete the confirmed Player Explorer feedback package:
  - [ ] Add a totals row below the results for Games, Goals, Green, Yellow and Red. Totals must use
    all filtered results, not only the current page.
  - [ ] Replace the generic **Use example** action with **Save filter** beside the filter controls.
  - [ ] Retain **Use 7 then 1 example** as the built-in sequence preset.
  - [ ] Preserve the active filter setup and search results when the user navigates away from
    Player Explorer and returns. Keep that working state until the user clears it or signs out.
  - [ ] Add a clear **Delete saved filter** action with confirmation. Remove the deleted filter
    from the dropdown and clear its `savedSearch` address parameter if it was active.
- [ ] Repair the confirmed top-right Admin menu overflow. Limit it to the available screen height
  and let the menu scroll internally so its bottom items remain reachable without shrinking text.
- [ ] Group failures from Phase 2 by root cause so one repair can cover all affected screens.
- [ ] Fix access-control and data-integrity failures before visual polish.
- [ ] Run focused lint, `npm run lint:dev-plan`, `npx tsc --noEmit`, `npm run build`, relevant
  Vitest/Python/Supabase checks and the full lint baseline comparison for each repair package.
- [ ] Re-run only the affected owner tests, then the short cross-module smoke set.
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

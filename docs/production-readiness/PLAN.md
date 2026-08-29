# SportStack Production Readiness Programme

Status: **planned — execution not yet started**

Last updated: **29 August 2026**

This document is the detailed execution plan beneath `docs/consolidated-open-items-plan.md`. The
consolidated plan remains the single priority list. This programme defines how SportStack will move
from the current Dev build to an evidence-backed Production decision.

## Outcome

SportStack is ready for Production only when:

- every known Blocker and High defect is fixed and retested;
- every Medium defect is fixed or explicitly deferred by Aaron with a recorded reason;
- every important route, role and workflow has a current result of Passed, Failed or Blocked;
- every data table and form has an explicit, consistently applied sorting and persistence policy;
- repeatable automated and walk-away checks cover the highest-risk workflows;
- Main staging passes the same reviewed release package;
- the exact Production database, Edge Function, workflow and application changes have backup,
  rollback and post-release evidence; and
- Aaron gives separate approval before any `prod` or Production change.

This is a release programme, not a promise that Production is ready today.

## Current evidence snapshot

The snapshot must be refreshed at the start of each work cycle.

- Dev is `74f6d93`; Main is `d48239d` and is two commits behind Dev.
- Production is `682b8ea` and is 195 commits behind Main.
- Dev Quality passed for `74f6d93`.
- The latest Production Supabase Scrapers run failed because three manually targeted games were
  started without a required round number. This must be repaired and rerun successfully.
- The repository has about 80 declared routes, 26 source files containing table headings and 15
  source files containing recognised form patterns. These are inventory starting points, not exact
  counts of user-visible tables or forms.
- Dev and Production migration histories have drifted and cannot be reconciled by counting migration
  files alone. The live schema is the source of truth.
- The current signed-in walkthrough found a serious roster-selection defect and several line-up and
  coaching consistency defects listed below.

## Work tree

```text
Production readiness
|-- A. Baseline and inventory
|-- B. Known-defect repair
|-- C. Screen consistency review
|-- D. Missing test cycles and regression automation
|-- E. Walk-away night testing
|-- F. Main staging acceptance
`-- G. Production release decision and controlled rollout
```

Each branch has an exit gate in `GATES.md`. A local pass does not count as a full release pass until
the joined workflow is retested.

## A. Baseline and inventory

### A1. Freeze the starting point

- Fetch Dev, Main and Production and record exact commit relationships.
- Confirm the repository identity, active GitHub account, clean working tree and installed pinned
  dependencies.
- Record current Dev Quality, Vercel, scraper and scheduled-job results.
- Record live Dev and Production schema and migration history without printing secrets.

### A2. Build three registers

Create machine-readable registers for:

1. every route and its allowed real roles/scopes;
2. every user-visible table, every column and its sorting rule; and
3. every form, filter, search, modal and multi-step workflow and its persistence rule.

Each register row must name the route, component, role, mobile/desktop relevance, expected behaviour,
automated coverage and latest manual result. New screens must be added to the registers before they
can be declared ready.

### A3. Severity and closure rule

- **Blocker:** a critical authorised workflow cannot be used at all.
- **High:** a major workflow is impossible, unsafe, misleading or can lose data.
- **Medium:** a workflow works only with significant confusion or repeated effort.
- **Low:** minor inconsistency or polish.

A finding closes only after the fix is deployed to Dev, the original steps pass, a nearby regression
check passes and evidence is recorded. A code change alone does not close a finding.

## B. Known-defect repair

Repair these in small Dev-only batches, highest risk first.

| ID | Severity | Known finding | Required outcome |
|---|---|---|---|
| READY-001 | High | The roster picker says 13 selected but shows only 10 because placeholder-linked players are excluded. Applying the visible selection can remove David, Sandin and Simon and their assignments. | Every already-selected valid player is visible and retained. The count, visible selections and saved assignments agree after reopen and refresh. |
| READY-002 | Medium | Bench/reserve players open game history, but pitch players do not. | Selecting any line-up player opens the same whole-season history, newest first. |
| READY-003 | Medium | Pitch movement depends on a small dotted handle and the marker snaps its centre to the cursor. | The whole marker is draggable, the pointer offset is preserved and the handle is removed. Click without drag still selects the player. |
| READY-004 | Medium | Playing area and side are displayed as unrelated choices. | Profile and Coaching display combined choices such as **Defender - Left** and **Attacker - Right** while the backend may retain separate fields. |
| READY-005 | Medium | Coaching assessment buttons 1–4 cannot be cleared by clicking the active value again. | Clicking an active rating clears it and the saved state remains correct after refresh. |
| READY-006 | Low | The Cards summary does not open the exact card details. | Selecting Cards shows the game and card received without leaving the player screen. |
| READY-007 | Low | The selected pitch player is not visually obvious enough. | The selected state is clear in colour and focus treatment and remains keyboard accessible. |
| READY-008 | Medium, confirm first | Quick Action arrows may move an item within the full catalogue rather than the visible authorised list. | A scoped admin can visibly reorder only actions they can access; hidden actions do not disrupt the order. |
| READY-009 | High operational | The latest Production scraper workflow failed because required target input was blank. | Invalid targeted runs fail before jobs fan out with a clear message, and a correctly configured rerun passes. |
| READY-010 | Medium coverage | Authenticated focus/persistence and several actual-role workflows still lack complete evidence. | Complete the role and persistence cycles in sections C and D. |

Additional confirmed defects found during the audit enter this table before repair. Avoid mixing
unrelated fixes into one commit.

READY-001 implementation status on 30 August 2026: the Dev repair and regression tests are complete.
A read-only live preflight confirmed 13 saved roster rows, three placeholder-linked profiles and 13
assignments. The finding remains open until the deployed Apply, Save, reopen and refresh owner test
passes without changing the selected players or their assignments.

## C. Screen consistency review

### C1. Sorting contract

Not every column should sort A to Z. Every **meaningful data column** must have the correct two-way
sort. Action and control-only columns should not pretend to sort.

| Column kind | Expected sort |
|---|---|
| Name or text | A–Z, then Z–A, case-insensitive and stable |
| Number or score | Low–high, then high–low |
| Date or time | Oldest–newest, then newest–oldest, using the real date value |
| Status or rating | Documented product order, then reverse order |
| Yes/no | No–Yes, then Yes–No |
| Composite display | Sort by the primary value users see, with a stable tie-breaker |
| Actions, checkboxes or menus | Not sortable |

Every sortable header must be a proper button, show its active direction, expose the direction to
assistive technology and work across the full filtered result set rather than only the visible page.
Sorting must remain stable while paging. A filter change may reset the page number but should not
silently reverse or discard the chosen sort.

The review covers all tabs within Fixtures, RevSports Review, Player MVP Voting, Umpire Match Voting,
Safety Hub and every other registered table. Existing sorting is retested; it is not assumed correct
because an arrow is visible.

### C2. Persistence contract

Persistence means the state survives the transition where users reasonably expect it to survive.
It does not mean saving every field forever.

| State | Expected behaviour |
|---|---|
| Saved server data | Survives refresh, sign-out/sign-in and a new browser session after explicit Save |
| Filters, search, sort and page size | Survive tab switches and focus changes; use URL or session state where returning to the page should restore the view |
| Ordinary unsaved draft | Survives a temporary focus/tab switch when losing it would be frustrating; clears after successful submit or explicit discard |
| Open modal or multi-step workflow | Does not vanish merely because the browser regains focus; explicit Cancel/Close may clear it |
| Passwords, tokens, file inputs and other sensitive values | Never persisted in browser storage |
| Association -> Club -> Division -> Team cascade | A higher-level change clears every now-invalid lower selection |
| Server validation failure | Keeps the user's visible input and explains what must change |

Each form is tested through tab switch, application focus change, browser back/forward, refresh and
reopen as appropriate. The register records deliberate exceptions so different screens do not make
different accidental choices.

### C3. Shared interaction and presentation contract

Review every registered screen for:

- consistent navigation, no unnecessary duplicate destinations and clear Working-as placement;
- Australian English, DD/MM/YYYY dates and association timezone handling;
- readable small text, consistent heading fonts and appropriately compact table headers;
- clearly indented child rows and consistent expandable detail patterns;
- consistent loading, empty, success, error and disabled states;
- keyboard focus, Enter/Escape behaviour and useful accessible names;
- mobile layout without clipped controls or unnecessary horizontal scrolling;
- consistent role/scope visibility and no private information outside the authorised context; and
- clean browser console/network behaviour, with repeated or failed requests linked to findings.

## D. Missing test cycles and regression automation

### D1. Role and scope cycle

Use actual authorised Dev identities where possible; Viewing-as is supporting evidence, not a
replacement. Cover Super Admin, Association Admin, Club Admin, Team Manager, Coach, Player, Umpire
and Coordinator. Test the relevant Association, Club, Division and Team boundaries and direct URLs.

### D2. Workflow cycle

At minimum, cover:

- authentication, Profile and personal/team details;
- Admin dashboard, entity management, Fixtures and RevSports review;
- roster, availability, fixture details, line-up save/reopen/reset and Coaching Squad/player notes;
- Player MVP Voting and Umpire Match Voting as separate modules;
- Communications, Coordination, Committee Management and Safety Hub;
- Expense Hub and Incident and Discipline; and
- public/signed-out routes, redirects, back/forward and direct links.

Read-only testing is the default. Write flows use named disposable Dev records only and must clean
up through a proven recoverable method. Temporary credentials are never written into evidence.

### D3. Device and accessibility cycle

- Desktop: approximately 1440 x 900.
- Mobile: approximately 390 x 844.
- Tablet: approximately 768 x 1024 where tables or split layouts justify it.
- Keyboard-only basics and visible focus on every high-risk workflow.
- Browser console and failed-network-request review for every route bundle.

### D4. Automated regression layer

Add focused tests before or with each repair. Priority automation covers:

- selected roster inclusion and save/reopen agreement;
- pitch and bench player history;
- marker dragging without cursor snapping;
- combined position labels and assessment deselection;
- table sorting comparators, indicators and full-result ordering;
- persistence helpers and scope-cascade clearing;
- role/scope access for sensitive screens; and
- the Production scraper's required-input validation.

Pin a browser test tool in the project before relying on unattended browser regression. Store only
an encrypted or operating-system-protected Dev test session outside the repository; never store a
password, token or browser state in Git.

## E. Walk-away night testing

The default unattended run is **Dev, read-only, report-only**. It may navigate, filter, sort, open
non-destructive views, take screenshots and inspect diagnostics. It may not save, submit, send,
approve, reject, vote, upload, delete, change roles or change Production.

The run charter is `WALK-AWAY-CHARTER.md`. Each night rotates through one manageable route bundle:

1. Admin, entities, Fixtures and RevSports;
2. Profile, roster, line-up and Coaching;
3. Player MVP Voting, Umpire Match Voting and analytics;
4. Communications, Coordination, Committee, Safety, Expense and Discipline;
5. mobile/tablet replay of open or recently repaired findings.

Every run produces a charter, decision log, short summary, issue register and screenshots in an
isolated temporary folder. A morning report gives counts by severity, passed coverage, blocked
coverage and the single best next action.

A separate disposable-data night is allowed only when its exact Dev identities and test records are
named in the charter. Production remains prohibited. No recurring automation is created merely by
this plan; scheduling is a separate action after Aaron accepts the charter and test access is ready.

## F. Main staging acceptance

Main promotion begins only after the Dev gates are current.

1. Fetch all branches and review the exact Dev-to-Main commits and changed files.
2. Confirm no unexpected Production-capable workflow or secret selector is included.
3. Run focused tests, full Vitest, TypeScript and the Production build; measure full lint against the
   documented baseline rather than hiding it.
4. Fast-forward Dev to Main only after the reviewed package is clear.
5. Confirm Vercel staging deployment and run the high-risk desktop/mobile/role smoke tests again.
6. Freeze the exact Main commit proposed for Production.

Dev and Main share the Dev database, so a Main UI pass does not prove Production schema
compatibility.

## G. Production release decision and controlled rollout

This phase requires Aaron's explicit approval before any change.

### G1. Exact package

- Recalculate branch divergence immediately before release.
- Compare live Production schema, RLS, functions, Storage and migration history with the frozen Main
  code. Do not infer the migration package from filenames alone.
- Identify every database migration, data preflight/backfill, Edge Function, scheduled job,
  environment setting and workflow change.
- Review Production security/performance advisers and separate release blockers from existing debt.

### G2. Recovery proof

- Create and verify a secure Production logical backup appropriate to the current plan.
- Dry-run migrations and guarded backfills against an isolated copy or transaction.
- Prove rollback steps and name the decision point for rollback.
- Verify no secret, private token or personal-data extract enters Git or the evidence folder.

### G3. Release and observation

- Obtain Aaron's recorded approval for the exact frozen commit and package.
- Apply database/function/job changes in the approved order.
- Fast-forward `prod` only after compatibility gates pass.
- Verify the Production deployment references Production Supabase only.
- Run signed-out and signed-in smoke tests, check logs/jobs/scrapers and keep the rollback window open.
- Record the final commit, migration/function versions, evidence and any explicitly accepted debt.

## Recommended first cycle

Start with READY-001 because it can remove selected players and saved assignments. In the same
cycle, add regression tests for roster count/visibility/save/reopen agreement. Then repair pitch
selection/history and marker dragging together because both depend on the marker interaction model.

After those High/Medium line-up risks pass on Dev, run the first read-only consistency night over
Admin, Fixtures and RevSports while the next repair batch is prepared.

## Reporting rhythm

Keep the user-facing update short and divide it into:

- **In progress now:** current repair or test bundle;
- **Next:** the next dependency-ready bundle; and
- **Parked for later:** ideas that do not affect readiness.

The ledger, registers and evidence folders hold the detail. Aaron should not have to remember which
screens were tested or infer readiness from a long chat history.

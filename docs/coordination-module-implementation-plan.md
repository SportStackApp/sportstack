# SportStack Coordination Module — Implementation Plan

- **Date:** 16 August 2026
- **Status:** Planning — ready for technical review, not approved for schema implementation
- **Source:** `docs/coordination-module-discovery.md`
- **Target branch:** `dev`
- **Production:** Explicitly excluded

## Outcome

Implement the confirmed Coordination design in small Dev-only stages, beginning with fixture
positions and the complete Umpire offer-to-confirmation workflow. Each stage must be independently
testable and must preserve existing fixture, permission, notification and Umpire Match Voting
behaviour.

## Current live Dev evidence

Read-only metadata was rechecked on 16 August 2026.

- `fixtures` supplies fixture details and includes `scheduled_end_at`.
- `fixture_availability` stores per-person fixture availability.
- `profiles` includes `date_of_birth`.
- `divisions` supplies association-scoped grades and match-duration information.
- `permission_sets` and `permission_assignments` supply scoped permission infrastructure.
- `notifications` supports in-app state, action links, fixture links and deduplication.
- `notification_preferences` currently has broad push/email flags and needs compatibility review for
  mandatory operational Coordination notices.
- `player_vote_submissions` remains the active Umpire Match Voting submission record.
- `revsports_umpire_mappings` already maps external Umpire names to profiles.
- No Coordination tables currently exist.

The live schema remains authoritative and must be checked again immediately before migration work.

## Implementation principles

1. Additive migrations only.
2. No Production work without separate approval.
3. Database-enforced organisation scope and workflow transitions.
4. No direct browser writes that bypass confirmation, conflict or audit rules.
5. “No until yes” represented by assignment creation, not an assumed boolean.
6. Append-only history for offers, assignments, warnings, notes and corrections.
7. Exact, unique historical mapping only; ambiguous mapping remains manual.
8. Explicit Data API grants and Row Level Security for every exposed record.
9. One small owner test at a time.

## Proposed record groups

Names are indicative until checked against live naming conventions.

### 1. Capabilities and invitations

- `coordination_capabilities`
  - person, capability type, organisation scope, active dates and state.
- `coordination_capability_invitations`
  - email/profile, capability, scope, inviter, status, expiry and acceptance audit.

Reuse existing `user_roles` only if a written source-of-truth review proves it can represent the
confirmed capability workflow without duplicate authority.

### 2. Permission keys

Proposed permission keys:

- `coordination.umpires.manage`
- `coordination.technical_bench.manage`
- `coordination.volunteers.manage`
- `coordination.activities.create`
- `coordination.offers.take_over`
- `coordination.umpire_matrix.manage`
- `coordination.roster_mismatches.review`
- `coordination.sensitive_notes.redact`

Use existing permission sets and assignments rather than building another coordinator-role system.

### 3. Position definitions and fixture positions

- `coordination_position_types`
- `coordination_position_templates`
- `coordination_positions`

A position links to exactly one fixture or one coordination activity. Initial fixture templates
create two Umpire and two Technical Bench positions. Position creation must be idempotent.

Supervision should be modelled as a relationship to an Umpire assignment rather than a permanently
required fixture position.

### 4. Offers and reminders

- `coordination_offer_batches`
- `coordination_offer_recipients`
- `coordination_offer_note_revisions`
- `coordination_offer_reminders`

Enforce one active offer batch per position and one recipient entry per person per batch.

### 5. Assignments, replacements and events

- `coordination_assignments`
- `coordination_replacement_requests`
- `coordination_assignment_events`
- `coordination_warning_overrides`

Only one current assignment may fill a position. Replacement creates a new assignment and closes the
old one. Events remain append-only.

### 6. Supervision and Umpire Matrix

- `coordination_supervision_links`
- `coordination_supervision_notes`
- `umpire_grade_signoffs`
- `umpire_qualifications`
- `umpire_coordinator_notes`

Sign-off changes create new history rather than overwriting evidence. Private note read/write and
redaction permissions remain separate.

### 7. Volunteer activities

- `coordination_activities`

Activities reuse the same position, offer, reminder, assignment and event records.

### 8. Umpire Match Voting roster checks

- `umpire_match_roster_checks`

Keep this separate from `player_vote_submissions`. Store the automated result, roster snapshot,
review outcome, reviewer and recheck history without changing voting approval state.

### 9. Notification delivery

Extend the current notification-dispatch pattern or add a narrowly scoped Coordination delivery
record after the existing email path is inspected. Required fields include channel, queued/sent/
failed time, attempt count, error category and deduplication key. Do not add email-open tracking.

## State transitions

### Position

`OPEN` → `OFFERING` → `AWAITING_CONFIRMATION` → `FILLED`

Additional states:

- `REPLACEMENT_REQUIRED`
- `RECONFIRMATION_REQUIRED`
- `CANCELLED`
- `COMPLETED`

### Offer recipient

`DRAFT` → `PENDING`

From `PENDING`:

- `ACCEPTED_AWAITING_CONFIRMATION`
- `DECLINED`
- `EXPIRED`
- `WITHDRAWN`

From accepted:

- `CONFIRMED`
- `WITHDRAWN`
- `NOT_SELECTED`
- reset to `PENDING` after an important offer-note revision.

### Assignment

`CONFIRMED` → one of:

- `RECONFIRMATION_REQUIRED`
- `REPLACEMENT_REQUESTED`
- `REPLACED`
- `CANCELLED`
- `COMPLETED`
- `DISPUTED` for challenged late roster corrections.

### Capability invitation

`PENDING` → `ACCEPTED`, `DECLINED`, `EXPIRED` or `WITHDRAWN`.

## Secure database operations

Create narrow operations for:

- send offer;
- add offer recipients;
- revise offer note;
- accept, decline or withdraw response;
- confirm accepted recipient;
- take over offer;
- request replacement;
- confirm replacement;
- respond to material fixture change;
- record late roster correction;
- dispute/resolve late roster correction;
- add/remove supervision link;
- apply warning override;
- sign off/suspend/remove grade eligibility;
- add qualification;
- add/redact restricted note; and
- review/recheck roster mismatch.

Confirmation must lock the position and relevant recipient response, then recheck:

- authentication and permission scope;
- response state;
- deadline/start time;
- current capability;
- one-current-assignment constraint;
- hard time overlaps;
- self-supervision;
- warnings requiring an override note; and
- Technical Bench age pairing.

Failed validation creates no assignment.

## Permission matrix

| Action | Recipient | Umpire Coordinator | Technical Bench Coordinator | Volunteer Coordinator | Super Admin |
|---|---:|---:|---:|---:|---:|
| Read own offer/assignment | Yes | Scoped | Scoped | Scoped | Yes |
| Respond to own offer | Yes | Own only | Own only | Own only | Own only |
| Send/confirm Umpire offer | No | Association scope | No | No | Recovery only |
| Manage Umpire Matrix | No | Association scope | No | No | Recovery only |
| Add own supervision note | Supervisor only | Yes | No | No | Yes |
| Read full Umpire private log | No | Association scope | No | No | Audited recovery |
| Send/confirm Technical Bench offer | No | No | Granted scope | No | Recovery only |
| Create/manage volunteer activity | No | No | No | Granted scope | Recovery only |
| Review Umpire Match Voting mismatch | No | Association scope | No | No | Audited backup |
| Redact sensitive note | No | No by default | No | No | Explicit privacy grant |

Every coordinator query and mutation must also match the stored organisation scope.

## Notifications

### Required channels

- In-app: mandatory.
- Email: mandatory while the capability is active.
- SMS/push: excluded.

### Reminder schedule

- Default offer window: 72 hours, adjustable to any deadline at or before start.
- Normal reminders: 24 hours and 4 hours before deadline.
- Window under 24 hours: halfway and 1 hour before deadline where possible.
- Window under 2 hours: show **Urgent** and send only reminders that still fit.

### Delivery evidence

- In-app: unread/read.
- Email: queued/sent/failed.
- No email-open tracking.

Stable deduplication keys must make scheduled retries safe.

## Historical data approach

1. Produce read-only counts of external Umpire names, exact unique matches, ambiguous matches,
   existing mappings and unmapped values.
2. Do not alter raw RevSports data.
3. Reuse or extend the mapping-screen pattern used for players.
4. Store coordinator corrections as an audited overlay.
5. Count history only after mapping/review.
6. Never derive grade sign-off automatically.
7. Do not create retrospective mismatch alerts.

No backfill may run without a reported dry-run and separate approval for the resulting writes.

## Delivery stages

### Stage 0 — technical preflight

- Recheck live Dev tables, functions, grants, RLS and advisers.
- Inspect account invitation and email delivery reuse.
- Inspect all fixture mutation paths.
- Confirm duration fallback when `scheduled_end_at` is null.
- Produce RevSports Umpire mapping dry-run counts.
- Write the detailed permission and privacy test cases.

No schema writes in this stage.

### Stage 1 — capability, permission and position foundation

- Add/reuse permission keys and capability invitations.
- Add position types/templates and future-fixture positions.
- Add the initial Umpire Matrix read model.
- Add RLS, explicit API grants and audit events.

Owner test: invite one disposable Dev Umpire and confirm capability appears only after acceptance.

### Stage 2 — fixture offer vertical slice

- Send one multi-recipient Umpire offer.
- Add recipients to the open batch.
- Accept/decline/withdraw.
- Confirm one recipient and mark others not selected.
- Apply 72-hour/adjustable deadline rules.
- Add in-app and email delivery evidence.

Owner tests are performed one small scenario at a time.

### Stage 3 — reminders, conflicts and availability

- Add scheduled reminder/expiry processing.
- Hard-block overlapping confirmation.
- Add explicit-unavailability and warning override flow.
- Write role-specific fixture availability on confirmation and clear it on replacement/cancellation.

### Stage 4 — replacement, reconfirmation and late correction

- Add mandatory-note replacement requests and new-offer replacement flow.
- Add fixture-change reconfirmation.
- Add takeover with reason.
- Add late roster correction, notification and dispute flow.

### Stage 5 — Umpire Matrix and supervision

- Add grade sign-off history, suspension/removal and override notes.
- Add qualifications and expiry warnings.
- Add restricted coordinator logs and redaction audit.
- Add supervision relationships and free-text supervisor notes.
- Add historical mapping review and verified totals.

### Stage 6 — Technical Bench

- Add two Technical Bench fixture positions.
- Add first-duty warning.
- Add date-of-birth pairing check without exposing exact birth dates.
- Reuse the complete offer/confirmation/replacement workflow.

### Stage 7 — Umpire Match Voting roster flag

- Add roster-check records and review queue.
- Cover linked, proxy, public/unverified and disputed-roster identities.
- Recheck after roster correction.
- Confirm voting submissions remain unchanged.

### Stage 8 — volunteer activities

- Add custom scoped activities and position counts.
- Reuse the direct-offer workflow.
- Keep open claiming and full Events features parked.

## Verification gates

### Database

- Migration rollback dry-run on Dev.
- RLS tests for every subject and scope.
- Two-recipient concurrency test proving one confirmation.
- Overlap and self-supervision rejection tests.
- Warning override-note tests.
- Reminder deduplication/retry tests.
- Fixture-change and replacement history tests.
- Late-correction dispute and mismatch recheck tests.
- Supabase security/performance advisers.

### Application

- Focused ESLint for changed files.
- `npx tsc --noEmit`.
- Focused automated state/permission tests.
- `npm run build`.
- Full `npm run lint`, with existing baseline debt reported separately if still present.

### Owner testing

Give Aaron one explicit Dev test at a time and wait for observed confirmation before marking it
passed. Use disposable Dev accounts and clearly marked test fixtures/activities.

## Rollback and release boundaries

- Additive Dev migrations only.
- Backfills require read-only counts first.
- No destructive cleanup.
- Do not hand-edit generated Supabase types; regenerate them.
- Do not promote to `main` until Dev owner tests and checks pass.
- `prod`, Production Supabase, Production functions and Production notification schedules require a
  separate explicit approval.

## Technical unknowns to resolve in Stage 0

- Exact reuse path for account invitations and capability acceptance.
- Whether mandatory Coordination email should extend or bypass broad notification preferences.
- Delivery-status source for queued/sent/failed email.
- Exact fixture update hooks for reconfirmation.
- Duration fallback for fixtures without `scheduled_end_at`.
- Secure date-of-birth comparison method that never returns the birth date to the normal UI.
- Exact historical mapping/backfill counts.
- Privacy and retention approval for permanent sensitive notes before Production.

These are technical checks, not unresolved product decisions.

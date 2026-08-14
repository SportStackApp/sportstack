# SportStack Coordination Module — Discovery Specification

- **Date:** 14 August 2026
- **Status:** Discovery — proposed design, not approved for implementation
- **Project:** SportStack
- **Production impact:** None

## Purpose

Create one reusable system where an authorised, organisation-scoped coordinator fills defined
positions on either:

- an existing fixture; or
- a basic non-fixture volunteer activity.

The first implementation should focus on fixture coordination for Umpires and Technical Bench
officials. SportStack fixtures remain the source of match details. The module must not become a
second fixture system or a full events system.

## Confirmed requirements

- A standard fixture needs two Umpire positions and two Technical Bench positions.
- The position model must remain configurable so other position types can be added later.
- A person can hold several capabilities, such as Umpire, Technical Bench and Volunteer.
- A coordinator requires both a coordination responsibility and an organisation scope.
- Offers must support Accept and Decline responses.
- One position can be offered to several eligible people at the same time.
- An Umpire accepting an offer records their willingness; it does not fill the position.
- The person who sent the offer must explicitly confirm one accepted Umpire before the assignment
  becomes official.
- Every offer must have a response deadline.
- Pending recipients must receive reminders before the deadline.
- An offer can contain a recipient-facing note, including important difficulty or payment information.
- The system must flag when an Umpire Match Voting submission identity does not match a rostered
  Umpire. The flag should support review and must not silently reject the submission.
- Non-fixture volunteer activities are in scope after the fixture workflow is established.
- Version 1 depends on in-app notifications, not email, SMS or push delivery.

## Current-system findings

The live SportStack Dev schema was rechecked read-only on 14 August 2026.

- `fixtures` stores fixture date/time, teams, division, venue, pitch and status. It does not store
  individual Umpire or Technical Bench assignments.
- `fixture_availability` stores a person's status and note for a specific fixture. It is useful
  evidence but is not a complete date/time availability system.
- `user_roles` already supports association, club and team scope and more than one role per person.
- `permission_assignments` provides a newer subject-and-scope permission model that should be
  assessed before adding another permission structure.
- `notifications` supports in-app notices, action links, fixture links and deduplication keys.
- The existing notification dispatcher currently provides reusable dispatch infrastructure. Its
  current message types do not yet implement coordination offers or reminders.
- `player_vote_submissions` is the current Umpire Match Voting submission record. It supports a
  linked Umpire profile as well as administrator proxy and public identity fields.
- No `coordination_*`, game-offer or official-assignment tables currently exist.
- A table named `fixture_lineup_assignments` exists for player line-ups. It is a different domain
  and must not be reused for official or volunteer coordination.
- Current imported Umpire names are not all safely linked to SportStack profiles. Name-only matching
  must therefore be treated as uncertain and reviewed before any backfill.

The live schema must be checked again immediately before an implementation migration is written.

## Design principles

1. **Positions, offers and assignments are different records.** A required position exists before
   anyone is contacted. An offer asks someone to take it. An assignment is created only when the
   position is successfully filled.
2. **Organisation scope is enforced in the database.** Hiding controls in the interface is not an
   access-control boundary.
3. **Confirmation fills the position.** Several people may accept the same offer. The original
   offerer chooses and confirms one accepted person through a secure database transaction.
4. **History is retained.** Declines, expired offers, replacements and material fixture changes
   remain auditable.
5. **Recipient information is preserved.** The note shown with an offer is an immutable snapshot.
6. **Warnings do not invent facts.** Unknown availability or an unlinked voting identity is shown
   as unknown or unverifiable, not automatically treated as a conflict or mismatch.
7. **The model is generic but the first interface is specific.** The storage model can support
   future positions while the first screen clearly shows Umpire 1, Umpire 2, Technical Bench 1 and
   Technical Bench 2.

## Proposed terminology and states

Keeping separate states avoids one ambiguous status field trying to describe several workflows.

### Position state

| State | Meaning |
|---|---|
| `OPEN` | The position needs someone and has no active offer. |
| `OFFERING` | One or more people have a pending offer. |
| `AWAITING_CONFIRMATION` | At least one person accepted, but the offerer has not confirmed anyone. |
| `FILLED` | A confirmed assignment currently fills the position. |
| `CANCELLED` | The position is no longer required. |
| `COMPLETED` | The duty occurred and the final assignment is retained. |

### Offer-recipient state

| State | Meaning |
|---|---|
| `DRAFT` | Prepared but not visible to the recipient. |
| `PENDING` | Sent and awaiting a response before the deadline. |
| `ACCEPTED_AWAITING_CONFIRMATION` | The recipient is willing, but is not yet rostered. |
| `CONFIRMED` | The original offerer selected this accepted recipient. |
| `DECLINED` | The recipient declined, optionally with a reason. |
| `EXPIRED` | The response deadline passed without acceptance. |
| `WITHDRAWN` | The coordinator withdrew the offer before it was filled. |
| `NOT_SELECTED` | The original offerer confirmed another accepted recipient. |

### Assignment state

| State | Meaning |
|---|---|
| `CONFIRMED` | The original offerer confirmed the person for the current duty details. |
| `RECONFIRMATION_REQUIRED` | A material fixture/activity change needs a new response. |
| `CANCELLED` | The duty was cancelled without a replacement. |
| `REPLACED` | A different person now fills the position. |
| `COMPLETED` | The duty occurred and remains in history. |

## Proposed records

Names are indicative. Exact columns, constraints and naming must be checked against the live schema
before implementation.

### Coordination capabilities

Connect a person to one or more assignable capabilities:

- Umpire
- Technical Bench
- Volunteer
- future capability types

Each capability should support association, club or team context, active dates and an active flag.
A capability means the person is eligible for consideration; it does not give coordinator access.

Before creating this record, confirm whether existing scoped `user_roles` can safely supply these
capabilities. Avoid storing the same authority in two systems without a defined source of truth.

### Coordinator authority

Use permission keys for responsibility and existing assignment scope where possible:

- `coordination.umpires.manage`
- `coordination.technical_bench.manage`
- `coordination.volunteers.manage`
- `coordination.activities.create`
- `coordination.roster_mismatches.review`

A permission assignment must contain its association, club or team scope. A person may hold several
responsibilities and scopes.

### Position templates

Define reusable requirements for a fixture type or activity type:

- position type;
- display label;
- required count;
- required capability;
- ordering;
- active dates; and
- optional instructions.

The initial standard fixture template creates:

| Position type | Count |
|---|---:|
| Umpire | 2 |
| Technical Bench | 2 |

### Coordination positions

Each concrete position links to exactly one source:

- an existing fixture; or
- a coordination activity.

Store the position type, sequence number, required capability, state, organisation scope and source
template version. Database constraints should prevent a position from linking to both source types.

### Offer batches

An offer batch represents one coordinator action for one open position. Store:

- position;
- original offerer, immutable after sending;
- sent time;
- required response deadline;
- immutable recipient-facing note;
- optional internal coordinator note stored separately;
- status;
- confirmed recipient offer, when filled; and
- created/updated timestamps.

The recipient-facing note must be visible before Accept or Decline. Examples include:

- “If you do this game I'll pay double.”
- “This game is likely to be difficult to umpire.”

Because these notes may contain safety, conduct or payment information, the exact offered text must
remain in history. Editing a sent note should create a new revision and notification, not overwrite
what recipients previously saw. Internal notes must never be included in recipient notifications.

### Offer recipients

Create one record per person offered the position. Store:

- offer batch;
- recipient profile;
- status;
- sent time;
- response time;
- optional decline reason;
- expiry time; and
- outcome details.

Use a unique constraint so the same person is not added twice to one offer batch. A recipient may
only view and respond to their own offer.

### Offer reminders

Materialise reminder records when an offer is sent rather than relying only on a calculated timer.
Store:

- offer recipient;
- reminder type;
- due time;
- sent time;
- cancelled time;
- dispatch attempt/status; and
- notification reference.

This supports several reminders, reliable retries and evidence of what was sent. Reminder times
should come from an organisation setting or coordinator-selected schedule. The exact default timing
remains an owner decision.

All future reminders are cancelled when the recipient responds, the offer is withdrawn, the
offerer confirms someone, the position is cancelled or the deadline passes.

### Assignments

An assignment is created only when the original offerer confirms a person whose offer response is
`ACCEPTED_AWAITING_CONFIRMATION`. Store:

- position;
- assigned person;
- confirmed offer response;
- original offerer;
- recipient acceptance time;
- offerer confirmation time;
- state;
- effective start and end time snapshot;
- replacement relationship; and
- completion time.

A partial unique constraint should allow only one current assignment for a position. Replacements
must close the previous assignment and create a new one rather than overwrite the person.

### Assignment events

Keep an append-only event trail for important changes such as:

- offer sent;
- reminder sent;
- accepted and awaiting confirmation, or declined;
- offerer confirmed a recipient;
- accepted recipient not selected;
- deadline expired;
- offer withdrawn;
- fixture changed;
- reconfirmation requested;
- assignment cancelled or replaced; and
- duty completed.

Do not rely only on mutable current-state columns for audit history.

### Coordination activities

For non-fixture work, store a basic activity with:

- name and activity type;
- description;
- organisation scope;
- start and end time;
- venue or plain-text location;
- coordinator;
- notes; and
- status.

Activities can use the same position, offer, reminder and assignment records as fixtures. Public
listings, ticketing, registration, programs and detailed event administration remain outside this
module.

## Multi-person offer workflow

1. The coordinator selects one open position.
2. SportStack shows eligible people, their recorded availability, current commitments and scope.
3. The coordinator selects one or more recipients, sets a deadline and adds a recipient-facing note.
4. SportStack validates scope, capability, fixture timing and duplicate recipients.
5. Sending creates one offer batch, recipient records, reminder schedule and in-app notifications.
6. Each recipient sees the same position, deadline and recipient-facing note with Accept and Decline.
7. A recipient accepts before the deadline. Their response becomes
   `ACCEPTED_AWAITING_CONFIRMATION`, their reminders stop and the original offerer is notified.
8. Other recipients may still accept or decline while the offer remains open.
9. The original offerer reviews the accepted recipients and explicitly confirms one.
10. In the confirmation database transaction, SportStack creates the assignment, marks the selected
    response `CONFIRMED`, marks the other active responses `NOT_SELECTED`, cancels remaining
    reminders and creates outcome notifications.
11. If everyone declines or expires without an acceptance, the position returns to `OPEN` and the
    offerer is notified.
12. If one or more people accept but nobody is confirmed, the position remains
    `AWAITING_CONFIRMATION` and appears as urgent work for the original offerer.

### Secure acceptance and atomic confirmation

Accept must use a tightly permissioned database function that:

- authenticates the current recipient;
- confirms the deadline has not passed;
- confirms the recipient's offer is still pending;
- records `ACCEPTED_AWAITING_CONFIRMATION` and the response time;
- cancels that recipient's future reminders; and
- notifies the original offerer without creating an assignment.

Confirmation must use a separate database transaction, not a sequence of browser writes. It should:

- authenticate that the current user is the original offerer;
- lock the position and offer batch;
- confirm the selected response is `ACCEPTED_AWAITING_CONFIRMATION`;
- confirm the position has no current assignment;
- create the confirmed assignment;
- mark the selected response `CONFIRMED`;
- close competing responses as `NOT_SELECTED` and cancel their reminders; and
- write notifications and history.

This makes the offerer's confirmation the single event that fills the position. An exceptional
Super Admin recovery action may be designed later, but it must require a reason and remain audited.

## Deadlines and reminders

- A sent offer cannot omit its deadline.
- The deadline must be before the fixture/activity starts and must allow a small minimum response
  window unless the coordinator confirms an urgent offer.
- The action screen must show the deadline in the association timezone, normally
  `Australia/Melbourne`, using SportStack's DD/MM/YYYY date format.
- A scheduled dispatcher should claim due reminders safely so repeated scheduled runs do not send
  duplicates.
- Reminder notifications need stable deduplication keys.
- A final deadline job expires pending offers and alerts the coordinator when the position is still
  unfilled.
- An acceptance immediately alerts the original offerer that confirmation is required. Accepted
  responses remain valid after the response deadline, but do not fill the position by themselves.
- The coordinator dashboard should show “respond by”, next reminder, expired offers and urgent
  vacancies, plus accepted responses awaiting offerer confirmation.

The existing scheduled notification-dispatch pattern should be extended or reused only after its
message-type and authorisation boundaries are reviewed. Version 1 should support in-app reminders;
other delivery channels can be added later without changing the offer state model.

## Availability and conflict handling

Version 1 should distinguish:

- available;
- unavailable; and
- unknown.

`fixture_availability` can inform the initial fixture screen, but a later availability-period record
is still needed for date/time ranges, conditional notes and recurring patterns.

Recommended version 1 rules:

- unavailable is a visible conflict warning;
- an overlapping confirmed assignment is a strong conflict warning;
- unknown availability is permitted but clearly labelled;
- coordinators may proceed through a warning when policy allows; and
- the confirmation transaction rechecks hard conflicts so stale screens cannot create two
  overlapping assignments unintentionally.

The exact hard-conflict and override policy remains open.

## Fixture changes after confirmation

Material changes include fixture date, start time, venue, pitch, teams or cancellation.

Recommended behaviour:

- record the changed fields in assignment history;
- notify all affected recipients and coordinators;
- cancel pending offers when their original timing is no longer valid;
- mark confirmed assignments `RECONFIRMATION_REQUIRED` for material schedule/location changes; and
- keep the original acceptance and offer note in history.

A score or other non-roster fixture update should not request reconfirmation.

## Umpire Match Voting roster mismatch flag

### Intended rule

After a Umpire Match Voting submission is received, compare its Umpire identity with the confirmed or
completed Umpire assignments for that fixture.

Possible check results:

| Result | Meaning |
|---|---|
| `MATCHED` | The linked submitting Umpire is rostered for the fixture. |
| `MISMATCH` | The linked submitting Umpire is known and is not rostered. |
| `NO_ROSTER` | The fixture has no confirmed/completed Umpire assignment to compare. |
| `UNVERIFIABLE` | The submission identity is text-only, unresolved or otherwise cannot be safely linked. |
| `VALID_PROXY` | An authorised administrator submitted for a rostered Umpire. |

Only `MISMATCH` should be called a confirmed mismatch. `NO_ROSTER` and `UNVERIFIABLE` need review but
must not imply that the submitter did something wrong.

### Review record

Use a separate roster-check record linked one-to-one with `player_vote_submissions` rather than
overloading voting approval fields. Store:

- submission and fixture;
- submitted or represented Umpire profile when known;
- matched assignment when found;
- automated check result and time;
- snapshot of the roster used for the check;
- review state (`PENDING`, `CONFIRMED`, `CLEARED` or `OVERRIDDEN`);
- reviewer, review time and reason; and
- recheck reason/version.

This keeps the voting record intact and allows a check to be rerun after a late roster correction.
The initial check should occur as part of the secure submission workflow so the flag appears
immediately.

### Review behaviour

- Do not block or delete the Umpire Match Voting submission.
- Show a visible flag in the authorised Umpire Match Voting administration view.
- Notify or queue the appropriate reviewer without exposing private details broadly.
- Allow an authorised reviewer to clear or confirm the flag with a required note.
- If the actual Umpire was a late replacement, correct the coordination roster first and rerun the
  check so history reflects what happened.
- Never auto-link a person using name text alone when the match is ambiguous.

The roster checked should be the final confirmed/replacement history effective for that fixture, not
merely the first person offered the game.

## Notifications

Initial notification types should include:

- new offer;
- offer reminder;
- offer declined;
- offer expired;
- response accepted and awaiting offerer confirmation;
- recipient confirmed for the assignment;
- accepted recipient not selected;
- offer withdrawn;
- replacement required;
- fixture changed/reconfirmation required; and
- Umpire Match Voting roster mismatch awaiting review.

Notifications should carry a direct action URL. Accept and Decline must still call the secure
database workflow; the URL itself must not perform a state change.

Realtime should update the coordinator and recipient screens after a response. Adding coordination
tables to Realtime requires a deliberate publication and RLS review; it must not be assumed from the
existing `notifications` subscription.

## Main views

### Coordinator dashboard

Show upcoming fixtures/activities, open positions, pending offers with deadlines, next reminders,
declines, expired offers, responses awaiting confirmation, availability conflicts, confirmed
assignments and replacement needs.

### Fixture coordination

Show fixture details and the four initial positions. For each position, show its current assignment
or offer recipients, response states, deadline and actions permitted within the coordinator's scope.

### My assignments and offers

Show pending offers first, with the deadline, offer note, fixture/activity details and Accept or
Decline. Clearly separate `Accepted — awaiting confirmation` from confirmed, replaced, cancelled
and completed assignments.

### People pool

Show capability, organisation connection, availability, overlapping commitments, current load,
pending offers and active/disabled state. Recent declines should provide operational context but
must not be presented as a performance score.

### Roster mismatch review

Show Umpire Match Voting submissions that are mismatched, unrostered or unverifiable, with the final
fixture roster, replacement history and a permission-controlled review action.

## Access-control outline

- Recipients may read and respond only to their own offers.
- People may manage only their own availability unless a separately approved delegation exists.
- Coordinators may manage positions, offers and assignments only for their responsibility and
  organisation scope.
- Only the original offerer may confirm an accepted response in the normal workflow. Another
  coordinator with the same scope cannot silently take over that confirmation.
- Umpire coordinators do not automatically gain Volunteer coordination access.
- Capability alone does not grant coordinator access.
- Association scope may include child clubs/teams only through one documented hierarchy function.
- Cross-club assignment is denied unless an explicit policy permits it.
- Workflow writes should use narrow database functions. Direct table updates must not bypass offer
  deadlines, offerer confirmation, scope or history.
- New public-schema tables require explicit API grants and Row Level Security policies.
- Helper functions should use a fixed `search_path`; elevated functions must not be executable by
  `PUBLIC` by default.
- Update policies require both row-selection and resulting-row checks.
- Realtime visibility must use the same row access rules as normal reads.

Before migration work, produce a written permission matrix covering Super Admin, Association Admin,
Club Admin, Team Admin, each coordinator responsibility and the assignment recipient.

## Delivery plan

### Phase 0 — approve the design

- Decide the default deadline, reminder timings and conflict override policy.
- Confirm who reviews Umpire Match Voting roster mismatch flags.
- Recheck the live schema, existing permission helpers and notification dispatcher.
- Dry-run Umpire name-to-profile matching and report matched, ambiguous and unmatched counts without
  changing live data.

### Phase 1 — permission and position foundation

- Add or reuse coordinator permission keys and scopes.
- Resolve the source of assignable capabilities.
- Add configurable templates and fixture positions.
- Add RLS, explicit API grants and append-only history.

### Phase 2 — fixture offer workflow

- Add multi-recipient offers, required deadlines and recipient-facing notes.
- Add recipient acceptance, original-offerer confirmation and replacement history.
- Add in-app notifications, scheduled reminders and expiry processing.
- Build Coordinator, Fixture Coordination and My Offers/Assignments views.
- Add the Umpire Match Voting roster check and review queue.

### Phase 3 — broader availability

- Add date/time availability periods and conditional notes.
- Show overlap warnings and existing commitments.
- Add recurring patterns only after a simple period model is proven.

### Phase 4 — volunteer activities

- Add basic non-fixture activities and configurable volunteer positions.
- Reuse the offer, reminder, response and assignment workflows.
- Keep full event management outside the module.

### Phase 5 — later improvements

- Open positions that eligible people can claim.
- Email, push or SMS delivery.
- Workload balancing and assignment limits.
- Qualification/accreditation tracking.
- Attendance, check-in and volunteer-hour reporting.
- Bulk assignment, exports and replacement requests.

## Decisions required before implementation

1. What is the default response period for an Umpire offer?
2. How many reminders are sent, and how long before the deadline are they due?
3. Can a coordinator override an availability or overlapping-assignment warning?
4. Which role reviews Umpire Match Voting roster mismatch flags at association and club level?
5. Can a club coordinator offer a position to a person connected only to another club?
6. Are Umpire, Technical Bench and Volunteer separate responsibilities by default?
7. Should a sent offer note be corrected by withdrawing and resending, or by a visible revision?
8. Is in-app delivery alone sufficient for the first Dev test?

## Implementation gate

No database migration, Row Level Security change, live permission grant or production change should
begin from this document alone. The next step is owner review of the eight decisions above, followed
by a current-schema technical plan containing proposed SQL objects, permission tests, rollback
tests, data-migration counts and one small owner test at a time.

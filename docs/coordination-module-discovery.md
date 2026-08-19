# SportStack Coordination Module — Confirmed Discovery Specification

- **Original proposal:** 3 August 2026
- **Decision review completed:** 16 August 2026
- **Status:** Confirmed and implemented on Development — owner testing pending
- **Project:** SportStack
- **Production impact:** None

## Purpose

Create one reusable system where an authorised, organisation-scoped coordinator fills defined
positions on either:

- an existing fixture; or
- a basic non-fixture volunteer activity.

Fixtures remain the source of match details. Coordination attaches staffing positions, offers,
responses, confirmations and history to those fixtures. It does not become a second fixture system
or a full events system.

## Core rule — no until yes

An offer recipient accepting means **I am willing**. It does not mean they are rostered.

An official assignment exists only after the offerer explicitly confirms an accepted person. Until
that confirmation succeeds:

- the position remains unfilled;
- no assignment exists;
- having only one accepted response does not auto-confirm it;
- reaching the response deadline does not auto-confirm it; and
- a missing, failed or abandoned confirmation remains **No**.

This rule applies to Umpires, Technical Bench officials, Supervising Umpires and Volunteers.

## Confirmed fixture positions

Every standard fixture requires:

| Position | Required count |
|---|---:|
| Umpire | 2 |
| Technical Bench | 2 |

The model remains configurable so future fixture or activity positions can be added without changing
the offer and assignment system.

Supervision is optional. A Supervising Umpire can be added to either Umpire or both at any time.

## Roles, responsibilities and scope

### Separate coordinator responsibilities

- Umpire Coordinator
- Technical Bench Coordinator
- Volunteer Coordinator

One person may hold several responsibilities, but one responsibility never automatically grants
another.

### Umpire Coordinator

Umpire coordination is association-scoped by default. Association Umpire Coordinators can manage
the association Umpire Matrix, offers, confirmations, sign-offs, qualifications, supervision and
roster mismatch reviews.

Umpire Coordinator is association-only. A direct responsibility assignment establishes only that
association access and does not create an Association Admin role.

### Technical Bench Coordinator

Technical Bench Coordinator may be association- or club-scoped. A club Coordinator can fill both
bench positions when either fixture team belongs to their club.

### Volunteer Coordinator

Volunteer Coordinators work within their assigned association or club scope. They may create
any basic coordination activity and define custom position names and counts.

Public listings, registrations, tickets, programs and full event administration remain outside this
module.

### Umpire role and other capability invitations

An association-scoped `UMPIRE` role is sufficient to receive Umpire offers and use Umpire Match
Voting in that association. The Umpire does not accept a separate capability invitation, but still
accepts or declines every individual game offer. Umpire does not grant Supervising Umpire.

Technical Bench, Volunteer and Supervising Umpire continue to use capability invitations.

The module provides an **Invite** action:

- an existing user without the capability receives an in-app invitation;
- a person without an account receives an account-invitation email;
- capability is assigned only after the person accepts; and
- the invitation does not reserve a position or start an assignment-offer deadline.

This grants an assignable non-Umpire capability, not coordinator access. Coordinator
responsibilities are protected fixed permission bundles assigned in User Management.

## Umpire Matrix

The association Umpire Matrix shows:

- all mapped Umpires in the association;
- completed games umpired;
- completed-game counts by grade;
- grade eligibility and full sign-off history;
- qualifications and expiry warnings;
- supervising-Umpire history;
- current offers, assignments and availability;
- replacement-request history; and
- restricted coordinator notes.

### Grade eligibility

Eligibility is recorded for each grade in the coordinator's association.

Each record shows:

- current eligibility state;
- who signed the Umpire off;
- sign-off date;
- later suspension or removal;
- effective dates and reasons; and
- immutable history.

Only an authorised Umpire Coordinator gives final grade sign-off. A sign-off is never deleted.
Suspending or removing eligibility requires a reason and effective date, and notifies the Umpire.

An Umpire may still be offered a game outside their current grade eligibility. SportStack shows a
strong warning and requires a mandatory coordinator override note.

### Qualifications

Each qualification records:

- qualification name — required;
- issuing organisation — optional;
- issue date — optional;
- expiry date — optional;
- supporting note — optional;
- who added it and when; and
- audit history.

An expired qualification shows a strong warning but does not hard-block an offer. Offering or
confirming through the warning requires a mandatory coordinator note.

### Supervising Umpires

A Supervising Umpire:

- uses the same offer, acceptance and confirmation workflow when appointed before the game;
- may also be Umpire 1 or Umpire 2;
- may supervise the other Umpire while officiating;
- cannot supervise themselves;
- must be a separate third person to supervise both Umpires; and
- may be added later by an authorised coordinator with an audited notification to affected people.

The supervisor may enter an optional free-text note linked to the fixture and individual Umpire.
It is not a score, rating or formal assessment and cannot change grade eligibility automatically.

The supervisor can view their own submitted note but cannot view the person's full notes history.
Authorised Umpire Coordinators can add notes and view the complete log.

### Restricted coordinator notes

Coordinator notes operate as an append-only log visible only to authorised Umpire Coordinators.

Replacement-request notes are visible only to:

- the Umpire who submitted the request; and
- authorised Umpire Coordinators for the association.

Health or bereavement details may be corrected or redacted by an authorised privacy administrator.
The event, date and redaction audit remain. Abusive, threatening or harassing text is retained as
restricted evidence and cannot be edited by the submitter after submission.

No Safety or Incident and Discipline case is created or linked in the first version. Formal action
remains outside the Coordination Module.

The product decision is to retain the history permanently. Because notes can contain health or
bereavement information, the Production plan requires a documented purpose, privacy review and
redaction process before release.

## Offer workflow

### Creating an offer

For one open position, the offerer can select one or more eligible recipients. One active offer group
exists per position.

While it remains open, the offerer may add more recipients. New recipients receive:

- the same current note;
- the same existing deadline; and
- only the response time that remains.

Adding recipients never restarts the deadline and is recorded in history.

### Offer notes

Every offer may contain a recipient-facing note, including information about payment, game
difficulty, safety or special duties. Internal coordinator notes remain separate and are never sent
to recipients.

A sent note cannot be silently edited:

- the original remains in history;
- every active recipient receives the revision;
- the editor and time are recorded;
- minor spelling corrections do not reset responses; and
- important changes involving payment, duties, difficulty, safety, time or location cancel existing
  acceptances and require a new response.

The offerer records whether a revision is minor or important.

### Response deadline

- Default response time: 72 hours.
- The offerer may adjust the exact date and time.
- An offer may be sent at any time before match/activity start.
- The deadline may be as late as the start time but never later.
- Offers with less than two hours remaining display **Urgent**.

### Reminders

For normal offers:

- first reminder: 24 hours before deadline;
- second reminder: 4 hours before deadline.

For an offer shorter than 24 hours:

- first reminder: halfway through the available response time;
- second reminder: 1 hour before deadline when enough time remains.

Responding, withdrawing, being confirmed, being marked not selected, withdrawal of the offer or
fixture cancellation stops future reminders. Stable deduplication prevents duplicate reminders.

### Recipient responses

A recipient can:

- accept;
- decline with an optional reason; or
- withdraw an acceptance while still awaiting offerer confirmation.

Acceptance changes the response to **Accepted — awaiting confirmation**. Other recipients may still
respond, and the offerer may wait for a preferred person or confirm any accepted person immediately.

Recipients never see who else received, accepted or declined the offer.

### Offerer confirmation

The offerer may confirm an accepted person at any time before match/activity start. Confirmation:

- creates the official assignment;
- marks the chosen response **Confirmed**;
- marks the remaining active recipients **Not selected**;
- cancels their reminders; and
- notifies everyone of the outcome.

If the original offerer becomes unavailable, another authorised coordinator with the same
responsibility and organisation scope may take over. A takeover reason is mandatory. SportStack
records and notifies the original offerer, replacement coordinator, reason and time.

### After match/activity start

Normal offers and pending acceptances close at the start time.

An authorised coordinator may directly record the person who actually performed the duty without
recipient acceptance. This is an audited late roster correction and sends in-app and email notice to
the recorded person.

The notice includes **Report incorrect**. A disputed record:

- remains in history;
- pauses Matrix totals;
- shows **Roster disputed** to the Umpire Match Voting roster check; and
- requires an authorised coordinator to correct it or confirm it with a mandatory note.

## Assignment conflicts and availability

### Hard overlap rule

Confirmed assignments must never overlap. SportStack hard-blocks:

- two positions on the same fixture;
- Umpire and Technical Bench duties on the same fixture;
- fixtures or activities whose scheduled times overlap; and
- any other overlapping confirmed duty.

People may accept overlapping offers, but only a non-overlapping duty can be confirmed. The secure
confirmation operation rechecks current assignments immediately before saving.

Back-to-back duties at different venues are allowed. Travel time is the person's responsibility in
the first version.

The Supervising Umpire relationship is not treated as a conflicting second duty, but self-supervision
is blocked.

### Availability

Blank availability has no effect and shows no warning.

Someone explicitly marked **Unavailable** may still receive an offer. The offerer sees a strong
warning and must enter an override note. If the person accepts and is confirmed, the fixture
availability becomes:

- **Umpiring**;
- **Technical Bench**; or
- **Volunteering**.

When an assignment is replaced or cancelled, the role-specific availability value is cleared back
to the default blank state. An older availability answer is not restored. Availability changes remain
in history.

When a person updates availability, SportStack checks their confirmed fixtures and activities. They
cannot mark themselves available for an overlapping duty.

### Warning overrides

Grade eligibility, expired qualification and explicit-unavailability warnings may be overridden.
Each override requires a mandatory note and records:

- coordinator;
- date and time;
- warning type;
- note; and
- related offer and fixture/activity.

Overlapping confirmed assignments cannot be overridden.

## Replacement workflow

Before confirmation, an accepted recipient may withdraw immediately and the offerer is notified.

After confirmation, the person must request a replacement. The request requires a note and changes
the roster display to **Replacement requested — not available**.

The original person remains listed until a replacement is confirmed. A replacement always uses a
new offer; earlier acceptances are never reused. Previously interested people may receive the new
offer but must accept again.

Confirming the replacement:

- marks the original assignment **Replaced**;
- creates a new confirmed assignment;
- clears the original person's role-specific availability to blank;
- sets the replacement person's availability; and
- preserves the complete history.

## Fixture changes

Material changes are:

- fixture date;
- start time;
- venue;
- pitch; or
- either team.

A material change:

- withdraws pending offers using the old details;
- notifies affected people;
- clears role-specific availability;
- changes confirmed assignments to **Reconfirmation required**;
- requires the person to accept the changed details; and
- requires the offerer to confirm again.

Scores and ordinary fixture notes do not trigger reconfirmation. This workflow will be tested in Dev
and adjusted if it creates unnecessary work.

## Technical Bench safeguards

Technical Bench eligibility uses a separate capability.

SportStack shows:

- **First Technical Bench duty** when the person has no completed Technical Bench history; and
- a pairing warning when both Technical Bench officials are under 18 on the fixture date.

SportStack calculates age from each profile's date of birth on the fixture date. At least one of the
two confirmed Technical Bench officials must be 18 or older to clear the pairing warning.

If either date of birth is missing, SportStack shows **Age unknown**, never assumes the person is an
adult, and requires a coordinator override note. Exact birth dates are not shown on the normal
Coordination screen.

These are warnings rather than hard blocks. Continuing through a first-duty, under-18 pairing or
age-unknown warning requires a mandatory coordinator note, and every warning is rechecked at
confirmation.

## Completed-duty history

An assignment counts in Umpire Matrix game and grade totals only after the fixture is completed.
Cancelled fixtures do not count. Disputed assignments pause the count until resolved. Corrections
recalculate totals.

## Historical RevSports Umpire records

Historical records use the existing player-mapping pattern:

- a unique exact match may link automatically;
- duplicate or non-exact names require manual mapping;
- fuzzy names never assign a profile automatically;
- unmapped records remain **Imported — unverified**; and
- every manual mapping records who completed it and when.

The coordinator can review and correct the identity, grade, fixture link and supervising-Umpire
information, then mark the record reviewed. The original imported value remains preserved beneath an
audited correction layer.

Reviewed records count in Matrix totals and help the coordinator complete grade eligibility.
Unreviewed records remain separate. Historical mapping does not create retrospective roster-mismatch
alerts or automatic grade sign-off.

## Umpire Match Voting roster checks

After an Umpire Match Voting submission is received, compare its Umpire identity with confirmed,
completed and corrected Umpire assignments for that fixture.

| Result | Meaning |
|---|---|
| `MATCHED` | The linked submitting Umpire is rostered. |
| `MISMATCH` | The linked identity is known and is not rostered. |
| `NO_ROSTER` | No confirmed/completed Umpire roster exists. |
| `UNVERIFIABLE` | Text-only, unresolved or ambiguous identity. |
| `VALID_PROXY` | An authorised proxy submitted for a rostered Umpire. |
| `ROSTER_DISPUTED` | The compared late roster record is disputed. |

Only `MISMATCH` is a confirmed mismatch. Association Umpire Coordinators review flags; Super Admin
is an audited backup.

A confirmed mismatch does not change, delete, block or reject the Umpire Match Voting submission.
The flag, coordinator review and note remain visible while the normal voting workflow continues.

Roster corrections rerun the check. Ambiguous names are never auto-linked.

## Notifications and delivery status

While a capability is active, required Coordination notifications cannot be disabled.

Version 1 uses:

- in-app notifications; and
- email notifications.

No SMS or push delivery is included initially.

Notification events include invitations, offers, reminders, acceptances, declines, withdrawals,
confirmation required, confirmed, not selected, expiry, takeover, replacement request, replacement,
fixture change, reconfirmation, late roster addition, dispute and roster mismatch review.

Email links open the secure SportStack response screen; the link itself never changes state.

Coordinators can see:

- in-app **Unread** or **Read**;
- email **Queued**, **Sent** or **Failed**; and
- date/time of each delivery attempt.

Email-open tracking is not used. A failed email warns the coordinator but does not cancel an offer
because the in-app offer remains available.

## Main views

### Coordinator dashboard

Show open positions, pending offers, deadlines, next reminders, responses awaiting confirmation,
declines, withdrawals, expired offers, confirmed assignments, replacement requests, reconfirmation,
warning overrides and notification failures.

### Fixture coordination

Show fixture details, two Umpire positions, two Technical Bench positions and optional supervision
links. Each position shows offer recipients, response states, deadlines, warnings and assignment
history within the viewer's permission scope.

### Umpire Matrix

Show Umpires, grade eligibility, qualifications, completed-duty counts, supervision, availability,
current workload, replacement history, imported-history review and restricted coordinator logs.

### My offers and assignments

Show pending offers first, including deadline, note, fixture/activity details and Accept/Decline.
Clearly separate **Accepted — awaiting confirmation**, confirmed, replacement requested, replaced,
cancelled and completed records.

### Volunteer activities

Allow authorised Volunteer Coordinators to create any basic scoped activity and position structure.
Version 1 uses direct offers only. Browse-and-claim positions remain parked.

### Roster mismatch review

Show Umpire Match Voting results that are mismatched, unrostered, unverifiable or roster-disputed,
with final roster and correction history.

## Access-control requirements

- Recipients read and respond only to their own offers.
- People manage only their own availability.
- Coordinators act only within their responsibility and organisation scope.
- Capability does not grant coordinator access.
- Umpire grade and private-log access is association-scoped.
- A supervisor can add and read their own supervision note but cannot read the full log.
- Recipients never see competing recipients or their responses.
- Normal confirmation belongs to the offerer; takeover requires equivalent scope and an audited reason.
- Workflow writes use narrow database operations that enforce states, scope and history.
- New exposed tables require explicit API grants and Row Level Security.
- Elevated functions must use fixed search paths, explicit authentication/authorisation and restricted
  execution grants.
- Realtime visibility must obey the same row access rules as normal reads.

## Confirmed boundaries

- Fixtures remain the source of match information.
- No automatic confirmation.
- No overlapping confirmed assignments.
- No public volunteer claiming in version 1.
- No SMS or push notifications in version 1.
- No automatic misconduct referral or Safety/Discipline case link.
- No automatic grade sign-off from history or supervisor notes.
- No fuzzy automatic identity matching.
- No retrospective roster-mismatch flood for historical records.
- No Production, schema, permission or live-data change is authorised by this document.

## Remaining technical checks — not product questions

Before a migration is written, the implementation plan must verify:

- the live Dev schema and grants;
- exact permission helper functions and hierarchy behaviour;
- account-invitation and capability-invitation reuse;
- notification email dispatch and delivery tracking reuse;
- all fixture mutation paths that must trigger reconfirmation;
- match end-time fallback when `scheduled_end_at` is missing;
- safe profile date-of-birth access without exposing the date;
- RevSports Umpire mapping counts and ambiguous identities;
- future-fixture position creation and idempotency; and
- privacy approval for permanent sensitive-note history before Production.

The detailed delivery sequence, proposed records, state transitions, permission matrix and test gates
are in `docs/coordination-module-implementation-plan.md`.

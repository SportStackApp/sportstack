# SportStack Access Control Model

Status: Approved target design - not yet implemented in full

Version: 1.0

Decision date: 28 August 2026

## 1. Purpose and implementation boundary

This document records the access-control model agreed for the future SportStack design. It is the
canonical product design for scopes, responsibilities, permission sets, capabilities, module
entitlements, temporary workflow assignments and record-specific eligibility.

> **Important:** this is a target model. It does not claim that the current application or live
> database already behaves this way. Existing roles, routes, database identifiers, permission
> helpers and public portals must be checked before implementation. Any change requires a staged
> compatibility and migration plan.

The model deliberately keeps these concepts separate:

- **Membership** says where a person belongs.
- **Scope** says where a responsibility applies.
- **Responsibility** says which job the person is performing.
- **Permission set** says which actions that responsibility can perform.
- **Capability** says which operational work a person is eligible to be offered.
- **Module entitlement** says whether the paid workflow is available at that scope.
- **Record eligibility** says whether the person can act on a particular fixture, vote, case or
  task.

The target access calculation is:

```text
Active account
+ relevant membership, capability or assignment
+ active Working as responsibility and its permission set
+ active module entitlement for the scope
+ record-specific eligibility
- conflicts, suspensions and other restrictions
= effective access
```

No single role controls everything. Higher scope does not mean unrestricted access.

## 2. Organisation and scope model

### 2.1 Membership hierarchy

```text
SportStack account
        |
        v
   Association
        |
        v
      Club
        |
        v
      Team
```

The access-control scopes are:

1. Association
2. Club
3. Team

Association is the parent of Club, and Club is the parent of Team.

### 2.2 Division and Season

Division and Season are not access-control scopes.

A Division is a competition configuration level used for:

- Team placement;
- player eligibility rules;
- Umpire competency;
- fixtures and ladders;
- Umpire Match Voting structure; and
- Division-specific module settings.

A Season is a time-based grouping used for:

- Divisions and Team entries;
- fixtures;
- Primary and Secondary Team relationships;
- player exemptions;
- voting configuration snapshots; and
- seasonal results and history.

People do not join a Division or Season, and no permanent responsibility is attached directly to
either one. They remain filters and configuration levels within an authorised Association or Team
context.

### 2.3 Downward access

Scope sets the outer boundary. The responsibility's permission set determines how far access can
reach inside that boundary.

| Responsibility | Downward access |
|---|---|
| Association Admin | Association, Clubs and Teams for administration |
| Association Executive | Association governance; child information only where required |
| Umpire Coordinator | Association Divisions, fixtures and Umpires across Clubs |
| Technical Bench Coordinator | Association fixtures and Technical Bench Participants |
| Association Volunteer Coordinator | Association-wide volunteer activities |
| Club Admin | That Club and its Teams |
| Club Committee Member | Club governance; Team information only where required |
| Club Volunteer Coordinator | Relevant Club and Team volunteer activities |
| Team Management | One exact Team |
| Player | Their Team participation and permitted fixture information |

Module coverage is checked separately. Association-wide entitlement makes a module available to
child scopes, but it does not give a person extra permissions.

## 3. Working as context

### 3.1 Independent work identities

One account may hold several responsibilities, but they operate independently. Permissions from
different responsibilities are not merged into a single super-context.

Example:

```text
Aaron's SportStack account
|
+-- Player - Division 1 Men
+-- Umpire Coordinator - Grampians Hockey Association
+-- Secretary - Grampians Hockey Association
+-- Team Management - Under 16 Girls
```

Each entry represents one responsibility, capability or participation context attached to one
exact scope.

### 3.2 Manual switching

When the person changes **Working as** manually, SportStack:

1. activates the selected responsibility;
2. returns to SportStack Home;
3. clears the Association -> Club -> Division -> Team cascade;
4. clears any selected fixture or workflow; and
5. loads navigation and modules for the new responsibility.

The system still knows the responsibility's permitted boundary even though the visible cascade
starts empty.

Every sensitive action records the account, active responsibility, scope and time.

### 3.3 Notifications and chats

The account has one combined communication centre containing all currently authorised:

- notifications;
- chats;
- unread counts; and
- work items from every responsibility and scope.

Each item clearly identifies its responsibility and scope. Opening a notification or scoped chat
is an intentional exception to the manual-switch rule. SportStack checks current access,
automatically activates the linked responsibility, clears the previous context, loads the correct
scope and opens the exact destination.

If the responsibility has ended, the item does not open and SportStack explains that access is no
longer available.

The principle is:

> One combined inbox for awareness, but one active responsibility for taking action.

The existing drop-down selector can remain initially. A more polished Working as experience using
cards, logos, colours, recent contexts and better grouping is parked for later.

## 4. Responsibility, title, permission and capability rules

### 4.1 Responsibility formula

```text
Displayed title
+ standard permission set
+ exact scope
= responsibility assignment
```

A custom title does not create permissions. It must map to an approved standard permission set.
SportStack controls the standard permission sets. Organisations appoint people to them but cannot
create unsafe individual-permission combinations.

### 4.2 Permanent Working as catalogue

#### Association

- Association Admin
- President
- Vice President
- Secretary
- Treasurer
- General Committee Member
- Custom Committee position
- Umpire Coordinator
- Technical Bench Coordinator
- Volunteer Coordinator
- Umpire
- Technical Bench Participant
- Volunteer

#### Club

- Club Admin
- President
- Vice President
- Secretary
- Treasurer
- General Committee Member
- Custom Committee position
- Volunteer Coordinator
- Volunteer

#### Team

- Team Management, displayed as Team Manager, Coach, Assistant Coach or other Team Staff
- Player

Team Manager and Coach use one **Team Management** permission set. Their titles describe the job;
they do not create different access.

### 4.3 Temporary Working as assignments

- Case Coordinator
- Lead Investigator
- Support Investigator
- Tribunal Administrator
- Tribunal Member
- Tribunal Chair
- Appeal Administrator
- Appeal Board Member
- Appeal Chair
- Safety Action Owner

These assignments apply to one exact case or action. They can be activated from My Work, My Reports
and Cases, a notification, or a temporary section in Working as.

### 4.4 Items that are not responsibilities

- Association, Club or Team membership
- Primary or Secondary Team status
- Fill-in fixture participation
- Division or Season
- Junior status
- Umpire competency
- Supervising Umpire fixture assignment
- Player MVP Voting eligibility
- Umpire Match Voting eligibility or proxy status
- Reporter, Reported Person, Affected Person or Witness
- Shared-authority grant
- Paid-module entitlement

### 4.5 Responsibilities deliberately excluded for now

- Team Admin - Team Management covers it
- separate Coach permission set - Team Management covers it
- Competition Coordinator
- Safety Coordinator - authorised executives and administrators manage Safety Hub for now
- permanent Supervising Umpire role
- permanent Voter role
- Division-level responsibilities

## 5. Permission matrices

### 5.1 Association responsibilities

| Responsibility | Main access | Important limits |
|---|---|---|
| Association Admin | Association setup, Clubs, administrators, module configuration and Coordinator appointments | No automatic Committee vote or confidential case access |
| President | Executive and Committee management, competition settings, incident escalation, Circular Resolutions and shared authority | Cannot control SportStack module entitlement |
| Vice President | General Executive access, incident escalation and shared authority | Does not automatically replace the President's title |
| Secretary | Meetings, minutes, Committee records, Circular Resolutions, correspondence and shared authority | Cannot escalate incidents unless authority is shared |
| Treasurer | Financial records, relevant reports, Committee work and shared authority | Cannot change SportStack module entitlement |
| General Committee Member | Committee papers, discussion and voting | No executive or administrative action unless delegated |
| Custom Executive position | Approved Executive permission set with a custom title | Limited to the standard set and exact scope |
| Custom General position | General Committee permission set with a custom title | No executive authority |
| Umpire Coordinator | Umpire capability, competency, availability, rostering, supervision and Umpire Match Voting administration | No Committee or general Association administration |
| Technical Bench Coordinator | Capability, availability, rostering, Junior indicators and permitted proxy workflows | No Committee or general Association administration |
| Volunteer Coordinator | Association Volunteer capabilities, opportunities, offers and assignments | No unrelated Club control |
| Umpire | Own competency, availability, offers, assignments and permitted fixture workflows | Cannot manage other Umpires |
| Technical Bench Participant | Own availability, offers, assignments and permitted fixture workflows | Cannot manage other participants |
| Volunteer | Own interests, availability, offers and assignments | Cannot manage other Volunteers |

### 5.2 Club responsibilities

| Responsibility | Main access | Important limits |
|---|---|---|
| Club Admin | Club setup, membership requests, Teams, administrators, module configuration and Coordinator appointments | Cannot change Association settings or SportStack entitlements |
| President | Club Executive and Committee management, exemption applications, safety workflows, Circular Resolutions and shared authority | Cannot change Association rules or independently open disciplinary cases |
| Vice President | General Club Executive access, exemption and safety workflows | Does not automatically replace the President's title |
| Secretary | Meetings, minutes, Committee records, Circular Resolutions, correspondence and shared authority | Additional executive authority must be included or shared |
| Treasurer | Club financial records, relevant reports, Committee work and shared authority | Cannot activate paid modules |
| General Committee Member | Club Committee papers, discussion and voting | No executive or administrative action unless delegated |
| Custom Executive position | Approved Club Executive permission set with a custom title | Cannot exceed Club scope |
| Custom General position | General Committee permission set with a custom title | No executive authority |
| Volunteer Coordinator | Club Volunteer capabilities, opportunities, offers and assignments | Cannot manage Association or other Club Volunteers |
| Volunteer | Own interests, availability, offers and Club assignments | Cannot manage other Volunteers |

### 5.3 Team responsibilities and participation

| Responsibility or participation | Main access | Important limits |
|---|---|---|
| Team Management | Team memberships, availability, selections, line-ups, fixture information, communication and enabled workflows | No Club administration, Association settings or other Team access |
| Player - Primary | Team information, availability, selections, communication and eligible Player MVP Voting | Cannot manage Team members or settings |
| Player - Secondary | Normal Team access while actively associated with that Team | Primary status remains elsewhere |
| Fill-in participant | Information and actions required for one fixture, including eligible Player MVP Voting | No ongoing Team membership or general Team access |

Team Management can prepare an exemption application but cannot approve it. It sees relevant
guardian and contact details but not unnecessary personal information.

### 5.4 Disciplinary assignments

| Temporary assignment | Main access | Important limits |
|---|---|---|
| Case Coordinator | Stages, participants, appointments, deadlines, notices and released information | Cannot decide findings or alter evidence |
| Lead Investigator | Investigation material and final Investigation Report | Cannot manage the Tribunal or decide sanctions |
| Support Investigator | Assigned investigation material, evidence collection and contributed notes | Cannot finalise the Investigation Report |
| Tribunal Administrator | Hearing dates, notices, attendance and approved case pack | Cannot deliberate or vote unless separately appointed |
| Tribunal Member | Approved case pack, hearing and individual decision | Cannot see private Investigator working notes |
| Tribunal Chair | Member access plus hearing management and final findings and sanctions | Cannot change original evidence |
| Appeal Administrator | Appeal checks, notices, dates and approved documents | Cannot decide the appeal |
| Appeal Board Member | Approved appeal material and decision participation | Cannot have investigated or decided the original case |
| Appeal Chair | Board access plus proceeding management and final outcome | Cannot rewrite the original Tribunal record |

Every appointment applies to one case, requires acceptance and a conflict declaration, changes to
read-only when its stage finishes and provides no access to unrelated cases.

### 5.5 Disciplinary participants

| Case relationship | Can access | Cannot access |
|---|---|---|
| Reporter | Their Incident Report, requests, responses, status updates and released outcome | Other statements, internal notes or deliberations |
| Reported Person | Allegations, disclosed evidence, responses, hearing details and released decisions | Protected identities, private notes or unrelated evidence |
| Affected Person | Their statement, requests, relevant updates and released information | The full investigation or other participants' material |
| Witness | Questions, their statement and follow-up requests | General case information, other evidence or deliberations |
| Other Participant | Specifically assigned information and actions | Everything not deliberately released |
| Guardian or Support Person | Information formally shared for the person they support | Independent access to the whole case |

These relationships appear under My Reports and Cases. They do not create permanent Working as
responsibilities.

### 5.6 Safety Hub

| Access holder | Main access | Important limits |
|---|---|---|
| Reporter | Their safety report, requests and released updates | No broader risk register or other reports |
| Association Admin or authorised Executive | Association safety reports, risk controls, reviews and actions | Club reports require escalation or an Association-wide process |
| Club Admin or authorised Executive | Safety reports, risks and actions for that Club | No other Club or Association-only reports |
| Safety Action Owner | Their corrective action, due date and required information | No general report or risk-register browsing |
| Committee Member | Information formally released for a meeting or resolution | No automatic personal or medical details |
| Affected participant | Their forms, requests and released information | No general Safety Hub access |

Safety Hub detail is intentionally left at this level until its workflow is designed further.

### 5.7 Three separate decision systems

| Area | Player MVP Voting | Umpire Match Voting | Committee Circular Resolution |
|---|---|---|---|
| Purpose | Players recognise Team peers | Official post-match votes | Committee governance decisions |
| Configuration | Team and module settings | Division voting structure | Committee governance settings |
| Administrator | Team Management | Umpire Coordinator | Authorised Committee Executive |
| Eligible voters | Players who participated | Division submission mode and fixture context | Active voting Committee members |
| Submissions | One per eligible player | Single, individual Umpire or collective | One per eligible Committee member |
| Public portal | No in the target context model | Optional secure public portal | No |
| Proxy | No | Yes | No by default |
| Results | Restricted until closed | Restricted until closed | Committee decision history |
| Audit | Eligibility and submission status | Submission, proxy and reopening history | Motion, quorum, conflicts and votes |

The three systems never share eligibility, submissions or permissions.

### 5.8 Paid modules

| Access holder | Module access |
|---|---|
| SportStack Admin | Grant, change, suspend or end entitlement and coverage |
| Association Admin | Configure entitled Association modules and permitted Association-wide defaults |
| Club Admin | Configure independent Club modules or permitted local settings |
| Association Executive | Operate authorised Association workflows; no entitlement control |
| Club Executive | Operate authorised Club workflows; no entitlement control |
| Coordinator | Operate only the module connected to that responsibility |
| Team Management | Operate enabled Team workflows; no organisation-wide settings |
| Participant | Use actions made available through membership, capability or assignment |

### 5.9 Notifications and chats

| Responsibility | Communication access |
|---|---|
| Association Admin or authorised Executive | Association-wide announcements and permitted organisation conversations |
| Club Admin or authorised Executive | Club-wide announcements and permitted Club conversations |
| Team Management | Team members, guardians and fixture conversations |
| Umpire Coordinator | Umpires, Supervising Umpires and relevant fixture officials |
| Technical Bench Coordinator | Technical Bench Participants and relevant fixture officials |
| Volunteer Coordinator | Volunteers within the exact Coordinator scope |
| Participant | Conversations in which they are included |
| Case assignment | Protected messages permitted for the exact case |
| Personal account | Personal direct messages and the combined inbox |

Messages record the account and active responsibility. Case content remains in the protected case
workflow even though alerts appear in the combined inbox.

### 5.10 Memberships and capabilities

| Item | How it starts | Access created |
|---|---|---|
| Association membership | Person joins immediately | Basic Association connection and child-membership requests |
| Club membership | Club approval | Basic Club member access |
| Team membership | Team Management or Club approval | Ongoing Player access to that Team |
| Primary Team | Automatic when none exists, or changed by player | Primary participation status |
| Secondary Team | Automatic when another Primary exists | Secondary participation status |
| Fill-in | Added to one fixture by Team Management | Fixture-only Player access |
| Umpire capability | Approved by Umpire Coordinator | Availability, competency and assignment workflows |
| Technical Bench capability | Approved by Technical Bench Coordinator | Availability and assignment workflows |
| Volunteer capability | Approved by relevant Volunteer Coordinator | Interests, availability and assignment workflows |

### 5.11 Appointments and handovers

| Action | Who controls it |
|---|---|
| Appoint Association Coordinator | Association Admin |
| Appoint Club Volunteer Coordinator | Club Admin |
| Appoint Team Management | Club Admin or authorised Club Executive |
| Record Committee position | Authorised person following the Committee's governance decision |
| Share selected Executive authority | The Executive who owns that authority |
| Transfer Case Coordinator | Current Case Coordinator; ends when recipient accepts |
| Replace Investigator, Tribunal or Appeal assignment | Relevant Case or Appeal Coordinator |
| Abandon normal responsibility | Current holder; notifications are sent |

Arranging a handover is not appointing a replacement. The current holder may nominate someone, but
the proper appointing authority confirms the appointment and the recipient accepts. Coordinators
cannot delegate their own permissions. Committee positions cannot be privately transferred outside
the organisation's governance process.

### 5.12 Personal information and guardians

| Access holder | Personal information available |
|---|---|
| Account owner | Full profile, memberships, responsibilities and settings |
| Linked guardian | Junior's memberships, availability, forms, consent and relevant communication |
| Ordinary member | Public name, profile image and sporting associations |
| Team Management | Relevant player contact and guardian details |
| Umpire Coordinator | Umpire contact, availability and competency |
| Technical Bench Coordinator | Contact, availability and Junior indicator |
| Volunteer Coordinator | Contact, availability, interests and required compliance status |
| Executive or Admin | Membership information required within the exact scope |
| Case assignment | Personal information released for that exact case |
| Emergency access holder | Required emergency information for an active fixture or activity |

Full date of birth remains hidden when a calculated result is enough. Medical information is
separately protected. Emergency access is time-limited and audited.

### 5.13 Availability, rostering and selection

| Action | Who can perform it | Limits |
|---|---|---|
| Set availability | Account owner or linked guardian for a Junior | Coordinators see status, not private calendar detail |
| Select Team players | Team Management | Eligibility, exemptions and conflicts are checked |
| Add fixture Fill-in | Team Management | Fixture-only access; no Team membership |
| Set Umpire competency | Umpire Coordinator | Per Division with history |
| Offer or assign Umpires | Umpire Coordinator | Competency, availability and conflict gates |
| Assign Supervising Umpire | Umpire Coordinator | Must be approved to supervise the Division |
| Offer or assign Technical Bench | Technical Bench Coordinator | Junior safeguards and availability checked |
| Offer or assign Volunteers | Volunteer Coordinator | Exact Coordinator scope |
| Accept or decline offer | Recipient or permitted guardian | Creates or rejects commitment |
| Override warning | Authorised Coordinator or Team Management | Reason required and audited |
| Override hard block | Not normally permitted | Underlying restriction must be resolved |

### 5.14 Audit records, reports and exports

| Access holder | Audit and reporting access |
|---|---|
| Account owner | Own login, membership, responsibility and submission history |
| SportStack Admin | Platform, entitlement and support activity; no automatic confidential content |
| Association Admin | Administrative activity within the Association boundary |
| Club Admin | Administrative activity within the Club boundary |
| Executive | Governance and workflow history permitted by their responsibility |
| Coordinator | Module and participant activity they manage |
| Case Coordinator | Audit history for the exact case |
| Investigator, Tribunal or Appeal assignment | History relevant to the assigned stage |
| Participant | Own submissions, amendments and released information |

Audit records cannot be edited or deleted through normal screens. Reports and exports cannot
contain information the active responsibility could not view on screen. Sensitive exports require
a reason, download links expire and permission is checked again when opened.

### 5.15 Suspension, leaving and account closure

| Action | Who can perform it | Result |
|---|---|---|
| Suspend responsibility | Appointing authority or higher authorised scope | Access stops temporarily; history remains |
| End responsibility | Appointing authority following required process | Appointment permanently ends |
| Abandon normal responsibility | Current holder | Access ends and appropriate people are notified |
| Arrange handover | Holder nominates, authority confirms, recipient accepts | Old responsibility ends after acceptance |
| Leave Team | Member | That Team participation ends |
| Leave Club | Member | Club and child Team memberships end |
| Leave Association | Member | All child memberships and capabilities end |
| Suspend organisation membership | Organisation Admin | Only that organisation's access is affected |
| Suspend complete account | SportStack Admin | Every SportStack context is blocked |
| Close account | Account owner after checks | Login ends; required historical records remain |

Active disciplinary assignments must be transferred or formally released before leaving. Normal
responsibilities may be abandoned. Upcoming operational commitments trigger warnings, withdrawal
and notifications.

## 6. Membership and player participation

### 6.1 Joining

```text
SportStack account
        |
        v
Join Association - immediate
        |
        v
Request Club or Team membership - approval required
```

- Association membership provides only basic member access.
- Joining a Club requires authorised Club approval.
- Joining a Team requires Team Management or Club approval.
- Approving a Team request creates the required Club membership if needed.
- Administrative or operational responsibilities are appointed separately.

### 6.2 Primary, Secondary and Fill-in

Primary and Secondary are ongoing Team participation relationships. Fill-in is a fixture
participation relationship only.

```text
Team membership approved
        |
        v
Does the player already have a Primary Team in the applicable competition and Season?
        |
   +----+----+
   |         |
  No        Yes
   |         |
Primary   Secondary
```

The person approving Team membership does not choose the status.

The player controls Primary Team changes from their Profile. They can choose only an already
accepted Team membership. The old Primary becomes Secondary, the new Primary takes effect from the
recorded time, affected Teams and Clubs are notified, future eligibility is recalculated and
historical fixtures remain unchanged. Association Executive approval is not required.

A Fill-in is added to one fixture, receives fixture-only access and may become eligible for Player
MVP Voting for that fixture. It does not create ongoing Team membership.

### 6.3 Division eligibility rules

Each Division can define:

- no age restriction;
- born on or after a set date;
- born on or before a set date;
- an optional minimum and maximum date of birth; and
- the Season or reference date used for assessment.

SportStack calculates eligibility without exposing unnecessary dates of birth. An out-of-range
selection displays a clear warning and requires an approved exemption or other specifically
permitted recorded override before it can proceed.

### 6.4 Player eligibility exemptions

A Club can apply for a player to participate outside the normal Division rule.

The application records:

- player;
- current Team and Division;
- requested Team and Division;
- reason;
- one fixture, number of rounds, date range or rest-of-Season duration; and
- supporting information.

Team Management may prepare the draft. An authorised Club Executive submits it to the Association
Committee. The Committee can approve, approve with conditions, provisionally approve, temporarily
approve, request more information or reject.

If the Committee proposes different conditions, the Club accepts them before the exemption becomes
active. Conditions may include fewer rounds, a review after specified fixtures, an end date or a
restriction to one Team.

An active exemption permits the otherwise ineligible selection and displays an **Approved
exemption** indicator. Its application, decision, conditions, review and expiry remain in history.

## 7. Committee and shared authority

An Association or Club Committee can contain:

- President;
- Vice President;
- Secretary;
- Treasurer;
- General Committee Member; and
- custom Executive or General positions.

Each appointment has dates and evidence of the election, meeting or resolution that authorised it.
Committee voting rights come from active voting Committee appointments, not ordinary organisation
membership.

### 7.1 Share authority

Every Executive position can share selected delegable authority with another active member of the
same Committee.

The grant records:

- authority shared;
- giver and recipient;
- start and end dates;
- reason;
- notifications; and
- complete audit history.

The recipient keeps their existing title and cannot re-delegate the authority. The grant ends when
either appointment ends.

The following are not delegable:

- an individual's Committee vote;
- conflict declarations;
- the ability to share authority;
- appointment or removal of elected Executive positions;
- final Tribunal or Appeal decisions; and
- paid-module entitlement.

An Acting President appointment is a separate, broader and time-limited governance appointment.

### 7.2 Circular Resolutions

An authorised Executive prepares the motion, background, attachments, opening and closing times,
quorum and majority rules. The motion locks when voting opens. A material change requires closing
and restarting the vote.

Eligible voters are captured from active voting Committee members when the resolution opens.
Members vote For, Against or Abstain. Conflicts are declared and treated according to the
Committee's quorum rules.

The permanent record contains the exact motion, eligible members, votes, abstentions, conflicts,
quorum calculation, result, conditions, comments, attachments and people who opened and finalised
the resolution.

An exemption application creates a linked, pre-filled Circular Resolution. The application and
resolution remain separate records but appear in one combined history. The exact storage and form
behaviour of the current Committee workflow must be verified before implementation.

## 8. Paid modules

SportStack Admin controls paid-module entitlement. Organisation administrators cannot self-grant a
paid module.

Coverage can be:

- Association only;
- whole Association, including all child Clubs and Teams;
- one Club and its Teams; or
- Off.

For whole-Association coverage, the Association sets defaults and may lock settings that must be
consistent. Clubs may adjust settings only where the Association permits. A Club with its own
entitlement controls its local configuration independently.

### 8.1 Turning a module off

Normal expiry or cancellation:

- stops new workflows;
- allows active workflows to be completed;
- allows existing assignments to be withdrawn or closed;
- retains history and configuration as read-only; and
- restores the existing information if entitlement returns.

An active disciplinary case can continue to completion, an open Player MVP Voting or Umpire Match
Voting session can close, and existing operational assignments can be managed. New workflows
cannot start.

Emergency suspension by SportStack Admin may block a module immediately for security, misuse or
legal reasons. It requires a reason, notifications, instructions about remaining access and a full
audit record.

## 9. Coordination, capability, availability and rostering

### 9.1 Coordinator boundaries

- Umpire Coordinator: Association only
- Technical Bench Coordinator: Association only
- Volunteer Coordinator: Association or Club

Coordinators cannot delegate their permission set. Continuity comes from appointing multiple
Coordinators. They manage the matching participant workflow rather than owning people as sub-roles.

### 9.2 Capability acceptance

A person may request a capability or receive a Coordinator invitation. The other party accepts
before it becomes active.

- Umpire capability requires Association connection and Umpire Coordinator approval.
- Technical Bench capability requires Association connection and Technical Bench Coordinator
  approval.
- Volunteer capability is attached to an Association or Club and approved by its Volunteer
  Coordinator.

Capability makes the person eligible for offers; it does not roster them automatically.

### 9.3 Umpire competency matrix

For every Division, Umpire competency contains:

- Not approved;
- Approved with supervision;
- Approved independently; and
- a separate **Can supervise** flag.

Supervising Umpire is a fixture assignment, not a permanent role.

Umpire rostering uses three gates:

```text
Competency + availability + no conflict = eligible candidate
```

An Umpire approved only with supervision requires a linked Supervising Umpire on the same fixture.
The pairing is provisional until both accept. An Umpire cannot supervise themselves. If either
withdraws, the fixture returns to Needs attention.

Offers may be sent to multiple eligible people. The first acceptance fills the position and closes
the remaining offers. Fixture, Division, competency, availability or conflict changes trigger
revalidation. SportStack flags confirmed assignments for review rather than silently removing
people.

### 9.4 Shared availability engine

Availability belongs to the person's account and is checked across:

- playing;
- Umpiring;
- Umpire supervision;
- Technical Bench;
- volunteering; and
- Team Management commitments.

People can record available, unavailable or unsure periods and recurring availability. Confirmed
assignments create commitments. SportStack checks overlap and possible travel-time clashes.
Explicitly unavailable people do not receive normal offers. Accepting one offer updates conflicting
offers. Coordinators see availability status, not private calendar details.

## 10. Voting workflows

### 10.1 Player MVP Voting

- One session belongs to one completed fixture and one Team.
- Team Management opens, monitors and closes it.
- Only players recorded as participating can vote or be nominated.
- Primary, Secondary and Fill-in players are treated equally for that fixture.
- Team Management or Coach cannot vote unless also participating as a player.
- Each eligible player has one submission.
- Team Management can see completion status but not selections.
- Results remain hidden until the session closes.
- Reopening a person's submission requires an audited action.

The target model activates voting through the Player context. The current implementation uses
private voting links and must be treated as a compatibility decision rather than silently replaced.

### 10.2 Umpire Match Voting

Each Division configures:

- voting enabled or disabled;
- points structure, such as 3-2-1 or 2-1;
- one combined category or separate male and female categories;
- single ballot, individual Umpire ballots or collective Umpire ballot;
- public portal enabled or disabled;
- proxy submissions enabled or disabled; and
- opening and closing rules.

Each fixture receives a snapshot of the Division configuration. Later Division changes do not
alter open or historical ballots.

The public portal can operate without login through a secure fixture link. Anyone with the link may
submit as a proxy where proxy submission is enabled. SportStack can record the supplied name,
person acted for, reason and time, but cannot independently verify the identity of a guest.

For single or collective mode, only one fixture submission is accepted. For individual mode, each
assigned Umpire has one submission slot and a proxy can complete a specific slot. Reopening or
replacing a submission requires a reason and audit record.

The user-described current public portal and submission behaviour must be verified against the live
implementation before changes are planned.

## 11. Incident, Discipline and Appeals

### 11.1 Incident intake

Anyone can submit an Incident Report from an easily available button. No SportStack login is
required. A guest provides contact information and verifies their email. An Association may
separately enable anonymous reporting. Signed-in reports link to the person's account; guest
reports use a private tracking link.

The report routes to the Association President and Vice President. If either person is named or has
a conflict, it routes away from them. The Association must have a nominated fallback recipient if
both are conflicted.

Reports can be acknowledged, discussed, responded to, linked to a confidential Committee agenda
item, resolved without discipline, or escalated.

### 11.2 Mandatory escalation path

Every disciplinary case must originate from at least one Incident Report.

Only the Association President, Vice President or a person explicitly given escalation authority
through Share authority can select **Escalate to disciplinary case**.

Escalation creates a permanent link between the original Incident Report and the new case. The
person escalating becomes the initial Case Coordinator.

### 11.3 Case Coordinator transfer

The initial Case Coordinator retains responsibility while a transfer is pending. When the
recipient accepts, the new appointment begins and the old appointment ends. The recipient may
decline. Every offer, acceptance, decline and transfer is recorded.

### 11.4 Investigator lifecycle

An Investigator can be any suitable person. They accept the appointment, declare conflicts and
receive only the exact case material released for investigation. They can request information,
collect evidence, keep private working notes and prepare the Investigation Report.

The Lead Investigator submits the final report. Submission locks the stage and changes access to
read-only. Further work requires a recorded reopening or supplementary request.

### 11.5 Tribunal and Appeal

Tribunal Administrator organises the hearing but does not deliberate unless separately appointed.
Tribunal Members see the approved case pack and decide the matter. Tribunal Chair manages the
hearing and finalises the combined findings, reasons and sanctions.

An eligible person may lodge an appeal within the allowed period. The Appeal Administrator checks
and organises it. Appeal Board Members and the Appeal Chair receive approved appeal material and
may uphold, vary or set aside the decision, or return the matter for a new hearing.

An Investigator cannot sit on the Tribunal or Appeal Board for the same case. A Tribunal Member
cannot sit on its Appeal Board.

### 11.6 Stage-based access

| Case stage | Case Coordinator | Investigator | Tribunal | Participants |
|---|---|---|---|---|
| Incident received | Read/write intake | Hidden | Hidden | Own report |
| Investigation active | Manage process | Read/write investigation | Hidden | Assigned requests |
| Investigation submitted | Read final report | Read-only | Hidden | Status only |
| Tribunal preparation | Prepare approved pack | Read-only | Read approved pack | Released material |
| Hearing active | Manage process | Read-only | Read/write hearing section | Own hearing material |
| Decision finalised | Release outcome | Read-only | Read-only | Released decision |
| Appeal active | Manage appeal process | Read-only | Original Tribunal read-only | Relevant appeal material |
| Case closed | Read-only administration | Permitted read-only | Permitted read-only | Own material and released outcomes |

Completing a stage locks its records. Reopening creates a new stage or supplementary entry rather
than rewriting the original record.

### 11.7 Conflicts of interest

Every case appointment requires No conflict, Possible conflict or Conflict exists, with private
details where needed.

Hard blocks prevent:

- a case participant investigating the case;
- an Investigator sitting on its Tribunal;
- an Investigator or Tribunal Member sitting on its Appeal Board; and
- self-appointment where independent approval is required.

Warnings requiring review include same Club or Team, family or close relationship, coaching or
employment relationship, previous involvement in the incident, and previous disputes. Small
Associations may accept a warning with a recorded reason or appoint an external person. A later
conflict ends active access and triggers replacement while preserving earlier audit history.

## 12. Safety Hub

Incident intake can feed separate linked workflows:

```text
Incident Report
      |
      +-- Safety workflow
      |
      +-- Conduct workflow -> possible disciplinary case
```

One report may create both workflows. Anyone can report a safety issue, hazard or incident.
Authorised Association or Club executives manage the matching scope. An assigned Safety Action
Owner sees only the corrective action, due date and information required to complete it.

Sensitive personal and medical information remains restricted. Association managers do not
automatically see every Club report; the report must be escalated or form part of an
Association-wide safety process.

No permanent Safety Coordinator is included for now. Detailed Safety Hub permissions are parked
until the module requires further design.

## 13. Juniors, guardians and personal information

Junior is a calculated status, not a responsibility. It is derived from date of birth on the
relevant fixture or activity date.

A Junior may have one or more linked guardians. The guardian relationship does not make the
guardian an organisation member. Guardians may manage permitted memberships, availability, forms,
consent, contact details and relevant communication. A Junior with their own login may manage
permitted parts of their profile.

Guardians cannot submit Player MVP Voting or Umpire Match Voting on the Junior's behalf. Case access
is assigned separately. Guardian access is reviewed when the participant turns 18.

Coordinators see **Junior participant**, not the full date of birth. Compliance views show useful
statuses such as Current or Expired rather than unnecessary document details. Medical and emergency
information requires specific, time-limited and audited access.

## 14. Appointments, delegation and lifecycle

### 14.1 Appointment authority

- SportStack Admin is appointed by SportStack.
- Association Admin is appointed by SportStack Admin or another Association Admin.
- Club Admin is appointed by Association Admin or another Club Admin.
- Association Umpire, Technical Bench and Volunteer Coordinators are appointed by Association
  Admin.
- Club Volunteer Coordinator is appointed by Club Admin.
- Team Management is appointed by Club Admin or an authorised Club Executive.
- Committee positions are recorded after the organisation's governance process.
- Case assignments are controlled by the relevant Case or Appeal Coordinator.

Nobody appoints themselves. Appointments have a start date, optional end date, acceptance and
audit history.

### 14.2 Suspend and end

Suspension stops access immediately while keeping the appointment. It requires a reason and review
date and can later be restored. Ending permanently finishes the appointment. Committee positions
must follow governance rules; an administrator records the authorised decision rather than
unilaterally removing an elected office holder.

An organisation can suspend only its own membership or responsibilities. It cannot disable the
person's whole SportStack account. Only SportStack Admin can suspend the complete account.

### 14.3 Leaving and abandonment

Before leaving, SportStack groups items as:

```text
Must resolve
  Active disciplinary assignments

Transfer or abandon
  Normal responsibilities and shared authority

Will end
  Memberships and capabilities

Upcoming commitments
  Playing, Umpire, Technical Bench and Volunteer assignments
```

Active disciplinary assignments block leaving until transferred or formally released. A normal
responsibility may be handed over through its appointing authority or abandoned immediately.
Abandonment ends access, records the reason and notifies the appropriate Association, Club or Team
authority so a replacement can be appointed.

Leaving a Team ends that participation. Leaving a Club ends its child Team memberships. Leaving an
Association ends its child Club and Team memberships and related capabilities. Historical records
remain.

### 14.4 Account closure

Before account closure, SportStack checks disciplinary assignments, responsibilities, future
operational assignments, exemption applications and safety actions. Required work is resolved,
transferred, withdrawn or abandoned using the agreed rules.

Login then ends, active memberships and capabilities finish, and historical fixtures, votes,
decisions, messages and audit records remain. Personal information is removed or hidden where no
longer required. SportStack shows what will remain before confirmation.

## 15. Audit, reports and support access

Important actions record:

- person and account;
- active responsibility;
- scope;
- action and affected record;
- date and time;
- reason where required; and
- previous and new important values.

This includes appointments, shared authority, membership approval, Primary Team changes,
exemptions, fixture assignments, overrides, voting reopenings, disciplinary access, sensitive data
views and module-entitlement changes.

Audit records are immutable through normal screens. Organisation administrators see audit activity
within their permitted scope, but protected case content remains restricted.

Exports never provide more access than the screen. Sensitive exports require a reason, links expire
and permission is checked again at download time.

SportStack Admin can see platform and entitlement activity without automatically seeing
confidential organisation or case information. Emergency support access to protected information
requires a reason, is time-limited and is clearly audited.

## 16. Public and external access

Public access may include:

- public Association, Club and Team information;
- public fixtures and results;
- Umpire Match Voting through a secure fixture link; and
- the public Incident Report form.

Public forms never expose internal reports, cases or member information.

Investigators, Tribunal Members, Appeal Board Members and other temporary specialists do not need
organisation membership. A Case Coordinator sends a secure email invitation. The recipient signs
in or creates an account, reviews confidentiality and conflicts, and accepts or declines. Accepted
access applies only to the exact case and ends with its lifecycle.

## 17. Key implementation consequences

The target design requires:

1. a responsibility-assignment record that always includes exact scope, permission set, status,
   dates and appointment source;
2. a session-bound Working as context enforced by the database as well as the interface;
3. module entitlement that remains separate from permission;
4. record-specific assignment and eligibility tables for fixtures, votes, safety actions and cases;
5. immutable audit history for sensitive changes;
6. stage-based Hidden, Read, Read/write and Read-only case access;
7. notification and chat deep links that safely activate the required context;
8. formal handover, abandonment and conflict workflows; and
9. a migration that maps current roles and permissions without granting broader access.

## 18. Parked and verification items

- Redesign the current Working as selector after the model has been tested.
- Do not add Competition Coordinator or Safety Coordinator yet.
- Inspect the current Committee voting form and stored Circular Resolution records before extending
  them for exemptions.
- Verify current public Umpire Match Voting portal, proxy and submission behaviour.
- Resolve the target Player-context Player MVP Voting design against the current private-link
  implementation.
- Design detailed Safety Hub permissions only when needed.
- Verify the live Dev schema before any migration or implementation.
- Keep the current implementation and this target design clearly separated until migration is
  complete.

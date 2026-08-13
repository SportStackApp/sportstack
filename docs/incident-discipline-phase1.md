# Incident & Discipline Phase 1

Status: Dev implementation specification. The 2026 rule pack remains `REVIEW_REQUIRED` until Hockey Ballarat approves the local interpretation items below.

## Purpose and boundary

This module supports Hockey Ballarat staff through intake, screening, investigation, report sign-off and an HB decision. The Dev extension now also records the later Tribunal notice, hearing, determination, appeal and closure workflow. It records facts, rules, human judgements and local interpretations separately. It never determines guilt or imposes a penalty automatically.

Phase 1 finishes when a matter is closed or referred. The Phase 2 extension records the later human-led process but does not send formal notices, constitute a Tribunal, or apply sanctions automatically.

## Verified source set

The following sources were downloaded and checked on 12/08/2026.

| Source | Official address | Local SHA-256 | Use in Phase 1 |
|---|---|---|---|
| Hockey Ballarat Local By-Law Addendum 2026 | https://www.hockeyballarat.com.au/uploads/1/4/8/3/148316959/hb_by-law_addendum_2026.pdf | `FE9791A976758BB78BD1631405B17358DB6F5B3D88C6A2A35CB0138BEE4E1D05` | HB authority and local variations |
| Hockey Victoria Competition Rules 2026 | https://cdn.revolutionise.com.au/cups/vichockey/files/tuqrabulv5ovd3og.pdf | `92654E41812679CB3F1E6243B0B3EC5A2A594B89680F73B60F52C1A97BDE7910` | Rule 7 workflow and decisions |
| Hockey Victoria Competition Regulations 2026 | https://cdn.revolutionise.com.au/cups/vichockey/files/bkbdi3qf9bpigpaf.pdf | `F93E1E4DE2725783FCA0248CA265C1854474E5761CE6E7C075BEFDBD10FB5B1D` | Rule-pack completeness; no separate Phase 1 discipline steps located |
| Hockey Victoria Competition Schedules 2026 | https://cdn.revolutionise.com.au/cups/vichockey/files/jnpjob9q1ytyxveo.pdf | `19897FF337C9D411E7FD0645BC3F7B4F81FFC829F9E142E675A4DBF554E1A02F` | Deadlines, classifications and penalty guidance |
| Hockey Victoria Incident Report Form | https://cdn.revolutionise.com.au/cups/vichockey/files/qwitffhsg8wpy0lk.docx | `8A0D83C4C6C385C1E5E7163016658383EB5B1866F87A42A0C898FB9DCA24F117` | Required intake fields and submission warning |
| Hockey Australia Complaints, Disputes and Discipline Policy | https://www.hockeyballarat.com.au/uploads/1/4/8/3/148316959/de3wntx1qsqupsyp.pdf | `BEE72D81A8912F558A523FC021B501F3D4E9ECC5C135BB47BEE2528F820471C4` | Jurisdiction and immediate-safety triage only |

The document links were cross-checked against Hockey Ballarat's official policies page:
https://www.hockeyballarat.com.au/policies--procedures.html.

The Hockey Ballarat policy page says the March 2026 addendum adopts the current HV Rules, Regulations and Schedules. Addendum clause 3.1 says references to HV are read as HB only insofar as practicable. Clause 2.1 places administration with the HB Committee. Clause 7.1 says HB does not fine clubs and instead works with them on a solution, with premiership points identified as an effective penalty where required.

The Hockey Australia policy is still linked by Hockey Ballarat, but its stated review date was July 2025. The module therefore presents it as a site-linked jurisdiction source whose current local adoption still needs confirmation.

## Confirmed workflow corrections

1. A last-round or finals report is not automatically sent directly to a Tribunal. Rule 7.1 adds the condition that the relevant club is participating in that competition. The intake records this as a separate fact.
2. The 2026 investigation-decision appeal provisions are Rules 7.22 to 7.25. The earlier design reference to Rule 10 is not used in the Phase 1 rule library.
3. Schedule 1 clause 4.2 marks Level 3 language, vilification, Level 3 violent conduct and the listed public-statement offence as direct-Tribunal matters. The preliminary screen must include all four, not only Level 3 and vilification.
4. The linked incident form shows a `$250` contempt amount, while the 2026 Schedules show `$500`. The Schedules value is stored as the current guideline and a source-conflict warning remains visible.
5. Rule 7.12 requires an appropriately experienced, conflict-free Investigation Officer and cooperation. It does not expressly state the full natural-justice checklist proposed for the investigation stage. That checklist is stored as an HB operating safeguard pending formal approval, supported more generally by the NIF policy and Tribunal provisions.
6. The source set contains no located definition of `business day`. Calculations use the configurable HB calendar, weekends and verified Victorian public holidays, but are labelled as a local interpretation pending approval.
7. The NIF complaint pathway must not be silently blended with the match-misconduct Rule 7 pathway. Intake requires a human jurisdiction choice. Immediate child-safety or other urgent risk requires prompt external action where applicable, but the safety flag is an overlay rather than an automatic jurisdiction decision. An external referral may suspend the internal process; it does not erase the private record.

## Intake wording and data decisions

- The page explains each jurisdiction pathway in plain language and links directly to the checked HV Rules, Incident Report Form and site-linked Hockey Australia policy. The NIF option remains labelled as requiring confirmation of HB adoption and referral contacts.
- The reason for the selected pathway is required factual text. Reusable reason tags support triage and searching but do not decide jurisdiction.
- Immediate-safety tags describe the reported risk or action. Selecting immediate safety alone no longer changes a Rule 7 case to `REFERRED`; an explicit external or policy referral pathway is required for that status.
- A selected SportStack fixture fills competition, grade, round, home team, away team, venue and match timing. Each field remains editable free text so the saved snapshot can accurately reflect an external report. The database keeps the official form-compatible `first_named_team` and `second_named_team` snapshot columns while the UI displays **Home team** and **Away team**.
- People and clubs can be linked to association-scoped SportStack suggestions or retained as free-text snapshots. A suggestion is not forced when identity is uncertain.
- The original incident report remains evidence. An allegation is a neutral structured account of one separate reported act, not a finding or a rewritten replacement for the report. Intake supports multiple allegations in one transaction and each allegation has its own optional descriptive tags, date, time and location.

## Preliminary screening wording and data decisions

- Screen 2 handles one allegation at a time. It repeats the saved allegation wording and descriptor tags so the user classifies the reported act rather than the whole incident.
- No factual answer is preselected. The user must identify the closest conduct category, the person group where relevant, and the facts required by that Schedule row. An unclear or unsafe match records an Amber human-review result instead of forcing a classification.
- Green means no current direct-Tribunal trigger was matched; Amber means human classification review is required; Red means the matched Schedule row calls for direct Tribunal preparation. None of these colours is a finding of guilt or an automatic penalty.
- The latest preliminary result, its time, penalty guidance and any source warning remain visible. Each later check creates another preserved assessment rather than overwriting the earlier record.
- The Schedule table marks the listed unfair public personal attack for immediate Tribunal referral, while the clarification below the table refers only to Level 3 offences and vilification. The app keeps that row Red and displays the conflict as a source warning.

## Investigation setup and independence decisions

- Rule 7.12 says the nature and seriousness of the allegation inform whether the matter uses an
  internal investigation or an independent external person. The appointed Investigation Officer
  should have no conflict of interest and appropriate training or experience. The screen explains
  those requirements and links directly to the verified HV Rules and HB addendum.
- No conflict answer is preselected. The Case Coordinator must answer actual and perceived conflict
  questions separately, record the relevant disclosures, choose a decision and explain its factual
  basis and any safeguards. The predefined conflict descriptors are HB operating prompts for
  consistent searching; they are not presented as a quoted or exhaustive Rule 7 list.
- An actual conflict requires a replacement. A perceived conflict may be managed with recorded
  safeguards or may also require replacement. A no-conflict decision is allowed only when both
  questions are answered No. Every saved check remains in the case history.
- The app supports optional support investigators as an HB practical arrangement, while one Lead
  Investigation Officer remains formally accountable. Investigators must be selected from
  SportStack profiles because case access is private and audited.
- An accepted check atomically records the setup, revokes superseded investigator access and grants
  the matching lead/support case roles. A replacement decision retains the rejected check without
  granting the proposed investigator access. Direct browser inserts into the setup table are
  revoked.
- Addendum clauses 2.1 and 3.1 support HB administration and reading “HV” as “HB” where practicable,
  but do not identify the exact local equivalent of the HV CEO or delegate in Rule 7.12. The screen
  therefore records the actual person or HB body that authorised the appointment and labels the
  authority mapping as **Local interpretation — needs formal HB confirmation**.

### Investigator email and onboarding follow-up

The current Dev screen can appoint only an existing SportStack profile. A future improvement should
make the investigator's email address mandatory and allow their name to be entered as free text.
When the verified email already belongs to a SportStack account, the appointment should link that
account. When it does not, the person should receive an invitation to create or claim an account
before accessing the case. An investigator may belong to another hockey association; the access
created by this appointment must still be limited to the Hockey Ballarat discipline portal and the
specific Hockey Ballarat case role. It must not infer a Hockey Ballarat club membership or broader
Hockey Ballarat permissions. Invitation status, email verification, acceptance and revocation should
remain auditable. This is a recorded product recommendation, not part of the current Phase 1 build.

## Incident 007 Dev workflow exercise

Case `HB-DIS-2026-0016` was progressed in the Dev database on 13/08/2026 as a workflow exercise.
The source set used for the exercise was the de-identified `IN0007 Incident report JH.pdf`, Tom
McMurrie's written response dated 12/08/2026 and the related appointment correspondence. No
Production system was used.

The exercise deliberately accepted the reporter's first-hand claims as true at Aaron's direction so
the remaining screens could be tested. Every generated clarification and finding was labelled as a
workflow simulation. It must not be treated as a genuine witness statement, independent
corroboration or a real disciplinary conclusion.

The simulated findings recorded were:

- Allegation 1, late physical contact: `SUBSTANTIATED`, preliminary code `VIOLENT_L1`. The exercise
  notes the difference between "very forceful" in the report and the later description of only a
  bump, with no injury or interruption to play.
- Allegation 2, bite through the shirt: `SUBSTANTIATED` only under the report-as-true exercise
  assumption, with exercise code `VIOLENT_L3`. The record also preserves Tom's denial, no marks or
  injury, no umpire observation, no card, the disputed meaning of the reported response and the
  missing junior and umpire statements.
- Allegation 3, reported threat: `UNABLE_TO_DETERMINE`, with
  `CLASSIFICATION_REVIEW_REQUIRED`. Accepting Jason's report as truthful establishes that the words
  were reported to him; it does not establish that Tom said them. The direct junior account and a
  specific response from Tom remain necessary.

The Case Coordinator browser session originally exposed editable finding forms even though the
audited database function correctly permitted only the Lead Investigator to save them. The deployed
workspace now shows read-only finding summaries to every other case role. For this Dev exercise only,
the three simulated findings and the signed report snapshot were recorded through the existing
audited functions as the appointed Tim placeholder after a rollback test. Verification found three
findings and one 64-character SHA-256 report snapshot.

The next Dev build replaced the single Decision Maker form with the planned three-person review
panel safeguard. Each member record now requires a free-text name, mandatory email, suitability
reason, affiliations/interests, separate actual and perceived conflict answers, a recorded conflict
result and an optional SportStack account link. Acceptance requires a linked account. The three
accepted members receive case-limited Decision Maker access, while Tim, the Case Coordinator and
other investigators cannot be appointed to the panel. Invitation status is recorded but Phase 1
does not yet send invitation emails.

Each accepted member records an independent outcome, reasons and rule source. Votes are append-only
revisions and remain visible only to their author until finalisation. The system requires all three
current votes and calculates a 2-1 or 3-0 majority; it rejects a three-way split. The final record
retains every vote and the formal meeting or resolution reference. The UI and database allow **no
overall recommendation recorded**, because an investigator may provide findings without proposing
one Rule 7.7 outcome.

For workflow testing only, three reserved Codex Dev accounts were saved through the deployed screen
as clearly labelled simulated reviewers. They recorded three simulated Tribunal-referral votes under
Aaron's report-as-true exercise direction. The database finalised a 3-0 majority and moved the case
to `REFERRED`. The authority, member checks, reasons and outcome all state that no real HB panel was
appointed and no real disciplinary determination was made. No notification was sent.

The remaining standard post-referral path is now implemented in the Dev Outcome tab. It records:

1. the Rule 7.18 notice particulars, relied-on evidence, hearing details, response rights and proof
   of external service;
2. the Rule 7.19-7.20 hearing record, including charges, plea, parties heard, evidence and natural
   justice;
3. the Rule 7.20-7.21 result for each charge, standard of proof, panel majority, reasons, penalty
   submissions and sanction treatment;
4. the Rule 7.22-7.25 appeal deadline, application/stay, three-member independent Appeal Board,
   new hearing on the merits and final majority result; and
5. notification, appeal completion, records, privacy/publication, sanction-register, fee and final
   closure checks.

Every save creates a new revision. A real Notice cannot be marked `ISSUED` until Tribunal
Preparation is `READY`, and a simulation can never change the real case status. Incident 007 was
saved through all five stages as an expressly acknowledged Dev simulation. The latest simulated
closure is revision 2 and includes the strengthened decision-notice, sanctions-register and
administrative-fee fields. The real case remains `REFERRED`; no email, Tribunal, finding, penalty,
appeal, publication or closure was created.

Rule 7.26 is not another ordinary step in every case. It creates a separate later review request for
a person suspended for longer than 12 months, only after at least 12 months has been served. The UI
explains that future pathway at closure without pretending it is applicable to Incident 007.

The original PDF and email source copies are summarised in immutable Dev evidence records, but their
private binary uploads remain pending. The simulated clarification record is clearly titled
`workflow exercise only`.

## Source ambiguities to retain

- Schedule 1 clause 4.1 refers to Rule 7.17(a) for Tribunal notification. The notice requirements appear in Rule 7.18(a).
- Schedule 1 clause 4.2 refers to Rule 7.20.4 for repeat-offence penalty factors. Those factors appear in Rule 7.21.4.
- Rule 7.22 contains apparent internal cross-reference issues around Appeals Board composition and the appeal fee.
- Rule 7.11 early-guilty-plea sequencing needs an HB operating decision.
- The HB destination for reports, the HV umpire-coach presentation step, publication, fees, non-cooperation consequences, Tribunal chairs and suspension reach all need local confirmation.

The app must display these as `LOCAL INTERPRETATION` or `SOURCE AMBIGUITY`, never as settled rules.

## Phase 1 status path

`DRAFT -> SCREENING -> INVESTIGATOR_SETUP -> INVESTIGATING -> FINDINGS -> REPORT_SIGNED -> HB_DECISION -> CLOSED or REFERRED`

The available HB decision outcomes are those in Rule 7.7: no action, Misconduct Penalty System, Tribunal referral, mediation referral, a combination, or another appropriate course. Phase 1 records the choice and reason; later proceedings remain out of scope.

## Deadline interpretation

Regular rounds use Schedule 1 clause 4.1:

| Action | Deadline |
|---|---|
| Report | 1:00 pm, second business day after the match |
| Appoint Investigation Officer | 10:00 am, third business day |
| Notify affected people | 10:00 am, third business day |
| Complete investigation | 12:00 pm, seventh business day |
| Notify outcome | 5:00 pm, seventh business day |

The direct-Tribunal timing path applies only when the Rule 7.1 finals condition is recorded as satisfied:

| Action | Deadline |
|---|---|
| Report | 11:00 am, first business day after the match |
| Refer to Tribunal | 10:00 am, second business day |
| Notify affected people | 10:00 am, second business day |
| Complete Tribunal | 12:00 pm, fourth business day |
| Notify outcome | 5:00 pm, fourth business day |

The database stores UTC timestamps and calculates/display dates using `Australia/Melbourne`. A saved deadline never changes silently. Recalculation requires a reason and creates an event containing the previous and new values.

The initial 2026 calendar comes from the Victorian Government's Business Victoria public-holiday
list: https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026.
Melbourne Cup Day remains included because no 2026 City of Ballarat substitute was listed when
checked. Manual exclusions can replace or supplement it after an HB decision.

## Security decisions

- Case contents are readable only by active case members. Being a Committee member, Association Admin or Super Admin does not reveal an existing case.
- Creating a case assigns the creator as Case Coordinator. Configuration access and case access are separate.
- Important writes use database functions that re-check the signed-in user and case role.
- Evidence uses a private Storage bucket and a case-ID first folder. Replacement creates a new database version and a new object; original evidence is not overwritten.
- `discipline_only` blocks normal SportStack routes in the app. It is not described as a complete database sandbox because the existing application intentionally exposes some shared hockey directory information to all signed-in users.

## Approval gate

Before the rule pack can be marked `PUBLISHED`, Hockey Ballarat should approve or vary:

1. the business-day definition and calendar;
2. the NIF jurisdiction/escalation contact process;
3. HB authority mappings and report destinations;
4. the investigation natural-justice checklist;
5. fees, fines, publication, Tribunal-chair and suspension-reach treatments;
6. the incident-form/Schedules contempt-amount conflict; and
7. the apparent source cross-references listed above.

Until then Dev cases show `Rule pack review required` and every calculated deadline identifies the pending local interpretation.

## Implemented Dev evidence

The hidden portal implements the Phase 1 intake, screening, investigation, findings, report and HB
decision flow. Initial people, all entered allegations and their descriptive tags are created in the
same database transaction as the case. Case access and portal access can be granted, changed or revoked only with a reason.
Evidence files use short-lived signed links; the original object and evidence record are not
overwritten. Signed report snapshots retain their SHA-256 hash and any authorised natural-justice
override reason.

The eighteen local migration files and the versions recorded by the live Dev migration history are:

| Local migration file | Live Dev version and name |
|---|---|
| `20260812110000_incident_discipline_foundation.sql` | `20260812004524 incident_discipline_foundation` |
| `20260812111000_incident_discipline_workflows.sql` | `20260812004530 incident_discipline_workflows` |
| `20260812112000_incident_discipline_seed_2026.sql` | `20260812004536 incident_discipline_seed_2026` |
| `20260812113000_incident_discipline_indexes.sql` | `20260812004654 incident_discipline_indexes` |
| `20260812114000_incident_discipline_portal_context.sql` | `20260812005212 incident_discipline_portal_context` |
| `20260812115000_incident_discipline_atomic_intake.sql` | `20260812010350 incident_discipline_atomic_intake` |
| `20260812116000_incident_discipline_report_hash.sql` | `20260812011829 incident_discipline_report_hash` |
| `20260812162815_improve_discipline_intake_guidance.sql` | `20260812064047 improve_discipline_intake_guidance` |
| `20260812164333_index_discipline_intake_links.sql` | `20260812064352 index_discipline_intake_links` |
| `20260812235915_improve_discipline_investigator_setup.sql` | `20260812140314 improve_discipline_investigator_setup` |
| `20260813224228_discipline_review_panel_workflow.sql` | `20260813124625 discipline_review_panel_workflow` |
| `20260813225158_discipline_review_vote_privacy.sql` | `20260813125316 discipline_review_vote_privacy` |
| `20260813225641_index_discipline_review_panel_foreign_keys.sql` | `20260813125705 index_discipline_review_panel_foreign_keys` |
| `20260813230835_allow_no_investigator_outcome_recommendation.sql` | `20260813130941 allow_no_investigator_outcome_recommendation` |
| `20260813235900_discipline_tribunal_preparation.sql` | `20260813132301 discipline_tribunal_preparation` |
| `20260814000500_harden_discipline_tribunal_preparation.sql` | `20260813133852 harden_discipline_tribunal_preparation` |
| `20260814010000_discipline_phase2_completion_workflow.sql` | `20260813182611 discipline_phase2_completion_workflow` |
| `20260814012000_harden_discipline_phase2_appeal_and_closure.sql` | `20260813183733 harden_discipline_phase2_appeal_and_closure` |

Supabase assigned the live versions at application time; the migration names identify the matching
local files.

Rolled-back live Dev checks confirmed:

- an unassigned Association/Super Admin cannot read case contents, while assignment and revocation
  immediately change access;
- a match ending on 02/04/2026 skips Good Friday, the Easter weekend and Easter Monday;
- a finals match ending Friday 07/08/2026 uses the direct-Tribunal Monday/Tuesday/Thursday dates
  only when the relevant club participation fact is true;
- Language Levels 1-3, Violent Conduct Levels 1-3, Vilification, the unfair public personal attack
  and Classification Review Required return the intended Green/Amber/Red guidance;
- report signing is blocked while required natural-justice safeguards are incomplete, then creates
  one immutable hashed snapshot only after a Case Coordinator's recorded override; and
- association-scoped suggestions returned 232 fixtures, 38 teams, 451 people and 34 descriptive
  tags in the Dev snapshot; a two-allegation Rule 7 case retained `REGULAR`/`DRAFT` when immediate
  safety was also recorded, and stored both case and allegation tags; and
- an accepted investigator setup atomically assigned one lead and one support role, an actual
  conflict replacement retained no investigator access, and an invalid actual-conflict/managed
  combination was rejected; and
- a three-member panel became ready only after three eligible linked acceptances, panel members
  could see only their own vote before finalisation, the Case Coordinator could see no vote content,
  a 2-1 majority calculated correctly, and all three votes became visible after finalisation; and
- a report with no overall outcome recommendation stored the panel relationship as null rather than
  forcing a false followed/not-followed answer; and
- Tribunal preparation allowed coordinator-only setup, made the preparation visible to an assigned
  Tribunal member and rolled back cleanly; its readiness rules require confirmed authority mapping,
  hearing details, at least two accepted independent members, an accepted Chair and the recorded
  Rule 7.17 Chair treatment; and
- every test transaction rolled back without leaving a case, person, finding or report record.

The final Supabase review found no anonymous discipline RPC, no discipline table without RLS and no
missing foreign-key index warning. The adviser continues to flag the authenticated client RPCs as
security-definer functions; this is intentional because each function validates `auth.uid()` and
the required association or case role before changing data.

Screen 3 commit `e801859` passed focused ESLint, five investigator validation tests, TypeScript,
the production build and `git diff --check`. Vercel deployment
`dpl_BZbwC86F3y6JrFGfV3HZHqdURQMb` is `READY` on the Dev alias. Its bundle contains the Screen 3
guidance and Dev Supabase reference and contains no Production project reference. A signed-in portal
check rendered without a console error or horizontal overflow; form-level owner acceptance remains
pending because the account has no assigned case.

Review-panel commit `7aec329` is deployed as Vercel deployment
`dpl_nvum4aYqAtC3WFAKr8uwj1vQWzoE`, which is `READY` on the Dev alias. The signed-in Incident 007
screen shows the complete panel, all linked reviewer labels after reload, the three simulated reasons,
the 3-0 majority and final `REFERRED` status.

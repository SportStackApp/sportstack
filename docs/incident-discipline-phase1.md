# Incident & Discipline Phase 1

Status: Dev implementation specification. The 2026 rule pack remains `REVIEW_REQUIRED` until Hockey Ballarat approves the local interpretation items below.

## Purpose and boundary

This module supports Hockey Ballarat staff through intake, screening, investigation, report sign-off and an HB decision. It records facts, rules, human judgements and local interpretations separately. It does not determine guilt, impose a penalty automatically, or run a Tribunal, mediation, appeal, suspension or publication process.

Phase 1 finishes when a matter is closed, or referred to the relevant later process.

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
7. The NIF complaint pathway must not be silently blended with the match-misconduct Rule 7 pathway. Intake requires a human jurisdiction choice. Immediate child-safety or other urgent risk is escalated outside the ordinary workflow.

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
decision flow. Initial people and the first allegation are created in the same database transaction
as the case. Case access and portal access can be granted, changed or revoked only with a reason.
Evidence files use short-lived signed links; the original object and evidence record are not
overwritten. Signed report snapshots retain their SHA-256 hash and any authorised natural-justice
override reason.

The seven local migration files and the versions recorded by the live Dev migration history are:

| Local migration file | Live Dev version and name |
|---|---|
| `20260812110000_incident_discipline_foundation.sql` | `20260812004524 incident_discipline_foundation` |
| `20260812111000_incident_discipline_workflows.sql` | `20260812004530 incident_discipline_workflows` |
| `20260812112000_incident_discipline_seed_2026.sql` | `20260812004536 incident_discipline_seed_2026` |
| `20260812113000_incident_discipline_indexes.sql` | `20260812004654 incident_discipline_indexes` |
| `20260812114000_incident_discipline_portal_context.sql` | `20260812005212 incident_discipline_portal_context` |
| `20260812115000_incident_discipline_atomic_intake.sql` | `20260812010350 incident_discipline_atomic_intake` |
| `20260812116000_incident_discipline_report_hash.sql` | `20260812011829 incident_discipline_report_hash` |

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
- every test transaction rolled back without leaving a case, person, finding or report record.

The final Supabase review found no anonymous discipline RPC, no discipline table without RLS and no
missing foreign-key index warning. The adviser continues to flag the authenticated client RPCs as
security-definer functions; this is intentional because each function validates `auth.uid()` and
the required association or case role before changing data.

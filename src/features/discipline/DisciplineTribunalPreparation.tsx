import { FormEvent, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Scale } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMelbourneDateTime, formatStatus } from "./format";
import {
  EMPTY_TRIBUNAL_PREPARATION,
  TRIBUNAL_CONFLICT_FACTORS,
  tribunalReadinessItems,
  validateTribunalPreparation,
  type TribunalMemberDraft,
  type TribunalPreparationDraft,
} from "./tribunalPreparationLogic";
import type {
  DisciplineTribunalPreparationInput,
  DisciplineWorkspaceData,
} from "./types";
import {
  combineZonedDateTime,
  splitZonedDateTime,
} from "@/lib/timezoneDateTime";

const HV_RULES_URL =
  "https://cdn.revolutionise.com.au/cups/vichockey/files/tuqrabulv5ovd3og.pdf";
const HB_ADDENDUM_URL =
  "https://www.hockeyballarat.com.au/uploads/1/4/8/3/148316959/hb_by-law_addendum_2026.pdf";

function profileLabel(data: DisciplineWorkspaceData, userId: string) {
  const profile = data.profileOptions.find((option) => option.id === userId);
  return profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || userId
    : userId;
}

function initialDraft(data: DisciplineWorkspaceData): TribunalPreparationDraft {
  const saved = data.tribunalPreparations[0];
  if (!saved) return EMPTY_TRIBUNAL_PREPARATION;
  const hearing = splitZonedDateTime(saved.hearing_at);
  return {
    referralBasis: saved.referral_basis,
    appointmentAuthority: saved.appointment_authority,
    authorityReference: saved.authority_reference || "",
    authorityMappingConfirmed: saved.authority_mapping_confirmed,
    receivingBody: saved.receiving_body,
    receivingContactName: saved.receiving_contact_name,
    receivingContactEmail: saved.receiving_contact_email,
    hbPresenterName: saved.hb_presenter_name,
    hbPresenterEmail: saved.hb_presenter_email,
    hearingMode: saved.hearing_mode,
    hearingDate: hearing.fixture_date,
    hearingTime: hearing.game_time,
    hearingLocation: saved.hearing_location,
    chairRequirementTreatment: saved.chair_requirement_treatment,
    chairApprovalReference: saved.chair_approval_reference || "",
    twoMemberReason: saved.two_member_reason || "",
    preparationNotes: saved.preparation_notes,
    members: [1, 2, 3].map((seatNumber) => {
      const member = data.tribunalMembers.find(
        (item) => item.active && item.seat_number === seatNumber,
      );
      if (!member) return EMPTY_TRIBUNAL_PREPARATION.members[seatNumber - 1];
      return {
        seatNumber,
        fullName: member.full_name,
        email: member.email,
        profileId: member.profile_id || "",
        organisation: member.organisation || "",
        roleOrPosition: member.role_or_position || "",
        invitationStatus:
          member.invitation_status as TribunalMemberDraft["invitationStatus"],
        isChair: member.is_chair,
        legalEligibilityConfirmed: member.legal_eligibility_confirmed,
        involvedClubRole: member.involved_club_role,
        hbGovernanceRole: member.hb_governance_role,
        directInterest: member.direct_interest,
        relationshipAffectingIndependence:
          member.relationship_affecting_independence,
        conflictFactors: member.conflict_factors,
        conflictDecision:
          member.conflict_decision as TribunalMemberDraft["conflictDecision"],
        conflictReason: member.conflict_reason,
        availabilityNotes: member.availability_notes,
      };
    }),
  };
}

export function DisciplineTribunalPreparation({
  data,
  canCoordinate,
  busy,
  onSave,
}: {
  data: DisciplineWorkspaceData;
  canCoordinate: boolean;
  busy: boolean;
  onSave: (values: DisciplineTribunalPreparationInput) => void;
}) {
  const [draft, setDraft] = useState(() => initialDraft(data));
  const [errors, setErrors] = useState<string[]>([]);
  const [profileSearches, setProfileSearches] = useState<
    Record<number, string>
  >({});
  const saved = data.tribunalPreparations[0];
  const referralDecision = data.decisions.find((decision) =>
    ["TRIBUNAL_REFERRAL", "COMBINATION_REFERRAL"].includes(decision.outcome),
  );
  const editable = canCoordinate && Boolean(referralDecision);
  const readiness = tribunalReadinessItems(draft);

  const updateMember = (index: number, changes: Partial<TribunalMemberDraft>) =>
    setDraft((current) => ({
      ...current,
      members: current.members.map((member, memberIndex) =>
        memberIndex === index ? { ...member, ...changes } : member,
      ),
    }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const validationErrors = validateTribunalPreparation(draft);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;
    onSave({
      referralBasis: draft.referralBasis,
      appointmentAuthority: draft.appointmentAuthority,
      authorityReference: draft.authorityReference,
      authorityMappingConfirmed: draft.authorityMappingConfirmed,
      receivingBody: draft.receivingBody,
      receivingContactName: draft.receivingContactName,
      receivingContactEmail: draft.receivingContactEmail,
      hbPresenterName: draft.hbPresenterName,
      hbPresenterEmail: draft.hbPresenterEmail,
      hearingMode: draft.hearingMode,
      hearingAt:
        draft.hearingDate && draft.hearingTime
          ? combineZonedDateTime(draft.hearingDate, draft.hearingTime)
          : undefined,
      hearingLocation: draft.hearingLocation,
      chairRequirementTreatment: draft.chairRequirementTreatment,
      chairApprovalReference: draft.chairApprovalReference,
      twoMemberReason: draft.twoMemberReason,
      preparationNotes: draft.preparationNotes,
      members: draft.members.map((member) => ({
        seat_number: member.seatNumber,
        full_name: member.fullName,
        email: member.email,
        profile_id: member.profileId || undefined,
        organisation: member.organisation,
        role_or_position: member.roleOrPosition,
        invitation_status: member.invitationStatus,
        is_chair: member.isChair,
        legal_eligibility_confirmed: member.legalEligibilityConfirmed,
        involved_club_role: member.involvedClubRole,
        hb_governance_role: member.hbGovernanceRole,
        direct_interest: member.directInterest,
        relationship_affecting_independence:
          member.relationshipAffectingIndependence,
        conflict_factors: member.conflictFactors,
        conflict_decision: member.conflictDecision as
          "CLEARED" | "MANAGED" | "REPLACE_MEMBER",
        conflict_reason: member.conflictReason,
        availability_notes: member.availabilityNotes,
      })),
    });
  };

  if (!referralDecision) {
    return (
      <Alert>
        <Scale className="h-4 w-4" />
        <AlertTitle>No final Tribunal referral recorded</AlertTitle>
        <AlertDescription>
          This preparation screen opens only after a final Tribunal or
          combination referral decision.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <Alert className="border-amber-500/40 bg-amber-500/5">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>
          Preparation only — this screen does not send a notice or appoint a
          real Tribunal
        </AlertTitle>
        <AlertDescription>
          Confirm the local authority, Chair treatment and actual people before
          relying on this record. Incident 007 remains a Dev workflow exercise.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>What the checked rules require</CardTitle>
          <CardDescription>
            Plain-language guidance for a first-time Case Coordinator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>HV Rule 7.17:</strong> a Tribunal ordinarily has three
            members, may sit with at least two, has one Chair eligible to engage
            in legal practice in Victoria, and excludes specified conflicts or
            relationships affecting independence.
          </p>
          <p>
            <strong>HV Rule 7.18:</strong> affected people receive the hearing
            time, date and place, enough allegation detail to respond, the
            evidence relied on, and the right to provide written or oral
            submissions. HB must attend to assist and present relevant evidence.
          </p>
          <p>
            <strong>HB clauses 2.1 and 3.1:</strong> HB administers the addendum
            and reads HV as HB where practicable. They do not identify exactly
            who replaces the HV CEO/delegate, so that mapping must be formally
            confirmed.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex items-center text-primary hover:underline"
              href={HV_RULES_URL}
              target="_blank"
              rel="noreferrer"
            >
              Open HV Rules, pages 30–32{" "}
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
            <a
              className="inline-flex items-center text-primary hover:underline"
              href={HB_ADDENDUM_URL}
              target="_blank"
              rel="noreferrer"
            >
              Open HB Addendum, page 1 <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Readiness</CardTitle>
              <CardDescription>
                {saved
                  ? `Saved ${formatMelbourneDateTime(saved.updated_at)}`
                  : "Not saved yet"}
              </CardDescription>
            </div>
            <Badge
              variant={saved?.status === "READY" ? "secondary" : "outline"}
            >
              {formatStatus(saved?.status || "SETUP")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {readiness.map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-2 rounded-lg border p-3 text-sm"
            >
              {item.complete ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
              )}
              {item.label}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Referral and local authority</CardTitle>
          <CardDescription>
            The referral decision is final; these fields record who is
            authorised to turn it into a Tribunal process.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Referral basis</Label>
            <Select
              value={draft.referralBasis}
              onValueChange={(value) =>
                setDraft({ ...draft, referralBasis: value })
              }
              disabled={!editable || busy}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HB_RULE_7_7_REFERRAL">
                  HB decision under Rule 7.7
                </SelectItem>
                <SelectItem value="DIRECT_SCHEDULE_REFERRAL">
                  Direct Schedule referral
                </SelectItem>
                <SelectItem value="MEDIATION_UNRESOLVED">
                  Unresolved mediation
                </SelectItem>
                <SelectItem value="OTHER_TRIBUNAL_JURISDICTION">
                  Other Tribunal jurisdiction
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Appointment authority</Label>
            <Input
              value={draft.appointmentAuthority}
              onChange={(event) =>
                setDraft({ ...draft, appointmentAuthority: event.target.value })
              }
              disabled={!editable || busy}
              placeholder="Name and role/body"
            />
          </div>
          <div className="space-y-2">
            <Label>Minute, delegation or resolution reference</Label>
            <Input
              value={draft.authorityReference}
              onChange={(event) =>
                setDraft({ ...draft, authorityReference: event.target.value })
              }
              disabled={!editable || busy}
            />
          </div>
          <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
            <Checkbox
              checked={draft.authorityMappingConfirmed}
              onCheckedChange={(checked) =>
                setDraft({
                  ...draft,
                  authorityMappingConfirmed: checked === true,
                })
              }
              disabled={!editable || busy}
            />
            <span>
              <span className="font-medium">
                HB has formally confirmed this authority mapping
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Do not tick this merely because someone is available. It should
                trace to an HB minute, resolution or delegation.
              </span>
            </span>
          </label>
          <div className="space-y-2">
            <Label>Body receiving/managing the referral</Label>
            <Input
              value={draft.receivingBody}
              onChange={(event) =>
                setDraft({ ...draft, receivingBody: event.target.value })
              }
              disabled={!editable || busy}
            />
          </div>
          <div className="space-y-2">
            <Label>Receiving contact name</Label>
            <Input
              value={draft.receivingContactName}
              onChange={(event) =>
                setDraft({ ...draft, receivingContactName: event.target.value })
              }
              disabled={!editable || busy}
            />
          </div>
          <div className="space-y-2">
            <Label>Receiving contact email</Label>
            <Input
              type="email"
              value={draft.receivingContactEmail}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  receivingContactEmail: event.target.value,
                })
              }
              disabled={!editable || busy}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hearing logistics and HB presenter</CardTitle>
          <CardDescription>
            Rule 7.18 requires hearing details in the later notice and an HB
            representative at the hearing.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>HB presenter/representative</Label>
            <Input
              value={draft.hbPresenterName}
              onChange={(event) =>
                setDraft({ ...draft, hbPresenterName: event.target.value })
              }
              disabled={!editable || busy}
            />
          </div>
          <div className="space-y-2">
            <Label>Presenter email</Label>
            <Input
              type="email"
              value={draft.hbPresenterEmail}
              onChange={(event) =>
                setDraft({ ...draft, hbPresenterEmail: event.target.value })
              }
              disabled={!editable || busy}
            />
          </div>
          <div className="space-y-2">
            <Label>Hearing mode</Label>
            <Select
              value={draft.hearingMode}
              onValueChange={(value) =>
                setDraft({ ...draft, hearingMode: value })
              }
              disabled={!editable || busy}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN_PERSON">In person</SelectItem>
                <SelectItem value="VIDEO">Video conference</SelectItem>
                <SelectItem value="TELECONFERENCE">Teleconference</SelectItem>
                <SelectItem value="HYBRID">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={draft.hearingDate}
                onChange={(event) =>
                  setDraft({ ...draft, hearingDate: event.target.value })
                }
                disabled={!editable || busy}
              />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={draft.hearingTime}
                onChange={(event) =>
                  setDraft({ ...draft, hearingTime: event.target.value })
                }
                disabled={!editable || busy}
              />
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Venue, video link or access instructions</Label>
            <Textarea
              value={draft.hearingLocation}
              onChange={(event) =>
                setDraft({ ...draft, hearingLocation: event.target.value })
              }
              disabled={!editable || busy}
            />
          </div>
          <div className="space-y-2">
            <Label>Rule 7.17 Chair treatment</Label>
            <Select
              value={draft.chairRequirementTreatment}
              onValueChange={(value) =>
                setDraft({ ...draft, chairRequirementTreatment: value })
              }
              disabled={!editable || busy}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NOT_RESOLVED">
                  Not resolved — preparation cannot be ready
                </SelectItem>
                <SelectItem value="HV_REQUIREMENT_CONFIRMED">
                  HV legal eligibility requirement will be met
                </SelectItem>
                <SelectItem value="HB_VARIATION_APPROVED">
                  Formal HB local variation approved
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Chair variation approval reference</Label>
            <Input
              value={draft.chairApprovalReference}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  chairApprovalReference: event.target.value,
                })
              }
              disabled={
                !editable ||
                busy ||
                draft.chairRequirementTreatment !== "HB_VARIATION_APPROVED"
              }
              placeholder="Required only for a formal local variation"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Reason if only two members will sit</Label>
            <Textarea
              value={draft.twoMemberReason}
              onChange={(event) =>
                setDraft({ ...draft, twoMemberReason: event.target.value })
              }
              disabled={!editable || busy}
              placeholder="Rule 7.17 says ordinarily three, with a minimum of two."
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Preparation scope and safeguards</Label>
            <Textarea
              value={draft.preparationNotes}
              onChange={(event) =>
                setDraft({ ...draft, preparationNotes: event.target.value })
              }
              disabled={!editable || busy}
            />
          </div>
        </CardContent>
      </Card>

      {draft.members.map((member, index) => (
        <Card key={member.seatNumber}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>
                  Tribunal member {member.seatNumber}
                  {member.isChair ? " — Chair" : ""}
                </CardTitle>
                <CardDescription>
                  Free-text identity is required; link an account before
                  recording acceptance.
                </CardDescription>
              </div>
              <Badge variant="outline">
                {formatStatus(member.invitationStatus)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input
                value={member.fullName}
                onChange={(event) =>
                  updateMember(index, { fullName: event.target.value })
                }
                disabled={!editable || busy}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={member.email}
                onChange={(event) =>
                  updateMember(index, { email: event.target.value })
                }
                disabled={!editable || busy}
              />
            </div>
            <div className="space-y-2">
              <Label>Search SportStack accounts</Label>
              <Input
                value={profileSearches[member.seatNumber] || ""}
                onChange={(event) =>
                  setProfileSearches({
                    ...profileSearches,
                    [member.seatNumber]: event.target.value,
                  })
                }
                disabled={!editable || busy}
                placeholder="Search account names"
              />
              <Select
                value={member.profileId || "__none__"}
                onValueChange={(value) =>
                  updateMember(index, {
                    profileId: value === "__none__" ? "" : value,
                  })
                }
                disabled={!editable || busy}
              >
                <SelectTrigger className="w-full min-w-0 overflow-hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    No account linked yet
                  </SelectItem>
                  {data.profileOptions
                    .filter((profile) => {
                      const query = (profileSearches[member.seatNumber] || "")
                        .toLowerCase()
                        .trim();
                      return (
                        !query ||
                        profile.id === member.profileId ||
                        profileLabel(data, profile.id)
                          .toLowerCase()
                          .includes(query)
                      );
                    })
                    .slice(0, 50)
                    .map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profileLabel(data, profile.id)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Invitation status</Label>
              <Select
                value={member.invitationStatus}
                onValueChange={(value) =>
                  updateMember(index, {
                    invitationStatus:
                      value as TribunalMemberDraft["invitationStatus"],
                  })
                }
                disabled={!editable || busy}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT_SENT">Not sent</SelectItem>
                  <SelectItem value="SENT">Sent outside SportStack</SelectItem>
                  <SelectItem value="ACCEPTED">Accepted</SelectItem>
                  <SelectItem value="DECLINED">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Organisation</Label>
              <Input
                value={member.organisation}
                onChange={(event) =>
                  updateMember(index, { organisation: event.target.value })
                }
                disabled={!editable || busy}
              />
            </div>
            <div className="space-y-2">
              <Label>Role or position</Label>
              <Input
                value={member.roleOrPosition}
                onChange={(event) =>
                  updateMember(index, { roleOrPosition: event.target.value })
                }
                disabled={!editable || busy}
              />
            </div>
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={member.isChair}
                onCheckedChange={(checked) =>
                  updateMember(index, { isChair: checked === true })
                }
                disabled={!editable || busy}
              />
              <span>This member is the Tribunal Chair</span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={member.legalEligibilityConfirmed}
                onCheckedChange={(checked) =>
                  updateMember(index, {
                    legalEligibilityConfirmed: checked === true,
                  })
                }
                disabled={!editable || busy}
              />
              <span>
                <span>Eligible to engage in legal practice in Victoria</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Confirm evidence; do not infer this from general legal
                  knowledge.
                </span>
              </span>
            </label>
            <div className="space-y-2 md:col-span-2">
              <Label>Rule 7.17 independence questions</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {[
                  ["Current role with an involved club", "involvedClubRole"],
                  ["Current HB governance/staff role", "hbGovernanceRole"],
                  [
                    "Party to or directly interested in the matter",
                    "directInterest",
                  ],
                  [
                    "Relationship that may reasonably affect independence",
                    "relationshipAffectingIndependence",
                  ],
                ].map(([label, key]) => (
                  <label
                    key={key}
                    className="flex items-start gap-2 rounded-lg border p-3 text-sm"
                  >
                    <Checkbox
                      checked={
                        member[key as keyof TribunalMemberDraft] === true
                      }
                      onCheckedChange={(checked) =>
                        updateMember(index, { [key]: checked === true })
                      }
                      disabled={!editable || busy}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                The HB governance question is a conservative local safeguard
                under HB clause 3.1 and remains subject to formal HB
                confirmation.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Independence descriptors</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {TRIBUNAL_CONFLICT_FACTORS.map(([value, label]) => (
                  <label
                    key={value}
                    className="flex items-start gap-2 rounded-lg border p-3 text-sm"
                  >
                    <Checkbox
                      checked={member.conflictFactors.includes(value)}
                      onCheckedChange={(checked) =>
                        updateMember(index, {
                          conflictFactors: checked
                            ? [...member.conflictFactors, value]
                            : member.conflictFactors.filter(
                                (factor) => factor !== value,
                              ),
                        })
                      }
                      disabled={!editable || busy}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Independence result</Label>
              <Select
                value={member.conflictDecision || undefined}
                onValueChange={(value) =>
                  updateMember(index, {
                    conflictDecision:
                      value as TribunalMemberDraft["conflictDecision"],
                  })
                }
                disabled={!editable || busy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLEARED">
                    Cleared — no issue identified
                  </SelectItem>
                  <SelectItem value="MANAGED">
                    Potential issue managed
                  </SelectItem>
                  <SelectItem value="REPLACE_MEMBER">
                    Do not appoint — replace
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Availability</Label>
              <Input
                value={member.availabilityNotes}
                onChange={(event) =>
                  updateMember(index, { availabilityNotes: event.target.value })
                }
                disabled={!editable || busy}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Independence reason and safeguards</Label>
              <Textarea
                value={member.conflictReason}
                onChange={(event) =>
                  updateMember(index, { conflictReason: event.target.value })
                }
                disabled={!editable || busy}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Check the preparation record</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {canCoordinate ? (
        <Button type="submit" disabled={!editable || busy}>
          Save Tribunal preparation
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your case role can view this preparation but cannot change it.
        </p>
      )}
    </form>
  );
}

import { FormEvent, useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Scale,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { HB_BYLAW_ADDENDUM_URL, HV_RULES_URL } from "./disciplineIntakeContent";
import { InformationBadge } from "./DisciplineUi";
import { formatMelbourneDateTime, formatStatus } from "./format";
import {
  EMPTY_REVIEW_PANEL,
  REVIEW_PANEL_CONFLICT_DECISIONS,
  REVIEW_PANEL_CONFLICT_FACTORS,
  validateReviewPanel,
  type ReviewPanelDraft,
  type ReviewPanelMemberDraft,
} from "./reviewPanelLogic";
import type {
  DisciplineReviewPanelInput,
  DisciplineReviewPanelVote,
  DisciplineReviewPanelVoteInput,
  DisciplineWorkspaceData,
} from "./types";

const SIA_INVESTIGATION_GUIDELINES_URL =
  "https://www.sportintegrity.gov.au/sites/default/files/Investigation%20of%20Complaints%20Guidelines.pdf";

const OUTCOMES = [
  "NO_ACTION",
  "MISCONDUCT_PENALTY_GUIDANCE",
  "TRIBUNAL_REFERRAL",
  "MEDIATION_REFERRAL",
  "COMBINATION_REFERRAL",
  "OTHER_APPROPRIATE_COURSE",
] as const;

type Props = {
  data: DisciplineWorkspaceData;
  currentUserId: string;
  canCoordinate: boolean;
  isDecisionMaker: boolean;
  busy: boolean;
  onSavePanel: (values: DisciplineReviewPanelInput) => void;
  onVote: (values: DisciplineReviewPanelVoteInput) => void;
  onFinalise: (meetingReference: string, processNote: string) => void;
};

function profileLabel(data: DisciplineWorkspaceData, userId: string) {
  const profile = data.profileOptions.find((option) => option.id === userId);
  return profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || userId
    : userId;
}

function savedPanelToDraft(data: DisciplineWorkspaceData): ReviewPanelDraft {
  const panel = data.reviewPanels[0];
  if (!panel) {
    return {
      ...EMPTY_REVIEW_PANEL,
      members: EMPTY_REVIEW_PANEL.members.map((member) => ({ ...member })),
    };
  }

  const activeMembers = data.reviewPanelMembers.filter(
    (member) => member.panel_id === panel.id && member.active,
  );
  return {
    appointmentAuthority: panel.appointment_authority,
    authorityReference: panel.authority_reference || "",
    processNotes: panel.process_notes,
    members: [1, 2, 3].map((seatNumber) => {
      const member = activeMembers.find(
        (item) => item.seat_number === seatNumber,
      );
      if (!member) return { ...EMPTY_REVIEW_PANEL.members[seatNumber - 1] };
      return {
        seatNumber,
        fullName: member.full_name,
        email: member.email,
        profileId: member.profile_id || "",
        organisation: member.organisation || "",
        roleOrPosition: member.role_or_position || "",
        invitationStatus:
          member.invitation_status as ReviewPanelMemberDraft["invitationStatus"],
        trainingExperience: member.training_experience,
        clubAffiliation: member.club_affiliation || "",
        committeeRole: member.committee_role || "",
        relationshipToParties: member.relationship_to_parties || "",
        competitiveInterest: member.competitive_interest || "",
        conflictFactors: member.conflict_factors,
        actualConflict: member.actual_conflict ? "YES" : "NO",
        perceivedConflict: member.perceived_conflict ? "YES" : "NO",
        conflictDecision:
          member.conflict_decision as ReviewPanelMemberDraft["conflictDecision"],
        conflictReason: member.conflict_reason,
      };
    }),
  };
}

function GuidanceDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <HelpCircle className="mr-2 h-4 w-4" />
          How does the review panel work?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Independent review in plain language</DialogTitle>
          <DialogDescription>
            The panel reviews the signed investigation report. It does not redo
            the investigation or assume the reported person is guilty.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <section className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-semibold">What the rules establish</h3>
              <InformationBadge kind="RULE" />
            </div>
            <p className="text-muted-foreground">
              Rule 7.12 separates the investigator's recommendations from the
              Rule 7.7 determination. The decision-maker must consider the
              report and select an available outcome supported by the rules.
            </p>
          </section>
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Hockey Ballarat operating safeguard</AlertTitle>
            <AlertDescription>
              A three-person non-conflicted panel is the operating safeguard
              selected for this workflow. The source documents do not expressly
              require exactly three people or authorise an email poll. Record
              the actual appointment authority and the formal meeting or
              resolution reference. Formal HB approval of this local process is
              still required.
            </AlertDescription>
          </Alert>
          <section className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-semibold">Who is suitable?</h3>
              <InformationBadge kind="JUDGEMENT" />
            </div>
            <p className="text-muted-foreground">
              Record facts showing good standing, relevant experience, ability
              to understand the material and communicate reasons. Check actual,
              perceived and potential conflicts. A person involved in the
              investigation, preliminary merits discussion or a club with a
              material interest should not decide the outcome.
            </p>
          </section>
          <section className="rounded-lg border p-4">
            <h3 className="font-semibold">How the decision is recorded</h3>
            <p className="mt-1 text-muted-foreground">
              Each accepted member records their own outcome, reasons and rule
              source. Votes remain private until finalisation. The system
              requires all three votes and calculates a 2–1 or 3–0 majority. A
              three-way split cannot be finalised.
            </p>
          </section>
          <section className="rounded-lg border p-4">
            <h3 className="font-semibold">Source documents</h3>
            <ul className="mt-2 space-y-2 text-muted-foreground">
              {[
                [
                  HV_RULES_URL,
                  "Hockey Victoria Competition Rules 2026 — Rules 7.7 and 7.12",
                ],
                [
                  HB_BYLAW_ADDENDUM_URL,
                  "Hockey Ballarat By-law Addendum 2026 — clauses 2.1 and 3.1",
                ],
                [
                  SIA_INVESTIGATION_GUIDELINES_URL,
                  "Sport Integrity Australia — Investigation of Complaints Guidelines",
                ],
              ].map(([href, label]) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {label}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function YesNoSelect({
  value,
  onChange,
  disabled,
}: {
  value: "" | "YES" | "NO";
  onChange: (value: "YES" | "NO") => void;
  disabled: boolean;
}) {
  return (
    <Select
      value={value || undefined}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-full min-w-0 overflow-hidden">
        <SelectValue placeholder="Select Yes or No" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="NO">No</SelectItem>
        <SelectItem value="YES">Yes</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function DisciplineReviewPanel({
  data,
  currentUserId,
  canCoordinate,
  isDecisionMaker,
  busy,
  onSavePanel,
  onVote,
  onFinalise,
}: Props) {
  const panel = data.reviewPanels[0];
  const [draft, setDraft] = useState<ReviewPanelDraft>(() =>
    savedPanelToDraft(data),
  );
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [profileSearches, setProfileSearches] = useState<
    Record<number, string>
  >({});

  const activeMembers = useMemo(
    () =>
      data.reviewPanelMembers
        .filter(
          (member) => member.active && (!panel || member.panel_id === panel.id),
        )
        .sort((left, right) => left.seat_number - right.seat_number),
    [data.reviewPanelMembers, panel],
  );
  const ownMember = activeMembers.find(
    (member) => member.profile_id === currentUserId,
  );
  const latestVotes = useMemo(() => {
    const byMember = new Map<string, DisciplineReviewPanelVote>();
    data.reviewPanelVotes.forEach((vote) => {
      const current = byMember.get(vote.panel_member_id);
      if (!current || vote.revision_number > current.revision_number) {
        byMember.set(vote.panel_member_id, vote);
      }
    });
    return byMember;
  }, [data.reviewPanelVotes]);
  const ownVote = ownMember ? latestVotes.get(ownMember.id) : undefined;
  const panelLocked =
    data.reviewPanelVotes.length > 0 || data.decisions.length > 0;
  const canEditPanel =
    canCoordinate &&
    !panelLocked &&
    ["REPORT_SIGNED", "HB_DECISION"].includes(data.incidentCase.status);

  const updateMember = (
    seatIndex: number,
    changes: Partial<ReviewPanelMemberDraft>,
  ) => {
    setDraft((current) => ({
      ...current,
      members: current.members.map((member, index) =>
        index === seatIndex ? { ...member, ...changes } : member,
      ),
    }));
  };

  const submitPanel = (event: FormEvent) => {
    event.preventDefault();
    const errors = validateReviewPanel(draft);
    setValidationErrors(errors);
    if (errors.length) return;
    onSavePanel({
      appointmentAuthority: draft.appointmentAuthority,
      authorityReference: draft.authorityReference,
      processNotes: draft.processNotes,
      members: draft.members.map((member) => ({
        seat_number: member.seatNumber,
        full_name: member.fullName,
        email: member.email,
        profile_id: member.profileId || undefined,
        organisation: member.organisation,
        role_or_position: member.roleOrPosition,
        invitation_status: member.invitationStatus,
        training_experience: member.trainingExperience,
        club_affiliation: member.clubAffiliation,
        committee_role: member.committeeRole,
        relationship_to_parties: member.relationshipToParties,
        competitive_interest: member.competitiveInterest,
        conflict_factors: member.conflictFactors,
        actual_conflict: member.actualConflict === "YES",
        perceived_conflict: member.perceivedConflict === "YES",
        conflict_decision: member.conflictDecision as
          "NO_CONFLICT" | "MANAGED" | "REPLACE_MEMBER",
        conflict_reason: member.conflictReason,
      })),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            Independent review and HB decision
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up three eligible reviewers, open deliberation, then record each
            member's independent reasons and the majority result.
          </p>
        </div>
        <GuidanceDialog />
      </div>

      {panel ? (
        <Alert>
          <UserRoundCheck className="h-4 w-4" />
          <AlertTitle>Review panel: {formatStatus(panel.status)}</AlertTitle>
          <AlertDescription>
            {activeMembers.length} of 3 seats recorded;{" "}
            {
              activeMembers.filter(
                (member) => member.invitation_status === "ACCEPTED",
              ).length
            }{" "}
            accepted.
            {panel.status === "READY"
              ? " The Case Coordinator can now advance the case to HB Decision."
              : " All three eligible members must accept and link a SportStack account before deliberation opens."}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <Scale className="h-4 w-4" />
          <AlertTitle>No review panel recorded</AlertTitle>
          <AlertDescription>
            Complete all three member checks below. Saving an invitation status
            records the workflow state only; Phase 1 does not send the email.
          </AlertDescription>
        </Alert>
      )}

      {validationErrors.length ? (
        <Alert variant="destructive">
          <AlertTitle>Complete these items before saving</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {validationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <form className="space-y-5" onSubmit={submitPanel}>
        <Card>
          <CardHeader>
            <CardTitle>Panel authority and pathway</CardTitle>
            <CardDescription>
              Record what actually happened. Do not describe the three-person
              panel as an express Rule 7 requirement.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Who authorised the panel?</Label>
              <Input
                value={draft.appointmentAuthority}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    appointmentAuthority: event.target.value,
                  }))
                }
                disabled={!canEditPanel || busy}
                placeholder="Person or properly authorised body"
              />
            </div>
            <div className="space-y-2">
              <Label>Authority or minute reference</Label>
              <Input
                value={draft.authorityReference}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    authorityReference: event.target.value,
                  }))
                }
                disabled={!canEditPanel || busy}
                placeholder="Meeting minute, resolution or delegation reference"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Why was this review pathway selected?</Label>
              <Textarea
                value={draft.processNotes}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    processNotes: event.target.value,
                  }))
                }
                disabled={!canEditPanel || busy}
                placeholder="Explain the independence needs, unavailable committee members and how conflicted people were excluded from deciding the merits."
              />
            </div>
          </CardContent>
        </Card>

        {draft.members.map((member, index) => (
          <Card key={member.seatNumber}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>Panel member {member.seatNumber}</CardTitle>
                  <CardDescription>
                    Name and email may be entered before an account exists. An
                    account link is mandatory before acceptance and voting.
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
                  disabled={!canEditPanel || busy}
                />
              </div>
              <div className="space-y-2">
                <Label>Email address</Label>
                <Input
                  type="email"
                  value={member.email}
                  onChange={(event) =>
                    updateMember(index, { email: event.target.value })
                  }
                  disabled={!canEditPanel || busy}
                />
              </div>
              <div className="space-y-2">
                <Label>Linked SportStack account</Label>
                <Input
                  value={profileSearches[member.seatNumber] || ""}
                  onChange={(event) =>
                    setProfileSearches((current) => ({
                      ...current,
                      [member.seatNumber]: event.target.value,
                    }))
                  }
                  disabled={!canEditPanel || busy}
                  placeholder="Search account names"
                />
                <Select
                  value={member.profileId || "__none__"}
                  onValueChange={(value) => {
                    const profileId = value === "__none__" ? "" : value;
                    updateMember(index, {
                      profileId,
                      fullName:
                        profileId && !member.fullName.trim()
                          ? profileLabel(data, profileId)
                          : member.fullName,
                    });
                  }}
                  disabled={!canEditPanel || busy}
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
                          .trim()
                          .toLowerCase();
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
                        value as ReviewPanelMemberDraft["invitationStatus"],
                    })
                  }
                  disabled={!canEditPanel || busy}
                >
                  <SelectTrigger className="w-full min-w-0 overflow-hidden">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_SENT">Not sent</SelectItem>
                    <SelectItem value="SENT">
                      Sent outside SportStack
                    </SelectItem>
                    <SelectItem value="ACCEPTED">Accepted</SelectItem>
                    <SelectItem value="DECLINED">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Organisation or club</Label>
                <Input
                  value={member.organisation}
                  onChange={(event) =>
                    updateMember(index, { organisation: event.target.value })
                  }
                  disabled={!canEditPanel || busy}
                />
              </div>
              <div className="space-y-2">
                <Label>Role or position</Label>
                <Input
                  value={member.roleOrPosition}
                  onChange={(event) =>
                    updateMember(index, { roleOrPosition: event.target.value })
                  }
                  disabled={!canEditPanel || busy}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Why is this person suitable?</Label>
                <Textarea
                  value={member.trainingExperience}
                  onChange={(event) =>
                    updateMember(index, {
                      trainingExperience: event.target.value,
                    })
                  }
                  disabled={!canEditPanel || busy}
                  placeholder="Relevant experience, good standing, communication ability and capacity to understand the material."
                />
              </div>
              {[
                ["Club affiliation", "clubAffiliation"],
                ["Committee role", "committeeRole"],
                ["Relationship to parties", "relationshipToParties"],
                ["Competitive interest", "competitiveInterest"],
              ].map(([label, key]) => (
                <div className="space-y-2" key={key}>
                  <Label>{label}</Label>
                  <Input
                    value={
                      member[key as keyof ReviewPanelMemberDraft] as string
                    }
                    onChange={(event) =>
                      updateMember(index, { [key]: event.target.value })
                    }
                    disabled={!canEditPanel || busy}
                    placeholder="Record none if checked and none identified"
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label>Actual conflict identified?</Label>
                <YesNoSelect
                  value={member.actualConflict}
                  onChange={(value) =>
                    updateMember(index, { actualConflict: value })
                  }
                  disabled={!canEditPanel || busy}
                />
              </div>
              <div className="space-y-2">
                <Label>Perceived or potential conflict identified?</Label>
                <YesNoSelect
                  value={member.perceivedConflict}
                  onChange={(value) =>
                    updateMember(index, { perceivedConflict: value })
                  }
                  disabled={!canEditPanel || busy}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Conflict descriptors</Label>
                <div className="grid gap-2 md:grid-cols-2">
                  {REVIEW_PANEL_CONFLICT_FACTORS.map(([value, label]) => (
                    <label
                      key={value}
                      className="flex items-start gap-2 rounded-lg border p-3 text-sm"
                    >
                      <Checkbox
                        checked={member.conflictFactors.includes(value)}
                        disabled={!canEditPanel || busy}
                        onCheckedChange={(checked) =>
                          updateMember(index, {
                            conflictFactors: checked
                              ? [...member.conflictFactors, value]
                              : member.conflictFactors.filter(
                                  (factor) => factor !== value,
                                ),
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Conflict result</Label>
                <Select
                  value={member.conflictDecision || undefined}
                  onValueChange={(value) =>
                    updateMember(index, {
                      conflictDecision:
                        value as ReviewPanelMemberDraft["conflictDecision"],
                    })
                  }
                  disabled={!canEditPanel || busy}
                >
                  <SelectTrigger className="w-full min-w-0 overflow-hidden">
                    <SelectValue placeholder="Select result" />
                  </SelectTrigger>
                  <SelectContent>
                    {REVIEW_PANEL_CONFLICT_DECISIONS.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Reason and safeguards</Label>
                <Textarea
                  value={member.conflictReason}
                  onChange={(event) =>
                    updateMember(index, { conflictReason: event.target.value })
                  }
                  disabled={!canEditPanel || busy}
                  placeholder="Explain the facts checked, the result and any safeguards. Do not enter only ‘none’."
                />
              </div>
            </CardContent>
          </Card>
        ))}

        {canCoordinate ? (
          <Button type="submit" disabled={!canEditPanel || busy}>
            Save review panel setup
          </Button>
        ) : null}
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Independent panel vote</CardTitle>
          <CardDescription>
            Each member records their own decision after the Case Coordinator
            opens HB Decision. Other votes remain private until finalisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ownVote ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>
                Your vote revision {ownVote.revision_number} is recorded
              </AlertTitle>
              <AlertDescription>
                {formatStatus(ownVote.outcome)} ·{" "}
                {formatMelbourneDateTime(ownVote.submitted_at)}
              </AlertDescription>
            </Alert>
          ) : null}
          {isDecisionMaker &&
          ownMember &&
          data.incidentCase.status === "HB_DECISION" &&
          !data.decisions.length ? (
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                onVote({
                  outcome: String(form.get("outcome")),
                  decisionReason: String(form.get("decisionReason")),
                  ruleReference: String(form.get("ruleReference")),
                  recommendationFollowed:
                    form.get("recommendationFollowed") === "on",
                  differenceReason: String(form.get("differenceReason") || ""),
                  changeReason: String(form.get("changeReason") || ""),
                });
              }}
            >
              <div className="space-y-2">
                <Label>Outcome</Label>
                <Select name="outcome" defaultValue={ownVote?.outcome} required>
                  <SelectTrigger className="w-full min-w-0 overflow-hidden">
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTCOMES.map((outcome) => (
                      <SelectItem key={outcome} value={outcome}>
                        {formatStatus(outcome)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Your independent reasons</Label>
                <Textarea
                  name="decisionReason"
                  defaultValue={ownVote?.decision_reason}
                  minLength={10}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Rule source</Label>
                <Input
                  name="ruleReference"
                  defaultValue={
                    ownVote?.rule_reference ||
                    "HV Competition Rules 2026, Rule 7.7"
                  }
                  required
                />
              </div>
              <label className="flex items-center gap-3 rounded-lg border p-3">
                <Checkbox
                  name="recommendationFollowed"
                  defaultChecked={ownVote?.recommendation_followed ?? true}
                />
                Investigator recommendation followed
              </label>
              <div className="space-y-2">
                <Label>Reason for any difference</Label>
                <Textarea
                  name="differenceReason"
                  defaultValue={ownVote?.difference_reason || ""}
                />
              </div>
              {ownVote ? (
                <div className="space-y-2">
                  <Label>Why are you revising your earlier vote?</Label>
                  <Textarea name="changeReason" minLength={10} required />
                </div>
              ) : null}
              <Button type="submit" disabled={busy}>
                {ownVote ? "Record revised vote" : "Record my vote"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              {data.incidentCase.status === "REPORT_SIGNED"
                ? "The panel must be ready and the Case Coordinator must open HB Decision first."
                : "Only an accepted panel member can record an independent vote."}
            </p>
          )}
        </CardContent>
      </Card>

      {isDecisionMaker &&
      ownMember &&
      data.incidentCase.status === "HB_DECISION" &&
      !data.decisions.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Finalise the majority result</CardTitle>
            <CardDescription>
              The system checks for all three current votes and requires a 2–1
              or 3–0 majority. Pressing finalise does not let one person choose
              the outcome.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                onFinalise(
                  String(form.get("meetingReference")),
                  String(form.get("processNote")),
                );
              }}
            >
              <div className="space-y-2">
                <Label>
                  Meeting minute or formally authorised resolution reference
                </Label>
                <Input name="meetingReference" required minLength={3} />
              </div>
              <div className="space-y-2">
                <Label>Process note</Label>
                <Textarea
                  name="processNote"
                  required
                  minLength={10}
                  placeholder="Record how the three independent votes were obtained and any procedural safeguards."
                />
              </div>
              <Button type="submit" disabled={busy}>
                Calculate and finalise majority
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {data.decisions.map((decision) => (
        <Alert key={decision.id}>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>{formatStatus(decision.outcome)}</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{decision.decision_reason}</p>
            <p>
              {decision.rule_reference} ·{" "}
              {formatMelbourneDateTime(decision.decided_at)}
              {decision.majority_count
                ? ` · ${decision.majority_count}–${decision.minority_count} majority`
                : ""}
            </p>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

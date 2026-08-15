import { FormEvent, useMemo, useState } from "react";
import {
  BookOpen,
  ExternalLink,
  HelpCircle,
  Search,
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
import { combineZonedDateTime } from "@/lib/timezoneDateTime";
import { cn } from "@/lib/utils";
import { HB_BYLAW_ADDENDUM_URL, HV_RULES_URL, SIA_INVESTIGATION_GUIDE_URL } from "./disciplineIntakeContent";
import {
  CONFLICT_DECISIONS,
  CONFLICT_FACTORS,
  EMPTY_INVESTIGATOR_SETUP,
  INVESTIGATION_TYPES,
  validateInvestigatorSetup,
  type InvestigatorSetupDraft,
} from "./investigatorSetupLogic";
import { InformationBadge, WorkflowSection } from "./DisciplineUi";
import { formatMelbourneDateTime, formatStatus } from "./format";
import type {
  DisciplineInvestigatorSetupInput,
  DisciplineWorkspaceData,
} from "./types";

type Props = {
  data: DisciplineWorkspaceData;
  canCoordinate: boolean;
  busy: boolean;
  onSave: (values: DisciplineInvestigatorSetupInput) => void;
};

const CONFLICT_FACTOR_LABELS = new Map<string, string>(CONFLICT_FACTORS);
const CONFLICT_RESULT_STYLES: Record<string, string> = {
  NO_CONFLICT:
    "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100",
  MANAGED:
    "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
  REPLACE_INVESTIGATOR:
    "border-red-500/40 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100",
};

function profileLabel(data: DisciplineWorkspaceData, userId: string) {
  const profile = data.profileOptions.find((option) => option.id === userId);
  return profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || userId
    : userId;
}

function SourceLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function InvestigatorGuidance() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <HelpCircle className="mr-2 h-4 w-4" />
          How do I choose an investigator?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Investigation setup in plain language</DialogTitle>
          <DialogDescription>
            This screen records who will investigate, why they are suitable and
            whether anything could affect — or appear to affect — their
            independence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <section className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-semibold">What Rule 7.12 requires</h3>
              <InformationBadge kind="RULE" />
            </div>
            <p className="text-muted-foreground">
              Hockey Victoria decides whether an internal investigation or an
              independent external investigator is appropriate after considering
              the nature and seriousness of the allegation. The appointed
              officer should have no conflict of interest and appropriate
              training or experience.
            </p>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            {INVESTIGATION_TYPES.map((item) => (
              <div key={item.value} className="rounded-lg border p-4">
                <h3 className="font-semibold">{item.label}</h3>
                <p className="mt-1 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </section>

          <section className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-semibold">Actual and perceived conflicts</h3>
              <InformationBadge kind="JUDGEMENT" />
            </div>
            <p className="text-muted-foreground">
              An actual conflict directly affects the person's ability to act
              independently. A perceived conflict is a connection or interest
              that a reasonable person could think may affect independence, even
              if the investigator believes it will not. Record the facts, not
              just “none”.
            </p>
          </section>

          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Hockey Ballarat operating interpretation</AlertTitle>
            <AlertDescription>
              The HB addendum adopts the HV rules with “HV” read as “HB” where
              practicable, but it does not name the exact local equivalent of
              the HV CEO or delegate for Rule 7.12 appointments. Record the
              actual person or body that authorised this appointment. Formal HB
              approval of that authority mapping is still required.
            </AlertDescription>
          </Alert>

          <section className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-semibold">
                Support investigators and descriptors
              </h3>
              <InformationBadge kind="LOCAL INTERPRETATION" />
            </div>
            <p className="text-muted-foreground">
              Support investigators and the conflict descriptor tags are
              practical HB record-keeping tools; they are not a quoted Rule 7
              list. One Lead Investigation Officer remains accountable for the
              investigation.
            </p>
          </section>

          <section className="rounded-lg border p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <BookOpen className="h-4 w-4" /> Official source documents
            </h3>
            <ul className="mt-2 space-y-2 text-muted-foreground">
              <li>
                <SourceLink href={HV_RULES_URL}>
                  Hockey Victoria Competition Rules 2026
                </SourceLink>
                {" — Rule 7.12, numbered page 29."}
              </li>
              <li>
                <SourceLink href={HB_BYLAW_ADDENDUM_URL}>
                  Hockey Ballarat By-law Addendum 2026
                </SourceLink>
                {" — clauses 2.1 and 3.1."}
              </li>
              <li>
                <SourceLink href={SIA_INVESTIGATION_GUIDE_URL}>
                  Sport Integrity Australia investigation guide
                </SourceLink>
                {" — conflict identification and management, sections 3.3–3.4."}
              </li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConflictResult({ decision }: { decision: string }) {
  return (
    <Badge variant="outline" className={CONFLICT_RESULT_STYLES[decision] || ""}>
      {formatStatus(decision)}
    </Badge>
  );
}

function SavedSetups({ data }: { data: DisciplineWorkspaceData }) {
  if (data.investigatorSetups.length === 0) {
    return (
      <Alert>
        <UserRoundCheck className="h-4 w-4" />
        <AlertTitle>No investigator setup recorded</AlertTitle>
        <AlertDescription>
          The case cannot move into the investigating stage until an acceptable
          appointment and independence check is saved.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {data.investigatorSetups.map((setup, index) => (
        <details
          key={setup.id}
          open={index === 0}
          className="rounded-lg border bg-background p-4"
        >
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {index === 0
                    ? "Current recorded check"
                    : "Earlier recorded check"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {profileLabel(data, setup.lead_user_id)} · recorded{" "}
                  {formatMelbourneDateTime(setup.recorded_at)}
                </p>
              </div>
              <ConflictResult decision={setup.conflict_decision} />
            </div>
          </summary>

          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="font-medium">Investigation pathway</dt>
              <dd className="text-muted-foreground">
                {formatStatus(setup.investigation_type)}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Appointed</dt>
              <dd className="text-muted-foreground">
                {formatMelbourneDateTime(setup.appointed_at)}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Appointment authority</dt>
              <dd className="text-muted-foreground">
                {setup.appointment_authority}
                {setup.authority_reference
                  ? ` — ${setup.authority_reference}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Support investigators</dt>
              <dd className="text-muted-foreground">
                {setup.support_user_ids.length
                  ? setup.support_user_ids
                      .map((id) => profileLabel(data, id))
                      .join(", ")
                  : "None"}
              </dd>
            </div>
            <div className="md:col-span-2">
              <dt className="font-medium">Training and experience</dt>
              <dd className="whitespace-pre-wrap text-muted-foreground">
                {setup.training_experience}
              </dd>
            </div>
            {[
              ["Club affiliation", setup.club_affiliation],
              ["Committee role", setup.committee_role],
              ["Relationship to parties", setup.relationship_to_parties],
              ["Competitive interest", setup.competitive_interest],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-medium">{label}</dt>
                <dd className="text-muted-foreground">
                  {value || "None disclosed"}
                </dd>
              </div>
            ))}
            <div className="md:col-span-2">
              <dt className="font-medium">
                Conflict questions and descriptors
              </dt>
              <dd className="text-muted-foreground">
                Actual: {setup.actual_conflict ? "Yes" : "No"}; perceived:{" "}
                {setup.perceived_conflict ? "Yes" : "No"}.
                {setup.conflict_factors.length
                  ? ` ${setup.conflict_factors
                      .map(
                        (factor) =>
                          CONFLICT_FACTOR_LABELS.get(factor) ||
                          formatStatus(factor),
                      )
                      .join(", ")}.`
                  : " No conflict descriptors recorded."}
              </dd>
            </div>
            <div className="md:col-span-2">
              <dt className="font-medium">
                Conflict decision reason and safeguards
              </dt>
              <dd className="whitespace-pre-wrap text-muted-foreground">
                {setup.conflict_reason}
              </dd>
            </div>
          </dl>
        </details>
      ))}
    </div>
  );
}

export function DisciplineInvestigatorSetupPanel({
  data,
  canCoordinate,
  busy,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<InvestigatorSetupDraft>(
    EMPTY_INVESTIGATOR_SETUP,
  );
  const [supportSearch, setSupportSearch] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const supportOptions = useMemo(() => {
    const query = supportSearch.trim().toLowerCase();
    const matches: DisciplineWorkspaceData["profileOptions"] = [];
    for (const profile of data.profileOptions) {
      if (profile.id === draft.leadUserId) continue;
      const label = `${profile.first_name || ""} ${profile.last_name || ""}`
        .trim()
        .toLowerCase();
      if (query && !label.includes(query)) continue;
      matches.push(profile);
      if (matches.length === 12) break;
    }
    return matches;
  }, [data.profileOptions, draft.leadUserId, supportSearch]);

  const update = <K extends keyof InvestigatorSetupDraft>(
    key: K,
    value: InvestigatorSetupDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateInvestigatorSetup(draft);
    setErrors(nextErrors);
    if (
      nextErrors.length > 0 ||
      !draft.investigationType ||
      !draft.conflictDecision
    )
      return;

    onSave({
      leadUserId: draft.leadUserId,
      supportUserIds: draft.supportUserIds,
      appointedAt: combineZonedDateTime(
        draft.appointedDate,
        draft.appointedTime,
      ),
      investigationType: draft.investigationType,
      appointmentAuthority: draft.appointmentAuthority.trim(),
      authorityReference: draft.authorityReference.trim(),
      trainingExperience: draft.trainingExperience.trim(),
      clubAffiliation: draft.clubAffiliation.trim(),
      committeeRole: draft.committeeRole.trim(),
      relationshipToParties: draft.relationshipToParties.trim(),
      competitiveInterest: draft.competitiveInterest.trim(),
      conflictFactors: draft.conflictFactors,
      actualConflict: draft.actualConflict === "YES",
      perceivedConflict: draft.perceivedConflict === "YES",
      conflictDecision: draft.conflictDecision,
      conflictReason: draft.conflictReason.trim(),
    });
  };

  const conflictIdentified =
    draft.actualConflict === "YES" || draft.perceivedConflict === "YES";

  return (
    <>
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>
                Screen 3: Investigation setup and independence
              </CardTitle>
              <CardDescription className="mt-1 max-w-3xl">
                Select the investigation pathway, appoint one accountable lead,
                record relevant experience, and complete a factual conflict
                check before investigation work begins.
              </CardDescription>
            </div>
            <InvestigatorGuidance />
          </div>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 text-sm md:grid-cols-3">
            <li className="rounded-lg border bg-background p-3">
              <strong>1. Choose the pathway and people</strong>
              <span className="mt-1 block text-muted-foreground">
                Record internal or external, the lead, supports and who
                authorised it.
              </span>
            </li>
            <li className="rounded-lg border bg-background p-3">
              <strong>2. Record suitability and connections</strong>
              <span className="mt-1 block text-muted-foreground">
                Capture experience, affiliations, roles, relationships and
                interests.
              </span>
            </li>
            <li className="rounded-lg border bg-background p-3">
              <strong>3. Decide independence</strong>
              <span className="mt-1 block text-muted-foreground">
                Record no conflict, safeguards for a perceived conflict, or
                replacement.
              </span>
            </li>
          </ol>
        </CardContent>
      </Card>

      <WorkflowSection
        title="Recorded appointment and independence checks"
        description="Each saved check is retained. The newest record appears first."
        kind="FACT"
        responsibleRole="Committee / Case Coordinator"
        reviewRole="Appointed investigator"
      >
        <SavedSetups data={data} />
      </WorkflowSection>

      {canCoordinate ? (
        <WorkflowSection
          title="Record a new appointment and independence check"
          description="Do not assume a blank disclosure means no conflict. Ask the questions and record the answers."
          kind="JUDGEMENT"
          responsibleRole="Committee / Case Coordinator"
          reviewRole="Appointed investigator"
        >
          <form className="space-y-6" onSubmit={submit} noValidate>
            {errors.length > 0 ? (
              <Alert variant="destructive">
                <AlertTitle>
                  Complete the highlighted decision information
                </AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            <fieldset className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
              <legend className="px-2 font-semibold">
                1. Pathway and appointment
              </legend>
              <div className="space-y-2">
                <Label>Investigation pathway</Label>
                <Select
                  value={draft.investigationType}
                  onValueChange={(value) =>
                    update(
                      "investigationType",
                      value as InvestigatorSetupDraft["investigationType"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select internal or external" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVESTIGATION_TYPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Rule 7.12 says the nature and seriousness of the allegation
                  inform this choice.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Lead Investigation Officer</Label>
                <Select
                  value={draft.leadUserId}
                  onValueChange={(value) => {
                    update("leadUserId", value);
                    update(
                      "supportUserIds",
                      draft.supportUserIds.filter((id) => id !== value),
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select the accountable lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.profileOptions.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profileLabel(data, profile.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Investigators need a SportStack profile so private case access
                  can be controlled and audited.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="investigator-appointed-date">
                  Appointment date
                </Label>
                <Input
                  id="investigator-appointed-date"
                  type="date"
                  value={draft.appointedDate}
                  onChange={(event) =>
                    update("appointedDate", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="investigator-appointed-time">
                  Appointment time
                </Label>
                <Input
                  id="investigator-appointed-time"
                  type="time"
                  value={draft.appointedTime}
                  onChange={(event) =>
                    update("appointedTime", event.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Use when the appointment was authorised, not a future planned
                  time.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointment-authority">
                  Who authorised the appointment?
                </Label>
                <Input
                  id="appointment-authority"
                  value={draft.appointmentAuthority}
                  onChange={(event) =>
                    update("appointmentAuthority", event.target.value)
                  }
                  placeholder="Actual person or HB body"
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <InformationBadge kind="LOCAL INTERPRETATION" />
                  Exact HB Rule 7.12 appointment authority needs formal
                  confirmation.
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="authority-reference">
                  Authority reference (optional)
                </Label>
                <Input
                  id="authority-reference"
                  value={draft.authorityReference}
                  onChange={(event) =>
                    update("authorityReference", event.target.value)
                  }
                  placeholder="Meeting minute, delegation or email reference"
                />
              </div>

              <div className="space-y-3 md:col-span-2">
                <div>
                  <Label htmlFor="support-search">
                    Support investigators (optional)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Select helpers only. The lead remains accountable. Maximum
                    10.
                  </p>
                </div>
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="support-search"
                    className="pl-9"
                    value={supportSearch}
                    onChange={(event) => setSupportSearch(event.target.value)}
                    placeholder="Search profile names"
                  />
                </div>
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-lg border p-3 md:grid-cols-2">
                  {supportOptions.length ? (
                    supportOptions.map((profile) => {
                      const checked = draft.supportUserIds.includes(profile.id);
                      return (
                        <label
                          key={profile.id}
                          className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/60"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) =>
                              update(
                                "supportUserIds",
                                next
                                  ? [...draft.supportUserIds, profile.id]
                                  : draft.supportUserIds.filter(
                                      (id) => id !== profile.id,
                                    ),
                              )
                            }
                          />
                          <span className="text-sm">
                            {profileLabel(data, profile.id)}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No matching profiles.
                    </p>
                  )}
                </div>
              </div>
            </fieldset>

            <fieldset className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
              <legend className="px-2 font-semibold">
                2. Suitability and connections
              </legend>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="training-experience">
                  Relevant training and experience
                </Label>
                <Textarea
                  id="training-experience"
                  value={draft.trainingExperience}
                  onChange={(event) =>
                    update("trainingExperience", event.target.value)
                  }
                  placeholder="Examples: investigation training, procedural fairness experience, previous disciplinary investigations, report writing"
                />
                <p className="text-xs text-muted-foreground">
                  Rule 7.12 requires appropriate training or experience; it does
                  not prescribe one qualification.
                </p>
              </div>
              {[
                [
                  "clubAffiliation",
                  "Club or team affiliation",
                  "Current or recent clubs or teams; write ‘None’ if asked and none disclosed.",
                ],
                [
                  "committeeRole",
                  "Committee or decision-making role",
                  "HB or club committee, selection, coaching or other authority roles.",
                ],
                [
                  "relationshipToParties",
                  "Relationship to any party",
                  "Personal, family, business, supervisory or other connections.",
                ],
                [
                  "competitiveInterest",
                  "Competitive interest",
                  "Any result, ladder, selection, club or team interest that could be affected.",
                ],
              ].map(([key, label, placeholder]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`investigator-${key}`}>{label}</Label>
                  <Textarea
                    id={`investigator-${key}`}
                    value={
                      draft[
                        key as keyof Pick<
                          InvestigatorSetupDraft,
                          | "clubAffiliation"
                          | "committeeRole"
                          | "relationshipToParties"
                          | "competitiveInterest"
                        >
                      ]
                    }
                    onChange={(event) =>
                      update(
                        key as keyof InvestigatorSetupDraft,
                        event.target.value,
                      )
                    }
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </fieldset>

            <fieldset className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
              <legend className="px-2 font-semibold">
                3. Independence decision
              </legend>
              <div className="space-y-2">
                <Label>Is there an actual conflict of interest?</Label>
                <Select
                  value={draft.actualConflict}
                  onValueChange={(value) =>
                    update("actualConflict", value as "YES" | "NO")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Yes or No" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YES">Yes</SelectItem>
                    <SelectItem value="NO">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Could there be a perceived conflict?</Label>
                <Select
                  value={draft.perceivedConflict}
                  onValueChange={(value) =>
                    update("perceivedConflict", value as "YES" | "NO")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Yes or No" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YES">Yes</SelectItem>
                    <SelectItem value="NO">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {conflictIdentified ? (
                <div className="space-y-3 md:col-span-2">
                  <div>
                    <Label>Possible conflict descriptors</Label>
                    <p className="text-xs text-muted-foreground">
                      Practical prompts only — select every descriptor that
                      applies.
                    </p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {CONFLICT_FACTORS.map(([value, label]) => (
                      <label
                        key={value}
                        className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                      >
                        <Checkbox
                          checked={draft.conflictFactors.includes(value)}
                          onCheckedChange={(next) =>
                            update(
                              "conflictFactors",
                              next
                                ? [...draft.conflictFactors, value]
                                : draft.conflictFactors.filter(
                                    (item) => item !== value,
                                  ),
                            )
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2 md:col-span-2">
                <Label>Independence decision</Label>
                <Select
                  value={draft.conflictDecision}
                  onValueChange={(value) =>
                    update(
                      "conflictDecision",
                      value as InvestigatorSetupDraft["conflictDecision"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select the decision supported by the disclosures" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFLICT_DECISIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="conflict-reason">
                  Reason, evidence and safeguards
                </Label>
                <Textarea
                  id="conflict-reason"
                  value={draft.conflictReason}
                  onChange={(event) =>
                    update("conflictReason", event.target.value)
                  }
                  placeholder="Explain the facts considered, why the decision is appropriate and any independent review, information barrier or other safeguard."
                />
              </div>

              <Alert
                className={cn(
                  "md:col-span-2",
                  draft.conflictDecision === "REPLACE_INVESTIGATOR" &&
                    "border-red-500/40 bg-red-50 dark:bg-red-950/20",
                )}
              >
                <AlertTitle>What happens when this is saved?</AlertTitle>
                <AlertDescription>
                  {draft.conflictDecision === "REPLACE_INVESTIGATOR"
                    ? "The check is retained, but the proposed investigator is not given investigator access. Record a new check for the replacement."
                    : "The accepted lead and support investigators receive the matching private case roles. Any superseded investigator access is revoked, while the case coordinator remains protected."}
                </AlertDescription>
              </Alert>
            </fieldset>

            <Button type="submit" disabled={busy}>
              Record appointment and independence check
            </Button>
          </form>
        </WorkflowSection>
      ) : (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Read-only appointment record</AlertTitle>
          <AlertDescription>
            A Case Coordinator records or changes the investigator appointment.
            Assigned investigators can see the recorded basis and safeguards.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}

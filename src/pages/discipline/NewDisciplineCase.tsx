import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Edit3,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  ShieldAlert,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DisciplineTagPicker } from "@/features/discipline/DisciplineTagPicker";
import {
  ConflictGuidance,
  JurisdictionGuidance,
  JurisdictionPathwayDetails,
} from "@/features/discipline/DisciplineIntakeGuidance";
import { JURISDICTION_HELP } from "@/features/discipline/disciplineIntakeContent";
import { PredictiveTextInput } from "@/features/discipline/PredictiveTextInput";
import {
  addDisciplineCasePerson,
  addDisciplineEvidence,
  createDisciplineCase,
  loadAssociationOptions,
  loadDisciplineIntakeOptions,
  recordDisciplineRiskAssessment,
} from "@/features/discipline/api";
import {
  InformationBadge,
  WorkflowSection,
} from "@/features/discipline/DisciplineUi";
import type {
  DisciplineIntakeOptions,
  DisciplineIntakeTagOption,
} from "@/features/discipline/types";
import { useDisciplineAccess } from "@/features/discipline/useDisciplineAccess";
import { useToast } from "@/hooks/use-toast";
import {
  combineZonedDateTime,
  splitZonedDateTime,
} from "@/lib/timezoneDateTime";

type CheckboxKey =
  | "immediateRisk"
  | "reportInWriting"
  | "prescribedForm"
  | "reportComplete"
  | "desiredOutcome"
  | "priorPresentation";

type LinkedTextValue = {
  value: string;
  id?: string;
};

type PersonDraft = {
  localId: string;
  caseRole: "REPORTER" | "REPORTED_PERSON" | "WITNESS" | "AFFECTED_PERSON" | "OTHER";
  fullName: string;
  organisation: string;
  personRole: string;
  otherRole: string;
  email: string;
  profileId?: string;
  clubId?: string;
};

type RiskAssessmentDraft = {
  riskDescription: string;
  likelihood: string;
  severity: string;
  mitigationAction: string;
  responsiblePerson: string;
  reviewAt: string;
};

type SourceDocumentDraft = {
  localId: string;
  documentType: "COMPLAINT" | "RESPONSE" | "ACTION" | "OTHER";
  title: string;
  file: File;
};

type AllegationDraft = {
  localId: string;
  title: string;
  description: string;
  incidentDate: string;
  incidentTime: string;
  location: string;
  tagIds: string[];
};

const emptyPerson = (caseRole: PersonDraft["caseRole"] = "REPORTER"): PersonDraft => ({
  localId: crypto.randomUUID(),
  caseRole,
  fullName: "",
  organisation: "",
  personRole: "",
  otherRole: "",
  email: "",
});

const emptyRiskAssessment = (): RiskAssessmentDraft => ({
  riskDescription: "",
  likelihood: "",
  severity: "",
  mitigationAction: "",
  responsiblePerson: "",
  reviewAt: "",
});

const newAllegation = (
  defaults?: Partial<AllegationDraft>,
): AllegationDraft => ({
  localId: crypto.randomUUID(),
  title: "",
  description: "",
  incidentDate: "",
  incidentTime: "",
  location: "",
  tagIds: [],
  ...defaults,
});

const tagsFor = (
  options: DisciplineIntakeOptions | undefined,
  scope: DisciplineIntakeTagOption["scope"],
) => options?.tags.filter((tag) => tag.scope === scope) ?? [];

function PersonFields({
  prefix,
  value,
  onChange,
  profiles,
  clubs,
}: {
  prefix: string;
  value: PersonDraft;
  onChange: (value: PersonDraft) => void;
  profiles: DisciplineIntakeOptions["profiles"];
  clubs: DisciplineIntakeOptions["clubs"];
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Person category</Label>
        <Select
          value={value.caseRole}
          onValueChange={(caseRole) =>
            onChange({ ...value, caseRole: caseRole as PersonDraft["caseRole"] })
          }
        >
          <SelectTrigger aria-label="Person category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="REPORTER">Reporter</SelectItem>
            <SelectItem value="REPORTED_PERSON">Reported person</SelectItem>
            <SelectItem value="WITNESS">Witness</SelectItem>
            <SelectItem value="AFFECTED_PERSON">Affected person</SelectItem>
            <SelectItem value="OTHER">Other person</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <PredictiveTextInput
        id={`${prefix}-name`}
        label="Full name"
        value={value.fullName}
        options={profiles.map((profile) => ({
          ...profile,
          description: profile.club,
        }))}
        onChange={(fullName, match) =>
          onChange({
            ...value,
            fullName,
            profileId: match?.id,
            organisation: match?.club ?? value.organisation,
            clubId: match?.club_id ?? value.clubId,
          })
        }
        helperText="Choose a SportStack person or type the name exactly as reported."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <PredictiveTextInput
          id={`${prefix}-organisation`}
          label="Club or organisation"
          value={value.organisation}
          options={clubs}
          onChange={(organisation, match) =>
            onChange({
              ...value,
              organisation,
              clubId: match?.id,
            })
          }
        />
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={value.personRole} onValueChange={(personRole) => onChange({ ...value, personRole })}>
            <SelectTrigger aria-label="Role"><SelectValue placeholder="Select a role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Player">Player</SelectItem>
              <SelectItem value="Umpire">Umpire</SelectItem>
              <SelectItem value="Coach">Coach</SelectItem>
              <SelectItem value="Spectator">Spectator</SelectItem>
              <SelectItem value="Volunteer">Volunteer</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {value.personRole === "Other" ? (
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-other-role`}>Other role description</Label>
          <Input
            id={`${prefix}-other-role`}
            value={value.otherRole}
            placeholder="Describe the person's role"
            onChange={(event) => onChange({ ...value, otherRole: event.target.value })}
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-email`}>Email</Label>
        <Input
          id={`${prefix}-email`}
          value={value.email}
          onChange={(event) =>
            onChange({ ...value, email: event.target.value })
          }
          type="email"
        />
      </div>
    </div>
  );
}

function AllegationEditorDialog({
  allegation,
  number,
  tags,
  onChange,
}: {
  allegation: AllegationDraft;
  number: number;
  tags: DisciplineIntakeTagOption[];
  onChange: (patch: Partial<AllegationDraft>) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Edit3 className="mr-2 h-4 w-4" /> {allegation.title ? "Edit" : "Complete"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Allegation {number}</DialogTitle>
          <DialogDescription>Record one separate reported act. This is an allegation, not a finding.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor={`allegation-title-${allegation.localId}`}>Neutral allegation title</Label><Input id={`allegation-title-${allegation.localId}`} value={allegation.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="For example: Reported language near the home dugout" minLength={3} required /></div>
          <div className="space-y-2"><Label htmlFor={`allegation-description-${allegation.localId}`}>Reported facts and known particulars</Label><Textarea id={`allegation-description-${allegation.localId}`} value={allegation.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="Record who allegedly did what, when and where. Identify uncertainty." minLength={5} required /></div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2"><Label htmlFor={`allegation-date-${allegation.localId}`}>Date</Label><Input id={`allegation-date-${allegation.localId}`} type="date" value={allegation.incidentDate} onChange={(event) => onChange({ incidentDate: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor={`allegation-time-${allegation.localId}`}>Time</Label><Input id={`allegation-time-${allegation.localId}`} type="time" value={allegation.incidentTime} onChange={(event) => onChange({ incidentTime: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor={`allegation-location-${allegation.localId}`}>Location</Label><Input id={`allegation-location-${allegation.localId}`} value={allegation.location} onChange={(event) => onChange({ location: event.target.value })} /></div>
          </div>
          <DisciplineTagPicker label="Reported-fact descriptors" description="Select factual descriptors for searching and triage. The information button explains each tag without selecting it." tags={tags} selectedIds={allegation.tagIds} onChange={(tagIds) => onChange({ tagIds })} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function NewDisciplineCase() {
  const { context, user } = useDisciplineAccess();
  const associationsQuery = useQuery({
    queryKey: ["discipline-associations", context?.association_ids],
    queryFn: () => loadAssociationOptions(context?.association_ids ?? []),
    enabled: Boolean(context),
  });
  const [associationId, setAssociationId] = useState("");
  const optionsQuery = useQuery({
    queryKey: ["discipline-intake-options", associationId],
    queryFn: () => loadDisciplineIntakeOptions(associationId),
    enabled: Boolean(associationId),
  });
  const [roundType, setRoundType] = useState("REGULAR");
  const [jurisdiction, setJurisdiction] = useState("UNASSESSED");
  const [relevantClub, setRelevantClub] = useState<"YES" | "NO" | "">("");
  const [jurisdictionTagIds, setJurisdictionTagIds] = useState<string[]>([]);
  const [safetyTagIds, setSafetyTagIds] = useState<string[]>([]);
  const [fixtureSearch, setFixtureSearch] = useState("");
  const [fixtureId, setFixtureId] = useState<string>();
  const [competition, setCompetition] = useState<LinkedTextValue>({ value: "" });
  const [grade, setGrade] = useState<LinkedTextValue>({ value: "" });
  const [roundLabel, setRoundLabel] = useState("");
  const [homeTeam, setHomeTeam] = useState<LinkedTextValue>({ value: "" });
  const [awayTeam, setAwayTeam] = useState<LinkedTextValue>({ value: "" });
  const [venue, setVenue] = useState<LinkedTextValue>({ value: "" });
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentTime, setIncidentTime] = useState("");
  const [incidentLocation, setIncidentLocation] = useState("");
  const [people, setPeople] = useState<PersonDraft[]>([]);
  const [personEditor, setPersonEditor] = useState<PersonDraft | null>(null);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [riskDialogOpen, setRiskDialogOpen] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessmentDraft>(emptyRiskAssessment);
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocumentDraft[]>([]);
  const [allegations, setAllegations] = useState<AllegationDraft[]>(() => [
    newAllegation(),
  ]);
  const [checks, setChecks] = useState<Record<CheckboxKey, boolean>>({
    immediateRisk: false,
    reportInWriting: false,
    prescribedForm: false,
    reportComplete: false,
    desiredOutcome: false,
    priorPresentation: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!associationId && associationsQuery.data?.length === 1) {
      setAssociationId(associationsQuery.data[0].id);
    }
  }, [associationId, associationsQuery.data]);

  const associationTimezone =
    associationsQuery.data?.find((item) => item.id === associationId)
      ?.timezone ?? "Australia/Melbourne";
  const options = optionsQuery.data;
  const pathwayHelp = JURISDICTION_HELP[jurisdiction];
  const referralPath = [
    "NIF_REFERRAL",
    "EXTERNAL_SAFETY_REFERRAL",
    "OTHER_REFERRAL",
  ].includes(jurisdiction);

  const roundOptions = useMemo(() => {
    const seen = new Set<string>();
    return (options?.fixtures ?? [])
      .filter((fixture) => {
        if (!fixture.round_label || seen.has(fixture.round_label)) return false;
        seen.add(fixture.round_label);
        return true;
      })
      .map((fixture) => ({ id: fixture.id, label: fixture.round_label! }));
  }, [options?.fixtures]);

  const setCheck = (key: CheckboxKey, value: boolean) =>
    setChecks((current) => ({ ...current, [key]: value }));

  const applyFixture = (fixture: DisciplineIntakeOptions["fixtures"][number]) => {
    const matchParts = splitZonedDateTime(
      fixture.match_concluded_at,
      associationTimezone,
    );
    const incidentParts = splitZonedDateTime(
      fixture.fixture_at,
      associationTimezone,
    );
    setFixtureId(fixture.id);
    setCompetition({
      value: fixture.competition ?? "",
      id: fixture.competition_id ?? undefined,
    });
    setGrade({ value: fixture.grade ?? "", id: fixture.division_id ?? undefined });
    setRoundLabel(fixture.round_label ?? "");
    setHomeTeam({ value: fixture.home_team, id: fixture.home_team_id });
    setAwayTeam({ value: fixture.away_team, id: fixture.away_team_id });
    setVenue({ value: fixture.venue ?? "", id: fixture.venue_id ?? undefined });
    setMatchDate(matchParts.fixture_date);
    setMatchTime(matchParts.game_time);
    setIncidentDate((current) => current || incidentParts.fixture_date);
  };

  const updateAllegation = (
    localId: string,
    patch: Partial<AllegationDraft>,
  ) => {
    setAllegations((current) =>
      current.map((allegation) =>
        allegation.localId === localId
          ? { ...allegation, ...patch }
          : allegation,
      ),
    );
  };

  const savePerson = () => {
    if (!personEditor?.fullName.trim()) return;
    setPeople((current) => {
      const exists = current.some((person) => person.localId === personEditor.localId);
      return exists
        ? current.map((person) => person.localId === personEditor.localId ? personEditor : person)
        : [...current, personEditor];
    });
    setPersonDialogOpen(false);
    setPersonEditor(null);
  };

  const addSourceDocuments = (files: FileList | null) => {
    if (!files) return;
    setSourceDocuments((current) => [
      ...current,
      ...Array.from(files).map((file) => ({
        localId: crypto.randomUUID(),
        documentType: "COMPLAINT" as const,
        title: file.name,
        file,
      })),
    ]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      if (checks.immediateRisk && (
        riskAssessment.riskDescription.trim().length < 5
        || !riskAssessment.likelihood
        || !riskAssessment.severity
        || riskAssessment.mitigationAction.trim().length < 5
      )) {
        throw new Error("Complete the immediate risk assessment before creating the case.");
      }
      const reporter = people.find((person) => person.caseRole === "REPORTER");
      const reportedPerson = people.find((person) => person.caseRole === "REPORTED_PERSON");
      const caseId = await createDisciplineCase({
        association_id: associationId,
        title: String(form.get("title") || ""),
        jurisdiction_path: jurisdiction,
        jurisdiction_reason: String(form.get("jurisdictionReason") || ""),
        jurisdiction_tag_ids: jurisdictionTagIds,
        immediate_safety_risk: checks.immediateRisk,
        immediate_safety_action: riskAssessment.mitigationAction,
        safety_tag_ids: safetyTagIds,
        fixture_id: fixtureId,
        competition_id: competition.id,
        division_id: grade.id,
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        venue_id: venue.id,
        competition: competition.value,
        grade: grade.value,
        round_label: roundLabel,
        round_type: roundType,
        relevant_club_participating: relevantClub
          ? relevantClub === "YES"
          : undefined,
        first_named_team: homeTeam.value,
        second_named_team: awayTeam.value,
        match_concluded_at: combineZonedDateTime(
          matchDate,
          matchTime,
          associationTimezone,
        ),
        incident_at: incidentDate
          ? combineZonedDateTime(
              incidentDate,
              incidentTime || "00:00",
              associationTimezone,
            )
          : undefined,
        venue: venue.value,
        incident_location: incidentLocation,
        report_received_at: form.get("reportDate")
          ? combineZonedDateTime(
              String(form.get("reportDate")),
              String(form.get("reportTime") || "00:00"),
              associationTimezone,
            )
          : undefined,
        report_method: String(form.get("reportMethod") || ""),
        report_in_writing: checks.reportInWriting,
        prescribed_form_used: checks.prescribedForm,
        report_complete: checks.reportComplete,
        desired_outcome_included: checks.desiredOutcome,
        prior_presentation_completed: checks.priorPresentation,
        reporter: reporter ? {
          full_name: reporter.fullName,
          organisation: reporter.organisation,
          person_role: reporter.personRole === "Other" ? reporter.otherRole : reporter.personRole,
          email: reporter.email,
          profile_id: reporter.profileId,
          club_id: reporter.clubId,
        } : undefined,
        reported_person: reportedPerson ? {
          full_name: reportedPerson.fullName,
          organisation: reportedPerson.organisation,
          person_role: reportedPerson.personRole === "Other" ? reportedPerson.otherRole : reportedPerson.personRole,
          email: reportedPerson.email,
          profile_id: reportedPerson.profileId,
          club_id: reportedPerson.clubId,
        } : undefined,
        allegations: allegations.map((allegation) => ({
          title: allegation.title,
          description: allegation.description,
          incident_at: allegation.incidentDate || incidentDate
            ? combineZonedDateTime(
                allegation.incidentDate || incidentDate,
                allegation.incidentTime || incidentTime || "00:00",
                associationTimezone,
              )
            : undefined,
          location: allegation.location || incidentLocation,
          tag_ids: allegation.tagIds,
        })),
      });
      if (!user) throw new Error("Your signed-in profile could not be confirmed.");

      const primaryIds = new Set([reporter?.localId, reportedPerson?.localId].filter(Boolean));
      await Promise.all(
        people
          .filter((person) => !primaryIds.has(person.localId))
          .map((person) => addDisciplineCasePerson(caseId, user.id, {
            caseRole: person.caseRole,
            fullName: person.fullName,
            organisation: person.organisation,
            personRole: person.personRole === "Other" ? person.otherRole : person.personRole,
            email: person.email,
            profileId: person.profileId,
            clubId: person.clubId,
          })),
      );

      if (checks.immediateRisk) {
        await recordDisciplineRiskAssessment(caseId, {
          risk_description: riskAssessment.riskDescription,
          likelihood: riskAssessment.likelihood,
          severity: riskAssessment.severity,
          mitigation_action: riskAssessment.mitigationAction,
          responsible_person: riskAssessment.responsiblePerson,
          review_at: riskAssessment.reviewAt ? new Date(riskAssessment.reviewAt).toISOString() : undefined,
          tag_ids: safetyTagIds,
        });
      }

      const failedDocuments: string[] = [];
      for (const document of sourceDocuments) {
        try {
          await addDisciplineEvidence(caseId, user.id, {
            evidenceType: document.documentType,
            title: document.title,
            source: "Intake upload",
            evidenceBasis: "DIRECT",
            notes: "Original source document received at intake.",
            file: document.file,
            receivedAt: new Date().toISOString(),
          });
        } catch {
          failedDocuments.push(document.title);
        }
      }
      toast({
        title: "Case created",
        description: failedDocuments.length
          ? `The case was saved. Retry these documents from Evidence: ${failedDocuments.join(", ")}.`
          : `${allegations.length} allegation${allegations.length === 1 ? "" : "s"} and ${sourceDocuments.length} source document${sourceDocuments.length === 1 ? "" : "s"} recorded.`,
        variant: failedDocuments.length ? "destructive" : undefined,
      });
      navigate(`/discipline/cases/${caseId}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The case could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-6 animate-fade-in" onSubmit={handleSubmit}>
      <div>
        <h1 className="font-display text-3xl md:text-4xl">NEW INCIDENT</h1>
        <p className="mt-1 text-muted-foreground">
          Work through each section in order. Record what was reported, keep
          the wording neutral and do not decide whether the allegation is true.
        </p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Case not created</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {optionsQuery.error ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>SportStack suggestions are unavailable</AlertTitle>
          <AlertDescription>
            You can still type the factual fields manually. Reload before
            creating the case if you need the predefined tags.
          </AlertDescription>
        </Alert>
      ) : null}

      <WorkflowSection
        title="1. Case name and source documents"
        description="Name the case, then attach the original complaint, responses and any action already taken. Uploaded originals remain authoritative."
        kind="FACT"
        responsibleRole="Committee / Case Coordinator"
      >
        <div className="space-y-2">
          <Label htmlFor="title">Case title</Label>
          <Input id="title" name="title" required minLength={3} placeholder="Short neutral identifier for the incident" />
        </div>
        <div className="mt-5 rounded-lg border border-dashed p-4">
          <Label htmlFor="source-documents" className="flex cursor-pointer items-center gap-2 font-medium">
            <Upload className="h-4 w-4" /> Add source documents
          </Label>
          <Input
            id="source-documents"
            type="file"
            multiple
            className="mt-3"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp"
            onChange={(event) => {
              addSourceDocuments(event.target.files);
              event.currentTarget.value = "";
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Private files only. Maximum 20 MB each. AI extraction is not active; a person must read and confirm all entered facts.
          </p>
        </div>
        <div className="mt-4 space-y-2">
          {sourceDocuments.map((document) => (
            <div key={document.localId} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <Paperclip className="h-4 w-4 shrink-0" />
              <Input
                aria-label={`Title for ${document.file.name}`}
                value={document.title}
                onChange={(event) => setSourceDocuments((current) => current.map((item) => item.localId === document.localId ? { ...item, title: event.target.value } : item))}
                className="min-w-0 flex-1"
              />
              <Select
                value={document.documentType}
                onValueChange={(documentType) => setSourceDocuments((current) => current.map((item) => item.localId === document.localId ? { ...item, documentType: documentType as SourceDocumentDraft["documentType"] } : item))}
              >
                <SelectTrigger className="w-36" aria-label={`Document type for ${document.file.name}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPLAINT">Complaint</SelectItem>
                  <SelectItem value="RESPONSE">Response</SelectItem>
                  <SelectItem value="ACTION">Action taken</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${document.file.name}`} onClick={() => setSourceDocuments((current) => current.filter((item) => item.localId !== document.localId))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </WorkflowSection>

      <WorkflowSection
        title="2. Safety and jurisdiction triage"
        description="Deal with urgent safety first, then record which process may apply and why."
        kind="JUDGEMENT"
        responsibleRole="Committee / Case Coordinator"
        reviewRole="Non-conflicted committee members"
      >
        <div className="mb-5 flex flex-wrap gap-2">
          <JurisdictionGuidance />
          <ConflictGuidance />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Association</Label>
            <Select
              value={associationId}
              onValueChange={(value) => {
                setAssociationId(value);
                setJurisdictionTagIds([]);
                setSafetyTagIds([]);
              }}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select association" />
              </SelectTrigger>
              <SelectContent>
                {associationsQuery.data?.map((association) => (
                  <SelectItem key={association.id} value={association.id}>
                    {association.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Jurisdiction pathway</Label>
            <Select value={jurisdiction} onValueChange={setJurisdiction}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNASSESSED">Needs assessment</SelectItem>
                <SelectItem value="COMPETITION_RULE_7">
                  HV Competition Rule 7
                </SelectItem>
                <SelectItem value="NIF_REFERRAL">
                  National integrity policy referral
                </SelectItem>
                <SelectItem value="EXTERNAL_SAFETY_REFERRAL">
                  External safety referral
                </SelectItem>
                <SelectItem value="OTHER_REFERRAL">Other referral</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Alert className="md:col-span-2">
            <InformationBadge kind="JUDGEMENT" />
            <AlertTitle className="mt-2">{pathwayHelp.title}</AlertTitle>
            <AlertDescription>{pathwayHelp.summary}</AlertDescription>
            <div className="mt-3"><JurisdictionPathwayDetails pathway={jurisdiction} /></div>
          </Alert>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="jurisdictionReason">
              Factual reason for selecting this pathway
            </Label>
            <Textarea
              id="jurisdictionReason"
              name="jurisdictionReason"
              placeholder={pathwayHelp.reasonPrompt}
              minLength={5}
              required
            />
            <p className="text-xs text-muted-foreground">
              Explain the known facts and any uncertainty. Do not write a
              conclusion about guilt or a final policy breach.
            </p>
          </div>
          <div className="md:col-span-2">
            <DisciplineTagPicker
              label="Reasons that may support the pathway"
              description="Select the factual descriptors that apply. Tags help searching and triage; they do not decide jurisdiction or guilt."
              tags={tagsFor(options, "JURISDICTION_REASON")}
              selectedIds={jurisdictionTagIds}
              onChange={setJurisdictionTagIds}
            />
          </div>
          <label className="flex items-start gap-3 rounded-lg border p-4 md:col-span-2">
            <Checkbox
              checked={checks.immediateRisk}
              onCheckedChange={(value) => {
                const checked = value === true;
                setCheck("immediateRisk", checked);
                if (checked) setRiskDialogOpen(true);
              }}
            />
            <span>
              <span className="font-medium">Immediate safety risk identified</span>
              <span className="block text-sm text-muted-foreground">
                Record and act on the urgent risk now. This is separate from
                the jurisdiction choice and does not automatically close the
                internal process.
              </span>
            </span>
          </label>
          {checks.immediateRisk ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 md:col-span-2">
              <div>
                <p className="font-medium">{riskAssessment.riskDescription || "Risk assessment not completed"}</p>
                <p className="text-sm text-muted-foreground">
                  {riskAssessment.likelihood && riskAssessment.severity ? `${riskAssessment.likelihood.replaceAll("_", " ")} likelihood · ${riskAssessment.severity.toLowerCase()} severity` : "Likelihood and severity required"}
                  {riskAssessment.mitigationAction ? ` · Action: ${riskAssessment.mitigationAction}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Protective interim action only — not a finding of guilt.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setRiskDialogOpen(true)}><Edit3 className="mr-2 h-4 w-4" /> Edit risk assessment</Button>
            </div>
          ) : null}
        </div>
        <Dialog open={riskDialogOpen} onOpenChange={setRiskDialogOpen}>
          <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>Immediate safety risk assessment</DialogTitle><DialogDescription>Record a proportionate protective response separately from any finding about the allegation.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label htmlFor="risk-description">Risk description</Label><Textarea id="risk-description" value={riskAssessment.riskDescription} onChange={(event) => setRiskAssessment((current) => ({ ...current, riskDescription: event.target.value }))} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Likelihood</Label><Select value={riskAssessment.likelihood} onValueChange={(likelihood) => setRiskAssessment((current) => ({ ...current, likelihood }))}><SelectTrigger aria-label="Risk likelihood"><SelectValue placeholder="Select likelihood" /></SelectTrigger><SelectContent><SelectItem value="RARE">Rare</SelectItem><SelectItem value="UNLIKELY">Unlikely</SelectItem><SelectItem value="POSSIBLE">Possible</SelectItem><SelectItem value="LIKELY">Likely</SelectItem><SelectItem value="ALMOST_CERTAIN">Almost certain</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Severity</Label><Select value={riskAssessment.severity} onValueChange={(severity) => setRiskAssessment((current) => ({ ...current, severity }))}><SelectTrigger aria-label="Risk severity"><SelectValue placeholder="Select severity" /></SelectTrigger><SelectContent><SelectItem value="INSIGNIFICANT">Insignificant</SelectItem><SelectItem value="MINOR">Minor</SelectItem><SelectItem value="MODERATE">Moderate</SelectItem><SelectItem value="MAJOR">Major</SelectItem><SelectItem value="SEVERE">Severe</SelectItem></SelectContent></Select></div>
              </div>
              <div className="space-y-2"><Label htmlFor="risk-action">Mitigation or interim action</Label><Textarea id="risk-action" value={riskAssessment.mitigationAction} onChange={(event) => setRiskAssessment((current) => ({ ...current, mitigationAction: event.target.value }))} /></div>
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="risk-owner">Responsible person (optional)</Label><Input id="risk-owner" value={riskAssessment.responsiblePerson} onChange={(event) => setRiskAssessment((current) => ({ ...current, responsiblePerson: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="risk-review">Review date and time (optional)</Label><Input id="risk-review" type="datetime-local" value={riskAssessment.reviewAt} onChange={(event) => setRiskAssessment((current) => ({ ...current, reviewAt: event.target.value }))} /></div></div>
              <DisciplineTagPicker label="Risk descriptors" description="Select all factual descriptors that apply." tags={tagsFor(options, "SAFETY_RISK")} selectedIds={safetyTagIds} onChange={setSafetyTagIds} />
            </div>
            <DialogFooter><Button type="button" onClick={() => setRiskDialogOpen(false)} disabled={riskAssessment.riskDescription.trim().length < 5 || !riskAssessment.likelihood || !riskAssessment.severity || riskAssessment.mitigationAction.trim().length < 5}>Save risk assessment</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        {referralPath ? (
          <Alert className="mt-5">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Referral pathway selected</AlertTitle>
            <AlertDescription>
              The private record will be retained as referred and ordinary Rule
              7 deadlines will not start. Record any external instruction about
              whether the internal process must pause.
            </AlertDescription>
          </Alert>
        ) : checks.immediateRisk ? (
          <Alert className="mt-5">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Safety action and internal pathway can run together</AlertTitle>
            <AlertDescription>
              The safety action is recorded without automatically changing the
              selected internal jurisdiction pathway.
            </AlertDescription>
          </Alert>
        ) : null}
      </WorkflowSection>

      <WorkflowSection
        title="3. Match and incident facts"
        description="Start with a known fixture to fill the existing SportStack facts, or type any field manually."
        kind="FACT"
        responsibleRole="Committee / Case Coordinator"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <p className="font-medium">{homeTeam.value && awayTeam.value ? `${homeTeam.value} v ${awayTeam.value}` : "No match details recorded"}</p>
            <p className="text-sm text-muted-foreground">{[competition.value, grade.value, roundLabel, matchDate].filter(Boolean).join(" · ") || "Select a fixture or enter the match manually."}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setMatchDialogOpen(true)}>{homeTeam.value || matchDate ? <Edit3 className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />} {homeTeam.value || matchDate ? "Edit match details" : "Add match details"}</Button>
        </div>
        <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader><DialogTitle>Match and incident details</DialogTitle><DialogDescription>Choose a fixture for predictive fill or enter the details manually.</DialogDescription></DialogHeader>
        {optionsQuery.isLoading ? (
          <p className="mb-4 flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading SportStack suggestions…
          </p>
        ) : null}
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <PredictiveTextInput
              id="fixture-search"
              label="Find an existing fixture (optional)"
              value={fixtureSearch}
              options={options?.fixtures ?? []}
              onChange={(value, match) => {
                setFixtureSearch(value);
                setFixtureId(match?.id);
                if (match) applyFixture(match);
              }}
              placeholder="Start typing a date, team or grade"
              helperText="Selecting a fixture fills the match fields below. You can still correct any snapshot text before creating the case."
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label id="round-type-label">Round type</Label>
            <Select value={roundType} onValueChange={setRoundType}>
              <SelectTrigger aria-labelledby="round-type-label"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="REGULAR">Regular round</SelectItem>
                <SelectItem value="LAST_REGULAR">Last regular round</SelectItem>
                <SelectItem value="FINALS">Finals</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select this manually because the label stored against a fixture
              may not prove the Rule 7 timing condition.
            </p>
          </div>
          {roundType !== "REGULAR" ? (
            <div className="space-y-2 lg:col-span-3">
              <Label>Is the relevant club participating in this competition?</Label>
              <Select
                value={relevantClub}
                onValueChange={(value) => setRelevantClub(value as "YES" | "NO")}
                required
              >
                <SelectTrigger><SelectValue placeholder="Select yes or no" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="YES">Yes</SelectItem>
                  <SelectItem value="NO">No</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                <InformationBadge kind="RULE" /> The direct-Tribunal timing in
                HV Rule 7.1 applies only when this fact is yes.
              </p>
            </div>
          ) : null}
          <PredictiveTextInput
            id="competition"
            label="Competition"
            value={competition.value}
            options={options?.competitions ?? []}
            onChange={(value, match) => setCompetition({ value, id: match?.id })}
          />
          <PredictiveTextInput
            id="grade"
            label="Grade"
            value={grade.value}
            options={options?.grades ?? []}
            onChange={(value, match) => setGrade({ value, id: match?.id })}
          />
          <PredictiveTextInput
            id="round-label"
            label="Round"
            value={roundLabel}
            options={roundOptions}
            onChange={setRoundLabel}
          />
          <PredictiveTextInput
            id="home-team"
            label="Home team"
            value={homeTeam.value}
            options={options?.teams ?? []}
            onChange={(value, match) => setHomeTeam({ value, id: match?.id })}
            helperText="The official HV form calls this the First Named Team. SportStack shows Home team for clarity."
          />
          <PredictiveTextInput
            id="away-team"
            label="Away team"
            value={awayTeam.value}
            options={options?.teams ?? []}
            onChange={(value, match) => setAwayTeam({ value, id: match?.id })}
            helperText="The official HV form calls this the Second Named Team. SportStack shows Away team for clarity."
          />
          <PredictiveTextInput
            id="venue"
            label="Venue"
            value={venue.value}
            options={options?.venues ?? []}
            onChange={(value, match) => setVenue({ value, id: match?.id })}
          />
          <div className="space-y-2">
            <Label htmlFor="match-date">Match date</Label>
            <Input id="match-date" type="date" value={matchDate} onChange={(event) => setMatchDate(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="match-time">Match conclusion time</Label>
            <Input id="match-time" type="time" value={matchTime} onChange={(event) => setMatchTime(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="incident-date">Overall incident date</Label>
            <Input id="incident-date" type="date" value={incidentDate} onChange={(event) => setIncidentDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="incident-time">Overall incident time</Label>
            <Input id="incident-time" type="time" value={incidentTime} onChange={(event) => setIncidentTime(event.target.value)} />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="incident-location">Overall incident location</Label>
            <Input id="incident-location" value={incidentLocation} onChange={(event) => setIncidentLocation(event.target.value)} placeholder="For example: pitch, dugout, changeroom or car park" />
          </div>
        </div>
            <DialogFooter><Button type="button" onClick={() => setMatchDialogOpen(false)} disabled={!matchDate || !matchTime}>Save match details</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </WorkflowSection>

      <WorkflowSection
        title="4. People named in the report"
        description="Names remain private. Each saved person receives a stable neutral reference for investigation and reporting."
        kind="FACT"
        responsibleRole="Committee / Case Coordinator"
      >
        <div className="space-y-2">
          {people.map((person) => {
            const roleNumber = people.filter((item) => item.caseRole === person.caseRole).findIndex((item) => item.localId === person.localId) + 1;
            const reference = `${person.caseRole === "REPORTED_PERSON" ? "Reported Person" : person.caseRole === "AFFECTED_PERSON" ? "Affected Person" : person.caseRole === "OTHER" ? "Other Person" : person.caseRole.charAt(0) + person.caseRole.slice(1).toLowerCase()} ${roleNumber}`;
            return (
              <div key={person.localId} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="min-w-0"><p className="font-medium">{reference}</p><p className="truncate text-sm text-muted-foreground">{person.fullName} · {person.personRole === "Other" ? person.otherRole : person.personRole || "Role not recorded"}{person.organisation ? ` · ${person.organisation}` : ""}</p></div>
                <div className="flex gap-1"><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${reference}`} onClick={() => { setPersonEditor(person); setPersonDialogOpen(true); }}><Edit3 className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${reference}`} onClick={() => setPeople((current) => current.filter((item) => item.localId !== person.localId))}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            );
          })}
        </div>
        <Button type="button" variant="outline" className="mt-3" onClick={() => { setPersonEditor(emptyPerson()); setPersonDialogOpen(true); }}><Users className="mr-2 h-4 w-4" /> Add a person</Button>
        <Dialog open={personDialogOpen} onOpenChange={setPersonDialogOpen}>
          <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>{people.some((person) => person.localId === personEditor?.localId) ? "Edit person" : "Add a person"}</DialogTitle><DialogDescription>Type the name freely. SportStack suggestions appear only after three characters and are optional.</DialogDescription></DialogHeader>
            {personEditor ? <PersonFields prefix={`person-${personEditor.localId}`} value={personEditor} onChange={setPersonEditor} profiles={options?.profiles ?? []} clubs={options?.clubs ?? []} /> : null}
            <DialogFooter><Button type="button" onClick={savePerson} disabled={!personEditor?.fullName.trim() || !personEditor?.personRole || (personEditor.personRole === "Other" && !personEditor.otherRole.trim())}>Save person</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </WorkflowSection>

      <WorkflowSection
        title="5. Allegations from this incident report"
        description="Create one neutral allegation for each separate reported act. All allegations below are saved together in the same private case."
        kind="FACT"
        responsibleRole="Committee / Case Coordinator"
      >
        <Alert className="mb-5">
          <FileText className="h-4 w-4" />
          <AlertTitle>Allegations are not findings</AlertTitle>
          <AlertDescription>
            Preserve the original report as evidence after the case is created.
            Here, break that source into clear reported acts: who allegedly did
            what, when and where. Do not improve the report, select an offence
            as proven or combine unrelated acts into one allegation.
          </AlertDescription>
        </Alert>
        <div className="space-y-2">
          {allegations.map((allegation, index) => (
            <div key={allegation.localId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <h3 className="font-semibold">Allegation {index + 1}: {allegation.title || "Not completed"}</h3>
                <p className="truncate text-sm text-muted-foreground">{allegation.description || "Add the reported facts and known particulars."}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <AllegationEditorDialog allegation={allegation} number={index + 1} tags={tagsFor(options, "ALLEGATION_DESCRIPTOR")} onChange={(patch) => updateAllegation(allegation.localId, patch)} />
                {allegations.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove allegation ${index + 1}`} onClick={() => setAllegations((current) => current.filter((item) => item.localId !== allegation.localId))}><Trash2 className="h-4 w-4" /></Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() =>
            setAllegations((current) => [
              ...current,
              newAllegation({
                incidentDate,
                incidentTime,
                location: incidentLocation,
              }),
            ])
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Add another allegation
        </Button>
      </WorkflowSection>

      <WorkflowSection
        title="6. Report receipt and formal checks"
        description="Record what was received without changing the original report. A missing item is flagged for human review; it is not silently treated as fatal."
        kind="RULE"
        responsibleRole="Committee / Case Coordinator"
      >
        <Alert className="mb-5">
          <FileText className="h-4 w-4" />
          <AlertTitle>Keep the original report as the source record</AlertTitle>
          <AlertDescription>
            After creating the case, upload the original email, form or file in
            Evidence. The allegations above are a structured, neutral breakdown
            of that source—not a replacement for it.
          </AlertDescription>
        </Alert>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="reportDate">Report received date</Label>
            <Input id="reportDate" name="reportDate" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reportTime">Report received time</Label>
            <Input id="reportTime" name="reportTime" type="time" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reportMethod">Report method</Label>
            <Input id="reportMethod" name="reportMethod" placeholder="Email, form, verbal notification…" />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {(
            [
              ["reportInWriting", "Report is in writing"],
              ["prescribedForm", "Prescribed incident report form used"],
              ["reportComplete", "Report appears complete"],
              ["desiredOutcome", "Desired outcome is included"],
              ["priorPresentation", "Required club or umpire routing step completed"],
            ] as [CheckboxKey, string][]
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox checked={checks[key]} onCheckedChange={(value) => setCheck(key, value === true)} />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The official form says a player, coach, club official, supporter or
          parent presents the report through their Club President or Secretary;
          an umpire report goes to the HV umpire coach first.
        </p>
      </WorkflowSection>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Rule pack awaiting Hockey Ballarat approval</AlertTitle>
        <AlertDescription>
          Verified 2026 source material is linked for guidance. HB still needs
          to confirm the local business-day interpretation, integrity referral
          contact/adoption and recorded source conflicts.
        </AlertDescription>
      </Alert>
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={submitting || !associationId || optionsQuery.isLoading}
        >
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create private case with {allegations.length} allegation{allegations.length === 1 ? "" : "s"}
        </Button>
      </div>
    </form>
  );
}

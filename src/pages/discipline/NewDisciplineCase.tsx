import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  FileText,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
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
import { DisciplineTagPicker } from "@/features/discipline/DisciplineTagPicker";
import { JurisdictionGuidance } from "@/features/discipline/DisciplineIntakeGuidance";
import { JURISDICTION_HELP } from "@/features/discipline/disciplineIntakeContent";
import { PredictiveTextInput } from "@/features/discipline/PredictiveTextInput";
import {
  createDisciplineCase,
  loadAssociationOptions,
  loadDisciplineIntakeOptions,
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
  fullName: string;
  organisation: string;
  personRole: string;
  email: string;
  profileId?: string;
  clubId?: string;
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

const emptyPerson = (): PersonDraft => ({
  fullName: "",
  organisation: "",
  personRole: "",
  email: "",
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
  heading,
  prefix,
  value,
  onChange,
  profiles,
  clubs,
}: {
  heading: string;
  prefix: string;
  value: PersonDraft;
  onChange: (value: PersonDraft) => void;
  profiles: DisciplineIntakeOptions["profiles"];
  clubs: DisciplineIntakeOptions["clubs"];
}) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">{heading}</h3>
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
          <Label htmlFor={`${prefix}-role`}>Role</Label>
          <Input
            id={`${prefix}-role`}
            value={value.personRole}
            onChange={(event) =>
              onChange({ ...value, personRole: event.target.value })
            }
            placeholder="Player, umpire, coach…"
          />
        </div>
      </div>
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

export default function NewDisciplineCase() {
  const { context } = useDisciplineAccess();
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
  const [reporter, setReporter] = useState<PersonDraft>(emptyPerson);
  const [reportedPerson, setReportedPerson] =
    useState<PersonDraft>(emptyPerson);
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const caseId = await createDisciplineCase({
        association_id: associationId,
        title: String(form.get("title") || ""),
        jurisdiction_path: jurisdiction,
        jurisdiction_reason: String(form.get("jurisdictionReason") || ""),
        jurisdiction_tag_ids: jurisdictionTagIds,
        immediate_safety_risk: checks.immediateRisk,
        immediate_safety_action: String(form.get("immediateAction") || ""),
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
        reporter: {
          full_name: reporter.fullName,
          organisation: reporter.organisation,
          person_role: reporter.personRole,
          email: reporter.email,
          profile_id: reporter.profileId,
          club_id: reporter.clubId,
        },
        reported_person: {
          full_name: reportedPerson.fullName,
          organisation: reportedPerson.organisation,
          person_role: reportedPerson.personRole,
          email: reportedPerson.email,
          profile_id: reportedPerson.profileId,
          club_id: reportedPerson.clubId,
        },
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
      toast({
        title: "Case created",
        description: `${allegations.length} allegation${allegations.length === 1 ? "" : "s"} recorded with the private case.`,
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
        title="1. Safety and jurisdiction triage"
        description="Deal with urgent safety first, then record which process may apply and why."
        kind="JUDGEMENT"
      >
        <div className="mb-5">
          <JurisdictionGuidance />
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
              onCheckedChange={(value) =>
                setCheck("immediateRisk", value === true)
              }
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
            <>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="immediateAction">Immediate safety action taken</Label>
                <Textarea
                  id="immediateAction"
                  name="immediateAction"
                  minLength={5}
                  required
                  placeholder="Record who was contacted, what was done, when it happened and any instructions received."
                />
              </div>
              <div className="md:col-span-2">
                <DisciplineTagPicker
                  label="Immediate safety descriptors"
                  description="Select all that describe the reported risk or action. Follow current emergency, police and child-protection procedures where required."
                  tags={tagsFor(options, "SAFETY_RISK")}
                  selectedIds={safetyTagIds}
                  onChange={setSafetyTagIds}
                />
              </div>
            </>
          ) : null}
        </div>
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
        title="2. Match and incident facts"
        description="Start with a known fixture to fill the existing SportStack facts, or type any field manually."
        kind="FACT"
      >
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
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="title">Case title</Label>
            <Input
              id="title"
              name="title"
              required
              minLength={3}
              placeholder="Short neutral identifier for the incident"
            />
          </div>
          <div className="space-y-2">
            <Label>Round type</Label>
            <Select value={roundType} onValueChange={setRoundType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
      </WorkflowSection>

      <WorkflowSection
        title="3. People named in the report"
        description="Select an existing SportStack record when it is clearly the same person or club. Otherwise type the report wording as free text."
        kind="FACT"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <PersonFields
            heading="Reporter"
            prefix="reporter"
            value={reporter}
            onChange={setReporter}
            profiles={options?.profiles ?? []}
            clubs={options?.clubs ?? []}
          />
          <PersonFields
            heading="Person reported"
            prefix="reported"
            value={reportedPerson}
            onChange={setReportedPerson}
            profiles={options?.profiles ?? []}
            clubs={options?.clubs ?? []}
          />
        </div>
      </WorkflowSection>

      <WorkflowSection
        title="4. Allegations from this incident report"
        description="Create one neutral allegation for each separate reported act. All allegations below are saved together in the same private case."
        kind="FACT"
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
        <div className="space-y-5">
          {allegations.map((allegation, index) => (
            <div key={allegation.localId} className="space-y-4 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Allegation {index + 1}</h3>
                  <p className="text-xs text-muted-foreground">One separate reported act or course of conduct.</p>
                </div>
                {allegations.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAllegations((current) => current.filter((item) => item.localId !== allegation.localId))}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Remove
                  </Button>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`allegation-title-${allegation.localId}`}>Neutral allegation title</Label>
                <Input
                  id={`allegation-title-${allegation.localId}`}
                  value={allegation.title}
                  onChange={(event) => updateAllegation(allegation.localId, { title: event.target.value })}
                  placeholder="For example: Reported language near the home dugout"
                  minLength={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`allegation-description-${allegation.localId}`}>Reported facts and known particulars</Label>
                <Textarea
                  id={`allegation-description-${allegation.localId}`}
                  value={allegation.description}
                  onChange={(event) => updateAllegation(allegation.localId, { description: event.target.value })}
                  placeholder="Record the act described in the report, the people involved, approximate timing, location and any words attributed. Identify uncertainty."
                  minLength={5}
                  required
                />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor={`allegation-date-${allegation.localId}`}>Date</Label>
                  <Input id={`allegation-date-${allegation.localId}`} type="date" value={allegation.incidentDate} onChange={(event) => updateAllegation(allegation.localId, { incidentDate: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`allegation-time-${allegation.localId}`}>Time</Label>
                  <Input id={`allegation-time-${allegation.localId}`} type="time" value={allegation.incidentTime} onChange={(event) => updateAllegation(allegation.localId, { incidentTime: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`allegation-location-${allegation.localId}`}>Location</Label>
                  <Input id={`allegation-location-${allegation.localId}`} value={allegation.location} onChange={(event) => updateAllegation(allegation.localId, { location: event.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Blank allegation date, time or location fields inherit the
                overall incident details recorded in section 2.
              </p>
              <DisciplineTagPicker
                label="Reported-fact descriptors"
                description="Select all useful descriptors. These tags support searching and triage only; classification and findings happen later."
                tags={tagsFor(options, "ALLEGATION_DESCRIPTOR")}
                selectedIds={allegation.tagIds}
                onChange={(tagIds) => updateAllegation(allegation.localId, { tagIds })}
              />
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
        title="5. Report receipt and formal checks"
        description="Record what was received without changing the original report. A missing item is flagged for human review; it is not silently treated as fatal."
        kind="RULE"
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

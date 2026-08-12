import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCheck2,
  Loader2,
  Printer,
  Scale,
  ShieldAlert,
  UserCheck,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  addDisciplineCasePerson,
  addDisciplineEvidence,
  addDisciplineNotification,
  addDisciplineWitness,
  addInvestigatorSetup,
  advanceDisciplineStage,
  assignDisciplineCaseMember,
  authoriseNaturalJusticeOverride,
  createDisciplineEvidenceLink,
  loadDisciplineWorkspace,
  recordClassification,
  recordDisciplineDecision,
  saveAllegation,
  saveDisciplineFinding,
  setDeadlineCompletion,
  setDisciplinePortalAccess,
  signDisciplineReport,
  updateNaturalJusticeCheck,
} from "@/features/discipline/api";
import {
  InformationBadge,
  WorkflowSection,
} from "@/features/discipline/DisciplineUi";
import {
  formatMelbourneDateTime,
  formatStatus,
} from "@/features/discipline/format";
import type {
  ClassificationResult,
  DisciplineAllegation,
  DisciplineWorkspaceData,
} from "@/features/discipline/types";
import { useToast } from "@/hooks/use-toast";
import { useDisciplineAccess } from "@/features/discipline/useDisciplineAccess";
import { cn } from "@/lib/utils";
import { combineZonedDateTime } from "@/lib/timezoneDateTime";

const STAGES = [
  "DRAFT",
  "SCREENING",
  "INVESTIGATOR_SETUP",
  "INVESTIGATING",
  "FINDINGS",
  "REPORT_SIGNED",
  "HB_DECISION",
  "CLOSED",
];
const NEXT_STATUS: Record<string, string | undefined> = {
  DRAFT: "SCREENING",
  SCREENING: "INVESTIGATOR_SETUP",
  INVESTIGATOR_SETUP: "INVESTIGATING",
  INVESTIGATING: "FINDINGS",
  REPORT_SIGNED: "HB_DECISION",
};

const PERSON_CATEGORIES = [
  ["MATCH_PARTICIPANT", "Match participant"],
  ["SPECTATOR", "Spectator"],
  ["OFFICIAL", "Official"],
] as const;

const OTHER_OFFENCES = [
  ["INFLUENCE_OFFICIAL", "Repeated attempts to influence an official"],
  ["PUBLIC_PERSONAL_ATTACK", "Unfair public personal attack"],
  ["NOT_LEAVING_FIELD", "Not leaving the field when directed"],
  ["UNFIT_STATE", "Participation in an unfit state"],
  ["UNAUTHORISED_FIELD_ENTRY", "Unauthorised field entry"],
  ["DISREPUTE", "Bringing the game into disrepute"],
  ["CONTEMPT", "Contempt of Tribunal or appeal process"],
] as const;

function profileLabel(data: DisciplineWorkspaceData, userId: string) {
  const profile = data.profileOptions.find((option) => option.id === userId);
  if (!profile) return userId;
  return (
    `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
    profile.email ||
    userId
  );
}

function ClassificationForm({
  caseId,
  allegation,
  onSaved,
}: {
  caseId: string;
  allegation: DisciplineAllegation;
  onSaved: () => Promise<unknown>;
}) {
  const [category, setCategory] = useState("LANGUAGE");
  const [personCategory, setPersonCategory] = useState("MATCH_PARTICIPANT");
  const [physicalKind, setPhysicalKind] = useState("PUSH_GRAB_TRIP");
  const [contactMade, setContactMade] = useState(true);
  const [otherOffence, setOtherOffence] = useState("INFLUENCE_OFFICIAL");
  const [protectedBasis, setProtectedBasis] = useState("__none__");
  const [frustrationOnly, setFrustrationOnly] = useState(false);
  const [offensive, setOffensive] = useState(false);
  const [repeated, setRepeated] = useState(false);
  const [incitement, setIncitement] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const answers: Record<string, unknown> = { category };
    if (category === "LANGUAGE") {
      Object.assign(answers, {
        frustration_only: frustrationOnly,
        offensive,
        repeated,
        incitement_to_violence: incitement,
        person_category: frustrationOnly ? "N_A" : personCategory,
      });
    }
    if (category === "PHYSICAL")
      Object.assign(answers, {
        physical_kind: physicalKind,
        contact_made: contactMade,
        person_category: personCategory,
      });
    if (category === "VILIFICATION")
      Object.assign(answers, {
        protected_characteristic: protectedBasis !== "__none__",
        protected_basis: protectedBasis,
        person_category: personCategory,
      });
    if (category === "OTHER")
      Object.assign(answers, { other_offence: otherOffence });
    try {
      setResult(await recordClassification(caseId, allegation.id, answers));
      await onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Classification could not be recorded.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4 rounded-lg border p-4" onSubmit={submit}>
      <div>
        <p className="font-semibold">
          Allegation {allegation.allegation_number}: {allegation.title}
        </p>
        <p className="text-sm text-muted-foreground">
          If the allegation were proven exactly as reported, which Schedule
          wording may apply?
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Conduct category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LANGUAGE">Language or gesture</SelectItem>
              <SelectItem value="PHYSICAL">Physical conduct</SelectItem>
              <SelectItem value="VILIFICATION">Vilification</SelectItem>
              <SelectItem value="OTHER">Other listed offence</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {category !== "OTHER" ? (
          <div className="space-y-2">
            <Label>Directed toward</Label>
            <Select value={personCategory} onValueChange={setPersonCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERSON_CATEGORIES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      {category === "LANGUAGE" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["Frustration only", frustrationOnly, setFrustrationOnly],
            [
              "Offensive, insulting, abusive or intimidating",
              offensive,
              setOffensive,
            ],
            ["Repeated", repeated, setRepeated],
            ["Incitement to violence", incitement, setIncitement],
          ].map(([label, checked, setter]) => (
            <label
              key={String(label)}
              className="flex items-center gap-3 rounded-lg border p-3 text-sm"
            >
              <Checkbox
                checked={checked as boolean}
                onCheckedChange={(value) =>
                  (setter as (value: boolean) => void)(value === true)
                }
              />
              {String(label)}
            </label>
          ))}
        </div>
      ) : null}
      {category === "PHYSICAL" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Physical conduct alleged</Label>
            <Select value={physicalKind} onValueChange={setPhysicalKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUSH_GRAB_TRIP">
                  Push, grab, trip or similar
                </SelectItem>
                <SelectItem value="ATTEMPTED_STRIKE">
                  Attempted strike
                </SelectItem>
                <SelectItem value="STRIKE">Strike</SelectItem>
                <SelectItem value="OTHER">
                  Does not fit listed wording
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
            <Checkbox
              checked={contactMade}
              onCheckedChange={(value) => setContactMade(value === true)}
            />
            Contact was made
          </label>
        </div>
      ) : null}
      {category === "VILIFICATION" ? (
        <div className="space-y-2">
          <Label>Alleged protected characteristic basis</Label>
          <Select value={protectedBasis} onValueChange={setProtectedBasis}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No listed basis recorded</SelectItem>
              {[
                "Age",
                "Gender",
                "Sexual orientation",
                "Physical ability",
                "Mental ability",
                "Race",
                "Culture",
                "Religion",
              ].map((label) => (
                <SelectItem
                  key={label}
                  value={label.toUpperCase().replaceAll(" ", "_")}
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {category === "OTHER" ? (
        <div className="space-y-2">
          <Label>Exact Schedule offence</Label>
          <Select value={otherOffence} onValueChange={setOtherOffence}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OTHER_OFFENCES.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Scale className="mr-2 h-4 w-4" />
        )}
        Record preliminary guidance
      </Button>
      {result ? (
        <Alert
          className={cn(
            result.tribunal_readiness === "RED" && "border-red-500",
            result.tribunal_readiness === "AMBER" && "border-amber-500",
          )}
        >
          <Scale className="h-4 w-4" />
          <AlertTitle>
            {result.tribunal_readiness}: {result.classification_label}
          </AlertTitle>
          <AlertDescription>
            <p>{result.explanation}</p>
            {result.penalty_guidance ? (
              <p className="mt-2 font-medium">
                Penalty guidance only: {result.penalty_guidance}
              </p>
            ) : null}
            {result.source_warning ? (
              <p className="mt-2 text-amber-700 dark:text-amber-300">
                Source warning: {result.source_warning}
              </p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}

function FindingForm({
  caseId,
  allegation,
  onSaved,
}: {
  caseId: string;
  allegation: DisciplineAllegation;
  onSaved: () => Promise<unknown>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await saveDisciplineFinding(caseId, allegation.id, {
        supporting_evidence: String(form.get("supporting") || ""),
        contradicting_evidence: String(form.get("contradicting") || ""),
        inconsistencies: String(form.get("inconsistencies") || ""),
        missing_evidence: String(form.get("missing") || ""),
        reported_person_response: String(form.get("response") || ""),
        reasoning: String(form.get("reasoning") || ""),
        recommended_finding: String(form.get("finding") || ""),
        recommended_classification_code: String(
          form.get("classification") || "",
        ),
        classification_change_reason: String(form.get("changeReason") || ""),
      });
      event.currentTarget.reset();
      await onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Finding could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="space-y-4 rounded-lg border p-4" onSubmit={submit}>
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-semibold">
          Allegation {allegation.allegation_number}: {allegation.title}
        </p>
        <InformationBadge kind="JUDGEMENT" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["supporting", "Supporting evidence"],
          ["contradicting", "Contradicting evidence"],
          ["inconsistencies", "Inconsistencies"],
          ["missing", "Missing evidence"],
          ["response", "Reported person's response"],
          ["reasoning", "Reasoning"],
        ].map(([name, label]) => (
          <div
            key={name}
            className={cn("space-y-2", name === "reasoning" && "md:col-span-2")}
          >
            <Label htmlFor={`${allegation.id}-${name}`}>{label}</Label>
            <Textarea
              id={`${allegation.id}-${name}`}
              name={name}
              required={name === "supporting" || name === "reasoning"}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Recommended finding</Label>
          <Select name="finding" required>
            <SelectTrigger>
              <SelectValue placeholder="Select finding" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SUBSTANTIATED">Substantiated</SelectItem>
              <SelectItem value="UNSUBSTANTIATED">Unsubstantiated</SelectItem>
              <SelectItem value="UNABLE_TO_DETERMINE">
                Unable to determine
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${allegation.id}-classification`}>
            Recommended classification code
          </Label>
          <Input
            id={`${allegation.id}-classification`}
            name="classification"
            placeholder={allegation.initial_classification_code || "Optional"}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${allegation.id}-changeReason`}>
            Reason if classification changed
          </Label>
          <Input id={`${allegation.id}-changeReason`} name="changeReason" />
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save
        finding revision
      </Button>
    </form>
  );
}

export default function DisciplineCaseWorkspace() {
  const { caseId = "" } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { context: portalContext } = useDisciplineAccess();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const workspaceQuery = useQuery({
    queryKey: ["discipline-workspace", caseId],
    queryFn: () => loadDisciplineWorkspace(caseId),
    enabled: Boolean(caseId),
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["discipline-workspace", caseId],
    });
  const runAction = async (
    successMessage: string,
    action: () => Promise<unknown>,
  ) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await refresh();
      toast({ title: successMessage });
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "The action could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (workspaceQuery.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (workspaceQuery.error || !workspaceQuery.data)
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Case could not be loaded</AlertTitle>
        <AlertDescription>
          {workspaceQuery.error?.message || "This case is unavailable."}
        </AlertDescription>
      </Alert>
    );

  const data = workspaceQuery.data;
  const incidentCase = data.incidentCase;
  const nextDeadline =
    data.deadlines.find((deadline) => !deadline.completed_at) ?? null;
  const nextStatus = NEXT_STATUS[incidentCase.status];
  const activeMember = data.members.find(
    (member) => member.user_id === user?.id && member.active,
  );
  const canCoordinate = activeMember?.case_role === "CASE_COORDINATOR";
  const canInvestigate = [
    "CASE_COORDINATOR",
    "LEAD_INVESTIGATOR",
    "SUPPORT_INVESTIGATOR",
  ].includes(activeMember?.case_role || "");
  const isLead = activeMember?.case_role === "LEAD_INVESTIGATOR";
  const isDecisionMaker = activeMember?.case_role === "DECISION_MAKER";

  return (
    <div className="space-y-6 animate-fade-in print:bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link to="/discipline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cases
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl md:text-4xl">
              {incidentCase.case_number}
            </h1>
            <Badge>{formatStatus(incidentCase.status)}</Badge>
            <Badge variant="outline">
              {formatStatus(activeMember?.case_role)}
            </Badge>
          </div>
          <p className="mt-1 text-lg text-muted-foreground">
            {incidentCase.title}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print current view
        </Button>
      </div>
      {actionError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action not completed</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
      {data.rulePack.status !== "PUBLISHED" ? (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Rule pack review required</AlertTitle>
          <AlertDescription>
            {data.rulePack.title} ({data.rulePack.version}) is verified source
            guidance but is not yet approved as a published Hockey Ballarat rule
            pack. Source conflicts remain visible in Rules.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5" />
              Next required action
            </CardTitle>
            <InformationBadge kind="RULE" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold">
            {nextDeadline?.label ??
              (nextStatus
                ? `Advance to ${formatStatus(nextStatus)}`
                : "No calculated action remains")}
          </p>
          {nextDeadline ? (
            <p className="mt-1 text-muted-foreground">
              Due {formatMelbourneDateTime(nextDeadline.due_at)} ·{" "}
              {nextDeadline.rule_reference}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border bg-card p-3 print:hidden">
        <ol className="flex min-w-max items-center gap-2">
          {STAGES.map((stage, index) => (
            <li key={stage} className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium",
                  stage === incidentCase.status
                    ? "bg-primary text-primary-foreground"
                    : STAGES.indexOf(incidentCase.status) > index
                      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {formatStatus(stage)}
              </span>
              {index < STAGES.length - 1 ? (
                <span className="text-muted-foreground">→</span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg border bg-card p-1 print:hidden">
          {[
            "overview",
            "intake",
            "screening",
            "investigation",
            "findings",
            "decision",
            "timeline",
            "rules",
          ].map((tab) => (
            <TabsTrigger key={tab} value={tab} className="shrink-0">
              {formatStatus(tab)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <WorkflowSection title="Case facts" kind="FACT">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Competition</dt>
                <dd>{incidentCase.competition || "Not recorded"}</dd>
                <dt className="text-muted-foreground">Grade / round</dt>
                <dd>
                  {incidentCase.grade || "Not recorded"} ·{" "}
                  {incidentCase.round_label || "Not recorded"}
                </dd>
                <dt className="text-muted-foreground">Match</dt>
                <dd>
                  {incidentCase.first_named_team || "Not recorded"} v{" "}
                  {incidentCase.second_named_team || "Not recorded"}
                </dd>
                <dt className="text-muted-foreground">Concluded</dt>
                <dd>
                  {formatMelbourneDateTime(incidentCase.match_concluded_at)}
                </dd>
                <dt className="text-muted-foreground">Pathway</dt>
                <dd>{formatStatus(incidentCase.pathway)}</dd>
              </dl>
            </WorkflowSection>
            <WorkflowSection title="Rule version snapshot" kind="RULE">
              <p className="font-medium">{data.rulePack.title}</p>
              <p className="text-sm text-muted-foreground">
                Version {data.rulePack.version} · {data.rulePack.timezone}
              </p>
              <p className="mt-3 text-sm">
                This case remains pinned to this version. Later rule updates
                will not silently change it.
              </p>
            </WorkflowSection>
          </div>
          <WorkflowSection
            title="Deadlines"
            description="Deadlines use Melbourne time and the configured HB business-day calendar."
            kind="RULE"
          >
            <div className="space-y-3">
              {data.deadlines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No Rule 7 deadlines were started for this pathway.
                </p>
              ) : (
                data.deadlines.map((deadline) => (
                  <div
                    key={deadline.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{deadline.label}</p>
                      <p className="text-sm text-muted-foreground">
                        Due {formatMelbourneDateTime(deadline.due_at)} ·{" "}
                        {deadline.calculation_text} · {deadline.rule_reference}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={deadline.completed_at ? "outline" : "default"}
                      disabled={busy || !canCoordinate}
                      onClick={() =>
                        runAction(
                          deadline.completed_at
                            ? "Deadline reopened"
                            : "Deadline completed",
                          () =>
                            setDeadlineCompletion(
                              deadline.id,
                              !deadline.completed_at,
                            ),
                        )
                      }
                    >
                      {deadline.completed_at ? (
                        "Reopen"
                      ) : (
                        <>
                          <CalendarCheck className="mr-2 h-4 w-4" />
                          Complete
                        </>
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </WorkflowSection>
          {nextStatus && (canCoordinate || isLead) ? (
            <div className="flex justify-end print:hidden">
              <Button
                disabled={busy}
                onClick={() =>
                  runAction(
                    `Case advanced to ${formatStatus(nextStatus)}`,
                    () => advanceDisciplineStage(caseId, nextStatus),
                  )
                }
              >
                Complete stage and advance
              </Button>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="intake" className="space-y-5">
          <WorkflowSection
            title="Jurisdiction and formal report facts"
            kind="FACT"
          >
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Jurisdiction</dt>
                <dd className="font-medium">
                  {formatStatus(incidentCase.jurisdiction_path)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Round / relevant club</dt>
                <dd className="font-medium">
                  {formatStatus(incidentCase.round_type)} ·{" "}
                  {incidentCase.relevant_club_participating == null
                    ? "Not applicable"
                    : incidentCase.relevant_club_participating
                      ? "Participating"
                      : "Not participating"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Report received</dt>
                <dd>
                  {formatMelbourneDateTime(incidentCase.report_received_at)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  Writing / form / complete
                </dt>
                <dd>
                  {incidentCase.report_in_writing ? "Yes" : "No"} /{" "}
                  {incidentCase.prescribed_form_used ? "Yes" : "No"} /{" "}
                  {incidentCase.report_complete ? "Yes" : "No"}
                </dd>
              </div>
            </dl>
          </WorkflowSection>
          <WorkflowSection
            title="People"
            description="Reporter, reported person, affected people and witnesses are case records, not portal users."
            kind="FACT"
          >
            <div className="space-y-2">
              {data.people.map((person) => (
                <div key={person.id} className="rounded-lg border p-3 text-sm">
                  <span className="font-medium">{person.full_name}</span> ·{" "}
                  {formatStatus(person.case_role)}
                  {person.organisation ? ` · ${person.organisation}` : ""}
                </div>
              ))}
            </div>
            {canCoordinate ? (
              <form
                className="mt-5 grid gap-4 rounded-lg border p-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void runAction("Person added", () =>
                    addDisciplineCasePerson(caseId, user!.id, {
                      caseRole: String(form.get("caseRole")),
                      fullName: String(form.get("fullName")),
                      organisation: String(form.get("organisation") || ""),
                      personRole: String(form.get("personRole") || ""),
                      email: String(form.get("email") || ""),
                      notes: String(form.get("notes") || ""),
                    }),
                  );
                  event.currentTarget.reset();
                }}
              >
                <div className="space-y-2">
                  <Label>Case role</Label>
                  <Select name="caseRole" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "REPORTER",
                        "REPORTED_PERSON",
                        "AFFECTED_PERSON",
                        "WITNESS",
                        "OTHER",
                      ].map((value) => (
                        <SelectItem key={value} value={value}>
                          {formatStatus(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="person-name">Full name</Label>
                  <Input id="person-name" name="fullName" required />
                </div>
                <div className="space-y-2">
                  <Label>Organisation / club</Label>
                  <Input name="organisation" />
                </div>
                <div className="space-y-2">
                  <Label>Person role</Label>
                  <Input
                    name="personRole"
                    placeholder="Player, umpire, coach…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input name="email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input name="notes" />
                </div>
                <Button className="md:col-span-2" type="submit" disabled={busy}>
                  Add person
                </Button>
              </form>
            ) : null}
          </WorkflowSection>
        </TabsContent>

        <TabsContent value="screening" className="space-y-5">
          <WorkflowSection
            title="Allegations"
            description="Each allegation has its own preserved revision history and classification."
            kind="FACT"
          >
            <div className="space-y-3">
              {data.allegations.map((allegation) => (
                <div key={allegation.id} className="rounded-lg border p-3">
                  <p className="font-medium">
                    {allegation.allegation_number}. {allegation.title}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {allegation.description}
                  </p>
                  {allegation.initial_classification_code ? (
                    <Badge variant="secondary" className="mt-2">
                      Initial: {allegation.initial_classification_code}
                    </Badge>
                  ) : null}
                  {canInvestigate ? (
                    <form
                      className="mt-4 grid gap-3 border-t pt-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        void runAction("Allegation revision saved", () =>
                          saveAllegation(caseId, {
                            allegationId: allegation.id,
                            title: String(form.get("revisionTitle")),
                            description: String(
                              form.get("revisionDescription"),
                            ),
                            incidentAt: allegation.incident_at || undefined,
                            location: String(
                              form.get("revisionLocation") || "",
                            ),
                            changeReason: String(form.get("revisionReason")),
                          }),
                        );
                      }}
                    >
                      <p className="text-sm font-medium">Record a revision</p>
                      <Input
                        name="revisionTitle"
                        defaultValue={allegation.title}
                        required
                        minLength={3}
                        aria-label="Revised allegation title"
                      />
                      <Textarea
                        name="revisionDescription"
                        defaultValue={allegation.description}
                        required
                        minLength={5}
                        aria-label="Revised allegation description"
                      />
                      <Input
                        name="revisionLocation"
                        defaultValue={allegation.location || ""}
                        placeholder="Location"
                        aria-label="Revised allegation location"
                      />
                      <Input
                        name="revisionReason"
                        required
                        minLength={5}
                        placeholder="Reason for this change"
                        aria-label="Allegation revision reason"
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                      >
                        Save preserved revision
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
            {canInvestigate ? (
              <form
                className="mt-5 grid gap-4 rounded-lg border p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void runAction("Allegation saved", () =>
                    saveAllegation(caseId, {
                      title: String(form.get("title")),
                      description: String(form.get("description")),
                      location: String(form.get("location") || ""),
                      changeReason:
                        "Initial allegation recorded from the case workspace.",
                    }),
                  );
                  event.currentTarget.reset();
                }}
              >
                <div className="space-y-2">
                  <Label>Allegation title</Label>
                  <Input name="title" required minLength={3} />
                </div>
                <div className="space-y-2">
                  <Label>Description and particulars</Label>
                  <Textarea name="description" required minLength={5} />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input name="location" />
                </div>
                <Button type="submit" disabled={busy}>
                  Add allegation
                </Button>
              </form>
            ) : null}
          </WorkflowSection>
          <WorkflowSection
            title="Preliminary classification and Tribunal readiness"
            description="This assumes the reported facts are proven only for screening. It is not a finding."
            kind="JUDGEMENT"
          >
            <div className="space-y-4">
              {data.allegations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add an allegation before screening.
                </p>
              ) : (
                data.allegations.map((allegation) => (
                  <ClassificationForm
                    key={allegation.id}
                    caseId={caseId}
                    allegation={allegation}
                    onSaved={refresh}
                  />
                ))
              )}
            </div>
          </WorkflowSection>
        </TabsContent>

        <TabsContent value="investigation" className="space-y-5">
          <WorkflowSection
            title="Case access and investigator appointment"
            description="Case access is explicit. The lead investigator remains formally accountable."
            kind="JUDGEMENT"
          >
            <div className="space-y-2">
              {data.members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <span>{profileLabel(data, member.user_id)}</span>
                  <Badge variant={member.active ? "secondary" : "outline"}>
                    {formatStatus(member.case_role)}
                    {member.active ? "" : " · revoked"}
                  </Badge>
                </div>
              ))}
            </div>
            {canCoordinate ? (
              <form
                className="mt-5 grid gap-4 rounded-lg border p-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void runAction("Case access updated", () =>
                    assignDisciplineCaseMember(caseId, {
                      userId: String(form.get("userId")),
                      role: String(form.get("role")),
                      active: String(form.get("active")) === "true",
                      reason: String(form.get("reason")),
                    }),
                  );
                }}
              >
                <div className="space-y-2">
                  <Label>User</Label>
                  <Select name="userId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.profileOptions.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {`${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
                            profile.email ||
                            profile.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Case role</Label>
                  <Select name="role" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "CASE_COORDINATOR",
                        "LEAD_INVESTIGATOR",
                        "SUPPORT_INVESTIGATOR",
                        "DECISION_MAKER",
                        "READ_ONLY",
                      ].map((value) => (
                        <SelectItem key={value} value={value}>
                          {formatStatus(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Access action</Label>
                  <Select name="active" defaultValue="true">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Assign or update</SelectItem>
                      <SelectItem value="false">Revoke access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assignment or revocation reason</Label>
                  <Input name="reason" required minLength={3} />
                </div>
                <Button type="submit" disabled={busy} className="md:col-span-2">
                  <UserCheck className="mr-2 h-4 w-4" />
                  Record access change
                </Button>
              </form>
            ) : null}
            {portalContext?.can_manage_config ? (
              <form
                className="mt-5 grid gap-4 rounded-lg border border-primary/30 p-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void runAction("Portal account access updated", () =>
                    setDisciplinePortalAccess({
                      associationId: incidentCase.association_id,
                      userId: String(form.get("portalUserId")),
                      accountMode: String(form.get("accountMode")) as
                        | "FULL_APP"
                        | "DISCIPLINE_ONLY",
                      canCreateCases: form.get("canCreate") === "on",
                      canManageConfig: form.get("canConfigure") === "on",
                      active: String(form.get("portalActive")) === "true",
                      reason: String(form.get("portalReason")),
                    }),
                  );
                }}
              >
                <div className="md:col-span-2">
                  <p className="font-semibold">Portal account access</p>
                  <p className="text-sm text-muted-foreground">
                    Grant the private portal before assigning a dedicated
                    investigator to this case.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>User</Label>
                  <Select name="portalUserId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.profileOptions.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {`${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
                            profile.email ||
                            profile.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account mode</Label>
                  <Select name="accountMode" defaultValue="DISCIPLINE_ONLY">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DISCIPLINE_ONLY">
                        Discipline portal only
                      </SelectItem>
                      <SelectItem value="FULL_APP">
                        Normal SportStack plus discipline
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Portal action</Label>
                  <Select name="portalActive" defaultValue="true">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Grant or update</SelectItem>
                      <SelectItem value="false">
                        Revoke portal access
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input name="portalReason" required minLength={3} />
                </div>
                <label className="flex items-center gap-3 text-sm">
                  <Checkbox name="canCreate" />
                  May create cases
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <Checkbox name="canConfigure" />
                  May manage portal configuration
                </label>
                <Button type="submit" disabled={busy} className="md:col-span-2">
                  Record portal access change
                </Button>
              </form>
            ) : null}
            {canCoordinate ? (
              <form
                className="mt-5 grid gap-4 rounded-lg border p-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const date = String(form.get("appointedDate"));
                  const time = String(form.get("appointedTime"));
                  const lead = String(form.get("leadUserId"));
                  void runAction(
                    "Investigator appointment recorded",
                    async () => {
                      await assignDisciplineCaseMember(caseId, {
                        userId: lead,
                        role: "LEAD_INVESTIGATOR",
                        active: true,
                        reason: "Appointed as the Lead Investigation Officer.",
                      });
                      await addInvestigatorSetup(caseId, user!.id, {
                        leadUserId: lead,
                        appointedAt: combineZonedDateTime(date, time),
                        trainingExperience: String(form.get("experience")),
                        clubAffiliation: String(form.get("club") || ""),
                        committeeRole: String(form.get("committeeRole") || ""),
                        relationshipToParties: String(
                          form.get("relationship") || "",
                        ),
                        competitiveInterest: String(form.get("interest") || ""),
                        actualConflict: form.get("actualConflict") === "on",
                        perceivedConflict:
                          form.get("perceivedConflict") === "on",
                        conflictDecision: String(form.get("conflictDecision")),
                        conflictReason: String(form.get("conflictReason")),
                      });
                    },
                  );
                }}
              >
                <div className="space-y-2">
                  <Label>Lead Investigation Officer</Label>
                  <Select name="leadUserId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.profileOptions.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {`${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
                            profile.email ||
                            profile.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Appointment date</Label>
                    <Input name="appointedDate" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input name="appointedTime" type="time" required />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Training and experience</Label>
                  <Textarea name="experience" required />
                </div>
                {[
                  ["club", "Club affiliation"],
                  ["committeeRole", "Committee role"],
                  ["relationship", "Relationship to parties"],
                  ["interest", "Competitive interest"],
                ].map(([name, label]) => (
                  <div key={name} className="space-y-2">
                    <Label>{label}</Label>
                    <Input name={name} />
                  </div>
                ))}
                <label className="flex items-center gap-3 rounded-lg border p-3">
                  <Checkbox name="actualConflict" />
                  Actual conflict identified
                </label>
                <label className="flex items-center gap-3 rounded-lg border p-3">
                  <Checkbox name="perceivedConflict" />
                  Perceived conflict identified
                </label>
                <div className="space-y-2">
                  <Label>Conflict decision</Label>
                  <Select name="conflictDecision" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select decision" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NO_CONFLICT">No conflict</SelectItem>
                      <SelectItem value="MANAGED">Conflict managed</SelectItem>
                      <SelectItem value="REPLACE_INVESTIGATOR">
                        Replace investigator
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conflict reason</Label>
                  <Input name="conflictReason" required />
                </div>
                <Button type="submit" disabled={busy} className="md:col-span-2">
                  Record appointment and independence check
                </Button>
              </form>
            ) : null}
          </WorkflowSection>

          <div className="grid gap-5 xl:grid-cols-2">
            <WorkflowSection title="Initial notifications" kind="FACT">
              <div className="space-y-2">
                {data.notifications.map((notice) => (
                  <div
                    key={notice.id}
                    className="rounded-lg border p-3 text-sm"
                  >
                    <p className="font-medium">
                      {notice.recipient_name} · {notice.notice_type}
                    </p>
                    <p className="text-muted-foreground">
                      Sent {formatMelbourneDateTime(notice.sent_at)} ·
                      {notice.delivered
                        ? "Delivered"
                        : "Delivery not confirmed"}
                      {" · "}No-finding statement{" "}
                      {notice.no_finding_statement_included
                        ? "included"
                        : "not recorded"}
                    </p>
                  </div>
                ))}
              </div>
              {canCoordinate ? (
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const sentDate = String(form.get("sentDate") || "");
                    const sentTime = String(form.get("sentTime") || "");
                    void runAction("Notification recorded", () =>
                      addDisciplineNotification(caseId, user!.id, {
                        recipientName: String(form.get("recipient")),
                        recipientRole: String(form.get("role") || ""),
                        recipientEmail: String(form.get("email") || ""),
                        noticeType: String(form.get("type")),
                        sentAt: sentDate
                          ? combineZonedDateTime(sentDate, sentTime || "00:00")
                          : undefined,
                        delivered: form.get("delivered") === "on",
                        copyReference: String(form.get("copy") || ""),
                        noFindingStatementIncluded:
                          form.get("noFinding") === "on",
                      }),
                    );
                    event.currentTarget.reset();
                  }}
                >
                  <Input
                    name="recipient"
                    placeholder="Recipient name"
                    required
                  />
                  <Input name="role" placeholder="Recipient role" />
                  <Input name="email" type="email" placeholder="Email" />
                  <Input name="type" placeholder="Notice type" required />
                  <div className="grid grid-cols-2 gap-3">
                    <Input name="sentDate" type="date" aria-label="Sent date" />
                    <Input name="sentTime" type="time" aria-label="Sent time" />
                  </div>
                  <Input name="copy" placeholder="Saved copy reference" />
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox name="delivered" />
                    Delivery confirmed
                  </label>
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox name="noFinding" />
                    Notice states that no finding has been made
                  </label>
                  <Button type="submit" disabled={busy}>
                    Record notification
                  </Button>
                </form>
              ) : null}
            </WorkflowSection>
            <WorkflowSection title="Witness register" kind="FACT">
              <div className="space-y-2">
                {data.witnesses.map((witness) => (
                  <div
                    key={witness.id}
                    className="rounded-lg border p-3 text-sm"
                  >
                    <p className="font-medium">{witness.name}</p>
                    <p className="text-muted-foreground">
                      {witness.can_address} ·{" "}
                      {witness.direct_witness
                        ? "Direct witness"
                        : "Direct status not confirmed"}
                      {" · "}Response{" "}
                      {formatMelbourneDateTime(witness.response_received_at)}
                    </p>
                  </div>
                ))}
              </div>
              {canInvestigate ? (
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const requestDate = String(form.get("requestDate") || "");
                    const responseDate = String(form.get("responseDate") || "");
                    void runAction("Witness recorded", () =>
                      addDisciplineWitness(caseId, user!.id, {
                        allegationId:
                          String(form.get("allegationId") || "") === "__none__"
                            ? undefined
                            : String(form.get("allegationId") || ""),
                        name: String(form.get("name")),
                        roleAndClub: String(form.get("role") || ""),
                        contactDetails: String(form.get("contact") || ""),
                        directWitness: form.get("direct") === "on",
                        isJunior: form.get("junior") === "on",
                        canAddress: String(form.get("canAddress")),
                        followUpRequired: form.get("followUp") === "on",
                        requestSentAt: requestDate
                          ? combineZonedDateTime(requestDate, "00:00")
                          : undefined,
                        responseReceivedAt: responseDate
                          ? combineZonedDateTime(responseDate, "00:00")
                          : undefined,
                      }),
                    );
                    event.currentTarget.reset();
                  }}
                >
                  <Select name="allegationId" defaultValue="__none__">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        General case witness
                      </SelectItem>
                      {data.allegations.map((allegation) => (
                        <SelectItem key={allegation.id} value={allegation.id}>
                          Allegation {allegation.allegation_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input name="name" placeholder="Witness name" required />
                  <Input name="role" placeholder="Role and club" />
                  <Input name="contact" placeholder="Contact details" />
                  <Textarea
                    name="canAddress"
                    placeholder="Facts this witness may address"
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Request sent</Label>
                      <Input name="requestDate" type="date" />
                    </div>
                    <div className="space-y-2">
                      <Label>Response received</Label>
                      <Input name="responseDate" type="date" />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox name="direct" />
                      Direct witness
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox name="junior" />
                      Junior
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox name="followUp" />
                      Follow-up required
                    </label>
                  </div>
                  <Button type="submit" disabled={busy}>
                    Add witness
                  </Button>
                </form>
              ) : null}
            </WorkflowSection>
          </div>

          <WorkflowSection
            title="Evidence register"
            description="Files are private and immutable. A replacement must be uploaded as a new version."
            kind="FACT"
          >
            <div className="grid gap-3 md:grid-cols-2">
              {data.evidence.map((item) => (
                <div key={item.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-muted-foreground">
                    {item.evidence_type} · {formatStatus(item.evidence_basis)} ·
                    version {item.version_number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Received {formatMelbourneDateTime(item.received_at)} ·
                    Shared{" "}
                    {formatMelbourneDateTime(
                      item.shared_with_reported_person_at,
                    )}
                  </p>
                  {item.external_url ? (
                    <a
                      className="mt-1 inline-flex items-center text-primary hover:underline"
                      href={item.external_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Controlled external link
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  ) : null}
                  {item.storage_path ? (
                    <Button
                      variant="link"
                      className="h-auto p-0 text-xs"
                      onClick={() =>
                        void createDisciplineEvidenceLink(item.storage_path!)
                          .then((url) =>
                            window.open(url, "_blank", "noopener,noreferrer"),
                          )
                          .catch((caught: unknown) =>
                            setActionError(
                              caught instanceof Error
                                ? caught.message
                                : "The private file could not be opened.",
                            ),
                          )
                      }
                    >
                      Open private file
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            {canInvestigate ? (
              <form
                className="mt-5 grid gap-4 rounded-lg border p-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const file = form.get("file");
                  const requestedDate = String(form.get("requestedDate") || "");
                  const receivedDate = String(form.get("receivedDate") || "");
                  const sharedDate = String(form.get("sharedDate") || "");
                  const supersedesId = String(form.get("supersedesId") || "");
                  const superseded = data.evidence.find(
                    (item) => item.id === supersedesId,
                  );
                  void runAction("Evidence recorded", () =>
                    addDisciplineEvidence(caseId, user!.id, {
                      allegationId:
                        String(form.get("allegationId")) === "__none__"
                          ? undefined
                          : String(form.get("allegationId")),
                      evidenceType: String(form.get("type")),
                      title: String(form.get("title")),
                      source: String(form.get("source")),
                      evidenceBasis: String(form.get("basis")),
                      externalUrl: String(form.get("url") || ""),
                      notes: String(form.get("notes") || ""),
                      file:
                        file instanceof File && file.size > 0
                          ? file
                          : undefined,
                      requestedAt: requestedDate
                        ? combineZonedDateTime(requestedDate, "00:00")
                        : undefined,
                      receivedAt: receivedDate
                        ? combineZonedDateTime(receivedDate, "00:00")
                        : undefined,
                      sharedAt: sharedDate
                        ? combineZonedDateTime(sharedDate, "00:00")
                        : undefined,
                      supersedesEvidenceId: superseded?.id,
                      versionNumber: superseded
                        ? superseded.version_number + 1
                        : 1,
                    }),
                  );
                }}
              >
                <Select name="allegationId" defaultValue="__none__">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Whole case</SelectItem>
                    {data.allegations.map((allegation) => (
                      <SelectItem key={allegation.id} value={allegation.id}>
                        Allegation {allegation.allegation_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input name="type" placeholder="Evidence type" required />
                <Input name="title" placeholder="Evidence title" required />
                <Input name="source" placeholder="Source" required />
                <Select name="basis" defaultValue="UNKNOWN">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRECT">Direct</SelectItem>
                    <SelectItem value="SECOND_HAND">Second-hand</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  </SelectContent>
                </Select>
                <Select name="supersedesId" defaultValue="__none__">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      New evidence, not a replacement
                    </SelectItem>
                    {data.evidence.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        Replaces {item.title}, version {item.version_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  name="url"
                  type="url"
                  placeholder="Controlled external link (optional)"
                />
                <Input
                  name="file"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp"
                />
                <div className="grid grid-cols-3 gap-2 md:col-span-2">
                  <div className="space-y-2">
                    <Label>Requested</Label>
                    <Input name="requestedDate" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Received</Label>
                    <Input name="receivedDate" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Shared</Label>
                    <Input name="sharedDate" type="date" />
                  </div>
                </div>
                <Textarea
                  name="notes"
                  placeholder="Notes (required if no file or link)"
                  className="md:col-span-2"
                />
                <Button type="submit" disabled={busy} className="md:col-span-2">
                  Add immutable evidence record
                </Button>
              </form>
            ) : null}
          </WorkflowSection>

          <WorkflowSection
            title="Natural justice safeguards"
            description="This is an HB operating safeguard pending formal approval; it is not presented as the exact wording of Rule 7.12."
            kind="LOCAL INTERPRETATION"
          >
            <div className="space-y-3">
              {data.naturalJustice.map((check) => (
                <div key={check.id} className="rounded-lg border p-3">
                  <label className="flex items-start gap-3">
                    <Checkbox
                      checked={check.completed}
                      disabled={!canInvestigate || busy}
                      onCheckedChange={(value) =>
                        runAction("Natural justice check updated", () =>
                          updateNaturalJusticeCheck(
                            check.id,
                            value === true,
                            check.notes || "",
                            user!.id,
                          ),
                        )
                      }
                    />
                    <span>
                      <span className="font-medium">{check.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {check.rule_basis}
                      </span>
                    </span>
                  </label>
                </div>
              ))}
            </div>
            {data.naturalJustice.some(
              (check) => check.required && !check.completed,
            ) ? (
              <>
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Natural justice check not complete</AlertTitle>
                  <AlertDescription>
                    The Lead Investigation Officer cannot sign the report unless
                    all required checks are complete or a Case Coordinator
                    records an authorised override reason.
                  </AlertDescription>
                </Alert>
                {canCoordinate ? (
                  <form
                    className="mt-4 flex flex-col gap-3 rounded-lg border border-destructive/30 p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void runAction(
                        "Natural justice override authorised",
                        () =>
                          authoriseNaturalJusticeOverride(
                            caseId,
                            String(form.get("overrideReason")),
                          ),
                      );
                    }}
                  >
                    <Label htmlFor="overrideReason">
                      Exceptional override reason
                    </Label>
                    <Textarea
                      id="overrideReason"
                      name="overrideReason"
                      required
                      minLength={10}
                    />
                    <Button variant="destructive" type="submit" disabled={busy}>
                      Authorise recorded override
                    </Button>
                  </form>
                ) : null}
              </>
            ) : (
              <Alert className="mt-4">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Required safeguards recorded</AlertTitle>
              </Alert>
            )}
          </WorkflowSection>
        </TabsContent>

        <TabsContent value="findings" className="space-y-5">
          <WorkflowSection
            title="Investigator findings by allegation"
            description="Preliminary classification remains separate. Each finding revision is preserved."
            kind="JUDGEMENT"
          >
            <div className="space-y-4">
              {data.allegations.map((allegation) => (
                <FindingForm
                  key={allegation.id}
                  caseId={caseId}
                  allegation={allegation}
                  onSaved={refresh}
                />
              ))}
            </div>
          </WorkflowSection>
          <Card>
            <CardHeader>
              <CardTitle>Investigation report sign-off</CardTitle>
              <CardDescription>
                Creates an immutable report snapshot and cryptographic hash.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.reportSnapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="rounded-lg border p-3 text-sm"
                >
                  <p className="font-medium">
                    Signed snapshot {snapshot.snapshot_number}
                  </p>
                  <p className="break-all text-xs text-muted-foreground">
                    {formatMelbourneDateTime(snapshot.signed_at)} · SHA-256{" "}
                    {snapshot.sha256}
                  </p>
                </div>
              ))}
              {isLead ? (
                <Button
                  disabled={busy || incidentCase.status !== "FINDINGS"}
                  onClick={() =>
                    runAction("Investigation report signed", () =>
                      signDisciplineReport(caseId),
                    )
                  }
                >
                  <FileCheck2 className="mr-2 h-4 w-4" />
                  Sign report snapshot
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decision" className="space-y-5">
          <WorkflowSection
            title="Hockey Ballarat decision"
            description="Rule 7.7 outcomes. Tribunal and mediation pathways are recorded as Phase 2 referrals."
            kind="JUDGEMENT"
          >
            {data.decisions.map((decision) => (
              <Alert key={decision.id} className="mb-4">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>{formatStatus(decision.outcome)}</AlertTitle>
                <AlertDescription>
                  {decision.decision_reason} · {decision.rule_reference} ·{" "}
                  {formatMelbourneDateTime(decision.decided_at)}
                </AlertDescription>
              </Alert>
            ))}
            {isDecisionMaker ? (
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void runAction("Hockey Ballarat decision recorded", () =>
                    recordDisciplineDecision(caseId, {
                      outcome: String(form.get("outcome")),
                      reason: String(form.get("reason")),
                      ruleReference: String(form.get("ruleReference")),
                      recommendationFollowed: form.get("followed") === "on",
                      differenceReason: String(
                        form.get("differenceReason") || "",
                      ),
                    }),
                  );
                }}
              >
                <div className="space-y-2">
                  <Label>Outcome</Label>
                  <Select name="outcome" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "NO_ACTION",
                        "MISCONDUCT_PENALTY_GUIDANCE",
                        "TRIBUNAL_REFERRAL",
                        "MEDIATION_REFERRAL",
                        "COMBINATION_REFERRAL",
                        "OTHER_APPROPRIATE_COURSE",
                      ].map((value) => (
                        <SelectItem key={value} value={value}>
                          {formatStatus(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Decision reasoning</Label>
                  <Textarea name="reason" required minLength={10} />
                </div>
                <div className="space-y-2">
                  <Label>Rule source</Label>
                  <Input
                    name="ruleReference"
                    defaultValue="HV Competition Rules 2026, Rule 7.7"
                    required
                  />
                </div>
                <label className="flex items-center gap-3 rounded-lg border p-3">
                  <Checkbox name="followed" />
                  Investigator recommendation followed
                </label>
                <div className="space-y-2">
                  <Label>Reason for any difference</Label>
                  <Textarea name="differenceReason" />
                </div>
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    !["REPORT_SIGNED", "HB_DECISION"].includes(
                      incidentCase.status,
                    )
                  }
                >
                  Record final decision
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only the assigned Decision Maker can record the Hockey Ballarat
                decision.
              </p>
            )}
          </WorkflowSection>
        </TabsContent>

        <TabsContent value="timeline">
          <WorkflowSection title="Append-only case timeline" kind="FACT">
            <div className="space-y-3">
              {data.auditEvents.map((event) => (
                <div
                  key={event.id}
                  className="border-l-2 border-primary/30 pl-4"
                >
                  <p className="text-sm font-medium">
                    {formatStatus(event.event_type)} ·{" "}
                    {formatStatus(event.entity_type)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatMelbourneDateTime(event.created_at)}
                    {event.reason ? ` · ${event.reason}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </WorkflowSection>
        </TabsContent>

        <TabsContent value="rules" className="space-y-5">
          <WorkflowSection title="Verified rule citations" kind="RULE">
            <div className="space-y-3">
              {data.ruleClauses.map((clause) => (
                <div key={clause.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      {clause.reference} · {clause.title}
                    </p>
                    <Badge
                      variant={
                        clause.source_status === "VERIFIED"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {formatStatus(clause.source_status)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm">{clause.verified_summary}</p>
                  <a
                    className="mt-2 inline-flex items-center text-sm text-primary hover:underline"
                    href={clause.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open official source
                    {clause.source_page ? `, page ${clause.source_page}` : ""}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </WorkflowSection>
          <WorkflowSection
            title="Local variations and unresolved source issues"
            kind="LOCAL INTERPRETATION"
          >
            <div className="space-y-3">
              {data.localVariations.map((variation) => (
                <div
                  key={variation.id}
                  className="rounded-lg border border-amber-500/30 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      {variation.rule_reference} · {variation.title}
                    </p>
                    <Badge variant="outline">
                      {formatStatus(variation.status)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm">
                    <strong>HV requirement:</strong> {variation.hv_requirement}
                  </p>
                  <p className="mt-1 text-sm">
                    <strong>Proposed HB treatment:</strong>{" "}
                    {variation.proposed_hb_treatment || "Not yet approved"}
                  </p>
                </div>
              ))}
            </div>
          </WorkflowSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}

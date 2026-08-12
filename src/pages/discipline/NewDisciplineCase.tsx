import { FormEvent, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
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
  createDisciplineCase,
  loadAssociationOptions,
} from "@/features/discipline/api";
import {
  InformationBadge,
  WorkflowSection,
} from "@/features/discipline/DisciplineUi";
import { useDisciplineAccess } from "@/features/discipline/useDisciplineAccess";
import { useToast } from "@/hooks/use-toast";
import { combineZonedDateTime } from "@/lib/timezoneDateTime";

type CheckboxKey =
  | "immediateRisk"
  | "reportInWriting"
  | "prescribedForm"
  | "reportComplete"
  | "desiredOutcome"
  | "priorPresentation";

export default function NewDisciplineCase() {
  const { context } = useDisciplineAccess();
  const associationsQuery = useQuery({
    queryKey: ["discipline-associations", context?.association_ids],
    queryFn: () => loadAssociationOptions(context?.association_ids ?? []),
    enabled: Boolean(context),
  });
  const [associationId, setAssociationId] = useState("");
  const [roundType, setRoundType] = useState("REGULAR");
  const [jurisdiction, setJurisdiction] = useState("UNASSESSED");
  const [relevantClub, setRelevantClub] = useState<"YES" | "NO" | "">("");
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
    if (!associationId && associationsQuery.data?.length === 1)
      setAssociationId(associationsQuery.data[0].id);
  }, [associationId, associationsQuery.data]);

  const setCheck = (key: CheckboxKey, value: boolean) =>
    setChecks((current) => ({ ...current, [key]: value }));

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
        immediate_safety_risk: checks.immediateRisk,
        immediate_safety_action: String(form.get("immediateAction") || ""),
        competition: String(form.get("competition") || ""),
        grade: String(form.get("grade") || ""),
        round_label: String(form.get("roundLabel") || ""),
        round_type: roundType,
        relevant_club_participating: relevantClub
          ? relevantClub === "YES"
          : undefined,
        first_named_team: String(form.get("firstTeam") || ""),
        second_named_team: String(form.get("secondTeam") || ""),
        match_concluded_at: combineZonedDateTime(
          String(form.get("matchDate") || ""),
          String(form.get("matchTime") || ""),
        ),
        incident_at: form.get("incidentDate")
          ? combineZonedDateTime(
              String(form.get("incidentDate")),
              String(form.get("incidentTime") || "00:00"),
            )
          : undefined,
        venue: String(form.get("venue") || ""),
        incident_location: String(form.get("location") || ""),
        report_received_at: form.get("reportDate")
          ? combineZonedDateTime(
              String(form.get("reportDate")),
              String(form.get("reportTime") || "00:00"),
            )
          : undefined,
        report_method: String(form.get("reportMethod") || ""),
        report_in_writing: checks.reportInWriting,
        prescribed_form_used: checks.prescribedForm,
        report_complete: checks.reportComplete,
        desired_outcome_included: checks.desiredOutcome,
        prior_presentation_completed: checks.priorPresentation,
        reporter: {
          full_name: String(form.get("reporterName") || ""),
          organisation: String(form.get("reporterOrganisation") || ""),
          person_role: String(form.get("reporterRole") || ""),
          email: String(form.get("reporterEmail") || ""),
        },
        reported_person: {
          full_name: String(form.get("reportedName") || ""),
          organisation: String(form.get("reportedOrganisation") || ""),
          person_role: String(form.get("reportedRole") || ""),
          email: String(form.get("reportedEmail") || ""),
        },
        initial_allegation: {
          title: String(form.get("allegationTitle") || ""),
          description: String(form.get("allegationDescription") || ""),
          incident_at: form.get("incidentDate")
            ? combineZonedDateTime(
                String(form.get("incidentDate")),
                String(form.get("incidentTime") || "00:00"),
              )
            : undefined,
          location: String(form.get("location") || ""),
        },
      });
      toast({
        title: "Case created",
        description: "Deadlines and private case access have been set.",
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

  const referralPath =
    checks.immediateRisk ||
    ["NIF_REFERRAL", "EXTERNAL_SAFETY_REFERRAL", "OTHER_REFERRAL"].includes(
      jurisdiction,
    );

  return (
    <form className="space-y-6 animate-fade-in" onSubmit={handleSubmit}>
      <div>
        <h1 className="font-display text-3xl md:text-4xl">NEW INCIDENT</h1>
        <p className="mt-1 text-muted-foreground">
          Record facts first. The system will guide the process but will not
          decide guilt.
        </p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Case not created</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <WorkflowSection
        title="1. Safety and jurisdiction triage"
        description="Deal with immediate safety first, then identify the proper process."
        kind="JUDGEMENT"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Association</Label>
            <Select
              value={associationId}
              onValueChange={setAssociationId}
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
                  National Integrity Framework referral
                </SelectItem>
                <SelectItem value="EXTERNAL_SAFETY_REFERRAL">
                  External safety referral
                </SelectItem>
                <SelectItem value="OTHER_REFERRAL">Other referral</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="jurisdictionReason">
              Reason for the selected pathway
            </Label>
            <Textarea
              id="jurisdictionReason"
              name="jurisdictionReason"
              placeholder="Record the known facts and why this pathway may apply."
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
              <span className="font-medium">
                Immediate safety risk identified
              </span>
              <span className="block text-sm text-muted-foreground">
                This requires the action taken to be recorded and stops the
                ordinary Rule 7 workflow.
              </span>
            </span>
          </label>
          {checks.immediateRisk ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="immediateAction">
                Immediate safety action taken
              </Label>
              <Textarea id="immediateAction" name="immediateAction" required />
            </div>
          ) : null}
        </div>
        {referralPath ? (
          <Alert className="mt-5">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>External referral pathway</AlertTitle>
            <AlertDescription>
              This case will be recorded as referred. The ordinary Rule 7
              investigation deadlines will not be started.
            </AlertDescription>
          </Alert>
        ) : null}
      </WorkflowSection>

      <WorkflowSection title="2. Match and incident facts" kind="FACT">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="title">Case title</Label>
            <Input id="title" name="title" required minLength={3} />
          </div>
          <div className="space-y-2">
            <Label>Round type</Label>
            <Select value={roundType} onValueChange={setRoundType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REGULAR">Regular round</SelectItem>
                <SelectItem value="LAST_REGULAR">Last regular round</SelectItem>
                <SelectItem value="FINALS">Finals</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {roundType !== "REGULAR" ? (
            <div className="space-y-2 lg:col-span-3">
              <Label>
                Is the relevant club participating in this competition?
              </Label>
              <Select
                value={relevantClub}
                onValueChange={(value) =>
                  setRelevantClub(value as "YES" | "NO")
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select yes or no" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YES">Yes</SelectItem>
                  <SelectItem value="NO">No</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                <InformationBadge kind="RULE" /> The direct Tribunal timing in
                HV Rule 7.1 applies only when this fact is yes.
              </p>
            </div>
          ) : null}
          {[
            ["competition", "Competition"],
            ["grade", "Grade"],
            ["roundLabel", "Round"],
            ["firstTeam", "First named team"],
            ["secondTeam", "Second named team"],
            ["venue", "Venue"],
            ["location", "Incident location"],
          ].map(([name, label]) => (
            <div key={name} className="space-y-2">
              <Label htmlFor={name}>{label}</Label>
              <Input id={name} name={name} />
            </div>
          ))}
          <div className="space-y-2">
            <Label htmlFor="matchDate">Match date</Label>
            <Input id="matchDate" name="matchDate" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="matchTime">Match conclusion time</Label>
            <Input id="matchTime" name="matchTime" type="time" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="incidentDate">Incident date</Label>
            <Input id="incidentDate" name="incidentDate" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="incidentTime">Incident time</Label>
            <Input id="incidentTime" name="incidentTime" type="time" />
          </div>
        </div>
      </WorkflowSection>

      <WorkflowSection
        title="3. People and first allegation"
        description="These records are created atomically with the private case. More people and allegations can be added later."
        kind="FACT"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-semibold">Reporter</h3>
            <div className="space-y-2">
              <Label htmlFor="reporterName">Full name</Label>
              <Input id="reporterName" name="reporterName" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reporterOrganisation">
                  Club or organisation
                </Label>
                <Input id="reporterOrganisation" name="reporterOrganisation" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reporterRole">Role</Label>
                <Input
                  id="reporterRole"
                  name="reporterRole"
                  placeholder="Player, umpire, coach…"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reporterEmail">Email</Label>
              <Input id="reporterEmail" name="reporterEmail" type="email" />
            </div>
          </div>
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-semibold">Person reported</h3>
            <div className="space-y-2">
              <Label htmlFor="reportedName">Full name</Label>
              <Input id="reportedName" name="reportedName" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reportedOrganisation">
                  Club or organisation
                </Label>
                <Input id="reportedOrganisation" name="reportedOrganisation" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportedRole">Role</Label>
                <Input
                  id="reportedRole"
                  name="reportedRole"
                  placeholder="Player, umpire, coach…"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportedEmail">Email</Label>
              <Input id="reportedEmail" name="reportedEmail" type="email" />
            </div>
          </div>
          <div className="space-y-4 rounded-lg border p-4 lg:col-span-2">
            <h3 className="font-semibold">Initial allegation</h3>
            <div className="space-y-2">
              <Label htmlFor="allegationTitle">Allegation title</Label>
              <Input
                id="allegationTitle"
                name="allegationTitle"
                minLength={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allegationDescription">
                Description and known particulars
              </Label>
              <Textarea
                id="allegationDescription"
                name="allegationDescription"
                minLength={5}
                required
              />
            </div>
          </div>
        </div>
      </WorkflowSection>

      <WorkflowSection
        title="4. Report receipt and formal checks"
        description="These are recorded facts. Hockey Ballarat decides what follows if a requirement is missing."
        kind="RULE"
      >
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
            <Input
              id="reportMethod"
              name="reportMethod"
              placeholder="Email, form, verbal notification…"
            />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {(
            [
              ["reportInWriting", "Report is in writing"],
              ["prescribedForm", "Prescribed incident report form used"],
              ["reportComplete", "Report appears complete"],
              ["desiredOutcome", "Desired outcome is included"],
              [
                "priorPresentation",
                "Required prior presentation or approval step completed",
              ],
            ] as [CheckboxKey, string][]
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <Checkbox
                checked={checks[key]}
                onCheckedChange={(value) => setCheck(key, value === true)}
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </WorkflowSection>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Rule pack awaiting Hockey Ballarat approval</AlertTitle>
        <AlertDescription>
          The verified 2026 source data is available for guidance, but the local
          business-day and fee conflicts remain clearly flagged for approval.
        </AlertDescription>
      </Alert>
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || !associationId}>
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Create private case
        </Button>
      </div>
    </form>
  );
}

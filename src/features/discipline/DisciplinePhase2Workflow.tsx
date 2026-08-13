import { useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InformationBadge } from "./DisciplineUi";
import { formatMelbourneDateTime, formatStatus } from "./format";
import {
  blankPhase2Payload,
  PHASE2_STAGES,
  PHASE2_STATUS_OPTIONS,
  validatePhase2Stage,
  type Phase2Mode,
  type Phase2Stage,
} from "./phase2Logic";
import type { DisciplineWorkspaceData } from "./types";
import type { Json } from "@/integrations/supabase/types";

const HV_RULES_URL = "https://cdn.revolutionise.com.au/cups/vichockey/files/tuqrabulv5ovd3og.pdf";

const FIELD_LAYOUT: Record<Phase2Stage, Array<[string, string, "text" | "email" | "datetime-local" | "textarea" | "checkbox"]>> = {
  NOTICE: [
    ["recipient_name", "Recipient name", "text"], ["recipient_email", "Recipient email", "email"],
    ["hearing_at", "Hearing date and time", "datetime-local"], ["hearing_location", "Hearing place or link", "text"],
    ["allegation_particulars", "Allegation particulars", "textarea"], ["evidence_relied_on", "Documents and evidence relied on", "textarea"],
    ["response_rights", "Written and oral response rights", "textarea"], ["hb_presenter", "HB representative/presenter", "text"],
    ["all_affected_people_checked", "All affected people identified", "checkbox"],
    ["notice_manually_issued", "Notice manually issued outside SportStack", "checkbox"], ["service_reference", "Service or copy reference", "text"],
  ],
  HEARING: [
    ["charges_read", "Each charge read to the parties", "checkbox"], ["plea_recorded", "Plea recorded", "checkbox"],
    ["plea", "Plea or response", "text"], ["parties_heard", "Parties given a reasonable opportunity to be heard", "checkbox"],
    ["evidence_considered", "Evidence and submissions considered", "checkbox"], ["natural_justice_confirmed", "Natural justice confirmed", "checkbox"],
    ["hearing_notes", "Hearing record", "textarea"], ["adjournment_reason", "Adjournment reason, if applicable", "textarea"],
  ],
  DETERMINATION: [
    ["charge_results", "Result for every charge", "textarea"], ["majority_basis", "Panel and majority basis", "textarea"],
    ["reasons", "Reasons, if provided", "textarea"], ["any_charge_proved", "One or more charges proved", "checkbox"],
    ["penalty_submissions_invited", "Penalty submissions invited before sanction", "checkbox"],
    ["penalty_submissions", "Penalty submissions considered", "textarea"], ["sanctions", "Sanctions or no sanction", "textarea"],
    ["reasons_publication_authorised", "Tribunal authorised publication of its reasons", "checkbox"],
  ],
  APPEAL: [
    ["decision_notified_at", "Decision notification date and time", "datetime-local"],
    ["appeal_deadline_at", "Calculated appeal deadline", "datetime-local"], ["pathway_confirmation", "Confirmed HB appeal destination and authority", "textarea"],
    ["application_received", "Appeal application received", "checkbox"], ["application_received_at", "Application received date and time", "datetime-local"],
    ["stay_applied", "Stay of execution applied", "checkbox"], ["fee_status", "Fee status or local treatment", "text"],
    ["appeal_outcome", "Appeal decision and reasons", "textarea"],
  ],
  CLOSURE: [
    ["outcome_notified", "Outcome notification completed", "checkbox"], ["appeal_complete", "Appeal period/process completed", "checkbox"],
    ["records_complete", "Case and sanction records complete", "checkbox"], ["privacy_review_complete", "Privacy/publication review completed", "checkbox"],
    ["publication_treatment", "Publication treatment and authority", "textarea"], ["retention_treatment", "Retention and access treatment", "textarea"],
    ["closure_summary", "Closure summary", "textarea"],
  ],
};

export function DisciplinePhase2Workflow({
  data,
  canCoordinate,
  busy,
  onSave,
}: {
  data: DisciplineWorkspaceData;
  canCoordinate: boolean;
  busy: boolean;
  onSave: (stage: Phase2Stage, status: string, mode: Phase2Mode, payload: Record<string, Json>) => void;
}) {
  const [stage, setStage] = useState<Phase2Stage>("NOTICE");
  const [mode, setMode] = useState<Phase2Mode>("SIMULATION");
  const [errors, setErrors] = useState<string[]>([]);
  const latest = useMemo(
    () => data.phase2StageRecords.find((record) => record.stage === stage && record.workflow_mode === mode),
    [data.phase2StageRecords, mode, stage],
  );
  const [drafts, setDrafts] = useState<Record<string, { status: string; payload: Record<string, Json> }>>({});
  const draftKey = `${mode}:${stage}`;
  const current = drafts[draftKey] ?? {
    status: latest?.status ?? "DRAFT",
    payload: latest ? (latest.payload as Record<string, Json>) : blankPhase2Payload(stage),
  };
  const guidance = PHASE2_STAGES.find((item) => item.key === stage)!;
  const preparationReady = data.tribunalPreparations[0]?.status === "READY";
  const realIssueBlocked = mode === "REAL" && stage === "NOTICE" && current.status === "ISSUED" && !preparationReady;
  const update = (changes: Partial<typeof current>) =>
    setDrafts((previous) => ({ ...previous, [draftKey]: { ...current, ...changes } }));
  const updatePayload = (key: string, value: Json) => update({ payload: { ...current.payload, [key]: value } });
  const submit = () => {
    const validationErrors = validatePhase2Stage(stage, current.status, mode, current.payload);
    setErrors(validationErrors);
    if (validationErrors.length) return;
    onSave(stage, current.status, mode, current.payload);
  };

  return (
    <div className="space-y-5">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Simulation does not create a real Tribunal outcome</AlertTitle>
        <AlertDescription>
          Incident 007 has unresolved Tribunal appointments. Simulation records test the workflow only and do not send email, appoint members, impose a sanction, start a real appeal or close the real case.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Post-referral workflow</CardTitle>
          <CardDescription>Complete each stage in order. Every save creates an audited revision.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {errors.length ? (
            <Alert variant="destructive" className="md:col-span-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Complete these items before saving</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-5">
                  {errors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label>Workflow stage</Label>
            <Select value={stage} onValueChange={(value) => setStage(value as Phase2Stage)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PHASE2_STAGES.map((item) => <SelectItem key={item.key} value={item.key}>{item.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Record type</Label>
            <Select value={mode} onValueChange={(value) => setMode(value as Phase2Mode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SIMULATION">Workflow simulation — no real effect</SelectItem>
                <SelectItem value="REAL">Real proceeding record</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><CardTitle>{guidance.title}</CardTitle><CardDescription>{guidance.guidance}</CardDescription></div>
            <InformationBadge kind="RULE" />
          </div>
          <a href={HV_RULES_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            {guidance.source}<ExternalLink className="h-3.5 w-3.5" />
          </a>
          {latest ? <p className="text-xs text-muted-foreground">Latest: revision {latest.revision_number}, {formatStatus(latest.status)}, saved {formatMelbourneDateTime(latest.recorded_at)}</p> : null}
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Stage status</Label>
            <Select value={current.status} onValueChange={(status) => update({ status })} disabled={!canCoordinate || busy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PHASE2_STATUS_OPTIONS[stage].map((status) => <SelectItem key={status} value={status}>{formatStatus(status)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {mode === "SIMULATION" ? (
            <label className="flex items-center gap-3 rounded-lg border border-amber-300 p-3 text-sm">
              <Checkbox checked={current.payload.simulation_acknowledged === true} onCheckedChange={(value) => updatePayload("simulation_acknowledged", value === true)} disabled={!canCoordinate || busy} />
              <span>I confirm this is a Dev workflow simulation only.</span>
            </label>
          ) : null}
          {FIELD_LAYOUT[stage].map(([key, label, type]) => type === "checkbox" ? (
            <label key={key} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <Checkbox checked={current.payload[key] === true} onCheckedChange={(value) => updatePayload(key, value === true)} disabled={!canCoordinate || busy} />
              <span>{label}</span>
            </label>
          ) : (
            <div key={key} className={type === "textarea" ? "space-y-2 md:col-span-2" : "space-y-2"}>
              <Label>{label}</Label>
              {type === "textarea" ? (
                <Textarea value={String(current.payload[key] ?? "")} onChange={(event) => updatePayload(key, event.target.value)} disabled={!canCoordinate || busy} />
              ) : (
                <Input type={type} value={String(current.payload[key] ?? "")} onChange={(event) => updatePayload(key, event.target.value)} disabled={!canCoordinate || busy} />
              )}
            </div>
          ))}
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button onClick={submit} disabled={!canCoordinate || busy || realIssueBlocked}>
              <Save className="mr-2 h-4 w-4" />Save {mode === "SIMULATION" ? "simulation" : "real record"}
            </Button>
            {realIssueBlocked ? <Badge variant="destructive">Blocked until Tribunal Preparation is Ready</Badge> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

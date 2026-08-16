import { ReactNode, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, FileClock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { recordDisciplineEvidenceStatusEvent } from "./api";
import {
  evidenceStatusNeedsDecision,
  evidenceStatusPreventsReliance,
  latestEvidenceStatusEvent,
  type EvidenceStatusTarget,
} from "./evidenceStatus";
import { formatMelbourneDateTime, formatStatus } from "./format";
import type { DisciplineEvidenceStatusEvent } from "./types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type StatusAction =
  | "WITHDRAWAL_REQUESTED"
  | "WITHDRAWAL_CANCELLED"
  | "EXCLUDED_FROM_RELIANCE"
  | "RETAINED_LIMITED_WEIGHT"
  | "RETAINED_FOR_RELIANCE"
  | "RESTORED_FOR_CONSIDERATION";

type RequestSource =
  | "WITNESS"
  | "COMPLAINANT"
  | "REPORTER"
  | "CASE_COORDINATOR"
  | "INVESTIGATOR"
  | "TRIBUNAL"
  | "OTHER";

const STATUS_LABELS: Record<string, string> = {
  WITHDRAWAL_REQUESTED: "Withdrawal requested — reliance paused",
  WITHDRAWAL_CANCELLED: "Withdrawal request cancelled",
  EXCLUDED_FROM_RELIANCE: "Excluded — must not be relied upon",
  RETAINED_LIMITED_WEIGHT: "Retained with limited weight",
  RETAINED_FOR_RELIANCE: "Retained for consideration",
  RESTORED_FOR_CONSIDERATION: "Restored for consideration",
};

export function DisciplineEvidenceHandlingDialog({
  caseId,
  targetType,
  targetId,
  title,
  summary,
  events,
  canRequest,
  canDecide,
  onSaved,
  children,
}: {
  caseId: string;
  targetType: EvidenceStatusTarget;
  targetId: string;
  title: string;
  summary: string;
  events: DisciplineEvidenceStatusEvent[];
  canRequest: boolean;
  canDecide: boolean;
  onSaved: () => Promise<void>;
  children: ReactNode;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<StatusAction | "">("");
  const [requestSource, setRequestSource] = useState<RequestSource>(
    targetType === "WITNESS" ? "WITNESS" : "OTHER",
  );
  const [reason, setReason] = useState("");
  const [safetyConcern, setSafetyConcern] = useState(false);
  const [pressureConcern, setPressureConcern] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetEvents = useMemo(
    () => events.filter((event) =>
      event.target_type === targetType
      && (targetType === "EVIDENCE"
        ? event.evidence_id === targetId
        : event.witness_id === targetId),
    ),
    [events, targetId, targetType],
  );
  const latest = latestEvidenceStatusEvent(events, targetType, targetId);
  const pending = evidenceStatusNeedsDecision(latest);
  const preventsReliance = evidenceStatusPreventsReliance(latest);

  const availableActions = useMemo(() => {
    const values: Array<[StatusAction, string]> = [];
    if (pending) {
      if (canRequest) {
        values.push(["WITHDRAWAL_CANCELLED", "Record that the request was cancelled"]);
      }
      if (canDecide) {
        values.push(
          ["EXCLUDED_FROM_RELIANCE", "Exclude from reliance"],
          ["RETAINED_LIMITED_WEIGHT", "Retain with limited weight"],
          ["RETAINED_FOR_RELIANCE", "Retain for consideration"],
        );
      }
    } else if (latest?.status === "EXCLUDED_FROM_RELIANCE") {
      if (canDecide) {
        values.push(["RESTORED_FOR_CONSIDERATION", "Restore for consideration"]);
      }
    } else if (canRequest) {
      values.push(["WITHDRAWAL_REQUESTED", "Record a withdrawal request"]);
    }
    return values;
  }, [canDecide, canRequest, latest?.status, pending]);

  const submit = async () => {
    if (!action || reason.trim().length < 10) return;
    setSaving(true);
    setError(null);
    try {
      await recordDisciplineEvidenceStatusEvent(caseId, {
        targetType,
        targetId,
        status: action,
        requestSource,
        reason: reason.trim(),
        safetyConcern,
        pressureOrIntimidationConcern: pressureConcern,
      });
      await onSaved();
      toast({ title: STATUS_LABELS[action] ?? formatStatus(action) });
      setAction("");
      setReason("");
      setSafetyConcern(false);
      setPressureConcern(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The withdrawal record could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50",
            preventsReliance && "border-destructive/60 bg-destructive/5",
          )}
        >
          <span className="flex flex-wrap items-start justify-between gap-2">
            <span>
              <span className="block font-medium">{title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{summary}</span>
            </span>
            <Badge variant={preventsReliance ? "destructive" : "outline"}>
              {latest ? STATUS_LABELS[latest.status] ?? formatStatus(latest.status) : "Active"}
            </Badge>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Review the full record and its append-only withdrawal history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border p-4 text-sm">{children}</div>

          {pending ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Reliance is paused</AlertTitle>
              <AlertDescription>
                Other case work may continue, but this material must not be
                relied upon and the report or Tribunal determination cannot be
                finalised until the request is decided.
              </AlertDescription>
            </Alert>
          ) : null}

          <Alert>
            <FileClock className="h-4 w-4" />
            <AlertTitle>What the rules mean here</AlertTitle>
            <AlertDescription>
              A request does not delete the original. Under HV Rule 7.19(f)–(g),
              the Tribunal may decide what weight to give material when its
              author is unavailable, while still observing natural justice.
              The national policy also allows a complaint process to continue
              after a complaint is withdrawn.
              <span className="mt-2 flex flex-wrap gap-3">
                <a className="inline-flex items-center text-primary hover:underline" href="https://cdn.revolutionise.com.au/cups/vichockey/files/tuqrabulv5ovd3og.pdf" target="_blank" rel="noreferrer">HV Rule 7.19, page 32 <ExternalLink className="ml-1 h-3 w-3" /></a>
                <a className="inline-flex items-center text-primary hover:underline" href="https://www.hockeyballarat.com.au/uploads/1/4/8/3/148316959/de3wntx1qsqupsyp.pdf" target="_blank" rel="noreferrer">HA policy 6.9 and 7.5(b), pages 12 and 14 <ExternalLink className="ml-1 h-3 w-3" /></a>
              </span>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <h3 className="font-medium">Withdrawal and decision history</h3>
            {targetEvents.length ? targetEvents.map((event) => (
              <div key={event.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{STATUS_LABELS[event.status] ?? formatStatus(event.status)}</p>
                <p className="mt-1">{event.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatMelbourneDateTime(event.recorded_at)} · Source: {formatStatus(event.request_source)}
                  {event.safety_concern ? " · Safety concern" : ""}
                  {event.pressure_or_intimidation_concern ? " · Possible pressure or intimidation" : ""}
                </p>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No withdrawal request has been recorded.</p>
            )}
          </div>

          {availableActions.length ? (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={action} onValueChange={(value) => setAction(value as StatusAction)}>
                  <SelectTrigger><SelectValue placeholder="Select an action" /></SelectTrigger>
                  <SelectContent>
                    {availableActions.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Who requested or authorised this action?</Label>
                <Select value={requestSource} onValueChange={(value) => setRequestSource(value as RequestSource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WITNESS">Witness</SelectItem>
                    <SelectItem value="COMPLAINANT">Complainant</SelectItem>
                    <SelectItem value="REPORTER">Reporter</SelectItem>
                    <SelectItem value="CASE_COORDINATOR">Case Coordinator</SelectItem>
                    <SelectItem value="INVESTIGATOR">Investigator</SelectItem>
                    <SelectItem value="TRIBUNAL">Tribunal</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`evidence-status-reason-${targetId}`}>Reason and relevant circumstances</Label>
                <Textarea id={`evidence-status-reason-${targetId}`} value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} placeholder="Record the request or decision reasons. Do not delete or rewrite the original account." />
              </div>
              {action === "WITHDRAWAL_REQUESTED" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-start gap-2 text-sm"><Checkbox checked={safetyConcern} onCheckedChange={(value) => setSafetyConcern(value === true)} /><span>Safety or wellbeing concern identified</span></label>
                  <label className="flex items-start gap-2 text-sm"><Checkbox checked={pressureConcern} onCheckedChange={(value) => setPressureConcern(value === true)} /><span>Possible pressure, intimidation or retaliation</span></label>
                </div>
              ) : null}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="button" onClick={() => void submit()} disabled={!action || reason.trim().length < 10 || saving}>
                {saving ? "Saving…" : "Save append-only record"}
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

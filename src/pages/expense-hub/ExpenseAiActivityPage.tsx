import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"expense_ai_processing_jobs">;
type Suggestion = Tables<"expense_ai_field_suggestions">;
type StatementImport = Tables<"expense_statement_imports">;

export default function ExpenseAiActivityPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [statements, setStatements] = useState<StatementImport[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [jobResult, suggestionResult, statementResult] = await Promise.all([
      supabase.from("expense_ai_processing_jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("expense_ai_field_suggestions").select("*"),
      supabase.from("expense_statement_imports").select("*").not("provider", "is", null).order("created_at", { ascending: false }),
    ]);
    const message = jobResult.error?.message || suggestionResult.error?.message || statementResult.error?.message;
    if (message) { setError(message); return; }
    setJobs(jobResult.data || []); setSuggestions(suggestionResult.data || []); setStatements(statementResult.data || []);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const summary = useMemo(() => {
    const approvedSuggestions = suggestions.filter((item) => item.approved_at);
    const changed = approvedSuggestions.filter((item) => item.was_changed).length;
    const confidences = suggestions.map((item) => Number(item.confidence_score)).filter(Number.isFinite);
    const totalCost = jobs.reduce((total, job) => total + Number(job.estimated_cost_usd || 0), 0)
      + statements.reduce((total, statement) => total + Number(statement.estimated_cost_usd || 0), 0);
    return {
      scans: jobs.length + statements.length,
      waiting: jobs.filter((job) => job.status === "READY_FOR_REVIEW").length,
      failed: jobs.filter((job) => job.status === "PROCESSING_FAILED").length + statements.filter((item) => item.status === "FAILED").length,
      changeRate: approvedSuggestions.length ? changed / approvedSuggestions.length * 100 : 0,
      confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length * 100 : 0,
      totalCost,
    };
  }, [jobs, statements, suggestions]);

  const activity = [
    ...jobs.map((job) => ({ id: job.id, createdAt: job.created_at, kind: "Invoice or receipt", provider: job.provider, model: job.model, status: job.status, cost: Number(job.estimated_cost_usd || 0) })),
    ...statements.map((statement) => ({ id: statement.id, createdAt: statement.created_at, kind: "PDF bank statement", provider: statement.provider || "—", model: statement.model || "—", status: statement.status, cost: Number(statement.estimated_cost_usd || 0) })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return <div className="space-y-6">
    <div><h2 className="text-2xl font-semibold">AI activity</h2><p className="text-sm text-muted-foreground">Usage, estimated provider costs and review accuracy. Invoice content is not shown here.</p></div>
    {error && <Alert variant="destructive"><AlertTitle>AI activity could not be loaded</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Scans" value={String(summary.scans)} /><Metric label="Waiting for review" value={String(summary.waiting)} /><Metric label="Failed" value={String(summary.failed)} />
      <Metric label="Fields corrected" value={`${summary.changeRate.toFixed(0)}%`} /><Metric label="Estimated cost" value={`US$${summary.totalCost.toFixed(4)}`} />
    </div>
    <Card><CardHeader><CardTitle className="text-lg">Extraction quality</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Average field confidence: {summary.confidence.toFixed(0)}%. Confidence describes the provider suggestion only; every financial record still needs user approval.</p></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-lg">Recent processing</CardTitle></CardHeader><CardContent className="space-y-3">{activity.map((item) => <div key={`${item.kind}-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{item.kind}</p><p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("en-AU")} · {item.provider} · {item.model}</p></div><div className="flex items-center gap-3"><span className="text-sm">US${item.cost.toFixed(4)}</span><Badge variant="outline">{item.status.replaceAll("_", " ")}</Badge></div></div>)}{activity.length === 0 && <p className="text-sm text-muted-foreground">No AI processing has been recorded.</p>}</CardContent></Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></CardContent></Card>;
}

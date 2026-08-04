import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileCheck2, FileWarning, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { createDraftExpenseFromStatementLine, importBankStatement, importPdfBankStatement, retryPdfBankStatement, reviewStatementLine } from "@/features/expense-hub/api";
import { useExpenseHub } from "@/features/expense-hub/ExpenseHubContext";
import { parseBankStatement } from "@/features/expense-hub/statementParser";
import { formatAustralianDate, formatCurrency } from "@/features/expense-hub/utils";

type StatementImport = Tables<"expense_statement_imports">;
type StatementLine = Tables<"expense_statement_lines">;
type Draft = { supplierId: string; categoryId: string; businessUse: string };

export default function StatementImportsPage() {
  const { user } = useAuth();
  const { suppliers, categories } = useExpenseHub();
  const { toast } = useToast();
  const [imports, setImports] = useState<StatementImport[]>([]);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [importResult, lineResult] = await Promise.all([
      supabase.from("expense_statement_imports").select("*").order("created_at", { ascending: false }),
      supabase.from("expense_statement_lines").select("*").order("transaction_date", { ascending: false }),
    ]);
    if (importResult.error || lineResult.error) {
      setError(importResult.error?.message || lineResult.error?.message || "Statement data could not be loaded.");
      return;
    }
    setImports(importResult.data || []);
    setLines(lineResult.data || []);
    setDrafts((current) => Object.fromEntries((lineResult.data || []).map((line) => [line.id, current[line.id] || {
      supplierId: line.supplier_id || "",
      categoryId: line.category_id || "",
      businessUse: String(line.business_use_percentage),
    }])));
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const uploadStatement = async (file?: File) => {
    if (!user || !file) return;
    setBusy(true); setError(null);
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const result = await importPdfBankStatement(user.id, file);
        await refresh();
        toast({ title: "PDF statement scanned", description: `${result.rowCount} lines are ready to review. ${result.provider} cost estimate: US$${result.estimatedCostUsd.toFixed(4)}.` });
        return;
      }
      const parsed = await parseBankStatement(file);
      await importBankStatement(user.id, file, parsed);
      await refresh();
      toast({ title: "Statement imported", description: `${parsed.length} transaction lines are ready to review.` });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The statement could not be imported.");
    } finally { setBusy(false); }
  };

  const retryImport = async (statement: StatementImport) => {
    setBusy(true); setError(null);
    try {
      const result = await retryPdfBankStatement(statement.id);
      await refresh();
      toast({ title: "Statement scan completed", description: `${result.rowCount} lines are ready to review.` });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The statement scan could not be retried.");
      await refresh();
    } finally { setBusy(false); }
  };

  const decide = async (line: StatementLine, decision: "BUSINESS" | "PERSONAL" | "NOT_RELEVANT") => {
    if (!user) return;
    const draft = drafts[line.id];
    setBusy(true);
    try {
      await reviewStatementLine(line.id, user.id, {
        decision,
        businessUsePercentage: Number(draft?.businessUse || 100),
        supplierId: draft?.supplierId,
        categoryId: draft?.categoryId,
      });
      await refresh();
    } catch (caught) {
      toast({ variant: "destructive", title: "Review could not be saved", description: caught instanceof Error ? caught.message : "Try again." });
    } finally { setBusy(false); }
  };

  const createDraft = async (line: StatementLine) => {
    if (!user) return;
    const draft = drafts[line.id];
    setBusy(true);
    try {
      await reviewStatementLine(line.id, user.id, { decision: "BUSINESS", businessUsePercentage: Number(draft.businessUse), supplierId: draft.supplierId, categoryId: draft.categoryId });
      const expenseId = await createDraftExpenseFromStatementLine(user.id, line.id);
      await refresh();
      toast({ title: "Draft expense created", description: "It is marked Needs review until evidence is attached." });
      window.location.assign(`/expense-hub/expenses/${expenseId}/edit`);
    } catch (caught) {
      toast({ variant: "destructive", title: "Draft expense could not be created", description: caught instanceof Error ? caught.message : "Try again." });
    } finally { setBusy(false); }
  };

  const pending = lines.filter((line) => !line.expense_id && line.decision !== "NOT_RELEVANT");
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-semibold">Bank statements</h2><p className="text-sm text-muted-foreground">Import transactions, decide what is relevant, then attach evidence to the created expense.</p></div>
    {error && <Alert variant="destructive"><AlertTitle>Statement import needs attention</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    <Card><CardHeader><CardTitle className="text-lg">Upload statement</CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">CSV and OFX stay in your browser. PDF statements use OpenAI first, with Claude as an automatic fallback, and always require your review.</p>
      <Label htmlFor="bank-statement">Choose a CSV, OFX or PDF file</Label>
      <Input id="bank-statement" type="file" accept=".csv,.ofx,.pdf,text/csv,application/x-ofx,application/pdf" disabled={busy} onChange={(event) => void uploadStatement(event.target.files?.[0])} />
    </CardContent></Card>
    <div className="grid gap-3 sm:grid-cols-3">
      <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Imports</p><p className="text-2xl font-semibold">{imports.length}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Waiting for review</p><p className="text-2xl font-semibold">{pending.length}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Missing evidence</p><p className="text-2xl font-semibold">{lines.filter((line) => line.expense_id && line.evidence_status === "MISSING").length}</p></CardContent></Card>
    </div>
    {imports.filter((statement) => statement.status === "FAILED").map((statement) => <Alert key={statement.id} variant="destructive"><FileWarning className="h-4 w-4" /><AlertTitle>{statement.original_filename} could not be scanned</AlertTitle><AlertDescription><p>{statement.error_message || "The PDF statement could not be processed. The original file was retained."}</p><Button className="mt-3" size="sm" variant="outline" disabled={busy || statement.attempt_count >= 5} onClick={() => void retryImport(statement)}>Retry scan ({statement.attempt_count}/5 used)</Button></AlertDescription></Alert>)}
    <div className="space-y-3">{lines.map((line) => {
      const draft = drafts[line.id] || { supplierId: "", categoryId: "", businessUse: "100" };
      return <Card key={line.id}><CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{line.description}</p><p className="text-sm text-muted-foreground">{formatAustralianDate(line.transaction_date)}{line.reference ? ` · ${line.reference}` : ""}</p></div><div className="text-right"><p className="font-semibold">{formatCurrency(Math.abs(Number(line.amount)))}</p><Badge variant={line.evidence_status === "VERIFIED" ? "default" : "outline"}>{line.expense_id ? line.evidence_status.replaceAll("_", " ") : line.decision.replaceAll("_", " ")}</Badge></div></div>
        {!line.expense_id && line.decision !== "NOT_RELEVANT" && <div className="grid gap-3 md:grid-cols-3">
          <Select value={draft.supplierId || "__none__"} onValueChange={(value) => setDrafts((current) => ({ ...current, [line.id]: { ...draft, supplierId: value === "__none__" ? "" : value } }))}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="Supplier" /></SelectTrigger><SelectContent><SelectItem value="__none__">Choose supplier</SelectItem>{suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.display_name}</SelectItem>)}</SelectContent></Select>
          <Select value={draft.categoryId || "__none__"} onValueChange={(value) => setDrafts((current) => ({ ...current, [line.id]: { ...draft, categoryId: value === "__none__" ? "" : value } }))}><SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="__none__">No category yet</SelectItem>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select>
          <Input aria-label="Business use percentage" type="number" min="0" max="100" value={draft.businessUse} onChange={(event) => setDrafts((current) => ({ ...current, [line.id]: { ...draft, businessUse: event.target.value } }))} />
        </div>}
        <div className="flex flex-wrap gap-2">
          {!line.expense_id && line.decision !== "NOT_RELEVANT" && <><Button size="sm" disabled={busy || !draft.supplierId} onClick={() => void createDraft(line)}><Upload className="mr-2 h-4 w-4" />Create business draft</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void decide(line, "PERSONAL")}>Personal</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void decide(line, "NOT_RELEVANT")}>Not relevant</Button></>}
          {line.expense_id && <Button size="sm" variant="outline" asChild><Link to={`/expense-hub/expenses/${line.expense_id}/edit`}>{line.evidence_status === "MISSING" ? <FileWarning className="mr-2 h-4 w-4" /> : <FileCheck2 className="mr-2 h-4 w-4" />}Open expense and evidence</Link></Button>}
        </div>
      </CardContent></Card>;
    })}{lines.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">No statement transactions have been imported.</CardContent></Card>}</div>
  </div>;
}

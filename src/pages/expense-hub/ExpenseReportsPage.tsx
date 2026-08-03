import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, History } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { exportExpensesToExcel, exportExpensesToPdf } from "@/features/expense-hub/exports";
import { ExpenseFiltersPanel } from "@/features/expense-hub/ExpenseFiltersPanel";
import { useExpenseHub } from "@/features/expense-hub/ExpenseHubContext";
import { ExpenseSummaryCards } from "@/features/expense-hub/ExpenseSummaryCards";
import { EMPTY_EXPENSE_FILTERS, type ExpenseFilters, type ExpenseRecord } from "@/features/expense-hub/types";
import { filterExpenses, financialYearForDate, formatCurrency } from "@/features/expense-hub/utils";

function groupBy(expenses: ExpenseRecord[], type: "supplier" | "category") {
  const totals = new Map<string, number>();
  expenses.forEach((expense) => {
    const label = type === "supplier" ? expense.supplier?.display_name || "Unknown" : expense.category?.name || "Uncategorised";
    totals.set(label, (totals.get(label) || 0) + Number(expense.business_amount));
  });
  return [...totals.entries()].map(([name, total]) => ({ name, total })).sort((left, right) => right.total - left.total).slice(0, 10);
}

export default function ExpenseReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { expenses, suppliers, categories, paymentMethods, exportBatches, error, refresh } = useExpenseHub();
  const [filters, setFilters] = useState<ExpenseFilters>({ ...EMPTY_EXPENSE_FILTERS });
  const [busy, setBusy] = useState(false);
  const financialYears = useMemo(() => [...new Set(expenses.map((expense) => financialYearForDate(expense.expense_date)))].sort().reverse(), [expenses]);
  const filtered = useMemo(() => filterExpenses(expenses, filters), [expenses, filters]);
  const supplierData = useMemo(() => groupBy(filtered, "supplier"), [filtered]);
  const categoryData = useMemo(() => groupBy(filtered, "category"), [filtered]);

  const exportReport = async (type: "XLSX" | "PDF") => {
    if (!user || filtered.length === 0) return;
    setBusy(true);
    try {
      if (type === "XLSX") await exportExpensesToExcel(user.id, filtered, filters); else await exportExpensesToPdf(user.id, filtered, filters);
      await refresh();
      toast({ title: `${type === "XLSX" ? "Excel" : "PDF"} report created`, description: `${filtered.length} filtered expense${filtered.length === 1 ? "" : "s"} included.` });
    } catch (caught) { toast({ variant: "destructive", title: "Report could not be created", description: caught instanceof Error ? caught.message : "Try again." }); }
    finally { setBusy(false); }
  };

  if (error) return <Alert variant="destructive"><AlertTitle>Reports could not be loaded</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">Reports and export</h2><p className="text-sm text-muted-foreground">Every total and export uses the filters shown below.</p></div><div className="flex gap-2"><Button variant="outline" disabled={busy || filtered.length === 0} onClick={() => void exportReport("XLSX")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button><Button disabled={busy || filtered.length === 0} onClick={() => void exportReport("PDF")}><Download className="mr-2 h-4 w-4" />PDF</Button></div></div><ExpenseSummaryCards expenses={filtered} /><ExpenseFiltersPanel filters={filters} onChange={setFilters} suppliers={suppliers} categories={categories} paymentMethods={paymentMethods} financialYears={financialYears} /><div className="grid gap-4 xl:grid-cols-2"><SummaryChart title="Business expenses by category" data={categoryData} /><SummaryChart title="Business expenses by supplier" data={supplierData} /></div><Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Export history</CardTitle><CardDescription>Exports remain a snapshot. They do not lock expense records.</CardDescription></CardHeader><CardContent className="space-y-2">{exportBatches.map((batch) => <div key={batch.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{batch.export_format} · {batch.expense_count} expenses</p><p className="text-xs text-muted-foreground">{new Date(batch.created_at).toLocaleString("en-AU")}</p></div><div className="text-right"><p className="font-medium">{formatCurrency(Number(batch.total_amount))}</p><p className="text-xs text-muted-foreground">Business {formatCurrency(Number(batch.total_business_amount))}</p></div></div>)}{exportBatches.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No reports have been exported yet.</p>}</CardContent></Card></div>;
}

function SummaryChart({ title, data }: { title: string; data: Array<{ name: string; total: number }> }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{data.length === 0 ? <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">No filtered data.</div> : <ResponsiveContainer width="100%" height={300}><BarChart data={data} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(value) => `$${value}`} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Bar dataKey="total" name="Business amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>}</CardContent></Card>;
}

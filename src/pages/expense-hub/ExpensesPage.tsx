import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, Copy, Download, FileSpreadsheet, Paperclip, Pencil } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { archiveExpense } from "@/features/expense-hub/api";
import { exportExpensesToExcel, exportExpensesToPdf } from "@/features/expense-hub/exports";
import { ExpenseFiltersPanel } from "@/features/expense-hub/ExpenseFiltersPanel";
import { useExpenseHub } from "@/features/expense-hub/ExpenseHubContext";
import { ExpenseStatusBadge } from "@/features/expense-hub/ExpenseStatusBadge";
import { ExpenseSummaryCards } from "@/features/expense-hub/ExpenseSummaryCards";
import { EMPTY_EXPENSE_FILTERS, type ExpenseFilters } from "@/features/expense-hub/types";
import { filterExpenses, financialYearForDate, formatAustralianDate, formatCurrency } from "@/features/expense-hub/utils";

export default function ExpensesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { expenses, suppliers, categories, paymentMethods, loading, error, refresh } = useExpenseHub();
  const [filters, setFilters] = useState<ExpenseFilters>({ ...EMPTY_EXPENSE_FILTERS });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const financialYears = useMemo(() => [...new Set(expenses.map((expense) => financialYearForDate(expense.expense_date)))].sort().reverse(), [expenses]);
  const filtered = useMemo(() => filterExpenses(expenses, filters), [expenses, filters]);
  const selectedExpenses = filtered.filter((expense) => selected.has(expense.id));

  const toggleAll = () => setSelected((current) => current.size === filtered.length ? new Set() : new Set(filtered.map((expense) => expense.id)));
  const toggleOne = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const setArchived = async (id: string, archived: boolean) => {
    if (!user) return;
    setBusy(true);
    try {
      await archiveExpense(id, user.id, archived);
      await refresh();
      toast({ title: archived ? "Expense archived" : "Expense restored" });
    } catch (caught) {
      toast({ variant: "destructive", title: "Expense could not be updated", description: caught instanceof Error ? caught.message : "Try again." });
    } finally {
      setBusy(false);
    }
  };

  const runExport = async (format: "XLSX" | "PDF") => {
    if (!user) return;
    const rows = selectedExpenses.length > 0 ? selectedExpenses : filtered;
    if (rows.length === 0) return;
    setBusy(true);
    try {
      if (format === "XLSX") await exportExpensesToExcel(user.id, rows, filters);
      else await exportExpensesToPdf(user.id, rows, filters);
      await refresh();
      toast({ title: `${format === "XLSX" ? "Excel" : "PDF"} export created`, description: `${rows.length} expense${rows.length === 1 ? "" : "s"} included.` });
    } catch (caught) {
      toast({ variant: "destructive", title: "Export failed", description: caught instanceof Error ? caught.message : "Try again." });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-80 w-full" /></div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Expenses could not be loaded</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-2xl font-semibold">Expenses</h2><p className="text-sm text-muted-foreground">Search, review and export your authorised records.</p></div>
        <div className="flex gap-2">
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" disabled={busy || filtered.length === 0}><Download className="mr-2 h-4 w-4" />Export{selectedExpenses.length > 0 ? ` (${selectedExpenses.length})` : ""}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => void runExport("XLSX")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel workbook</DropdownMenuItem><DropdownMenuItem onClick={() => void runExport("PDF")}><Download className="mr-2 h-4 w-4" />PDF report</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <Button asChild><Link to="/expense-hub/expenses/new">Add expense</Link></Button>
        </div>
      </div>
      <ExpenseSummaryCards expenses={filtered} />
      <ExpenseFiltersPanel filters={filters} onChange={setFilters} suppliers={suppliers} categories={categories} paymentMethods={paymentMethods} financialYears={financialYears} />
      <Card className="hidden lg:block"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="w-10"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} aria-label="Select all filtered expenses" /></TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead>Description</TableHead><TableHead>Invoice</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Business</TableHead><TableHead>Status</TableHead><TableHead className="w-32">Actions</TableHead></TableRow></TableHeader><TableBody>
        {filtered.map((expense) => <TableRow key={expense.id} className={expense.archived_at ? "opacity-60" : undefined}><TableCell><Checkbox checked={selected.has(expense.id)} onCheckedChange={() => toggleOne(expense.id)} aria-label={`Select ${expense.description}`} /></TableCell><TableCell>{formatAustralianDate(expense.expense_date)}</TableCell><TableCell className="w-64 max-w-xs"><span className="block truncate">{expense.supplier?.display_name || "Unknown"}</span></TableCell><TableCell className="max-w-xs"><span className="block truncate">{expense.description}</span></TableCell><TableCell>{expense.invoice_number || "—"}</TableCell><TableCell>{expense.category?.name || "Uncategorised"}</TableCell><TableCell className="text-right font-medium">{formatCurrency(Number(expense.total_amount))}</TableCell><TableCell className="text-right"><div>{formatCurrency(Number(expense.business_amount))}</div><div className="text-xs text-muted-foreground">{Number(expense.business_use_percentage).toFixed(0)}%</div></TableCell><TableCell><div className="flex items-center gap-2"><ExpenseStatusBadge expense={expense} />{expense.attachments.length > 0 && <Paperclip className="h-4 w-4 text-muted-foreground" />}</div></TableCell><TableCell><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => navigate(`/expense-hub/expenses/${expense.id}/edit`)} aria-label="Edit expense"><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => navigate(`/expense-hub/expenses/new?duplicate=${expense.id}`)} aria-label="Duplicate expense"><Copy className="h-4 w-4" /></Button><Button size="icon" variant="ghost" disabled={busy} onClick={() => void setArchived(expense.id, !expense.archived_at)} aria-label={expense.archived_at ? "Restore expense" : "Archive expense"}>{expense.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</Button></div></TableCell></TableRow>)}
        {filtered.length === 0 && <TableRow><TableCell colSpan={10} className="h-32 text-center text-muted-foreground">No expenses match the current filters.</TableCell></TableRow>}
      </TableBody></Table></CardContent></Card>
      <div className="grid gap-3 lg:hidden">{filtered.map((expense) => <Card key={expense.id} className={expense.archived_at ? "opacity-60" : undefined}><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{expense.supplier?.display_name || "Unknown supplier"}</p><p className="text-sm text-muted-foreground">{formatAustralianDate(expense.expense_date)} · {expense.description}</p></div><Checkbox checked={selected.has(expense.id)} onCheckedChange={() => toggleOne(expense.id)} aria-label={`Select ${expense.description}`} /></div><div className="flex items-end justify-between"><div><ExpenseStatusBadge expense={expense} /><p className="mt-2 text-xs text-muted-foreground">Business {Number(expense.business_use_percentage).toFixed(0)}% · {formatCurrency(Number(expense.business_amount))}</p></div><p className="text-lg font-semibold">{formatCurrency(Number(expense.total_amount))}</p></div><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => navigate(`/expense-hub/expenses/${expense.id}/edit`)}><Pencil className="mr-2 h-4 w-4" />Edit</Button><Button size="sm" variant="ghost" onClick={() => navigate(`/expense-hub/expenses/new?duplicate=${expense.id}`)}><Copy className="mr-2 h-4 w-4" />Duplicate</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void setArchived(expense.id, !expense.archived_at)}>{expense.archived_at ? "Restore" : "Archive"}</Button></div></CardContent></Card>)}{filtered.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">No expenses match the current filters.</CardContent></Card>}</div>
    </div>
  );
}

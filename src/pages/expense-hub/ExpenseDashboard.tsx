import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BarChart3, FilePlus2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpenseSummaryCards } from "@/features/expense-hub/ExpenseSummaryCards";
import { useExpenseHub } from "@/features/expense-hub/ExpenseHubContext";
import { calculateExpenseTotals, formatCurrency } from "@/features/expense-hub/utils";

export default function ExpenseDashboard() {
  const { expenses, loading, error } = useExpenseHub();
  const activeExpenses = useMemo(() => expenses.filter((expense) => !expense.archived_at), [expenses]);
  const monthlyData = useMemo(() => {
    const grouped = new Map<string, typeof activeExpenses>();
    activeExpenses.forEach((expense) => {
      const month = expense.expense_date.slice(0, 7);
      grouped.set(month, [...(grouped.get(month) || []), expense]);
    });
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-12).map(([month, rows]) => ({
      month: new Date(`${month}-01T00:00:00`).toLocaleDateString("en-AU", { month: "short", year: "2-digit" }),
      total: calculateExpenseTotals(rows).totalAmount,
      business: calculateExpenseTotals(rows).businessAmount,
    }));
  }, [activeExpenses]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-80 w-full" /></div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Expense data could not be loaded</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-2xl font-semibold">Dashboard</h2><p className="text-sm text-muted-foreground">A current view of your authorised expense records.</p></div>
        <Button asChild><Link to="/expense-hub/expenses/new"><FilePlus2 className="mr-2 h-4 w-4" />Add expense</Link></Button>
      </div>
      <ExpenseSummaryCards expenses={activeExpenses} />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Expenses by month</CardTitle></CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Add an expense to start the monthly summary.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis tickFormatter={(value) => `$${value}`} /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Bar dataKey="total" name="Total" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} /><Bar dataKey="business" name="Business" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

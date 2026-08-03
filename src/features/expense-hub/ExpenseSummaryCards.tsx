import { CircleDollarSign, FileWarning, Landmark, ReceiptText, Scale, WalletCards } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ExpenseRecord } from "./types";
import { calculateExpenseTotals, formatCurrency } from "./utils";

export function ExpenseSummaryCards({ expenses }: { expenses: ExpenseRecord[] }) {
  const totals = calculateExpenseTotals(expenses);
  const items = [
    { label: "Total expenses", value: formatCurrency(totals.totalAmount), icon: CircleDollarSign },
    { label: "Business portion", value: formatCurrency(totals.businessAmount), icon: Landmark },
    { label: "Personal portion", value: formatCurrency(totals.personalAmount), icon: WalletCards },
    { label: "GST recorded", value: formatCurrency(totals.gstAmount), icon: Scale },
    { label: "Needs review", value: String(expenses.filter((item) => item.expense_status === "NEEDS_REVIEW").length), icon: FileWarning },
    { label: "Without documents", value: String(expenses.filter((item) => item.attachments.length === 0).length), icon: ReceiptText },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {items.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{label}</p>
              <p className="truncate text-xl font-semibold">{value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

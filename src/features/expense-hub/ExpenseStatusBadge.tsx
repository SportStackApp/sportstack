import { Badge } from "@/components/ui/badge";
import type { ExpenseRecord } from "./types";

export function ExpenseStatusBadge({ expense }: { expense: ExpenseRecord }) {
  if (expense.archived_at) return <Badge variant="outline">Archived</Badge>;
  if (expense.expense_status === "READY") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Ready</Badge>;
  if (expense.expense_status === "NEEDS_REVIEW") return <Badge variant="destructive">Needs review</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

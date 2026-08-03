import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useExpenseHubAccess } from "./useExpenseHubAccess";

export function ExpenseHubGate({ children }: { children: ReactNode }) {
  const { allowed, loading, error } = useExpenseHubAccess();

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-2xl">
        <LockKeyhole className="h-4 w-4" />
        <AlertTitle>Expense Hub access could not be checked</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!allowed) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

import { Navigate, Outlet } from "react-router-dom";
import { AlertTriangle, LockKeyhole } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useDisciplineAccess } from "./useDisciplineAccess";

export function DisciplineAccessGate() {
  const { context, loading, error } = useDisciplineAccess();

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-muted/30 p-6">
        <Alert variant="destructive" className="mx-auto max-w-2xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Discipline access could not be checked</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!context?.allowed) {
    return context?.discipline_only ? (
      <main className="min-h-screen bg-muted/30 p-6">
        <Alert className="mx-auto max-w-2xl">
          <LockKeyhole className="h-4 w-4" />
          <AlertTitle>No assigned discipline cases</AlertTitle>
          <AlertDescription>
            Ask the Hockey Ballarat case coordinator to assign your account.
          </AlertDescription>
        </Alert>
      </main>
    ) : (
      <Navigate to="/dashboard" replace />
    );
  }

  return <Outlet />;
}

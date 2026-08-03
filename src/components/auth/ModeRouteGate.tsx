import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppMode, type AppMode } from "@/contexts/AppModeContext";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["user_role_enum"];

interface ModeRouteGateProps {
  allowedModes: readonly AppMode[];
  children: ReactNode;
  fallback?: string;
  requiredRoleForPlayerMode?: AppRole;
}

/**
 * Keeps a protected route closed until Supabase has confirmed the user's
 * current mode and organisation scope. The active mode is intentional: a
 * Super Admin using "Viewing as" must receive the same restricted screen as
 * the lower role they selected.
 */
export function ModeRouteGate({
  allowedModes,
  children,
  fallback = "/dashboard",
  requiredRoleForPlayerMode,
}: ModeRouteGateProps) {
  const {
    activeMode,
    loading,
    contextConfirmed,
    modeSyncError,
    roles,
  } = useAppMode();

  if (loading) {
    return (
      <div className="space-y-4" aria-label="Confirming access">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const hasRequiredPlayerRole = activeMode !== "player"
    || !requiredRoleForPlayerMode
    || roles.includes(requiredRoleForPlayerMode);

  if (!allowedModes.includes(activeMode) || !hasRequiredPlayerRole) {
    return <Navigate to={fallback} replace />;
  }

  if (!contextConfirmed) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-2xl">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access could not be confirmed</AlertTitle>
        <AlertDescription>
          {modeSyncError || "Your selected role and organisation scope are still being confirmed. Refresh this page to try again."}
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}

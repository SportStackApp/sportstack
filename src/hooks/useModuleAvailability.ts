import { useEffect, useState } from "react";
import { useAppMode } from "@/contexts/AppModeContext";
import { useTeamContext } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import { useCoordinationAccess } from "@/hooks/useCoordinationAccess";

export type SportStackModuleKey =
  | "player_mvp"
  | "umpire_match_voting"
  | "committee"
  | "safety_risk"
  | "hockey_trace"
  | "incident_discipline"
  | "coordination";

const CLOSED_MODULE_STATE: Record<SportStackModuleKey, boolean> = {
  player_mvp: false,
  umpire_match_voting: false,
  committee: false,
  safety_risk: false,
  hockey_trace: false,
  incident_discipline: false,
  coordination: false,
};

const permissionClient = supabase as unknown as {
  rpc: (
    functionName: "resolve_effective_permission_for_mode",
    args: {
      p_permission_key: string;
      p_actor_mode: string;
      p_association_id?: string;
      p_club_id?: string;
      p_division_id?: string;
      p_team_id?: string;
    },
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export function useModuleAvailability(moduleKeys: SportStackModuleKey[]) {
  const {
    activeMode,
    loading: modeLoading,
    modeSyncError,
    contextConfirmed,
  } = useAppMode();
  const {
    selectedAssociationId,
    selectedClubId,
    selectedDivision,
    selectedTeamId,
  } = useTeamContext();
  const moduleKeySignature = moduleKeys.join(",");
  const coordinationRequested = moduleKeys.includes("coordination");
  const { access: coordinationAccess, loading: coordinationAccessLoading } = useCoordinationAccess(coordinationRequested);
  const requestSignature = [
    moduleKeySignature,
    activeMode,
    selectedAssociationId,
    selectedClubId,
    selectedDivision,
    selectedTeamId,
  ].join("|");
  const [enabled, setEnabled] = useState<Record<SportStackModuleKey, boolean>>(CLOSED_MODULE_STATE);
  const [resolvedSignature, setResolvedSignature] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const requestedKeys = moduleKeySignature.split(",").filter(Boolean) as SportStackModuleKey[];
    if (requestedKeys.length === 0) {
      setResolvedSignature(requestSignature);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    // A requested module stays unavailable until its permission has been
    // confirmed. This avoids briefly exposing a module when the resolver is
    // slow or unavailable.
    setEnabled((current) => ({
      ...current,
      ...Object.fromEntries(requestedKeys.map((key) => [key, false])),
    }));

    // The database data gates are bound to the active Auth session mode. Do
    // not resolve or render a module until AppModeContext has confirmed that
    // mode with Supabase; otherwise the first page query can race ahead of the
    // session initialisation and fail without a useful retry.
    if (modeLoading) {
      setResolvedSignature("");
      return () => {
        cancelled = true;
      };
    }
    if (coordinationRequested && coordinationAccessLoading) {
      setResolvedSignature("");
      return () => {
        cancelled = true;
      };
    }

    if (modeSyncError) {
      setError(modeSyncError);
      setResolvedSignature(requestSignature);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (!contextConfirmed) {
      setResolvedSignature("");
      return () => {
        cancelled = true;
      };
    }

    void Promise.all(requestedKeys.map(async (moduleKey) => {
      if (moduleKey === "coordination" && coordinationAccess.is_coordinator) {
        return [moduleKey, true] as const;
      }
      const { data, error: resolveError } = await permissionClient.rpc("resolve_effective_permission_for_mode", {
        p_permission_key: `module.${moduleKey}.access`,
        p_actor_mode: activeMode,
        p_association_id: selectedAssociationId || undefined,
        p_club_id: selectedClubId || undefined,
        p_division_id: selectedDivision || undefined,
        p_team_id: selectedTeamId || undefined,
      });
      if (resolveError) throw resolveError;
      const result = data as { allowed?: boolean } | null;
      // A missing or malformed response is not permission. Only an explicit
      // true from the mode-aware server resolver opens a module.
      return [moduleKey, result?.allowed === true] as const;
    }))
      .then((results) => {
        if (cancelled) return;
        setEnabled((current) => ({ ...current, ...Object.fromEntries(results) }));
        setResolvedSignature(requestSignature);
      })
      .catch((resolveError: unknown) => {
        if (cancelled) return;
        setError(resolveError instanceof Error ? resolveError.message : "Module status could not be checked.");
        // Fail closed for the requested modules. Existing Supabase RLS remains
        // the data-security boundary, but a resolver failure must not expose UI.
        setEnabled((current) => ({
          ...current,
          ...Object.fromEntries(requestedKeys.map((key) => [key, false])),
        }));
        setResolvedSignature(requestSignature);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeMode,
    coordinationAccess.is_coordinator,
    coordinationAccessLoading,
    coordinationRequested,
    contextConfirmed,
    modeLoading,
    modeSyncError,
    moduleKeySignature,
    requestSignature,
    selectedAssociationId,
    selectedClubId,
    selectedDivision,
    selectedTeamId,
  ]);

  const isCurrentRequest = resolvedSignature === requestSignature;
  return {
    enabled: isCurrentRequest ? enabled : CLOSED_MODULE_STATE,
    loading: loading || !isCurrentRequest,
    error: isCurrentRequest ? error : null,
  };
}

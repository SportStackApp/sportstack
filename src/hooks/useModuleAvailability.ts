import { useEffect, useState } from "react";
import { useTeamContext } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";

export type SportStackModuleKey =
  | "player_mvp"
  | "umpire_match_voting"
  | "committee"
  | "safety_risk"
  | "hockey_trace";

const DEFAULT_MODULE_STATE: Record<SportStackModuleKey, boolean> = {
  player_mvp: true,
  umpire_match_voting: true,
  committee: true,
  safety_risk: true,
  hockey_trace: false,
};

export function useModuleAvailability(moduleKeys: SportStackModuleKey[]) {
  const {
    selectedAssociationId,
    selectedClubId,
    selectedDivision,
    selectedTeamId,
  } = useTeamContext();
  const moduleKeySignature = moduleKeys.join(",");
  const [enabled, setEnabled] = useState<Record<SportStackModuleKey, boolean>>(DEFAULT_MODULE_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const requestedKeys = moduleKeySignature.split(",").filter(Boolean) as SportStackModuleKey[];
    if (requestedKeys.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    void Promise.all(requestedKeys.map(async (moduleKey) => {
      const { data, error: resolveError } = await supabase.rpc("resolve_module_enabled", {
        p_module_key: moduleKey,
        p_association_id: selectedAssociationId || undefined,
        p_club_id: selectedClubId || undefined,
        p_division_id: selectedDivision || undefined,
        p_team_id: selectedTeamId || undefined,
      });
      if (resolveError) throw resolveError;
      return [moduleKey, data] as const;
    }))
      .then((results) => {
        if (cancelled) return;
        setEnabled((current) => ({ ...current, ...Object.fromEntries(results) }));
      })
      .catch((resolveError: unknown) => {
        if (cancelled) return;
        setError(resolveError instanceof Error ? resolveError.message : "Module status could not be checked.");
        // Keep current modules available if the status service is temporarily unavailable.
        setEnabled(DEFAULT_MODULE_STATE);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleKeySignature, selectedAssociationId, selectedClubId, selectedDivision, selectedTeamId]);

  return { enabled, loading, error };
}

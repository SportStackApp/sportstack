import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppMode } from "@/contexts/AppModeContext";
import { useTeamContext } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";

export type CoordinationResponsibility = {
  responsibility:
    | "UMPIRE_COORDINATOR"
    | "TECHNICAL_BENCH_COORDINATOR"
    | "VOLUNTEER_COORDINATOR";
  scope_type: "ASSOCIATION" | "CLUB";
  scope_id: string;
};

export type CoordinationAccess = {
  is_coordinator: boolean;
  can_manage_umpires: boolean;
  can_manage_technical_bench: boolean;
  can_manage_volunteers: boolean;
  can_manage_matrix: boolean;
  can_review_roster_mismatches: boolean;
  responsibilities: CoordinationResponsibility[];
};

const CLOSED_ACCESS: CoordinationAccess = {
  is_coordinator: false,
  can_manage_umpires: false,
  can_manage_technical_bench: false,
  can_manage_volunteers: false,
  can_manage_matrix: false,
  can_review_roster_mismatches: false,
  responsibilities: [],
};

export function useCoordinationAccess(enabled = true) {
  const { user } = useAuth();
  const { activeMode, contextConfirmed } = useAppMode();
  const { selectedAssociationId, selectedClubId, selectedTeamId } = useTeamContext();
  const [access, setAccess] = useState<CoordinationAccess>(CLOSED_ACCESS);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !user || !contextConfirmed) {
      setAccess(CLOSED_ACCESS);
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    void supabase.rpc("coordination_get_current_access", {
      p_actor_mode: activeMode,
      p_association_id: selectedAssociationId || undefined,
      p_club_id: selectedClubId || undefined,
      p_team_id: selectedTeamId || undefined,
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data || typeof data !== "object") {
        setAccess(CLOSED_ACCESS);
        return;
      }
      setAccess(data as unknown as CoordinationAccess);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [
    activeMode,
    contextConfirmed,
    enabled,
    selectedAssociationId,
    selectedClubId,
    selectedTeamId,
    user,
  ]);

  return { access, loading };
}

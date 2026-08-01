import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppMode, type AppMode } from "@/contexts/AppModeContext";
import { useTeamContext } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["user_role_enum"];

interface ScopedRole {
  role: AppRole;
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
}

interface AdminScope {
  loading: boolean;
  scopeLoading: boolean;
  isSuperAdmin: boolean;
  actualIsSuperAdmin: boolean;
  isAnyAdmin: boolean;
  actorMode: AppMode;
  scopedRoles: ScopedRole[];
  scopedAssociationIds: string[];
  scopedClubIds: string[];
  scopedTeamIds: string[];
  canManageAssociation: (id: string) => boolean;
  canManageClub: (id: string) => boolean;
  canManageTeam: (id: string) => boolean;
  highestScopedRole: AppRole | null;
  refetch: () => Promise<void>;
}

const ADMIN_ROLES: AppRole[] = ["SUPER_ADMIN", "ASSOCIATION_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"];

export function useAdminScope(): AdminScope {
  const { user } = useAuth();
  const { mode, viewingAs } = useAppMode();
  const { selectedAssociationId, selectedClubId, selectedTeamId } = useTeamContext();
  const [loading, setLoading] = useState(true);
  const [scopedRoles, setScopedRoles] = useState<ScopedRole[]>([]);
  const [allClubs, setAllClubs] = useState<{ id: string; association_id: string }[]>([]);
  const [allTeams, setAllTeams] = useState<{ id: string; club_id: string }[]>([]);

  const fetchScope = useCallback(async () => {
    if (!user) {
      setScopedRoles([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch user's roles with scope columns + hierarchy data in parallel
    const [rolesRes, clubsRes, teamsRes] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role, association_id, club_id, team_id")
        .eq("user_id", user.id),
      supabase.from("clubs").select("id, association_id"),
      supabase.from("teams").select("id, club_id"),
    ]);

    setScopedRoles(
      (rolesRes.data || []).map((r) => ({
        role: r.role,
        association_id: r.association_id,
        club_id: r.club_id,
        team_id: r.team_id,
      }))
    );
    setAllClubs(clubsRes.data || []);
    setAllTeams(teamsRes.data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchScope();
  }, [fetchScope]);

  const actualIsSuperAdmin = scopedRoles.some((r) => r.role === "SUPER_ADMIN");
  const actorMode = mode === "super_admin" ? viewingAs : mode;
  const isSuperAdmin = actualIsSuperAdmin && actorMode === "super_admin";
  const isAnyAdmin = actorMode !== "player" && actorMode !== "coach";

  // Build scoped IDs (memoized to prevent infinite re-render loops)
  const { scopedAssociationIds, scopedClubIds, scopedTeamIds } = useMemo(() => {
    const assocIds: string[] = [];
    const clubIds: string[] = [];
    const teamIds: string[] = [];

    if (!loading && !isSuperAdmin) {
      // A Super Admin using Viewing as is deliberately restricted to the
      // selected cascade scope. Lower-role accounts use only the role that
      // matches their active mode.
      if (actualIsSuperAdmin) {
        if (actorMode === "association" && selectedAssociationId) assocIds.push(selectedAssociationId);
        if (actorMode === "club" && selectedClubId) clubIds.push(selectedClubId);
        if (actorMode === "team_manager" && selectedTeamId) teamIds.push(selectedTeamId);
      }

      const roleForMode: Partial<Record<AppMode, AppRole>> = {
        association: "ASSOCIATION_ADMIN",
        club: "CLUB_ADMIN",
        team_manager: "TEAM_MANAGER",
        coach: "COACH",
      };
      const matchingRole = roleForMode[actorMode];
      const activeScopedRoles = actualIsSuperAdmin
        ? []
        : scopedRoles.filter((role) => !matchingRole || role.role === matchingRole);

      for (const sr of activeScopedRoles) {
        if (sr.role === "ASSOCIATION_ADMIN" && sr.association_id) {
          if (!assocIds.includes(sr.association_id)) {
            assocIds.push(sr.association_id);
          }
          for (const club of allClubs) {
            if (club.association_id === sr.association_id && !clubIds.includes(club.id)) {
              clubIds.push(club.id);
            }
          }
          for (const team of allTeams) {
            const club = allClubs.find((c) => c.id === team.club_id);
            if (club && club.association_id === sr.association_id && !teamIds.includes(team.id)) {
              teamIds.push(team.id);
            }
          }
        }
        if (sr.role === "CLUB_ADMIN" && sr.club_id) {
          if (!clubIds.includes(sr.club_id)) {
            clubIds.push(sr.club_id);
          }
          for (const team of allTeams) {
            if (team.club_id === sr.club_id && !teamIds.includes(team.id)) {
              teamIds.push(team.id);
            }
          }
        }
        if ((sr.role === "TEAM_MANAGER" || sr.role === "COACH") && sr.team_id) {
          if (!teamIds.includes(sr.team_id)) {
            teamIds.push(sr.team_id);
          }
        }
      }
    }

    for (const club of allClubs) {
      if (assocIds.includes(club.association_id) && !clubIds.includes(club.id)) clubIds.push(club.id);
    }
    for (const team of allTeams) {
      if (clubIds.includes(team.club_id) && !teamIds.includes(team.id)) teamIds.push(team.id);
    }

    return { scopedAssociationIds: assocIds, scopedClubIds: clubIds, scopedTeamIds: teamIds };
  }, [
    actorMode,
    actualIsSuperAdmin,
    scopedRoles,
    allClubs,
    allTeams,
    loading,
    isSuperAdmin,
    selectedAssociationId,
    selectedClubId,
    selectedTeamId,
  ]);

  const canManageAssociation = (id: string) => isSuperAdmin || scopedAssociationIds.includes(id);
  const canManageClub = (id: string) => isSuperAdmin || scopedClubIds.includes(id);
  const canManageTeam = (id: string) => isSuperAdmin || scopedTeamIds.includes(id);

  const ROLE_HIERARCHY: AppRole[] = ["SUPER_ADMIN", "ASSOCIATION_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH", "PLAYER"];
  const highestScopedRole = scopedRoles.length > 0
    ? ROLE_HIERARCHY.find((r) => scopedRoles.some((sr) => sr.role === r)) || null
    : null;

  return {
    loading,
    scopeLoading: loading,
    isSuperAdmin,
    actualIsSuperAdmin,
    isAnyAdmin,
    actorMode,
    scopedRoles,
    scopedAssociationIds,
    scopedClubIds,
    scopedTeamIds,
    canManageAssociation,
    canManageClub,
    canManageTeam,
    highestScopedRole,
    refetch: fetchScope,
  };
}

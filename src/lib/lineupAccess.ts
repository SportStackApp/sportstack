/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface FixtureAccessInput {
  id: string;
  home_team_id: string;
  away_team_id: string;
}

export interface LineupAccess {
  canView: boolean;
  canEdit: boolean;
  visibleTeamIds: string[];
  editableTeamIds: string[];
}

interface TeamScopeRow {
  id: string;
  club_id: string;
  clubs?: { association_id: string | null } | { association_id: string | null }[] | null;
}

interface RoleRow {
  role: AppRole;
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
}

const canRoleManageTeam = (role: RoleRow, team: TeamScopeRow) => {
  const club = Array.isArray(team.clubs) ? team.clubs[0] : team.clubs;
  if (role.role === "SUPER_ADMIN") return true;
  if (role.role === "ASSOCIATION_ADMIN") return role.association_id === club?.association_id;
  if (role.role === "CLUB_ADMIN") return role.club_id === team.club_id;
  if (role.role === "TEAM_MANAGER" || role.role === "COACH") return role.team_id === team.id;
  return false;
};

export const getLineupAccess = async (userId: string | undefined, fixture: FixtureAccessInput): Promise<LineupAccess> => {
  if (!userId) {
    return { canView: false, canEdit: false, visibleTeamIds: [], editableTeamIds: [] };
  }

  const fixtureTeamIds = [fixture.home_team_id, fixture.away_team_id].filter(Boolean);

  const [rolesRes, membershipsRes, fillInsRes, teamsRes] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role, association_id, club_id, team_id")
      .eq("user_id", userId),
    supabase
      .from("team_memberships")
      .select("team_id")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .in("team_id", fixtureTeamIds),
    (supabase as any)
      .from("fixture_fill_ins")
      .select("team_id")
      .eq("fixture_id", fixture.id)
      .eq("player_id", userId)
      .eq("status", "SELECTED")
      .lte("access_starts_at", new Date().toISOString())
      .gte("access_expires_at", new Date().toISOString()),
    (supabase
      .from("teams")
      .select("id, club_id, clubs(association_id)")
      .in("id", fixtureTeamIds) as any),
  ]);

  const roles = (rolesRes.data || []) as RoleRow[];
  const memberTeamIds = new Set((membershipsRes.data || []).map((row) => row.team_id));
  const fillInTeamIds = new Set<string>(((fillInsRes.data || []) as Array<{ team_id: string }>).map((row) => row.team_id));
  const teams = ((teamsRes.data || []) as TeamScopeRow[]).filter((team) => fixtureTeamIds.includes(team.id));

  const visibleTeamIds = new Set<string>();
  const editableTeamIds = new Set<string>();

  teams.forEach((team) => {
    if (memberTeamIds.has(team.id) || fillInTeamIds.has(team.id)) visibleTeamIds.add(team.id);

    if (roles.some((role) => canRoleManageTeam(role, team))) {
      visibleTeamIds.add(team.id);
      editableTeamIds.add(team.id);
    }
  });

  return {
    canView: visibleTeamIds.size > 0,
    canEdit: editableTeamIds.size > 0,
    visibleTeamIds: Array.from(visibleTeamIds),
    editableTeamIds: Array.from(editableTeamIds),
  };
};

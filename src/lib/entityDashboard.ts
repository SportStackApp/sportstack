import { supabase } from "@/integrations/supabase/client";

export type EntityDashboardType = "association" | "club" | "division" | "team";

interface RoleScopeRow {
  role: string;
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
}

interface MembershipScopeRow {
  team_id: string;
  teams: {
    club_id: string;
    division_id: string | null;
    clubs: { association_id: string } | null;
  } | null;
}

interface EntityScope {
  associationId: string;
  clubId: string | null;
  divisionId: string | null;
  teamId: string | null;
}

async function loadEntityScope(entityType: EntityDashboardType, entityId: string): Promise<EntityScope | null> {
  if (entityType === "association") {
    return { associationId: entityId, clubId: null, divisionId: null, teamId: null };
  }
  if (entityType === "club") {
    const { data } = await supabase
      .from("clubs")
      .select("id, association_id")
      .eq("id", entityId)
      .maybeSingle();
    return data ? { associationId: data.association_id, clubId: data.id, divisionId: null, teamId: null } : null;
  }
  if (entityType === "division") {
    const { data } = await supabase
      .from("divisions")
      .select("id, association_id")
      .eq("id", entityId)
      .maybeSingle();
    return data ? { associationId: data.association_id, clubId: null, divisionId: data.id, teamId: null } : null;
  }

  const { data } = await supabase
    .from("teams")
    .select("id, club_id, division_id, clubs(association_id)")
    .eq("id", entityId)
    .maybeSingle();
  const club = Array.isArray(data?.clubs) ? data.clubs[0] : data?.clubs;
  return data && club
    ? { associationId: club.association_id, clubId: data.club_id, divisionId: data.division_id, teamId: data.id }
    : null;
}

export interface EntityUpdate {
  id: string;
  content: string;
  createdAt: string;
  scopeLabel: string;
}

export async function canViewEntityDashboard(
  userId: string,
  entityType: EntityDashboardType,
  entityId: string,
) {
  const [rolesResult, membershipsResult] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role, association_id, club_id, team_id")
      .eq("user_id", userId),
    supabase
      .from("team_memberships")
      .select("team_id, teams(club_id, division_id, clubs(association_id))")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .in("membership_type", ["PRIMARY", "SECONDARY", "PERMANENT"]),
  ]);

  const roles = (rolesResult.data || []) as RoleScopeRow[];
  if (roles.some((role) => role.role === "SUPER_ADMIN")) return true;

  const memberships = (membershipsResult.data || []) as unknown as MembershipScopeRow[];
  const membershipTeamIds = memberships.map((membership) => membership.team_id);
  const divisionMembershipResult = entityType === "division" && membershipTeamIds.length > 0
    ? await supabase
        .from("team_divisions")
        .select("team_id")
        .eq("division_id", entityId)
        .in("team_id", membershipTeamIds)
    : { data: [] };
  const divisionMembershipTeamIds = new Set((divisionMembershipResult.data || []).map((row) => row.team_id));
  const membershipAllows = memberships.some((membership) => {
    const team = Array.isArray(membership.teams) ? membership.teams[0] : membership.teams;
    const club = Array.isArray(team?.clubs) ? team.clubs[0] : team?.clubs;
    if (entityType === "team") return membership.team_id === entityId;
    if (entityType === "club") return team?.club_id === entityId;
    if (entityType === "division") {
      return team?.division_id === entityId || divisionMembershipTeamIds.has(membership.team_id);
    }
    return club?.association_id === entityId;
  });
  if (membershipAllows) return true;

  const entityScope = await loadEntityScope(entityType, entityId);
  const roleAllows = Boolean(entityScope) && roles.some((role) => {
    if (role.role === "ASSOCIATION_ADMIN") return role.association_id === entityScope?.associationId;
    if (role.role === "CLUB_ADMIN") return role.club_id === entityScope?.clubId;
    if (["COACH", "TEAM_MANAGER", "PLAYER"].includes(role.role)) return role.team_id === entityScope?.teamId;
    return false;
  });
  if (roleAllows) return true;

  if (entityType !== "team") return false;
  const now = new Date().toISOString();
  const { data: fillIn } = await supabase
    .from("fixture_fill_ins")
    .select("id")
    .eq("player_id", userId)
    .eq("team_id", entityId)
    .eq("status", "SELECTED")
    .lte("access_starts_at", now)
    .gte("access_expires_at", now)
    .limit(1)
    .maybeSingle();
  return Boolean(fillIn);
}

export async function loadOfficialEntityUpdates(scope: {
  associationId?: string | null;
  clubId?: string | null;
}) {
  const requests = [];
  if (scope.associationId) {
    requests.push(
      supabase
        .from("communication_channels")
        .select("id, association_id, club_id")
        .eq("channel_type", "ASSOCIATION_BROADCAST")
        .eq("association_id", scope.associationId)
        .maybeSingle(),
    );
  }
  if (scope.clubId) {
    requests.push(
      supabase
        .from("communication_channels")
        .select("id, association_id, club_id")
        .eq("channel_type", "CLUB_BROADCAST")
        .eq("club_id", scope.clubId)
        .maybeSingle(),
    );
  }

  const channelResults = await Promise.all(requests);
  const channels = channelResults.map((result) => result.data).filter(Boolean) as Array<{
    id: string;
    association_id: string | null;
    club_id: string | null;
  }>;
  if (channels.length === 0) return [];

  const { data } = await supabase
    .from("communication_messages")
    .select("id, channel_id, content, created_at")
    .in("channel_id", channels.map((channel) => channel.id))
    .is("removed_at", null)
    .order("created_at", { ascending: false })
    .limit(6);

  return (data || []).map((message): EntityUpdate => {
    const channel = channels.find((item) => item.id === message.channel_id);
    return {
      id: message.id,
      content: message.content,
      createdAt: message.created_at,
      scopeLabel: channel?.club_id ? "Club update" : "Association update",
    };
  });
}

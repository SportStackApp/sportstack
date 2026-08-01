import { supabase } from "@/integrations/supabase/client";
import { getCanonicalPositionGroup, type CanonicalPositionGroup } from "@/lib/playerPositions";

export interface TeamPositionOption {
  code: string;
  label: string;
  canonicalGroup: CanonicalPositionGroup | null;
}

interface FormationSummary {
  id: string;
  owner_scope: "SUPER_ADMIN" | "ASSOCIATION" | "CLUB" | "TEAM";
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
}

interface FormationPositionSummary {
  formation_id: string;
  code: string;
  name: string;
  canonical_group: CanonicalPositionGroup | null;
}

interface TeamScopeSummary {
  id: string;
  club_id: string;
  association_id: string | null;
}

interface TeamScopeQueryRow {
  id: string;
  club_id: string;
  clubs: { association_id: string } | { association_id: string }[] | null;
}

export async function loadTeamPositionOptions(
  teamIds: string[],
): Promise<Record<string, TeamPositionOption[]>> {
  const uniqueTeamIds = [...new Set(teamIds.filter(Boolean))];
  const empty = Object.fromEntries(uniqueTeamIds.map((teamId) => [teamId, [] as TeamPositionOption[]]));
  if (uniqueTeamIds.length === 0) return empty;

  const [{ data: teamRows, error: teamError }, formationsResult] = await Promise.all([
    supabase.from("teams").select("id, club_id, clubs(association_id)").in("id", uniqueTeamIds),
    supabase
    .from("formations")
    .select("id, owner_scope, association_id, club_id, team_id")
    .order("is_default", { ascending: false })
    .order("name"),
  ]);
  if (teamError) throw teamError;
  if (formationsResult.error) throw formationsResult.error;

  const formations = (formationsResult.data || []) as FormationSummary[];
  if (formations.length === 0) return empty;
  const teamScopes = new Map(
    ((teamRows || []) as TeamScopeQueryRow[]).map((team) => [team.id, {
      id: team.id,
      club_id: team.club_id,
      association_id: (Array.isArray(team.clubs) ? team.clubs[0] : team.clubs)?.association_id || null,
    } as TeamScopeSummary]),
  );

  const positionsResult = await supabase
    .from("formation_positions")
    .select("formation_id, code, name, canonical_group")
    .in("formation_id", formations.map((formation) => formation.id))
    .eq("is_starting_slot", true)
    .order("sort_order");
  if (positionsResult.error) throw positionsResult.error;

  const next = { ...empty };
  for (const position of (positionsResult.data || []) as FormationPositionSummary[]) {
    const formation = formations.find((item) => item.id === position.formation_id);
    if (!formation) continue;
    uniqueTeamIds.forEach((teamId) => {
      const scope = teamScopes.get(teamId);
      const applies = formation.owner_scope === "SUPER_ADMIN"
        || (formation.owner_scope === "ASSOCIATION" && formation.association_id === scope?.association_id)
        || (formation.owner_scope === "CLUB" && formation.club_id === scope?.club_id)
        || (formation.owner_scope === "TEAM" && formation.team_id === teamId);
      if (!applies || next[teamId]?.some((item) => item.code === position.code)) return;
      next[teamId] = [...(next[teamId] || []), {
        code: position.code,
        label: position.name,
        canonicalGroup: position.canonical_group || getCanonicalPositionGroup(position.name),
      }];
    });
  }
  return next;
}

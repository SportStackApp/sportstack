import { supabase } from "@/integrations/supabase/client";

export interface TeamPositionOption {
  code: string;
  label: string;
}

interface FormationSummary {
  id: string;
  team_id: string | null;
}

interface FormationPositionSummary {
  formation_id: string;
  code: string;
  name: string;
}

export async function loadTeamPositionOptions(
  teamIds: string[],
): Promise<Record<string, TeamPositionOption[]>> {
  const uniqueTeamIds = [...new Set(teamIds.filter(Boolean))];
  const empty = Object.fromEntries(uniqueTeamIds.map((teamId) => [teamId, [] as TeamPositionOption[]]));
  if (uniqueTeamIds.length === 0) return empty;

  const formationsResult = await supabase
    .from("formations")
    .select("id, team_id")
    .eq("owner_scope", "TEAM")
    .in("team_id", uniqueTeamIds)
    .order("is_default", { ascending: false })
    .order("name");
  if (formationsResult.error) throw formationsResult.error;

  const formations = (formationsResult.data || []) as FormationSummary[];
  if (formations.length === 0) return empty;

  const positionsResult = await supabase
    .from("formation_positions")
    .select("formation_id, code, name")
    .in("formation_id", formations.map((formation) => formation.id))
    .eq("is_starting_slot", true)
    .order("sort_order");
  if (positionsResult.error) throw positionsResult.error;

  const formationTeam = new Map(formations.map((formation) => [formation.id, formation.team_id]));
  const next = { ...empty };
  for (const position of (positionsResult.data || []) as FormationPositionSummary[]) {
    const teamId = formationTeam.get(position.formation_id);
    if (!teamId || next[teamId]?.some((item) => item.code === position.code)) continue;
    next[teamId] = [...(next[teamId] || []), { code: position.code, label: position.name }];
  }
  return next;
}

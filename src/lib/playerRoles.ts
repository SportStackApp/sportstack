import { supabase } from "@/integrations/supabase/client";

type TeamScope = {
  id: string;
  club_id: string;
  clubs: { association_id: string } | { association_id: string }[] | null;
};

const getTeamScope = async (teamId: string) => {
  const { data, error } = await supabase
    .from("teams")
    .select("id, club_id, clubs(association_id)")
    .eq("id", teamId)
    .single();

  if (error) throw error;

  const team = data as unknown as TeamScope;
  const club = Array.isArray(team.clubs) ? team.clubs[0] : team.clubs;

  if (!team.club_id || !club?.association_id) {
    throw new Error("Team scope could not be found.");
  }

  return {
    associationId: club.association_id,
    clubId: team.club_id,
  };
};

export const ensurePlayerRoleForTeam = async (userId: string, teamId: string) => {
  const { data: existingRole, error: roleCheckError } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "PLAYER")
    .eq("team_id", teamId)
    .maybeSingle();

  if (roleCheckError) throw roleCheckError;
  if (existingRole) return;

  const { associationId, clubId } = await getTeamScope(teamId);

  const { error: roleInsertError } = await supabase.from("user_roles").insert({
    user_id: userId,
    role: "PLAYER",
    association_id: associationId,
    club_id: clubId,
    team_id: teamId,
  });

  if (roleInsertError) throw roleInsertError;
};

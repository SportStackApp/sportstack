import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import EntityDashboard from "@/components/entity/EntityDashboard";
import { Button } from "@/components/ui/button";
import { calculateLadder, getTeamLadderPosition, type LadderRow } from "@/lib/ladder";
import { useAuth } from "@/contexts/AuthContext";
import { canViewEntityDashboard, loadOfficialEntityUpdates, type EntityUpdate } from "@/lib/entityDashboard";

const TeamDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState<{ name: string; logo_url: string | null; banner_url: string | null; primary_colour: string | null; secondary_colour: string | null } | null>(null);
  const [parentName, setParentName] = useState("");
  const [stats, setStats] = useState({ gamesPlayed: 0, goalsFor: 0, goalsAgainst: 0, upcomingFixtures: 0, activePlayers: 0, ladderPosition: null });
  const [upcomingGames, setUpcomingGames] = useState<any[]>([]);
  const [ladderSections, setLadderSections] = useState<{ title: string; rows: LadderRow[]; highlightTeamIds: string[] }[]>([]);
  const [updates, setUpdates] = useState<EntityUpdate[]>([]);

  const fixtureSelect =
    "id, fixture_date, status, home_score, away_score, division_id, venue_id, home_team_id, away_team_id, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name), venue:venues!venue_id(id, name), divisions:divisions!fixtures_division_id_fkey(id, name)";

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      setLoading(true);

      if (!(await canViewEntityDashboard(user.id, "team", id))) {
        navigate("/dashboard", { replace: true });
        return;
      }

      const { data: team } = await supabase
        .from("teams")
        .select("name, club_id, division_id, logo_url, banner_url, primary_colour, secondary_colour")
        .eq("id", id)
        .single();

      if (!team) { navigate("/dashboard"); return; }
      const { data: club } = await supabase
        .from("clubs")
        .select("name, association_id, banner_url, primary_colour, secondary_colour, associations(banner_url, primary_colour, secondary_colour)")
        .eq("id", team.club_id)
        .single();
      setParentName(club?.name || "");
      const association = Array.isArray(club?.associations) ? club.associations[0] : club?.associations;
      setEntity({
        name: team.name,
        logo_url: team.logo_url,
        banner_url: team.banner_url || club?.banner_url || association?.banner_url || null,
        primary_colour: team.primary_colour || club?.primary_colour || association?.primary_colour || null,
        secondary_colour: team.secondary_colour || club?.secondary_colour || association?.secondary_colour || null,
      });

      // Stats
      const { data: completed } = await supabase
        .from("fixtures")
        .select("home_team_id, away_team_id, home_score, away_score")
        .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
        .eq("status", "COMPLETED");

      const gamesPlayed = completed?.length || 0;
      const goalsFor = (completed || []).reduce((sum, g) => {
        return sum + (g.home_team_id === id ? (g.home_score || 0) : (g.away_score || 0));
      }, 0);
      const goalsAgainst = (completed || []).reduce((sum, g) => {
        return sum + (g.home_team_id === id ? (g.away_score || 0) : (g.home_score || 0));
      }, 0);
      let ladderPosition: number | null = null;
      let teamLadderSections: { title: string; rows: LadderRow[]; highlightTeamIds: string[] }[] = [];
      if ((team as any).division_id) {
        const [{ data: division }, { data: divisionTeams }, { data: ladderFixtures }] = await Promise.all([
          (supabase.from("divisions" as any).select("id, name").eq("id", (team as any).division_id).single() as any),
          supabase.from("teams").select("id, name, club_id, division_id").eq("division_id", (team as any).division_id),
          supabase.from("fixtures").select("id, home_team_id, away_team_id, home_score, away_score, status, fixture_date, division_id").eq("division_id", (team as any).division_id).eq("status", "COMPLETED"),
        ]);
        const ladder = calculateLadder(divisionTeams || [], ladderFixtures || []);
        ladderPosition = getTeamLadderPosition(ladder, id);
        teamLadderSections = [{ title: division?.name || "Division ladder", rows: ladder, highlightTeamIds: [id] }];
      }
      setStats({ gamesPlayed, goalsFor, goalsAgainst, upcomingFixtures: 0, activePlayers: 0, ladderPosition });
      setLadderSections(teamLadderSections);

      // Upcoming
      const { data: upcoming } = await supabase
        .from("fixtures")
        .select(fixtureSelect)
        .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
        .eq("status", "SCHEDULED")
        .gte("fixture_date", new Date().toISOString())
        .order("fixture_date", { ascending: true })
        .limit(12);

      setUpcomingGames(upcoming || []);
      const [{ count: activePlayers }, entityUpdates] = await Promise.all([
        supabase
          .from("team_memberships")
          .select("id", { count: "exact", head: true })
          .eq("team_id", id)
          .eq("status", "ACTIVE"),
        loadOfficialEntityUpdates({ associationId: club?.association_id, clubId: team.club_id }),
      ]);
      setStats((current) => ({
        ...current,
        upcomingFixtures: upcoming?.length || 0,
        activePlayers: activePlayers || 0,
      }));
      setUpdates(entityUpdates);
      setLoading(false);
    };
    load();
  }, [id, navigate, user]);

  return (
    <div className="space-y-4">
      <EntityDashboard
        entityName={entity?.name || ""}
        entityType="team"
        logoUrl={entity?.logo_url}
        bannerUrl={entity?.banner_url}
        primaryColour={entity?.primary_colour}
        secondaryColour={entity?.secondary_colour}
        parentName={parentName}
        stats={stats}
        upcomingGames={upcomingGames}
        ladderSections={ladderSections}
        updates={updates}
        loading={loading}
      />
    </div>
  );
};

export default TeamDashboard;

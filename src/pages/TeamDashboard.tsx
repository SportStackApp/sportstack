import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import EntityDashboard from "@/components/entity/EntityDashboard";
import { Button } from "@/components/ui/button";
import { calculateLadder, getTeamLadderPosition, type LadderRow } from "@/lib/ladder";

const TeamDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entityName, setEntityName] = useState("");
  const [parentName, setParentName] = useState("");
  const [stats, setStats] = useState({ gamesPlayed: 0, goalsFor: 0, goalsAgainst: 0, ladderPosition: null });
  const [upcomingGames, setUpcomingGames] = useState<any[]>([]);
  const [ladderSections, setLadderSections] = useState<{ title: string; rows: LadderRow[]; highlightTeamIds: string[] }[]>([]);

  const fixtureSelect =
    "id, fixture_date, status, home_score, away_score, division_id, venue_id, home_team_id, away_team_id, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name), venue:venues!venue_id(id, name), divisions:divisions!fixtures_division_id_fkey(id, name)";

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);

      const { data: team } = await supabase
        .from("teams")
        .select("name, club_id, division_id")
        .eq("id", id)
        .single();

      if (!team) { navigate("/dashboard"); return; }
      setEntityName(team.name);

      const { data: club } = await supabase
        .from("clubs")
        .select("name")
        .eq("id", team.club_id)
        .single();
      setParentName(club?.name || "");

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
      setStats({ gamesPlayed, goalsFor, goalsAgainst, ladderPosition });
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
      setLoading(false);
    };
    load();
  }, [id, navigate]);

  return (
    <div className="space-y-4">
      <EntityDashboard
        entityName={entityName}
        entityType="team"
        parentName={parentName}
        stats={stats}
        upcomingGames={upcomingGames}
        ladderSections={ladderSections}
        loading={loading}
      />
    </div>
  );
};

export default TeamDashboard;

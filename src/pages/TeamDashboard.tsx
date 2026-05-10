import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import EntityDashboard from "@/components/entity/EntityDashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const TeamDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entityName, setEntityName] = useState("");
  const [parentName, setParentName] = useState("");
  const [stats, setStats] = useState({ gamesPlayed: 0, goalsScored: 0 });
  const [upcomingGames, setUpcomingGames] = useState<any[]>([]);

  const fixtureSelect =
    "id, fixture_date, status, home_score, away_score, venue_id, home_team_id, away_team_id, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name), venue:venues!venue_id(id, name)";

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);

      const { data: team } = await supabase
        .from("teams")
        .select("name, club_id")
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
        .eq("status", "completed");

      const gamesPlayed = completed?.length || 0;
      const goalsScored = (completed || []).reduce((sum, g) => {
        return sum + (g.home_team_id === id ? (g.home_score || 0) : (g.away_score || 0));
      }, 0);
      setStats({ gamesPlayed, goalsScored });

      // Upcoming
      const { data: upcoming } = await supabase
        .from("fixtures")
        .select(fixtureSelect)
        .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
        .eq("status", "scheduled")
        .gte("fixture_date", new Date().toISOString())
        .order("fixture_date", { ascending: true })
        .limit(5);

      setUpcomingGames(upcoming || []);
      setLoading(false);
    };
    load();
  }, [id, navigate]);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <EntityDashboard
        entityName={entityName}
        entityType="team"
        parentName={parentName}
        stats={stats}
        upcomingGames={upcomingGames}
        loading={loading}
      />
    </div>
  );
};

export default TeamDashboard;

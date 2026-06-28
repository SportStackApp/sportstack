import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import EntityDashboard from "@/components/entity/EntityDashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { calculateLadder, type LadderRow } from "@/lib/ladder";

const AssociationDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState<{ name: string; logo_url: string | null; abbreviation: string | null } | null>(null);
  const [stats, setStats] = useState({ gamesPlayed: 0, goalsFor: 0, goalsAgainst: 0, ladderPosition: null });
  const [upcomingGames, setUpcomingGames] = useState<any[]>([]);
  const [ladderSections, setLadderSections] = useState<{ title: string; rows: LadderRow[] }[]>([]);

  const fixtureSelect =
    "id, fixture_date, status, home_score, away_score, division_id, venue_id, home_team_id, away_team_id, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name), venue:venues!venue_id(id, name), divisions:divisions!fixtures_division_id_fkey(id, name)";

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);

      // Fetch association
      const { data: assoc } = await supabase
        .from("associations")
        .select("name, logo_url, abbreviation")
        .eq("id", id)
        .single();

      if (!assoc) { navigate("/admin"); return; }
      setEntity(assoc);

      // Get all teams under this association
      const { data: clubs } = await supabase.from("clubs").select("id").eq("association_id", id);
      const clubIds = clubs?.map((c) => c.id) || [];

      if (clubIds.length === 0) {
        setStats({ gamesPlayed: 0, goalsFor: 0, goalsAgainst: 0, ladderPosition: null });
        setUpcomingGames([]);
        setLadderSections([]);
        setLoading(false);
        return;
      }

      const [{ data: teams }, { data: divisions }] = await Promise.all([
        supabase.from("teams").select("id, name, club_id, division_id").in("club_id", clubIds),
        (supabase.from("divisions" as any).select("id, name").eq("association_id", id) as any),
      ]);
      const teamIds = teams?.map((t) => t.id) || [];

      if (teamIds.length === 0) {
        setStats({ gamesPlayed: 0, goalsFor: 0, goalsAgainst: 0, ladderPosition: null });
        setUpcomingGames([]);
        setLadderSections([]);
        setLoading(false);
        return;
      }

      // Completed games for stats
      const { data: completed } = await supabase
        .from("fixtures")
        .select("id, home_team_id, away_team_id, home_score, away_score")
        .or(`home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`)
        .eq("status", "COMPLETED");

      const gamesPlayed = completed?.length || 0;
      const teamIdSet = new Set(teamIds);
      const goalsFor = (completed || []).reduce((sum, g) => {
        const homeGoals = teamIdSet.has(g.home_team_id) ? (g.home_score || 0) : 0;
        const awayGoals = teamIdSet.has(g.away_team_id) ? (g.away_score || 0) : 0;
        return sum + homeGoals + awayGoals;
      }, 0);
      const goalsAgainst = (completed || []).reduce((sum, g) => {
        const homeAgainst = teamIdSet.has(g.home_team_id) ? (g.away_score || 0) : 0;
        const awayAgainst = teamIdSet.has(g.away_team_id) ? (g.home_score || 0) : 0;
        return sum + homeAgainst + awayAgainst;
      }, 0);
      setStats({ gamesPlayed, goalsFor, goalsAgainst, ladderPosition: null });

      const { data: ladderFixtures } = await supabase
        .from("fixtures")
        .select("id, home_team_id, away_team_id, home_score, away_score, status, fixture_date, division_id")
        .or(`home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`)
        .eq("status", "COMPLETED");

      const sections = ((divisions || []) as any[])
        .map((division) => {
          const divisionTeams = (teams || []).filter((team: any) => team.division_id === division.id);
          if (divisionTeams.length === 0) return null;
          return {
            title: division.name,
            rows: calculateLadder(divisionTeams, (ladderFixtures || []).filter((fixture: any) => fixture.division_id === division.id)),
          };
        })
        .filter(Boolean) as { title: string; rows: LadderRow[] }[];
      setLadderSections(sections);

      // Upcoming games
      const { data: upcoming } = await supabase
        .from("fixtures")
        .select(fixtureSelect)
        .or(`home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`)
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
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <EntityDashboard
        entityName={entity?.name || ""}
        entityType="association"
        logoUrl={entity?.logo_url}
        abbreviation={entity?.abbreviation}
        stats={stats}
        upcomingGames={upcomingGames}
        ladderSections={ladderSections}
        loading={loading}
      />
    </div>
  );
};

export default AssociationDashboard;

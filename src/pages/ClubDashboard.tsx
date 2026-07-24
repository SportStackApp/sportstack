import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import EntityDashboard from "@/components/entity/EntityDashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { calculateLadder, type LadderRow } from "@/lib/ladder";
import { useAuth } from "@/contexts/AuthContext";
import { canViewEntityDashboard, loadOfficialEntityUpdates, type EntityUpdate } from "@/lib/entityDashboard";

const ClubDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState<{ name: string; logo_url: string | null; abbreviation: string | null; banner_url: string | null; primary_colour: string | null; secondary_colour: string | null } | null>(null);
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

      if (!(await canViewEntityDashboard(user.id, "club", id))) {
        navigate("/dashboard", { replace: true });
        return;
      }

      const { data: club } = await supabase
        .from("clubs")
        .select("name, logo_url, abbreviation, association_id, banner_url, primary_colour, secondary_colour")
        .eq("id", id)
        .single();

      if (!club) { navigate("/admin"); return; }
      // Parent association name
      const { data: assoc } = await supabase
        .from("associations")
        .select("name, banner_url, primary_colour, secondary_colour")
        .eq("id", club.association_id)
        .single();
      setParentName(assoc?.name || "");
      setEntity({
        ...club,
        banner_url: club.banner_url || assoc?.banner_url || null,
        primary_colour: club.primary_colour || assoc?.primary_colour || null,
        secondary_colour: club.secondary_colour || assoc?.secondary_colour || null,
      });

      // Teams for this club
      const { data: teams } = await supabase.from("teams").select("id, name, club_id, division_id").eq("club_id", id);
      const teamIds = teams?.map((t) => t.id) || [];

      if (teamIds.length === 0) {
        setStats({ gamesPlayed: 0, goalsFor: 0, goalsAgainst: 0, upcomingFixtures: 0, activePlayers: 0, ladderPosition: null });
        setUpcomingGames([]);
        setLadderSections([]);
        setLoading(false);
        return;
      }

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
      setStats({ gamesPlayed, goalsFor, goalsAgainst, upcomingFixtures: 0, activePlayers: 0, ladderPosition: null });

      const divisionIds = Array.from(new Set((teams || []).map((team: any) => team.division_id).filter(Boolean)));
      const [{ data: divisionRows }, { data: divisionTeams }, { data: ladderFixtures }] = await Promise.all([
        divisionIds.length > 0 ? (supabase.from("divisions" as any).select("id, name").in("id", divisionIds) as any) : Promise.resolve({ data: [] }),
        divisionIds.length > 0 ? supabase.from("teams").select("id, name, club_id, division_id").in("division_id", divisionIds) : Promise.resolve({ data: [] }),
        divisionIds.length > 0 ? supabase.from("fixtures").select("id, home_team_id, away_team_id, home_score, away_score, status, fixture_date, division_id").in("division_id", divisionIds).eq("status", "COMPLETED") : Promise.resolve({ data: [] }),
      ]);

      const sections = ((divisionRows || []) as any[]).map((division) => ({
        title: division.name,
        rows: calculateLadder(
          ((divisionTeams || []) as any[]).filter((team) => team.division_id === division.id),
          ((ladderFixtures || []) as any[]).filter((fixture) => fixture.division_id === division.id)
        ),
        highlightTeamIds: teamIds,
      }));
      setLadderSections(sections);

      const { data: upcoming } = await supabase
        .from("fixtures")
        .select(fixtureSelect)
        .or(`home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`)
        .eq("status", "SCHEDULED")
        .gte("fixture_date", new Date().toISOString())
        .order("fixture_date", { ascending: true })
        .limit(12);

      setUpcomingGames(upcoming || []);
      const [{ data: activeMemberships }, entityUpdates] = await Promise.all([
        supabase
          .from("team_memberships")
          .select("user_id")
          .in("team_id", teamIds)
          .eq("status", "ACTIVE"),
        loadOfficialEntityUpdates({ associationId: club.association_id, clubId: id }),
      ]);
      setStats((current) => ({
        ...current,
        upcomingFixtures: upcoming?.length || 0,
        activePlayers: new Set((activeMemberships || []).map((membership) => membership.user_id)).size,
      }));
      setUpdates(entityUpdates);
      setLoading(false);
    };
    load();
  }, [id, navigate, user]);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <EntityDashboard
        entityName={entity?.name || ""}
        entityType="club"
        logoUrl={entity?.logo_url}
        bannerUrl={entity?.banner_url}
        primaryColour={entity?.primary_colour}
        secondaryColour={entity?.secondary_colour}
        abbreviation={entity?.abbreviation}
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

export default ClubDashboard;

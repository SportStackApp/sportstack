import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import EntityDashboard from "@/components/entity/EntityDashboard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTeamContext } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import { canViewEntityDashboard, loadOfficialEntityUpdates, type EntityUpdate } from "@/lib/entityDashboard";
import { calculateLadder, type LadderRow, type LadderTeam } from "@/lib/ladder";

interface DivisionDetails {
  id: string;
  name: string;
  association_id: string;
}

interface AssociationBranding {
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_colour: string | null;
  secondary_colour: string | null;
}

interface FixtureSummary {
  id: string;
  fixture_date: string;
  status: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  home_team: { id: string; name: string } | null;
  away_team: { id: string; name: string } | null;
  venue: { id: string; name: string } | null;
}

const EMPTY_STATS = {
  gamesPlayed: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  upcomingFixtures: 0,
  activePlayers: 0,
  ladderPosition: null,
};

const DivisionDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedDivision } = useTeamContext();
  const divisionId = id || selectedDivision;
  const [loading, setLoading] = useState(true);
  const [division, setDivision] = useState<DivisionDetails | null>(null);
  const [association, setAssociation] = useState<AssociationBranding | null>(null);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [upcomingGames, setUpcomingGames] = useState<Array<FixtureSummary & { divisions: { id: string; name: string } }>>([]);
  const [ladder, setLadder] = useState<LadderRow[]>([]);
  const [updates, setUpdates] = useState<EntityUpdate[]>([]);

  useEffect(() => {
    if (!divisionId || !user) {
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      const canView = await canViewEntityDashboard(user.id, "division", divisionId);
      if (!active) return;
      if (!canView) {
        navigate("/dashboard", { replace: true });
        return;
      }

      const { data: divisionData } = await supabase
        .from("divisions")
        .select("id, name, association_id")
        .eq("id", divisionId)
        .maybeSingle();
      if (!divisionData || !active) {
        navigate("/dashboard", { replace: true });
        return;
      }

      const [{ data: associationData }, { data: directTeams }, { data: teamDivisionRows }] = await Promise.all([
        supabase
          .from("associations")
          .select("name, abbreviation, logo_url, banner_url, primary_colour, secondary_colour")
          .eq("id", divisionData.association_id)
          .maybeSingle(),
        supabase.from("teams").select("id, name, club_id").eq("division_id", divisionId),
        supabase.from("team_divisions").select("team_id").eq("division_id", divisionId),
      ]);

      const mappedTeamIds = (teamDivisionRows || []).map((row) => row.team_id);
      const { data: mappedTeams } = mappedTeamIds.length > 0
        ? await supabase.from("teams").select("id, name, club_id").in("id", mappedTeamIds)
        : { data: [] };
      const teams = [...(directTeams || []), ...(mappedTeams || [])]
        .filter((team, index, all) => all.findIndex((item) => item.id === team.id) === index) as LadderTeam[];
      const teamIds = teams.map((team) => team.id);

      if (!active) return;
      setDivision(divisionData);
      setAssociation(associationData);

      if (teamIds.length === 0) {
        const entityUpdates = await loadOfficialEntityUpdates({ associationId: divisionData.association_id });
        if (!active) return;
        setStats(EMPTY_STATS);
        setUpcomingGames([]);
        setLadder([]);
        setUpdates(entityUpdates);
        setLoading(false);
        return;
      }

      const fixtureSelect = "id, fixture_date, status, home_team_id, away_team_id, home_score, away_score, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name), venue:venues!venue_id(id, name)";
      const teamFilter = `home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`;
      const [completedResult, upcomingResult, membershipsResult, entityUpdates] = await Promise.all([
        supabase
          .from("fixtures")
          .select("id, fixture_date, status, home_team_id, away_team_id, home_score, away_score")
          .or(teamFilter)
          .eq("status", "COMPLETED"),
        supabase
          .from("fixtures")
          .select(fixtureSelect, { count: "exact" })
          .or(teamFilter)
          .eq("status", "SCHEDULED")
          .gte("fixture_date", new Date().toISOString())
          .order("fixture_date", { ascending: true })
          .limit(12),
        supabase
          .from("team_memberships")
          .select("user_id")
          .in("team_id", teamIds)
          .eq("status", "ACTIVE"),
        loadOfficialEntityUpdates({ associationId: divisionData.association_id }),
      ]);

      if (!active) return;
      const completed = completedResult.data || [];
      const teamIdSet = new Set(teamIds);
      const goalsFor = completed.reduce((sum, fixture) => {
        const home = teamIdSet.has(fixture.home_team_id || "") ? fixture.home_score || 0 : 0;
        const away = teamIdSet.has(fixture.away_team_id || "") ? fixture.away_score || 0 : 0;
        return sum + home + away;
      }, 0);
      const goalsAgainst = completed.reduce((sum, fixture) => {
        const home = teamIdSet.has(fixture.home_team_id || "") ? fixture.away_score || 0 : 0;
        const away = teamIdSet.has(fixture.away_team_id || "") ? fixture.home_score || 0 : 0;
        return sum + home + away;
      }, 0);
      const upcoming = ((upcomingResult.data || []) as FixtureSummary[]).map((fixture) => ({
        ...fixture,
        divisions: { id: divisionData.id, name: divisionData.name },
      }));

      setStats({
        gamesPlayed: completed.length,
        goalsFor,
        goalsAgainst,
        upcomingFixtures: upcomingResult.count || 0,
        activePlayers: new Set((membershipsResult.data || []).map((membership) => membership.user_id)).size,
        ladderPosition: null,
      });
      setUpcomingGames(upcoming);
      setLadder(calculateLadder(teams, completed));
      setUpdates(entityUpdates);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [divisionId, navigate, user]);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <EntityDashboard
        entityName={division?.name || "Division"}
        entityType="division"
        logoUrl={association?.logo_url}
        bannerUrl={association?.banner_url}
        primaryColour={association?.primary_colour}
        secondaryColour={association?.secondary_colour}
        abbreviation={association?.abbreviation}
        parentName={association?.name}
        stats={stats}
        upcomingGames={upcomingGames}
        ladderSections={ladder.length > 0 ? [{ title: division?.name || "Division", rows: ladder }] : []}
        updates={updates}
        loading={loading}
      />
    </div>
  );
};

export default DivisionDashboard;

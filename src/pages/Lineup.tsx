import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Calendar, Clock } from "lucide-react";
import { LineupView } from "@/components/lineup/LineupView";
import { useState, useEffect } from "react";
import { cn, getTeamDisplayName } from "@/lib/utils";
import { useTeamContext } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getLineupAccess, type LineupAccess } from "@/lib/lineupAccess";

interface GameRow {
  id: string;
  fixture_date: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
  venue_id: string | null;
  home_team: { id: string; name: string } | null;
  away_team: { id: string; name: string } | null;
  venue: { id: string; name: string } | null;
}

const FIXTURE_SELECT =
  "id, fixture_date, status, venue_id, home_team_id, away_team_id, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name), venue:venues!venue_id(id, name)";

const Lineup = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { selectedTeam } = useTeamContext();
  const [game, setGame] = useState<GameRow | null>(null);
  const [access, setAccess] = useState<LineupAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCoachView, setIsCoachView] = useState(false);
  const [lineupTeamId, setLineupTeamId] = useState<string | null>(null);

  useEffect(() => {
    const fetchGame = async () => {
      if (!id) return;
      setLoading(true);
      const { data } = await supabase.from("fixtures").select(FIXTURE_SELECT).eq("id", id).single();
      const fixture = (data as GameRow) || null;
      setGame(fixture);
      if (fixture) {
        const accessResult = await getLineupAccess(user?.id, fixture);
        const preferredTeamId =
          selectedTeam?.id && accessResult.visibleTeamIds.includes(selectedTeam.id)
            ? selectedTeam.id
            : accessResult.visibleTeamIds[0] || fixture.home_team_id;
        setAccess(accessResult);
        setLineupTeamId(preferredTeamId);
        setIsCoachView(accessResult.editableTeamIds.includes(preferredTeamId));
      } else {
        setAccess(null);
        setLineupTeamId(null);
      }
      setLoading(false);
    };
    fetchGame();
  }, [id, selectedTeam?.id, user?.id]);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Game not found</p>
        <Link to="/games">
          <Button variant="link">Back to games</Button>
        </Link>
      </div>
    );
  }

  if (!access?.canView) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Link to={`/games/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to Game
          </Button>
        </Link>
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="font-semibold text-foreground">You do not have access to this line-up.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Line-ups are only available to players, coaches, managers, and admins linked to this fixture.
          </p>
        </div>
      </div>
    );
  }

  const homeTeam = game.home_team?.name ?? "Unknown";
  const awayTeam = game.away_team?.name ?? "Unknown";
  const fallbackTeamId = access.visibleTeamIds[0] || game.home_team_id;
  const activeLineupTeamId = lineupTeamId && access.visibleTeamIds.includes(lineupTeamId) ? lineupTeamId : fallbackTeamId;
  const isEditableLineup = access.editableTeamIds.includes(activeLineupTeamId);
  const teamName = selectedTeam?.id === activeLineupTeamId ? getTeamDisplayName(selectedTeam) : activeLineupTeamId === game.away_team_id ? awayTeam : homeTeam;
  const opponentName = activeLineupTeamId === game.away_team_id ? homeTeam : awayTeam;
  const gameDate = new Date(game.fixture_date);
  const changeLineupTeam = (teamId: string) => {
    setLineupTeamId(teamId);
    setIsCoachView(access.editableTeamIds.includes(teamId));
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <Link to={`/games/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to Game
          </Button>
        </Link>
        
        {access.canEdit && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">View as:</span>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setIsCoachView(true)}
              disabled={!isEditableLineup}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                isCoachView ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              Coach
            </button>
            <button
              onClick={() => setIsCoachView(false)}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                !isCoachView ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              Player
            </button>
          </div>
        </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 p-3">
        <div>
          <p className="font-semibold text-sm">
            {homeTeam} vs {awayTeam}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {gameDate.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {gameDate.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {access.visibleTeamIds.length > 1 && (
            <Select value={activeLineupTeamId} onValueChange={changeLineupTeam}>
              <SelectTrigger className="w-48" aria-label="Line-up team">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {access.visibleTeamIds.map((teamId) => (
                  <SelectItem key={teamId} value={teamId}>
                    {teamId === game.away_team_id ? awayTeam : homeTeam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Badge variant="default">{game.status}</Badge>
        </div>
      </div>

      <LineupView
        gameId={game.id}
        fixtureDate={game.fixture_date}
        teamId={activeLineupTeamId}
        teamName={teamName}
        opponentName={opponentName}
        isCoach={isCoachView && isEditableLineup}
      />

      {isCoachView && isEditableLineup && (
        <div className="text-center text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">
          <p className="mb-1 font-medium">Line-up instructions</p>
          <p>On mobile, tap a position and then tap Add beside a player. On desktop, you can also drag players between positions and the bench.</p>
        </div>
      )}
    </div>
  );
};

export default Lineup;

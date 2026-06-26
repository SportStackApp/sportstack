import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Calendar, Clock } from "lucide-react";
import { LineupView } from "@/components/lineup/LineupView";
import { useState, useEffect } from "react";
import { cn, getTeamDisplayName } from "@/lib/utils";
import { useTeamContext } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";

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
  const { selectedTeam } = useTeamContext();
  const [game, setGame] = useState<GameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCoachView, setIsCoachView] = useState(true);

  useEffect(() => {
    const fetchGame = async () => {
      if (!id) return;
      setLoading(true);
      const { data } = await supabase.from("fixtures").select(FIXTURE_SELECT).eq("id", id).single();
      setGame((data as GameRow) || null);
      setLoading(false);
    };
    fetchGame();
  }, [id]);

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

  const homeTeam = game.home_team?.name ?? "Unknown";
  const awayTeam = game.away_team?.name ?? "Unknown";
  const lineupTeamId =
    selectedTeam?.id === game.home_team_id || selectedTeam?.id === game.away_team_id
      ? selectedTeam.id
      : game.home_team_id;
  const teamName = selectedTeam ? getTeamDisplayName(selectedTeam) : homeTeam;
  const opponentName = lineupTeamId === game.away_team_id ? homeTeam : awayTeam;
  const gameDate = new Date(game.fixture_date);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <Link to={`/games/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to Game
          </Button>
        </Link>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">View as:</span>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setIsCoachView(true)}
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
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
        <div>
          <p className="font-semibold text-sm">
            {homeTeam} vs {awayTeam}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {gameDate.toLocaleDateString("en-AU", { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {gameDate.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
        <Badge variant="default">{game.status}</Badge>
      </div>

      <LineupView
        gameId={game.id}
        teamId={lineupTeamId}
        teamName={teamName}
        opponentName={opponentName}
        isCoach={isCoachView}
      />

      {isCoachView && (
        <div className="text-center text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">
          <p className="font-medium mb-1">Drag & Drop Instructions</p>
          <p>Drag players from the bench onto positions, or swap players by dragging between positions.</p>
        </div>
      )}
    </div>
  );
};

export default Lineup;

import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  MapPin,
  Clock,
  ChevronRight,
  CalendarDays,
  List,
  Download,
} from "lucide-react";
import { cn, getTeamDisplayName } from "@/lib/utils";
import { useTeamContext } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

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
  home_score: number | null;
  away_score: number | null;
  notes: string | null;
  round_number: number | null;
  season_id: string | null;
}

const FIXTURE_SELECT =
  "id, fixture_date, status, home_score, away_score, notes, round_number, season_id, venue_id, home_team_id, away_team_id, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name), venue:venues!venue_id(id, name)";

interface Season {
  id: string;
  name: string;
  association_id: string;
  is_active: boolean;
}

const Games = () => {
  const { selectedTeamId, selectedClub, selectedTeam, selectedAssociationId } = useTeamContext();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("all");

  // Fetch seasons for the association
  useEffect(() => {
    const fetchSeasons = async () => {
      if (!selectedAssociationId) {
        setSeasons([]);
        return;
      }
      const { data } = await supabase
        .from("seasons")
        .select("id, name, association_id, is_active")
        .eq("association_id", selectedAssociationId)
        .order("start_date", { ascending: false });
      const s = (data as Season[]) || [];
      setSeasons(s);
      // Default to active season if exists
      const active = s.find((x) => x.is_active);
      setSelectedSeasonId(active ? active.id : "all");
    };
    fetchSeasons();
  }, [selectedAssociationId]);

  useEffect(() => {
    const fetchGames = async () => {
      if (!selectedTeamId) {
        setGames([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      let query = (supabase
        .from("fixtures" as any)
        .select(FIXTURE_SELECT) as any)
        .or(`home_team_id.eq.${selectedTeamId},away_team_id.eq.${selectedTeamId}`)
        .order("fixture_date", { ascending: true });

      if (selectedSeasonId && selectedSeasonId !== "all") {
        query = query.eq("season_id", selectedSeasonId);
      }

      const { data } = await query;
      setGames((data as GameRow[]) || []);
      setLoading(false);
    };
    fetchGames();
  }, [selectedTeamId, selectedSeasonId]);

  const now = new Date();
  const upcomingGames = games.filter((g) => new Date(g.fixture_date) >= now);
  const pastGames = games.filter((g) => new Date(g.fixture_date) < now);

  const teamName = selectedTeam ? getTeamDisplayName(selectedTeam) : "Team";
  const clubName = selectedClub?.name || "";

  const handleExport = () => {
    if (games.length === 0) return;

    const rows = games.map((g) => {
      const d = new Date(g.fixture_date);
      return {
        Round: g.round_number ?? "",
        Date: d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }),
        Day: d.toLocaleDateString("en-AU", { weekday: "short" }),
        Time: d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }),
        "Home Team": g.home_team?.name ?? "Unknown",
        "Away Team": g.away_team?.name ?? "Unknown",
        Venue: g.venue?.name ?? "TBD",
        Status: g.status,
        "Home Score": g.home_score ?? "",
        "Away Score": g.away_score ?? "",
        Notes: g.notes || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fixtures");
    const safeName = teamName.replace(/[^a-zA-Z0-9]/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `fixtures-${safeName}-${dateStr}.xlsx`);

    toast({ title: "Fixtures exported", description: `${games.length} games exported to XLSX.` });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-foreground">
            FIXTURES
          </h1>
          <p className="text-muted-foreground mt-1">
            {teamName} {clubName && `• ${clubName}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Season filter */}
          {seasons.length > 0 && (
            <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Seasons</SelectItem>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "calendar" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setViewMode("calendar")}
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleExport}
            disabled={games.length === 0}
            title="Export fixtures to XLSX"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingGames.length})
            </TabsTrigger>
            <TabsTrigger value="past">Past ({pastGames.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4">
            {upcomingGames.length === 0 ? (
              <EmptyState message="No upcoming games scheduled." />
            ) : (
              <div className="space-y-3">
                {upcomingGames.map((game, index) => (
                  <GameCard key={game.id} game={game} index={index} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-4">
            {pastGames.length === 0 ? (
              <EmptyState message="No past games yet." />
            ) : (
              <div className="space-y-3">
                {pastGames.map((game, index) => (
                  <GameCard key={game.id} game={game} index={index} isPast />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

interface GameCardProps {
  game: GameRow;
  index: number;
  isPast?: boolean;
}

const GameCard = ({ game, index, isPast }: GameCardProps) => {
  const homeTeam = game.home_team?.name ?? "Unknown";
  const awayTeam = game.away_team?.name ?? "Unknown";
  const venueName = game.venue?.name ?? "TBD";
  const gameDate = new Date(game.fixture_date);

  return (
    <Link to={`/games/${game.id}`}>
      <Card
        variant="game"
        className={cn("animate-slide-up", isPast && "opacity-75")}
        style={{ animationDelay: `${index * 0.05}s` }}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="text-center min-w-[55px] py-1">
                <p className="text-xs text-muted-foreground uppercase">
                  {gameDate.toLocaleDateString("en-AU", { weekday: "short" })}
                </p>
                <p className="font-display text-2xl text-foreground">
                  {gameDate.getDate()}
                </p>
                <p className="text-xs text-muted-foreground uppercase">
                  {gameDate.toLocaleDateString("en-AU", { month: "short" })}
                </p>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {game.round_number !== null && game.round_number !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      Rd {game.round_number}
                    </Badge>
                  )}
                  {isPast && game.status === "finalised" && (
                    <Badge variant="finalised" className="text-xs">
                      Finalised
                    </Badge>
                  )}
                </div>

                <p className="font-semibold text-foreground truncate">
                  {homeTeam} vs {awayTeam}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {gameDate.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{venueName}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {isPast && game.home_score !== null && game.away_score !== null && (
                <Badge variant="secondary" className="text-sm font-bold">
                  {game.home_score} - {game.away_score}
                </Badge>
              )}
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <Card variant="ghost" className="text-center py-12">
    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
    <p className="text-muted-foreground">{message}</p>
  </Card>
);

export default Games;

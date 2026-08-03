import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedTeamId, selectedClub, selectedTeam, selectedAssociationId } = useTeamContext();
  const [viewMode, setViewMode] = useState<"list" | "calendar">(searchParams.get("view") === "calendar" ? "calendar" : "list");
  const [fixtureTab, setFixtureTab] = useState<"upcoming" | "past">(searchParams.get("tab") === "past" ? "past" : "upcoming");
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(searchParams.get("season") || "all");

  const updateUrlState = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => next.set(key, value));
    setSearchParams(next, { replace: true });
  };

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
      const requestedSeason = searchParams.get("season");
      const active = s.find((x) => x.is_active);
      const nextSeason = requestedSeason && s.some((season) => season.id === requestedSeason)
        ? requestedSeason
        : active?.id || "all";
      setSelectedSeasonId(nextSeason);
    };
    fetchSeasons();
  }, [selectedAssociationId, searchParams]);

  useEffect(() => {
    const fetchGames = async () => {
      if (!selectedTeamId) {
        setGames([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      let query = (supabase
        // The live fixtures relation includes joined fields not yet present in generated types.
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
            <Select value={selectedSeasonId} onValueChange={(value) => { setSelectedSeasonId(value); updateUrlState({ season: value }); }}>
              <SelectTrigger className="w-[250px] max-w-full">
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
            onClick={() => { setViewMode("list"); updateUrlState({ view: "list" }); }}
            title="List view"
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "calendar" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => { setViewMode("calendar"); updateUrlState({ view: "calendar" }); }}
            title="Calendar view"
            aria-label="Calendar view"
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
        <Tabs value={fixtureTab} onValueChange={(value) => { const next = value as "upcoming" | "past"; setFixtureTab(next); updateUrlState({ tab: next }); }} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingGames.length})
            </TabsTrigger>
            <TabsTrigger value="past">Past ({pastGames.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4">
            {upcomingGames.length === 0 ? (
              <EmptyState message="No upcoming games scheduled." />
            ) : viewMode === "calendar" ? (
              <FixtureCalendarView games={upcomingGames} />
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
            ) : viewMode === "calendar" ? (
              <FixtureCalendarView games={pastGames} isPast />
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

const FixtureCalendarView = ({ games, isPast = false }: { games: GameRow[]; isPast?: boolean }) => {
  const months = useMemo(() => {
    const grouped = new Map<string, { month: Date; games: GameRow[] }>();

    games.forEach((game) => {
      const date = new Date(game.fixture_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const group = grouped.get(key) || {
        month: new Date(date.getFullYear(), date.getMonth(), 1),
        games: [],
      };
      group.games.push(game);
      grouped.set(key, group);
    });

    return Array.from(grouped.values()).sort((a, b) => a.month.getTime() - b.month.getTime());
  }, [games]);

  return (
    <div className="space-y-4">
      {months.map(({ month, games: monthGames }) => {
        const leadingDays = (month.getDay() + 6) % 7;
        const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

        return (
          <Card key={month.toISOString()}>
            <CardContent className="p-4">
              <h2 className="mb-3 font-display text-xl text-foreground">
                {month.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
              </h2>
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  <div className="grid grid-cols-7 gap-px overflow-hidden rounded-t-lg border bg-border">
                    {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((day) => (
                      <div key={day} className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-px overflow-hidden rounded-b-lg border border-t-0 bg-border">
                    {Array.from({ length: leadingDays }, (_, index) => (
                      <div key={`leading-${index}`} className="min-h-28 bg-muted/30" aria-hidden="true" />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, index) => {
                      const day = index + 1;
                      const dayGames = monthGames.filter((game) => new Date(game.fixture_date).getDate() === day);

                      return (
                        <div key={day} className="min-h-28 bg-background p-1.5">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">{day}</p>
                          <div className="space-y-1">
                            {dayGames.map((game) => {
                              const isBye = !game.home_team || !game.away_team;
                              const knownTeam = game.home_team?.name || game.away_team?.name || "Team";
                              const matchup = isBye
                                ? `${knownTeam} — Bye`
                                : `${game.home_team?.name} vs ${game.away_team?.name}`;

                              return (
                                <Link
                                  key={game.id}
                                  to={`/games/${game.id}`}
                                  className={cn(
                                    "block rounded-md border bg-primary/5 p-1.5 text-[11px] transition-colors hover:bg-primary/10",
                                    isPast && "opacity-75",
                                  )}
                                >
                                  {game.round_number !== null && game.round_number !== undefined && (
                                    <p className="font-medium text-primary">Round {game.round_number}</p>
                                  )}
                                  <p className="truncate font-medium text-foreground" title={matchup}>{matchup}</p>
                                  {!isBye && (
                                    <p className="text-muted-foreground">
                                      {new Date(game.fixture_date).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
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
  const isBye = !game.home_team || !game.away_team;
  const knownTeam = game.home_team?.name || game.away_team?.name || "Team";

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
                      Round {game.round_number}
                    </Badge>
                  )}
                  {isPast && game.status === "finalised" && (
                    <Badge variant="finalised" className="text-xs">
                      Finalised
                    </Badge>
                  )}
                </div>

                <p className="font-semibold text-foreground truncate">
                  {isBye ? `${knownTeam} — Bye` : `${homeTeam} vs ${awayTeam}`}
                </p>

                {!isBye && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {gameDate.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{venueName}</span>
                  </span>
                </div>}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {isPast && game.home_score !== null && game.away_score !== null && (
                <Badge variant="secondary" className="text-sm font-bold">
                  {game.home_score} - {game.away_score}
                </Badge>
              )}
              {!isBye && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
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

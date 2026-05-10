import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Trophy, Target, Megaphone, MapPin } from "lucide-react";
import { format } from "date-fns";

interface GameSummary {
  id: string;
  fixture_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team: { id: string; name: string } | null;
  away_team: { id: string; name: string } | null;
  venue: { id: string; name: string } | null;
}

interface EntityDashboardProps {
  entityName: string;
  entityType: "association" | "club" | "team";
  logoUrl?: string | null;
  abbreviation?: string | null;
  parentName?: string;
  stats: {
    gamesPlayed: number;
    goalsScored: number;
  };
  upcomingGames: GameSummary[];
  loading: boolean;
}

const TYPE_LABELS = {
  association: "Association",
  club: "Club",
  team: "Team",
};

const EntityDashboard = ({
  entityName,
  entityType,
  logoUrl,
  abbreviation,
  parentName,
  stats,
  upcomingGames,
  loading,
}: EntityDashboardProps) => {
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 rounded-lg">
          <AvatarImage src={logoUrl || undefined} alt={entityName} className="object-cover" />
          <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-lg font-bold">
            {abbreviation || entityName.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{entityName}</h1>
            <Badge variant="secondary">{TYPE_LABELS[entityType]}</Badge>
          </div>
          {parentName && (
            <p className="text-muted-foreground">{parentName}</p>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Games Played</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.gamesPlayed}</div>
            <p className="text-xs text-muted-foreground">Completed games</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.goalsScored}</div>
            <p className="text-xs text-muted-foreground">Goals scored</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ladder Position</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </div>

      {/* Announcements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Announcements
          </CardTitle>
          <CardDescription>Latest news and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No announcements yet.
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Fixtures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Fixtures
          </CardTitle>
          <CardDescription>Next scheduled games</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingGames.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No upcoming fixtures.
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingGames.map((game) => (
                (() => {
                  const homeTeam = game.home_team?.name ?? "Unknown";
                  const awayTeam = game.away_team?.name ?? "Unknown";
                  const venueName = game.venue?.name ?? "TBD";
                  return (
                <div
                  key={game.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[60px]">
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(game.fixture_date), "MMM d")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(game.fixture_date), "h:mm a")}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">{homeTeam} vs {awayTeam}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {venueName}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {game.status}
                  </Badge>
                </div>
                  );
                })()
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EntityDashboard;

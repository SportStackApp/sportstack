import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Trophy, Target, Megaphone, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import type { LadderRow } from "@/lib/ladder";
import type { EntityUpdate } from "@/lib/entityDashboard";
import { cn } from "@/lib/utils";

interface GameSummary {
  id: string;
  fixture_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team: { id: string; name: string } | null;
  away_team: { id: string; name: string } | null;
  venue: { id: string; name: string } | null;
  divisions?: { id: string; name: string } | null;
}

interface EntityDashboardProps {
  entityName: string;
  entityType: "association" | "club" | "division" | "team";
  logoUrl?: string | null;
  bannerUrl?: string | null;
  primaryColour?: string | null;
  secondaryColour?: string | null;
  abbreviation?: string | null;
  parentName?: string;
  stats: {
    gamesPlayed: number;
    goalsFor: number;
    goalsAgainst: number;
    upcomingFixtures: number;
    activePlayers: number;
    ladderPosition?: number | null;
  };
  upcomingGames: GameSummary[];
  ladderSections?: { title: string; rows: LadderRow[]; highlightTeamIds?: string[] }[];
  updates?: EntityUpdate[];
  loading: boolean;
}

const TYPE_LABELS = {
  association: "Association",
  club: "Club",
  division: "Division",
  team: "Team",
};

const EntityDashboard = ({
  entityName,
  entityType,
  logoUrl,
  bannerUrl,
  primaryColour,
  secondaryColour,
  abbreviation,
  parentName,
  stats,
  upcomingGames,
  ladderSections = [],
  updates = [],
  loading,
}: EntityDashboardProps) => {
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div
        className={cn(
          "relative flex min-h-52 items-end gap-4 overflow-hidden rounded-xl border bg-cover bg-center p-5 shadow-sm sm:min-h-64 sm:p-7",
          !bannerUrl && !primaryColour && "bg-primary text-primary-foreground",
          bannerUrl && "text-white",
        )}
        style={bannerUrl
          ? { backgroundImage: `linear-gradient(90deg, rgba(8,15,35,.9), rgba(8,15,35,.35)), url(${bannerUrl})` }
          : primaryColour
            ? { backgroundColor: primaryColour, color: secondaryColour || "#fff" }
            : undefined}
      >
        <Avatar className="h-16 w-16 rounded-lg">
          <AvatarImage src={logoUrl || undefined} alt={entityName} className="object-cover" />
          <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-lg font-bold">
            {abbreviation || entityName.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{entityName}</h1>
            <Badge variant="secondary" className="bg-white/90 text-slate-900">{TYPE_LABELS[entityType]}</Badge>
          </div>
          {parentName && <p className="text-muted-foreground">{parentName}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed Fixtures</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.gamesPlayed}</div>
            <p className="text-xs text-muted-foreground">Completed games</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Goals Scored</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.goalsFor}</div>
            <p className="text-xs text-muted-foreground">Goals scored</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Fixtures</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingFixtures}</div>
            <p className="text-xs text-muted-foreground">Currently scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activePlayers}</div>
            <p className="text-xs text-muted-foreground">Distinct current members</p>
          </CardContent>
        </Card>
      </div>

      {ladderSections.length > 0 ? (
        <div className="space-y-4">
          {ladderSections.map((section) => (
            <Card key={section.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-sm font-medium">{section.title}</CardTitle>
                  <CardDescription>Ladder position</CardDescription>
                </div>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-2 text-left">#</th>
                        <th className="py-2 pr-2 text-left">Team</th>
                        <th className="py-2 pr-2 text-right">P</th>
                        <th className="py-2 pr-2 text-right">W</th>
                        <th className="py-2 pr-2 text-right">D</th>
                        <th className="py-2 pr-2 text-right">L</th>
                        <th className="py-2 pr-2 text-right">GD</th>
                        <th className="py-2 text-right">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row) => {
                        const highlighted = section.highlightTeamIds?.includes(row.teamId);
                        return (
                          <tr key={row.teamId} className={highlighted ? "bg-primary/10 font-semibold" : ""}>
                            <td className="py-2 pr-2">{row.position}</td>
                            <td className="py-2 pr-2">{row.teamName}</td>
                            <td className="py-2 pr-2 text-right">{row.played}</td>
                            <td className="py-2 pr-2 text-right">{row.wins}</td>
                            <td className="py-2 pr-2 text-right">{row.draws}</td>
                            <td className="py-2 pr-2 text-right">{row.losses}</td>
                            <td className="py-2 pr-2 text-right">{row.goalDifference}</td>
                            <td className="py-2 text-right">{row.points}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Ladder Position</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.ladderPosition || "TBC"}</div>
          <p className="text-xs text-muted-foreground">Ladder data not connected yet</p>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Announcements
          </CardTitle>
          <CardDescription>Official club and association updates</CardDescription>
        </CardHeader>
        <CardContent>
          {updates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No official updates yet.</div>
          ) : (
            <div className="divide-y rounded-lg border">
              {updates.map((update) => (
                <div key={update.id} className="p-3">
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{update.scopeLabel}</span>
                    <span>{new Date(update.createdAt).toLocaleDateString("en-AU")}</span>
                  </div>
                  <p className="text-sm">{update.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
            <div className="text-center py-8 text-muted-foreground">No upcoming fixtures.</div>
          ) : (
            <div className="space-y-3">
              {upcomingGames.map((game) => {
                const homeTeam = game.home_team?.name ?? "Unknown";
                const awayTeam = game.away_team?.name ?? "Unknown";
                const venueName = game.venue?.name ?? "TBD";
                const divisionName = game.divisions?.name;

                return (
                  <div key={game.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
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
                        <div className="font-medium">
                          {homeTeam} vs {awayTeam}
                        </div>
                        {divisionName && (
                          <div className="text-xs text-muted-foreground">
                            {divisionName}
                          </div>
                        )}
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
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EntityDashboard;

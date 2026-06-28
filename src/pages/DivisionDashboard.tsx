import { useEffect, useState } from "react";
import { useTeamContext } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Trophy, Users } from "lucide-react";
import { calculateLadder, type LadderRow } from "@/lib/ladder";

const DivisionDashboard = () => {
  const {
    selectedDivision,
    selectedAssociation,
    selectedClub,
    divisions,
    filteredTeams,
  } = useTeamContext();

  const [fixtures, setFixtures] = useState<any[]>([]);
  const [ladder, setLadder] = useState<LadderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedDivision) return;

    const fetchFixtures = async () => {
      setLoading(true);

      // Get team IDs for this division
      const teamIds = filteredTeams.map((t) => t.id);

      if (teamIds.length === 0) {
        setFixtures([]);
        setLadder([]);
        setLoading(false);
        return;
      }

      const [{ data }, { data: completed }] = await Promise.all([
        (supabase
        .from("fixtures" as any)
        .select("id, round_number, round_name, fixture_date, status, home_team_id, away_team_id, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name)")
        .or(`home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`)
        .eq("status", "SCHEDULED")
        .order("fixture_date", { ascending: true })
        .limit(20) as any),
        (supabase
          .from("fixtures" as any)
          .select("id, home_team_id, away_team_id, home_score, away_score, status, fixture_date")
          .or(`home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`)
          .eq("status", "COMPLETED") as any),
      ]);

      setFixtures(data || []);
      setLadder(calculateLadder(divisionTeams, completed || []));
      setLoading(false);
    };

    fetchFixtures();
  }, [selectedDivision, filteredTeams]);

  const divisionTeams = filteredTeams;
  const divisionName = divisions.find((division) => division.id === selectedDivision)?.name || "Division";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {divisionName}
        </h1>
        <p className="text-muted-foreground">
          {selectedAssociation?.name}
          {selectedClub ? ` · ${selectedClub.name}` : ""}
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{divisionTeams.length}</div>
            <p className="text-xs text-muted-foreground">Teams in division</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{fixtures.length}</div>
            <p className="text-xs text-muted-foreground">Upcoming fixtures</p>
          </CardContent>
        </Card>
      </div>

      {/* Teams */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Teams
          </CardTitle>
        </CardHeader>
        <CardContent>
          {divisionTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams in this division.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {divisionTeams.map((t) => (
                <Badge key={t.id} variant="outline">{t.name}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" />
            Ladder
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ladder.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed games yet.</p>
          ) : (
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
                  {ladder.map((row) => (
                    <tr key={row.teamId}>
                      <td className="py-2 pr-2">{row.position}</td>
                      <td className="py-2 pr-2">{row.teamName}</td>
                      <td className="py-2 pr-2 text-right">{row.played}</td>
                      <td className="py-2 pr-2 text-right">{row.wins}</td>
                      <td className="py-2 pr-2 text-right">{row.draws}</td>
                      <td className="py-2 pr-2 text-right">{row.losses}</td>
                      <td className="py-2 pr-2 text-right">{row.goalDifference}</td>
                      <td className="py-2 text-right">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fixtures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Fixtures
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : fixtures.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fixtures scheduled.</p>
          ) : (
            <div className="space-y-2">
              {fixtures.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm py-2 border-b border-border/40 last:border-0">
                  <div>
                    <span className="font-medium">{f.round_name || `Round ${f.round_number}`}</span>
                    <span className="text-muted-foreground ml-2">
                      {f.home_team?.name || "TBC"} vs {f.away_team?.name || "Bye"}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {f.fixture_date ? new Date(f.fixture_date).toLocaleDateString("en-AU") : "Date TBC"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DivisionDashboard;

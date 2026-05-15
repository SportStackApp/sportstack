import { useEffect, useState } from "react";
import { useTeamContext } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users } from "lucide-react";

const DivisionDashboard = () => {
  const {
    selectedDivision,
    selectedAssociation,
    selectedClub,
    filteredTeams,
  } = useTeamContext();

  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedDivision) return;

    const fetchFixtures = async () => {
      setLoading(true);

      // Get team IDs for this division
      const teamIds = filteredTeams
        .filter((t) => t.division === selectedDivision)
        .map((t) => t.id);

      if (teamIds.length === 0) {
        setFixtures([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("fixtures")
        .select("id, round_number, round_name, game_date, status, team_id, opponent_name, venue_id")
        .in("team_id", teamIds)
        .order("game_date", { ascending: true })
        .limit(20);

      setFixtures(data || []);
      setLoading(false);
    };

    fetchFixtures();
  }, [selectedDivision, filteredTeams]);

  const divisionTeams = filteredTeams.filter((t) => t.division === selectedDivision);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {selectedDivision || "Division"}
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
                    <span className="text-muted-foreground ml-2">vs {f.opponent_name || "TBC"}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {f.game_date ? new Date(f.game_date).toLocaleDateString("en-AU") : "Date TBC"}
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

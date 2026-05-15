import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid } from "lucide-react";

interface Team {
  id: string;
  name: string;
  division: string | null;
  club_id: string | null;
}

const DivisionsManagement = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, division, club_id")
        .order("division", { ascending: true })
        .order("name", { ascending: true });

      if (!error && data) {
        setTeams(data);
      } else {
        console.error("Error fetching teams:", error?.message);
      }
      setLoading(false);
    };

    fetchTeams();
  }, []);

  // Group teams by division
  const groupedTeams = teams.reduce((acc, team) => {
    const div = team.division && team.division.trim() !== "" ? team.division : "No Division Assigned";
    if (!acc[div]) acc[div] = [];
    acc[div].push(team);
    return acc;
  }, {} as Record<string, Team[]>);

  const totalDivisions = Object.keys(groupedTeams).filter(d => d !== "No Division Assigned").length;
  const totalTeams = teams.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <LayoutGrid className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Divisions Management</h1>
          <p className="text-muted-foreground">Manage and view divisions across the association</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalDivisions}</div>
            <p className="text-xs text-muted-foreground">Total Divisions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalTeams}</div>
            <p className="text-xs text-muted-foreground">Total Teams</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading divisions...</p>
      ) : (
        <div className="grid gap-4">
          {Object.entries(groupedTeams).map(([division, divTeams]) => (
            <Card key={division}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{division}</CardTitle>
                  <Badge variant="secondary" className="ml-2">
                    {divTeams.length} {divTeams.length === 1 ? 'team' : 'teams'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {divTeams.map((team) => (
                    <div key={team.id} className="text-sm py-1 border-b last:border-0 border-border/50">
                      {team.name}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DivisionsManagement;

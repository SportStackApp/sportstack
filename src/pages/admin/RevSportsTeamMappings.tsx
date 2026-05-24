import { useEffect, useState } from "react";
import { supabase as originalSupabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const supabase = originalSupabase as any;

interface SportStackTeam {
  id: string;
  name: string;
  divisionName: string;
  clubName: string;
}

interface ScrapedTeamEntry {
  teamName: string;
  grade: string;
  key: string; // compound key: `${teamName}|||${grade}`
}

export default function RevSportsTeamMappings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [scrapedTeams, setScrapedTeams] = useState<ScrapedTeamEntry[]>([]);
  const [systemTeams, setSystemTeams] = useState<SportStackTeam[]>([]);
  
  // State maps: ScrapedTeamEntry.key -> team_id (or "__none__")
  const [mappings, setMappings] = useState<Record<string, string>>({});

  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      // 1. Fetch distinct scraped team names and grades
      const { data: playersData, error: playersErr } = await supabase
        .from("revsports_players")
        .select("home_team, away_team, grade");
        
      // 2. Fetch existing mappings
      const { data: mappingData, error: mappingErr } = await supabase
        .from("revsports_team_mappings")
        .select("*");
        
      // 3. Fetch system teams, clubs, divisions in parallel
      const [
        { data: teamsData, error: teamsErr },
        { data: clubsData, error: clubsErr },
        { data: divisionsData, error: divisionsErr }
      ] = await Promise.all([
        supabase.from("teams").select("id, name, club_id, division_id"),
        supabase.from("clubs").select("id, name"),
        supabase.from("divisions").select("id, name")
      ]);

      if (playersErr || mappingErr || teamsErr || clubsErr || divisionsErr) {
        toast({ variant: "destructive", title: "Error loading data" });
        setLoading(false);
        return;
      }

      // Process scraped teams
      const entryMap = new Map<string, ScrapedTeamEntry>();
      if (playersData) {
        playersData.forEach((row: any) => {
          if (row.home_team && row.grade) {
            const key = `${row.home_team}|||${row.grade}`;
            if (!entryMap.has(key)) {
              entryMap.set(key, { teamName: row.home_team, grade: row.grade, key });
            }
          }
          if (row.away_team && row.grade) {
            const key = `${row.away_team}|||${row.grade}`;
            if (!entryMap.has(key)) {
              entryMap.set(key, { teamName: row.away_team, grade: row.grade, key });
            }
          }
        });
      }
      
      const sortedTeams = Array.from(entryMap.values()).sort((a, b) => {
        const nameCmp = a.teamName.localeCompare(b.teamName);
        if (nameCmp !== 0) return nameCmp;
        return a.grade.localeCompare(b.grade);
      });

      // Process system teams
      if (teamsData && clubsData && divisionsData) {
        const clubsMap = new Map(clubsData.map((c: any) => [c.id, c.name]));
        const divisionsMap = new Map(divisionsData.map((d: any) => [d.id, d.name]));
        
        const builtTeams: SportStackTeam[] = teamsData.map((t: any) => ({
          id: t.id,
          name: t.name,
          clubName: t.club_id ? (clubsMap.get(t.club_id) || "Unknown") : "Unknown",
          divisionName: t.division_id ? (divisionsMap.get(t.division_id) || "Unknown") : "Unknown"
        })).sort((a: SportStackTeam, b: SportStackTeam) => a.name.localeCompare(b.name));
        
        setSystemTeams(builtTeams);
      }

      // Process mappings
      const currentMappings: Record<string, string> = {};
      if (mappingData) {
        mappingData.forEach((m: any) => {
          if (m.team_id) {
            const key = `${m.revsports_team_name}|||${m.grade}`;
            currentMappings[key] = m.team_id;
          }
        });
      }
      
      // Initialize state
      const initialFormState: Record<string, string> = {};
      sortedTeams.forEach(entry => {
        initialFormState[entry.key] = currentMappings[entry.key] || "__none__";
      });
      
      // Also include any mappings that exist but maybe aren't in scraped teams currently
      Object.keys(currentMappings).forEach(key => {
        if (!initialFormState[key]) {
          initialFormState[key] = currentMappings[key];
          if (!entryMap.has(key)) {
            const [teamName, grade] = key.split("|||");
            sortedTeams.push({ teamName, grade, key });
          }
        }
      });
      
      sortedTeams.sort((a, b) => {
        const nameCmp = a.teamName.localeCompare(b.teamName);
        if (nameCmp !== 0) return nameCmp;
        return a.grade.localeCompare(b.grade);
      });
      
      setScrapedTeams(sortedTeams);
      setMappings(initialFormState);

      setLoading(false);
    }
    
    loadData();
  }, [toast]);

  const handleSelectChange = (key: string, value: string) => {
    setMappings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    
    // Only save rows where a team has been selected (skip "__none__")
    const rowsToUpsert = Object.entries(mappings)
      .filter(([key, teamId]) => teamId !== "__none__")
      .map(([key, teamId]) => {
        const [revsports_team_name, grade] = key.split("|||");
        return {
          revsports_team_name,
          grade,
          team_id: teamId
        };
      });

    if (rowsToUpsert.length === 0) {
      toast({ title: "Nothing to save" });
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("revsports_team_mappings")
      .upsert(rowsToUpsert, { onConflict: "revsports_team_name,grade" });

    if (error) {
      toast({ variant: "destructive", title: "Failed to save mappings", description: error.message });
    } else {
      toast({ title: "Mappings saved successfully!" });
    }
    
    setSaving(false);
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RevSports Team Mappings</h1>
          <p className="text-muted-foreground mt-1">Map scraped team names to SportStack teams for accurate player filtering.</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save All Mappings"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%] pl-6 py-4">Scraped Team Name</TableHead>
                <TableHead className="w-[50%] py-4">Maps To</TableHead>
                <TableHead className="w-[20%] text-right pr-6 py-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scrapedTeams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                    No scraped teams found.
                  </TableCell>
                </TableRow>
              ) : (
                scrapedTeams.map((entry) => {
                  const currentValue = mappings[entry.key];
                  const isMapped = currentValue && currentValue !== "__none__";
                  
                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="pl-6">
                        <span className="font-bold">{entry.teamName}</span>
                        <span className="text-muted-foreground"> · {entry.grade}</span>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={currentValue} 
                          onValueChange={(val) => handleSelectChange(entry.key, val)}
                        >
                          <SelectTrigger className="w-full md:w-[300px]">
                            <SelectValue placeholder="— Not mapped —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Not mapped —</SelectItem>
                            {systemTeams.map(team => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name} — {team.divisionName}, {team.clubName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {isMapped ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Mapped</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100 border-gray-200">Unmapped</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

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
}

export default function RevSportsTeamMappings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [scrapedTeams, setScrapedTeams] = useState<string[]>([]);
  const [systemTeams, setSystemTeams] = useState<SportStackTeam[]>([]);
  
  // State maps: revsports_team_name -> team_id (or "__none__")
  const [mappings, setMappings] = useState<Record<string, string>>({});

  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      // 1. Fetch distinct scraped team names
      const { data: playersData, error: playersErr } = await supabase
        .from("revsports_players")
        .select("home_team, away_team");
        
      // 2. Fetch existing mappings
      const { data: mappingData, error: mappingErr } = await supabase
        .from("revsports_team_mappings")
        .select("*");
        
      // 3. Fetch system teams
      const { data: teamsData, error: teamsErr } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");

      if (playersErr || mappingErr || teamsErr) {
        toast({ variant: "destructive", title: "Error loading data" });
        setLoading(false);
        return;
      }

      // Process scraped teams
      const teamSet = new Set<string>();
      if (playersData) {
        playersData.forEach((row: any) => {
          if (row.home_team) teamSet.add(row.home_team);
          if (row.away_team) teamSet.add(row.away_team);
        });
      }
      const sortedTeams = Array.from(teamSet).sort((a, b) => a.localeCompare(b));

      // Process system teams
      if (teamsData) {
        setSystemTeams(teamsData);
      }

      // Process mappings
      const currentMappings: Record<string, string> = {};
      if (mappingData) {
        mappingData.forEach((m: any) => {
          if (m.team_id) {
            currentMappings[m.revsports_team_name] = m.team_id;
          }
        });
      }
      
      // Initialize state
      const initialFormState: Record<string, string> = {};
      sortedTeams.forEach(team => {
        initialFormState[team] = currentMappings[team] || "__none__";
      });
      // also include any mappings that exist but maybe aren't in scraped teams
      Object.keys(currentMappings).forEach(team => {
        if (!initialFormState[team]) {
          initialFormState[team] = currentMappings[team];
          if (!sortedTeams.includes(team)) {
            sortedTeams.push(team);
          }
        }
      });
      
      sortedTeams.sort((a, b) => a.localeCompare(b));
      setScrapedTeams(sortedTeams);
      setMappings(initialFormState);

      setLoading(false);
    }
    
    loadData();
  }, [toast]);

  const handleSelectChange = (scrapedName: string, value: string) => {
    setMappings(prev => ({
      ...prev,
      [scrapedName]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    
    // Only save rows where a team has been selected (skip "__none__")
    const rowsToUpsert = Object.entries(mappings)
      .filter(([name, teamId]) => teamId !== "__none__")
      .map(([name, teamId]) => ({
        revsports_team_name: name,
        team_id: teamId
      }));

    if (rowsToUpsert.length === 0) {
      toast({ title: "Nothing to save" });
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("revsports_team_mappings")
      .upsert(rowsToUpsert, { onConflict: "revsports_team_name" });

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
                scrapedTeams.map((scrapedName) => {
                  const currentValue = mappings[scrapedName];
                  const isMapped = currentValue && currentValue !== "__none__";
                  
                  return (
                    <TableRow key={scrapedName}>
                      <TableCell className="pl-6 font-medium">{scrapedName}</TableCell>
                      <TableCell>
                        <Select 
                          value={currentValue} 
                          onValueChange={(val) => handleSelectChange(scrapedName, val)}
                        >
                          <SelectTrigger className="w-full md:w-[300px]">
                            <SelectValue placeholder="— Not mapped —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Not mapped —</SelectItem>
                            {systemTeams.map(team => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
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

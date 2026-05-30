import { useEffect, useState } from "react";
import { supabase as originalSupabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSelect } from "@/components/ui/multi-select";

const supabase = originalSupabase as any;

// System Data Interfaces
interface SystemTeam { id: string; name: string; divisionName: string; clubName: string; }
interface SystemProfile { id: string; firstName: string; lastName: string; }
interface SystemVenue { id: string; name: string; }
interface SystemDivision { id: string; name: string; associationName: string; }
interface SystemClub { id: string; name: string; }
interface SystemPitch { id: string; name: string; venueName: string; }

// Scraped Data Interfaces
interface ScrapedTeam { teamName: string; clubName: string; grade: string; key: string; }
interface ScrapedGrade { grade: string; key: string; }
interface ScrapedClub { clubName: string; key: string; }
interface ScrapedVenue { venueName: string; key: string; }
interface ScrapedPitch { pitchName: string; venueName: string; key: string; }
interface ScrapedPlayer { playerName: string; clubName: string; team: string; grade: string; jersey: string; key: string; }
interface ScrapedUmpire { umpireName: string; key: string; }

export default function RevSportsMappings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("teams");

  // System Data
  const [systemTeams, setSystemTeams] = useState<SystemTeam[]>([]);
  const [systemProfiles, setSystemProfiles] = useState<SystemProfile[]>([]);
  const [systemVenues, setSystemVenues] = useState<SystemVenue[]>([]);
  const [systemDivisions, setSystemDivisions] = useState<SystemDivision[]>([]);
  const [systemClubs, setSystemClubs] = useState<SystemClub[]>([]);
  const [systemPitches, setSystemPitches] = useState<SystemPitch[]>([]);

  // Scraped Data
  const [scrapedTeams, setScrapedTeams] = useState<ScrapedTeam[]>([]);
  const [scrapedGrades, setScrapedGrades] = useState<ScrapedGrade[]>([]);
  const [scrapedClubs, setScrapedClubs] = useState<ScrapedClub[]>([]);
  const [scrapedVenues, setScrapedVenues] = useState<ScrapedVenue[]>([]);
  const [scrapedPitches, setScrapedPitches] = useState<ScrapedPitch[]>([]);
  const [scrapedPlayers, setScrapedPlayers] = useState<ScrapedPlayer[]>([]);
  const [scrapedUmpires, setScrapedUmpires] = useState<ScrapedUmpire[]>([]);

  // Mappings (Scraped Key -> System ID)
  const [teamMappings, setTeamMappings] = useState<Record<string, string>>({});
  const [gradeMappings, setGradeMappings] = useState<Record<string, string>>({});
  const [clubMappings, setClubMappings] = useState<Record<string, string>>({});
  const [venueMappings, setVenueMappings] = useState<Record<string, string>>({});
  const [pitchMappings, setPitchMappings] = useState<Record<string, string>>({});
  const [playerMappings, setPlayerMappings] = useState<Record<string, string>>({});
  const [umpireMappings, setUmpireMappings] = useState<Record<string, string>>({});

  // Filters
  const [teamFilters, setTeamFilters] = useState({ grades: [] as string[], clubs: [] as string[] });
  const [playerFilters, setPlayerFilters] = useState({ grades: [] as string[], teams: [] as string[] });
  const [gradeTabAssociationFilter, setGradeTabAssociationFilter] = useState("all");

  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      const [
        { data: playersData, error: playersErr },
        { data: teamsData },
        { data: clubsData },
        { data: divisionsData },
        { data: profilesData },
        { data: venuesData },
        { data: pitchesData },
        { data: tMapData },
        { data: gMapData },
        { data: cMapData },
        { data: vMapData },
        { data: pMapData },
        { data: plMapData },
        { data: uMapData }
      ] = await Promise.all([
        supabase.from("revsports_players").select("team, player_name, grade, home_team, away_team, venue, club_name, jersey, umpire_1, umpire_2, pitch"),
        supabase.from("teams").select("id, name, club_id, division_id"),
        supabase.from("clubs").select("id, name"),
        supabase.from("divisions").select("id, name, associations(name)"),
        supabase.from("profiles").select("id, first_name, last_name"),
        supabase.from("venues").select("id, name"),
        supabase.from("pitches").select("id, name, venue_id"),
        
        supabase.from("revsports_team_mappings").select("*"),
        supabase.from("revsports_grade_mappings").select("*"),
        supabase.from("revsports_club_mappings").select("*"),
        supabase.from("revsports_venue_mappings").select("*"),
        supabase.from("revsports_pitch_mappings").select("*"),
        supabase.from("revsports_player_mappings").select("*"),
        supabase.from("revsports_umpire_mappings").select("*")
      ]);

      if (playersErr) {
        toast({ variant: "destructive", title: "Error loading revsports players data" });
        setLoading(false);
        return;
      }

      // --- Process System Data ---
      const clubsMap = new Map((clubsData || []).map((c: any) => [c.id, c.name]));
      const divisionsMap = new Map((divisionsData || []).map((d: any) => [d.id, d.name]));
      const venuesMap = new Map((venuesData || []).map((v: any) => [v.id, v.name]));

      const builtTeams: SystemTeam[] = (teamsData || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        clubName: t.club_id ? (clubsMap.get(t.club_id) || "Unknown") : "Unknown",
        divisionName: t.division_id ? (divisionsMap.get(t.division_id) || "Unknown") : "Unknown"
      })).sort((a: SystemTeam, b: SystemTeam) => a.clubName.localeCompare(b.clubName) || a.divisionName.localeCompare(b.divisionName) || a.name.localeCompare(b.name));

      const builtProfiles: SystemProfile[] = (profilesData || []).map((p: any) => ({
        id: p.id,
        firstName: p.first_name || "",
        lastName: p.last_name || ""
      })).sort((a: SystemProfile, b: SystemProfile) => {
        const aName = `${a.firstName} ${a.lastName}`.trim();
        const bName = `${b.firstName} ${b.lastName}`.trim();
        return aName.localeCompare(bName);
      });

      const builtVenues: SystemVenue[] = (venuesData || []).map((v: any) => ({
        id: v.id,
        name: v.name
      })).sort((a: SystemVenue, b: SystemVenue) => a.name.localeCompare(b.name));

      const builtDivisions: SystemDivision[] = (divisionsData || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        associationName: d.associations ? (Array.isArray(d.associations) ? d.associations[0]?.name : d.associations?.name) || "Unknown" : "Unknown"
      })).sort((a: SystemDivision, b: SystemDivision) => a.associationName.localeCompare(b.associationName) || a.name.localeCompare(b.name));

      const builtClubs: SystemClub[] = (clubsData || []).map((c: any) => ({
        id: c.id,
        name: c.name
      })).sort((a: SystemClub, b: SystemClub) => a.name.localeCompare(b.name));

      const builtPitches: SystemPitch[] = (pitchesData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        venueName: p.venue_id ? (venuesMap.get(p.venue_id) || "Unknown") : "Unknown"
      })).sort((a: SystemPitch, b: SystemPitch) => a.venueName.localeCompare(b.venueName) || a.name.localeCompare(b.name));

      setSystemTeams(builtTeams);
      setSystemProfiles(builtProfiles);
      setSystemVenues(builtVenues);
      setSystemDivisions(builtDivisions);
      setSystemClubs(builtClubs);
      setSystemPitches(builtPitches);

      // --- Process Scraped Data ---
      const sTeamsMap = new Map<string, ScrapedTeam>();
      const sGradesMap = new Map<string, ScrapedGrade>();
      const sClubsMap = new Map<string, ScrapedClub>();
      const sVenuesMap = new Map<string, ScrapedVenue>();
      const sPitchesMap = new Map<string, ScrapedPitch>();
      const sPlayersMap = new Map<string, ScrapedPlayer>();
      const sUmpiresMap = new Map<string, ScrapedUmpire>();

      if (playersData) {
        playersData.forEach((row: any) => {
          const clubName = row.club_name || "";
          const grade = row.grade || "";
          
          // Teams (home_team, away_team, team)
          const teamsToProcess = [];
          if (row.home_team) teamsToProcess.push(row.home_team);
          if (row.away_team) teamsToProcess.push(row.away_team);
          if (row.team) teamsToProcess.push(row.team);
          
          teamsToProcess.forEach(tName => {
            if (tName) {
              const key = `${clubName}|||${grade}|||${tName}`;
              if (!sTeamsMap.has(key)) {
                sTeamsMap.set(key, { teamName: tName, clubName, grade, key });
              }
            }
          });

          // Grades
          if (grade) {
            if (!sGradesMap.has(grade)) sGradesMap.set(grade, { grade, key: grade });
          }

          // Clubs
          if (clubName) {
            if (!sClubsMap.has(clubName)) sClubsMap.set(clubName, { clubName, key: clubName });
          }

          // Venues
          if (row.venue) {
            if (!sVenuesMap.has(row.venue)) sVenuesMap.set(row.venue, { venueName: row.venue, key: row.venue });
          }

          // Pitches
          if (row.venue && row.pitch) {
            const key = `${row.venue}|||${row.pitch}`;
            if (!sPitchesMap.has(key)) sPitchesMap.set(key, { pitchName: row.pitch, venueName: row.venue, key });
          }

          // Players
          if (row.player_name) {
            const tName = row.team || "";
            const jersey = row.jersey || "";
            const key = `${row.player_name}|||${clubName}|||${grade}|||${tName}|||${jersey}`;
            if (!sPlayersMap.has(key)) {
              sPlayersMap.set(key, { playerName: row.player_name, clubName, team: tName, grade, jersey, key });
            }
          }

          // Umpires
          if (row.umpire_1) {
            if (!sUmpiresMap.has(row.umpire_1)) sUmpiresMap.set(row.umpire_1, { umpireName: row.umpire_1, key: row.umpire_1 });
          }
          if (row.umpire_2) {
            if (!sUmpiresMap.has(row.umpire_2)) sUmpiresMap.set(row.umpire_2, { umpireName: row.umpire_2, key: row.umpire_2 });
          }
        });
      }

      // Sort Scraped Data
      const sortedTeams = Array.from(sTeamsMap.values()).sort((a, b) => a.clubName.localeCompare(b.clubName) || a.grade.localeCompare(b.grade) || a.teamName.localeCompare(b.teamName));
      const sortedGrades = Array.from(sGradesMap.values()).sort((a, b) => a.grade.localeCompare(b.grade));
      const sortedClubs = Array.from(sClubsMap.values()).sort((a, b) => a.clubName.localeCompare(b.clubName));
      const sortedVenues = Array.from(sVenuesMap.values()).sort((a, b) => a.venueName.localeCompare(b.venueName));
      const sortedPitches = Array.from(sPitchesMap.values()).sort((a, b) => a.venueName.localeCompare(b.venueName) || a.pitchName.localeCompare(b.pitchName));
      const sortedPlayers = Array.from(sPlayersMap.values()).sort((a, b) => a.playerName.localeCompare(b.playerName));
      const sortedUmpires = Array.from(sUmpiresMap.values()).sort((a, b) => a.umpireName.localeCompare(b.umpireName));

      setScrapedTeams(sortedTeams);
      setScrapedGrades(sortedGrades);
      setScrapedClubs(sortedClubs);
      setScrapedVenues(sortedVenues);
      setScrapedPitches(sortedPitches);
      setScrapedPlayers(sortedPlayers);
      setScrapedUmpires(sortedUmpires);

      // --- Process Existing Mappings ---
      const initTeamMappings: Record<string, string> = {};
      const initGradeMappings: Record<string, string> = {};
      const initClubMappings: Record<string, string> = {};
      const initVenueMappings: Record<string, string> = {};
      const initPitchMappings: Record<string, string> = {};
      const initPlayerMappings: Record<string, string> = {};
      const initUmpireMappings: Record<string, string> = {};

      if (tMapData) {
        tMapData.forEach((m: any) => {
          if (m.team_id) initTeamMappings[`${m.club_name || ""}|||${m.grade || ""}|||${m.revsports_team_name}`] = m.team_id;
        });
      }
      if (gMapData) {
        gMapData.forEach((m: any) => { if (m.division_id) initGradeMappings[m.revsports_grade] = m.division_id; });
      }
      if (cMapData) {
        cMapData.forEach((m: any) => { if (m.club_id) initClubMappings[m.revsports_club_name] = m.club_id; });
      }
      if (vMapData) {
        vMapData.forEach((m: any) => { if (m.venue_id) initVenueMappings[m.revsports_venue_name] = m.venue_id; });
      }
      if (pMapData) {
        pMapData.forEach((m: any) => { if (m.pitch_id) initPitchMappings[`${m.revsports_venue_name}|||${m.revsports_pitch_name}`] = m.pitch_id; });
      }
      if (plMapData) {
        plMapData.forEach((m: any) => {
          if (m.profile_id) initPlayerMappings[`${m.revsports_player_name}|||${m.club_name || ""}|||${m.grade || ""}|||${m.team || ""}|||${m.jersey || ""}`] = m.profile_id;
        });
      }
      if (uMapData) {
        uMapData.forEach((m: any) => { if (m.profile_id) initUmpireMappings[m.revsports_umpire_name] = m.profile_id; });
      }

      // Pad missing keys with __none__
      sortedTeams.forEach(t => { if (!initTeamMappings[t.key]) initTeamMappings[t.key] = "__none__"; });
      sortedGrades.forEach(g => { if (!initGradeMappings[g.key]) initGradeMappings[g.key] = "__none__"; });
      sortedClubs.forEach(c => { if (!initClubMappings[c.key]) initClubMappings[c.key] = "__none__"; });
      sortedVenues.forEach(v => { if (!initVenueMappings[v.key]) initVenueMappings[v.key] = "__none__"; });
      sortedPitches.forEach(p => { if (!initPitchMappings[p.key]) initPitchMappings[p.key] = "__none__"; });
      sortedPlayers.forEach(p => { if (!initPlayerMappings[p.key]) initPlayerMappings[p.key] = "__none__"; });
      sortedUmpires.forEach(u => { if (!initUmpireMappings[u.key]) initUmpireMappings[u.key] = "__none__"; });

      setTeamMappings(initTeamMappings);
      setGradeMappings(initGradeMappings);
      setClubMappings(initClubMappings);
      setVenueMappings(initVenueMappings);
      setPitchMappings(initPitchMappings);
      setPlayerMappings(initPlayerMappings);
      setUmpireMappings(initUmpireMappings);

      setLoading(false);
    }
    loadData();
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    let success = true;

    try {
      if (activeTab === "teams") {
        const rowsToUpsert = Object.entries(teamMappings).filter(([_, id]) => id !== "__none__").map(([key, id]) => {
          const [club_name, grade, revsports_team_name] = key.split("|||");
          return { revsports_team_name, club_name, division_name: grade, team_id: id };
        });
        if (rowsToUpsert.length > 0) {
          const { error } = await supabase.from("revsports_team_mappings").upsert(rowsToUpsert, { onConflict: "revsports_team_name,club_name,division_name" });
          if (error) throw error;
        }
      } else if (activeTab === "grades") {
        const rowsToUpsert = Object.entries(gradeMappings).filter(([_, id]) => id !== "__none__").map(([key, id]) => {
          return { revsports_grade: key, division_id: id };
        });
        if (rowsToUpsert.length > 0) {
          const { error } = await supabase.from("revsports_grade_mappings").upsert(rowsToUpsert, { onConflict: "revsports_grade" });
          if (error) throw error;
        }
      } else if (activeTab === "clubs") {
        const rowsToUpsert = Object.entries(clubMappings).filter(([_, id]) => id !== "__none__").map(([key, id]) => {
          return { revsports_club_name: key, club_id: id };
        });
        if (rowsToUpsert.length > 0) {
          const { error } = await supabase.from("revsports_club_mappings").upsert(rowsToUpsert, { onConflict: "revsports_club_name" });
          if (error) throw error;
        }
      } else if (activeTab === "venues") {
        const rowsToUpsert = Object.entries(venueMappings).filter(([_, id]) => id !== "__none__").map(([key, id]) => {
          return { revsports_venue_name: key, venue_id: id };
        });
        if (rowsToUpsert.length > 0) {
          const { error } = await supabase.from("revsports_venue_mappings").upsert(rowsToUpsert, { onConflict: "revsports_venue_name" });
          if (error) throw error;
        }
      } else if (activeTab === "pitches") {
        const rowsToUpsert = Object.entries(pitchMappings).filter(([_, id]) => id !== "__none__").map(([key, id]) => {
          const [revsports_venue_name, revsports_pitch_name] = key.split("|||");
          return { revsports_venue_name, revsports_pitch_name, pitch_id: id };
        });
        if (rowsToUpsert.length > 0) {
          const { error } = await supabase.from("revsports_pitch_mappings").upsert(rowsToUpsert, { onConflict: "revsports_venue_name,revsports_pitch_name" });
          if (error) throw error;
        }
      } else if (activeTab === "players") {
        const rowsToUpsert = Object.entries(playerMappings).filter(([_, id]) => id !== "__none__").map(([key, id]) => {
          const [revsports_player_name, club_name, grade, team, jersey] = key.split("|||");
          return { revsports_player_name, grade, team, profile_id: id };
        });
        if (rowsToUpsert.length > 0) {
          const { error } = await supabase.from("revsports_player_mappings").upsert(rowsToUpsert, { onConflict: "revsports_player_name,grade,team" });
          if (error) throw error;
        }
      } else if (activeTab === "umpires") {
        const rowsToUpsert = Object.entries(umpireMappings).filter(([_, id]) => id !== "__none__").map(([key, id]) => {
          return { revsports_umpire_name: key, profile_id: id };
        });
        if (rowsToUpsert.length > 0) {
          const { error } = await supabase.from("revsports_umpire_mappings").upsert(rowsToUpsert, { onConflict: "revsports_umpire_name" });
          if (error) throw error;
        }
      }
    } catch (error: any) {
      success = false;
      toast({ variant: "destructive", title: "Failed to save mappings", description: error.message });
    }

    if (success) toast({ title: "Mappings saved successfully!" });
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  // Render Functions
  const renderTeamsTab = () => {
    const gradeOptions = Array.from(new Set(scrapedTeams.map(t => t.grade))).filter(Boolean).sort().map(g => ({ label: g, value: g }));
    const clubOptions = Array.from(new Set(scrapedTeams.map(t => t.clubName))).filter(Boolean).sort().map(c => ({ label: c, value: c }));

    const filtered = scrapedTeams.filter(t => {
      if (teamFilters.grades.length > 0 && !teamFilters.grades.includes(t.grade)) return false;
      if (teamFilters.clubs.length > 0 && !teamFilters.clubs.includes(t.clubName)) return false;
      return true;
    });

    return (
      <div className="space-y-4">
        <div className="flex gap-4 flex-wrap">
          <MultiSelect title="Grade" options={gradeOptions} selected={teamFilters.grades} onChange={(s) => setTeamFilters(p => ({ ...p, grades: s }))} className="w-[250px]" />
          <MultiSelect title="Club (Scraped)" options={clubOptions} selected={teamFilters.clubs} onChange={(s) => setTeamFilters(p => ({ ...p, clubs: s }))} className="w-[250px]" />
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-4 pl-6">CSV Column</TableHead>
                  <TableHead className="py-4">Scraped Value</TableHead>
                  <TableHead className="py-4">Maps To</TableHead>
                  <TableHead className="py-4">Supabase Destination</TableHead>
                  <TableHead className="py-4 text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(entry => {
                  const currentValue = teamMappings[entry.key];
                  const isMapped = currentValue && currentValue !== "__none__";
                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="pl-6 text-muted-foreground font-mono text-xs">team / home_team / away_team</TableCell>
                      <TableCell>
                        <span className="font-bold">{entry.teamName}</span>
                        <span className="text-muted-foreground block text-xs">{entry.clubName} • {entry.grade}</span>
                      </TableCell>
                      <TableCell>
                        <Select value={currentValue} onValueChange={(val) => setTeamMappings(prev => ({ ...prev, [entry.key]: val }))}>
                          <SelectTrigger className="w-[300px]"><SelectValue placeholder="— Not mapped —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Not mapped —</SelectItem>
                            {systemTeams.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.clubName} — {t.divisionName} — {t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">teams.id</TableCell>
                      <TableCell className="text-right pr-6">
                        {isMapped ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Mapped</Badge> : <Badge variant="secondary">Unmapped</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderGradesTab = () => {
    const associationOptions = Array.from(new Set(systemDivisions.map(d => d.associationName))).filter(Boolean).sort();
    
    const filteredDivisions = gradeTabAssociationFilter === "all"
      ? systemDivisions
      : systemDivisions.filter(d => d.associationName === gradeTabAssociationFilter);

    return (
      <div className="space-y-4">
        <div className="flex gap-4 flex-wrap">
          <div className="w-[250px]">
            <Select value={gradeTabAssociationFilter} onValueChange={setGradeTabAssociationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Association" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Associations</SelectItem>
                {associationOptions.map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-4 pl-6">CSV Column</TableHead>
                  <TableHead className="py-4">Scraped Value</TableHead>
                  <TableHead className="py-4">Maps To</TableHead>
                  <TableHead className="py-4">Supabase Destination</TableHead>
                  <TableHead className="py-4 text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scrapedGrades.map(entry => {
                  const currentValue = gradeMappings[entry.key];
                  const isMapped = currentValue && currentValue !== "__none__";
                  
                  // Ensure the currently mapped option is always available, even if filtered out
                  let optionsToRender = filteredDivisions;
                  if (currentValue && currentValue !== "__none__" && !filteredDivisions.find(d => d.id === currentValue)) {
                    const mappedDivision = systemDivisions.find(d => d.id === currentValue);
                    if (mappedDivision) {
                      optionsToRender = [...filteredDivisions, mappedDivision];
                    }
                  }

                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="pl-6 text-muted-foreground font-mono text-xs">grade</TableCell>
                      <TableCell><span className="font-bold">{entry.grade}</span></TableCell>
                      <TableCell>
                        <Select value={currentValue} onValueChange={(val) => setGradeMappings(prev => ({ ...prev, [entry.key]: val }))}>
                          <SelectTrigger className="w-[300px]"><SelectValue placeholder="— Not mapped —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Not mapped —</SelectItem>
                            {optionsToRender.map(d => <SelectItem key={d.id} value={d.id}>{d.associationName} — {d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">divisions.id</TableCell>
                      <TableCell className="text-right pr-6">
                        {isMapped ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Mapped</Badge> : <Badge variant="secondary">Unmapped</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderClubsTab = () => {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-4 pl-6">CSV Column</TableHead>
                  <TableHead className="py-4">Scraped Value</TableHead>
                  <TableHead className="py-4">Maps To</TableHead>
                  <TableHead className="py-4">Supabase Destination</TableHead>
                  <TableHead className="py-4 text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scrapedClubs.map(entry => {
                  const currentValue = clubMappings[entry.key];
                  const isMapped = currentValue && currentValue !== "__none__";
                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="pl-6 text-muted-foreground font-mono text-xs">club_name</TableCell>
                      <TableCell><span className="font-bold">{entry.clubName}</span></TableCell>
                      <TableCell>
                        <Select value={currentValue} onValueChange={(val) => setClubMappings(prev => ({ ...prev, [entry.key]: val }))}>
                          <SelectTrigger className="w-[300px]"><SelectValue placeholder="— Not mapped —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Not mapped —</SelectItem>
                            {systemClubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">clubs.id</TableCell>
                      <TableCell className="text-right pr-6">
                        {isMapped ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Mapped</Badge> : <Badge variant="secondary">Unmapped</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderVenuesTab = () => {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-4 pl-6">CSV Column</TableHead>
                  <TableHead className="py-4">Scraped Value</TableHead>
                  <TableHead className="py-4">Maps To</TableHead>
                  <TableHead className="py-4">Supabase Destination</TableHead>
                  <TableHead className="py-4 text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scrapedVenues.map(entry => {
                  const currentValue = venueMappings[entry.key];
                  const isMapped = currentValue && currentValue !== "__none__";
                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="pl-6 text-muted-foreground font-mono text-xs">venue</TableCell>
                      <TableCell><span className="font-bold">{entry.venueName}</span></TableCell>
                      <TableCell>
                        <Select value={currentValue} onValueChange={(val) => setVenueMappings(prev => ({ ...prev, [entry.key]: val }))}>
                          <SelectTrigger className="w-[300px]"><SelectValue placeholder="— Not mapped —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Not mapped —</SelectItem>
                            {systemVenues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">venues.id</TableCell>
                      <TableCell className="text-right pr-6">
                        {isMapped ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Mapped</Badge> : <Badge variant="secondary">Unmapped</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPitchesTab = () => {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-4 pl-6">CSV Column</TableHead>
                  <TableHead className="py-4">Scraped Value</TableHead>
                  <TableHead className="py-4">Maps To</TableHead>
                  <TableHead className="py-4">Supabase Destination</TableHead>
                  <TableHead className="py-4 text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scrapedPitches.map(entry => {
                  const currentValue = pitchMappings[entry.key];
                  const isMapped = currentValue && currentValue !== "__none__";
                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="pl-6 text-muted-foreground font-mono text-xs">pitch</TableCell>
                      <TableCell>
                        <span className="font-bold">{entry.pitchName}</span>
                        <span className="text-muted-foreground block text-xs">{entry.venueName}</span>
                      </TableCell>
                      <TableCell>
                        <Select value={currentValue} onValueChange={(val) => setPitchMappings(prev => ({ ...prev, [entry.key]: val }))}>
                          <SelectTrigger className="w-[300px]"><SelectValue placeholder="— Not mapped —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Not mapped —</SelectItem>
                            {systemPitches.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.venueName} — {p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">pitches.id</TableCell>
                      <TableCell className="text-right pr-6">
                        {isMapped ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Mapped</Badge> : <Badge variant="secondary">Unmapped</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPlayersTab = () => {
    const gradeOptions = Array.from(new Set(scrapedPlayers.map(p => p.grade))).filter(Boolean).sort().map(g => ({ label: g, value: g }));
    const teamOptions = Array.from(new Set(scrapedPlayers.map(p => p.team))).filter(Boolean).sort().map(t => ({ label: t, value: t }));

    const filtered = scrapedPlayers.filter(p => {
      if (playerFilters.grades.length > 0 && !playerFilters.grades.includes(p.grade)) return false;
      if (playerFilters.teams.length > 0 && !playerFilters.teams.includes(p.team)) return false;
      return true;
    });

    return (
      <div className="space-y-4">
        <div className="flex gap-4 flex-wrap">
          <MultiSelect title="Grade" options={gradeOptions} selected={playerFilters.grades} onChange={(s) => setPlayerFilters(p => ({ ...p, grades: s }))} className="w-[250px]" />
          <MultiSelect title="Team" options={teamOptions} selected={playerFilters.teams} onChange={(s) => setPlayerFilters(p => ({ ...p, teams: s }))} className="w-[250px]" />
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-4 pl-6">CSV Column</TableHead>
                  <TableHead className="py-4">Scraped Value</TableHead>
                  <TableHead className="py-4">Maps To</TableHead>
                  <TableHead className="py-4">Supabase Destination</TableHead>
                  <TableHead className="py-4 text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(entry => {
                  const currentValue = playerMappings[entry.key];
                  const isMapped = currentValue && currentValue !== "__none__";
                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="pl-6 text-muted-foreground font-mono text-xs">player_name</TableCell>
                      <TableCell>
                        <span className="font-bold">{entry.playerName}</span>
                        <span className="text-muted-foreground block text-xs">
                          {entry.clubName} • {entry.team} • {entry.grade} {entry.jersey ? `• #${entry.jersey}` : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Select value={currentValue} onValueChange={(val) => setPlayerMappings(prev => ({ ...prev, [entry.key]: val }))}>
                          <SelectTrigger className="w-[300px]"><SelectValue placeholder="— Not mapped —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Not mapped —</SelectItem>
                            {systemProfiles.map(profile => (
                              <SelectItem key={profile.id} value={profile.id}>{profile.firstName} {profile.lastName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">profiles.id</TableCell>
                      <TableCell className="text-right pr-6">
                        {isMapped ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Mapped</Badge> : <Badge variant="secondary">Unmapped</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderUmpiresTab = () => {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-4 pl-6">CSV Column</TableHead>
                  <TableHead className="py-4">Scraped Value</TableHead>
                  <TableHead className="py-4">Maps To</TableHead>
                  <TableHead className="py-4">Supabase Destination</TableHead>
                  <TableHead className="py-4 text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scrapedUmpires.map(entry => {
                  const currentValue = umpireMappings[entry.key];
                  const isMapped = currentValue && currentValue !== "__none__";
                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="pl-6 text-muted-foreground font-mono text-xs">umpire_1 / umpire_2</TableCell>
                      <TableCell><span className="font-bold">{entry.umpireName}</span></TableCell>
                      <TableCell>
                        <Select value={currentValue} onValueChange={(val) => setUmpireMappings(prev => ({ ...prev, [entry.key]: val }))}>
                          <SelectTrigger className="w-[300px]"><SelectValue placeholder="— Not mapped —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Not mapped —</SelectItem>
                            {systemProfiles.map(profile => (
                              <SelectItem key={profile.id} value={profile.id}>{profile.firstName} {profile.lastName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">profiles.id</TableCell>
                      <TableCell className="text-right pr-6">
                        {isMapped ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Mapped</Badge> : <Badge variant="secondary">Unmapped</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RevSports Mappings</h1>
          <p className="text-muted-foreground mt-1">Map scraped revsports data to SportStack system records.</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save All Mappings"}
        </Button>
      </div>

      <Tabs defaultValue="teams" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
          <TabsTrigger value="clubs">Clubs</TabsTrigger>
          <TabsTrigger value="venues">Venues</TabsTrigger>
          <TabsTrigger value="pitches">Pitches</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="umpires">Umpires</TabsTrigger>
        </TabsList>
        <TabsContent value="teams">{renderTeamsTab()}</TabsContent>
        <TabsContent value="grades">{renderGradesTab()}</TabsContent>
        <TabsContent value="clubs">{renderClubsTab()}</TabsContent>
        <TabsContent value="venues">{renderVenuesTab()}</TabsContent>
        <TabsContent value="pitches">{renderPitchesTab()}</TabsContent>
        <TabsContent value="players">{renderPlayersTab()}</TabsContent>
        <TabsContent value="umpires">{renderUmpiresTab()}</TabsContent>
      </Tabs>
    </div>
  );
}

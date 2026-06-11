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
import { Input } from "@/components/ui/input";

const supabase = originalSupabase as any;

// System Data Interfaces
interface SystemTeam { id: string; name: string; divisionName: string; clubName: string; }
interface SystemProfile { id: string; firstName: string; lastName: string; isPlaceholder: boolean; }
interface SystemVenue { id: string; name: string; }
interface SystemDivision { id: string; name: string; associationName: string; }
interface SystemClub { id: string; name: string; }
interface SystemPitch { id: string; name: string; venueName: string; }

// Scraped Data Interfaces
interface ScrapedTeam { teamName: string; clubName: string; grade: string; association: string; key: string; }
interface ScrapedGrade { grade: string; association: string; key: string; }
interface ScrapedClub { clubName: string; key: string; }
interface ScrapedVenue { venueName: string; key: string; }
interface ScrapedPitch { pitchName: string; venueName: string; key: string; }
interface ScrapedPlayer { playerName: string; clubName: string; team: string; grade: string; jersey: string; isFillin: boolean; key: string; }
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

  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({
    teams: "", grades: "", clubs: "", venues: "", pitches: "", players: "", umpires: ""
  });
  const [showUnmappedOnly, setShowUnmappedOnly] = useState<Record<string, boolean>>({
    teams: true, grades: true, clubs: true, venues: true, pitches: true, players: true, umpires: true
  });
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({
    teams: 1, grades: 1, clubs: 1, venues: 1, pitches: 1, players: 1, umpires: 1
  });
  const [rowsPerPage, setRowsPerPage] = useState<Record<string, number>>({
    teams: 25, grades: 25, clubs: 25, venues: 25, pitches: 25, players: 25, umpires: 25
  });

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
        supabase.from("revsports_players").select("team, player_name, grade, home_team, away_team, venue, club_name, jersey, umpire_1, umpire_2, pitch, association, is_fillin"),
        supabase.from("teams").select("id, name, club_id, division_id"),
        supabase.from("clubs").select("id, name"),
        supabase.from("divisions").select("id, name, associations(name)"),
        supabase.from("profiles").select("id, first_name, last_name, is_placeholder").eq("is_placeholder" as any, false),
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
        lastName: p.last_name || "",
        isPlaceholder: p.is_placeholder === true
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
        // Simple deduplication: key by team name, read club and grade from the same row
        playersData.forEach((row: any) => {
          const tName = row.team;
          if (!tName) return;
          if (!sTeamsMap.has(tName)) {
            sTeamsMap.set(tName, {
              teamName: tName,
              clubName: row.club_name || "",
              grade: row.grade || "",
              association: row.association || "",
              key: tName
            });
          }
        });

        // Also ensure home_team and away_team appear in the list, even if they have no matching team rows
        playersData.forEach((row: any) => {
          [row.home_team, row.away_team].filter(Boolean).forEach((tName: string) => {
            if (!sTeamsMap.has(tName)) {
              sTeamsMap.set(tName, { teamName: tName, clubName: "", grade: "", association: row.association || "", key: tName });
            }
          });
        });

        playersData.forEach((row: any) => {
          const clubName = row.club_name || "";
          const grade = row.grade || "";

          // Grades
          if (grade) {
            const association = row.association || "";
            const gradeKey = `${association}|||${grade}`;
            if (!sGradesMap.has(gradeKey)) {
              sGradesMap.set(gradeKey, { grade, association, key: gradeKey });
            }
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
            const isFillin = row.is_fillin === true;
            const key = `${row.player_name}|||${clubName}|||${grade}|||${tName}|||${jersey}|||${isFillin}`;
            if (!sPlayersMap.has(key)) {
              sPlayersMap.set(key, { playerName: row.player_name, clubName, team: tName, grade, jersey, isFillin, key });
            }
          }

          // Umpires
          if (row.umpire_1) {
            row.umpire_1.split(";").forEach((uName: string) => {
              const trimmed = uName.trim();
              if (trimmed && !sUmpiresMap.has(trimmed)) {
                sUmpiresMap.set(trimmed, { umpireName: trimmed, key: trimmed });
              }
            });
          }
          if (row.umpire_2) {
            row.umpire_2.split(";").forEach((uName: string) => {
              const trimmed = uName.trim();
              if (trimmed && !sUmpiresMap.has(trimmed)) {
                sUmpiresMap.set(trimmed, { umpireName: trimmed, key: trimmed });
              }
            });
          }
        });
      }

      // Sort Scraped Data
      const sortedTeams = Array.from(sTeamsMap.values()).sort((a, b) => a.association.localeCompare(b.association) || a.clubName.localeCompare(b.clubName) || a.grade.localeCompare(b.grade) || a.teamName.localeCompare(b.teamName));
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
          if (m.team_id) initTeamMappings[m.revsports_team_name] = m.team_id;
        });
      }
      if (gMapData) {
        gMapData.forEach((m: any) => {
          if (m.division_id) initGradeMappings[`${m.association || ""}|||${m.revsports_grade}`] = m.division_id;
        });
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
          if (m.profile_id) {
            const isFillin = m.is_fillin === true;
            const newKey = `${m.revsports_player_name}|||${m.club_name || ""}|||${m.grade || ""}|||${m.team || ""}|||${m.jersey || ""}|||${isFillin}`;
            initPlayerMappings[newKey] = m.profile_id;
          }
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
          return { revsports_team_name: key, club_name: "", division_name: "", team_id: id };
        });
        if (rowsToUpsert.length > 0) {
          const { error } = await supabase.from("revsports_team_mappings").upsert(rowsToUpsert, { onConflict: "revsports_team_name,club_name,division_name" });
          if (error) throw error;
        }
      } else if (activeTab === "grades") {
        const rowsToUpsert = Object.entries(gradeMappings).filter(([_, id]) => id !== "__none__").map(([key, id]) => {
          const [association, revsports_grade] = key.split("|||");
          return { revsports_grade, division_id: id };
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
        const rowsToUpsert = Object.entries(playerMappings).filter(([_, id]) => id !== "none" && id !== "__none__").map(([key, id]) => {
          const [revsports_player_name, club_name, grade, team, jersey, is_fillin_str] = key.split("|||");
          return { revsports_player_name, club_name: club_name || null, grade, team, jersey: jersey || null, is_fillin: is_fillin_str === "true", profile_id: id };
        });
        if (rowsToUpsert.length > 0) {
          const { error } = await supabase.from("revsports_player_mappings").upsert(rowsToUpsert, { onConflict: "revsports_player_name,club_name,grade,team,jersey,is_fillin" });
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
  const renderTabControls = (
    tabKey: string,
    searchValue: string,
    onSearchChange: (val: string) => void,
    unmappedOnly: boolean,
    onToggleUnmapped: (val: boolean) => void,
    totalRows: number,
    filteredRows: number
  ) => {
    return (
      <div className="flex flex-wrap items-center gap-4 justify-between mt-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[300px]">
          <Input
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setCurrentPage((prev) => ({ ...prev, [tabKey]: 1 }));
            }}
            className="w-[200px]"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onToggleUnmapped(!unmappedOnly);
              setCurrentPage((prev) => ({ ...prev, [tabKey]: 1 }));
            }}
          >
            {unmappedOnly ? "Show all" : "Unmapped only"}
          </Button>

          <span className="text-sm text-muted-foreground">
            Showing {filteredRows} of {totalRows} rows
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
          <Select
            value={String(rowsPerPage[tabKey])}
            onValueChange={(val) => {
              setRowsPerPage((prev) => ({ ...prev, [tabKey]: Number(val) }));
              setCurrentPage((prev) => ({ ...prev, [tabKey]: 1 }));
            }}
          >
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  const renderPaginationFooter = (tabKey: string, totalFilteredRows: number) => {
    const rPerPage = rowsPerPage[tabKey];
    const totalPages = Math.ceil(totalFilteredRows / rPerPage);
    if (totalPages <= 1) return null;

    const current = currentPage[tabKey];

    return (
      <div className="flex items-center justify-between mt-4 py-4 border-t px-6">
        <Button
          variant="outline"
          size="sm"
          disabled={current === 1}
          onClick={() => setCurrentPage((prev) => ({ ...prev, [tabKey]: Math.max(1, current - 1) }))}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground font-medium">
          Page {current} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={current === totalPages}
          onClick={() => setCurrentPage((prev) => ({ ...prev, [tabKey]: Math.min(totalPages, current + 1) }))}
        >
          Next
        </Button>
      </div>
    );
  };

  const renderTeamsTab = () => {
    const gradeOptions = Array.from(new Set(scrapedTeams.map(t => t.grade))).filter(Boolean).sort().map(g => ({ label: g, value: g }));
    const clubOptions = Array.from(new Set(scrapedTeams.map(t => t.clubName))).filter(Boolean).sort().map(c => ({ label: c, value: c }));

    let filtered = scrapedTeams.filter(t => {
      if (teamFilters.grades.length > 0 && !teamFilters.grades.includes(t.grade)) return false;
      if (teamFilters.clubs.length > 0 && !teamFilters.clubs.includes(t.clubName)) return false;
      return true;
    });

    const totalRows = filtered.length;

    if (showUnmappedOnly["teams"]) {
      filtered = filtered.filter(entry => {
        const val = teamMappings[entry.key];
        return val === "none" || val === "__none__" || !val;
      });
    }

    if (searchTerms["teams"]) {
      const searchLower = searchTerms["teams"].toLowerCase();
      filtered = filtered.filter(entry => entry.teamName.toLowerCase().includes(searchLower));
    }

    const totalFilteredCount = filtered.length;

    const startIdx = (currentPage["teams"] - 1) * rowsPerPage["teams"];
    const paginated = filtered.slice(startIdx, startIdx + rowsPerPage["teams"]);

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-4 flex-wrap">
            <MultiSelect title="Grade" options={gradeOptions} selected={teamFilters.grades} onChange={(s) => { setTeamFilters(p => ({ ...p, grades: s })); setCurrentPage(prev => ({ ...prev, teams: 1 })); }} className="w-[250px]" />
            <MultiSelect title="Club (Scraped)" options={clubOptions} selected={teamFilters.clubs} onChange={(s) => { setTeamFilters(p => ({ ...p, clubs: s })); setCurrentPage(prev => ({ ...prev, teams: 1 })); }} className="w-[250px]" />
          </div>
          {renderTabControls(
            "teams",
            searchTerms["teams"],
            (val) => setSearchTerms(prev => ({ ...prev, teams: val })),
            showUnmappedOnly["teams"],
            (val) => setShowUnmappedOnly(prev => ({ ...prev, teams: val })),
            totalRows,
            totalFilteredCount
          )}
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
                {paginated.map(entry => {
                  const currentValue = teamMappings[entry.key];
                  const isMapped = currentValue && currentValue !== "__none__";
                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="pl-6 text-muted-foreground font-mono text-xs">team / home_team / away_team</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{entry.teamName}</div>
                          <div className="text-xs text-muted-foreground">{[entry.clubName, entry.grade].filter(Boolean).join(" • ")}</div>
                        </div>
                      </TableCell>
                      <TableCell className="w-64 max-w-xs">
                        <Select value={currentValue} onValueChange={(val) => setTeamMappings(prev => ({ ...prev, [entry.key]: val }))}>
                          <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="— Not mapped —" /></SelectTrigger>
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
        {renderPaginationFooter("teams", totalFilteredCount)}
      </div>
    );
  };

  const renderGradesTab = () => {
    const associationOptions = Array.from(new Set(systemDivisions.map(d => d.associationName))).filter(Boolean).sort();
    
    const filteredDivisions = gradeTabAssociationFilter === "all"
      ? systemDivisions
      : systemDivisions.filter(d => d.associationName === gradeTabAssociationFilter);

    let filtered = scrapedGrades;
    const totalRows = filtered.length;

    if (showUnmappedOnly["grades"]) {
      filtered = filtered.filter(entry => {
        const val = gradeMappings[entry.key];
        return val === "none" || val === "__none__" || !val;
      });
    }

    if (searchTerms["grades"]) {
      const searchLower = searchTerms["grades"].toLowerCase();
      filtered = filtered.filter(entry => entry.grade.toLowerCase().includes(searchLower));
    }

    const totalFilteredCount = filtered.length;
    const startIdx = (currentPage["grades"] - 1) * rowsPerPage["grades"];
    const paginated = filtered.slice(startIdx, startIdx + rowsPerPage["grades"]);

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-4 flex-wrap">
            <div className="w-[250px]">
              <Select value={gradeTabAssociationFilter} onValueChange={(val) => { setGradeTabAssociationFilter(val); setCurrentPage(prev => ({ ...prev, grades: 1 })); }}>
                <SelectTrigger className="w-full min-w-0 overflow-hidden">
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
          {renderTabControls(
            "grades",
            searchTerms["grades"],
            (val) => setSearchTerms(prev => ({ ...prev, grades: val })),
            showUnmappedOnly["grades"],
            (val) => setShowUnmappedOnly(prev => ({ ...prev, grades: val })),
            totalRows,
            totalFilteredCount
          )}
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
                {paginated.map(entry => {
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
                      <TableCell>
                        {entry.association && (
                          <span className="text-muted-foreground block text-xs">{entry.association}</span>
                        )}
                        <span className="font-bold">{entry.grade}</span>
                      </TableCell>
                      <TableCell className="w-64 max-w-xs">
                        <Select value={currentValue} onValueChange={(val) => setGradeMappings(prev => ({ ...prev, [entry.key]: val }))}>
                          <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="— Not mapped —" /></SelectTrigger>
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
        {renderPaginationFooter("grades", totalFilteredCount)}
      </div>
    );
  };

  const renderClubsTab = () => {
    let filtered = scrapedClubs;
    const totalRows = filtered.length;

    if (showUnmappedOnly["clubs"]) {
      filtered = filtered.filter(entry => {
        const val = clubMappings[entry.key];
        return val === "none" || val === "__none__" || !val;
      });
    }

    if (searchTerms["clubs"]) {
      const searchLower = searchTerms["clubs"].toLowerCase();
      filtered = filtered.filter(entry => entry.clubName.toLowerCase().includes(searchLower));
    }

    const totalFilteredCount = filtered.length;
    const startIdx = (currentPage["clubs"] - 1) * rowsPerPage["clubs"];
    const paginated = filtered.slice(startIdx, startIdx + rowsPerPage["clubs"]);

    return (
      <div className="space-y-4">
        {renderTabControls(
          "clubs",
          searchTerms["clubs"],
          (val) => setSearchTerms(prev => ({ ...prev, clubs: val })),
          showUnmappedOnly["clubs"],
          (val) => setShowUnmappedOnly(prev => ({ ...prev, clubs: val })),
          totalRows,
          totalFilteredCount
        )}
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
                {paginated.map(entry => {
                  const currentValue = clubMappings[entry.key];
                  const isMapped = currentValue && currentValue !== "__none__";
                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="pl-6 text-muted-foreground font-mono text-xs">club_name</TableCell>
                      <TableCell><span className="font-bold">{entry.clubName}</span></TableCell>
                      <TableCell className="w-64 max-w-xs">
                        <Select value={currentValue} onValueChange={(val) => setClubMappings(prev => ({ ...prev, [entry.key]: val }))}>
                          <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="— Not mapped —" /></SelectTrigger>
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
        {renderPaginationFooter("clubs", totalFilteredCount)}
      </div>
    );
  };

  const renderVenuesTab = () => {
    let filtered = scrapedVenues;
    const totalRows = filtered.length;

    if (showUnmappedOnly["venues"]) {
      filtered = filtered.filter(entry => {
        const val = venueMappings[entry.key];
        return val === "none" || val === "__none__" || !val;
      });
    }

    if (searchTerms["venues"]) {
      const searchLower = searchTerms["venues"].toLowerCase();
      filtered = filtered.filter(entry => entry.venueName.toLowerCase().includes(searchLower));
    }

    const totalFilteredCount = filtered.length;
    const startIdx = (currentPage["venues"] - 1) * rowsPerPage["venues"];
    const paginated = filtered.slice(startIdx, startIdx + rowsPerPage["venues"]);

    return (
      <div className="space-y-4">
        {renderTabControls(
          "venues",
          searchTerms["venues"],
          (val) => setSearchTerms(prev => ({ ...prev, venues: val })),
          showUnmappedOnly["venues"],
          (val) => setShowUnmappedOnly(prev => ({ ...prev, venues: val })),
          totalRows,
          totalFilteredCount
        )}
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
                {paginated.map(entry => {
                  const currentValue = venueMappings[entry.key];
                  const isMapped = currentValue && currentValue !== "__none__";
                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="pl-6 text-muted-foreground font-mono text-xs">venue</TableCell>
                      <TableCell><span className="font-bold">{entry.venueName}</span></TableCell>
                      <TableCell className="w-64 max-w-xs">
                        <Select value={currentValue} onValueChange={(val) => setVenueMappings(prev => ({ ...prev, [entry.key]: val }))}>
                          <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="— Not mapped —" /></SelectTrigger>
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
        {renderPaginationFooter("venues", totalFilteredCount)}
      </div>
    );
  };

  const renderPitchesTab = () => {
    let filtered = scrapedPitches;
    const totalRows = filtered.length;

    if (showUnmappedOnly["pitches"]) {
      filtered = filtered.filter(entry => {
        const val = pitchMappings[entry.key];
        return val === "none" || val === "__none__" || !val;
      });
    }

    if (searchTerms["pitches"]) {
      const searchLower = searchTerms["pitches"].toLowerCase();
      filtered = filtered.filter(entry => entry.pitchName.toLowerCase().includes(searchLower));
    }

    const totalFilteredCount = filtered.length;
    const startIdx = (currentPage["pitches"] - 1) * rowsPerPage["pitches"];
    const paginated = filtered.slice(startIdx, startIdx + rowsPerPage["pitches"]);

    return (
      <div className="space-y-4">
        {renderTabControls(
          "pitches",
          searchTerms["pitches"],
          (val) => setSearchTerms(prev => ({ ...prev, pitches: val })),
          showUnmappedOnly["pitches"],
          (val) => setShowUnmappedOnly(prev => ({ ...prev, pitches: val })),
          totalRows,
          totalFilteredCount
        )}
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
                {paginated.map(entry => {
                  const currentValue = pitchMappings[entry.key];
                  const isMapped = currentValue && currentValue !== "__none__";
                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="pl-6 text-muted-foreground font-mono text-xs">pitch</TableCell>
                      <TableCell>
                        <span className="font-bold">{entry.pitchName}</span>
                        <span className="text-muted-foreground block text-xs">{entry.venueName}</span>
                      </TableCell>
                      <TableCell className="w-64 max-w-xs">
                        <Select value={currentValue} onValueChange={(val) => setPitchMappings(prev => ({ ...prev, [entry.key]: val }))}>
                          <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="— Not mapped —" /></SelectTrigger>
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
        {renderPaginationFooter("pitches", totalFilteredCount)}
      </div>
    );
  };

  const renderPlayersTab = () => {
    const gradeOptions = Array.from(new Set(scrapedPlayers.map(p => p.grade))).filter(Boolean).sort().map(g => ({ label: g, value: g }));
    const teamOptions = Array.from(new Set(scrapedPlayers.map(p => p.team))).filter(Boolean).sort().map(t => ({ label: t, value: t }));

    let filtered = scrapedPlayers.filter(p => {
      if (playerFilters.grades.length > 0 && !playerFilters.grades.includes(p.grade)) return false;
      if (playerFilters.teams.length > 0 && !playerFilters.teams.includes(p.team)) return false;
      return true;
    });

    const totalRows = filtered.length;

    if (showUnmappedOnly["players"]) {
      filtered = filtered.filter(entry => {
        const val = playerMappings[entry.key];
        return val === "none" || val === "__none__" || !val;
      });
    }

    if (searchTerms["players"]) {
      const searchLower = searchTerms["players"].toLowerCase();
      filtered = filtered.filter(entry => entry.playerName.toLowerCase().includes(searchLower));
    }

    const totalFilteredCount = filtered.length;
    const startIdx = (currentPage["players"] - 1) * rowsPerPage["players"];
    const paginated = filtered.slice(startIdx, startIdx + rowsPerPage["players"]);

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-4 flex-wrap">
            <MultiSelect title="Grade" options={gradeOptions} selected={playerFilters.grades} onChange={(s) => { setPlayerFilters(p => ({ ...p, grades: s })); setCurrentPage(prev => ({ ...prev, players: 1 })); }} className="w-[250px]" />
            <MultiSelect title="Team" options={teamOptions} selected={playerFilters.teams} onChange={(s) => { setPlayerFilters(p => ({ ...p, teams: s })); setCurrentPage(prev => ({ ...prev, players: 1 })); }} className="w-[250px]" />
          </div>
          {renderTabControls(
            "players",
            searchTerms["players"],
            (val) => setSearchTerms(prev => ({ ...prev, players: val })),
            showUnmappedOnly["players"],
            (val) => setShowUnmappedOnly(prev => ({ ...prev, players: val })),
            totalRows,
            totalFilteredCount
          )}
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
                {paginated.map(entry => {
                  const currentValue = playerMappings[entry.key];
                  const isMapped = currentValue && currentValue !== "__none__";
                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="pl-6 text-muted-foreground font-mono text-xs">player_name</TableCell>
                      <TableCell>
                        <span className="font-bold">{entry.playerName}</span>
                        <span className="text-muted-foreground block text-xs">
                          {entry.clubName} • {entry.team} • {entry.grade}
                          {entry.jersey ? ` • #${entry.jersey}` : ""}
                          {entry.isFillin ? " (fill-in)" : ""}
                        </span>
                      </TableCell>
                      <TableCell className="w-64 max-w-xs">
                        <Select value={currentValue} onValueChange={(val) => setPlayerMappings(prev => ({ ...prev, [entry.key]: val }))}>
                          <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="— Not mapped —" /></SelectTrigger>
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
        {renderPaginationFooter("players", totalFilteredCount)}
      </div>
    );
  };

  const renderUmpiresTab = () => {
    let filtered = scrapedUmpires;
    const totalRows = filtered.length;

    if (showUnmappedOnly["umpires"]) {
      filtered = filtered.filter(entry => {
        const val = umpireMappings[entry.key];
        return val === "none" || val === "__none__" || !val;
      });
    }

    if (searchTerms["umpires"]) {
      const searchLower = searchTerms["umpires"].toLowerCase();
      filtered = filtered.filter(entry => entry.umpireName.toLowerCase().includes(searchLower));
    }

    const totalFilteredCount = filtered.length;
    const startIdx = (currentPage["umpires"] - 1) * rowsPerPage["umpires"];
    const paginated = filtered.slice(startIdx, startIdx + rowsPerPage["umpires"]);

    return (
      <div className="space-y-4">
        {renderTabControls(
          "umpires",
          searchTerms["umpires"],
          (val) => setSearchTerms(prev => ({ ...prev, umpires: val })),
          showUnmappedOnly["umpires"],
          (val) => setShowUnmappedOnly(prev => ({ ...prev, umpires: val })),
          totalRows,
          totalFilteredCount
        )}
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
                {paginated.map(entry => {
                  const currentValue = umpireMappings[entry.key];
                  const isMapped = currentValue && currentValue !== "__none__";
                  return (
                    <TableRow key={entry.key}>
                      <TableCell className="pl-6 text-muted-foreground font-mono text-xs">umpire_1 / umpire_2</TableCell>
                      <TableCell><span className="font-bold">{entry.umpireName}</span></TableCell>
                      <TableCell className="w-64 max-w-xs">
                        <Select value={currentValue} onValueChange={(val) => setUmpireMappings(prev => ({ ...prev, [entry.key]: val }))}>
                          <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="— Not mapped —" /></SelectTrigger>
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
        {renderPaginationFooter("umpires", totalFilteredCount)}
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

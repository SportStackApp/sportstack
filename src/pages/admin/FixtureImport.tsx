import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle, ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Download, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface FixtureImportRow {
  row_number: number;
  date: string;
  time: string;
  venue: string;
  pitch: string;
  home_team: string;
  away_team: string;
}

interface ParsedFixture extends FixtureImportRow {
  errors: string[];
  home_team_id: string | null;
  away_team_id: string | null;
  division_id: string | null;
  season_id: string | null;
  venue_id: string | null;
  pitch_id: string | null;
  resolved_venue: string;
  resolved_home_team: string;
  resolved_away_team: string;
  resolved_division: string;
}

interface TeamReference {
  id: string;
  name: string;
  label: string;
  divisionId: string | null;
  divisionName: string;
  seasonId: string | null;
}

const normaliseLookupKey = (value: string) => value.trim().toLocaleLowerCase("en-AU").replace(/\s+/g, " ");

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : fallback;

function parseDate(val: unknown): string {
  if (!val) return "";
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${year}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  const num = Number(val);
  if (!isNaN(num) && num > 1000 && num < 100000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return str;
}

function parseTime(val: unknown): string {
  if (!val) return "";
  const num = Number(val);
  if (!isNaN(num) && num >= 0 && num < 1) {
    const totalMinutes = Math.round(num * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let h = parseInt(match[1]);
    const m = match[2];
    const period = match[3]?.toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  if (/^\d{1,2}:\d{2}$/.test(str)) return str;
  return str;
}

function getField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return "";
}

const FixtureImport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isAnyAdmin, isSuperAdmin, scopedAssociationIds, scopedClubIds, scopedTeamIds: adminScopedTeamIds } = useAdminScope();

  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [rows, setRows] = useState<ParsedFixture[]>([]);
  const [importDone, setImportDone] = useState(false);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [associations, setAssociations] = useState<{ id: string; name: string; timezone: string }[]>([]);
  const [clubs, setClubs] = useState<{ id: string; name: string; association_id: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; club_id: string; division_id: string | null }[]>([]);
  const [divisions, setDivisions] = useState<{ id: string; name: string; association_id: string; season_id: string | null }[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string; association_id: string | null }[]>([]);
  const [pitches, setPitches] = useState<{ id: string; name: string; venue_id: string }[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState("");

  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) navigate("/admin");
  }, [scopeLoading, isAnyAdmin, navigate]);

  useEffect(() => {
    const load = async () => {
      setReferenceLoading(true);
      setReferenceError(null);
      const [aRes, cRes, tRes, dRes, vRes, pRes] = await Promise.all([
        supabase.from("associations").select("id, name, timezone").order("name"),
        supabase.from("clubs").select("id, name, association_id").order("name"),
        supabase.from("teams").select("id, name, club_id, division_id").order("name"),
        supabase.from("divisions").select("id, name, association_id, season_id").order("name"),
        supabase.from("venues").select("id, name, association_id").order("name"),
        supabase.from("pitches").select("id, name, venue_id").order("name"),
      ]);
      const firstError = [aRes.error, cRes.error, tRes.error, dRes.error, vRes.error, pRes.error].find(Boolean);
      if (firstError) {
        const message = getErrorMessage(firstError, "Reference data could not be loaded.");
        setReferenceError(message);
        toast({ title: "Fixture import unavailable", description: message, variant: "destructive" });
      } else {
        setAssociations(aRes.data || []);
        setClubs(cRes.data || []);
        setTeams(tRes.data || []);
        setDivisions(dRes.data || []);
        setVenues(vRes.data || []);
        setPitches(pRes.data || []);
      }
      setReferenceLoading(false);
    };
    void load();
  }, [toast]);

  useEffect(() => {
    if (!scopeLoading && !isSuperAdmin && scopedAssociationIds.length === 1) {
      setSelectedAssociationId(scopedAssociationIds[0]);
    }
  }, [scopeLoading, isSuperAdmin, scopedAssociationIds]);

  const availableAssociations = isSuperAdmin
    ? associations
    : associations.filter((association) => scopedAssociationIds.includes(association.id));

  const assocClubs = useMemo(() => {
    const filtered = clubs.filter((club) => club.association_id === selectedAssociationId);
    if (isSuperAdmin) return filtered;
    if (scopedClubIds.length > 0) return filtered.filter((club) => scopedClubIds.includes(club.id));
    if (scopedAssociationIds.includes(selectedAssociationId)) return filtered;
    return filtered.filter((club) => teams.some((team) => team.club_id === club.id && adminScopedTeamIds.includes(team.id)));
  }, [selectedAssociationId, clubs, isSuperAdmin, scopedClubIds, scopedAssociationIds, adminScopedTeamIds, teams]);

  const assocTeams = useMemo(() => {
    const clubIds = new Set(assocClubs.map((club) => club.id));
    const canAccessWholeAssociation = isSuperAdmin || scopedAssociationIds.includes(selectedAssociationId);
    return teams.filter((team) =>
      clubIds.has(team.club_id)
      && (
        canAccessWholeAssociation
        || scopedClubIds.includes(team.club_id)
        || adminScopedTeamIds.includes(team.id)
      ),
    );
  }, [adminScopedTeamIds, assocClubs, isSuperAdmin, scopedAssociationIds, scopedClubIds, selectedAssociationId, teams]);

  const teamReferences = useMemo<TeamReference[]>(() => {
    const clubById = new Map(assocClubs.map((club) => [club.id, club]));
    const divisionById = new Map(
      divisions
        .filter((division) => division.association_id === selectedAssociationId)
        .map((division) => [division.id, division]),
    );

    return assocTeams
      .map((team) => {
        const club = clubById.get(team.club_id);
        const division = team.division_id ? divisionById.get(team.division_id) : undefined;
        const divisionName = division?.name || "Unassigned division";
        return {
          id: team.id,
          name: team.name,
          label: [club?.name || "Unknown club", divisionName, team.name].join(" - "),
          divisionId: division?.id || null,
          divisionName,
          seasonId: division?.season_id || null,
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [assocClubs, assocTeams, divisions, selectedAssociationId]);

  const teamLookups = useMemo(() => {
    const full = new Map<string, TeamReference[]>();
    const short = new Map<string, TeamReference[]>();
    teamReferences.forEach((team) => {
      const fullKey = normaliseLookupKey(team.label);
      const shortKey = normaliseLookupKey(team.name);
      full.set(fullKey, [...(full.get(fullKey) || []), team]);
      short.set(shortKey, [...(short.get(shortKey) || []), team]);
    });
    return { full, short };
  }, [teamReferences]);

  const venueLookup = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    venues
      .filter((venue) => !selectedAssociationId || venue.association_id === selectedAssociationId)
      .forEach((venue) => map.set(venue.name.toLowerCase().trim(), { id: venue.id, name: venue.name }));
    return map;
  }, [venues, selectedAssociationId]);

  const validate = useCallback((parsed: FixtureImportRow[]): ParsedFixture[] => {
    const resolveTeam = (value: string) => {
      const lookupKey = normaliseLookupKey(value);
      const fullMatches = teamLookups.full.get(lookupKey) || [];
      if (fullMatches.length === 1) return { team: fullMatches[0], ambiguousCount: 0 };
      if (fullMatches.length > 1) return { team: null, ambiguousCount: fullMatches.length };
      const shortMatches = teamLookups.short.get(lookupKey) || [];
      if (shortMatches.length === 1) return { team: shortMatches[0], ambiguousCount: 0 };
      return { team: null, ambiguousCount: shortMatches.length };
    };

    const validated = parsed.map((row) => {
      const errors: string[] = [];
      let home_team_id: string | null = null;
      let away_team_id: string | null = null;
      let division_id: string | null = null;
      let season_id: string | null = null;
      let venue_id: string | null = null;
      let pitch_id: string | null = null;
      let resolved_venue = row.venue;
      let resolved_home_team = row.home_team;
      let resolved_away_team = row.away_team;
      let resolved_division = "";

      if (!row.date) errors.push("Date required");
      if (!row.time) errors.push("Time required");

      if (!row.home_team) {
        errors.push("Home team required");
      } else {
        const match = resolveTeam(row.home_team);
        if (match.team) {
          home_team_id = match.team.id;
          resolved_home_team = match.team.label;
        } else if (match.ambiguousCount > 1) {
          errors.push(`Home team '${row.home_team}' matches ${match.ambiguousCount} teams. Use the full Club - Division - Team value.`);
        } else {
          errors.push(`Home team '${row.home_team}' not found`);
        }
      }

      if (!row.away_team) {
        errors.push("Away team required");
      } else {
        const match = resolveTeam(row.away_team);
        if (match.team) {
          away_team_id = match.team.id;
          resolved_away_team = match.team.label;
        } else if (match.ambiguousCount > 1) {
          errors.push(`Away team '${row.away_team}' matches ${match.ambiguousCount} teams. Use the full Club - Division - Team value.`);
        } else {
          errors.push(`Away team '${row.away_team}' not found`);
        }
      }

      const homeReference = home_team_id ? teamReferences.find((team) => team.id === home_team_id) : null;
      const awayReference = away_team_id ? teamReferences.find((team) => team.id === away_team_id) : null;
      if (home_team_id && away_team_id && home_team_id === away_team_id) {
        errors.push("Home and away teams must be different");
      } else if (homeReference && awayReference) {
        if (!homeReference.divisionId || !awayReference.divisionId) {
          errors.push("Both teams need an assigned division before this fixture can be imported");
        } else if (homeReference.divisionId !== awayReference.divisionId) {
          errors.push(`Teams belong to different divisions: ${homeReference.divisionName} and ${awayReference.divisionName}`);
        } else if (!homeReference.seasonId) {
          errors.push(`Division '${homeReference.divisionName}' needs an assigned season before importing fixtures`);
        } else {
          division_id = homeReference.divisionId;
          season_id = homeReference.seasonId;
          resolved_division = homeReference.divisionName;
        }
      }

      if (!row.venue) {
        errors.push("Venue required");
      } else {
        const match = venueLookup.get(row.venue.toLowerCase().trim());
        if (match) {
          venue_id = match.id;
          resolved_venue = match.name;
        } else {
          errors.push(`Venue '${row.venue}' not found in venues table`);
        }
      }

      if (row.pitch && venue_id) {
        const pitch = pitches.find(
          (item) => item.venue_id === venue_id && item.name.toLowerCase().trim() === row.pitch.toLowerCase().trim()
        );
        if (pitch) pitch_id = pitch.id;
        else errors.push(`Pitch '${row.pitch}' does not belong to venue '${row.venue}'`);
      }

      return {
        ...row,
        errors,
        home_team_id,
        away_team_id,
        division_id,
        season_id,
        venue_id,
        pitch_id,
        resolved_venue,
        resolved_home_team,
        resolved_away_team,
        resolved_division,
      };
    });

    const duplicateCounts = new Map<string, number>();
    validated.forEach((row) => {
      if (!row.date || !row.time || !row.home_team_id || !row.away_team_id) return;
      const teamPair = [row.home_team_id, row.away_team_id].sort().join(":");
      const key = [row.date, row.time, teamPair].join("|");
      duplicateCounts.set(key, (duplicateCounts.get(key) || 0) + 1);
    });

    return validated.map((row) => {
      if (!row.date || !row.time || !row.home_team_id || !row.away_team_id) return row;
      const teamPair = [row.home_team_id, row.away_team_id].sort().join(":");
      const key = [row.date, row.time, teamPair].join("|");
      return (duplicateCounts.get(key) || 0) > 1
        ? { ...row, errors: [...row.errors, "Duplicate fixture in this spreadsheet"] }
        : row;
    });
  }, [pitches, teamLookups, teamReferences, venueLookup]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportDone(false);

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      try {
        const data = new Uint8Array(readerEvent.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        const parsed = json.map((row, index) => ({
          row_number: index + 2,
          date: parseDate(row["date *"] || row.date || row.Date || ""),
          time: parseTime(row["time *"] || row.time || row.Time || ""),
          venue: getField(row, "venue *", "venue", "Venue"),
          pitch: getField(row, "pitch", "Pitch", "Field"),
          home_team: getField(row, "home_team *", "home_team", "Home Team", "Home"),
          away_team: getField(row, "away_team *", "away_team", "Away Team", "Away"),
        }));
        setRows(validate(parsed));
      } catch (error) {
        console.error(error);
        toast({ title: "Parse Error", description: "Could not read the spreadsheet.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    if (rows.length > 0) {
      setRows((previous) => validate(previous.map((row) => ({
        row_number: row.row_number,
        date: row.date,
        time: row.time,
        venue: row.venue,
        pitch: row.pitch,
        home_team: row.home_team,
        away_team: row.away_team,
      }))));
    }
  }, [rows.length, selectedAssociationId, teamLookups, venueLookup, validate]);

  const validRows = rows.filter((row) => row.errors.length === 0);
  const errorRows = rows.filter((row) => row.errors.length > 0);

  const handleSubmit = async () => {
    if (validRows.length === 0 || errorRows.length > 0 || submitting) {
      if (errorRows.length > 0) {
        toast({
          title: "Fix the spreadsheet first",
          description: "All rows must be valid before any fixtures are imported.",
          variant: "destructive",
        });
      }
      return;
    }
    setSubmitting(true);

    const inserts = validRows.map((row) => ({
      home_team_id: row.home_team_id,
      away_team_id: row.away_team_id,
      division_id: row.division_id,
      season_id: row.season_id,
      fixture_date: `${row.date}T${row.time}:00`,
      venue_id: row.venue_id,
      pitch_id: row.pitch_id,
      status: "SCHEDULED" as const,
    }));

    const { error } = await supabase.from("fixtures").insert(inserts);
    setSubmitting(false);

    if (error) {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
      return;
    }

    setImportDone(true);
    toast({ title: "Fixtures Imported", description: `${validRows.length} fixture(s) imported.` });
  };

  const downloadTemplate = () => {
    const headers = ["date *", "time *", "venue *", "pitch", "home_team *", "away_team *"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws["!cols"] = headers.map((header) => ({ wch: Math.max(header.length + 4, 14) }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "Fixture Import");

    const venuePitchList = pitches
      .filter((pitch) => venues.some((venue) => venue.id === pitch.venue_id && venue.association_id === selectedAssociationId))
      .map((pitch) => {
        const venue = venues.find((item) => item.id === pitch.venue_id);
        return venue ? `${venue.name} - ${pitch.name}` : pitch.name;
      });
    const teamsList = teamReferences.map((team) => team.label);
    const clubsList = assocClubs.map((club) => club.name);

    const maxLen = Math.max(venuePitchList.length, teamsList.length, clubsList.length);
    const refData: string[][] = [["Venue - Pitch", "Teams (use exact full label)", "Clubs (for reference)"]];
    for (let index = 0; index < maxLen; index++) {
      refData.push([venuePitchList[index] || "", teamsList[index] || "", clubsList[index] || ""]);
    }
    const refWs = XLSX.utils.aoa_to_sheet(refData);
    refWs["!cols"] = [{ wch: 28 }, { wch: 48 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(workbook, refWs, "Allowed Values");

    XLSX.writeFile(workbook, "fixture_import_template.xlsx");
  };

  if (scopeLoading) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/fixtures")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Fixture Import</h1>
          <p className="text-muted-foreground">Upload a spreadsheet to import fixtures</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Import Scope</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {referenceError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Reference data could not be loaded. Refresh before importing fixtures. {referenceError}</span>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Association</Label>
              <Select
                value={selectedAssociationId}
                onValueChange={setSelectedAssociationId}
                disabled={referenceLoading || Boolean(referenceError) || (!isSuperAdmin && scopedAssociationIds.length <= 1)}
              >
                <SelectTrigger><SelectValue placeholder="Select association" /></SelectTrigger>
                <SelectContent>
                  {availableAssociations.map((association) => <SelectItem key={association.id} value={association.id}>{association.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Association bounds team and venue selections. Use the exact Club - Division - Team
            labels from the template; a short team name is accepted only when it is unique.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Upload Spreadsheet</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Label htmlFor="fixture-upload" className={`flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${(!selectedAssociationId || referenceLoading || referenceError) && "opacity-50 pointer-events-none"}`}>
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Choose .xlsx or .csv file</span>
            </Label>
            <Input key={fileKey} id="fixture-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} disabled={!selectedAssociationId || referenceLoading || Boolean(referenceError)} />
            <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={!selectedAssociationId || referenceLoading || Boolean(referenceError)}>
              <Download className="h-4 w-4 mr-1" />
              Download Template
            </Button>
            {fileName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                {fileName}
                <button
                  onClick={() => { setFileName(""); setRows([]); setImportDone(false); setFileKey((key) => key + 1); }}
                  className="ml-1 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && !importDone && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Preview ({rows.length} rows)</CardTitle>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-green-600 border-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />{validRows.length} valid
              </Badge>
              {errorRows.length > 0 && (
                <Badge variant="outline" className="text-destructive border-destructive/30">
                  <XCircle className="h-3 w-3 mr-1" />{errorRows.length} errors
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Pitch</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Home Team</TableHead>
                    <TableHead>Away Team</TableHead>
                    <TableHead className="w-48">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.row_number} className={row.errors.length > 0 ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-xs">{row.row_number}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{row.date}</TableCell>
                      <TableCell className="text-xs">{row.time}</TableCell>
                      <TableCell className="text-xs">{row.resolved_venue || row.venue}</TableCell>
                      <TableCell className="text-xs">{row.pitch}</TableCell>
                      <TableCell className="text-xs">{row.resolved_division || "—"}</TableCell>
                      <TableCell className="text-xs">{row.resolved_home_team || row.home_team}</TableCell>
                      <TableCell className="text-xs">{row.resolved_away_team || row.away_team}</TableCell>
                      <TableCell>
                        {row.errors.length === 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="space-y-0.5">
                            {row.errors.map((error, index) => (
                              <div key={index} className="flex items-start gap-1">
                                <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                                <span className="text-xs text-destructive">{error}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {importDone ? (
        <Card>
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="font-medium">{validRows.length} fixture(s) imported successfully!</p>
            <Button variant="link" onClick={() => navigate("/admin/fixtures")}>View Fixtures</Button>
          </CardContent>
        </Card>
      ) : (
        rows.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full" size="lg" disabled={submitting || validRows.length === 0 || errorRows.length > 0}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {submitting
                  ? "Importing..."
                  : errorRows.length > 0
                    ? `Fix ${errorRows.length} row(s) before importing`
                    : `Review and Import ${validRows.length} Fixture(s)`}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Import {validRows.length} scheduled fixture(s)?</AlertDialogTitle>
                <AlertDialogDescription>
                  This creates every previewed fixture in {availableAssociations.find((association) => association.id === selectedAssociationId)?.name || "the selected association"}.
                  Existing fixtures are not changed. Check the teams, division, date, time, venue and pitch before continuing.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleSubmit()} disabled={submitting}>
                  {submitting ? "Importing..." : "Import Fixtures"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )
      )}
    </div>
  );
};

export default FixtureImport;

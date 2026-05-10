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
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Download, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface ParsedFixture {
  row_number: number;
  date: string;
  time: string;
  venue: string;
  pitch: string;
  home_team: string;
  away_team: string;
  errors: string[];
  home_team_id: string | null;
  away_team_id: string | null;
  venue_id: string | null;
  pitch_id: string | null;
  resolved_venue: string;
}

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
  const [associations, setAssociations] = useState<{ id: string; name: string }[]>([]);
  const [clubs, setClubs] = useState<{ id: string; name: string; association_id: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; club_id: string }[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string; association_id: string | null }[]>([]);
  const [pitches, setPitches] = useState<{ id: string; name: string; venue_id: string }[]>([]);
  const [selectedAssociationId, setSelectedAssociationId] = useState("");

  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) navigate("/admin");
  }, [scopeLoading, isAnyAdmin, navigate]);

  useEffect(() => {
    const load = async () => {
      const [aRes, cRes, tRes, vRes, pRes] = await Promise.all([
        supabase.from("associations").select("id, name").order("name"),
        supabase.from("clubs").select("id, name, association_id").order("name"),
        supabase.from("teams").select("id, name, club_id").order("name"),
        supabase.from("venues").select("id, name, association_id").order("name"),
        supabase.from("pitches").select("id, name, venue_id").order("name"),
      ]);
      setAssociations(aRes.data || []);
      setClubs(cRes.data || []);
      setTeams(tRes.data || []);
      setVenues(vRes.data || []);
      setPitches(pRes.data || []);
    };
    load();
  }, []);

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
    return teams.filter((team) => clubIds.has(team.club_id));
  }, [assocClubs, teams]);

  const teamLookup = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    assocTeams.forEach((team) => map.set(team.name.toLowerCase().trim(), { id: team.id, name: team.name }));
    return map;
  }, [assocTeams]);

  const venueLookup = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    venues
      .filter((venue) => !selectedAssociationId || venue.association_id === selectedAssociationId)
      .forEach((venue) => map.set(venue.name.toLowerCase().trim(), { id: venue.id, name: venue.name }));
    return map;
  }, [venues, selectedAssociationId]);

  const validate = useCallback((parsed: Omit<ParsedFixture, "errors" | "home_team_id" | "away_team_id" | "venue_id" | "pitch_id" | "resolved_venue">[]): ParsedFixture[] => {
    return parsed.map((row) => {
      const errors: string[] = [];
      let home_team_id: string | null = null;
      let away_team_id: string | null = null;
      let venue_id: string | null = null;
      let pitch_id: string | null = null;
      let resolved_venue = row.venue;

      if (!row.date) errors.push("Date required");
      if (!row.time) errors.push("Time required");

      if (!row.home_team) {
        errors.push("Home team required");
      } else {
        const match = teamLookup.get(row.home_team.toLowerCase().trim());
        if (match) home_team_id = match.id;
        else errors.push(`Home team '${row.home_team}' not found`);
      }

      if (!row.away_team) {
        errors.push("Away team required");
      } else {
        const match = teamLookup.get(row.away_team.toLowerCase().trim());
        if (match) away_team_id = match.id;
        else errors.push(`Away team '${row.away_team}' not found`);
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

      return { ...row, errors, home_team_id, away_team_id, venue_id, pitch_id, resolved_venue };
    });
  }, [teamLookup, venueLookup, pitches]);

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
      setRows((prev) => validate(prev.map(({ errors, home_team_id, away_team_id, venue_id, pitch_id, resolved_venue, ...rest }) => rest)));
    }
  }, [selectedAssociationId, teamLookup, venueLookup, validate]);

  const validRows = rows.filter((row) => row.errors.length === 0);
  const errorRows = rows.filter((row) => row.errors.length > 0);

  const handleSubmit = async () => {
    if (validRows.length === 0) return;
    setSubmitting(true);

    const inserts = validRows.map((row) => ({
      home_team_id: row.home_team_id,
      away_team_id: row.away_team_id,
      fixture_date: `${row.date}T${row.time}:00`,
      venue_id: row.venue_id,
      pitch_id: row.pitch_id,
      status: "scheduled",
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
    const teamsList = [...new Set(assocTeams.map((team) => team.name.trim()))];
    const clubsList = assocClubs.map((club) => club.name);

    const maxLen = Math.max(venuePitchList.length, teamsList.length, clubsList.length);
    const refData: string[][] = [["Venue - Pitch", "Teams", "Clubs (for reference)"]];
    for (let index = 0; index < maxLen; index++) {
      refData.push([venuePitchList[index] || "", teamsList[index] || "", clubsList[index] || ""]);
    }
    const refWs = XLSX.utils.aoa_to_sheet(refData);
    refWs["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 24 }];
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
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Association</Label>
              <Select value={selectedAssociationId} onValueChange={setSelectedAssociationId} disabled={!isSuperAdmin && scopedAssociationIds.length <= 1}>
                <SelectTrigger><SelectValue placeholder="Select association" /></SelectTrigger>
                <SelectContent>
                  {availableAssociations.map((association) => <SelectItem key={association.id} value={association.id}>{association.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Association bounds team and venue selections.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Upload Spreadsheet</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Label htmlFor="fixture-upload" className={`flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${!selectedAssociationId && "opacity-50 pointer-events-none"}`}>
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Choose .xlsx or .csv file</span>
            </Label>
            <Input key={fileKey} id="fixture-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} disabled={!selectedAssociationId} />
            <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={!selectedAssociationId}>
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
                      <TableCell className="text-xs">{row.home_team}</TableCell>
                      <TableCell className="text-xs">{row.away_team}</TableCell>
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
          <Button className="w-full" size="lg" disabled={submitting || validRows.length === 0} onClick={handleSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {submitting ? "Importing..." : `Import ${validRows.length} Fixture(s)`}
          </Button>
        )
      )}
    </div>
  );
};

export default FixtureImport;

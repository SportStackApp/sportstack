import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Download,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface ParsedRow {
  row_number: number;
  first_name: string;
  last_name: string;
  email: string;
  gender: string;
  date_of_birth: string;
  hockey_vic_number: string;
  club_name: string;
  division: string;
  team_name: string;
  association_name: string;
  phone: string;
  suburb: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  is_primary_team: boolean;
  jersey_number: string;
  position: string;
  role: string;
  notes: string;
  errors: string[];
  team_id: string | null;
}

interface ImportResult {
  created: number;
  added: number;
  errors: Array<{ row: number; error: string }>;
}

const GENDER_OPTIONS = ["Male", "Female", "Other"];
const ROLE_OPTIONS = ["PLAYER", "COACH", "TEAM_MANAGER", "CLUB_ADMIN", "ASSOCIATION_ADMIN"];
const POSITION_OPTIONS = ["GK", "FB", "HB", "MF", "IF", "CF"];
const YES_NO_OPTIONS = ["Yes", "No"];

function parseExcelDate(val: unknown): string {
  if (!val) return "";
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  const num = Number(val);
  if (!isNaN(num) && num > 1000 && num < 100000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  return str;
}

function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoDate;
}

function getField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
  }
  return "";
}

const BulkImport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isAnyAdmin, isSuperAdmin, scopedAssociationIds, scopedClubIds, scopedTeamIds } = useAdminScope();
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [clearingData, setClearingData] = useState(false);
  const [clearAssociationId, setClearAssociationId] = useState("");

  // Reference data
  const [associations, setAssociations] = useState<{ id: string; name: string }[]>([]);
  const [clubs, setClubs] = useState<{ id: string; name: string; association_id: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string; club_id: string; division: string | null }[]>([]);

  // Cascade state
  const [selectedAssociationId, setSelectedAssociationId] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");

  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) navigate("/dashboard");
  }, [scopeLoading, isAnyAdmin, navigate]);

  useEffect(() => {
    const load = async () => {
      const [aRes, cRes, tRes] = await Promise.all([
        supabase.from("associations").select("id, name").order("name"),
        supabase.from("clubs").select("id, name, association_id").order("name"),
        supabase.from("teams").select("id, name, club_id, division, team_divisions(divisions(name))").order("name"),
      ]);
      setAssociations(aRes.data || []);
      setClubs(cRes.data || []);
      setTeams(((tRes.data || []) as any[]).map((team: any) => ({
        id: team.id,
        name: team.name,
        club_id: team.club_id,
        division: team.division || (team.team_divisions?.[0]?.divisions?.name ?? null),
      })));
    };
    load();
  }, []);

  useEffect(() => {
    if (scopeLoading) return;
    if (!isSuperAdmin && scopedAssociationIds.length === 1) {
      setSelectedAssociationId(scopedAssociationIds[0]);
    }
  }, [scopeLoading, isSuperAdmin, scopedAssociationIds]);

  // Scoped available associations
  const availableAssociations = isSuperAdmin
    ? associations
    : associations.filter((a) => scopedAssociationIds.includes(a.id));

  // Cascade filtering
  const assocClubs = useMemo(() => {
    const filtered = clubs.filter((c) => c.association_id === selectedAssociationId);
    if (isSuperAdmin) return filtered;
    // Non-super-admins: further filter by scope
    if (scopedClubIds.length > 0) return filtered.filter((c) => scopedClubIds.includes(c.id));
    if (scopedAssociationIds.includes(selectedAssociationId)) return filtered;
    return filtered.filter((c) => teams.some((t) => t.club_id === c.id && scopedTeamIds.includes(t.id)));
  }, [selectedAssociationId, clubs, isSuperAdmin, scopedClubIds, scopedAssociationIds, scopedTeamIds, teams]);

  const assocTeams = useMemo(() => {
    const assocClubIds = new Set(assocClubs.map((c) => c.id));
    let filtered = teams.filter((t) => assocClubIds.has(t.club_id));
    if (!isSuperAdmin && scopedTeamIds.length > 0 && !scopedAssociationIds.includes(selectedAssociationId) && scopedClubIds.length === 0) {
      filtered = filtered.filter((t) => scopedTeamIds.includes(t.id));
    }
    return filtered;
  }, [assocClubs, teams, isSuperAdmin, scopedTeamIds, scopedAssociationIds, selectedAssociationId, scopedClubIds]);

  // Filtered clubs for cascade (by selected association)
  const cascadeClubs = assocClubs;

  // Filtered divisions for cascade (by selected club)
  const cascadeDivisions = useMemo(() => {
    let filtered = assocTeams;
    if (selectedClubId) filtered = filtered.filter((t) => t.club_id === selectedClubId);
    const divs = new Set<string>();
    filtered.forEach((t) => { if (t.division) divs.add(t.division); });
    return Array.from(divs).sort();
  }, [assocTeams, selectedClubId]);

  // Filtered teams for cascade (by selected club + division)
  const cascadeTeams = useMemo(() => {
    let filtered = assocTeams;
    if (selectedClubId) filtered = filtered.filter((t) => t.club_id === selectedClubId);
    if (selectedDivision) filtered = filtered.filter((t) => t.division === selectedDivision);
    return filtered;
  }, [assocTeams, selectedClubId, selectedDivision]);

  // Cascade change handlers
  const handleAssociationChange = (id: string) => {
    setSelectedAssociationId(id);
    setSelectedClubId("");
    setSelectedDivision("");
    setSelectedTeamId("");
  };

  const handleClubChange = (id: string) => {
    setSelectedClubId(id);
    setSelectedDivision("");
    setSelectedTeamId("");
  };

  const handleDivisionChange = (d: string) => {
    setSelectedDivision(d);
    setSelectedTeamId("");
  };

  const teamLookup = useMemo(() => {
    if (!selectedAssociationId) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const team of assocTeams) {
      const club = assocClubs.find((c) => c.id === team.club_id);
      if (club && team.division) {
        const key = `${club.name.toLowerCase().trim()}|${team.division.toLowerCase().trim()}`;
        map.set(key, team.id);
      }
    }
    return map;
  }, [selectedAssociationId, assocClubs, assocTeams]);

  // Build scope boundary sets for validation
  const scopeTeamIds = useMemo(() => {
    return new Set(cascadeTeams.map((t) => t.id));
  }, [cascadeTeams]);

  const scopeClubIds = useMemo(() => {
    if (selectedClubId) return new Set([selectedClubId]);
    return new Set(assocClubs.map((c) => c.id));
  }, [selectedClubId, assocClubs]);

  const validateRows = useCallback(
    (parsed: Omit<ParsedRow, "errors" | "team_id">[]): ParsedRow[] => {
      return parsed.map((r) => {
        const errors: string[] = [];
        if (!r.first_name.trim()) errors.push("First name required");
        if (!r.last_name.trim()) errors.push("Last name required");
        if (r.gender && !GENDER_OPTIONS.includes(r.gender)) errors.push(`Gender must be one of: ${GENDER_OPTIONS.join(", ")}`);
        if (isSuperAdmin && r.role && !ROLE_OPTIONS.includes(r.role.toUpperCase())) errors.push(`Role must be one of: ${ROLE_OPTIONS.join(", ")}`);
        if (r.position && !POSITION_OPTIONS.includes(r.position.toUpperCase())) errors.push(`Position must be one of: ${POSITION_OPTIONS.join(", ")}`);

        let team_id: string | null = null;
        if (r.club_name && r.division) {
          const key = `${r.club_name.toLowerCase().trim()}|${r.division.toLowerCase().trim()}`;
          const found = teamLookup.get(key);
          if (found) {
            team_id = found;
          } else {
            const clubNames = assocClubs.map((c) => c.name);
            const similar = clubNames.find((n) => n.toLowerCase().includes(r.club_name.toLowerCase().trim().substring(0, 4)));
            const hint = similar ? ` Did you mean '${similar}'?` : "";
            errors.push(`Club '${r.club_name}' / Division '${r.division}' not found in this association.${hint}`);
          }
        } else if (!r.club_name && !r.division) {
          errors.push("Club and Division required");
        } else {
          errors.push("Both Club and Division required");
        }

        // Scope enforcement: check resolved team is within cascade selection
        if (team_id && errors.length === 0) {
          if (!scopeTeamIds.has(team_id)) {
            const team = teams.find((t) => t.id === team_id);
            const club = team ? clubs.find((c) => c.id === team.club_id) : null;
            const scopeDesc = selectedTeamId
              ? `team '${cascadeTeams.find((t) => t.id === selectedTeamId)?.name || ""}'`
              : selectedDivision
              ? `division '${selectedDivision}'`
              : selectedClubId
              ? `club '${cascadeClubs.find((c) => c.id === selectedClubId)?.name || ""}'`
              : "selected scope";
            errors.push(`Row outside selected scope (${scopeDesc}). Row resolves to ${club?.name || "unknown club"} / ${team?.division || "unknown division"}.`);
            team_id = null;
          }
        }

        return { ...r, errors, team_id };
      });
    },
    [teamLookup, assocClubs, isSuperAdmin, scopeTeamIds, selectedTeamId, selectedDivision, selectedClubId, cascadeTeams, cascadeClubs, teams, clubs]
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        const parsed = json.map((row, i) => {
          const dob = parseExcelDate(row["date_of_birth"] || row["DOB"] || row["Date of Birth"] || "");
          const isPrimaryRaw = getField(row, "is_primary_team", "Is Primary Team").toLowerCase();

          return {
            row_number: i + 2,
            first_name: getField(row, "first_name", "First Name", "FirstName"),
            last_name: getField(row, "last_name", "Last Name", "LastName"),
            email: getField(row, "email", "Email"),
            gender: getField(row, "gender", "Gender"),
            date_of_birth: dob,
            hockey_vic_number: getField(row, "hockey_vic_number", "HV Number", "HV_Number"),
            club_name: getField(row, "club_name", "Club", "Club Name", "club"),
            division: getField(row, "division", "Division", "Comp", "competition"),
            team_name: getField(row, "team_name", "Team Name", "Team"),
            association_name: getField(row, "association", "Association", "association_name"),
            phone: getField(row, "phone", "Phone"),
            suburb: getField(row, "suburb", "Suburb", "Address"),
            emergency_contact_name: getField(row, "emergency_contact_name", "Emergency Contact Name", "EC Name"),
            emergency_contact_phone: getField(row, "emergency_contact_phone", "Emergency Contact Phone", "EC Phone"),
            emergency_contact_relationship: getField(row, "emergency_contact_relationship", "Emergency Contact Relationship", "EC Relationship"),
            is_primary_team: isPrimaryRaw === "yes" || isPrimaryRaw === "true" || isPrimaryRaw === "1",
            jersey_number: getField(row, "jersey_number", "Jersey Number", "Jersey"),
            position: getField(row, "position", "Position"),
            role: getField(row, "role", "Role"),
            notes: getField(row, "notes", "Notes"),
          };
        });

        setRows(validateRows(parsed));
      } catch {
        toast({ title: "Parse Error", description: "Could not read the spreadsheet file.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Re-validate when scope changes
  useEffect(() => {
    if (rows.length > 0) {
      setRows((prev) =>
        validateRows(prev.map(({ errors, team_id, ...rest }) => rest))
      );
    }
  }, [teamLookup, scopeTeamIds]);

  const updateRow = (rowNum: number, field: keyof Omit<ParsedRow, "errors" | "team_id" | "row_number">, value: string) => {
    setRows((prev) => {
      const updated = prev.map((r) => {
        if (r.row_number !== rowNum) return r;
        const newRow = { ...r, [field]: value };
        if (field === "is_primary_team") {
          (newRow as any).is_primary_team = value === "Yes" || value === "true";
        }
        return newRow;
      });
      return validateRows(updated.map(({ errors, team_id, ...rest }) => rest));
    });
    setImportResult(null);
  };

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);

  const handleSubmit = async () => {
    if (validRows.length === 0) {
      toast({ title: "No Valid Rows", description: "Fix errors before importing.", variant: "destructive" });
      return;
    }
    if (!selectedAssociationId) {
      toast({ title: "No Association", description: "Select an association first.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("bulk-import", {
      body: {
        association_id: selectedAssociationId,
        players: validRows.map((r) => ({
          first_name: r.first_name,
          last_name: r.last_name,
          email: r.email || null,
          gender: r.gender || null,
          date_of_birth: r.date_of_birth || null,
          hockey_vic_number: r.hockey_vic_number || null,
          phone: r.phone || null,
          suburb: r.suburb || null,
          emergency_contact_name: r.emergency_contact_name || null,
          emergency_contact_phone: r.emergency_contact_phone || null,
          emergency_contact_relationship: r.emergency_contact_relationship || null,
          team_id: r.team_id,
          is_primary_team: r.is_primary_team,
          jersey_number: r.jersey_number ? parseInt(r.jersey_number) : null,
          position: r.position || null,
          role: isSuperAdmin ? (r.role || null) : null,
          notes: r.notes || null,
          row_number: r.row_number,
        })),
      },
    });
    setSubmitting(false);

    if (error || data?.error) {
      toast({
        title: "Import Failed",
        description: data?.error || error?.message || "Unknown error",
        variant: "destructive",
      });
      return;
    }

    const result = data as ImportResult;
    setImportResult(result);

    if (result.errors && result.errors.length > 0) {
      const failedRowNumbers = new Set(result.errors.map((e) => e.row));
      setRows((prev) => {
        const kept = prev.filter(
          (r) => r.errors.length > 0 || failedRowNumbers.has(r.row_number)
        );
        return kept.map((r) => {
          const serverError = result.errors.find((e) => e.row === r.row_number);
          if (serverError && r.errors.length === 0) {
            return { ...r, errors: [`Server: ${serverError.error}`] };
          }
          return r;
        });
      });
    } else {
      setRows([]);
    }

    toast({
      title: "Import Complete",
      description: `${result.created} new player(s) created. ${result.added || 0} added to additional teams. ${result.errors?.length || 0} failed.`,
    });
  };

  const downloadTemplate = () => {
    const headers = [
      "first_name", "last_name", "email", "phone", "suburb",
      "date_of_birth", "gender", "hockey_vic_number",
      "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship",
      "association", "club", "competition", "team_name",
      "is_primary_team", "jersey_number", "position",
      ...(isSuperAdmin ? ["role"] : []),
      "notes",
    ];

    // Pre-fill row 2 with cascade values
    const selectedAssocName = associations.find((a) => a.id === selectedAssociationId)?.name || "";
    const selectedClubName = cascadeClubs.find((c) => c.id === selectedClubId)?.name || "";
    const selectedTeamName = cascadeTeams.find((t) => t.id === selectedTeamId)?.name || "";
    const prefillRow = headers.map((h) => {
      if (h === "association") return selectedAssocName;
      if (h === "club") return selectedClubName;
      if (h === "competition") return selectedDivision;
      if (h === "team_name") return selectedTeamName;
      return "";
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, prefillRow]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }));

    if (!ws["!dataValidation"]) (ws as any)["!dataValidation"] = [];
    const validations: any[] = (ws as any)["!dataValidation"];
    const maxRows = 200;

    const addValidation = (col: number, options: string[]) => {
      const colLetter = XLSX.utils.encode_col(col);
      validations.push({
        sqref: `${colLetter}2:${colLetter}${maxRows}`,
        type: "list",
        formula1: `"${options.join(",")}"`,
      });
    };

    const genderCol = headers.indexOf("gender");
    const isPrimaryCol = headers.indexOf("is_primary_team");
    const positionCol = headers.indexOf("position");
    const roleCol = headers.indexOf("role");

    if (genderCol >= 0) addValidation(genderCol, GENDER_OPTIONS);
    if (isPrimaryCol >= 0) addValidation(isPrimaryCol, YES_NO_OPTIONS);
    if (positionCol >= 0) addValidation(positionCol, POSITION_OPTIONS);
    if (roleCol >= 0) addValidation(roleCol, ROLE_OPTIONS);

    if (cascadeClubs.length > 0) {
      const clubCol = headers.indexOf("club");
      if (clubCol >= 0) addValidation(clubCol, cascadeClubs.map((c) => c.name));
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Players");

    // Allowed Values reference sheet — scoped to cascade
    const refHeaders: string[] = ["Gender", "Position", "Is Primary Team"];
    if (isSuperAdmin) refHeaders.push("Role");
    refHeaders.push("Club", "Division");

    // Scoped values
    const scopedClubNames = selectedClubId
      ? [cascadeClubs.find((c) => c.id === selectedClubId)?.name || ""]
      : cascadeClubs.map((c) => c.name);
    const scopedDivisions = selectedDivision
      ? [selectedDivision]
      : cascadeDivisions;

    const colValues: string[][] = [
      GENDER_OPTIONS,
      POSITION_OPTIONS,
      YES_NO_OPTIONS,
    ];
    if (isSuperAdmin) colValues.push(ROLE_OPTIONS);
    colValues.push(scopedClubNames);
    colValues.push(scopedDivisions);

    const maxLen = Math.max(...colValues.map((v) => v.length));
    const refData: string[][] = [refHeaders];
    for (let i = 0; i < maxLen; i++) {
      refData.push(refHeaders.map((_, ci) => colValues[ci]?.[i] || ""));
    }

    const refWs = XLSX.utils.aoa_to_sheet(refData);
    refWs["!cols"] = refHeaders.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
    XLSX.utils.book_append_sheet(wb, refWs, "Allowed Values");

    XLSX.writeFile(wb, "player_import_template.xlsx");
  };

  const handleClearTestData = async () => {
    if (!clearAssociationId) {
      toast({ title: "Select Association", description: "Choose which association to clear.", variant: "destructive" });
      return;
    }
    setClearingData(true);
    const { data, error } = await supabase.functions.invoke("clear-test-data", {
      body: { association_id: clearAssociationId },
    });
    setClearingData(false);

    if (error || data?.error) {
      toast({
        title: "Clear Failed",
        description: data?.error || error?.message || "Unknown error",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Test Data Cleared",
      description: `Deleted ${data.deleted_users} user(s), ${data.deleted_memberships} membership(s), ${data.deleted_roles} role(s), ${data.deleted_profiles} profile(s).`,
    });
  };

  if (scopeLoading) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bulk Player Import</h1>
            <p className="text-muted-foreground">Upload a spreadsheet to create multiple players at once</p>
          </div>
        </div>
        {isSuperAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All Test Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear All Test Data</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all players, memberships, roles, profiles, and auth accounts
                  within the selected association. Users with memberships in other associations will keep
                  those memberships but lose their data in this association. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Label>Association to clear</Label>
                <Select value={clearAssociationId} onValueChange={setClearAssociationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select association" />
                  </SelectTrigger>
                  <SelectContent>
                    {associations.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearTestData}
                  disabled={clearingData || !clearAssociationId}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {clearingData ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                  {clearingData ? "Clearing..." : "Delete Everything"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Import Scope — Cascade Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Import Scope</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Association</Label>
              <Select
                value={selectedAssociationId}
                onValueChange={handleAssociationChange}
                disabled={!isSuperAdmin && scopedAssociationIds.length <= 1}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select association" />
                </SelectTrigger>
                <SelectContent>
                  {availableAssociations.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Club</Label>
              <Select
                value={selectedClubId}
                onValueChange={handleClubChange}
                disabled={!selectedAssociationId || cascadeClubs.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All clubs" />
                </SelectTrigger>
                <SelectContent>
                  {cascadeClubs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Division</Label>
              <Select
                value={selectedDivision}
                onValueChange={handleDivisionChange}
                disabled={cascadeDivisions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All divisions" />
                </SelectTrigger>
                <SelectContent>
                  {cascadeDivisions.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Team</Label>
              <Select
                value={selectedTeamId}
                onValueChange={setSelectedTeamId}
                disabled={cascadeTeams.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All teams" />
                </SelectTrigger>
                <SelectContent>
                  {cascadeTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Rows outside the selected scope will be rejected. Association is the minimum required selection.
          </p>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Spreadsheet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Label
              htmlFor="file-upload"
              className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Choose .xlsx or .csv file</span>
            </Label>
            <Input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={!selectedAssociationId}
            />
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1" />
              Download Template
            </Button>
            {fileName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                {fileName}
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Template includes dropdown lists for: <span className="font-medium">Gender, Position, Is Primary Team</span>{isSuperAdmin && <>, <span className="font-medium">Role</span></>}{cascadeClubs.length > 0 && <>, <span className="font-medium">Club</span></>}</p>
            <p>Dates can be DD/MM/YYYY format. Email is optional — mock emails will be generated if left blank.</p>
            <p>Errors can be corrected inline in the preview below. The template also includes an "Allowed Values" reference sheet.</p>
          </div>
        </CardContent>
      </Card>

      {/* Preview Table */}
      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Preview ({rows.length} rows)
            </CardTitle>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-green-600 border-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {validRows.length} valid
              </Badge>
              {errorRows.length > 0 && (
                <Badge variant="outline" className="text-destructive border-destructive/30">
                  <XCircle className="h-3 w-3 mr-1" />
                  {errorRows.length} errors
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 sticky left-0 bg-background z-10">#</TableHead>
                    <TableHead>First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>HV #</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead>Jersey</TableHead>
                    <TableHead>Position</TableHead>
                    {isSuperAdmin && <TableHead>Role</TableHead>}
                    <TableHead>EC Name</TableHead>
                    <TableHead>EC Phone</TableHead>
                    <TableHead>EC Rel</TableHead>
                    <TableHead>Suburb</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-32 sticky right-0 bg-background z-10">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={r.row_number}
                      className={r.errors.length > 0 ? "bg-destructive/5" : ""}
                    >
                      <TableCell className="font-mono text-xs sticky left-0 bg-background z-10">{r.row_number}</TableCell>
                      <TableCell className="text-xs">{r.first_name}</TableCell>
                      <TableCell className="text-xs">{r.last_name}</TableCell>
                      <TableCell className="text-xs">{r.email || <span className="text-muted-foreground italic">auto</span>}</TableCell>
                      <TableCell className="text-xs">{r.phone}</TableCell>
                      <TableCell>
                        <Select value={r.gender || undefined} onValueChange={(v) => updateRow(r.row_number, "gender", v)}>
                          <SelectTrigger className="h-7 w-20 text-xs border-0 p-1">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatDateDisplay(r.date_of_birth)}</TableCell>
                      <TableCell className="text-xs">{r.hockey_vic_number}</TableCell>
                      <TableCell>
                        {cascadeClubs.length > 0 ? (
                          <Select value={r.club_name || undefined} onValueChange={(v) => updateRow(r.row_number, "club_name", v)}>
                            <SelectTrigger className="h-7 w-28 text-xs border-0 p-1">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {cascadeClubs.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs">{r.club_name}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{r.division}</TableCell>
                      <TableCell className="text-xs">{r.team_name}</TableCell>
                      <TableCell className="text-xs">{r.is_primary_team ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-xs">{r.jersey_number}</TableCell>
                      <TableCell>
                        <Select value={r.position || undefined} onValueChange={(v) => updateRow(r.row_number, "position", v)}>
                          <SelectTrigger className="h-7 w-16 text-xs border-0 p-1">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {POSITION_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell>
                          <Select value={r.role || undefined} onValueChange={(v) => updateRow(r.row_number, "role", v)}>
                            <SelectTrigger className="h-7 w-28 text-xs border-0 p-1">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((rl) => <SelectItem key={rl} value={rl}>{rl}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      <TableCell className="text-xs">{r.emergency_contact_name}</TableCell>
                      <TableCell className="text-xs">{r.emergency_contact_phone}</TableCell>
                      <TableCell className="text-xs">{r.emergency_contact_relationship}</TableCell>
                      <TableCell className="text-xs">{r.suburb}</TableCell>
                      <TableCell className="text-xs max-w-[100px] truncate">{r.notes}</TableCell>
                      <TableCell className="sticky right-0 bg-background z-10">
                        {r.errors.length === 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="space-y-0.5">
                            {r.errors.map((err, i) => (
                              <div key={i} className="flex items-start gap-1">
                                <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                                <span className="text-xs text-destructive">{err}</span>
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

      {/* Import Result */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold text-green-600">{importResult.created}</span> new player(s) created.
              {importResult.added > 0 && (
                <> <span className="font-semibold text-blue-600">{importResult.added}</span> added to additional teams.</>
              )}
            </p>
            {importResult.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {importResult.errors.length} row(s) failed — fix errors above and re-submit:
                </p>
                <ul className="text-xs space-y-1 pl-5 list-disc text-muted-foreground">
                  {importResult.errors.map((e, i) => (
                    <li key={i}>Row {e.row}: {e.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      {rows.length > 0 && validRows.length > 0 && (
        <Button
          className="w-full"
          size="lg"
          disabled={submitting || validRows.length === 0}
          onClick={handleSubmit}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {submitting ? "Importing..." : `Import ${validRows.length} Player(s)`}
        </Button>
      )}
    </div>
  );
};

export default BulkImport;

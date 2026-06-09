import { useState, useEffect, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Download, Calendar, Upload, Pencil, Trash2, Plus, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTeamContext } from "@/contexts/TeamContext";
import { useAdminScope } from "@/hooks/useAdminScope";
import * as XLSX from "xlsx";

interface FixtureRow {
  id: string;
  fixture_date: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  notes: string | null;
  round_number: number | null;
  home_team_id: string;
  away_team_id: string | null;
  venue_id: string | null;
  pitch_id: string | null;
  home_team: { id: string; name: string } | null;
  away_team: { id: string; name: string } | null;
  venue: { id: string; name: string } | null;
}

interface FixtureForm {
  home_team_id: string;
  away_team_id: string;
  round_number: string;
  fixture_date: string;
  game_time: string;
  venue_id: string;
  pitch_id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  notes: string;
}

const emptyForm: FixtureForm = {
  home_team_id: "",
  away_team_id: "",
  round_number: "",
  fixture_date: "",
  game_time: "",
  venue_id: "",
  pitch_id: "",
  status: "SCHEDULED",
  home_score: null,
  away_score: null,
  notes: "",
};

const FIXTURE_SELECT =
  "id, fixture_date, status, home_score, away_score, notes, round_number, venue_id, pitch_id, home_team_id, away_team_id, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name), venue:venues!venue_id(id, name)";

const splitDateTime = (value: string | null) => {
  if (!value) return { fixture_date: "", game_time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { fixture_date: "", game_time: "" };
  return {
    fixture_date: date.toISOString().slice(0, 10),
    game_time: date.toTimeString().slice(0, 5),
  };
};

const combineDateTime = (date: string, time: string) =>
  time ? `${date}T${time}:00` : `${date}T00:00:00`;

const normaliseStatus = (status: string) => status.toUpperCase();
const formatStatusLabel = (status: string) =>
  status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
const toDbStatus = (status: string) => status.toUpperCase();

const FixturesManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedTeamId, selectedAssociationId } = useTeamContext();
  const { scopedTeamIds } = useAdminScope();
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFixture, setSelectedFixture] = useState<FixtureRow | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editAssociationId, setEditAssociationId] = useState<string>("");
  const [editDivisionId, setEditDivisionId] = useState<string>("");
  const [editForm, setEditForm] = useState({
    date: "",
    time: "",
    homeTeamId: "",
    awayTeamId: "",
    round: "",
    venueId: "",
    status: "",
    homeScore: "",
    awayScore: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState<FixtureForm>(emptyForm);
  const [allAssocTeams, setAllAssocTeams] = useState<{ id: string; name: string; club_id: string; division_id: string | null; divisionName: string | null; associationName: string | null }[]>([]);
  const [allAssociations, setAllAssociations] = useState<{ id: string; name: string }[]>([]);
  const [allDivisions, setAllDivisions] = useState<{ id: string; name: string; association_id: string }[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [pitches, setPitches] = useState<{ id: string; name: string; venue_id: string }[]>([]);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterRound, setFilterRound] = useState("");
  const [assocTeamIds, setAssocTeamIds] = useState<string[]>([]);

  const teamIds = selectedTeamId
    ? [selectedTeamId]
    : scopedTeamIds.length > 0
    ? scopedTeamIds
    : [];

  useEffect(() => {
    const loadRefData = async () => {
      if (!selectedAssociationId) {
        const [venueRes, teamRes, pitchRes, divisionRes, associationRes] = await Promise.all([
          supabase.from("venues").select("id, name").order("name"),
          (supabase.from("teams" as any).select("id, name, club_id, division_id, divisions(name, association_id, associations(name))") as any).order("name"),
          supabase.from("pitches").select("id, name, venue_id").order("name"),
          supabase.from("divisions" as any).select("id, name, association_id").order("name"),
          supabase.from("associations").select("id, name").order("name"),
        ]);
        setVenues(venueRes.data || []);
        setAllAssocTeams((teamRes.data || []).map((team: any) => ({
          id: team.id,
          name: team.name,
          club_id: team.club_id,
          division_id: team.division_id,
          divisionName: team.divisions?.name ?? null,
          associationName: team.divisions?.associations?.name ?? null,
        })));
        setPitches(pitchRes.data || []);
        setAllDivisions((divisionRes.data || []) as any);
        setAllAssociations(associationRes.data || []);
        return;
      }
      const [clubRes, venueRes, divisionRes, associationRes] = await Promise.all([
        supabase.from("clubs").select("id").eq("association_id", selectedAssociationId),
        supabase.from("venues").select("id, name").eq("association_id", selectedAssociationId).order("name"),
        supabase.from("divisions" as any).select("id, name, association_id").order("name"),
        supabase.from("associations").select("id, name").order("name"),
      ]);

      const clubIds = (clubRes.data || []).map((club) => club.id);
      const loadedVenues = venueRes.data || [];
      setVenues(loadedVenues);
      setAllDivisions((divisionRes.data || []) as any);
      setAllAssociations(associationRes.data || []);

      if (clubIds.length > 0) {
        const { data: teamData } = await (supabase.from("teams" as any).select("id, name, club_id, division_id, divisions(name, association_id, associations(name))").in("club_id", clubIds) as any).order("name");
        setAllAssocTeams((teamData || []).map((team: any) => ({
          id: team.id,
          name: team.name,
          club_id: team.club_id,
          division_id: team.division_id,
          divisionName: team.divisions?.name ?? null,
          associationName: team.divisions?.associations?.name ?? null,
        })));
      } else {
        setAllAssocTeams([]);
      }

      if (loadedVenues.length > 0) {
        const { data: pitchData } = await supabase.from("pitches").select("id, name, venue_id").in("venue_id", loadedVenues.map((venue) => venue.id)).order("name");
        setPitches(pitchData || []);
      } else {
        setPitches([]);
      }
    };
    loadRefData();
  }, [selectedAssociationId]);

  useEffect(() => {
    if (selectedAssociationId && teamIds.length === 0) {
      const fetchAssocTeams = async () => {
        const { data: clubs } = await supabase.from("clubs").select("id").eq("association_id", selectedAssociationId);
        const clubIds = (clubs || []).map((club) => club.id);
        if (clubIds.length === 0) {
          setAssocTeamIds([]);
          return;
        }
        const { data: teams } = await supabase.from("teams").select("id").in("club_id", clubIds);
        setAssocTeamIds((teams || []).map((team) => team.id));
      };
      fetchAssocTeams();
    } else {
      setAssocTeamIds([]);
    }
  }, [selectedAssociationId, teamIds.join(",")]);

  const fetchFixtures = async () => {
    const shouldFetchAll = !selectedAssociationId && !selectedTeamId && scopedTeamIds.length === 0;
    const idsToUse = shouldFetchAll ? null : teamIds.length > 0 ? teamIds : assocTeamIds;

    setLoading(true);
    let query = (supabase.from("fixtures" as any).select(FIXTURE_SELECT) as any).order("fixture_date", { ascending: true });

    if (idsToUse !== null) {
      if (idsToUse.length === 0) {
        setFixtures([]);
        setLoading(false);
        return;
      }
      const idList = idsToUse.join(",");
      query = query.or(`home_team_id.in.(${idList}),away_team_id.in.(${idList})`);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setFixtures([]);
      setLoading(false);
      return;
    }

    const loadedFixtures = (data as FixtureRow[]) || [];
    setFixtures(loadedFixtures);
    setLoading(false);
  };

  useEffect(() => {
    fetchFixtures();
  }, [selectedAssociationId, selectedTeamId, scopedTeamIds.join(","), assocTeamIds.join(",")]);

  const handleExport = () => {
    if (fixtures.length === 0) return;
    const rows = fixtures.map((fixture) => {
      const date = fixture.fixture_date ? new Date(fixture.fixture_date) : null;
      return {
        Date: date ? date.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
        Day: date ? date.toLocaleDateString("en-AU", { weekday: "short" }) : "",
        Time: date ? date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "",
        "Home Team": fixture.home_team?.name ?? "Unknown",
        "Away Team": fixture.away_team?.name ?? "BYE",
        Venue: fixture.venue?.name ?? "TBD",
        Round: fixture.round_number ?? "",
        Status: fixture.status,
        "Home Score": fixture.home_score ?? "",
        "Away Score": fixture.away_score ?? "",
        Notes: fixture.notes || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fixtures");
    XLSX.writeFile(wb, `fixtures-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Exported", description: `${fixtures.length} fixtures exported.` });
  };

  const openEdit = (fixture: FixtureRow) => {
    const homeTeam = allAssocTeams.find(t => t.id === fixture.home_team_id);
    const division = allDivisions.find(d => d.id === homeTeam?.division_id);
    setEditAssociationId(division?.association_id ?? "");
    setEditDivisionId(homeTeam?.division_id ?? "");
    
    const dateParts = splitDateTime(fixture.fixture_date);
    
    setEditForm({
      date: dateParts.fixture_date,
      time: dateParts.game_time,
      homeTeamId: fixture.home_team_id ?? "",
      awayTeamId: fixture.away_team_id ?? "",
      round: String(fixture.round_number ?? ""),
      venueId: fixture.venue_id ?? "",
      status: fixture.status ?? "SCHEDULED",
      homeScore: fixture.home_score !== null ? String(fixture.home_score) : "",
      awayScore: fixture.away_score !== null ? String(fixture.away_score) : "",
    });
    setSelectedFixture(fixture);
    setIsEditModalOpen(true);
  };

  const handleUpdateFixture = async () => {
    if (!selectedFixture) return;
    if (!editForm.homeTeamId || !editForm.date) {
      toast({ title: "Error", description: "Home team and date are required.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("fixtures").update({
      home_team_id: editForm.homeTeamId,
      away_team_id: editForm.awayTeamId || null,
      round_number: editForm.round ? parseInt(editForm.round, 10) : null,
      fixture_date: combineDateTime(editForm.date, editForm.time),
      venue_id: editForm.venueId || null,
      status: toDbStatus(editForm.status),
      home_score: editForm.homeScore ? parseInt(editForm.homeScore, 10) : null,
      away_score: editForm.awayScore ? parseInt(editForm.awayScore, 10) : null,
    }).eq("id", selectedFixture.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Updated", description: "Fixture updated successfully." });
    setIsEditModalOpen(false);
    setSelectedFixture(null);
    fetchFixtures();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("fixtures").delete().eq("id", deleteTarget);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Fixture deleted." });
      fetchFixtures();
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleAddFixture = async () => {
    if (!addForm.home_team_id || !addForm.fixture_date) {
      toast({ title: "Error", description: "Home team and date are required.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("fixtures").insert({
      home_team_id: addForm.home_team_id,
      away_team_id: addForm.away_team_id || null,
      round_number: addForm.round_number ? parseInt(addForm.round_number, 10) : null,
      fixture_date: combineDateTime(addForm.fixture_date, addForm.game_time),
      venue_id: addForm.venue_id || null,
      pitch_id: addForm.pitch_id || null,
      status: toDbStatus(addForm.status),
      home_score: addForm.home_score,
      away_score: addForm.away_score,
      notes: addForm.notes || null,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Created", description: "Fixture added." });
    setAddDialogOpen(false);
    setAddForm(emptyForm);
    fetchFixtures();
  };

  const divisionsForModal = editAssociationId
    ? allDivisions.filter((d) => d.association_id === editAssociationId)
    : allDivisions;

  const teamsForModal = editDivisionId
    ? allAssocTeams.filter((t) => t.division_id === editDivisionId)
    : editAssociationId
    ? allAssocTeams.filter((t) => {
        const div = allDivisions.find((d) => d.id === t.division_id);
        return div?.association_id === editAssociationId;
      })
    : allAssocTeams;

  const renderTeamSelect = (value: string, onChange: (value: string) => void, placeholder: string, teamsList: typeof allAssocTeams, allowBye = false) => {
    const selectValue = value === "" ? "__none__" : value || "__none__";
    return (
      <Select value={selectValue} onValueChange={(value) => onChange(value === "__none__" ? "" : value)}>
        <SelectTrigger className="h-9 text-sm w-full px-3"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{allowBye ? "BYE" : "None"}</SelectItem>
          {teamsList.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const displayFixtures = fixtures.filter((fixture) => {
    const matchesStatus = filterStatus === "ALL" || fixture.status === filterStatus;
    const matchesRound = !filterRound || fixture.round_number?.toString() === filterRound;
    return matchesStatus && matchesRound;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-foreground">
            FIXTURES MANAGEMENT
          </h1>
          <p className="text-muted-foreground mt-1">
            Import, edit, and manage fixtures across teams
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/fixture-import")} className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={fixtures.length === 0} className="gap-2">
            <Download className="h-4 w-4" />
            Export ({fixtures.length})
          </Button>
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label>Status:</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="INCOMPLETE">Incomplete</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="POSTPONED">Postponed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>Round:</Label>
          <Input
            className="h-9 w-20"
            type="number"
            placeholder="All"
            value={filterRound}
            onChange={(event) => setFilterRound(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full" />)}
        </div>
      ) : displayFixtures.length === 0 ? (
        <Card variant="ghost" className="text-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No fixtures found. Import fixtures or add one manually.
          </p>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {displayFixtures.length} Fixture{displayFixtures.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Association</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Home Team</TableHead>
                    <TableHead>Away Team</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayFixtures.map((fixture) => {
                    const date = fixture.fixture_date ? new Date(fixture.fixture_date) : null;
                    const venueName = fixture.venue?.name ?? "TBD";
                    const statusLabel = formatStatusLabel(fixture.status);

                    return (
                      <TableRow key={fixture.id}>
                        <TableCell className="whitespace-nowrap text-foreground">
                          {date ? date.toLocaleDateString("en-AU", { day: "2-digit", month: "short" }) : "TBD"}
                        </TableCell>
                        <TableCell>
                          {allAssocTeams.find((t) => t.id === fixture.home_team_id)?.associationName ?? "-"}
                        </TableCell>
                        <TableCell>
                          {allAssocTeams.find((t) => t.id === fixture.home_team_id)?.divisionName ?? "-"}
                        </TableCell>
                        <TableCell>
                          {fixture.home_team?.name ?? "Unknown"}
                        </TableCell>
                        <TableCell>
                          {fixture.away_team?.name ?? "BYE"}
                        </TableCell>
                        <TableCell>
                          {fixture.round_number ?? "-"}
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground truncate max-w-[150px] block">{venueName}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">{statusLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          {fixture.home_score !== null && fixture.away_score !== null ? `${fixture.home_score}-${fixture.away_score}` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(fixture)}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeleteTarget(fixture.id); setDeleteDialogOpen(true); }}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Fixture</DialogTitle>
            <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Fixture</DialogTitle>
            <DialogDescription>Manually create a single fixture.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Home Team *</Label>
                {renderTeamSelect(addForm.home_team_id, (value) => setAddForm((form) => ({ ...form, home_team_id: value })), "Select home team", allAssocTeams)}
              </div>
              <div className="space-y-2">
                <Label>Away Team</Label>
                {renderTeamSelect(addForm.away_team_id, (value) => setAddForm((form) => ({ ...form, away_team_id: value })), "Select away team or BYE", allAssocTeams, true)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={addForm.fixture_date} onChange={(event) => setAddForm((form) => ({ ...form, fixture_date: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input type="time" value={addForm.game_time} onChange={(event) => setAddForm((form) => ({ ...form, game_time: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Round</Label>
              <Input type="number" value={addForm.round_number} onChange={(event) => setAddForm((form) => ({ ...form, round_number: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Venue</Label>
                <Select value={addForm.venue_id || "__none__"} onValueChange={(value) => setAddForm((form) => ({ ...form, venue_id: value === "__none__" ? "" : value, pitch_id: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {venues.map((venue) => <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pitch</Label>
                <Select disabled={!addForm.venue_id} value={addForm.pitch_id || "__none__"} onValueChange={(value) => setAddForm((form) => ({ ...form, pitch_id: value === "__none__" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="Select pitch" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {pitches.filter((pitch) => pitch.venue_id === addForm.venue_id).map((pitch) => (
                      <SelectItem key={pitch.id} value={pitch.id}>{pitch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddFixture}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Fixture</DialogTitle>
            <DialogDescription>Update fixture details.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-x-[10px] gap-y-3 py-2">
            {/* Row 1 — Status and Association */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground block mb-1">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) => setEditForm((form) => ({ ...form, status: value }))}
              >
                <SelectTrigger className="h-9 w-full px-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="POSTPONED">Postponed</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="INCOMPLETE">Incomplete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground block mb-1">Association</Label>
              <Select
                value={editAssociationId || "__none__"}
                onValueChange={(value) => {
                  const nextVal = value === "__none__" ? "" : value;
                  setEditAssociationId(nextVal);
                  setEditDivisionId("");
                  setEditForm((form) => ({ ...form, homeTeamId: "", awayTeamId: "" }));
                }}
              >
                <SelectTrigger className="h-9 w-full px-3"><SelectValue placeholder="All Associations" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All Associations</SelectItem>
                  {allAssociations.map((assoc) => (
                    <SelectItem key={assoc.id} value={assoc.id}>{assoc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 2 — Round and Venue */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground block mb-1">Round</Label>
              <Input
                type="number"
                value={editForm.round}
                onChange={(e) => setEditForm((form) => ({ ...form, round: e.target.value }))}
                className="h-9 w-full"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground block mb-1">Venue</Label>
              <Select
                value={editForm.venueId || "__none__"}
                onValueChange={(value) => setEditForm((form) => ({ ...form, venueId: value === "__none__" ? "" : value }))}
              >
                <SelectTrigger className="h-9 w-full px-3"><SelectValue placeholder="Select venue" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 3 — Division, Home Team, Away Team */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground block mb-1">Division</Label>
              <Select
                value={editDivisionId || "__none__"}
                onValueChange={(value) => {
                  const nextVal = value === "__none__" ? "" : value;
                  setEditDivisionId(nextVal);
                  setEditForm((form) => ({ ...form, homeTeamId: "", awayTeamId: "" }));
                }}
              >
                <SelectTrigger className="h-9 w-full px-3"><SelectValue placeholder="All Divisions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All Divisions</SelectItem>
                  {divisionsForModal.map((div) => (
                    <SelectItem key={div.id} value={div.id}>{div.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground block mb-1">Home Team *</Label>
              {renderTeamSelect(
                editForm.homeTeamId,
                (value) => setEditForm((form) => ({ ...form, homeTeamId: value })),
                "Select home team",
                teamsForModal
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground block mb-1">Away Team</Label>
              {renderTeamSelect(
                editForm.awayTeamId,
                (value) => setEditForm((form) => ({ ...form, awayTeamId: value })),
                "Select away team or BYE",
                teamsForModal,
                true
              )}
            </div>

            {/* Row 4 — Date, Start Time, Score */}
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground block mb-1">Date *</Label>
              <Input
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm((form) => ({ ...form, date: e.target.value }))}
                className="h-9 w-full"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground block mb-1">Start Time</Label>
              <Input
                type="time"
                value={editForm.time}
                onChange={(e) => setEditForm((form) => ({ ...form, time: e.target.value }))}
                className="h-9 w-full"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground block mb-1">Score</Label>
              <div className="flex items-center gap-2 h-9">
                <Input
                  type="number"
                  value={editForm.homeScore}
                  onChange={(e) => setEditForm((form) => ({ ...form, homeScore: e.target.value }))}
                  className="w-14 text-center h-9"
                />
                <span className="text-muted-foreground">—</span>
                <Input
                  type="number"
                  value={editForm.awayScore}
                  onChange={(e) => setEditForm((form) => ({ ...form, awayScore: e.target.value }))}
                  className="w-14 text-center h-9"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateFixture}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FixturesManagement;

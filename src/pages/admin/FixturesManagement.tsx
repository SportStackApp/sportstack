import { useState, useEffect } from "react";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FixtureForm>(emptyForm);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState<FixtureForm>(emptyForm);
  const [allAssocTeams, setAllAssocTeams] = useState<{ id: string; name: string; club_id: string; division_id: string | null; divisionName: string | null; associationName: string | null }[]>([]);
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
        const [venueRes, teamRes, pitchRes] = await Promise.all([
          supabase.from("venues").select("id, name").order("name"),
          supabase.from("teams").select("id, name, club_id, division_id, divisions(name, association_id, associations(name))").order("name"),
          supabase.from("pitches").select("id, name, venue_id").order("name"),
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
        return;
      }
      const [clubRes, venueRes] = await Promise.all([
        supabase.from("clubs").select("id").eq("association_id", selectedAssociationId),
        supabase.from("venues").select("id, name").eq("association_id", selectedAssociationId).order("name"),
      ]);

      const clubIds = (clubRes.data || []).map((club) => club.id);
      const loadedVenues = venueRes.data || [];
      setVenues(loadedVenues);

      if (clubIds.length > 0) {
        const { data: teamData } = await supabase.from("teams").select("id, name, club_id, division_id, divisions(name, association_id, associations(name))").in("club_id", clubIds).order("name");
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
    let query = supabase.from("fixtures").select(FIXTURE_SELECT).order("fixture_date", { ascending: true });

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

  const startEdit = (fixture: FixtureRow) => {
    const dateParts = splitDateTime(fixture.fixture_date);
    setEditingId(fixture.id);
    setEditForm({
      home_team_id: fixture.home_team_id,
      away_team_id: fixture.away_team_id || "",
      round_number: fixture.round_number?.toString() ?? "",
      fixture_date: dateParts.fixture_date,
      game_time: dateParts.game_time,
      venue_id: fixture.venue_id || "",
      pitch_id: fixture.pitch_id || "",
      status: normaliseStatus(fixture.status),
      home_score: fixture.home_score,
      away_score: fixture.away_score,
      notes: fixture.notes || "",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editForm.home_team_id || !editForm.fixture_date) {
      toast({ title: "Error", description: "Home team and date are required.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("fixtures").update({
      home_team_id: editForm.home_team_id,
      away_team_id: editForm.away_team_id || null,
      round_number: editForm.round_number ? parseInt(editForm.round_number, 10) : null,
      fixture_date: combineDateTime(editForm.fixture_date, editForm.game_time),
      venue_id: editForm.venue_id || null,
      pitch_id: editForm.pitch_id || null,
      status: toDbStatus(editForm.status),
      home_score: editForm.home_score,
      away_score: editForm.away_score,
      notes: editForm.notes || null,
    }).eq("id", editingId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Updated", description: "Fixture updated successfully." });
    setEditingId(null);
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

  const renderTeamSelect = (value: string, onChange: (value: string) => void, placeholder: string, allowBye = false) => {
    const selectValue = value === "" ? "__none__" : value || "__none__";
    return (
      <Select value={selectValue} onValueChange={(value) => onChange(value === "__none__" ? "" : value)}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{allowBye ? "BYE" : "None"}</SelectItem>
          {allAssocTeams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}{team.divisionName || team.associationName ? ` (${[team.associationName, team.divisionName].filter(Boolean).join(' · ')})` : ''}
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
                    const isEditing = editingId === fixture.id;
                    const venueName = fixture.venue?.name ?? "TBD";
                    const statusLabel = formatStatusLabel(fixture.status);

                    return (
                      <TableRow key={fixture.id}>
                        <TableCell className="whitespace-nowrap text-foreground">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Input className="h-8 w-36 text-xs" type="date" value={editForm.fixture_date} onChange={(event) => setEditForm((form) => ({ ...form, fixture_date: event.target.value }))} />
                              <Input className="h-8 w-24 text-xs" type="time" value={editForm.game_time} onChange={(event) => setEditForm((form) => ({ ...form, game_time: event.target.value }))} />
                            </div>
                          ) : (
                            date ? date.toLocaleDateString("en-AU", { day: "2-digit", month: "short" }) : "TBD"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? renderTeamSelect(editForm.home_team_id, (value) => setEditForm((form) => ({ ...form, home_team_id: value })), "Home team") : fixture.home_team?.name ?? "Unknown"}
                        </TableCell>
                        <TableCell>
                          {isEditing ? renderTeamSelect(editForm.away_team_id, (value) => setEditForm((form) => ({ ...form, away_team_id: value })), "Away team", true) : fixture.away_team?.name ?? "BYE"}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input className="h-8 w-20 text-xs" type="number" value={editForm.round_number} onChange={(event) => setEditForm((form) => ({ ...form, round_number: event.target.value }))} />
                          ) : (
                            fixture.round_number ?? "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Select value={editForm.venue_id || "__none__"} onValueChange={(value) => setEditForm((form) => ({ ...form, venue_id: value === "__none__" ? "" : value, pitch_id: "" }))}>
                              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Venue" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {venues.map((venue) => <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground truncate max-w-[150px] block">{venueName}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Select value={editForm.status} onValueChange={(value) => setEditForm((form) => ({ ...form, status: value }))}>
                              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                <SelectItem value="POSTPONED">Postponed</SelectItem>
                                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                <SelectItem value="INCOMPLETE">Incomplete</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="secondary" className="text-xs capitalize">{statusLabel}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input className="h-8 w-14 text-xs" type="number" value={editForm.home_score ?? ""} onChange={(event) => setEditForm((form) => ({ ...form, home_score: event.target.value ? parseInt(event.target.value) : null }))} />
                              <span>-</span>
                              <Input className="h-8 w-14 text-xs" type="number" value={editForm.away_score ?? ""} onChange={(event) => setEditForm((form) => ({ ...form, away_score: event.target.value ? parseInt(event.target.value) : null }))} />
                            </div>
                          ) : (
                            fixture.home_score !== null && fixture.away_score !== null ? `${fixture.home_score}-${fixture.away_score}` : "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit}><Save className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(fixture)}><Pencil className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeleteTarget(fixture.id); setDeleteDialogOpen(true); }}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          )}
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
                {renderTeamSelect(addForm.home_team_id, (value) => setAddForm((form) => ({ ...form, home_team_id: value })), "Select home team")}
              </div>
              <div className="space-y-2">
                <Label>Away Team</Label>
                {renderTeamSelect(addForm.away_team_id, (value) => setAddForm((form) => ({ ...form, away_team_id: value })), "Select away team or BYE", true)}
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
    </div>
  );
};

export default FixturesManagement;

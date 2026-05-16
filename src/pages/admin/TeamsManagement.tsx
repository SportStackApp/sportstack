import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Trophy, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getTeamDisplayName } from "@/lib/utils";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useTeamContext } from "@/contexts/TeamContext";
import type { Database } from "@/integrations/supabase/types";

type Team = Database["public"]["Tables"]["teams"]["Row"];
type Club = Database["public"]["Tables"]["clubs"]["Row"];
type Association = Database["public"]["Tables"]["associations"]["Row"];

interface TeamWithClub extends Team {
  clubs: { name: string; association_id: string } | null;
  divisions?: { name: string } | null;
  team_divisions?: { divisions?: { name: string } | null }[] | null;
}

const TeamsManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin, isAnyAdmin, scopedTeamIds, scopedClubIds, scopedAssociationIds, canManageTeam } = useAdminScope();
  const { selectedAssociationId, selectedClubId, selectedDivision } = useTeamContext();

  const [teams, setTeams] = useState<TeamWithClub[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [divisions, setDivisions] = useState<{ id: string; name: string; association_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamWithClub | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<TeamWithClub | null>(null);
  const [formData, setFormData] = useState({ name: "", club_id: "", age_group: "", division: "", gender: "", home_venue_id: "" });
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) navigate("/dashboard");
  }, [scopeLoading, isAnyAdmin, navigate]);

  const fetchData = async () => {
    setLoading(true);

    let teamsQuery = supabase.from("teams").select("*, clubs:club_id(name, association_id), divisions:division_id(id, name), team_divisions(division_id, divisions(id, name))" as any).order("name");
    if (!isSuperAdmin && scopedTeamIds.length > 0) {
      teamsQuery = teamsQuery.in("id", scopedTeamIds);
    } else if (!isSuperAdmin && scopedClubIds.length > 0) {
      teamsQuery = teamsQuery.in("club_id", scopedClubIds);
    }

    const [teamsRes, clubsRes, associationsRes, venuesRes, divisionsRes] = await Promise.all([
      teamsQuery,
      supabase.from("clubs").select("*").order("name"),
      supabase.from("associations").select("*").order("name"),
      supabase.from("venues").select("id, name").order("name"),
      supabase.from("divisions").select("id, name, association_id").order("name"),
    ]);

    if (teamsRes.error) toast({ title: "Error", description: "Failed to load teams", variant: "destructive" });
    else setTeams(teamsRes.data || []);
    if (!clubsRes.error) setClubs(clubsRes.data || []);
    if (!associationsRes.error) setAssociations(associationsRes.data || []);
    if (!venuesRes.error) setVenues(venuesRes.data || []);
    if (!divisionsRes.error) setDivisions(divisionsRes.data || []);
    setLoading(false);
  };

  const normalizeTeamGenderData = async () => {
    const { error: maleError } = await supabase
      .from("teams")
      .update({ gender: "Open" })
      .in("gender", ["male"]);

    const { error: femaleError } = await supabase
      .from("teams")
      .update({ gender: "Women" })
      .in("gender", ["female"]);

    if (maleError || femaleError) {
      toast({ title: "Error", description: "Failed to normalize team gender values", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!scopeLoading && isAnyAdmin) {
      const load = async () => {
        await normalizeTeamGenderData();
        await fetchData();
      };
      load();
    }
  }, [scopeLoading, isAnyAdmin]);

  // Scoped clubs for form dropdown
  const formClubs = isSuperAdmin
    ? clubs
    : clubs.filter((c) => scopedClubIds.includes(c.id) || scopedAssociationIds.includes(c.association_id));

  // Get divisions for the selected club's association
  const getFilteredDivisions = () => {
    if (!formData.club_id) return divisions;
    const selectedClub = clubs.find(c => c.id === formData.club_id);
    if (!selectedClub) return divisions;
    return divisions.filter(d => d.association_id === selectedClub.association_id);
  };

  let filteredTeams = teams;
  if (selectedAssociationId) {
    filteredTeams = filteredTeams.filter((t) => t.clubs?.association_id === selectedAssociationId);
  }
  if (selectedClubId) {
    filteredTeams = filteredTeams.filter((t) => t.club_id === selectedClubId);
  }
  if (selectedDivision) {
    filteredTeams = filteredTeams.filter((t) => 
      t.divisions?.id === selectedDivision || 
      t.team_divisions?.some(td => td.divisions?.id === selectedDivision || td.division_id === selectedDivision)
    );
  }

  const canAdd = isSuperAdmin || scopedAssociationIds.length > 0 || scopedClubIds.length > 0;
  const canDelete = isSuperAdmin || scopedAssociationIds.length > 0 || scopedClubIds.length > 0;

  const handleOpenDialog = (team?: TeamWithClub) => {
    if (team) {
      setEditingTeam(team);
      setFormData({ name: team.name, club_id: team.club_id, age_group: team.age_group || "", division: team.division || "", gender: team.gender || "", home_venue_id: (team as any).home_venue_id || "" });
    } else {
      setEditingTeam(null);
      const defaultClubId = formClubs.length === 1 ? formClubs[0].id : "";
      const defaultName = defaultClubId ? formClubs.find(c => c.id === defaultClubId)?.name || "" : "";
      setFormData({ name: defaultName, club_id: defaultClubId, age_group: "", division: "", gender: "", home_venue_id: "" });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const selectedClub = clubs.find((c) => c.id === formData.club_id);
    const teamName = formData.name.trim() || selectedClub?.name || "";
    if (!teamName || !formData.club_id) {
      toast({ title: "Error", description: "Name and Club are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const teamData = { name: teamName, club_id: formData.club_id, age_group: formData.age_group || null, division: formData.division.trim() || null, gender: formData.gender || null, home_venue_id: formData.home_venue_id || null } as any;

    if (editingTeam) {
      const { error } = await supabase.from("teams").update(teamData).eq("id", editingTeam.id);
      if (error) toast({ title: "Error", description: "Failed to update team", variant: "destructive" });
      else { toast({ title: "Success", description: "Team updated" }); setDialogOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from("teams").insert(teamData);
      if (error) toast({ title: "Error", description: "Failed to create team", variant: "destructive" });
      else { toast({ title: "Success", description: "Team created" }); setDialogOpen(false); fetchData(); }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingTeam) return;
    const { error } = await supabase.from("teams").delete().eq("id", deletingTeam.id);
    if (error) toast({ title: "Error", description: "Failed to delete team. It may have members.", variant: "destructive" });
    else { toast({ title: "Success", description: "Team deleted" }); fetchData(); }
    setDeleteDialogOpen(false);
    setDeletingTeam(null);
  };

  if (scopeLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground">Manage teams within clubs</p>
        </div>
        {canAdd && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Add Team</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTeam ? "Edit Team" : "Add Team"}</DialogTitle>
                <DialogDescription>{editingTeam ? "Update details" : "Create a new team"}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Club *</Label>
                  <Select value={formData.club_id} onValueChange={(v) => setFormData({ ...formData, club_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select club" /></SelectTrigger>
                    <SelectContent>
                      {formClubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Team name" />
                  {!editingTeam && <p className="text-xs text-muted-foreground">Tip: Rename this team after saving.</p>}
                </div>
                <div className="space-y-2">
                  <Label>Age Group</Label>
                  <Select value={formData.age_group} onValueChange={(v) => setFormData({ ...formData, age_group: v })}>
                    <SelectTrigger><SelectValue placeholder="Select age group" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Seniors">Seniors</SelectItem>
                      <SelectItem value="Juniors">Juniors</SelectItem>
                      <SelectItem value="Masters">Masters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Division *</Label>
                    <Select value={formData.division} onValueChange={(v) => setFormData({ ...formData, division: v })}>
                      <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
                      <SelectContent>
                        {getFilteredDivisions().map((div) => (
                          <SelectItem key={div.id} value={div.id}>
                            {div.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Gender *</Label>
                    <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                      <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="Women">Women</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Home Venue</Label>
                  <Select value={formData.home_venue_id || "__none__"} onValueChange={(v) => setFormData({ ...formData, home_venue_id: v === "__none__" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingTeam ? "Update" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Page-level filters have been removed in favor of the global cascade bar context */}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" />Teams</CardTitle>
          <CardDescription>{filteredTeams.length} team(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredTeams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No teams found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                 <TableHead>Name</TableHead>
                  <TableHead>Club</TableHead>
                  <TableHead>Abbreviation</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">
                      <Link to={`/teams/${team.id}`} className="hover:underline text-primary">
                        {getTeamDisplayName(team)}
                      </Link>
                    </TableCell>
                    <TableCell>{team.clubs?.name || "-"}</TableCell>
                    <TableCell>{team.abbreviation || "-"}</TableCell>
                    <TableCell>
                      {team.divisions?.name || team.team_divisions?.[0]?.divisions?.name || team.division || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageTeam(team.id) && (
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(team)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && canManageTeam(team.id) && (
                        <Button variant="ghost" size="icon" onClick={() => { setDeletingTeam(team); setDeleteDialogOpen(true); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete "{deletingTeam?.name}" and remove all memberships.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamsManagement;

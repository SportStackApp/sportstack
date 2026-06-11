import { useEffect, useState, useMemo } from "react";
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
import type { Database } from "@/integrations/supabase/types";

type Team = Database["public"]["Tables"]["teams"]["Row"] & { division_id?: string | null };
type Club = Database["public"]["Tables"]["clubs"]["Row"];
type Association = Database["public"]["Tables"]["associations"]["Row"];
type Venue = Database["public"]["Tables"]["venues"]["Row"];

interface Division {
  id: string;
  name: string;
  association_id: string;
  season_id: string | null;
}

const TeamsManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin, isAnyAdmin, scopedTeamIds, scopedClubIds, scopedAssociationIds, canManageTeam } = useAdminScope();

  const [teams, setTeams] = useState<Team[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter Bar State
  const [filterAssociation, setFilterAssociation] = useState<string>("all");
  const [filterClub, setFilterClub] = useState<string>("all");
  const [filterDivision, setFilterDivision] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterAssociation, filterClub, filterDivision]);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    club_id: "__none__",
    age_group: "",
    division: "",
    division_id: "__none__",
    gender: "",
    home_venue_id: "__none__"
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) navigate("/dashboard");
  }, [scopeLoading, isAnyAdmin, navigate]);

  const fetchData = async () => {
    setLoading(true);

    const [teamsRes, clubsRes, associationsRes, venuesRes, divisionsRes] = await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase.from("clubs").select("*").order("name"),
      supabase.from("associations").select("*").order("name"),
      supabase.from("venues").select("*").order("name"),
      supabase.from("divisions" as any).select("id, name, association_id, season_id").order("name"),
    ]);

    if (clubsRes.error) toast({ title: "Error", description: "Failed to load clubs", variant: "destructive" });
    if (associationsRes.error) toast({ title: "Error", description: "Failed to load associations", variant: "destructive" });
    if (venuesRes.error) toast({ title: "Error", description: "Failed to load venues", variant: "destructive" });
    if (divisionsRes.error) toast({ title: "Error", description: "Failed to load divisions", variant: "destructive" });

    const allClubs = clubsRes.data || [];
    const allAssociations = associationsRes.data || [];
    const allVenues = venuesRes.data || [];
    const allDivisions = (divisionsRes.data as any) || [];

    setClubs(allClubs);
    setAssociations(allAssociations);
    setVenues(allVenues);
    setDivisions(allDivisions);

    if (teamsRes.error) {
      toast({ title: "Error", description: "Failed to load teams", variant: "destructive" });
    } else {
      let teamsList = (teamsRes.data as Team[]) || [];
      // Scope filter in memory
      if (!isSuperAdmin) {
        teamsList = teamsList.filter((t) => {
          if (scopedTeamIds.includes(t.id)) return true;
          if (scopedClubIds.includes(t.club_id)) return true;
          const club = allClubs.find((c) => c.id === t.club_id);
          if (club && scopedAssociationIds.includes(club.association_id)) return true;
          return false;
        });
      }
      setTeams(teamsList);
    }

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

  // Scoped associations for filters/forms
  const formAssociations = isSuperAdmin
    ? associations
    : associations.filter((a) => scopedAssociationIds.includes(a.id));

  // Scoped clubs for form dropdown
  const formClubs = isSuperAdmin
    ? clubs
    : clubs.filter((c) => scopedClubIds.includes(c.id) || scopedAssociationIds.includes(c.association_id));

  // Get divisions for the selected club's association in dialog
  const getFilteredDivisions = () => {
    if (!formData.club_id || formData.club_id === "__none__") return divisions;
    const selectedClub = clubs.find(c => c.id === formData.club_id);
    if (!selectedClub) return divisions;
    return divisions.filter(d => d.association_id === selectedClub.association_id);
  };

  // Memory filtering of teams list based on cascading filter bar
  const filteredTeams = teams.filter((t) => {
    if (filterAssociation !== "all") {
      const club = clubs.find((c) => c.id === t.club_id);
      if (!club || club.association_id !== filterAssociation) {
        return false;
      }
    }
    if (filterClub !== "all" && t.club_id !== filterClub) {
      return false;
    }
    if (filterDivision !== "all" && t.division_id !== filterDivision) {
      return false;
    }
    return true;
  });

  const paginatedTeams = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return filteredTeams.slice(startIdx, startIdx + rowsPerPage);
  }, [filteredTeams, currentPage, rowsPerPage]);

  const canAdd = isSuperAdmin || scopedAssociationIds.length > 0 || scopedClubIds.length > 0;
  const canDelete = isSuperAdmin || scopedAssociationIds.length > 0 || scopedClubIds.length > 0;

  const handleOpenDialog = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setFormData({
        name: team.name,
        club_id: team.club_id || "__none__",
        age_group: team.age_group || "",
        division: team.division || "",
        division_id: team.division_id || "__none__",
        gender: team.gender || "",
        home_venue_id: team.home_venue_id || "__none__"
      });
    } else {
      setEditingTeam(null);
      const defaultClubId = formClubs.length === 1 ? formClubs[0].id : "__none__";
      const defaultName = defaultClubId !== "__none__" ? formClubs.find(c => c.id === defaultClubId)?.name || "" : "";
      setFormData({
        name: defaultName,
        club_id: defaultClubId,
        age_group: "",
        division: "",
        division_id: "__none__",
        gender: "",
        home_venue_id: "__none__"
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const selectedClub = clubs.find((c) => c.id === formData.club_id);
    const teamName = formData.name.trim() || selectedClub?.name || "";
    
    if (!teamName) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    if (formData.club_id === "__none__") {
      toast({ title: "Error", description: "Club is required", variant: "destructive" });
      return;
    }
    if (formData.division_id === "__none__") {
      toast({ title: "Error", description: "Division is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    const teamData = {
      name: teamName,
      club_id: formData.club_id,
      age_group: formData.age_group || null,
      division: formData.division.trim() || null,
      division_id: formData.division_id,
      gender: formData.gender || null,
      home_venue_id: formData.home_venue_id === "__none__" ? null : formData.home_venue_id
    };

    if (editingTeam) {
      const { error } = await supabase.from("teams").update(teamData).eq("id", editingTeam.id);
      if (error) {
        toast({ title: "Error", description: "Failed to update team", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Team updated" });
        setDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from("teams").insert(teamData);
      if (error) {
        toast({ title: "Error", description: "Failed to create team", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Team created" });
        setDialogOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingTeam) return;
    const { error } = await supabase.from("teams").delete().eq("id", deletingTeam.id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete team. It may have members.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Team deleted" });
      fetchData();
    }
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
                  <Select value={formData.club_id} onValueChange={(v) => setFormData({ ...formData, club_id: v, division_id: "__none__", division: "" })}>
                    <SelectTrigger><SelectValue placeholder="Select club" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select club</SelectItem>
                      {formClubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Team name" />
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
                    <Select
                      value={formData.division_id}
                      disabled={formData.club_id === "__none__"}
                      onValueChange={(v) => {
                        const div = divisions.find(d => d.id === v);
                        setFormData({ ...formData, division_id: v, division: div ? div.name : "" });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder={formData.club_id === "__none__" ? "Select club first" : "Select division"} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select division</SelectItem>
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
                  <Select value={formData.home_venue_id} onValueChange={(v) => setFormData({ ...formData, home_venue_id: v })}>
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

      {/* Cascading Filter Bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="shrink-0">Filter by Association:</Label>
          <Select
            value={filterAssociation}
            onValueChange={(v) => {
              setFilterAssociation(v);
              setFilterClub("all");
              setFilterDivision("all");
            }}
          >
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Associations</SelectItem>
              {formAssociations.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="shrink-0">Filter by Club:</Label>
          <Select
            value={filterClub}
            onValueChange={setFilterClub}
            disabled={filterAssociation === "all"}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder={filterAssociation === "all" ? "Select association first" : "All Clubs"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clubs</SelectItem>
              {clubs.filter(c => c.association_id === filterAssociation).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="shrink-0">Filter by Division:</Label>
          <Select
            value={filterDivision}
            onValueChange={setFilterDivision}
            disabled={filterAssociation === "all"}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder={filterAssociation === "all" ? "Select association first" : "All Divisions"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {divisions.filter(d => d.association_id === filterAssociation).map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" />Teams</CardTitle>
            <CardDescription>{filteredTeams.length} team(s)</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(val) => {
                setRowsPerPage(Number(val));
                setCurrentPage(1);
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
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredTeams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No teams found.</div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Club</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Age Group</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTeams.map((team) => {
                  const clubName = clubs.find((c) => c.id === team.club_id)?.name || "-";
                  const divName = divisions.find((d) => d.id === team.division_id)?.name || team.division || "-";
                  return (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">
                        <Link to={`/teams/${team.id}`} className="hover:underline text-primary">
                          {getTeamDisplayName(team)}
                        </Link>
                      </TableCell>
                      <TableCell>{clubName}</TableCell>
                      <TableCell>{divName}</TableCell>
                      <TableCell>{team.gender || "-"}</TableCell>
                      <TableCell>{team.age_group || "-"}</TableCell>
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
                  );
                })}
              </TableBody>
            </Table>
            {(() => {
              const totalPages = Math.ceil(filteredTeams.length / rowsPerPage);
              if (totalPages <= 1) return null;
              return (
                <div className="flex items-center justify-between mt-4 py-4 border-t px-6">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              );
            })()}
            </>
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

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { LayoutGrid, Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import type { Database } from "@/integrations/supabase/types";

type Association = Database["public"]["Tables"]["associations"]["Row"];

interface Competition {
  id: string;
  association_id: string;
  season_id: string;
  name: string;
  revsports_competition_id: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

interface Division {
  id: string;
  association_id: string;
  season_id: string | null;
  competition_id: string | null;
  name: string;
  gender: string | null;
  age_group: string | null;
  min_age: number | null;
  max_age: number | null;
  default_match_duration_minutes: number | null;
  umpire_vote_scheme_key: "classic_3_2_1" | "junior_2_1_split";
  created_at: string;
}

const DivisionsManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin, scopedAssociationIds } = useAdminScope();

  const hasAccess = isSuperAdmin || scopedAssociationIds.length > 0;

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterAssociation, setFilterAssociation] = useState<string>("all");
  const [filterCompetition, setFilterCompetition] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterAssociation, filterCompetition]);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDivision, setEditingDivision] = useState<Division | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDivision, setDeletingDivision] = useState<Division | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    association_id: "__none__",
    competition_id: "__none__",
    gender: "__none__",
    age_group: "",
    min_age: "",
    max_age: "",
    default_match_duration_minutes: "",
    umpire_vote_scheme_key: "classic_3_2_1",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!scopeLoading && !hasAccess) {
      navigate("/admin");
    }
  }, [scopeLoading, hasAccess, navigate]);

  const fetchData = async () => {
    setLoading(true);

    const [divisionsRes, associationsRes, competitionsRes] = await Promise.all([
      supabase.from("divisions" as any).select("*").order("name"),
      supabase.from("associations").select("*").order("name"),
      supabase.from("competitions" as any).select("*").order("name"),
    ]);

    if (divisionsRes.error) {
      toast({ title: "Error", description: "Failed to load divisions", variant: "destructive" });
    } else {
      setDivisions((divisionsRes.data as any) || []);
    }

    if (!associationsRes.error) setAssociations(associationsRes.data || []);
    if (!competitionsRes.error) setCompetitions((competitionsRes.data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!scopeLoading && hasAccess) fetchData();
  }, [scopeLoading, hasAccess]);

  const formAssociations = isSuperAdmin
    ? associations
    : associations.filter((a) => scopedAssociationIds.includes(a.id));

  // Available competitions for dropdown in dialog (filtered by chosen association)
  const dialogCompetitions = competitions.filter(
    (c) => c.association_id === formData.association_id
  );

  // Available competitions for filter bar (filtered by chosen association)
  const filterCompetitions = competitions.filter(
    (c) => c.association_id === filterAssociation
  );

  const filteredDivisions = divisions.filter((div) => {
    // Admin scope filter
    if (!isSuperAdmin && !scopedAssociationIds.includes(div.association_id)) {
      return false;
    }
    // Association filter selection
    if (filterAssociation !== "all" && div.association_id !== filterAssociation) {
      return false;
    }
    // Competition filter selection
    if (filterCompetition !== "all" && div.competition_id !== filterCompetition) {
      return false;
    }
    return true;
  });

  const paginatedDivisions = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return filteredDivisions.slice(startIdx, startIdx + rowsPerPage);
  }, [filteredDivisions, currentPage, rowsPerPage]);

  const associationById = useMemo(
    () => new Map(associations.map((association) => [association.id, association])),
    [associations],
  );

  const handleOpenDialog = (div?: Division) => {
    if (div) {
      setEditingDivision(div);
      setFormData({
        name: div.name,
        association_id: div.association_id || "__none__",
        competition_id: div.competition_id || "__none__",
        gender: div.gender || "__none__",
        age_group: div.age_group || "",
        min_age: div.min_age !== null && div.min_age !== undefined ? div.min_age.toString() : "",
        max_age: div.max_age !== null && div.max_age !== undefined ? div.max_age.toString() : "",
        default_match_duration_minutes: div.default_match_duration_minutes?.toString() ?? "",
        umpire_vote_scheme_key: div.umpire_vote_scheme_key || "classic_3_2_1",
      });
    } else {
      setEditingDivision(null);
      const defaultAssocId = formAssociations.length === 1 ? formAssociations[0].id : "__none__";
      setFormData({
        name: "",
        association_id: defaultAssocId,
        competition_id: "__none__",
        gender: "__none__",
        age_group: "",
        min_age: "",
        max_age: "",
        default_match_duration_minutes: "",
        umpire_vote_scheme_key: "classic_3_2_1",
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    if (formData.association_id === "__none__") {
      toast({ title: "Error", description: "Association is required", variant: "destructive" });
      return;
    }
    if (formData.competition_id === "__none__") {
      toast({ title: "Error", description: "Competition is required", variant: "destructive" });
      return;
    }

    const durationText = formData.default_match_duration_minutes.trim();
    const durationMinutes = durationText === "" ? null : Number(durationText);
    if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 240)) {
      toast({
        title: "Check match duration",
        description: "Enter a whole number from 30 to 240 minutes, or leave it blank to inherit the association default.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    const selectedComp = competitions.find((c) => c.id === formData.competition_id);
    const seasonId = selectedComp ? selectedComp.season_id : null;

    const payload = {
      name: formData.name.trim(),
      association_id: formData.association_id,
      competition_id: formData.competition_id,
      season_id: seasonId,
      gender: formData.gender === "__none__" ? null : formData.gender,
      age_group: formData.age_group.trim() || null,
      min_age: formData.min_age.trim() !== "" ? parseInt(formData.min_age, 10) : null,
      max_age: formData.max_age.trim() !== "" ? parseInt(formData.max_age, 10) : null,
      default_match_duration_minutes: durationMinutes,
      umpire_vote_scheme_key: formData.umpire_vote_scheme_key,
    };

    if (editingDivision) {
      const { error } = await supabase
        .from("divisions" as any)
        .update(payload)
        .eq("id", editingDivision.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update division", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Division updated" });
        setDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from("divisions" as any)
        .insert(payload);

      if (error) {
        toast({ title: "Error", description: "Failed to create division", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Division created" });
        setDialogOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingDivision) return;
    const { error } = await supabase
      .from("divisions" as any)
      .delete()
      .eq("id", deletingDivision.id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete division", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Division deleted" });
      fetchData();
    }
    setDeleteDialogOpen(false);
    setDeletingDivision(null);
  };

  if (scopeLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Divisions</h1>
          <p className="text-muted-foreground">Manage division settings and assignments</p>
        </div>
        {hasAccess && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Add Division</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingDivision ? "Edit Division" : "Add Division"}</DialogTitle>
                <DialogDescription>{editingDivision ? "Update details" : "Create a new division"}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Association *</Label>
                  <Select
                    value={formData.association_id}
                    onValueChange={(v) => setFormData({ ...formData, association_id: v, competition_id: "__none__" })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select association" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select association</SelectItem>
                      {formAssociations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Competition *</Label>
                  <Select
                    value={formData.competition_id}
                    onValueChange={(v) => setFormData({ ...formData, competition_id: v })}
                    disabled={formData.association_id === "__none__"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.association_id === "__none__" ? "Select association first" : "Select competition"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select competition</SelectItem>
                      {dialogCompetitions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Division 1 Open"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="division-match-duration">Match duration (minutes)</Label>
                  <Input
                    id="division-match-duration"
                    type="number"
                    min={30}
                    max={240}
                    step={1}
                    value={formData.default_match_duration_minutes}
                    onChange={(e) => setFormData({ ...formData, default_match_duration_minutes: e.target.value })}
                    placeholder="Inherit association default"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to inherit {associationById.get(formData.association_id)?.default_match_duration_minutes ?? 90} minutes from the association.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(v) => setFormData({ ...formData, gender: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="Womens">Women's</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Umpire Match Voting scheme</Label>
                  <Select
                    value={formData.umpire_vote_scheme_key}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      umpire_vote_scheme_key: value as "classic_3_2_1" | "junior_2_1_split",
                    })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classic_3_2_1">Classic 3/2/1</SelectItem>
                      <SelectItem value="junior_2_1_split">2/1 Male + 2/1 Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This scheme is applied automatically when an umpire selects this division.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Age Group</Label>
                  <Select
                    value={formData.age_group || "none"}
                    onValueChange={(v) => {
                      const val = v === "none" ? "" : v;
                      setFormData({ ...formData, age_group: val, min_age: "", max_age: "" });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      <SelectItem value="Juniors">Juniors</SelectItem>
                      <SelectItem value="Seniors">Seniors</SelectItem>
                      <SelectItem value="Masters">Masters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(formData.age_group === "Juniors" || formData.age_group === "Masters") && (
                  <div className="grid grid-cols-2 gap-4">
                    {formData.age_group === "Juniors" && (
                      <div className="space-y-2 col-span-2 sm:col-span-1">
                        <Label>Max Age</Label>
                        <p className="text-xs text-muted-foreground">
                          Age on 31 Dec of competition year. Players must be this age or younger.
                        </p>
                        <Input
                          type="number"
                          min={5}
                          max={21}
                          value={formData.max_age}
                          onChange={(e) => setFormData({ ...formData, max_age: e.target.value })}
                        />
                      </div>
                    )}
                    {formData.age_group === "Masters" && (
                      <div className="space-y-2 col-span-2 sm:col-span-1">
                        <Label>Min Age</Label>
                        <p className="text-xs text-muted-foreground">
                          Age on 31 Dec of competition year. Players must have reached this age.
                        </p>
                        <Input
                          type="number"
                          min={25}
                          max={80}
                          value={formData.min_age}
                          onChange={(e) => setFormData({ ...formData, min_age: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingDivision ? "Update" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filter Bar */}
      {(isSuperAdmin || scopedAssociationIds.length > 1) && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="shrink-0">Filter by Association:</Label>
            <Select
              value={filterAssociation}
              onValueChange={(v) => {
                setFilterAssociation(v);
                setFilterCompetition("all");
              }}
            >
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Associations</SelectItem>
                {(isSuperAdmin ? associations : associations.filter((a) => scopedAssociationIds.includes(a.id))).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="shrink-0">Filter by Competition:</Label>
            <Select
              value={filterCompetition}
              onValueChange={setFilterCompetition}
              disabled={filterAssociation === "all"}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder={filterAssociation === "all" ? "Select association first" : "All Competitions"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Competitions</SelectItem>
                {filterCompetitions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" />Divisions</CardTitle>
            <CardDescription>{filteredDivisions.length} division(s)</CardDescription>
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
          ) : filteredDivisions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No divisions found.</div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Competition</TableHead>
                  <TableHead>Association</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Age Group</TableHead>
                  <TableHead>Match Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDivisions.map((div) => {
                  const compName = competitions.find((c) => c.id === div.competition_id)?.name || "-";
                  const assocName = associationById.get(div.association_id)?.name || "-";
                  return (
                    <TableRow key={div.id}>
                      <TableCell className="font-medium">{div.name}</TableCell>
                      <TableCell>{compName}</TableCell>
                      <TableCell>{assocName}</TableCell>
                      <TableCell>{div.gender === "Womens" ? "Women's" : (div.gender || "-")}</TableCell>
                      <TableCell>
                        {div.age_group ? div.age_group + (div.max_age ? " (U" + div.max_age + ")" : "") + (div.min_age ? " (" + div.min_age + "+)" : "") : "-"}
                      </TableCell>
                      <TableCell>
                        {div.default_match_duration_minutes !== null
                          ? `${div.default_match_duration_minutes} min`
                          : `Inherits ${associationById.get(div.association_id)?.default_match_duration_minutes ?? 90} min`}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(div)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setDeletingDivision(div); setDeleteDialogOpen(true); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {(() => {
              const totalPages = Math.ceil(filteredDivisions.length / rowsPerPage);
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
            <AlertDialogTitle>Delete Division?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingDivision?.name}". Teams linked to this division will lose their division assignment.
            </AlertDialogDescription>
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

export default DivisionsManagement;

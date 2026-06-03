import { useEffect, useState } from "react";
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
      supabase.from("divisions").select("*").order("name"),
      supabase.from("associations").select("*").order("name"),
      supabase.from("competitions").select("*").order("name"),
    ]);

    if (divisionsRes.error) {
      toast({ title: "Error", description: "Failed to load divisions", variant: "destructive" });
    } else {
      setDivisions((divisionsRes.data as Division[]) || []);
    }

    if (!associationsRes.error) setAssociations(associationsRes.data || []);
    if (!competitionsRes.error) setCompetitions((competitionsRes.data as Competition[]) || []);
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

  const handleOpenDialog = (div?: Division) => {
    if (div) {
      setEditingDivision(div);
      setFormData({
        name: div.name,
        association_id: div.association_id || "__none__",
        competition_id: div.competition_id || "__none__",
        gender: div.gender || "__none__",
        age_group: div.age_group || "",
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
    };

    if (editingDivision) {
      const { error } = await supabase
        .from("divisions")
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
        .from("divisions")
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
      .from("divisions")
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
                  <Label>Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(v) => setFormData({ ...formData, gender: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="Women">Women</SelectItem>
                      <SelectItem value="Men">Men</SelectItem>
                      <SelectItem value="Mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Age Group</Label>
                  <Input
                    value={formData.age_group}
                    onChange={(e) => setFormData({ ...formData, age_group: e.target.value })}
                    placeholder="e.g., Under 16"
                  />
                </div>
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" />Divisions</CardTitle>
          <CardDescription>{filteredDivisions.length} division(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredDivisions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No divisions found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Competition</TableHead>
                  <TableHead>Association</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Age Group</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDivisions.map((div) => {
                  const compName = competitions.find((c) => c.id === div.competition_id)?.name || "-";
                  const assocName = associations.find((a) => a.id === div.association_id)?.name || "-";
                  return (
                    <TableRow key={div.id}>
                      <TableCell className="font-medium">{div.name}</TableCell>
                      <TableCell>{compName}</TableCell>
                      <TableCell>{assocName}</TableCell>
                      <TableCell>{div.gender || "-"}</TableCell>
                      <TableCell>{div.age_group || "-"}</TableCell>
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

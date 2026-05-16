import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { LayoutGrid, Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Division {
  id: string;
  name: string;
  association_id: string;
  season_id: string | null;
  gender: string | null;
  age_group: string | null;
  min_age: number | null;
  max_age: number | null;
  created_at: string;
  associations?: { name: string } | null;
}

type DivisionTeam = {
  id: string;
  name: string;
  abbreviation: string | null;
  club_name: string | null;
  division_id: string | null;
};

const DivisionsManagement = () => {
  const { toast } = useToast();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [associations, setAssociations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDivision, setEditingDivision] = useState<Division | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDivision, setDeletingDivision] = useState<Division | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    association_id: "",
    age_group: "",
    gender: "",
    min_age: "",
    max_age: "",
  });
  const [expandedDivisionIds, setExpandedDivisionIds] = useState<string[]>([]);
  const [divisionTeams, setDivisionTeams] = useState<Record<string, DivisionTeam[]>>({});
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [divisionsRes, associationsRes, teamsRes] = await Promise.all([
      supabase
        .from("divisions")
        .select("*, associations:association_id(name)")
        .order("name"),
      supabase.from("associations").select("id, name").order("name"),
      supabase
        .from("teams")
        .select("id,name,abbreviation,division_id, clubs:club_id(name)")
        .order("name"),
    ]);

    if (divisionsRes.error) {
      toast({ title: "Error", description: "Failed to load divisions", variant: "destructive" });
    } else {
      setDivisions(divisionsRes.data || []);
    }
    if (!associationsRes.error) {
      setAssociations(associationsRes.data || []);
    }
    if (!teamsRes.error) {
      const grouped: Record<string, DivisionTeam[]> = {};
      (teamsRes.data || []).forEach((team: any) => {
        const divisionId = team.division_id;
        if (!divisionId) return;
        if (!grouped[divisionId]) grouped[divisionId] = [];
        grouped[divisionId].push({
          id: team.id,
          name: team.name,
          abbreviation: team.abbreviation || null,
          club_name: team.clubs?.name || null,
          division_id: divisionId,
        });
      });
      setDivisionTeams(grouped);
    } else {
      setDivisionTeams({});
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleDivisionExpanded = (divisionId: string) => {
    setExpandedDivisionIds((prev) =>
      prev.includes(divisionId) ? prev.filter((id) => id !== divisionId) : [...prev, divisionId]
    );
  };

  const handleOpenDialog = (division?: Division) => {
    if (division) {
      setEditingDivision(division);
      setFormData({
        name: division.name,
        association_id: division.association_id,
        age_group: division.age_group || "",
        gender: division.gender || "",
        min_age: division.min_age?.toString() || "",
        max_age: division.max_age?.toString() || "",
      });
    } else {
      setEditingDivision(null);
      setFormData({
        name: "",
        association_id: "",
        age_group: "",
        gender: "",
        min_age: "",
        max_age: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.association_id) {
      toast({ title: "Error", description: "Division name and Association are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    const divisionData = {
      name: formData.name.trim(),
      association_id: formData.association_id,
      age_group: formData.age_group || null,
      gender: formData.gender || null,
      min_age: formData.min_age ? parseInt(formData.min_age) : null,
      max_age: formData.max_age ? parseInt(formData.max_age) : null,
    };

    if (editingDivision) {
      const { error } = await supabase
        .from("divisions")
        .update(divisionData)
        .eq("id", editingDivision.id);
      if (error) {
        toast({ title: "Error", description: "Failed to update division", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Division updated" });
        setDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from("divisions").insert(divisionData);
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
    const { error } = await supabase.from("divisions").delete().eq("id", deletingDivision.id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete division", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Division deleted" });
      fetchData();
    }
    setDeleteDialogOpen(false);
    setDeletingDivision(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <LayoutGrid className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Divisions Management</h1>
            <p className="text-muted-foreground">Manage divisions across associations</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Division
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingDivision ? "Edit Division" : "Add Division"}</DialogTitle>
              <DialogDescription>
                {editingDivision ? "Update division details" : "Create a new division"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Division Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Premier Division, U16 Division"
                />
              </div>
              <div className="space-y-2">
                <Label>Association *</Label>
                <Select value={formData.association_id} onValueChange={(v) => setFormData({ ...formData, association_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select association" />
                  </SelectTrigger>
                  <SelectContent>
                    {associations.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Age Group</Label>
                <Select value={formData.age_group} onValueChange={(v) => setFormData({ ...formData, age_group: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select age group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Juniors">Juniors</SelectItem>
                    <SelectItem value="Seniors">Seniors</SelectItem>
                    <SelectItem value="Masters">Masters</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Women">Women</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Age</Label>
                  <Input
                    type="number"
                    value={formData.min_age}
                    onChange={(e) => setFormData({ ...formData, min_age: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Age</Label>
                  <Input
                    type="number"
                    value={formData.max_age}
                    onChange={(e) => setFormData({ ...formData, max_age: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingDivision ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold">{divisions.length}</div>
          <p className="text-xs text-muted-foreground">Total Divisions</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Divisions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : divisions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No divisions found. Create one to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Association</TableHead>
                  <TableHead>Age Group</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Age Range</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {divisions.map((division) => {
                  const isExpanded = expandedDivisionIds.includes(division.id);
                  const teamsForDivision = divisionTeams[division.id] || [];
                  return [
                    <TableRow key={division.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            onClick={() => toggleDivisionExpanded(division.id)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          {division.name}
                        </div>
                      </TableCell>
                      <TableCell>{division.associations?.name || "-"}</TableCell>
                      <TableCell>{division.age_group || "-"}</TableCell>
                      <TableCell>{division.gender || "-"}</TableCell>
                      <TableCell>
                        {division.min_age || division.max_age
                          ? `${division.min_age || "*"} - ${division.max_age || "*"}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(division)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingDivision(division);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>,
                    isExpanded && (
                      <TableRow key={`${division.id}-teams`}>
                        <TableCell colSpan={6} className="bg-muted/10">
                          {teamsForDivision.length > 0 ? (
                            <ul className="pl-10 text-sm text-muted-foreground space-y-2">
                              {teamsForDivision.map((team) => (
                                <li key={team.id}>
                                  <span className="font-medium">{team.name}</span>
                                  {team.club_name ? ` — ${team.club_name}` : ""}
                                  {team.abbreviation ? ` (${team.abbreviation})` : ""}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="pl-10 text-sm text-muted-foreground">No teams in this division.</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ),
                  ];
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
              This will permanently delete "{deletingDivision?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DivisionsManagement;

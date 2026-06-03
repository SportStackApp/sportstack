import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { useAdminScope } from "@/hooks/useAdminScope";
import type { Database } from "@/integrations/supabase/types";

type Association = Database["public"]["Tables"]["associations"]["Row"];
type Season = Database["public"]["Tables"]["seasons"]["Row"];

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

const CompetitionsManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin, scopedAssociationIds } = useAdminScope();

  const hasAccess = isSuperAdmin || scopedAssociationIds.length > 0;

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAssociation, setFilterAssociation] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCompetition, setDeletingCompetition] = useState<Competition | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    association_id: "__none__",
    season_id: "__none__",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!scopeLoading && !hasAccess) {
      navigate("/admin");
    }
  }, [scopeLoading, hasAccess, navigate]);

  const fetchData = async () => {
    setLoading(true);

    const [competitionsRes, associationsRes, seasonsRes] = await Promise.all([
      supabase.from("competitions").select("*").order("name"),
      supabase.from("associations").select("*").order("name"),
      supabase.from("seasons").select("*").order("name"),
    ]);

    if (competitionsRes.error) {
      toast({ title: "Error", description: "Failed to load competitions", variant: "destructive" });
    } else {
      setCompetitions((competitionsRes.data as Competition[]) || []);
    }

    if (!associationsRes.error) setAssociations(associationsRes.data || []);
    if (!seasonsRes.error) setSeasons(seasonsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!scopeLoading && hasAccess) fetchData();
  }, [scopeLoading, hasAccess]);

  const filteredCompetitions = competitions.filter((comp) => {
    // Check admin scopes
    if (!isSuperAdmin && !scopedAssociationIds.includes(comp.association_id)) {
      return false;
    }
    // Check filter selection
    if (filterAssociation !== "all" && comp.association_id !== filterAssociation) {
      return false;
    }
    return true;
  });

  const canAdd = isSuperAdmin || scopedAssociationIds.length > 0;
  const canDelete = isSuperAdmin || scopedAssociationIds.length > 0;

  const formAssociations = isSuperAdmin
    ? associations
    : associations.filter((a) => scopedAssociationIds.includes(a.id));

  // Filter seasons based on selected association in dialog
  const dialogSeasons = seasons.filter(
    (s) => s.association_id === formData.association_id
  );

  const handleOpenDialog = (comp?: Competition) => {
    if (comp) {
      setEditingCompetition(comp);
      setFormData({
        name: comp.name,
        association_id: comp.association_id || "__none__",
        season_id: comp.season_id || "__none__",
        is_active: comp.is_active ?? true,
      });
    } else {
      setEditingCompetition(null);
      const defaultAssocId = formAssociations.length === 1 ? formAssociations[0].id : "__none__";
      setFormData({
        name: "",
        association_id: defaultAssocId,
        season_id: "__none__",
        is_active: true,
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
    if (formData.season_id === "__none__") {
      toast({ title: "Error", description: "Season is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      name: formData.name.trim(),
      association_id: formData.association_id,
      season_id: formData.season_id,
      is_active: formData.is_active,
    };

    if (editingCompetition) {
      const { error } = await supabase
        .from("competitions")
        .update(payload)
        .eq("id", editingCompetition.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update competition", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Competition updated" });
        setDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase
        .from("competitions")
        .insert(payload);

      if (error) {
        toast({ title: "Error", description: "Failed to create competition", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Competition created" });
        setDialogOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingCompetition) return;
    const { error } = await supabase
      .from("competitions")
      .delete()
      .eq("id", deletingCompetition.id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete competition", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Competition deleted" });
      fetchData();
    }
    setDeleteDialogOpen(false);
    setDeletingCompetition(null);
  };

  if (scopeLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Competitions</h1>
          <p className="text-muted-foreground">Manage association competitions and seasons</p>
        </div>
        {canAdd && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Add Competition</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCompetition ? "Edit Competition" : "Add Competition"}</DialogTitle>
                <DialogDescription>{editingCompetition ? "Update details" : "Create a new competition"}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Association *</Label>
                  <Select
                    value={formData.association_id}
                    onValueChange={(v) => setFormData({ ...formData, association_id: v, season_id: "__none__" })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select association" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select association</SelectItem>
                      {formAssociations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Season *</Label>
                  <Select
                    value={formData.season_id}
                    onValueChange={(v) => setFormData({ ...formData, season_id: v })}
                    disabled={formData.association_id === "__none__"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.association_id === "__none__" ? "Select association first" : "Select season"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select season</SelectItem>
                      {dialogSeasons.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Winter 2026 Premier League"
                  />
                </div>
                <div className="flex items-center justify-between space-y-2 rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <Label>Active</Label>
                    <p className="text-xs text-muted-foreground">Show this competition on the platform</p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingCompetition ? "Update" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filter */}
      {(isSuperAdmin || scopedAssociationIds.length > 1) && (
        <div className="flex items-center gap-4">
          <Label>Filter by Association:</Label>
          <Select value={filterAssociation} onValueChange={setFilterAssociation}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Associations</SelectItem>
              {(isSuperAdmin ? associations : associations.filter((a) => scopedAssociationIds.includes(a.id))).map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" />Competitions</CardTitle>
          <CardDescription>{filteredCompetitions.length} competition(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredCompetitions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No competitions found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Association</TableHead>
                  <TableHead>Season</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompetitions.map((comp) => {
                  const assocName = associations.find((a) => a.id === comp.association_id)?.name || "-";
                  const seasonName = seasons.find((s) => s.id === comp.season_id)?.name || "-";
                  return (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium">{comp.name}</TableCell>
                      <TableCell>{assocName}</TableCell>
                      <TableCell>{seasonName}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${comp.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                          {comp.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(comp)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingCompetition(comp); setDeleteDialogOpen(true); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
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
            <AlertDialogTitle>Delete Competition?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingCompetition?.name}". This will unlink any divisions assigned to this competition.
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

export default CompetitionsManagement;

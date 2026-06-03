import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, ArrowLeft, ChevronDown, ChevronRight, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";
import type { Database } from "@/integrations/supabase/types";

type Venue = Database["public"]["Tables"]["venues"]["Row"];
type Pitch = Database["public"]["Tables"]["pitches"]["Row"];
type Association = Database["public"]["Tables"]["associations"]["Row"];

interface VenueWithMeta extends Venue {
  pitchCount: number;
  associationName: string | null;
}

const EMPTY_FORM = {
  name: "", address: "", suburb: "", state: "", postcode: "",
  phone: "", email: "", association_id: "", available_times: "", notes: "",
};

const VenuesManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    loading: scopeLoading, isSuperAdmin, isAnyAdmin,
    scopedAssociationIds, highestScopedRole,
  } = useAdminScope();

  const canEdit = isSuperAdmin || highestScopedRole === "ASSOCIATION_ADMIN";
  const isViewOnly = isAnyAdmin && !canEdit;

  const [venues, setVenues] = useState<VenueWithMeta[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAssociation, setFilterAssociation] = useState<string>("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingVenue, setDeletingVenue] = useState<Venue | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<{ pitchCount: number; teamNames: string[] } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Pitches inline
  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [pitchesLoading, setPitchesLoading] = useState(false);
  const [newPitchName, setNewPitchName] = useState("");
  const [editingPitch, setEditingPitch] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) navigate("/dashboard");
  }, [scopeLoading, isAnyAdmin, navigate]);

  const fetchVenues = async () => {
    setLoading(true);
    const [venuesRes, pitchesRes, assocRes] = await Promise.all([
      supabase.from("venues").select("*").order("name"),
      supabase.from("pitches").select("venue_id"),
      supabase.from("associations").select("*").order("name"),
    ]);

    const allAssoc = assocRes.data || [];
    setAssociations(allAssoc);

    const pitchCounts: Record<string, number> = {};
    (pitchesRes.data || []).forEach((p) => {
      pitchCounts[p.venue_id] = (pitchCounts[p.venue_id] || 0) + 1;
    });

    let venuesList = venuesRes.data || [];
    // Scope for ASSOCIATION_ADMIN
    if (!isSuperAdmin && scopedAssociationIds.length > 0) {
      venuesList = venuesList.filter(
        (v) => v.association_id && scopedAssociationIds.includes(v.association_id)
      );
    }

    setVenues(
      venuesList.map((v) => ({
        ...v,
        pitchCount: pitchCounts[v.id] || 0,
        associationName: v.association_id
          ? allAssoc.find((a) => a.id === v.association_id)?.name || null
          : null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    if (!scopeLoading && isAnyAdmin) fetchVenues();
  }, [scopeLoading, isAnyAdmin]);

  // Scoped associations for dropdown
  const formAssociations = isSuperAdmin
    ? associations
    : associations.filter((a) => scopedAssociationIds.includes(a.id));

  // --- Dialog handlers ---
  const handleOpenDialog = (venue?: Venue) => {
    if (venue) {
      setEditingVenue(venue);
      setFormData({
        name: venue.name,
        address: venue.address || "",
        suburb: venue.suburb || "",
        state: venue.state || "",
        postcode: venue.postcode || "",
        phone: venue.phone || "",
        email: venue.email || "",
        association_id: venue.association_id || "",
        available_times: venue.available_times || "",
        notes: venue.notes || "",
      });
    } else {
      setEditingVenue(null);
      const defaultAssoc = formAssociations.length === 1 ? formAssociations[0].id : "";
      setFormData({ ...EMPTY_FORM, association_id: defaultAssoc });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: formData.name.trim(),
      address: formData.address.trim() || null,
      suburb: formData.suburb.trim() || null,
      state: formData.state.trim() || null,
      postcode: formData.postcode.trim() || null,
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      association_id: formData.association_id || null,
      available_times: formData.available_times.trim() || null,
      notes: formData.notes.trim() || null,
    };

    if (editingVenue) {
      const { error } = await supabase.from("venues").update(payload).eq("id", editingVenue.id);
      if (error) toast({ title: "Error", description: "Failed to update venue", variant: "destructive" });
      else { toast({ title: "Success", description: "Venue updated" }); setDialogOpen(false); fetchVenues(); }
    } else {
      const { error } = await supabase.from("venues").insert(payload);
      if (error) toast({ title: "Error", description: "Failed to create venue", variant: "destructive" });
      else { toast({ title: "Success", description: "Venue created" }); setDialogOpen(false); fetchVenues(); }
    }
    setSaving(false);
  };

  // --- Delete with safety check ---
  const handleDeleteClick = async (venue: Venue) => {
    setDeletingVenue(venue);
    const [pitchesRes, teamsRes] = await Promise.all([
      supabase.from("pitches").select("id", { count: "exact", head: true }).eq("venue_id", venue.id),
      supabase.from("teams").select("name").eq("home_venue_id", venue.id),
    ]);
    setDeleteInfo({
      pitchCount: pitchesRes.count || 0,
      teamNames: (teamsRes.data || []).map((t) => t.name),
    });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingVenue) return;
    setDeleting(true);

    // 1. Delete pitches
    await supabase.from("pitches").delete().eq("venue_id", deletingVenue.id);
    // 2. Clear home_venue_id on teams
    await supabase.from("teams").update({ home_venue_id: null }).eq("home_venue_id", deletingVenue.id);
    // 3. Delete venue
    const { error } = await supabase.from("venues").delete().eq("id", deletingVenue.id);
    if (error) toast({ title: "Error", description: "Failed to delete venue", variant: "destructive" });
    else { toast({ title: "Success", description: "Venue deleted" }); fetchVenues(); }

    setDeleting(false);
    setDeleteDialogOpen(false);
    setDeletingVenue(null);
    setDeleteInfo(null);
  };

  // --- Pitches inline ---
  const togglePitches = async (venueId: string) => {
    if (expandedVenueId === venueId) {
      setExpandedVenueId(null);
      return;
    }
    setExpandedVenueId(venueId);
    setPitchesLoading(true);
    const { data } = await supabase.from("pitches").select("*").eq("venue_id", venueId).order("name");
    setPitches(data || []);
    setPitchesLoading(false);
    setNewPitchName("");
    setEditingPitch(null);
  };

  const handleAddPitch = async () => {
    if (!newPitchName.trim() || !expandedVenueId) return;
    const { error } = await supabase.from("pitches").insert({ venue_id: expandedVenueId, name: newPitchName.trim() });
    if (error) toast({ title: "Error", description: "Failed to add pitch", variant: "destructive" });
    else {
      setNewPitchName("");
      const { data } = await supabase.from("pitches").select("*").eq("venue_id", expandedVenueId).order("name");
      setPitches(data || []);
      fetchVenues(); // refresh counts
    }
  };

  const handleRenamePitch = async () => {
    if (!editingPitch || !editingPitch.name.trim()) return;
    const { error } = await supabase.from("pitches").update({ name: editingPitch.name.trim() }).eq("id", editingPitch.id);
    if (error) toast({ title: "Error", description: "Failed to rename pitch", variant: "destructive" });
    else {
      setEditingPitch(null);
      const { data } = await supabase.from("pitches").select("*").eq("venue_id", expandedVenueId!).order("name");
      setPitches(data || []);
    }
  };

  const handleDeletePitch = async (pitchId: string) => {
    const { error } = await supabase.from("pitches").delete().eq("id", pitchId);
    if (error) toast({ title: "Error", description: "Failed to delete pitch", variant: "destructive" });
    else {
      const { data } = await supabase.from("pitches").select("*").eq("venue_id", expandedVenueId!).order("name");
      setPitches(data || []);
      fetchVenues();
    }
  };

  if (scopeLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Venues</h1>
            {isViewOnly && <Badge variant="secondary">View only</Badge>}
          </div>
          <p className="text-muted-foreground">Manage grounds and pitches</p>
        </div>
        {canEdit && (
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />Add Venue
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      {(isSuperAdmin || scopedAssociationIds.length > 1) && (
        <div className="flex items-center gap-4">
          <Label>Filter by Association:</Label>
          <Select value={filterAssociation} onValueChange={setFilterAssociation}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Associations</SelectItem>
              {formAssociations.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (venues.filter(v => filterAssociation === "all" || v.association_id === filterAssociation)).length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No venues found.</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Suburb</TableHead>
                <TableHead>Association</TableHead>
                <TableHead>Pitches</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(venues.filter(v => filterAssociation === "all" || v.association_id === filterAssociation)).map((venue) => (
                <Collapsible key={venue.id} open={expandedVenueId === venue.id} asChild>
                  <>
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {venue.name}
                        </div>
                      </TableCell>
                      <TableCell>{venue.suburb || "-"}</TableCell>
                      <TableCell>{venue.associationName || "-"}</TableCell>
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => togglePitches(venue.id)}>
                            {expandedVenueId === venue.id ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                            {venue.pitchCount}
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(venue)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(venue)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                    <CollapsibleContent asChild>
                      <tr>
                        <td colSpan={canEdit ? 5 : 4} className="p-0">
                          <div className="bg-muted/50 px-6 py-4 space-y-3">
                            <p className="text-sm font-medium">Pitches at {venue.name}</p>
                            {pitchesLoading ? (
                              <Skeleton className="h-8 w-full" />
                            ) : pitches.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No pitches yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {pitches.map((pitch) => (
                                  <div key={pitch.id} className="flex items-center gap-2">
                                    {editingPitch?.id === pitch.id ? (
                                      <>
                                        <Input
                                          value={editingPitch.name}
                                          onChange={(e) => setEditingPitch({ ...editingPitch, name: e.target.value })}
                                          className="h-8 w-48"
                                          onKeyDown={(e) => e.key === "Enter" && handleRenamePitch()}
                                        />
                                        <Button size="sm" variant="outline" onClick={handleRenamePitch}>Save</Button>
                                        <Button size="sm" variant="ghost" onClick={() => setEditingPitch(null)}>Cancel</Button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-sm">{pitch.name}</span>
                                        {pitch.notes && <span className="text-xs text-muted-foreground">— {pitch.notes}</span>}
                                        {canEdit && (
                                          <>
                                            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setEditingPitch({ id: pitch.id, name: pitch.name })}>
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => handleDeletePitch(pitch.id)}>
                                              <Trash2 className="h-3 w-3 text-destructive" />
                                            </Button>
                                          </>
                                        )}
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {canEdit && (
                              <div className="flex items-center gap-2 pt-1">
                                <Input
                                  value={newPitchName}
                                  onChange={(e) => setNewPitchName(e.target.value)}
                                  placeholder="New pitch name"
                                  className="h-8 w-48"
                                  onKeyDown={(e) => e.key === "Enter" && handleAddPitch()}
                                />
                                <Button size="sm" onClick={handleAddPitch} disabled={!newPitchName.trim()}>
                                  <Plus className="h-3 w-3 mr-1" />Add
                                </Button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVenue ? "Edit Venue" : "Add Venue"}</DialogTitle>
            <DialogDescription>{editingVenue ? "Update venue details" : "Create a new venue"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Venue name" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Street address" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Suburb</Label>
                <Input value={formData.suburb} onChange={(e) => setFormData({ ...formData, suburb: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Postcode</Label>
                <Input value={formData.postcode} onChange={(e) => setFormData({ ...formData, postcode: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Association</Label>
              <Select value={formData.association_id || "__none__"} onValueChange={(v) => setFormData({ ...formData, association_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {formAssociations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Available Times</Label>
              <Textarea value={formData.available_times} onChange={(e) => setFormData({ ...formData, available_times: e.target.value })} placeholder="e.g. Saturdays 9am-6pm" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingVenue ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Venue?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>This will permanently delete "{deletingVenue?.name}".</p>
                {deleteInfo && (deleteInfo.pitchCount > 0 || deleteInfo.teamNames.length > 0) && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-1">
                    {deleteInfo.pitchCount > 0 && (
                      <p className="text-sm font-medium">⚠️ This venue has {deleteInfo.pitchCount} pitch(es) that will be removed.</p>
                    )}
                    {deleteInfo.teamNames.length > 0 && (
                      <p className="text-sm font-medium">⚠️ This venue is the home venue for: {deleteInfo.teamNames.join(", ")}. Their home venue will be cleared.</p>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleting} className="bg-destructive text-destructive-foreground">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VenuesManagement;

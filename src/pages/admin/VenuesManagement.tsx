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
  associationIds: string[];
}

const EMPTY_FORM = {
  name: "", address: "", suburb: "", state: "", postcode: "",
  phone: "", email: "", selectedAssociationIds: [] as string[],
  associationPitchRestrictions: {} as Record<string, string[]>,
  available_times: "", notes: "",
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
  const [venueAssociations, setVenueAssociations] = useState<{ id: string; venue_id: string; association_id: string; allowed_pitch_ids?: string[] | null }[]>([]);
  const [venuePitches, setVenuePitches] = useState<{ id: string; venue_id: string; name: string }[]>([]);
  const [pitchesLoadingForDialog, setPitchesLoadingForDialog] = useState(false);
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
    const [venuesRes, pitchesRes, assocRes, vaRes] = await Promise.all([
      supabase.from("venues").select("*").order("name"),
      supabase.from("pitches").select("venue_id"),
      supabase.from("associations").select("*").order("name"),
      supabase.from("venue_associations").select("id, venue_id, association_id, allowed_pitch_ids"),
    ]);

    const allAssoc = assocRes.data || [];
    setAssociations(allAssoc);

    const vaData = vaRes.data || [];
    setVenueAssociations(vaData);

    const pitchCounts: Record<string, number> = {};
    (pitchesRes.data || []).forEach((p) => {
      pitchCounts[p.venue_id] = (pitchCounts[p.venue_id] || 0) + 1;
    });

    let venuesList = venuesRes.data || [];
    // Scope for ASSOCIATION_ADMIN
    if (!isSuperAdmin && scopedAssociationIds.length > 0) {
      venuesList = venuesList.filter(
        (v) => (vaData || []).some((va: any) => va.venue_id === v.id && scopedAssociationIds.includes(va.association_id))
      );
    }

    setVenues(
      venuesList.map((v) => ({
        ...v,
        pitchCount: pitchCounts[v.id] || 0,
        associationIds: (vaData || []).filter((va: any) => va.venue_id === v.id).map((va: any) => va.association_id),
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
  const handleOpenDialog = async (venue?: Venue) => {
    if (venue) {
      setEditingVenue(venue);
      const mappedAssocIds = venueAssociations
        .filter((va) => va.venue_id === venue.id)
        .map((va) => va.association_id);

      const restrictions: Record<string, string[]> = {};
      mappedAssocIds.forEach((assocId) => {
        const row = venueAssociations.find(
          (va) => va.venue_id === venue.id && va.association_id === assocId
        );
        restrictions[assocId] = (row?.allowed_pitch_ids && row.allowed_pitch_ids.length > 0)
          ? row.allowed_pitch_ids
          : [];
      });

      setFormData({
        name: venue.name,
        address: venue.address || "",
        suburb: venue.suburb || "",
        state: venue.state || "",
        postcode: venue.postcode || "",
        phone: venue.phone || "",
        email: venue.email || "",
        selectedAssociationIds: mappedAssocIds,
        associationPitchRestrictions: restrictions,
        available_times: venue.available_times || "",
        notes: venue.notes || "",
      });

      setPitchesLoadingForDialog(true);
      const { data } = await supabase
        .from("pitches")
        .select("id, venue_id, name")
        .eq("venue_id", venue.id);
      setVenuePitches(data || []);
      setPitchesLoadingForDialog(false);
    } else {
      setEditingVenue(null);
      setFormData({
        ...EMPTY_FORM,
        selectedAssociationIds: [],
        associationPitchRestrictions: {},
      });
      setVenuePitches([]);
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
      available_times: formData.available_times.trim() || null,
      notes: formData.notes.trim() || null,
    };

    let venueId = "";
    let saveSuccess = false;

    if (editingVenue) {
      const { error } = await supabase.from("venues").update(payload).eq("id", editingVenue.id);
      if (error) {
        toast({ title: "Error", description: "Failed to update venue", variant: "destructive" });
      } else {
        venueId = editingVenue.id;
        saveSuccess = true;
      }
    } else {
      const { data, error } = await supabase.from("venues").insert(payload).select("id").single();
      if (error) {
        toast({ title: "Error", description: "Failed to create venue", variant: "destructive" });
      } else if (data) {
        venueId = data.id;
        saveSuccess = true;
      }
    }

    if (saveSuccess) {
      try {
        const { error: deleteError } = await supabase
          .from("venue_associations")
          .delete()
          .eq("venue_id", venueId);

        if (deleteError) {
          toast({ title: "Error", description: "Failed to clear old association links", variant: "destructive" });
        }

        if (formData.selectedAssociationIds.length > 0) {
          const rowsToInsert = formData.selectedAssociationIds.map(assocId => {
            const restrictions = formData.associationPitchRestrictions[assocId] || [];
            return {
              venue_id: venueId,
              association_id: assocId,
              allowed_pitch_ids: restrictions.length > 0 ? restrictions : null
            };
          });
          const { error: insertError } = await supabase
            .from("venue_associations")
            .insert(rowsToInsert);

          if (insertError) {
            toast({ title: "Error", description: "Failed to link new associations", variant: "destructive" });
          }
        }
      } catch (err) {
        console.error("Junction save error:", err);
      }

      toast({ title: "Success", description: editingVenue ? "Venue updated" : "Venue created" });
      setDialogOpen(false);
      fetchVenues();
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
      ) : (venues.filter(v => filterAssociation === "all" || v.associationIds.includes(filterAssociation))).length === 0 ? (
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
              {(venues.filter(v => filterAssociation === "all" || v.associationIds.includes(filterAssociation))).map((venue) => (
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
                      <TableCell>
                        {venue.associationIds && venue.associationIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {venue.associationIds.map(assocId => {
                              const name = associations.find(a => a.id === assocId)?.name || "Unknown";
                              return <Badge key={assocId} variant="secondary">{name}</Badge>;
                            })}
                          </div>
                        ) : "-"}
                      </TableCell>
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
              <Label>Associations</Label>
              <div className="space-y-3 border rounded-md p-3 max-h-[300px] overflow-y-auto">
                {formAssociations.map((assoc) => {
                  const isChecked = formData.selectedAssociationIds.includes(assoc.id);
                  return (
                    <div key={assoc.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`assoc-${assoc.id}`}
                          checked={isChecked}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const updatedIds = checked
                              ? [...formData.selectedAssociationIds, assoc.id]
                              : formData.selectedAssociationIds.filter((id) => id !== assoc.id);
                            
                            const updatedRestrictions = { ...formData.associationPitchRestrictions };
                            if (!checked) {
                              updatedRestrictions[assoc.id] = [];
                            }
                            
                            setFormData({
                              ...formData,
                              selectedAssociationIds: updatedIds,
                              associationPitchRestrictions: updatedRestrictions
                            });
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor={`assoc-${assoc.id}`} className="font-normal cursor-pointer">
                          {assoc.name}
                        </Label>
                      </div>

                      {isChecked && venuePitches.length > 0 && (
                        <div className="pl-6 space-y-1.5">
                          <div className="text-[12px] text-muted-foreground">
                            Allowed pitches (leave all unticked for no restriction)
                          </div>
                          {pitchesLoadingForDialog ? (
                            <Skeleton className="h-5 w-24" />
                          ) : (
                            <div className="space-y-1">
                              {venuePitches.map((pitch) => {
                                const isPitchChecked = formData.associationPitchRestrictions[assoc.id]?.includes(pitch.id) || false;
                                return (
                                  <div key={pitch.id} className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      id={`pitch-${assoc.id}-${pitch.id}`}
                                      checked={isPitchChecked}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        const currentPitches = formData.associationPitchRestrictions[assoc.id] || [];
                                        const updatedPitches = checked
                                          ? [...currentPitches, pitch.id]
                                          : currentPitches.filter((id) => id !== pitch.id);
                                        setFormData({
                                          ...formData,
                                          associationPitchRestrictions: {
                                            ...formData.associationPitchRestrictions,
                                            [assoc.id]: updatedPitches,
                                          }
                                        });
                                      }}
                                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <Label htmlFor={`pitch-${assoc.id}-${pitch.id}`} className="text-xs font-normal cursor-pointer">
                                      {pitch.name}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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

import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
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
import { Plus, Pencil, Trash2, Shield, ArrowLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";
import type { Database } from "@/integrations/supabase/types";

type Club = Database["public"]["Tables"]["clubs"]["Row"];
type Association = Database["public"]["Tables"]["associations"]["Row"];

type ValidationState = {
  status: "success" | "error";
  message: string;
};

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

const getCroppedImg = async (imageSrc: string, pixelCrop: Area) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to get canvas context");
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
};

const generateAbbreviation = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .join("")
    .slice(0, 10);

const slugifyName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const sanitizeFileName = (filename: string) => filename.replace(/[^a-zA-Z0-9._-]/g, "_");

const ClubsManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin, isAnyAdmin, scopedClubIds, scopedAssociationIds, canManageClub } = useAdminScope();

  const hasAccess = isSuperAdmin || scopedAssociationIds.length > 0 || scopedClubIds.length > 0;

  const [clubs, setClubs] = useState<Club[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAssociation, setFilterAssociation] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingClub, setDeletingClub] = useState<Club | null>(null);
  const [formData, setFormData] = useState({ name: "", abbreviation: "", website_url: "", logo_url: "", association_id: "" });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [logoValidation, setLogoValidation] = useState<{ status: "success" | "error"; message: string } | null>(null);
  const [formErrors, setFormErrors] = useState<{ abbreviation?: string; logo?: string }>({});
  const [abbreviationTouched, setAbbreviationTouched] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedLogoSrc, setSelectedLogoSrc] = useState("");
  const [croppingFile, setCroppingFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
      if (selectedLogoSrc.startsWith("blob:")) {
        URL.revokeObjectURL(selectedLogoSrc);
      }
    };
  }, [logoPreviewUrl, selectedLogoSrc]);

  useEffect(() => {
    if (!scopeLoading && !hasAccess) {
      navigate("/admin");
    }
  }, [scopeLoading, hasAccess, navigate]);

  const fetchData = async () => {
    setLoading(true);

    let clubsQuery = supabase.from("clubs").select("*").order("name");
    if (!isSuperAdmin && scopedClubIds.length > 0) {
      clubsQuery = clubsQuery.in("id", scopedClubIds);
    }

    const [clubsRes, associationsRes] = await Promise.all([
      clubsQuery,
      supabase.from("associations").select("*").order("name"),
    ]);

    if (clubsRes.error) {
      toast({ title: "Error", description: "Failed to load clubs", variant: "destructive" });
    } else {
      setClubs(clubsRes.data || []);
    }
    if (!associationsRes.error) setAssociations(associationsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!scopeLoading && hasAccess) fetchData();
  }, [scopeLoading, hasAccess]);

  const filteredClubs = filterAssociation === "all"
    ? clubs
    : clubs.filter((c) => c.association_id === filterAssociation);

  // Can add clubs if SUPER_ADMIN or ASSOCIATION_ADMIN
  const canAdd = isSuperAdmin || scopedAssociationIds.length > 0;
  const canDelete = isSuperAdmin || scopedAssociationIds.length > 0;

  // Available associations for form dropdown (scoped)
  const formAssociations = isSuperAdmin
    ? associations
    : associations.filter((a) => scopedAssociationIds.includes(a.id));

  const handleOpenDialog = (club?: Club) => {
    if (club) {
      setEditingClub(club);
      setFormData({
        name: club.name,
        abbreviation: club.abbreviation || "",
        website_url: club.website_url || "",
        logo_url: club.logo_url || "",
        association_id: club.association_id,
      });
      setLogoPreviewUrl(club.logo_url || "");
    } else {
      setEditingClub(null);
      setFormData({ name: "", abbreviation: "", website_url: "", logo_url: "", association_id: formAssociations.length === 1 ? formAssociations[0].id : "" });
      setLogoPreviewUrl("");
    }
    setLogoFile(null);
    setFormErrors({});
    setAbbreviationTouched(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.association_id) {
      toast({ title: "Error", description: "Name and Association are required", variant: "destructive" });
      return;
    }

    const abbreviation = formData.abbreviation.trim();
    setFormErrors({});

    if (abbreviation) {
      let query = supabase.from("clubs").select("id").eq("abbreviation", abbreviation);
      if (editingClub) {
        query = query.neq("id", editingClub.id);
      }
      const { data: existingAbbreviations, error: abbreviationError } = await query;
      if (abbreviationError) {
        toast({ title: "Error", description: "Failed to validate abbreviation", variant: "destructive" });
        return;
      }
      if (existingAbbreviations && existingAbbreviations.length > 0) {
        setFormErrors({ abbreviation: "This abbreviation is already in use." });
        return;
      }
    }

    let logoUrl = formData.logo_url.trim();
    if (logoFile) {
      const allowedTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
      if (!allowedTypes.includes(logoFile.type)) {
        setFormErrors((prev) => ({ ...prev, logo: "Accepted file types: PNG, JPG, SVG, WebP only." }));
        toast({ title: "Error", description: "Invalid file type. Please upload a PNG, JPG, SVG, or WebP image.", variant: "destructive" });
        return;
      }
      if (logoFile.size > 2 * 1024 * 1024) {
        setFormErrors((prev) => ({ ...prev, logo: "File must be under 2MB." }));
        toast({ title: "Error", description: "File is too large. Maximum size is 2MB.", variant: "destructive" });
        return;
      }

      const slug = slugifyName(formData.name);
      const filename = `${Date.now()}-${sanitizeFileName(logoFile.name)}`;
      const path = `clubs/${slug}/${filename}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("logos")
        .upload(path, logoFile, {
          contentType: logoFile.type,
          upsert: true,
        });

      if (uploadError || !uploadData) {
        toast({ title: "Error", description: uploadError?.message || "Failed to upload logo", variant: "destructive" });
        return;
      }

      const { data: publicUrlData, error: publicUrlError } = supabase.storage.from("logos").getPublicUrl(path);
      if (publicUrlError || !publicUrlData?.publicUrl) {
        toast({ title: "Error", description: "Failed to retrieve logo URL", variant: "destructive" });
        return;
      }
      logoUrl = publicUrlData.publicUrl;
    }

    setSaving(true);
    const payload = {
      name: formData.name.trim(),
      abbreviation: abbreviation || null,
      website_url: formData.website_url.trim() || null,
      logo_url: logoUrl.trim() || null,
      association_id: formData.association_id,
    };

    if (editingClub) {
      const { error } = await supabase.from("clubs").update(payload).eq("id", editingClub.id);
      if (error) { toast({ title: "Error", description: "Failed to update club", variant: "destructive" }); }
      else { toast({ title: "Success", description: "Club updated" }); setDialogOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from("clubs").insert(payload);
      if (error) { toast({ title: "Error", description: "Failed to create club", variant: "destructive" }); }
      else { toast({ title: "Success", description: "Club created" }); setDialogOpen(false); fetchData(); }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingClub) return;
    const { error } = await supabase.from("clubs").delete().eq("id", deletingClub.id);
    if (error) { toast({ title: "Error", description: "Failed to delete club. It may have teams.", variant: "destructive" }); }
    else { toast({ title: "Success", description: "Club deleted" }); fetchData(); }
    setDeleteDialogOpen(false);
    setDeletingClub(null);
  };

  if (scopeLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Clubs</h1>
          <p className="text-muted-foreground">Manage clubs within associations</p>
        </div>
        {canAdd && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Add Club</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingClub ? "Edit Club" : "Add Club"}</DialogTitle>
                <DialogDescription>{editingClub ? "Update details" : "Create a new club"}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Association *</Label>
                  <Select value={formData.association_id} onValueChange={(v) => setFormData({ ...formData, association_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select association" /></SelectTrigger>
                    <SelectContent>
                      {formAssociations.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        name,
                        abbreviation: abbreviationTouched ? prev.abbreviation : generateAbbreviation(name),
                      }));
                    }}
                    placeholder="e.g., Melbourne HC"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website URL</Label>
                  <Input
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Abbreviation</Label>
                  <Input
                    maxLength={10}
                    value={formData.abbreviation}
                    onChange={(e) => {
                      setAbbreviationTouched(true);
                      setFormData({ ...formData, abbreviation: e.target.value.slice(0, 10) });
                    }}
                    placeholder="e.g., MHC"
                  />
                  {formErrors.abbreviation && <p className="text-sm text-destructive">{formErrors.abbreviation}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo">Logo</Label>
                  <input
                    id="logo"
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg,.webp"
                    className="block w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground file:border-0 file:bg-transparent file:text-primary"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (!file) {
                        setLogoValidation(null);
                        return;
                      }

                      const allowedTypes = [
                        "image/png",
                        "image/jpeg",
                        "image/jpg",
                        "image/svg+xml",
                        "image/webp",
                      ];

                      if (!allowedTypes.includes(file.type)) {
                        setFormErrors((prev) => ({ ...prev, logo: "Accepted file types: PNG, JPG, SVG, WebP only." }));
                        setLogoValidation({ status: "error", message: "Only PNG, JPG, SVG and WebP files are accepted" });
                        setLogoFile(null);
                        setLogoPreviewUrl("");
                        return;
                      }

                      if (file.size > 2 * 1024 * 1024) {
                        setFormErrors((prev) => ({ ...prev, logo: "File must be under 2MB." }));
                        setLogoValidation({ status: "error", message: "File is too large — maximum size is 2MB" });
                        setLogoFile(null);
                        setLogoPreviewUrl("");
                        return;
                      }

                      setFormErrors((prev) => ({ ...prev, logo: undefined }));
                      setLogoValidation({ status: "success", message: "File looks good" });
                      setLogoFile(file);
                      setFormData({ ...formData, logo_url: "" });
                      setLogoPreviewUrl(URL.createObjectURL(file));
                    }}
                  />
                  <p className="text-sm text-muted-foreground">Accepted formats: PNG, JPG, SVG, WebP · Max size: 2MB · Square image recommended</p>
                  {logoValidation && (
                    <p className={`text-sm ${logoValidation.status === "success" ? "text-emerald-600" : "text-destructive"}`}>
                      {logoValidation.status === "success" ? "✅ File looks good" : `❌ ${logoValidation.message}`}
                    </p>
                  )}
                  {formErrors.logo && <p className="text-sm text-destructive">{formErrors.logo}</p>}
                </div>
                {(logoPreviewUrl || formData.logo_url) && (
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 overflow-hidden rounded border border-muted bg-muted">
                      <img
                        src={logoPreviewUrl || formData.logo_url}
                        alt="Logo preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreviewUrl("");
                        setFormData({ ...formData, logo_url: "" });
                        setFormErrors((prev) => ({ ...prev, logo: undefined }));
                        setLogoValidation(null);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editingClub ? "Update" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        <Dialog open={cropDialogOpen} onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open && selectedLogoSrc.startsWith("blob:")) {
            URL.revokeObjectURL(selectedLogoSrc);
            setSelectedLogoSrc("");
            setCroppingFile(null);
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crop logo</DialogTitle>
              <DialogDescription>Drag and resize the square crop box, then upload the cropped logo.</DialogDescription>
            </DialogHeader>
            <div className="relative h-96 w-full overflow-hidden rounded bg-black">
              {selectedLogoSrc && (
                <Cropper
                  image={selectedLogoSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                />
              )}
            </div>
            <div className="mt-4 flex items-center gap-4">
              <Label>Zoom</Label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCropDialogOpen(false)}>Cancel</Button>
              <Button onClick={async () => {
                if (!selectedLogoSrc || !croppedAreaPixels || !croppingFile) return;
                setUploadingLogo(true);
                try {
                  const croppedBlob = await getCroppedImg(selectedLogoSrc, croppedAreaPixels);
                  if (!croppedBlob) {
                    toast({ title: "Error", description: "Failed to create cropped image.", variant: "destructive" });
                    return;
                  }
                  const slug = slugifyName(formData.name);
                  const filename = `${Date.now()}-${sanitizeFileName(croppingFile.name)}`;
                  const path = `clubs/${slug}/${filename}`;
                  const { data: uploadData, error: uploadError } = await supabase.storage
                    .from("logos")
                    .upload(path, croppedBlob, {
                      contentType: "image/png",
                      upsert: true,
                    });
                  if (uploadError || !uploadData) {
                    toast({ title: "Error", description: uploadError?.message || "Failed to upload logo", variant: "destructive" });
                    return;
                  }
                  const { data: publicUrlData, error: publicUrlError } = supabase.storage.from("logos").getPublicUrl(path);
                  if (publicUrlError || !publicUrlData?.publicUrl) {
                    toast({ title: "Error", description: "Failed to retrieve logo URL", variant: "destructive" });
                    return;
                  }
                  setFormData((prev) => ({ ...prev, logo_url: publicUrlData.publicUrl }));
                  setLogoPreviewUrl(publicUrlData.publicUrl);
                  setCroppingFile(null);
                  setLogoValidation({ status: "success", message: "File uploaded successfully" });
                  setCropDialogOpen(false);
                } finally {
                  setUploadingLogo(false);
                }
              }} disabled={uploadingLogo}>
                {uploadingLogo ? "Uploading..." : "Crop & Upload"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Clubs</CardTitle>
          <CardDescription>{filteredClubs.length} club(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredClubs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No clubs found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Association</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Abbreviation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClubs.map((club) => {
                  const assocName = associations.find((a) => a.id === club.association_id)?.name || "-";
                  return (
                    <TableRow key={club.id}>
                      <TableCell className="font-medium">
                        <Link to={`/clubs/${club.id}`} className="hover:underline text-primary">
                          {club.name}
                        </Link>
                      </TableCell>
                      <TableCell>{assocName}</TableCell>
                      <TableCell>
                        {club.website_url ? (
                          <a href={club.website_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            {club.website_url}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{club.abbreviation || "-"}</TableCell>
                      <TableCell className="text-right">
                        {canManageClub(club.id) && (
                          <Button variant="ghost" size="icon" onClick={() => { handleOpenDialog(club); setDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingClub(club); setDeleteDialogOpen(true); }}>
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
            <AlertDialogTitle>Delete Club?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete "{deletingClub?.name}". All teams must be deleted first.</AlertDialogDescription>
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

export default ClubsManagement;

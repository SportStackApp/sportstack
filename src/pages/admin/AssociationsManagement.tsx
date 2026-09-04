import { useEffect, useState, useMemo } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Building2, ArrowLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";
import type { Database } from "@/integrations/supabase/types";
import { SortableTableHead } from "@/components/admin/SortableTableHead";
import { nextSortState, stableSortRows, type SortState } from "@/lib/adminSorting";

type Association = Database["public"]["Tables"]["associations"]["Row"] & {
  banner_url?: string | null;
  primary_colour?: string | null;
  secondary_colour?: string | null;
};

type ValidationState = {
  status: "success" | "error";
  message: string;
};

type AssociationSortKey = "name" | "abbreviation" | "website" | "duration";

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

const AssociationsManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin, isAnyAdmin, scopedAssociationIds, canManageAssociation } = useAdminScope();
  
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sort, setSort] = useState<SortState<AssociationSortKey>>({ key: "name", direction: "asc" });

  const paginatedAssociations = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    const sorted = stableSortRows(associations, sort, (association, key) => {
      if (key === "abbreviation") return association.abbreviation;
      if (key === "website") return association.website_url;
      if (key === "duration") return association.default_match_duration_minutes;
      return association.name;
    });
    return sorted.slice(startIdx, startIdx + rowsPerPage);
  }, [associations, currentPage, rowsPerPage, sort]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssociation, setEditingAssociation] = useState<Association | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAssociation, setDeletingAssociation] = useState<Association | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    abbreviation: "",
    website_url: "",
    logo_url: "",
    banner_url: "",
    primary_colour: "",
    secondary_colour: "",
    default_match_duration_minutes: "90",
  });
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

  // Only SUPER_ADMIN and ASSOCIATION_ADMIN should see this page
  const hasAccess = isSuperAdmin || scopedAssociationIds.length > 0;

  useEffect(() => {
    if (!scopeLoading && !hasAccess) {
      navigate("/admin");
    }
  }, [scopeLoading, hasAccess, navigate]);

  const fetchAssociations = async () => {
    setLoading(true);
    let query = supabase.from("associations").select("*").order("name");

    if (!isSuperAdmin) {
      query = query.in("id", scopedAssociationIds);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: "Failed to load associations", variant: "destructive" });
    } else {
      setAssociations(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!scopeLoading && hasAccess) {
      fetchAssociations();
    }
  }, [scopeLoading, hasAccess]);

  const handleOpenDialog = (association?: Association) => {
    if (association) {
      setEditingAssociation(association);
      setFormData({
        name: association.name,
        abbreviation: association.abbreviation || "",
        website_url: association.website_url || "",
        logo_url: association.logo_url || "",
        banner_url: association.banner_url || "",
        primary_colour: association.primary_colour || "",
        secondary_colour: association.secondary_colour || "",
        default_match_duration_minutes: association.default_match_duration_minutes.toString(),
      });
      setLogoPreviewUrl(association.logo_url || "");
    } else {
      setEditingAssociation(null);
      setFormData({
        name: "",
        abbreviation: "",
        website_url: "",
        logo_url: "",
        banner_url: "",
        primary_colour: "",
        secondary_colour: "",
        default_match_duration_minutes: "90",
      });
      setLogoPreviewUrl("");
    }
    setLogoFile(null);
    setFormErrors({});
    setAbbreviationTouched(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }

    const durationMinutes = Number(formData.default_match_duration_minutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 240) {
      toast({
        title: "Check match duration",
        description: "Enter a whole number from 30 to 240 minutes.",
        variant: "destructive",
      });
      return;
    }

    const abbreviation = formData.abbreviation.trim();
    setFormErrors({});

    const hexColour = /^#[0-9a-fA-F]{6}$/;
    if (
      (formData.primary_colour && !hexColour.test(formData.primary_colour))
      || (formData.secondary_colour && !hexColour.test(formData.secondary_colour))
    ) {
      toast({
        title: "Check the theme colours",
        description: "Use a six-digit colour such as #2563EB.",
        variant: "destructive",
      });
      return;
    }

    if (abbreviation) {
      let query = supabase.from("associations").select("id").eq("abbreviation", abbreviation);
      if (editingAssociation) {
        query = query.neq("id", editingAssociation.id);
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
      const path = `associations/${slug}/${filename}`;
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

      const { data: publicUrlData } = supabase.storage.from("logos").getPublicUrl(path);
      if (!publicUrlData?.publicUrl) {
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
      banner_url: formData.banner_url.trim() || null,
      primary_colour: formData.primary_colour.trim() || null,
      secondary_colour: formData.secondary_colour.trim() || null,
      default_match_duration_minutes: durationMinutes,
    };

    if (editingAssociation) {
      const { error } = await supabase
        .from("associations")
        .update(payload)
        .eq("id", editingAssociation.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update association", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Association updated" });
        setDialogOpen(false);
        fetchAssociations();
      }
    } else {
      const { error } = await supabase.from("associations").insert(payload);
      if (error) {
        toast({ title: "Error", description: "Failed to create association", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Association created" });
        setDialogOpen(false);
        fetchAssociations();
      }
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingAssociation) return;

    const { error } = await supabase
      .from("associations")
      .delete()
      .eq("id", deletingAssociation.id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete association. It may have clubs.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Association deleted" });
      fetchAssociations();
    }

    setDeleteDialogOpen(false);
    setDeletingAssociation(null);
  };

  if (scopeLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const canAdd = isSuperAdmin;
  const canEdit = (id: string) => canManageAssociation(id);
  const canDelete = isSuperAdmin;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Associations</h1>
          <p className="text-muted-foreground">Manage sports associations</p>
        </div>
        {canAdd && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Association
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAssociation ? "Edit Association" : "Add Association"}</DialogTitle>
                <DialogDescription>
                  {editingAssociation ? "Update the association details" : "Create a new association"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        name,
                        abbreviation: abbreviationTouched ? prev.abbreviation : generateAbbreviation(name),
                      }));
                    }}
                    placeholder="e.g., Hockey Victoria"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website_url">Website URL</Label>
                  <Input
                    id="website_url"
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abbreviation">Abbreviation</Label>
                  <Input
                    id="abbreviation"
                    maxLength={10}
                    value={formData.abbreviation}
                    onChange={(e) => {
                      setAbbreviationTouched(true);
                      setFormData({ ...formData, abbreviation: e.target.value.slice(0, 10) });
                    }}
                    placeholder="e.g., HV"
                  />
                  {formErrors.abbreviation && (
                    <p className="text-sm text-destructive">{formErrors.abbreviation}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="association-match-duration">Default match duration (minutes) *</Label>
                  <Input
                    id="association-match-duration"
                    type="number"
                    min={30}
                    max={240}
                    step={1}
                    value={formData.default_match_duration_minutes}
                    onChange={(e) => setFormData({ ...formData, default_match_duration_minutes: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Used when a fixture and its division do not set a more specific finish.</p>
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
                        "image/svg+xml",
                        "image/webp",
                      ];

                      if (!allowedTypes.includes(file.type)) {
                        setFormErrors((prev) => ({ ...prev, logo: "Accepted file types: PNG, JPG, SVG, WebP only." }));
                        setLogoValidation({ status: "error", message: "Invalid file type. Please upload a PNG, JPG, SVG, or WebP image." });
                        setCroppingFile(null);
                        setSelectedLogoSrc("");
                        return;
                      }

                      if (file.size > 2 * 1024 * 1024) {
                        setFormErrors((prev) => ({ ...prev, logo: "File must be under 2MB." }));
                        setLogoValidation({ status: "error", message: "File is too large. Maximum allowed size is 2MB." });
                        setCroppingFile(null);
                        setSelectedLogoSrc("");
                        return;
                      }

                      const objectUrl = URL.createObjectURL(file);
                      const image = new Image();
                      image.onload = () => {
                        if (image.width < 100 || image.height < 100) {
                          setFormErrors((prev) => ({ ...prev, logo: "Image is too small. Minimum size is 100×100 pixels." }));
                          setLogoValidation({ status: "error", message: "Image is too small. Minimum size is 100×100 pixels." });
                          setCroppingFile(null);
                          setSelectedLogoSrc("");
                          URL.revokeObjectURL(objectUrl);
                          return;
                        }

                        setFormErrors((prev) => ({ ...prev, logo: undefined }));
                        setLogoValidation({ status: "success", message: "File looks good" });
                        setCroppingFile(file);
                        setSelectedLogoSrc(objectUrl);
                        setCropDialogOpen(true);
                      };
                      image.onerror = () => {
                        setFormErrors((prev) => ({ ...prev, logo: "Unable to load image file." }));
                        setLogoValidation({ status: "error", message: "Unable to load the selected image." });
                        setCroppingFile(null);
                        setSelectedLogoSrc("");
                        URL.revokeObjectURL(objectUrl);
                      };
                      image.src = objectUrl;
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
                <div className="space-y-2">
                  <Label htmlFor="banner_url">Default dashboard banner URL</Label>
                  <Input
                    id="banner_url"
                    value={formData.banner_url}
                    onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                    placeholder="https://example.com/banner.jpg"
                  />
                  <p className="text-xs text-muted-foreground">Clubs and teams inherit this banner unless they set an override.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="primary_colour">Default primary colour</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.primary_colour || "#2563EB"}
                        onChange={(e) => setFormData({ ...formData, primary_colour: e.target.value })}
                        className="w-14 p-1"
                        aria-label="Choose primary colour"
                      />
                      <Input
                        id="primary_colour"
                        value={formData.primary_colour}
                        onChange={(e) => setFormData({ ...formData, primary_colour: e.target.value })}
                        placeholder="#2563EB"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondary_colour">Default secondary colour</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.secondary_colour || "#FFFFFF"}
                        onChange={(e) => setFormData({ ...formData, secondary_colour: e.target.value })}
                        className="w-14 p-1"
                        aria-label="Choose secondary colour"
                      />
                      <Input
                        id="secondary_colour"
                        value={formData.secondary_colour}
                        onChange={(e) => setFormData({ ...formData, secondary_colour: e.target.value })}
                        placeholder="#FFFFFF"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : editingAssociation ? "Update" : "Create"}
                </Button>
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
                  const path = `associations/${slug}/${filename}`;
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
                  const { data: publicUrlData } = supabase.storage.from("logos").getPublicUrl(path);
                  if (!publicUrlData?.publicUrl) {
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

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              All Associations
            </CardTitle>
            <CardDescription>{associations.length} association(s)</CardDescription>
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
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : associations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No associations yet. Create your first one!
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Name" sortKey="name" sort={sort} onSort={(key) => setSort(nextSortState(sort, key))} />
                  <SortableTableHead label="Abbreviation" sortKey="abbreviation" sort={sort} onSort={(key) => setSort(nextSortState(sort, key))} />
                  <SortableTableHead label="Website" sortKey="website" sort={sort} onSort={(key) => setSort(nextSortState(sort, key))} />
                  <TableHead>Logo</TableHead>
                  <SortableTableHead label="Default Duration" sortKey="duration" sort={sort} onSort={(key) => setSort(nextSortState(sort, key))} />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAssociations.map((association) => {
                  return (
                    <TableRow key={association.id}>
                      <TableCell className="font-medium">
                        <Link to={`/associations/${association.id}`} className="hover:underline text-primary">
                          {association.name}
                        </Link>
                      </TableCell>
                      <TableCell>{association.abbreviation || "-"}</TableCell>
                      <TableCell>
                        {association.website_url ? (
                          <a href={association.website_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            {association.website_url}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {association.logo_url ? (
                          <img src={association.logo_url} alt="" className="h-8 w-8 rounded object-cover" />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{association.default_match_duration_minutes} min</TableCell>
                      <TableCell className="text-right">
                        {canEdit(association.id) && (
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(association)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingAssociation(association);
                              setDeleteDialogOpen(true);
                            }}
                          >
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
              const totalPages = Math.ceil(associations.length / rowsPerPage);
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

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Association?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingAssociation?.name}". 
              All clubs and teams under this association must be deleted first.
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

export default AssociationsManagement;

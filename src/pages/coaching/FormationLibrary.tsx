/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTeamContext } from "@/contexts/TeamContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HockeyPitch } from "@/components/lineup/HockeyPitch";
import {
  DEFAULT_POSITION_ICON_SIZE,
  type FieldTemplateRow,
  type FormationIconRow,
  type FormationOwnerScope,
  type FormationPositionRow,
  type FormationRow,
  formatOwnerScope,
  getFormationFieldSource,
} from "@/lib/formationPlanner";
import { cn } from "@/lib/utils";
import { LibraryBig, Plus, Search, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";

const supabase = typedSupabase as any;

type FormationPreference = {
  formation_id: string;
  is_favourite: boolean;
  is_hidden: boolean;
};

type LibraryPosition = Pick<FormationPositionRow, "formation_id" | "code" | "x_percent" | "y_percent" | "icon_id"> & {
  id: string;
};

type FormationAssetImage = {
  id: string;
  name: string;
  url: string;
  usedBy: number;
  createdBy?: string | null;
};

const OWNER_FILTERS = ["__all__", "SUPER_ADMIN", "ASSOCIATION", "CLUB", "TEAM"] as const;
const STATUS_FILTERS = ["active", "hidden"] as const;
const ASSET_TYPE_FILTERS = ["all", "surface", "icons", "symbols"] as const;
const ASSET_OWNER_FILTERS = ["all", "mine", "shared", "hidden"] as const;

type PendingDelete =
  | { type: "formation"; id: string; name: string }
  | { type: "template"; id: string; name: string }
  | { type: "asset"; id: string; name: string }
  | null;

function ownerText(scope: FormationOwnerScope) {
  return scope === "SUPER_ADMIN" ? "Global" : formatOwnerScope(scope);
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function MiniPitch({
  backgroundUrl,
  positions,
  icons,
  className,
}: {
  backgroundUrl?: string | null;
  positions?: LibraryPosition[];
  icons?: FormationIconRow[];
  className?: string;
}) {
  return (
    <HockeyPitch backgroundUrl={backgroundUrl} className={cn("rounded-md border", className)}>
      {(positions || []).slice(0, 12).map((position) => {
        const icon = icons?.find((item) => item.id === position.icon_id);
        return (
          <span
            key={position.id}
            className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white bg-primary text-[8px] font-bold text-primary-foreground shadow"
            style={{ left: `${position.x_percent}%`, top: `${position.y_percent}%` }}
            title={position.code}
          >
            {icon?.image_url ? <img src={icon.image_url} alt="" className="h-full w-full rounded-full object-cover" /> : position.code}
          </span>
        );
      })}
    </HockeyPitch>
  );
}

export default function FormationLibrary() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const { selectedAssociation, selectedClub, selectedTeam } = useTeamContext();
  const [loading, setLoading] = useState(true);
  const [formations, setFormations] = useState<FormationRow[]>([]);
  const [fieldTemplates, setFieldTemplates] = useState<FieldTemplateRow[]>([]);
  const [icons, setIcons] = useState<FormationIconRow[]>([]);
  const [positions, setPositions] = useState<LibraryPosition[]>([]);
  const [preferences, setPreferences] = useState<Record<string, FormationPreference>>({});
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<(typeof OWNER_FILTERS)[number]>("__all__");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("active");
  const [assetTypeFilter, setAssetTypeFilter] = useState<(typeof ASSET_TYPE_FILTERS)[number]>("all");
  const [assetOwnerFilter, setAssetOwnerFilter] = useState<(typeof ASSET_OWNER_FILTERS)[number]>("all");
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [assetDraftType, setAssetDraftType] = useState<"surface" | "icon" | "symbol">("surface");
  const [assetDraftName, setAssetDraftName] = useState("");
  const [assetDraftPreview, setAssetDraftPreview] = useState<string | null>(null);
  const [assetFocusX, setAssetFocusX] = useState(50);
  const [assetFocusY, setAssetFocusY] = useState(50);
  const [assetZoom, setAssetZoom] = useState(100);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const loadLibrary = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [formationsRes, iconsRes, prefsRes, positionsRes, templatesRes] = await Promise.all([
      supabase.from("formations").select("*").order("is_default", { ascending: false }).order("name"),
      supabase.from("formation_icons").select("*").order("is_custom").order("name"),
      supabase.from("user_formation_preferences").select("formation_id, is_favourite, is_hidden").eq("user_id", userId),
      supabase.from("formation_positions").select("id, formation_id, code, x_percent, y_percent, icon_id").order("sort_order"),
      supabase.from("field_templates").select("*").eq("is_active", true).order("name"),
    ]);

    if (formationsRes.error) toast.error(formationsRes.error.message);
    if (iconsRes.error) toast.error(iconsRes.error.message);
    if (prefsRes.error) toast.error(prefsRes.error.message);
    if (positionsRes.error) toast.warning("Position previews are unavailable.");

    const templates = templatesRes.error ? [] : ((templatesRes.data || []) as FieldTemplateRow[]);
    const templateMap = new Map(templates.map((template) => [template.id, template]));
    const formationRows = ((formationsRes.data || []) as FormationRow[]).map((formation) => ({
      ...formation,
      field_templates: formation.field_template_id ? templateMap.get(formation.field_template_id) || null : null,
    }));

    setFormations(formationRows);
    setFieldTemplates(templates);
    setIcons((iconsRes.data || []) as FormationIconRow[]);
    setPositions((positionsRes.data || []) as LibraryPosition[]);
    setPreferences(
      ((prefsRes.data || []) as FormationPreference[]).reduce((acc, pref) => {
        acc[pref.formation_id] = pref;
        return acc;
      }, {} as Record<string, FormationPreference>),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const ownerLabel = (scope: FormationOwnerScope) => {
    if (scope === "ASSOCIATION") return selectedAssociation?.name || "Association";
    if (scope === "CLUB") return selectedClub?.name || "Club";
    if (scope === "TEAM") return selectedTeam?.name || "Team";
    return "Global";
  };

  const searchText = search.trim().toLowerCase();
  const positionsByFormation = useMemo(() => {
    return positions.reduce((acc, position) => {
      acc[position.formation_id] = [...(acc[position.formation_id] || []), position];
      return acc;
    }, {} as Record<string, LibraryPosition[]>);
  }, [positions]);

  const filteredFormations = useMemo(() => {
    return formations.filter((formation) => {
      const hidden = preferences[formation.id]?.is_hidden === true;
      const fieldSource = getFormationFieldSource(formation);
      const matchesSearch =
        !searchText ||
        [formation.name, formation.code, formation.description, fieldSource.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(searchText));
      const matchesOwner = ownerFilter === "__all__" || formation.owner_scope === ownerFilter;
      const matchesStatus = statusFilter === "hidden" ? hidden : !hidden;
      return matchesSearch && matchesOwner && matchesStatus;
    });
  }, [formations, ownerFilter, preferences, searchText, statusFilter]);

  const templateCards = useMemo(() => {
    if (fieldTemplates.length > 0) return fieldTemplates;
    const seen = new Map<string, FieldTemplateRow>();
    formations.forEach((formation) => {
      const source = getFormationFieldSource(formation);
      const key = source.background_image_url || `${source.grid_rows}-${source.grid_columns}-${source.name || formation.id}`;
      if (seen.has(key)) return;
      seen.set(key, {
        id: key,
        name: source.name || `${formation.name} pitch`,
        code: source.code || null,
        sport: "hockey",
        owner_scope: formation.owner_scope,
        association_id: formation.association_id,
        club_id: formation.club_id,
        team_id: formation.team_id,
        background_image_url: source.background_image_url || null,
        grid_rows: Number(source.grid_rows || formation.grid_rows || 10),
        grid_columns: Number(source.grid_columns || formation.grid_columns || 14),
        pitch_boundary_x: source.pitch_boundary_x,
        pitch_boundary_y: source.pitch_boundary_y,
        pitch_boundary_width: source.pitch_boundary_width,
        pitch_boundary_height: source.pitch_boundary_height,
        default_icon_id: source.default_icon_id || null,
        position_icon_size: source.position_icon_size || DEFAULT_POSITION_ICON_SIZE,
        is_active: true,
        created_by: formation.created_by,
      });
    });
    return Array.from(seen.values());
  }, [fieldTemplates, formations]);

  const imageCards = useMemo(() => {
    const seen = new Map<string, FormationAssetImage>();
    [...fieldTemplates, ...formations].forEach((item: any) => {
      if (!item.background_image_url) return;
      const current = seen.get(item.background_image_url);
      seen.set(item.background_image_url, {
        id: item.background_image_url,
        name: current?.name || item.name || "Surface image",
        url: item.background_image_url,
        usedBy: (current?.usedBy || 0) + 1,
        createdBy: current?.createdBy || item.created_by || null,
      });
    });
    return Array.from(seen.values());
  }, [fieldTemplates, formations]);

  const iconUseCount = useMemo(() => {
    return positions.reduce((acc, position) => {
      if (position.icon_id) acc[position.icon_id] = (acc[position.icon_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [positions]);

  const assetCards = useMemo(() => {
    const imageAssets = imageCards.map((image) => ({
      id: image.id,
      type: "surface" as const,
      name: image.name,
      url: image.url,
      ownerText: image.createdBy === userId ? "Mine" : "Shared",
      meta: `Used by ${image.usedBy} templates or formations`,
      createdBy: image.createdBy || null,
      hidden: false,
    }));
    const iconAssets = icons.map((icon) => ({
      id: icon.id,
      type: "icon" as const,
      name: icon.name,
      url: icon.image_url,
      ownerText: (icon as any).uploaded_by === userId || icon.is_custom ? "Mine" : "Shared",
      meta: `${icon.is_custom ? "Custom" : "Standard"} - used by ${iconUseCount[icon.id] || 0} positions`,
      createdBy: (icon as any).uploaded_by || null,
      hidden: false,
    }));
    const symbolAssets = [
      {
        id: "symbols-placeholder",
        type: "symbol" as const,
        name: "Symbols",
        url: null,
        ownerText: "Shared",
        meta: "Placeholder for reusable formation symbols",
        createdBy: null,
        hidden: false,
      },
    ];

    return [...imageAssets, ...iconAssets, ...symbolAssets].filter((asset) => {
      if (assetTypeFilter === "surface" && asset.type !== "surface") return false;
      if (assetTypeFilter === "icons" && asset.type !== "icon") return false;
      if (assetTypeFilter === "symbols" && asset.type !== "symbol") return false;
      if (assetOwnerFilter === "mine") return asset.ownerText === "Mine";
      if (assetOwnerFilter === "shared") return asset.ownerText === "Shared";
      if (assetOwnerFilter === "hidden") return asset.hidden;
      return true;
    });
  }, [assetOwnerFilter, assetTypeFilter, iconUseCount, icons, imageCards, userId]);

  const openFormation = (formationId: string) => navigate(`/coaching/formations/builder?formation=${formationId}`);
  const createFormation = () => navigate("/coaching/formations/builder?new=1");
  const openTemplate = (templateId: string) => navigate(`/coaching/formations/templates/builder?template=${encodeURIComponent(templateId)}`);
  const createTemplate = () => navigate("/coaching/formations/templates/builder?new=1");
  const createFormationFromTemplate = (templateId: string) => navigate(`/coaching/formations/builder?new=1&template=${encodeURIComponent(templateId)}`);
  const requestDelete = (item: PendingDelete) => setPendingDelete(item);
  const confirmDelete = () => {
    toast.info("Delete needs backend usage checks before it can remove live data. Use hide for now.");
    setPendingDelete(null);
  };
  const handleAssetFile = (file?: File) => {
    if (!file) return;
    setAssetDraftName((current) => current || file.name.replace(/\.[^.]+$/, ""));
    setAssetDraftPreview(URL.createObjectURL(file));
  };
  const saveAssetDraft = () => {
    toast.info("Asset saving needs backend support before it can be added to the shared library.");
    setAssetDialogOpen(false);
    setAssetDraftName("");
    setAssetDraftPreview(null);
    setAssetFocusX(50);
    setAssetFocusY(50);
    setAssetZoom(100);
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading formation library...</div>;
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Formation Library</h1>
          <p className="text-sm text-muted-foreground">Manage templates, formations, surface images, and position icons.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAssetDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add asset
          </Button>
          <Button variant="outline" onClick={createTemplate}>
            <Plus className="mr-2 h-4 w-4" />
            Create template
          </Button>
          <Button onClick={createFormation}>
            <Plus className="mr-2 h-4 w-4" />
            Create formation
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-[minmax(0,1fr)_180px_160px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search library" />
        </div>
        <Select value={ownerFilter} onValueChange={(value) => setOwnerFilter(value as typeof ownerFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OWNER_FILTERS.map((scope) => (
              <SelectItem key={scope} value={scope}>
                {scope === "__all__" ? "All owners" : ownerText(scope)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="formations" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:w-auto">
          <TabsTrigger value="formations">Formations</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="formations">
          {filteredFormations.length === 0 ? (
            <EmptyState title="No formations found" text="Create a formation or change the search filters." action={createFormation} actionLabel="Create formation" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredFormations.map((formation) => {
                const fieldSource = getFormationFieldSource(formation);
                const formationPositions = positionsByFormation[formation.id] || [];
                const hidden = preferences[formation.id]?.is_hidden;
                return (
                  <Card key={formation.id} className={cn("overflow-hidden", hidden && "opacity-75")}>
                    <CardHeader className="space-y-2 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{formation.name}</CardTitle>
                        <div className="flex gap-1">
                          {formation.is_default && <Badge variant="secondary">Default</Badge>}
                          {hidden && <Badge variant="outline">Hidden</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <MiniPitch backgroundUrl={fieldSource.background_image_url} positions={formationPositions} icons={icons} />
                      <div className="grid gap-1 text-sm text-muted-foreground">
                        <span>Template: {fieldSource.name || "Formation surface"}</span>
                        <span>Positions: {formationPositions.length}</span>
                        <span>
                          Owner: {ownerText(formation.owner_scope)} - {ownerLabel(formation.owner_scope)}
                        </span>
                        <span>Last updated: {formatDate((formation as any).updated_at)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => openFormation(formation.id)}>
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => requestDelete({ type: "formation", id: formation.id, name: formation.name })}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates">
          {templateCards.length === 0 ? (
            <EmptyState title="No templates yet" text="Create or open a template to set up a reusable surface." action={createTemplate} actionLabel="Create template" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templateCards.map((template) => {
                const usedBy = formations.filter((formation) => {
                  const source = getFormationFieldSource(formation);
                  return formation.field_template_id === template.id || source.background_image_url === template.background_image_url;
                }).length;
                return (
                  <Card key={template.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <MiniPitch backgroundUrl={template.background_image_url} />
                      <div className="grid gap-1 text-sm text-muted-foreground">
                        <span>
                          Grid: {template.grid_rows} rows x {template.grid_columns} columns
                        </span>
                        <span>Orientation: Landscape</span>
                        <span>Owner: {ownerText(template.owner_scope)}</span>
                        <span>Used by {usedBy} formations</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => openTemplate(template.id)}>
                          Open template
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => createFormationFromTemplate(template.id)}>
                          Create formation from this
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => requestDelete({ type: "template", id: template.id, name: template.name })}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assets" className="space-y-4">
          <div className="grid gap-3 rounded-lg border bg-card p-3 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">Asset type</p>
              <div className="flex flex-wrap gap-2">
                {ASSET_TYPE_FILTERS.map((filter) => (
                  <Button
                    key={filter}
                    size="sm"
                    variant={assetTypeFilter === filter ? "default" : "outline"}
                    onClick={() => setAssetTypeFilter(filter)}
                  >
                    {filter === "all" ? "All" : filter === "surface" ? "Surface images" : filter === "icons" ? "Icons" : "Symbols"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">Ownership</p>
              <div className="flex flex-wrap gap-2">
                {ASSET_OWNER_FILTERS.map((filter) => (
                  <Button
                    key={filter}
                    size="sm"
                    variant={assetOwnerFilter === filter ? "default" : "outline"}
                    onClick={() => setAssetOwnerFilter(filter)}
                  >
                    {filter === "all" ? "All" : filter === "mine" ? "Mine" : filter === "shared" ? "Shared" : "Hidden"}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {assetCards.length === 0 ? (
            <EmptyState title="No assets found" text="Surface images, icons, and symbols will appear here after they are added or used." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              {assetCards.map((asset) => (
                <Card key={`${asset.type}-${asset.id}`}>
                  <CardContent className="space-y-3 pt-4">
                    {asset.type === "surface" ? (
                      <img src={asset.url || ""} alt="" className="aspect-video w-full rounded-md border object-cover" />
                    ) : asset.type === "icon" ? (
                      <div className="flex aspect-video w-full items-center justify-center rounded-md border bg-muted">
                        {asset.url ? <img src={asset.url} alt="" className="h-14 w-14 rounded-full object-cover" /> : <Users className="h-8 w-8 text-muted-foreground" />}
                      </div>
                    ) : (
                      <div className="flex aspect-video w-full items-center justify-center rounded-md border bg-muted">
                        <span className="rounded-full border bg-background px-3 py-2 text-sm font-semibold">SYM</span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate font-medium">{asset.name}</p>
                        <Badge variant="outline">
                          {asset.type === "surface" ? "Surface" : asset.type === "icon" ? "Icon" : "Symbol"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{asset.meta}</p>
                      <p className="text-xs text-muted-foreground">{asset.ownerText}</p>
                    </div>
                    {asset.type === "surface" && (
                      <Button size="sm" variant="outline" onClick={createTemplate}>
                        Use in new template
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => requestDelete({ type: "asset", id: asset.id, name: asset.name })}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add asset</DialogTitle>
            <DialogDescription>Choose an asset type, upload a file, and preview how an icon crop will look.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div>
                <Label>Asset type</Label>
                <Select value={assetDraftType} onValueChange={(value) => setAssetDraftType(value as typeof assetDraftType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="surface">Surface image</SelectItem>
                    <SelectItem value="icon">Icon</SelectItem>
                    <SelectItem value="symbol">Symbol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Name</Label>
                <Input value={assetDraftName} onChange={(event) => setAssetDraftName(event.target.value)} placeholder="Asset name" />
              </div>
              <div>
                <Label htmlFor="asset-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Upload className="h-4 w-4" />
                  Upload file
                </Label>
                <Input id="asset-upload" type="file" accept="image/*" className="hidden" onChange={(event) => handleAssetFile(event.target.files?.[0])} />
              </div>
              {(assetDraftType === "icon" || assetDraftType === "symbol") && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Focus point</p>
                  <div>
                    <Label>X</Label>
                    <Input type="number" min={0} max={100} value={assetFocusX} onChange={(event) => setAssetFocusX(Number(event.target.value))} />
                  </div>
                  <div>
                    <Label>Y</Label>
                    <Input type="number" min={0} max={100} value={assetFocusY} onChange={(event) => setAssetFocusY(Number(event.target.value))} />
                  </div>
                  <div>
                    <Label>Zoom</Label>
                    <Input type="number" min={50} max={200} value={assetZoom} onChange={(event) => setAssetZoom(Number(event.target.value))} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex min-h-[300px] items-center justify-center rounded-md border bg-muted/30 p-4">
              {assetDraftPreview ? (
                assetDraftType === "surface" ? (
                  <img src={assetDraftPreview} alt="" className="aspect-video w-full rounded-md border object-cover" />
                ) : (
                  <div className="relative flex h-56 w-56 items-center justify-center rounded-md border bg-background">
                    <img
                      src={assetDraftPreview}
                      alt=""
                      className="h-44 w-44 rounded-full border-4 border-primary object-cover"
                      style={{
                        objectPosition: `${assetFocusX}% ${assetFocusY}%`,
                        transform: `scale(${assetZoom / 100})`,
                      }}
                    />
                    <span className="pointer-events-none absolute h-44 w-44 rounded-full border-2 border-dashed border-white/90" />
                  </div>
                )
              ) : (
                <p className="text-sm text-muted-foreground">Upload an image to preview it here.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAssetDraft}>Save asset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} cannot be deleted in this front-end pass because live usage checks are needed first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ title, text, action, actionLabel }: { title: string; text: string; action?: () => void; actionLabel?: string }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed bg-card p-8 text-center">
      <LibraryBig className="h-10 w-10 text-muted-foreground" />
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>
      {action && actionLabel && (
        <Button className="mt-4" onClick={action}>
          <Plus className="mr-2 h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

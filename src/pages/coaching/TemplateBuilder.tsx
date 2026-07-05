/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useTeamContext } from "@/contexts/TeamContext";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SurfaceCanvas } from "@/components/formation/SurfaceCanvas";
import {
  DEFAULT_BOUNDARY,
  DEFAULT_POSITION_ICON_SIZE,
  type BoundaryBox,
  type FieldTemplateRow,
  type FormationOwnerScope,
  type FormationRow,
  formatOwnerScope,
  getFormationFieldSource,
  normaliseBoundary,
} from "@/lib/formationPlanner";
import {
  clearLocalJson,
  loadLocalJson,
  loadTemplateQuickPicks,
  saveLocalJson,
  saveTemplateQuickPicks,
  templateDraftKey,
  type TemplateQuickPick,
} from "@/lib/formationLocalState";
import { ArrowLeft, ImagePlus, Maximize2, Minus, Plus, RotateCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

const supabase = typedSupabase as any;
const OWNER_SCOPES: FormationOwnerScope[] = ["SUPER_ADMIN", "ASSOCIATION", "CLUB", "TEAM"];

type PendingAction = { type: "library" } | { type: "new" } | null;

type TemplateDraft = {
  name: string;
  code: string;
  sport: string;
  description: string;
  ownerScope: FormationOwnerScope;
  backgroundUrl: string | null;
  gridRows: number;
  gridColumns: number;
  boundary: BoundaryBox;
  showGrid: boolean;
  snapToGrid: boolean;
  markerSize: number;
  orientation: "landscape" | "portrait";
  zoom: number;
  quickPicks: TemplateQuickPick[];
  savedAt: string;
};

const isExpectedMissingSchemaError = (error?: { message?: string } | null) => {
  const message = String(error?.message || "").toLowerCase();
  return ["field_templates", "could not find", "does not exist", "schema cache"].some((pattern) => message.includes(pattern));
};

const buildTemplateSignature = ({
  name,
  code,
  sport,
  description,
  ownerScope,
  backgroundUrl,
  gridRows,
  gridColumns,
  boundary,
  showGrid,
  snapToGrid,
  markerSize,
  orientation,
  quickPicks,
}: {
  name: string;
  code: string;
  sport: string;
  description: string;
  ownerScope: FormationOwnerScope;
  backgroundUrl: string | null;
  gridRows: number;
  gridColumns: number;
  boundary: BoundaryBox;
  showGrid: boolean;
  snapToGrid: boolean;
  markerSize: number;
  orientation: "landscape" | "portrait";
  quickPicks: TemplateQuickPick[];
}) =>
  JSON.stringify({
    name,
    code,
    sport,
    description,
    ownerScope,
    backgroundUrl,
    gridRows,
    gridColumns,
    boundary,
    showGrid,
    snapToGrid,
    markerSize,
    orientation,
    quickPicks,
  });

export default function TemplateBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isSuperAdmin, canManageAssociation, canManageClub, canManageTeam } = useAdminScope();
  const { selectedAssociationId, selectedClubId, selectedTeamId } = useTeamContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<FieldTemplateRow[]>([]);
  const [surfaceImages, setSurfaceImages] = useState<{ id: string; name: string; url: string }[]>([]);
  const [canUseTemplatesTable, setCanUseTemplatesTable] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);

  const [name, setName] = useState("New surface template");
  const [code, setCode] = useState("");
  const [sport, setSport] = useState("hockey");
  const [description, setDescription] = useState("");
  const [ownerScope, setOwnerScope] = useState<FormationOwnerScope>("TEAM");
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [gridRows, setGridRows] = useState(24);
  const [gridColumns, setGridColumns] = useState(40);
  const [boundary, setBoundary] = useState<BoundaryBox>(DEFAULT_BOUNDARY);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [markerSize, setMarkerSize] = useState(DEFAULT_POSITION_ICON_SIZE);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [zoom, setZoom] = useState(1);
  const [quickPicks, setQuickPicks] = useState<TemplateQuickPick[]>([]);
  const [quickPickCode, setQuickPickCode] = useState("");
  const [quickPickName, setQuickPickName] = useState("");
  const [quickPickSymbol, setQuickPickSymbol] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const draftKey = useMemo(() => templateDraftKey(searchParams.get("template") || "new"), [searchParams]);

  const canUseScope = (scope: FormationOwnerScope) => {
    if (isSuperAdmin) return true;
    if (scope === "ASSOCIATION") return !!selectedAssociationId && canManageAssociation(selectedAssociationId);
    if (scope === "CLUB") return !!selectedClubId && canManageClub(selectedClubId);
    if (scope === "TEAM") return !!selectedTeamId && canManageTeam(selectedTeamId);
    return false;
  };

  const availableOwnerScopes = OWNER_SCOPES.filter(canUseScope);
  const preferredOwnerScope = () => {
    if (selectedTeamId && availableOwnerScopes.includes("TEAM")) return "TEAM";
    if (selectedClubId && availableOwnerScopes.includes("CLUB")) return "CLUB";
    if (selectedAssociationId && availableOwnerScopes.includes("ASSOCIATION")) return "ASSOCIATION";
    if (availableOwnerScopes.includes("SUPER_ADMIN")) return "SUPER_ADMIN";
    return ownerScope;
  };

  const currentSignature = useMemo(
    () =>
      buildTemplateSignature({
        name,
        code,
        sport,
        description,
        ownerScope,
        backgroundUrl,
        gridRows,
        gridColumns,
        boundary,
        showGrid,
        snapToGrid,
        markerSize,
        orientation,
        quickPicks,
      }),
    [name, code, sport, description, ownerScope, backgroundUrl, gridRows, gridColumns, boundary, showGrid, snapToGrid, markerSize, orientation, quickPicks],
  );
  const hasUnsavedChanges = savedSignature !== null && currentSignature !== savedSignature;

  useEffect(() => {
    if (!user) return;
    loadTemplateData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    saveLocalJson<TemplateDraft>(draftKey, {
      name,
      code,
      sport,
      description,
      ownerScope,
      backgroundUrl,
      gridRows,
      gridColumns,
      boundary,
      showGrid,
      snapToGrid,
      markerSize,
      orientation,
      zoom,
      quickPicks,
      savedAt: new Date().toISOString(),
    });
  }, [
    backgroundUrl,
    boundary,
    code,
    description,
    draftKey,
    gridColumns,
    gridRows,
    hasUnsavedChanges,
    markerSize,
    name,
    orientation,
    ownerScope,
    quickPicks,
    showGrid,
    snapToGrid,
    sport,
    zoom,
  ]);

  const captureSignature = (overrides?: Partial<Parameters<typeof buildTemplateSignature>[0]>) =>
    buildTemplateSignature({
      name,
      code,
      sport,
      description,
      ownerScope,
      backgroundUrl,
      gridRows,
      gridColumns,
      boundary,
      showGrid,
      snapToGrid,
      markerSize,
      orientation,
      quickPicks,
      ...overrides,
    });

  const restoreLocalDraft = () => {
    if (draftRestored) return false;
    const draft = loadLocalJson<TemplateDraft>(draftKey);
    if (!draft) return false;
    setDraftRestored(true);
    setName(draft.name);
    setCode(draft.code);
    setSport(draft.sport);
    setDescription(draft.description);
    setOwnerScope(draft.ownerScope);
    setBackgroundUrl(draft.backgroundUrl);
    setGridRows(draft.gridRows);
    setGridColumns(draft.gridColumns);
    setBoundary(draft.boundary);
    setShowGrid(draft.showGrid);
    setSnapToGrid(draft.snapToGrid);
    setMarkerSize(draft.markerSize);
    setOrientation(draft.orientation);
    setZoom(draft.zoom || 1);
    setQuickPicks(draft.quickPicks || []);
    toast.info("Draft restored.");
    return true;
  };

  const clearLocalDraft = () => {
    clearLocalJson(draftKey);
    setDraftRestored(false);
  };

  const loadTemplateData = async () => {
    if (hasUnsavedChanges) {
      toast.info("Fresh template data is available. Save or discard your changes before reloading it.");
      return;
    }

    setLoading(true);
    const [templatesRes, formationsRes] = await Promise.all([
      supabase.from("field_templates").select("*").eq("is_active", true).order("name"),
      supabase.from("formations").select("*").order("name"),
    ]);

    const templateRows = templatesRes.error ? [] : ((templatesRes.data || []) as FieldTemplateRow[]);
    if (templatesRes.error && !isExpectedMissingSchemaError(templatesRes.error)) {
      toast.warning(`Template storage is unavailable: ${templatesRes.error.message}`);
    }
    setCanUseTemplatesTable(!templatesRes.error);
    setTemplates(templateRows);

    const imageMap = new Map<string, { id: string; name: string; url: string }>();
    [...templateRows, ...((formationsRes.data || []) as FormationRow[])].forEach((item) => {
      const source = "field_template_id" in item ? getFormationFieldSource(item) : item;
      const url = source.background_image_url;
      if (!url) return;
      imageMap.set(url, { id: url, name: source.name || "Surface image", url });
    });
    setSurfaceImages(Array.from(imageMap.values()));

    const requestedTemplateId = searchParams.get("template");
    const requestedTemplate = requestedTemplateId ? templateRows.find((template) => template.id === requestedTemplateId) || null : null;
    if (requestedTemplate) {
      loadTemplate(requestedTemplate);
    } else {
      startNewTemplate();
    }
    setLoading(false);
  };

  const loadTemplate = (template: FieldTemplateRow) => {
    const nextBoundary = normaliseBoundary(template);
    const nextQuickPicks = loadTemplateQuickPicks(template.id);
    setActiveTemplateId(template.id);
    setName(template.name);
    setCode(template.code || "");
    setSport(template.sport || "hockey");
    setDescription("");
    setOwnerScope(template.owner_scope);
    setBackgroundUrl(template.background_image_url || null);
    setGridRows(Number(template.grid_rows || 24));
    setGridColumns(Number(template.grid_columns || 40));
    setBoundary(nextBoundary);
    setMarkerSize(Number(template.position_icon_size || DEFAULT_POSITION_ICON_SIZE));
    setQuickPicks(nextQuickPicks);
    setSavedSignature(
      buildTemplateSignature({
        name: template.name,
        code: template.code || "",
        sport: template.sport || "hockey",
        description: "",
        ownerScope: template.owner_scope,
        backgroundUrl: template.background_image_url || null,
        gridRows: Number(template.grid_rows || 24),
        gridColumns: Number(template.grid_columns || 40),
        boundary: nextBoundary,
        showGrid,
        snapToGrid,
        markerSize: Number(template.position_icon_size || DEFAULT_POSITION_ICON_SIZE),
        orientation,
        quickPicks: nextQuickPicks,
      }),
    );
    restoreLocalDraft();
  };

  const startNewTemplate = () => {
    const nextOwnerScope = preferredOwnerScope();
    setActiveTemplateId(null);
    setName("New surface template");
    setCode("");
    setSport("hockey");
    setDescription("");
    setOwnerScope(nextOwnerScope);
    setBackgroundUrl(null);
    setGridRows(24);
    setGridColumns(40);
    setBoundary(DEFAULT_BOUNDARY);
    setShowGrid(true);
    setSnapToGrid(true);
    setMarkerSize(DEFAULT_POSITION_ICON_SIZE);
    setOrientation("landscape");
    setZoom(1);
    setQuickPicks([]);
    setSavedSignature(
      buildTemplateSignature({
        name: "New surface template",
        code: "",
        sport: "hockey",
        description: "",
        ownerScope: nextOwnerScope,
        backgroundUrl: null,
        gridRows: 24,
        gridColumns: 40,
        boundary: DEFAULT_BOUNDARY,
        showGrid: true,
        snapToGrid: true,
        markerSize: DEFAULT_POSITION_ICON_SIZE,
        orientation: "landscape",
        quickPicks: [],
      }),
    );
    restoreLocalDraft();
  };

  const requestBackToLibrary = () => {
    if (hasUnsavedChanges) {
      setPendingAction({ type: "library" });
      return;
    }
    navigate("/coaching/formations");
  };

  const requestNewTemplate = () => {
    if (hasUnsavedChanges) {
      setPendingAction({ type: "new" });
      return;
    }
    startNewTemplate();
  };

  const ownerIdsForScope = () => ({
    association_id: ownerScope === "ASSOCIATION" ? selectedAssociationId || null : null,
    club_id: ownerScope === "CLUB" ? selectedClubId || null : null,
    team_id: ownerScope === "TEAM" ? selectedTeamId || null : null,
  });

  const uploadSurfaceImage = async (file?: File) => {
    if (!file || !user) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${user.id}/backgrounds/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("formation-assets").upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("formation-assets").getPublicUrl(path);
    setBackgroundUrl(data.publicUrl as string);
  };

  const saveTemplate = async () => {
    if (!user) return false;
    if (!canUseTemplatesTable) {
      toast.error("Template storage is not available yet. This needs backend support before templates can be saved.");
      return false;
    }
    if (!name.trim()) {
      toast.error("Add a template name first.");
      return false;
    }
    if (!canUseScope(ownerScope)) {
      toast.error("You cannot save a template at that level.");
      return false;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        sport: sport.trim() || "sport",
        owner_scope: ownerScope,
        ...ownerIdsForScope(),
        background_image_url: backgroundUrl,
        grid_rows: Math.max(1, Math.floor(Number(gridRows))),
        grid_columns: Math.max(1, Math.floor(Number(gridColumns))),
        pitch_boundary_x: boundary.x,
        pitch_boundary_y: boundary.y,
        pitch_boundary_width: boundary.width,
        pitch_boundary_height: boundary.height,
        default_icon_id: null,
        position_icon_size: Math.max(24, Math.min(72, Math.floor(Number(markerSize)))),
        is_active: true,
        created_by: user.id,
      };
      const res = activeTemplateId
        ? await supabase.from("field_templates").update(payload).eq("id", activeTemplateId).select("*").single()
        : await supabase.from("field_templates").insert(payload).select("*").single();

      if (res.error) throw res.error;
      const saved = res.data as FieldTemplateRow;
      toast.success("Template saved.");
      setActiveTemplateId(saved.id);
      saveTemplateQuickPicks(saved.id, quickPicks);
      setLastSavedAt(new Date().toISOString());
      clearLocalDraft();
      setSavedSignature(captureSignature({ name: saved.name, code: saved.code || "", sport: saved.sport || "sport", quickPicks }));
      return true;
    } catch (error: any) {
      toast.error(error.message || "Template could not be saved.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const confirmPendingAction = () => {
    const action = pendingAction;
    setPendingAction(null);
    if (!action) return;
    clearLocalDraft();
    if (action.type === "library") navigate("/coaching/formations");
    if (action.type === "new") startNewTemplate();
  };

  const saveThenRunPendingAction = async () => {
    const action = pendingAction;
    if (!action) return;
    const saved = await saveTemplate();
    if (!saved) return;
    setPendingAction(null);
    if (action.type === "library") navigate("/coaching/formations");
    if (action.type === "new") startNewTemplate();
  };

  const zoomIn = () => setZoom((current) => Math.min(2.5, Number((current + 0.25).toFixed(2))));
  const zoomOut = () => setZoom((current) => Math.max(1, Number((current - 0.25).toFixed(2))));
  const fitView = () => setZoom(1);
  const resetView = () => {
    setZoom(1);
    setOrientation("landscape");
  };

  const addQuickPick = () => {
    const codeValue = quickPickCode.trim().toUpperCase();
    const nameValue = quickPickName.trim();
    if (!codeValue || !nameValue) {
      toast.error("Add a quick-pick code and name first.");
      return;
    }
    setQuickPicks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        code: codeValue,
        name: nameValue,
        symbol: quickPickSymbol.trim() || codeValue,
        iconId: null,
      },
    ]);
    setQuickPickCode("");
    setQuickPickName("");
    setQuickPickSymbol("");
  };

  const removeQuickPick = (quickPickId: string) => {
    setQuickPicks((current) => current.filter((quickPick) => quickPick.id !== quickPickId));
  };

  const formatSavedTime = (value: string) =>
    new Intl.DateTimeFormat("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading template builder...</div>;
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Template Builder</h1>
          <p className="text-sm text-muted-foreground">
            {name}
            {hasUnsavedChanges ? " - Unsaved changes" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={requestBackToLibrary}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Library
          </Button>
          <Button variant="outline" onClick={requestNewTemplate}>
            <Plus className="mr-2 h-4 w-4" />
            New
          </Button>
          <Button variant="outline" onClick={() => setOrientation((current) => (current === "landscape" ? "portrait" : "landscape"))}>
            <RotateCw className="mr-2 h-4 w-4" />
            Rotate view
          </Button>
          <Button variant="outline" size="icon" onClick={zoomOut} title="Zoom out">
            <Minus className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={zoomIn} title="Zoom in">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={fitView}>
            <Maximize2 className="mr-2 h-4 w-4" />
            Fit
          </Button>
          <Button variant="outline" onClick={resetView}>
            Reset
          </Button>
          <Button onClick={saveTemplate} disabled={saving || !canUseTemplatesTable}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save template"}
          </Button>
          {lastSavedAt && <span className="self-center text-xs text-muted-foreground">Saved {formatSavedTime(lastSavedAt)}</span>}
        </div>
      </div>

      {!canUseTemplatesTable && (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Template storage is not available in the current backend. You can review the Template Builder layout, but saving needs backend support.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
        <Card className="order-2 lg:order-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Template settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Template name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <Label>Short code</Label>
              <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
            </div>
            <div>
              <Label>Sport / surface type</Label>
              <Input value={sport} onChange={(event) => setSport(event.target.value)} />
            </div>
            <div>
              <Label>Owner</Label>
              <Select value={ownerScope} onValueChange={(value) => setOwnerScope(value as FormationOwnerScope)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableOwnerScopes.map((scope) => (
                    <SelectItem key={scope} value={scope}>
                      {formatOwnerScope(scope)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Front-end note only until template descriptions are supported."
              />
            </div>
            <div>
              <Label>Surface image</Label>
              <Select value={backgroundUrl || "__none__"} onValueChange={(value) => setBackgroundUrl(value === "__none__" ? null : value)}>
                <SelectTrigger className="w-full min-w-0 overflow-hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Standard surface image</SelectItem>
                  {surfaceImages.map((image) => (
                    <SelectItem key={image.id} value={image.url}>
                      {image.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="surface-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <ImagePlus className="h-4 w-4" />
                Upload surface image
              </Label>
              <Input id="surface-upload" type="file" accept="image/*" className="hidden" onChange={(event) => uploadSurfaceImage(event.target.files?.[0])} />
            </div>
          </CardContent>
        </Card>

        <Card className="order-1 lg:order-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Surface canvas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SurfaceCanvas
              backgroundUrl={backgroundUrl}
              boundary={boundary}
              gridRows={gridRows}
              gridColumns={gridColumns}
              showGrid={showGrid}
              snapToGrid={snapToGrid}
              rotation={orientation}
              zoom={zoom}
              markerSize={markerSize}
            />
          </CardContent>
        </Card>

        <Card className="order-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Surface controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Grid rows</Label>
                <Input type="number" min={1} value={gridRows} onChange={(event) => setGridRows(Number(event.target.value))} />
              </div>
              <div>
                <Label>Grid columns</Label>
                <Input type="number" min={1} value={gridColumns} onChange={(event) => setGridColumns(Number(event.target.value))} />
              </div>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <p className="font-medium">Usable playing area</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>X</Label>
                  <Input type="number" value={boundary.x} onChange={(event) => setBoundary((current) => ({ ...current, x: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label>Y</Label>
                  <Input type="number" value={boundary.y} onChange={(event) => setBoundary((current) => ({ ...current, y: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label>Width</Label>
                  <Input type="number" value={boundary.width} onChange={(event) => setBoundary((current) => ({ ...current, width: Number(event.target.value) }))} />
                </div>
                <div>
                  <Label>Height</Label>
                  <Input type="number" value={boundary.height} onChange={(event) => setBoundary((current) => ({ ...current, height: Number(event.target.value) }))} />
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="template-show-grid">Show grid</Label>
                <Checkbox id="template-show-grid" checked={showGrid} onCheckedChange={(value) => setShowGrid(value === true)} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="template-snap-grid">Snap to grid default</Label>
                <Checkbox id="template-snap-grid" checked={snapToGrid} onCheckedChange={(value) => setSnapToGrid(value === true)} />
              </div>
              <div>
                <Label>Default marker size</Label>
                <Input type="number" min={24} max={72} value={markerSize} onChange={(event) => setMarkerSize(Number(event.target.value))} />
              </div>
              <div className="text-xs text-muted-foreground">Zoom: {Math.round(zoom * 100)}%</div>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div>
                <p className="font-medium">Quick-pick positions</p>
                <p className="text-xs text-muted-foreground">Front-end template shortcuts for the Formation Builder.</p>
              </div>
              <div className="grid grid-cols-[72px_minmax(0,1fr)_72px] gap-2">
                <div>
                  <Label>Code</Label>
                  <Input value={quickPickCode} onChange={(event) => setQuickPickCode(event.target.value.toUpperCase())} />
                </div>
                <div>
                  <Label>Position name</Label>
                  <Input value={quickPickName} onChange={(event) => setQuickPickName(event.target.value)} />
                </div>
                <div>
                  <Label>Symbol</Label>
                  <Input value={quickPickSymbol} onChange={(event) => setQuickPickSymbol(event.target.value.toUpperCase())} />
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addQuickPick}>
                <Plus className="mr-2 h-4 w-4" />
                Add quick-pick
              </Button>
              {quickPicks.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No quick-pick positions yet.
                </p>
              ) : (
                <div className="grid gap-2">
                  {quickPicks.map((quickPick) => (
                    <div key={quickPick.id} className="flex items-center gap-2 rounded-md border px-2 py-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {quickPick.symbol || quickPick.code}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{quickPick.code}</p>
                        <p className="truncate text-xs text-muted-foreground">{quickPick.name}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => removeQuickPick(quickPick.id)}
                        title="Remove quick-pick"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have unsaved changes. Save before leaving?</AlertDialogTitle>
            <AlertDialogDescription>You can keep editing, discard the changes, or save before continuing.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <Button variant="outline" onClick={confirmPendingAction}>
              Discard changes
            </Button>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                saveThenRunPendingAction();
              }}
            >
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

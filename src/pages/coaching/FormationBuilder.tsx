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
import { SurfaceCanvas, type CanvasPlacement } from "@/components/formation/SurfaceCanvas";
import {
  DEFAULT_BOUNDARY,
  DEFAULT_POSITION_ICON_SIZE,
  type BoundaryBox,
  type FieldTemplateRow,
  type FormationIconRow,
  type FormationOwnerScope,
  type FormationPositionRow,
  type FormationRow,
  formatOwnerScope,
  getFormationFieldSource,
  gridToPercent,
  normaliseBoundary,
} from "@/lib/formationPlanner";
import {
  clearLocalJson,
  formationDraftKey,
  loadLocalJson,
  loadTemplateQuickPicks,
  saveLocalJson,
  type TemplateQuickPick,
} from "@/lib/formationLocalState";
import { cn } from "@/lib/utils";
import { ArrowLeft, Maximize2, Minus, Plus, RotateCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

const supabase = typedSupabase as any;

type EditablePosition = Omit<FormationPositionRow, "id" | "formation_id" | "created_at" | "updated_at"> & {
  id?: string;
  local_id?: string;
};

const getPositionKey = (position: EditablePosition, index: number) => position.id || position.local_id || `${position.code}-${index}`;

type PendingUnsavedAction =
  | { type: "new" }
  | { type: "library" }
  | { type: "template"; templateId: string }
  | null;

const OWNER_SCOPES: FormationOwnerScope[] = ["SUPER_ADMIN", "ASSOCIATION", "CLUB", "TEAM"];

type FormationSchemaCapabilities = {
  canUseFieldTemplatesTable: boolean;
  canUseFormationFieldTemplateId: boolean;
  canUseFormationPositionIconSize: boolean;
};

const EXPECTED_SCHEMA_ERROR_PATTERNS = [
  "field_templates",
  "field_template_id",
  "position_icon_size",
  "could not find",
  "does not exist",
  "schema cache",
  "relationship",
];

const MARKER_SIZE_OPTIONS = {
  small: 32,
  medium: 40,
  large: 48,
} as const;

type MarkerSize = keyof typeof MARKER_SIZE_OPTIONS;

type FormationDraft = {
  name: string;
  code: string;
  description: string;
  ownerScope: FormationOwnerScope;
  gridRows: number;
  gridColumns: number;
  isDefault: boolean;
  backgroundUrl: string | null;
  boundary: BoundaryBox;
  selectedFieldTemplateId: string;
  positions: EditablePosition[];
  newPositionName: string;
  newPositionCode: string;
  newPositionIconId: string;
  showGrid: boolean;
  snapToGrid: boolean;
  markerSize: MarkerSize;
  isRotatedView: boolean;
  zoom: number;
  savedAt: string;
};

const isExpectedMissingSchemaError = (error?: { message?: string } | null) => {
  const message = String(error?.message || "").toLowerCase();
  return EXPECTED_SCHEMA_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

const buildDraftSignature = ({
  name,
  code,
  description,
  ownerScope,
  gridRows,
  gridColumns,
  isDefault,
  backgroundUrl,
  boundary,
  selectedFieldTemplateId,
  positions,
}: {
  name: string;
  code: string;
  description: string;
  ownerScope: FormationOwnerScope;
  gridRows: number;
  gridColumns: number;
  isDefault: boolean;
  backgroundUrl: string | null;
  boundary: BoundaryBox;
  selectedFieldTemplateId: string;
  positions: EditablePosition[];
}) =>
  JSON.stringify({
    name,
    code,
    description,
    ownerScope,
    gridRows,
    gridColumns,
    isDefault,
    backgroundUrl,
    boundary,
    selectedFieldTemplateId,
    positions: positions.map((position, index) => ({
      id: position.id || null,
      name: position.name,
      code: position.code,
      icon_id: position.icon_id || null,
      zone: position.zone || null,
      grid_x: position.grid_x,
      grid_y: position.grid_y,
      x_percent: position.x_percent,
      y_percent: position.y_percent,
      sort_order: index,
      is_starting_slot: position.is_starting_slot !== false,
    })),
  });

export default function FormationBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isSuperAdmin, canManageAssociation, canManageClub, canManageTeam } = useAdminScope();
  const {
    selectedAssociationId,
    selectedClubId,
    selectedTeamId,
  } = useTeamContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formations, setFormations] = useState<FormationRow[]>([]);
  const [fieldTemplates, setFieldTemplates] = useState<FieldTemplateRow[]>([]);
  const [selectedFieldTemplateId, setSelectedFieldTemplateId] = useState<string>("__legacy__");
  const [schemaCapabilities, setSchemaCapabilities] = useState<FormationSchemaCapabilities>({
    canUseFieldTemplatesTable: false,
    canUseFormationFieldTemplateId: false,
    canUseFormationPositionIconSize: false,
  });
  const [icons, setIcons] = useState<FormationIconRow[]>([]);
  const [savedDraftSignature, setSavedDraftSignature] = useState<string | null>(null);
  const [pendingUnsavedAction, setPendingUnsavedAction] = useState<PendingUnsavedAction>(null);
  const [activeFormationId, setActiveFormationId] = useState<string | null>(null);
  const [name, setName] = useState("Standard 10");
  const [code, setCode] = useState("STD-10");
  const [description, setDescription] = useState("");
  const [ownerScope, setOwnerScope] = useState<FormationOwnerScope>("TEAM");
  const [gridRows, setGridRows] = useState(10);
  const [gridColumns, setGridColumns] = useState(14);
  const [isDefault, setIsDefault] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [boundary, setBoundary] = useState<BoundaryBox>(DEFAULT_BOUNDARY);
  const [positions, setPositions] = useState<EditablePosition[]>([]);
  const [newPositionName, setNewPositionName] = useState("Centre Forward");
  const [newPositionCode, setNewPositionCode] = useState("CF");
  const [newPositionIconId, setNewPositionIconId] = useState<string>("__none__");
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [markerSize, setMarkerSize] = useState<MarkerSize>("medium");
  const [isRotatedView, setIsRotatedView] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedPositionKey, setSelectedPositionKey] = useState<string | null>(null);
  const [quickPicks, setQuickPicks] = useState<TemplateQuickPick[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const draftKey = useMemo(
    () => formationDraftKey(searchParams.get("formation") || searchParams.get("template") || "new"),
    [searchParams],
  );

  const canUseScope = (scope: FormationOwnerScope) => {
    if (isSuperAdmin) return true;
    if (scope === "ASSOCIATION") return !!selectedAssociationId && canManageAssociation(selectedAssociationId);
    if (scope === "CLUB") return !!selectedClubId && canManageClub(selectedClubId);
    if (scope === "TEAM") return !!selectedTeamId && canManageTeam(selectedTeamId);
    return false;
  };

  const availableOwnerScopes = OWNER_SCOPES.filter(canUseScope);
  const getPreferredOwnerScope = () => {
    if (selectedTeamId && availableOwnerScopes.includes("TEAM")) return "TEAM";
    if (selectedClubId && availableOwnerScopes.includes("CLUB")) return "CLUB";
    if (selectedAssociationId && availableOwnerScopes.includes("ASSOCIATION")) return "ASSOCIATION";
    if (availableOwnerScopes.includes("SUPER_ADMIN")) return "SUPER_ADMIN";
    return ownerScope;
  };
  const activeFormation = formations.find((formation) => formation.id === activeFormationId) || null;
  const currentDraftSignature = useMemo(
    () =>
      buildDraftSignature({
        name,
        code,
        description,
        ownerScope,
        gridRows,
        gridColumns,
        isDefault,
        backgroundUrl,
        boundary,
        selectedFieldTemplateId,
        positions,
      }),
    [name, code, description, ownerScope, gridRows, gridColumns, isDefault, backgroundUrl, boundary, selectedFieldTemplateId, positions],
  );
  const hasUnsavedChanges = savedDraftSignature !== null && currentDraftSignature !== savedDraftSignature;
  const fieldSource = getFormationFieldSource(activeFormation);
  const currentTemplateName =
    selectedFieldTemplateId !== "__legacy__"
      ? fieldTemplates.find((template) => template.id === selectedFieldTemplateId)?.name || fieldSource.name || "Selected template"
      : fieldSource.name || "Formation surface";
  const markerPixelSize = MARKER_SIZE_OPTIONS[markerSize];
  const selectedPositionIndex = positions.findIndex((position, index) => getPositionKey(position, index) === selectedPositionKey);
  const selectedPosition = selectedPositionIndex >= 0 ? positions[selectedPositionIndex] : null;
  const canvasMarkers = useMemo(
    () =>
      positions.map((position, index) => {
        const icon = icons.find((item) => item.id === position.icon_id);
        return {
          key: getPositionKey(position, index),
          code: position.code,
          name: position.name,
          iconUrl: icon?.image_url || null,
          gridX: Number(position.grid_x),
          gridY: Number(position.grid_y),
          xPercent: Number(position.x_percent),
          yPercent: Number(position.y_percent),
        };
      }),
    [icons, positions],
  );
  const zoomIn = () => setZoom((current) => Math.min(2.5, Number((current + 0.25).toFixed(2))));
  const zoomOut = () => setZoom((current) => Math.max(1, Number((current - 0.25).toFixed(2))));
  const fitView = () => setZoom(1);
  const resetView = () => {
    setZoom(1);
    setIsRotatedView(false);
  };

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user?.id]);

  useEffect(() => {
    if (activeFormationId) return;
    setOwnerScope(getPreferredOwnerScope());
  }, [activeFormationId, selectedAssociationId, selectedClubId, selectedTeamId, availableOwnerScopes.join("|")]);

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
    if (selectedFieldTemplateId === "__legacy__") {
      setQuickPicks([]);
      return;
    }
    setQuickPicks(loadTemplateQuickPicks(selectedFieldTemplateId));
  }, [selectedFieldTemplateId]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    saveLocalJson<FormationDraft>(draftKey, {
      name,
      code,
      description,
      ownerScope,
      gridRows,
      gridColumns,
      isDefault,
      backgroundUrl,
      boundary,
      selectedFieldTemplateId,
      positions,
      newPositionName,
      newPositionCode,
      newPositionIconId,
      showGrid,
      snapToGrid,
      markerSize,
      isRotatedView,
      zoom,
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
    isDefault,
    isRotatedView,
    markerSize,
    name,
    newPositionCode,
    newPositionIconId,
    newPositionName,
    ownerScope,
    positions,
    selectedFieldTemplateId,
    showGrid,
    snapToGrid,
    zoom,
  ]);

  const captureSignature = (overrides?: Partial<Parameters<typeof buildDraftSignature>[0]>) =>
    buildDraftSignature({
      name,
      code,
      description,
      ownerScope,
      gridRows,
      gridColumns,
      isDefault,
      backgroundUrl,
      boundary,
      selectedFieldTemplateId,
      positions,
      ...overrides,
    });

  const restoreLocalDraft = () => {
    if (draftRestored) return false;
    const draft = loadLocalJson<FormationDraft>(draftKey);
    if (!draft) return false;
    setDraftRestored(true);
    setName(draft.name);
    setCode(draft.code);
    setDescription(draft.description);
    setOwnerScope(draft.ownerScope);
    setGridRows(draft.gridRows);
    setGridColumns(draft.gridColumns);
    setIsDefault(draft.isDefault);
    setBackgroundUrl(draft.backgroundUrl);
    setBoundary(draft.boundary);
    setSelectedFieldTemplateId(draft.selectedFieldTemplateId);
    setPositions(draft.positions || []);
    setNewPositionName(draft.newPositionName || "Centre Forward");
    setNewPositionCode(draft.newPositionCode || "CF");
    setNewPositionIconId(draft.newPositionIconId || "__none__");
    setShowGrid(draft.showGrid);
    setSnapToGrid(draft.snapToGrid);
    setMarkerSize(draft.markerSize || "medium");
    setIsRotatedView(draft.isRotatedView);
    setZoom(draft.zoom || 1);
    toast.info("Draft restored.");
    return true;
  };

  const clearLocalDraft = () => {
    clearLocalJson(draftKey);
    setDraftRestored(false);
  };

  const loadData = async (options?: { allowDraftReplace?: boolean }) => {
    if (hasUnsavedChanges && !options?.allowDraftReplace) {
      toast.info("Fresh formation data is available. Save or discard your changes before reloading it.");
      return;
    }
    setLoading(true);
    const [formationsRes, iconsRes] = await Promise.all([
      supabase.from("formations").select("*").order("name"),
      supabase.from("formation_icons").select("*").order("is_custom").order("name"),
    ]);

    if (formationsRes.error) toast.error(formationsRes.error.message);
    if (iconsRes.error) toast.error(iconsRes.error.message);

    const [fieldTemplateIdRes, positionIconSizeRes, fieldTemplatesRes] = await Promise.all([
      supabase.from("formations").select("id, field_template_id").limit(1),
      supabase.from("formations").select("id, position_icon_size").limit(1),
      supabase.from("field_templates").select("*").eq("is_active", true).order("name"),
    ]);

    const canUseFormationFieldTemplateId = !fieldTemplateIdRes.error;
    const canUseFormationPositionIconSize = !positionIconSizeRes.error;
    const canUseFieldTemplatesTable = !fieldTemplatesRes.error;

    if (fieldTemplateIdRes.error && !isExpectedMissingSchemaError(fieldTemplateIdRes.error)) {
      toast.warning(`Field template links are unavailable: ${fieldTemplateIdRes.error.message}`);
    }
    if (positionIconSizeRes.error && !isExpectedMissingSchemaError(positionIconSizeRes.error)) {
      toast.warning(`Formation icon size is unavailable: ${positionIconSizeRes.error.message}`);
    }
    const loadedFieldTemplates = canUseFieldTemplatesTable ? (fieldTemplatesRes.data || []) as FieldTemplateRow[] : [];
    const fieldTemplateMap = new Map(loadedFieldTemplates.map((template) => [template.id, template]));
    const formationRows = ((formationsRes.data || []) as FormationRow[]).map((formation) => ({
      ...formation,
      field_templates: formation.field_template_id ? fieldTemplateMap.get(formation.field_template_id) || null : null,
    }));

    setSchemaCapabilities({
      canUseFieldTemplatesTable,
      canUseFormationFieldTemplateId,
      canUseFormationPositionIconSize,
    });
    setFieldTemplates(loadedFieldTemplates);
    setFormations(formationRows);
    setIcons((iconsRes.data || []) as FormationIconRow[]);
    setLoading(false);

    const requestedFormationId = searchParams.get("formation");
    const requestedTemplateId = searchParams.get("template");
    if (requestedFormationId) {
      const requestedFormation = formationRows.find((formation) => formation.id === requestedFormationId);
      if (requestedFormation) {
        await loadFormation(requestedFormation);
      }
      return;
    }

    if (searchParams.get("new") === "1") {
      const requestedTemplate = requestedTemplateId ? loadedFieldTemplates.find((template) => template.id === requestedTemplateId) || null : null;
      startNewFormation(requestedTemplate);
    }
  };

  const loadFormation = async (formation: FormationRow) => {
    const fieldSource = getFormationFieldSource(formation);
    const nextGridRows = Number(fieldSource.grid_rows ?? formation.grid_rows);
    const nextGridColumns = Number(fieldSource.grid_columns ?? formation.grid_columns);
    const nextBackgroundUrl = fieldSource.background_image_url || null;
    const nextBoundary = normaliseBoundary(fieldSource);
    const nextFieldTemplateId = formation.field_template_id || "__legacy__";
    setActiveFormationId(formation.id);
    setName(formation.name);
    setCode(formation.code || "");
    setDescription(formation.description || "");
    setOwnerScope(formation.owner_scope);
    setGridRows(nextGridRows);
    setGridColumns(nextGridColumns);
    setIsDefault(formation.is_default);
    setBackgroundUrl(nextBackgroundUrl);
    setBoundary(nextBoundary);
    setSelectedFieldTemplateId(nextFieldTemplateId);

    const { data, error } = await supabase
      .from("formation_positions")
      .select("*")
      .eq("formation_id", formation.id)
      .order("sort_order");

    if (error) {
      toast.error(error.message);
      setPositions([]);
      return;
    }

    const loadedPositions = ((data || []) as EditablePosition[]).map((position) => ({ ...position, local_id: position.id }));
    setPositions(loadedPositions);
    setSelectedPositionKey(null);
    setSavedDraftSignature(
      buildDraftSignature({
        name: formation.name,
        code: formation.code || "",
        description: formation.description || "",
        ownerScope: formation.owner_scope,
        gridRows: nextGridRows,
        gridColumns: nextGridColumns,
        isDefault: formation.is_default,
        backgroundUrl: nextBackgroundUrl,
        boundary: nextBoundary,
        selectedFieldTemplateId: nextFieldTemplateId,
        positions: loadedPositions,
      }),
    );
    restoreLocalDraft();
  };

  const startNewFormation = (template?: FieldTemplateRow | null) => {
    const nextOwnerScope = getPreferredOwnerScope();
    const nextBoundary = template ? normaliseBoundary(template) : DEFAULT_BOUNDARY;
    const nextGridRows = Number(template?.grid_rows || 10);
    const nextGridColumns = Number(template?.grid_columns || 14);
    const nextBackgroundUrl = template?.background_image_url || null;
    const nextTemplateId = template?.id || "__legacy__";
    const seededPositions: EditablePosition[] = [];

    setActiveFormationId(null);
    setName(template ? `${template.name} formation` : "New formation");
    setCode(template?.code || "");
    setDescription("");
    setOwnerScope(nextOwnerScope);
    setIsDefault(false);
    setBackgroundUrl(nextBackgroundUrl);
    setBoundary(nextBoundary);
    setGridRows(nextGridRows);
    setGridColumns(nextGridColumns);
    setSelectedFieldTemplateId(nextTemplateId);
    setPositions(seededPositions);
    setSelectedPositionKey(null);
    setSavedDraftSignature(
      buildDraftSignature({
        name: template ? `${template.name} formation` : "New formation",
        code: template?.code || "",
        description: "",
        ownerScope: nextOwnerScope,
        gridRows: nextGridRows,
        gridColumns: nextGridColumns,
        isDefault: false,
        backgroundUrl: nextBackgroundUrl,
        boundary: nextBoundary,
        selectedFieldTemplateId: nextTemplateId,
        positions: seededPositions,
      }),
    );
    restoreLocalDraft();
  };

  const requestStartNewFormation = () => {
    if (hasUnsavedChanges) {
      setPendingUnsavedAction({ type: "new" });
      return;
    }
    startNewFormation();
  };

  const requestBackToLibrary = () => {
    if (hasUnsavedChanges) {
      setPendingUnsavedAction({ type: "library" });
      return;
    }
    navigate("/coaching/formations");
  };

  const confirmUnsavedAction = () => {
    const action = pendingUnsavedAction;
    setPendingUnsavedAction(null);
    if (!action) return;
    clearLocalDraft();
    if (action.type === "new") {
      startNewFormation();
      return;
    }
    if (action.type === "library") {
      navigate("/coaching/formations");
      return;
    }
    if (action.type === "template") {
      applyFieldTemplate(action.templateId, { skipUnsavedCheck: true });
    }
  };

  const applyFieldTemplate = (templateId: string, options?: { skipUnsavedCheck?: boolean }) => {
    if (!options?.skipUnsavedCheck && templateId !== selectedFieldTemplateId && hasUnsavedChanges) {
      setPendingUnsavedAction({ type: "template", templateId });
      return;
    }

    setSelectedFieldTemplateId(templateId);
    if (templateId === "__legacy__") return;

    const template = fieldTemplates.find((item) => item.id === templateId);
    if (!template) return;

    const nextBoundary = normaliseBoundary(template);
    setBackgroundUrl(template.background_image_url || null);
    setGridRows(template.grid_rows);
    setGridColumns(template.grid_columns);
    setBoundary(nextBoundary);
    recalcPositions(nextBoundary, template.grid_columns, template.grid_rows);
  };

  const ownerIdsForScope = () => ({
    association_id: ownerScope === "ASSOCIATION" ? selectedAssociationId || null : null,
    club_id: ownerScope === "CLUB" ? selectedClubId || null : null,
    team_id: ownerScope === "TEAM" ? selectedTeamId || null : null,
  });

  const validateFormationForSave = () => {
    if (!name.trim()) {
      toast.error("Add a formation name first.");
      return null;
    }
    if (!canUseScope(ownerScope)) {
      toast.error("You cannot save a formation at that level.");
      return null;
    }
    const safeRows = Math.floor(Number(gridRows));
    const safeColumns = Math.floor(Number(gridColumns));
    if (!Number.isFinite(safeRows) || safeRows < 1 || !Number.isFinite(safeColumns) || safeColumns < 1) {
      toast.error("Rows and columns must be valid numbers.");
      return null;
    }

    const cleanPositions = positions.map((position, index) => {
      const gridX = Math.min(safeColumns, Math.max(0, Math.round(Number(position.grid_x))));
      const gridY = Math.min(safeRows, Math.max(0, Math.round(Number(position.grid_y))));
      const percent = gridToPercent(gridX, gridY, safeColumns, safeRows, boundary);
      const xPercent = Math.min(100, Math.max(0, Number(position.x_percent ?? percent.x)));
      const yPercent = Math.min(100, Math.max(0, Number(position.y_percent ?? percent.y)));
      return {
        ...position,
        name: position.name.trim(),
        code: position.code.trim().toUpperCase(),
        icon_id: position.icon_id || null,
        zone: position.zone || null,
        grid_x: gridX,
        grid_y: gridY,
        x_percent: Number.isFinite(xPercent) ? Number(xPercent.toFixed(3)) : percent.x,
        y_percent: Number.isFinite(yPercent) ? Number(yPercent.toFixed(3)) : percent.y,
        sort_order: index,
        is_starting_slot: position.is_starting_slot !== false,
      };
    });

    if (cleanPositions.length === 0) {
      toast.error("Place at least one position on the pitch.");
      return null;
    }
    if (cleanPositions.some((position) => !position.name || !position.code)) {
      toast.error("Every position needs a name and short code.");
      return null;
    }

    const gridSlots = new Set<string>();
    for (const position of cleanPositions) {
      const slot = `${position.grid_x}:${position.grid_y}`;
      if (gridSlots.has(slot)) {
        toast.error("Two positions are on the same grid corner.");
        return null;
      }
      gridSlots.add(slot);
    }

    const codes = cleanPositions.map((position) => position.code);
    if (new Set(codes).size !== codes.length) {
      toast.warning("Some position codes are repeated.");
    }

    return { safeRows, safeColumns, cleanPositions };
  };

  const savePositionRows = async (formationId: string, cleanPositions: EditablePosition[]) => {
    const positionRows = cleanPositions.map((position, index) => ({
      ...(position.id ? { id: position.id } : {}),
      formation_id: formationId,
      name: position.name,
      code: position.code,
      icon_id: position.icon_id || null,
      zone: position.zone || null,
      grid_x: position.grid_x,
      grid_y: position.grid_y,
      x_percent: position.x_percent,
      y_percent: position.y_percent,
      sort_order: index,
      is_starting_slot: position.is_starting_slot,
    }));

    const { data, error } = await supabase.from("formation_positions").upsert(positionRows).select("id");
    if (error) throw error;

    const savedIds = ((data || []) as Pick<FormationPositionRow, "id">[]).map((row) => row.id).filter(Boolean);
    if (activeFormationId && savedIds.length > 0) {
      const staleRes = await supabase
        .from("formation_positions")
        .delete()
        .eq("formation_id", formationId)
        .not("id", "in", `(${savedIds.join(",")})`);
      if (staleRes.error) throw staleRes.error;
    }
  };

  const saveFormation = async () => {
    if (!user) return false;
    const validated = validateFormationForSave();
    if (!validated) return false;

    setSaving(true);
    const payload = {
      name: name.trim(),
      code: code.trim() || null,
      description: description.trim() || null,
      owner_scope: ownerScope,
      ...ownerIdsForScope(),
      background_image_url: backgroundUrl,
      grid_rows: validated.safeRows,
      grid_columns: validated.safeColumns,
      is_default: isDefault,
      pitch_boundary_x: boundary.x,
      pitch_boundary_y: boundary.y,
      pitch_boundary_width: boundary.width,
      pitch_boundary_height: boundary.height,
      ...(schemaCapabilities.canUseFormationFieldTemplateId ? { field_template_id: null } : {}),
      ...(schemaCapabilities.canUseFormationPositionIconSize
        ? { position_icon_size: DEFAULT_POSITION_ICON_SIZE }
        : {}),
      created_by: user.id,
    };

    try {
      const formationRes = activeFormationId
        ? await supabase.from("formations").update(payload).eq("id", activeFormationId).select("*").single()
        : await supabase.from("formations").insert(payload).select("*").single();

      if (formationRes.error) throw formationRes.error;
      const formation = formationRes.data as FormationRow;
      await savePositionRows(formation.id, validated.cleanPositions);
      toast.success("Formation saved.");
      setActiveFormationId(formation.id);
      setLastSavedAt(new Date().toISOString());
      clearLocalDraft();
      await loadData({ allowDraftReplace: true });
      await loadFormation(formation);
      return true;
    } catch (error: any) {
      toast.error(error.message || "Formation could not be saved.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveThenRunPendingAction = async () => {
    const action = pendingUnsavedAction;
    if (!action) return;
    const saved = await saveFormation();
    if (!saved) return;
    setPendingUnsavedAction(null);

    if (action.type === "new") {
      startNewFormation();
      return;
    }
    if (action.type === "library") {
      navigate("/coaching/formations");
      return;
    }
    if (action.type === "template") {
      applyFieldTemplate(action.templateId, { skipUnsavedCheck: true });
    }
  };

  const addPositionAt = (placement: CanvasPlacement) => {
    if (snapToGrid && positions.some((position) => position.grid_x === placement.snappedX && position.grid_y === placement.snappedY)) {
      toast.error("That grid corner already has a position.");
      return;
    }

    const nextKey = crypto.randomUUID();

    setPositions((current) => [
      ...current,
      {
        name: newPositionName.trim() || "Position",
        code: newPositionCode.trim().toUpperCase() || "POS",
        icon_id: newPositionIconId === "__none__" ? null : newPositionIconId,
        local_id: nextKey,
        zone: null,
        grid_x: placement.gridX,
        grid_y: placement.gridY,
        x_percent: placement.xPercent,
        y_percent: placement.yPercent,
        sort_order: current.length,
        is_starting_slot: true,
      },
    ]);
    setSelectedPositionKey(nextKey);
  };

  const recalcPositions = (nextBoundary = boundary, nextColumns = gridColumns, nextRows = gridRows) => {
    const safeColumns = Math.max(1, Math.floor(Number(nextColumns)));
    const safeRows = Math.max(1, Math.floor(Number(nextRows)));
    setPositions((current) =>
      current.map((position) => {
        const gridX = Math.min(safeColumns, Math.max(0, Math.round(Number(position.grid_x))));
        const gridY = Math.min(safeRows, Math.max(0, Math.round(Number(position.grid_y))));
        const percent = gridToPercent(gridX, gridY, safeColumns, safeRows, nextBoundary);
        return { ...position, grid_x: gridX, grid_y: gridY, x_percent: percent.x, y_percent: percent.y };
      }),
    );
  };

  const updatePositionByKey = (positionKey: string, patch: Partial<EditablePosition>) => {
    setPositions((current) =>
      current.map((position, index) => (getPositionKey(position, index) === positionKey ? { ...position, ...patch } : position)),
    );
  };

  const deletePositionByKey = (positionKey: string) => {
    setPositions((current) => current.filter((position, index) => getPositionKey(position, index) !== positionKey));
    setSelectedPositionKey(null);
  };

  const movePositionToPlacement = (positionKey: string, placement: CanvasPlacement) => {
    updatePositionByKey(positionKey, {
      grid_x: placement.gridX,
      grid_y: placement.gridY,
      x_percent: placement.xPercent,
      y_percent: placement.yPercent,
    });
  };

  const applyQuickPick = (quickPick: TemplateQuickPick) => {
    setNewPositionName(quickPick.name);
    setNewPositionCode(quickPick.code.toUpperCase());
    setNewPositionIconId(quickPick.iconId || "__none__");
  };

  const formatSavedTime = (value: string) =>
    new Intl.DateTimeFormat("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading formation builder...</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Formation Builder</h1>
          <p className="text-sm text-muted-foreground">
            {name}
            {hasUnsavedChanges ? " - Unsaved changes" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={requestBackToLibrary}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Library
          </Button>
          <Button variant="outline" onClick={requestStartNewFormation}>
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
          <Button variant="outline" onClick={() => setIsRotatedView((current) => !current)}>
            <RotateCw className="h-4 w-4 mr-2" />
            Rotate view
          </Button>
          <Button variant="outline" size="icon" onClick={zoomOut} title="Zoom out">
            <Minus className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={zoomIn} title="Zoom in">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={fitView}>
            <Maximize2 className="h-4 w-4 mr-2" />
            Fit
          </Button>
          <Button variant="outline" onClick={resetView}>
            Reset
          </Button>
          <Button onClick={saveFormation} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
          {lastSavedAt && <span className="self-center text-xs text-muted-foreground">Saved {formatSavedTime(lastSavedAt)}</span>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
        <Card className="order-2 lg:order-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Canvas tools</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Current template</p>
              <p className="mt-1 font-medium">{currentTemplateName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {gridRows} rows x {gridColumns} columns
              </p>
              <p className="text-xs text-muted-foreground">
                Boundary: {boundary.x}%, {boundary.y}%, {boundary.width}% x {boundary.height}%
              </p>
              <p className="text-xs text-muted-foreground">
                Orientation: {isRotatedView ? "Portrait view" : "Landscape view"}
              </p>
              <p className="text-xs text-muted-foreground">
                {backgroundUrl ? "Custom surface image" : "Standard surface image"}
              </p>
              {schemaCapabilities.canUseFieldTemplatesTable && (
                <div className="mt-3">
                  <Label>Change template</Label>
                  <Select value={selectedFieldTemplateId} onValueChange={(value) => applyFieldTemplate(value)}>
                    <SelectTrigger className="w-full min-w-0 overflow-hidden">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__legacy__">Use this formation's surface</SelectItem>
                      {fieldTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {quickPicks.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  No quick-pick positions are set for this template. Add a custom position, or edit the template to add quick-pick positions.
                </div>
              ) : (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Quick-pick positions</p>
                  <div className="grid grid-cols-2 gap-2">
                    {quickPicks.map((quickPick) => (
                      <Button
                        key={quickPick.id}
                        type="button"
                        variant="outline"
                        className="h-auto justify-start px-2 py-2 text-left"
                        onClick={() => applyQuickPick(quickPick)}
                      >
                        <span className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {quickPick.symbol || quickPick.code}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold">{quickPick.code}</span>
                          <span className="block truncate text-[11px] font-normal text-muted-foreground">{quickPick.name}</span>
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label>Position name</Label>
                <Input value={newPositionName} onChange={(event) => setNewPositionName(event.target.value)} />
              </div>
              <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-2">
                <div>
                  <Label>Code</Label>
                  <Input value={newPositionCode} onChange={(event) => setNewPositionCode(event.target.value.toUpperCase())} />
                </div>
                <div>
                  <Label>Icon</Label>
                  <Select value={newPositionIconId} onValueChange={setNewPositionIconId}>
                    <SelectTrigger className="w-full min-w-0 overflow-hidden">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Standard marker</SelectItem>
                      {icons.map((icon) => (
                        <SelectItem key={icon.id} value={icon.id}>
                          {icon.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Choose a position, then click the surface to place it.</p>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="show-grid">Show grid</Label>
                <Checkbox id="show-grid" checked={showGrid} onCheckedChange={(value) => setShowGrid(value === true)} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="snap-grid">Snap to grid</Label>
                <Checkbox id="snap-grid" checked={snapToGrid} onCheckedChange={(value) => setSnapToGrid(value === true)} />
              </div>
              <div>
                <Label>Marker size</Label>
                <Select value={markerSize} onValueChange={(value) => setMarkerSize(value as MarkerSize)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground">Zoom: {Math.round(zoom * 100)}%</div>
            </div>
          </CardContent>
        </Card>

        <Card className="order-1 lg:order-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Surface canvas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Use Canvas tools to choose the next position, then click the surface to place it.</p>
            <SurfaceCanvas
              backgroundUrl={backgroundUrl}
              boundary={boundary}
              gridRows={gridRows}
              gridColumns={gridColumns}
              showGrid={showGrid}
              snapToGrid={snapToGrid}
              rotation={isRotatedView ? "portrait" : "landscape"}
              zoom={zoom}
              markers={canvasMarkers}
              selectedMarkerKey={selectedPositionKey}
              markerSize={markerPixelSize}
              onCanvasClick={addPositionAt}
              onMarkerSelect={setSelectedPositionKey}
              onMarkerMove={movePositionToPlacement}
            />
          </CardContent>
        </Card>

        <Card className="order-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Inspector</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedPosition ? (
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">Selected position</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => deletePositionByKey(selectedPositionKey!)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <Label>Position name</Label>
                  <Input
                    value={selectedPosition.name}
                    onChange={(event) => updatePositionByKey(selectedPositionKey!, { name: event.target.value })}
                  />
                </div>
                <div>
                  <Label>Short code</Label>
                  <Input
                    value={selectedPosition.code}
                    onChange={(event) => updatePositionByKey(selectedPositionKey!, { code: event.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <Label>Icon</Label>
                  <Select
                    value={selectedPosition.icon_id || "__none__"}
                    onValueChange={(value) => updatePositionByKey(selectedPositionKey!, { icon_id: value === "__none__" ? null : value })}
                  >
                    <SelectTrigger className="w-full min-w-0 overflow-hidden">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Standard marker</SelectItem>
                      {icons.map((icon) => (
                        <SelectItem key={icon.id} value={icon.id}>
                          {icon.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="starting-position">Starting position</Label>
                  <Checkbox
                    id="starting-position"
                    checked={selectedPosition.is_starting_slot !== false}
                    onCheckedChange={(value) => updatePositionByKey(selectedPositionKey!, { is_starting_slot: value === true })}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-md border p-3">
                <p className="font-medium">Formation settings</p>
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div>
                  <Label>Short code</Label>
                  <Input value={code} onChange={(event) => setCode(event.target.value)} />
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
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="default-formation">Default for this owner</Label>
                  <Checkbox id="default-formation" checked={isDefault} onCheckedChange={(value) => setIsDefault(value === true)} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Optional notes for coaches using this formation."
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="font-medium">All positions</p>
            {positions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No positions placed yet.</p>
            ) : (
              positions.map((position, index) => (
                <button
                  key={getPositionKey(position, index)}
                  type="button"
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/50",
                    selectedPositionKey === getPositionKey(position, index) && "border-primary bg-primary/5",
                  )}
                  onClick={() => setSelectedPositionKey(getPositionKey(position, index))}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {icons.find((icon) => icon.id === position.icon_id)?.image_url ? (
                        <img
                          src={icons.find((icon) => icon.id === position.icon_id)?.image_url || ""}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        position.code
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{position.code}</span>
                      <span className="block truncate text-xs text-muted-foreground">{position.name}</span>
                    </span>
                  </div>
                </button>
              ))
            )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={pendingUnsavedAction !== null} onOpenChange={(open) => !open && setPendingUnsavedAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have unsaved changes. Save before leaving?</AlertDialogTitle>
            <AlertDialogDescription>
              You can keep editing, discard the changes, or save before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <Button variant="outline" onClick={confirmUnsavedAction}>Discard changes</Button>
            <AlertDialogAction onClick={(event) => {
              event.preventDefault();
              saveThenRunPendingAction();
            }}>
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

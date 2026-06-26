/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useTeamContext } from "@/contexts/TeamContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { HockeyPitch } from "@/components/lineup/HockeyPitch";
import {
  DEFAULT_BOUNDARY,
  DEFAULT_FORMATION_POSITIONS,
  type BoundaryBox,
  type FormationIconRow,
  type FormationOwnerScope,
  type FormationPositionRow,
  type FormationRow,
  formatOwnerScope,
  gridToPercent,
  normaliseBoundary,
} from "@/lib/formationPlanner";
import { cn } from "@/lib/utils";
import { EyeOff, ImagePlus, Plus, Save, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

const supabase = typedSupabase as any;

type FormationPreference = {
  formation_id: string;
  is_favourite: boolean;
  is_hidden: boolean;
};

type EditablePosition = Omit<FormationPositionRow, "id" | "formation_id" | "created_at" | "updated_at"> & {
  id?: string;
};

const OWNER_SCOPES: FormationOwnerScope[] = ["SUPER_ADMIN", "ASSOCIATION", "CLUB", "TEAM"];

export default function FormationBuilder() {
  const { user } = useAuth();
  const { isSuperAdmin, canManageAssociation, canManageClub, canManageTeam } = useAdminScope();
  const {
    selectedAssociationId,
    selectedClubId,
    selectedTeamId,
    selectedAssociation,
    selectedClub,
    selectedTeam,
  } = useTeamContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formations, setFormations] = useState<FormationRow[]>([]);
  const [icons, setIcons] = useState<FormationIconRow[]>([]);
  const [preferences, setPreferences] = useState<Record<string, FormationPreference>>({});
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

  const canUseScope = (scope: FormationOwnerScope) => {
    if (isSuperAdmin) return true;
    if (scope === "ASSOCIATION") return !!selectedAssociationId && canManageAssociation(selectedAssociationId);
    if (scope === "CLUB") return !!selectedClubId && canManageClub(selectedClubId);
    if (scope === "TEAM") return !!selectedTeamId && canManageTeam(selectedTeamId);
    return false;
  };

  const availableOwnerScopes = OWNER_SCOPES.filter(canUseScope);
  const activeFormation = formations.find((formation) => formation.id === activeFormationId) || null;

  const visibleFormations = useMemo(() => {
    return formations
      .filter((formation) => !preferences[formation.id]?.is_hidden)
      .sort((a, b) => {
        const favA = preferences[a.id]?.is_favourite ? 1 : 0;
        const favB = preferences[b.id]?.is_favourite ? 1 : 0;
        if (favA !== favB) return favB - favA;
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [formations, preferences]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user?.id]);

  useEffect(() => {
    if (activeFormationId) return;
    if (selectedTeamId && availableOwnerScopes.includes("TEAM")) {
      setOwnerScope("TEAM");
    } else if (selectedClubId && availableOwnerScopes.includes("CLUB")) {
      setOwnerScope("CLUB");
    } else if (selectedAssociationId && availableOwnerScopes.includes("ASSOCIATION")) {
      setOwnerScope("ASSOCIATION");
    } else if (availableOwnerScopes.includes("SUPER_ADMIN")) {
      setOwnerScope("SUPER_ADMIN");
    }
  }, [activeFormationId, selectedAssociationId, selectedClubId, selectedTeamId, availableOwnerScopes.join("|")]);

  const loadData = async () => {
    setLoading(true);
    const [formationsRes, iconsRes, prefsRes] = await Promise.all([
      supabase.from("formations").select("*").order("name"),
      supabase.from("formation_icons").select("*").order("is_custom").order("name"),
      supabase.from("user_formation_preferences").select("formation_id, is_favourite, is_hidden").eq("user_id", user!.id),
    ]);

    if (formationsRes.error) toast.error(formationsRes.error.message);
    if (iconsRes.error) toast.error(iconsRes.error.message);
    if (prefsRes.error) toast.error(prefsRes.error.message);

    setFormations((formationsRes.data || []) as FormationRow[]);
    setIcons((iconsRes.data || []) as FormationIconRow[]);
    setPreferences(
      ((prefsRes.data || []) as FormationPreference[]).reduce((acc, pref) => {
        acc[pref.formation_id] = pref;
        return acc;
      }, {} as Record<string, FormationPreference>),
    );
    setLoading(false);
  };

  const loadFormation = async (formation: FormationRow) => {
    setActiveFormationId(formation.id);
    setName(formation.name);
    setCode(formation.code || "");
    setDescription(formation.description || "");
    setOwnerScope(formation.owner_scope);
    setGridRows(formation.grid_rows);
    setGridColumns(formation.grid_columns);
    setIsDefault(formation.is_default);
    setBackgroundUrl(formation.background_image_url);
    setBoundary(normaliseBoundary(formation));

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

    setPositions((data || []) as EditablePosition[]);
  };

  const startNewFormation = () => {
    const seededPositions = DEFAULT_FORMATION_POSITIONS.map((position, index) => {
      const percent = gridToPercent(position.grid_x, position.grid_y, gridColumns, gridRows, DEFAULT_BOUNDARY);
      return {
        ...position,
        icon_id: null,
        x_percent: percent.x,
        y_percent: percent.y,
        sort_order: index,
        is_starting_slot: true,
      };
    });

    setActiveFormationId(null);
    setName("Standard 10");
    setCode("STD-10");
    setDescription("");
    setIsDefault(false);
    setBackgroundUrl(null);
    setBoundary(DEFAULT_BOUNDARY);
    setGridRows(10);
    setGridColumns(14);
    setPositions(seededPositions);
  };

  const ownerIdsForScope = () => ({
    association_id: ownerScope === "ASSOCIATION" ? selectedAssociationId || null : null,
    club_id: ownerScope === "CLUB" ? selectedClubId || null : null,
    team_id: ownerScope === "TEAM" ? selectedTeamId || null : null,
  });

  const saveFormation = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Add a formation name first.");
      return;
    }
    if (!canUseScope(ownerScope)) {
      toast.error("You cannot save a formation at that level.");
      return;
    }
    if (positions.length === 0) {
      toast.error("Place at least one position on the pitch.");
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      code: code.trim() || null,
      description: description.trim() || null,
      owner_scope: ownerScope,
      ...ownerIdsForScope(),
      background_image_url: backgroundUrl,
      grid_rows: gridRows,
      grid_columns: gridColumns,
      is_default: isDefault,
      pitch_boundary_x: boundary.x,
      pitch_boundary_y: boundary.y,
      pitch_boundary_width: boundary.width,
      pitch_boundary_height: boundary.height,
      created_by: user.id,
    };

    const formationRes = activeFormationId
      ? await supabase.from("formations").update(payload).eq("id", activeFormationId).select("*").single()
      : await supabase.from("formations").insert(payload).select("*").single();

    if (formationRes.error) {
      setSaving(false);
      toast.error(formationRes.error.message);
      return;
    }

    const formation = formationRes.data as FormationRow;
    await supabase.from("formation_positions").delete().eq("formation_id", formation.id);

    const positionRows = positions.map((position, index) => ({
      formation_id: formation.id,
      name: position.name.trim(),
      code: position.code.trim(),
      icon_id: position.icon_id || null,
      zone: position.zone || null,
      grid_x: position.grid_x,
      grid_y: position.grid_y,
      x_percent: position.x_percent,
      y_percent: position.y_percent,
      sort_order: index,
      is_starting_slot: position.is_starting_slot,
    }));

    const positionsRes = await supabase.from("formation_positions").insert(positionRows);
    if (positionsRes.error) {
      toast.error(positionsRes.error.message);
    } else {
      toast.success("Formation saved.");
      setActiveFormationId(formation.id);
      await loadData();
    }
    setSaving(false);
  };

  const uploadAsset = async (file: File, folder: "backgrounds" | "icons") => {
    if (!user) return null;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${user.id}/${folder}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("formation-assets").upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      return null;
    }
    const { data } = supabase.storage.from("formation-assets").getPublicUrl(path);
    return data.publicUrl as string;
  };

  const handleBackgroundUpload = async (file?: File) => {
    if (!file) return;
    const url = await uploadAsset(file, "backgrounds");
    if (url) setBackgroundUrl(url);
  };

  const handleIconUpload = async (file?: File) => {
    if (!file || !user) return;
    const url = await uploadAsset(file, "icons");
    if (!url) return;
    const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    const { data, error } = await supabase
      .from("formation_icons")
      .insert({ name, image_url: url, is_custom: true, uploaded_by: user.id })
      .select("*")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setIcons((current) => [...current, data as FormationIconRow]);
    setNewPositionIconId(data.id);
    toast.success("Icon uploaded.");
  };

  const addPositionAt = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const rawX = ((event.clientX - rect.left) / rect.width) * 100;
    const rawY = ((event.clientY - rect.top) / rect.height) * 100;
    const boundedX = Math.min(100, Math.max(0, rawX));
    const boundedY = Math.min(100, Math.max(0, rawY));
    const gridX = Math.round(((boundedX - boundary.x) / boundary.width) * gridColumns);
    const gridY = Math.round(((boundedY - boundary.y) / boundary.height) * gridRows);
    const snappedX = Math.min(gridColumns, Math.max(0, gridX));
    const snappedY = Math.min(gridRows, Math.max(0, gridY));

    if (positions.some((position) => position.grid_x === snappedX && position.grid_y === snappedY)) {
      toast.error("That grid corner already has a position.");
      return;
    }

    const percent = gridToPercent(snappedX, snappedY, gridColumns, gridRows, boundary);
    setPositions((current) => [
      ...current,
      {
        name: newPositionName.trim() || "Position",
        code: newPositionCode.trim().toUpperCase() || "POS",
        icon_id: newPositionIconId === "__none__" ? null : newPositionIconId,
        zone: null,
        grid_x: snappedX,
        grid_y: snappedY,
        x_percent: percent.x,
        y_percent: percent.y,
        sort_order: current.length,
        is_starting_slot: true,
      },
    ]);
  };

  const recalcPositions = (nextBoundary = boundary, nextColumns = gridColumns, nextRows = gridRows) => {
    setPositions((current) =>
      current.map((position) => {
        const percent = gridToPercent(position.grid_x, position.grid_y, nextColumns, nextRows, nextBoundary);
        return { ...position, x_percent: percent.x, y_percent: percent.y };
      }),
    );
  };

  const updatePreference = async (formationId: string, patch: Partial<FormationPreference>) => {
    if (!user) return;
    const current = preferences[formationId] || {
      formation_id: formationId,
      is_favourite: false,
      is_hidden: false,
    };
    const next = { ...current, ...patch };
    setPreferences((prefs) => ({ ...prefs, [formationId]: next }));
    const { error } = await supabase.from("user_formation_preferences").upsert(
      {
        user_id: user.id,
        formation_id: formationId,
        is_favourite: next.is_favourite,
        is_hidden: next.is_hidden,
      },
      { onConflict: "user_id,formation_id" },
    );
    if (error) toast.error(error.message);
  };

  const ownerLabel = (formation: FormationRow) => {
    if (formation.owner_scope === "ASSOCIATION") return selectedAssociation?.name || "Association";
    if (formation.owner_scope === "CLUB") return selectedClub?.name || "Club";
    if (formation.owner_scope === "TEAM") return selectedTeam?.name || "Team";
    return "Global";
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading formation builder...</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Formation Builder</h1>
          <p className="text-sm text-muted-foreground">Create reusable pitch templates for fixture line-ups.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={startNewFormation}>
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
          <Button onClick={saveFormation} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleFormations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visible formations yet.</p>
            ) : (
              visibleFormations.map((formation) => {
                const pref = preferences[formation.id];
                return (
                  <div
                    key={formation.id}
                    className={cn(
                      "rounded-md border p-3 text-left transition-colors",
                      activeFormationId === formation.id ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                    )}
                  >
                    <button className="w-full text-left" onClick={() => loadFormation(formation)}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{formation.name}</p>
                        {formation.is_default && <Badge variant="secondary">Default</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatOwnerScope(formation.owner_scope)} - {ownerLabel(formation)}
                      </p>
                    </button>
                    <div className="mt-2 flex gap-1">
                      <Button
                        variant={pref?.is_favourite ? "default" : "outline"}
                        size="sm"
                        onClick={() => updatePreference(formation.id, { is_favourite: !pref?.is_favourite })}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updatePreference(formation.id, { is_hidden: true })}
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pitch Layout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
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
            </div>

            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional notes for coaches using this formation."
            />

            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label>Rows</Label>
                <Input
                  type="number"
                  min={4}
                  max={40}
                  value={gridRows}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setGridRows(next);
                    recalcPositions(boundary, gridColumns, next);
                  }}
                />
              </div>
              <div>
                <Label>Columns</Label>
                <Input
                  type="number"
                  min={4}
                  max={60}
                  value={gridColumns}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setGridColumns(next);
                    recalcPositions(boundary, next, gridRows);
                  }}
                />
              </div>
              <div className="flex items-end gap-2">
                <Checkbox checked={isDefault} onCheckedChange={(value) => setIsDefault(value === true)} />
                <Label className="pb-0.5">Default for this owner</Label>
              </div>
              <div>
                <Label htmlFor="pitch-upload">Pitch image</Label>
                <Input id="pitch-upload" type="file" accept="image/*" onChange={(event) => handleBackgroundUpload(event.target.files?.[0])} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {[
                ["X", "x"],
                ["Y", "y"],
                ["Width", "width"],
                ["Height", "height"],
              ].map(([label, key]) => (
                <div key={key}>
                  <div className="flex justify-between">
                    <Label>{label}</Label>
                    <span className="text-xs text-muted-foreground">{Math.round(boundary[key as keyof BoundaryBox])}%</span>
                  </div>
                  <Slider
                    value={[boundary[key as keyof BoundaryBox]]}
                    min={0}
                    max={key === "width" || key === "height" ? 100 : 80}
                    step={1}
                    onValueChange={([value]) => {
                      const next = { ...boundary, [key]: value };
                      next.width = Math.min(next.width, 100 - next.x);
                      next.height = Math.min(next.height, 100 - next.y);
                      setBoundary(next);
                      recalcPositions(next);
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_120px_170px]">
              <div>
                <Label>New position name</Label>
                <Input value={newPositionName} onChange={(event) => setNewPositionName(event.target.value)} />
              </div>
              <div>
                <Label>Code</Label>
                <Input value={newPositionCode} onChange={(event) => setNewPositionCode(event.target.value.toUpperCase())} />
              </div>
              <div>
                <Label>Icon</Label>
                <Select value={newPositionIconId} onValueChange={setNewPositionIconId}>
                  <SelectTrigger>
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

            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="icon-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <ImagePlus className="h-4 w-4" />
                Upload custom icon
              </Label>
              <Input id="icon-upload" type="file" accept="image/*" className="hidden" onChange={(event) => handleIconUpload(event.target.files?.[0])} />
              <span className="text-xs text-muted-foreground">Click the pitch to place the next position on the nearest grid corner.</span>
            </div>

            <div className="relative" onClick={addPositionAt}>
              <HockeyPitch backgroundUrl={backgroundUrl}>
                <div
                  className="absolute border-2 border-primary/80 bg-primary/5"
                  style={{
                    left: `${boundary.x}%`,
                    top: `${boundary.y}%`,
                    width: `${boundary.width}%`,
                    height: `${boundary.height}%`,
                  }}
                >
                  {Array.from({ length: gridColumns + 1 }).map((_, index) => (
                    <span
                      key={`x-${index}`}
                      className="absolute top-0 h-full border-l border-white/20"
                      style={{ left: `${(index / gridColumns) * 100}%` }}
                    />
                  ))}
                  {Array.from({ length: gridRows + 1 }).map((_, index) => (
                    <span
                      key={`y-${index}`}
                      className="absolute left-0 w-full border-t border-white/20"
                      style={{ top: `${(index / gridRows) * 100}%` }}
                    />
                  ))}
                </div>
                {positions.map((position, index) => {
                  const icon = icons.find((item) => item.id === position.icon_id);
                  return (
                    <button
                      key={`${position.code}-${index}`}
                      type="button"
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground shadow-lg border-2 border-white"
                      style={{ left: `${position.x_percent}%`, top: `${position.y_percent}%` }}
                      onClick={(event) => event.stopPropagation()}
                      title={position.name}
                    >
                      {icon?.image_url ? (
                        <img src={icon.image_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center text-xs font-bold">{position.code}</span>
                      )}
                      <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded bg-background/90 px-1 text-[10px] font-semibold text-foreground">
                        {position.code}
                      </span>
                    </button>
                  );
                })}
              </HockeyPitch>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Positions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {positions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No positions placed yet.</p>
            ) : (
              positions.map((position, index) => (
                <div key={`${position.code}-${index}`} className="rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={position.code}
                      className="w-20"
                      onChange={(event) =>
                        setPositions((current) =>
                          current.map((item, i) => (i === index ? { ...item, code: event.target.value.toUpperCase() } : item)),
                        )
                      }
                    />
                    <Input
                      value={position.name}
                      onChange={(event) =>
                        setPositions((current) => current.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setPositions((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Grid {position.grid_x}, {position.grid_y}
                    </span>
                    <span>
                      {Math.round(position.x_percent)}%, {Math.round(position.y_percent)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

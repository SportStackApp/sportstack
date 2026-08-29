export type FormationOwnerScope = "SUPER_ADMIN" | "ASSOCIATION" | "CLUB" | "TEAM";

export type FieldTemplateRow = {
  id: string;
  name: string;
  code: string | null;
  sport: string;
  owner_scope: FormationOwnerScope;
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
  background_image_url: string | null;
  grid_rows: number;
  grid_columns: number;
  pitch_boundary_x?: number;
  pitch_boundary_y?: number;
  pitch_boundary_width?: number;
  pitch_boundary_height?: number;
  default_icon_id: string | null;
  position_icon_size: number;
  is_active: boolean;
  created_by: string | null;
};

export type FormationRow = {
  id: string;
  name: string;
  code: string | null;
  description?: string | null;
  owner_scope: FormationOwnerScope;
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
  background_image_url: string | null;
  grid_rows: number;
  grid_columns: number;
  is_default: boolean;
  pitch_boundary_x?: number;
  pitch_boundary_y?: number;
  pitch_boundary_width?: number;
  pitch_boundary_height?: number;
  field_template_id?: string | null;
  position_icon_size?: number | null;
  field_templates?: FieldTemplateRow | FieldTemplateRow[] | null;
  created_by: string | null;
};

export type FormationPositionRow = {
  id: string;
  formation_id: string;
  name: string;
  code: string;
  icon_id: string | null;
  zone: string | null;
  grid_x: number;
  grid_y: number;
  x_percent: number;
  y_percent: number;
  sort_order: number;
  is_starting_slot: boolean;
  position_area?: "DEFENDER" | "MIDFIELDER" | "ATTACKER" | "GOALKEEPER" | null;
  position_side?: "LEFT" | "CENTRE" | "RIGHT" | null;
};

export type FormationIconRow = {
  id: string;
  name: string;
  image_url: string | null;
  lucide_icon: string | null;
  is_custom: boolean;
  uploaded_by?: string | null;
};

export type BoundaryBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DEFAULT_BOUNDARY: BoundaryBox = {
  x: 6,
  y: 8,
  width: 88,
  height: 84,
};

export const DEFAULT_POSITION_ICON_SIZE = 40;

export const DEFAULT_FORMATION_POSITIONS = [
  { code: "GK", name: "Goalkeeper", grid_x: 1, grid_y: 5, zone: "goalkeeper" },
  { code: "LB", name: "Left Back", grid_x: 4, grid_y: 2, zone: "defence" },
  { code: "CB", name: "Centre Back", grid_x: 3, grid_y: 5, zone: "defence" },
  { code: "RB", name: "Right Back", grid_x: 4, grid_y: 8, zone: "defence" },
  { code: "LH", name: "Left Half", grid_x: 7, grid_y: 2, zone: "midfield" },
  { code: "CH", name: "Centre Half", grid_x: 7, grid_y: 5, zone: "midfield" },
  { code: "RH", name: "Right Half", grid_x: 7, grid_y: 8, zone: "midfield" },
  { code: "LW", name: "Left Wing", grid_x: 11, grid_y: 1, zone: "attack" },
  { code: "CF", name: "Centre Forward", grid_x: 12, grid_y: 5, zone: "attack" },
  { code: "RW", name: "Right Wing", grid_x: 11, grid_y: 9, zone: "attack" },
];

export function gridToPercent(
  gridX: number,
  gridY: number,
  gridColumns: number,
  gridRows: number,
  boundary: BoundaryBox,
) {
  const safeColumns = Math.max(1, gridColumns);
  const safeRows = Math.max(1, gridRows);

  return {
    x: Number((boundary.x + (gridX / safeColumns) * boundary.width).toFixed(3)),
    y: Number((boundary.y + (gridY / safeRows) * boundary.height).toFixed(3)),
  };
}

type FieldSourceLike = Partial<Pick<
  FormationRow | FieldTemplateRow,
  "pitch_boundary_x" | "pitch_boundary_y" | "pitch_boundary_width" | "pitch_boundary_height"
>>;

export type FormationFieldSource = FieldSourceLike & {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  background_image_url?: string | null;
  grid_rows?: number | null;
  grid_columns?: number | null;
  default_icon_id?: string | null;
  position_icon_size?: number | null;
};

function getLinkedFieldTemplate(formation?: Partial<FormationRow> | null) {
  const fieldTemplate = formation?.field_templates;
  if (Array.isArray(fieldTemplate)) return fieldTemplate[0] || null;
  return fieldTemplate || null;
}

export function getFieldTemplateFallbackFromFormation(formation: Partial<FormationRow>): FormationFieldSource {
  return {
    id: formation.field_template_id || formation.id || null,
    name: formation.name || null,
    code: formation.code || null,
    background_image_url: formation.background_image_url || null,
    grid_rows: formation.grid_rows ?? 10,
    grid_columns: formation.grid_columns ?? 14,
    pitch_boundary_x: formation.pitch_boundary_x ?? DEFAULT_BOUNDARY.x,
    pitch_boundary_y: formation.pitch_boundary_y ?? DEFAULT_BOUNDARY.y,
    pitch_boundary_width: formation.pitch_boundary_width ?? DEFAULT_BOUNDARY.width,
    pitch_boundary_height: formation.pitch_boundary_height ?? DEFAULT_BOUNDARY.height,
    default_icon_id: null,
    position_icon_size: formation.position_icon_size ?? DEFAULT_POSITION_ICON_SIZE,
  };
}

export function getFormationFieldSource(formation?: Partial<FormationRow> | null): FormationFieldSource {
  if (!formation) return getFieldTemplateFallbackFromFormation({});
  return getLinkedFieldTemplate(formation) || getFieldTemplateFallbackFromFormation(formation);
}

export function normaliseBoundary(row?: FieldSourceLike | null): BoundaryBox {
  return {
    x: Number(row?.pitch_boundary_x ?? DEFAULT_BOUNDARY.x),
    y: Number(row?.pitch_boundary_y ?? DEFAULT_BOUNDARY.y),
    width: Number(row?.pitch_boundary_width ?? DEFAULT_BOUNDARY.width),
    height: Number(row?.pitch_boundary_height ?? DEFAULT_BOUNDARY.height),
  };
}

export function formatOwnerScope(scope: FormationOwnerScope) {
  switch (scope) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "ASSOCIATION":
      return "Association";
    case "CLUB":
      return "Club";
    case "TEAM":
      return "Team";
    default:
      return scope;
  }
}

export function preferenceScore(value?: number | null) {
  if (value == null) return 0;
  // Current coaching screen stores 1 as strongest preference and 4 as weakest.
  return Math.max(0, 5 - value);
}

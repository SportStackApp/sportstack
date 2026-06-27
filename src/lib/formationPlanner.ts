export type FormationOwnerScope = "SUPER_ADMIN" | "ASSOCIATION" | "CLUB" | "TEAM";

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
};

export type FormationIconRow = {
  id: string;
  name: string;
  image_url: string | null;
  lucide_icon: string | null;
  is_custom: boolean;
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

export function normaliseBoundary(row?: Partial<FormationRow> | null): BoundaryBox {
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

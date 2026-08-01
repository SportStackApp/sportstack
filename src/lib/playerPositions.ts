export type CanonicalPositionGroup = "GOALKEEPER" | "DEFENCE" | "MIDFIELD" | "FORWARD";

export const canonicalPositionLabels: Record<CanonicalPositionGroup, string> = {
  GOALKEEPER: "Goalkeepers",
  DEFENCE: "Defence / Backs",
  MIDFIELD: "Midfielders",
  FORWARD: "Forwards / Strikers",
};

const aliases: Record<CanonicalPositionGroup, string[]> = {
  GOALKEEPER: ["goalkeeper", "goalie", "keeper", "gk"],
  DEFENCE: ["defence", "defender", "back", "fullback", "halfback", "left half", "right half", "sweeper"],
  MIDFIELD: ["midfield", "midfielder", "centre half", "center half", "inside", "left inside", "right inside"],
  FORWARD: ["forward", "striker", "wing", "left wing", "right wing", "centre forward", "center forward"],
};

/** Maps local position labels to the shared SportStack position groups. */
export const getCanonicalPositionGroup = (position: string | null | undefined): CanonicalPositionGroup | null => {
  if (!position) return null;
  const normalised = position.trim().toLowerCase();
  return (Object.entries(aliases) as [CanonicalPositionGroup, string[]][]).find(([, values]) =>
    values.some((value) => normalised === value || normalised.includes(value)),
  )?.[0] || null;
};

export const membershipPriority: Record<string, number> = {
  PRIMARY: 3,
  SECONDARY: 2,
  FILL_IN: 1,
};

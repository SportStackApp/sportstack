export type HockeyPositionArea = "DEFENDER" | "MIDFIELDER" | "ATTACKER" | "GOALKEEPER";
export type HockeyPositionSide = "LEFT" | "CENTRE" | "RIGHT";

export const HOCKEY_POSITION_AREAS: ReadonlyArray<{ value: HockeyPositionArea; label: string }> = [
  { value: "DEFENDER", label: "Defender" },
  { value: "MIDFIELDER", label: "Midfielder" },
  { value: "ATTACKER", label: "Attacker" },
  { value: "GOALKEEPER", label: "Goalkeeper" },
];

export const HOCKEY_POSITION_SIDES: ReadonlyArray<{ value: HockeyPositionSide; label: string }> = [
  { value: "LEFT", label: "Left" },
  { value: "CENTRE", label: "Centre" },
  { value: "RIGHT", label: "Right" },
];

export const areaPositionCode = (area: HockeyPositionArea) => `AREA_${area}`;
export const sidePositionCode = (side: HockeyPositionSide) => `SIDE_${side}`;
export const combinedPositionCode = (area: Exclude<HockeyPositionArea, "GOALKEEPER">, side: HockeyPositionSide) => `POSITION_${area}_${side}`;

export type HockeyPositionChoice = {
  code: string;
  label: string;
  area: HockeyPositionArea | null;
  side: HockeyPositionSide | null;
  canonicalGroup: "GOALKEEPER" | "DEFENCE" | "MIDFIELD" | "FORWARD" | null;
};

const canonicalGroupByArea: Record<HockeyPositionArea, HockeyPositionChoice["canonicalGroup"]> = {
  DEFENDER: "DEFENCE",
  MIDFIELDER: "MIDFIELD",
  ATTACKER: "FORWARD",
  GOALKEEPER: "GOALKEEPER",
};

const outfieldAreas = HOCKEY_POSITION_AREAS.filter(
  (position): position is { value: Exclude<HockeyPositionArea, "GOALKEEPER">; label: string } => position.value !== "GOALKEEPER",
);

export const HOCKEY_POSITION_CHOICES: ReadonlyArray<HockeyPositionChoice> = [
  ...outfieldAreas.flatMap((area) => [
    {
      code: areaPositionCode(area.value),
      label: area.label,
      area: area.value,
      side: null,
      canonicalGroup: canonicalGroupByArea[area.value],
    },
    ...HOCKEY_POSITION_SIDES.map((side) => ({
      code: combinedPositionCode(area.value, side.value),
      label: `${area.label} - ${side.label}`,
      area: area.value,
      side: side.value,
      canonicalGroup: canonicalGroupByArea[area.value],
    })),
  ]),
  {
    code: areaPositionCode("GOALKEEPER"),
    label: "Goalkeeper",
    area: "GOALKEEPER",
    side: null,
    canonicalGroup: "GOALKEEPER",
  },
  ...HOCKEY_POSITION_SIDES.map((side) => ({
    code: sidePositionCode(side.value),
    label: `${side.label} side - any area`,
    area: null,
    side: side.value,
    canonicalGroup: null,
  })),
];

export const hockeyPositionChoiceFromCode = (code: string): HockeyPositionChoice | undefined =>
  HOCKEY_POSITION_CHOICES.find((choice) => choice.code === code);

export function describeHockeyPosition(area?: HockeyPositionArea | null, side?: HockeyPositionSide | null): string {
  if (area === "GOALKEEPER") return "Goalkeeper";
  const areaLabel = HOCKEY_POSITION_AREAS.find((option) => option.value === area)?.label;
  const sideLabel = HOCKEY_POSITION_SIDES.find((option) => option.value === side)?.label;
  if (areaLabel && sideLabel) return `${areaLabel} - ${sideLabel}`;
  return areaLabel || sideLabel || "No position set";
}

export function inferHockeyPosition(label: string, code = ""): {
  area: HockeyPositionArea | null;
  side: HockeyPositionSide | null;
} {
  const value = `${label} ${code}`.trim().toLowerCase();
  const area: HockeyPositionArea | null = /(goalkeeper|goalie|keeper|\bgk\b)/.test(value)
    ? "GOALKEEPER"
    : /(defen|back|sweeper)/.test(value)
      ? "DEFENDER"
      : /(mid|half|inside)/.test(value)
        ? "MIDFIELDER"
        : /(attack|forward|striker|wing)/.test(value)
          ? "ATTACKER"
          : null;
  if (area === "GOALKEEPER") return { area, side: null };
  const side: HockeyPositionSide | null = /(^|\s)(left|lb|lh|li|lw|lf)(\s|$)/.test(value)
    ? "LEFT"
    : /(^|\s)(right|rb|rh|ri|rw|rf)(\s|$)/.test(value)
      ? "RIGHT"
      : /(^|\s)(centre|center|cb|ch|ci|cm|cf)(\s|$)/.test(value)
        ? "CENTRE"
        : null;
  return { area, side };
}

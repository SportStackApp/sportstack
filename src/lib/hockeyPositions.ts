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

export function describeHockeyPosition(area?: HockeyPositionArea | null, side?: HockeyPositionSide | null): string {
  if (area === "GOALKEEPER") return "Goalkeeper";
  const areaLabel = HOCKEY_POSITION_AREAS.find((option) => option.value === area)?.label;
  const sideLabel = HOCKEY_POSITION_SIDES.find((option) => option.value === side)?.label;
  return [sideLabel, areaLabel].filter(Boolean).join(" ") || "No position set";
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

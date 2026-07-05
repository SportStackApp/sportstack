import { cn } from "@/lib/utils";
import fieldBg from "@/assets/Field_2.png";

interface HockeyPitchProps {
  children: React.ReactNode;
  className?: string;
  backgroundUrl?: string | null;
  orientation?: "landscape" | "portrait";
}

// Field dimensions within the SVG viewBox (0 0 1000 620)
const PADDING = 50;
const FIELD_X = PADDING;
const FIELD_Y = PADDING;
const FIELD_W = 1000 - PADDING * 2; // 900
const FIELD_H = 620 - PADDING * 2;  // 520
const FIELD_R = FIELD_X + FIELD_W;
const FIELD_B = FIELD_Y + FIELD_H;
const CENTER_X_LINE = FIELD_X + FIELD_W / 2;
const LINE_23_LEFT = FIELD_X + FIELD_W * 0.25;
const LINE_23_RIGHT = FIELD_X + FIELD_W * 0.75;
const MID_Y = FIELD_Y + FIELD_H / 2;

// D-arc radius
const D_RADIUS = 100;
// Dotted arc radius (wider)
const DOT_ARC_RADIUS = 130;

// Goal dimensions
const GOAL_W = 20;
const GOAL_H = 40;

export const HockeyPitch = ({ children, className, backgroundUrl, orientation = "landscape" }: HockeyPitchProps) => {
  // Build tick marks along all four sides
  const ticks: React.ReactNode[] = [];
  const TICK_LEN = 6;
  const TICK_SPACING = 30;

  // Top & bottom sidelines (horizontal ticks)
  for (let x = FIELD_X + TICK_SPACING; x < FIELD_R; x += TICK_SPACING) {
    ticks.push(
      <line key={`tt-${x}`} x1={x} y1={FIELD_Y} x2={x} y2={FIELD_Y - TICK_LEN} stroke="white" strokeWidth="1.5" />,
      <line key={`tb-${x}`} x1={x} y1={FIELD_B} x2={x} y2={FIELD_B + TICK_LEN} stroke="white" strokeWidth="1.5" />
    );
  }
  // Left & right endlines (vertical ticks)
  for (let y = FIELD_Y + TICK_SPACING; y < FIELD_B; y += TICK_SPACING) {
    ticks.push(
      <line key={`tl-${y}`} x1={FIELD_X} y1={y} x2={FIELD_X - TICK_LEN} y2={y} stroke="white" strokeWidth="1.5" />,
      <line key={`tr-${y}`} x1={FIELD_R} y1={y} x2={FIELD_R + TICK_LEN} y2={y} stroke="white" strokeWidth="1.5" />
    );
  }

  // D-arc paths (semicircles bulging inward from each endline)
  // Left D: arc from (FIELD_X, MID_Y - D_RADIUS) to (FIELD_X, MID_Y + D_RADIUS) bulging right
  const leftD = `M ${FIELD_X} ${MID_Y - D_RADIUS} A ${D_RADIUS} ${D_RADIUS} 0 0 1 ${FIELD_X} ${MID_Y + D_RADIUS}`;
  // Right D: arc from (FIELD_R, MID_Y - D_RADIUS) to (FIELD_R, MID_Y + D_RADIUS) bulging left
  const rightD = `M ${FIELD_R} ${MID_Y - D_RADIUS} A ${D_RADIUS} ${D_RADIUS} 0 0 0 ${FIELD_R} ${MID_Y + D_RADIUS}`;

  // Dotted arcs (wider radius, outside the D)
  const leftDotArc = `M ${FIELD_X} ${MID_Y - DOT_ARC_RADIUS} A ${DOT_ARC_RADIUS} ${DOT_ARC_RADIUS} 0 0 1 ${FIELD_X} ${MID_Y + DOT_ARC_RADIUS}`;
  const rightDotArc = `M ${FIELD_R} ${MID_Y - DOT_ARC_RADIUS} A ${DOT_ARC_RADIUS} ${DOT_ARC_RADIUS} 0 0 0 ${FIELD_R} ${MID_Y + DOT_ARC_RADIUS}`;

  // Penalty spot positions
  const penSpotOffset = 50;

  return (
    <div
      className={cn(
        "relative w-full mx-auto rounded-xl overflow-hidden",
        className
      )}
      style={{ aspectRatio: orientation === "portrait" ? "620 / 1000" : "1000 / 620" }}
    >
      {/* Field background image */}
      <img
        src={backgroundUrl || fieldBg}
        alt="Playing surface"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Players overlay */}
      <div className="absolute inset-0">
        {children}
      </div>
    </div>
  );
};

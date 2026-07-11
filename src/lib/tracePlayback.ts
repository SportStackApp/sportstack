export interface TracePoint {
  timeMs: number;
  x: number;
  y: number;
  speedMps: number;
  heartRate?: number;
}

export interface TraceEvent {
  timeMs: number;
  type: "Hit" | "Trap" | "Sprint";
  confidence: number;
  x: number;
  y: number;
}

export interface TraceSummary {
  durationMs: number;
  distanceM: number;
  averageSpeedMps: number;
  topSpeedMps: number;
  averageHeartRate: number | null;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseNumber = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const splitCsvLine = (line: string) =>
  line
    .split(",")
    .map((cell) => cell.trim().replace(/^"|"$/g, ""));

export const parseTraceCsv = (csv: string): TracePoint[] => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const indexOf = (...aliases: string[]) => aliases.map((alias) => headers.indexOf(alias)).find((index) => index !== -1) ?? -1;

  const timeIndex = indexOf("time", "timestamp", "seconds", "seconds_elapsed", "time_ms");
  const xIndex = indexOf("x", "pitch_x", "longitude", "lng", "lon");
  const yIndex = indexOf("y", "pitch_y", "latitude", "lat");
  const speedIndex = indexOf("speed", "speed_mps", "speedmps");
  const heartRateIndex = indexOf("heart_rate", "heartrate", "hr", "bpm");

  if (xIndex === -1 || yIndex === -1) return [];

  const rawRows = lines.slice(1).map((line, rowIndex) => {
    const cells = splitCsvLine(line);
    const rawTime = parseNumber(cells[timeIndex]);
    const x = parseNumber(cells[xIndex]);
    const y = parseNumber(cells[yIndex]);
    const speed = parseNumber(cells[speedIndex]);
    const heartRate = parseNumber(cells[heartRateIndex]);

    if (x === null || y === null) return null;

    return {
      timeMs: rawTime !== null ? (rawTime > 100000 ? rawTime : rawTime * 1000) : rowIndex * 1000,
      x,
      y,
      speedMps: speed ?? 0,
      heartRate: heartRate ?? undefined,
    };
  }).filter((row): row is TracePoint => Boolean(row));

  return normaliseTracePoints(rawRows);
};

export const normaliseTracePoints = (points: TracePoint[]) => {
  if (points.length === 0) return [];

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const xRange = Math.max(maxX - minX, 0.000001);
  const yRange = Math.max(maxY - minY, 0.000001);

  return points
    .slice()
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((point, index, sorted) => {
      const previous = sorted[index - 1];
      const next = sorted[index + 1];
      const fallbackSpeed = previous
        ? Math.hypot(point.x - previous.x, point.y - previous.y) / Math.max((point.timeMs - previous.timeMs) / 1000, 1)
        : next
        ? Math.hypot(next.x - point.x, next.y - point.y) / Math.max((next.timeMs - point.timeMs) / 1000, 1)
        : 0;

      return {
        ...point,
        x: clamp(((point.x - minX) / xRange) * 88 + 6, 6, 94),
        y: clamp(100 - (((point.y - minY) / yRange) * 88 + 6), 6, 94),
        speedMps: point.speedMps || fallbackSpeed,
      };
    });
};

export const buildDemoTrace = (): TracePoint[] =>
  normaliseTracePoints(
    Array.from({ length: 72 }, (_, index) => {
      const angle = (index / 72) * Math.PI * 2;
      const drift = Math.sin(index / 5) * 9;
      return {
        timeMs: index * 5000,
        x: Math.cos(angle) * 42 + drift,
        y: Math.sin(angle * 1.3) * 26 + Math.cos(index / 9) * 6,
        speedMps: 2.2 + Math.abs(Math.sin(index / 6)) * 4.5,
        heartRate: Math.round(122 + Math.abs(Math.sin(index / 7)) * 48),
      };
    }),
  );

export const detectTraceEvents = (points: TracePoint[]): TraceEvent[] =>
  points
    .filter((point, index) => index > 0 && index % 5 === 0)
    .map((point, index) => {
      const isSprint = point.speedMps >= 5.8;
      const isHit = index % 3 === 0;
      return {
        timeMs: point.timeMs,
        type: isSprint ? "Sprint" : isHit ? "Hit" : "Trap",
        confidence: clamp(Math.round(62 + point.speedMps * 6 + (isHit ? 8 : 0)), 58, 96),
        x: point.x,
        y: point.y,
      };
    });

export const summariseTrace = (points: TracePoint[]): TraceSummary => {
  if (points.length === 0) {
    return { durationMs: 0, distanceM: 0, averageSpeedMps: 0, topSpeedMps: 0, averageHeartRate: null };
  }

  const distanceM = points.reduce((total, point, index) => {
    const previous = points[index - 1];
    if (!previous) return total;
    return total + Math.hypot(point.x - previous.x, point.y - previous.y) * 1.05;
  }, 0);
  const speeds = points.map((point) => point.speedMps).filter((speed) => Number.isFinite(speed));
  const heartRates = points.map((point) => point.heartRate).filter((value): value is number => typeof value === "number");

  return {
    durationMs: points[points.length - 1].timeMs - points[0].timeMs,
    distanceM,
    averageSpeedMps: speeds.length ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length : 0,
    topSpeedMps: speeds.length ? Math.max(...speeds) : 0,
    averageHeartRate: heartRates.length ? Math.round(heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length) : null,
  };
};

export const formatTraceTime = (timeMs: number) => {
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

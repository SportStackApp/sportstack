export type TraceFileKind =
  | "metadata"
  | "heartRate"
  | "pedometer"
  | "activity"
  | "phoneGps"
  | "watchGps"
  | "wristMotion"
  | "unsupported";

export type TraceGpsSource = "phone" | "watch";
export type TraceGpsQuality = "good" | "fair" | "poor" | "unknown" | "none";
export type TraceFileStatus = "loaded" | "unused" | "error";

export interface TraceMetadata {
  version: string | null;
  deviceName: string | null;
  recordingTime: string | null;
  recordingTimezone: string | null;
  platform: string | null;
  appVersion: string | null;
}

export interface TraceHeartRatePoint {
  seconds: number;
  bpm: number;
}

export interface TraceStepPoint {
  seconds: number;
  steps: number;
}

export interface TraceActivityPoint {
  seconds: number;
  activity: string;
}

export interface TraceGpsPoint {
  seconds: number;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  speedMps: number | null;
  accuracyM: number | null;
}

export interface TraceMovementBucket {
  seconds: number;
  meanAcceleration: number;
  peakAcceleration: number;
  meanRotation: number;
  peakRotation: number;
  samples: number;
}

export interface TraceFileReport {
  fileName: string;
  kind: TraceFileKind;
  status: TraceFileStatus;
  rows: number;
  outputRows: number;
  skippedRows: number;
  preRollRows: number;
  sizeBytes: number;
  durationSeconds: number | null;
  note: string;
}

export interface ParsedTraceFile {
  kind: TraceFileKind;
  report: TraceFileReport;
  metadata?: TraceMetadata;
  heartRate?: TraceHeartRatePoint[];
  steps?: TraceStepPoint[];
  activity?: TraceActivityPoint[];
  gps?: TraceGpsPoint[];
  movement?: TraceMovementBucket[];
}

export interface TraceDataset {
  metadata: TraceMetadata | null;
  heartRate: TraceHeartRatePoint[];
  steps: TraceStepPoint[];
  activity: TraceActivityPoint[];
  phoneGps: TraceGpsPoint[];
  watchGps: TraceGpsPoint[];
  movement: TraceMovementBucket[];
  reports: TraceFileReport[];
}

export interface TraceWorkerProgress {
  fileName: string;
  processedBytes: number;
  totalBytes: number;
  percent: number;
}

export type TraceWorkerResponse =
  | { type: "start"; fileName: string; totalBytes: number }
  | { type: "progress"; progress: TraceWorkerProgress }
  | { type: "parsed"; result: ParsedTraceFile }
  | { type: "complete" };

export interface TraceGpsSummary {
  samples: number;
  durationSeconds: number;
  distanceM: number;
  topSpeedMps: number;
  medianAccuracyM: number | null;
  quality: TraceGpsQuality;
}

export interface TraceSessionSummary {
  durationSeconds: number;
  distanceM: number;
  topSpeedMps: number;
  steps: number | null;
  averageHeartRate: number | null;
  maximumHeartRate: number | null;
  movementLoad: number | null;
}

export interface TraceOverviewPoint {
  seconds: number;
  heartRate: number | null;
  movement: number | null;
  steps: number | null;
  activity: string | null;
}

export interface TraceMovementPeak {
  seconds: number;
  acceleration: number;
  rotation: number;
}

export interface NormalisedGpsPoint extends TraceGpsPoint {
  x: number;
  y: number;
}

export const createEmptyTraceDataset = (): TraceDataset => ({
  metadata: null,
  heartRate: [],
  steps: [],
  activity: [],
  phoneGps: [],
  watchGps: [],
  movement: [],
  reports: [],
});

export const traceFileLabel = (kind: TraceFileKind) => {
  const labels: Record<TraceFileKind, string> = {
    metadata: "Session metadata",
    heartRate: "Watch heart rate",
    pedometer: "Phone steps",
    activity: "Phone activity",
    phoneGps: "Phone GPS",
    watchGps: "Watch GPS",
    wristMotion: "Watch wrist movement",
    unsupported: "Not used",
  };
  return labels[kind];
};

export const mergeParsedTraceFile = (current: TraceDataset, parsed: ParsedTraceFile): TraceDataset => {
  const reportMatches = (report: TraceFileReport) =>
    parsed.kind === "unsupported"
      ? report.kind === parsed.kind && report.fileName.toLowerCase() === parsed.report.fileName.toLowerCase()
      : report.kind === parsed.kind;

  const next: TraceDataset = {
    ...current,
    reports: [...current.reports.filter((report) => !reportMatches(report)), parsed.report],
  };

  if (parsed.report.status !== "loaded") return next;

  switch (parsed.kind) {
    case "metadata":
      return { ...next, metadata: parsed.metadata ?? null };
    case "heartRate":
      return { ...next, heartRate: parsed.heartRate ?? [] };
    case "pedometer":
      return { ...next, steps: parsed.steps ?? [] };
    case "activity":
      return { ...next, activity: parsed.activity ?? [] };
    case "phoneGps":
      return { ...next, phoneGps: parsed.gps ?? [] };
    case "watchGps":
      return { ...next, watchGps: parsed.gps ?? [] };
    case "wristMotion":
      return { ...next, movement: parsed.movement ?? [] };
    case "unsupported":
      return next;
  }
};

const lastSeconds = (rows: Array<{ seconds: number }>) => rows.at(-1)?.seconds ?? 0;

export const getTraceDurationSeconds = (dataset: TraceDataset) =>
  Math.max(
    lastSeconds(dataset.heartRate),
    lastSeconds(dataset.steps),
    lastSeconds(dataset.activity),
    lastSeconds(dataset.phoneGps),
    lastSeconds(dataset.watchGps),
    lastSeconds(dataset.movement),
    0,
  );

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistance = (left: TraceGpsPoint, right: TraceGpsPoint) => {
  const earthRadiusM = 6_371_000;
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const latitudeDelta = rightLatitude - leftLatitude;
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const median = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

export const getGpsSummary = (points: TraceGpsPoint[]): TraceGpsSummary => {
  if (points.length === 0) {
    return {
      samples: 0,
      durationSeconds: 0,
      distanceM: 0,
      topSpeedMps: 0,
      medianAccuracyM: null,
      quality: "none",
    };
  }

  let distanceM = 0;
  let derivedTopSpeedMps = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const secondsDelta = current.seconds - previous.seconds;
    if (secondsDelta <= 0 || secondsDelta > 15) continue;
    const segmentDistance = haversineDistance(previous, current);
    distanceM += segmentDistance;
    derivedTopSpeedMps = Math.max(derivedTopSpeedMps, segmentDistance / secondsDelta);
  }

  const reportedSpeeds = points
    .map((point) => point.speedMps)
    .filter((speed): speed is number => typeof speed === "number" && speed >= 0);
  const accuracies = points
    .map((point) => point.accuracyM)
    .filter((accuracy): accuracy is number => typeof accuracy === "number" && accuracy >= 0);
  const medianAccuracyM = median(accuracies);
  const quality: TraceGpsQuality =
    medianAccuracyM === null
      ? "unknown"
      : medianAccuracyM <= 10
        ? "good"
        : medianAccuracyM <= 25
          ? "fair"
          : "poor";

  return {
    samples: points.length,
    durationSeconds: Math.max(0, lastSeconds(points) - (points[0]?.seconds ?? 0)),
    distanceM,
    topSpeedMps: reportedSpeeds.length > 0 ? Math.max(...reportedSpeeds) : derivedTopSpeedMps,
    medianAccuracyM,
    quality,
  };
};

export const getTraceSummary = (dataset: TraceDataset, source: TraceGpsSource): TraceSessionSummary => {
  const gpsSummary = getGpsSummary(source === "phone" ? dataset.phoneGps : dataset.watchGps);
  const heartRates = dataset.heartRate.map((point) => point.bpm);
  const movementLoad = dataset.movement.length
    ? dataset.movement.reduce((total, point) => total + point.meanAcceleration, 0)
    : null;

  return {
    durationSeconds: getTraceDurationSeconds(dataset),
    distanceM: gpsSummary.distanceM,
    topSpeedMps: gpsSummary.topSpeedMps,
    steps: dataset.steps.length ? Math.max(...dataset.steps.map((point) => point.steps)) : null,
    averageHeartRate: heartRates.length
      ? Math.round(heartRates.reduce((total, value) => total + value, 0) / heartRates.length)
      : null,
    maximumHeartRate: heartRates.length ? Math.max(...heartRates) : null,
    movementLoad,
  };
};

export const findLatestAtTime = <T extends { seconds: number }>(rows: T[], seconds: number): T | null => {
  if (rows.length === 0 || seconds < rows[0].seconds) return null;

  let low = 0;
  let high = rows.length - 1;
  let match = rows[0];
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (rows[middle].seconds <= seconds) {
      match = rows[middle];
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return match;
};

export const buildOverviewTimeline = (dataset: TraceDataset, maximumPoints = 600): TraceOverviewPoint[] => {
  const durationSeconds = getTraceDurationSeconds(dataset);
  if (durationSeconds <= 0) return [];
  const interval = Math.max(1, Math.ceil(durationSeconds / maximumPoints));
  const points: TraceOverviewPoint[] = [];

  for (let seconds = 0; seconds <= durationSeconds; seconds += interval) {
    const heartRate = findLatestAtTime(dataset.heartRate, seconds);
    const movement = findLatestAtTime(dataset.movement, seconds);
    const steps = findLatestAtTime(dataset.steps, seconds);
    const activity = findLatestAtTime(dataset.activity, seconds);
    points.push({
      seconds,
      heartRate: heartRate && seconds - heartRate.seconds <= 15 ? heartRate.bpm : null,
      movement: movement && seconds - movement.seconds <= interval + 1 ? movement.meanAcceleration : null,
      steps: steps?.steps ?? null,
      activity: activity?.activity ?? null,
    });
  }
  return points;
};

export const buildActivityDurations = (dataset: TraceDataset) => {
  const totals = new Map<string, number>();
  const sessionEnd = getTraceDurationSeconds(dataset);
  dataset.activity.forEach((point, index) => {
    const nextSeconds = dataset.activity[index + 1]?.seconds ?? sessionEnd;
    totals.set(point.activity, (totals.get(point.activity) ?? 0) + Math.max(0, nextSeconds - point.seconds));
  });
  return [...totals.entries()]
    .map(([activity, seconds]) => ({ activity, seconds }))
    .sort((left, right) => right.seconds - left.seconds);
};

export const buildHeartRateBands = (points: TraceHeartRatePoint[]) => {
  const bands = [
    { label: "Under 100", minimum: 0, maximum: 99, seconds: 0 },
    { label: "100-119", minimum: 100, maximum: 119, seconds: 0 },
    { label: "120-139", minimum: 120, maximum: 139, seconds: 0 },
    { label: "140-159", minimum: 140, maximum: 159, seconds: 0 },
    { label: "160+", minimum: 160, maximum: Number.POSITIVE_INFINITY, seconds: 0 },
  ];

  points.forEach((point, index) => {
    const nextSeconds = points[index + 1]?.seconds ?? point.seconds + 5;
    const sampleSeconds = Math.min(15, Math.max(0, nextSeconds - point.seconds));
    const band = bands.find((candidate) => point.bpm >= candidate.minimum && point.bpm <= candidate.maximum);
    if (band) band.seconds += sampleSeconds;
  });
  return bands;
};

const percentile = (values: number[], fraction: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
};

export const detectMovementPeaks = (points: TraceMovementBucket[]): TraceMovementPeak[] => {
  if (points.length < 3) return [];
  const threshold = percentile(points.map((point) => point.peakAcceleration), 0.95);
  const peaks: TraceMovementPeak[] = [];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const lastPeak = peaks.at(-1);
    if (
      current.peakAcceleration >= threshold &&
      current.peakAcceleration >= previous.peakAcceleration &&
      current.peakAcceleration > next.peakAcceleration &&
      (!lastPeak || current.seconds - lastPeak.seconds >= 3)
    ) {
      peaks.push({
        seconds: current.seconds,
        acceleration: current.peakAcceleration,
        rotation: current.peakRotation,
      });
    }
  }

  return peaks.sort((left, right) => right.acceleration - left.acceleration).slice(0, 20);
};

export const normaliseGpsPoints = (points: TraceGpsPoint[]): NormalisedGpsPoint[] => {
  if (points.length === 0) return [];
  const bounds = points.reduce(
    (current, point) => ({
      minimumLongitude: Math.min(current.minimumLongitude, point.longitude),
      maximumLongitude: Math.max(current.maximumLongitude, point.longitude),
      minimumLatitude: Math.min(current.minimumLatitude, point.latitude),
      maximumLatitude: Math.max(current.maximumLatitude, point.latitude),
    }),
    {
      minimumLongitude: Number.POSITIVE_INFINITY,
      maximumLongitude: Number.NEGATIVE_INFINITY,
      minimumLatitude: Number.POSITIVE_INFINITY,
      maximumLatitude: Number.NEGATIVE_INFINITY,
    },
  );
  const longitudeRange = Math.max(bounds.maximumLongitude - bounds.minimumLongitude, 0.000001);
  const latitudeRange = Math.max(bounds.maximumLatitude - bounds.minimumLatitude, 0.000001);

  return points.map((point) => ({
    ...point,
    x: ((point.longitude - bounds.minimumLongitude) / longitudeRange) * 88 + 6,
    y: 94 - ((point.latitude - bounds.minimumLatitude) / latitudeRange) * 88,
  }));
};

export const sampleRows = <T>(rows: T[], maximumRows: number) => {
  if (rows.length <= maximumRows) return rows;
  const interval = Math.ceil(rows.length / maximumRows);
  return rows.filter((_, index) => index % interval === 0 || index === rows.length - 1);
};

export const formatTraceDuration = (secondsValue: number) => {
  const totalSeconds = Math.max(0, Math.floor(secondsValue));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const formatTraceBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const metadataDateValue = (metadata: TraceMetadata | null) => {
  const match = metadata?.recordingTime?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
};

export const buildDemoTraceDataset = (): TraceDataset => {
  const durationSeconds = 360;
  const phoneGps: TraceGpsPoint[] = [];
  const watchGps: TraceGpsPoint[] = [];
  const movement: TraceMovementBucket[] = [];
  const heartRate: TraceHeartRatePoint[] = [];
  const steps: TraceStepPoint[] = [];
  const activity: TraceActivityPoint[] = [
    { seconds: 0, activity: "walking" },
    { seconds: 55, activity: "running" },
    { seconds: 300, activity: "walking" },
  ];

  for (let seconds = 0; seconds <= durationSeconds; seconds += 1) {
    const angle = (seconds / durationSeconds) * Math.PI * 4;
    const latitude = -37.05 + Math.sin(angle) * 0.00025;
    const longitude = 142.78 + Math.cos(angle * 0.8) * 0.0004;
    const speedMps = 2.2 + Math.abs(Math.sin(seconds / 18)) * 4.8;
    phoneGps.push({ seconds, latitude, longitude, altitudeM: 210, speedMps, accuracyM: 6.5 });
    watchGps.push({
      seconds,
      latitude: latitude + Math.sin(seconds / 8) * 0.00001,
      longitude: longitude + Math.cos(seconds / 9) * 0.00001,
      altitudeM: 210,
      speedMps,
      accuracyM: 5.2,
    });
    movement.push({
      seconds,
      meanAcceleration: 0.35 + Math.abs(Math.sin(seconds / 9)) * 0.9,
      peakAcceleration: 0.8 + Math.abs(Math.sin(seconds / 7)) * 3.5,
      meanRotation: 0.8 + Math.abs(Math.cos(seconds / 12)) * 2.2,
      peakRotation: 2 + Math.abs(Math.cos(seconds / 8)) * 7,
      samples: 100,
    });
    if (seconds % 5 === 0) {
      heartRate.push({ seconds, bpm: Math.round(118 + Math.abs(Math.sin(seconds / 45)) * 52) });
    }
    if (seconds % 15 === 0) {
      steps.push({ seconds, steps: Math.round(seconds * 2.1) });
    }
  }

  const loadedReport = (
    fileName: string,
    kind: TraceFileKind,
    rows: number,
    outputRows = rows,
  ): TraceFileReport => ({
    fileName,
    kind,
    status: "loaded",
    rows,
    outputRows,
    skippedRows: 0,
    preRollRows: 0,
    sizeBytes: 0,
    durationSeconds,
    note: "Generated demonstration data.",
  });

  return {
    metadata: {
      version: "demo",
      deviceName: "Example phone and watch",
      recordingTime: "2026-07-15_18-14-43",
      recordingTimezone: "Australia/Melbourne",
      platform: "demo",
      appVersion: null,
    },
    heartRate,
    steps,
    activity,
    phoneGps,
    watchGps,
    movement,
    reports: [
      loadedReport("Metadata.csv", "metadata", 1),
      loadedReport("HeartRate.csv", "heartRate", heartRate.length),
      loadedReport("Pedometer.csv", "pedometer", steps.length),
      loadedReport("Activity.csv", "activity", activity.length),
      loadedReport("Location.csv", "phoneGps", phoneGps.length),
      loadedReport("WatchLocation.csv", "watchGps", watchGps.length),
      loadedReport("WristMotion.csv", "wristMotion", movement.length * 100, movement.length),
    ],
  };
};

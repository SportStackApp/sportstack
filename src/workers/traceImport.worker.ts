/// <reference lib="webworker" />

import type {
  ParsedTraceFile,
  TraceFileKind,
  TraceFileReport,
  TraceGpsPoint,
  TraceMetadata,
  TraceMovementBucket,
  TraceWorkerResponse,
} from "@/lib/tracePlayback";

const workerScope = self as DedicatedWorkerGlobalScope;

const supportedFiles: Record<string, TraceFileKind> = {
  "metadata.csv": "metadata",
  "heartrate.csv": "heartRate",
  "pedometer.csv": "pedometer",
  "activity.csv": "activity",
  "location.csv": "phoneGps",
  "watchlocation.csv": "watchGps",
  "wristmotion.csv": "wristMotion",
};

const parseCsvRow = (line: string) => {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
};

const normaliseHeader = (header: string) => header.trim().toLowerCase().replace(/^\uFEFF/, "");

const toNumber = (value: string | undefined) => {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const post = (message: TraceWorkerResponse) => workerScope.postMessage(message);

const streamCsv = async (
  file: File,
  onHeader: (headers: string[]) => void,
  onRow: (cells: string[]) => void,
) => {
  const reader = file.stream().getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let processedBytes = 0;
  let headerRead = false;
  let lastProgressBytes = 0;

  const processLine = (rawLine: string) => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line.trim()) return;
    if (!headerRead) {
      onHeader(parseCsvRow(line).map(normaliseHeader));
      headerRead = true;
      return;
    }
    onRow(parseCsvRow(line));
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    processedBytes += value.byteLength;
    buffer += decoder.decode(value, { stream: true });
    let lineBreak = buffer.indexOf("\n");
    while (lineBreak >= 0) {
      processLine(buffer.slice(0, lineBreak));
      buffer = buffer.slice(lineBreak + 1);
      lineBreak = buffer.indexOf("\n");
    }

    if (processedBytes - lastProgressBytes >= 512 * 1024 || processedBytes === file.size) {
      lastProgressBytes = processedBytes;
      post({
        type: "progress",
        progress: {
          fileName: file.name,
          processedBytes,
          totalBytes: file.size,
          percent: file.size ? Math.min(100, Math.round((processedBytes / file.size) * 100)) : 100,
        },
      });
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) processLine(buffer);
  if (!headerRead) throw new Error("The file is empty or does not contain a CSV header.");
};

const requiredIndex = (headers: string[], name: string) => {
  const index = headers.indexOf(name);
  if (index === -1) throw new Error(`Required column '${name}' was not found.`);
  return index;
};

const optionalIndex = (headers: string[], ...names: string[]) => {
  for (const name of names) {
    const index = headers.indexOf(name);
    if (index >= 0) return index;
  }
  return -1;
};

const makeReport = (
  file: File,
  kind: TraceFileKind,
  status: TraceFileReport["status"],
  rows: number,
  outputRows: number,
  skippedRows: number,
  preRollRows: number,
  minimumSeconds: number | null,
  maximumSeconds: number | null,
  note: string,
): TraceFileReport => ({
  fileName: file.name,
  kind,
  status,
  rows,
  outputRows,
  skippedRows,
  preRollRows,
  sizeBytes: file.size,
  durationSeconds:
    minimumSeconds === null || maximumSeconds === null ? null : Math.max(0, maximumSeconds - minimumSeconds),
  note,
});

const parseMetadata = async (file: File): Promise<ParsedTraceFile> => {
  let headers: string[] = [];
  let rows = 0;
  let skippedRows = 0;
  let metadata: TraceMetadata | null = null;

  await streamCsv(
    file,
    (nextHeaders) => {
      headers = nextHeaders;
    },
    (cells) => {
      rows += 1;
      if (metadata) return;
      const value = (name: string) => {
        const index = headers.indexOf(name);
        return index >= 0 && cells[index]?.trim() ? cells[index].trim() : null;
      };
      metadata = {
        version: value("version"),
        deviceName: value("device name"),
        recordingTime: value("recording time"),
        recordingTimezone: value("recording timezone"),
        platform: value("platform"),
        appVersion: value("appversion"),
      };
    },
  );

  if (!metadata) {
    skippedRows = rows;
    throw new Error("Metadata.csv did not contain a data row.");
  }

  return {
    kind: "metadata",
    metadata,
    report: makeReport(file, "metadata", "loaded", rows, 1, skippedRows, 0, null, null, "Session details loaded."),
  };
};

const parseHeartRate = async (file: File): Promise<ParsedTraceFile> => {
  let secondsIndex = -1;
  let bpmIndex = -1;
  let rows = 0;
  let skippedRows = 0;
  let preRollRows = 0;
  let minimumSeconds: number | null = null;
  let maximumSeconds: number | null = null;
  const heartRate: NonNullable<ParsedTraceFile["heartRate"]> = [];

  await streamCsv(
    file,
    (headers) => {
      secondsIndex = requiredIndex(headers, "seconds_elapsed");
      bpmIndex = requiredIndex(headers, "bpm");
    },
    (cells) => {
      rows += 1;
      const seconds = toNumber(cells[secondsIndex]);
      const bpm = toNumber(cells[bpmIndex]);
      if (seconds === null || bpm === null || bpm <= 0) {
        skippedRows += 1;
        return;
      }
      if (seconds < 0) {
        skippedRows += 1;
        preRollRows += 1;
        return;
      }
      heartRate.push({ seconds, bpm });
      minimumSeconds = minimumSeconds === null ? seconds : Math.min(minimumSeconds, seconds);
      maximumSeconds = maximumSeconds === null ? seconds : Math.max(maximumSeconds, seconds);
    },
  );

  return {
    kind: "heartRate",
    heartRate,
    report: makeReport(
      file,
      "heartRate",
      "loaded",
      rows,
      heartRate.length,
      skippedRows,
      preRollRows,
      minimumSeconds,
      maximumSeconds,
      "Watch heart-rate samples loaded.",
    ),
  };
};

const parsePedometer = async (file: File): Promise<ParsedTraceFile> => {
  let secondsIndex = -1;
  let stepsIndex = -1;
  let rows = 0;
  let skippedRows = 0;
  let preRollRows = 0;
  let minimumSeconds: number | null = null;
  let maximumSeconds: number | null = null;
  const steps: NonNullable<ParsedTraceFile["steps"]> = [];

  await streamCsv(
    file,
    (headers) => {
      secondsIndex = requiredIndex(headers, "seconds_elapsed");
      stepsIndex = requiredIndex(headers, "steps");
    },
    (cells) => {
      rows += 1;
      const seconds = toNumber(cells[secondsIndex]);
      const stepCount = toNumber(cells[stepsIndex]);
      if (seconds === null || stepCount === null || stepCount < 0) {
        skippedRows += 1;
        return;
      }
      if (seconds < 0) {
        skippedRows += 1;
        preRollRows += 1;
        return;
      }
      steps.push({ seconds, steps: stepCount });
      minimumSeconds = minimumSeconds === null ? seconds : Math.min(minimumSeconds, seconds);
      maximumSeconds = maximumSeconds === null ? seconds : Math.max(maximumSeconds, seconds);
    },
  );

  return {
    kind: "pedometer",
    steps,
    report: makeReport(
      file,
      "pedometer",
      "loaded",
      rows,
      steps.length,
      skippedRows,
      preRollRows,
      minimumSeconds,
      maximumSeconds,
      "Phone step counter loaded.",
    ),
  };
};

const parseActivity = async (file: File): Promise<ParsedTraceFile> => {
  let secondsIndex = -1;
  let activityIndex = -1;
  let rows = 0;
  let skippedRows = 0;
  let preRollRows = 0;
  let minimumSeconds: number | null = null;
  let maximumSeconds: number | null = null;
  const activity: NonNullable<ParsedTraceFile["activity"]> = [];

  await streamCsv(
    file,
    (headers) => {
      secondsIndex = requiredIndex(headers, "seconds_elapsed");
      activityIndex = requiredIndex(headers, "activity");
    },
    (cells) => {
      rows += 1;
      const seconds = toNumber(cells[secondsIndex]);
      const activityLabel = cells[activityIndex]?.trim().toLowerCase();
      if (seconds === null || !activityLabel) {
        skippedRows += 1;
        return;
      }
      if (seconds < 0) {
        skippedRows += 1;
        preRollRows += 1;
        return;
      }
      activity.push({ seconds, activity: activityLabel });
      minimumSeconds = minimumSeconds === null ? seconds : Math.min(minimumSeconds, seconds);
      maximumSeconds = maximumSeconds === null ? seconds : Math.max(maximumSeconds, seconds);
    },
  );

  return {
    kind: "activity",
    activity,
    report: makeReport(
      file,
      "activity",
      "loaded",
      rows,
      activity.length,
      skippedRows,
      preRollRows,
      minimumSeconds,
      maximumSeconds,
      "Phone activity classifications loaded.",
    ),
  };
};

const parseGps = async (file: File, kind: "phoneGps" | "watchGps"): Promise<ParsedTraceFile> => {
  let secondsIndex = -1;
  let latitudeIndex = -1;
  let longitudeIndex = -1;
  let altitudeIndex = -1;
  let speedIndex = -1;
  let accuracyIndex = -1;
  let rows = 0;
  let skippedRows = 0;
  let preRollRows = 0;
  let minimumSeconds: number | null = null;
  let maximumSeconds: number | null = null;
  const gps: TraceGpsPoint[] = [];

  await streamCsv(
    file,
    (headers) => {
      secondsIndex = requiredIndex(headers, "seconds_elapsed");
      latitudeIndex = requiredIndex(headers, "latitude");
      longitudeIndex = requiredIndex(headers, "longitude");
      altitudeIndex = optionalIndex(headers, "altitudeabovemeansealevel", "altitude", "ellipsoidalaltitude");
      speedIndex = optionalIndex(headers, "speed");
      accuracyIndex = optionalIndex(headers, "horizontalaccuracy");
    },
    (cells) => {
      rows += 1;
      const seconds = toNumber(cells[secondsIndex]);
      const latitude = toNumber(cells[latitudeIndex]);
      const longitude = toNumber(cells[longitudeIndex]);
      if (
        seconds === null ||
        latitude === null ||
        longitude === null ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        skippedRows += 1;
        return;
      }
      if (seconds < 0) {
        preRollRows += 1;
      }
      const rawSpeed = speedIndex >= 0 ? toNumber(cells[speedIndex]) : null;
      const rawAccuracy = accuracyIndex >= 0 ? toNumber(cells[accuracyIndex]) : null;
      gps.push({
        seconds,
        latitude,
        longitude,
        altitudeM: altitudeIndex >= 0 ? toNumber(cells[altitudeIndex]) : null,
        speedMps: rawSpeed !== null && rawSpeed >= 0 ? rawSpeed : null,
        accuracyM: rawAccuracy !== null && rawAccuracy >= 0 ? rawAccuracy : null,
      });
      minimumSeconds = minimumSeconds === null ? seconds : Math.min(minimumSeconds, seconds);
      maximumSeconds = maximumSeconds === null ? seconds : Math.max(maximumSeconds, seconds);
    },
  );

  const note = preRollRows
    ? `${preRollRows.toLocaleString("en-AU")} pre-recording ${kind === "phoneGps" ? "phone" : "watch"} location row${preRollRows === 1 ? " is" : "s are"} included at the start of the route.`
    : `${kind === "phoneGps" ? "Phone" : "Watch"} GPS samples loaded.`;
  return {
    kind,
    gps,
    report: makeReport(
      file,
      kind,
      "loaded",
      rows,
      gps.length,
      skippedRows,
      preRollRows,
      minimumSeconds,
      maximumSeconds,
      note,
    ),
  };
};

interface MovementAccumulator {
  seconds: number;
  accelerationTotal: number;
  peakAcceleration: number;
  rotationTotal: number;
  peakRotation: number;
  samples: number;
}

const parseWristMotion = async (file: File): Promise<ParsedTraceFile> => {
  let secondsIndex = -1;
  let accelerationIndexes: number[] = [];
  let rotationIndexes: number[] = [];
  let rows = 0;
  let skippedRows = 0;
  let preRollRows = 0;
  let minimumSeconds: number | null = null;
  let maximumSeconds: number | null = null;
  const buckets = new Map<number, MovementAccumulator>();

  await streamCsv(
    file,
    (headers) => {
      secondsIndex = requiredIndex(headers, "seconds_elapsed");
      accelerationIndexes = [
        requiredIndex(headers, "accelerationx"),
        requiredIndex(headers, "accelerationy"),
        requiredIndex(headers, "accelerationz"),
      ];
      rotationIndexes = [
        requiredIndex(headers, "rotationratex"),
        requiredIndex(headers, "rotationratey"),
        requiredIndex(headers, "rotationratez"),
      ];
    },
    (cells) => {
      rows += 1;
      const seconds = toNumber(cells[secondsIndex]);
      const accelerationValues = accelerationIndexes.map((index) => toNumber(cells[index]));
      const rotationValues = rotationIndexes.map((index) => toNumber(cells[index]));
      if (
        seconds === null ||
        accelerationValues.some((value) => value === null) ||
        rotationValues.some((value) => value === null)
      ) {
        skippedRows += 1;
        return;
      }
      if (seconds < 0) {
        skippedRows += 1;
        preRollRows += 1;
        return;
      }

      const acceleration = Math.hypot(...(accelerationValues as number[]));
      const rotation = Math.hypot(...(rotationValues as number[]));
      const bucketSeconds = Math.floor(seconds);
      const bucket = buckets.get(bucketSeconds) ?? {
        seconds: bucketSeconds,
        accelerationTotal: 0,
        peakAcceleration: 0,
        rotationTotal: 0,
        peakRotation: 0,
        samples: 0,
      };
      bucket.accelerationTotal += acceleration;
      bucket.peakAcceleration = Math.max(bucket.peakAcceleration, acceleration);
      bucket.rotationTotal += rotation;
      bucket.peakRotation = Math.max(bucket.peakRotation, rotation);
      bucket.samples += 1;
      buckets.set(bucketSeconds, bucket);
      minimumSeconds = minimumSeconds === null ? seconds : Math.min(minimumSeconds, seconds);
      maximumSeconds = maximumSeconds === null ? seconds : Math.max(maximumSeconds, seconds);
    },
  );

  const movement: TraceMovementBucket[] = [...buckets.values()]
    .sort((left, right) => left.seconds - right.seconds)
    .map((bucket) => ({
      seconds: bucket.seconds,
      meanAcceleration: bucket.accelerationTotal / bucket.samples,
      peakAcceleration: bucket.peakAcceleration,
      meanRotation: bucket.rotationTotal / bucket.samples,
      peakRotation: bucket.peakRotation,
      samples: bucket.samples,
    }));

  return {
    kind: "wristMotion",
    movement,
    report: makeReport(
      file,
      "wristMotion",
      "loaded",
      rows,
      movement.length,
      skippedRows,
      preRollRows,
      minimumSeconds,
      maximumSeconds,
      `Watch movement was reduced to ${movement.length.toLocaleString("en-AU")} one-second summaries.`,
    ),
  };
};

const parseFile = async (file: File): Promise<ParsedTraceFile> => {
  const kind = supportedFiles[file.name.toLowerCase()] ?? "unsupported";
  if (kind === "unsupported") {
    return {
      kind,
      report: makeReport(
        file,
        kind,
        "unused",
        0,
        0,
        0,
        0,
        null,
        null,
        "This file is not used in the first TraceLab playground.",
      ),
    };
  }

  switch (kind) {
    case "metadata":
      return parseMetadata(file);
    case "heartRate":
      return parseHeartRate(file);
    case "pedometer":
      return parsePedometer(file);
    case "activity":
      return parseActivity(file);
    case "phoneGps":
    case "watchGps":
      return parseGps(file, kind);
    case "wristMotion":
      return parseWristMotion(file);
    case "unsupported":
      throw new Error("Unsupported file type.");
  }
};

workerScope.onmessage = async (event: MessageEvent<{ type: "parse"; files: File[] }>) => {
  if (event.data.type !== "parse") return;

  for (const file of event.data.files) {
    post({ type: "start", fileName: file.name, totalBytes: file.size });
    try {
      const result = await parseFile(file);
      post({ type: "parsed", result });
    } catch (error) {
      const kind = supportedFiles[file.name.toLowerCase()] ?? "unsupported";
      const message = error instanceof Error ? error.message : "The file could not be read.";
      post({
        type: "parsed",
        result: {
          kind,
          report: makeReport(file, kind, "error", 0, 0, 0, 0, null, null, message),
        },
      });
    }
  }

  post({ type: "complete" });
};

export {};

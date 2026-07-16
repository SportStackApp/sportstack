import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  Footprints,
  Gauge,
  HeartPulse,
  Info,
  MapPinned,
  Pause,
  Play,
  Radar,
  RotateCcw,
  Square,
  Timer,
  Upload,
  Waves,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  buildActivityDurations,
  buildDemoTraceDataset,
  buildHeartRateBands,
  buildOverviewTimeline,
  createEmptyTraceDataset,
  detectMovementPeaks,
  findLatestAtTime,
  formatTraceBytes,
  formatTraceDuration,
  getGpsSummary,
  getTraceDurationSeconds,
  getTraceSummary,
  mergeParsedTraceFile,
  metadataDateValue,
  normaliseGpsPoints,
  sampleRows,
  traceFileLabel,
  type NormalisedGpsPoint,
  type TraceDataset,
  type TraceFileReport,
  type TraceGpsQuality,
  type TraceGpsSource,
  type TraceWorkerProgress,
  type TraceWorkerResponse,
} from "@/lib/tracePlayback";

const supportedFileNames = [
  "Metadata.csv",
  "HeartRate.csv",
  "Pedometer.csv",
  "Activity.csv",
  "Location.csv",
  "WatchLocation.csv",
  "WristMotion.csv",
];

const qualityDetails: Record<TraceGpsQuality, { label: string; className: string; description: string }> = {
  good: {
    label: "Good",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    description: "The typical GPS accuracy is within 10 metres.",
  },
  fair: {
    label: "Fair",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    description: "The route can be explored, but distance and speed should be treated as estimates.",
  },
  poor: {
    label: "Poor",
    className: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    description: "The GPS points are displayed, but the route, distance and speed may be misleading.",
  },
  unknown: {
    label: "Unknown",
    className: "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    description: "This file does not include a usable horizontal-accuracy value.",
  },
  none: {
    label: "No data",
    className: "border-muted-foreground/30 bg-muted text-muted-foreground",
    description: "Import a phone or watch location file to view a GPS trace.",
  },
};

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  color: "hsl(var(--popover-foreground))",
};

export default function HockeyTraceLab() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const batchTotalsRef = useRef({ loaded: 0, unused: 0, errors: 0 });
  const [dataset, setDataset] = useState<TraceDataset>(() => createEmptyTraceDataset());
  const [sessionName, setSessionName] = useState("Untitled trace session");
  const [playerName, setPlayerName] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedGpsSource, setSelectedGpsSource] = useState<TraceGpsSource>("phone");
  const [currentSecond, setCurrentSecond] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTrail, setShowTrail] = useState(true);
  const [showPeaks, setShowPeaks] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<TraceWorkerProgress | null>(null);

  const durationSeconds = useMemo(() => getTraceDurationSeconds(dataset), [dataset]);
  const selectedGpsPoints = selectedGpsSource === "phone" ? dataset.phoneGps : dataset.watchGps;
  const gpsSummary = useMemo(() => getGpsSummary(selectedGpsPoints), [selectedGpsPoints]);
  const sessionSummary = useMemo(
    () => getTraceSummary(dataset, selectedGpsSource),
    [dataset, selectedGpsSource],
  );
  const overviewTimeline = useMemo(() => buildOverviewTimeline(dataset), [dataset]);
  const activityDurations = useMemo(() => buildActivityDurations(dataset), [dataset]);
  const heartRateBands = useMemo(() => buildHeartRateBands(dataset.heartRate), [dataset.heartRate]);
  const movementPeaks = useMemo(() => detectMovementPeaks(dataset.movement), [dataset.movement]);
  const movementChart = useMemo(() => sampleRows(dataset.movement, 700), [dataset.movement]);
  const normalisedGps = useMemo(() => normaliseGpsPoints(selectedGpsPoints), [selectedGpsPoints]);
  const loadedFileCount = dataset.reports.filter((report) => report.status === "loaded").length;
  const currentHeartRate = findLatestAtTime(dataset.heartRate, currentSecond);
  const currentSteps = findLatestAtTime(dataset.steps, currentSecond);
  const currentActivity = findLatestAtTime(dataset.activity, currentSecond);
  const currentMovement = findLatestAtTime(dataset.movement, currentSecond);

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    if (selectedGpsSource === "phone" && dataset.phoneGps.length === 0 && dataset.watchGps.length > 0) {
      setSelectedGpsSource("watch");
    }
    if (selectedGpsSource === "watch" && dataset.watchGps.length === 0 && dataset.phoneGps.length > 0) {
      setSelectedGpsSource("phone");
    }
  }, [dataset.phoneGps.length, dataset.watchGps.length, selectedGpsSource]);

  useEffect(() => {
    setCurrentSecond((current) => Math.min(current, Math.max(0, durationSeconds)));
  }, [durationSeconds]);

  useEffect(() => {
    if (!isPlaying || durationSeconds <= 0) return;
    const replayStepSeconds = Math.max(1, Math.round(durationSeconds / 720));
    const timer = window.setInterval(() => {
      setCurrentSecond((current) => {
        if (current >= durationSeconds) {
          setIsPlaying(false);
          return durationSeconds;
        }
        return Math.min(durationSeconds, current + replayStepSeconds);
      });
    }, 200);
    return () => window.clearInterval(timer);
  }, [durationSeconds, isPlaying]);

  const cancelImport = (showToast = true) => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsImporting(false);
    setImportProgress(null);
    if (showToast) {
      toast({ title: "Import cancelled", description: "Files that finished earlier in the batch remain loaded." });
    }
  };

  const startImport = (files: File[]) => {
    if (files.length === 0) return;
    if (workerRef.current) cancelImport(false);

    const worker = new Worker(new URL("../../workers/traceImport.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    batchTotalsRef.current = { loaded: 0, unused: 0, errors: 0 };
    setIsImporting(true);
    setIsPlaying(false);

    worker.onmessage = (event: MessageEvent<TraceWorkerResponse>) => {
      const message = event.data;
      if (message.type === "start") {
        setImportProgress({
          fileName: message.fileName,
          processedBytes: 0,
          totalBytes: message.totalBytes,
          percent: 0,
        });
        return;
      }
      if (message.type === "progress") {
        setImportProgress(message.progress);
        return;
      }
      if (message.type === "parsed") {
        setDataset((current) => mergeParsedTraceFile(current, message.result));
        if (message.result.report.status === "loaded") batchTotalsRef.current.loaded += 1;
        if (message.result.report.status === "unused") batchTotalsRef.current.unused += 1;
        if (message.result.report.status === "error") batchTotalsRef.current.errors += 1;

        if (message.result.metadata) {
          const dateValue = metadataDateValue(message.result.metadata);
          if (dateValue) {
            setSessionDate(dateValue);
            setSessionName((current) =>
              current === "Untitled trace session" || current === "Demonstration training session"
                ? `Training ${formatSessionDate(dateValue)}`
                : current,
            );
          }
        }
        return;
      }

      setIsImporting(false);
      setImportProgress(null);
      worker.terminate();
      workerRef.current = null;
      const { loaded, unused, errors } = batchTotalsRef.current;
      toast({
        title: errors > 0 ? "Import completed with errors" : "Trace data loaded",
        description: `${loaded} used, ${unused} not used${errors ? `, ${errors} failed` : ""}.`,
        variant: errors > 0 ? "destructive" : "default",
      });
    };

    worker.onerror = () => {
      cancelImport(false);
      toast({
        title: "Trace import stopped",
        description: "The browser worker could not finish reading the selected files.",
        variant: "destructive",
      });
    };
    worker.postMessage({ type: "parse", files });
  };

  const loadDemo = () => {
    cancelImport(false);
    setDataset(buildDemoTraceDataset());
    setSessionName("Demonstration training session");
    setPlayerName("Example player");
    setSessionDate("2026-07-15");
    setSelectedGpsSource("watch");
    setCurrentSecond(0);
    setShowTrail(true);
    setShowPeaks(true);
    setIsPlaying(false);
  };

  const clearSession = () => {
    cancelImport(false);
    setDataset(createEmptyTraceDataset());
    setSessionName("Untitled trace session");
    setPlayerName("");
    setSessionDate(new Date().toISOString().slice(0, 10));
    setSelectedGpsSource("phone");
    setCurrentSecond(0);
    setShowTrail(true);
    setShowPeaks(true);
    setIsPlaying(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Radar className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Hockey Trace Lab</h1>
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              On hold
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            This browser-only viewer is on hold. Existing imports, timelines and replay tools remain available for future testing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadDemo}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Load demo
          </Button>
          <Button variant="outline" onClick={clearSession}>
            New session
          </Button>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Browser-only playground</AlertTitle>
        <AlertDescription>
          Files stay on this device and are not saved to SportStack. Poor data is still shown, with warnings where results may be inaccurate.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session intake</CardTitle>
          <CardDescription>Add supported files together or one at a time. A newer file replaces only the matching data type.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="trace-session-name">Session name</Label>
              <Input id="trace-session-name" value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trace-player-name">Player</Label>
              <Input
                id="trace-player-name"
                value={playerName}
                placeholder="Optional for this playground"
                onChange={(event) => setPlayerName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trace-session-date">Session date</Label>
              <Input id="trace-session-date" type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border border-dashed p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-2">
                <Label htmlFor="trace-file-import">TraceLab CSV files</Label>
                <Input
                  ref={fileInputRef}
                  id="trace-file-import"
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  disabled={isImporting}
                  onChange={(event) => {
                    startImport(Array.from(event.target.files ?? []));
                    event.target.value = "";
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Supported: {supportedFileNames.join(", ")}. Large files work best on desktop.
                </p>
              </div>
              {isImporting ? (
                <Button variant="outline" onClick={() => cancelImport()}>
                  <Square className="mr-2 h-4 w-4" />
                  Cancel import
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Choose files
                </Button>
              )}
            </div>

            {importProgress && <ImportProgress progress={importProgress} />}
            {!isImporting && dataset.reports.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{loadedFileCount} used</Badge>
                {dataset.reports.filter((report) => report.status === "unused").length > 0 && (
                  <Badge variant="outline">{dataset.reports.filter((report) => report.status === "unused").length} unused</Badge>
                )}
                {dataset.reports.filter((report) => report.status === "error").length > 0 && (
                  <Badge variant="destructive">{dataset.reports.filter((report) => report.status === "error").length} errors</Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <TraceStatCard icon={Timer} label="Duration" value={formatTraceDuration(sessionSummary.durationSeconds)} note="Combined timeline" />
        <TraceStatCard
          icon={MapPinned}
          label="Estimated distance"
          value={formatDistance(sessionSummary.distanceM)}
          note={`${selectedGpsSource === "phone" ? "Phone" : "Watch"} GPS`}
          quality={gpsSummary.quality}
        />
        <TraceStatCard
          icon={Gauge}
          label="Top speed"
          value={gpsSummary.samples ? `${sessionSummary.topSpeedMps.toFixed(1)} m/s` : "No GPS"}
          note={gpsSummary.samples ? `${(sessionSummary.topSpeedMps * 3.6).toFixed(1)} km/h` : "Import Location.csv"}
          quality={gpsSummary.quality}
        />
        <TraceStatCard
          icon={Footprints}
          label="Recorded steps"
          value={sessionSummary.steps?.toLocaleString("en-AU") ?? "No data"}
          note="Phone pedometer"
        />
        <TraceStatCard
          icon={HeartPulse}
          label="Heart rate"
          value={sessionSummary.averageHeartRate ? `${sessionSummary.averageHeartRate} avg` : "No data"}
          note={sessionSummary.maximumHeartRate ? `${sessionSummary.maximumHeartRate} bpm maximum` : "Import HeartRate.csv"}
        />
        <TraceStatCard
          icon={Waves}
          label="Movement load"
          value={sessionSummary.movementLoad === null ? "No data" : Math.round(sessionSummary.movementLoad).toLocaleString("en-AU")}
          note="Experimental wrist index"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base">{sessionName || "Untitled trace session"}</CardTitle>
              <CardDescription>
                {playerName || "No player selected"} · {formatSessionDate(sessionDate)} · {formatTraceDuration(durationSeconds)} · {loadedFileCount} data files
              </CardDescription>
            </div>
            <Badge variant="secondary">In-memory replay</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center">
            <Button variant="outline" onClick={() => setCurrentSecond(0)} disabled={durationSeconds <= 0}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart
            </Button>
            <div className="space-y-1">
              <Slider
                value={[Math.min(currentSecond, durationSeconds)]}
                min={0}
                max={Math.max(1, durationSeconds)}
                step={1}
                disabled={durationSeconds <= 0}
                onValueChange={([value]) => {
                  setCurrentSecond(value);
                  setIsPlaying(false);
                }}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTraceDuration(currentSecond)}</span>
                <span>{formatTraceDuration(durationSeconds)}</span>
              </div>
            </div>
            <Button onClick={() => setIsPlaying((current) => !current)} disabled={durationSeconds <= 0}>
              {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <div className="flex gap-2">
              <Button variant={showTrail ? "default" : "outline"} size="sm" onClick={() => setShowTrail((current) => !current)}>
                Trail
              </Button>
              <Button variant={showPeaks ? "default" : "outline"} size="sm" onClick={() => setShowPeaks((current) => !current)}>
                Peaks
              </Button>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <div className="overflow-x-auto">
              <TabsList className="h-auto min-w-full justify-start">
                <TabsTrigger value="overview" className="min-w-28 flex-1">Overview</TabsTrigger>
                <TabsTrigger value="gps" className="min-w-24 flex-1">GPS</TabsTrigger>
                <TabsTrigger value="movement" className="min-w-28 flex-1">Movement</TabsTrigger>
                <TabsTrigger value="quality" className="min-w-32 flex-1">Data quality</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <CurrentValue label="Heart rate" value={currentHeartRate ? `${currentHeartRate.bpm} bpm` : "No reading"} />
                <CurrentValue label="Phone steps" value={currentSteps ? currentSteps.steps.toLocaleString("en-AU") : "No reading"} />
                <CurrentValue label="Phone activity" value={sentenceCase(currentActivity?.activity ?? "No reading")} />
                <CurrentValue
                  label="Wrist movement"
                  value={currentMovement ? `${currentMovement.meanAcceleration.toFixed(2)} mean` : "No reading"}
                />
              </div>

              {overviewTimeline.length ? (
                <div className="h-80 rounded-lg border p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={overviewTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="seconds" tickFormatter={(value) => formatTraceDuration(Number(value))} minTickGap={32} />
                      <YAxis yAxisId="movement" orientation="left" width={42} />
                      <YAxis yAxisId="heart" orientation="right" domain={[60, "auto"]} width={42} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(value) => formatTraceDuration(Number(value))}
                        formatter={(value, name) => [Number(value).toFixed(name === "Heart rate" ? 0 : 2), name]}
                      />
                      <Legend />
                      <Area
                        yAxisId="movement"
                        type="monotone"
                        dataKey="movement"
                        name="Wrist movement"
                        fill="hsl(var(--primary) / 0.2)"
                        stroke="hsl(var(--primary))"
                        connectNulls={false}
                      />
                      <Line
                        yAxisId="heart"
                        type="monotone"
                        dataKey="heartRate"
                        name="Heart rate"
                        stroke="#ef4444"
                        dot={false}
                        strokeWidth={2}
                        connectNulls={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyPanel message="Import heart-rate, activity or wrist-motion data to build the combined timeline." />
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Recorded time by BPM range</CardTitle>
                    <CardDescription>Simple recorded ranges, not personalised training zones.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 sm:grid-cols-5">
                    {heartRateBands.map((band) => (
                      <div key={band.label} className="rounded-md border p-2 text-center">
                        <div className="text-sm font-medium">{formatTraceDuration(band.seconds)}</div>
                        <div className="text-xs text-muted-foreground">{band.label}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Phone activity classification</CardTitle>
                    <CardDescription>This describes the phone, which may not have been carried by the player.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {activityDurations.length ? (
                      activityDurations.map((item) => (
                        <Badge key={item.activity} variant="outline">
                          {sentenceCase(item.activity)} · {formatTraceDuration(item.seconds)}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No Activity.csv data loaded.</span>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="gps" className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-medium">GPS source</h3>
                  <p className="text-sm text-muted-foreground">Switch sources to compare the phone and watch recordings.</p>
                </div>
                <div className="flex rounded-md border p-1">
                  <Button
                    variant={selectedGpsSource === "phone" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedGpsSource("phone")}
                  >
                    Phone ({dataset.phoneGps.length.toLocaleString("en-AU")})
                  </Button>
                  <Button
                    variant={selectedGpsSource === "watch" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedGpsSource("watch")}
                  >
                    Watch ({dataset.watchGps.length.toLocaleString("en-AU")})
                  </Button>
                </div>
              </div>

              <Alert className={gpsSummary.quality === "poor" ? "border-orange-500/50" : undefined}>
                <Info className="h-4 w-4" />
                <AlertTitle className="flex items-center gap-2">
                  GPS quality <QualityBadge quality={gpsSummary.quality} />
                </AlertTitle>
                <AlertDescription>{qualityDetails[gpsSummary.quality].description}</AlertDescription>
              </Alert>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <GpsPitch points={normalisedGps} currentSecond={currentSecond} showTrail={showTrail} />
                <div className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <CurrentValue label="Samples" value={gpsSummary.samples.toLocaleString("en-AU")} />
                  <CurrentValue
                    label="Typical accuracy"
                    value={gpsSummary.medianAccuracyM === null ? "Unknown" : `${gpsSummary.medianAccuracyM.toFixed(1)} m`}
                  />
                  <CurrentValue label="Estimated distance" value={formatDistance(gpsSummary.distanceM)} />
                  <CurrentValue label="Reported top speed" value={`${gpsSummary.topSpeedMps.toFixed(2)} m/s`} />
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Relative fitted preview – not field calibrated. The trace is stretched to the available coordinate range.
              </p>
            </TabsContent>

            <TabsContent value="movement" className="space-y-4">
              <Alert>
                <BarChart3 className="h-4 w-4" />
                <AlertTitle>Movement, not hockey actions</AlertTitle>
                <AlertDescription>
                  Wrist acceleration and rotation are reduced into one-second summaries. Peaks are labelled High movement, not hits, traps or sprints.
                </AlertDescription>
              </Alert>

              {movementChart.length ? (
                <div className="h-80 rounded-lg border p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={movementChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="seconds" tickFormatter={(value) => formatTraceDuration(Number(value))} minTickGap={32} />
                      <YAxis width={42} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(value) => formatTraceDuration(Number(value))}
                        formatter={(value, name) => [Number(value).toFixed(2), name]}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="peakAcceleration" name="Peak acceleration" stroke="#0ea5e9" dot={false} />
                      <Line type="monotone" dataKey="peakRotation" name="Peak rotation" stroke="#8b5cf6" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyPanel message="Import WristMotion.csv to view movement intensity." />
              )}

              {showPeaks && (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Marker</TableHead>
                        <TableHead className="text-right">Acceleration</TableHead>
                        <TableHead className="text-right">Rotation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movementPeaks.length ? (
                        movementPeaks.map((peak) => (
                          <TableRow key={peak.seconds} className={peak.seconds <= currentSecond ? "bg-muted/30" : undefined}>
                            <TableCell className="font-mono text-xs">{formatTraceDuration(peak.seconds)}</TableCell>
                            <TableCell><Badge variant="outline">High movement</Badge></TableCell>
                            <TableCell className="text-right">{peak.acceleration.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{peak.rotation.toFixed(2)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No movement peaks available.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="quality" className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <DataNote
                  title="Watch data"
                  description="HeartRate.csv, WatchLocation.csv and WristMotion.csv describe the watch and are the strongest player-worn sources in this pack."
                />
                <DataNote
                  title="Phone data"
                  description="Location.csv, Pedometer.csv and Activity.csv describe the phone. If the phone was left beside the pitch, they do not describe the player."
                />
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Input rows</TableHead>
                      <TableHead className="text-right">Used rows</TableHead>
                      <TableHead className="text-right">Skipped</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataset.reports.length ? (
                      [...dataset.reports]
                        .sort((left, right) => left.fileName.localeCompare(right.fileName))
                        .map((report) => <FileReportRow key={`${report.kind}-${report.fileName}`} report={report} />)
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No files imported yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {dataset.metadata && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Recording metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <MetadataValue label="Device" value={dataset.metadata.deviceName} />
                    <MetadataValue label="Platform" value={dataset.metadata.platform} />
                    <MetadataValue label="Timezone" value={dataset.metadata.recordingTimezone} />
                    <MetadataValue label="Recorder version" value={dataset.metadata.appVersion} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function ImportProgress({ progress }: { progress: TraceWorkerProgress }) {
  return (
    <div className="mt-4 space-y-2 rounded-md bg-muted/50 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium">Reading {progress.fileName}</span>
        <span className="shrink-0 text-muted-foreground">{progress.percent}%</span>
      </div>
      <Progress value={progress.percent} />
      <p className="text-xs text-muted-foreground">
        {formatTraceBytes(progress.processedBytes)} of {formatTraceBytes(progress.totalBytes)}
      </p>
    </div>
  );
}

function TraceStatCard({
  icon: Icon,
  label,
  value,
  note,
  quality,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  quality?: TraceGpsQuality;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {quality && <QualityBadge quality={quality} />}
        </div>
        <div className="mt-3 text-xl font-semibold">{value}</div>
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">{note}</div>
      </CardContent>
    </Card>
  );
}

function CurrentValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function QualityBadge({ quality }: { quality: TraceGpsQuality }) {
  const detail = qualityDetails[quality];
  return <Badge variant="outline" className={detail.className}>{detail.label}</Badge>;
}

function GpsPitch({
  points,
  currentSecond,
  showTrail,
}: {
  points: NormalisedGpsPoint[];
  currentSecond: number;
  showTrail: boolean;
}) {
  const trail = points.filter((point) => point.seconds <= currentSecond);
  const current = findLatestAtTime(points, currentSecond);
  const markers = sampleRows(points, 70);
  const trailPoints = trail.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="rounded-lg border bg-emerald-950 p-3">
      <svg viewBox="0 0 100 100" className="block aspect-[1.6/1] w-full" role="img" aria-label="Relative fitted GPS trace">
        <rect x="3" y="5" width="94" height="90" fill="#166534" stroke="#bbf7d0" strokeWidth="0.6" />
        <line x1="50" y1="5" x2="50" y2="95" stroke="#bbf7d0" strokeWidth="0.45" />
        <circle cx="50" cy="50" r="9" fill="none" stroke="#bbf7d0" strokeWidth="0.45" />
        <path d="M 3 27 C 18 27 18 73 3 73" fill="none" stroke="#bbf7d0" strokeWidth="0.45" />
        <path d="M 97 27 C 82 27 82 73 97 73" fill="none" stroke="#bbf7d0" strokeWidth="0.45" />
        {showTrail && trailPoints && (
          <polyline points={trailPoints} fill="none" stroke="#38bdf8" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {markers.map((point) => (
          <circle
            key={`${point.seconds}-${point.latitude}-${point.longitude}`}
            cx={point.x}
            cy={point.y}
            r="0.8"
            fill={gpsMarkerColour(point.accuracyM)}
            opacity="0.8"
          />
        ))}
        {current && <circle cx={current.x} cy={current.y} r="2.5" fill="#fde047" stroke="#111827" strokeWidth="0.55" />}
        {points.length === 0 && (
          <text x="50" y="50" textAnchor="middle" fill="#d1fae5" fontSize="5">No GPS data loaded</text>
        )}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-[11px] text-emerald-50">
        <LegendDot colour="#22c55e" label="≤10 m" />
        <LegendDot colour="#facc15" label="11-25 m" />
        <LegendDot colour="#f97316" label=">25 m" />
        <LegendDot colour="#fde047" label="Replay point" />
      </div>
    </div>
  );
}

function LegendDot({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colour }} />
      {label}
    </span>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function DataNote({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 font-medium">
        <FileSpreadsheet className="h-4 w-4 text-primary" />
        {title}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function FileReportRow({ report }: { report: TraceFileReport }) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{report.fileName}</div>
        <div className="max-w-72 text-xs text-muted-foreground">{report.note}</div>
      </TableCell>
      <TableCell>{traceFileLabel(report.kind)}</TableCell>
      <TableCell className="text-right">{report.rows.toLocaleString("en-AU")}</TableCell>
      <TableCell className="text-right">{report.outputRows.toLocaleString("en-AU")}</TableCell>
      <TableCell className="text-right">
        {report.skippedRows.toLocaleString("en-AU")}
      </TableCell>
      <TableCell><ReportStatus report={report} /></TableCell>
    </TableRow>
  );
}

function ReportStatus({ report }: { report: TraceFileReport }) {
  if (report.status === "loaded") {
    return <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="mr-1 h-3 w-3" />Loaded</Badge>;
  }
  if (report.status === "error") {
    return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Error</Badge>;
  }
  return <Badge variant="outline">Unused</Badge>;
}

function MetadataValue({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "Not recorded"}</div>
    </div>
  );
}

function gpsMarkerColour(accuracy: number | null) {
  if (accuracy === null) return "#94a3b8";
  if (accuracy <= 10) return "#22c55e";
  if (accuracy <= 25) return "#facc15";
  return "#f97316";
}

function formatDistance(distanceM: number) {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return "0 m";
  return distanceM >= 1000 ? `${(distanceM / 1000).toFixed(2)} km` : `${Math.round(distanceM)} m`;
}

function formatSessionDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || "No date";
}

function sentenceCase(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Gauge,
  HeartPulse,
  Pause,
  Play,
  Radar,
  RotateCcw,
  Upload,
  Waves,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TracePoint,
  buildDemoTrace,
  detectTraceEvents,
  formatTraceTime,
  parseTraceCsv,
  summariseTrace,
} from "@/lib/tracePlayback";
import { useToast } from "@/hooks/use-toast";

type UploadKind = "motion" | "gps" | "heartRate";

const emptyUploadCounts: Record<UploadKind, number> = {
  motion: 0,
  gps: 0,
  heartRate: 0,
};

export default function HockeyTraceLab() {
  const { toast } = useToast();
  const [points, setPoints] = useState<TracePoint[]>(() => buildDemoTrace());
  const [sessionName, setSessionName] = useState("Demo stick sensor replay");
  const [playerName, setPlayerName] = useState("Example player");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [confidenceFloor, setConfidenceFloor] = useState(70);
  const [showTrail, setShowTrail] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploadCounts, setUploadCounts] = useState<Record<UploadKind, number>>({
    motion: 72,
    gps: 72,
    heartRate: 72,
  });

  const events = useMemo(
    () => detectTraceEvents(points).filter((event) => event.confidence >= confidenceFloor),
    [points, confidenceFloor],
  );
  const summary = useMemo(() => summariseTrace(points), [points]);
  const currentPoint = points[Math.min(currentIndex, Math.max(points.length - 1, 0))];
  const trailPoints = showTrail ? points.slice(0, currentIndex + 1).map((point) => `${point.x},${point.y}`).join(" ") : "";

  useEffect(() => {
    if (!isPlaying || points.length <= 1) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => {
        if (index >= points.length - 1) {
          setIsPlaying(false);
          return points.length - 1;
        }
        return index + 1;
      });
    }, 220);

    return () => window.clearInterval(timer);
  }, [isPlaying, points.length]);

  const handleCsvUpload = async (kind: UploadKind, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseTraceCsv(text);
    if (parsed.length < 2) {
      toast({
        title: "CSV not loaded",
        description: "Use a CSV with x/y or latitude/longitude columns. Speed and heart rate are optional in this lab.",
        variant: "destructive",
      });
      return;
    }

    setPoints(parsed);
    setCurrentIndex(0);
    setIsPlaying(false);
    setUploadCounts((current) => ({ ...current, [kind]: parsed.length }));
    setSessionName(file.name.replace(/\.[^.]+$/, ""));
    toast({ title: "Trace loaded", description: `${parsed.length} ${uploadLabel(kind)} rows were loaded.` });
  };

  const resetDemo = () => {
    setPoints(buildDemoTrace());
    setSessionName("Demo stick sensor replay");
    setPlayerName("Example player");
    setSessionDate(new Date().toISOString().slice(0, 10));
    setConfidenceFloor(70);
    setShowTrail(true);
    setShowEvents(true);
    setIsPlaying(false);
    setCurrentIndex(0);
    setUploadCounts({ motion: 72, gps: 72, heartRate: 72 });
  };

  const clearSession = () => {
    setPoints([]);
    setCurrentIndex(0);
    setIsPlaying(false);
    setUploadCounts(emptyUploadCounts);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Radar className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Hockey Trace Lab</h1>
            <Badge variant="outline">Experimental</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            In-memory GPS, motion and heart-rate replay concept. Nothing is saved to SportStack yet.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetDemo}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Demo loader
          </Button>
          <Button variant="outline" onClick={clearSession}>
            New session
          </Button>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Experimental only</AlertTitle>
        <AlertDescription>
          This page reads CSVs in your browser only. Refreshing the page clears the session.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session Intake</CardTitle>
            <CardDescription>Separate upload cards match the original Trace workflow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Session name</Label>
              <Input value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Player</Label>
              <Input value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Session date</Label>
              <Input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} />
            </div>

            <TraceUploadCard
              id="trace-motion"
              title="Motion (IMU)"
              description="Required in the original workflow. This lab accepts position-style CSVs for replay."
              count={uploadCounts.motion}
              onChange={(event) => handleCsvUpload("motion", event)}
            />
            <TraceUploadCard
              id="trace-gps"
              title="GPS"
              description="Pitch position source. Accepts x/y, lat/lng, speed and seconds columns."
              count={uploadCounts.gps}
              onChange={(event) => handleCsvUpload("gps", event)}
            />
            <TraceUploadCard
              id="trace-heart-rate"
              title="Heart Rate"
              description="Optional. HR is read when included with position rows in this frontend-only version."
              count={uploadCounts.heartRate}
              onChange={(event) => handleCsvUpload("heartRate", event)}
            />

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Confidence filter</span>
                <span className="text-muted-foreground">{confidenceFloor}%+</span>
              </div>
              <Slider value={[confidenceFloor]} min={50} max={95} step={5} onValueChange={([value]) => setConfidenceFloor(value)} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TraceStat icon={Activity} label="Distance" value={`${(summary.distanceM / 1000).toFixed(2)} km`} />
            <TraceStat icon={Gauge} label="Top speed" value={`${summary.topSpeedMps.toFixed(1)} m/s`} />
            <TraceStat icon={Waves} label="Events" value={events.length.toString()} />
            <TraceStat icon={HeartPulse} label="Avg HR" value={summary.averageHeartRate ? `${summary.averageHeartRate} bpm` : "No HR"} />
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">{sessionName || "Untitled session"}</CardTitle>
                  <CardDescription>
                    {playerName || "No player"} - {sessionDate || "No date"} - {formatTraceTime(summary.durationMs)} duration - {points.length} samples
                  </CardDescription>
                </div>
                <Badge variant="secondary">In-memory replay</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center">
                <Button variant="outline" onClick={() => setCurrentIndex(0)} disabled={points.length === 0}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restart
                </Button>
                <Slider
                  value={[currentIndex]}
                  min={0}
                  max={Math.max(points.length - 1, 0)}
                  step={1}
                  disabled={points.length === 0}
                  onValueChange={([value]) => {
                    setCurrentIndex(value);
                    setIsPlaying(false);
                  }}
                />
                <Button onClick={() => setIsPlaying((playing) => !playing)} disabled={points.length <= 1}>
                  {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                  {isPlaying ? "Pause" : "Play"}
                </Button>
                <div className="flex gap-2">
                  <Button variant={showTrail ? "default" : "outline"} size="sm" onClick={() => setShowTrail((value) => !value)}>Trail</Button>
                  <Button variant={showEvents ? "default" : "outline"} size="sm" onClick={() => setShowEvents((value) => !value)}>Events</Button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-md border bg-emerald-950 p-3">
                  <svg viewBox="0 0 100 100" className="block aspect-[1.6/1] w-full">
                    <rect x="3" y="5" width="94" height="90" fill="#166534" stroke="#bbf7d0" strokeWidth="0.6" />
                    <line x1="50" y1="5" x2="50" y2="95" stroke="#bbf7d0" strokeWidth="0.45" />
                    <circle cx="50" cy="50" r="9" fill="none" stroke="#bbf7d0" strokeWidth="0.45" />
                    <path d="M 3 27 C 18 27 18 73 3 73" fill="none" stroke="#bbf7d0" strokeWidth="0.45" />
                    <path d="M 97 27 C 82 27 82 73 97 73" fill="none" stroke="#bbf7d0" strokeWidth="0.45" />
                    {showTrail && <polyline points={trailPoints} fill="none" stroke="#38bdf8" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />}
                    {showEvents && events.map((event) => (
                      <circle
                        key={`${event.timeMs}-${event.type}`}
                        cx={event.x}
                        cy={event.y}
                        r={event.type === "Sprint" ? 2.2 : 1.8}
                        fill={event.type === "Hit" ? "#fb923c" : event.type === "Trap" ? "#facc15" : "#a78bfa"}
                        stroke="#fff7ed"
                        strokeWidth="0.35"
                      />
                    ))}
                    {currentPoint && <circle cx={currentPoint.x} cy={currentPoint.y} r="2.5" fill="#fde047" stroke="#111827" strokeWidth="0.55" />}
                  </svg>
                </div>

                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead className="text-right">Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No events at this sensitivity.</TableCell>
                        </TableRow>
                      ) : (
                        events.slice(0, 12).map((event) => (
                          <TableRow
                            key={`${event.timeMs}-${event.type}-row`}
                            className={currentPoint && event.timeMs <= currentPoint.timeMs ? "bg-muted/40" : undefined}
                          >
                            <TableCell className="font-mono text-xs">{formatTraceTime(event.timeMs)}</TableCell>
                            <TableCell>{event.type}</TableCell>
                            <TableCell className="text-right">{event.confidence}%</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function uploadLabel(kind: UploadKind) {
  if (kind === "heartRate") return "heart rate";
  return kind;
}

function TraceUploadCard({
  id,
  title,
  description,
  count,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  count: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor={id} className="font-semibold">{title}</Label>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant={count > 0 ? "secondary" : "outline"}>{count > 0 ? `${count} rows` : "No file"}</Badge>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <Input id={id} type="file" accept=".csv,text/csv" onChange={onChange} />
      </div>
    </div>
  );
}

function TraceStat({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xl font-semibold">{value}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

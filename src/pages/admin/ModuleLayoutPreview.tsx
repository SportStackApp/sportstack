import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  FileCheck,
  FileWarning,
  Gauge,
  HeartPulse,
  ListChecks,
  Map,
  Play,
  Radar,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Upload,
  UserCheck,
  Users,
  Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ModuleKey = "risk" | "safety" | "umpire" | "trace";

type ModuleNote = {
  key: ModuleKey;
  name: string;
  source: string;
  status: string;
  fit: string;
  caution: string;
};

const moduleNotes: ModuleNote[] = [
  {
    key: "risk",
    name: "Hockey Risk Guard",
    source: "modules/Hockey Risk Guard",
    status: "Most complete risk module",
    fit: "Best base for a proper SportStack risk register, action plan, QI board, and audit history.",
    caution: "Separate Supabase tables and auth were found locally. This preview avoids those until a schema plan is approved.",
  },
  {
    key: "safety",
    name: "Hockey Safety Hub",
    source: "modules/Hockey Safety Hub",
    status: "Simpler safety workspace",
    fit: "Useful for a lighter club safety register with fast table-style editing.",
    caution: "Good layout reference, but it should share SportStack permissions and existing club/team scope.",
  },
  {
    key: "umpire",
    name: "Ballarat Umpire Hub",
    source: "modules/Ballarat Umpire Hub",
    status: "Voting portal plus admin backend",
    fit: "Strong candidate for umpire best-player voting, approval workflow, and leaderboards.",
    caution: "Branding can be removed later. Functionally it overlaps with SportStack voting patterns and should reuse token/private-link rules where possible.",
  },
  {
    key: "trace",
    name: "Hockey Trace Playback",
    source: "modules/Hockey Trace Playback",
    status: "Early sensor replay concept",
    fit: "A good future space for GPS, gyro, hit/trap detection, session replay, and player movement analysis.",
    caution: "This is experimental. The preview uses mock session data only, with no device import or storage yet.",
  },
];

const riskRows = [
  { id: "R-001", category: "Match day", title: "Player collision near interchange gate", rating: "High", owner: "Club safety", status: "Open", due: "12/07/2026" },
  { id: "R-002", category: "Facilities", title: "Wet entrance path after rain", rating: "Medium", owner: "Venue manager", status: "In Progress", due: "18/07/2026" },
  { id: "R-003", category: "Equipment", title: "Damaged goal net clips", rating: "Low", owner: "Team manager", status: "Controlled", due: "25/07/2026" },
];

const safetyRows = [
  { area: "First aid", item: "Restock match day kit", owner: "Home team", status: "Due soon" },
  { area: "Facilities", item: "Check lighting at pitch 2", owner: "Venue", status: "Open" },
  { area: "Incident review", item: "Review weekend collision report", owner: "Committee", status: "Under review" },
];

const leaderboardRows = [
  { rank: 1, player: "Mia Roberts", team: "Pumas", threes: 4, twos: 2, ones: 1, total: 17 },
  { rank: 2, player: "Sophie Clark", team: "Eureka", threes: 3, twos: 3, ones: 2, total: 17 },
  { rank: 3, player: "Emily Grant", team: "North", threes: 3, twos: 1, ones: 4, total: 15 },
];

const sensorEvents = [
  { time: "03:12", type: "Hit", zone: "Right baseline", confidence: 92 },
  { time: "08:48", type: "Trap", zone: "Centre corridor", confidence: 78 },
  { time: "14:20", type: "Sprint", zone: "Left wing", confidence: 86 },
  { time: "19:05", type: "Hit", zone: "Top circle", confidence: 88 },
];

const tracePoints = [
  [18, 82],
  [25, 70],
  [32, 64],
  [45, 59],
  [60, 50],
  [70, 40],
  [63, 30],
  [48, 25],
  [38, 34],
  [55, 46],
  [74, 58],
  [82, 70],
];

export default function ModuleLayoutPreview() {
  const [selectedModule, setSelectedModule] = useState<ModuleKey>("risk");
  const selectedNote = useMemo(
    () => moduleNotes.find((note) => note.key === selectedModule) ?? moduleNotes[0],
    [selectedModule],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Module Preview Lab</h1>
          <p className="text-sm text-muted-foreground">
            Read-only SportStack-style previews of the local Lovable modules. These are mock/reference screens only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Preview only</Badge>
          <Badge variant="outline">Mock data only</Badge>
          <Badge variant="outline">No live writes</Badge>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-2 p-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>
            This page is a planning reference. Use `/admin/umpire-voting`, `/admin/safety-risk`, and `/coaching/trace` for the current local prototypes.
          </span>
          <Badge variant="secondary">Not production workflow</Badge>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {moduleNotes.map((note) => (
          <Card key={note.key} className="min-w-0">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{note.name}</CardTitle>
                <ModuleIcon moduleKey={note.key} />
              </div>
              <CardDescription>{note.status}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{note.fit}</p>
              <p className="text-xs text-muted-foreground">{note.source}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={selectedModule} onValueChange={(value) => setSelectedModule(value as ModuleKey)} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="risk">Risk Guard</TabsTrigger>
          <TabsTrigger value="safety">Safety Hub</TabsTrigger>
          <TabsTrigger value="umpire">Umpire Hub</TabsTrigger>
          <TabsTrigger value="trace">Trace Playback</TabsTrigger>
        </TabsList>

        <Card className="min-w-0">
          <CardContent className="p-4">
            <div className="flex min-w-0 flex-col gap-1 text-sm md:flex-row md:items-center md:justify-between">
              <span className="font-medium">{selectedNote.name}</span>
              <span className="min-w-0 text-muted-foreground">{selectedNote.caution}</span>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="risk" className="space-y-4">
          <RiskGuardPreview />
        </TabsContent>

        <TabsContent value="safety" className="space-y-4">
          <SafetyHubPreview />
        </TabsContent>

        <TabsContent value="umpire" className="space-y-4">
          <UmpireHubPreview />
        </TabsContent>

        <TabsContent value="trace" className="space-y-4">
          <TracePlaybackPreview />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ModuleIcon({ moduleKey }: { moduleKey: ModuleKey }) {
  const className = "h-4 w-4 text-muted-foreground";
  if (moduleKey === "risk") return <ShieldCheck className={className} />;
  if (moduleKey === "safety") return <ClipboardCheck className={className} />;
  if (moduleKey === "umpire") return <Award className={className} />;
  return <Radar className={className} />;
}

function RiskGuardPreview() {
  return (
    <>
      <MetricGrid
        metrics={[
          { label: "Total risks", value: "42", icon: ShieldCheck },
          { label: "High / Very High", value: "8", icon: AlertTriangle },
          { label: "Open actions", value: "18", icon: ClipboardList },
          { label: "QI under review", value: "9", icon: Sparkles },
        ]}
      />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base">Risk Register</CardTitle>
                <CardDescription>Dense admin table with rating, owner, status, and review date.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline"><Search className="mr-2 h-4 w-4" />Search</Button>
                <Button size="sm"><FileWarning className="mr-2 h-4 w-4" />Add risk</Button>
              </div>
            </div>
          </CardHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riskRows.map((risk) => (
                  <TableRow key={risk.id}>
                    <TableCell className="font-mono text-xs">{risk.id}</TableCell>
                    <TableCell>{risk.category}</TableCell>
                    <TableCell className="min-w-64">{risk.title}</TableCell>
                    <TableCell><RiskRating rating={risk.rating} /></TableCell>
                    <TableCell>{risk.owner}</TableCell>
                    <TableCell>{risk.status}</TableCell>
                    <TableCell className="whitespace-nowrap">{risk.due}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Action And QI Board</CardTitle>
            <CardDescription>Shows the module as a real admin workflow, not just a table.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MiniProgress label="Overdue reviews" value={32} tone="bg-red-500" />
            <MiniProgress label="Actions in progress" value={68} tone="bg-blue-500" />
            <MiniProgress label="Controls verified" value={76} tone="bg-emerald-500" />
            <div className="rounded-md border p-3">
              <div className="text-sm font-medium">Next useful integration step</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Map risk ownership to SportStack association, club, division, and team scope.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SafetyHubPreview() {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4" />
            Club Safety Snapshot
          </CardTitle>
          <CardDescription>A simpler everyday workspace for smaller clubs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Open safety items", value: "14", icon: ListChecks },
            { label: "Due this week", value: "5", icon: Clock },
            { label: "Recently closed", value: "11", icon: CheckCircle2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center justify-between rounded-md border p-3">
              <span className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4 text-muted-foreground" />{label}</span>
              <span className="text-xl font-semibold">{value}</span>
            </div>
          ))}
          <Button className="w-full" variant="outline">Open safety checklist</Button>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base">Fast Edit Register</CardTitle>
              <CardDescription>Represents the local module's editable table style.</CardDescription>
            </div>
            <Button size="sm" variant="outline">Add row</Button>
          </div>
        </CardHeader>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safetyRows.map((row) => (
                <TableRow key={row.item}>
                  <TableCell>{row.area}</TableCell>
                  <TableCell className="min-w-64">{row.item}</TableCell>
                  <TableCell>{row.owner}</TableCell>
                  <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function UmpireHubPreview() {
  return (
    <>
      <MetricGrid
        metrics={[
          { label: "Submissions", value: "128", icon: FileCheck },
          { label: "Pending approval", value: "7", icon: Clock },
          { label: "Registered umpires", value: "34", icon: UserCheck },
          { label: "Active fixtures", value: "22", icon: Trophy },
        ]}
      />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.4fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Umpire Vote Flow</CardTitle>
            <CardDescription>Mobile-first match selection and player vote lodging.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              {["Match", "Vote", "Confirm"].map((step, index) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${index < 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {index + 1}
                  </div>
                  {index < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <LabeledValue label="Round" value="Round 12" />
              <LabeledValue label="Division" value="Women A Grade" />
              <LabeledValue label="Fixture" value="Pumas vs Eureka" />
            </div>

            {[3, 2, 1].map((votes) => (
              <div key={votes} className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Badge className={votes === 3 ? "bg-amber-500 text-white hover:bg-amber-500" : ""}>{votes}</Badge>
                  <span className="text-sm font-medium">{votes === 3 ? "Best on ground" : votes === 2 ? "Second best" : "Third best"}</span>
                </div>
                <div className="grid grid-cols-[1fr_72px] gap-2">
                  <Input value={votes === 3 ? "Mia Roberts" : ""} readOnly placeholder="Player name" />
                  <Input value={votes === 3 ? "14" : ""} readOnly placeholder="#" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base">Admin Review And Leaderboard</CardTitle>
                <CardDescription>Approve submissions, export CSVs, and track season totals.</CardDescription>
              </div>
              <Button size="sm" variant="outline"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
            </div>
          </CardHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-center">3s</TableHead>
                  <TableHead className="text-center">2s</TableHead>
                  <TableHead className="text-center">1s</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboardRows.map((row) => (
                  <TableRow key={row.player}>
                    <TableCell className="font-semibold">{row.rank}</TableCell>
                    <TableCell>{row.player}</TableCell>
                    <TableCell>{row.team}</TableCell>
                    <TableCell className="text-center">{row.threes}</TableCell>
                    <TableCell className="text-center">{row.twos}</TableCell>
                    <TableCell className="text-center">{row.ones}</TableCell>
                    <TableCell className="text-center text-lg font-semibold">{row.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </>
  );
}

function TracePlaybackPreview() {
  return (
    <>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" />
              Session Intake
            </CardTitle>
            <CardDescription>Represents CSV or device upload without actually storing anything.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { title: "Motion / gyro", description: "accel_x/y/z and gyro_x/y/z", count: "48,200 rows" },
              { title: "GPS path", description: "latitude, longitude, speed", count: "2,430 points" },
              { title: "Heart rate", description: "optional bpm stream", count: "1,180 rows" },
            ].map((file) => (
              <div key={file.title} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{file.title}</div>
                    <div className="text-xs text-muted-foreground">{file.description}</div>
                  </div>
                  <Badge variant="secondary">{file.count}</Badge>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Player</Label>
                <Input value="A. Singh" readOnly className="mt-1" />
              </div>
              <div>
                <Label>Session</Label>
                <Input value="Training drill" readOnly className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Map className="h-4 w-4" />
                  Pitch Replay
                </CardTitle>
                <CardDescription>GPS movement path with detected stick events.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">Demo mode</Badge>
                <Badge variant="outline">1.5x speed</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-md border bg-emerald-950 p-3">
                <svg viewBox="0 0 100 115" className="block w-full">
                  {/* Static preview of the future replay surface. */}
                  <rect x="2" y="2" width="96" height="111" fill="none" stroke="#a7f3d0" strokeWidth="0.5" />
                  <line x1="2" y1="57.5" x2="98" y2="57.5" stroke="#a7f3d0" strokeWidth="0.4" />
                  <circle cx="50" cy="57.5" r="9" fill="none" stroke="#a7f3d0" strokeWidth="0.4" />
                  <path d="M 25 2 A 25 18 0 0 0 75 2" fill="none" stroke="#a7f3d0" strokeWidth="0.4" />
                  <path d="M 25 113 A 25 18 0 0 1 75 113" fill="none" stroke="#a7f3d0" strokeWidth="0.4" />
                  <polyline
                    points={tracePoints.map(([x, y]) => `${x},${y}`).join(" ")}
                    fill="none"
                    stroke="#38bdf8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                  />
                  {tracePoints.map(([x, y], index) => (
                    <circle key={`${x}-${y}`} cx={x} cy={y} r={index % 3 === 0 ? 2.1 : 1.2} fill={index % 3 === 0 ? "#f59e0b" : "#22c55e"} />
                  ))}
                  <circle cx="82" cy="70" r="3.5" fill="#f97316" stroke="#fff7ed" strokeWidth="0.7" />
                </svg>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <StatTile icon={Gauge} label="Top speed" value="7.8 m/s" />
                  <StatTile icon={Activity} label="Distance" value="3.2 km" />
                  <StatTile icon={HeartPulse} label="Avg HR" value="151" />
                  <StatTile icon={Waves} label="Events" value="24" />
                </div>
                <Button className="w-full"><Play className="mr-2 h-4 w-4" />Replay session</Button>
                <Button className="w-full" variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4" />Detection settings</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-base">Detected Events</CardTitle>
          <CardDescription>Early idea for hit, trap, sprint, and workload review.</CardDescription>
        </CardHeader>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Pitch zone</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sensorEvents.map((event) => (
                <TableRow key={`${event.time}-${event.type}`}>
                  <TableCell className="font-mono text-xs">{event.time}</TableCell>
                  <TableCell>{event.type}</TableCell>
                  <TableCell>{event.zone}</TableCell>
                  <TableCell>
                    <div className="flex min-w-40 items-center gap-2">
                      <div className="h-2 flex-1 rounded bg-muted">
                        <div className="h-2 rounded bg-primary" style={{ width: `${event.confidence}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs text-muted-foreground">{event.confidence}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}

function MetricGrid({ metrics }: { metrics: Array<{ label: string; value: string; icon: typeof ShieldCheck }> }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map(({ label, value, icon: Icon }) => (
        <Card key={label} className="min-w-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-semibold">{value}</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MiniProgress({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{value}%</span>
      </div>
      <div className="h-2 rounded bg-muted">
        <div className={`h-2 rounded ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function LabeledValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <Icon className="mb-2 h-4 w-4 text-muted-foreground" />
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function RiskRating({ rating }: { rating: string }) {
  const className =
    rating === "High"
      ? "bg-orange-100 text-orange-800"
      : rating === "Medium"
        ? "bg-amber-100 text-amber-800"
        : "bg-blue-100 text-blue-800";

  return <span className={`rounded px-2 py-1 text-xs font-medium ${className}`}>{rating}</span>;
}

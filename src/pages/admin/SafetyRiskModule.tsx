import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Eye,
  FileClock,
  Filter,
  History,
  Lightbulb,
  Link2,
  ListChecks,
  Plus,
  Search,
  ShieldCheck,
  Target,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useToast } from "@/hooks/use-toast";
import { useTeamContext } from "@/contexts/TeamContext";
import { cn } from "@/lib/utils";

type RiskRating = "Low" | "Medium" | "High" | "Very High";
type ReviewState = "Current" | "Due soon" | "Overdue";
type DueState = "Current" | "Due soon" | "Overdue" | "Complete";

interface RiskRecord {
  kind: "risk";
  id: string;
  title: string;
  summary: string;
  category: string;
  type: string;
  owner: string;
  scope: string;
  status: "Open" | "In progress" | "Controlled" | "Closed";
  inherentRating: RiskRating;
  residualRating: RiskRating;
  targetRating: RiskRating;
  likelihood: string;
  consequence: string;
  existingControls: string;
  treatmentPlan: string;
  lastReview: string;
  nextReview: string;
  reviewState: ReviewState;
  linkedActions: string[];
  linkedQi: string[];
  evidence: string;
}

interface ActionRecord {
  kind: "action";
  id: string;
  title: string;
  owner: string;
  status: "Not started" | "In progress" | "Blocked" | "Complete";
  dueDate: string;
  dueState: DueState;
  linkedRiskId?: string;
  linkedQiId?: string;
  baseline: string;
  evaluate: string;
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
}

interface QiRecord {
  kind: "qi";
  id: string;
  title: string;
  source: string;
  area: string;
  owner: string;
  priority: "Low" | "Medium" | "High";
  status: "New" | "Awaiting decision" | "Approved" | "In progress" | "Complete";
  dueDate: string;
  dueState: DueState;
  issue: string;
  requiredAction: string;
  outcome: string;
  linkedRiskId?: string;
  linkedActionId?: string;
  linkedIdeaId?: string;
}

interface BrightIdeaRecord {
  kind: "idea";
  id: string;
  title: string;
  submittedBy: string;
  submittedDate: string;
  scope: string;
  status: "Submitted" | "Under review" | "Accepted" | "Deferred" | "Closed";
  decision: "Pending" | "Accept" | "Defer" | "Reject" | "Close";
  whyNeeded: string;
  suggestedImplementation: string;
  suggestedEvaluation: string;
  couldAssist: string;
  committeeNotes: string;
  linkedRecordId?: string;
}

interface AuditRecord {
  kind: "audit";
  id: string;
  date: string;
  user: string;
  record: string;
  recordType: "Risk" | "Action" | "QI" | "Bright Idea";
  action: string;
  fieldChanged: string;
  previousValue: string;
  newValue: string;
  reason: string;
}

type SafetyRecord = RiskRecord | ActionRecord | QiRecord | BrightIdeaRecord | AuditRecord;
type SafetyFormMode = "risk" | "action" | "qi" | "idea" | "committee-review" | "risk-review";

interface SafetyFormContext {
  riskId?: string;
  actionId?: string;
  qiId?: string;
  ideaId?: string;
}

interface OpenFormOptions {
  mode: SafetyFormMode;
  context?: SafetyFormContext;
}

interface ChartDatum {
  name: string;
  value: number;
  fill: string;
}

const ratingOrder: RiskRating[] = ["Very High", "High", "Medium", "Low"];
const statusOptions = ["__all__", "Open", "In progress", "Controlled", "Closed"];
const ratingOptions = ["__all__", ...ratingOrder];
const dueSoonDays = 30;
const formLikelihoodOptions = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const formConsequenceOptions = ["Insignificant", "Minor", "Moderate", "Major", "Severe"];
const reviewFrequencyOptions = ["Monthly", "Quarterly", "Six monthly", "Annual"];
const ideaDecisionOptions = ["Pending", "Accept", "Defer", "Reject", "Close"];
const conversionOptions = ["Create risk", "Create action", "Create QI item", "Link to existing record", "Close without conversion"];

const ratingStyles: Record<RiskRating, string> = {
  Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-800",
  High: "border-orange-200 bg-orange-50 text-orange-800",
  "Very High": "border-rose-200 bg-rose-50 text-rose-800",
};

const ratingColours: Record<RiskRating, string> = {
  Low: "#059669",
  Medium: "#d97706",
  High: "#ea580c",
  "Very High": "#be123c",
};

const risks: RiskRecord[] = [
  {
    kind: "risk",
    id: "R-001",
    title: "Serious player injury during a match",
    summary: "First response, ambulance access and sideline role clarity need tighter review.",
    category: "Player safety",
    type: "Operational",
    owner: "Safety Lead",
    scope: "Hockey Ballarat",
    status: "In progress",
    inherentRating: "Very High",
    residualRating: "Very High",
    targetRating: "Medium",
    likelihood: "Possible",
    consequence: "Severe",
    existingControls: "First-aid kits, nominated ground marshal and emergency contact list.",
    treatmentPlan: "Confirm first-aid roster, mark ambulance access points and brief team managers.",
    lastReview: "02/05/2026",
    nextReview: "02/07/2026",
    reviewState: "Overdue",
    linkedActions: ["A-001", "A-004"],
    linkedQi: ["QI-004"],
    evidence: "Venue emergency checklist and committee minute reference.",
  },
  {
    kind: "risk",
    id: "R-002",
    title: "Concussion process is not followed consistently",
    summary: "Volunteer coaches need a simple decision path for suspected concussion.",
    category: "Player safety",
    type: "Clinical",
    owner: "Participation Officer",
    scope: "Association",
    status: "Open",
    inherentRating: "Very High",
    residualRating: "High",
    targetRating: "Medium",
    likelihood: "Likely",
    consequence: "Major",
    existingControls: "Policy exists, but practical match-day prompts are inconsistent.",
    treatmentPlan: "Create one-page prompt and add it to coach packs and venue folders.",
    lastReview: "14/06/2026",
    nextReview: "25/07/2026",
    reviewState: "Due soon",
    linkedActions: ["A-002"],
    linkedQi: ["QI-001"],
    evidence: "Policy link, incident debrief notes.",
  },
  {
    kind: "risk",
    id: "R-003",
    title: "Child safety incident escalation pathway",
    summary: "Committee members need confidence that escalation roles and contacts are current.",
    category: "Child safety",
    type: "Governance",
    owner: "Child Safety Officer",
    scope: "Stawell Hockey Club",
    status: "Controlled",
    inherentRating: "High",
    residualRating: "Low",
    targetRating: "Low",
    likelihood: "Rare",
    consequence: "Severe",
    existingControls: "Named officer, published escalation contacts and annual policy review.",
    treatmentPlan: "Keep contacts current and include the escalation pathway in induction.",
    lastReview: "12/06/2026",
    nextReview: "12/09/2026",
    reviewState: "Current",
    linkedActions: ["A-003"],
    linkedQi: [],
    evidence: "Policy register and induction checklist.",
  },
  {
    kind: "risk",
    id: "R-004",
    title: "Extreme weather at outdoor venues",
    summary: "Heat, lightning and poor air quality decisions need clear match-day ownership.",
    category: "Venue safety",
    type: "Environmental",
    owner: "Venue Coordinator",
    scope: "Association",
    status: "Open",
    inherentRating: "High",
    residualRating: "Medium",
    targetRating: "Medium",
    likelihood: "Possible",
    consequence: "Major",
    existingControls: "Weather policy and venue inspection process.",
    treatmentPlan: "Add threshold prompts to fixture-day run sheet.",
    lastReview: "18/05/2026",
    nextReview: "18/08/2026",
    reviewState: "Current",
    linkedActions: ["A-005"],
    linkedQi: ["QI-002"],
    evidence: "Weather policy and match-day checklist.",
  },
  {
    kind: "risk",
    id: "R-005",
    title: "Working With Children Check tracking gaps",
    summary: "Manual spreadsheet tracking makes expiry follow-up easy to miss.",
    category: "Compliance",
    type: "Governance",
    owner: "Secretary",
    scope: "Association",
    status: "In progress",
    inherentRating: "High",
    residualRating: "Medium",
    targetRating: "Low",
    likelihood: "Possible",
    consequence: "Moderate",
    existingControls: "Spreadsheet and annual reminders.",
    treatmentPlan: "Move to structured review list with expiry alerts.",
    lastReview: "01/06/2026",
    nextReview: "01/08/2026",
    reviewState: "Current",
    linkedActions: ["A-006"],
    linkedQi: ["QI-003"],
    evidence: "Volunteer register extract.",
  },
  {
    kind: "risk",
    id: "R-006",
    title: "Volunteer burnout during finals",
    summary: "A small group covers too many operational roles late in the season.",
    category: "People",
    type: "Operational",
    owner: "Committee",
    scope: "Association",
    status: "Open",
    inherentRating: "Medium",
    residualRating: "Medium",
    targetRating: "Low",
    likelihood: "Likely",
    consequence: "Moderate",
    existingControls: "Volunteer roster and committee escalation.",
    treatmentPlan: "Split finals roles and publish a small task list by club.",
    lastReview: "08/06/2026",
    nextReview: "08/09/2026",
    reviewState: "Current",
    linkedActions: [],
    linkedQi: [],
    evidence: "Finals planning notes.",
  },
  {
    kind: "risk",
    id: "R-007",
    title: "Umpire abuse reporting is too informal",
    summary: "Incidents are discussed but not always recorded in a consistent place.",
    category: "Behaviour",
    type: "Conduct",
    owner: "Umpire Coordinator",
    scope: "Association",
    status: "Open",
    inherentRating: "High",
    residualRating: "High",
    targetRating: "Medium",
    likelihood: "Possible",
    consequence: "Major",
    existingControls: "Code of conduct and umpire coordinator review.",
    treatmentPlan: "Create a short incident capture flow and committee review rhythm.",
    lastReview: "22/05/2026",
    nextReview: "22/07/2026",
    reviewState: "Due soon",
    linkedActions: ["A-007"],
    linkedQi: [],
    evidence: "Umpire debrief notes.",
  },
  {
    kind: "risk",
    id: "R-008",
    title: "Equipment register is incomplete",
    summary: "Shared equipment ownership and replacement timing is unclear.",
    category: "Assets",
    type: "Operational",
    owner: "Equipment Officer",
    scope: "Club",
    status: "Controlled",
    inherentRating: "Medium",
    residualRating: "Low",
    targetRating: "Low",
    likelihood: "Unlikely",
    consequence: "Moderate",
    existingControls: "Annual stocktake and club storage list.",
    treatmentPlan: "Add photo-backed register and replacement review.",
    lastReview: "10/06/2026",
    nextReview: "10/10/2026",
    reviewState: "Current",
    linkedActions: [],
    linkedQi: ["QI-005"],
    evidence: "Stocktake list.",
  },
];

const actions: ActionRecord[] = [
  {
    kind: "action",
    id: "A-001",
    title: "Confirm first-aid roster for every senior match",
    owner: "Safety Lead",
    status: "In progress",
    dueDate: "15/07/2026",
    dueState: "Due soon",
    linkedRiskId: "R-001",
    baseline: "Rosters are held by each team and not visible to the association.",
    evaluate: "Check every fixture has a named first-aid contact.",
    specific: "Publish a single fixture-linked first-aid roster.",
    measurable: "100% of senior fixtures have a named contact.",
    achievable: "Team managers confirm by Thursday before each round.",
    relevant: "Reduces delay during serious injury response.",
    timeBound: "Review weekly until finals.",
  },
  {
    kind: "action",
    id: "A-002",
    title: "Create one-page concussion prompt for coaches",
    owner: "Participation Officer",
    status: "Not started",
    dueDate: "25/07/2026",
    dueState: "Due soon",
    linkedRiskId: "R-002",
    linkedQiId: "QI-001",
    baseline: "Policy is available but too long for sideline use.",
    evaluate: "Coach feedback after two rounds.",
    specific: "Produce a laminated sideline prompt.",
    measurable: "All teams receive the same prompt.",
    achievable: "Use existing policy wording.",
    relevant: "Improves match-day decision consistency.",
    timeBound: "Ready before 25/07/2026.",
  },
  {
    kind: "action",
    id: "A-003",
    title: "Refresh child safety contact list",
    owner: "Child Safety Officer",
    status: "Complete",
    dueDate: "30/06/2026",
    dueState: "Complete",
    linkedRiskId: "R-003",
    baseline: "Old contact list was split across documents.",
    evaluate: "Committee checks list at monthly meeting.",
    specific: "Update and publish the current contact list.",
    measurable: "One approved list in the policy folder.",
    achievable: "Contacts already confirmed.",
    relevant: "Keeps escalation clear.",
    timeBound: "Completed 30/06/2026.",
  },
  {
    kind: "action",
    id: "A-004",
    title: "Mark ambulance access gates on venue maps",
    owner: "Venue Coordinator",
    status: "Blocked",
    dueDate: "05/07/2026",
    dueState: "Overdue",
    linkedRiskId: "R-001",
    baseline: "Venue maps do not show emergency access.",
    evaluate: "Spot check maps with ground marshals.",
    specific: "Add access gates to each venue map.",
    measurable: "All active venues have updated maps.",
    achievable: "Needs council confirmation for two venues.",
    relevant: "Speeds emergency access.",
    timeBound: "Original due date 05/07/2026.",
  },
  {
    kind: "action",
    id: "A-005",
    title: "Add weather threshold prompts to run sheet",
    owner: "Venue Coordinator",
    status: "In progress",
    dueDate: "20/08/2026",
    dueState: "Current",
    linkedRiskId: "R-004",
    linkedQiId: "QI-002",
    baseline: "Weather decisions rely on experienced volunteers.",
    evaluate: "Review two weather-affected rounds.",
    specific: "Add heat, lightning and smoke prompts.",
    measurable: "Prompt appears in the run sheet.",
    achievable: "Use existing policy thresholds.",
    relevant: "Supports consistent decisions.",
    timeBound: "Before 20/08/2026.",
  },
  {
    kind: "action",
    id: "A-006",
    title: "Build WWCC expiry review list",
    owner: "Secretary",
    status: "In progress",
    dueDate: "01/08/2026",
    dueState: "Current",
    linkedRiskId: "R-005",
    linkedQiId: "QI-003",
    baseline: "Expiry dates are checked manually.",
    evaluate: "Compare against current volunteer register.",
    specific: "Create an expiry review list for committee.",
    measurable: "Every active volunteer has a status.",
    achievable: "Secretary has the source register.",
    relevant: "Supports compliance tracking.",
    timeBound: "Before 01/08/2026.",
  },
  {
    kind: "action",
    id: "A-007",
    title: "Draft umpire incident capture form",
    owner: "Umpire Coordinator",
    status: "Not started",
    dueDate: "18/07/2026",
    dueState: "Due soon",
    linkedRiskId: "R-007",
    baseline: "Reports are mostly verbal.",
    evaluate: "Review form use after one month.",
    specific: "Create a short form for umpire incidents.",
    measurable: "Reports include date, fixture, incident and follow-up.",
    achievable: "Can start as a simple committee form.",
    relevant: "Improves behaviour trend review.",
    timeBound: "Draft by 18/07/2026.",
  },
];

const qiItems: QiRecord[] = [
  {
    kind: "qi",
    id: "QI-001",
    title: "Concussion sideline decision aid",
    source: "Risk review",
    area: "Player welfare",
    owner: "Participation Officer",
    priority: "High",
    status: "Approved",
    dueDate: "25/07/2026",
    dueState: "Due soon",
    issue: "Coaches need a fast, consistent decision aid.",
    requiredAction: "Design, approve and distribute a one-page prompt.",
    outcome: "Pending implementation.",
    linkedRiskId: "R-002",
    linkedActionId: "A-002",
  },
  {
    kind: "qi",
    id: "QI-002",
    title: "Fixture-day weather decision checklist",
    source: "Committee review",
    area: "Venue safety",
    owner: "Venue Coordinator",
    priority: "Medium",
    status: "In progress",
    dueDate: "20/08/2026",
    dueState: "Current",
    issue: "Weather calls are not always recorded.",
    requiredAction: "Add prompts to the fixture-day run sheet.",
    outcome: "Draft checklist in progress.",
    linkedRiskId: "R-004",
    linkedActionId: "A-005",
  },
  {
    kind: "qi",
    id: "QI-003",
    title: "Volunteer compliance tracking",
    source: "Audit",
    area: "Governance",
    owner: "Secretary",
    priority: "High",
    status: "Awaiting decision",
    dueDate: "01/08/2026",
    dueState: "Current",
    issue: "Volunteer checks need easier expiry review.",
    requiredAction: "Confirm the preferred register and review owner.",
    outcome: "Awaiting committee decision.",
    linkedRiskId: "R-005",
    linkedActionId: "A-006",
  },
  {
    kind: "qi",
    id: "QI-004",
    title: "Digital venue emergency checks",
    source: "Bright Idea",
    area: "Emergency response",
    owner: "Safety Lead",
    priority: "High",
    status: "Awaiting decision",
    dueDate: "15/07/2026",
    dueState: "Due soon",
    issue: "Ground marshals need a repeatable pre-game check.",
    requiredAction: "Review whether the Bright Idea should become a formal action.",
    outcome: "Committee review pending.",
    linkedRiskId: "R-001",
    linkedIdeaId: "BI-002",
  },
  {
    kind: "qi",
    id: "QI-005",
    title: "Photo-backed equipment register",
    source: "Bright Idea",
    area: "Assets",
    owner: "Equipment Officer",
    priority: "Medium",
    status: "New",
    dueDate: "10/10/2026",
    dueState: "Current",
    issue: "Equipment condition and replacement timing is unclear.",
    requiredAction: "Trial a simple register with photos.",
    outcome: "Not started.",
    linkedRiskId: "R-008",
    linkedIdeaId: "BI-001",
  },
  {
    kind: "qi",
    id: "QI-006",
    title: "Committee decision tracker",
    source: "Internal review",
    area: "Governance",
    owner: "Secretary",
    priority: "Medium",
    status: "Complete",
    dueDate: "30/06/2026",
    dueState: "Complete",
    issue: "Decisions were hard to trace across minutes.",
    requiredAction: "Create a simple decision list.",
    outcome: "Live in committee pack.",
  },
];

const brightIdeas: BrightIdeaRecord[] = [
  {
    kind: "idea",
    id: "BI-001",
    title: "Equipment register with photos",
    submittedBy: "Alex Smith",
    submittedDate: "18/06/2026",
    scope: "Stawell Hockey Club",
    status: "Accepted",
    decision: "Accept",
    whyNeeded: "Shared equipment is hard to track and condition is not visible.",
    suggestedImplementation: "Take a photo during stocktake and store condition, location and owner.",
    suggestedEvaluation: "Review whether lost or duplicated equipment purchases reduce.",
    couldAssist: "Equipment Officer and club team managers.",
    committeeNotes: "Accepted as a small QI trial before finals.",
    linkedRecordId: "QI-005",
  },
  {
    kind: "idea",
    id: "BI-002",
    title: "Digital venue safety checklist",
    submittedBy: "Jordan Lee",
    submittedDate: "21/06/2026",
    scope: "Association",
    status: "Under review",
    decision: "Pending",
    whyNeeded: "Paper venue checks do not always make it back to committee.",
    suggestedImplementation: "Ground marshal completes a short digital checklist before the first game.",
    suggestedEvaluation: "Track completion rate by venue for four rounds.",
    couldAssist: "Ground marshals and Safety Lead.",
    committeeNotes: "Needs review against current emergency process.",
    linkedRecordId: "QI-004",
  },
  {
    kind: "idea",
    id: "BI-003",
    title: "Umpire debrief form",
    submittedBy: "Priya Jones",
    submittedDate: "25/06/2026",
    scope: "Association",
    status: "Submitted",
    decision: "Pending",
    whyNeeded: "Young umpires need a simple place to raise concerns.",
    suggestedImplementation: "Send a short debrief link after matches.",
    suggestedEvaluation: "Review themes monthly with umpire coordinator.",
    couldAssist: "Umpire mentors.",
    committeeNotes: "Not yet reviewed.",
  },
  {
    kind: "idea",
    id: "BI-004",
    title: "Volunteer finals micro-roster",
    submittedBy: "Sam Taylor",
    submittedDate: "29/06/2026",
    scope: "Association",
    status: "Deferred",
    decision: "Defer",
    whyNeeded: "Finals work falls to the same few people.",
    suggestedImplementation: "Break finals duties into small named jobs by club.",
    suggestedEvaluation: "Compare fill rate with last season.",
    couldAssist: "Club secretaries.",
    committeeNotes: "Good idea, but deferred until the fixture is final.",
  },
  {
    kind: "idea",
    id: "BI-005",
    title: "QR code for incident reporting",
    submittedBy: "Morgan Clark",
    submittedDate: "02/07/2026",
    scope: "Association",
    status: "Submitted",
    decision: "Pending",
    whyNeeded: "People forget where incident forms are stored.",
    suggestedImplementation: "Place QR codes in venue folders and change rooms.",
    suggestedEvaluation: "Check if incident records become more complete.",
    couldAssist: "Venue Coordinator.",
    committeeNotes: "Not yet reviewed.",
  },
];

const auditEvents: AuditRecord[] = [
  {
    kind: "audit",
    id: "AU-001",
    date: "08/07/2026 7:42 pm",
    user: "Safety Lead",
    record: "R-001",
    recordType: "Risk",
    action: "Updated",
    fieldChanged: "Residual rating",
    previousValue: "Very High",
    newValue: "High",
    reason: "First-aid roster control added.",
  },
  {
    kind: "audit",
    id: "AU-002",
    date: "07/07/2026 6:15 pm",
    user: "Secretary",
    record: "QI-003",
    recordType: "QI",
    action: "Created",
    fieldChanged: "Status",
    previousValue: "-",
    newValue: "Awaiting decision",
    reason: "Compliance audit follow-up.",
  },
  {
    kind: "audit",
    id: "AU-003",
    date: "05/07/2026 9:04 am",
    user: "Venue Coordinator",
    record: "A-004",
    recordType: "Action",
    action: "Status changed",
    fieldChanged: "Status",
    previousValue: "In progress",
    newValue: "Blocked",
    reason: "Waiting on council access confirmation.",
  },
  {
    kind: "audit",
    id: "AU-004",
    date: "01/07/2026 8:20 pm",
    user: "Committee",
    record: "BI-001",
    recordType: "Bright Idea",
    action: "Decision recorded",
    fieldChanged: "Decision",
    previousValue: "Pending",
    newValue: "Accept",
    reason: "Useful small QI trial.",
  },
  {
    kind: "audit",
    id: "AU-005",
    date: "30/06/2026 5:55 pm",
    user: "Child Safety Officer",
    record: "A-003",
    recordType: "Action",
    action: "Completed",
    fieldChanged: "Status",
    previousValue: "In progress",
    newValue: "Complete",
    reason: "Updated list published.",
  },
];

const riskMatrix: RiskRating[][] = [
  ["Low", "Low", "Low", "Medium", "High"],
  ["Low", "Low", "Medium", "High", "High"],
  ["Low", "Medium", "Medium", "High", "High"],
  ["Medium", "Medium", "Medium", "High", "Very High"],
  ["Medium", "Medium", "High", "Very High", "Very High"],
];

const likelihoodLabels = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const consequenceLabels = ["Insignificant", "Minor", "Moderate", "Major", "Severe"];

export default function SafetyRiskModule() {
  const { toast } = useToast();
  const { loading: scopeLoading, isAnyAdmin } = useAdminScope();
  const {
    selectedAssociation,
    selectedClub,
    selectedTeam,
  } = useTeamContext();
  const [activeRecord, setActiveRecord] = useState<SafetyRecord | null>(null);
  const [riskSearch, setRiskSearch] = useState("");
  const [riskRating, setRiskRating] = useState("__all__");
  const [riskStatus, setRiskStatus] = useState("__all__");
  const [riskCategory, setRiskCategory] = useState("__all__");
  const [formMode, setFormMode] = useState<SafetyFormMode | null>(null);
  const [formContext, setFormContext] = useState<SafetyFormContext>({});
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formStep, setFormStep] = useState(0);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [formDirty, setFormDirty] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [prototypeSaveMessage, setPrototypeSaveMessage] = useState<string | null>(null);

  const scopeLabel = selectedTeam?.name || selectedClub?.name || selectedAssociation?.name || "All accessible organisations";

  const openForm = ({ mode, context = {} }: OpenFormOptions) => {
    setActiveRecord(null);
    setFormMode(mode);
    setFormContext(context);
    setFormValues(createInitialFormValues(mode, context, scopeLabel));
    setFormStep(0);
    setFormErrors([]);
    setFormDirty(false);
    setPrototypeSaveMessage(null);
  };

  const updateFormValue = (field: string, value: string) => {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormDirty(true);
    if (formErrors.length > 0) setFormErrors([]);
  };

  const requestFormClose = () => {
    if (formDirty) {
      setShowUnsavedWarning(true);
      return;
    }
    closeForm();
  };

  const closeForm = () => {
    setShowUnsavedWarning(false);
    setFormMode(null);
    setFormContext({});
    setFormValues({});
    setFormStep(0);
    setFormErrors([]);
    setFormDirty(false);
    setPrototypeSaveMessage(null);
  };

  const submitForm = () => {
    if (!formMode) return;
    const errors = validateSafetyForm(formMode, formValues);
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    const message = getPrototypeSaveMessage(formMode, formContext);
    setPrototypeSaveMessage(message);
    setFormDirty(false);
    toast({
      title: "Prototype form saved",
      description: message,
    });
  };

  const riskCategories = useMemo(
    () => Array.from(new Set(risks.map((risk) => risk.category))).sort(),
    [],
  );

  const filteredRisks = useMemo(() => {
    const search = riskSearch.trim().toLowerCase();
    return risks.filter((risk) => {
      const matchesSearch =
        !search ||
        [risk.id, risk.title, risk.summary, risk.category, risk.owner]
          .some((value) => value.toLowerCase().includes(search));
      const matchesRating = riskRating === "__all__" || risk.residualRating === riskRating;
      const matchesStatus = riskStatus === "__all__" || risk.status === riskStatus;
      const matchesCategory = riskCategory === "__all__" || risk.category === riskCategory;
      return matchesSearch && matchesRating && matchesStatus && matchesCategory;
    });
  }, [riskCategory, riskRating, riskSearch, riskStatus]);

  const ratingData = useMemo(
    () => ratingOrder.map((rating) => ({
      name: rating,
      value: risks.filter((risk) => risk.residualRating === rating).length,
      fill: ratingColours[rating],
    })),
    [],
  );

  const actionStatusData = useMemo(() => {
    const statuses = ["Not started", "In progress", "Blocked", "Complete"];
    return statuses.map((status) => ({
      name: status,
      value: actions.filter((action) => action.status === status).length,
      fill: status === "Complete" ? "#059669" : status === "Blocked" ? "#be123c" : "#2563eb",
    }));
  }, []);

  const categoryData = useMemo(
    () => riskCategories.map((category) => ({
      name: category,
      value: risks.filter((risk) => risk.category === category).length,
      fill: "#2563eb",
    })),
    [riskCategories],
  );

  const qiStatusData = useMemo(() => {
    const statuses = ["New", "Awaiting decision", "Approved", "In progress", "Complete"];
    return statuses.map((status) => ({
      name: status,
      value: qiItems.filter((item) => item.status === status).length,
      fill: status === "Complete" ? "#059669" : status === "Awaiting decision" ? "#d97706" : "#2563eb",
    }));
  }, []);

  const highestRisks = [...risks]
    .sort((a, b) => ratingOrder.indexOf(a.residualRating) - ratingOrder.indexOf(b.residualRating))
    .slice(0, 5);
  const overdueActions = actions.filter((action) => action.dueState === "Overdue").length;
  const dueSoonActions = actions.filter((action) => action.dueState === "Due soon").length;
  const awaitingQi = qiItems.filter((item) => item.status === "Awaiting decision").length;
  const awaitingIdeas = brightIdeas.filter((idea) => idea.decision === "Pending").length;
  const overdueReviews = risks.filter((risk) => risk.reviewState === "Overdue").length;
  const risksWithoutOwners = risks.filter((risk) => risk.owner === "Committee").length;
  const risksWithoutControls = risks.filter((risk) => !risk.existingControls.trim()).length;
  const aboveTarget = risks.filter((risk) => ratingOrder.indexOf(risk.residualRating) < ratingOrder.indexOf(risk.targetRating)).length;
  const combinedDueItems = [
    ...risks
      .filter((risk) => risk.reviewState !== "Current")
      .map((risk) => ({
        type: "Review",
        id: risk.id,
        description: risk.title,
        owner: risk.owner,
        due: risk.nextReview,
        state: risk.reviewState,
        record: risk as SafetyRecord,
      })),
    ...actions
      .filter((action) => action.dueState !== "Complete")
      .map((action) => ({
        type: "Action",
        id: action.id,
        description: action.title,
        owner: action.owner,
        due: action.dueDate,
        state: action.dueState,
        record: action as SafetyRecord,
      })),
    ...qiItems
      .filter((item) => item.dueState !== "Complete" && item.status !== "Complete")
      .map((item) => ({
        type: "QI",
        id: item.id,
        description: item.title,
        owner: item.owner,
        due: item.dueDate,
        state: item.dueState,
        record: item as SafetyRecord,
      })),
  ].slice(0, 8);

  if (scopeLoading) {
    return <LoadingState />;
  }

  if (!isAnyAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Safety Hub</CardTitle>
          <CardDescription>You need an admin role to view this module.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Safety Hub</h1>
            <Badge variant="outline">Prototype</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Risk, actions, QI and Bright Ideas review surface for {scopeLabel}.
          </p>
        </div>
        <AddRecordButton onOpenForm={(mode) => openForm({ mode })} />
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="risks">Risk Register</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="qi">QI Register</TabsTrigger>
          <TabsTrigger value="ideas">Bright Ideas</TabsTrigger>
          <TabsTrigger value="matrix">Matrix & Guidance</TabsTrigger>
          <TabsTrigger value="audit">Audit History</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard icon={ShieldCheck} label="Total risks" value={risks.length} />
            <MetricCard icon={AlertTriangle} label="Very high risks" value={risks.filter((risk) => risk.residualRating === "Very High").length} tone="critical" />
            <MetricCard icon={ClipboardList} label="Overdue actions" value={overdueActions} tone="warning" />
            <MetricCard icon={Lightbulb} label="Ideas awaiting review" value={awaitingIdeas} tone="warning" />
            <MetricCard icon={FileClock} label="Reviews overdue" value={overdueReviews} tone="critical" />
          </div>

          <div className="flex flex-wrap gap-2">
            <AlertChip tone="critical" label={`${overdueReviews} reviews overdue`} />
            <AlertChip tone="warning" label={`${dueSoonActions} actions due within ${dueSoonDays} days`} />
            <AlertChip tone="warning" label={`${risksWithoutOwners} risks need clearer ownership`} />
            <AlertChip tone="neutral" label={`${risksWithoutControls} risks missing controls`} />
            <AlertChip tone="warning" label={`${awaitingQi} QI items awaiting decision`} />
            <AlertChip tone="critical" label={`${aboveTarget} risks above target rating`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Risks by rating" description="Residual rating">
              <DonutChart data={ratingData} />
            </ChartCard>
            <ChartCard title="Actions by status" description="Controls and treatments">
              <SimpleBarChart data={actionStatusData} />
            </ChartCard>
            <ChartCard title="Risks by category" description="Current register mix">
              <SimpleBarChart data={categoryData} />
            </ChartCard>
            <ChartCard title="QI items by status" description="Improvement workflow">
              <SimpleBarChart data={qiStatusData} />
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <RegisterTable
              title="Top Current Risks"
              icon={AlertTriangle}
              columns={["ID", "Risk", "Rating", "Owner", "Review"]}
              emptyLabel="No risks to show."
            >
              {highestRisks.map((risk) => (
                <TableRow key={risk.id}>
                  <TableCell className="font-mono text-xs">{risk.id}</TableCell>
                  <TableCell className="min-w-52">
                    <div className="font-medium">{risk.title}</div>
                    <div className="line-clamp-1 text-xs text-muted-foreground">{risk.summary}</div>
                  </TableCell>
                  <TableCell><RiskRatingBadge rating={risk.residualRating} /></TableCell>
                  <TableCell>{risk.owner}</TableCell>
                  <TableCell><DueBadge state={risk.reviewState} label={risk.nextReview} /></TableCell>
                </TableRow>
              ))}
            </RegisterTable>

            <RegisterTable
              title="Work Requiring Attention"
              icon={CalendarClock}
              columns={["Type", "ID", "Description", "Owner", "Due"]}
              emptyLabel="No due items to show."
            >
              {combinedDueItems.map((item) => (
                <TableRow key={`${item.type}-${item.id}`}>
                  <TableCell><Badge variant="outline">{item.type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{item.id}</TableCell>
                  <TableCell className="min-w-48">
                    <button
                      type="button"
                      className="text-left font-medium hover:underline"
                      onClick={() => setActiveRecord(item.record)}
                    >
                      {item.description}
                    </button>
                  </TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell><DueBadge state={item.state} label={item.due} /></TableCell>
                </TableRow>
              ))}
            </RegisterTable>
          </div>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          <FilterBar
            search={riskSearch}
            onSearchChange={setRiskSearch}
            rating={riskRating}
            onRatingChange={setRiskRating}
            status={riskStatus}
            onStatusChange={setRiskStatus}
            category={riskCategory}
            onCategoryChange={setRiskCategory}
            categories={riskCategories}
          />
          <RegisterTable
            title="Risk Register"
            icon={ShieldCheck}
            columns={["ID", "Risk / summary", "Rating", "Owner", "Review", "Status", ""]}
            emptyLabel="No risks match the selected filters."
          >
            {filteredRisks.map((risk) => (
              <TableRow key={risk.id}>
                <TableCell className="font-mono text-xs">{risk.id}</TableCell>
                <TableCell className="min-w-64">
                  <div className="font-medium">{risk.title}</div>
                  <div className="line-clamp-1 text-xs text-muted-foreground">{risk.summary}</div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <RiskRatingBadge rating={risk.residualRating} />
                    <div className="text-xs text-muted-foreground">Target {risk.targetRating}</div>
                  </div>
                </TableCell>
                <TableCell>{risk.owner}</TableCell>
                <TableCell><DueBadge state={risk.reviewState} label={risk.nextReview} /></TableCell>
                <TableCell><Badge variant="secondary">{risk.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setActiveRecord(risk)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </RegisterTable>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <RegisterTable
            title="Actions"
            icon={ListChecks}
            columns={["ID", "Action", "Links", "Owner", "Due", "Status", ""]}
            emptyLabel="No actions to show."
          >
            {actions.map((action) => (
              <TableRow key={action.id}>
                <TableCell className="font-mono text-xs">{action.id}</TableCell>
                <TableCell className="min-w-64">
                  <div className="font-medium">{action.title}</div>
                  <div className="line-clamp-1 text-xs text-muted-foreground">{action.specific}</div>
                </TableCell>
                <TableCell><LinkedIds ids={[action.linkedRiskId, action.linkedQiId]} /></TableCell>
                <TableCell>{action.owner}</TableCell>
                <TableCell><DueBadge state={action.dueState} label={action.dueDate} /></TableCell>
                <TableCell><Badge variant="secondary">{action.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setActiveRecord(action)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </RegisterTable>
        </TabsContent>

        <TabsContent value="qi" className="space-y-4">
          <RegisterTable
            title="QI Register"
            icon={ClipboardCheck}
            columns={["ID", "Improvement", "Priority", "Links", "Owner", "Due", "Status", ""]}
            emptyLabel="No QI items to show."
          >
            {qiItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{item.id}</TableCell>
                <TableCell className="min-w-64">
                  <div className="font-medium">{item.title}</div>
                  <div className="line-clamp-1 text-xs text-muted-foreground">{item.issue}</div>
                </TableCell>
                <TableCell><PriorityBadge priority={item.priority} /></TableCell>
                <TableCell><LinkedIds ids={[item.linkedRiskId, item.linkedActionId, item.linkedIdeaId]} /></TableCell>
                <TableCell>{item.owner}</TableCell>
                <TableCell><DueBadge state={item.dueState} label={item.dueDate} /></TableCell>
                <TableCell><Badge variant="secondary">{item.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setActiveRecord(item)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </RegisterTable>
        </TabsContent>

        <TabsContent value="ideas" className="space-y-4">
          <RegisterTable
            title="Bright Ideas"
            icon={Lightbulb}
            columns={["ID", "Idea", "Submitted by", "Decision", "Status", "Links", ""]}
            emptyLabel="No Bright Ideas to show."
          >
            {brightIdeas.map((idea) => (
              <TableRow key={idea.id}>
                <TableCell className="font-mono text-xs">{idea.id}</TableCell>
                <TableCell className="min-w-64">
                  <div className="font-medium">{idea.title}</div>
                  <div className="line-clamp-1 text-xs text-muted-foreground">{idea.whyNeeded}</div>
                </TableCell>
                <TableCell>
                  <div>{idea.submittedBy}</div>
                  <div className="text-xs text-muted-foreground">{idea.submittedDate}</div>
                </TableCell>
                <TableCell><DecisionBadge decision={idea.decision} /></TableCell>
                <TableCell><Badge variant="secondary">{idea.status}</Badge></TableCell>
                <TableCell><LinkedIds ids={[idea.linkedRecordId]} /></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setActiveRecord(idea)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </RegisterTable>
        </TabsContent>

        <TabsContent value="matrix" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How to assess risk</CardTitle>
              <CardDescription>Choose likelihood, choose consequence, then read the rating.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-44">Likelihood</TableHead>
                      {consequenceLabels.map((label) => (
                        <TableHead key={label} className="text-center">{label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {likelihoodLabels.map((likelihood, rowIndex) => (
                      <TableRow key={likelihood}>
                        <TableCell className="font-medium">{likelihood}</TableCell>
                        {riskMatrix[rowIndex].map((rating, columnIndex) => (
                          <TableCell key={`${likelihood}-${consequenceLabels[columnIndex]}`} className="text-center">
                            <RiskRatingBadge rating={rating} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <GuidanceBlock title="Likelihood definitions" text="Use the best available evidence for how often the event could happen in the current season." />
                <GuidanceBlock title="Consequence examples" text="Consider injury, child safety, financial, reputation, compliance and operational impacts." />
                <GuidanceBlock title="Risk response guide" text="Very High and High risks need visible ownership, controls and committee review." />
                <GuidanceBlock title="Inherent vs residual risk" text="Inherent risk is before controls. Residual risk is after current controls are considered." />
                <GuidanceBlock title="Review frequency" text="Use shorter review cycles for higher residual ratings or weak controls." />
                <GuidanceBlock title="Categories" text="Keep categories practical so committee members can find similar issues quickly." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <RegisterTable
            title="Audit History"
            icon={History}
            columns={["Date", "User", "Record", "Action", "Field", ""]}
            emptyLabel="No audit rows to show."
          >
            {auditEvents.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="whitespace-nowrap">{event.date}</TableCell>
                <TableCell>{event.user}</TableCell>
                <TableCell>
                  <div className="font-mono text-xs">{event.record}</div>
                  <div className="text-xs text-muted-foreground">{event.recordType}</div>
                </TableCell>
                <TableCell>{event.action}</TableCell>
                <TableCell>{event.fieldChanged}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setActiveRecord(event)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </RegisterTable>
        </TabsContent>
      </Tabs>

      <SafetyFormDialog
        mode={formMode}
        context={formContext}
        values={formValues}
        step={formStep}
        errors={formErrors}
        saveMessage={prototypeSaveMessage}
        onStepChange={setFormStep}
        onValueChange={updateFormValue}
        onRequestClose={requestFormClose}
        onSubmit={submitForm}
      />
      <SafetyDetailDrawer
        record={activeRecord}
        onOpenChange={(open) => !open && setActiveRecord(null)}
        onOpenForm={openForm}
      />
      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This prototype form has unsaved changes. Closing it will clear the local draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={closeForm}>Discard draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

function AddRecordButton({ onOpenForm }: { onOpenForm: (mode: SafetyFormMode) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Add record
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Prototype forms</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onOpenForm("risk")}>Add risk</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onOpenForm("action")}>Add action</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onOpenForm("qi")}>Add QI item</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onOpenForm("idea")}>Submit Bright Idea</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onOpenForm("committee-review")}>Committee Bright Idea review</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onOpenForm("risk-review")}>Record risk review</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "critical";
}) {
  const toneClass = {
    neutral: "text-muted-foreground",
    warning: "text-amber-700",
    critical: "text-rose-700",
  }[tone];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <Icon className={cn("h-5 w-5", toneClass)} />
          <span className="text-2xl font-semibold">{value}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function AlertChip({ label, tone }: { label: string; tone: "neutral" | "warning" | "critical" }) {
  const className = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    critical: "border-rose-200 bg-rose-50 text-rose-800",
  }[tone];

  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium", className)}>
      {label}
    </span>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SimpleBarChart({ data }: { data: ChartDatum[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={48} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DonutChart({ data }: { data: ChartDatum[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 self-center">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: entry.fill }} />
              {entry.name}
            </span>
            <span className="font-semibold">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterBar({
  search,
  onSearchChange,
  rating,
  onRatingChange,
  status,
  onStatusChange,
  category,
  onCategoryChange,
  categories,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  rating: string;
  onRatingChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search risks"
              className="pl-9"
            />
          </div>
          <FilterSelect value={rating} onValueChange={onRatingChange} options={ratingOptions} label="Rating" />
          <FilterSelect value={status} onValueChange={onStatusChange} options={statusOptions} label="Status" />
          <FilterSelect value={category} onValueChange={onCategoryChange} options={["__all__", ...categories]} label="Category" />
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  value,
  onValueChange,
  options,
  label,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full min-w-0 overflow-hidden">
        <Filter className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option === "__all__" ? `All ${label.toLowerCase()}` : option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RegisterTable({
  title,
  icon: Icon,
  columns,
  emptyLabel,
  children,
}: {
  title: string;
  icon: LucideIcon;
  columns: string[];
  emptyLabel: string;
  children: React.ReactNode;
}) {
  const hasRows = Boolean(children && (!Array.isArray(children) || children.length > 0));

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>{columns.map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {hasRows ? children : (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <EmptyState label={emptyLabel} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function RiskRatingBadge({ rating }: { rating: RiskRating }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", ratingStyles[rating])}>
      {rating}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: QiRecord["priority"] }) {
  const className = {
    Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Medium: "border-amber-200 bg-amber-50 text-amber-800",
    High: "border-orange-200 bg-orange-50 text-orange-800",
  }[priority];
  return <Badge variant="outline" className={className}>{priority}</Badge>;
}

function DecisionBadge({ decision }: { decision: BrightIdeaRecord["decision"] }) {
  const className = {
    Pending: "border-amber-200 bg-amber-50 text-amber-800",
    Accept: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Defer: "border-blue-200 bg-blue-50 text-blue-700",
    Reject: "border-rose-200 bg-rose-50 text-rose-800",
    Close: "border-slate-200 bg-slate-50 text-slate-700",
  }[decision];
  return <Badge variant="outline" className={className}>{decision}</Badge>;
}

function DueBadge({ state, label }: { state: DueState | ReviewState; label: string }) {
  const className = state === "Overdue"
    ? "border-rose-200 bg-rose-50 text-rose-800"
    : state === "Due soon"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : state === "Complete"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="space-y-1">
      <Badge variant="outline" className={cn("whitespace-nowrap", className)}>{state}</Badge>
      <div className="whitespace-nowrap text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function LinkedIds({ ids }: { ids: Array<string | undefined> }) {
  const visibleIds = ids.filter(Boolean) as string[];
  if (visibleIds.length === 0) return <span className="text-sm text-muted-foreground">-</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleIds.map((id) => (
        <Badge key={id} variant="outline" className="font-mono text-xs">
          <Link2 className="mr-1 h-3 w-3" />
          {id}
        </Badge>
      ))}
    </div>
  );
}

function GuidanceBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border p-4">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function SafetyFormDialog({
  mode,
  context,
  values,
  step,
  errors,
  saveMessage,
  onStepChange,
  onValueChange,
  onRequestClose,
  onSubmit,
}: {
  mode: SafetyFormMode | null;
  context: SafetyFormContext;
  values: Record<string, string>;
  step: number;
  errors: string[];
  saveMessage: string | null;
  onStepChange: (step: number) => void;
  onValueChange: (field: string, value: string) => void;
  onRequestClose: () => void;
  onSubmit: () => void;
}) {
  const riskStepCount = 5;
  const canGoBack = mode === "risk" && step > 0;
  const canGoForward = mode === "risk" && step < riskStepCount - 1;

  return (
    <Dialog open={Boolean(mode)} onOpenChange={(open) => !open && onRequestClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        {mode && (
          <>
            <DialogHeader>
              <DialogTitle>{getFormTitle(mode, context)}</DialogTitle>
              <DialogDescription>{getFormDescription(mode, context)}</DialogDescription>
            </DialogHeader>

            {mode === "risk" && (
              <RiskWizardProgress step={step} />
            )}

            <FormErrors errors={errors} />
            <PrototypeSaveBanner message={saveMessage} />

            <div className="space-y-4">
              {mode === "risk" && <RiskFormStep step={step} values={values} onValueChange={onValueChange} />}
              {mode === "action" && <ActionForm values={values} onValueChange={onValueChange} />}
              {mode === "qi" && <QiForm values={values} onValueChange={onValueChange} />}
              {mode === "idea" && <BrightIdeaForm values={values} onValueChange={onValueChange} />}
              {mode === "committee-review" && <CommitteeReviewForm values={values} onValueChange={onValueChange} />}
              {mode === "risk-review" && <RiskReviewForm values={values} onValueChange={onValueChange} />}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={onRequestClose}>
                Close
              </Button>
              {canGoBack && (
                <Button type="button" variant="outline" onClick={() => onStepChange(step - 1)}>
                  Back
                </Button>
              )}
              {canGoForward ? (
                <Button type="button" onClick={() => onStepChange(step + 1)}>
                  Next
                </Button>
              ) : (
                <Button type="button" onClick={onSubmit}>
                  Save prototype
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RiskWizardProgress({ step }: { step: number }) {
  const steps = ["Basics", "Risk Event", "Inherent Risk", "Controls & Residual", "Treatment & Review"];

  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {steps.map((label, index) => (
        <div
          key={label}
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            index === step ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
            index < step && "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          <div className="text-xs font-medium">Step {index + 1}</div>
          <div>{label}</div>
        </div>
      ))}
    </div>
  );
}

function RiskFormStep({
  step,
  values,
  onValueChange,
}: {
  step: number;
  values: Record<string, string>;
  onValueChange: (field: string, value: string) => void;
}) {
  const inherentRating = calculateRiskRating(values.inherentLikelihood, values.inherentConsequence);
  const residualRating = calculateRiskRating(values.residualLikelihood, values.residualConsequence);

  if (step === 0) {
    return (
      <FormGrid>
        <TextField label="Organisation scope" field="scope" values={values} onValueChange={onValueChange} />
        <SelectField label="Risk type" field="type" values={values} onValueChange={onValueChange} options={["Operational", "Clinical", "Governance", "Environmental", "Conduct"]} />
        <TextField label="Category" field="category" values={values} onValueChange={onValueChange} />
        <TextField label="Owner" field="owner" values={values} onValueChange={onValueChange} />
        <SelectField label="Status" field="status" values={values} onValueChange={onValueChange} options={["Open", "In progress", "Controlled", "Closed"]} />
      </FormGrid>
    );
  }

  if (step === 1) {
    return (
      <div className="space-y-4">
        <TextField label="Short title" field="title" values={values} onValueChange={onValueChange} />
        <TextAreaField label="Risk event" field="riskEvent" values={values} onValueChange={onValueChange} />
        <TextAreaField label="Consequences" field="consequences" values={values} onValueChange={onValueChange} />
        <TextAreaField label="Current risk summary" field="summary" values={values} onValueChange={onValueChange} />
      </div>
    );
  }

  if (step === 2) {
    return (
      <FormGrid>
        <SelectField label="Inherent likelihood" field="inherentLikelihood" values={values} onValueChange={onValueChange} options={formLikelihoodOptions} />
        <SelectField label="Inherent consequence" field="inherentConsequence" values={values} onValueChange={onValueChange} options={formConsequenceOptions} />
        <RatingPreview label="Calculated inherent rating" rating={inherentRating} />
      </FormGrid>
    );
  }

  if (step === 3) {
    return (
      <div className="space-y-4">
        <TextAreaField label="Existing controls" field="existingControls" values={values} onValueChange={onValueChange} />
        <FormGrid>
          <SelectField label="Residual likelihood" field="residualLikelihood" values={values} onValueChange={onValueChange} options={formLikelihoodOptions} />
          <SelectField label="Residual consequence" field="residualConsequence" values={values} onValueChange={onValueChange} options={formConsequenceOptions} />
          <RatingPreview label="Calculated residual rating" rating={residualRating} />
          <SelectField label="Target rating" field="targetRating" values={values} onValueChange={onValueChange} options={ratingOrder} />
        </FormGrid>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TextAreaField label="Treatment plan" field="treatmentPlan" values={values} onValueChange={onValueChange} />
      <FormGrid>
        <SelectField label="Review frequency" field="reviewFrequency" values={values} onValueChange={onValueChange} options={reviewFrequencyOptions} />
        <TextField label="Next review date" field="nextReview" values={values} onValueChange={onValueChange} />
      </FormGrid>
      <TextAreaField label="Evidence or notes" field="evidence" values={values} onValueChange={onValueChange} />
      <div className="rounded-md border bg-muted/40 p-4">
        <div className="text-sm font-medium">Review before saving</div>
        <p className="mt-1 text-sm text-muted-foreground">
          This prototype keeps the draft in the browser only. It will not create or edit a live risk record.
        </p>
      </div>
    </div>
  );
}

function ActionForm({
  values,
  onValueChange,
}: {
  values: Record<string, string>;
  onValueChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <LinkedContextBanner ids={[values.linkedRiskId, values.linkedQiId, values.linkedIdeaId]} />
      <FormGrid>
        <TextField label="Action title" field="title" values={values} onValueChange={onValueChange} />
        <TextField label="Owner" field="owner" values={values} onValueChange={onValueChange} />
        <TextField label="Due date" field="dueDate" values={values} onValueChange={onValueChange} />
        <SelectField label="Status" field="status" values={values} onValueChange={onValueChange} options={["Not started", "In progress", "Blocked", "Complete"]} />
        <TextField label="Risk link" field="linkedRiskId" values={values} onValueChange={onValueChange} />
        <TextField label="QI link" field="linkedQiId" values={values} onValueChange={onValueChange} />
      </FormGrid>
      <DetailSection title="BE SMART">
        <div className="grid gap-3">
          <TextAreaField label="Baseline" field="baseline" values={values} onValueChange={onValueChange} />
          <TextAreaField label="Evaluate" field="evaluate" values={values} onValueChange={onValueChange} />
          <TextAreaField label="Specific" field="specific" values={values} onValueChange={onValueChange} />
          <TextAreaField label="Measurable" field="measurable" values={values} onValueChange={onValueChange} />
          <TextAreaField label="Achievable" field="achievable" values={values} onValueChange={onValueChange} />
          <TextAreaField label="Relevant" field="relevant" values={values} onValueChange={onValueChange} />
          <TextAreaField label="Time-bound" field="timeBound" values={values} onValueChange={onValueChange} />
        </div>
      </DetailSection>
    </div>
  );
}

function QiForm({
  values,
  onValueChange,
}: {
  values: Record<string, string>;
  onValueChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <LinkedContextBanner ids={[values.linkedRiskId, values.linkedActionId, values.linkedIdeaId]} />
      <FormGrid>
        <TextField label="QI title" field="title" values={values} onValueChange={onValueChange} />
        <TextField label="Source" field="source" values={values} onValueChange={onValueChange} />
        <TextField label="Area" field="area" values={values} onValueChange={onValueChange} />
        <TextField label="Owner" field="owner" values={values} onValueChange={onValueChange} />
        <TextField label="Due date" field="dueDate" values={values} onValueChange={onValueChange} />
        <SelectField label="Priority" field="priority" values={values} onValueChange={onValueChange} options={["Low", "Medium", "High"]} />
        <SelectField label="Status" field="status" values={values} onValueChange={onValueChange} options={["New", "Awaiting decision", "Approved", "In progress", "Complete"]} />
        <TextField label="Risk link" field="linkedRiskId" values={values} onValueChange={onValueChange} />
        <TextField label="Action link" field="linkedActionId" values={values} onValueChange={onValueChange} />
        <TextField label="Bright Idea link" field="linkedIdeaId" values={values} onValueChange={onValueChange} />
      </FormGrid>
      <TextAreaField label="Issue or opportunity identified" field="issue" values={values} onValueChange={onValueChange} />
      <TextAreaField label="Required action" field="requiredAction" values={values} onValueChange={onValueChange} />
      <TextAreaField label="Outcome" field="outcome" values={values} onValueChange={onValueChange} />
    </div>
  );
}

function BrightIdeaForm({
  values,
  onValueChange,
}: {
  values: Record<string, string>;
  onValueChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <FormGrid>
        <TextField label="Idea title" field="title" values={values} onValueChange={onValueChange} />
        <TextField label="Submitted by" field="submittedBy" values={values} onValueChange={onValueChange} />
        <TextField label="Organisation scope" field="scope" values={values} onValueChange={onValueChange} />
        <SelectField label="Status" field="status" values={values} onValueChange={onValueChange} options={["Submitted", "Under review", "Accepted", "Deferred", "Closed"]} />
      </FormGrid>
      <TextAreaField label="Why it is needed" field="whyNeeded" values={values} onValueChange={onValueChange} />
      <TextAreaField label="Suggested implementation" field="suggestedImplementation" values={values} onValueChange={onValueChange} />
      <TextAreaField label="Suggested evaluation" field="suggestedEvaluation" values={values} onValueChange={onValueChange} />
      <TextAreaField label="Who could assist" field="couldAssist" values={values} onValueChange={onValueChange} />
      <TextAreaField label="Other information" field="otherInfo" values={values} onValueChange={onValueChange} />
    </div>
  );
}

function CommitteeReviewForm({
  values,
  onValueChange,
}: {
  values: Record<string, string>;
  onValueChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <LinkedContextBanner ids={[values.ideaId, values.linkedRecordId]} />
      <FormGrid>
        <TextField label="Bright Idea ID" field="ideaId" values={values} onValueChange={onValueChange} />
        <SelectField label="Committee decision" field="decision" values={values} onValueChange={onValueChange} options={ideaDecisionOptions} />
        <SelectField label="Conversion or link" field="conversion" values={values} onValueChange={onValueChange} options={conversionOptions} />
        <TextField label="Resulting or linked record" field="linkedRecordId" values={values} onValueChange={onValueChange} />
      </FormGrid>
      <TextAreaField label="Committee discussion" field="committeeNotes" values={values} onValueChange={onValueChange} />
      <TextAreaField label="Decision reason" field="decisionReason" values={values} onValueChange={onValueChange} />
      <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
        The original Bright Idea text stays unchanged. Any converted record should carry a link back to this idea.
      </div>
    </div>
  );
}

function RiskReviewForm({
  values,
  onValueChange,
}: {
  values: Record<string, string>;
  onValueChange: (field: string, value: string) => void;
}) {
  const residualRating = calculateRiskRating(values.residualLikelihood, values.residualConsequence);

  return (
    <div className="space-y-4">
      <LinkedContextBanner ids={[values.riskId]} />
      <FormGrid>
        <TextField label="Risk ID" field="riskId" values={values} onValueChange={onValueChange} />
        <TextField label="Reviewed by" field="reviewedBy" values={values} onValueChange={onValueChange} />
        <TextField label="Review date" field="reviewDate" values={values} onValueChange={onValueChange} />
        <TextField label="Next review date" field="nextReview" values={values} onValueChange={onValueChange} />
        <SelectField label="Residual likelihood" field="residualLikelihood" values={values} onValueChange={onValueChange} options={formLikelihoodOptions} />
        <SelectField label="Residual consequence" field="residualConsequence" values={values} onValueChange={onValueChange} options={formConsequenceOptions} />
        <RatingPreview label="Calculated residual rating" rating={residualRating} />
        <SelectField label="Risk status" field="status" values={values} onValueChange={onValueChange} options={["Open", "In progress", "Controlled", "Closed"]} />
      </FormGrid>
      <TextAreaField label="Review notes" field="reviewNotes" values={values} onValueChange={onValueChange} />
      <TextAreaField label="Evidence or follow-up" field="evidence" values={values} onValueChange={onValueChange} />
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function TextField({
  label,
  field,
  values,
  onValueChange,
}: {
  label: string;
  field: string;
  values: Record<string, string>;
  onValueChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field}>{label}</Label>
      <Input
        id={field}
        value={values[field] || ""}
        onChange={(event) => onValueChange(field, event.target.value)}
      />
    </div>
  );
}

function TextAreaField({
  label,
  field,
  values,
  onValueChange,
}: {
  label: string;
  field: string;
  values: Record<string, string>;
  onValueChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field}>{label}</Label>
      <Textarea
        id={field}
        value={values[field] || ""}
        onChange={(event) => onValueChange(field, event.target.value)}
        className="min-h-24"
      />
    </div>
  );
}

function SelectField({
  label,
  field,
  values,
  options,
  onValueChange,
}: {
  label: string;
  field: string;
  values: Record<string, string>;
  options: string[];
  onValueChange: (field: string, value: string) => void;
}) {
  const selectedValue = values[field] || options[0];

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={selectedValue} onValueChange={(value) => onValueChange(field, value)}>
        <SelectTrigger className="w-full min-w-0 overflow-hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RatingPreview({ label, rating }: { label: string; rating: RiskRating }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Target className="h-4 w-4 text-muted-foreground" />
        {label}
      </div>
      <div className="mt-3"><RiskRatingBadge rating={rating} /></div>
    </div>
  );
}

function LinkedContextBanner({ ids }: { ids: Array<string | undefined> }) {
  const visibleIds = ids.filter((id) => Boolean(id?.trim())) as string[];
  if (visibleIds.length === 0) return null;

  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <div className="text-sm font-medium">Linked record context</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {visibleIds.map((id) => (
          <Badge key={id} variant="outline" className="font-mono text-xs">
            <Link2 className="mr-1 h-3 w-3" />
            {id}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function FormErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;

  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
      <div className="font-medium">Please check these fields</div>
      <ul className="mt-2 list-inside list-disc space-y-1">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}

function PrototypeSaveBanner({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
      <CheckCircle2 className="mt-0.5 h-4 w-4" />
      <div>
        <div className="font-medium">Prototype save complete</div>
        <div>{message}</div>
      </div>
    </div>
  );
}

function SafetyDetailDrawer({
  record,
  onOpenChange,
  onOpenForm,
}: {
  record: SafetyRecord | null;
  onOpenChange: (open: boolean) => void;
  onOpenForm: (options: OpenFormOptions) => void;
}) {
  return (
    <Sheet open={Boolean(record)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {record && (
          <>
            <SheetHeader className="pr-8">
              <SheetTitle>{getRecordTitle(record)}</SheetTitle>
              <SheetDescription>{getRecordSubtitle(record)}</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {record.kind === "risk" && <RiskDetail risk={record} onOpenForm={onOpenForm} />}
              {record.kind === "action" && <ActionDetail action={record} onOpenForm={onOpenForm} />}
              {record.kind === "qi" && <QiDetail item={record} onOpenForm={onOpenForm} />}
              {record.kind === "idea" && <BrightIdeaDetail idea={record} onOpenForm={onOpenForm} />}
              {record.kind === "audit" && <AuditDetail event={record} />}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RiskDetail({
  risk,
  onOpenForm,
}: {
  risk: RiskRecord;
  onOpenForm: (options: OpenFormOptions) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onOpenForm({ mode: "risk", context: { riskId: risk.id } })}>
          Edit risk
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "action", context: { riskId: risk.id } })}>
          Add linked action
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "qi", context: { riskId: risk.id } })}>
          Add linked QI
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "risk-review", context: { riskId: risk.id } })}>
          Record review
        </Button>
      </div>
      <DetailGrid>
        <DetailField label="Category" value={risk.category} />
        <DetailField label="Type" value={risk.type} />
        <DetailField label="Owner" value={risk.owner} />
        <DetailField label="Scope" value={risk.scope} />
        <DetailField label="Status" value={risk.status} />
        <DetailField label="Next review" value={risk.nextReview} />
      </DetailGrid>
      <DetailSection title="Assessment">
        <div className="grid gap-3 sm:grid-cols-3">
          <DetailRating label="Inherent" rating={risk.inherentRating} />
          <DetailRating label="Residual" rating={risk.residualRating} />
          <DetailRating label="Target" rating={risk.targetRating} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {risk.likelihood} likelihood with {risk.consequence.toLowerCase()} consequence.
        </p>
      </DetailSection>
      <DetailSection title="Controls and treatment">
        <DetailField label="Existing controls" value={risk.existingControls} />
        <DetailField label="Treatment plan" value={risk.treatmentPlan} />
        <DetailField label="Evidence" value={risk.evidence} />
      </DetailSection>
      <DetailSection title="Linked records">
        <div className="grid gap-2 sm:grid-cols-2">
          {[...risk.linkedActions, ...risk.linkedQi].map((id) => <LinkedRecordCard key={id} id={id} />)}
        </div>
      </DetailSection>
    </>
  );
}

function ActionDetail({
  action,
  onOpenForm,
}: {
  action: ActionRecord;
  onOpenForm: (options: OpenFormOptions) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onOpenForm({ mode: "action", context: { actionId: action.id } })}>
          Edit action
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "qi", context: { actionId: action.id, riskId: action.linkedRiskId } })}>
          Add linked QI
        </Button>
      </div>
      <DetailGrid>
        <DetailField label="Owner" value={action.owner} />
        <DetailField label="Status" value={action.status} />
        <DetailField label="Due date" value={action.dueDate} />
        <DetailField label="Risk link" value={action.linkedRiskId || "-"} />
        <DetailField label="QI link" value={action.linkedQiId || "-"} />
      </DetailGrid>
      <DetailSection title="BE SMART">
        <div className="grid gap-3">
          <DetailField label="Baseline" value={action.baseline} />
          <DetailField label="Evaluate" value={action.evaluate} />
          <DetailField label="Specific" value={action.specific} />
          <DetailField label="Measurable" value={action.measurable} />
          <DetailField label="Achievable" value={action.achievable} />
          <DetailField label="Relevant" value={action.relevant} />
          <DetailField label="Time-bound" value={action.timeBound} />
        </div>
      </DetailSection>
    </>
  );
}

function QiDetail({
  item,
  onOpenForm,
}: {
  item: QiRecord;
  onOpenForm: (options: OpenFormOptions) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onOpenForm({ mode: "qi", context: { qiId: item.id } })}>
          Edit QI item
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "action", context: { qiId: item.id, riskId: item.linkedRiskId } })}>
          Add linked action
        </Button>
      </div>
      <DetailGrid>
        <DetailField label="Source" value={item.source} />
        <DetailField label="Area" value={item.area} />
        <DetailField label="Owner" value={item.owner} />
        <DetailField label="Priority" value={item.priority} />
        <DetailField label="Status" value={item.status} />
        <DetailField label="Due date" value={item.dueDate} />
      </DetailGrid>
      <DetailSection title="Improvement detail">
        <DetailField label="Issue or opportunity" value={item.issue} />
        <DetailField label="Required action" value={item.requiredAction} />
        <DetailField label="Outcome" value={item.outcome} />
      </DetailSection>
      <DetailSection title="Linked records">
        <div className="grid gap-2 sm:grid-cols-2">
          {[item.linkedRiskId, item.linkedActionId, item.linkedIdeaId]
            .filter(Boolean)
            .map((id) => <LinkedRecordCard key={id} id={id as string} />)}
        </div>
      </DetailSection>
    </>
  );
}

function BrightIdeaDetail({
  idea,
  onOpenForm,
}: {
  idea: BrightIdeaRecord;
  onOpenForm: (options: OpenFormOptions) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onOpenForm({ mode: "committee-review", context: { ideaId: idea.id } })}>
          Review idea
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "qi", context: { ideaId: idea.id } })}>
          Create linked QI
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "action", context: { ideaId: idea.id } })}>
          Create linked action
        </Button>
      </div>
      <DetailGrid>
        <DetailField label="Submitted by" value={idea.submittedBy} />
        <DetailField label="Submitted date" value={idea.submittedDate} />
        <DetailField label="Scope" value={idea.scope} />
        <DetailField label="Status" value={idea.status} />
        <DetailField label="Decision" value={idea.decision} />
        <DetailField label="Linked record" value={idea.linkedRecordId || "-"} />
      </DetailGrid>
      <DetailSection title="Suggestion">
        <DetailField label="Why it is needed" value={idea.whyNeeded} />
        <DetailField label="Suggested implementation" value={idea.suggestedImplementation} />
        <DetailField label="Suggested evaluation" value={idea.suggestedEvaluation} />
        <DetailField label="Who could assist" value={idea.couldAssist} />
      </DetailSection>
      <DetailSection title="Committee discussion">
        <p className="text-sm text-muted-foreground">{idea.committeeNotes}</p>
      </DetailSection>
    </>
  );
}

function AuditDetail({ event }: { event: AuditRecord }) {
  return (
    <>
      <DetailGrid>
        <DetailField label="Date and time" value={event.date} />
        <DetailField label="User" value={event.user} />
        <DetailField label="Record" value={event.record} />
        <DetailField label="Record type" value={event.recordType} />
        <DetailField label="Action" value={event.action} />
        <DetailField label="Field changed" value={event.fieldChanged} />
      </DetailGrid>
      <DetailSection title="Change detail">
        <DetailField label="Previous value" value={event.previousValue} />
        <DetailField label="New value" value={event.newValue} />
        <DetailField label="Reason" value={event.reason} />
      </DetailSection>
    </>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border p-4">
      <h3 className="font-medium">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function DetailRating({ label, rating }: { label: string; rating: RiskRating }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2"><RiskRatingBadge rating={rating} /></div>
    </div>
  );
}

function LinkedRecordCard({ id }: { id: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border p-3 text-sm">
      <Link2 className="h-4 w-4 text-muted-foreground" />
      <span className="font-mono text-xs">{id}</span>
    </div>
  );
}

function getRecordTitle(record: SafetyRecord) {
  if (record.kind === "audit") return `${record.record} audit event`;
  return `${record.id} - ${record.title}`;
}

function getRecordSubtitle(record: SafetyRecord) {
  if (record.kind === "risk") return record.summary;
  if (record.kind === "action") return record.specific;
  if (record.kind === "qi") return record.issue;
  if (record.kind === "idea") return record.whyNeeded;
  return `${record.action} by ${record.user}`;
}

function createInitialFormValues(
  mode: SafetyFormMode,
  context: SafetyFormContext,
  scopeLabel: string,
): Record<string, string> {
  const risk = context.riskId ? risks.find((item) => item.id === context.riskId) : undefined;
  const action = context.actionId ? actions.find((item) => item.id === context.actionId) : undefined;
  const qi = context.qiId ? qiItems.find((item) => item.id === context.qiId) : undefined;
  const idea = context.ideaId ? brightIdeas.find((item) => item.id === context.ideaId) : undefined;

  if (mode === "risk") {
    return {
      scope: risk?.scope || scopeLabel,
      type: risk?.type || "Operational",
      category: risk?.category || "Safety",
      owner: risk?.owner || "",
      status: risk?.status || "Open",
      title: risk?.title || idea?.title || "",
      riskEvent: risk?.title || "",
      consequences: risk?.summary || "",
      summary: risk?.summary || "",
      inherentLikelihood: risk?.likelihood || "Possible",
      inherentConsequence: risk?.consequence || "Moderate",
      existingControls: risk?.existingControls || "",
      residualLikelihood: risk?.likelihood || "Possible",
      residualConsequence: risk?.consequence || "Moderate",
      targetRating: risk?.targetRating || "Medium",
      treatmentPlan: risk?.treatmentPlan || "",
      reviewFrequency: "Quarterly",
      nextReview: risk?.nextReview || "",
      evidence: risk?.evidence || "",
    };
  }

  if (mode === "action") {
    return {
      title: action?.title || idea?.title || "",
      owner: action?.owner || "",
      dueDate: action?.dueDate || "",
      status: action?.status || "Not started",
      linkedRiskId: action?.linkedRiskId || context.riskId || "",
      linkedQiId: action?.linkedQiId || context.qiId || "",
      linkedIdeaId: context.ideaId || "",
      baseline: action?.baseline || "",
      evaluate: action?.evaluate || "",
      specific: action?.specific || idea?.suggestedImplementation || "",
      measurable: action?.measurable || "",
      achievable: action?.achievable || "",
      relevant: action?.relevant || idea?.whyNeeded || "",
      timeBound: action?.timeBound || "",
    };
  }

  if (mode === "qi") {
    return {
      title: qi?.title || idea?.title || "",
      source: qi?.source || (idea ? "Bright Idea" : context.riskId ? "Risk review" : context.actionId ? "Action follow-up" : "Committee review"),
      area: qi?.area || "",
      owner: qi?.owner || "",
      dueDate: qi?.dueDate || "",
      priority: qi?.priority || "Medium",
      status: qi?.status || "New",
      linkedRiskId: qi?.linkedRiskId || context.riskId || "",
      linkedActionId: qi?.linkedActionId || context.actionId || "",
      linkedIdeaId: qi?.linkedIdeaId || context.ideaId || "",
      issue: qi?.issue || idea?.whyNeeded || "",
      requiredAction: qi?.requiredAction || idea?.suggestedImplementation || "",
      outcome: qi?.outcome || "",
    };
  }

  if (mode === "idea") {
    return {
      title: "",
      submittedBy: "Current signed-in user",
      scope: scopeLabel,
      status: "Submitted",
      whyNeeded: "",
      suggestedImplementation: "",
      suggestedEvaluation: "",
      couldAssist: "",
      otherInfo: "",
    };
  }

  if (mode === "committee-review") {
    return {
      ideaId: idea?.id || "",
      decision: idea?.decision || "Pending",
      conversion: idea?.linkedRecordId ? "Link to existing record" : "Create QI item",
      linkedRecordId: idea?.linkedRecordId || "",
      committeeNotes: idea?.committeeNotes || "",
      decisionReason: "",
    };
  }

  return {
    riskId: risk?.id || "",
    reviewedBy: "Safety Lead",
    reviewDate: "11/07/2026",
    nextReview: risk?.nextReview || "",
    residualLikelihood: risk?.likelihood || "Possible",
    residualConsequence: risk?.consequence || "Moderate",
    status: risk?.status || "Open",
    reviewNotes: "",
    evidence: risk?.evidence || "",
  };
}

function getFormTitle(mode: SafetyFormMode, context: SafetyFormContext) {
  if (mode === "risk") return context.riskId ? `Edit ${context.riskId}` : "Add Risk";
  if (mode === "action") return context.actionId ? `Edit ${context.actionId}` : "Add Action";
  if (mode === "qi") return context.qiId ? `Edit ${context.qiId}` : "Add QI Item";
  if (mode === "idea") return "Submit Bright Idea";
  if (mode === "committee-review") return "Committee Bright Idea Review";
  return "Record Risk Review";
}

function getFormDescription(mode: SafetyFormMode, context: SafetyFormContext) {
  if (mode === "risk") return "Five-step guided risk form with calculated inherent and residual ratings.";
  if (mode === "action") return context.riskId || context.qiId ? "Linked action form with the source record already filled in." : "Independent action form.";
  if (mode === "qi") return context.ideaId ? "QI form carrying text across from the Bright Idea." : "Independent or linked quality improvement form.";
  if (mode === "idea") return "Simple suggestion form for signed-in users.";
  if (mode === "committee-review") return "Committee decision and conversion notes for a Bright Idea.";
  return "Risk review form using the same matrix as the risk form.";
}

function validateSafetyForm(mode: SafetyFormMode, values: Record<string, string>) {
  const errors: string[] = [];
  const requireField = (field: string, label: string) => {
    if (!values[field]?.trim()) errors.push(`${label} is required.`);
  };

  if (mode === "risk") {
    requireField("title", "Short title");
    requireField("owner", "Owner");
    requireField("riskEvent", "Risk event");
    requireField("existingControls", "Existing controls");
    requireField("treatmentPlan", "Treatment plan");
  }

  if (mode === "action") {
    requireField("title", "Action title");
    requireField("owner", "Owner");
    requireField("dueDate", "Due date");
    requireField("specific", "Specific");
    requireField("timeBound", "Time-bound");
  }

  if (mode === "qi") {
    requireField("title", "QI title");
    requireField("owner", "Owner");
    requireField("issue", "Issue or opportunity");
    requireField("requiredAction", "Required action");
  }

  if (mode === "idea") {
    requireField("title", "Idea title");
    requireField("whyNeeded", "Why it is needed");
    requireField("suggestedImplementation", "Suggested implementation");
  }

  if (mode === "committee-review") {
    requireField("ideaId", "Bright Idea ID");
    requireField("decision", "Committee decision");
    requireField("committeeNotes", "Committee discussion");
  }

  if (mode === "risk-review") {
    requireField("riskId", "Risk ID");
    requireField("reviewedBy", "Reviewed by");
    requireField("reviewDate", "Review date");
    requireField("reviewNotes", "Review notes");
  }

  return errors;
}

function getPrototypeSaveMessage(mode: SafetyFormMode, context: SafetyFormContext) {
  const linkText = [context.riskId, context.actionId, context.qiId, context.ideaId]
    .filter(Boolean)
    .join(", ");
  const suffix = linkText ? ` Linked context: ${linkText}.` : "";

  if (mode === "risk") return `Risk draft validated locally.${suffix}`;
  if (mode === "action") return `Action draft validated locally.${suffix}`;
  if (mode === "qi") return `QI draft validated locally.${suffix}`;
  if (mode === "idea") return "Bright Idea draft validated locally.";
  if (mode === "committee-review") return `Committee review draft validated locally.${suffix}`;
  return `Risk review draft validated locally.${suffix}`;
}

function calculateRiskRating(likelihood: string | undefined, consequence: string | undefined): RiskRating {
  const likelihoodIndex = formLikelihoodOptions.indexOf(likelihood || "");
  const consequenceIndex = formConsequenceOptions.indexOf(consequence || "");

  if (likelihoodIndex < 0 || consequenceIndex < 0) return "Medium";
  return riskMatrix[likelihoodIndex][consequenceIndex];
}

import { Children, createContext, Fragment, isValidElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ChevronDown,
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
  Loader2,
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
import { SortableTableHead } from "@/components/admin/SortableTableHead";
import { nextSortState, stableSortRows, type SortState } from "@/lib/adminSorting";
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
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type RiskRating = "Low" | "Medium" | "High" | "Very High";
type ReviewState = "Current" | "Due soon" | "Overdue";
type DueState = "Current" | "Due soon" | "Overdue" | "Complete";
type RiskStatus = "Open" | "In progress" | "Controlled" | "Closed" | "Entered in error";
type ActionStatus = "Not started" | "In progress" | "Blocked" | "Complete" | "Entered in error";
type QiStatus = "New" | "Awaiting decision" | "Approved" | "In progress" | "Complete" | "Entered in error";
type BrightIdeaStatus = "Submitted" | "Under review" | "Accepted" | "Deferred" | "Closed" | "Entered in error";

interface RiskRecord {
  kind: "risk";
  databaseId?: string;
  id: string;
  title: string;
  summary: string;
  category: string;
  type: string;
  owner: string;
  createdBy?: string;
  scope: string;
  status: RiskStatus;
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
  databaseId?: string;
  id: string;
  title: string;
  owner: string;
  createdBy?: string;
  status: ActionStatus;
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
  databaseId?: string;
  id: string;
  title: string;
  source: string;
  area: string;
  owner: string;
  createdBy?: string;
  priority: "Low" | "Medium" | "High";
  status: QiStatus;
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
  databaseId?: string;
  id: string;
  title: string;
  submittedBy: string;
  submittedDate: string;
  scope: string;
  status: BrightIdeaStatus;
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
  recordType: "Risk" | "Action" | "QI" | "Bright Idea" | "Risk Review" | "Link" | "Settings" | "Comment";
  scope: string;
  relatedRecordId?: string;
  action: string;
  fieldChanged: string;
  previousValue: string;
  newValue: string;
  reason: string;
}

type SafetyRecord = RiskRecord | ActionRecord | QiRecord | BrightIdeaRecord | AuditRecord;
type CoreSafetyRecord = RiskRecord | ActionRecord | QiRecord | BrightIdeaRecord;
type SafetyFormMode = "risk" | "action" | "qi" | "idea" | "committee-review" | "risk-review" | "link-records";

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

interface SafetyHubData {
  risks: RiskRecord[];
  actions: ActionRecord[];
  qiItems: QiRecord[];
  brightIdeas: BrightIdeaRecord[];
  auditEvents: AuditRecord[];
  riskMatrix: RiskRating[][];
  likelihoodDefinitions: RiskConfigDefinition[];
  consequenceDefinitions: RiskConfigDefinition[];
  riskCategories: RiskConfigCategory[];
}

interface RiskConfigDefinition {
  id?: string;
  name: string;
  description: string;
}

interface RiskConfigCategory extends RiskConfigDefinition {
  isActive: boolean;
}

interface SafetyHubDataContextValue extends SafetyHubData {
  recordsById: Map<string, SafetyRecord>;
}

interface SafetyScopeSelection {
  associationId?: string;
  clubId?: string;
  teamId?: string;
}

type SafetyRiskRow = Tables<"rg_risk_register">;
type SafetyActionRow = Tables<"rg_be_smart_actions">;
type SafetyQiRow = Tables<"rg_quality_improvement_items">;
type SafetyIdeaRow = Tables<"rg_bright_ideas">;
type SafetyLinkRow = Tables<"rg_record_links">;
type SafetyReviewRow = Tables<"rg_risk_reviews">;
type SafetyAuditRow = Tables<"rg_audit_log">;
type SafetyMatrixRow = Tables<"rg_risk_matrix">;
type SafetySettingsRow = Tables<"rg_risk_settings">;
type SafetyDropdownRow = Tables<"rg_dropdown_values">;
type ProfileRow = Tables<"profiles">;
type AssociationRow = Tables<"associations">;
type ClubRow = Tables<"clubs">;
type TeamRow = Tables<"teams">;
type ProfileSummary = Pick<ProfileRow, "id" | "first_name" | "last_name">;
type AssociationSummary = Pick<AssociationRow, "id" | "name">;
type ClubSummary = Pick<ClubRow, "id" | "name" | "association_id">;
type TeamSummary = Pick<TeamRow, "id" | "name" | "club_id">;

const ratingOrder: RiskRating[] = ["Very High", "High", "Medium", "Low"];
const statusOptions = ["__all__", "Open", "In progress", "Controlled", "Closed", "Entered in error"];
const ratingOptions = ["__all__", ...ratingOrder];
const reviewStateOptions = ["__all__", "Current", "Due soon", "Overdue"];
const dueSoonDays = 30;
const formLikelihoodOptions = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const formConsequenceOptions = ["Insignificant", "Minor", "Moderate", "Major", "Severe"];
const reviewFrequencyOptions = ["Monthly", "Quarterly", "Six monthly", "Annual"];
const ideaDecisionOptions = ["Pending", "Accept", "Defer", "Reject", "Close"];
const conversionOptions = ["Create risk", "Create action", "Create QI item", "Link to existing record", "Close without conversion"];
const defaultLikelihoodDefinitions: RiskConfigDefinition[] = [
  { name: "Rare", description: "May occur only in exceptional circumstances." },
  { name: "Unlikely", description: "Could occur, but has not happened recently in this organisation." },
  { name: "Possible", description: "Might occur during a normal season or activity cycle." },
  { name: "Likely", description: "Expected to occur unless controls are improved." },
  { name: "Almost Certain", description: "Expected to occur repeatedly or is already happening." },
];
const defaultConsequenceDefinitions: RiskConfigDefinition[] = [
  { name: "Insignificant", description: "No injury or disruption; managed with a quick local response." },
  { name: "Minor", description: "Minor impact requiring routine treatment or follow-up." },
  { name: "Moderate", description: "Meaningful impact requiring formal response and review." },
  { name: "Major", description: "Serious impact, significant disruption or external attention." },
  { name: "Severe", description: "Catastrophic harm or long-term organisational impact." },
];

const ratingStyles: Record<RiskRating, string> = {
  Low: "border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-100",
  Medium: "border-yellow-500 bg-yellow-100 text-yellow-950 dark:border-yellow-600 dark:bg-yellow-950/70 dark:text-yellow-100",
  High: "border-orange-600 bg-orange-200 text-orange-950 dark:border-orange-500 dark:bg-orange-950 dark:text-orange-100",
  "Very High": "border-red-800 bg-red-700 text-white dark:border-red-500 dark:bg-red-900 dark:text-white",
};

const ratingCellStyles: Record<RiskRating, string> = {
  Low: "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/45",
  Medium: "border-yellow-500 bg-yellow-100 dark:border-yellow-600 dark:bg-yellow-950/65",
  High: "border-orange-600 bg-orange-200 dark:border-orange-500 dark:bg-orange-950",
  "Very High": "border-red-800 bg-red-300 dark:border-red-500 dark:bg-red-950",
};

const matrixRatingLabelStyles: Record<RiskRating, string> = {
  Low: "border-emerald-800 bg-emerald-700 text-white dark:border-emerald-400 dark:bg-emerald-800",
  Medium: "border-yellow-700 bg-yellow-400 text-yellow-950 dark:border-yellow-300 dark:bg-yellow-500",
  High: "border-orange-900 bg-orange-600 text-white dark:border-orange-300 dark:bg-orange-700",
  "Very High": "border-red-950 bg-red-800 text-white dark:border-red-300 dark:bg-red-800",
};

const idCellClass = "w-20 min-w-20 whitespace-nowrap font-mono text-xs";
const safetyTabTriggerClass =
  "min-h-10 shrink-0 rounded-md border border-transparent px-4 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm";

const ratingColours: Record<RiskRating, string> = {
  Low: "#059669",
  Medium: "#d97706",
  High: "#ea580c",
  "Very High": "#be123c",
};

const prototypeRisks: RiskRecord[] = [
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

const prototypeActions: ActionRecord[] = [
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

const prototypeQiItems: QiRecord[] = [
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

const prototypeBrightIdeas: BrightIdeaRecord[] = [
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

const prototypeAuditEvents: AuditRecord[] = [
  {
    kind: "audit",
    id: "AU-001",
    date: "08/07/2026 7:42 pm",
    user: "Safety Lead",
    record: "R-001",
    recordType: "Risk",
    scope: "Association",
    relatedRecordId: "A-001",
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
    scope: "Club",
    relatedRecordId: "R-005",
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
    scope: "Venue",
    relatedRecordId: "R-001",
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
    scope: "Club",
    relatedRecordId: "QI-005",
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
    scope: "Association",
    relatedRecordId: "R-003",
    action: "Completed",
    fieldChanged: "Status",
    previousValue: "In progress",
    newValue: "Complete",
    reason: "Updated list published.",
  },
];

const prototypeRiskMatrix: RiskRating[][] = [
  ["Low", "Low", "Low", "Medium", "High"],
  ["Low", "Low", "Medium", "High", "High"],
  ["Low", "Medium", "Medium", "High", "High"],
  ["Medium", "Medium", "Medium", "High", "Very High"],
  ["Medium", "Medium", "High", "Very High", "Very High"],
];

const prototypeSafetyHubData: SafetyHubData = {
  risks: prototypeRisks,
  actions: prototypeActions,
  qiItems: prototypeQiItems,
  brightIdeas: prototypeBrightIdeas,
  auditEvents: prototypeAuditEvents,
  riskMatrix: prototypeRiskMatrix,
  likelihoodDefinitions: defaultLikelihoodDefinitions,
  consequenceDefinitions: defaultConsequenceDefinitions,
  riskCategories: [],
};

const emptySafetyHubData: SafetyHubData = {
  risks: [],
  actions: [],
  qiItems: [],
  brightIdeas: [],
  auditEvents: [],
  riskMatrix: prototypeRiskMatrix,
  likelihoodDefinitions: defaultLikelihoodDefinitions,
  consequenceDefinitions: defaultConsequenceDefinitions,
  riskCategories: [],
};

const SafetyHubDataContext = createContext<SafetyHubDataContextValue>({
  ...prototypeSafetyHubData,
  recordsById: new Map(
    [
      ...prototypeRisks,
      ...prototypeActions,
      ...prototypeQiItems,
      ...prototypeBrightIdeas,
      ...prototypeAuditEvents,
    ].map((record) => [record.id, record]),
  ),
});

function useSafetyHubData() {
  return useContext(SafetyHubDataContext);
}

const likelihoodLabels = defaultLikelihoodDefinitions.map((definition) => definition.name);
const consequenceLabels = defaultConsequenceDefinitions.map((definition) => definition.name);

const likelihoodGuidance = [
  "Rare: may occur only in exceptional circumstances, such as once every five or more seasons.",
  "Unlikely: could occur at some time, but has not happened recently in this club or competition.",
  "Possible: might occur during a normal season based on known incidents, near misses or local conditions.",
  "Likely: expected to occur at least once in a season unless controls are improved.",
  "Almost Certain: expected to occur many times, or is already happening repeatedly.",
];

const consequenceGuidance = [
  "Insignificant: no injury or disruption; handled with normal supervision or a quick local fix.",
  "Minor: first aid, short delay, small cost, or low-level complaint with no lasting impact.",
  "Moderate: medical treatment, missed game, repeated complaint, equipment damage, or committee follow-up required.",
  "Major: serious injury, child safety concern, formal investigation, major cost, or significant reputation impact.",
  "Severe: life-threatening injury, major safeguarding breach, legal action, season disruption, or severe financial loss.",
];

const responseGuidance = [
  "Low: manage through normal procedures, keep basic controls in place, and review annually.",
  "Medium: assign an owner, record current controls, and review at least six-monthly or after an incident.",
  "High: create a treatment action, report to committee, check controls are working, and review at least quarterly.",
  "Very High: escalate immediately, consider pausing the activity until controls are clear, and review monthly until reduced.",
];

const categoryGuidance = [
  "Safety: injury prevention, first aid, equipment, venue hazards and player welfare.",
  "Child safety: supervision, behaviour, reporting, screening and safeguarding obligations.",
  "Operational: rosters, fixtures, volunteers, data quality and day-to-day delivery risks.",
  "Compliance: policies, legal duties, insurance, WWCC, privacy and record keeping.",
  "Reputation: member trust, complaints, communication, social media and community confidence.",
  "Financial: fees, grants, purchases, cash handling, loss, waste or unexpected costs.",
];

const reviewGuidance = [
  "Very High: monthly until the rating is reduced and controls are proven.",
  "High: quarterly, or sooner after an incident, near miss or major change.",
  "Medium: six-monthly, or at season start and season end.",
  "Low: annually, unless the activity or controls change.",
  "Any overdue review should appear in the dashboard and remain visible until closed.",
];

const inherentResidualGuidance = [
  "Inherent risk is the rating before considering current controls.",
  "Residual risk is the rating after current controls are considered.",
  "Example: an uninspected goal cage may be High inherent risk; after inspection, anchoring and pre-game checks, it may become Medium residual risk.",
  "Target risk is the rating the club is aiming for after extra actions are completed.",
];

const matrixGuidanceTabs = [
  { value: "likelihood", label: "Likelihood", title: "Likelihood definitions", items: likelihoodGuidance },
  { value: "consequences", label: "Consequences", title: "Consequence examples", items: consequenceGuidance },
  { value: "responses", label: "Ratings and responses", title: "Risk response guide", items: [...responseGuidance, ...inherentResidualGuidance] },
  { value: "reviews", label: "Reviews", title: "Review frequency", items: reviewGuidance },
  { value: "categories", label: "Categories", title: "Sporting risk categories", items: categoryGuidance },
];

export default function SafetyRiskModule() {
  const { toast } = useToast();
  const { loading: scopeLoading, isAnyAdmin } = useAdminScope();
  const {
    selectedAssociation,
    selectedClub,
    selectedTeam,
  } = useTeamContext();
  const [safetyData, setSafetyData] = useState<SafetyHubData>(emptySafetyHubData);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const {
    risks,
    actions,
    qiItems,
    brightIdeas,
    auditEvents,
    riskMatrix,
    likelihoodDefinitions,
    consequenceDefinitions,
    riskCategories: configuredRiskCategories,
  } = safetyData;
  const [activeRecord, setActiveRecord] = useState<SafetyRecord | null>(null);
  const [expandedLinkedRowId, setExpandedLinkedRowId] = useState<string | null>(null);
  const [riskSearch, setRiskSearch] = useState("");
  const [riskRating, setRiskRating] = useState("__all__");
  const [riskStatus, setRiskStatus] = useState("__all__");
  const [riskCategory, setRiskCategory] = useState("__all__");
  const [riskOwner, setRiskOwner] = useState("__all__");
  const [riskReviewState, setRiskReviewState] = useState("__all__");
  const [riskScope, setRiskScope] = useState("__all__");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");
  const [auditUser, setAuditUser] = useState("__all__");
  const [auditRecordType, setAuditRecordType] = useState("__all__");
  const [auditRecordId, setAuditRecordId] = useState("");
  const [auditAction, setAuditAction] = useState("__all__");
  const [formMode, setFormMode] = useState<SafetyFormMode | null>(null);
  const [formContext, setFormContext] = useState<SafetyFormContext>({});
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formStep, setFormStep] = useState(0);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [formDirty, setFormDirty] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [formSaving, setFormSaving] = useState(false);

  const scopeLabel = selectedTeam?.name || selectedClub?.name || selectedAssociation?.name || "All accessible organisations";
  const recordsById = useMemo(
    () => new Map<string, SafetyRecord>(
      [
        ...risks,
        ...actions,
        ...qiItems,
        ...brightIdeas,
        ...auditEvents,
      ].map((record) => [record.id, record]),
    ),
    [actions, auditEvents, brightIdeas, qiItems, risks],
  );
  const dataContextValue = useMemo<SafetyHubDataContextValue>(
    () => ({ ...safetyData, recordsById }),
    [recordsById, safetyData],
  );

  useEffect(() => {
    if (scopeLoading || !isAnyAdmin) {
      if (!scopeLoading) setDataLoading(false);
      return;
    }

    let cancelled = false;
    setDataLoading(true);
    setDataError(null);

    loadSafetyHubData({
      associationId: selectedAssociation?.id,
      clubId: selectedClub?.id,
      teamId: selectedTeam?.id,
    })
      .then((nextData) => {
        if (cancelled) return;
        setSafetyData(nextData);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSafetyData(emptySafetyHubData);
        setDataError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isAnyAdmin,
    scopeLoading,
    selectedAssociation?.id,
    selectedClub?.id,
    selectedTeam?.id,
  ]);

  const openForm = ({ mode, context = {} }: OpenFormOptions) => {
    setActiveRecord(null);
    setFormMode(mode);
    setFormContext(context);
    setFormValues(createInitialFormValues(mode, context, scopeLabel, safetyData));
    setFormStep(0);
    setFormErrors([]);
    setFormDirty(false);
  };

  const toggleLinkedRow = (recordId: string) => {
    setExpandedLinkedRowId((current) => current === recordId ? null : recordId);
  };

  const handleLinkedRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, recordId: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleLinkedRow(recordId);
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
  };

  const submitForm = async () => {
    if (!formMode) return;
    const errors = validateSafetyForm(formMode, formValues);
    const isEdit = Boolean(
      (formMode === "risk" && formContext.riskId)
      || (formMode === "action" && formContext.actionId)
      || (formMode === "qi" && formContext.qiId),
    );
    if (isEdit && !formValues.changeReason?.trim()) {
      errors.push("Change reason is required when editing an existing record.");
    }
    if (["risk", "action", "qi", "idea"].includes(formMode) && !isEdit && !selectedAssociation?.id) {
      errors.push("Select an association before creating a Safety Hub record.");
    }
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormSaving(true);
    try {
      const ownerId = await resolveSafetyOwnerId(formValues.owner || "");
      const recordId = getFormRecordDatabaseId(formMode, formContext, safetyData);
      const payload = buildSafetyFormPayload(formMode, formValues, safetyData, ownerId);
      const { error: saveError } = await supabase.rpc("save_safety_hub_form", {
        p_mode: formMode,
        p_record_id: (recordId ?? null) as string,
        p_association_id: (selectedAssociation?.id ?? null) as string,
        p_club_id: (selectedClub?.id ?? null) as string,
        p_team_id: (selectedTeam?.id ?? null) as string,
        p_payload: payload,
      });
      if (saveError) throw saveError;

      const nextData = await loadSafetyHubData({
        associationId: selectedAssociation?.id,
        clubId: selectedClub?.id,
        teamId: selectedTeam?.id,
      });
      setSafetyData(nextData);
      const followUpMode = formMode === "committee-review"
        ? getCommitteeReviewFollowUpMode(formValues.conversion)
        : null;
      const ideaId = formContext.ideaId;
      closeForm();
      if (followUpMode && ideaId) {
        const nextContext = { ideaId };
        setFormMode(followUpMode);
        setFormContext(nextContext);
        setFormValues(createInitialFormValues(followUpMode, nextContext, scopeLabel, nextData));
        toast({ title: "Committee decision saved", description: "Complete the linked record now." });
      } else {
        toast({ title: getSafetySaveTitle(formMode), description: "The live Dev record and audit history are up to date." });
      }
    } catch (error: unknown) {
      setFormErrors([getErrorMessage(error)]);
      toast({ title: "Safety Hub record not saved", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setFormSaving(false);
    }
  };

  const riskCategories = useMemo(
    () => Array.from(new Set(risks.map((risk) => risk.category))).sort(),
    [risks],
  );

  const riskOwners = useMemo(
    () => Array.from(new Set(risks.map((risk) => risk.owner))).sort(),
    [risks],
  );

  const riskScopes = useMemo(
    () => Array.from(new Set(risks.map((risk) => risk.scope))).sort(),
    [risks],
  );

  const auditUsers = useMemo(
    () => Array.from(new Set(auditEvents.map((event) => event.user))).sort(),
    [auditEvents],
  );

  const auditActions = useMemo(
    () => Array.from(new Set(auditEvents.map((event) => event.action))).sort(),
    [auditEvents],
  );

  const auditRecordTypes = useMemo(
    () => Array.from(new Set(auditEvents.map((event) => event.recordType))).sort(),
    [auditEvents],
  );

  const filteredAuditEvents = useMemo(() => {
    const fromDate = parseDateFilter(auditDateFrom);
    const toDate = parseDateFilter(auditDateTo);
    const recordSearch = auditRecordId.trim().toLowerCase();

    return auditEvents.filter((event) => {
      const eventDate = parseAuditEventDate(event.date);
      const matchesFrom = !fromDate || !eventDate || eventDate >= fromDate;
      const matchesTo = !toDate || !eventDate || eventDate <= endOfDay(toDate);
      const matchesUser = auditUser === "__all__" || event.user === auditUser;
      const matchesRecordType = auditRecordType === "__all__" || event.recordType === auditRecordType;
      const matchesRecordId =
        !recordSearch ||
        [event.record, event.relatedRecordId || ""]
          .some((value) => value.toLowerCase().includes(recordSearch));
      const matchesAction = auditAction === "__all__" || event.action === auditAction;

      return matchesFrom && matchesTo && matchesUser && matchesRecordType && matchesRecordId && matchesAction;
    });
  }, [auditAction, auditDateFrom, auditDateTo, auditEvents, auditRecordId, auditRecordType, auditUser]);

  const filteredRisks = useMemo(() => {
    const search = riskSearch.trim().toLowerCase();
    return risks.filter((risk) => {
      const matchesSearch =
        !search ||
        [risk.id, risk.title, risk.summary, risk.category, risk.owner, risk.scope]
          .some((value) => value.toLowerCase().includes(search));
      const matchesRating = riskRating === "__all__" || risk.residualRating === riskRating;
      const matchesStatus = riskStatus === "__all__" || risk.status === riskStatus;
      const matchesCategory = riskCategory === "__all__" || risk.category === riskCategory;
      const matchesOwner = riskOwner === "__all__" || risk.owner === riskOwner;
      const matchesReviewState = riskReviewState === "__all__" || risk.reviewState === riskReviewState;
      const matchesScope = riskScope === "__all__" || risk.scope === riskScope;
      return matchesSearch && matchesRating && matchesStatus && matchesCategory && matchesOwner && matchesReviewState && matchesScope;
    });
  }, [riskCategory, riskOwner, riskRating, riskReviewState, riskScope, riskSearch, riskStatus, risks]);

  const ratingData = useMemo(
    () => ratingOrder.map((rating) => ({
      name: rating,
      value: risks.filter((risk) => risk.residualRating === rating).length,
      fill: ratingColours[rating],
    })),
    [risks],
  );

  const actionStatusData = useMemo(() => {
    const statuses: ActionStatus[] = ["Not started", "In progress", "Blocked", "Complete", "Entered in error"];
    return statuses.map((status) => ({
      name: status,
      value: actions.filter((action) => action.status === status).length,
      fill: status === "Complete" ? "#059669" : status === "Blocked" || status === "Entered in error" ? "#be123c" : "#2563eb",
    }));
  }, [actions]);

  const categoryData = useMemo(
    () => riskCategories.map((category) => ({
      name: category,
      value: risks.filter((risk) => risk.category === category).length,
      fill: "#2563eb",
    })),
    [riskCategories, risks],
  );

  const qiStatusData = useMemo(() => {
    const statuses: QiStatus[] = ["New", "Awaiting decision", "Approved", "In progress", "Complete", "Entered in error"];
    return statuses.map((status) => ({
      name: status,
      value: qiItems.filter((item) => item.status === status).length,
      fill: status === "Complete" ? "#059669" : status === "Entered in error" ? "#be123c" : status === "Awaiting decision" ? "#d97706" : "#2563eb",
    }));
  }, [qiItems]);

  const highestRisks = [...risks]
    .sort((a, b) => ratingOrder.indexOf(a.residualRating) - ratingOrder.indexOf(b.residualRating))
    .slice(0, 5);
  const highOrVeryHighRisks = risks.filter((risk) => risk.residualRating === "High" || risk.residualRating === "Very High").length;
  const overdueActions = actions.filter((action) => action.dueState === "Overdue").length;
  const dueSoonActions = actions.filter((action) => action.dueState === "Due soon").length;
  const awaitingQi = qiItems.filter((item) => item.status === "Awaiting decision").length;
  const awaitingIdeas = brightIdeas.filter((idea) => idea.decision === "Pending").length;
  const overdueReviews = risks.filter((risk) => risk.reviewState === "Overdue").length;
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

  if (scopeLoading || dataLoading) {
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
    <SafetyHubDataContext.Provider value={dataContextValue}>
      <div className="min-w-0 space-y-6">
      <div className="-mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-semibold tracking-tight">Safety Hub</h1>
              <Badge variant="outline">Live Dev module</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Manage risks, actions, quality improvements and Bright Ideas across {scopeLabel}.
            </p>
          </div>
          <AddRecordButton onOpenForm={(mode) => openForm({ mode })} />
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="min-w-0 space-y-4">
        <TabsList className="sticky top-14 z-20 flex h-auto w-full min-w-0 justify-start gap-1 overflow-x-auto border bg-muted/80 p-1.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-muted/70 dark:bg-muted/50">
          <TabsTrigger value="dashboard" className={safetyTabTriggerClass}>Dashboard</TabsTrigger>
          <TabsTrigger value="risks" className={safetyTabTriggerClass}>Risk Register</TabsTrigger>
          <TabsTrigger value="actions" className={safetyTabTriggerClass}>Actions</TabsTrigger>
          <TabsTrigger value="qi" className={safetyTabTriggerClass}>QI Register</TabsTrigger>
          <TabsTrigger value="ideas" className={safetyTabTriggerClass}>Bright Ideas</TabsTrigger>
          <TabsTrigger value="matrix" className={safetyTabTriggerClass}>Matrix & Guidance</TabsTrigger>
          <TabsTrigger value="audit" className={safetyTabTriggerClass}>Audit History</TabsTrigger>
        </TabsList>

        {dataError && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100">
            <div className="font-semibold">Safety Hub data could not be loaded</div>
            <p className="mt-1">{dataError}</p>
          </div>
        )}

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
            <MetricCard icon={ShieldCheck} label="Total risks" value={risks.length} />
            <MetricCard icon={AlertTriangle} label="High / Very High risks" value={highOrVeryHighRisks} tone="critical" />
            <MetricCard icon={ListChecks} label="Total actions" value={actions.length} />
            <MetricCard icon={ClipboardList} label="Overdue actions" value={overdueActions} tone="warning" />
            <MetricCard icon={CalendarClock} label={`Due within ${dueSoonDays} days`} value={dueSoonActions} tone="warning" />
            <MetricCard icon={ClipboardCheck} label="Total QI items" value={qiItems.length} />
            <MetricCard icon={ClipboardList} label="QI awaiting decision" value={awaitingQi} tone="warning" />
            <MetricCard icon={Lightbulb} label="Bright Ideas awaiting review" value={awaitingIdeas} tone="warning" />
            <MetricCard icon={FileClock} label="Reviews overdue" value={overdueReviews} tone="critical" />
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
                <TableRow key={risk.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveRecord(risk)}>
                  <TableCell className={idCellClass}>{risk.id}</TableCell>
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
                <TableRow key={`${item.type}-${item.id}`} className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveRecord(item.record)}>
                  <TableCell><Badge variant="outline">{item.type}</Badge></TableCell>
                  <TableCell className={idCellClass}>{item.id}</TableCell>
                  <TableCell className="min-w-48">
                    <span className="font-medium">{item.description}</span>
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
            owner={riskOwner}
            onOwnerChange={setRiskOwner}
            owners={riskOwners}
            reviewState={riskReviewState}
            onReviewStateChange={setRiskReviewState}
            scope={riskScope}
            onScopeChange={setRiskScope}
            scopes={riskScopes}
          />
          <RegisterTable
            title="Risk Register"
            icon={ShieldCheck}
            columns={["ID", "Risk / summary", "Current rating", "Target rating", "Owner", "Review", "Status", ""]}
            emptyLabel="No risks match the selected filters."
          >
            {filteredRisks.map((risk) => {
              const isExpanded = expandedLinkedRowId === risk.id;

              return (
                <Fragment key={risk.id}>
                  <TableRow
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={`${risk.id}-links`}
                    className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    onClick={() => toggleLinkedRow(risk.id)}
                    onKeyDown={(event) => handleLinkedRowKeyDown(event, risk.id)}
                  >
                    <TableCell className={idCellClass}>{risk.id}</TableCell>
                    <TableCell className="min-w-48">
                      <div className="font-medium">{risk.title}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{risk.summary}</div>
                    </TableCell>
                    <TableCell><RiskRatingBadge rating={risk.residualRating} /></TableCell>
                    <TableCell><RiskRatingBadge rating={risk.targetRating} /></TableCell>
                    <TableCell>{risk.owner}</TableCell>
                    <TableCell><DueBadge state={risk.reviewState} label={risk.nextReview} /></TableCell>
                    <TableCell><StatusBadge status={risk.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`View ${risk.id} details`}
                          onClick={(event) => { event.stopPropagation(); setActiveRecord(risk); }}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <Eye className="h-4 w-4 xl:mr-2" />
                          <span className="hidden xl:inline">View details</span>
                        </Button>
                        <ExpandAssociatedRecordsButton
                          recordId={risk.id}
                          isExpanded={isExpanded}
                          onToggle={toggleLinkedRow}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <ExpandedLinkedRecordsRow
                      id={`${risk.id}-links`}
                      colSpan={8}
                      sourceRecord={risk}
                      onOpenRecord={setActiveRecord}
                    />
                  )}
                </Fragment>
              );
            })}
          </RegisterTable>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <RegisterTable
            title="Actions"
            icon={ListChecks}
            columns={["ID", "Action", "Owner", "Due", "Status", ""]}
            emptyLabel="No actions to show."
          >
            {actions.map((action) => {
              const isExpanded = expandedLinkedRowId === action.id;

              return (
                <Fragment key={action.id}>
                  <TableRow
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={`${action.id}-links`}
                    className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    onClick={() => toggleLinkedRow(action.id)}
                    onKeyDown={(event) => handleLinkedRowKeyDown(event, action.id)}
                  >
                    <TableCell className={idCellClass}>{action.id}</TableCell>
                    <TableCell className="min-w-48">
                      <div className="font-medium">{action.title}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{action.specific}</div>
                    </TableCell>
                    <TableCell>{action.owner}</TableCell>
                    <TableCell><DueBadge state={action.dueState} label={action.dueDate} /></TableCell>
                    <TableCell><StatusBadge status={action.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`View ${action.id} details`}
                          onClick={(event) => { event.stopPropagation(); setActiveRecord(action); }}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <Eye className="h-4 w-4 xl:mr-2" />
                          <span className="hidden xl:inline">View details</span>
                        </Button>
                        <ExpandAssociatedRecordsButton
                          recordId={action.id}
                          isExpanded={isExpanded}
                          onToggle={toggleLinkedRow}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <ExpandedLinkedRecordsRow
                      id={`${action.id}-links`}
                      colSpan={6}
                      sourceRecord={action}
                      onOpenRecord={setActiveRecord}
                    />
                  )}
                </Fragment>
              );
            })}
          </RegisterTable>
        </TabsContent>

        <TabsContent value="qi" className="space-y-4">
          <RegisterTable
            title="QI Register"
            icon={ClipboardCheck}
            columns={["ID", "Improvement", "Priority", "Owner", "Due", "Status", ""]}
            emptyLabel="No QI items to show."
          >
            {qiItems.map((item) => {
              const isExpanded = expandedLinkedRowId === item.id;

              return (
                <Fragment key={item.id}>
                  <TableRow
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={`${item.id}-links`}
                    className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    onClick={() => toggleLinkedRow(item.id)}
                    onKeyDown={(event) => handleLinkedRowKeyDown(event, item.id)}
                  >
                    <TableCell className={idCellClass}>{item.id}</TableCell>
                    <TableCell className="min-w-48">
                      <div className="font-medium">{item.title}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{item.issue}</div>
                    </TableCell>
                    <TableCell><PriorityBadge priority={item.priority} /></TableCell>
                    <TableCell>{item.owner}</TableCell>
                    <TableCell><DueBadge state={item.dueState} label={item.dueDate} /></TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`View ${item.id} details`}
                          onClick={(event) => { event.stopPropagation(); setActiveRecord(item); }}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <Eye className="h-4 w-4 xl:mr-2" />
                          <span className="hidden xl:inline">View details</span>
                        </Button>
                        <ExpandAssociatedRecordsButton
                          recordId={item.id}
                          isExpanded={isExpanded}
                          onToggle={toggleLinkedRow}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <ExpandedLinkedRecordsRow
                      id={`${item.id}-links`}
                      colSpan={7}
                      sourceRecord={item}
                      onOpenRecord={setActiveRecord}
                    />
                  )}
                </Fragment>
              );
            })}
          </RegisterTable>
        </TabsContent>

        <TabsContent value="ideas" className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Bright Ideas</h2>
              <p className="text-sm text-muted-foreground">
                Capture practical improvement suggestions before they become formal QI items, actions or risks.
              </p>
            </div>
            <Button onClick={() => openForm({ mode: "idea" })}>
              <Lightbulb className="mr-2 h-4 w-4" />
              Submit a Bright Idea
            </Button>
          </div>
          <RegisterTable
            title="Bright Ideas"
            icon={Lightbulb}
            columns={["ID", "Idea", "Submitted by", "Decision", "Status", ""]}
            emptyLabel="No Bright Ideas to show."
          >
            {brightIdeas.map((idea) => {
              const isExpanded = expandedLinkedRowId === idea.id;

              return (
                <Fragment key={idea.id}>
                  <TableRow
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-controls={`${idea.id}-links`}
                    className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    onClick={() => toggleLinkedRow(idea.id)}
                    onKeyDown={(event) => handleLinkedRowKeyDown(event, idea.id)}
                  >
                    <TableCell className={idCellClass}>{idea.id}</TableCell>
                    <TableCell className="min-w-48">
                      <div className="font-medium">{idea.title}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{idea.whyNeeded}</div>
                    </TableCell>
                    <TableCell>
                      <div>{idea.submittedBy}</div>
                      <div className="text-xs text-muted-foreground">{idea.submittedDate}</div>
                    </TableCell>
                    <TableCell><DecisionBadge decision={idea.decision} /></TableCell>
                    <TableCell><StatusBadge status={idea.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`View ${idea.id} details`}
                          onClick={(event) => { event.stopPropagation(); setActiveRecord(idea); }}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <Eye className="h-4 w-4 xl:mr-2" />
                          <span className="hidden xl:inline">View details</span>
                        </Button>
                        <ExpandAssociatedRecordsButton
                          recordId={idea.id}
                          isExpanded={isExpanded}
                          onToggle={toggleLinkedRow}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <ExpandedLinkedRecordsRow
                      id={`${idea.id}-links`}
                      colSpan={6}
                      sourceRecord={idea}
                      onOpenRecord={setActiveRecord}
                    />
                  )}
                </Fragment>
              );
            })}
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
                      <TableHead className="w-44 bg-muted/70 font-bold text-foreground">Likelihood</TableHead>
                      {consequenceDefinitions.map(({ name: label }) => (
                        <TableHead key={label} className="bg-muted/70 text-center font-bold text-foreground">{label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {likelihoodDefinitions.map(({ name: likelihood }, rowIndex) => (
                      <TableRow key={likelihood}>
                        <TableCell className="bg-muted/35 font-bold text-foreground">{likelihood}</TableCell>
                        {riskMatrix[rowIndex].map((rating, columnIndex) => (
                          <TableCell
                            key={`${likelihood}-${consequenceDefinitions[columnIndex]?.name ?? columnIndex}`}
                            className={cn("border-2 text-center", ratingCellStyles[rating])}
                          >
                            <MatrixRatingLabel rating={rating} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <RiskConfigurationEditor
                associationId={selectedAssociation?.id}
                clubId={selectedClub?.id}
                likelihoods={likelihoodDefinitions}
                consequences={consequenceDefinitions}
                matrix={riskMatrix}
                categories={configuredRiskCategories}
                onSaved={async () => {
                  const nextData = await loadSafetyHubData({
                    associationId: selectedAssociation?.id,
                    clubId: selectedClub?.id,
                    teamId: selectedTeam?.id,
                  });
                  setSafetyData(nextData);
                }}
              />
              <Tabs defaultValue="likelihood" className="space-y-3">
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 border bg-muted/80 p-1 md:grid-cols-3 xl:grid-cols-5">
                  {matrixGuidanceTabs.map((section) => (
                    <TabsTrigger
                      key={section.value}
                      value={section.value}
                      className="font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                    >
                      {section.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {matrixGuidanceTabs.map((section) => (
                  <TabsContent key={section.value} value={section.value}>
                    <GuidanceBlock title={section.title} items={section.items} />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditFilterBar
            dateFrom={auditDateFrom}
            onDateFromChange={setAuditDateFrom}
            dateTo={auditDateTo}
            onDateToChange={setAuditDateTo}
            user={auditUser}
            onUserChange={setAuditUser}
            users={auditUsers}
            recordType={auditRecordType}
            onRecordTypeChange={setAuditRecordType}
            recordTypes={auditRecordTypes}
            recordId={auditRecordId}
            onRecordIdChange={setAuditRecordId}
            action={auditAction}
            onActionChange={setAuditAction}
            actions={auditActions}
          />
          <RegisterTable
            title="Audit History"
            icon={History}
            columns={["Date", "User", "Record", "Action", "Field", ""]}
            emptyLabel="No audit rows to show."
          >
            {filteredAuditEvents.map((event) => (
              <TableRow key={event.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setActiveRecord(event)}>
                <TableCell className="whitespace-nowrap">{event.date}</TableCell>
                <TableCell>{event.user}</TableCell>
                <TableCell>
                  <div className="whitespace-nowrap font-mono text-xs">{event.record}</div>
                  <div className="text-xs text-muted-foreground">{event.recordType}</div>
                </TableCell>
                <TableCell>{event.action}</TableCell>
                <TableCell>{event.fieldChanged}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={(clickEvent) => { clickEvent.stopPropagation(); setActiveRecord(event); }}>
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
        saving={formSaving}
        onStepChange={setFormStep}
        onValueChange={updateFormValue}
        onRequestClose={requestFormClose}
        onSubmit={() => void submitForm()}
      />
      <SafetyDetailDrawer
        record={activeRecord}
        onOpenChange={(open) => !open && setActiveRecord(null)}
        onOpenForm={openForm}
        onOpenRecord={setActiveRecord}
      />
      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This form has unsaved changes. Closing it will clear the draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={closeForm}>Discard draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </SafetyHubDataContext.Provider>
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
  const [open, setOpen] = useState(false);
  const openFormAndCloseMenu = (mode: SafetyFormMode) => {
    setOpen(false);
    onOpenForm(mode);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="text-foreground hover:bg-primary hover:text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" />
          Add record
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Create Safety Hub record</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => openFormAndCloseMenu("risk")}>Add risk</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openFormAndCloseMenu("action")}>Add action</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openFormAndCloseMenu("qi")}>Add QI item</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openFormAndCloseMenu("idea")}>Submit Bright Idea</DropdownMenuItem>
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
    warning: "text-amber-700 dark:text-amber-300",
    critical: "text-rose-700 dark:text-rose-300",
  }[tone];

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <Icon className={cn("h-4 w-4", toneClass)} />
          <span className="text-xl font-semibold">{value}</span>
        </div>
        <p className="mt-1 text-xs leading-tight text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
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

function ThemedChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: ChartDatum }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      {label && <div className="mb-1 font-medium">{label}</div>}
      <div className="space-y-1">
        {payload.map((entry) => {
          const colour = entry.color || entry.payload?.fill || "hsl(var(--primary))";
          const name = entry.name === "value" ? entry.payload?.name : entry.name;

          return (
            <div key={`${name}-${entry.value}`} className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colour }} />
              <span>{name || "Count"}</span>
              <span className="font-medium text-popover-foreground">{entry.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SimpleBarChart({ data }: { data: ChartDatum[] }) {
  const axisTick = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 24 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} angle={-15} textAnchor="end" height={48} />
          <YAxis allowDecimals={false} tick={axisTick} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
          <Tooltip content={<ThemedChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.35)" }} wrapperStyle={{ outline: "none" }} />
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
      <div className="h-56" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} rootTabIndex={-1}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<ThemedChartTooltip />} wrapperStyle={{ outline: "none" }} />
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
  owner,
  onOwnerChange,
  owners,
  reviewState,
  onReviewStateChange,
  scope,
  onScopeChange,
  scopes,
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
  owner: string;
  onOwnerChange: (value: string) => void;
  owners: string[];
  reviewState: string;
  onReviewStateChange: (value: string) => void;
  scope: string;
  onScopeChange: (value: string) => void;
  scopes: string[];
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7">
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
          <FilterSelect value={owner} onValueChange={onOwnerChange} options={["__all__", ...owners]} label="Owner" />
          <FilterSelect value={reviewState} onValueChange={onReviewStateChange} options={reviewStateOptions} label="Review due" />
          <FilterSelect value={scope} onValueChange={onScopeChange} options={["__all__", ...scopes]} label="Scope" />
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
      <SelectTrigger className="h-10 w-full min-w-0 overflow-hidden px-3 py-2">
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

function AuditFilterBar({
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  user,
  onUserChange,
  users,
  recordType,
  onRecordTypeChange,
  recordTypes,
  recordId,
  onRecordIdChange,
  action,
  onActionChange,
  actions,
}: {
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  user: string;
  onUserChange: (value: string) => void;
  users: string[];
  recordType: string;
  onRecordTypeChange: (value: string) => void;
  recordTypes: string[];
  recordId: string;
  onRecordIdChange: (value: string) => void;
  action: string;
  onActionChange: (value: string) => void;
  actions: string[];
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[10rem_10rem_11rem_10.5rem_minmax(0,1fr)_11rem]">
          <div className="space-y-1 sm:max-w-40">
            <Label htmlFor="audit-date-from" className="text-xs text-muted-foreground">From</Label>
            <Input className="h-10 px-3 py-2" id="audit-date-from" type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
          </div>
          <div className="space-y-1 sm:max-w-40">
            <Label htmlFor="audit-date-to" className="text-xs text-muted-foreground">To</Label>
            <Input className="h-10 px-3 py-2" id="audit-date-to" type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">User</Label>
            <FilterSelect value={user} onValueChange={onUserChange} options={["__all__", ...users]} label="User" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Record type</Label>
            <FilterSelect value={recordType} onValueChange={onRecordTypeChange} options={["__all__", ...recordTypes]} label="Record type" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-record-id" className="text-xs text-muted-foreground">Record ID</Label>
            <Input
              className="h-10 px-3 py-2"
              id="audit-record-id"
              value={recordId}
              onChange={(event) => onRecordIdChange(event.target.value)}
              placeholder="Search R-001, A-001..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Action type</Label>
            <FilterSelect value={action} onValueChange={onActionChange} options={["__all__", ...actions]} label="Action" />
          </div>
        </div>
      </CardContent>
    </Card>
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
  const [sort, setSort] = useState<SortState<string> | null>(null);
  const rowNodes = Children.toArray(children);
  const hasRows = rowNodes.length > 0;
  const extractText = (node: ReactNode): string => {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(extractText).join(" ");
    if (!isValidElement<{ children?: ReactNode }>(node)) return "";
    return extractText(node.props.children);
  };
  const columnText = (node: ReactNode, columnIndex: number) => {
    if (!isValidElement<{ children?: ReactNode }>(node)) return "";
    const fragmentChildren = Children.toArray(node.props.children);
    const row = node.type === Fragment ? fragmentChildren[0] : node;
    if (!isValidElement<{ children?: ReactNode }>(row)) return "";
    return extractText(Children.toArray(row.props.children)[columnIndex]);
  };
  const displayedRows = sort
    ? stableSortRows(rowNodes, sort, (node, key) => columnText(node, Number(key)))
    : rowNodes;

  return (
    <Card className="min-w-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 !font-sans text-base">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table className="[&_td]:py-2.5 [&_th]:h-10">
          <TableHeader>
            <TableRow>{columns.map((column, index) => column ? (
              <SortableTableHead key={`${column}-${index}`} label={column} sortKey={String(index)} sort={sort} onSort={(key) => setSort(nextSortState(sort, key))} className="whitespace-nowrap" />
            ) : <TableHead key={`actions-${index}`} />)}</TableRow>
          </TableHeader>
          <TableBody>
            {hasRows ? displayedRows : (
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

function ExpandAssociatedRecordsButton({
  recordId,
  isExpanded,
  onToggle,
}: {
  recordId: string;
  isExpanded: boolean;
  onToggle: (recordId: string) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      aria-label={`${isExpanded ? "Hide" : "Show"} associated records for ${recordId}`}
      aria-expanded={isExpanded}
      aria-controls={`${recordId}-links`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(recordId);
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
    </Button>
  );
}

const associationGroups: Array<{
  kind: CoreSafetyRecord["kind"];
  label: string;
  emptyLabel: string;
}> = [
  { kind: "risk", label: "Associated risks", emptyLabel: "No associated risks." },
  { kind: "action", label: "Associated actions", emptyLabel: "No associated actions." },
  { kind: "qi", label: "Associated QI items", emptyLabel: "No associated QI items." },
  { kind: "idea", label: "Associated Bright Ideas", emptyLabel: "No associated Bright Ideas." },
];

const associationSummaryGridClass = "grid-cols-[5.5rem_minmax(12rem,1fr)_9rem_10rem_9rem]";

const associationColumnLabels: Record<CoreSafetyRecord["kind"], [string, string, string, string, string]> = {
  risk: ["ID", "Risk / summary", "Rating", "Owner", "Review"],
  action: ["ID", "Action / summary", "Owner", "Due", "Status"],
  qi: ["ID", "QI item / summary", "Owner", "Due", "Status"],
  idea: ["ID", "Bright Idea / summary", "Submitted by", "Decision", "Status"],
};

function ExpandedLinkedRecordsRow({
  id,
  colSpan,
  sourceRecord,
  onOpenRecord,
}: {
  id: string;
  colSpan: number;
  sourceRecord: CoreSafetyRecord;
  onOpenRecord: (record: SafetyRecord) => void;
}) {
  const { risks, actions, qiItems, brightIdeas } = useSafetyHubData();
  const linkedRecords = getAssociatedSafetyRecords(
    sourceRecord,
    [...risks, ...actions, ...qiItems, ...brightIdeas],
  );
  const visibleGroups = associationGroups.filter((group) => group.kind !== sourceRecord.kind);

  return (
    <TableRow id={id} className="bg-muted/35 hover:bg-muted/35">
      <TableCell colSpan={colSpan} className="py-3 pl-8 pr-4">
        <div className="space-y-3 border-l-2 border-muted-foreground/20 pl-3">
          {visibleGroups.map((group) => (
            <AssociatedRecordSection
              key={group.kind}
              headingId={`${id}-${group.kind}`}
              label={group.label}
              emptyLabel={group.emptyLabel}
              records={linkedRecords.filter((record) => record.kind === group.kind)}
              onOpenRecord={onOpenRecord}
            />
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

function AssociatedRecordSection({
  headingId,
  label,
  emptyLabel,
  records,
  onOpenRecord,
}: {
  headingId: string;
  label: string;
  emptyLabel: string;
  records: CoreSafetyRecord[];
  onOpenRecord: (record: SafetyRecord) => void;
}) {
  return (
    <section aria-labelledby={headingId}>
      <h4 id={headingId} className="text-xs font-semibold uppercase text-foreground">
        {label}
      </h4>
      {records.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="mt-1 overflow-x-auto">
          <div className="min-w-[720px]">
            <div className={cn("grid w-full items-center gap-3 border-y bg-muted/45 px-1 py-1 text-[11px] font-semibold uppercase text-muted-foreground", associationSummaryGridClass)}>
              {associationColumnLabels[records[0].kind].map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>
            {records.map((record) => (
              <AssociatedRecordSummary
                key={record.id}
                record={record}
                onOpenRecord={onOpenRecord}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function AssociatedRecordSummary({
  record,
  onOpenRecord,
}: {
  record: CoreSafetyRecord;
  onOpenRecord: (record: SafetyRecord) => void;
}) {
  return (
    <button
      type="button"
      className={cn("grid w-full items-start gap-3 border-b px-1 py-2.5 text-left transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 dark:hover:bg-background/25", associationSummaryGridClass)}
      onClick={(event) => {
        event.stopPropagation();
        onOpenRecord(record);
      }}
    >
      <span className="flex items-center gap-2 whitespace-nowrap font-mono text-xs">
        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
        {record.id}
      </span>
      <span className="line-clamp-3 text-sm font-medium leading-5" title={record.title}>{record.title}</span>
      {record.kind === "risk" && (
        <>
          <span className="justify-self-start"><RiskRatingBadge rating={record.residualRating} /></span>
          <span className="text-sm">{record.owner}</span>
          <CompactDueSummary state={record.reviewState} date={record.nextReview} />
        </>
      )}
      {record.kind === "action" && (
        <>
          <span className="text-sm">{record.owner}</span>
          <CompactDueSummary state={record.dueState} date={record.dueDate} />
          <span className="justify-self-start"><StatusBadge status={record.status} /></span>
        </>
      )}
      {record.kind === "qi" && (
        <>
          <span className="text-sm">{record.owner}</span>
          <CompactDueSummary state={record.dueState} date={record.dueDate} />
          <span className="justify-self-start"><StatusBadge status={record.status} /></span>
        </>
      )}
      {record.kind === "idea" && (
        <>
          <CompactValue value={`${record.submittedBy} - ${record.submittedDate}`} />
          {record.decision === "Pending" ? (
            <CompactValue value="Not decided" />
          ) : (
            <span className="justify-self-start"><DecisionBadge decision={record.decision} /></span>
          )}
          <span className="justify-self-start"><StatusBadge status={record.status} /></span>
        </>
      )}
    </button>
  );
}

function CompactValue({ value }: { value: string }) {
  return (
    <span className="line-clamp-3 text-xs font-medium leading-4 text-foreground" title={value}>
      {value}
    </span>
  );
}

function CompactDueSummary({
  state,
  date,
}: {
  state: DueState | ReviewState;
  date: string;
}) {
  const tone = state === "Overdue"
    ? "text-rose-700 dark:text-rose-200"
    : state === "Due soon"
      ? "text-amber-700 dark:text-amber-200"
      : state === "Complete"
        ? "text-emerald-700 dark:text-emerald-200"
        : "text-foreground";

  return (
    <span className={cn("text-xs font-medium leading-4", tone)} title={`${date} (${state === "Current" ? "On track" : state})`}>
      <span className="block">{date}</span>
      <span className="block">{state === "Current" ? "On track" : state}</span>
    </span>
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
    Low: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    Medium: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    High: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-200",
  }[priority];
  return <Badge variant="outline" className={className}>{priority}</Badge>;
}

function StatusBadge({ status }: { status: RiskStatus | ActionStatus | QiStatus | BrightIdeaStatus }) {
  const className =
    status === "Complete" || status === "Controlled" || status === "Accepted" || status === "Approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
      : status === "Blocked" || status === "Entered in error"
        ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
        : status === "Awaiting decision" || status === "Under review" || status === "In progress"
          ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
          : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200";

  return <Badge variant="outline" className={cn("whitespace-nowrap", className)}>{status}</Badge>;
}

function DecisionBadge({ decision }: { decision: BrightIdeaRecord["decision"] }) {
  if (decision === "Pending") {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  const className = {
    Accept: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    Defer: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
    Reject: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
    Close: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200",
  }[decision as Exclude<BrightIdeaRecord["decision"], "Pending">];
  return <Badge variant="outline" className={className}>{decision}</Badge>;
}

function DueBadge({ state, label }: { state: DueState | ReviewState; label: string }) {
  const className = state === "Overdue"
    ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
    : state === "Due soon"
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
      : state === "Complete"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
        : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200";

  return (
    <div className="space-y-1">
      <Badge variant="outline" className={cn("whitespace-nowrap", className)}>{state === "Current" ? "On track" : state}</Badge>
      <div className="whitespace-nowrap text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function MatrixRatingLabel({ rating }: { rating: RiskRating }) {
  return (
    <Badge
      variant="outline"
      className={cn("min-w-20 justify-center whitespace-nowrap border-2 font-bold shadow-sm", matrixRatingLabelStyles[rating])}
    >
      {rating}
    </Badge>
  );
}

function RiskConfigurationEditor({
  associationId,
  clubId,
  likelihoods,
  consequences,
  matrix,
  categories,
  onSaved,
}: {
  associationId?: string;
  clubId?: string;
  likelihoods: RiskConfigDefinition[];
  consequences: RiskConfigDefinition[];
  matrix: RiskRating[][];
  categories: RiskConfigCategory[];
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [likelihoodDraft, setLikelihoodDraft] = useState<RiskConfigDefinition[]>([]);
  const [consequenceDraft, setConsequenceDraft] = useState<RiskConfigDefinition[]>([]);
  const [matrixDraft, setMatrixDraft] = useState<RiskRating[][]>([]);
  const [categoryDraft, setCategoryDraft] = useState<RiskConfigCategory[]>([]);

  const openEditor = () => {
    setLikelihoodDraft(likelihoods.map((item) => ({ ...item })));
    setConsequenceDraft(consequences.map((item) => ({ ...item })));
    setMatrixDraft(matrix.map((row) => [...row]));
    setCategoryDraft(categories.map((item) => ({ ...item })));
    setChangeReason("");
    setOpen(true);
  };

  const updateDefinition = (
    type: "likelihood" | "consequence",
    index: number,
    field: "name" | "description",
    value: string,
  ) => {
    const setter = type === "likelihood" ? setLikelihoodDraft : setConsequenceDraft;
    setter((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const saveConfiguration = async () => {
    if (changeReason.trim().length < 3) {
      toast({ title: "Change reason required", description: "Explain why this configuration is changing.", variant: "destructive" });
      return;
    }
    if ([...likelihoodDraft, ...consequenceDraft, ...categoryDraft].some((item) => !item.name.trim())) {
      toast({ title: "Name required", description: "Every likelihood, consequence and category needs a name.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const matrixPayload = matrixDraft.flatMap((row, rowIndex) => row.map((rating, columnIndex) => ({
        likelihood: rowIndex + 1,
        consequence: columnIndex + 1,
        rating,
      })));
      const { error } = await supabase.rpc("save_safety_risk_configuration" as never, {
        p_association_id: associationId ?? null,
        p_club_id: clubId ?? null,
        p_likelihoods: likelihoodDraft,
        p_consequences: consequenceDraft,
        p_matrix: matrixPayload,
        p_categories: categoryDraft,
        p_change_reason: changeReason.trim(),
      } as never);
      if (error) throw error;
      await onSaved();
      setOpen(false);
      toast({ title: "Risk configuration saved", description: "The matrix, definitions and categories were updated and audited." });
    } catch (error: unknown) {
      toast({ title: "Could not save configuration", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/25 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-semibold">Organisation risk configuration</div>
        <p className="text-xs text-muted-foreground">Edit the fixed 5×5 matrix, descriptors and permanent category list for this scope.</p>
      </div>
      <Button type="button" variant="outline" onClick={openEditor}>Configure</Button>
      <Dialog open={open} onOpenChange={(nextOpen) => !saving && setOpen(nextOpen)}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure risk matrix and categories</DialogTitle>
            <DialogDescription>
              Likelihood and consequence names can change. Category names become permanent after their first save; hide them when no longer used.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <DefinitionEditor title="Likelihoods" type="likelihood" items={likelihoodDraft} onChange={updateDefinition} />
              <DefinitionEditor title="Consequences" type="consequence" items={consequenceDraft} onChange={updateDefinition} />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">5×5 rating matrix</h3>
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Likelihood</TableHead>
                      {consequenceDraft.map((item, index) => <TableHead key={index}>{item.name || `Consequence ${index + 1}`}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrixDraft.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        <TableCell className="font-medium">{likelihoodDraft[rowIndex]?.name || `Likelihood ${rowIndex + 1}`}</TableCell>
                        {row.map((rating, columnIndex) => (
                          <TableCell key={columnIndex} className={cn("min-w-32", ratingCellStyles[rating])}>
                            <Select
                              value={rating}
                              onValueChange={(value: RiskRating) => setMatrixDraft((current) => current.map((currentRow, currentRowIndex) => (
                                currentRowIndex === rowIndex
                                  ? currentRow.map((cell, currentColumnIndex) => currentColumnIndex === columnIndex ? value : cell)
                                  : currentRow
                              )))}
                            >
                              <SelectTrigger className="w-full bg-background/85"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["Low", "Medium", "High", "Very High"].map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Risk categories</h3>
                  <p className="text-xs text-muted-foreground">Descriptions stay editable. Saved category names cannot be renamed or deleted.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setCategoryDraft((current) => [...current, { name: "", description: "", isActive: true }])}>
                  <Plus className="mr-2 h-4 w-4" /> Add category
                </Button>
              </div>
              {categoryDraft.length === 0 && <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No categories configured for this scope yet.</p>}
              {categoryDraft.map((category, index) => (
                <div key={category.id ?? `new-${index}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(12rem,0.7fr)_minmax(16rem,1.3fr)_auto] md:items-end">
                  <div className="space-y-1.5">
                    <Label>Category name</Label>
                    <Input
                      value={category.name}
                      disabled={Boolean(category.id)}
                      onChange={(event) => setCategoryDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Input
                      value={category.description}
                      onChange={(event) => setCategoryDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))}
                    />
                  </div>
                  {category.id ? (
                    <Button type="button" variant="outline" onClick={() => setCategoryDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, isActive: !item.isActive } : item))}>
                      {category.isActive ? "Hide" : "Restore"}
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" onClick={() => setCategoryDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove draft</Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="risk-config-reason">Change reason</Label>
              <Input id="risk-config-reason" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Why are these settings changing?" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" disabled={saving} onClick={() => void saveConfiguration()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DefinitionEditor({
  title,
  type,
  items,
  onChange,
}: {
  title: string;
  type: "likelihood" | "consequence";
  items: RiskConfigDefinition[];
  onChange: (type: "likelihood" | "consequence", index: number, field: "name" | "description", value: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-md bg-muted/25 p-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <Input value={item.name} onChange={(event) => onChange(type, index, "name", event.target.value)} aria-label={`${title} ${index + 1} name`} />
          <Input value={item.description} onChange={(event) => onChange(type, index, "description", event.target.value)} aria-label={`${title} ${index + 1} description`} placeholder="Description" />
        </div>
      ))}
    </div>
  );
}

function GuidanceBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border p-4">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
        {items.map((item) => {
          const separatorIndex = item.indexOf(":");

          return (
            <li key={item}>
              {separatorIndex > -1 ? (
                <>
                  <span className="font-bold text-foreground">{item.slice(0, separatorIndex + 1)}</span>
                  {item.slice(separatorIndex + 1)}
                </>
              ) : item}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SafetyFormDialog({
  mode,
  context,
  values,
  step,
  errors,
  saving,
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
  saving: boolean;
  onStepChange: (step: number) => void;
  onValueChange: (field: string, value: string) => void;
  onRequestClose: () => void;
  onSubmit: () => void;
}) {
  const riskStepCount = 5;
  const canGoBack = mode === "risk" && step > 0;
  const canGoForward = mode === "risk" && step < riskStepCount - 1;
  const needsChangeReason = Boolean(
    (mode === "risk" && context.riskId)
    || (mode === "action" && context.actionId)
    || (mode === "qi" && context.qiId),
  );

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

            <div className="space-y-4">
              {mode === "risk" && <RiskFormStep step={step} values={values} onValueChange={onValueChange} />}
              {mode === "action" && <ActionForm values={values} onValueChange={onValueChange} />}
              {mode === "qi" && <QiForm values={values} onValueChange={onValueChange} />}
              {mode === "idea" && <BrightIdeaForm values={values} onValueChange={onValueChange} />}
              {mode === "committee-review" && <CommitteeReviewForm values={values} onValueChange={onValueChange} />}
              {mode === "risk-review" && <RiskReviewForm values={values} onValueChange={onValueChange} />}
              {mode === "link-records" && <LinkRecordsForm values={values} onValueChange={onValueChange} />}
              {needsChangeReason && (
                <TextAreaField
                  label="Reason for this change"
                  field="changeReason"
                  values={values}
                  onValueChange={onValueChange}
                />
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={onRequestClose} disabled={saving}>
                Close
              </Button>
              {canGoBack && (
                <Button type="button" variant="outline" onClick={() => onStepChange(step - 1)} disabled={saving}>
                  Back
                </Button>
              )}
              {canGoForward ? (
                <Button type="button" onClick={() => onStepChange(step + 1)} disabled={saving}>
                  Next
                </Button>
              ) : (
                <Button type="button" onClick={onSubmit} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save record
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
            index < step && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
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
      <div className="space-y-4">
        <LinkedContextBanner ids={[values.linkedActionId, values.linkedQiId, values.linkedIdeaId]} />
        <FormGrid>
          <ReadOnlyField label="Organisation scope" value={values.scope || "Select an organisation"} />
          <SelectField label="Risk type" field="type" values={values} onValueChange={onValueChange} options={["Operational", "Clinical", "Governance", "Environmental", "Conduct"]} />
          <TextField label="Category" field="category" values={values} onValueChange={onValueChange} />
          <TextField label="Owner (optional)" field="owner" values={values} onValueChange={onValueChange} />
          <AutomaticAddedByField />
          <SelectField label="Status" field="status" values={values} onValueChange={onValueChange} options={["Open", "In progress", "Controlled", "Closed", "Entered in error"]} />
        </FormGrid>
      </div>
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
        <TextField label="Next review date" field="nextReview" type="date" values={values} onValueChange={onValueChange} />
      </FormGrid>
      <TextAreaField label="Evidence or notes" field="evidence" values={values} onValueChange={onValueChange} />
      <div className="rounded-md border bg-muted/40 p-4">
        <div className="text-sm font-medium">Review before saving</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Saving updates the live Dev Risk Register and records the change in the audit history.
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
      <DetailSection title="Basics and links">
        <FormGrid>
          <TextField label="Action title" field="title" values={values} onValueChange={onValueChange} />
          <SelectField label="Status" field="status" values={values} onValueChange={onValueChange} options={["Not started", "In progress", "Blocked", "Complete", "Entered in error"]} />
          <AutomaticAddedByField />
        </FormGrid>
        <PermanentRelationshipPanel ids={[values.linkedRiskId, values.linkedQiId, values.linkedIdeaId]} />
      </DetailSection>
      <DetailSection title="BE - Baseline and Evaluate">
        <div className="grid gap-3">
          <TextAreaField label="Baseline" field="baseline" values={values} onValueChange={onValueChange} />
          <TextAreaField label="Evaluate" field="evaluate" values={values} onValueChange={onValueChange} />
        </div>
      </DetailSection>
      <DetailSection title="SMART treatment">
        <div className="grid gap-3">
          <TextAreaField label="Specific" field="specific" values={values} onValueChange={onValueChange} />
          <TextAreaField label="Measurable" field="measurable" values={values} onValueChange={onValueChange} />
          <TextAreaField label="Achievable" field="achievable" values={values} onValueChange={onValueChange} />
          <TextAreaField label="Relevant" field="relevant" values={values} onValueChange={onValueChange} />
          <TextAreaField label="Time-bound" field="timeBound" values={values} onValueChange={onValueChange} />
        </div>
      </DetailSection>
      <DetailSection title="Responsibility, resources and due date">
        <FormGrid>
          <TextField label="Owner (optional)" field="owner" values={values} onValueChange={onValueChange} />
          <TextField label="Due date" field="dueDate" type="date" values={values} onValueChange={onValueChange} />
        </FormGrid>
        <TextAreaField label="Resources or support needed" field="resources" values={values} onValueChange={onValueChange} />
      </DetailSection>
      <DetailSection title="Review and save note">
        <p className="text-sm text-muted-foreground">
          Saving updates the live Dev action register and records the change in the audit history.
        </p>
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
      <FormGrid>
        <TextField label="QI title" field="title" values={values} onValueChange={onValueChange} />
        <TextField label="Source" field="source" values={values} onValueChange={onValueChange} />
        <TextField label="Area" field="area" values={values} onValueChange={onValueChange} />
        <TextField label="Owner (optional)" field="owner" values={values} onValueChange={onValueChange} />
        <AutomaticAddedByField />
        <TextField label="Due date" field="dueDate" type="date" values={values} onValueChange={onValueChange} />
        <SelectField label="Priority" field="priority" values={values} onValueChange={onValueChange} options={["Low", "Medium", "High"]} />
        <SelectField label="Status" field="status" values={values} onValueChange={onValueChange} options={["New", "Awaiting decision", "Approved", "In progress", "Complete", "Entered in error"]} />
      </FormGrid>
      <PermanentRelationshipPanel ids={[values.linkedRiskId, values.linkedActionId, values.linkedIdeaId]} />
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
      <TextField label="Idea title" field="title" values={values} onValueChange={onValueChange} />
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
        <ReadOnlyField label="Bright Idea ID" value={values.ideaId || "No source idea selected"} />
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
        <ReadOnlyField label="Risk ID" value={values.riskId || "No risk selected"} />
        <AutomaticAddedByField />
        <TextField label="Review date" field="reviewDate" type="date" values={values} onValueChange={onValueChange} />
        <TextField label="Next review date" field="nextReview" type="date" values={values} onValueChange={onValueChange} />
        <SelectField label="Residual likelihood" field="residualLikelihood" values={values} onValueChange={onValueChange} options={formLikelihoodOptions} />
        <SelectField label="Residual consequence" field="residualConsequence" values={values} onValueChange={onValueChange} options={formConsequenceOptions} />
        <RatingPreview label="Calculated residual rating" rating={residualRating} />
        <SelectField label="Risk status" field="status" values={values} onValueChange={onValueChange} options={["Open", "In progress", "Controlled", "Closed", "Entered in error"]} />
      </FormGrid>
      <TextAreaField label="Review notes" field="reviewNotes" values={values} onValueChange={onValueChange} />
      <TextAreaField label="Evidence or follow-up" field="evidence" values={values} onValueChange={onValueChange} />
    </div>
  );
}

function LinkRecordsForm({
  values,
  onValueChange,
}: {
  values: Record<string, string>;
  onValueChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <LinkedContextBanner ids={[values.sourceRecordId, values.linkedRiskId, values.linkedActionId, values.linkedQiId, values.linkedIdeaId]} />
      <FormGrid>
        <ReadOnlyField label="Source record" value={values.sourceRecordId || "No source record selected"} />
        <TextField label="Existing risk ID" field="linkedRiskId" values={values} onValueChange={onValueChange} />
        <TextField label="Existing action ID" field="linkedActionId" values={values} onValueChange={onValueChange} />
        <TextField label="Existing QI ID" field="linkedQiId" values={values} onValueChange={onValueChange} />
        <TextField label="Existing Bright Idea ID" field="linkedIdeaId" values={values} onValueChange={onValueChange} />
      </FormGrid>
      <TextAreaField label="Link reason or notes" field="linkNotes" values={values} onValueChange={onValueChange} />
      <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
        Saving creates permanent live links between the selected Safety Hub records.
      </div>
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function TextField({
  label,
  field,
  type = "text",
  values,
  onValueChange,
}: {
  label: string;
  field: string;
  type?: string;
  values: Record<string, string>;
  onValueChange: (field: string, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field}>{label}</Label>
      <Input
        id={field}
        type={type}
        value={values[field] || ""}
        onChange={(event) => onValueChange(field, event.target.value)}
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="min-h-10 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {value}
      </div>
    </div>
  );
}

function PermanentRelationshipPanel({ ids }: { ids: Array<string | undefined> }) {
  const visibleIds = ids.filter((id) => Boolean(id?.trim())) as string[];

  return (
    <div className="rounded-md border bg-muted/40 p-4">
      <div className="text-sm font-medium">Permanent source relationship</div>
      {visibleIds.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          No source record selected. This record will be saved as independent.
        </p>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {visibleIds.map((id) => {
            const record = findSafetyRecordById(id);
            return (
              <div key={id} className="rounded-md border bg-background/80 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-xs">{id}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-muted-foreground">
                  {record ? getRecordSubtitle(record) : "Source record selected during creation."}
                </p>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        After saving, this relationship is read-only. A wrong link should be marked Entered in error and replaced rather than silently moved.
      </p>
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
          <Badge key={id} variant="outline" className="whitespace-nowrap font-mono text-xs">
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
    <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
      <div className="font-medium">Please check these fields</div>
      <ul className="mt-2 list-inside list-disc space-y-1">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}

function SafetyDetailDrawer({
  record,
  onOpenChange,
  onOpenForm,
  onOpenRecord,
}: {
  record: SafetyRecord | null;
  onOpenChange: (open: boolean) => void;
  onOpenForm: (options: OpenFormOptions) => void;
  onOpenRecord: (record: SafetyRecord) => void;
}) {
  return (
    <Sheet open={Boolean(record)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full max-w-none flex-col overflow-hidden p-0 sm:max-w-none lg:max-w-[600px]">
        {record && (
          <>
            <SheetHeader className="sticky top-0 z-10 border-b bg-background p-6 pr-12">
              <SheetTitle>{getRecordTitle(record)}</SheetTitle>
              <SheetDescription>{getRecordSubtitle(record)}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {record.kind === "risk" && <RiskDetail risk={record} onOpenForm={onOpenForm} onOpenRecord={onOpenRecord} />}
              {record.kind === "action" && <ActionDetail action={record} onOpenForm={onOpenForm} onOpenRecord={onOpenRecord} />}
              {record.kind === "qi" && <QiDetail item={record} onOpenForm={onOpenForm} onOpenRecord={onOpenRecord} />}
              {record.kind === "idea" && <BrightIdeaDetail idea={record} onOpenForm={onOpenForm} onOpenRecord={onOpenRecord} />}
              {record.kind === "audit" && <AuditDetail event={record} onOpenRecord={onOpenRecord} />}
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
  onOpenRecord,
}: {
  risk: RiskRecord;
  onOpenForm: (options: OpenFormOptions) => void;
  onOpenRecord: (record: SafetyRecord) => void;
}) {
  return (
    <>
      <DetailActions>
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
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "link-records", context: { sourceRecordId: risk.id } })}>
          Link another record
        </Button>
      </DetailActions>
      <DetailGrid>
        <DetailField label="Category" value={risk.category} />
        <DetailField label="Type" value={risk.type} />
        <DetailField label="Owner" value={risk.owner} />
        <DetailField label="Added by" value={risk.createdBy || "Not recorded"} />
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
          {[...risk.linkedActions, ...risk.linkedQi].map((id) => <LinkedRecordCard key={id} id={id} onOpenRecord={onOpenRecord} />)}
        </div>
      </DetailSection>
    </>
  );
}

function ActionDetail({
  action,
  onOpenForm,
  onOpenRecord,
}: {
  action: ActionRecord;
  onOpenForm: (options: OpenFormOptions) => void;
  onOpenRecord: (record: SafetyRecord) => void;
}) {
  return (
    <>
      <DetailActions>
        <Button size="sm" onClick={() => onOpenForm({ mode: "action", context: { actionId: action.id } })}>
          Edit action
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "link-records", context: { sourceRecordId: action.id } })}>
          Link another record
        </Button>
      </DetailActions>
      <DetailGrid>
        <DetailField label="Owner" value={action.owner} />
        <DetailField label="Added by" value={action.createdBy || "Not recorded"} />
        <DetailField label="Status" value={action.status} />
        <DetailField label="Due date" value={action.dueDate} />
        <DetailField label="Risk link" value={action.linkedRiskId || "-"} />
        <DetailField label="QI link" value={action.linkedQiId || "-"} />
      </DetailGrid>
      <DetailSection title="BE SMART — Baseline, Evaluate, Specific, Measurable, Achievable, Relevant, Time-bound">
        <div className="grid gap-2">
          {[
            ["B", "Baseline", action.baseline],
            ["E", "Evaluate", action.evaluate],
            ["S", "Specific", action.specific],
            ["M", "Measurable", action.measurable],
            ["A", "Achievable", action.achievable],
            ["R", "Relevant", action.relevant],
            ["T", "Time-bound", action.timeBound],
          ].map(([letter, label, value]) => (
            <div key={letter} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 rounded-md border bg-muted/20 p-3">
              <div className="text-center text-3xl font-black leading-none text-primary">{letter}</div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
                <div className="mt-1 text-sm">{value || "Not recorded"}</div>
              </div>
            </div>
          ))}
        </div>
      </DetailSection>
      <DetailSection title="Linked records">
        <div className="grid gap-2 sm:grid-cols-2">
          {[action.linkedRiskId, action.linkedQiId]
            .filter(Boolean)
            .map((id) => <LinkedRecordCard key={id} id={id as string} onOpenRecord={onOpenRecord} />)}
        </div>
      </DetailSection>
    </>
  );
}

function QiDetail({
  item,
  onOpenForm,
  onOpenRecord,
}: {
  item: QiRecord;
  onOpenForm: (options: OpenFormOptions) => void;
  onOpenRecord: (record: SafetyRecord) => void;
}) {
  const { recordsById } = useSafetyHubData();
  const originatingRecord = item.linkedIdeaId ? recordsById.get(item.linkedIdeaId) : undefined;
  const originatingIdea = originatingRecord?.kind === "idea" ? originatingRecord : undefined;

  return (
    <>
      <DetailActions>
        <Button size="sm" onClick={() => onOpenForm({ mode: "qi", context: { qiId: item.id } })}>
          Edit QI item
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "risk", context: { qiId: item.id } })}>
          Create linked risk
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "action", context: { qiId: item.id, riskId: item.linkedRiskId } })}>
          Create linked action
        </Button>
        {originatingIdea && (
          <Button size="sm" variant="outline" onClick={() => onOpenRecord(originatingIdea)}>
            View originating Bright Idea
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "link-records", context: { sourceRecordId: item.id } })}>
          Link another record
        </Button>
      </DetailActions>
      <DetailGrid>
        <DetailField label="Source" value={item.source} />
        <DetailField label="Area" value={item.area} />
        <DetailField label="Owner" value={item.owner} />
        <DetailField label="Added by" value={item.createdBy || "Not recorded"} />
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
            .map((id) => <LinkedRecordCard key={id} id={id as string} onOpenRecord={onOpenRecord} />)}
        </div>
      </DetailSection>
    </>
  );
}

function BrightIdeaDetail({
  idea,
  onOpenForm,
  onOpenRecord,
}: {
  idea: BrightIdeaRecord;
  onOpenForm: (options: OpenFormOptions) => void;
  onOpenRecord: (record: SafetyRecord) => void;
}) {
  const { recordsById } = useSafetyHubData();
  const linkedRecord = idea.linkedRecordId ? recordsById.get(idea.linkedRecordId) : undefined;

  return (
    <>
      <DetailActions>
        <Button size="sm" onClick={() => onOpenForm({ mode: "committee-review", context: { ideaId: idea.id } })}>
          Review idea
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "risk", context: { ideaId: idea.id } })}>
          Create linked risk
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "qi", context: { ideaId: idea.id } })}>
          Create linked QI
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "action", context: { ideaId: idea.id } })}>
          Create linked action
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenForm({ mode: "link-records", context: { sourceRecordId: idea.id } })}>
          Link another record
        </Button>
      </DetailActions>
      <DetailGrid>
        <DetailField label="Submitted by" value={idea.submittedBy} />
        <DetailField label="Submitted date" value={idea.submittedDate} />
        <DetailField label="Scope" value={idea.scope} />
        <DetailField label="Status" value={idea.status} />
        <DetailField label="Decision" value={idea.decision === "Pending" ? "No committee decision recorded yet" : idea.decision} />
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
      {linkedRecord && (
        <DetailSection title="Linked records">
          <LinkedRecordCard id={linkedRecord.id} onOpenRecord={onOpenRecord} />
        </DetailSection>
      )}
    </>
  );
}

function AuditDetail({
  event,
  onOpenRecord,
}: {
  event: AuditRecord;
  onOpenRecord: (record: SafetyRecord) => void;
}) {
  const { recordsById } = useSafetyHubData();
  const relatedRecord = event.relatedRecordId ? recordsById.get(event.relatedRecordId) : undefined;

  return (
    <>
      <DetailGrid>
        <DetailField label="Date and time" value={event.date} />
        <DetailField label="User" value={event.user} />
        <DetailField label="Record" value={event.record} />
        <DetailField label="Record type" value={event.recordType} />
        <DetailField label="Organisation scope" value={event.scope} />
        <DetailField label="Action" value={event.action} />
        <DetailField label="Field changed" value={event.fieldChanged} />
        <DetailField label="Related record" value={event.relatedRecordId || "-"} />
      </DetailGrid>
      <DetailSection title="Change detail">
        <DetailField label="Previous value" value={event.previousValue} />
        <DetailField label="New value" value={event.newValue} />
        <DetailField label="Reason" value={event.reason} />
      </DetailSection>
      {relatedRecord && (
        <DetailSection title="Related record detail">
          <LinkedRecordCard id={relatedRecord.id} onOpenRecord={onOpenRecord} />
          <DetailField label="Summary" value={getRecordSubtitle(relatedRecord)} />
        </DetailSection>
      )}
    </>
  );
}

function DetailActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-2 border-b bg-background/95 px-1 pb-3 backdrop-blur">
      {children}
    </div>
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

function LinkedRecordCard({
  id,
  onOpenRecord,
}: {
  id: string;
  onOpenRecord: (record: SafetyRecord) => void;
}) {
  const { recordsById } = useSafetyHubData();
  const linkedRecord = recordsById.get(id);

  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted/50"
      onClick={() => {
        if (linkedRecord) onOpenRecord(linkedRecord);
      }}
      disabled={!linkedRecord}
    >
      <Link2 className="h-4 w-4 text-muted-foreground" />
      <span className="whitespace-nowrap font-mono text-xs">{id}</span>
    </button>
  );
}

function AutomaticAddedByField() {
  return (
    <div className="space-y-2">
      <Label>Added by</Label>
      <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
        Current signed-in user
      </div>
    </div>
  );
}

function getAssociatedSafetyRecords(
  sourceRecord: CoreSafetyRecord,
  records: CoreSafetyRecord[],
): CoreSafetyRecord[] {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const visitedIds = new Set([sourceRecord.id]);
  const pendingIds = [sourceRecord.id];

  while (pendingIds.length > 0) {
    const currentId = pendingIds.shift();
    if (!currentId) continue;

    const currentRecord = recordsById.get(currentId);
    if (!currentRecord) continue;

    const currentLinks = new Set(getDirectAssociationIds(currentRecord));

    records.forEach((candidate) => {
      if (visitedIds.has(candidate.id)) return;

      const candidateLinksBack = getDirectAssociationIds(candidate).includes(currentRecord.id);
      if (!currentLinks.has(candidate.id) && !candidateLinksBack) return;

      visitedIds.add(candidate.id);
      pendingIds.push(candidate.id);
    });
  }

  return records.filter((record) => record.id !== sourceRecord.id && visitedIds.has(record.id));
}

function getDirectAssociationIds(record: CoreSafetyRecord): string[] {
  if (record.kind === "risk") return [...record.linkedActions, ...record.linkedQi];
  if (record.kind === "action") return [record.linkedRiskId, record.linkedQiId].filter(isRecordId);
  if (record.kind === "qi") {
    return [record.linkedRiskId, record.linkedActionId, record.linkedIdeaId].filter(isRecordId);
  }
  return [record.linkedRecordId].filter(isRecordId);
}

function isRecordId(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
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
  data: SafetyHubData,
): Record<string, string> {
  const risk = context.riskId ? data.risks.find((item) => item.id === context.riskId) : undefined;
  const action = context.actionId ? data.actions.find((item) => item.id === context.actionId) : undefined;
  const qi = context.qiId ? data.qiItems.find((item) => item.id === context.qiId) : undefined;
  const idea = context.ideaId ? data.brightIdeas.find((item) => item.id === context.ideaId) : undefined;

  if (mode === "risk") {
    return {
      scope: risk?.scope || scopeLabel,
      type: risk?.type || "Operational",
      category: risk?.category || "Safety",
      owner: editableSafetyOwner(risk?.owner),
      status: risk?.status || "Open",
      title: risk?.title || idea?.title || qi?.title || action?.title || "",
      riskEvent: risk?.title || qi?.issue || idea?.whyNeeded || "",
      consequences: risk?.summary || qi?.issue || idea?.whyNeeded || "",
      summary: risk?.summary || qi?.issue || idea?.whyNeeded || "",
      inherentLikelihood: risk?.likelihood || "Possible",
      inherentConsequence: risk?.consequence || "Moderate",
      existingControls: risk?.existingControls || "",
      residualLikelihood: risk?.likelihood || "Possible",
      residualConsequence: risk?.consequence || "Moderate",
      targetRating: risk?.targetRating || "Medium",
      treatmentPlan: risk?.treatmentPlan || "",
      reviewFrequency: "Quarterly",
      nextReview: toSafetyDateInput(risk?.nextReview),
      evidence: risk?.evidence || "",
      changeReason: "",
      linkedActionId: context.actionId || "",
      linkedQiId: context.qiId || "",
      linkedIdeaId: context.ideaId || "",
    };
  }

  if (mode === "action") {
    return {
      title: action?.title || idea?.title || "",
      owner: editableSafetyOwner(action?.owner),
      dueDate: toSafetyDateInput(action?.dueDate),
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
      resources: "",
      changeReason: "",
    };
  }

  if (mode === "qi") {
    return {
      title: qi?.title || idea?.title || "",
      source: qi?.source || (idea ? "Bright Idea" : context.riskId ? "Risk review" : context.actionId ? "Action follow-up" : "Committee review"),
      area: qi?.area || "",
      owner: editableSafetyOwner(qi?.owner),
      dueDate: toSafetyDateInput(qi?.dueDate),
      priority: qi?.priority || "Medium",
      status: qi?.status || "New",
      linkedRiskId: qi?.linkedRiskId || context.riskId || "",
      linkedActionId: qi?.linkedActionId || context.actionId || "",
      linkedIdeaId: qi?.linkedIdeaId || context.ideaId || "",
      issue: qi?.issue || idea?.whyNeeded || "",
      requiredAction: qi?.requiredAction || idea?.suggestedImplementation || "",
      outcome: qi?.outcome || "",
      changeReason: "",
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

  if (mode === "link-records") {
    const sourceRecordId = risk?.id || action?.id || qi?.id || idea?.id || "";
    return {
      sourceRecordId,
      linkedRiskId: risk?.id || action?.linkedRiskId || qi?.linkedRiskId || "",
      linkedActionId: action?.id || qi?.linkedActionId || "",
      linkedQiId: qi?.id || action?.linkedQiId || "",
      linkedIdeaId: idea?.id || qi?.linkedIdeaId || "",
      linkNotes: "",
    };
  }

  return {
    riskId: risk?.id || "",
    reviewedBy: "Safety Lead",
    reviewDate: new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" }),
    nextReview: toSafetyDateInput(risk?.nextReview),
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
  if (mode === "link-records") return "Manage Linked Records";
  return "Record Risk Review";
}

function getFormDescription(mode: SafetyFormMode, context: SafetyFormContext) {
  if (mode === "risk") return "Five-step guided risk form with calculated inherent and residual ratings.";
  if (mode === "action") return context.riskId || context.qiId ? "Linked action form with the source record already filled in." : "Independent action form.";
  if (mode === "qi") return context.ideaId ? "QI form carrying text across from the Bright Idea." : "Independent or linked quality improvement form.";
  if (mode === "idea") return "Simple suggestion form for signed-in users.";
  if (mode === "committee-review") return "Committee decision and conversion notes for a Bright Idea.";
  if (mode === "link-records") return "Connect existing live records while preserving their original history.";
  return "Risk review form using the same matrix as the risk form.";
}

function validateSafetyForm(mode: SafetyFormMode, values: Record<string, string>) {
  const errors: string[] = [];
  const requireField = (field: string, label: string) => {
    if (!values[field]?.trim()) errors.push(`${label} is required.`);
  };

  if (mode === "risk") {
    requireField("title", "Short title");
    requireField("riskEvent", "Risk event");
    requireField("existingControls", "Existing controls");
    requireField("treatmentPlan", "Treatment plan");
  }

  if (mode === "action") {
    requireField("title", "Action title");
    requireField("dueDate", "Due date");
    requireField("specific", "Specific");
    requireField("timeBound", "Time-bound");
  }

  if (mode === "qi") {
    requireField("title", "QI title");
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
    requireField("decisionReason", "Decision reason");
    if (values.conversion === "Link to existing record") requireField("linkedRecordId", "Linked record");
  }

  if (mode === "link-records") {
    requireField("sourceRecordId", "Source record");
  }

  if (mode === "risk-review") {
    requireField("riskId", "Risk ID");
    requireField("reviewDate", "Review date");
    requireField("reviewNotes", "Review notes");
  }

  return errors;
}

async function loadSafetyHubData(scope: SafetyScopeSelection): Promise<SafetyHubData> {
  const [
    riskResult,
    actionResult,
    qiResult,
    ideaResult,
    linkResult,
    reviewResult,
    auditResult,
    matrixResult,
    settingsResult,
    dropdownResult,
    profileResult,
    associationResult,
    clubResult,
    teamResult,
  ] = await Promise.all([
    supabase.from("rg_risk_register").select("*").order("display_number"),
    supabase.from("rg_be_smart_actions").select("*").order("display_number"),
    supabase.from("rg_quality_improvement_items").select("*").order("display_number"),
    supabase.from("rg_bright_ideas").select("*").order("display_number"),
    supabase.from("rg_record_links").select("*").eq("is_active", true),
    supabase.from("rg_risk_reviews").select("*").order("reviewed_at", { ascending: false }),
    supabase.from("rg_audit_log").select("*").order("changed_at", { ascending: false }).limit(500),
    supabase.from("rg_risk_matrix").select("*").order("likelihood").order("consequence"),
    supabase.from("rg_risk_settings").select("*").eq("is_active", true),
    supabase.from("rg_dropdown_values").select("*").order("category").order("sort_order"),
    supabase.from("profiles").select("id, first_name, last_name"),
    supabase.from("associations").select("id, name"),
    supabase.from("clubs").select("id, name, association_id"),
    supabase.from("teams").select("id, name, club_id"),
  ]);

  const results = [
    riskResult,
    actionResult,
    qiResult,
    ideaResult,
    linkResult,
    reviewResult,
    auditResult,
    matrixResult,
    settingsResult,
    dropdownResult,
    profileResult,
    associationResult,
    clubResult,
    teamResult,
  ];
  const failedResult = results.find((result) => result.error);
  if (failedResult?.error) throw failedResult.error;

  return buildSafetyHubData({
    scope,
    riskRows: filterSafetyRows(riskResult.data ?? [], scope),
    actionRows: filterSafetyRows(actionResult.data ?? [], scope),
    qiRows: filterSafetyRows(qiResult.data ?? [], scope),
    ideaRows: filterSafetyRows(ideaResult.data ?? [], scope),
    linkRows: filterSafetyRows(linkResult.data ?? [], scope),
    reviewRows: filterSafetyRows(reviewResult.data ?? [], scope),
    auditRows: filterSafetyRows(auditResult.data ?? [], scope),
    matrixRows: matrixResult.data ?? [],
    settingsRows: settingsResult.data ?? [],
    dropdownRows: dropdownResult.data ?? [],
    profiles: profileResult.data ?? [],
    associations: associationResult.data ?? [],
    clubs: clubResult.data ?? [],
    teams: teamResult.data ?? [],
  });
}

function filterSafetyRows<T extends {
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
}>(rows: T[], scope: SafetyScopeSelection): T[] {
  if (scope.teamId) return rows.filter((row) => row.team_id === scope.teamId);
  if (scope.clubId) return rows.filter((row) => row.club_id === scope.clubId);
  if (scope.associationId) return rows.filter((row) => row.association_id === scope.associationId);
  return rows;
}

function buildSafetyHubData({
  scope,
  riskRows,
  actionRows,
  qiRows,
  ideaRows,
  linkRows,
  reviewRows,
  auditRows,
  matrixRows,
  settingsRows,
  dropdownRows,
  profiles,
  associations,
  clubs,
  teams,
}: {
  scope: SafetyScopeSelection;
  riskRows: SafetyRiskRow[];
  actionRows: SafetyActionRow[];
  qiRows: SafetyQiRow[];
  ideaRows: SafetyIdeaRow[];
  linkRows: SafetyLinkRow[];
  reviewRows: SafetyReviewRow[];
  auditRows: SafetyAuditRow[];
  matrixRows: SafetyMatrixRow[];
  settingsRows: SafetySettingsRow[];
  dropdownRows: SafetyDropdownRow[];
  profiles: ProfileSummary[];
  associations: AssociationSummary[];
  clubs: ClubSummary[];
  teams: TeamSummary[];
}): SafetyHubData {
  const profileNames = new Map(
    profiles.map((profile) => [profile.id, formatProfileName(profile)]),
  );
  const associationNames = new Map(associations.map((association) => [association.id, association.name]));
  const clubNames = new Map(clubs.map((club) => [club.id, club.name]));
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));

  const displayByDatabaseId = new Map<string, string>();
  riskRows.forEach((row) => displayByDatabaseId.set(row.id, formatDisplayId("R", row.display_number)));
  actionRows.forEach((row) => displayByDatabaseId.set(row.id, formatDisplayId("A", row.display_number)));
  qiRows.forEach((row) => displayByDatabaseId.set(row.id, formatDisplayId("QI", row.display_number)));
  ideaRows.forEach((row) => displayByDatabaseId.set(row.id, formatDisplayId("BI", row.display_number)));

  const linkedDisplayIds = buildLinkedDisplayIds(
    linkRows,
    actionRows,
    displayByDatabaseId,
  );
  const latestReviewByRisk = new Map<string, SafetyReviewRow>();
  reviewRows.forEach((review) => {
    if (!latestReviewByRisk.has(review.risk_id)) latestReviewByRisk.set(review.risk_id, review);
  });

  const risks = riskRows.map<RiskRecord>((row) => {
    const latestReview = latestReviewByRisk.get(row.id);
    const links = linkedDisplayIds.get(row.id) ?? [];
    const residualLikelihood = row.residual_likelihood ?? row.likelihood;
    const residualConsequence = row.residual_consequence ?? row.consequence;

    return {
      kind: "risk",
      databaseId: row.id,
      id: displayByDatabaseId.get(row.id) ?? row.id,
      title: row.title,
      summary: row.description ?? row.consequences ?? row.risk_event ?? "No summary recorded.",
      category: row.category ?? "Uncategorised",
      type: row.risk_type ?? "Operational",
      owner: profileNames.get(row.owner_id ?? "") ?? "Unassigned",
      createdBy: profileNames.get(row.created_by ?? "") ?? "Not recorded",
      scope: getScopeName(row, associationNames, clubNames, teamNames),
      status: mapRiskStatus(row.status),
      inherentRating: normaliseRiskRating(row.inherent_rating),
      residualRating: normaliseRiskRating(row.residual_rating),
      targetRating: normaliseRiskRating(row.target_rating),
      likelihood: likelihoodLabels[(residualLikelihood ?? 1) - 1] ?? "Not recorded",
      consequence: consequenceLabels[(residualConsequence ?? 1) - 1] ?? "Not recorded",
      existingControls: row.existing_controls ?? "",
      treatmentPlan: row.treatment_plan ?? "",
      lastReview: formatDate(latestReview?.reviewed_at),
      nextReview: formatDate(row.next_review_date),
      reviewState: getReviewState(row.next_review_date),
      linkedActions: links.filter((id) => id.startsWith("A-")),
      linkedQi: links.filter((id) => id.startsWith("QI-")),
      evidence: row.evidence ?? latestReview?.evidence ?? "",
    };
  });

  const actions = actionRows.map<ActionRecord>((row) => {
    const links = linkedDisplayIds.get(row.id) ?? [];
    return {
      kind: "action",
      databaseId: row.id,
      id: displayByDatabaseId.get(row.id) ?? row.id,
      title: row.title,
      owner: profileNames.get(row.assigned_to ?? "") ?? "Unassigned",
      createdBy: profileNames.get(row.created_by ?? "") ?? "Not recorded",
      status: mapActionStatus(row.status),
      dueDate: formatDate(row.due_date),
      dueState: getDueState(row.due_date, row.status === "COMPLETED"),
      linkedRiskId: links.find((id) => id.startsWith("R-")),
      linkedQiId: links.find((id) => id.startsWith("QI-")),
      baseline: row.baseline ?? "",
      evaluate: row.evaluate ?? "",
      specific: row.specific ?? row.action_text,
      measurable: row.measurable ?? "",
      achievable: row.achievable ?? "",
      relevant: row.relevant ?? "",
      timeBound: row.time_bound ?? "",
    };
  });

  const qiItems = qiRows.map<QiRecord>((row) => {
    const links = linkedDisplayIds.get(row.id) ?? [];
    return {
      kind: "qi",
      databaseId: row.id,
      id: displayByDatabaseId.get(row.id) ?? row.id,
      title: row.title,
      source: row.source ?? "Not recorded",
      area: row.area ?? "Not recorded",
      owner: profileNames.get(row.owner_id ?? "") ?? "Unassigned",
      createdBy: profileNames.get(row.created_by ?? "") ?? "Not recorded",
      priority: mapPriority(row.priority),
      status: mapQiStatus(row.status),
      dueDate: formatDate(row.due_date),
      dueState: getDueState(row.due_date, row.status === "COMPLETED"),
      issue: row.issue ?? row.description ?? "",
      requiredAction: row.required_action ?? "",
      outcome: row.outcome ?? "",
      linkedRiskId: links.find((id) => id.startsWith("R-")),
      linkedActionId: links.find((id) => id.startsWith("A-")),
      linkedIdeaId: links.find((id) => id.startsWith("BI-")),
    };
  });

  const brightIdeas = ideaRows.map<BrightIdeaRecord>((row) => {
    const links = linkedDisplayIds.get(row.id) ?? [];
    return {
      kind: "idea",
      databaseId: row.id,
      id: displayByDatabaseId.get(row.id) ?? row.id,
      title: row.title,
      submittedBy: profileNames.get(row.submitted_by ?? "") ?? "Unknown submitter",
      submittedDate: formatDate(row.submitted_at),
      scope: getScopeName(row, associationNames, clubNames, teamNames),
      status: mapBrightIdeaStatus(row.status),
      decision: mapBrightIdeaDecision(row.decision),
      whyNeeded: row.why_needed,
      suggestedImplementation: row.suggested_implementation ?? "",
      suggestedEvaluation: row.suggested_evaluation ?? "",
      couldAssist: row.could_assist ?? "",
      committeeNotes: row.committee_notes ?? "No committee notes recorded.",
      linkedRecordId: links[0],
    };
  });

  const auditEvents = auditRows
    .map<AuditRecord | null>((row) => {
      const recordType = normaliseAuditRecordType(row.record_type);
      if (!recordType) return null;
      return {
        kind: "audit",
        id: `AU-${row.id.slice(0, 8).toUpperCase()}`,
        date: formatDateTime(row.changed_at),
        user: profileNames.get(row.user_id ?? "") ?? "System",
        record: row.record_reference ?? row.record_id ?? "Unknown record",
        recordType,
        scope: getScopeName(row, associationNames, clubNames, teamNames),
        relatedRecordId: row.related_record_reference ?? row.record_reference ?? undefined,
        action: mapAuditAction(row.action),
        fieldChanged: humaniseFieldName(row.field_name),
        previousValue: formatAuditValue(row.previous_value),
        newValue: formatAuditValue(row.new_value),
        reason: row.reason ?? "No reason recorded.",
      };
    })
    .filter((event): event is AuditRecord => event !== null);

  const effectiveSettings = getEffectiveRiskSettings(scope, settingsRows);
  const scopedDropdowns = effectiveSettings
    ? dropdownRows.filter((row) => row.settings_id === effectiveSettings.id)
    : [];

  return {
    risks,
    actions,
    qiItems,
    brightIdeas,
    auditEvents,
    riskMatrix: buildRiskMatrix(scope, settingsRows, matrixRows),
    likelihoodDefinitions: buildRiskDefinitions(
      scopedDropdowns,
      "LIKELIHOOD",
      defaultLikelihoodDefinitions,
    ),
    consequenceDefinitions: buildRiskDefinitions(
      scopedDropdowns,
      "CONSEQUENCE",
      defaultConsequenceDefinitions,
    ),
    riskCategories: scopedDropdowns
      .filter((row) => row.category === "RISK_CATEGORY")
      .map((row) => ({
        id: row.id,
        name: row.label,
        description: row.description ?? "",
        isActive: row.is_active,
      })),
  };
}

function getEffectiveRiskSettings(
  scope: SafetyScopeSelection,
  settingsRows: SafetySettingsRow[],
) {
  return (
    (scope.clubId
      ? settingsRows.find((row) => row.scope_level === "CLUB" && row.club_id === scope.clubId)
      : undefined)
    ?? (scope.associationId
      ? settingsRows.find((row) => row.scope_level === "ASSOCIATION" && row.association_id === scope.associationId)
      : undefined)
    ?? settingsRows.find((row) => row.scope_level === "GLOBAL")
  );
}

function buildRiskDefinitions(
  rows: SafetyDropdownRow[],
  category: "LIKELIHOOD" | "CONSEQUENCE",
  defaults: RiskConfigDefinition[],
) {
  const configured = rows
    .filter((row) => row.category === category && row.is_active)
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))
    .slice(0, 5)
    .map((row) => ({ id: row.id, name: row.label, description: row.description ?? "" }));
  return configured.length === 5 ? configured : defaults.map((definition) => ({ ...definition }));
}

function buildLinkedDisplayIds(
  links: SafetyLinkRow[],
  actions: SafetyActionRow[],
  displayByDatabaseId: Map<string, string>,
) {
  const linked = new Map<string, Set<string>>();
  const connect = (leftId: string | null, rightId: string | null) => {
    if (!leftId || !rightId) return;
    const leftDisplay = displayByDatabaseId.get(leftId);
    const rightDisplay = displayByDatabaseId.get(rightId);
    if (!leftDisplay || !rightDisplay) return;
    if (!linked.has(leftId)) linked.set(leftId, new Set());
    if (!linked.has(rightId)) linked.set(rightId, new Set());
    linked.get(leftId)?.add(rightDisplay);
    linked.get(rightId)?.add(leftDisplay);
  };

  links.forEach((link) => {
    const ids = [link.risk_id, link.action_id, link.qi_item_id, link.bright_idea_id]
      .filter((id): id is string => Boolean(id));
    if (ids.length === 2) connect(ids[0], ids[1]);
  });
  actions.forEach((action) => connect(action.id, action.risk_id));

  return new Map(
    Array.from(linked.entries()).map(([id, values]) => [id, Array.from(values)]),
  );
}

function buildRiskMatrix(
  scope: SafetyScopeSelection,
  settingsRows: SafetySettingsRow[],
  matrixRows: SafetyMatrixRow[],
): RiskRating[][] {
  const settings = getEffectiveRiskSettings(scope, settingsRows);
  const matrix = prototypeRiskMatrix.map((row) => [...row]);
  if (!settings) return matrix;

  matrixRows
    .filter((row) => row.settings_id === settings.id)
    .forEach((row) => {
      const likelihoodIndex = row.likelihood - 1;
      const consequenceIndex = row.consequence - 1;
      if (matrix[likelihoodIndex]?.[consequenceIndex]) {
        matrix[likelihoodIndex][consequenceIndex] = normaliseRiskRating(row.risk_level);
      }
    });
  return matrix;
}

function formatDisplayId(prefix: "R" | "A" | "QI" | "BI", displayNumber: number) {
  return `${prefix}-${String(displayNumber).padStart(3, "0")}`;
}

function formatProfileName(profile: ProfileSummary) {
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return name || "Unnamed user";
}

function getScopeName(
  row: { association_id: string | null; club_id: string | null; team_id: string | null },
  associationNames: Map<string, string>,
  clubNames: Map<string, string>,
  teamNames: Map<string, string>,
) {
  if (row.team_id) return teamNames.get(row.team_id) ?? "Unknown team";
  if (row.club_id) return clubNames.get(row.club_id) ?? "Unknown club";
  if (row.association_id) return associationNames.get(row.association_id) ?? "Unknown association";
  return "Global";
}

function normaliseRiskRating(value: string | null | undefined): RiskRating {
  const normalised = value?.trim().toLowerCase();
  if (normalised === "low") return "Low";
  if (normalised === "high") return "High";
  if (normalised === "very high" || normalised === "critical") return "Very High";
  return "Medium";
}

function mapRiskStatus(value: string): RiskStatus {
  if (value === "IN_PROGRESS") return "In progress";
  if (value === "CONTROLLED" || value === "RESOLVED" || value === "ACCEPTED") return "Controlled";
  if (value === "CLOSED") return "Closed";
  if (value === "ENTERED_IN_ERROR") return "Entered in error";
  return "Open";
}

function mapActionStatus(value: string): ActionStatus {
  if (value === "IN_PROGRESS" || value === "APPROVED") return "In progress";
  if (value === "BLOCKED") return "Blocked";
  if (value === "COMPLETED") return "Complete";
  if (value === "ENTERED_IN_ERROR") return "Entered in error";
  return "Not started";
}

function mapQiStatus(value: string): QiStatus {
  if (value === "AWAITING_DECISION" || value === "PENDING") return "Awaiting decision";
  if (value === "APPROVED") return "Approved";
  if (value === "IN_PROGRESS") return "In progress";
  if (value === "COMPLETED") return "Complete";
  if (value === "ENTERED_IN_ERROR") return "Entered in error";
  return "New";
}

function mapPriority(value: string): QiRecord["priority"] {
  if (value.toUpperCase() === "HIGH") return "High";
  if (value.toUpperCase() === "LOW") return "Low";
  return "Medium";
}

function mapBrightIdeaStatus(value: string): BrightIdeaStatus {
  if (value === "UNDER_REVIEW") return "Under review";
  if (value === "ACCEPTED") return "Accepted";
  if (value === "DEFERRED") return "Deferred";
  if (value === "CLOSED") return "Closed";
  if (value === "ENTERED_IN_ERROR") return "Entered in error";
  return "Submitted";
}

function mapBrightIdeaDecision(value: string | null): BrightIdeaRecord["decision"] {
  if (value === "ACCEPT") return "Accept";
  if (value === "DEFER") return "Defer";
  if (value === "REJECT") return "Reject";
  if (value === "CLOSE") return "Close";
  return "Pending";
}

function parseDatabaseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null | undefined) {
  const date = parseDatabaseDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  const date = parseDatabaseDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  }).format(date);
}

function getDueState(value: string | null, complete: boolean): DueState {
  if (complete) return "Complete";
  const dueDate = parseDatabaseDate(value);
  if (!dueDate) return "Current";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  if (dueDate < today) return "Overdue";
  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);
  return daysUntilDue <= dueSoonDays ? "Due soon" : "Current";
}

function getReviewState(value: string | null): ReviewState {
  const state = getDueState(value, false);
  if (state === "Overdue") return "Overdue";
  if (state === "Due soon") return "Due soon";
  return "Current";
}

function normaliseAuditRecordType(value: string | null): AuditRecord["recordType"] | null {
  if (
    value === "Risk"
    || value === "Action"
    || value === "QI"
    || value === "Bright Idea"
    || value === "Risk Review"
    || value === "Link"
    || value === "Settings"
    || value === "Comment"
  ) {
    return value;
  }
  return null;
}

function mapAuditAction(value: string) {
  if (value === "INSERT") return "Created";
  if (value === "UPDATE") return "Updated";
  if (value === "DELETE") return "Removed";
  return value;
}

function humaniseFieldName(value: string | null) {
  if (!value) return "Record";
  if (value === "Record created" || value === "Record removed") return value;
  return value
    .split("_")
    .filter(Boolean)
    .map((part, index) => index === 0
      ? `${part.charAt(0).toUpperCase()}${part.slice(1)}`
      : part)
    .join(" ");
}

function formatAuditValue(value: Json | null) {
  if (value === null) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object"
    && error !== null
    && "message" in error
    && typeof error.message === "string"
  ) {
    return error.message;
  }
  return "An unknown Supabase error occurred.";
}

function getSafetyRecord(data: SafetyHubData, displayId: string | undefined): CoreSafetyRecord | undefined {
  if (!displayId) return undefined;
  return [...data.risks, ...data.actions, ...data.qiItems, ...data.brightIdeas]
    .find((record) => record.id === displayId);
}

function requireSafetyRecord(data: SafetyHubData, displayId: string | undefined, label: string): CoreSafetyRecord {
  const record = getSafetyRecord(data, displayId);
  if (!record?.databaseId) throw new Error(`${label} was not found in the current organisation scope.`);
  return record;
}

function getFormRecordDatabaseId(
  mode: SafetyFormMode,
  context: SafetyFormContext,
  data: SafetyHubData,
): string | null {
  const displayId = mode === "risk" ? context.riskId
    : mode === "action" ? context.actionId
      : mode === "qi" ? context.qiId
        : mode === "committee-review" ? context.ideaId
          : mode === "risk-review" ? context.riskId
            : mode === "link-records"
              ? context.riskId || context.actionId || context.qiId || context.ideaId
              : undefined;
  if (!displayId) return null;
  return requireSafetyRecord(data, displayId, "Source record").databaseId || null;
}

function getLinkedRecordId(
  data: SafetyHubData,
  displayId: string | undefined,
  expectedKind?: CoreSafetyRecord["kind"],
): string | null {
  if (!displayId?.trim()) return null;
  const record = requireSafetyRecord(data, displayId.trim(), "Linked record");
  if (expectedKind && record.kind !== expectedKind) {
    throw new Error(`${displayId} is not a ${expectedKind === "qi" ? "QI" : expectedKind} record.`);
  }
  return record.databaseId || null;
}

async function resolveSafetyOwnerId(ownerName: string): Promise<string | null> {
  const wanted = ownerName.trim().toLocaleLowerCase("en-AU");
  if (!wanted) return null;
  const { data, error } = await supabase.from("profiles").select("id, first_name, last_name");
  if (error) throw error;
  const matches = (data || []).filter((profile) =>
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim().toLocaleLowerCase("en-AU") === wanted,
  );
  if (matches.length === 0) throw new Error("Owner must exactly match a SportStack user's full name, or be left blank.");
  if (matches.length > 1) throw new Error("More than one SportStack user has that owner name. Leave it blank until a user selector is added.");
  return matches[0].id;
}

function buildSafetyFormPayload(
  mode: SafetyFormMode,
  values: Record<string, string>,
  data: SafetyHubData,
  ownerId: string | null,
): Json {
  const linkedRiskId = getLinkedRecordId(data, values.linkedRiskId, "risk");
  const linkedActionId = getLinkedRecordId(data, values.linkedActionId, "action");
  const linkedQiId = getLinkedRecordId(data, values.linkedQiId, "qi");
  const linkedIdeaId = getLinkedRecordId(data, values.linkedIdeaId, "idea");
  const baseLinks = {
    linked_risk_id: linkedRiskId,
    linked_action_id: linkedActionId,
    linked_qi_id: linkedQiId,
    linked_idea_id: linkedIdeaId,
    link_reason: values.linkNotes || "Related Safety Hub records",
  };

  if (mode === "risk") {
    return {
      ...baseLinks,
      title: values.title.trim(), summary: values.summary.trim(), risk_event: values.riskEvent.trim(),
      consequences: values.consequences.trim(), risk_type: values.type, category: values.category.trim(),
      owner_id: ownerId, status: toRiskDatabaseStatus(values.status),
      inherent_likelihood: safetyRatingNumber(values.inherentLikelihood),
      inherent_consequence: safetyRatingNumber(values.inherentConsequence),
      inherent_rating: calculateRiskRating(values.inherentLikelihood, values.inherentConsequence),
      residual_likelihood: safetyRatingNumber(values.residualLikelihood),
      residual_consequence: safetyRatingNumber(values.residualConsequence),
      residual_rating: calculateRiskRating(values.residualLikelihood, values.residualConsequence),
      target_rating: values.targetRating, existing_controls: values.existingControls.trim(),
      treatment_plan: values.treatmentPlan.trim(), review_frequency: values.reviewFrequency,
      next_review_date: values.nextReview || null, evidence: values.evidence.trim(),
      change_reason: values.changeReason?.trim() || null,
    };
  }
  if (mode === "action") {
    return {
      ...baseLinks,
      title: values.title.trim(), owner_id: ownerId, status: toActionDatabaseStatus(values.status),
      due_date: values.dueDate || null, baseline: values.baseline.trim(), evaluate: values.evaluate.trim(),
      specific: values.specific.trim(), measurable: values.measurable.trim(),
      achievable: values.achievable.trim(), relevant: values.relevant.trim(),
      time_bound: values.timeBound.trim(), resources: values.resources.trim(),
      change_reason: values.changeReason?.trim() || null,
    };
  }
  if (mode === "qi") {
    return {
      ...baseLinks,
      title: values.title.trim(), source: values.source.trim(), area: values.area.trim(), owner_id: ownerId,
      due_date: values.dueDate || null, priority: values.priority.toUpperCase(),
      status: toQiDatabaseStatus(values.status), issue: values.issue.trim(),
      required_action: values.requiredAction.trim(), outcome: values.outcome.trim(),
      change_reason: values.changeReason?.trim() || null,
    };
  }
  if (mode === "idea") {
    return {
      title: values.title.trim(), why_needed: values.whyNeeded.trim(),
      suggested_implementation: values.suggestedImplementation.trim(),
      suggested_evaluation: values.suggestedEvaluation.trim(), could_assist: values.couldAssist.trim(),
      other_information: values.otherInfo.trim(), status: toIdeaDatabaseStatus(values.status),
    };
  }
  if (mode === "committee-review") {
    const linkedRecord = getLinkedRecordId(data, values.linkedRecordId);
    const record = getSafetyRecord(data, values.linkedRecordId);
    return {
      decision: toIdeaDatabaseDecision(values.decision),
      status: toIdeaStatusFromDecision(values.decision),
      committee_notes: values.committeeNotes.trim(), decision_reason: values.decisionReason.trim(),
      linked_risk_id: record?.kind === "risk" ? linkedRecord : null,
      linked_action_id: record?.kind === "action" ? linkedRecord : null,
      linked_qi_id: record?.kind === "qi" ? linkedRecord : null,
      linked_idea_id: null,
      link_reason: values.decisionReason.trim() || "Committee decision relationship",
    };
  }
  if (mode === "risk-review") {
    return {
      reviewed_at: new Date(`${values.reviewDate}T12:00:00`).toISOString(),
      residual_likelihood: safetyRatingNumber(values.residualLikelihood),
      residual_consequence: safetyRatingNumber(values.residualConsequence),
      residual_rating: calculateRiskRating(values.residualLikelihood, values.residualConsequence),
      status: toRiskDatabaseStatus(values.status), next_review_date: values.nextReview || null,
      review_notes: values.reviewNotes.trim(), evidence: values.evidence.trim(),
    };
  }

  const source = requireSafetyRecord(data, values.sourceRecordId, "Source record");
  return {
    ...baseLinks,
    source_type: source.kind,
    link_reason: values.linkNotes.trim(),
  };
}

function safetyRatingNumber(value: string): number {
  const likelihood = formLikelihoodOptions.indexOf(value);
  if (likelihood >= 0) return likelihood + 1;
  const consequence = formConsequenceOptions.indexOf(value);
  if (consequence >= 0) return consequence + 1;
  throw new Error("Select a valid likelihood or consequence rating.");
}

function toRiskDatabaseStatus(value: string): string {
  return ({ Open: "OPEN", "In progress": "IN_PROGRESS", Controlled: "CONTROLLED", Closed: "CLOSED", "Entered in error": "ENTERED_IN_ERROR" } as Record<string, string>)[value] || "OPEN";
}

function toActionDatabaseStatus(value: string): string {
  return ({ "Not started": "PENDING", "In progress": "IN_PROGRESS", Blocked: "BLOCKED", Complete: "COMPLETED", "Entered in error": "ENTERED_IN_ERROR" } as Record<string, string>)[value] || "PENDING";
}

function toQiDatabaseStatus(value: string): string {
  return ({ New: "NEW", "Awaiting decision": "AWAITING_DECISION", Approved: "APPROVED", "In progress": "IN_PROGRESS", Complete: "COMPLETED", "Entered in error": "ENTERED_IN_ERROR" } as Record<string, string>)[value] || "NEW";
}

function toIdeaDatabaseStatus(value: string): string {
  return value.trim().toUpperCase().replaceAll(" ", "_");
}

function toIdeaDatabaseDecision(value: string): string | null {
  return value === "Pending" ? null : value.toUpperCase();
}

function toIdeaStatusFromDecision(value: string): string {
  if (value === "Accept") return "ACCEPTED";
  if (value === "Defer") return "DEFERRED";
  if (value === "Pending") return "UNDER_REVIEW";
  return "CLOSED";
}

function getCommitteeReviewFollowUpMode(value: string): "risk" | "action" | "qi" | null {
  if (value === "Create risk") return "risk";
  if (value === "Create action") return "action";
  if (value === "Create QI item") return "qi";
  return null;
}

function getSafetySaveTitle(mode: SafetyFormMode): string {
  if (mode === "risk-review") return "Risk review saved";
  if (mode === "committee-review") return "Committee decision saved";
  if (mode === "link-records") return "Record links saved";
  if (mode === "idea") return "Bright Idea submitted";
  if (mode === "qi") return "QI record saved";
  if (mode === "action") return "BE SMART action saved";
  return "Risk record saved";
}

function editableSafetyOwner(value: string | undefined): string {
  return value && !["Unassigned", "Not recorded"].includes(value) ? value : "";
}

function toSafetyDateInput(value: string | undefined): string {
  if (!value || value === "Not recorded") return "";
  const [day, month, year] = value.split("/");
  return day && month && year ? `${year}-${month}-${day}` : value;
}

function parseDateFilter(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseAuditEventDate(value: string): Date | null {
  const [datePart] = value.split(" ");
  const [day, month, year] = datePart.split("/").map(Number);
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function calculateRiskRating(likelihood: string | undefined, consequence: string | undefined): RiskRating {
  const likelihoodIndex = formLikelihoodOptions.indexOf(likelihood || "");
  const consequenceIndex = formConsequenceOptions.indexOf(consequence || "");

  if (likelihoodIndex < 0 || consequenceIndex < 0) return "Medium";
  return prototypeRiskMatrix[likelihoodIndex][consequenceIndex];
}

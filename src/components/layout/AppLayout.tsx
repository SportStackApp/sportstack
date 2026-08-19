import { useState, useEffect, useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { cn, getTeamDisplayName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  MessageCircle,
  LogOut,
  Menu,
  X,
  Bell,
  AlertTriangle,
  ClipboardList,
  ClipboardCheck,
  Users,
  UserCog,
  Building2,
  Shield,
  Globe,
  ChevronDown,
  MapPin,
  LayoutGrid,
  GitMerge,
  Trophy,
  Vote,
  Layers,
  MessageSquare,
  ImagePlus,
  ShieldCheck,
  Radar,
  ReceiptText,
  UserSearch,
  UserCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTeamContext } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAppMode, MODE_LABELS, type AppMode } from "@/contexts/AppModeContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useModuleAvailability } from "@/hooks/useModuleAvailability";
import { useCoordinationAccess } from "@/hooks/useCoordinationAccess";
import { APP_ENVIRONMENT, APP_ENVIRONMENT_CLASS, APP_VERSION } from "@/lib/appVersion";
import { filterClubsForActiveMode } from "@/lib/activeScopeOptions";
import { isProfileReviewRequired } from "@/lib/profileCompletion";
import { useExpenseHubAccess } from "@/features/expense-hub/useExpenseHubAccess";

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
}
interface NavSection {
  heading: string;
  items: NavItem[];
}

const ADMIN_DROPDOWN_SECTIONS: NavSection[] = [
  {
    heading: "Overview",
    items: [
      { path: "/admin", label: "Admin Dashboard", icon: LayoutDashboard },
      { path: "/admin/fixtures", label: "Fixtures", icon: Calendar },
    ],
  },
  {
    heading: "Organisation",
    items: [
      { path: "/admin/associations", label: "Associations", icon: Globe },
      { path: "/admin/competitions", label: "Competitions", icon: Trophy },
      { path: "/admin/clubs", label: "Clubs", icon: Building2 },
      { path: "/admin/divisions", label: "Divisions", icon: Layers },
      { path: "/admin/teams", label: "Teams", icon: Shield },
      { path: "/admin/venues", label: "Venues", icon: MapPin },
    ],
  },
  {
    heading: "People & Access",
    items: [
      { path: "/admin/users", label: "Users", icon: UserCog },
      { path: "/admin/requests", label: "Requests", icon: ClipboardList },
      { path: "/admin/roles-permissions", label: "Roles & modules", icon: Shield },
    ],
  },
  {
    heading: "Data Quality",
    items: [
      { path: "/admin/bulk-import", label: "Bulk Import", icon: GitMerge },
      { path: "/admin/fixture-import", label: "Fixture Import", icon: Calendar },
      { path: "/admin/revsports-entities", label: "RevSports Review", icon: GitMerge },
      { path: "/admin/player-explorer", label: "Player Explorer", icon: UserSearch },
      { path: "/admin/revsports-mappings", label: "Legacy Direct Mappings", icon: GitMerge },
      { path: "/admin/revsports-unmatched", label: "Legacy Unmatched Queue", icon: AlertTriangle },
    ],
  },
  {
    heading: "Support",
    items: [
      { path: "/admin/feedback", label: "Feedback", icon: MessageSquare },
      { path: "/admin/error-logs", label: "Error Logs", icon: AlertTriangle },
    ],
  },
  {
    heading: "Voting",
    items: [
      { path: "/admin/mvp-voting", label: "Player MVP Voting", icon: Trophy },
      { path: "/admin/umpire-voting", label: "Umpire Match Voting", icon: Vote },
      { path: "/admin/analytics", label: "Voting Analytics", icon: BarChart3 },
    ],
  },
  {
    heading: "Modules",
    items: [
      { path: "/committee", label: "Committee Management", icon: Users },
      { path: "/coordination", label: "Coordination", icon: UserCheck },
      { path: "/admin/safety-risk", label: "Safety Hub", icon: ShieldCheck },
      { path: "/admin/module-preview", label: "Module Preview", icon: ImagePlus },
    ],
  },
];

const NAV_SETS: Record<AppMode, NavSection[]> = {
  super_admin: [
    {
      heading: "Core",
      items: [
        { path: "/admin", label: "Admin Dashboard", icon: LayoutDashboard },
        { path: "/admin/fixtures", label: "Fixtures", icon: Calendar },
        { path: "/chat", label: "Communications", icon: MessageCircle },
      ],
    },
    {
      heading: "MVP Voting",
      items: [
        { path: "/admin/mvp-voting", label: "Player MVP Voting", icon: Trophy },
        { path: "/admin/analytics", label: "MVP Analytics", icon: BarChart3 },
      ],
    },
    {
      heading: "Safety",
      items: [
        { path: "/committee", label: "Committee Management", icon: Users },
        { path: "/admin/safety-risk", label: "Safety Hub", icon: ShieldCheck },
      ],
    },
    {
      heading: "Coaching",
      items: [
        { path: "/coaching", label: "Squad", icon: ClipboardCheck },
        { path: "/coaching/formations", label: "Formation Library", icon: LayoutGrid },
        { path: "/roster", label: "Roster", icon: Users },
        { path: "/coaching/trace", label: "Hockey Trace Lab", icon: Radar },
      ],
    },
    {
      heading: "Umpiring",
      items: [
        { path: "/umpire/vote", label: "Umpire Match Ballot", icon: ClipboardList },
        { path: "/coordination", label: "Coordination", icon: UserCheck },
      ],
    },
    {
      heading: "Admin",
      items: [
        { path: "/admin/associations", label: "Associations", icon: Globe },
        { path: "/admin/competitions", label: "Competitions", icon: Trophy },
        { path: "/admin/divisions", label: "Divisions", icon: Layers },
        { path: "/admin/clubs", label: "Clubs", icon: Building2 },
        { path: "/admin/teams", label: "Teams", icon: Shield },
        { path: "/admin/venues", label: "Venues", icon: MapPin },
        { path: "/admin/users", label: "Users", icon: UserCog },
        { path: "/admin/requests", label: "Requests", icon: ClipboardList },
        { path: "/admin/roles-permissions", label: "Roles & modules", icon: Shield },
      ],
    },
  ],
  association: [
    {
      heading: "Core",
      items: [
        { path: "/admin", label: "Admin Dashboard", icon: LayoutDashboard },
        { path: "/admin/fixtures", label: "Fixtures", icon: Calendar },
        { path: "/chat", label: "Communications", icon: MessageCircle },
      ],
    },
    {
      heading: "MVP Voting",
      items: [
        { path: "/admin/mvp-voting", label: "Player MVP Voting", icon: Trophy },
        { path: "/admin/analytics", label: "MVP Analytics", icon: BarChart3 },
      ],
    },
    {
      heading: "Umpiring",
      items: [
        { path: "/umpire/vote", label: "Umpire Match Ballot", icon: ClipboardList },
        { path: "/coordination", label: "Coordination", icon: UserCheck },
        { path: "/admin/umpire-voting", label: "Umpire Match Voting", icon: Vote },
        { path: "/admin/umpire-voting?tab=leaderboard", label: "Umpire Analytics", icon: BarChart3 },
      ],
    },
    {
      heading: "Safety",
      items: [
        { path: "/committee", label: "Committee Management", icon: Users },
        { path: "/admin/safety-risk", label: "Safety Hub", icon: ShieldCheck },
      ],
    },
    {
      heading: "Admin",
      items: [
        { path: "/admin/competitions", label: "Competitions", icon: Trophy },
        { path: "/admin/divisions", label: "Divisions", icon: Layers },
        { path: "/admin/clubs", label: "Clubs", icon: Building2 },
        { path: "/admin/teams", label: "Teams", icon: Shield },
        { path: "/admin/venues", label: "Venues", icon: MapPin },
        { path: "/admin/users", label: "Users", icon: UserCog },
        { path: "/admin/requests", label: "Requests", icon: ClipboardList },
        { path: "/admin/roles-permissions", label: "Roles & modules", icon: Shield },
      ],
    },
  ],
  club: [
    {
      heading: "Core",
      items: [
        { path: "/admin", label: "Admin Dashboard", icon: LayoutDashboard },
        { path: "/games", label: "Fixtures", icon: Calendar },
        { path: "/chat", label: "Communications", icon: MessageCircle },
        { path: "/coordination", label: "Coordination", icon: UserCheck },
      ],
    },
    {
      heading: "Voting",
      items: [
        { path: "/admin/mvp-voting", label: "Player MVP Voting", icon: Trophy },
      ],
    },
    {
      heading: "Safety",
      items: [
        { path: "/committee", label: "Committee Management", icon: Users },
        { path: "/admin/safety-risk", label: "Safety Hub", icon: ShieldCheck },
      ],
    },
    {
      heading: "Admin",
      items: [
        { path: "/admin/teams", label: "Teams", icon: Shield },
        { path: "/admin/divisions", label: "Divisions", icon: LayoutGrid },
        { path: "/admin/users", label: "Users", icon: UserCog },
        { path: "/admin/requests", label: "Requests", icon: ClipboardList },
        { path: "/admin/roles-permissions", label: "Roles & modules", icon: Shield },
      ],
    },
  ],
  team_manager: [
    {
      heading: "Core",
      items: [
        { path: "/dashboard", label: "My Dashboard", icon: LayoutDashboard },
        { path: "/games", label: "Fixtures", icon: Calendar },
        { path: "/chat", label: "Communications", icon: MessageCircle },
        { path: "/coordination", label: "Coordination", icon: UserCheck },
        { path: "/mvp-votes", label: "Player MVP", icon: Vote },
      ],
    },
    {
      heading: "Voting",
      items: [
        { path: "/admin/mvp-voting", label: "Manage Player MVP", icon: Trophy },
      ],
    },
    {
      heading: "Governance",
      items: [
        { path: "/committee", label: "Committee Management", icon: Users },
      ],
    },
    {
      heading: "Team data",
      items: [
        { path: "/admin/player-explorer", label: "Player Explorer", icon: UserSearch },
      ],
    },
    {
      heading: "Coaching",
      items: [
        { path: "/coaching", label: "Squad", icon: ClipboardCheck },
        { path: "/coaching/formations", label: "Formation Library", icon: LayoutGrid },
        { path: "/roster", label: "Roster", icon: Users },
        { path: "/coaching/trace", label: "Hockey Trace Lab", icon: Radar },
      ],
    },
  ],
  coach: [
    {
      heading: "Core",
      items: [
        { path: "/dashboard", label: "My Dashboard", icon: LayoutDashboard },
        { path: "/games", label: "Fixtures", icon: Calendar },
        { path: "/chat", label: "Communications", icon: MessageCircle },
        { path: "/coordination/my-assignments", label: "My coordination", icon: UserCheck },
        { path: "/mvp-votes", label: "Player MVP", icon: Vote },
      ],
    },
    {
      heading: "Coaching",
      items: [
        { path: "/coaching", label: "Squad", icon: ClipboardCheck },
        { path: "/admin/player-explorer", label: "Player Explorer", icon: UserSearch },
        { path: "/coaching/formations", label: "Formation Library", icon: LayoutGrid },
        { path: "/roster", label: "Roster", icon: Users },
        { path: "/coaching/trace", label: "Hockey Trace Lab", icon: Radar },
      ],
    },
  ],
  player: [
    {
      heading: "Core",
      items: [
        { path: "/dashboard", label: "My Dashboard", icon: LayoutDashboard },
        { path: "/games", label: "Fixtures", icon: Calendar },
        { path: "/chat", label: "Communications", icon: MessageCircle },
        { path: "/coordination/my-assignments", label: "My coordination", icon: UserCheck },
        { path: "/mvp-votes", label: "Player MVP", icon: Vote },
      ],
    },
    {
      heading: "Umpiring",
      items: [
        { path: "/umpire/vote", label: "Umpire Match Ballot", icon: ClipboardList },
        { path: "/coordination/my-assignments", label: "My coordination", icon: UserCheck },
      ],
    },
    {
      heading: "Governance",
      items: [
        { path: "/committee", label: "Committee Management", icon: Users },
      ],
    },
  ],
};

const ASSOCIATION_ADMIN_DROPDOWN_PATHS = new Set([
  "/admin",
  "/admin/competitions",
  "/admin/clubs",
  "/admin/divisions",
  "/admin/teams",
  "/admin/fixtures",
  "/admin/venues",
  "/admin/users",
  "/admin/requests",
  "/admin/feedback",
  "/admin/player-explorer",
  "/admin/mvp-voting",
  "/admin/umpire-voting",
  "/admin/analytics",
  "/admin/safety-risk",
  "/committee",
  "/admin/roles-permissions",
]);

const CLUB_ADMIN_DROPDOWN_PATHS = new Set([
  "/admin",
  "/admin/divisions",
  "/admin/teams",
  "/games",
  "/admin/users",
  "/admin/requests",
  "/admin/player-explorer",
  "/admin/mvp-voting",
  "/admin/safety-risk",
  "/committee",
  "/admin/roles-permissions",
]);

const NAV_MODULE_KEYS = [
  "player_mvp",
  "umpire_match_voting",
  "committee",
  "safety_risk",
  "hockey_trace",
  "coordination",
] as const;

const MOBILE_NAV: Record<AppMode, NavItem[]> = {
  super_admin: NAV_SETS.super_admin[0].items.slice(0, 4),
  association: NAV_SETS.association[0].items.slice(0, 4),
  club: NAV_SETS.club[0].items.slice(0, 4),
  team_manager: NAV_SETS.team_manager[0].items.slice(0, 4),
  coach: NAV_SETS.coach[0].items.slice(0, 4),
  player: NAV_SETS.player[0].items.slice(0, 4),
};

interface Notification {
  id: string;
  type: string | null;
  title: string;
  message: string | null;
  body: string | null;
  action_url: string | null;
  read: boolean;
  created_at: string;
}

interface NotificationRow {
  id: string;
  type?: string | null;
  title: string;
  message?: string | null;
  body?: string | null;
  action_url?: string | null;
  read: boolean;
  created_at: string;
}

interface VoterTeamMembership {
  teamId: string;
  teamName: string;
  membershipType: "PRIMARY" | "SECONDARY" | "FILL_IN";
  isDefaultTeam: boolean;
  divisionId: string | null;
  clubId: string;
  clubName: string;
  clubLogoUrl: string | null;
  associationId: string;
  associationName: string;
  associationAbbr: string | null;
  associationLogoUrl: string | null;
}

interface VoterAssociationRow {
  id: string;
  name: string | null;
  abbreviation: string | null;
  logo_url: string | null;
}

interface VoterClubRow {
  id: string;
  name: string | null;
  logo_url: string | null;
  associations: VoterAssociationRow | VoterAssociationRow[] | null;
}

interface VoterTeamRow {
  id: string;
  name: string | null;
  division_id: string | null;
  clubs: VoterClubRow | VoterClubRow[] | null;
}

interface VoterMembershipRow {
  membership_type: "PRIMARY" | "SECONDARY" | "PERMANENT";
  teams: VoterTeamRow | VoterTeamRow[] | null;
}

interface FillInMembershipRow {
  access_expires_at: string;
  teams: VoterTeamRow | VoterTeamRow[] | null;
}

interface TeamRoleRow {
  team_id: string | null;
}

interface FeedbackInsert {
  user_id: string;
  message: string;
  page_path: string;
  user_agent: string;
  screenshot_path?: string | null;
}

interface FeedbackAttachmentInsert {
  feedback_id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  content_type: string;
  file_size: number;
}

interface FeedbackClient {
  from: (table: "app_feedback") => {
    insert: (payload: FeedbackInsert) => {
      select: (columns: string) => {
        single: () => Promise<{ data: { id: string } | null; error: { message?: string } | null }>;
      };
    };
  };
}

interface FeedbackAttachmentClient {
  from: (table: "app_feedback_attachments") => {
    insert: (payload: FeedbackAttachmentInsert[]) => Promise<{ error: { message?: string } | null }>;
  };
}

interface RequestCountClient {
  from: (table: "requests") => {
    select: (
      columns: string,
      options: { count: "exact"; head: true }
    ) => {
      eq: (column: "status", value: "PENDING") => Promise<{ count: number | null; error: { message?: string } | null }>;
    };
  };
}

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { mode, activeMode, setMode, availableModes, canSwitchMode, modeLabel, roles, viewingAs, setViewingAs, isViewingAsOverridden, setIsViewingAsOverridden, modeChanging, modeSyncError } = useAppMode();
  const {
    associations,
    selectedAssociationId,
    selectedClubId,
    selectedTeamId,
    selectedDivision,
    setSelectedAssociationId,
    setSelectedClubId,
    setSelectedTeamId,
    setSelectedDivision,
    setSelectedScope,
    clubs,
    teams,
    teamDivisions,
    filteredClubs,
    filteredTeams,
    filteredDivisions,
    selectedAssociation,
    selectedClub,
    selectedTeam,
  } = useTeamContext();
  const {
    loading: adminScopeLoading,
    scopedAssociationIds,
    scopedClubIds,
  } = useAdminScope();
  const { enabled: moduleEnabled } = useModuleAvailability([...NAV_MODULE_KEYS]);
  const { access: coordinationAccess } = useCoordinationAccess();
  const { allowed: expenseHubAllowed } = useExpenseHubAccess();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAssociationPopoverOpen, setIsAssociationPopoverOpen] = useState(false);
  const [isCascadePopoverOpen, setIsCascadePopoverOpen] = useState(false);
  const [isModeSwitcherOpen, setIsModeSwitcherOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [communicationUnreadCount, setCommunicationUnreadCount] = useState(0);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState("U");
  const [playerAssociationName, setPlayerAssociationName] = useState("");
  const [playerAssociationAbbr, setPlayerAssociationAbbr] = useState("");
  const [playerClubName, setPlayerClubName] = useState("");
  const [playerTeamName, setPlayerTeamName] = useState("");
  const [playerLogoUrl, setPlayerLogoUrl] = useState<string | null>(null);
  const [voterTeamMemberships, setVoterTeamMemberships] = useState<VoterTeamMembership[]>([]);
  const [hasCurrentCommitteeMembership, setHasCurrentCommitteeMembership] = useState(false);
  const [fillInRefreshTick, setFillInRefreshTick] = useState(0);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackScreenshots, setFeedbackScreenshots] = useState<File[]>([]);
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);

  const isVoterOnly = roles.length === 1 && roles[0] === "VOTER";
  const isBrandNewUser = roles.length === 0;
  const isTeamScopedMode = activeMode === "player" || activeMode === "team_manager" || activeMode === "coach";

  useEffect(() => {
    if (!user) {
      setHasCurrentCommitteeMembership(false);
      return;
    }

    let active = true;
    const loadCommitteeMembership = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("committee_members")
        .select("id")
        .eq("user_id", user.id)
        .lte("start_date", today)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .limit(1);

      if (!active) return;
      if (error) {
        setHasCurrentCommitteeMembership(false);
        return;
      }

      setHasCurrentCommitteeMembership((data || []).length > 0);
    };

    void loadCommitteeMembership();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!modeSyncError) return;
    toast({
      title: "Mode was not changed",
      description: modeSyncError,
      variant: "destructive",
    });
  }, [modeSyncError, toast]);


  // Keep the bell current without requiring a page refresh.
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    let active = true;
    const fetchNotifications = async () => {
      const [result, profileResult] = await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("profiles")
          .select("first_name, last_name, phone, date_of_birth, gender, updated_at")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      if (active && !result.error) {
        const rows = (result.data || []) as unknown as NotificationRow[];
        const storedNotifications = rows.map((row) => ({
            id: row.id,
            type: row.type || null,
            title: row.title,
            message: row.message || row.body || null,
            body: row.body || null,
            action_url: row.action_url || null,
            read: row.read,
            created_at: row.created_at,
          }));
        const completionNotification: Notification | null = isProfileReviewRequired(profileResult.data)
          ? {
              id: "profile-completion",
              type: "PROFILE_COMPLETION",
              title: "Complete your profile",
              message: "Add your missing personal details so your SportStack profile is ready.",
              body: null,
              action_url: "/profile",
              read: false,
              created_at: profileResult.data?.updated_at || new Date().toISOString(),
            }
          : null;
        setNotifications(completionNotification ? [completionNotification, ...storedNotifications] : storedNotifications);
      }
    };

    void fetchNotifications();
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => void fetchNotifications(),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  // Ordinary team messages use a navigation badge, not an individual alert.
  useEffect(() => {
    if (!user) {
      setCommunicationUnreadCount(0);
      return;
    }
    let active = true;
    const refreshCommunicationUnread = async () => {
      const communicationClient = supabase;
      const scopeRequests = [
        selectedTeamId
          ? communicationClient.from("communication_channels").select("id").eq("team_id", selectedTeamId).maybeSingle()
          : Promise.resolve({ data: null }),
        selectedClubId
          ? communicationClient.from("communication_channels").select("id").eq("club_id", selectedClubId).maybeSingle()
          : Promise.resolve({ data: null }),
        selectedAssociationId
          ? communicationClient.from("communication_channels").select("id").eq("association_id", selectedAssociationId).maybeSingle()
          : Promise.resolve({ data: null }),
      ];
      const results = await Promise.all(scopeRequests);
      const channelIds = results.map((result) => result.data?.id).filter(Boolean) as string[];
      if (channelIds.length === 0) {
        if (active) setCommunicationUnreadCount(0);
        return;
      }
      const { data: states } = await communicationClient
        .from("communication_read_state")
        .select("channel_id, last_read_at")
        .eq("user_id", user.id)
        .in("channel_id", channelIds);
      const counts = await Promise.all(channelIds.map((channelId) => {
        const readState = ((states || []) as Array<{ channel_id: string; last_read_at: string | null }>)
          .find((state) => state.channel_id === channelId);
        let query = communicationClient
          .from("communication_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", channelId)
          .neq("author_id", user.id)
          .is("removed_at", null);
        if (readState?.last_read_at) query = query.gt("created_at", readState.last_read_at);
        return query;
      }));
      if (active) setCommunicationUnreadCount(counts.reduce((sum, result) => sum + (result.count || 0), 0));
    };
    void refreshCommunicationUnread();
    const channel = supabase
      .channel(`communication-unread:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "communication_messages" }, () => {
        void refreshCommunicationUnread();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "communication_read_state", filter: `user_id=eq.${user.id}` }, () => {
        void refreshCommunicationUnread();
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [selectedAssociationId, selectedClubId, selectedTeamId, user]);

  // Fetch pending request count for admin badge
  useEffect(() => {
    if (!user) return;
    const isAdmin = activeMode === "super_admin" || activeMode === "association" || activeMode === "club";
    if (!isAdmin) { setPendingRequestCount(0); return; }
    const fetchCount = async () => {
      const requestCountClient = supabase as unknown as RequestCountClient;
      const [membershipRequests, primaryRequests] = await Promise.all([
        requestCountClient
          .from("requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "PENDING"),
        supabase
          .from("primary_change_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["PENDING", "ADMIN_APPROVED"]),
      ]);
      setPendingRequestCount((membershipRequests.count || 0) + (primaryRequests.count || 0));
    };
    fetchCount();
  }, [user, activeMode]);

  // Fetch user avatar
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, first_name, last_name")
        .eq("id", user.id)
        .single();
      if (data) {
        setUserAvatarUrl(data.avatar_url);
        const initials = [data.first_name, data.last_name]
          .filter(Boolean)
          .map((n) => n!.charAt(0).toUpperCase())
          .join("");
        setUserInitials(initials || user.email?.charAt(0).toUpperCase() || "U");
      }
    };
    fetchProfile();
  }, [user]);

  // Fetch regular teams plus fixture-scoped fill-in teams whose access has not expired.
  useEffect(() => {
    let expiryTimer: number | undefined;
    let active = true;
    const clearPlayerHeaderContext = () => {
      setPlayerAssociationName("");
      setPlayerAssociationAbbr("");
      setPlayerClubName("");
      setPlayerTeamName("");
      setPlayerLogoUrl(null);
      setVoterTeamMemberships([]);
    };

    if (!isTeamScopedMode || !user) {
      clearPlayerHeaderContext();
      return;
    }

    const fetchPlayerHeaderContext = async () => {
      const now = new Date().toISOString();
      const scopedRole = activeMode === "team_manager" ? "TEAM_MANAGER" : activeMode === "coach" ? "COACH" : null;
      const [regularResult, fillInResult, profileResult, roleResult] = await Promise.all([
        supabase
          .from("team_memberships")
          .select("team_id, membership_type, teams(id, name, division_id, clubs(id, name, logo_url, associations(id, name, abbreviation, logo_url)))")
          .eq("user_id", user.id)
          .eq("status", "ACTIVE")
          .in("membership_type", ["PRIMARY", "SECONDARY", "PERMANENT"]),
        // New additive table is used before generated types are refreshed from Dev.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("fixture_fill_ins")
          .select("access_expires_at, teams(id, name, division_id, clubs(id, name, logo_url, associations(id, name, abbreviation, logo_url)))")
          .eq("player_id", user.id)
          .eq("status", "SELECTED")
          .lte("access_starts_at", now)
          .gte("access_expires_at", now),
        // The registered-club field is added by the same migration.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("profiles")
          .select("registered_club_id")
          .eq("id", user.id)
          .maybeSingle(),
        scopedRole
          ? supabase
              .from("user_roles")
              .select("team_id")
              .eq("user_id", user.id)
              .eq("role", scopedRole)
              .not("team_id", "is", null)
          : Promise.resolve({ data: [] as TeamRoleRow[], error: null }),
      ]);

      const toMembership = (
        row: VoterMembershipRow | FillInMembershipRow,
        membershipType: VoterTeamMembership["membershipType"],
        isDefaultTeam: boolean,
      ) => {
          const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
          const club = Array.isArray(team?.clubs) ? team.clubs[0] : team?.clubs;
          const association = Array.isArray(club?.associations) ? club.associations[0] : club?.associations;

          if (!team?.id || !club?.id || !association?.id) return null;

          return {
            teamId: team.id,
            teamName: team.name || "Team",
            membershipType,
            isDefaultTeam,
            divisionId: team.division_id || teamDivisions.find((item) => item.team_id === team.id)?.division_id || null,
            clubId: club.id,
            clubName: club.name || "Club",
            clubLogoUrl: club.logo_url || null,
            associationId: association.id,
            associationName: association.name || "Association",
            associationAbbr: association.abbreviation || null,
            associationLogoUrl: association.logo_url || null,
          } satisfies VoterTeamMembership;
      };

      const registeredClubId = (profileResult.data as { registered_club_id?: string | null } | null)?.registered_club_id;
      const regularMemberships = ((regularResult.data || []) as unknown as VoterMembershipRow[])
        .map((row) => {
          const initial = toMembership(row, "SECONDARY", row.membership_type === "PRIMARY");
          if (!initial) return null;
          return {
            ...initial,
            membershipType: registeredClubId
              ? initial.clubId === registeredClubId ? "PRIMARY" : "SECONDARY"
              : row.membership_type === "PRIMARY" ? "PRIMARY" : "SECONDARY",
          } satisfies VoterTeamMembership;
        });
      const fillInRows = ((fillInResult.data || []) as unknown as FillInMembershipRow[]);
      const fillInMemberships = fillInRows.map((row) => toMembership(row, "FILL_IN", false));
      const toRoleMembership = (row: TeamRoleRow) => {
        const team = teams.find((item) => item.id === row.team_id);
        const club = team ? clubs.find((item) => item.id === team.club_id) : undefined;
        const association = club ? associations.find((item) => item.id === club.association_id) : undefined;
        if (!team || !club || !association) return null;

        return {
          teamId: team.id,
          teamName: team.name || "Team",
          membershipType: "SECONDARY",
          isDefaultTeam: false,
          divisionId: team.division_id || teamDivisions.find((item) => item.team_id === team.id)?.division_id || null,
          clubId: club.id,
          clubName: club.name || "Club",
          clubLogoUrl: club.logo_url || null,
          associationId: association.id,
          associationName: association.name || "Association",
          associationAbbr: association.abbreviation || null,
          associationLogoUrl: association.logo_url || null,
        } satisfies VoterTeamMembership;
      };
      const roleMemberships = ((roleResult.data || []) as unknown as TeamRoleRow[])
        .map((row) => {
          const roleMembership = toRoleMembership(row);
          if (!roleMembership) return null;
          const matchingMembership = regularMemberships.find((item) => item?.teamId === roleMembership.teamId);
          return matchingMembership || roleMembership;
        });
      if (roleResult.error) {
        console.error(`Unable to load ${scopedRole || "team"} scopes`, roleResult.error);
      }
      const accessibleMemberships = activeMode === "player"
        ? [...regularMemberships, ...fillInMemberships]
        : roleMemberships;
      const memberships = accessibleMemberships
        .filter((membership): membership is VoterTeamMembership => Boolean(membership))
        .filter((membership, index, all) => all.findIndex((item) => item.teamId === membership.teamId) === index)
        .sort((a, b) => {
          const order = { PRIMARY: 0, SECONDARY: 1, FILL_IN: 2 } as const;
          if (a.isDefaultTeam !== b.isDefaultTeam) return a.isDefaultTeam ? -1 : 1;
          return order[a.membershipType] - order[b.membershipType];
        });

      if (!active) return;

      const nextExpiry = fillInRows
        .map((row) => new Date(row.access_expires_at).getTime())
        .filter((value) => Number.isFinite(value) && value > Date.now())
        .sort((a, b) => a - b)[0];
      if (nextExpiry) {
        expiryTimer = window.setTimeout(
          () => setFillInRefreshTick((current) => current + 1),
          Math.min(nextExpiry - Date.now() + 1000, 2_147_000_000),
        );
      }

      setVoterTeamMemberships(memberships);

      const contextSessionKey = `${activeMode}-primary-context:${user.id}`;
      const primaryMembership =
        memberships.find((membership) => membership.isDefaultTeam)
        || memberships.find((membership) => membership.membershipType === "PRIMARY")
        || memberships[0];
      const needsPrimaryContext = !sessionStorage.getItem(contextSessionKey);
      const selectedMembership = memberships.find((membership) => membership.teamId === selectedTeamId);
      const currentMembership = needsPrimaryContext
        ? primaryMembership
        : selectedMembership || primaryMembership;

      if (!currentMembership) {
        clearPlayerHeaderContext();
        return;
      }

      setPlayerAssociationName(currentMembership.associationName);
      setPlayerAssociationAbbr(currentMembership.associationAbbr || "");
      setPlayerClubName(currentMembership.clubName);
      setPlayerTeamName(currentMembership.teamName);
      setPlayerLogoUrl(currentMembership.associationLogoUrl || currentMembership.clubLogoUrl);

      if (needsPrimaryContext || !selectedMembership) {
        sessionStorage.setItem(contextSessionKey, currentMembership.teamId);
        setSelectedScope({
          associationId: currentMembership.associationId,
          clubId: currentMembership.clubId,
          divisionId: currentMembership.divisionId || "",
          teamId: currentMembership.teamId,
        });
      }
    };

    void fetchPlayerHeaderContext();
    return () => {
      active = false;
      if (expiryTimer) window.clearTimeout(expiryTimer);
    };
  }, [
    fillInRefreshTick,
    isTeamScopedMode,
    activeMode,
    user,
    selectedTeamId,
    setSelectedScope,
    teamDivisions,
    associations,
    clubs,
    teams,
  ]);

  // Auto-switch viewingAs based on cascade selection (only if not manually overridden)
  useEffect(() => {
    if (mode !== "super_admin") return;
    if (isViewingAsOverridden) return;
    if (modeChanging) return;
    if (modeSyncError) return;

    const cascadeMode: AppMode = selectedTeamId
      ? "team_manager"
      : selectedClubId
        ? "club"
        : selectedAssociationId
          ? "association"
          : "super_admin";
    if (viewingAs !== cascadeMode) void setViewingAs(cascadeMode);
  }, [selectedAssociationId, selectedClubId, selectedTeamId, isViewingAsOverridden, mode, modeChanging, modeSyncError, setViewingAs, viewingAs]);

  const handleAssociationChange = (associationId: string) => {
    setSelectedAssociationId(associationId);
    setIsAssociationPopoverOpen(false);
    navigate(`/associations/${associationId}`);
  };

  const rawBaseSections = expenseHubAllowed
    ? [
        ...NAV_SETS[activeMode],
        { heading: "Finance", items: [{ path: "/expense-hub", label: "Expense Hub", icon: ReceiptText }] },
      ]
    : NAV_SETS[activeMode];
  const baseSections = coordinationAccess.is_coordinator
    ? rawBaseSections.map((section) => ({
        ...section,
        items: section.items.map((item) => item.path === "/coordination/my-assignments"
          ? { ...item, path: "/coordination", label: "Coordination" }
          : item),
      }))
    : rawBaseSections;
  // Viewing as is an actual data/action restriction, not only a navigation skin.
  const showAssociationSelector = activeMode === "super_admin";
  const showClubSelector = activeMode === "super_admin" || activeMode === "association" || activeMode === "club";
  const showAdminDropdown = activeMode === "super_admin" || activeMode === "association" || activeMode === "club";
  const authorisedClubs = useMemo(() => filterClubsForActiveMode(
    clubs,
    activeMode,
    scopedAssociationIds,
    scopedClubIds,
  ), [activeMode, clubs, scopedAssociationIds, scopedClubIds]);
  const cascadeClubs = useMemo(
    () => authorisedClubs.filter((club) => club.association_id === selectedAssociationId),
    [authorisedClubs, selectedAssociationId],
  );
  const isModulePathEnabled = (path: string) => {
    if (path === "/mvp-votes" || path === "/admin/mvp-voting") return moduleEnabled.player_mvp;
    if (path === "/umpire/vote" || path === "/admin/umpire-voting") return moduleEnabled.umpire_match_voting;
    if (path === "/admin/analytics") return moduleEnabled.player_mvp || moduleEnabled.umpire_match_voting;
    if (path === "/admin/safety-risk") return moduleEnabled.safety_risk;
    if (path === "/committee") return moduleEnabled.committee;
    if (path === "/coaching/trace") return moduleEnabled.hockey_trace;
    if (path === "/coordination" || path === "/coordination/my-assignments") return moduleEnabled.coordination;
    return true;
  };

  const visibleSections = baseSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (isVoterOnly && !["/dashboard", "/mvp-votes"].includes(item.path)) return false;
      if (isBrandNewUser && item.path !== "/dashboard") return false;
      if (!isModulePathEnabled(item.path)) return false;
      if (item.path === "/mvp-votes" && !roles.some((role) => role === "PLAYER" || role === "VOTER" || role === "SUPER_ADMIN")) return false;
      if (item.path === "/umpire/vote"
        && activeMode === "player"
        && !roles.includes("UMPIRE")) return false;
      if (item.path === "/committee"
        && !["super_admin", "association", "club"].includes(activeMode)
        && !hasCurrentCommitteeMembership) return false;
      if (selectedAssociationId && item.path === "/admin/associations") return false;
      if (selectedClubId && item.path === "/admin/clubs") return false;
      if (selectedTeamId && item.path === "/admin/teams") return false;
      if (showAdminDropdown && section.heading === "Admin") return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);
  const rawMobileNavItems = isBrandNewUser ? MOBILE_NAV.player.filter((item) => item.path === "/dashboard") : MOBILE_NAV[activeMode];
  const mobileNavItems = coordinationAccess.is_coordinator
    ? rawMobileNavItems.map((item) => item.path === "/coordination/my-assignments"
      ? { ...item, path: "/coordination", label: "Coordination" }
      : item)
    : rawMobileNavItems;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = async (notification: Notification) => {
    if (user && !notification.read && notification.id !== "profile-completion") {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item,
        ),
      );

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notification.id)
        .eq("user_id", user.id);

      if (error) {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, read: false } : item,
          ),
        );
      }
    }

    if (notification.action_url?.startsWith("/")) {
      navigate(notification.action_url, {
        state: { notificationRefreshAt: Date.now() },
      });
    }
  };

  const visibleAdminDropdownSections = ADMIN_DROPDOWN_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!showAdminDropdown) return false;
      if (!isModulePathEnabled(item.path)) return false;
      if (activeMode === "association" && !ASSOCIATION_ADMIN_DROPDOWN_PATHS.has(item.path)) return false;
      if (activeMode === "club" && !CLUB_ADMIN_DROPDOWN_PATHS.has(item.path)) return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);

  const selectedDivisionObj = filteredDivisions.find((division) => division.id === selectedDivision);
  // A single available option is still a choice. Do not make a lower cascade
  // level look selected until the user or an explicit entity route selects it.
  const cascadeDivisionId = selectedDivision;
  const cascadeTeams = selectedClubId && cascadeDivisionId
    ? teams.filter((team) => {
        if (team.club_id !== selectedClubId) return false;
        const teamDivisionId = (team as { division_id?: string | null }).division_id;
        return teamDivisionId === cascadeDivisionId || teamDivisions.some((item) => item.team_id === team.id && item.division_id === cascadeDivisionId);
      })
    : filteredTeams;
  const staticCascadeClass =
    "flex h-10 min-w-0 max-w-[190px] items-center rounded-md bg-primary-foreground/10 px-3 text-sm font-medium text-primary-foreground truncate lg:max-w-[260px]";
  const cascadeSelectTriggerClass =
    "h-10 min-w-0 max-w-[190px] bg-primary-foreground/10 text-primary-foreground border-primary-foreground/15 font-medium data-[placeholder]:text-primary-foreground/70 lg:max-w-[260px]";
  const cascadePanelSelectTriggerClass =
    "h-10 w-full min-w-0 bg-background text-foreground border-border font-medium";
  const cascadeClearClass =
    "h-7 w-7 shrink-0 rounded-full text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10";
  const cascadeSummaryParts = [
    selectedAssociation?.name || (isTeamScopedMode ? playerAssociationName : ""),
    selectedClub?.name || (isTeamScopedMode ? playerClubName : ""),
    selectedDivisionObj?.name,
    selectedTeam ? getTeamDisplayName(selectedTeam) : isTeamScopedMode ? playerTeamName : "",
  ].filter(Boolean);
  const cascadeSummary = cascadeSummaryParts.length > 0 ? cascadeSummaryParts.join(" > ") : "Select scope";
  const selectedPlayerMembership = isTeamScopedMode
    ? voterTeamMemberships.find((membership) => membership.teamId === selectedTeamId) || voterTeamMemberships[0]
    : undefined;
  const playerCanBrowseParentEntities = selectedPlayerMembership?.membershipType !== "FILL_IN";
  const teamScopeLabel = (membership: VoterTeamMembership) =>
    membership.clubName === membership.teamName
      ? membership.teamName
      : `${membership.clubName} — ${membership.teamName}`;

  useEffect(() => {
    if (adminScopeLoading || activeMode !== "club") return;
    if (selectedClubId && authorisedClubs.some((club) => club.id === selectedClubId)) return;

    const fallbackClub = authorisedClubs[0];
    if (!fallbackClub) return;
    setSelectedScope({
      associationId: fallbackClub.association_id,
      clubId: fallbackClub.id,
      divisionId: "",
      teamId: "",
    });
    if (location.pathname.startsWith("/clubs/")) {
      navigate(`/clubs/${fallbackClub.id}`, { replace: true });
    }
  }, [
    activeMode,
    adminScopeLoading,
    authorisedClubs,
    location.pathname,
    navigate,
    selectedClubId,
    setSelectedScope,
  ]);

  useEffect(() => {
    // Player entity dashboards use their route ID and must not clear the
    // active membership context shown in the header. Clearing it here made
    // the player-primary effect immediately restore Pumas, creating a loop.
    if (isTeamScopedMode) return;

    const associationMatch = location.pathname.match(/^\/associations\/([^/]+)/);
    const clubMatch = location.pathname.match(/^\/clubs\/([^/]+)/);
    const teamMatch = location.pathname.match(/^\/teams\/([^/]+)/);

    if (teamMatch) {
      const teamId = teamMatch[1];
      const team = teams.find((item) => item.id === teamId) as { id: string; club_id: string; division_id?: string | null } | undefined;
      const club = team ? clubs.find((item) => item.id === team.club_id) : undefined;
      const divisionId = team?.division_id || teamDivisions.find((item) => item.team_id === teamId)?.division_id || "";

      if (club && selectedAssociationId !== club.association_id) setSelectedAssociationId(club.association_id);
      if (team && selectedClubId !== team.club_id) setSelectedClubId(team.club_id);
      if (divisionId && selectedDivision !== divisionId) setSelectedDivision(divisionId);
      if (team && selectedTeamId !== team.id) setSelectedTeamId(team.id);
      return;
    }

    if (clubMatch) {
      const clubId = clubMatch[1];
      if (adminScopeLoading) return;
      const club = authorisedClubs.find((item) => item.id === clubId);
      if (!club) {
        const fallbackClub = activeMode === "club" ? authorisedClubs[0] : undefined;
        if (fallbackClub) {
          setSelectedScope({
            associationId: fallbackClub.association_id,
            clubId: fallbackClub.id,
            divisionId: "",
            teamId: "",
          });
          navigate(`/clubs/${fallbackClub.id}`, { replace: true });
        }
        return;
      }
      if (club && selectedAssociationId !== club.association_id) setSelectedAssociationId(club.association_id);
      if (club && selectedClubId !== club.id) setSelectedClubId(club.id);
      if (selectedDivision) setSelectedDivision("");
      if (selectedTeamId) setSelectedTeamId("");
      return;
    }

    if (associationMatch) {
      const associationId = associationMatch[1];
      if (selectedAssociationId !== associationId) setSelectedAssociationId(associationId);
      if (selectedClubId) setSelectedClubId("");
      if (selectedDivision) setSelectedDivision("");
      if (selectedTeamId) setSelectedTeamId("");
    }
  }, [
    location.pathname,
    activeMode,
    adminScopeLoading,
    authorisedClubs,
    isTeamScopedMode,
    navigate,
    clubs,
    teams,
    teamDivisions,
    selectedAssociationId,
    selectedClubId,
    selectedDivision,
    selectedTeamId,
    setSelectedAssociationId,
    setSelectedClubId,
    setSelectedDivision,
    setSelectedScope,
    setSelectedTeamId,
  ]);

  const handleLogout = async () => {
    if (user?.id) {
      sessionStorage.removeItem(`player-primary-context:${user.id}`);
      sessionStorage.removeItem(`team_manager-primary-context:${user.id}`);
      sessionStorage.removeItem(`coach-primary-context:${user.id}`);
    }
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleModeSwitch = async (newMode: AppMode) => {
    const changed = await setMode(newMode);
    if (!changed) return;
    setIsModeSwitcherOpen(false);
    const landing = newMode === "super_admin" || newMode === "association" || newMode === "club" ? "/admin" : "/dashboard";
    navigate(landing);
  };

  const handleVoterTeamChange = (teamId: string) => {
    const membership = voterTeamMemberships.find((item) => item.teamId === teamId);
    if (!membership) return;

    setSelectedScope({
      associationId: membership.associationId,
      clubId: membership.clubId,
      divisionId: membership.divisionId || "",
      teamId: membership.teamId,
    });
    navigate(`/teams/${membership.teamId}`);
  };

  const handleFeedbackSubmit = async () => {
    if (!user || !feedbackMessage.trim() || isFeedbackSubmitting) return;

    setIsFeedbackSubmitting(true);
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    for (const screenshot of feedbackScreenshots) {
      if (!allowedTypes.includes(screenshot.type)) {
        toast({
          title: "Photos not attached",
          description: "Please use PNG, JPG, or WebP photos only.",
          variant: "destructive",
        });
        setIsFeedbackSubmitting(false);
        return;
      }

      if (screenshot.size > 5 * 1024 * 1024) {
        toast({
          title: "Photo too large",
          description: "Each photo must be under 5MB.",
          variant: "destructive",
        });
        setIsFeedbackSubmitting(false);
        return;
      }
    }

    const feedbackClient = supabase as unknown as FeedbackClient;
    const feedbackPayload: FeedbackInsert = {
      user_id: user.id,
      message: feedbackMessage.trim(),
      page_path: location.pathname,
      user_agent: navigator.userAgent,
      screenshot_path: null,
    };

    const { data: insertedFeedback, error } = await feedbackClient
      .from("app_feedback")
      .insert(feedbackPayload)
      .select("id")
      .single();

    if (error || !insertedFeedback) {
      setIsFeedbackSubmitting(false);
      toast({
        title: "Feedback not sent",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
      return;
    }

    const uploadedAttachments: FeedbackAttachmentInsert[] = [];

    for (const screenshot of feedbackScreenshots) {
      const extension = screenshot.name.split(".").pop() || "png";
      const storagePath = `${user.id}/${insertedFeedback.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("feedback-screenshots")
        .upload(storagePath, screenshot, {
          contentType: screenshot.type,
          upsert: false,
        });

      if (uploadError) {
        setIsFeedbackSubmitting(false);
        toast({
          title: "Photo not uploaded",
          description: uploadError.message || "Your feedback was saved, but one photo was not attached.",
          variant: "destructive",
        });
        return;
      }

      uploadedAttachments.push({
        feedback_id: insertedFeedback.id,
        user_id: user.id,
        storage_path: storagePath,
        file_name: screenshot.name,
        content_type: screenshot.type,
        file_size: screenshot.size,
      });
    }

    if (uploadedAttachments.length > 0) {
      const attachmentClient = supabase as unknown as FeedbackAttachmentClient;
      const { error: attachmentError } = await attachmentClient
        .from("app_feedback_attachments")
        .insert(uploadedAttachments);

      if (attachmentError) {
        setIsFeedbackSubmitting(false);
        toast({
          title: "Photos not linked",
          description: attachmentError.message || "Your feedback was saved, but the photo links were not saved.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsFeedbackSubmitting(false);
    setFeedbackMessage("");
    setFeedbackScreenshots([]);
    setIsFeedbackOpen(false);
    toast({
      title: "Feedback sent",
      description: "Thanks. Your feedback has been saved.",
    });
  };

  const renderSidebar = (isMobile: boolean) => (
    <>
      {/* Viewing As dropdown — Super Admin only */}
      {mode === "super_admin" && (
        <div className="shrink-0 px-3 pt-3 pb-1">
          <p className="text-xs font-medium text-primary-foreground/75 mb-1 px-1">Viewing as</p>
          <select
            value={viewingAs}
            disabled={modeChanging}
            onChange={(e) => {
              const selected = e.target.value as AppMode;
              // Claim the manual override before the async server write starts.
              // Otherwise the cascade effect can enqueue its automatic team
              // mode during this render and immediately replace the choice.
              setIsViewingAsOverridden(true);
              void setViewingAs(selected).then((changed) => {
                if (!changed) setIsViewingAsOverridden(false);
              });
            }}
            className="w-full rounded-md border border-border bg-background text-foreground text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="super_admin">⭐ Super Admin</option>
            {selectedAssociationId && <option value="association">Association Admin</option>}
            {selectedClubId && <option value="club">Club Admin</option>}
            {selectedTeamId && <option value="team_manager">Team Manager</option>}
            {selectedTeamId && <option value="coach">Coach</option>}
            {selectedTeamId && <option value="player">Player</option>}
          </select>
        </div>
      )}
      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-2">
        {visibleSections.map((section) => (
          <div key={section.heading} className="mb-2">
            <p className="text-xs font-semibold text-primary-foreground/75 uppercase tracking-wider px-6 py-2">
              {section.heading}
            </p>
            {section.items.map((item) => {
              const isActive =
                (item.path === "/admin" && location.pathname === "/admin") ||
                (item.path !== "/admin" && (
                  location.pathname === item.path ||
                  (item.path === "/games" && location.pathname.startsWith("/games"))
                ));
              const Icon = item.icon;
              const isRequestsItem = item.path === "/admin/requests";
              const isCommunicationsItem = item.path === "/chat";
              return (
                <Link
                  key={item.path + item.label}
                  to={item.path}
                  onClick={isMobile ? () => setIsMobileMenuOpen(false) : undefined}
                >
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 mx-2 my-1 rounded-lg text-sm font-medium transition-all border-l-4",
                      isActive
                        ? "bg-primary-foreground text-primary border-primary-foreground"
                        : "text-primary-foreground/95 hover:bg-primary-foreground/10 border-transparent"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                    {isRequestsItem && pendingRequestCount > 0 && (
                      <Badge className="ml-auto h-5 min-w-[20px] px-1.5 text-xs bg-destructive text-destructive-foreground">
                        {pendingRequestCount}
                      </Badge>
                    )}
                    {isCommunicationsItem && communicationUnreadCount > 0 && (
                      <Badge className="ml-auto h-5 min-w-[20px] bg-destructive px-1.5 text-xs text-destructive-foreground">
                        {communicationUnreadCount}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 p-4 space-y-2">
        {/* Mode Switcher */}
        {canSwitchMode && (
          <div className="relative">
            <button
              onClick={() => setIsModeSwitcherOpen(!isModeSwitcherOpen)}
              disabled={modeChanging}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg text-sm font-medium text-primary-foreground/95 hover:bg-primary-foreground/10 transition-all border border-primary-foreground/20"
            >
              <span className="truncate">{modeLabel}</span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isModeSwitcherOpen && "rotate-180")} />
            </button>
            {isModeSwitcherOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-background border border-border rounded-lg shadow-lg p-1 z-50">
                <p className="text-xs font-medium text-muted-foreground px-3 py-2">Switch Mode</p>
                {availableModes.map((m) => (
                  <button
                    key={m}
                    onClick={() => void handleModeSwitch(m)}
                    disabled={modeChanging}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                      m === mode
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setIsFeedbackOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-primary-foreground/95 hover:bg-primary-foreground/10 transition-all"
        >
          <MessageSquare className="h-5 w-5" />
          Send feedback
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-primary-foreground/95 hover:bg-primary-foreground/10 transition-all"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>

        <div className="px-4 pt-2 text-xs text-primary-foreground/65">
          SportStack {APP_VERSION}
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-50 bg-primary border-b border-primary/20">
        <div className="flex h-14 items-center justify-between px-4">
          {/* Left: Hamburger → Association Logo → Club → Division → Team */}
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <Popover open={isCascadePopoverOpen} onOpenChange={setIsCascadePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="min-w-0 flex-1 justify-start gap-2 px-2 text-primary-foreground hover:bg-primary-foreground/10 lg:hidden"
                >
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate text-left text-sm font-medium">{cascadeSummary}</span>
                  <ChevronDown className="ml-auto h-4 w-4 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(92vw,360px)] space-y-3 bg-background p-3" align="start">
                {isTeamScopedMode && selectedPlayerMembership && (
                  <div className="space-y-2">
                    {playerCanBrowseParentEntities && (
                      <div className="grid grid-cols-1 gap-1">
                        <Button variant="ghost" className="justify-start" onClick={() => navigate(`/associations/${selectedPlayerMembership.associationId}`)}>
                          {selectedPlayerMembership.associationName}
                        </Button>
                        <Button variant="ghost" className="justify-start" onClick={() => navigate(`/clubs/${selectedPlayerMembership.clubId}`)}>
                          {selectedPlayerMembership.clubName}
                        </Button>
                        {selectedPlayerMembership.divisionId && (
                          <Button variant="ghost" className="justify-start" onClick={() => navigate(`/divisions/${selectedPlayerMembership.divisionId}`)}>
                            {selectedDivisionObj?.name || "Division Overview"}
                          </Button>
                        )}
                      </div>
                    )}
                    <Label className="text-xs text-muted-foreground">Team</Label>
                    {voterTeamMemberships.length > 1 ? (
                      <Select value={selectedPlayerMembership.teamId} onValueChange={handleVoterTeamChange}>
                        <SelectTrigger className={cascadePanelSelectTriggerClass}>
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border">
                          {voterTeamMemberships.map((membership) => (
                            <SelectItem
                              key={membership.teamId}
                              value={membership.teamId}
                              onPointerDown={() => {
                                if (membership.teamId === selectedTeamId) {
                                  handleVoterTeamChange(membership.teamId);
                                  setIsCascadePopoverOpen(false);
                                }
                              }}
                            >
                              {teamScopeLabel(membership)}
                              {activeMode === "player" && ` (${membership.membershipType === "PRIMARY" ? "Primary" : membership.membershipType === "FILL_IN" ? "Fill-in" : "Secondary"})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Button className="w-full justify-start" variant="outline" onClick={() => handleVoterTeamChange(selectedPlayerMembership.teamId)}>
                        {teamScopeLabel(selectedPlayerMembership)}
                      </Button>
                    )}
                  </div>
                )}
                {showAssociationSelector && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Association</Label>
                    <Select
                      value={selectedAssociationId || undefined}
                      onValueChange={(v) => {
                        handleAssociationChange(v);
                        setIsCascadePopoverOpen(false);
                      }}
                    >
                      <SelectTrigger className={cascadePanelSelectTriggerClass}>
                        <SelectValue placeholder="Select association" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        {associations.map((assoc) => (
                          <SelectItem key={assoc.id} value={assoc.id}>
                            {assoc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showClubSelector && selectedAssociationId && cascadeClubs.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Club</Label>
                    <Select
                      value={selectedClubId || undefined}
                      onValueChange={(v) => {
                        setSelectedClubId(v);
                        navigate(`/clubs/${v}`);
                      }}
                    >
                      <SelectTrigger className={cascadePanelSelectTriggerClass}>
                        <SelectValue placeholder="Select club" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        {cascadeClubs.map((club) => (
                          <SelectItem key={club.id} value={club.id}>
                            {club.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showClubSelector && selectedClubId && filteredDivisions.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Division</Label>
                    <Select
                      value={selectedDivision || undefined}
                      onValueChange={(v) => {
                        setSelectedDivision(v);
                        navigate("/admin/division");
                      }}
                    >
                      <SelectTrigger className={cascadePanelSelectTriggerClass}>
                        <SelectValue placeholder="Select division" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        {filteredDivisions.map((div) => (
                          <SelectItem key={div.id} value={div.id}>
                            {div.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showClubSelector && selectedClubId && cascadeDivisionId && cascadeTeams.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Team</Label>
                    <Select
                      value={selectedTeamId || undefined}
                      onValueChange={(v) => {
                        setSelectedTeamId(v);
                        setIsCascadePopoverOpen(false);
                        navigate(`/teams/${v}`);
                      }}
                    >
                      <SelectTrigger className={cascadePanelSelectTriggerClass}>
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        {cascadeTeams.map((team) => (
                          <SelectItem
                            key={team.id}
                            value={team.id}
                            onPointerDown={() => {
                              if (team.id === selectedTeamId) {
                                setIsCascadePopoverOpen(false);
                                navigate(`/teams/${team.id}`);
                              }
                            }}
                          >
                            {getTeamDisplayName(team)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <div className="hidden min-w-0 items-center gap-2 lg:flex">
            {/* Association Logo with Popover - only interactive for super_admin */}
            {showAssociationSelector ? (
              <div className="flex items-center gap-1">
                <Popover open={isAssociationPopoverOpen} onOpenChange={setIsAssociationPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="w-10 h-10 shrink-0 rounded-lg overflow-hidden border-2 border-primary-foreground/20 hover:border-primary-foreground/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-foreground/50"
                      title={selectedAssociation?.name || "Select association"}
                    >
                      <Avatar className="w-full h-full rounded-none">
                        <AvatarImage
                          src={selectedAssociation?.logo_url || "/favicon.ico"}
                          alt={selectedAssociation?.name || "SportStack"}
                          className="object-cover"
                        />
                        <AvatarFallback className="rounded-none bg-accent text-accent-foreground text-xs font-semibold">
                          {selectedAssociation ? (selectedAssociation.abbreviation || selectedAssociation.name.substring(0, 2).toUpperCase()) : "SS"}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2 bg-background border-border" align="start">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground px-2 py-1">Select Association</p>
                      <button
                        onClick={() => {
                          setSelectedAssociationId("");
                          setSelectedClubId("");
                          setSelectedDivision("");
                          setSelectedTeamId("");
                          setIsAssociationPopoverOpen(false);
                          navigate(activeMode === "super_admin" || activeMode === "association" || activeMode === "club" ? "/admin" : "/dashboard");
                        }}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors hover:bg-muted text-foreground"
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <LayoutDashboard className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">Dashboard</span>
                      </button>
                      <div className="h-px bg-border my-1" />
                      {associations.map((assoc) => (
                        <button
                          key={assoc.id}
                          onClick={() => handleAssociationChange(assoc.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors",
                            selectedAssociationId === assoc.id
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted text-foreground"
                          )}
                        >
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={assoc.logo_url || undefined} alt={assoc.name} className="object-cover" />
                            <AvatarFallback className="text-xs">
                              {assoc.abbreviation || assoc.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate">{assoc.name}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                {selectedAssociationId && (
                  <Button variant="ghost" size="icon" className={cascadeClearClass} title="Clear association" onClick={() => {
                    setSelectedAssociationId("");
                    setSelectedClubId("");
                    setSelectedDivision("");
                    setSelectedTeamId("");
                    navigate(activeMode === "super_admin" || activeMode === "association" || activeMode === "club" ? "/admin" : "/dashboard");
                  }}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ) : (
              // Static association logo for non-super_admin modes
              <>
                <button
                  type="button"
                  className="w-10 h-10 shrink-0 rounded-lg overflow-hidden border-2 border-primary-foreground/20 disabled:cursor-default"
                  title={(isTeamScopedMode ? playerAssociationName || playerClubName : selectedAssociation?.name) || "SportStack"}
                  disabled={!isTeamScopedMode || !playerCanBrowseParentEntities || !selectedPlayerMembership}
                  onClick={() => selectedPlayerMembership && navigate(`/associations/${selectedPlayerMembership.associationId}`)}
                >
                  <Avatar className="w-full h-full rounded-none">
                    <AvatarImage
                      src={(isTeamScopedMode ? playerLogoUrl : selectedAssociation?.logo_url) || "/favicon.ico"}
                      alt={(isTeamScopedMode ? playerAssociationName || playerClubName : selectedAssociation?.name) || "SportStack"}
                      className="object-cover"
                    />
                    <AvatarFallback className="rounded-none bg-accent text-accent-foreground text-xs font-semibold">
                      {isTeamScopedMode
                        ? playerAssociationAbbr || playerAssociationName.substring(0, 2).toUpperCase() || "SS"
                        : selectedAssociation ? (selectedAssociation.abbreviation || selectedAssociation.name.substring(0, 2).toUpperCase()) : "SS"}
                    </AvatarFallback>
                  </Avatar>
                </button>
                {isTeamScopedMode && playerCanBrowseParentEntities && selectedPlayerMembership && (
                  <button
                    type="button"
                    className={staticCascadeClass}
                    title={`Open ${selectedPlayerMembership.clubName} dashboard`}
                    onClick={() => navigate(`/clubs/${selectedPlayerMembership.clubId}`)}
                  >
                    {selectedPlayerMembership.clubName}
                  </button>
                )}
                {isTeamScopedMode && voterTeamMemberships.length > 1 ? (
                  <div className="flex min-w-0 items-center gap-1">
                    {playerCanBrowseParentEntities && selectedPlayerMembership?.divisionId && (
                      <button
                        type="button"
                        className={staticCascadeClass}
                        title={`Open ${selectedDivisionObj?.name || "division"} dashboard`}
                        onClick={() => navigate(`/divisions/${selectedPlayerMembership.divisionId}`)}
                      >
                        {selectedDivisionObj?.name || "Division"}
                      </button>
                    )}
                    <Select value={selectedTeamId || voterTeamMemberships[0]?.teamId} onValueChange={handleVoterTeamChange}>
                      <SelectTrigger className={cn(cascadeSelectTriggerClass, "w-[190px]")}>
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        {voterTeamMemberships.map((membership) => (
                          <SelectItem
                            key={membership.teamId}
                            value={membership.teamId}
                            onPointerDown={() => {
                              if (membership.teamId === selectedTeamId) {
                                handleVoterTeamChange(membership.teamId);
                              }
                            }}
                          >
                            {teamScopeLabel(membership)}
                            {activeMode === "player" && ` (${membership.membershipType === "PRIMARY" ? "Primary" : membership.membershipType === "FILL_IN" ? "Fill-in" : "Secondary"})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <>
                    {isTeamScopedMode && playerCanBrowseParentEntities && selectedDivisionObj && (
                      <button
                        type="button"
                        className={staticCascadeClass}
                        title={`Open ${selectedDivisionObj.name} dashboard`}
                        onClick={() => navigate(`/divisions/${selectedDivisionObj.id}`)}
                      >
                        {selectedDivisionObj.name}
                      </button>
                    )}
                    {isTeamScopedMode && selectedPlayerMembership && (
                      <button
                        type="button"
                        className={staticCascadeClass}
                        title={`Open ${selectedPlayerMembership.teamName} overview`}
                        onClick={() => navigate(`/teams/${selectedPlayerMembership.teamId}`)}
                      >
                        {selectedTeam ? getTeamDisplayName(selectedTeam) : playerTeamName}
                      </button>
                    )}
                  </>
                )}
              </>
            )}

            {/* Club Selector */}
            {showClubSelector && selectedAssociationId && cascadeClubs.length > 0 && (
              <div className="flex items-center gap-1">
                {cascadeClubs.length === 1 ? (
                  <button type="button" className={staticCascadeClass} title={`Open ${selectedClub?.name || cascadeClubs[0].name} overview`} onClick={() => navigate(`/clubs/${selectedClub?.id || cascadeClubs[0].id}`)}>
                    {selectedClub?.name || cascadeClubs[0].name}
                  </button>
                ) : (
                  <Select key={selectedAssociationId} value={selectedClubId || undefined} onValueChange={(v) => {
                    setSelectedClubId(v);
                    navigate(`/clubs/${v}`);
                  }}>
                    <SelectTrigger className={cn(cascadeSelectTriggerClass, "w-[170px] lg:w-[230px]")}>
                      <SelectValue placeholder="Select Club" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border">
                      {cascadeClubs.map((club) => (
                        <SelectItem key={club.id} value={club.id}>
                          {club.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedClubId && cascadeClubs.length > 1 && (
                  <Button variant="ghost" size="icon" className={cascadeClearClass} title="Clear club" onClick={() => {
                    setSelectedClubId("");
                    setSelectedDivision("");
                    setSelectedTeamId("");
                    navigate(selectedAssociationId ? `/associations/${selectedAssociationId}` : "/admin");
                  }}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}

            {/* Division Selector */}
            {showClubSelector && selectedClubId && filteredDivisions.length > 0 && (
              <div className="flex items-center gap-1">
                {filteredDivisions.length === 1 && selectedDivision ? (
                  <button type="button" className={staticCascadeClass} title={`Open ${selectedDivisionObj?.name || filteredDivisions[0].name} overview`} onClick={() => navigate(`/divisions/${selectedDivisionObj?.id || filteredDivisions[0].id}`)}>
                    {selectedDivisionObj?.name || filteredDivisions[0].name}
                  </button>
                ) : (
                  <Select key={selectedClubId} value={selectedDivision || undefined} onValueChange={(v) => {
                    setSelectedDivision(v);
                    navigate("/admin/division");
                  }}>
                    <SelectTrigger className={cn(cascadeSelectTriggerClass, "w-[150px] lg:w-[210px]")}>
                      <SelectValue placeholder="Division" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border">
                      {filteredDivisions.map((div) => (
                        <SelectItem key={div.id} value={div.id}>
                          {div.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedDivision && filteredDivisions.length > 1 && (
                  <Button variant="ghost" size="icon" className={cascadeClearClass} title="Clear division" onClick={() => {
                    setSelectedDivision("");
                    setSelectedTeamId("");
                    navigate(selectedClubId ? `/clubs/${selectedClubId}` : "/admin");
                  }}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}

            {/* Team Selector */}
            {showClubSelector && selectedClubId && cascadeDivisionId && cascadeTeams.length > 0 && (
              <div className="flex items-center gap-1">
                {cascadeTeams.length === 1 && selectedTeamId ? (
                  <button type="button" className={staticCascadeClass} title={`Open ${getTeamDisplayName(selectedTeam || cascadeTeams[0])} overview`} onClick={() => navigate(`/teams/${selectedTeam?.id || cascadeTeams[0].id}`)}>
                    {getTeamDisplayName(selectedTeam || cascadeTeams[0])}
                  </button>
                ) : (
                  <Select key={selectedClubId + cascadeDivisionId} value={selectedTeamId || undefined} onValueChange={(v) => {
                    setSelectedTeamId(v);
                    navigate(`/teams/${v}`);
                  }}>
                    <SelectTrigger className={cn(cascadeSelectTriggerClass, "w-[150px] lg:w-[210px]")}>
                      <SelectValue placeholder="Select Team" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border">
                      {cascadeTeams.map((team) => (
                        <SelectItem
                          key={team.id}
                          value={team.id}
                          onPointerDown={() => {
                            if (team.id === selectedTeamId) navigate(`/teams/${team.id}`);
                          }}
                        >
                          {getTeamDisplayName(team)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedTeamId && cascadeTeams.length > 1 && (
                  <Button variant="ghost" size="icon" className={cascadeClearClass} title="Clear team" onClick={() => {
                    setSelectedTeamId("");
                    navigate(selectedDivision ? "/admin/division" : selectedClubId ? `/clubs/${selectedClubId}` : "/dashboard");
                  }}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
            </div>
          </div>

          {/* Right: Notifications & User Avatar */}
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1">
              <Badge variant="outline" className={cn("px-1.5 py-0.5 text-[10px] font-semibold", APP_ENVIRONMENT_CLASS[APP_ENVIRONMENT])}>
                {APP_ENVIRONMENT}
              </Badge>
              <span className="inline-flex rounded-md border border-primary-foreground/20 px-1.5 py-1 text-[10px] font-medium text-primary-foreground/75 sm:px-2 sm:text-xs">
                {APP_VERSION}
              </span>
            </div>

            {showAdminDropdown && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    Admin
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {visibleAdminDropdownSections.map((section, sectionIndex) => (
                    <div key={section.heading}>
                      {sectionIndex > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel>{section.heading}</DropdownMenuLabel>
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <DropdownMenuItem key={item.path} asChild>
                            <Link to={item.path} className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary-foreground hover:bg-primary-foreground/10 relative"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 bg-background border-border" align="end">
                <div className="p-3 border-b border-border">
                  <h4 className="font-semibold text-foreground">Notifications</h4>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No notifications</p>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        type="button"
                        key={notification.id}
                        onClick={() => void handleNotificationClick(notification)}
                        className={cn(
                          "w-full p-3 border-b border-border last:border-0 text-left hover:bg-muted/50 cursor-pointer",
                          !notification.read && "bg-muted/30"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-lg">🔔</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{notification.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {notification.message || notification.body || "Open to view details."}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(notification.created_at).toLocaleDateString("en-AU", {
                                day: "numeric",
                                month: "short",
                              })}
                            </p>
                          </div>
                          {!notification.read && (
                            <Badge className="bg-primary text-primary-foreground text-xs">New</Badge>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Link to="/profile">
              <Avatar className="w-9 h-9 border-2 border-primary-foreground/20 hover:border-primary-foreground/50 transition-colors cursor-pointer">
                <AvatarImage src={userAvatarUrl || undefined} alt="Profile" />
                <AvatarFallback className="bg-accent text-accent-foreground text-sm font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-56 sticky top-14 h-[calc(100vh-3.5rem)] min-h-0 overflow-hidden bg-accent border-r border-border">
          {renderSidebar(false)}
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <aside className="absolute left-0 top-14 bottom-0 w-64 min-h-0 bg-accent animate-slide-in-right flex flex-col overflow-hidden">
              {renderSidebar(true)}
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="min-w-0 flex-1 min-h-[calc(100vh-3.5rem)] p-4 lg:p-6 bg-muted/30">
          <RouteErrorBoundary resetKey={`${location.pathname}${location.search}`}>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>

      <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Tell us what is not working or what would make SportStack easier to use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="feedback-message">Feedback</Label>
            <Textarea
              id="feedback-message"
              value={feedbackMessage}
              onChange={(event) => setFeedbackMessage(event.target.value)}
              placeholder="Type your feedback here"
              className="min-h-32 resize-none"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">{feedbackMessage.length}/1000</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="feedback-screenshot" className="flex items-center gap-2">
              <ImagePlus className="h-4 w-4" />
              Photos optional
            </Label>
            <input
              id="feedback-screenshot"
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              multiple
              className="block w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground file:border-0 file:bg-transparent file:text-primary"
              onChange={(event) => setFeedbackScreenshots(Array.from(event.target.files || []))}
              disabled={isFeedbackSubmitting}
            />
            {feedbackScreenshots.length > 0 && (
              <div className="space-y-2">
                {feedbackScreenshots.map((screenshot) => (
                  <div key={`${screenshot.name}-${screenshot.lastModified}`} className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{screenshot.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setFeedbackScreenshots((current) =>
                          current.filter((item) => item.name !== screenshot.name || item.lastModified !== screenshot.lastModified)
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">PNG, JPG, or WebP. Maximum 5MB each.</p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setIsFeedbackOpen(false)}
              disabled={isFeedbackSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleFeedbackSubmit}
              disabled={!feedbackMessage.trim() || isFeedbackSubmitting}
            >
              {isFeedbackSubmitting ? "Sending..." : "Send feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
};

export default AppLayout;

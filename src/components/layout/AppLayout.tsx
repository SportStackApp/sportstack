import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
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
import { APP_VERSION } from "@/lib/appVersion";

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
    heading: "Core Admin",
    items: [
      { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { path: "/admin/associations", label: "Associations", icon: Globe },
      { path: "/admin/clubs", label: "Clubs", icon: Building2 },
      { path: "/admin/divisions", label: "Divisions", icon: Layers },
      { path: "/admin/users", label: "Users", icon: UserCog },
      { path: "/admin/teams", label: "Teams", icon: Shield },
      { path: "/admin/requests", label: "Requests", icon: ClipboardList },
      { path: "/admin/fixtures", label: "Fixtures", icon: Calendar },
      { path: "/admin/venues", label: "Venues", icon: MapPin },
      { path: "/admin/roles-permissions", label: "Roles & permissions", icon: Shield },
    ],
  },
  {
    heading: "Data Quality",
    items: [
      { path: "/admin/revsports-mappings", label: "RevSports Mappings", icon: GitMerge },
      { path: "/admin/revsports-entities", label: "RevSports Review", icon: GitMerge },
      { path: "/admin/revsports-unmatched", label: "Unmatched RevSports", icon: AlertTriangle },
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
      { path: "/admin/mvp-voting", label: "Voting Sessions", icon: Trophy },
      { path: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
];

const NAV_SETS: Record<AppMode, NavSection[]> = {
  super_admin: [
    {
      heading: "Core",
      items: [
        { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { path: "/admin/fixtures", label: "Fixtures", icon: Calendar },
        { path: "/chat", label: "Chat", icon: MessageCircle },
      ],
    },
    {
      heading: "MVP Voting",
      items: [
        { path: "/admin/mvp-voting", label: "Voting Sessions", icon: Trophy },
        { path: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      ],
    },
    {
      heading: "Coaching",
      items: [
        { path: "/coaching", label: "Squad", icon: ClipboardCheck },
        { path: "/coaching/formations", label: "Formations", icon: LayoutGrid },
        { path: "/roster", label: "Roster", icon: Users },
      ],
    },
    {
      heading: "Umpiring",
      items: [
        { path: "/umpire/vote", label: "Vote Submission", icon: ClipboardList },
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
      ],
    },
  ],
  association: [
    {
      heading: "Core",
      items: [
        { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { path: "/admin/fixtures", label: "Fixtures", icon: Calendar },
      ],
    },
    {
      heading: "MVP Voting",
      items: [
        { path: "/admin/mvp-voting", label: "Voting Sessions", icon: Trophy },
        { path: "/admin/analytics", label: "Analytics", icon: BarChart3 },
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
      ],
    },
  ],
  club: [
    {
      heading: "Core",
      items: [
        { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { path: "/admin/fixtures", label: "Fixtures", icon: Calendar },
      ],
    },
    {
      heading: "Admin",
      items: [
        { path: "/admin/teams", label: "Teams", icon: Shield },
        { path: "/admin/divisions", label: "Divisions", icon: LayoutGrid },
        { path: "/admin/users", label: "Users", icon: UserCog },
        { path: "/admin/requests", label: "Requests", icon: ClipboardList },
      ],
    },
  ],
  team: [
    {
      heading: "Core",
      items: [
        { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { path: "/mvp-votes", label: "MVP Votes", icon: Vote },
        { path: "/games", label: "Fixtures", icon: Calendar },
        { path: "/chat", label: "Chat", icon: MessageCircle },
      ],
    },
    {
      heading: "Coaching",
      items: [
        { path: "/roster", label: "Roster", icon: Users },
        { path: "/coaching", label: "Coaching", icon: ClipboardCheck },
        { path: "/coaching/formations", label: "Formations", icon: LayoutGrid },
      ],
    },
  ],
  player: [
    {
      heading: "Core",
      items: [
        { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { path: "/mvp-votes", label: "MVP Votes", icon: Vote },
        { path: "/games", label: "Fixtures", icon: Calendar },
        { path: "/roster", label: "Statistics", icon: BarChart3 },
        { path: "/chat", label: "Chat", icon: MessageCircle },
      ],
    },
    {
      heading: "Coaching",
      items: [
        { path: "/coaching", label: "Coaching", icon: ClipboardCheck },
        { path: "/coaching/formations", label: "Formations", icon: LayoutGrid },
      ],
    },
  ],
};

const MOBILE_NAV: Record<AppMode, NavItem[]> = {
  super_admin: NAV_SETS.super_admin[0].items.slice(0, 4),
  association: NAV_SETS.association[0].items.slice(0, 4),
  club: NAV_SETS.club[0].items.slice(0, 4),
  team: NAV_SETS.team[0].items.slice(0, 4),
  player: NAV_SETS.player[0].items.slice(0, 4),
};

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface VoterTeamMembership {
  teamId: string;
  teamName: string;
  membershipType: "PRIMARY" | "SECONDARY";
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
  clubs: VoterClubRow | VoterClubRow[] | null;
}

interface VoterMembershipRow {
  membership_type: "PRIMARY" | "SECONDARY";
  teams: VoterTeamRow | VoterTeamRow[] | null;
}

interface FeedbackInsert {
  user_id: string;
  message: string;
  page_path: string;
  user_agent: string;
  screenshot_path?: string | null;
}

interface FeedbackClient {
  from: (table: "app_feedback") => {
    insert: (payload: FeedbackInsert) => Promise<{ error: { message?: string } | null }>;
  };
}

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { mode, setMode, availableModes, canSwitchMode, modeLabel, roles, viewingAs, setViewingAs, isViewingAsOverridden, setIsViewingAsOverridden } = useAppMode();
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

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAssociationPopoverOpen, setIsAssociationPopoverOpen] = useState(false);
  const [isModeSwitcherOpen, setIsModeSwitcherOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState("U");
  const [playerAssociationName, setPlayerAssociationName] = useState("");
  const [playerAssociationAbbr, setPlayerAssociationAbbr] = useState("");
  const [playerClubName, setPlayerClubName] = useState("");
  const [playerTeamName, setPlayerTeamName] = useState("");
  const [playerLogoUrl, setPlayerLogoUrl] = useState<string | null>(null);
  const [voterTeamMemberships, setVoterTeamMemberships] = useState<VoterTeamMembership[]>([]);
  const [isVoter, setIsVoter] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackScreenshot, setFeedbackScreenshot] = useState<File | null>(null);
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);

  const isVoterOnly = roles.length === 1 && roles[0] === "VOTER";
  const isBrandNewUser = roles.length === 0;


  // Fetch notifications from DB
  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setNotifications(data || []);
    };
    fetchNotifications();
  }, [user]);

  // Fetch pending request count for admin badge
  useEffect(() => {
    if (!user) return;
    const isAdmin = mode === "super_admin" || mode === "association" || mode === "club";
    if (!isAdmin) { setPendingRequestCount(0); return; }
    const fetchCount = async () => {
      const [membershipRequests, primaryRequests] = await Promise.all([
        (supabase as any)
          .from("requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "PENDING"),
        supabase
          .from("primary_change_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "PENDING"),
      ]);
      setPendingRequestCount((membershipRequests.count || 0) + (primaryRequests.count || 0));
    };
    fetchCount();
  }, [user, mode]);

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

  // Fetch player header context from active primary/secondary team memberships.
  useEffect(() => {
    const clearPlayerHeaderContext = () => {
      setPlayerAssociationName("");
      setPlayerAssociationAbbr("");
      setPlayerClubName("");
      setPlayerTeamName("");
      setPlayerLogoUrl(null);
      setVoterTeamMemberships([]);
    };

    if (mode !== "player" || !user) {
      clearPlayerHeaderContext();
      return;
    }

    const fetchPlayerHeaderContext = async () => {
      const { data } = await supabase
        .from("team_memberships")
        .select("team_id, membership_type, teams(id, name, clubs(id, name, logo_url, associations(id, name, abbreviation, logo_url)))")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE")
        .in("membership_type", ["PRIMARY", "SECONDARY"]);

      const memberships = ((data || []) as unknown as VoterMembershipRow[])
        .map((row) => {
          const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
          const club = Array.isArray(team?.clubs) ? team.clubs[0] : team?.clubs;
          const association = Array.isArray(club?.associations) ? club.associations[0] : club?.associations;

          if (!team?.id || !club?.id || !association?.id) return null;

          return {
            teamId: team.id,
            teamName: team.name || "Team",
            membershipType: row.membership_type,
            clubId: club.id,
            clubName: club.name || "Club",
            clubLogoUrl: club.logo_url || null,
            associationId: association.id,
            associationName: association.name || "Association",
            associationAbbr: association.abbreviation || null,
            associationLogoUrl: association.logo_url || null,
          } satisfies VoterTeamMembership;
        })
        .filter((membership): membership is VoterTeamMembership => Boolean(membership))
        .sort((a, b) => (a.membershipType === "PRIMARY" ? -1 : 1));

      setVoterTeamMemberships(memberships);

      const currentMembership =
        memberships.find((membership) => membership.teamId === selectedTeamId) ||
        memberships[0];

      if (!currentMembership) {
        clearPlayerHeaderContext();
        return;
      }

      setPlayerAssociationName(currentMembership.associationName);
      setPlayerAssociationAbbr(currentMembership.associationAbbr || "");
      setPlayerClubName(currentMembership.clubName);
      setPlayerTeamName(selectedTeamId === currentMembership.teamId ? currentMembership.teamName : "");
      setPlayerLogoUrl(currentMembership.associationLogoUrl || currentMembership.clubLogoUrl);

      if (isVoterOnly && selectedTeamId !== currentMembership.teamId) {
        setSelectedAssociationId(currentMembership.associationId);
        setSelectedClubId(currentMembership.clubId);
        setSelectedDivision("");
        setSelectedTeamId(currentMembership.teamId);
      }
    };

    fetchPlayerHeaderContext();
  }, [
    mode,
    user,
    selectedTeamId,
    isVoterOnly,
    setSelectedAssociationId,
    setSelectedClubId,
    setSelectedDivision,
    setSelectedTeamId,
  ]);

  // Fetch VOTER role status
  useEffect(() => {
    if (!user) {
      setIsVoter(false);
      return;
    }
    const checkVoterRole = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "VOTER")
        .maybeSingle();
      setIsVoter(!!data);
    };
    checkVoterRole();
  }, [user]);

  // Auto-switch viewingAs based on cascade selection (only if not manually overridden)
  useEffect(() => {
    if (mode !== "super_admin") return;
    if (isViewingAsOverridden) return;

    if (selectedTeamId) {
      setViewingAs("team");
    } else if (selectedClubId) {
      setViewingAs("club");
    } else if (selectedAssociationId) {
      setViewingAs("association");
    } else {
      setViewingAs("super_admin");
    }
  }, [selectedAssociationId, selectedClubId, selectedTeamId, isViewingAsOverridden, mode, setViewingAs]);

  const handleAssociationChange = (associationId: string) => {
    setSelectedAssociationId(associationId);
    setIsAssociationPopoverOpen(false);
    navigate(`/associations/${associationId}`);
  };

  const baseSections = NAV_SETS[mode === "super_admin" ? viewingAs : mode];
  // Show selectors based on mode
  const showAssociationSelector = mode === "super_admin";
  const showClubSelector = mode === "super_admin" || mode === "association" || mode === "club";
  const showAdminDropdown = mode === "super_admin" || mode === "association" || mode === "club";

  const visibleSections = baseSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (isVoterOnly && !["/dashboard", "/mvp-votes"].includes(item.path)) return false;
      if (isBrandNewUser && item.path !== "/dashboard") return false;
      if (selectedAssociationId && item.path === "/admin/associations") return false;
      if (selectedClubId && item.path === "/admin/clubs") return false;
      if (selectedTeamId && item.path === "/admin/teams") return false;
      if (item.path === "/mvp-votes" && !isVoter) return false;
      if (showAdminDropdown && section.heading === "Admin") return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);
  const mobileNavItems = isBrandNewUser ? MOBILE_NAV.player.filter((item) => item.path === "/dashboard") : MOBILE_NAV[mode];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const visibleAdminDropdownSections = ADMIN_DROPDOWN_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!showAdminDropdown) return false;
      if (item.path === "/admin/error-logs" && mode !== "super_admin") return false;
      if (item.path === "/admin/roles-permissions" && mode !== "super_admin") return false;
      if (item.path === "/admin/feedback" && mode === "club") return false;
      if (section.heading === "Data Quality" && mode !== "super_admin") return false;
      if (section.heading === "Voting" && mode === "club") return false;
      return true;
    }),
  })).filter((section) => section.items.length > 0);

  const selectedDivisionObj = filteredDivisions.find((division) => division.id === selectedDivision);
  const cascadeDivisionId =
    selectedDivision || (filteredDivisions.length === 1 ? filteredDivisions[0].id : "");
  const cascadeTeams = selectedClubId && cascadeDivisionId
    ? teams.filter((team) => {
        if (team.club_id !== selectedClubId) return false;
        const teamDivisionId = (team as { division_id?: string | null }).division_id;
        return teamDivisionId === cascadeDivisionId || teamDivisions.some((item) => item.team_id === team.id && item.division_id === cascadeDivisionId);
      })
    : filteredTeams;
  const selectedTeamDivisionId =
    (selectedTeam as { division_id?: string | null } | undefined)?.division_id ||
    teamDivisions.find((teamDivision) => teamDivision.team_id === selectedTeamId)?.division_id ||
    "";
  const staticCascadeClass =
    "flex h-10 min-w-0 max-w-[190px] items-center rounded-md bg-primary-foreground/10 px-3 text-sm font-medium text-primary-foreground truncate lg:max-w-[260px]";
  const cascadeSelectTriggerClass =
    "h-10 min-w-0 max-w-[190px] bg-primary-foreground/10 text-primary-foreground border-primary-foreground/15 font-medium data-[placeholder]:text-primary-foreground/70 lg:max-w-[260px]";
  const cascadeClearClass =
    "h-7 w-7 shrink-0 rounded-full text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10";

  useEffect(() => {
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
      const club = clubs.find((item) => item.id === clubId);
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
    setSelectedTeamId,
  ]);

  useEffect(() => {
    if (selectedTeamId && selectedTeamDivisionId && selectedDivision !== selectedTeamDivisionId) {
      setSelectedDivision(selectedTeamDivisionId);
    }
  }, [selectedDivision, selectedTeamDivisionId, selectedTeamId, setSelectedDivision]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleModeSwitch = (newMode: AppMode) => {
    setMode(newMode);
    setIsModeSwitcherOpen(false);
    const landing = newMode === "super_admin" || newMode === "association" || newMode === "club" ? "/admin" : "/dashboard";
    navigate(landing);
  };

  const handleVoterTeamChange = (teamId: string) => {
    const membership = voterTeamMemberships.find((item) => item.teamId === teamId);
    if (!membership) return;

    setSelectedAssociationId(membership.associationId);
    setSelectedClubId(membership.clubId);
    setSelectedDivision("");
    setSelectedTeamId(membership.teamId);
    navigate("/dashboard");
  };

  const handleFeedbackSubmit = async () => {
    if (!user || !feedbackMessage.trim() || isFeedbackSubmitting) return;

    setIsFeedbackSubmitting(true);
    let screenshotPath: string | null = null;

    if (feedbackScreenshot) {
      const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
      if (!allowedTypes.includes(feedbackScreenshot.type)) {
        toast({
          title: "Screenshot not attached",
          description: "Please use a PNG, JPG, or WebP screenshot.",
          variant: "destructive",
        });
        setIsFeedbackSubmitting(false);
        return;
      }

      if (feedbackScreenshot.size > 5 * 1024 * 1024) {
        toast({
          title: "Screenshot too large",
          description: "Screenshots must be under 5MB.",
          variant: "destructive",
        });
        setIsFeedbackSubmitting(false);
        return;
      }

      const extension = feedbackScreenshot.name.split(".").pop() || "png";
      screenshotPath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("feedback-screenshots")
        .upload(screenshotPath, feedbackScreenshot, {
          contentType: feedbackScreenshot.type,
          upsert: false,
        });

      if (uploadError) {
        toast({
          title: "Screenshot not uploaded",
          description: uploadError.message || "Please try again.",
          variant: "destructive",
        });
        setIsFeedbackSubmitting(false);
        return;
      }
    }

    const feedbackClient = supabase as unknown as FeedbackClient;
    const { error } = await feedbackClient.from("app_feedback").insert({
      user_id: user.id,
      message: feedbackMessage.trim(),
      page_path: location.pathname,
      user_agent: navigator.userAgent,
      screenshot_path: screenshotPath,
    });

    setIsFeedbackSubmitting(false);

    if (error) {
      toast({
        title: "Feedback not sent",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      return;
    }

    setFeedbackMessage("");
    setFeedbackScreenshot(null);
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
          <p className="text-xs font-medium text-muted-foreground mb-1 px-1">Viewing as</p>
          <select
            value={viewingAs}
            onChange={(e) => {
              const selected = e.target.value as AppMode;
              if (selected === "super_admin") {
                setIsViewingAsOverridden(false);
                setViewingAs("super_admin");
              } else {
                setViewingAs(selected);
              }
            }}
            className="w-full rounded-md border border-border bg-background text-foreground text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="super_admin">⭐ Super Admin</option>
            {selectedAssociationId && <option value="association">Association Admin</option>}
            {selectedClubId && <option value="club">Club Admin</option>}
            {selectedTeamId && <option value="team">Team Manager</option>}
            {selectedTeamId && <option value="player">Player</option>}
          </select>
        </div>
      )}
      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-2">
        {visibleSections.map((section) => (
          <div key={section.heading} className="mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-2">
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
                        ? "bg-secondary text-secondary-foreground border-secondary"
                        : "text-accent-foreground hover:bg-accent-foreground/10 border-transparent"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                    {isRequestsItem && pendingRequestCount > 0 && (
                      <Badge className="ml-auto h-5 min-w-[20px] px-1.5 text-xs bg-destructive text-destructive-foreground">
                        {pendingRequestCount}
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
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg text-sm font-medium text-accent-foreground hover:bg-accent-foreground/10 transition-all border border-border"
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
                    onClick={() => handleModeSwitch(m)}
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
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-accent-foreground hover:bg-accent-foreground/10 transition-all"
        >
          <MessageSquare className="h-5 w-5" />
          Send feedback
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-accent-foreground hover:bg-accent-foreground/10 transition-all"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>

        <div className="px-4 pt-2 text-xs text-accent-foreground/60">
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
                          navigate(mode === "super_admin" || mode === "association" || mode === "club" ? "/admin" : "/dashboard");
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
                    navigate(mode === "super_admin" || mode === "association" || mode === "club" ? "/admin" : "/dashboard");
                  }}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ) : (
              // Static association logo for non-super_admin modes
              <>
                <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden border-2 border-primary-foreground/20" title={(mode === "player" ? playerAssociationName || playerClubName : selectedAssociation?.name) || "SportStack"}>
                  <Avatar className="w-full h-full rounded-none">
                    <AvatarImage
                      src={(mode === "player" ? playerLogoUrl : selectedAssociation?.logo_url) || "/favicon.ico"}
                      alt={(mode === "player" ? playerAssociationName || playerClubName : selectedAssociation?.name) || "SportStack"}
                      className="object-cover"
                    />
                    <AvatarFallback className="rounded-none bg-accent text-accent-foreground text-xs font-semibold">
                      {mode === "player"
                        ? playerAssociationAbbr || playerAssociationName.substring(0, 2).toUpperCase() || "SS"
                        : selectedAssociation ? (selectedAssociation.abbreviation || selectedAssociation.name.substring(0, 2).toUpperCase()) : "SS"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {mode === "player" && isVoterOnly && voterTeamMemberships.length > 1 ? (
                  <Select value={selectedTeamId || voterTeamMemberships[0]?.teamId} onValueChange={handleVoterTeamChange}>
                    <SelectTrigger className={cn(cascadeSelectTriggerClass, "w-[190px]")}>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border">
                      {voterTeamMemberships.map((membership) => (
                        <SelectItem key={membership.teamId} value={membership.teamId}>
                          {membership.teamName} ({membership.membershipType === "PRIMARY" ? "Primary" : "Secondary"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    {mode === "player" && (selectedClub || playerClubName) && (
                      <div className={staticCascadeClass} title={selectedClub?.name || playerClubName}>
                        {selectedClub?.name || playerClubName}
                      </div>
                    )}
                    {mode === "player" && selectedDivisionObj && (
                      <div className={staticCascadeClass} title={selectedDivisionObj.name}>
                        {selectedDivisionObj.name}
                      </div>
                    )}
                    {mode === "player" && (selectedTeam || (!selectedClubId && playerTeamName)) && (
                      <div className={staticCascadeClass} title={selectedTeam ? getTeamDisplayName(selectedTeam) : playerTeamName}>
                        {selectedTeam ? getTeamDisplayName(selectedTeam) : playerTeamName}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Club Selector */}
            {showClubSelector && selectedAssociationId && filteredClubs.length > 0 && (
              <div className="flex items-center gap-1">
                {filteredClubs.length === 1 ? (
                  <div className={staticCascadeClass} title={selectedClub?.name || filteredClubs[0].name}>
                    {selectedClub?.name || filteredClubs[0].name}
                  </div>
                ) : (
                  <Select key={selectedAssociationId} value={selectedClubId || undefined} onValueChange={(v) => {
                    setSelectedClubId(v);
                    navigate(`/clubs/${v}`);
                  }}>
                    <SelectTrigger className={cn(cascadeSelectTriggerClass, "w-[170px] lg:w-[230px]")}>
                      <SelectValue placeholder="Select Club" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border">
                      {filteredClubs.map((club) => (
                        <SelectItem key={club.id} value={club.id}>
                          {club.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedClubId && filteredClubs.length > 1 && (
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
                {filteredDivisions.length === 1 ? (
                  <div className={staticCascadeClass} title={selectedDivisionObj?.name || filteredDivisions[0].name}>
                    {selectedDivisionObj?.name || filteredDivisions[0].name}
                  </div>
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
                {cascadeTeams.length === 1 ? (
                  <div className={staticCascadeClass} title={getTeamDisplayName(selectedTeam || cascadeTeams[0])}>
                    {getTeamDisplayName(selectedTeam || cascadeTeams[0])}
                  </div>
                ) : (
                  <Select key={selectedClubId + cascadeDivisionId} value={selectedTeamId || undefined} onValueChange={(v) => {
                    if (!selectedDivision && cascadeDivisionId) setSelectedDivision(cascadeDivisionId);
                    setSelectedTeamId(v);
                    navigate(`/teams/${v}`);
                  }}>
                    <SelectTrigger className={cn(cascadeSelectTriggerClass, "w-[150px] lg:w-[210px]")}>
                      <SelectValue placeholder="Select Team" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border">
                      {cascadeTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
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

          {/* Right: Notifications & User Avatar */}
          <div className="flex items-center gap-1">
            <span className="hidden sm:inline-flex rounded-md border border-primary-foreground/20 px-2 py-1 text-xs font-medium text-primary-foreground/75">
              {APP_VERSION}
            </span>

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
                      <div
                        key={notification.id}
                        className={cn(
                          "p-3 border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer",
                          !notification.read && "bg-muted/30"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-lg">🔔</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{notification.title}</p>
                            <p className="text-sm text-muted-foreground">{notification.message}</p>
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
                      </div>
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
        <main className="flex-1 min-h-[calc(100vh-3.5rem)] p-4 lg:p-6 bg-muted/30">
          <Outlet />
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
              Screenshot optional
            </Label>
            <input
              id="feedback-screenshot"
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              className="block w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground file:border-0 file:bg-transparent file:text-primary"
              onChange={(event) => setFeedbackScreenshot(event.target.files?.[0] || null)}
              disabled={isFeedbackSubmitting}
            />
            {feedbackScreenshot && (
              <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{feedbackScreenshot.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setFeedbackScreenshot(null)}>
                  Remove
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">PNG, JPG, or WebP. Maximum 5MB.</p>
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

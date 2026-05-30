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
  ClipboardList,
  Users,
  UserCog,
  Settings,
  Building2,
  Shield,
  Globe,
  ChevronDown,
  MapPin,
  LayoutGrid,
  GitMerge,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTeamContext } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAppMode, MODE_LABELS, type AppMode } from "@/contexts/AppModeContext";
import { supabase } from "@/integrations/supabase/client";

// Nav items per mode
const NAV_SETS: Record<AppMode, { path: string; label: string; icon: typeof LayoutDashboard }[]> = {
  super_admin: [
    { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { path: "/admin/associations", label: "Associations", icon: Globe },
    { path: "/admin/clubs", label: "Clubs", icon: Building2 },
    { path: "/admin/teams", label: "Teams", icon: Shield },
    { path: "/admin/divisions", label: "Divisions", icon: LayoutGrid },
    { path: "/admin/revsports-mappings", label: "RevSports Mappings", icon: GitMerge },
    { path: "/admin/fixtures", label: "Fixtures", icon: Calendar },
    { path: "/admin/venues", label: "Venues", icon: MapPin },
    { path: "/admin/users", label: "Users", icon: UserCog },
    { path: "/admin/requests", label: "Requests", icon: ClipboardList },
  ],
  association: [
    { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { path: "/admin/clubs", label: "Clubs", icon: Building2 },
    { path: "/admin/teams", label: "Teams", icon: Shield },
    { path: "/admin/divisions", label: "Divisions", icon: LayoutGrid },
    { path: "/admin/fixtures", label: "Fixtures", icon: Calendar },
    { path: "/admin/venues", label: "Venues", icon: MapPin },
    { path: "/admin/users", label: "Users", icon: UserCog },
    { path: "/admin/requests", label: "Requests", icon: ClipboardList },
  ],
  club: [
    { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { path: "/admin/teams", label: "Teams", icon: Shield },
    { path: "/admin/divisions", label: "Divisions", icon: LayoutGrid },
    { path: "/admin/fixtures", label: "Fixtures", icon: Calendar },
    { path: "/admin/users", label: "Users", icon: UserCog },
    { path: "/admin/requests", label: "Requests", icon: ClipboardList },
  ],
  team: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/games", label: "Fixtures", icon: Calendar },
    { path: "/roster", label: "Roster", icon: Users },
    { path: "/chat", label: "Chat", icon: MessageCircle },
  ],
  player: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/games", label: "Fixtures", icon: Calendar },
    { path: "/roster", label: "Statistics", icon: BarChart3 },
    { path: "/chat", label: "Chat", icon: MessageCircle },
  ],
};

// Bottom nav for mobile per mode
const MOBILE_NAV: Record<AppMode, { path: string; label: string; icon: typeof LayoutDashboard }[]> = {
  super_admin: NAV_SETS.super_admin.slice(0, 4),
  association: NAV_SETS.association.slice(0, 4),
  club: NAV_SETS.club.slice(0, 4),
  team: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/games", label: "Fixtures", icon: Calendar },
    { path: "/roster", label: "Roster", icon: Users },
    { path: "/chat", label: "Chat", icon: MessageCircle },
  ],
  player: [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/games", label: "Fixtures", icon: Calendar },
    { path: "/roster", label: "Stats", icon: BarChart3 },
    { path: "/chat", label: "Chat", icon: MessageCircle },
  ],
};

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mode, setMode, availableModes, canSwitchMode, modeLabel } = useAppMode();
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
    filteredClubs,
    filteredTeams,
    filteredDivisions,
    selectedAssociation,
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
      const { count } = await supabase
        .from("primary_change_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING");
      setPendingRequestCount(count || 0);
    };
    fetchCount();
  }, [user]);

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

  // Fetch player header context from the player's primary team membership
  useEffect(() => {
    const clearPlayerHeaderContext = () => {
      setPlayerAssociationName("");
      setPlayerAssociationAbbr("");
      setPlayerClubName("");
      setPlayerTeamName("");
    };

    if (mode !== "player" || !user) {
      clearPlayerHeaderContext();
      return;
    }

    const fetchPlayerHeaderContext = async () => {
      const { data } = await supabase
        .from("team_memberships")
        .select("teams(name, clubs(name, associations(name, abbreviation)))")
        .eq("user_id", user.id)
        .eq("membership_type", "PRIMARY")
        .eq("status", "APPROVED")
        .maybeSingle();

      const team = Array.isArray(data?.teams) ? data?.teams[0] : data?.teams;
      const club = Array.isArray(team?.clubs) ? team?.clubs[0] : team?.clubs;
      const association = Array.isArray(club?.associations) ? club?.associations[0] : club?.associations;

      setPlayerAssociationName(association?.name || "");
      setPlayerAssociationAbbr(association?.abbreviation || "");
      setPlayerClubName(club?.name || "");
      setPlayerTeamName(team?.name || "");
    };

    fetchPlayerHeaderContext();
  }, [mode, user]);

  const handleAssociationChange = (associationId: string) => {
    setSelectedAssociationId(associationId);
    setIsAssociationPopoverOpen(false);
    navigate(`/associations/${associationId}`);
  };

  const navItems = NAV_SETS[mode];
  
  // Hide nav items that are redundant based on cascade selection
  const visibleNavItems = navItems.filter((item) => {
    if (selectedAssociationId && item.path === "/admin/associations") return false;
    if (selectedClubId && item.path === "/admin/clubs") return false;
    if (selectedTeamId && item.path === "/admin/teams") return false;
    return true;
  });
  const mobileNavItems = MOBILE_NAV[mode];
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Show selectors based on mode
  const showAssociationSelector = mode === "super_admin";
  const showClubSelector = mode === "super_admin" || mode === "association";

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

  const renderSidebar = (isMobile: boolean) => (
    <>
      <nav className="flex-1 py-2">
        {visibleNavItems.map((item) => {
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
              key={item.path}
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
      </nav>

      <div className="p-4 space-y-2">
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
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-accent-foreground hover:bg-accent-foreground/10 transition-all"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-50 bg-primary border-b border-primary/20">
        <div className="flex h-14 items-center justify-between px-4">
          {/* Left: Hamburger → Association Logo → Club → Division → Team */}
          <div className="flex items-center gap-2">
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
              <Popover open={isAssociationPopoverOpen} onOpenChange={setIsAssociationPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="w-10 h-10 rounded-lg overflow-hidden border-2 border-primary-foreground/20 hover:border-primary-foreground/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-foreground/50">
                    <Avatar className="w-full h-full rounded-none">
                      <AvatarImage
                        src={selectedAssociation?.logo_url || undefined}
                        alt={selectedAssociation?.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="rounded-none bg-accent text-accent-foreground text-xs font-semibold">
                        {selectedAssociation ? (selectedAssociation.abbreviation || selectedAssociation.name.substring(0, 2).toUpperCase()) : "Admin"}
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
            ) : (
              // Static association logo for non-super_admin modes
              <>
                <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-primary-foreground/20">
                  <Avatar className="w-full h-full rounded-none">
                    <AvatarImage
                      src={selectedAssociation?.logo_url || undefined}
                      alt={selectedAssociation?.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="rounded-none bg-accent text-accent-foreground text-xs font-semibold">
                      {mode === "player"
                        ? playerAssociationAbbr || playerAssociationName.substring(0, 2).toUpperCase() || "Admin"
                        : selectedAssociation ? (selectedAssociation.abbreviation || selectedAssociation.name.substring(0, 2).toUpperCase()) : "Admin"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {mode === "player" && playerClubName && (
                  <div className="h-10 max-w-[140px] lg:max-w-[180px] rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground truncate">
                    {playerClubName}
                  </div>
                )}
                {mode === "player" && playerTeamName && (
                  <div className="h-10 max-w-[120px] lg:max-w-[160px] rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground truncate">
                    {playerTeamName}
                  </div>
                )}
              </>
            )}

            {/* Club Selector */}
            {showClubSelector && selectedAssociationId && filteredClubs.length > 0 && (
              <Select key={selectedAssociationId} value={selectedClubId || undefined} onValueChange={(v) => {
                setSelectedClubId(v); 
                navigate(`/clubs/${v}`);
              }}>
                <SelectTrigger className="w-[140px] lg:w-[180px] bg-accent text-accent-foreground border-0 font-medium">
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

            {/* Division Selector */}
            {selectedClubId && filteredDivisions.length > 0 && (
              <Select key={selectedClubId} value={selectedDivision || undefined} onValueChange={(v) => {
                setSelectedDivision(v); 
                navigate("/admin/division");
              }}>
                <SelectTrigger className="w-[120px] lg:w-[160px] bg-accent text-accent-foreground border-0 font-medium">
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

            {/* Team Selector */}
            {selectedClubId && selectedDivision && filteredTeams.length > 0 && (
              <Select key={selectedClubId + selectedDivision} value={selectedTeamId || undefined} onValueChange={(v) => {
                setSelectedTeamId(v);
                navigate(`/teams/${v}`);
              }}>
                <SelectTrigger className="w-[120px] lg:w-[160px] bg-accent text-accent-foreground border-0 font-medium">
                  <SelectValue placeholder="Select Team" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  {filteredTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {getTeamDisplayName(team)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Right: Notifications & User Avatar */}
          <div className="flex items-center gap-1">
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
        <aside className="hidden lg:flex flex-col w-56 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto bg-accent border-r border-border">
          {renderSidebar(false)}
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <aside className="absolute left-0 top-14 bottom-0 w-64 bg-accent animate-slide-in-right flex flex-col">
              {renderSidebar(true)}
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-3.5rem)] p-4 lg:p-6 bg-muted/30">
          <Outlet />
        </main>
      </div>
    </div>

  );
};

export default AppLayout;

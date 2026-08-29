import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Users, Shield, Trophy, ArrowRight, Crown, Clock, AlertTriangle, MessageSquare, Pencil, ArrowUp, ArrowDown, Globe, GitMerge, UserCog } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";
import { getRoleDisplayName, getRoleBadgeColor } from "@/hooks/useUserRole";
import { useTeamContext } from "@/contexts/TeamContext";
import { useAppMode } from "@/contexts/AppModeContext";

const ADMIN_MODE_ROLE = {
  super_admin: "SUPER_ADMIN",
  association: "ASSOCIATION_ADMIN",
  club: "CLUB_ADMIN",
} as const;

interface Stats {
  associations: number;
  clubs: number;
  teams: number;
  divisions: number;
  venues: number;
  users: number;
  pendingMemberships: number;
}

const QUICK_ACTION_IDS = ["fixtures", "associations", "clubs", "teams", "users", "revsports", "error_logs", "feedback"] as const;
type QuickActionId = typeof QUICK_ACTION_IDS[number];
const DEFAULT_QUICK_ACTIONS: QuickActionId[] = ["fixtures", "error_logs", "feedback"];
const QUICK_ACTION_STORAGE_KEY = "sportstack.admin.quick-actions.v1";

const loadQuickActionIds = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(QUICK_ACTION_STORAGE_KEY) || "[]") as string[];
    const valid = saved.filter((id): id is QuickActionId => QUICK_ACTION_IDS.includes(id as QuickActionId));
    return valid.length ? [...valid, ...QUICK_ACTION_IDS.filter((id) => !valid.includes(id))] : [...DEFAULT_QUICK_ACTIONS, ...QUICK_ACTION_IDS.filter((id) => !DEFAULT_QUICK_ACTIONS.includes(id))];
  } catch {
    return [...DEFAULT_QUICK_ACTIONS, ...QUICK_ACTION_IDS.filter((id) => !DEFAULT_QUICK_ACTIONS.includes(id))];
  }
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { loading: scopeLoading, isSuperAdmin, isAnyAdmin, highestScopedRole, scopedAssociationIds, scopedClubIds, scopedTeamIds } = useAdminScope();
  const { activeMode } = useAppMode();
  const {
    selectedAssociationId,
    selectedClubId,
    selectedTeamId,
    selectedAssociation,
    selectedClub,
    selectedTeam,
  } = useTeamContext();

  const [stats, setStats] = useState<Stats>({ associations: 0, clubs: 0, teams: 0, divisions: 0, venues: 0, users: 0, pendingMemberships: 0 });
  const [loading, setLoading] = useState(true);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [quickActionOrder, setQuickActionOrder] = useState<QuickActionId[]>(loadQuickActionIds);
  const [enabledQuickActions, setEnabledQuickActions] = useState<Set<QuickActionId>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`${QUICK_ACTION_STORAGE_KEY}.enabled`) || "[]") as QuickActionId[];
      return new Set(saved.length ? saved : DEFAULT_QUICK_ACTIONS);
    } catch {
      return new Set(DEFAULT_QUICK_ACTIONS);
    }
  });

  useEffect(() => {
    localStorage.setItem(QUICK_ACTION_STORAGE_KEY, JSON.stringify(quickActionOrder));
    localStorage.setItem(`${QUICK_ACTION_STORAGE_KEY}.enabled`, JSON.stringify(Array.from(enabledQuickActions)));
  }, [enabledQuickActions, quickActionOrder]);

  useEffect(() => {
    const fetchUnmatched = async () => {
      const { count } = (await supabase
        .from("revsports_unmatched_items" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "unmatched")) as any;
      setUnmatchedCount(count ?? 0);
    };
    fetchUnmatched();
  }, []);

  const contextLevel = selectedTeamId
    ? "team"
    : selectedClubId
    ? "club"
    : selectedAssociationId
    ? "association"
    : "global";

  const dashboardTitle =
    contextLevel === "team" ? `${selectedTeam?.name || "Team"} Admin Dashboard`
    : contextLevel === "club" ? `${selectedClub?.name || "Club"} Admin Dashboard`
    : contextLevel === "association" ? `${selectedAssociation?.name || "Association"} Admin Dashboard`
    : "SportStack Admin";

  const dashboardSubtitle =
    contextLevel === "team" ? "Team stats and activity"
    : contextLevel === "club" ? "Club stats and activity"
    : contextLevel === "association" ? "Association stats and activity"
    : "Manage your organization's structure and users";

  const activeAdminRole = activeMode in ADMIN_MODE_ROLE
    ? ADMIN_MODE_ROLE[activeMode as keyof typeof ADMIN_MODE_ROLE]
    : null;

  useEffect(() => {
    if (!scopeLoading && !isAnyAdmin) {
      navigate("/dashboard");
    }
  }, [scopeLoading, isAnyAdmin, navigate]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!isAnyAdmin) return;
      setLoading(true);

      // Associations
      const assocRes = await supabase.from("associations").select("id", { count: "exact", head: true });
      
      // Clubs
      let clubsQuery = supabase.from("clubs").select("id", { count: "exact", head: true });
      if (selectedAssociationId) clubsQuery = clubsQuery.eq("association_id", selectedAssociationId);
      const clubsRes = await clubsQuery;

      // Teams
      let teamsQuery = supabase.from("teams").select("id, clubs!inner(association_id)", { count: "exact", head: true });
      if (selectedClubId) {
        teamsQuery = teamsQuery.eq("club_id", selectedClubId);
      } else if (selectedAssociationId) {
        teamsQuery = teamsQuery.eq("clubs.association_id", selectedAssociationId);
      }
      const teamsRes = await teamsQuery;

      // Divisions
      let divisionsQuery = supabase.from("divisions" as any).select("id", { count: "exact", head: true }) as any;
      if (selectedClubId) {
        divisionsQuery = divisionsQuery.eq("club_id", selectedClubId);
      } else if (selectedAssociationId) {
        divisionsQuery = divisionsQuery.eq("association_id", selectedAssociationId);
      }
      const divisionsRes = (await divisionsQuery) as any;

      // Venues
      let venuesQuery = supabase.from("venues").select("id", { count: "exact", head: true }) as any;
      if (selectedClubId) {
        venuesQuery = venuesQuery.eq("club_id", selectedClubId);
      } else if (selectedAssociationId) {
        venuesQuery = venuesQuery.eq("association_id", selectedAssociationId);
      }
      const venuesRes = (await venuesQuery) as any;

      // Users and Pending Memberships
      let usersCount = 0;
      let pendingCount = 0;
      
      if (contextLevel === "global") {
        const usersRes = await supabase.from("profiles").select("id", { count: "exact", head: true });
        const pendingRes = await supabase.from("team_memberships").select("id", { count: "exact", head: true }).eq("status", "PENDING");
        usersCount = usersRes.count || 0;
        pendingCount = pendingRes.count || 0;
      } else {
        let query = supabase.from("teams").select("id, clubs!inner(association_id)");
        if (selectedTeamId) query = query.eq("id", selectedTeamId);
        else if (selectedClubId) query = query.eq("club_id", selectedClubId);
        else if (selectedAssociationId) query = query.eq("clubs.association_id", selectedAssociationId);
        
        const { data: teamsData } = await query;
        const tIds = teamsData?.map(t => t.id) || [];
        
        if (tIds.length > 0) {
          const usersRes = await supabase.from("team_memberships").select("user_id", { count: "exact", head: true }).in("team_id", tIds);
          const pendingRes = await supabase.from("team_memberships").select("id", { count: "exact", head: true }).in("team_id", tIds).eq("status", "PENDING");
          usersCount = usersRes.count || 0;
          pendingCount = pendingRes.count || 0;
        }
      }

      setStats({
        associations: assocRes.count || 0,
        clubs: clubsRes.count || 0,
        teams: teamsRes.count || 0,
        divisions: divisionsRes.count || 0,
        venues: venuesRes.count || 0,
        users: usersCount,
        pendingMemberships: pendingCount,
      });

      setLoading(false);
    };

    if (!scopeLoading && isAnyAdmin) {
      fetchStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeLoading, isAnyAdmin, isSuperAdmin, 
      scopedAssociationIds.join(","), scopedClubIds.join(","), scopedTeamIds.join(","),
      selectedAssociationId, selectedClubId, selectedTeamId, contextLevel]);

  if (scopeLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // Determine which cards to show based on cascade level
  const showAssociations = contextLevel === "global";
  const showClubs = contextLevel === "global" || contextLevel === "association";
  const showTeams = contextLevel !== "team";
  const scopeQuery = new URLSearchParams();
  if (selectedAssociationId) scopeQuery.set("association", selectedAssociationId);
  if (selectedClubId) scopeQuery.set("club", selectedClubId);
  if (selectedTeamId) scopeQuery.set("team", selectedTeamId);
  const scopedHref = (path: string) => scopeQuery.size > 0 ? `${path}?${scopeQuery.toString()}` : path;
  const quickActionCatalogue: Record<QuickActionId, { label: string; href: string; icon: typeof Clock; allowed: boolean }> = {
    fixtures: { label: "Fixtures", href: scopedHref("/admin/fixtures"), icon: Clock, allowed: true },
    associations: { label: "Associations", href: "/admin/associations", icon: Globe, allowed: isSuperAdmin },
    clubs: { label: "Clubs", href: scopedHref("/admin/clubs"), icon: Building2, allowed: isSuperAdmin || highestScopedRole === "ASSOCIATION_ADMIN" },
    teams: { label: "Teams", href: scopedHref("/admin/teams"), icon: Shield, allowed: true },
    users: { label: "Users", href: scopedHref("/admin/users"), icon: UserCog, allowed: true },
    revsports: { label: "RevSports Review", href: "/admin/revsports-entities", icon: GitMerge, allowed: isSuperAdmin || highestScopedRole === "ASSOCIATION_ADMIN" },
    error_logs: { label: "Error Logs", href: "/admin/error-logs", icon: AlertTriangle, allowed: isSuperAdmin },
    feedback: { label: "Feedback", href: "/admin/feedback", icon: MessageSquare, allowed: isSuperAdmin || highestScopedRole === "ASSOCIATION_ADMIN" },
  };
  const availableQuickActionIds = quickActionOrder.filter((id) => quickActionCatalogue[id].allowed);
  const visibleQuickActionIds = availableQuickActionIds.filter((id) => enabledQuickActions.has(id));
  const moveQuickAction = (id: QuickActionId, direction: -1 | 1) => {
    setQuickActionOrder((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };
  const scopeBanner = (
    selectedTeam as { banner_url?: string | null; primary_colour?: string | null } | null
  )?.banner_url || (
    selectedClub as { banner_url?: string | null; primary_colour?: string | null } | null
  )?.banner_url || (
    selectedAssociation as { banner_url?: string | null; primary_colour?: string | null } | null
  )?.banner_url;
  const scopeColour = (
    selectedTeam as { primary_colour?: string | null } | null
  )?.primary_colour || (
    selectedClub as { primary_colour?: string | null } | null
  )?.primary_colour || (
    selectedAssociation as { primary_colour?: string | null } | null
  )?.primary_colour || undefined;

  const statCards = [
    ...(showAssociations ? [{
      title: "Associations",
      value: stats.associations,
      icon: Building2,
      href: scopedHref("/admin/associations"),
      description: "Manage associations",
      color: "text-blue-600",
    }] : []),
    ...(showClubs ? [{
      title: "Clubs",
      value: stats.clubs,
      icon: Shield,
      href: scopedHref("/admin/clubs"),
      description: "Manage clubs",
      color: "text-green-600",
    }] : []),
    ...(showTeams ? [{
      title: "Teams",
      value: stats.teams,
      icon: Trophy,
      href: scopedHref("/admin/teams"),
      description: "Manage teams",
      color: "text-purple-600",
    }] : []),
    ...(showTeams ? [{
      title: "Divisions",
      value: stats.divisions,
      icon: Trophy,
      href: scopedHref("/admin/divisions"),
      description: "Manage divisions",
      color: "text-sky-600",
    }] : []),
    ...(showTeams ? [{
      title: "Venues",
      value: stats.venues,
      icon: Trophy,
      href: scopedHref("/admin/venues"),
      description: "Manage venues",
      color: "text-cyan-600",
    }] : []),
    {
      title: "Users",
      value: stats.users,
      icon: Users,
      href: scopedHref("/admin/users"),
      description: "Manage users & roles",
      color: "text-orange-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{dashboardTitle}</h1>
          <p className="text-muted-foreground">
            {dashboardSubtitle}
          </p>
        </div>
        {activeAdminRole && (
          <Badge className={getRoleBadgeColor(activeAdminRole)}>
            <Crown className="mr-1 h-3 w-3" />
            {getRoleDisplayName(activeAdminRole)}
          </Badge>
        )}
      </div>

      {contextLevel !== "global" && (
        <div
          className="flex min-h-28 items-end overflow-hidden rounded-xl border bg-primary p-5 text-primary-foreground shadow-sm"
          style={{
            backgroundColor: scopeColour,
            backgroundImage: scopeBanner ? `linear-gradient(90deg, rgba(0,0,0,.62), rgba(0,0,0,.12)), url(${scopeBanner})` : undefined,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Selected management scope</p>
            <p className="mt-1 text-xl font-semibold">{selectedTeam?.name || selectedClub?.name || selectedAssociation?.name}</p>
          </div>
        </div>
      )}

      {/* Pending Memberships Alert */}
      {stats.pendingMemberships > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium text-foreground">{stats.pendingMemberships} pending membership(s)</p>
                <p className="text-sm text-muted-foreground">Users waiting for approval</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/users">Review</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Unmatched RevSports Items Alert */}
      {unmatchedCount > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-foreground">
                  {unmatchedCount} unmatched RevSports item{unmatchedCount !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Teams or grades found by the scraper with no SportStack match yet
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/revsports-unmatched">Review</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-bold">{stat.value}</div>
              )}
              <Link to={stat.href}>
                <Button variant="link" className="p-0 h-auto mt-2">
                  {stat.description}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setQuickActionsOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {visibleQuickActionIds.map((id) => {
            const action = quickActionCatalogue[id];
            const Icon = action.icon;
            return <Button key={id} variant="outline" asChild className="h-auto flex-col py-4"><Link to={action.href}><Icon className="mb-2 h-6 w-6" /><span>{action.label}</span></Link></Button>;
          })}
          {visibleQuickActionIds.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No quick actions selected. Use Edit to add some.</p>}
        </CardContent>
      </Card>

      <Dialog open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Quick Actions</DialogTitle>
            <DialogDescription>Choose which shortcuts appear and use the arrows to change their order.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {availableQuickActionIds.map((id, index) => {
              const action = quickActionCatalogue[id];
              return <div key={id} className="flex items-center gap-3 rounded-md border p-3">
                <Checkbox checked={enabledQuickActions.has(id)} onCheckedChange={(checked) => setEnabledQuickActions((current) => {
                  const next = new Set(current);
                  if (checked) next.add(id); else next.delete(id);
                  return next;
                })} aria-label={`Show ${action.label}`} />
                <span className="flex-1 text-sm font-medium">{action.label}</span>
                <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => moveQuickAction(id, -1)} aria-label={`Move ${action.label} up`}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" disabled={index === availableQuickActionIds.length - 1} onClick={() => moveQuickAction(id, 1)} aria-label={`Move ${action.label} down`}><ArrowDown className="h-4 w-4" /></Button>
              </div>;
            })}
          </div>
          <DialogFooter><Button onClick={() => setQuickActionsOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;

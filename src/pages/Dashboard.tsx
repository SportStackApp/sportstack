import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  MapPin,
  Clock,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  HelpCircle,
  AlertCircle,
  BellRing,
  Megaphone,
  MessagesSquare,
  UserPlus,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTeamContext } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn, getTeamDisplayName } from "@/lib/utils";
import { useAdminScope } from "@/hooks/useAdminScope";

type AvailabilityStatus = Database["public"]["Enums"]["availability_status_enum"];

interface GameRow {
  id: string;
  fixture_date: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
  venue_id: string | null;
  home_team: { id: string; name: string } | null;
  away_team: { id: string; name: string } | null;
  venue: { id: string; name: string } | null;
  divisions?: { id: string; name: string } | null;
}

interface TeamRequest {
  id: string;
  request_type: string;
  team_id: string;
  team_name: string;
  club_name: string;
  membership_type: string;
  requester_name: string;
  created_at: string;
}

interface DashboardFeedMessage {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string;
  is_important: boolean;
  author_name?: string;
  scope_tab?: "team" | "club" | "association";
}

type MembershipType = Database["public"]["Enums"]["membership_type_enum"];

const FIXTURE_SELECT =
  "id, fixture_date, status, home_team_id, away_team_id, division_id, venue_id, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name), venue:venues!venue_id(id, name), divisions:divisions!fixtures_division_id_fkey(id, name)";

const Dashboard = () => {
  const {
    associations,
    selectedAssociationId,
    selectedClubId,
    selectedTeamId,
    selectedDivision,
    selectedTeam,
    selectedClub,
    selectedAssociation,
    setSelectedAssociationId,
    setSelectedClubId,
    setSelectedDivision,
    setSelectedTeamId,
    filteredClubs,
    filteredDivisions,
    filteredTeams,
  } = useTeamContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const { canManageClub, canManageTeam } = useAdminScope();
  const [games, setGames] = useState<GameRow[]>([]);
  const [availability, setAvailability] = useState<Record<string, AvailabilityStatus>>({});
  const [loading, setLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [profileName, setProfileName] = useState("");
  const [teamRequests, setTeamRequests] = useState<TeamRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [conflictRequest, setConflictRequest] = useState<TeamRequest | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [accountLoading, setAccountLoading] = useState(true);
  const [roleCount, setRoleCount] = useState(0);
  const [activeMembershipCount, setActiveMembershipCount] = useState(0);
  const [submittingJoinRequest, setSubmittingJoinRequest] = useState(false);
  const [joinRequestSent, setJoinRequestSent] = useState(false);
  const [publishedLineupFixtureIds, setPublishedLineupFixtureIds] = useState<Set<string>>(new Set());
  const [officialUpdates, setOfficialUpdates] = useState<DashboardFeedMessage[]>([]);
  const [teamActivity, setTeamActivity] = useState<DashboardFeedMessage[]>([]);
  const [importantUnreadCount, setImportantUnreadCount] = useState(0);
  const [mentionCount, setMentionCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", user.id)
        .single();
      if (data?.first_name) setProfileName(data.first_name);
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchAccountState = async () => {
      setAccountLoading(true);
      const [rolesRes, membershipsRes, requestsRes] = await Promise.all([
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase
          .from("team_memberships")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "ACTIVE"),
        supabase
          .from("requests")
          .select("id", { count: "exact", head: true })
          .eq("target_user_id", user.id)
          .eq("status", "PENDING"),
      ]);

      setRoleCount(rolesRes.count || 0);
      setActiveMembershipCount(membershipsRes.count || 0);
      setJoinRequestSent((requestsRes.count || 0) > 0);
      setAccountLoading(false);
    };

    fetchAccountState();
  }, [user]);

  // Fetch pending team requests for the player
  useEffect(() => {
    if (!user) return;
    const fetchTeamRequests = async () => {
      setLoadingRequests(true);
      try {
        const { data, error } = await supabase
          .from("requests")
          .select("*")
          .eq("target_user_id", user.id)
          .eq("status", "PENDING")
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Fetch team and club info
        const requestsWithTeamInfo = await Promise.all(
          (data || []).filter((request) => Boolean(request.team_id)).map(async (req) => {
            const { data: teamData } = await supabase
              .from("teams")
              .select("name, club_id, clubs(name)")
              .eq("id", req.team_id)
              .single();

            const { data: profileData } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", req.requester_id)
              .single();

            const clubData = Array.isArray(teamData?.clubs) ? teamData.clubs[0] : teamData?.clubs;
            return {
              id: req.id,
              request_type: req.request_type,
              team_id: req.team_id,
              team_name: teamData?.name || "Unknown Team",
              club_name: clubData?.name || "Unknown Club",
              membership_type: req.membership_type,
              requester_name: `${profileData?.first_name || ""} ${profileData?.last_name || ""}`.trim() || "Unknown",
              created_at: req.created_at,
            };
          })
        );

        setTeamRequests(requestsWithTeamInfo);
      } catch (err: unknown) {
        console.error(err);
      } finally {
        setLoadingRequests(false);
      }
    };

    fetchTeamRequests();
  }, [user]);

  useEffect(() => {
    const fetchGames = async () => {
      if (!selectedTeamId) {
        setGames([]);
        setLoading(false);
        return;
      }
      setLoading(true);

      const { data: gamesData } = await supabase
        .from("fixtures")
        .select(FIXTURE_SELECT)
        .or(`home_team_id.eq.${selectedTeamId},away_team_id.eq.${selectedTeamId}`)
        .gte("fixture_date", new Date().toISOString())
        .eq("status", "SCHEDULED")
        .order("fixture_date", { ascending: true })
        .limit(8);

      const gamesList = (gamesData as GameRow[]) || [];
      setGames(gamesList);

      // Fetch availability for these games
      if (user && gamesList.length > 0) {
        const gameIds = gamesList.map((g) => g.id);
        const [availabilityResult, lineupsResult] = await Promise.all([
          supabase
            .from("fixture_availability")
            .select("fixture_id, status")
            .eq("user_id", user.id)
            .in("fixture_id", gameIds),
          supabase
            .from("fixture_lineups")
            .select("fixture_id, published_at")
            .eq("team_id", selectedTeamId)
            .in("fixture_id", gameIds)
            .not("published_at", "is", null),
        ]);

        const availMap: Record<string, AvailabilityStatus> = {};
        availabilityResult.data?.forEach((a) => {
          availMap[a.fixture_id] = a.status as AvailabilityStatus;
        });
        setAvailability(availMap);
        setPublishedLineupFixtureIds(new Set((lineupsResult.data || []).map((lineup) => lineup.fixture_id)));
      }

      setLoading(false);
    };
    fetchGames();
  }, [selectedTeamId, user]);

  useEffect(() => {
    if (!user) return;
    const communicationsClient = supabase;
    let active = true;
    const loadDashboardCommunications = async () => {
      const channelRequests = [
        selectedTeamId
          ? communicationsClient.from("communication_channels").select("id").eq("team_id", selectedTeamId).maybeSingle()
          : Promise.resolve({ data: null }),
        selectedClubId
          ? communicationsClient.from("communication_channels").select("id").eq("club_id", selectedClubId).maybeSingle()
          : Promise.resolve({ data: null }),
        selectedAssociationId
          ? communicationsClient.from("communication_channels").select("id").eq("association_id", selectedAssociationId).maybeSingle()
          : Promise.resolve({ data: null }),
      ];
      const [teamChannel, clubChannel, associationChannel] = await Promise.all(channelRequests);
      const officialChannelIds = [clubChannel.data?.id, associationChannel.data?.id].filter(Boolean) as string[];
      const teamChannelId = teamChannel.data?.id as string | undefined;
      const messageSelect = "id, channel_id, author_id, content, created_at, is_important";
      const [officialResult, activityResult, notificationResult, readStateResult] = await Promise.all([
        officialChannelIds.length > 0
          ? communicationsClient
              .from("communication_messages")
              .select(messageSelect)
              .in("channel_id", officialChannelIds)
              .is("removed_at", null)
              .order("created_at", { ascending: false })
              .limit(6)
          : Promise.resolve({ data: [] }),
        teamChannelId
          ? communicationsClient
              .from("communication_messages")
              .select(messageSelect)
              .eq("channel_id", teamChannelId)
              .is("removed_at", null)
              .order("created_at", { ascending: false })
              .limit(6)
          : Promise.resolve({ data: [] }),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false)
          .eq("type", "COMMUNICATION_MENTION"),
        officialChannelIds.length > 0
          ? communicationsClient
              .from("communication_read_state")
              .select("channel_id, last_read_at")
              .eq("user_id", user.id)
              .in("channel_id", officialChannelIds)
          : Promise.resolve({ data: [] }),
      ]);
      const allMessages = [...(officialResult.data || []), ...(activityResult.data || [])] as DashboardFeedMessage[];
      const authorIds = [...new Set(allMessages.map((message) => message.author_id))];
      const { data: authors } = authorIds.length > 0
        ? await supabase.from("profiles").select("id, first_name, last_name").in("id", authorIds)
        : { data: [] };
      const authorNames = Object.fromEntries((authors || []).map((profile) => [
        profile.id,
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Member",
      ]));
      const enrich = (items: DashboardFeedMessage[]) => items.map((message) => ({
        ...message,
        author_name: authorNames[message.author_id] || "Member",
        scope_tab: message.channel_id === associationChannel.data?.id
          ? "association" as const
          : message.channel_id === clubChannel.data?.id
            ? "club" as const
            : "team" as const,
      }));
      if (!active) return;
      setOfficialUpdates(enrich((officialResult.data || []) as DashboardFeedMessage[]));
      setTeamActivity(enrich((activityResult.data || []) as DashboardFeedMessage[]));
      setMentionCount(notificationResult.count || 0);
      const readStates = readStateResult.data || [];
      setImportantUnreadCount(((officialResult.data || []) as DashboardFeedMessage[]).filter((message) => {
        if (!message.is_important) return false;
        const state = (readStates as Array<{ channel_id: string; last_read_at: string | null }>)
          .find((item) => item.channel_id === message.channel_id);
        return !state?.last_read_at || new Date(message.created_at) > new Date(state.last_read_at);
      }).length);
    };
    void loadDashboardCommunications();
    const channel = supabase
      .channel(`dashboard-communications:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "communication_messages" }, () => {
        void loadDashboardCommunications();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        void loadDashboardCommunications();
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [selectedAssociationId, selectedClubId, selectedTeamId, user]);

  const handleAvailabilityChange = async (gameId: string, status: AvailabilityStatus) => {
    if (!user) return;
    const previous = availability[gameId];
    setAvailability((prev) => ({ ...prev, [gameId]: status }));

    const { error } = await supabase
      .from("fixture_availability")
      .upsert({ fixture_id: gameId, user_id: user.id, status }, { onConflict: "fixture_id,user_id" });
    if (error) {
      setAvailability((current) => {
        const next = { ...current };
        if (previous) next[gameId] = previous;
        else delete next[gameId];
        return next;
      });
      toast({ title: "Availability not saved", description: "Please try again.", variant: "destructive" });
    }
  };

  const handleAcceptRequest = async (request: TeamRequest, joinAsSecondary?: boolean) => {
    if (!user) return;

    try {
      // Check for existing PRIMARY membership if needed
      if (request.membership_type === "PRIMARY" && !joinAsSecondary) {
        const { data: existingPrimary } = await supabase
          .from("team_memberships")
          .select("id, team_id, status")
          .eq("user_id", user.id)
          .eq("membership_type", "PRIMARY")
          .in("status", ["ACTIVE", "PENDING"]);

        if ((existingPrimary || []).length > 0) {
          setConflictRequest(request);
          setShowConflictModal(true);
          return;
        }
      }

      // Determine membership type to use
      const finalMembershipType = joinAsSecondary ? "SECONDARY" : request.membership_type;

      // If switching primary, deactivate old one
      if (request.membership_type === "PRIMARY" && !joinAsSecondary) {
        const { data: oldPrimary } = await supabase
          .from("team_memberships")
          .select("id")
          .eq("user_id", user.id)
          .eq("membership_type", "PRIMARY")
          .eq("status", "ACTIVE");

        if (oldPrimary && oldPrimary.length > 0) {
          await supabase
            .from("team_memberships")
            .update({ status: "INACTIVE" })
            .eq("id", oldPrimary[0].id);
        }
      }

      // Create new team membership
      await supabase.from("team_memberships").insert({
        user_id: user.id,
        team_id: request.team_id,
        membership_type: finalMembershipType as MembershipType,
        status: "ACTIVE",
      });

      // Update request status
      await supabase
        .from("requests")
        .update({ status: "APPROVED", responded_by: user.id })
        .eq("id", request.id);

      toast({
        title: "Request accepted",
        description: `You've joined ${request.team_name} as ${finalMembershipType.toLowerCase()}.`,
      });

      setShowConflictModal(false);
      setConflictRequest(null);
      setTeamRequests(teamRequests.filter((r) => r.id !== request.id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "The request could not be accepted.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    if (!user) return;

    try {
      await supabase
        .from("requests")
        .update({ status: "DECLINED", responded_by: user.id })
        .eq("id", requestId);

      toast({
        title: "Request declined",
        description: "The team request has been declined.",
      });

      setTeamRequests(teamRequests.filter((r) => r.id !== requestId));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "The request could not be declined.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleJoinRequest = async () => {
    if (!user || !selectedAssociationId || submittingJoinRequest) return;

    setSubmittingJoinRequest(true);
    const { error } = await supabase.from("requests").insert({
      request_type: "PLAYER_REQUEST",
      requester_id: user.id,
      target_user_id: user.id,
      association_id: selectedAssociationId,
      club_id: selectedClubId || null,
      team_id: selectedTeamId || null,
      membership_type: "PRIMARY",
      status: "PENDING",
    });
    setSubmittingJoinRequest(false);

    if (error) {
      toast({
        title: "Request not sent",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      return;
    }

    setJoinRequestSent(true);
    toast({
      title: "Request sent",
      description: "An admin can now review your club or team request.",
    });
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCalendarMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + (direction === "prev" ? -1 : 1));
      return newDate;
    });
  };

  const generateCalendarDays = () => {
    const today = new Date();
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    let startOffset = firstDayOfMonth.getDay() - 1;
    if (startOffset < 0) startOffset = 6;
    const daysInMonth = lastDayOfMonth.getDate();
    const days: { date: number; isCurrentMonth: boolean; isToday: boolean; hasGame: boolean }[] = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ date: prevMonthLastDay - i, isCurrentMonth: false, isToday: false, hasGame: false });
    }

    const gameDays = games
      .filter((g) => {
        const d = new Date(g.fixture_date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .map((g) => new Date(g.fixture_date).getDate());

    for (let i = 1; i <= daysInMonth; i++) {
      const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      days.push({ date: i, isCurrentMonth: true, isToday, hasGame: gameDays.includes(i) });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: i, isCurrentMonth: false, isToday: false, hasGame: false });
    }
    return days;
  };

  const calendarDays = generateCalendarDays();
  const monthYearLabel = calendarMonth.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  const teamName = selectedTeam ? getTeamDisplayName(selectedTeam) : "Team";
  const isBrandNewUser = !accountLoading && roleCount === 0 && activeMembershipCount === 0;

  // Club branding
  const clubPrimary = selectedClub?.primary_colour || undefined;
  const clubSecondary = selectedClub?.secondary_colour || undefined;
  const clubBannerUrl = selectedClub?.banner_url || undefined;
  const clubLogoUrl = selectedClub?.logo_url || undefined;

  const brandStyle = clubPrimary
    ? { backgroundColor: clubPrimary, color: clubSecondary || "#fff" }
    : undefined;
  const canEditCurrentClub = selectedClubId ? canManageClub(selectedClubId) : false;
  const canOpenFixtureDetail = selectedTeamId ? canManageTeam(selectedTeamId) : false;
  const unansweredAvailabilityCount = games.filter(
    (game) => !availability[game.id] || availability[game.id] === "MAYBE" || availability[game.id] === "NO_RESPONSE",
  ).length;

  if (isBrandNewUser) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 animate-fade-in">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <CardTitle>Welcome to SportStack</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose where you want to join. Your request will go to an admin for approval.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Association</Label>
              <Select
                value={selectedAssociationId || undefined}
                onValueChange={(value) => setSelectedAssociationId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select association" />
                </SelectTrigger>
                <SelectContent>
                  {associations.map((association) => (
                    <SelectItem key={association.id} value={association.id}>
                      {association.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Club</Label>
              <Select
                value={selectedClubId || undefined}
                onValueChange={(value) => setSelectedClubId(value)}
                disabled={!selectedAssociationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select club" />
                </SelectTrigger>
                <SelectContent>
                  {filteredClubs.map((club) => (
                    <SelectItem key={club.id} value={club.id}>
                      {club.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Division</Label>
              <Select
                value={selectedDivision || undefined}
                onValueChange={(value) => setSelectedDivision(value)}
                disabled={!selectedClubId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select division" />
                </SelectTrigger>
                <SelectContent>
                  {filteredDivisions.map((division) => (
                    <SelectItem key={division.id} value={division.id}>
                      {division.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Team</Label>
              <Select
                value={selectedTeamId || undefined}
                onValueChange={(value) => setSelectedTeamId(value)}
                disabled={!selectedDivision}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!selectedDivision ? "Select division first" : "Select team"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {getTeamDisplayName(team)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {joinRequestSent ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Your request is waiting for admin approval.
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={handleJoinRequest}
                disabled={!selectedAssociationId || submittingJoinRequest}
              >
                {submittingJoinRequest ? "Sending..." : "Request to Join"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Combined player and club banner */}
      <Card
        style={clubBannerUrl
          ? { backgroundImage: `linear-gradient(90deg, rgba(10,20,45,.9), rgba(10,20,45,.45)), url(${clubBannerUrl})` }
          : brandStyle}
        className={cn(
          "relative overflow-hidden bg-cover bg-center",
          !clubBannerUrl && !brandStyle && "bg-primary text-primary-foreground",
          clubBannerUrl && "text-white",
        )}
      >
        <CardContent className="relative flex min-h-28 items-center gap-4 px-5 py-4 sm:px-6">
          {clubLogoUrl && (
            <img
              src={clubLogoUrl}
              alt={`${selectedClub?.name || "Club"} logo`}
              className="h-16 w-16 shrink-0 rounded-lg bg-white/90 object-contain p-1"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm opacity-80">Welcome back{profileName ? `, ${profileName}` : ""}</p>
            {selectedTeamId ? (
              <>
                <h1 className="truncate text-xl font-semibold sm:text-2xl">{teamName}</h1>
                <p className="truncate text-sm opacity-80">
                  {[selectedClub?.name, selectedAssociation?.name].filter(Boolean).join(" • ")}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm">Select an association, club and team to open its dashboard.</p>
            )}
          </div>
          {canEditCurrentClub && (
            <Link to="/admin/clubs" className="hidden sm:block">
              <Button size="sm" variant="secondary" className="gap-2">
                <Pencil className="h-4 w-4" /> Edit branding
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Needs attention */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="mr-2 flex items-center gap-2 text-sm font-semibold">
            <BellRing className="h-4 w-4" /> Needs attention
          </div>
          {unansweredAvailabilityCount === 0 && importantUnreadCount === 0 && mentionCount === 0 && teamRequests.length === 0 ? (
            <span className="text-sm text-muted-foreground">You’re up to date.</span>
          ) : (
            <>
              {unansweredAvailabilityCount > 0 && (
                <Badge variant="secondary">{unansweredAvailabilityCount} availability response{unansweredAvailabilityCount === 1 ? "" : "s"}</Badge>
              )}
              {importantUnreadCount > 0 && (
                <Link to="/chat?tab=club"><Badge variant="destructive">{importantUnreadCount} important update{importantUnreadCount === 1 ? "" : "s"}</Badge></Link>
              )}
              {mentionCount > 0 && (
                <Link to="/chat?tab=team"><Badge variant="secondary">{mentionCount} mention{mentionCount === 1 ? "" : "s"}</Badge></Link>
              )}
              {teamRequests.length > 0 && <Badge variant="secondary">{teamRequests.length} team request{teamRequests.length === 1 ? "" : "s"}</Badge>}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-[7fr_3fr] gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Upcoming Fixtures */}
          <Card style={brandStyle} className={!brandStyle ? "bg-primary text-primary-foreground" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base font-semibold text-primary-foreground">
                  Upcoming fixtures
                </CardTitle>
                <Link to="/games">
                  <Button size="sm" variant="secondary">
                    View all
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full bg-primary-foreground/10" />
                  ))}
                </div>
              ) : games.length === 0 ? (
                <p className="text-primary-foreground/70 text-sm">No upcoming fixtures</p>
              ) : (
                games.slice(0, 5).map((game) => {
                  const gameDate = new Date(game.fixture_date);
                  const homeTeam = game.home_team?.name ?? "Unknown";
                  const awayTeam = game.away_team?.name ?? "Unknown";
                  const venueName = game.venue?.name ?? "TBD";
                  const divisionName = game.divisions?.name;
                  const avail = availability[game.id];

                  const fixtureCard = (
                    <>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm">
                          {homeTeam} vs {awayTeam}
                        </p>
                        {canOpenFixtureDetail && <ChevronRight className="h-4 w-4 text-primary-foreground/50 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-primary-foreground/70 mb-2">
                        {divisionName && <span>{divisionName}</span>}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {gameDate.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {gameDate.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {venueName}
                        </span>
                      </div>

                      {publishedLineupFixtureIds.has(game.id) && (
                        <Badge className="mb-2 border-0 bg-sky-500/25 text-sky-100">Line-up published</Badge>
                      )}

                      {/* Availability buttons */}
                      <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                        {(["AVAILABLE", "UNAVAILABLE", "MAYBE"] as const).map((status) => {
                          const config = {
                            AVAILABLE: { icon: Check, label: "Available", active: "bg-green-500 text-white", inactive: "bg-green-500/20 text-green-200" },
                            UNAVAILABLE: { icon: X, label: "Not Available", active: "bg-red-500 text-white", inactive: "bg-red-500/20 text-red-200" },
                            MAYBE: { icon: HelpCircle, label: "Unsure", active: "bg-yellow-500 text-white", inactive: "bg-yellow-500/20 text-yellow-200" },
                          };
                          const c = config[status];
                          const Icon = c.icon;
                          return (
                            <Badge
                              key={status}
                              onClick={() => handleAvailabilityChange(game.id, status)}
                              className={`text-xs cursor-pointer transition-all border-0 ${
                                avail === status ? c.active : `${c.inactive} hover:opacity-80`
                              }`}
                            >
                              <Icon className="h-3 w-3 mr-1" />
                              {c.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </>
                  );

                  return canOpenFixtureDetail ? (
                    <Link
                      key={game.id}
                      to={`/games/${game.id}`}
                      className="block p-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
                    >
                      {fixtureCard}
                    </Link>
                  ) : (
                    <div
                      key={game.id}
                      className="block p-3 rounded-lg bg-primary-foreground/10"
                    >
                      {fixtureCard}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Calendar */}
        <div className="space-y-4">
          <Card style={brandStyle} className={`h-[260px] ${!brandStyle ? "bg-primary text-primary-foreground" : ""}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/10"
                  onClick={() => navigateMonth("prev")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-base font-semibold text-primary-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {monthYearLabel}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/10"
                  onClick={() => navigateMonth("next")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                  <div key={i} className="py-0.5 text-primary-foreground/70 font-medium">{day}</div>
                ))}
                {calendarDays.map((day, i) => (
                  <div
                    key={i}
                    className={`py-1 rounded-full text-xs ${
                      day.isToday
                        ? "bg-primary-foreground text-primary font-bold"
                        : day.hasGame && day.isCurrentMonth
                        ? "bg-green-500 text-white font-medium"
                        : day.isCurrentMonth
                        ? "text-primary-foreground font-medium"
                        : "text-primary-foreground/40"
                    }`}
                  >
                    {day.date}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="h-4 w-4" /> Official updates
              </CardTitle>
              <Link to="/chat?tab=club" className="text-xs text-primary hover:underline">Open updates</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {officialUpdates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No club or association updates yet.</p>
            ) : officialUpdates.slice(0, 4).map((message) => (
              <Link key={message.id} to={`/chat?tab=${message.scope_tab || "club"}&message=${message.id}`} className="block rounded-lg border p-3 hover:bg-muted/40">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="truncate text-xs font-medium">{message.author_name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(message.created_at).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm">{message.content}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessagesSquare className="h-4 w-4" /> Team activity
              </CardTitle>
              <Link to="/chat?tab=team" className="text-xs text-primary hover:underline">Open Team Chat</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent team conversation.</p>
            ) : teamActivity.slice(0, 4).map((message) => (
              <Link key={message.id} to={`/chat?tab=team&message=${message.id}`} className="block rounded-lg border p-3 hover:bg-muted/40">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="truncate text-xs font-medium">{message.author_name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(message.created_at).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm">{message.content}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Team Requests Section */}
      {teamRequests.length > 0 && (
        <Card className="border-l-4 border-l-amber-500 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base font-semibold text-foreground">
                Team Requests ({teamRequests.length})
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              You have pending team requests awaiting your response
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingRequests ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              teamRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{request.team_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.club_name} • {request.membership_type}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Sent by {request.requester_name} •{" "}
                      {new Date(request.created_at).toLocaleDateString("en-AU", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-600 border-green-200 hover:bg-green-50 h-8 px-3 text-xs"
                      onClick={() => handleAcceptRequest(request)}
                    >
                      <Check className="h-3 w-3 mr-1" /> Accept
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 h-8 px-3 text-xs"
                      onClick={() => handleDeclineRequest(request.id)}
                    >
                      <X className="h-3 w-3 mr-1" /> Decline
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Primary Team Conflict Modal */}
      <AlertDialog open={showConflictModal} onOpenChange={setShowConflictModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Primary Team Conflict</AlertDialogTitle>
            <AlertDialogDescription>
              You already have an active primary team. How would you like to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm font-medium">{conflictRequest?.team_name}</p>
              <p className="text-xs text-muted-foreground">
                {conflictRequest?.club_name}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <AlertDialogCancel className="flex-1">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                conflictRequest && handleAcceptRequest(conflictRequest, true)
              }
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Join as Secondary
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => conflictRequest && handleAcceptRequest(conflictRequest, false)}
              className="flex-1"
            >
              Switch as Primary
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;

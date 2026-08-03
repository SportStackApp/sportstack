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
import { useAppMode } from "@/contexts/AppModeContext";
import { MembershipTypeBadge } from "@/components/MembershipTypeBadge";

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

interface CalendarGameRow extends GameRow {
  membershipType: "PRIMARY" | "SECONDARY" | "FILL_IN";
  contextTeamId: string;
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
type DisplayMembershipType = "PRIMARY" | "SECONDARY" | "FILL_IN";

const AVAILABILITY_OPTIONS = [
  { status: "AVAILABLE", label: "Available", icon: Check },
  { status: "UNAVAILABLE", label: "Unavailable", icon: X },
  { status: "MAYBE", label: "Unsure", icon: HelpCircle },
] as const;

const availabilityLabel = (status?: AvailabilityStatus) => {
  if (status === "AVAILABLE") return "Available";
  if (status === "UNAVAILABLE") return "Unavailable";
  if (status === "MAYBE") return "Unsure";
  return "No response";
};

interface AvailabilityControlsProps {
  current?: AvailabilityStatus;
  saving: boolean;
  onChange: (status: AvailabilityStatus) => void;
  compact?: boolean;
}

const AvailabilityControls = ({ current, saving, onChange, compact = false }: AvailabilityControlsProps) => (
  <div className="space-y-1.5">
    <p className={cn("text-xs text-primary-foreground/80", compact && "text-[10px]")} aria-live="polite">
      Your availability: <span className="font-semibold text-primary-foreground">{availabilityLabel(current)}</span>
      {saving && <span> · Saving…</span>}
    </p>
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Set your availability">
      {AVAILABILITY_OPTIONS.map(({ status, label, icon: Icon }) => {
        const isSelected = current === status;
        return (
          <button
            type="button"
            key={status}
            aria-pressed={isSelected}
            aria-label={`${label}${isSelected ? "; selected; select again to clear" : ""}`}
            disabled={saving}
            onClick={() => onChange(status)}
            className={cn(
              "inline-flex min-h-8 items-center justify-center rounded-md border border-primary-foreground/20 px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground disabled:cursor-wait disabled:opacity-60",
              compact && "min-h-7 px-2 text-[10px]",
              isSelected
                ? "bg-primary-foreground text-primary"
                : "bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20",
            )}
          >
            <Icon className={cn("mr-1 h-3.5 w-3.5", compact && "h-3 w-3")} />
            {label}
          </button>
        );
      })}
    </div>
  </div>
);

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
  const { activeMode } = useAppMode();
  const [games, setGames] = useState<GameRow[]>([]);
  const [calendarGames, setCalendarGames] = useState<CalendarGameRow[]>([]);
  const [availability, setAvailability] = useState<Record<string, AvailabilityStatus>>({});
  const [availabilitySaving, setAvailabilitySaving] = useState<Set<string>>(new Set());
  const [teamMembershipTypes, setTeamMembershipTypes] = useState<Record<string, DisplayMembershipType>>({});
  const [loading, setLoading] = useState(true);
  const [fixturesError, setFixturesError] = useState(false);
  const [fixtureReloadKey, setFixtureReloadKey] = useState(0);
  const [calendarError, setCalendarError] = useState(false);
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
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", user.id)
        .single();
      if (data) {
        if (data.first_name) setProfileName(data.first_name);
      }
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
        setPublishedLineupFixtureIds(new Set());
        setFixturesError(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      setFixturesError(false);

      const { data: gamesData, error: gamesError } = await supabase
        .from("fixtures")
        .select(FIXTURE_SELECT)
        .or(`home_team_id.eq.${selectedTeamId},away_team_id.eq.${selectedTeamId}`)
        .gte("fixture_date", new Date().toISOString())
        .eq("status", "SCHEDULED")
        .order("fixture_date", { ascending: true })
        .limit(8);

      if (gamesError) {
        setGames([]);
        setPublishedLineupFixtureIds(new Set());
        setFixturesError(true);
        setLoading(false);
        return;
      }

      const gamesList = (gamesData as GameRow[]) || [];
      setGames(gamesList);

      // Published line-ups belong to the selected team fixture cards.
      if (user && gamesList.length > 0) {
        const gameIds = gamesList.map((g) => g.id);
        const lineupsResult = await supabase
            .from("fixture_lineups")
            .select("fixture_id, published_at")
            .eq("team_id", selectedTeamId)
            .in("fixture_id", gameIds)
            .not("published_at", "is", null);
        setPublishedLineupFixtureIds(new Set((lineupsResult.data || []).map((lineup) => lineup.fixture_id)));
      } else {
        setPublishedLineupFixtureIds(new Set());
      }

      setLoading(false);
    };
    fetchGames();
  }, [fixtureReloadKey, selectedTeamId, user]);

  useEffect(() => {
    if (!user) {
      setCalendarGames([]);
      setAvailability({});
      setTeamMembershipTypes({});
      setCalendarError(false);
      return;
    }

    let active = true;
    const loadPlayerCalendar = async () => {
      setCalendarError(false);
      const now = new Date().toISOString();
      const [regularResult, fillInResult] = await Promise.all([
        supabase
          .from("team_memberships")
          .select("team_id, membership_type")
          .eq("user_id", user.id)
          .eq("status", "ACTIVE")
          .in("membership_type", ["PRIMARY", "SECONDARY", "PERMANENT"]),
        supabase
          .from("fixture_fill_ins")
          .select("fixture_id, team_id")
          .eq("player_id", user.id)
          .eq("status", "SELECTED")
          .gte("access_expires_at", now),
      ]);

      if (regularResult.error || fillInResult.error) {
        if (active) {
          setCalendarGames([]);
          setAvailability({});
          setTeamMembershipTypes({});
          setCalendarError(true);
        }
        return;
      }

      const regularMemberships = (regularResult.data || []).map((row) => ({
        teamId: row.team_id,
        membershipType: row.membership_type === "PRIMARY" ? "PRIMARY" as const : "SECONDARY" as const,
      }));
      const fillIns = (fillInResult.data || []).map((row) => ({
        fixtureId: row.fixture_id,
        teamId: row.team_id,
      }));
      const nextMembershipTypes: Record<string, DisplayMembershipType> = {};
      for (const membership of regularMemberships) {
        nextMembershipTypes[membership.teamId] = membership.membershipType;
      }
      for (const fillIn of fillIns) {
        if (!nextMembershipTypes[fillIn.teamId]) nextMembershipTypes[fillIn.teamId] = "FILL_IN";
      }
      if (active) setTeamMembershipTypes(nextMembershipTypes);
      const regularTeamIds = [...new Set(regularMemberships.map((row) => row.teamId))];
      const fillInFixtureIds = [...new Set(fillIns.map((row) => row.fixtureId))];

      const regularFixturesPromise = regularTeamIds.length > 0
        ? supabase
            .from("fixtures")
            .select(FIXTURE_SELECT)
            .or(`home_team_id.in.(${regularTeamIds.join(",")}),away_team_id.in.(${regularTeamIds.join(",")})`)
            .gte("fixture_date", now)
            .eq("status", "SCHEDULED")
            .order("fixture_date", { ascending: true })
            .limit(60)
        : Promise.resolve({ data: [], error: null });
      const fillInFixturesPromise = fillInFixtureIds.length > 0
        ? supabase
            .from("fixtures")
            .select(FIXTURE_SELECT)
            .in("id", fillInFixtureIds)
            .gte("fixture_date", now)
            .eq("status", "SCHEDULED")
            .order("fixture_date", { ascending: true })
        : Promise.resolve({ data: [], error: null });

      const [regularFixturesResult, fillInFixturesResult] = await Promise.all([
        regularFixturesPromise,
        fillInFixturesPromise,
      ]);

      if (regularFixturesResult.error || fillInFixturesResult.error) {
        if (active) {
          setCalendarGames([]);
          setAvailability({});
          setCalendarError(true);
        }
        return;
      }

      const membershipOrder = { PRIMARY: 0, SECONDARY: 1, FILL_IN: 2 } as const;
      const merged = new Map<string, CalendarGameRow>();
      for (const fixture of ((regularFixturesResult.data || []) as GameRow[])) {
        const membership = regularMemberships
          .filter((row) => row.teamId === fixture.home_team_id || row.teamId === fixture.away_team_id)
          .sort((a, b) => membershipOrder[a.membershipType] - membershipOrder[b.membershipType])[0];
        if (!membership) continue;
        merged.set(fixture.id, {
          ...fixture,
          membershipType: membership.membershipType,
          contextTeamId: membership.teamId,
        });
      }
      for (const fixture of ((fillInFixturesResult.data || []) as GameRow[])) {
        const fillIn = fillIns.find((row) => row.fixtureId === fixture.id);
        if (!fillIn || merged.has(fixture.id)) continue;
        merged.set(fixture.id, {
          ...fixture,
          membershipType: "FILL_IN",
          contextTeamId: fillIn.teamId,
        });
      }

      const nextGames = [...merged.values()].sort(
        (a, b) => new Date(a.fixture_date).getTime() - new Date(b.fixture_date).getTime(),
      );
      const fixtureIds = nextGames.map((fixture) => fixture.id);
      const availabilityResult = fixtureIds.length > 0
        ? await supabase
            .from("fixture_availability")
            .select("fixture_id, status")
            .eq("user_id", user.id)
            .in("fixture_id", fixtureIds)
        : { data: [], error: null };
      if (availabilityResult.error) {
        if (active) {
          setCalendarGames(nextGames);
          setAvailability({});
          setCalendarError(true);
        }
        return;
      }
      const nextAvailability: Record<string, AvailabilityStatus> = {};
      for (const row of availabilityResult.data || []) {
        if (row.status !== "NO_RESPONSE") nextAvailability[row.fixture_id] = row.status as AvailabilityStatus;
      }

      if (active) {
        setCalendarGames(nextGames);
        setAvailability(nextAvailability);
      }
    };

    void loadPlayerCalendar();
    return () => {
      active = false;
    };
  }, [user]);

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
      const [officialResult, activityResult] = await Promise.all([
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
    if (!user || availabilitySaving.has(gameId)) return;
    const previous = availability[gameId];
    const isClearing = previous === status;
    setAvailabilitySaving((current) => new Set(current).add(gameId));
    setAvailability((current) => {
      const next = { ...current };
      if (isClearing) delete next[gameId];
      else next[gameId] = status;
      return next;
    });

    const { error } = isClearing
      ? await supabase
          .from("fixture_availability")
          .delete()
          .eq("fixture_id", gameId)
          .eq("user_id", user.id)
      : await supabase
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
    } else if (isClearing) {
      toast({ title: "Availability cleared", description: "No response is selected for this fixture." });
    }
    setAvailabilitySaving((current) => {
      const next = new Set(current);
      next.delete(gameId);
      return next;
    });
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
    setSelectedCalendarDate(null);
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
    let startOffset = firstDayOfMonth.getDay() - 1;
    if (startOffset < 0) startOffset = 6;
    const startDate = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const value = new Date(startDate);
      value.setDate(startDate.getDate() + index);
      const dateKey = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
      const fixtures = calendarGames.filter((fixture) => {
        const fixtureDate = new Date(fixture.fixture_date);
        return fixtureDate.getFullYear() === value.getFullYear()
          && fixtureDate.getMonth() === value.getMonth()
          && fixtureDate.getDate() === value.getDate();
      });
      return {
        date: value.getDate(),
        dateKey,
        isCurrentMonth: value.getMonth() === month,
        isToday: value.toDateString() === today.toDateString(),
        fixtures,
      };
    });
  };

  const calendarDays = generateCalendarDays();
  const monthYearLabel = calendarMonth.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  const teamName = selectedTeam ? getTeamDisplayName(selectedTeam) : "Team";
  const isBrandNewUser = !accountLoading && roleCount === 0 && activeMembershipCount === 0;

  // A team can override its club, and a club can override the association.
  // Blank override fields deliberately inherit the next level up.
  const themePrimary = selectedTeam?.primary_colour
    || selectedClub?.primary_colour
    || selectedAssociation?.primary_colour
    || undefined;
  const themeSecondary = selectedTeam?.secondary_colour
    || selectedClub?.secondary_colour
    || selectedAssociation?.secondary_colour
    || undefined;
  const bannerUrl = selectedTeam?.banner_url
    || selectedClub?.banner_url
    || selectedAssociation?.banner_url
    || undefined;
  const logoUrl = selectedTeam?.logo_url
    || selectedClub?.logo_url
    || selectedAssociation?.logo_url
    || undefined;

  const brandStyle = themePrimary
    ? { backgroundColor: themePrimary, color: themeSecondary || "#fff" }
    : undefined;
  const canEditCurrentClub = selectedClubId ? canManageClub(selectedClubId) : false;
  const canManageCurrentTeam = selectedTeamId ? canManageTeam(selectedTeamId) : false;
  const canOpenFixtureDetail = Boolean(selectedTeamId);
  const selectedMembershipType = selectedTeamId ? teamMembershipTypes[selectedTeamId] : undefined;
  const playerFixtureIds = new Set(calendarGames.map((fixture) => fixture.id));
  const selectedDayFixtures = selectedCalendarDate
    ? calendarGames.filter((fixture) => {
        const fixtureDate = new Date(fixture.fixture_date);
        const key = `${fixtureDate.getFullYear()}-${String(fixtureDate.getMonth() + 1).padStart(2, "0")}-${String(fixtureDate.getDate()).padStart(2, "0")}`;
        return key === selectedCalendarDate;
      })
    : [];
  const membershipDotClass = {
    PRIMARY: "bg-blue-400",
    SECONDARY: "bg-violet-400",
    FILL_IN: "bg-amber-400",
  } as const;
  const availabilityRingClass = (status?: AvailabilityStatus) => {
    if (status === "AVAILABLE") return "ring-2 ring-green-300";
    if (status === "UNAVAILABLE") return "ring-2 ring-red-300";
    if (status === "MAYBE") return "ring-2 ring-yellow-200";
    return "ring-1 ring-white/70";
  };

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
        style={bannerUrl
          ? { backgroundImage: `linear-gradient(90deg, rgba(10,20,45,.9), rgba(10,20,45,.45)), url(${bannerUrl})` }
          : brandStyle}
        className={cn(
          "relative overflow-hidden bg-cover bg-center",
          !bannerUrl && !brandStyle && "bg-primary text-primary-foreground",
          bannerUrl && "text-white",
        )}
      >
        <CardContent className="relative flex min-h-44 items-end gap-4 px-5 py-5 sm:min-h-56 sm:px-7 sm:py-7">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={`${selectedTeam?.name || selectedClub?.name || "Club"} logo`}
              className="h-16 w-16 shrink-0 rounded-xl bg-white/90 object-contain p-1 sm:h-20 sm:w-20"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm opacity-80">Welcome back{profileName ? `, ${profileName}` : ""}</p>
            {selectedTeamId ? (
              <>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-semibold sm:text-2xl">{teamName}</h1>
                  {selectedMembershipType && (
                    <MembershipTypeBadge
                      membershipType={selectedMembershipType}
                      className="border-white/60 bg-white/90 text-slate-900"
                    />
                  )}
                </div>
                <p className="truncate text-sm opacity-80">
                  {[selectedClub?.name, selectedAssociation?.name].filter(Boolean).join(" • ")}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm">Select an association, club and team to open its dashboard.</p>
            )}
          </div>
          {["super_admin", "association", "club"].includes(activeMode)
            && (canEditCurrentClub || canManageCurrentTeam) && (
            <Link to={canManageCurrentTeam ? "/admin/teams" : "/admin/clubs"} className="hidden sm:block">
              <Button size="sm" variant="secondary" className="gap-2">
                <Pencil className="h-4 w-4" /> Edit branding
              </Button>
            </Link>
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
                fixturesError ? (
                  <div className="rounded-lg bg-primary-foreground/10 p-3 text-sm text-primary-foreground">
                    <p className="flex items-center gap-2 font-medium">
                      <AlertCircle className="h-4 w-4" /> Upcoming fixtures could not be loaded.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={() => setFixtureReloadKey((current) => current + 1)}
                    >
                      Try again
                    </Button>
                  </div>
                ) : (
                  <p className="text-primary-foreground/70 text-sm">No upcoming fixtures</p>
                )
              ) : (
                games.slice(0, 5).map((game) => {
                  const gameDate = new Date(game.fixture_date);
                  const homeTeam = game.home_team?.name ?? "Unknown";
                  const awayTeam = game.away_team?.name ?? "Unknown";
                  const venueName = game.venue?.name ?? "TBD";
                  const divisionName = game.divisions?.name;
                  const avail = availability[game.id];
                  const isHomeFixture = game.home_team_id === selectedTeamId;
                  const canSetAvailability = playerFixtureIds.has(game.id);

                  return (
                    <div
                      key={game.id}
                      className="rounded-lg bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/15"
                    >
                      {canOpenFixtureDetail ? (
                        <Link to={`/games/${game.id}`} className="block p-3 pb-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="border-primary-foreground/30 text-primary-foreground">
                                  {isHomeFixture ? "Home" : "Away"}
                                </Badge>
                                {divisionName && <span className="text-xs text-primary-foreground/70">{divisionName}</span>}
                              </div>
                              <p className="text-sm font-medium text-primary-foreground">
                                {homeTeam} vs {awayTeam}
                              </p>
                            </div>
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-primary-foreground/50" />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-foreground/75">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {gameDate.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {gameDate.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="flex min-w-0 items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{venueName}</span>
                            </span>
                          </div>
                        </Link>
                      ) : (
                        <div className="p-3 pb-2">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-primary-foreground/30 text-primary-foreground">
                              {isHomeFixture ? "Home" : "Away"}
                            </Badge>
                            {divisionName && <span className="text-xs text-primary-foreground/70">{divisionName}</span>}
                          </div>
                          <p className="text-sm font-medium text-primary-foreground">{homeTeam} vs {awayTeam}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-foreground/75">
                            <span>{gameDate.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}</span>
                            <span>{gameDate.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</span>
                            <span className="truncate">{venueName}</span>
                          </div>
                        </div>
                      )}

                      {(publishedLineupFixtureIds.has(game.id) || canSetAvailability) && (
                        <div className="space-y-2 border-t border-primary-foreground/15 px-3 py-2.5">
                          {publishedLineupFixtureIds.has(game.id) && (
                            <Badge className="border-0 bg-sky-500/25 text-sky-100">Line-up published</Badge>
                          )}
                          {canSetAvailability && (
                            <AvailabilityControls
                              current={avail}
                              saving={availabilitySaving.has(game.id)}
                              onChange={(status) => void handleAvailabilityChange(game.id, status)}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Calendar */}
        <div className="space-y-4">
          <Card style={brandStyle} className={`min-h-[300px] ${!brandStyle ? "bg-primary text-primary-foreground" : ""}`}>
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
              {calendarError && (
                <div className="mb-3 flex items-start gap-2 rounded-md bg-primary-foreground/10 p-2 text-xs text-primary-foreground">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Your full fixture calendar or availability could not be loaded. Please refresh and try again.
                </div>
              )}
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                  <div key={i} className="py-0.5 text-primary-foreground/70 font-medium">{day}</div>
                ))}
                {calendarDays.map((day) => (
                  <button
                    type="button"
                    key={day.dateKey}
                    onClick={() => day.fixtures.length > 0 && setSelectedCalendarDate(day.dateKey)}
                    className={`relative min-h-8 rounded-md py-1 text-xs ${
                      day.isToday
                        ? "bg-primary-foreground text-primary font-bold"
                        : day.isCurrentMonth
                        ? "text-primary-foreground font-medium"
                        : "text-primary-foreground/40"
                    } ${day.fixtures.length > 0 ? "cursor-pointer hover:bg-primary-foreground/10" : "cursor-default"}`}
                  >
                    <span>{day.date}</span>
                    {day.fixtures.length > 0 && (
                      <span className="absolute inset-x-0 bottom-0.5 flex justify-center gap-0.5" aria-label={`${day.fixtures.length} fixture${day.fixtures.length === 1 ? "" : "s"}`}>
                        {day.fixtures.slice(0, 3).map((fixture) => (
                          <span
                            key={fixture.id}
                            title={`${fixture.membershipType} fixture - ${availability[fixture.id] || "No response"}`}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              membershipDotClass[fixture.membershipType],
                              availabilityRingClass(availability[fixture.id]),
                            )}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-primary-foreground/80">
                {(["PRIMARY", "SECONDARY", "FILL_IN"] as const).map((type) => (
                  <span key={type} className="flex items-center gap-1">
                    <span className={cn("h-2 w-2 rounded-full", membershipDotClass[type])} />
                    {type === "FILL_IN" ? "Fill-in" : type.charAt(0) + type.slice(1).toLowerCase()}
                  </span>
                ))}
              </div>

              {selectedDayFixtures.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-primary-foreground/20 pt-3">
                  {selectedDayFixtures.map((fixture) => (
                    <div key={fixture.id} className="rounded-md bg-primary-foreground/10 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">
                          {fixture.home_team?.name || "Unknown"} vs {fixture.away_team?.name || "Unknown"}
                        </span>
                        <MembershipTypeBadge membershipType={fixture.membershipType} compact />
                      </div>
                      <p className="mt-1 text-primary-foreground/75">
                        {new Date(fixture.fixture_date).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                        {` • ${availabilityLabel(availability[fixture.id])}`}
                      </p>
                      <div className="mt-2">
                        <AvailabilityControls
                          current={availability[fixture.id]}
                          saving={availabilitySaving.has(fixture.id)}
                          compact
                          onChange={(status) => void handleAvailabilityChange(fixture.id, status)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

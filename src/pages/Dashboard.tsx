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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { getTeamDisplayName } from "@/lib/utils";

type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE" | "UNSURE" | "PENDING";

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

const FIXTURE_SELECT =
  "id, fixture_date, status, home_team_id, away_team_id, venue_id, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name), venue:venues!venue_id(id, name)";

const Dashboard = () => {
  const { selectedTeamId, selectedTeam, selectedClub } = useTeamContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const [games, setGames] = useState<GameRow[]>([]);
  const [availability, setAvailability] = useState<Record<string, AvailabilityStatus>>({});
  const [loading, setLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [profileName, setProfileName] = useState("");
  const [teamRequests, setTeamRequests] = useState<TeamRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [conflictRequest, setConflictRequest] = useState<TeamRequest | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

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
          (data || []).map(async (req: any) => {
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

            return {
              id: req.id,
              request_type: req.request_type,
              team_id: req.team_id,
              team_name: teamData?.name || "Unknown Team",
              club_name: (teamData?.clubs as any)?.name || "Unknown Club",
              membership_type: req.membership_type,
              requester_name: `${profileData?.first_name || ""} ${profileData?.last_name || ""}`.trim() || "Unknown",
              created_at: req.created_at,
            };
          })
        );

        setTeamRequests(requestsWithTeamInfo);
      } catch (err: any) {
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
        .order("fixture_date", { ascending: true })
        .limit(8);

      const gamesList = (gamesData as GameRow[]) || [];
      setGames(gamesList);

      // Fetch availability for these games
      if (user && gamesList.length > 0) {
        const gameIds = gamesList.map((g) => g.id);
        const { data: availData } = await supabase
          .from("fixture_availability")
          .select("fixture_id, status")
          .eq("user_id", user.id)
          .in("fixture_id", gameIds);

        const availMap: Record<string, AvailabilityStatus> = {};
        availData?.forEach((a) => {
          availMap[a.fixture_id] = a.status as AvailabilityStatus;
        });
        setAvailability(availMap);
      }

      setLoading(false);
    };
    fetchGames();
  }, [selectedTeamId, user]);

  const handleAvailabilityChange = async (gameId: string, status: AvailabilityStatus) => {
    if (!user) return;
    setAvailability((prev) => ({ ...prev, [gameId]: status }));

    await supabase
      .from("fixture_availability")
      .upsert({ fixture_id: gameId, user_id: user.id, status }, { onConflict: "fixture_id,user_id" });
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
        membership_type: finalMembershipType,
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
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
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
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
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

  // Club branding
  const clubPrimary = selectedClub?.primary_colour || undefined;
  const clubSecondary = selectedClub?.secondary_colour || undefined;
  const clubBannerUrl = (selectedClub as any)?.banner_url || undefined;
  const clubLogoUrl = selectedClub?.logo_url || undefined;

  const brandStyle = clubPrimary
    ? { backgroundColor: clubPrimary, color: clubSecondary || "#fff" }
    : undefined;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Welcome Banner */}
      <Card style={brandStyle} className={!brandStyle ? "bg-primary text-primary-foreground" : ""}>
        <CardContent className="py-4 px-6">
          <p className="text-lg font-medium">
            Welcome back{profileName ? `, ${profileName}` : ""}!
          </p>
          <p className="text-sm opacity-70 mt-1">
            {selectedClub?.name || "Select a club"} • {teamName}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-[7fr_3fr] gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Club Banner */}
          <Card
            className={`h-[260px] overflow-hidden ${!clubBannerUrl && !brandStyle ? "bg-primary text-primary-foreground" : ""}`}
            style={!clubBannerUrl ? brandStyle : undefined}
          >
            <CardContent className="flex items-center justify-center h-full py-8 relative">
              {clubBannerUrl ? (
                <img
                  src={clubBannerUrl}
                  alt={`${selectedClub?.name} banner`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : null}
              <div className={`text-center relative z-10 ${clubBannerUrl ? "bg-background/80 backdrop-blur-sm rounded-xl px-6 py-4" : ""}`}>
                {clubLogoUrl && (
                  <img src={clubLogoUrl} alt={selectedClub?.name} className="h-16 w-16 mx-auto mb-3 object-contain" />
                )}
                <h2 className="text-xl font-bold mb-2">{selectedClub?.name || "Select a club"}</h2>
                <p className="opacity-80">
                  {selectedClub?.home_ground || "Club banner"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Fixtures */}
          <Card style={brandStyle} className={!brandStyle ? "bg-primary text-primary-foreground" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-primary-foreground">
                Upcoming fixtures
              </CardTitle>
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
                games.slice(0, 4).map((game) => {
                  const gameDate = new Date(game.fixture_date);
                  const homeTeam = game.home_team?.name ?? "Unknown";
                  const awayTeam = game.away_team?.name ?? "Unknown";
                  const venueName = game.venue?.name ?? "TBD";
                  const avail = availability[game.id];

                  return (
                    <Link
                      key={game.id}
                      to={`/games/${game.id}`}
                      className="block p-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm">
                          {homeTeam} vs {awayTeam}
                        </p>
                        <ChevronRight className="h-4 w-4 text-primary-foreground/50 flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-primary-foreground/70 mb-2">
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

                      {/* Availability buttons */}
                      <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                        {(["AVAILABLE", "UNAVAILABLE", "UNSURE"] as const).map((status) => {
                          const config = {
                            AVAILABLE: { icon: Check, label: "Available", active: "bg-green-500 text-white", inactive: "bg-green-500/20 text-green-200" },
                            UNAVAILABLE: { icon: X, label: "Not Available", active: "bg-red-500 text-white", inactive: "bg-red-500/20 text-red-200" },
                            UNSURE: { icon: HelpCircle, label: "Unsure", active: "bg-yellow-500 text-white", inactive: "bg-yellow-500/20 text-yellow-200" },
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
                    </Link>
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

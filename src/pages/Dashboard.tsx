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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeamContext } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
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

const FIXTURE_SELECT =
  "id, fixture_date, status, home_team_id, away_team_id, venue_id, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name), venue:venues!venue_id(id, name)";

const Dashboard = () => {
  const { selectedTeamId, selectedTeam, selectedClub } = useTeamContext();
  const { user } = useAuth();
  const [games, setGames] = useState<GameRow[]>([]);
  const [availability, setAvailability] = useState<Record<string, AvailabilityStatus>>({});
  const [loading, setLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [profileName, setProfileName] = useState("");

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

          {/* Upcoming Games */}
          <Card style={brandStyle} className={!brandStyle ? "bg-primary text-primary-foreground" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-primary-foreground">
                Upcoming games
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
                <p className="text-primary-foreground/70 text-sm">No upcoming games</p>
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
    </div>
  );
};

export default Dashboard;

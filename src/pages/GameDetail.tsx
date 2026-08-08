import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  MapPin,
  Clock,
  Calendar,
  Users,
  Check,
  X,
  HelpCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTeamContext } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getLineupAccess, type LineupAccess } from "@/lib/lineupAccess";
import {
  getFixtureDisplayStatus,
  getFixtureMatchupLabel,
  isByeFixtureDisplay,
} from "@/lib/fixtureDisplay";

type AvailabilityStatus = Database["public"]["Enums"]["availability_status_enum"];

const availabilityStatusLabel = (status: AvailabilityStatus) => {
  if (status === "AVAILABLE") return "available";
  if (status === "UNAVAILABLE") return "unavailable";
  if (status === "MAYBE") return "maybe";
  return "no response";
};

interface GameRow {
  id: string;
  fixture_date: string;
  status: string;
  home_team_id: string | null;
  away_team_id: string | null;
  venue_id: string | null;
  home_team: { id: string; name: string } | null;
  away_team: { id: string; name: string } | null;
  venue: { id: string; name: string } | null;
  home_score: number | null;
  away_score: number | null;
  round_number: number | null;
}

const FIXTURE_SELECT =
  "id, fixture_date, status, home_score, away_score, round_number, venue_id, home_team_id, away_team_id, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name), venue:venues!venue_id(id, name)";

interface TeamMember {
  row_id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  jersey_number: string | number | null;
  membership_type: string | null;
  played: boolean;
  is_fill_in: boolean;
  goals: number;
  green_cards: number;
  yellow_cards: number;
  red_cards: number;
  availability_status: AvailabilityStatus;
}

interface MatchAppearance {
  id: string;
  player_name: string;
  profile_id: string | null;
  jersey: string | null;
  team_side: string | null;
  is_fillin: boolean;
  goals: number | null;
  green_cards: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
}

const GameDetail = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedTeam } = useTeamContext();
  const [game, setGame] = useState<GameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<AvailabilityStatus>("NO_RESPONSE");
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [lineupAccess, setLineupAccess] = useState<LineupAccess | null>(null);
  const [hasVisibleLineup, setHasVisibleLineup] = useState(false);

  useEffect(() => {
    const fetchGame = async () => {
      if (!id) return;
      setLoading(true);

      const { data: gameData } = await supabase
        .from("fixtures")
        .select(FIXTURE_SELECT)
        .eq("id", id)
        .single();

      if (gameData) {
        const fixture = gameData as GameRow;
        setGame(fixture);
        const access = await getLineupAccess(user?.id, fixture);
        setLineupAccess(access);
        setHasVisibleLineup(false);

        if (access.visibleTeamIds.length > 0) {
          const { data: lineupRows } = await supabase
            .from("fixture_lineups")
            .select("id")
            .eq("fixture_id", id)
            .in("team_id", access.visibleTeamIds)
            .limit(1);
          setHasVisibleLineup((lineupRows || []).length > 0);
        }

        // Fetch current user's availability
        if (user) {
          const { data: avail } = await supabase
            .from("fixture_availability")
            .select("status")
            .eq("fixture_id", id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (avail) setAvailability(avail.status as AvailabilityStatus);
        }

        // Fetch team members with their availability for this game
        const membershipTeamId =
          selectedTeam?.id === fixture.home_team_id || selectedTeam?.id === fixture.away_team_id
            ? selectedTeam.id
            : fixture.home_team_id ?? fixture.away_team_id;
        if (!membershipTeamId) {
          setLoading(false);
          return;
        }
        const side = membershipTeamId === fixture.home_team_id ? "home" : "away";
        const [membersResult, fillInsResult, appearancesResult] = await Promise.all([
          supabase
          .from("team_memberships")
          .select("user_id, position, jersey_number, membership_type")
          .eq("team_id", membershipTeamId)
          .eq("status", "ACTIVE"),
          supabase
            .from("fixture_fill_ins")
            .select("id, player_id")
            .eq("fixture_id", id)
            .eq("team_id", membershipTeamId)
            .eq("status", "SELECTED"),
          supabase
            .from("revsports_players")
            .select("id, player_name, profile_id, jersey, team_side, is_fillin, goals, green_cards, yellow_cards, red_cards")
            .eq("fixture_id", id)
            .eq("team_side", side)
            .eq("attended", true)
            .eq("is_removed", false),
        ]);

        const members = membersResult.data || [];
        const fillIns = fillInsResult.data || [];
        const appearances = (appearancesResult.data || []) as MatchAppearance[];

        if (members.length > 0 || fillIns.length > 0 || appearances.length > 0) {
          // Historical Dev data can contain duplicate active memberships. Keep one
          // visible player while preserving any useful number or position stored on
          // either row. Database guards prevent new duplicates from being created.
          const uniqueMembers = Array.from(
            members.reduce((byUser, member) => {
              const existing = byUser.get(member.user_id);
              byUser.set(member.user_id, {
                user_id: member.user_id,
                position: existing?.position || member.position,
                jersey_number: existing?.jersey_number || member.jersey_number,
                membership_type: existing?.membership_type || member.membership_type,
              });
              return byUser;
            }, new Map<string, (typeof members)[number]>()),
          ).map(([, member]) => member);
          const userIds = Array.from(new Set([
            ...uniqueMembers.map((member) => member.user_id),
            ...fillIns.map((fillIn) => fillIn.player_id),
            ...appearances.map((appearance) => appearance.profile_id).filter(Boolean) as string[],
          ]));

          const [profilesRes, availRes] = await Promise.all([
            userIds.length > 0
              ? supabase.from("profiles").select("id, first_name, last_name").in("id", userIds)
              : Promise.resolve({ data: [], error: null }),
            userIds.length > 0
              ? supabase.from("fixture_availability").select("user_id, status").eq("fixture_id", id).in("user_id", userIds)
              : Promise.resolve({ data: [], error: null }),
          ]);

          const profiles = profilesRes.data || [];
          const avails = availRes.data || [];

          const appearanceByProfile = new Map(
            appearances
              .filter((appearance) => appearance.profile_id)
              .map((appearance) => [appearance.profile_id as string, appearance]),
          );
          const fillInIds = new Set(fillIns.map((fillIn) => fillIn.player_id));
          const membershipByUser = new Map(uniqueMembers.map((member) => [member.user_id, member]));

          const linkedMembers: TeamMember[] = userIds.map((userId) => {
            const m = membershipByUser.get(userId);
            const profile = profiles.find((p) => p.id === userId);
            const avail = avails.find((a) => a.user_id === userId);
            const appearance = appearanceByProfile.get(userId);
            const isFillIn = fillInIds.has(userId) || appearance?.is_fillin === true;
            return {
              row_id: `profile-${userId}`,
              user_id: userId,
              first_name: profile?.first_name || null,
              last_name: profile?.last_name || null,
              position: m?.position || null,
              jersey_number: m?.jersey_number || appearance?.jersey || null,
              membership_type: m?.membership_type || null,
              played: Boolean(appearance),
              is_fill_in: isFillIn,
              goals: appearance?.goals || 0,
              green_cards: appearance?.green_cards || 0,
              yellow_cards: appearance?.yellow_cards || 0,
              red_cards: appearance?.red_cards || 0,
              availability_status: (avail?.status as AvailabilityStatus) || "NO_RESPONSE",
            };
          });

          const unlinkedAppearances: TeamMember[] = appearances
            .filter((appearance) => !appearance.profile_id)
            .map((appearance) => {
              const nameParts = appearance.player_name.trim().split(/\s+/);
              return {
                row_id: `appearance-${appearance.id}`,
                user_id: null,
                first_name: nameParts.shift() || appearance.player_name,
                last_name: nameParts.join(" ") || null,
                position: null,
                jersey_number: appearance.jersey,
                membership_type: null,
                played: true,
                is_fill_in: appearance.is_fillin,
                goals: appearance.goals || 0,
                green_cards: appearance.green_cards || 0,
                yellow_cards: appearance.yellow_cards || 0,
                red_cards: appearance.red_cards || 0,
                availability_status: "NO_RESPONSE",
              };
            });

          const orderedMembers = [...linkedMembers, ...unlinkedAppearances].sort((a, b) => {
            const group = (member: TeamMember) => member.played ? (member.is_fill_in ? 1 : 0) : 2;
            const groupDifference = group(a) - group(b);
            if (groupDifference !== 0) return groupDifference;
            return `${a.first_name || ""} ${a.last_name || ""}`.localeCompare(
              `${b.first_name || ""} ${b.last_name || ""}`,
              "en-AU",
            );
          });
          setTeamMembers(orderedMembers);
        } else {
          setTeamMembers([]);
        }
      }
      setLoading(false);
    };
    fetchGame();
  }, [id, user, selectedTeam?.id]);

  const handleAvailability = async (status: AvailabilityStatus) => {
    if (!user || !id || availabilitySaving) return;

    const previous = availability;
    const isClearing = previous === status;
    const nextStatus: AvailabilityStatus = isClearing ? "NO_RESPONSE" : status;
    setAvailabilitySaving(true);
    setAvailability(nextStatus);

    const { error } = isClearing
      ? await supabase
          .from("fixture_availability")
          .delete()
          .eq("fixture_id", id)
          .eq("user_id", user.id)
      : await supabase
          .from("fixture_availability")
          .upsert(
            { fixture_id: id, user_id: user.id, status },
            { onConflict: "fixture_id,user_id" }
          );

    if (error) {
      setAvailability(previous);
      toast({
        title: "Availability not saved",
        description: "Please try again.",
        variant: "destructive",
      });
    } else {
      setTeamMembers((current) => current.map((member) => (
        member.user_id === user.id ? { ...member, availability_status: nextStatus } : member
      )));
      toast(isClearing
        ? { title: "Availability cleared", description: "No response is selected for this fixture." }
        : { title: "Availability updated", description: `You are now marked as ${availabilityStatusLabel(status)}.` });
    }
    setAvailabilitySaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Game not found</p>
        <Link to="/games">
          <Button variant="link">Back to games</Button>
        </Link>
      </div>
    );
  }

  const fixtureDisplay = {
    fixtureDate: game.fixture_date,
    status: game.status,
    homeTeam: game.home_team,
    awayTeam: game.away_team,
  };
  const isBye = isByeFixtureDisplay(fixtureDisplay);
  const displayStatus = getFixtureDisplayStatus(fixtureDisplay);
  const venueName = game.venue?.name ?? "TBD";
  const gameDate = new Date(game.fixture_date);
  const isCompleted = displayStatus === "COMPLETED" || displayStatus === "FINALISED";

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/games">
        <Button variant="ghost" size="sm" className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back to Games
        </Button>
      </Link>

      {/* Game Header Card */}
      <Card variant="gradient">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span />
            <Badge variant={displayStatus === "SCHEDULED" ? "scheduled" : "finalised"}>
              {displayStatus}
            </Badge>
          </div>

          <div className="py-8 text-center">
            {game.round_number !== null && game.round_number !== undefined && (
              <p className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Round {game.round_number}
              </p>
            )}
            {isBye ? (
              <p className="font-display text-3xl text-foreground md:text-4xl">
                {getFixtureMatchupLabel(fixtureDisplay)}
              </p>
            ) : (
              <>
                <p className="font-display text-3xl text-foreground md:text-4xl">{game.home_team?.name ?? "Unknown"}</p>
                {isCompleted && game.home_score !== null && game.away_score !== null ? (
                  <p className="my-3 font-display text-4xl text-foreground">
                    {game.home_score} – {game.away_score}
                  </p>
                ) : (
                  <p className="my-3 text-xl text-muted-foreground">vs</p>
                )}
                <p className="font-display text-3xl text-foreground md:text-4xl">{game.away_team?.name ?? "Unknown"}</p>
              </>
            )}
          </div>

          <div className={cn("grid gap-4 border-t border-border py-4 text-center", isBye ? "grid-cols-1" : "grid-cols-3")}>
            <div>
              <Calendar className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-sm font-medium text-foreground">
                {gameDate.toLocaleDateString("en-AU", { weekday: "short", month: "short", day: "numeric" })}
              </p>
            </div>
            {!isBye && (
              <>
                <div>
                  <Clock className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm font-medium text-foreground">
                    {gameDate.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div>
                  <MapPin className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm font-medium text-foreground truncate px-2">
                    {venueName}
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Availability Section */}
      {displayStatus === "SCHEDULED" && !isBye && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Availability</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Let your coach know if you can play in this match.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <AvailabilityButton status="AVAILABLE" current={availability} saving={availabilitySaving} onClick={() => handleAvailability("AVAILABLE")} icon={<Check className="h-5 w-5" />} label="Available" />
              <AvailabilityButton status="UNAVAILABLE" current={availability} saving={availabilitySaving} onClick={() => handleAvailability("UNAVAILABLE")} icon={<X className="h-5 w-5" />} label="Unavailable" />
              <AvailabilityButton status="MAYBE" current={availability} saving={availabilitySaving} onClick={() => handleAvailability("MAYBE")} icon={<HelpCircle className="h-5 w-5" />} label="Maybe" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members & Availability */}
      {teamMembers.length > 0 && !isBye && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{isCompleted ? "Match Players & Availability" : "Team Availability"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div key={member.row_id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                      {member.jersey_number || "?"}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {[member.first_name, member.last_name].filter(Boolean).join(" ") || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.position || "No position"}</p>
                      {isCompleted && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                          {member.played && <Badge variant="available">Played</Badge>}
                          {member.is_fill_in && <Badge variant="secondary">Fill-in</Badge>}
                          {member.goals > 0 && <Badge variant="outline">{member.goals} goal{member.goals === 1 ? "" : "s"}</Badge>}
                          {member.green_cards > 0 && <Badge variant="outline" className="border-green-600 text-green-700">{member.green_cards} green</Badge>}
                          {member.yellow_cards > 0 && <Badge variant="outline" className="border-yellow-500 text-yellow-700">{member.yellow_cards} yellow</Badge>}
                          {member.red_cards > 0 && <Badge variant="outline" className="border-red-600 text-red-700">{member.red_cards} red</Badge>}
                          {!member.played && member.availability_status === "AVAILABLE" && (
                            <Badge variant="outline">Available • not selected</Badge>
                          )}
                          {member.played && member.availability_status === "NO_RESPONSE" && (
                            <Badge variant="outline">Played • no response</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      member.availability_status === "AVAILABLE" ? "available" :
                      member.availability_status === "UNAVAILABLE" ? "destructive" :
                      member.availability_status === "MAYBE" ? "secondary" : "outline"
                    }
                    className="text-xs"
                  >
                    {member.availability_status === "NO_RESPONSE"
                      ? "No response"
                      : availabilityStatusLabel(member.availability_status).replace(/^./, (letter) => letter.toUpperCase())}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!isBye && lineupAccess?.canView && (lineupAccess.canEdit || hasVisibleLineup) && (
        <div className="flex gap-3">
          <Link to={`/games/${id}/lineup`} className="flex-1">
            <Button variant="default" className="w-full">
              <Users className="h-4 w-4 mr-2" />
              View Lineup
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
};

interface AvailabilityButtonProps {
  status: AvailabilityStatus;
  current: AvailabilityStatus;
  saving: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const AvailabilityButton = ({ status, current, saving, onClick, icon, label }: AvailabilityButtonProps) => {
  const isSelected = status === current;
  const variants: Record<AvailabilityStatus, { selected: string; default: string }> = {
    AVAILABLE: { selected: "bg-success text-success-foreground border-success", default: "border-success/60 bg-success/5 text-success hover:bg-success/10" },
    UNAVAILABLE: { selected: "bg-destructive text-destructive-foreground border-destructive", default: "border-destructive/60 bg-destructive/5 text-destructive hover:bg-destructive/10" },
    MAYBE: { selected: "bg-warning text-warning-foreground border-warning", default: "border-warning/70 bg-warning/10 text-foreground hover:bg-warning/20" },
    NO_RESPONSE: { selected: "", default: "" },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      aria-pressed={isSelected}
      aria-label={`${label}${isSelected ? "; selected; select again to clear" : ""}`}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 disabled:cursor-wait disabled:opacity-60",
        isSelected ? variants[status].selected : variants[status].default
      )}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
};

export default GameDetail;

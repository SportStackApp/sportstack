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
  home_score: number | null;
  away_score: number | null;
}

const FIXTURE_SELECT =
  "id, fixture_date, status, home_score, away_score, venue_id, home_team_id, away_team_id, home_team:teams!home_team_id(id, name), away_team:teams!away_team_id(id, name), venue:venues!venue_id(id, name)";

interface TeamMember {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  jersey_number: number | null;
  availability_status: AvailabilityStatus;
}

const GameDetail = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedTeam } = useTeamContext();
  const [game, setGame] = useState<GameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<AvailabilityStatus>("PENDING");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

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
            : fixture.home_team_id;
        const { data: members } = await supabase
          .from("team_memberships")
          .select("user_id, position, jersey_number")
          .eq("team_id", membershipTeamId)
          .eq("status", "ACTIVE");

        if (members && members.length > 0) {
          const userIds = members.map((m) => m.user_id);

          const [profilesRes, availRes] = await Promise.all([
            supabase.from("teammate_profiles").select("id, first_name, last_name").in("id", userIds),
            supabase.from("fixture_availability").select("user_id, status").eq("fixture_id", id).in("user_id", userIds),
          ]);

          const profiles = profilesRes.data || [];
          const avails = availRes.data || [];

          const merged: TeamMember[] = members.map((m) => {
            const profile = profiles.find((p) => p.id === m.user_id);
            const avail = avails.find((a) => a.user_id === m.user_id);
            return {
              user_id: m.user_id,
              first_name: profile?.first_name || null,
              last_name: profile?.last_name || null,
              position: m.position,
              jersey_number: m.jersey_number,
              availability_status: (avail?.status as AvailabilityStatus) || "PENDING",
            };
          });
          setTeamMembers(merged);
        }
      }
      setLoading(false);
    };
    fetchGame();
  }, [id, user, selectedTeam?.id]);

  const handleAvailability = async (status: AvailabilityStatus) => {
    if (!user || !id) return;

    const { error } = await supabase
      .from("fixture_availability")
      .upsert(
        { fixture_id: id, user_id: user.id, status },
        { onConflict: "fixture_id,user_id" }
      );

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update availability.",
        variant: "destructive",
      });
    } else {
      setAvailability(status);
      toast({
        title: "Availability Updated",
        description: `You are now marked as ${status.toLowerCase()}.`,
      });
    }
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

  const homeTeam = game.home_team?.name ?? "Unknown";
  const awayTeam = game.away_team?.name ?? "Unknown";
  const venueName = game.venue?.name ?? "TBD";
  const gameDate = new Date(game.fixture_date);

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
            <Badge variant={game.status === "scheduled" ? "scheduled" : "finalised"}>
              {game.status}
            </Badge>
          </div>

          <div className="text-center py-8">
            <p className="font-display text-3xl md:text-4xl text-foreground">{homeTeam}</p>
            <p className="text-muted-foreground text-xl my-3">vs</p>
            <p className="font-display text-3xl md:text-4xl text-foreground">{awayTeam}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center py-4 border-t border-border">
            <div>
              <Calendar className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-sm font-medium text-foreground">
                {gameDate.toLocaleDateString("en-AU", { weekday: "short", month: "short", day: "numeric" })}
              </p>
            </div>
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
          </div>
        </CardContent>
      </Card>

      {/* Availability Section */}
      {game.status === "scheduled" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Availability</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Let your coach know if you can play in this match.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <AvailabilityButton status="AVAILABLE" current={availability} onClick={() => handleAvailability("AVAILABLE")} icon={<Check className="h-5 w-5" />} label="Available" />
              <AvailabilityButton status="UNAVAILABLE" current={availability} onClick={() => handleAvailability("UNAVAILABLE")} icon={<X className="h-5 w-5" />} label="Unavailable" />
              <AvailabilityButton status="UNSURE" current={availability} onClick={() => handleAvailability("UNSURE")} icon={<HelpCircle className="h-5 w-5" />} label="Unsure" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members & Availability */}
      {teamMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Team Availability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                      {member.jersey_number || "?"}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {[member.first_name, member.last_name].filter(Boolean).join(" ") || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.position || "No position"}</p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      member.availability_status === "AVAILABLE" ? "available" :
                      member.availability_status === "UNAVAILABLE" ? "destructive" :
                      member.availability_status === "UNSURE" ? "secondary" : "outline"
                    }
                    className="text-xs"
                  >
                    {member.availability_status === "PENDING" ? "No response" : member.availability_status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Link to={`/games/${id}/lineup`} className="flex-1">
          <Button variant="default" className="w-full">
            <Users className="h-4 w-4 mr-2" />
            View Lineup
          </Button>
        </Link>
      </div>
    </div>
  );
};

interface AvailabilityButtonProps {
  status: AvailabilityStatus;
  current: AvailabilityStatus;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const AvailabilityButton = ({ status, current, onClick, icon, label }: AvailabilityButtonProps) => {
  const isSelected = status === current;
  const variants = {
    AVAILABLE: { selected: "bg-success text-success-foreground border-success", default: "border-success/50 text-success hover:bg-success/10" },
    UNAVAILABLE: { selected: "bg-destructive text-destructive-foreground border-destructive", default: "border-destructive/50 text-destructive hover:bg-destructive/10" },
    UNSURE: { selected: "bg-warning text-warning-foreground border-warning", default: "border-warning/50 text-warning-foreground hover:bg-warning/10" },
    PENDING: { selected: "", default: "" },
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
        isSelected ? variants[status].selected : variants[status].default
      )}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
};

export default GameDetail;

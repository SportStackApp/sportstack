import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MembershipTypeBadge } from "@/components/MembershipTypeBadge";
import { membershipPriority } from "@/lib/playerPositions";
import { useTeamContext } from "@/contexts/TeamContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HOCKEY_POSITION_AREAS, HOCKEY_POSITION_SIDES, areaPositionCode, sidePositionCode } from "@/lib/hockeyPositions";

interface TeamOption { id: string; name: string }
interface Player {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  jersey_number: number | null;
  membership_type: string;
  assessments: { position_code: string; assessment: number | null }[];
}

function assessmentSummary(assessments: Player["assessments"]): string {
  const strongest = assessments
    .filter((assessment): assessment is { position_code: string; assessment: number } => assessment.assessment !== null)
    .sort((left, right) => left.assessment - right.assessment);
  const area = HOCKEY_POSITION_AREAS.find((option) =>
    strongest.some((assessment) => assessment.position_code === areaPositionCode(option.value)),
  )?.label;
  const side = HOCKEY_POSITION_SIDES.find((option) =>
    strongest.some((assessment) => assessment.position_code === sidePositionCode(option.value)),
  )?.label;
  return [side, area].filter(Boolean).join(" ") || "No position assessed";
}

export default function CoachingSquad() {
  const { user } = useAuth();
  const { selectedTeamId } = useTeamContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const selectedRosterTeamId = searchParams.get("team") || "";

  useEffect(() => {
    let active = true;
    async function loadTeamOptions() {
      if (!user) return;
      setLoading(true);
      setError(null);
      const { data: roles, error: roleError } = await supabase
        .from("user_roles")
        .select("role, team_id")
        .eq("user_id", user.id)
        .in("role", ["SUPER_ADMIN", "COACH", "TEAM_MANAGER"]);
      if (roleError) {
        setError(roleError.message);
        setLoading(false);
        return;
      }

      const isSuperAdmin = (roles || []).some((role) => role.role === "SUPER_ADMIN");
      const roleTeamIds = (roles || [])
        .filter((role) => role.role === "COACH" || role.role === "TEAM_MANAGER")
        .map((role) => role.team_id)
        .filter((teamId): teamId is string => Boolean(teamId));
      const authorisedTeamIds = isSuperAdmin
        ? [selectedTeamId].filter((teamId): teamId is string => Boolean(teamId))
        : Array.from(new Set(roleTeamIds));

      if (authorisedTeamIds.length === 0) {
        if (active) {
          setHasAccess(false);
          setLoading(false);
        }
        return;
      }

      const { data: teamRows, error: teamError } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", authorisedTeamIds)
        .order("name");
      if (teamError) {
        setError(teamError.message);
        setLoading(false);
        return;
      }
      if (!active) return;
      const nextTeams = (teamRows || []) as TeamOption[];
      setTeams(nextTeams);
      setHasAccess(true);
      const requestedTeam = nextTeams.some((team) => team.id === selectedRosterTeamId)
        ? selectedRosterTeamId
        : nextTeams[0]?.id || "";
      if (requestedTeam && requestedTeam !== selectedRosterTeamId) {
        setSearchParams({ team: requestedTeam }, { replace: true });
      }
    }
    void loadTeamOptions();
    return () => { active = false; };
  }, [selectedRosterTeamId, selectedTeamId, setSearchParams, user]);

  useEffect(() => {
    let active = true;
    async function loadPlayers() {
      if (!user || !selectedRosterTeamId || !teams.some((team) => team.id === selectedRosterTeamId)) return;
      setLoading(true);
      setError(null);
      try {
        const { data: memberships, error: membershipsError } = await supabase
          .from("team_memberships")
          .select("user_id, membership_type, jersey_number")
          .eq("team_id", selectedRosterTeamId)
          .eq("status", "ACTIVE");
        if (membershipsError) throw membershipsError;

        const playerIds = Array.from(new Set((memberships || []).map((membership) => membership.user_id)));
        const [profileResult, assessmentResult] = await Promise.all([
          playerIds.length
            ? supabase.from("profiles").select("id, first_name, last_name, avatar_url").in("id", playerIds)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("coach_position_assessments")
            .select("player_id, position_code, assessment")
            .eq("coach_id", user.id)
            .eq("team_id", selectedRosterTeamId),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (assessmentResult.error) throw assessmentResult.error;

        const profiles = new Map((profileResult.data || []).map((profile) => [profile.id, profile]));
        const assessments = new Map<string, Player["assessments"]>();
        (assessmentResult.data || []).forEach((assessment) => {
          assessments.set(assessment.player_id, [
            ...(assessments.get(assessment.player_id) || []),
            { position_code: assessment.position_code, assessment: assessment.assessment },
          ]);
        });

        const byPlayer = new Map<string, Player>();
        (memberships || []).forEach((membership) => {
          const profile = profiles.get(membership.user_id);
          const candidate: Player = {
            user_id: membership.user_id,
            first_name: profile?.first_name || "Unknown",
            last_name: profile?.last_name || "",
            avatar_url: profile?.avatar_url || null,
            jersey_number: membership.jersey_number,
            membership_type: membership.membership_type,
            assessments: assessments.get(membership.user_id) || [],
          };
          const current = byPlayer.get(membership.user_id);
          if (!current || (membershipPriority[candidate.membership_type] || 0) > (membershipPriority[current.membership_type] || 0)) {
            byPlayer.set(membership.user_id, candidate);
          }
        });
        const nextPlayers = Array.from(byPlayer.values()).sort((left, right) => {
          const priority = (membershipPriority[right.membership_type] || 0) - (membershipPriority[left.membership_type] || 0);
          return priority || `${left.first_name} ${left.last_name}`.localeCompare(`${right.first_name} ${right.last_name}`, "en-AU");
        });
        if (active) setPlayers(nextPlayers);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "The squad could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadPlayers();
    return () => { active = false; };
  }, [selectedRosterTeamId, teams, user]);

  const membershipCounts = useMemo(() => players.reduce(
    (counts, player) => ({ ...counts, [player.membership_type]: (counts[player.membership_type] || 0) + 1 }),
    {} as Record<string, number>,
  ), [players]);
  const teamName = teams.find((team) => team.id === selectedRosterTeamId)?.name;

  if (!hasAccess && !loading) {
    return <div className="p-12 text-center"><h2 className="text-2xl font-bold text-destructive">Access denied</h2><p className="mt-2 text-muted-foreground">You need a Coach or Team Manager role to access this page.</p></div>;
  }
  if (error) {
    return <div className="p-12 text-center"><h2 className="text-2xl font-bold text-destructive">Squad unavailable</h2><p className="mt-2 text-muted-foreground">{error}</p></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="font-display text-3xl font-bold uppercase tracking-tight">My Squad</h1>{teamName && <p className="mt-1 text-muted-foreground">{teamName}</p>}</div>
        {teams.length > 1 && (
          <label className="w-full space-y-1 text-sm font-medium sm:w-72">
            Team
            <Select value={selectedRosterTeamId} onValueChange={(team) => setSearchParams({ team })}>
              <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue placeholder="Select team" /></SelectTrigger>
              <SelectContent>{teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["PRIMARY", "SECONDARY", "FILL_IN"] as const).map((type) => (
          <Badge key={type} variant="outline" className="gap-2 px-3 py-1.5"><MembershipTypeBadge membershipType={type} compact /><span>{membershipCounts[type] || 0}</span></Badge>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-40" />)}</div>
      ) : players.length === 0 ? (
        <Card className="border-dashed p-12 text-center"><p className="text-muted-foreground">No players found in this squad.</p></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => {
            const initials = `${player.first_name[0] || ""}${player.last_name[0] || ""}`;
            return (
              <Card key={player.user_id} className="transition-shadow hover:shadow-md">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 border"><AvatarImage src={player.avatar_url || undefined} /><AvatarFallback>{initials}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">{player.first_name} {player.last_name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2"><MembershipTypeBadge membershipType={player.membership_type} compact />{player.jersey_number != null && <Badge variant="secondary">#{player.jersey_number}</Badge>}</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{assessmentSummary(player.assessments)}</p>
                  <Button variant="outline" className="w-full" onClick={() => navigate(`/coaching/${player.user_id}?team=${selectedRosterTeamId}`)}>View player</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

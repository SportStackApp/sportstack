import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase as originalSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Award, Calendar, CheckCircle2, Clock, History, Send, ShieldAlert, Star } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = originalSupabase as any;

interface MvpSession {
  id: string;
  fixture_id: string;
  match_url: string | null;
  grade: string;
  round: string;
  game_date: string;
  home_team: string;
  away_team: string;
  status: string;
  opened_at: string | null;
  closes_at: string | null;
}

interface RevsportsPlayerRow {
  id: string;
  fixture_id: string;
  player_name: string;
  team: string | null;
  team_side: string | null;
  team_label: string | null;
  jersey: string | null;
  profile_id: string | null;
}

interface SubmissionRow {
  session_id: string;
}

interface VoteRow {
  session_id: string;
  player_id: string;
  points: number;
}

interface FixtureScopeRow {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team?: TeamScopeRow | null;
  away_team?: TeamScopeRow | null;
}

interface TeamScopeRow {
  id: string;
  name: string;
  club_id: string | null;
  clubs?: {
    id: string;
    name: string;
    association_id: string | null;
  } | null;
}

type TileState = "open-unsubmitted" | "open-submitted" | "closed-submitted" | "closed-unsubmitted";

interface SessionTile extends MvpSession {
  tileState: TileState;
  hasSubmitted: boolean;
}

const getSameSidePlayers = (
  players: RevsportsPlayerRow[],
  fixtureId: string,
  userId: string,
) => {
  const fixturePlayers = players.filter((player) => player.fixture_id === fixtureId);
  const voterRow = fixturePlayers.find((player) => player.profile_id === userId);

  if (!voterRow) return [];

  const sameSide = (player: RevsportsPlayerRow) => {
    if (voterRow.team_side && player.team_side) {
      return player.team_side === voterRow.team_side;
    }
    if (voterRow.team_label && player.team_label) {
      return player.team_label === voterRow.team_label;
    }
    return (player.team == null && voterRow.team == null) || player.team === voterRow.team;
  };

  return fixturePlayers
    .filter((player) => sameSide(player) && player.id !== voterRow.id && player.profile_id !== userId)
    .sort((a, b) => a.player_name.localeCompare(b.player_name));
};

const getTileState = (session: MvpSession, hasSubmitted: boolean): TileState => {
  const isOpen = session.status === "OPEN";
  if (isOpen && hasSubmitted) return "open-submitted";
  if (isOpen) return "open-unsubmitted";
  if (hasSubmitted) return "closed-submitted";
  return "closed-unsubmitted";
};

const getStatusBadge = (tileState: TileState) => {
  switch (tileState) {
    case "open-unsubmitted":
      return { label: "Open - vote now", className: "bg-primary/10 text-primary border-primary/20" };
    case "open-submitted":
      return { label: "Open - already submitted", className: "bg-green-100 text-green-800 border-green-200" };
    case "closed-submitted":
      return { label: "Closed - submitted", className: "bg-muted text-muted-foreground border-border" };
    case "closed-unsubmitted":
      return { label: "Closed - not submitted", className: "bg-amber-100 text-amber-800 border-amber-200" };
  }
};

const formatDuration = (endDate: string | null) => {
  if (!endDate) return null;

  const remainingMs = new Date(endDate).getTime() - Date.now();
  if (Number.isNaN(remainingMs)) return null;
  if (remainingMs <= 0) return "Deadline passed";

  const totalMinutes = Math.floor(remainingMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
};

export default function MvpVotes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isVoter, setIsVoter] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<SessionTile[]>([]);
  const [players, setPlayers] = useState<RevsportsPlayerRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [fixtureScopes, setFixtureScopes] = useState<Record<string, FixtureScopeRow>>({});
  const [selectedSession, setSelectedSession] = useState<SessionTile | null>(null);
  const [requestingSessionId, setRequestingSessionId] = useState<string | null>(null);
  const [requestedSessionIds, setRequestedSessionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadVotingData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .eq("role", "VOTER")
          .maybeSingle();

        if (roleError) throw roleError;

        if (!roleData) {
          setIsVoter(false);
          setLoading(false);
          return;
        }

        setIsVoter(true);

        const { data: playersData, error: playersError } = await supabase
          .from("revsports_players")
          .select("id, fixture_id, player_name, team, team_side, team_label, jersey, profile_id")
          .eq("profile_id", user.id)
          .eq("attended", true);

        if (playersError) throw playersError;

        const voterRows = (playersData as RevsportsPlayerRow[] | null) || [];
        const fixtureIds = Array.from(new Set(voterRows.map((player) => player.fixture_id).filter(Boolean)));

        if (fixtureIds.length === 0) {
          setSessions([]);
          setPlayers([]);
          setVotes([]);
          setFixtureScopes({});
          setLoading(false);
          return;
        }

        const [sessionsRes, submissionsRes, allPlayersRes, votesRes, fixturesRes] = await Promise.all([
          supabase
            .from("mvp_voting_sessions")
            .select("*")
            .in("fixture_id", fixtureIds)
            .order("game_date", { ascending: false }),
          supabase
            .from("mvp_vote_submissions")
            .select("session_id")
            .eq("voter_profile_id", user.id),
          supabase
            .from("revsports_players")
            .select("id, fixture_id, player_name, team, team_side, team_label, jersey, profile_id")
            .in("fixture_id", fixtureIds)
            .eq("attended", true),
          supabase
            .from("mvp_votes")
            .select("session_id, player_id, points")
            .eq("voter_profile_id", user.id),
          supabase
            .from("fixtures")
            .select("id, home_team_id, away_team_id, home_team:teams!home_team_id(id, name, club_id, clubs(id, name, association_id)), away_team:teams!away_team_id(id, name, club_id, clubs(id, name, association_id))")
            .in("id", fixtureIds),
        ]);

        if (sessionsRes.error) throw sessionsRes.error;
        if (submissionsRes.error) throw submissionsRes.error;
        if (allPlayersRes.error) throw allPlayersRes.error;
        if (votesRes.error) throw votesRes.error;
        if (fixturesRes.error) throw fixturesRes.error;

        const submittedSessionIds = new Set(
          ((submissionsRes.data as SubmissionRow[] | null) || []).map((submission) => submission.session_id),
        );
        const typedSessions = ((sessionsRes.data as MvpSession[] | null) || []).map((session) => {
          const hasSubmitted = submittedSessionIds.has(session.id);
          return {
            ...session,
            hasSubmitted,
            tileState: getTileState(session, hasSubmitted),
          };
        });
        const typedFixtures = (fixturesRes.data as FixtureScopeRow[] | null) || [];

        setSessions(typedSessions);
        setPlayers((allPlayersRes.data as RevsportsPlayerRow[] | null) || []);
        setVotes((votesRes.data as VoteRow[] | null) || []);
        setFixtureScopes(
          Object.fromEntries(typedFixtures.map((fixture) => [fixture.id, fixture])),
        );
      } catch (err) {
        const error = err as Error;
        console.error("Error loading MVP votes data:", error);
        toast({
          title: "Error loading votes",
          description: error.message || "Failed to load voting sessions.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadVotingData();
  }, [user, toast]);

  const selectedPlayers = useMemo(() => {
    if (!selectedSession || !user) return [];
    return getSameSidePlayers(players, selectedSession.fixture_id, user.id);
  }, [players, selectedSession, user]);

  const selectedVotesByPlayer = useMemo(() => {
    if (!selectedSession) return new Map<string, number>();
    return new Map(
      votes
        .filter((vote) => vote.session_id === selectedSession.id)
        .map((vote) => [vote.player_id, vote.points]),
    );
  }, [selectedSession, votes]);

  const selectedVoteRows = useMemo(() => {
    if (!selectedSession) return [];
    return votes
      .filter((vote) => vote.session_id === selectedSession.id)
      .sort((a, b) => b.points - a.points);
  }, [selectedSession, votes]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Australia/Melbourne",
    });
  };

  const getPlayerName = (playerId: string) => {
    const player = players.find((item) => item.id === playerId);
    return player?.player_name || "Unknown player";
  };

  const requestReopen = async (session: SessionTile) => {
    if (!user || requestingSessionId) return;

    const fixture = fixtureScopes[session.fixture_id];
    const teamIds = [fixture?.home_team_id, fixture?.away_team_id].filter(Boolean) as string[];
    const clubIds = [
      fixture?.home_team?.club_id,
      fixture?.away_team?.club_id,
    ].filter(Boolean) as string[];
    const associationIds = [
      fixture?.home_team?.clubs?.association_id,
      fixture?.away_team?.clubs?.association_id,
    ].filter(Boolean) as string[];

    setRequestingSessionId(session.id);
    try {
      const roleFilters = [
        ...teamIds.map((id) => `and(role.in.(COACH,TEAM_MANAGER),team_id.eq.${id})`),
        ...clubIds.map((id) => `and(role.eq.CLUB_ADMIN,club_id.eq.${id})`),
        ...associationIds.map((id) => `and(role.eq.ASSOCIATION_ADMIN,association_id.eq.${id})`),
        "role.eq.SUPER_ADMIN",
      ];

      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .or(roleFilters.join(","));

      if (rolesError) throw rolesError;

      const recipientIds = Array.from(
        new Set(((adminRoles as { user_id: string }[] | null) || []).map((role) => role.user_id).filter(Boolean)),
      );

      if (recipientIds.length === 0) {
        toast({
          title: "No admins found",
          description: "No matching admins were found for this voting session.",
          variant: "destructive",
        });
        return;
      }

      const notifications = recipientIds.map((userId) => ({
        user_id: userId,
        type: "mvp_reopen_request",
        title: "MVP voting reopen request",
        message: `A player requested reopening ${session.home_team} vs ${session.away_team}, Round ${session.round}.`,
        game_id: session.fixture_id,
        team_id: teamIds[0] || null,
      }));

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notificationError) throw notificationError;

      setRequestedSessionIds((current) => new Set([...current, session.id]));
      toast({
        title: "Request sent",
        description: "The reopen request has been sent to the relevant admins.",
      });
    } catch (err) {
      const error = err as Error;
      console.error("Error requesting MVP reopen:", error);
      toast({
        title: "Request failed",
        description: error.message || "Could not send the reopen request.",
        variant: "destructive",
      });
    } finally {
      setRequestingSessionId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 container py-6 mx-auto max-w-7xl animate-fade-in">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center gap-2 mb-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-6 w-3/4 mt-2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isVoter === false) {
    return (
      <div className="container py-12 mx-auto max-w-md animate-fade-in">
        <Card className="border-destructive/30 shadow-sm text-center">
          <CardHeader className="pt-8">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl font-semibold">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="pb-8">
            <p className="text-muted-foreground text-sm">
              You must have the VOTER role assigned to access MVP voting. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 container py-6 mx-auto max-w-7xl animate-fade-in">
      <div>
        <h1 className="text-3xl font-display text-foreground font-semibold">MVP Votes</h1>
        <p className="text-muted-foreground mt-1">Vote for recent games and review your previous votes</p>
      </div>

      {sessions.length === 0 ? (
        <Card className="border-dashed py-16 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center mb-4">
            <Award className="h-6 w-6 text-primary opacity-60" />
          </div>
          <CardTitle className="text-lg font-medium text-foreground">No MVP voting rounds found</CardTitle>
          <CardDescription className="mt-1 text-sm text-muted-foreground">
            Eligible voting rounds will appear here after you are linked to the game lineup.
          </CardDescription>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => {
            const statusBadge = getStatusBadge(session.tileState);
            const countdown = session.status === "OPEN" ? formatDuration(session.closes_at) : null;
            const requestSent = requestedSessionIds.has(session.id);

            return (
              <Card key={session.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 max-w-[70%] truncate block">
                      {session.grade}
                    </Badge>
                    <Badge variant="secondary" className="font-semibold shrink-0">
                      Round {session.round}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-display mt-2 leading-tight">
                    {session.home_team} vs {session.away_team}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground/75" />
                      <span>{formatDate(session.game_date)}</span>
                    </div>
                    {countdown && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0 text-muted-foreground/75" />
                        <span>{countdown}</span>
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className={statusBadge.className}>
                    {statusBadge.label}
                  </Badge>
                  {session.tileState === "open-unsubmitted" && (
                    <Link to={`/mvp-votes/${session.id}`} className="block w-full">
                      <Button className="w-full" variant="default">
                        Vote Now
                      </Button>
                    </Link>
                  )}
                  {(session.tileState === "open-submitted" || session.tileState === "closed-submitted") && (
                    <Button className="w-full gap-2" variant="outline" onClick={() => setSelectedSession(session)}>
                      <History className="h-4 w-4" />
                      View My Votes
                    </Button>
                  )}
                  {session.tileState === "closed-unsubmitted" && (
                    <Button
                      className="w-full gap-2"
                      variant="outline"
                      disabled={requestingSessionId === session.id || requestSent}
                      onClick={() => requestReopen(session)}
                    >
                      <Send className="h-4 w-4" />
                      {requestSent ? "Request Sent" : requestingSessionId === session.id ? "Sending..." : "Request Reopen"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>My MVP Votes</DialogTitle>
            <DialogDescription>
              {selectedSession
                ? `${selectedSession.home_team} vs ${selectedSession.away_team}, Round ${selectedSession.round}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {[3, 2, 1].map((points) => {
                const vote = selectedVoteRows.find((row) => row.points === points);
                return (
                  <div key={points} className="rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      {points} {points === 1 ? "Vote" : "Votes"}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {vote ? getPlayerName(vote.player_id) : "No selection recorded"}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Players listed for this vote</h3>
              {selectedPlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No linked player list was found for this game.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {selectedPlayers.map((player) => {
                    const points = selectedVotesByPlayer.get(player.id);
                    return (
                      <div key={player.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                        <span className="min-w-0 truncate">
                          {player.player_name} {player.jersey ? `(#${player.jersey})` : ""}
                        </span>
                        {points ? (
                          <Badge variant="outline" className="shrink-0 bg-green-100 text-green-800 border-green-200">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {points} {points === 1 ? "vote" : "votes"}
                          </Badge>
                        ) : (
                          <span className="shrink-0 text-xs text-muted-foreground">No votes</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

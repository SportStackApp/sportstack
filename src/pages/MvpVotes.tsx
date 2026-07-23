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
import {
  getMvpErrorMessage,
  getMvpSessionDisplayState,
  isMvpUpgradeUnavailable,
  type MvpSessionDisplayState,
  type MvpSessionStatus,
} from "@/lib/mvpVoting";
import { Award, Calendar, CheckCircle2, Clock, History, Send, Star, TriangleAlert } from "lucide-react";

// MVP tables and functions are added before the generated client types are regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = originalSupabase as any;

interface MvpSession {
  id: string;
  fixture_id: string;
  team_id: string | null;
  match_url: string | null;
  grade: string;
  round: string;
  game_date: string;
  home_team: string;
  away_team: string;
  status: MvpSessionStatus;
  opened_at: string | null;
  closes_at: string | null;
}

interface RevsportsPlayerRow {
  id: string;
  fixture_id: string;
  player_name: string;
  team: string | null;
  team_side: "home" | "away" | null;
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

interface FixtureTeamRow {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
}

interface FixtureFillInRow {
  fixture_id: string;
  team_id: string;
}

interface TeamTimezoneRow {
  id: string;
  clubs: {
    associations: { timezone: string | null } | null;
  } | null;
}

interface SessionTile extends MvpSession {
  displayState: MvpSessionDisplayState;
  hasSubmitted: boolean;
  isLegacy: boolean;
  timezone: string;
}

const DEFAULT_ASSOCIATION_TIMEZONE = "Australia/Melbourne";

const getSameSidePlayers = (
  players: RevsportsPlayerRow[],
  fixtureId: string,
  userId: string,
) => {
  const fixturePlayers = players.filter((player) => player.fixture_id === fixtureId);
  const voterRow = fixturePlayers.find((player) => player.profile_id === userId);

  if (!voterRow?.team_side) return [];

  return fixturePlayers
    .filter(
      (player) =>
        player.team_side === voterRow.team_side &&
        player.id !== voterRow.id &&
        player.profile_id !== userId,
    )
    .sort((a, b) => a.player_name.localeCompare(b.player_name));
};

const getStatusBadge = (session: SessionTile) => {
  if (session.isLegacy) {
    return { label: "History only", className: "bg-muted text-muted-foreground border-border" };
  }

  switch (session.displayState) {
    case "open":
      return session.hasSubmitted
        ? { label: "Open - ballot submitted", className: "bg-green-100 text-green-800 border-green-200" }
        : { label: "Open - vote now", className: "bg-primary/10 text-primary border-primary/20" };
    case "expired":
      return { label: "Voting time expired", className: "bg-amber-100 text-amber-800 border-amber-200" };
    case "disputed":
      return { label: "Result being reviewed", className: "bg-red-100 text-red-800 border-red-200" };
    case "closed":
      return session.hasSubmitted
        ? { label: "Closed - ballot submitted", className: "bg-muted text-muted-foreground border-border" }
        : { label: "Closed - not submitted", className: "bg-amber-100 text-amber-800 border-amber-200" };
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
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);
  const [hasAttendedMatches, setHasAttendedMatches] = useState(false);
  const [sessions, setSessions] = useState<SessionTile[]>([]);
  const [players, setPlayers] = useState<RevsportsPlayerRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionTile | null>(null);
  const [requestingSessionId, setRequestingSessionId] = useState<string | null>(null);
  const [requestedSessionIds, setRequestedSessionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadVotingData = async () => {
      if (!user) return;
      setLoading(true);
      setSchemaUnavailable(false);

      try {
        // Attendance and the recorded home/away side determine player access.
        // A global VOTER role is deliberately not used as an eligibility shortcut.
        const [voterRowsRes, fillInRowsRes, submissionsRes] = await Promise.all([
          supabase
            .from("revsports_players")
            .select("id, fixture_id, player_name, team, team_side, team_label, jersey, profile_id")
            .eq("profile_id", user.id)
            .eq("attended", true),
          supabase
            .from("fixture_fill_ins")
            .select("fixture_id, team_id")
            .eq("player_id", user.id)
            .eq("status", "SELECTED"),
          supabase
            .from("mvp_vote_submissions")
            .select("session_id")
            .eq("voter_profile_id", user.id),
        ]);

        if (voterRowsRes.error) throw voterRowsRes.error;
        if (fillInRowsRes.error) throw fillInRowsRes.error;
        if (submissionsRes.error) throw submissionsRes.error;

        const voterRows = (voterRowsRes.data as RevsportsPlayerRow[] | null) || [];
        const fillInRows = (fillInRowsRes.data as FixtureFillInRow[] | null) || [];
        const fixtureIds = Array.from(new Set([
          ...voterRows.map((player) => player.fixture_id),
          ...fillInRows.map((fillIn) => fillIn.fixture_id),
        ].filter(Boolean)));
        const submittedSessionIds = new Set(
          ((submissionsRes.data as SubmissionRow[] | null) || []).map((submission) => submission.session_id),
        );
        setHasAttendedMatches(fixtureIds.length > 0);

        if (fixtureIds.length === 0 && submittedSessionIds.size === 0) {
          setSessions([]);
          setPlayers([]);
          setVotes([]);
          return;
        }

        let sessionsQuery = supabase
          .from("mvp_voting_sessions")
          .select("id, fixture_id, team_id, match_url, grade, round, game_date, home_team, away_team, status, opened_at, closes_at");

        if (fixtureIds.length > 0 && submittedSessionIds.size > 0) {
          sessionsQuery = sessionsQuery.or(
            `fixture_id.in.(${fixtureIds.join(",")}),id.in.(${Array.from(submittedSessionIds).join(",")})`,
          );
        } else if (fixtureIds.length > 0) {
          sessionsQuery = sessionsQuery.in("fixture_id", fixtureIds);
        } else {
          sessionsQuery = sessionsQuery.in("id", Array.from(submittedSessionIds));
        }

        const sessionsRes = await sessionsQuery.order("game_date", { ascending: false });
        if (sessionsRes.error) throw sessionsRes.error;

        const sessionRows = (sessionsRes.data as MvpSession[] | null) || [];
        const relatedFixtureIds = Array.from(new Set([
          ...fixtureIds,
          ...sessionRows.map((session) => session.fixture_id),
        ].filter(Boolean)));
        const sessionTeamIds = Array.from(
          new Set(sessionRows.map((session) => session.team_id).filter((teamId): teamId is string => Boolean(teamId))),
        );
        const emptyRows = Promise.resolve({ data: [], error: null });

        const [allPlayersRes, votesRes, fixturesRes, teamTimezonesRes] = await Promise.all([
          relatedFixtureIds.length > 0
            ? supabase
                .from("revsports_players")
                .select("id, fixture_id, player_name, team, team_side, team_label, jersey, profile_id")
                .in("fixture_id", relatedFixtureIds)
                .eq("attended", true)
            : emptyRows,
          supabase
            .from("mvp_votes")
            .select("session_id, player_id, points")
            .eq("voter_profile_id", user.id),
          relatedFixtureIds.length > 0
            ? supabase
                .from("fixtures")
                .select("id, home_team_id, away_team_id")
                .in("id", relatedFixtureIds)
            : emptyRows,
          sessionTeamIds.length > 0
            ? supabase
                .from("teams")
                .select("id, clubs(associations(timezone))")
                .in("id", sessionTeamIds)
            : emptyRows,
        ]);

        if (allPlayersRes.error) throw allPlayersRes.error;
        if (votesRes.error) throw votesRes.error;
        if (fixturesRes.error) throw fixturesRes.error;
        if (teamTimezonesRes.error) throw teamTimezonesRes.error;

        const fixturesById = new Map(
          ((fixturesRes.data as FixtureTeamRow[] | null) || []).map((fixture) => [fixture.id, fixture]),
        );
        const fillInTeamByFixtureId = new Map(fillInRows.map((row) => [row.fixture_id, row.team_id]));
        const syntheticFillInRows: RevsportsPlayerRow[] = fillInRows.flatMap((fillIn) => {
          const fixture = fixturesById.get(fillIn.fixture_id);
          const teamSide = fixture?.home_team_id === fillIn.team_id
            ? "home"
            : fixture?.away_team_id === fillIn.team_id
              ? "away"
              : null;
          if (!teamSide) return [];
          return [{
            id: `fill-in-${fillIn.fixture_id}-${user.id}`,
            fixture_id: fillIn.fixture_id,
            player_name: "Fill-in voter",
            team: null,
            team_side: teamSide,
            team_label: null,
            jersey: null,
            profile_id: user.id,
          }];
        });
        const voterByFixtureId = new Map(
          [...voterRows, ...syntheticFillInRows].map((player) => [player.fixture_id, player]),
        );
        const timezoneByTeamId = new Map<string, string>(
          ((teamTimezonesRes.data as TeamTimezoneRow[] | null) || []).map((team): [string, string] => [
            team.id,
            team.clubs?.associations?.timezone || DEFAULT_ASSOCIATION_TIMEZONE,
          ]),
        );

        const visibleSessions = sessionRows
          .filter((session) => session.status !== "PENDING")
          .filter((session) => {
            const hasSubmitted = submittedSessionIds.has(session.id);

            // A validated submission remains visible as the player's own history
            // even if later attendance imports change or lose the fixture-side row.
            if (hasSubmitted) return true;
            if (!session.team_id) return false;
            if (session.status === "CLOSED" && !session.opened_at) return false;

            const fixture = fixturesById.get(session.fixture_id);
            const voterRow = voterByFixtureId.get(session.fixture_id);
            if (!fixture || !voterRow?.team_side) return false;

            const attendedTeamId = voterRow.team_side === "home"
              ? fixture.home_team_id
              : fixture.away_team_id;
            return attendedTeamId === session.team_id
              || fillInTeamByFixtureId.get(session.fixture_id) === session.team_id;
          })
          .map((session): SessionTile => {
            const hasSubmitted = submittedSessionIds.has(session.id);
            return {
              ...session,
              hasSubmitted,
              isLegacy: !session.team_id,
              displayState: getMvpSessionDisplayState(session.status, session.closes_at),
              timezone: session.team_id
                ? timezoneByTeamId.get(session.team_id) || DEFAULT_ASSOCIATION_TIMEZONE
                : DEFAULT_ASSOCIATION_TIMEZONE,
            };
          });

        setSessions(visibleSessions);
        setPlayers([
          ...((allPlayersRes.data as RevsportsPlayerRow[] | null) || []),
          ...syntheticFillInRows,
        ]);
        setVotes((votesRes.data as VoteRow[] | null) || []);
      } catch (error) {
        console.error("Error loading MVP votes data:", error);
        if (isMvpUpgradeUnavailable(error)) {
          setSchemaUnavailable(true);
          setSessions([]);
        } else {
          toast({
            title: "Could not load MVP voting",
            description: getMvpErrorMessage(error, "MVP voting could not be loaded. Please try again."),
            variant: "destructive",
          });
        }
      } finally {
        setLoading(false);
      }
    };

    void loadVotingData();
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

  const formatDate = (dateStr: string, timeZone: string) => new Date(dateStr).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  });

  const getPlayerName = (playerId: string) => {
    const player = players.find((item) => item.id === playerId);
    return player?.player_name || "Unknown player";
  };

  const requestReopen = async (session: SessionTile) => {
    if (!user || requestingSessionId || !session.team_id) return;

    setRequestingSessionId(session.id);
    try {
      const { error } = await supabase.rpc("request_mvp_session_reopen", {
        p_session_id: session.id,
      });
      if (error) throw error;

      setRequestedSessionIds((current) => new Set([...current, session.id]));
      toast({
        title: "Request sent",
        description: "The team staff have been asked to review this voting round.",
      });
    } catch (error) {
      console.error("Error requesting MVP reopen:", error);
      toast({
        title: "Request not sent",
        description: getMvpErrorMessage(error, "The reopen request could not be sent. Please try again."),
        variant: "destructive",
      });
    } finally {
      setRequestingSessionId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 container py-6 mx-auto max-w-7xl animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-80" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-64 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 container py-6 mx-auto max-w-7xl animate-fade-in">
      <div>
        <h1 className="text-3xl font-display text-foreground font-semibold">MVP Votes</h1>
        <p className="text-muted-foreground mt-1">Vote for your team and review your previous ballots</p>
      </div>

      {schemaUnavailable ? (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TriangleAlert className="h-5 w-5 text-amber-700" />
              MVP voting upgrade not ready yet
            </CardTitle>
            <CardDescription>
              The secure team voting update has not been added to the database yet. No action is needed from you.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed py-16 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center mb-4">
            <Award className="h-6 w-6 text-primary opacity-60" />
          </div>
          <CardTitle className="text-lg font-medium text-foreground">No MVP voting rounds found</CardTitle>
          <CardDescription className="mt-1 text-sm text-muted-foreground max-w-md">
            {hasAttendedMatches
              ? "Your team's open voting rounds and submitted history will appear here."
              : "Rounds will appear after you are linked as an attended player or selected as a fill-in."}
          </CardDescription>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => {
            const statusBadge = getStatusBadge(session);
            const countdown = session.displayState === "open" ? formatDuration(session.closes_at) : null;
            const requestSent = requestedSessionIds.has(session.id);
            const canRequestReopen =
              !session.isLegacy &&
              !session.hasSubmitted &&
              (session.displayState === "closed" || session.displayState === "expired");

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
                      <span>{formatDate(session.game_date, session.timezone)}</span>
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

                  {session.displayState === "open" && !session.hasSubmitted && (
                    <Button asChild className="w-full">
                      <Link to={`/mvp-votes/${session.id}`}>Vote Now</Link>
                    </Button>
                  )}

                  {session.displayState === "open" && session.hasSubmitted && !session.isLegacy && (
                    <Button asChild className="w-full" variant="outline">
                      <Link to={`/mvp-votes/${session.id}`}>Check Match Result</Link>
                    </Button>
                  )}

                  {session.hasSubmitted && (
                    <Button className="w-full gap-2" variant="outline" onClick={() => setSelectedSession(session)}>
                      <History className="h-4 w-4" />
                      View My Ballot
                    </Button>
                  )}

                  {canRequestReopen && (
                    <Button
                      className="w-full gap-2"
                      variant="outline"
                      disabled={requestingSessionId === session.id || requestSent}
                      onClick={() => void requestReopen(session)}
                    >
                      <Send className="h-4 w-4" />
                      {requestSent ? "Request Sent" : requestingSessionId === session.id ? "Sending..." : "Request Reopen"}
                    </Button>
                  )}

                  {session.displayState === "disputed" && (
                    <p className="text-sm text-muted-foreground">
                      Team staff are checking the recorded match result. Voting and reminders are paused.
                    </p>
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
            <DialogTitle>My MVP Ballot</DialogTitle>
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
                      {points} {points === 1 ? "Point" : "Points"}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {vote ? getPlayerName(vote.player_id) : "No selection recorded"}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Teammates listed for this ballot</h3>
              {selectedPlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No linked teammate list was found for this match.</p>
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
                            {points} {points === 1 ? "point" : "points"}
                          </Badge>
                        ) : (
                          <span className="shrink-0 text-xs text-muted-foreground">No points</span>
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

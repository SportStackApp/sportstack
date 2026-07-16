import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase as originalSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  getMvpErrorMessage,
  getMvpSessionDisplayState,
  isMvpUpgradeUnavailable,
  normaliseMvpResultCheckState,
  type MvpResultCheckResponse,
  type MvpResultCheckState,
  type MvpSessionStatus,
} from "@/lib/mvpVoting";
import { Star, Trophy, Clock, CheckCircle2, ChevronLeft, Calendar, ShieldAlert, MapPin, Shield, TriangleAlert } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = originalSupabase as any;
const DEFAULT_ASSOCIATION_TIMEZONE = "Australia/Melbourne";

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
  closes_at: string | null;
  result_check_round: number;
}

interface ScoreboardTeam {
  id: string | null;
  name: string | null;
  logo_url: string | null;
  banner_url: string | null;
  club_id?: string | null;
}

interface ScoreboardFixture {
  id: string;
  fixture_date: string | null;
  home_score: number | null;
  away_score: number | null;
  round_number: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  venue_id: string | null;
  pitch_id: string | null;
  home_team: ScoreboardTeam | null;
  away_team: ScoreboardTeam | null;
  venue: { id: string; name: string | null } | null;
  pitch: { id: string; name: string | null } | null;
}

interface FixtureScoreRow {
  id: string;
  fixture_date: string | null;
  home_score: number | null;
  away_score: number | null;
  round_number: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  venue_id: string | null;
  pitch_id: string | null;
}

type ScorerDialogTeam = "home" | "away";

interface ClubAssociationRow {
  id: string;
  association_id: string | null;
  associations: {
    id: string;
    name: string | null;
    abbreviation: string | null;
    timezone: string | null;
  } | null;
}

interface GoalScorer {
  id: string;
  playerName: string;
  goals: number;
  team: ScorerDialogTeam;
}

interface RevsportsPlayer {
  id: string;
  player_name: string;
  team: string;
  team_side: "home" | "away" | null;
  team_label: string | null;
  jersey: string | null;
  profile_id: string | null;
  goals?: number | null;
}

export default function MvpVoteCast() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<MvpSession | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [eligiblePlayers, setEligiblePlayers] = useState<RevsportsPlayer[]>([]);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [fixture, setFixture] = useState<ScoreboardFixture | null>(null);
  const [scorerDialogTeam, setScorerDialogTeam] = useState<ScorerDialogTeam | null>(null);
  const [goalScorers, setGoalScorers] = useState<GoalScorer[]>([]);
  const [associationContext, setAssociationContext] = useState<string | null>(null);
  const [associationTimeZone, setAssociationTimeZone] = useState(DEFAULT_ASSOCIATION_TIMEZONE);
  const [schemaUnavailable, setSchemaUnavailable] = useState(false);
  const [resultCheck, setResultCheck] = useState<MvpResultCheckState>(() => normaliseMvpResultCheckState(null));
  const [checkingResult, setCheckingResult] = useState(false);
  const [concernDialogOpen, setConcernDialogOpen] = useState(false);
  const [resultComment, setResultComment] = useState("");

  const [votes, setVotes] = useState({ vote3: "__none__", vote2: "__none__", vote1: "__none__" });
  const [shoutout, setShoutout] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const refreshResultCheckState = useCallback(async () => {
    if (!sessionId) return;

    const { data, error } = await supabase.rpc("get_mvp_result_check_state", {
      p_session_id: sessionId,
    });
    if (error) throw error;
    setResultCheck(normaliseMvpResultCheckState(data));
  }, [sessionId]);

  useEffect(() => {
    const loadVotingDetails = async () => {
      if (!user || !sessionId) return;
      setLoading(true);
      setErrorState(null);
      setSchemaUnavailable(false);
      setSession(null);
      setHasVoted(false);
      setEligiblePlayers([]);
      setFixture(null);
      setScorerDialogTeam(null);
      setGoalScorers([]);
      setAssociationContext(null);
      setAssociationTimeZone(DEFAULT_ASSOCIATION_TIMEZONE);
      setSuccess(false);
      setVotes({ vote3: "__none__", vote2: "__none__", vote1: "__none__" });
      setShoutout("");
      setSubmitting(false);
      setResultCheck(normaliseMvpResultCheckState(null));
      setCheckingResult(false);
      setConcernDialogOpen(false);
      setResultComment("");
      try {
        // The explicit new columns make a pre-migration database fail clearly,
        // instead of silently treating every round as an old fixture-wide round.
        const { data: sessionData, error: sessionErr } = await supabase
          .from("mvp_voting_sessions")
          .select("id, fixture_id, team_id, match_url, grade, round, game_date, home_team, away_team, status, closes_at, result_check_round")
          .eq("id", sessionId)
          .maybeSingle();

        if (sessionErr) throw sessionErr;
        if (!sessionData) {
          setErrorState("Voting session not found.");
          setLoading(false);
          return;
        }

        const typedSession = sessionData as MvpSession;
        if (!typedSession.team_id) {
          setErrorState("This older fixture-wide voting round is available from your submitted history only.");
          setLoading(false);
          return;
        }
        if (typedSession.status === "PENDING") {
          setErrorState("This team voting round has not been opened yet.");
          setLoading(false);
          return;
        }
        setSession(typedSession);

        let fixtureRowForEligibility: FixtureScoreRow | null = null;
        const { data: fixtureData, error: fixtureErr } = await supabase
          .from("fixtures")
          .select("id, fixture_date, home_score, away_score, round_number, home_team_id, away_team_id, venue_id, pitch_id")
          .eq("id", typedSession.fixture_id)
          .maybeSingle();

        if (fixtureErr) {
          console.warn("Fixture scoreboard context unavailable:", fixtureErr);
        } else {
          const fixtureRow = fixtureData as FixtureScoreRow | null;
          fixtureRowForEligibility = fixtureRow;
          if (fixtureRow) {
            let homeTeam: ScoreboardTeam | null = null;
            let awayTeam: ScoreboardTeam | null = null;
            let venue: ScoreboardFixture["venue"] = null;
            let pitch: ScoreboardFixture["pitch"] = null;

            const teamIds = [fixtureRow.home_team_id, fixtureRow.away_team_id].filter(Boolean) as string[];
            if (teamIds.length > 0) {
              const { data: teamData, error: teamErr } = await supabase
                .from("teams")
                .select("id, name, logo_url, banner_url, club_id")
                .in("id", teamIds);

              if (teamErr) {
                console.warn("Scoreboard team branding unavailable:", teamErr);
              } else {
                const teams = ((teamData as ScoreboardTeam[]) || []).reduce<Record<string, ScoreboardTeam>>((map, team) => {
                  if (team.id) map[team.id] = team;
                  return map;
                }, {});
                homeTeam = fixtureRow.home_team_id ? teams[fixtureRow.home_team_id] || null : null;
                awayTeam = fixtureRow.away_team_id ? teams[fixtureRow.away_team_id] || null : null;

                const clubIds = Array.from(new Set(((teamData as ScoreboardTeam[]) || []).map((team) => team.club_id).filter(Boolean))) as string[];
                if (clubIds.length > 0) {
                  const { data: clubData, error: clubErr } = await supabase
                    .from("clubs")
                    .select("id, association_id, associations(id, name, abbreviation, timezone)")
                    .in("id", clubIds);

                  if (clubErr) {
                    console.warn("Scoreboard association context unavailable:", clubErr);
                    setAssociationContext(null);
                    setAssociationTimeZone(DEFAULT_ASSOCIATION_TIMEZONE);
                  } else {
                    const association = ((clubData as ClubAssociationRow[]) || [])
                      .map((club) => club.associations)
                      .find(Boolean);
                    setAssociationContext(association?.abbreviation || association?.name || null);
                    setAssociationTimeZone(association?.timezone || DEFAULT_ASSOCIATION_TIMEZONE);
                  }
                } else {
                  setAssociationContext(null);
                  setAssociationTimeZone(DEFAULT_ASSOCIATION_TIMEZONE);
                }
              }
            }

            if (fixtureRow.venue_id) {
              const { data: venueData, error: venueErr } = await supabase
                .from("venues")
                .select("id, name")
                .eq("id", fixtureRow.venue_id)
                .maybeSingle();
              if (venueErr) {
                console.warn("Scoreboard venue unavailable:", venueErr);
              } else {
                venue = venueData as ScoreboardFixture["venue"];
              }
            }

            if (fixtureRow.pitch_id) {
              const { data: pitchData, error: pitchErr } = await supabase
                .from("pitches")
                .select("id, name")
                .eq("id", fixtureRow.pitch_id)
                .maybeSingle();
              if (pitchErr) {
                console.warn("Scoreboard pitch unavailable:", pitchErr);
              } else {
                pitch = pitchData as ScoreboardFixture["pitch"];
              }
            }

            setFixture({
              ...fixtureRow,
              home_team: homeTeam,
              away_team: awayTeam,
              venue,
              pitch,
            });
          } else {
            setFixture(null);
          }
        }

        const { data: scorerRows, error: scorerErr } = await supabase
          .from("revsports_players")
          .select("id, player_name, team, team_side, team_label, goals")
          .eq("fixture_id", typedSession.fixture_id)
          .gt("goals", 0);

        if (scorerErr) {
          console.warn("Goal scorer summary unavailable:", scorerErr);
          setGoalScorers([]);
        } else {
          const normalise = (value?: string | null) => String(value || "").trim().toLowerCase();
          const homeLabel = normalise(typedSession.home_team);
          const awayLabel = normalise(typedSession.away_team);

          const scorers = ((scorerRows as RevsportsPlayer[]) || [])
            .map((row): GoalScorer | null => {
              let team: ScorerDialogTeam | null = null;
              if (row.team_side === "home" || row.team_side === "away") {
                team = row.team_side;
              } else {
                const rowLabel = normalise(row.team_label || row.team);
                if (rowLabel && rowLabel === homeLabel) team = "home";
                if (rowLabel && rowLabel === awayLabel) team = "away";
              }

              if (!team || !row.goals) return null;
              return {
                id: row.id,
                playerName: row.player_name,
                goals: row.goals,
                team,
              };
            })
            .filter((row): row is GoalScorer => row !== null);

          setGoalScorers(scorers);
        }

        // A submitted player can still check the match result while the round is open.
        const { data: submissionData, error: submissionErr } = await supabase
          .from("mvp_vote_submissions")
          .select("id")
          .eq("session_id", sessionId)
          .eq("voter_profile_id", user.id)
          .maybeSingle();

        if (submissionErr) throw submissionErr;
        if (submissionData) {
          setHasVoted(true);
        } else {
          setHasVoted(false);
        }

        // Attendance and the fixture side are the authoritative eligibility checks.
        const { data: voterRow, error: voterErr } = await supabase
          .from("revsports_players")
          .select("id, team, team_side, team_label")
          .eq("fixture_id", typedSession.fixture_id)
          .eq("profile_id", user.id)
          .eq("attended", true)
          .maybeSingle();

        if (voterErr) throw voterErr;
        if (!voterRow) {
          setErrorState("We couldn't find your player record in the lineup for this game. You can only vote if you were in the lineup.");
          setLoading(false);
          return;
        }

        if (!fixtureRowForEligibility || !voterRow.team_side) {
          setErrorState("Your attended home or away team could not be confirmed for this match.");
          setLoading(false);
          return;
        }

        const attendedTeamId = voterRow.team_side === "home"
          ? fixtureRowForEligibility.home_team_id
          : fixtureRowForEligibility.away_team_id;
        if (attendedTeamId !== typedSession.team_id) {
          setErrorState("This voting round belongs to the other team in the match.");
          setLoading(false);
          return;
        }

        // Only attended players on the session's fixture side can appear on the ballot.
        const { data: allRows, error: teammateErr } = await supabase
          .from("revsports_players")
          .select("id, player_name, team, team_side, team_label, jersey, profile_id")
          .eq("fixture_id", typedSession.fixture_id)
          .eq("attended", true);

        if (teammateErr) throw teammateErr;

        const typedRows = (allRows as RevsportsPlayer[]) || [];

        const eligible = typedRows.filter(
          (player) =>
            player.team_side === voterRow.team_side &&
            player.id !== voterRow.id &&
            player.profile_id !== user.id,
        );

        const sorted = eligible.sort((a, b) => a.player_name.localeCompare(b.player_name));
        setEligiblePlayers(sorted);

        await refreshResultCheckState();
      } catch (error) {
        console.error("Error loading voting details:", error);
        if (isMvpUpgradeUnavailable(error)) {
          setSchemaUnavailable(true);
          setErrorState("The secure team voting update has not been added to the database yet. No action is needed from you.");
        } else {
          setErrorState(getMvpErrorMessage(error, "MVP voting details could not be loaded. Please try again."));
        }
      } finally {
        setLoading(false);
      }
    };

    void loadVotingDetails();
  }, [user, sessionId, refreshResultCheckState]);

  const checkDuplicate = (val: string) => {
    if (val === "__none__") return false;
    const all = [votes.vote3, votes.vote2, votes.vote1];
    return all.filter((v) => v === val).length > 1;
  };

  const hasDuplicates = checkDuplicate(votes.vote3) || checkDuplicate(votes.vote2) || checkDuplicate(votes.vote1);
  const allSelected = votes.vote3 !== "__none__" && votes.vote2 !== "__none__" && votes.vote1 !== "__none__";
  const sessionDisplayState = session
    ? getMvpSessionDisplayState(session.status, session.closes_at)
    : "closed";
  const resultCheckRequired = resultCheck.requiresCheck && !resultCheck.response;
  const canCastBallot =
    sessionDisplayState === "open" &&
    !hasVoted &&
    resultCheck.canVote &&
    !resultCheckRequired;

  const onSubmit = async () => {
    if (!user || !sessionId || !canCastBallot || !allSelected || hasDuplicates || submitting) return;
    setSubmitting(true);
    try {
      // The database function locks the session and saves all three votes plus
      // the submission marker in one transaction. A failure leaves no partial ballot.
      const { error } = await supabase.rpc("submit_mvp_ballot", {
        p_session_id: sessionId,
        p_three_point_player_id: votes.vote3,
        p_two_point_player_id: votes.vote2,
        p_one_point_player_id: votes.vote1,
        p_shoutout: shoutout.trim() || null,
      });
      if (error) throw error;

      setSuccess(true);
      setHasVoted(true);
      toast({
        title: "Ballot submitted",
        description: "Your 3, 2 and 1 point votes were saved together."
      });
    } catch (error) {
      console.error("Error submitting votes:", error);

      // A teammate may have raised a result concern while this ballot was open.
      // Refresh the secure result-check state and session status so the player
      // immediately sees the required Correct / Incorrect choice after a reject.
      await Promise.allSettled([
        refreshResultCheckState(),
        supabase
          .from("mvp_voting_sessions")
          .select("status, closes_at, result_check_round")
          .eq("id", sessionId)
          .maybeSingle()
          .then(({ data, error: sessionError }: { data: Partial<MvpSession> | null; error: unknown }) => {
            if (sessionError || !data) return;
            setSession((current) => current ? { ...current, ...data } : current);
          }),
      ]);

      toast({
        title: "Ballot not submitted",
        description: getMvpErrorMessage(error, "Your ballot could not be saved. Please try again."),
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const recordResultCheck = async (response: MvpResultCheckResponse) => {
    if (!sessionId || checkingResult || resultCheck.response) return;

    setCheckingResult(true);
    try {
      const { data, error } = await supabase.rpc("record_mvp_result_check", {
        p_session_id: sessionId,
        p_response: response,
        p_comment: response === "INCORRECT" ? resultComment.trim() || null : null,
      });
      if (error) throw error;

      const returnedState = Array.isArray(data) ? data[0] : data;
      if (returnedState && typeof returnedState === "object") {
        const returnedStatus = (returnedState as { status?: MvpSessionStatus }).status;
        if (returnedStatus) {
          setSession((current) => current ? { ...current, status: returnedStatus } : current);
        }
      }

      await refreshResultCheckState();
      setConcernDialogOpen(false);
      setResultComment("");
      toast({
        title: response === "CORRECT" ? "Result confirmed" : "Result concern recorded",
        description: response === "CORRECT"
          ? "You can continue to the MVP ballot."
          : "Team staff will review the recorded match result.",
      });
    } catch (error) {
      console.error("Error recording MVP result check:", error);
      toast({
        title: "Result check not saved",
        description: getMvpErrorMessage(error, "Your result check could not be saved. Please try again."),
        variant: "destructive",
      });
    } finally {
      setCheckingResult(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: associationTimeZone,
    });
  };

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return "Time TBC";
    return new Date(dateStr).toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: associationTimeZone,
    });
  };

  const cleanRoundLabel = (round?: string | number | null) => {
    const value = String(round ?? "").trim();
    if (!value) return "Round TBC";
    return value.toLowerCase().startsWith("round") ? value : `Round ${value}`;
  };

  const teamInitials = (name?: string | null) =>
    (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  const scoreboardDate = fixture?.fixture_date || session?.game_date || null;
  const homeTeam = fixture?.home_team;
  const awayTeam = fixture?.away_team;
  const homeName = homeTeam?.name || session?.home_team || "Home";
  const awayName = awayTeam?.name || session?.away_team || "Away";
  const homeScore = fixture?.home_score;
  const awayScore = fixture?.away_score;
  const hasScore = homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined;
  const roundLabel = cleanRoundLabel(fixture?.round_number ?? session?.round);
  const pitchLabel = fixture?.pitch?.name || fixture?.venue?.name || "Pitch TBC";
  const venueLabel = fixture?.pitch?.name && fixture?.venue?.name ? fixture.venue.name : null;
  const scorerTeamName = scorerDialogTeam === "home" ? homeName : awayName;
  const competitionLabel = session?.grade || "Competition TBC";
  const bannerContextLabel = associationContext || "MVP Voting";
  const scorerDialogRows = scorerDialogTeam
    ? goalScorers.filter((scorer) => scorer.team === scorerDialogTeam)
    : [];

  const ScoreBlock = () => {
    if (!hasScore) {
      return (
        <div className="mx-auto flex min-w-44 flex-col items-center justify-center rounded-2xl bg-white/12 px-6 py-4 text-center shadow-2xl ring-1 ring-white/20 backdrop-blur">
          <span className="font-display text-5xl font-black leading-none sm:text-6xl">VS</span>
          <span className="mt-2 text-xs font-semibold uppercase tracking-wider text-white/65">Score pending</span>
        </div>
      );
    }

    return (
      <div className="mx-auto flex items-center justify-center gap-2 rounded-2xl bg-white/12 px-4 py-4 shadow-2xl ring-1 ring-white/20 backdrop-blur sm:px-5">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              className="min-w-16 rounded-xl bg-white/15 px-3 py-2 text-center font-display text-5xl font-black leading-none transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white sm:text-6xl"
              onClick={() => setScorerDialogTeam("home")}
              title={`${homeName} goal scorers`}
            >
              {homeScore}
            </button>
            <span className="text-2xl font-black text-white/55">-</span>
            <button
              type="button"
              className="min-w-16 rounded-xl bg-white/15 px-3 py-2 text-center font-display text-5xl font-black leading-none transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white sm:text-6xl"
              onClick={() => setScorerDialogTeam("away")}
              title={`${awayName} goal scorers`}
            >
              {awayScore}
            </button>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
            Click score for scorers
          </span>
        </div>
      </div>
    );
  };

  const Scoreboard = () => (
    <div className="overflow-hidden rounded-2xl border border-primary/25 bg-card shadow-xl shadow-primary/5">
      <div
        className="relative min-h-[260px] bg-slate-950 text-white"
        style={{
          backgroundImage: [
            homeTeam?.banner_url ? `linear-gradient(90deg, rgba(2,6,23,.92), rgba(2,6,23,.65)), url(${homeTeam.banner_url})` : "",
            awayTeam?.banner_url ? `linear-gradient(270deg, rgba(2,6,23,.88), rgba(2,6,23,.65)), url(${awayTeam.banner_url})` : "",
          ].filter(Boolean).join(", "),
          backgroundPosition: "left center, right center",
          backgroundSize: "50% 100%, 50% 100%",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(37,99,235,.78),rgba(2,6,23,.92)_45%,rgba(15,23,42,.84))]" />
        <div className="absolute inset-x-0 top-0 h-20 bg-white/[0.04]" />
        <div className="relative flex min-h-[260px] flex-col justify-between gap-6 p-5 sm:p-7">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/85">
              <Shield className="h-3.5 w-3.5" />
              <span>{bannerContextLabel}</span>
            </div>
          </div>
          <div className="hidden" aria-hidden="true">
            <span>{session?.grade || "Grade TBC"}</span>
            <span className="text-white/35">•</span>
            <span>{roundLabel}</span>
            <span className="text-white/35">•</span>
            <span>{scoreboardDate ? formatDate(scoreboardDate) : "Date TBC"}</span>
          </div>

          <div className="grid justify-center gap-4 sm:grid-cols-[minmax(120px,160px)_auto_minmax(120px,160px)] sm:items-center">
            <ScoreboardTeamBlock name={homeName} logoUrl={homeTeam?.logo_url || null} />
            <ScoreBlock />
            <ScoreboardTeamBlock name={awayName} logoUrl={awayTeam?.logo_url || null} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs font-semibold uppercase tracking-wider text-white/75">
            <span>{competitionLabel}</span>
            <span className="text-white/35">/</span>
            <span>{roundLabel}</span>
            <span className="text-white/35">/</span>
            <span>{scoreboardDate ? formatDate(scoreboardDate) : "Date TBC"}</span>
          </div>
          <div className="grid gap-2 text-sm text-white/85 sm:grid-cols-3">
            <div className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2">
              <Clock className="h-4 w-4" />
              <span>{formatTime(scoreboardDate)}</span>
            </div>
            <div className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{pitchLabel}</span>
            </div>
            <div className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2">
              <Calendar className="h-4 w-4" />
              <span>{scoreboardDate ? formatDate(scoreboardDate) : "Date TBC"}</span>
            </div>
          </div>
          {venueLabel && <p className="text-center text-xs text-white/60">Venue: {venueLabel}</p>}
        </div>
      </div>
      <Dialog open={scorerDialogTeam !== null} onOpenChange={(open) => !open && setScorerDialogTeam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{scorerTeamName} goals</DialogTitle>
            <DialogDescription>
              Recorded goals for this match.
            </DialogDescription>
          </DialogHeader>
          {scorerDialogRows.length > 0 ? (
            <div className="space-y-2">
              {scorerDialogRows.map((scorer) => (
                <div key={scorer.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <span className="font-medium">{scorer.playerName}</span>
                  <span className="text-muted-foreground">
                    {scorer.goals} {scorer.goals === 1 ? "goal" : "goals"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
              Goal scorers not recorded
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  const ScoreboardTeamBlock = ({
    name,
    logoUrl,
  }: {
    name: string;
    logoUrl: string | null;
  }) => (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-white/75 bg-white/15 shadow-lg sm:h-28 sm:w-28">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl font-black">{teamInitials(name)}</span>
        )}
      </div>
      <p className="max-w-40 text-center font-display text-xl font-black uppercase leading-tight sm:max-w-44">
        {name}
      </p>
    </div>
  );

  const ResultCheckPanel = () => {
    if (sessionDisplayState !== "open") return null;

    if (resultCheck.response === "CORRECT") {
      return (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="flex items-start gap-3 pt-6">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
            <div>
              <p className="font-semibold text-green-900">You confirmed the match result</p>
              <p className="mt-1 text-sm text-green-800">Your result check is saved for this review round.</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (resultCheck.response === "INCORRECT") {
      return (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="flex items-start gap-3 pt-6">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-semibold text-amber-950">You reported that the match result is not correct</p>
              <p className="mt-1 text-sm text-amber-900">
                Team staff will review it. You cannot cast a ballot during this review round.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (resultCheckRequired) {
      return (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="text-lg">Please check the match result first</CardTitle>
            <CardDescription>
              {resultCheck.incorrectCount} {resultCheck.incorrectCount === 1 ? "teammate has" : "teammates have"} reported a concern.
              Confirm whether the scoreboard above is correct before voting.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button disabled={checkingResult} onClick={() => void recordResultCheck("CORRECT")}>
              Results are correct
            </Button>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={checkingResult}
              onClick={() => setConcernDialogOpen(true)}
            >
              Results are not correct
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Does the scoreboard look wrong?</p>
            <p className="mt-1 text-sm text-muted-foreground">Report it before submitting your ballot.</p>
          </div>
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={checkingResult}
            onClick={() => setConcernDialogOpen(true)}
          >
            These match results are not correct
          </Button>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 container py-6 mx-auto max-w-3xl animate-fade-in">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (errorState) {
    return (
      <div className="space-y-6 container py-6 mx-auto max-w-3xl animate-fade-in">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to="/mvp-votes">
            <ChevronLeft className="h-4 w-4" />
            Back to MVP Votes
          </Link>
        </Button>
        <Card className={schemaUnavailable ? "border-amber-300 bg-amber-50/50 text-center py-8" : "border-destructive/30 text-center py-8"}>
          <CardHeader>
            <div className={schemaUnavailable ? "mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2" : "mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2"}>
              {schemaUnavailable
                ? <TriangleAlert className="h-6 w-6 text-amber-700" />
                : <ShieldAlert className="h-6 w-6 text-destructive" />}
            </div>
            <CardTitle className="text-xl font-semibold">
              {schemaUnavailable ? "MVP voting upgrade not ready yet" : "MVP voting unavailable"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {errorState}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 container py-6 mx-auto max-w-3xl animate-fade-in">
      <Button asChild variant="ghost" size="sm" className="gap-2">
        <Link to="/mvp-votes">
          <ChevronLeft className="h-4 w-4" />
          Back to MVP Votes
        </Link>
      </Button>

      <Scoreboard />

      <ResultCheckPanel />

      {sessionDisplayState === "disputed" && (
        <Card className="mx-auto max-w-xl border-red-300 bg-red-50/50 text-center py-8">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-2">
              <TriangleAlert className="h-6 w-6 text-red-700" />
            </div>
            <CardTitle className="text-xl font-semibold">Match result under review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Voting is paused while team staff check the recorded result. Your existing ballot, if any, remains saved.
            </p>
          </CardContent>
        </Card>
      )}

      {sessionDisplayState === "expired" && (
        <Card className="mx-auto max-w-xl text-center py-8">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
              <Clock className="h-6 w-6 text-amber-700" />
            </div>
            <CardTitle className="text-xl font-semibold">Voting time expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The deadline has passed. You can request a reopen from the MVP Votes page.
            </p>
          </CardContent>
        </Card>
      )}

      {sessionDisplayState === "closed" && (
        <Card className="mx-auto max-w-xl text-center py-8">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl font-semibold">Voting closed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This team voting round has been closed.
            </p>
          </CardContent>
        </Card>
      )}

      {sessionDisplayState === "open" && hasVoted && (
        <Card className="mx-auto max-w-xl border-green-200 bg-green-50/50 text-center py-8">
          <CardContent className="pt-6 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-700" />
            </div>
            <h2 className="text-xl font-semibold text-green-900">
              {success ? "Ballot submitted. Thanks for voting." : "Your ballot is already submitted."}
            </h2>
            <p className="text-sm text-green-800">
              You can still check the match result above while this round remains open.
            </p>
          </CardContent>
        </Card>
      )}

      {sessionDisplayState === "open" && !hasVoted && canCastBallot && (
      <Card className="mx-auto max-w-xl">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <div className="hidden">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {session?.grade} • Round {session?.round}
            </span>
          </div>
          <CardTitle className="text-xl font-display leading-tight">
            Cast your MVP votes
          </CardTitle>
          <CardDescription>
            Pick three teammates from {homeName} vs {awayName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {eligiblePlayers.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              No other teammates are available to vote for in this game. This usually means the player list has not linked correctly yet.
            </div>
          ) : (
            <>
              {/* Vote Select 3 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  <Label htmlFor="mvp-vote-3" className="font-semibold text-sm">3 Votes (Best Player)</Label>
                </div>
                <Select
                  value={votes.vote3}
                  onValueChange={(val) => setVotes((v) => ({ ...v, vote3: val }))}
                >
                  <SelectTrigger id="mvp-vote-3">
                    <SelectValue placeholder="Select a player" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-- Select a player --</SelectItem>
                    {eligiblePlayers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.player_name} {p.jersey ? `(#${p.jersey})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vote Select 2 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 fill-gray-400 text-gray-400" />
                  <Label htmlFor="mvp-vote-2" className="font-semibold text-sm">2 Votes (Second Best)</Label>
                </div>
                <Select
                  value={votes.vote2}
                  onValueChange={(val) => setVotes((v) => ({ ...v, vote2: val }))}
                >
                  <SelectTrigger id="mvp-vote-2">
                    <SelectValue placeholder="Select a player" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-- Select a player --</SelectItem>
                    {eligiblePlayers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.player_name} {p.jersey ? `(#${p.jersey})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vote Select 1 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 fill-amber-700 text-amber-700" />
                  <Label htmlFor="mvp-vote-1" className="font-semibold text-sm">1 Vote (Third Best)</Label>
                </div>
                <Select
                  value={votes.vote1}
                  onValueChange={(val) => setVotes((v) => ({ ...v, vote1: val }))}
                >
                  <SelectTrigger id="mvp-vote-1">
                    <SelectValue placeholder="Select a player" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-- Select a player --</SelectItem>
                    {eligiblePlayers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.player_name} {p.jersey ? `(#${p.jersey})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hasDuplicates && (
                <p className="text-sm font-medium text-destructive text-center">
                  You cannot allocate points to the same player twice.
                </p>
              )}

              {/* Shoutout Section */}
              <div className="space-y-2 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mvp-shoutout" className="flex items-center gap-1.5 font-semibold text-sm">
                    Team Shoutout <Trophy className="h-4 w-4 text-yellow-500" />
                  </Label>
                  <span className="text-xs text-muted-foreground">{shoutout.length}/200</span>
                </div>
                <Textarea
                  id="mvp-shoutout"
                  placeholder="Give a shoutout to someone who made a difference — on or off the field"
                  className="resize-none h-24 text-sm"
                  maxLength={200}
                  value={shoutout}
                  onChange={(e) => setShoutout(e.target.value)}
                />
              </div>

              {/* Action Button */}
              <Button
                className="w-full mt-4"
                size="lg"
                disabled={!allSelected || hasDuplicates || submitting || !canCastBallot}
                onClick={() => void onSubmit()}
              >
                {submitting ? "Submitting..." : "Submit Ballot"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      )}

      {sessionDisplayState === "open" && !hasVoted && !canCastBallot && (
        <Card className="mx-auto max-w-xl border-dashed">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            {resultCheck.response === "INCORRECT"
              ? "Your ballot is locked for this review round because you reported that the result is incorrect."
              : "Check the match result above before the ballot becomes available."}
          </CardContent>
        </Card>
      )}

      <Dialog open={concernDialogOpen} onOpenChange={setConcernDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report an incorrect match result?</DialogTitle>
            <DialogDescription>
              This records your concern for team staff. The MVP module does not change the fixture score.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mvp-result-comment">Comment (optional)</Label>
              <Textarea
                id="mvp-result-comment"
                value={resultComment}
                onChange={(event) => setResultComment(event.target.value)}
                maxLength={500}
                className="min-h-24 resize-none"
                placeholder="Briefly explain what looks wrong"
              />
              <p className="text-right text-xs text-muted-foreground">{resultComment.length}/500</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" disabled={checkingResult} onClick={() => setConcernDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={checkingResult} onClick={() => void recordResultCheck("INCORRECT")}>
                {checkingResult ? "Saving..." : "Confirm result is not correct"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

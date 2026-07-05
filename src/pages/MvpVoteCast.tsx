import { useEffect, useState } from "react";
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
import { Star, Trophy, Clock, CheckCircle2, ChevronLeft, Calendar, ShieldAlert, MapPin, Shield } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = originalSupabase as any;

interface MvpSession {
  id: string;
  fixture_id: string;
  match_url: string;
  grade: string;
  round: string;
  game_date: string;
  home_team: string;
  away_team: string;
  status: string;
  closes_at: string;
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
  associations: { id: string; name: string | null; abbreviation: string | null } | null;
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
  team_side: string | null;
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
  const [isClosed, setIsClosed] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [eligiblePlayers, setEligiblePlayers] = useState<RevsportsPlayer[]>([]);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [fixture, setFixture] = useState<ScoreboardFixture | null>(null);
  const [scorerDialogTeam, setScorerDialogTeam] = useState<ScorerDialogTeam | null>(null);
  const [goalScorers, setGoalScorers] = useState<GoalScorer[]>([]);
  const [associationContext, setAssociationContext] = useState<string | null>(null);

  const [votes, setVotes] = useState({ vote3: "__none__", vote2: "__none__", vote1: "__none__" });
  const [shoutout, setShoutout] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadVotingDetails = async () => {
      if (!user || !sessionId) return;
      setLoading(true);
      setErrorState(null);
      try {
        // 1. Fetch voting session details
        const { data: sessionData, error: sessionErr } = await supabase
          .from("mvp_voting_sessions")
          .select("*")
          .eq("id", sessionId)
          .maybeSingle();

        if (sessionErr) throw sessionErr;
        if (!sessionData) {
          setErrorState("Voting session not found.");
          setLoading(false);
          return;
        }

        const typedSession = sessionData as MvpSession;
        setSession(typedSession);

        const { data: fixtureData, error: fixtureErr } = await supabase
          .from("fixtures")
          .select("id, fixture_date, home_score, away_score, round_number, home_team_id, away_team_id, venue_id, pitch_id")
          .eq("id", typedSession.fixture_id)
          .maybeSingle();

        if (fixtureErr) {
          console.warn("Fixture scoreboard context unavailable:", fixtureErr);
        } else {
          const fixtureRow = fixtureData as FixtureScoreRow | null;
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
                    .select("id, association_id, associations(id, name, abbreviation)")
                    .in("id", clubIds);

                  if (clubErr) {
                    console.warn("Scoreboard association context unavailable:", clubErr);
                    setAssociationContext(null);
                  } else {
                    const association = ((clubData as ClubAssociationRow[]) || [])
                      .map((club) => club.associations)
                      .find(Boolean);
                    setAssociationContext(association?.abbreviation || association?.name || null);
                  }
                } else {
                  setAssociationContext(null);
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

        // Admin controls whether a voting session is open. Some reopened
        // sessions can have an old closes_at value, so status is the source of truth.
        const closed = typedSession.status !== "OPEN";
        setIsClosed(closed);

        if (closed) {
          setLoading(false);
          return;
        }

        // 2. Check if user already submitted their vote
        const { data: submissionData, error: submissionErr } = await supabase
          .from("mvp_vote_submissions")
          .select("id")
          .eq("session_id", sessionId)
          .eq("voter_profile_id", user.id)
          .maybeSingle();

        if (submissionErr) throw submissionErr;
        if (submissionData) {
          setHasVoted(true);
          setLoading(false);
          return;
        }

        // 3. Find current user's player row in revsports_players
        const { data: voterRow, error: voterErr } = await supabase
          .from("revsports_players")
          .select("id, team, team_side, team_label")
          .eq("fixture_id", typedSession.fixture_id)
          .eq("profile_id", user.id)
          .maybeSingle();

        if (voterErr) throw voterErr;
        if (!voterRow) {
          setErrorState("We couldn't find your player record in the lineup for this game. You can only vote if you were in the lineup.");
          setLoading(false);
          return;
        }

        // 4. Fetch ALL attended players in this fixture, then filter in JS.
        // We match on the voter's team value INCLUDING null. PostgREST .eq() cannot
        // match null (SQL "= null" is never true), and for many Grampians fixtures the
        // Pumas players come through from the scraper with team = null while the
        // opposition has a real team name. So we fetch everything and compare in JS,
        // where null === null works correctly. This keeps the voter on their own side
        // of the game (teammates + fill-ins) and excludes the opposition.
        const { data: allRows, error: teammateErr } = await supabase
          .from("revsports_players")
          .select("id, player_name, team, team_side, team_label, jersey, profile_id")
          .eq("fixture_id", typedSession.fixture_id)
          .eq("attended", true);

        if (teammateErr) throw teammateErr;

        const typedRows = (allRows as RevsportsPlayer[]) || [];

        // voterRow.team may be null; (a == null && b == null) || a === b handles both cases
        const sameSide = (player: RevsportsPlayer) => {
          if (voterRow.team_side && player.team_side) {
            return player.team_side === voterRow.team_side;
          }
          if (voterRow.team_label && player.team_label) {
            return player.team_label === voterRow.team_label;
          }
          return (player.team == null && voterRow.team == null) || player.team === voterRow.team;
        };

        // Eligible = same side as voter, excluding the voter themselves
        const eligible = typedRows.filter(
          (p) => sameSide(p) && p.id !== voterRow.id && p.profile_id !== user.id
        );

        // Sort alphabetically
        const sorted = eligible.sort((a, b) => a.player_name.localeCompare(b.player_name));
        setEligiblePlayers(sorted);
      } catch (err) {
        const error = err as Error;
        console.error("Error loading voting details:", error);
        setErrorState(error.message || "Failed to load voting details.");
      } finally {
        setLoading(false);
      }
    };

    loadVotingDetails();
  }, [user, sessionId, toast]);

  const checkDuplicate = (val: string) => {
    if (val === "__none__") return false;
    const all = [votes.vote3, votes.vote2, votes.vote1];
    return all.filter((v) => v === val).length > 1;
  };

  const hasDuplicates = checkDuplicate(votes.vote3) || checkDuplicate(votes.vote2) || checkDuplicate(votes.vote1);
  const allSelected = votes.vote3 !== "__none__" && votes.vote2 !== "__none__" && votes.vote1 !== "__none__";

  const onSubmit = async () => {
    if (!user || !sessionId || !allSelected || hasDuplicates || submitting) return;
    setSubmitting(true);
    try {
      const submittedAt = new Date().toISOString();

      // Save vote rows first. If RLS blocks this step, do not create the
      // submission marker, otherwise the round disappears without a full vote.
      const votesToInsert = [
        {
          session_id: sessionId,
          voter_profile_id: user.id,
          player_id: votes.vote3,
          points: 3,
          created_at: submittedAt
        },
        {
          session_id: sessionId,
          voter_profile_id: user.id,
          player_id: votes.vote2,
          points: 2,
          created_at: submittedAt
        },
        {
          session_id: sessionId,
          voter_profile_id: user.id,
          player_id: votes.vote1,
          points: 1,
          created_at: submittedAt
        }
      ];

      const { error: votesErr } = await supabase
        .from("mvp_votes")
        .insert(votesToInsert);

      if (votesErr) throw votesErr;

      // Record the submission after the vote rows are safely saved.
      const { error: subErr } = await supabase
        .from("mvp_vote_submissions")
        .insert({
          session_id: sessionId,
          voter_profile_id: user.id,
          shoutout: shoutout.trim() || null,
          submitted_at: submittedAt
        });

      if (subErr) throw subErr;

      setSuccess(true);
      toast({
        title: "Success",
        description: "Votes submitted successfully."
      });
    } catch (err) {
      const error = err as Error;
      console.error("Error submitting votes:", error);
      toast({
        title: "Submission failed",
        description: error.message || "Failed to submit votes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Australia/Melbourne"
    });
  };

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return "Time TBC";
    return new Date(dateStr).toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Australia/Melbourne"
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
        <Link to="/mvp-votes">
          <Button variant="ghost" size="sm" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to MVP Votes
          </Button>
        </Link>
        <Card className="border-destructive/30 text-center py-8">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl font-semibold">Error</CardTitle>
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

  if (isClosed) {
    return (
      <div className="space-y-6 container py-6 mx-auto max-w-3xl animate-fade-in">
        <Link to="/mvp-votes">
          <Button variant="ghost" size="sm" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to MVP Votes
          </Button>
        </Link>
        <Scoreboard />
        <Card className="mx-auto max-w-xl text-center py-8">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle className="text-xl font-semibold">Voting Closed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Voting has closed for this game.
            </p>
            <Link to="/mvp-votes">
              <Button>Back to MVP Votes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasVoted) {
    return (
      <div className="space-y-6 container py-6 mx-auto max-w-3xl animate-fade-in">
        <Link to="/mvp-votes">
          <Button variant="ghost" size="sm" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to MVP Votes
          </Button>
        </Link>
        <Scoreboard />
        <Card className="mx-auto max-w-xl text-center py-8">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-xl font-semibold">Already Voted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              You've already voted for this game. Thank you!
            </p>
            <Link to="/mvp-votes">
              <Button>Back to MVP Votes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-6 container py-6 mx-auto max-w-3xl animate-fade-in">
        {session && <Scoreboard />}
        <Card className="mx-auto max-w-xl border-green-200 bg-green-50/50 text-center py-8">
          <CardContent className="pt-6 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-green-800">
              Votes submitted! Thanks for voting.
            </h2>
            <Link to="/mvp-votes" className="block pt-2">
              <Button>Back to MVP Votes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 container py-6 mx-auto max-w-3xl animate-fade-in">
      <Link to="/mvp-votes">
        <Button variant="ghost" size="sm" className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back to MVP Votes
        </Button>
      </Link>

      <Scoreboard />

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
                  <Label className="font-semibold text-sm">3 Votes (Best Player)</Label>
                </div>
                <Select
                  value={votes.vote3}
                  onValueChange={(val) => setVotes((v) => ({ ...v, vote3: val }))}
                >
                  <SelectTrigger>
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
                  <Label className="font-semibold text-sm">2 Votes (Second Best)</Label>
                </div>
                <Select
                  value={votes.vote2}
                  onValueChange={(val) => setVotes((v) => ({ ...v, vote2: val }))}
                >
                  <SelectTrigger>
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
                  <Label className="font-semibold text-sm">1 Vote (Third Best)</Label>
                </div>
                <Select
                  value={votes.vote1}
                  onValueChange={(val) => setVotes((v) => ({ ...v, vote1: val }))}
                >
                  <SelectTrigger>
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
                  <Label className="flex items-center gap-1.5 font-semibold text-sm">
                    Club Champion Shoutout <Trophy className="h-4 w-4 text-yellow-500" />
                  </Label>
                  <span className="text-xs text-muted-foreground">{shoutout.length}/200</span>
                </div>
                <Textarea
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
                disabled={!allSelected || hasDuplicates || submitting}
                onClick={onSubmit}
              >
                {submitting ? "Submitting..." : "Submit Votes"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

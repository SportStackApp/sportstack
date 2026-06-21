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
import { useToast } from "@/hooks/use-toast";
import { Star, Trophy, Clock, CheckCircle2, ChevronLeft, Calendar, ShieldAlert } from "lucide-react";

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

interface RevsportsPlayer {
  id: string;
  player_name: string;
  team: string;
  jersey: string | null;
  profile_id: string | null;
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

        // Check if session is closed
        const closesAt = new Date(typedSession.closes_at);
        const closed = typedSession.status !== "OPEN" || closesAt <= new Date();
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
          .select("id, team")
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
          .select("id, player_name, team, jersey, profile_id")
          .eq("fixture_id", typedSession.fixture_id)
          .eq("attended", true);

        if (teammateErr) throw teammateErr;

        const typedRows = (allRows as RevsportsPlayer[]) || [];

        // voterRow.team may be null; (a == null && b == null) || a === b handles both cases
        const sameSide = (rowTeam: string | null) =>
          (rowTeam == null && voterRow.team == null) || rowTeam === voterRow.team;

        // Eligible = same side as voter, excluding the voter themselves
        const eligible = typedRows.filter(
          (p) => sameSide(p.team) && p.id !== voterRow.id && p.profile_id !== user.id
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
      // 1. Insert into mvp_vote_submissions
      const { error: subErr } = await supabase
        .from("mvp_vote_submissions")
        .insert({
          session_id: sessionId,
          voter_profile_id: user.id,
          shoutout: shoutout.trim() || null,
          submitted_at: new Date().toISOString()
        });

      if (subErr) throw subErr;

      // 2. Insert three rows into mvp_votes
      const votesToInsert = [
        {
          session_id: sessionId,
          voter_profile_id: user.id,
          player_id: votes.vote3,
          points: 3,
          created_at: new Date().toISOString()
        },
        {
          session_id: sessionId,
          voter_profile_id: user.id,
          player_id: votes.vote2,
          points: 2,
          created_at: new Date().toISOString()
        },
        {
          session_id: sessionId,
          voter_profile_id: user.id,
          player_id: votes.vote1,
          points: 1,
          created_at: new Date().toISOString()
        }
      ];

      const { error: votesErr } = await supabase
        .from("mvp_votes")
        .insert(votesToInsert);

      if (votesErr) throw votesErr;

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

  if (loading) {
    return (
      <div className="space-y-6 container py-6 mx-auto max-w-xl animate-fade-in">
        <Skeleton className="h-8 w-32" />
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
      <div className="space-y-6 container py-6 mx-auto max-w-xl animate-fade-in">
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
      <div className="space-y-6 container py-6 mx-auto max-w-xl animate-fade-in">
        <Link to="/mvp-votes">
          <Button variant="ghost" size="sm" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to MVP Votes
          </Button>
        </Link>
        <Card className="text-center py-8">
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
      <div className="space-y-6 container py-6 mx-auto max-w-xl animate-fade-in">
        <Link to="/mvp-votes">
          <Button variant="ghost" size="sm" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to MVP Votes
          </Button>
        </Link>
        <Card className="text-center py-8">
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
      <div className="space-y-6 container py-6 mx-auto max-w-xl animate-fade-in">
        <Card className="border-green-200 bg-green-50/50 text-center py-8">
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
    <div className="space-y-6 container py-6 mx-auto max-w-xl animate-fade-in">
      <Link to="/mvp-votes">
        <Button variant="ghost" size="sm" className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back to MVP Votes
        </Button>
      </Link>

      <Card>
        <CardHeader className="bg-muted/30 border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {session?.grade} • Round {session?.round}
            </span>
          </div>
          <CardTitle className="text-xl font-display leading-tight">
            {session?.home_team} vs {session?.away_team}
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5 mt-1 font-medium">
            <Calendar className="h-3.5 w-3.5" />
            {session ? formatDate(session.game_date) : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {eligiblePlayers.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              No other teammates found in the lineup for this game.
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

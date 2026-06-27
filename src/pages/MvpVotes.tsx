import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase as originalSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ShieldAlert, Award } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = originalSupabase as any;

// Types for the database rows
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
  opened_at: string;
  closes_at: string;
}

interface RevsportsPlayerRow {
  fixture_id: string;
}

interface SubmissionRow {
  session_id: string;
}

export default function MvpVotes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isVoter, setIsVoter] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<MvpSession[]>([]);

  useEffect(() => {
    const loadVotingData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // 1. Check if user has VOTER role
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

        // 2. Fetch user's attended RevSports games and already voted submissions.
        // The admin MVP screen uses revsports_players.profile_id as the player link,
        // so the voter page must use the same source instead of the older lineups table.
        const [playersRes, submissionsRes] = await Promise.all([
          supabase
            .from("revsports_players")
            .select("fixture_id")
            .eq("profile_id", user.id)
            .eq("attended", true),
          supabase
            .from("mvp_vote_submissions")
            .select("session_id")
            .eq("voter_profile_id", user.id)
        ]);

        if (playersRes.error) throw playersRes.error;
        if (submissionsRes.error) throw submissionsRes.error;

        const playersData = playersRes.data as RevsportsPlayerRow[] | null;
        const submissionsData = submissionsRes.data as SubmissionRow[] | null;

        const fixtureIds = Array.from(
          new Set(playersData?.map((p) => p.fixture_id).filter(Boolean) || [])
        );
        const votedSessionIds = new Set(
          submissionsData?.map((s) => s.session_id) || []
        );

        if (fixtureIds.length === 0) {
          setSessions([]);
          setLoading(false);
          return;
        }

        // 3. Fetch open and active voting sessions matching those fixtures
        const now = new Date().toISOString();
        const { data: sessionsData, error: sessionsError } = await supabase
          .from("mvp_voting_sessions")
          .select("*")
          .in("fixture_id", fixtureIds)
          .eq("status", "OPEN")
          .gt("closes_at", now)
          .order("game_date", { ascending: true });

        if (sessionsError) throw sessionsError;

        const typedSessions = (sessionsData as MvpSession[] | null) || [];

        // 4. Filter out sessions already voted in
        const outstanding = typedSessions.filter(
          (session) => !votedSessionIds.has(session.id)
        );

        setSessions(outstanding);
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Australia/Melbourne",
    });
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
              You must have the "VOTER" role assigned to access MVP voting. Please contact your administrator.
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
        <p className="text-muted-foreground mt-1">Vote for the player of the match in your recent games</p>
      </div>

      {sessions.length === 0 ? (
        <Card className="border-dashed py-16 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center mb-4">
            <Award className="h-6 w-6 text-primary opacity-60" />
          </div>
          <CardTitle className="text-lg font-medium text-foreground">You're all caught up</CardTitle>
          <CardDescription className="mt-1 text-sm text-muted-foreground">
            No votes outstanding.
          </CardDescription>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
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
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0 text-muted-foreground/75" />
                  <span>{formatDate(session.game_date)}</span>
                </div>
                <Link to={`/mvp-votes/${session.id}`} className="block w-full">
                  <Button className="w-full" variant="default">
                    Vote Now
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

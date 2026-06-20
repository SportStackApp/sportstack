import { useState, useEffect } from "react";
import { supabase as originalSupabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useToast } from "@/hooks/use-toast";
import { 
  Trophy, ChevronLeft, RefreshCw, Mail, XCircle, CheckCircle2, Clock, Users 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle 
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

// Widened Supabase client type for these custom MVP queries
const supabase = originalSupabase as any;

interface MvpSession {
  id: string;
  grade: string;
  round: string;
  game_date: string;
  home_team: string;
  away_team: string;
  status: string;
  opens_at: string;
  closes_at: string;
  votedCount?: number;
  totalVoters?: number;
}

interface RankedResult {
  playerId: string;
  name: string;
  points: number;
}

interface VoterStatus {
  id: string;
  revsports_player_id: string;
  voted_at: string | null;
  player_name: string;
}

export default function MvpVotingAdmin() {
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin, highestScopedRole } = useAdminScope();

  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // List view states
  const [sessions, setSessions] = useState<MvpSession[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // Detail view states
  const [sessionDetails, setSessionDetails] = useState<MvpSession | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [results, setResults] = useState<RankedResult[]>([]);
  const [voters, setVoters] = useState<VoterStatus[]>([]);

  // Dialog and action states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCancelToken, setSelectedCancelToken] = useState<VoterStatus | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const hasAccess = isSuperAdmin || highestScopedRole === "ASSOCIATION_ADMIN";

  // Load session list
  const loadSessions = async () => {
    setListLoading(true);
    try {
      const { data, error } = await supabase
        .from("mvp_voting_sessions")
        .select("*")
        .order("game_date", { ascending: false });

      if (error) throw error;

      if (data) {
        // Fetch eligible voters and votes cast counts per session
        const sessionsWithCounts = await Promise.all(
          data.map(async (session: any) => {
            // Count total tokens (eligible voters)
            const { count: tokenCount } = await supabase
              .from("mvp_vote_tokens")
              .select("*", { count: "exact", head: true })
              .eq("session_id", session.id);

            // Fetch token IDs to query mvp_votes cast
            const { data: sessionTokens } = await supabase
              .from("mvp_vote_tokens")
              .select("id")
              .eq("session_id", session.id);

            const tokenIds = (sessionTokens || []).map((t: any) => t.id);
            let votedCount = 0;

            if (tokenIds.length > 0) {
              const { data: votesData } = await supabase
                .from("mvp_votes")
                .select("token_id")
                .in("token_id", tokenIds);

              votedCount = new Set((votesData || []).map((v: any) => v.token_id)).size;
            }

            return {
              ...session,
              votedCount,
              totalVoters: tokenCount || 0,
            };
          })
        );
        setSessions(sessionsWithCounts);
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error loading sessions",
        description: err.message || "An unexpected error occurred.",
      });
    } finally {
      setListLoading(false);
    }
  };

  // Load session detail view data
  const loadSessionDetails = async (sessionId: string) => {
    setDetailLoading(true);
    try {
      // 1. Load session row
      const { data: sessionRow, error: sErr } = await supabase
        .from("mvp_voting_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();

      if (sErr) throw sErr;
      if (!sessionRow) throw new Error("Session not found");

      setSessionDetails(sessionRow);

      // 2. Fetch all tokens for this session
      const { data: tokensData, error: tErr } = await supabase
        .from("mvp_vote_tokens")
        .select("*")
        .eq("session_id", sessionId);

      if (tErr) throw tErr;

      const tokenIds = (tokensData || []).map((t: any) => t.id);
      const playerIds = (tokensData || []).map((t: any) => t.revsports_player_id).filter(Boolean);

      // Fetch player names mapping
      let playersMap: Record<string, string> = {};
      if (playerIds.length > 0) {
        const { data: playersData } = await supabase
          .from("revsports_players")
          .select("id, player_name")
          .in("id", playerIds);
        if (playersData) {
          playersData.forEach((p: any) => {
            playersMap[p.id] = p.player_name;
          });
        }
      }

      // Map voter status list
      const mappedVoters: VoterStatus[] = (tokensData || []).map((t: any) => ({
        id: t.id,
        revsports_player_id: t.revsports_player_id,
        voted_at: t.voted_at,
        player_name: playersMap[t.revsports_player_id] || "Unknown Player",
      }));
      setVoters(mappedVoters);

      // 3. Load votes and calculate ranked leaderboard
      let rankedResults: RankedResult[] = [];
      if (tokenIds.length > 0) {
        const { data: votesData, error: vErr } = await supabase
          .from("mvp_votes")
          .select("player_id, points")
          .in("token_id", tokenIds);

        if (vErr) throw vErr;

        if (votesData && votesData.length > 0) {
          const uniqueRecipients = Array.from(new Set(votesData.map((v: any) => v.player_id)));
          let recipientNamesMap: Record<string, string> = {};

          if (uniqueRecipients.length > 0) {
            const { data: recipientsData } = await supabase
              .from("revsports_players")
              .select("id, player_name")
              .in("id", uniqueRecipients);

            if (recipientsData) {
              recipientsData.forEach((r: any) => {
                recipientNamesMap[r.id] = r.player_name;
              });
            }
          }

          // Group and sum points
          const groups: Record<string, { name: string; points: number }> = {};
          votesData.forEach((v: any) => {
            const name = recipientNamesMap[v.player_id] || "Unknown Player";
            if (!groups[v.player_id]) {
              groups[v.player_id] = { name, points: 0 };
            }
            groups[v.player_id].points += v.points || 0;
          });

          // Sort by points descending
          rankedResults = Object.entries(groups).map(([playerId, val]) => ({
            playerId,
            name: val.name,
            points: val.points,
          })).sort((a, b) => b.points - a.points);
        }
      }
      setResults(rankedResults);

    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error loading session details",
        description: err.message || "An unexpected error occurred.",
      });
      setView("list");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess && view === "list") {
      loadSessions();
    }
  }, [hasAccess, view]);

  // Action: Reopen closed session
  const handleReopenSession = async () => {
    if (!sessionDetails) return;
    setActionLoading(true);
    try {
      const closesAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      const { error: updateErr } = await supabase
        .from("mvp_voting_sessions")
        .update({ 
          status: "OPEN", 
          closes_at: closesAt 
        })
        .eq("id", sessionDetails.id);

      if (updateErr) throw updateErr;

      const { data: { user } } = await supabase.auth.getUser();
      const { error: auditErr } = await supabase
        .from("mvp_vote_audit")
        .insert({
          action: "REOPEN",
          session_id: sessionDetails.id,
          changed_by: user?.id,
          reason: "Admin reopened session",
        });

      if (auditErr) throw auditErr;

      toast({
        title: "Session Reopened",
        description: "The voting session is now OPEN for 72 hours.",
      });

      await loadSessionDetails(sessionDetails.id);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error reopening session",
        description: err.message || "An unexpected error occurred.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Resend notification to non-voters (mock)
  const handleResendToNonVoters = () => {
    toast({
      title: "Resend to Non-Voters",
      description: "Email resend will be available once the email trigger is built",
    });
  };

  // Action: Cancel vote confirmation flow
  const handleCancelVoteConfirm = async () => {
    if (!selectedCancelToken || !sessionDetails) return;
    setActionLoading(true);
    try {
      // 1. Delete votes
      const { error: delErr } = await supabase
        .from("mvp_votes")
        .delete()
        .eq("token_id", selectedCancelToken.id);

      if (delErr) throw delErr;

      // 2. Clear voted_at on token
      const { error: tokErr } = await supabase
        .from("mvp_vote_tokens")
        .update({ voted_at: null })
        .eq("id", selectedCancelToken.id);

      if (tokErr) throw tokErr;

      // 3. Write audit log
      const { data: { user } } = await supabase.auth.getUser();
      const { error: auditErr } = await supabase
        .from("mvp_vote_audit")
        .insert({
          action: "CANCEL_VOTE",
          session_id: sessionDetails.id,
          changed_by: user?.id,
          reason: "Admin cancelled vote for resubmission",
        });

      if (auditErr) throw auditErr;

      toast({
        title: "Vote Cancelled",
        description: `Successfully cancelled vote for ${selectedCancelToken.player_name}.`,
      });

      setDialogOpen(false);
      setSelectedCancelToken(null);
      await loadSessionDetails(sessionDetails.id);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error cancelling vote",
        description: err.message || "An unexpected error occurred.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (scopeLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto p-6 flex justify-center items-center min-h-[400px]">
        <Card className="w-full max-w-md border-red-200 bg-red-50/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <XCircle className="h-5 w-5" /> Access Denied
            </CardTitle>
            <CardDescription className="text-red-600 font-medium">
              Administrative permissions required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 text-sm">
              You must be a Super Admin or Association Admin to view this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Format Australian dates
  const formatDateString = (dateStr: string) => {
    return new Intl.DateTimeFormat("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(dateStr));
  };

  const formatDateTimeString = (dateStr: string) => {
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(dateStr));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">PENDING</Badge>;
      case "OPEN":
        return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">OPEN</Badge>;
      case "CLOSED":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100">CLOSED</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {view === "list" ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-gray-900 flex items-center gap-2">
                <Trophy className="h-8 w-8 text-yellow-500 fill-yellow-500/20" /> MVP Voting
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage best-on-ground voting sessions
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadSessions} className="self-start md:self-auto gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>

          <Card className="shadow-sm border-border bg-card">
            <CardContent className="p-0">
              {listLoading ? (
                <div className="p-6 space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  No MVP voting sessions found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="font-semibold text-foreground">Grade</TableHead>
                        <TableHead className="font-semibold text-foreground">Round</TableHead>
                        <TableHead className="font-semibold text-foreground">Game Date</TableHead>
                        <TableHead className="font-semibold text-foreground">Teams</TableHead>
                        <TableHead className="font-semibold text-foreground">Status</TableHead>
                        <TableHead className="font-semibold text-foreground">Voted</TableHead>
                        <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((session) => (
                        <TableRow key={session.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium">{session.grade}</TableCell>
                          <TableCell>{session.round}</TableCell>
                          <TableCell>{formatDateString(session.game_date)}</TableCell>
                          <TableCell className="font-semibold">
                            {session.home_team} <span className="text-muted-foreground font-normal">vs</span> {session.away_team}
                          </TableCell>
                          <TableCell>{getStatusBadge(session.status)}</TableCell>
                          <TableCell className="font-medium text-muted-foreground">
                            <span className="text-foreground font-bold">{session.votedCount}</span> / {session.totalVoters}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setView("detail");
                                setSelectedSessionId(session.id);
                                loadSessionDetails(session.id);
                              }}
                            >
                              View Results
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        // DETAIL VIEW
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setView("list");
                setSelectedSessionId(null);
                setSessionDetails(null);
                setResults([]);
                setVoters([]);
              }}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" /> Back to all sessions
            </Button>
          </div>

          {detailLoading || !sessionDetails ? (
            <div className="space-y-6">
              <Skeleton className="h-32 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            </div>
          ) : (
            <>
              <Card className="overflow-hidden border-border bg-gradient-to-r from-card to-muted/20 shadow-md">
                <CardHeader className="pb-4 border-b bg-card">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold tracking-wide text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-full">
                          {sessionDetails.grade}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground uppercase">
                          • {sessionDetails.round}
                        </span>
                      </div>
                      <CardTitle className="text-2xl font-black text-foreground">
                        {sessionDetails.home_team} vs {sessionDetails.away_team}
                      </CardTitle>
                      <CardDescription className="text-sm font-semibold text-gray-700">
                        {formatDateString(sessionDetails.game_date)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 self-start md:self-auto">
                      {getStatusBadge(sessionDetails.status)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadSessionDetails(sessionDetails.id)}
                        disabled={actionLoading}
                        className="h-8 w-8 p-0"
                      >
                        <RefreshCw className={`h-4 w-4 ${actionLoading ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 pb-6 bg-card/40">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground block text-xs">Voting Opened</span>
                        <span className="font-semibold flex items-center gap-1.5 mt-0.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDateTimeString(sessionDetails.opened_at)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Voting Closes</span>
                        <span className="font-semibold flex items-center gap-1.5 mt-0.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDateTimeString(sessionDetails.closes_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 md:pt-0">
                      {sessionDetails.status === "CLOSED" && (
                        <Button
                          variant="outline"
                          onClick={handleReopenSession}
                          disabled={actionLoading}
                          className="gap-2"
                        >
                          <RefreshCw className={`h-4 w-4 ${actionLoading ? "animate-spin" : ""}`} />
                          Reopen Session
                        </Button>
                      )}
                      {sessionDetails.status === "OPEN" && (
                        <Button
                          variant="outline"
                          onClick={handleResendToNonVoters}
                          disabled={actionLoading}
                          className="gap-2"
                        >
                          <Mail className="h-4 w-4" />
                          Resend to Non-Voters
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* RESULTS SECTION */}
                <Card className="shadow-sm border-border">
                  <CardHeader className="bg-muted/20 border-b py-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500 fill-yellow-500/20" /> Results
                    </CardTitle>
                    <CardDescription>Live standings and point tallies</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {results.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        No votes have been submitted yet.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16 font-semibold">Rank</TableHead>
                            <TableHead className="font-semibold">Player Name</TableHead>
                            <TableHead className="text-right font-semibold">Points</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.map((res, index) => {
                            const isWinner = index === 0;
                            return (
                              <TableRow 
                                key={res.playerId} 
                                className={`${isWinner ? "bg-amber-50/70 hover:bg-amber-50" : "hover:bg-muted/30"} transition-colors`}
                              >
                                <TableCell className="font-bold text-center">
                                  {isWinner ? "🥇 1" : index + 1}
                                </TableCell>
                                <TableCell className={`font-semibold ${isWinner ? "text-amber-900" : ""}`}>
                                  {res.name}
                                </TableCell>
                                <TableCell className={`text-right font-black ${isWinner ? "text-amber-900 text-base" : ""}`}>
                                  {res.points}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* VOTER STATUS SECTION */}
                <Card className="shadow-sm border-border">
                  <CardHeader className="bg-muted/20 border-b py-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" /> Voter Status
                    </CardTitle>
                    <CardDescription>Check status of individual player links</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {voters.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        No eligible voter tokens exist for this session.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="font-semibold">Player Name</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="text-right font-semibold">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {voters.map((voter) => (
                            <TableRow key={voter.id} className="hover:bg-muted/30 transition-colors">
                              <TableCell className="font-medium">{voter.player_name}</TableCell>
                              <TableCell>
                                {voter.voted_at ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="h-3 w-3" /> Voted
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                                    <Clock className="h-3 w-3" /> Pending
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {voter.voted_at && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedCancelToken(voter);
                                      setDialogOpen(true);
                                    }}
                                    disabled={actionLoading}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Cancel Vote"
                                  >
                                    <XCircle className="h-4.5 w-4.5" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* CONFIRMATION DIALOG FOR CANCELLING VOTE */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" /> Cancel Player Vote
            </DialogTitle>
            <DialogDescription className="pt-2 text-foreground font-medium">
              Are you sure you want to cancel {selectedCancelToken?.player_name}'s vote? They will be able to resubmit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setSelectedCancelToken(null);
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelVoteConfirm}
              disabled={actionLoading}
              className="gap-2"
            >
              {actionLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

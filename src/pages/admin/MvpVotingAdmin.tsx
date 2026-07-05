import { useState, useEffect } from "react";
import { supabase as originalSupabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useToast } from "@/hooks/use-toast";
import { 
  Trophy, ChevronLeft, ChevronRight, RefreshCw, Mail, XCircle, CheckCircle2, Clock, Users 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
  opened_at: string;
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

interface Shoutout {
  voterName: string;
  text: string;
}

export default function MvpVotingAdmin() {
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin, highestScopedRole, scopedAssociationIds } = useAdminScope();

  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Reference data states
  const [allAssociations, setAllAssociations] = useState<{ id: string; name: string }[]>([]);
  const [allClubs, setAllClubs] = useState<{ id: string; name: string; association_id: string }[]>([]);
  const [allDivisions, setAllDivisions] = useState<{ id: string; name: string; association_id: string }[]>([]);
  const [allTeams, setAllTeams] = useState<{ id: string; name: string; club_id: string; division_id: string | null }[]>([]);

  // Filter states
  const [filterAssociation, setFilterAssociation] = useState<string>("ALL");
  const [filterClub, setFilterClub] = useState<string>("ALL");
  const [filterDivision, setFilterDivision] = useState<string>("ALL");
  const [filterTeam, setFilterTeam] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("OPEN"); // Default OPEN
  const [filterRound, setFilterRound] = useState<string>("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // List view states
  const [sessions, setSessions] = useState<MvpSession[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // Detail view states
  const [sessionDetails, setSessionDetails] = useState<MvpSession | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [results, setResults] = useState<RankedResult[]>([]);
  const [voters, setVoters] = useState<VoterStatus[]>([]);
  const [shoutouts, setShoutouts] = useState<Shoutout[]>([]);

  // Dialog and action states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCancelToken, setSelectedCancelToken] = useState<VoterStatus | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const hasAccess = isSuperAdmin || highestScopedRole === "ASSOCIATION_ADMIN";

  // Load reference data on mount
  useEffect(() => {
    const loadRefData = async () => {
      try {
        const [assocRes, clubRes, divRes, teamRes] = await Promise.all([
          supabase.from("associations").select("id, name").order("name"),
          supabase.from("clubs").select("id, name, association_id").order("name"),
          supabase.from("divisions").select("id, name, association_id").order("name"),
          supabase.from("teams").select("id, name, club_id, division_id").order("name"),
        ]);

        setAllAssociations(assocRes.data || []);
        setAllClubs(clubRes.data || []);
        setAllDivisions(divRes.data || []);
        setAllTeams(teamRes.data || []);
      } catch (err) {
        console.error("Error loading reference data:", err);
      }
    };
    
    loadRefData();
  }, []);

  // Initialize and restrict association admin to their scoped association
  useEffect(() => {
    if (!isSuperAdmin && scopedAssociationIds && scopedAssociationIds.length > 0) {
      setFilterAssociation(scopedAssociationIds[0]);
    }
  }, [isSuperAdmin, scopedAssociationIds]);

  // Cascading filter handlers
  const handleAssociationChange = (val: string) => {
    setFilterAssociation(val);
    setFilterClub("ALL");
    setFilterDivision("ALL");
    setFilterTeam("ALL");
    setCurrentPage(1);
  };

  const handleClubChange = (val: string) => {
    setFilterClub(val);
    setFilterDivision("ALL");
    setFilterTeam("ALL");
    setCurrentPage(1);
  };

  const handleDivisionChange = (val: string) => {
    setFilterDivision(val);
    setFilterTeam("ALL");
    setCurrentPage(1);
  };

  // Filter derivations
  const filteredDivisions = allDivisions.filter((div) => {
    if (filterAssociation !== "ALL" && div.association_id !== filterAssociation) {
      return false;
    }
    if (filterClub !== "ALL") {
      return allTeams.some((t) => t.club_id === filterClub && t.division_id === div.id);
    }
    return true;
  });

  const filteredTeams = allTeams.filter((team) => {
    if (filterClub !== "ALL" && team.club_id !== filterClub) {
      return false;
    }
    if (filterDivision !== "ALL" && team.division_id !== filterDivision) {
      return false;
    }
    if (filterAssociation !== "ALL") {
      const club = allClubs.find((c) => c.id === team.club_id);
      if (!club || club.association_id !== filterAssociation) {
        return false;
      }
    }
    return true;
  });

  // Load session list
  const loadSessions = async () => {
    setListLoading(true);
    try {
      // Resolve Association/Club filters to a list of team IDs first (home OR
      // away), since clubs.association_id and teams.club_id only exist on the
      // team row, and a club/association can appear on either side of a
      // fixture. This avoids a 3-level-deep nested PostgREST filter that
      // previously only matched the home team and silently hid away games.
      let teamIdsForClubOrAssoc: string[] | null = null;
      if (filterAssociation !== "ALL" || filterClub !== "ALL") {
        let teamQuery = supabase.from("teams").select("id, club_id, clubs!inner(id, association_id)");
        if (filterClub !== "ALL") {
          teamQuery = teamQuery.eq("club_id", filterClub);
        }
        if (filterAssociation !== "ALL") {
          teamQuery = teamQuery.eq("clubs.association_id", filterAssociation);
        }
        const { data: matchingTeams, error: teamErr } = await teamQuery;
        if (teamErr) throw teamErr;
        teamIdsForClubOrAssoc = (matchingTeams || []).map((t: any) => t.id);
      }

      let query = supabase
        .from("mvp_voting_sessions")
        .select(`
          *,
          fixtures!inner(
            id,
            division_id,
            home_team_id,
            away_team_id,
            round_number
          )
        `, { count: "exact" });

      // Apply Filters
      if (teamIdsForClubOrAssoc !== null) {
        if (teamIdsForClubOrAssoc.length === 0) {
          // No teams match this association/club combo — short-circuit to empty results
          setSessions([]);
          setTotalCount(0);
          setListLoading(false);
          return;
        }
        const idList = teamIdsForClubOrAssoc.join(",");
        query = query.or(`home_team_id.in.(${idList}),away_team_id.in.(${idList})`, { foreignTable: "fixtures" });
      }
      if (filterDivision !== "ALL") {
        query = query.eq("fixtures.division_id", filterDivision);
      }
      if (filterTeam !== "ALL") {
        query = query.or(`home_team_id.eq.${filterTeam},away_team_id.eq.${filterTeam}`, { foreignTable: "fixtures" });
      }
      if (filterStatus !== "ALL") {
        query = query.eq("status", filterStatus);
      }
      if (filterRound.trim() !== "") {
        query = query.ilike("round", `%Round ${filterRound}%`);
      }

      // Order and Paginate
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order("game_date", { ascending: false })
        .range(from, to);

      if (error) throw error;

      setTotalCount(count || 0);

      if (data) {
        // Fetch submission counts and eligible voter counts in bulk for this page's sessions
        const sessionIds = data.map((s: any) => s.id);
        const fixtureIds = data.map((s: any) => s.fixture_id).filter(Boolean);

        // 1. Bulk fetch submission counts (votedCount)
        const submissionsGroup: Record<string, number> = {};
        if (sessionIds.length > 0) {
          const { data: subsData, error: subsErr } = await supabase
            .from("mvp_vote_submissions")
            .select("session_id")
            .in("session_id", sessionIds);
          
          if (subsErr) throw subsErr;

          (subsData || []).forEach((sub: any) => {
            submissionsGroup[sub.session_id] = (submissionsGroup[sub.session_id] || 0) + 1;
          });
        }

        // 2. Bulk fetch eligible voters
        const voterCountsGroup: Record<string, number> = {};
        if (fixtureIds.length > 0) {
          const { data: playersData, error: playersErr } = await supabase
            .from("revsports_players")
            .select("fixture_id, profile_id, team")
            .in("fixture_id", fixtureIds)
            .eq("attended", true)
            .not("profile_id", "is", null);

          if (playersErr) throw playersErr;

          // Group by fixture_id and count distinct profile_ids for Pumas side (team is null or "Grampians Hockey Club")
          const fixtureVoterProfiles: Record<string, Set<string>> = {};
          (playersData || []).forEach((row: any) => {
            const isPumas = row.team === null || row.team === "Grampians Hockey Club";
            if (isPumas) {
              if (!fixtureVoterProfiles[row.fixture_id]) {
                fixtureVoterProfiles[row.fixture_id] = new Set();
              }
              fixtureVoterProfiles[row.fixture_id].add(row.profile_id);
            }
          });

          Object.entries(fixtureVoterProfiles).forEach(([fixId, profSet]) => {
            voterCountsGroup[fixId] = profSet.size;
          });
        }

        const sessionsWithCounts = data.map((session: any) => ({
          ...session,
          votedCount: submissionsGroup[session.id] || 0,
          totalVoters: voterCountsGroup[session.fixture_id] || 0,
        }));

        setSessions(sessionsWithCounts);
      } else {
        setSessions([]);
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

      // 2. Fetch all submissions for this session (login-based model).
      //    Each row = one voter who has voted, plus their optional shoutout text.
      const { data: submissionsData, error: subErr } = await supabase
        .from("mvp_vote_submissions")
        .select("id, voter_profile_id, shoutout, submitted_at")
        .eq("session_id", sessionId);

      if (subErr) throw subErr;

      const submissions = submissionsData || [];
      const votedProfileIds = new Set(submissions.map((s: any) => s.voter_profile_id));

      // 3. Build the eligible-voter list = distinct attended players in this fixture
      //    who have a linked profile. Mark who has voted (has a submission row).
      let mappedVoters: VoterStatus[] = [];
      const profileNameMap: Record<string, string> = {};
      if (sessionRow.fixture_id) {
        const { data: attendedRowsRaw, error: attErr } = await supabase
          .from("revsports_players")
          .select("id, player_name, profile_id, team")
          .eq("fixture_id", sessionRow.fixture_id)
          .eq("attended", true)
          .not("profile_id", "is", null);

        if (attErr) throw attErr;

        // Same Pumas-side rule as loadSessions: team is null or "Grampians Hockey Club"
        // for our side; the opposition always has a distinct real team name. This keeps
        // opposition players (and anyone else, e.g. an umpire with an unrelated player
        // profile) out of the eligible-voter list.
        const attendedRows = (attendedRowsRaw || []).filter(
          (r: any) => r.team === null || r.team === "Grampians Hockey Club"
        );

        // Resolve real names from profiles for nicer display
        const profileIds = Array.from(
          new Set([...(attendedRows || []).map((r: any) => r.profile_id), ...submissions.map((s: any) => s.voter_profile_id)])
        ).filter(Boolean);
        if (profileIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", profileIds);
          (profs || []).forEach((p: any) => {
            profileNameMap[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
          });
        }

        // Deduplicate by profile_id (a player may appear once per fixture, but be safe)
        const seen = new Set<string>();
        mappedVoters = (attendedRows || [])
          .filter((r: any) => {
            if (seen.has(r.profile_id)) return false;
            seen.add(r.profile_id);
            return true;
          })
          .map((r: any) => ({
            id: r.profile_id,
            revsports_player_id: r.id,
            voted_at: votedProfileIds.has(r.profile_id) ? "voted" : null,
            player_name: profileNameMap[r.profile_id] || r.player_name || "Unknown Player",
          }));
      }
      setVoters(mappedVoters);

      // 4. Shoutouts (Grampians Champion) = non-empty shoutout text on submissions
      const mappedShoutouts: Shoutout[] = submissions
        .filter((s: any) => s.shoutout && s.shoutout.trim() !== "")
        .map((s: any) => ({
          voterName: profileNameMap[s.voter_profile_id] || "A teammate",
          text: s.shoutout.trim(),
        }));
      setShoutouts(mappedShoutouts);

      // 5. Load votes for this session and calculate the ranked leaderboard.
      //    Votes are keyed by session_id (not token_id) in the login-based model.
      //    player_id points at a revsports_players row id.
      let rankedResults: RankedResult[] = [];
      const { data: votesData, error: vErr } = await supabase
        .from("mvp_votes")
        .select("player_id, points")
        .eq("session_id", sessionId);

      if (vErr) throw vErr;

      if (votesData && votesData.length > 0) {
        const uniqueRecipients = Array.from(new Set(votesData.map((v: any) => v.player_id)));
        const recipientNamesMap: Record<string, string> = {};

        if (uniqueRecipients.length > 0) {
          // Get revsports rows (for name + profile link)
          const { data: recipientsData } = await supabase
            .from("revsports_players")
            .select("id, player_name, profile_id")
            .in("id", uniqueRecipients);

          // Prefer the real profile name where we have it, else the scraped name
          const recProfileIds = (recipientsData || []).map((r: any) => r.profile_id).filter(Boolean);
          const recProfileNames: Record<string, string> = {};
          if (recProfileIds.length > 0) {
            const { data: recProfs } = await supabase
              .from("profiles")
              .select("id, first_name, last_name")
              .in("id", recProfileIds);
            (recProfs || []).forEach((p: any) => {
              recProfileNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
            });
          }
          (recipientsData || []).forEach((r: any) => {
            recipientNamesMap[r.id] = (r.profile_id && recProfileNames[r.profile_id]) || r.player_name || "Unknown Player";
          });
        }

        // Group and sum points by recipient
        const groups: Record<string, { name: string; points: number }> = {};
        votesData.forEach((v: any) => {
          const name = recipientNamesMap[v.player_id] || "Unknown Player";
          if (!groups[v.player_id]) {
            groups[v.player_id] = { name, points: 0 };
          }
          groups[v.player_id].points += v.points || 0;
        });

        rankedResults = Object.entries(groups).map(([playerId, val]) => ({
          playerId,
          name: val.name,
          points: val.points,
        })).sort((a, b) => b.points - a.points);
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
  }, [
    hasAccess,
    view,
    currentPage,
    pageSize,
    filterAssociation,
    filterClub,
    filterDivision,
    filterTeam,
    filterStatus,
    filterRound
  ]);

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

  // Action: Resend voting reminder to players who have not voted.
  const handleResendToNonVoters = async () => {
    if (!sessionDetails) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mvp-voting-email-reminders", {
        body: {
          action: "manual_resend",
          session_id: sessionDetails.id,
        },
      });

      if (error) throw error;

      toast({
        title: "Reminder sent",
        description: `Sent ${data?.sent || 0} email(s). Skipped ${data?.skipped || 0}. Failed ${data?.failed || 0}.`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Reminder failed",
        description: err instanceof Error ? err.message : "The reminder email could not be sent.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Cancel vote confirmation flow
  const handleCancelVoteConfirm = async () => {
    if (!selectedCancelToken || !sessionDetails) return;
    setActionLoading(true);
    try {
      // In the login-based model, selectedCancelToken.id holds the voter's PROFILE id.
      // 1. Delete this voter's three vote rows for this session.
      const { error: delErr } = await supabase
        .from("mvp_votes")
        .delete()
        .eq("session_id", sessionDetails.id)
        .eq("voter_profile_id", selectedCancelToken.id);

      if (delErr) throw delErr;

      // 2. Delete their submission row so they show as "Pending" and can re-vote.
      const { error: subDelErr } = await supabase
        .from("mvp_vote_submissions")
        .delete()
        .eq("session_id", sessionDetails.id)
        .eq("voter_profile_id", selectedCancelToken.id);

      if (subDelErr) throw subDelErr;

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

          {/* Filters UI */}
          <div className="flex flex-wrap items-center gap-4 bg-muted/20 p-4 rounded-lg border border-border">
            {/* Association filter */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">Association:</Label>
              <Select
                disabled={!isSuperAdmin}
                value={filterAssociation}
                onValueChange={handleAssociationChange}
              >
                <SelectTrigger className="w-48 min-w-0 overflow-hidden h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {allAssociations.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Club filter */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">Club:</Label>
              <Select value={filterClub} onValueChange={handleClubChange}>
                <SelectTrigger className="w-48 min-w-0 overflow-hidden h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {allClubs
                    .filter((c) => filterAssociation === "ALL" || c.association_id === filterAssociation)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Division filter */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">Division:</Label>
              <Select value={filterDivision} onValueChange={handleDivisionChange}>
                <SelectTrigger className="w-48 min-w-0 overflow-hidden h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {filteredDivisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Team filter */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">Team:</Label>
              <Select value={filterTeam} onValueChange={(v) => { setFilterTeam(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-48 min-w-0 overflow-hidden h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {filteredTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">Status:</Label>
              <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Round filter */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">Round:</Label>
              <Input
                className="h-9 w-20"
                type="number"
                placeholder="All"
                value={filterRound}
                onChange={(e) => {
                  setFilterRound(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
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
                <div className="p-12 text-center text-muted-foreground text-sm">
                  No MVP voting sessions found.
                </div>
              ) : (
                <>
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

                  {/* Pagination controls */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t bg-muted/20">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Show</span>
                      <Select
                        value={pageSize.toString()}
                        onValueChange={(v) => {
                          setPageSize(Number(v));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-16 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                      <span>per page</span>
                      <span className="ml-2 font-medium">
                        {totalCount > 0
                          ? `Showing ${Math.min(totalCount, (currentPage - 1) * pageSize + 1)}-${Math.min(
                              totalCount,
                              currentPage * pageSize
                            )} of ${totalCount}`
                          : "Showing 0-0 of 0"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-2"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                        disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                        className="h-8 px-2"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
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
                        No eligible voters found for this session.
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

              {/* GRAMPIANS CHAMPION / SHOUTOUTS SECTION */}
              <Card className="shadow-sm border-border">
                <CardHeader className="bg-muted/20 border-b py-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500 fill-yellow-500/20" /> Grampians Champion
                  </CardTitle>
                  <CardDescription>Off-field shoutouts from voters this round</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {shoutouts.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      No shoutouts submitted for this round.
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {shoutouts.map((s, idx) => (
                        <li key={idx} className="p-4">
                          <p className="text-sm text-foreground">“{s.text}”</p>
                          <p className="text-xs text-muted-foreground mt-1">— {s.voterName}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
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

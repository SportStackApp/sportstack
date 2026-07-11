import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trophy,
  UserCheck,
  Vote,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase as originalSupabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useToast } from "@/hooks/use-toast";

interface LooseQuery extends PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> {
  select: (columns?: string, options?: unknown) => LooseQuery;
  order: (column: string, options?: unknown) => LooseQuery;
  limit: (count: number) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  update: (values: unknown) => LooseQuery;
}

interface LooseSupabase {
  from: (table: string) => LooseQuery;
}

const moduleSupabase = originalSupabase as unknown as LooseSupabase;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "An unexpected error occurred.";

interface SubmissionRow {
  id: string;
  fixture_id: string | null;
  association_id: string | null;
  division_id: string | null;
  round_number: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  is_approved: boolean;
  is_locked: boolean;
  is_deleted: boolean;
  proxy_umpire_name: string | null;
  proxy_reason?: string | null;
  submitted_by_admin_id?: string | null;
  proxy_submitter_id?: string | null;
  umpire_user_id?: string | null;
  submitted_at: string;
}

interface VoteLineRow {
  id: string;
  submission_id: string;
  votes: number;
  player_name: string;
  player_number: number | null;
  team_id: string | null;
}

interface NamedRow {
  id: string;
  name: string;
  association_id?: string | null;
}

interface LeaderboardRow {
  playerKey: string;
  playerName: string;
  teamName: string;
  total: number;
  threes: number;
  twos: number;
  ones: number;
}

interface EditHistoryRow {
  id: string;
  submission_id?: string | null;
  changed_by_id?: string | null;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  reason?: string | null;
  created_at?: string | null;
  changed_at?: string | null;
}

export default function UmpireVotingModule() {
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin, highestScopedRole, scopedAssociationIds } = useAdminScope();
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [voteLines, setVoteLines] = useState<VoteLineRow[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistoryRow[]>([]);
  const [associations, setAssociations] = useState<NamedRow[]>([]);
  const [divisions, setDivisions] = useState<NamedRow[]>([]);
  const [teams, setTeams] = useState<NamedRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [associationFilter, setAssociationFilter] = useState("ALL");
  const [divisionFilter, setDivisionFilter] = useState("ALL");
  const [roundFilter, setRoundFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "DELETED" | "ALL">("PENDING");
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRow | null>(null);

  const hasAccess = isSuperAdmin || highestScopedRole === "ASSOCIATION_ADMIN" || highestScopedRole === "CLUB_ADMIN";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [submissionRes, linesRes, assocRes, divRes, teamRes] = await Promise.all([
        moduleSupabase
          .from("player_vote_submissions")
          .select("id, fixture_id, association_id, division_id, round_number, home_team_id, away_team_id, is_approved, is_locked, is_deleted, proxy_umpire_name, proxy_reason, submitted_by_admin_id, proxy_submitter_id, umpire_user_id, submitted_at")
          .order("submitted_at", { ascending: false })
          .limit(250),
        moduleSupabase.from("player_vote_lines").select("id, submission_id, votes, player_name, player_number, team_id").limit(1000),
        moduleSupabase.from("associations").select("id, name").order("name"),
        moduleSupabase.from("divisions").select("id, name, association_id").order("name"),
        moduleSupabase.from("teams").select("id, name").order("name"),
      ]);

      if (submissionRes.error) throw submissionRes.error;
      if (linesRes.error) throw linesRes.error;
      if (assocRes.error) throw assocRes.error;
      if (divRes.error) throw divRes.error;
      if (teamRes.error) throw teamRes.error;

      setSubmissions((submissionRes.data || []) as SubmissionRow[]);
      setVoteLines((linesRes.data || []) as VoteLineRow[]);
      setAssociations((assocRes.data || []) as NamedRow[]);
      setDivisions((divRes.data || []) as NamedRow[]);
      setTeams((teamRes.data || []) as NamedRow[]);

      const editsRes = await moduleSupabase.from("player_vote_edits").select("*").limit(1000);
      setEditHistory(editsRes.error ? [] : ((editsRes.data || []) as EditHistoryRow[]));
    } catch (err: unknown) {
      toast({
        title: "Umpire voting data failed to load",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (hasAccess) loadData();
  }, [hasAccess, loadData]);

  useEffect(() => {
    if (!isSuperAdmin && scopedAssociationIds.length === 1) {
      setAssociationFilter(scopedAssociationIds[0]);
    }
  }, [isSuperAdmin, scopedAssociationIds]);

  const teamNameMap = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);
  const divisionNameMap = useMemo(() => new Map(divisions.map((division) => [division.id, division.name])), [divisions]);

  const visibleSubmissions = useMemo(() => {
    const normalisedSearch = searchTerm.trim().toLowerCase();
    return submissions.filter((submission) => {
      if (!isSuperAdmin && scopedAssociationIds.length > 0 && submission.association_id && !scopedAssociationIds.includes(submission.association_id)) {
        return false;
      }
      if (associationFilter !== "ALL" && submission.association_id !== associationFilter) return false;
      if (divisionFilter !== "ALL" && submission.division_id !== divisionFilter) return false;
      if (roundFilter !== "ALL" && String(submission.round_number || "") !== roundFilter) return false;
      if (!showDeleted && submission.is_deleted) return false;
      if (statusFilter === "PENDING" && (submission.is_approved || submission.is_deleted)) return false;
      if (statusFilter === "APPROVED" && (!submission.is_approved || submission.is_deleted)) return false;
      if (statusFilter === "DELETED" && !submission.is_deleted) return false;
      if (normalisedSearch) {
        const lines = voteLines.filter((line) => line.submission_id === submission.id);
        const haystack = [
          submission.proxy_umpire_name,
          submission.proxy_reason,
          submission.round_number ? `round ${submission.round_number}` : "",
          submission.division_id ? divisionNameMap.get(submission.division_id) : "",
          submission.home_team_id ? teamNameMap.get(submission.home_team_id) : "",
          submission.away_team_id ? teamNameMap.get(submission.away_team_id) : "",
          ...lines.flatMap((line) => [
            line.player_name,
            line.player_number ? String(line.player_number) : "",
            line.team_id ? teamNameMap.get(line.team_id) : "",
          ]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalisedSearch)) return false;
      }
      return true;
    });
  }, [
    submissions,
    associationFilter,
    divisionFilter,
    roundFilter,
    statusFilter,
    showDeleted,
    searchTerm,
    voteLines,
    divisionNameMap,
    teamNameMap,
    isSuperAdmin,
    scopedAssociationIds,
  ]);

  const approvedVisibleSubmissionIds = useMemo(
    () => new Set(visibleSubmissions.filter((submission) => submission.is_approved && !submission.is_deleted).map((submission) => submission.id)),
    [visibleSubmissions],
  );

  const roundOptions = useMemo(
    () =>
      Array.from(new Set(submissions.map((submission) => submission.round_number).filter((round): round is number => typeof round === "number")))
        .sort((a, b) => a - b),
    [submissions],
  );

  const getSubmissionLines = useCallback(
    (submissionId: string) => voteLines.filter((line) => line.submission_id === submissionId),
    [voteLines],
  );

  const getSubmissionEdits = useCallback(
    (submissionId: string) => editHistory.filter((row) => row.submission_id === submissionId),
    [editHistory],
  );

  const leaderboard = useMemo(() => {
    const rows = new Map<string, LeaderboardRow>();
    voteLines
      .filter((line) => approvedVisibleSubmissionIds.has(line.submission_id))
      .forEach((line) => {
        const playerKey = `${line.player_name.toLowerCase()}-${line.team_id || "none"}-${line.player_number || ""}`;
        const existing = rows.get(playerKey) || {
          playerKey,
          playerName: line.player_name || "Unknown player",
          teamName: line.team_id ? teamNameMap.get(line.team_id) || "Unknown team" : "No team recorded",
          total: 0,
          threes: 0,
          twos: 0,
          ones: 0,
        };
        existing.total += line.votes;
        if (line.votes === 3) existing.threes += 1;
        if (line.votes === 2) existing.twos += 1;
        if (line.votes === 1) existing.ones += 1;
        rows.set(playerKey, existing);
      });

    return Array.from(rows.values()).sort((a, b) => b.total - a.total || b.threes - a.threes || a.playerName.localeCompare(b.playerName));
  }, [voteLines, approvedVisibleSubmissionIds, teamNameMap]);

  const pendingCount = visibleSubmissions.filter((submission) => !submission.is_approved).length;
  const approvedCount = visibleSubmissions.filter((submission) => submission.is_approved).length;

  const exportCsv = () => {
    const rows = visibleSubmissions.map((submission) => {
      const lines = getSubmissionLines(submission.id)
        .map((line) => `${line.votes} ${line.player_name || "Unknown"}${line.player_number ? ` #${line.player_number}` : ""}`)
        .join("; ");
      return [
        submission.submitted_at,
        submission.round_number ? `Round ${submission.round_number}` : "",
        submission.division_id ? divisionNameMap.get(submission.division_id) || "" : "",
        `${submission.home_team_id ? teamNameMap.get(submission.home_team_id) || "" : ""} vs ${submission.away_team_id ? teamNameMap.get(submission.away_team_id) || "" : ""}`,
        submission.proxy_umpire_name || "Self",
        submission.proxy_reason || "",
        submission.is_deleted ? "Deleted" : submission.is_approved ? "Approved" : "Pending",
        lines,
      ];
    });
    const csv = [
      ["Submitted", "Round", "Division", "Match", "Submitted for", "Proxy reason", "Status", "Votes"],
      ...rows,
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `umpire-vote-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const updateApproval = async (submissionId: string, approved: boolean) => {
    const { error } = await moduleSupabase
      .from("player_vote_submissions")
      .update({ is_approved: approved, is_locked: approved })
      .eq("id", submissionId);

    if (error) {
      toast({ title: "Submission not updated", description: error.message, variant: "destructive" });
      return;
    }

    setSubmissions((current) =>
      current.map((submission) =>
        submission.id === submissionId ? { ...submission, is_approved: approved, is_locked: approved } : submission,
      ),
    );
    toast({ title: approved ? "Submission approved" : "Submission reopened" });
  };

  if (scopeLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!hasAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Umpire Voting</CardTitle>
          <CardDescription>You need an admin role to view umpire voting administration.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Vote className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Umpire Voting</h1>
            <Badge variant="outline">Ballarat branding removed</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin review, approvals and leaderboard for umpire best-player votes.
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Trophy} label="Submissions" value={visibleSubmissions.length} />
        <Metric icon={Clock} label="Pending" value={pendingCount} />
        <Metric icon={CheckCircle2} label="Approved" value={approvedCount} />
        <Metric icon={UserCheck} label="Leaderboard players" value={leaderboard.length} />
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Umpire, team, player or reason"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Association</label>
            <Select value={associationFilter} onValueChange={(value) => { setAssociationFilter(value); setDivisionFilter("ALL"); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All associations</SelectItem>
                {associations.map((association) => (
                  <SelectItem key={association.id} value={association.id}>{association.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Round</label>
            <Select value={roundFilter} onValueChange={setRoundFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All rounds</SelectItem>
                {roundOptions.map((round) => (
                  <SelectItem key={round} value={String(round)}>Round {round}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Division</label>
            <Select value={divisionFilter} onValueChange={setDivisionFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All divisions</SelectItem>
                {divisions
                  .filter((division) => associationFilter === "ALL" || division.association_id === associationFilter)
                  .map((division) => (
                    <SelectItem key={division.id} value={division.id}>{division.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="DELETED">Deleted</SelectItem>
                <SelectItem value="ALL">All submissions</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-between gap-3 md:col-span-2 xl:col-span-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={showDeleted} onCheckedChange={setShowDeleted} />
              Show deleted rows
            </label>
            <Button variant="outline" onClick={exportCsv} disabled={visibleSubmissions.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="submissions" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2">
          <TabsTrigger value="submissions">Review Queue</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vote Submissions</CardTitle>
              <CardDescription>{loading ? "Loading..." : `${visibleSubmissions.length} submissions shown.`}</CardDescription>
            </CardHeader>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Fixture</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Submitted by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Votes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleSubmissions.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No umpire submissions found for the selected filters.</TableCell></TableRow>
                  ) : (
                    visibleSubmissions.map((submission) => {
                      const lines = getSubmissionLines(submission.id);
                      return (
                        <TableRow key={submission.id}>
                          <TableCell className="whitespace-nowrap">{new Date(submission.submitted_at).toLocaleString("en-AU")}</TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {submission.home_team_id ? teamNameMap.get(submission.home_team_id) || "Home team" : "Custom"}
                              {" vs "}
                              {submission.away_team_id ? teamNameMap.get(submission.away_team_id) || "Away team" : "Custom"}
                            </div>
                            <div className="text-xs text-muted-foreground">Round {submission.round_number || "-"}</div>
                          </TableCell>
                          <TableCell>{submission.division_id ? divisionNameMap.get(submission.division_id) || "Unknown" : "-"}</TableCell>
                          <TableCell>
                            <div className="font-medium">{submission.proxy_umpire_name || "Self"}</div>
                            {submission.proxy_reason && (
                              <div className="max-w-[220px] truncate text-xs text-muted-foreground">{submission.proxy_reason}</div>
                            )}
                            {(submission.submitted_by_admin_id || submission.proxy_submitter_id) && (
                              <Badge variant="outline" className="mt-1">Admin/proxy</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {submission.is_deleted ? (
                              <Badge variant="destructive">Deleted</Badge>
                            ) : submission.is_approved ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600">Approved</Badge>
                            ) : (
                              <Badge variant="secondary">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {lines.map((line) => (
                                <div key={line.id} className="text-sm">
                                  <span className="font-semibold">{line.votes}</span> - {line.player_name}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => setSelectedSubmission(submission)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Review
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leaderboard</CardTitle>
              <CardDescription>Aggregated from approved submissions only in the selected scope.</CardDescription>
            </CardHeader>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">3s</TableHead>
                    <TableHead className="text-center">2s</TableHead>
                    <TableHead className="text-center">1s</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.slice(0, 100).map((row, index) => (
                    <TableRow key={row.playerKey}>
                      <TableCell className="font-semibold">{index + 1}</TableCell>
                      <TableCell>{row.playerName}</TableCell>
                      <TableCell>{row.teamName}</TableCell>
                      <TableCell className="text-center">{row.threes}</TableCell>
                      <TableCell className="text-center">{row.twos}</TableCell>
                      <TableCell className="text-center">{row.ones}</TableCell>
                      <TableCell className="text-center text-lg font-semibold">{row.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selectedSubmission)} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
        <DialogContent className="max-w-3xl">
          {selectedSubmission && (
            <>
              <DialogHeader>
                <DialogTitle>Review umpire submission</DialogTitle>
                <DialogDescription>
                  Check fixture details, proxy context and vote lines before approving or reopening.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-3 rounded-md border p-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Fixture</p>
                    <p className="font-medium">
                      {selectedSubmission.home_team_id ? teamNameMap.get(selectedSubmission.home_team_id) || "Home team" : "Custom"}
                      {" vs "}
                      {selectedSubmission.away_team_id ? teamNameMap.get(selectedSubmission.away_team_id) || "Away team" : "Custom"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Round / Division</p>
                    <p className="font-medium">
                      Round {selectedSubmission.round_number || "-"} - {selectedSubmission.division_id ? divisionNameMap.get(selectedSubmission.division_id) || "Unknown division" : "No division"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Submitted for</p>
                    <p className="font-medium">{selectedSubmission.proxy_umpire_name || "Self"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Submitted</p>
                    <p className="font-medium">{new Date(selectedSubmission.submitted_at).toLocaleString("en-AU")}</p>
                  </div>
                  {selectedSubmission.proxy_reason && (
                    <div className="md:col-span-2">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Proxy/admin reason</p>
                      <p className="text-sm">{selectedSubmission.proxy_reason}</p>
                    </div>
                  )}
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Points</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Team</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getSubmissionLines(selectedSubmission.id).map((line) => (
                        <TableRow key={line.id}>
                          <TableCell><Badge>{line.votes}</Badge></TableCell>
                          <TableCell>
                            {line.player_name || "Unknown player"}
                            {line.player_number && <span className="ml-2 text-muted-foreground">#{line.player_number}</span>}
                          </TableCell>
                          <TableCell>{line.team_id ? teamNameMap.get(line.team_id) || "Unknown team" : "No team recorded"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="rounded-md border p-4">
                  <p className="text-sm font-semibold">Edit history</p>
                  {getSubmissionEdits(selectedSubmission.id).length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No edit history was found for this submission.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {getSubmissionEdits(selectedSubmission.id).map((edit) => (
                        <div key={edit.id} className="rounded-md bg-muted/40 p-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{edit.field_name || "field"}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(edit.created_at || edit.changed_at || selectedSubmission.submitted_at).toLocaleString("en-AU")}
                            </span>
                          </div>
                          <p className="mt-2">
                            <span className="text-muted-foreground line-through">{edit.old_value || "blank"}</span>
                            <span className="mx-2">-&gt;</span>
                            <span className="font-medium">{edit.new_value || "blank"}</span>
                          </p>
                          {edit.reason && <p className="mt-1 text-xs text-muted-foreground">{edit.reason}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                  Close
                </Button>
                {!selectedSubmission.is_deleted && (
                  selectedSubmission.is_approved ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        updateApproval(selectedSubmission.id, false);
                        setSelectedSubmission(null);
                      }}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reopen
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        updateApproval(selectedSubmission.id, true);
                        setSelectedSubmission(null);
                      }}
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  )
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-2xl font-semibold">{value}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

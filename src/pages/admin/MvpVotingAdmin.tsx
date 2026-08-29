import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { supabase as originalSupabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Play,
  Power,
  RefreshCw,
  ShieldCheck,
  Square,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AdminCascadeFilters } from "@/components/admin/AdminCascadeFilters";
import { SortableTableHead } from "@/components/admin/SortableTableHead";
import { nextSortState, stableSortRows, type SortState } from "@/lib/adminSorting";
import { type CascadeValue } from "@/lib/adminCascade";
import {
  getMvpErrorMessage,
  getMvpSessionDisplayState,
  isMvpUpgradeUnavailable,
  type MvpSessionStatus,
} from "@/lib/mvpVoting";

const supabase = originalSupabase;

type SessionStatus = MvpSessionStatus;
type LifecycleKind = "open" | "close" | "reopen" | "resolve";

interface AssociationOption {
  id: string;
  name: string;
  timezone: string | null;
}

interface ClubOption {
  id: string;
  name: string;
  association_id: string;
}

interface DivisionOption {
  id: string;
  name: string;
  association_id: string;
}

interface TeamOption {
  id: string;
  name: string;
  club_id: string;
  division_id: string | null;
  mvp_enabled: boolean;
  mvp_notifications_enabled: boolean;
}

interface VenueOption {
  id: string;
  name: string;
}

interface FixtureSummary {
  id: string;
  fixture_date: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  division_id: string | null;
  venue_id: string | null;
  round_number: number | string | null;
}

interface MvpSession {
  id: string;
  fixture_id: string;
  team_id: string | null;
  grade: string | null;
  round: string | null;
  game_date: string | null;
  home_team: string | null;
  away_team: string | null;
  status: SessionStatus;
  opened_at: string | null;
  closes_at: string | null;
  result_check_round: number;
  voting_cycle: number;
  locked_at: string | null;
  locked_reason: string | null;
  votedCount?: number;
  totalVoters?: number | null;
  fixture?: FixtureSummary;
}
type SessionSortKey = "team" | "fixture" | "date" | "status" | "completed";

interface OpenCandidate extends FixtureSummary {
  homeTeamName: string;
  awayTeamName: string;
  venueName: string;
}

interface RankedResult {
  playerId: string;
  name: string;
  points: number;
}

interface VoterStatus {
  id: string;
  revsports_player_id: string | null;
  voted_at: string | null;
  player_name: string;
  result_response: "CORRECT" | "INCORRECT" | null;
}

interface ResultConcern {
  id: string;
  voter_profile_id: string;
  reporterName: string;
  comment: string | null;
  created_at: string;
}

interface Shoutout {
  voterName: string;
  text: string;
}

interface RawBallot {
  voterId: string;
  voterName: string;
  choices: Array<{ points: number; playerName: string }>;
}

interface SubmissionRow {
  id?: string;
  session_id?: string;
  voter_profile_id: string;
  shoutout: string | null;
  submitted_at: string | null;
}

interface ResultCheckRow {
  id: string;
  voter_profile_id: string;
  response: "CORRECT" | "INCORRECT";
  comment: string | null;
  created_at: string;
  result_check_round: number;
}

interface AttendedPlayerRow {
  id: string;
  fixture_id?: string;
  player_name: string | null;
  profile_id: string;
  team_side: "home" | "away";
}

interface ProfileNameRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface VoteRow {
  voter_profile_id: string | null;
  player_id: string;
  points: number;
}

interface VoteRecipientRow {
  id: string;
  player_name: string | null;
  profile_id: string | null;
}

interface AggregateResultRow {
  player_id?: string;
  playerId?: string;
  player_name?: string;
  name?: string;
  total_points?: number;
  points?: number;
}

interface AggregateResultPayload {
  results?: AggregateResultRow[];
  rows?: AggregateResultRow[];
  data?: AggregateResultRow[];
}

interface LifecycleDialogState {
  kind: LifecycleKind;
  session: MvpSession | null;
  fixture: OpenCandidate | null;
}

const MVP_UPGRADE_MESSAGE =
  "The MVP reliability database upgrade has not been applied yet. Session controls are disabled until the approved Supabase migrations are applied.";

const isUpgradeMissingError = (error: unknown) => {
  const value = error as { code?: string; message?: string } | null;
  const message = value?.message?.toLowerCase() || "";
  return (
    isMvpUpgradeUnavailable(error) ||
    ["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(value?.code || "") ||
    message.includes("mvp_enabled") ||
    message.includes("mvp_notifications_enabled") ||
    message.includes("mvp_result_checks") ||
    message.includes("does not exist") ||
    message.includes("could not find the function")
  );
};

const friendlyMvpError = (error: unknown) => {
  const value = error as { message?: string } | null;
  const message = value?.message || "The action could not be completed.";
  const namedMessages: Record<string, string> = {
    NOT_AUTHORISED: "You do not have permission to manage this team.",
    TEAM_MVP_DISABLED: "MVP voting is turned off for this team.",
    LEGACY_SESSION_READ_ONLY: "Legacy voting sessions are read-only and cannot be reopened.",
    SESSION_NOT_FOUND: "This voting session could not be found.",
    SESSION_NOT_OPEN: "This voting session is not open.",
    SESSION_EXPIRED: "The voting deadline has passed and this round is closed.",
    SESSION_DISPUTED: "This voting session is paused while the match result is reviewed.",
    RESULT_CONCERN_UNRESOLVED: "Review the unresolved match-result concern before closing this session.",
    FIXTURE_NOT_COMPLETED: "The fixture must be marked as completed before voting can open.",
    SCORES_MISSING: "Both fixture scores must be recorded before voting can open.",
    INVALID_CLOSE_TIME: "Choose a closing time in the future.",
  };

  const match = Object.keys(namedMessages).find((key) => message.includes(key));
  return match ? namedMessages[match] : getMvpErrorMessage(error, message);
};

const localDateTimeValue = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
};

const MAX_VOTING_WINDOW_MS = 72 * 60 * 60 * 1000;
const DEFAULT_ASSOCIATION_TIMEZONE = "Australia/Melbourne";
const defaultCloseValue = () => localDateTimeValue(new Date(Date.now() + MAX_VOTING_WINDOW_MS));
const maximumCloseValue = () => localDateTimeValue(new Date(Date.now() + MAX_VOTING_WINDOW_MS));

const extractSessionId = (data: unknown) => {
  const value = data as { session_id?: string; id?: string; data?: { session_id?: string; id?: string } } | null;
  return value?.session_id || value?.id || value?.data?.session_id || value?.data?.id || null;
};

export default function MvpVotingAdmin() {
  const { toast } = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledDetailLocationKey = useRef<string | null>(null);
  const {
    loading: scopeLoading,
    isAnyAdmin,
    isSuperAdmin,
    scopedRoles,
    scopedTeamIds,
  } = useAdminScope();

  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [allAssociations, setAllAssociations] = useState<AssociationOption[]>([]);
  const [allClubs, setAllClubs] = useState<ClubOption[]>([]);
  const [allDivisions, setAllDivisions] = useState<DivisionOption[]>([]);
  const [allTeams, setAllTeams] = useState<TeamOption[]>([]);
  const [allVenues, setAllVenues] = useState<VenueOption[]>([]);
  const [referenceDataLoaded, setReferenceDataLoaded] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const [filterAssociation, setFilterAssociation] = useState("ALL");
  const [filterClub, setFilterClub] = useState("ALL");
  const [filterDivision, setFilterDivision] = useState("ALL");
  const [filterTeam, setFilterTeam] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterRound, setFilterRound] = useState("");
  const [showLegacy, setShowLegacy] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [sessions, setSessions] = useState<MvpSession[]>([]);
  const [sessionSort, setSessionSort] = useState<SortState<SessionSortKey> | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [openCandidates, setOpenCandidates] = useState<OpenCandidate[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  const [sessionDetails, setSessionDetails] = useState<MvpSession | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [results, setResults] = useState<RankedResult[]>([]);
  const [voters, setVoters] = useState<VoterStatus[]>([]);
  const [resultConcerns, setResultConcerns] = useState<ResultConcern[]>([]);
  const [shoutouts, setShoutouts] = useState<Shoutout[]>([]);
  const [rawBallots, setRawBallots] = useState<RawBallot[]>([]);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rowActionLoading, setRowActionLoading] = useState<string | null>(null);
  const [lifecycleDialog, setLifecycleDialog] = useState<LifecycleDialogState | null>(null);
  const [lifecycleCloseAt, setLifecycleCloseAt] = useState(defaultCloseValue);
  const [teamToggleTarget, setTeamToggleTarget] = useState<boolean | null>(null);
  const [withdrawVoter, setWithdrawVoter] = useState<VoterStatus | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");

  const hasAccess = isAnyAdmin;
  const hasRawAuditRole =
    isSuperAdmin || scopedRoles.some((role) => role.role === "ASSOCIATION_ADMIN");
  const deepLinkedSessionId = searchParams.get("session");

  const visibleTeams = useMemo(
    () => (isSuperAdmin ? allTeams : allTeams.filter((team) => scopedTeamIds.includes(team.id))),
    [allTeams, isSuperAdmin, scopedTeamIds],
  );

  const visibleClubIds = useMemo(() => new Set(visibleTeams.map((team) => team.club_id)), [visibleTeams]);
  const visibleClubs = useMemo(
    () => (isSuperAdmin ? allClubs : allClubs.filter((club) => visibleClubIds.has(club.id))),
    [allClubs, isSuperAdmin, visibleClubIds],
  );
  const visibleAssociationIds = useMemo(
    () => new Set(visibleClubs.map((club) => club.association_id)),
    [visibleClubs],
  );
  const visibleAssociations = useMemo(
    () =>
      isSuperAdmin
        ? allAssociations
        : allAssociations.filter((association) => visibleAssociationIds.has(association.id)),
    [allAssociations, isSuperAdmin, visibleAssociationIds],
  );
  const visibleDivisionIds = useMemo(
    () => new Set(visibleTeams.map((team) => team.division_id).filter(Boolean)),
    [visibleTeams],
  );
  const visibleDivisions = useMemo(
    () => (isSuperAdmin ? allDivisions : allDivisions.filter((division) => visibleDivisionIds.has(division.id))),
    [allDivisions, isSuperAdmin, visibleDivisionIds],
  );
  const displayedSessions = useMemo(() => sessionSort ? stableSortRows(sessions, sessionSort, (session, key) => {
    const team = allTeams.find((item) => item.id === session.team_id);
    const fixture = session.fixture;
    const homeName = allTeams.find((item) => item.id === fixture?.home_team_id)?.name || session.home_team || "Home";
    const awayName = allTeams.find((item) => item.id === fixture?.away_team_id)?.name || session.away_team || "Away";
    if (key === "team") return team?.name || "Legacy fixture-wide";
    if (key === "fixture") return `${homeName} vs ${awayName}`;
    if (key === "date") return session.game_date || fixture?.fixture_date;
    if (key === "status") return session.status;
    return session.votedCount || 0;
  }) : sessions, [allTeams, sessionSort, sessions]);
  const selectedTeam = useMemo(
    () => visibleTeams.find((team) => team.id === filterTeam) || null,
    [filterTeam, visibleTeams],
  );

  const canAuditRawBallotsForSession = useCallback(
    (session: MvpSession | null) => {
      if (!session) return false;
      if (isSuperAdmin) return true;

      const teamIds = session.team_id
        ? [session.team_id]
        : [session.fixture?.home_team_id, session.fixture?.away_team_id].filter(
            (teamId): teamId is string => Boolean(teamId),
          );

      return teamIds.some((teamId) => {
        const team = allTeams.find((item) => item.id === teamId);
        const club = team ? allClubs.find((item) => item.id === team.club_id) : null;
        if (!club) return false;
        return scopedRoles.some(
          (role) => role.role === "ASSOCIATION_ADMIN" && role.association_id === club.association_id,
        );
      });
    },
    [allClubs, allTeams, isSuperAdmin, scopedRoles],
  );

  const visibleOpenCandidates = useMemo(() => {
    const query = candidateSearch.trim().toLowerCase();
    if (!query) return openCandidates;
    return openCandidates.filter((fixture) =>
      [
        fixture.homeTeamName,
        fixture.awayTeamName,
        fixture.venueName,
        fixture.round_number == null ? "" : `round ${fixture.round_number}`,
        fixture.fixture_date,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [candidateSearch, openCandidates]);

  const filterCascade: CascadeValue = {
    associationId: filterAssociation,
    clubId: filterClub,
    divisionId: filterDivision,
    teamId: filterTeam,
  };

  const filteredTeamIds = useMemo(() => {
    return visibleTeams
      .filter((team) => {
        const club = allClubs.find((item) => item.id === team.club_id);
        if (filterAssociation !== "ALL" && club?.association_id !== filterAssociation) return false;
        if (filterClub !== "ALL" && team.club_id !== filterClub) return false;
        if (filterDivision !== "ALL" && team.division_id !== filterDivision) return false;
        if (filterTeam !== "ALL" && team.id !== filterTeam) return false;
        return true;
      })
      .map((team) => team.id);
  }, [allClubs, filterAssociation, filterClub, filterDivision, filterTeam, visibleTeams]);

  const handleCascadeChange = useCallback((nextValue: CascadeValue) => {
    setFilterAssociation(nextValue.associationId);
    setFilterClub(nextValue.clubId);
    setFilterDivision(nextValue.divisionId);
    setFilterTeam(nextValue.teamId);
    setCandidateSearch("");
    setCurrentPage(1);
  }, []);

  const markUpgradeMissing = useCallback(() => {
    setSchemaReady(false);
    setUpgradeError(MVP_UPGRADE_MESSAGE);
  }, []);

  const loadReferenceData = useCallback(async () => {
    setReferenceDataLoaded(false);
    setSchemaReady(true);
    setUpgradeError(null);

    try {
      const [associationResult, clubResult, divisionResult, venueResult] = await Promise.all([
        supabase.from("associations").select("id, name, timezone").order("name"),
        supabase.from("clubs").select("id, name, association_id").order("name"),
        supabase.from("divisions").select("id, name, association_id").order("name"),
        supabase.from("venues").select("id, name").order("name"),
      ]);

      if (associationResult.error) throw associationResult.error;
      if (clubResult.error) throw clubResult.error;
      if (divisionResult.error) throw divisionResult.error;
      if (venueResult.error) throw venueResult.error;

      const teamResult = await supabase
        .from("teams")
        .select("id, name, club_id, division_id, mvp_enabled, mvp_notifications_enabled")
        .order("name");

      let teamData: TeamOption[];

      if (teamResult.error && isUpgradeMissingError(teamResult.error)) {
        markUpgradeMissing();
        const fallback = await supabase
          .from("teams")
          .select("id, name, club_id, division_id, mvp_enabled")
          .order("name");
        if (fallback.error) throw fallback.error;
        teamData = ((fallback.data || []) as Omit<TeamOption, "mvp_notifications_enabled">[]).map((team) => ({
          ...team,
          mvp_notifications_enabled: false,
        }));
      } else if (teamResult.error) {
        throw teamResult.error;
      } else {
        teamData = (teamResult.data || []) as TeamOption[];
      }

      setAllAssociations(associationResult.data || []);
      setAllClubs(clubResult.data || []);
      setAllDivisions(divisionResult.data || []);
      setAllVenues(venueResult.data || []);
      setAllTeams(teamData);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not load MVP administration",
        description: friendlyMvpError(error),
      });
    } finally {
      setReferenceDataLoaded(true);
    }
  }, [markUpgradeMissing, toast]);

  useEffect(() => {
    if (!scopeLoading && hasAccess) void loadReferenceData();
  }, [hasAccess, loadReferenceData, scopeLoading]);

  useEffect(() => {
    if (!isSuperAdmin && visibleAssociations.length === 1 && filterAssociation === "ALL") {
      setFilterAssociation(visibleAssociations[0].id);
    }
  }, [filterAssociation, isSuperAdmin, visibleAssociations]);

  const loadSessions = useCallback(async () => {
    if (!schemaReady || !referenceDataLoaded) {
      setSessions([]);
      setTotalCount(0);
      setListLoading(false);
      return;
    }

    setListLoading(true);
    try {
      if (!showLegacy && filteredTeamIds.length === 0) {
        setSessions([]);
        setTotalCount(0);
        return;
      }

      let legacyFixtureIds: string[] | null = null;
      if (showLegacy && (!isSuperAdmin || filteredTeamIds.length !== allTeams.length)) {
        if (filteredTeamIds.length === 0) {
          setSessions([]);
          setTotalCount(0);
          return;
        }
        const idList = filteredTeamIds.join(",");
        const { data: fixtureRows, error: fixtureScopeError } = await supabase
          .from("fixtures")
          .select("id")
          .or(`home_team_id.in.(${idList}),away_team_id.in.(${idList})`);
        if (fixtureScopeError) throw fixtureScopeError;
        legacyFixtureIds = ((fixtureRows || []) as Array<{ id: string }>).map((fixture) => fixture.id);
        if (legacyFixtureIds.length === 0) {
          setSessions([]);
          setTotalCount(0);
          return;
        }
      }

      let query = supabase.from("mvp_voting_sessions").select("*", { count: "exact" });
      if (showLegacy) {
        query = query.is("team_id", null);
        if (legacyFixtureIds) query = query.in("fixture_id", legacyFixtureIds);
      } else {
        query = query.not("team_id", "is", null);
        const unrestrictedSuperView =
          isSuperAdmin &&
          filterAssociation === "ALL" &&
          filterClub === "ALL" &&
          filterDivision === "ALL" &&
          filterTeam === "ALL";
        if (!unrestrictedSuperView) query = query.in("team_id", filteredTeamIds);
      }
      if (filterStatus !== "ALL") query = query.eq("status", filterStatus);
      if (filterRound.trim()) query = query.ilike("round", `%${filterRound.trim()}%`);

      const from = (currentPage - 1) * pageSize;
      const { data, error, count } = await query
        .order("game_date", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      const sessionRows = (data || []) as MvpSession[];
      const sessionIds = sessionRows.map((session) => session.id);
      const fixtureIds = Array.from(new Set(sessionRows.map((session) => session.fixture_id).filter(Boolean)));

      const [fixtureResult, submissionResult, playerResult, fillInResult] = await Promise.all([
        fixtureIds.length
          ? supabase
              .from("fixtures")
              .select(
                "id, fixture_date, status, home_team_id, away_team_id, home_score, away_score, division_id, venue_id, round_number",
              )
              .in("id", fixtureIds)
          : Promise.resolve({ data: [], error: null }),
        sessionIds.length
          ? supabase.from("mvp_vote_submissions").select("session_id").in("session_id", sessionIds)
          : Promise.resolve({ data: [], error: null }),
        fixtureIds.length
          ? supabase
              .from("revsports_players")
              .select("fixture_id, profile_id, team_side")
              .in("fixture_id", fixtureIds)
              .eq("attended", true)
              .not("profile_id", "is", null)
          : Promise.resolve({ data: [], error: null }),
        fixtureIds.length
          ? supabase
              .from("fixture_fill_ins")
              .select("fixture_id, team_id, player_id")
              .in("fixture_id", fixtureIds)
              .eq("status", "SELECTED")
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (fixtureResult.error) throw fixtureResult.error;
      if (submissionResult.error) throw submissionResult.error;
      if (playerResult.error) throw playerResult.error;
      if (fillInResult.error) throw fillInResult.error;

      const fixturesById = new Map<string, FixtureSummary>(
        (fixtureResult.data || []).map((fixture: FixtureSummary) => [fixture.id, fixture]),
      );
      const submissionCounts = new Map<string, number>();
      ((submissionResult.data || []) as Array<{ session_id: string }>).forEach((submission) => {
        submissionCounts.set(submission.session_id, (submissionCounts.get(submission.session_id) || 0) + 1);
      });

      const playerProfiles = new Map<string, Map<"home" | "away", Set<string>>>();
      ((playerResult.data || []) as AttendedPlayerRow[]).forEach((player) => {
        if (player.team_side !== "home" && player.team_side !== "away") return;
        if (!playerProfiles.has(player.fixture_id)) {
          playerProfiles.set(
            player.fixture_id,
            new Map([
              ["home", new Set<string>()],
              ["away", new Set<string>()],
            ]),
          );
        }
        playerProfiles.get(player.fixture_id)?.get(player.team_side)?.add(player.profile_id);
      });
      ((fillInResult.data || []) as Array<{ fixture_id: string; team_id: string; player_id: string }>).forEach((fillIn) => {
        const fixture = fixturesById.get(fillIn.fixture_id);
        const side = fixture?.home_team_id === fillIn.team_id
          ? "home"
          : fixture?.away_team_id === fillIn.team_id
            ? "away"
            : null;
        if (!side) return;
        if (!playerProfiles.has(fillIn.fixture_id)) {
          playerProfiles.set(
            fillIn.fixture_id,
            new Map([
              ["home", new Set<string>()],
              ["away", new Set<string>()],
            ]),
          );
        }
        playerProfiles.get(fillIn.fixture_id)?.get(side)?.add(fillIn.player_id);
      });

      setSessions(
        sessionRows.map((session) => {
          const fixture = fixturesById.get(session.fixture_id);
          const side =
            session.team_id && fixture
              ? fixture.home_team_id === session.team_id
                ? "home"
                : fixture.away_team_id === session.team_id
                  ? "away"
                  : null
              : null;
          return {
            ...session,
            fixture,
            votedCount: submissionCounts.get(session.id) || 0,
            totalVoters: side ? playerProfiles.get(session.fixture_id)?.get(side)?.size || 0 : null,
          };
        }),
      );
      setTotalCount(count || 0);
    } catch (error) {
      if (isUpgradeMissingError(error)) markUpgradeMissing();
      toast({
        variant: "destructive",
        title: "Could not load voting sessions",
        description: isUpgradeMissingError(error) ? MVP_UPGRADE_MESSAGE : friendlyMvpError(error),
      });
      setSessions([]);
      setTotalCount(0);
    } finally {
      setListLoading(false);
    }
  }, [
    allTeams.length,
    currentPage,
    filterAssociation,
    filterClub,
    filterDivision,
    filterRound,
    filterStatus,
    filterTeam,
    filteredTeamIds,
    isSuperAdmin,
    markUpgradeMissing,
    pageSize,
    referenceDataLoaded,
    schemaReady,
    showLegacy,
    toast,
  ]);

  const loadOpenCandidates = useCallback(async () => {
    if (!schemaReady || !selectedTeam) {
      setOpenCandidates([]);
      return;
    }

    setCandidatesLoading(true);
    try {
      const fixtureRows: FixtureSummary[] = [];
      const fixturePageSize = 500;
      for (let from = 0; ; from += fixturePageSize) {
        const { data, error } = await supabase
          .from("fixtures")
          .select(
            "id, fixture_date, status, home_team_id, away_team_id, home_score, away_score, division_id, venue_id, round_number",
          )
          .eq("status", "COMPLETED")
          .or(`home_team_id.eq.${selectedTeam.id},away_team_id.eq.${selectedTeam.id}`)
          .not("home_score", "is", null)
          .not("away_score", "is", null)
          .order("fixture_date", { ascending: false })
          .order("id", { ascending: true })
          .range(from, from + fixturePageSize - 1);
        if (error) throw error;

        const page = (data || []) as FixtureSummary[];
        fixtureRows.push(...page);
        if (page.length < fixturePageSize) break;
      }

      const fixtureIds = fixtureRows.map((fixture) => fixture.id);
      const existingRows: Array<{ fixture_id: string }> = [];
      const fixtureIdChunkSize = 200;
      for (let start = 0; start < fixtureIds.length; start += fixtureIdChunkSize) {
        const fixtureIdChunk = fixtureIds.slice(start, start + fixtureIdChunkSize);
        const { data, error } = await supabase
          .from("mvp_voting_sessions")
          .select("fixture_id")
          .eq("team_id", selectedTeam.id)
          .in("fixture_id", fixtureIdChunk);
        if (error) throw error;
        existingRows.push(...((data || []) as Array<{ fixture_id: string }>));
      }

      const existingFixtureIds = new Set(
        existingRows.map((row) => row.fixture_id),
      );
      setOpenCandidates(
        fixtureRows
          .filter((fixture: FixtureSummary) => !existingFixtureIds.has(fixture.id))
          .map((fixture: FixtureSummary) => ({
            ...fixture,
            homeTeamName: allTeams.find((team) => team.id === fixture.home_team_id)?.name || "Home team",
            awayTeamName: allTeams.find((team) => team.id === fixture.away_team_id)?.name || "Away team",
            venueName: allVenues.find((venue) => venue.id === fixture.venue_id)?.name || "Venue not recorded",
          })),
      );
    } catch (error) {
      if (isUpgradeMissingError(error)) markUpgradeMissing();
      toast({
        variant: "destructive",
        title: "Could not load completed fixtures",
        description: isUpgradeMissingError(error) ? MVP_UPGRADE_MESSAGE : friendlyMvpError(error),
      });
      setOpenCandidates([]);
    } finally {
      setCandidatesLoading(false);
    }
  }, [allTeams, allVenues, markUpgradeMissing, schemaReady, selectedTeam, toast]);

  const loadSessionDetails = useCallback(
    async (sessionId: string) => {
      setDetailLoading(true);
      setDetailError(null);
      setResultsError(null);
      setResults([]);
      setVoters([]);
      setResultConcerns([]);
      setShoutouts([]);
      setRawBallots([]);

      try {
        const { data: sessionRow, error: sessionError } = await supabase
          .from("mvp_voting_sessions")
          .select("*")
          .eq("id", sessionId)
          .maybeSingle();
        if (sessionError) throw sessionError;
        if (!sessionRow) throw new Error("This voting session could not be found or is outside your scope.");

        const { data: fixtureRow, error: fixtureError } = await supabase
          .from("fixtures")
          .select(
            "id, fixture_date, status, home_team_id, away_team_id, home_score, away_score, division_id, venue_id, round_number",
          )
          .eq("id", sessionRow.fixture_id)
          .maybeSingle();
        if (fixtureError) throw fixtureError;
        if (!fixtureRow) throw new Error("The fixture linked to this session could not be found.");

        const detailSession = { ...sessionRow, fixture: fixtureRow } as MvpSession;
        setSessionDetails(detailSession);

        const [submissionResult, checkResult] = await Promise.all([
          supabase
            .from("mvp_vote_submissions")
            .select("id, voter_profile_id, shoutout, submitted_at")
            .eq("session_id", sessionId),
          supabase
            .from("mvp_result_checks")
            .select("id, voter_profile_id, response, comment, created_at, result_check_round")
            .eq("session_id", sessionId)
            .eq("result_check_round", sessionRow.result_check_round)
            .order("created_at", { ascending: true }),
        ]);
        if (submissionResult.error) throw submissionResult.error;
        if (checkResult.error) throw checkResult.error;

        const submissions = (submissionResult.data || []) as SubmissionRow[];
        const checks = (checkResult.data || []) as ResultCheckRow[];
        const votedProfileIds = new Set(submissions.map((submission) => submission.voter_profile_id));
        const checkByProfile = new Map<string, "CORRECT" | "INCORRECT">(
          checks.map((check) => [check.voter_profile_id, check.response]),
        );

        let attendedRows: AttendedPlayerRow[] = [];
        if (detailSession.team_id) {
          const expectedSide =
            fixtureRow.home_team_id === detailSession.team_id
              ? "home"
              : fixtureRow.away_team_id === detailSession.team_id
                ? "away"
                : null;
          if (!expectedSide) throw new Error("The voting team does not belong to this fixture.");

          const [attendedResult, fillInResult] = await Promise.all([
            supabase
              .from("revsports_players")
              .select("id, player_name, profile_id, team_side")
              .eq("fixture_id", detailSession.fixture_id)
              .eq("team_side", expectedSide)
              .eq("attended", true)
              .not("profile_id", "is", null),
            supabase
              .from("fixture_fill_ins")
              .select("id, player_id")
              .eq("fixture_id", detailSession.fixture_id)
              .eq("team_id", detailSession.team_id)
              .eq("status", "SELECTED"),
          ]);
          if (attendedResult.error) throw attendedResult.error;
          if (fillInResult.error) throw fillInResult.error;
          attendedRows = [
            ...((attendedResult.data || []) as AttendedPlayerRow[]),
            ...((fillInResult.data || []) as Array<{ id: string; player_id: string }>).map((fillIn) => ({
              id: `fill-in-${fillIn.id}`,
              fixture_id: detailSession.fixture_id,
              player_name: null,
              profile_id: fillIn.player_id,
              team_side: expectedSide,
            })),
          ];
        }

        const profileIds = Array.from(
          new Set([
            ...attendedRows.map((row) => row.profile_id),
            ...submissions.map((submission) => submission.voter_profile_id),
            ...checks.map((check) => check.voter_profile_id),
          ]),
        ).filter(Boolean);
        const profileNames = new Map<string, string>();
        if (profileIds.length) {
          const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", profileIds);
          if (profileError) throw profileError;
          ((profiles || []) as ProfileNameRow[]).forEach((profile) => {
            profileNames.set(
              profile.id,
              [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "Unnamed player",
            );
          });
        }

        const seenProfiles = new Set<string>();
        const eligibleVoters: VoterStatus[] = detailSession.team_id
          ? attendedRows
              .filter((row) => {
                if (seenProfiles.has(row.profile_id)) return false;
                seenProfiles.add(row.profile_id);
                return true;
              })
              .map((row) => ({
                id: row.profile_id,
                revsports_player_id: row.id,
                voted_at: votedProfileIds.has(row.profile_id) ? "voted" : null,
                player_name: profileNames.get(row.profile_id) || row.player_name || "Unnamed player",
                result_response: checkByProfile.get(row.profile_id) || null,
              }))
          : submissions.map((submission) => ({
              id: submission.voter_profile_id,
              revsports_player_id: null,
              voted_at: submission.submitted_at || "voted",
              player_name: profileNames.get(submission.voter_profile_id) || "Legacy voter",
              result_response: checkByProfile.get(submission.voter_profile_id) || null,
            }));
        setVoters(eligibleVoters.sort((a, b) => a.player_name.localeCompare(b.player_name)));

        const incorrectChecks = checks.filter((check) => check.response === "INCORRECT");
        setResultConcerns(
          incorrectChecks.map((check) => ({
            id: check.id,
            voter_profile_id: check.voter_profile_id,
            reporterName: profileNames.get(check.voter_profile_id) || "Unnamed player",
            comment: check.comment,
            created_at: check.created_at,
          })),
        );

        const canPublishAggregates = detailSession.status === "CLOSED" && incorrectChecks.length === 0;
        if (canPublishAggregates) {
          const { data: resultData, error: resultError } = await supabase.rpc("get_mvp_session_results", {
            p_session_id: sessionId,
          });
          if (resultError) {
            setResultsError(
              isUpgradeMissingError(resultError) ? MVP_UPGRADE_MESSAGE : friendlyMvpError(resultError),
            );
          } else {
            const resultValue = resultData as unknown as AggregateResultRow[] | AggregateResultPayload;
            const rows = Array.isArray(resultValue)
              ? resultValue
              : resultValue?.results || resultValue?.rows || resultValue?.data || [];
            setResults(
              (rows || [])
                .map((row) => ({
                  playerId: row.player_id || row.playerId,
                  name: row.player_name || row.name || "Unnamed player",
                  points: Number(row.total_points ?? row.points ?? 0),
                }))
                .sort((a: RankedResult, b: RankedResult) => b.points - a.points),
            );
          }

          setShoutouts(
            submissions
              .filter((submission) => submission.shoutout?.trim())
              .map((submission) => ({
                voterName: profileNames.get(submission.voter_profile_id) || "A teammate",
                text: submission.shoutout.trim(),
              })),
          );
        }

        if (canAuditRawBallotsForSession(detailSession)) {
          const { data: voteRows, error: voteError } = await supabase
            .from("mvp_votes")
            .select("voter_profile_id, player_id, points")
            .eq("session_id", sessionId)
            .order("points", { ascending: false });
          if (voteError) throw voteError;

          const typedVoteRows = (voteRows || []) as VoteRow[];
          const recipientIds = Array.from(new Set(typedVoteRows.map((vote) => vote.player_id).filter(Boolean)));
          const recipientNames = new Map<string, string>();
          if (recipientIds.length) {
            const { data: recipients, error: recipientError } = await supabase
              .from("revsports_players")
              .select("id, player_name, profile_id")
              .in("id", recipientIds);
            if (recipientError) throw recipientError;

            const recipientProfileIds = Array.from(
              new Set(
                ((recipients || []) as VoteRecipientRow[])
                  .map((recipient) => recipient.profile_id)
                  .filter((profileId): profileId is string => Boolean(profileId)),
              ),
            );
            const recipientProfileNames = new Map<string, string>();
            if (recipientProfileIds.length) {
              const { data: recipientProfiles, error: recipientProfileError } = await supabase
                .from("profiles")
                .select("id, first_name, last_name")
                .in("id", recipientProfileIds);
              if (recipientProfileError) throw recipientProfileError;
              ((recipientProfiles || []) as ProfileNameRow[]).forEach((profile) => {
                recipientProfileNames.set(
                  profile.id,
                  [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim(),
                );
              });
            }
            ((recipients || []) as VoteRecipientRow[]).forEach((recipient) => {
              recipientNames.set(
                recipient.id,
                recipientProfileNames.get(recipient.profile_id) || recipient.player_name || "Unnamed player",
              );
            });
          }

          const grouped = new Map<string, RawBallot>();
          typedVoteRows.forEach((vote) => {
            const voterId = vote.voter_profile_id || "legacy-token-voter";
            if (!grouped.has(voterId)) {
              grouped.set(voterId, {
                voterId,
                voterName: profileNames.get(voterId) || "Legacy token voter",
                choices: [],
              });
            }
            grouped.get(voterId)?.choices.push({
              points: Number(vote.points),
              playerName: recipientNames.get(vote.player_id) || "Unnamed player",
            });
          });
          setRawBallots(Array.from(grouped.values()).sort((a, b) => a.voterName.localeCompare(b.voterName)));
        }
      } catch (error) {
        if (isUpgradeMissingError(error)) markUpgradeMissing();
        setDetailError(isUpgradeMissingError(error) ? MVP_UPGRADE_MESSAGE : friendlyMvpError(error));
      } finally {
        setDetailLoading(false);
      }
    },
    [canAuditRawBallotsForSession, markUpgradeMissing],
  );

  useEffect(() => {
    if (hasAccess && referenceDataLoaded && view === "list") void loadSessions();
  }, [hasAccess, loadSessions, referenceDataLoaded, schemaReady, view]);

  useEffect(() => {
    if (hasAccess && referenceDataLoaded && view === "list") void loadOpenCandidates();
  }, [hasAccess, loadOpenCandidates, referenceDataLoaded, schemaReady, view]);

  useEffect(() => {
    if (
      hasAccess &&
      referenceDataLoaded &&
      schemaReady &&
      deepLinkedSessionId &&
      (view !== "detail" ||
        selectedSessionId !== deepLinkedSessionId ||
        handledDetailLocationKey.current !== location.key)
    ) {
      handledDetailLocationKey.current = location.key;
      setView("detail");
      setSelectedSessionId(deepLinkedSessionId);
      void loadSessionDetails(deepLinkedSessionId);
    }
  }, [
    deepLinkedSessionId,
    hasAccess,
    loadSessionDetails,
    location.key,
    referenceDataLoaded,
    schemaReady,
    selectedSessionId,
    view,
  ]);

  const openSessionDetail = (sessionId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("session", sessionId);
    setSearchParams(next);
    setSelectedSessionId(sessionId);
    setView("detail");
  };

  const returnToList = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("session");
    setSearchParams(next);
    setView("list");
    handledDetailLocationKey.current = null;
    setSelectedSessionId(null);
    setSessionDetails(null);
    setDetailError(null);
    setResults([]);
    setVoters([]);
    setResultConcerns([]);
    setRawBallots([]);
  };

  const openLifecycleDialog = (
    kind: LifecycleKind,
    session: MvpSession | null,
    fixture: OpenCandidate | null = null,
  ) => {
    setLifecycleCloseAt(defaultCloseValue());
    setLifecycleDialog({ kind, session, fixture });
  };

  const sendOpeningEmail = async (sessionId: string) => {
    const { data, error } = await supabase.functions.invoke("mvp-voting-email-reminders", {
      body: { action: "opened", session_id: sessionId },
    });
    if (error || data?.error) {
      toast({
        variant: "destructive",
        title: "Voting opened, but the email failed",
        description: friendlyMvpError(error || new Error(data.error)),
      });
      return;
    }

    const sent = Number(data?.sent || 0);
    const skipped = Number(data?.skipped || 0);
    const failed = Number(data?.failed || 0);
    if (failed > 0) {
      toast({
        variant: "destructive",
        title: "Voting opened, but some emails failed",
        description: `Sent ${sent}. Skipped ${skipped}. Failed ${failed}.`,
      });
    } else if (sent === 0 || skipped > 0) {
      toast({
        title: sent === 0 ? "Voting opened; no opening email was sent" : "Voting opened; some emails were skipped",
        description: `Sent ${sent}. Skipped ${skipped}. Failed ${failed}.`,
      });
    }
  };

  const handleLifecycleConfirm = async () => {
    if (!lifecycleDialog) return;
    const { kind, session, fixture } = lifecycleDialog;
    let closesAt: string | null = null;
    if (kind === "reopen" || kind === "resolve") {
      const closeDate = new Date(lifecycleCloseAt);
      if (!lifecycleCloseAt || Number.isNaN(closeDate.getTime()) || closeDate.getTime() <= Date.now()) {
        toast({
          variant: "destructive",
          title: "Choose a future closing time",
          description: "The closing time must be later than the current time.",
        });
        return;
      }
      if (closeDate.getTime() > Date.now() + MAX_VOTING_WINDOW_MS) {
        toast({
          variant: "destructive",
          title: "Choose an earlier closing time",
          description: "MVP voting can stay open for no more than 72 hours.",
        });
        return;
      }
      closesAt = closeDate.toISOString();
    }

    const loadingKey = `${kind}-${session?.id || fixture?.id || "session"}`;
    setActionLoading(loadingKey);
    try {
      let result: { data: unknown; error: unknown };
      if (kind === "open") {
        const fixtureId = fixture?.id || session?.fixture_id;
        const teamId = session?.team_id || selectedTeam?.id;
        if (!fixtureId || !teamId) throw new Error("Select a team-owned fixture before opening voting.");
        result = await supabase.rpc("open_mvp_voting_session", {
          p_fixture_id: fixtureId,
          p_team_id: teamId,
          p_closes_at: closesAt,
        });
      } else if (kind === "close") {
        if (!session) throw new Error("Select a voting session first.");
        result = await supabase.rpc("close_mvp_voting_session", { p_session_id: session.id });
      } else if (kind === "reopen") {
        if (!session) throw new Error("Select a voting session first.");
        result = await supabase.rpc("reopen_mvp_voting_session", {
          p_session_id: session.id,
          p_closes_at: closesAt,
        });
      } else {
        if (!session) throw new Error("Select a voting session first.");
        result = await supabase.rpc("resolve_mvp_result_dispute", {
          p_session_id: session.id,
          p_closes_at: closesAt,
        });
      }

      if (result.error) throw result.error;
      let sessionId = session?.id || extractSessionId(result.data);
      if (!sessionId && kind === "open") {
        const fixtureId = fixture?.id || session?.fixture_id;
        const teamId = session?.team_id || selectedTeam?.id;
        const { data: openedSession, error: lookupError } = await supabase
          .from("mvp_voting_sessions")
          .select("id")
          .eq("fixture_id", fixtureId)
          .eq("team_id", teamId)
          .maybeSingle();
        if (lookupError) throw lookupError;
        sessionId = openedSession?.id || null;
      }

      const successTitles: Record<LifecycleKind, string> = {
        open: "Voting opened",
        close: "Voting closed",
        reopen: "Voting reopened",
        resolve: "Concern resolved and voting reopened",
      };
      toast({
        title: successTitles[kind],
        description:
          kind === "close"
            ? "The aggregate result can now be published if no concern is unresolved."
            : kind === "open"
              ? "The voting round closes when this team’s next scheduled match starts."
              : "The voting round is open until the selected closing time.",
      });

      setLifecycleDialog(null);
      await Promise.all([loadSessions(), loadOpenCandidates()]);
      const notificationTeamId = session?.team_id || selectedTeam?.id;
      const notificationsEnabled = allTeams.find((team) => team.id === notificationTeamId)
        ?.mvp_notifications_enabled;
      if (sessionId && kind !== "close" && notificationsEnabled) await sendOpeningEmail(sessionId);
      if (sessionId && (view === "detail" || kind === "open")) openSessionDetail(sessionId);
      else if (session?.id && view === "detail") await loadSessionDetails(session.id);
    } catch (error) {
      if (isUpgradeMissingError(error)) markUpgradeMissing();
      toast({
        variant: "destructive",
        title: `Could not ${kind} voting`,
        description: isUpgradeMissingError(error) ? MVP_UPGRADE_MESSAGE : friendlyMvpError(error),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTeamToggleConfirm = async () => {
    if (!selectedTeam || teamToggleTarget === null) return;
    setActionLoading(`toggle-${selectedTeam.id}`);
    try {
      const { error } = await supabase.rpc("set_team_mvp_enabled", {
        p_team_id: selectedTeam.id,
        p_enabled: teamToggleTarget,
      });
      if (error) throw error;

      setAllTeams((teams) =>
        teams.map((team) => (team.id === selectedTeam.id ? { ...team, mvp_enabled: teamToggleTarget } : team)),
      );
      toast({
        title: teamToggleTarget ? "Team MVP voting enabled" : "Team MVP voting turned off",
        description: teamToggleTarget
          ? "Authorised people can now open voting for completed fixtures."
          : "Pending and open rounds were closed. Disputed rounds remain available for review.",
      });
      setTeamToggleTarget(null);
      await loadSessions();
      if (sessionDetails) await loadSessionDetails(sessionDetails.id);
    } catch (error) {
      if (isUpgradeMissingError(error)) markUpgradeMissing();
      toast({
        variant: "destructive",
        title: "Could not change the team setting",
        description: isUpgradeMissingError(error) ? MVP_UPGRADE_MESSAGE : friendlyMvpError(error),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!selectedTeam) return;
    setActionLoading(`notifications-${selectedTeam.id}`);
    try {
      const { error } = await supabase.rpc("set_team_mvp_notifications_enabled", {
        p_team_id: selectedTeam.id,
        p_enabled: enabled,
      });
      if (error) throw error;

      setAllTeams((teams) =>
        teams.map((team) =>
          team.id === selectedTeam.id ? { ...team, mvp_notifications_enabled: enabled } : team,
        ),
      );
      toast({
        title: enabled ? "Player MVP emails turned on" : "Player MVP emails turned off",
        description: enabled
          ? "Opening and reminder emails can now be sent for this team."
          : "Player MVP Voting still works, but opening and reminder emails will not be sent.",
      });
    } catch (error) {
      if (isUpgradeMissingError(error)) markUpgradeMissing();
      toast({
        variant: "destructive",
        title: "Could not change the email setting",
        description: isUpgradeMissingError(error) ? MVP_UPGRADE_MESSAGE : friendlyMvpError(error),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendToNonVoters = async () => {
    if (!sessionDetails) return;
    const team = allTeams.find((candidate) => candidate.id === sessionDetails.team_id);
    if (!team?.mvp_notifications_enabled) {
      toast({ title: "Player MVP emails are off", description: "Turn on email notifications for this team first." });
      return;
    }
    setActionLoading(`remind-${sessionDetails.id}`);
    try {
      const { data, error } = await supabase.functions.invoke("mvp-voting-email-reminders", {
        body: { action: "manual_resend", session_id: sessionDetails.id },
      });
      if (error || data?.error) throw error || new Error(data.error);
      const sent = Number(data?.sent || 0);
      const skipped = Number(data?.skipped || 0);
      const failed = Number(data?.failed || 0);
      toast({
        variant: failed > 0 || sent === 0 ? "destructive" : "default",
        title: failed > 0 ? "Some reminders failed" : sent > 0 ? "Reminder sent" : "No reminder was sent",
        description: `Sent ${sent}. Skipped ${skipped}. Failed ${failed}.`,
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Reminder failed", description: friendlyMvpError(error) });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendToVoter = async (voter: VoterStatus) => {
    if (!sessionDetails) return;
    const team = allTeams.find((candidate) => candidate.id === sessionDetails.team_id);
    if (!team?.mvp_notifications_enabled) {
      toast({ title: "Player MVP emails are off", description: "Turn on email notifications for this team first." });
      return;
    }
    setRowActionLoading(`resend-${voter.id}`);
    try {
      const { data, error } = await supabase.functions.invoke("mvp-voting-email-reminders", {
        body: { action: "manual_resend", session_id: sessionDetails.id, profile_id: voter.id },
      });
      if (error || data?.error) throw error || new Error(data.error);
      const sent = Number(data?.sent || 0);
      const skipped = Number(data?.skipped || 0);
      const failed = Number(data?.failed || 0);
      toast({
        variant: failed > 0 || sent === 0 ? "destructive" : "default",
        title: failed > 0 ? "Reminder failed" : sent > 0 ? "Reminder sent" : "No reminder was sent",
        description: `Sent ${sent}. Skipped ${skipped}. Failed ${failed}.`,
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Reminder failed", description: friendlyMvpError(error) });
    } finally {
      setRowActionLoading(null);
    }
  };

  const handleWithdrawConfirm = async () => {
    if (!withdrawVoter || !sessionDetails || !canAuditRawBallotsForSession(sessionDetails)) return;
    if (!withdrawReason.trim()) {
      toast({
        variant: "destructive",
        title: "Add a reason",
        description: "A withdrawal reason is required for the audit record.",
      });
      return;
    }

    setActionLoading(`withdraw-${withdrawVoter.id}`);
    try {
      const { error } = await supabase.rpc("withdraw_mvp_submission", {
        p_session_id: sessionDetails.id,
        p_voter_profile_id: withdrawVoter.id,
        p_reason: withdrawReason.trim(),
      });
      if (error) throw error;
      toast({
        title: "Vote withdrawn",
        description: `${withdrawVoter.player_name} can submit a replacement ballot while the round is open.`,
      });
      setWithdrawVoter(null);
      setWithdrawReason("");
      await loadSessionDetails(sessionDetails.id);
    } catch (error) {
      if (isUpgradeMissingError(error)) markUpgradeMissing();
      toast({
        variant: "destructive",
        title: "Could not withdraw the vote",
        description: isUpgradeMissingError(error) ? MVP_UPGRADE_MESSAGE : friendlyMvpError(error),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getTeamTimezone = (teamId: string | null | undefined) => {
    const team = allTeams.find((item) => item.id === teamId);
    const club = team ? allClubs.find((item) => item.id === team.club_id) : null;
    return allAssociations.find((item) => item.id === club?.association_id)?.timezone || DEFAULT_ASSOCIATION_TIMEZONE;
  };
  const getSessionTimezone = (session: MvpSession) =>
    getTeamTimezone(session.team_id || session.fixture?.home_team_id);

  const formatDate = (value: string | null | undefined, timeZone = DEFAULT_ASSOCIATION_TIMEZONE) => {
    if (!value) return "Not recorded";
    return new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone,
    }).format(new Date(value));
  };

  const formatDateTime = (value: string | null | undefined, timeZone = DEFAULT_ASSOCIATION_TIMEZONE) => {
    if (!value) return "Not set";
    return new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(new Date(value));
  };

  const getTeamName = (teamId: string | null | undefined) =>
    allTeams.find((team) => team.id === teamId)?.name || "Legacy fixture-wide session";
  const getVenueName = (venueId: string | null | undefined) =>
    allVenues.find((venue) => venue.id === venueId)?.name || "Venue not recorded";
  const isPastDeadline = (session: MvpSession) =>
    session.status === "OPEN" && getMvpSessionDisplayState(session.status, session.closes_at) === "closed";
  const isReminderAvailable = (session: MvpSession) => session.status === "OPEN" && !isPastDeadline(session);
  const isWithdrawalAvailable = (session: MvpSession) =>
    Boolean(session.team_id) && (session.status === "OPEN" || session.status === "RESULT_DISPUTED");
  const selectedTeamForDetail = sessionDetails?.team_id
    ? allTeams.find((team) => team.id === sessionDetails.team_id) || null
    : null;
  const aggregatesEligible = sessionDetails?.status === "CLOSED" && resultConcerns.length === 0;

  const getStatusBadge = (session: MvpSession) => {
    if (isPastDeadline(session)) return <Badge variant="secondary">CLOSED</Badge>;
    if (session.status === "PENDING") return <Badge className="bg-amber-100 text-amber-800">PENDING</Badge>;
    if (session.status === "OPEN") return <Badge className="bg-green-100 text-green-800">OPEN</Badge>;
    if (session.status === "RESULT_DISPUTED") {
      return <Badge className="bg-red-100 text-red-800">RESULT CONCERN</Badge>;
    }
    return <Badge variant="secondary">CLOSED</Badge>;
  };

  if (scopeLoading) {
    return (
      <div className="container mx-auto space-y-6 p-4 md:p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto flex min-h-[400px] items-center justify-center p-4 md:p-6">
        <Card className="w-full max-w-md border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" /> Access denied
            </CardTitle>
            <CardDescription className="text-red-700">
              MVP voting is available to scoped coaches, team managers, club administrators, association administrators and
              super administrators.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      {upgradeError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>MVP database upgrade required</AlertTitle>
          <AlertDescription>{upgradeError}</AlertDescription>
        </Alert>
      )}

      {view === "list" ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight">
                <Trophy className="h-8 w-8 text-yellow-500" /> MVP Voting
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Control each team’s voting rounds, reminders and result concerns.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 self-start"
              onClick={async () => {
                await loadReferenceData();
                await loadSessions();
              }}
              disabled={Boolean(actionLoading)}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Scope and filters</CardTitle>
              <CardDescription>Select the association, club and division before selecting a team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AdminCascadeFilters
                associations={visibleAssociations}
                clubs={visibleClubs}
                divisions={visibleDivisions}
                teams={visibleTeams}
                value={filterCascade}
                onChange={handleCascadeChange}
                disabledAssociation={!isSuperAdmin && visibleAssociations.length === 1}
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                triggerClassName="w-full min-w-0 overflow-hidden"
              />
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={filterStatus}
                    onValueChange={(value) => {
                      setFilterStatus(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All statuses</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="RESULT_DISPUTED">Result concern</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="round-filter">Round</Label>
                  <Input
                    id="round-filter"
                    className="w-32"
                    placeholder="All rounds"
                    value={filterRound}
                    onChange={(event) => {
                      setFilterRound(event.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                {hasRawAuditRole && (
                  <div className="flex items-center gap-2 pb-2">
                    <Switch
                      id="legacy-audit"
                      checked={showLegacy}
                      onCheckedChange={(checked) => {
                        setShowLegacy(checked);
                        setCurrentPage(1);
                      }}
                    />
                    <Label htmlFor="legacy-audit">Legacy audit</Label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {selectedTeam && !showLegacy && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Power className="h-4 w-4" /> {selectedTeam.name} Player MVP settings
                </CardTitle>
                <CardDescription>
                  Control voting access and its emails separately for this team.
                </CardDescription>
                <div className="pt-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/admin/mvp-voting/tallies?team=${selectedTeam.id}`}>
                      <Trophy className="mr-2 h-4 w-4" /> Tally presentations
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">Player MVP Voting is {selectedTeam.mvp_enabled ? "on" : "off"}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTeam.mvp_enabled
                        ? "Completed fixtures can open for this team."
                        : "No new team voting round can be opened."}
                    </p>
                  </div>
                  <Switch
                    checked={selectedTeam.mvp_enabled}
                    onCheckedChange={setTeamToggleTarget}
                    disabled={!schemaReady || Boolean(actionLoading)}
                    aria-label={`Turn Player MVP Voting ${selectedTeam.mvp_enabled ? "off" : "on"} for ${selectedTeam.name}`}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 border-t pt-4">
                  <div>
                    <p className="font-semibold">
                      Email notifications are {selectedTeam.mvp_notifications_enabled ? "on" : "off"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTeam.mvp_notifications_enabled
                        ? "Opening and reminder emails will be sent while voting is open."
                        : "Voting still works, but opening and reminder emails are skipped."}
                    </p>
                  </div>
                  <Switch
                    checked={selectedTeam.mvp_notifications_enabled}
                    onCheckedChange={handleNotificationToggle}
                    disabled={!schemaReady || Boolean(actionLoading)}
                    aria-label={`Turn Player MVP email notifications ${selectedTeam.mvp_notifications_enabled ? "off" : "on"} for ${selectedTeam.name}`}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {selectedTeam && !showLegacy && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4" /> Completed fixtures ready to open
                </CardTitle>
                <CardDescription>
                  This creates the selected team’s round only. The other team remains independent.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={candidateSearch}
                  onChange={(event) => setCandidateSearch(event.target.value)}
                  placeholder="Search by team, venue, round or date"
                  aria-label="Search completed fixtures"
                  disabled={candidatesLoading}
                />
                {candidatesLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : openCandidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No completed fixture is waiting for a team voting round.</p>
                ) : visibleOpenCandidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No completed fixture matches this search.</p>
                ) : (
                  <div className="space-y-3">
                    {visibleOpenCandidates.map((fixture) => (
                      <div
                        key={fixture.id}
                        className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {fixture.homeTeamName} {fixture.home_score}–{fixture.away_score} {fixture.awayTeamName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(fixture.fixture_date, getTeamTimezone(selectedTeam.id))} · {fixture.venueName}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="gap-2 self-start sm:self-auto"
                          onClick={() => openLifecycleDialog("open", null, fixture)}
                          disabled={!schemaReady || !selectedTeam.mvp_enabled || Boolean(actionLoading)}
                        >
                          <Play className="h-4 w-4" /> Open voting
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{showLegacy ? "Legacy session audit" : "Team voting sessions"}</CardTitle>
              <CardDescription>
                {showLegacy
                  ? "Legacy fixture-wide rounds are read-only and cannot be reopened."
                  : "Completion names are visible here, but individual ballot choices remain restricted."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {listLoading ? (
                <div className="space-y-3 p-6">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">No matching voting sessions found.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortableTableHead label="Team" sortKey="team" sort={sessionSort} onSort={(key) => setSessionSort(nextSortState(sessionSort, key))} />
                          <SortableTableHead label="Fixture" sortKey="fixture" sort={sessionSort} onSort={(key) => setSessionSort(nextSortState(sessionSort, key))} />
                          <SortableTableHead label="Date" sortKey="date" sort={sessionSort} onSort={(key) => setSessionSort(nextSortState(sessionSort, key))} />
                          <SortableTableHead label="Status" sortKey="status" sort={sessionSort} onSort={(key) => setSessionSort(nextSortState(sessionSort, key))} />
                          <SortableTableHead label="Completed" sortKey="completed" sort={sessionSort} onSort={(key) => setSessionSort(nextSortState(sessionSort, key))} />
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedSessions.map((session) => {
                          const team = allTeams.find((item) => item.id === session.team_id);
                          const fixture = session.fixture;
                          const homeName =
                            allTeams.find((item) => item.id === fixture?.home_team_id)?.name || session.home_team || "Home";
                          const awayName =
                            allTeams.find((item) => item.id === fixture?.away_team_id)?.name || session.away_team || "Away";
                          return (
                            <TableRow key={session.id}>
                              <TableCell className="w-64 max-w-xs font-semibold">
                                <span className="block truncate">{team?.name || "Legacy fixture-wide"}</span>
                              </TableCell>
                              <TableCell className="min-w-64">
                                <span className="font-medium">{homeName} vs {awayName}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {session.round || (fixture?.round_number ? `Round ${fixture.round_number}` : "Round not recorded")}
                                </span>
                              </TableCell>
                              <TableCell>
                                {formatDate(session.game_date || fixture?.fixture_date, getSessionTimezone(session))}
                              </TableCell>
                              <TableCell>{getStatusBadge(session)}</TableCell>
                              <TableCell>
                                <span className="font-semibold">{session.votedCount || 0}</span>
                                {session.totalVoters === null || session.totalVoters === undefined
                                  ? ""
                                  : ` / ${session.totalVoters}`}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {!showLegacy && session.status === "PENDING" && team?.mvp_enabled && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1"
                                      onClick={() => openLifecycleDialog("open", session)}
                                      disabled={Boolean(actionLoading)}
                                    >
                                      <Play className="h-3.5 w-3.5" /> Open
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" onClick={() => openSessionDetail(session.id)}>
                                    {session.status === "RESULT_DISPUTED" ? "Review" : "Manage"}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-col items-center justify-between gap-3 border-t p-4 sm:flex-row">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Show</span>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(value) => {
                          setPageSize(Number(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                      <span>of {totalCount}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage((page) => page + 1)}
                        disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                      >
                        Next <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Button variant="ghost" size="sm" className="gap-1" onClick={returnToList}>
            <ChevronLeft className="h-4 w-4" /> Back to sessions
          </Button>

          {detailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : detailError || !sessionDetails ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Could not open this session</AlertTitle>
              <AlertDescription>{detailError || "The session is unavailable."}</AlertDescription>
            </Alert>
          ) : (
            <>
              <Card>
                <CardHeader className="border-b">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {getStatusBadge(sessionDetails)}
                        {!sessionDetails.team_id && <Badge variant="outline">LEGACY READ-ONLY</Badge>}
                      </div>
                      <CardTitle className="truncate text-2xl">{getTeamName(sessionDetails.team_id)}</CardTitle>
                      <CardDescription className="mt-1 text-base">
                        {allTeams.find((team) => team.id === sessionDetails.fixture?.home_team_id)?.name || sessionDetails.home_team}
                        {" vs "}
                        {allTeams.find((team) => team.id === sessionDetails.fixture?.away_team_id)?.name || sessionDetails.away_team}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadSessionDetails(sessionDetails.id)}
                      disabled={Boolean(actionLoading)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-5">
                  <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <span className="text-muted-foreground">Fixture date</span>
                      <p className="font-semibold">
                        {formatDate(
                          sessionDetails.fixture?.fixture_date || sessionDetails.game_date,
                          getSessionTimezone(sessionDetails),
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Score</span>
                      <p className="font-semibold">
                        {sessionDetails.fixture?.home_score ?? "–"} – {sessionDetails.fixture?.away_score ?? "–"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Opened</span>
                      <p className="font-semibold">
                        {formatDateTime(sessionDetails.opened_at, getSessionTimezone(sessionDetails))}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Closes</span>
                      <p className="font-semibold">
                        {formatDateTime(sessionDetails.closes_at, getSessionTimezone(sessionDetails))}
                      </p>
                    </div>
                  </div>

                  {sessionDetails.team_id && (
                    <div className="flex flex-wrap gap-2 border-t pt-4">
                      {sessionDetails.status === "PENDING" && (
                        <Button
                          className="gap-2"
                          onClick={() => openLifecycleDialog("open", sessionDetails)}
                          disabled={!selectedTeamForDetail?.mvp_enabled || Boolean(actionLoading)}
                        >
                          <Play className="h-4 w-4" /> Open
                        </Button>
                      )}
                      {sessionDetails.status === "OPEN" && !isPastDeadline(sessionDetails) && (
                        <>
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => openLifecycleDialog("close", sessionDetails)}
                            disabled={resultConcerns.length > 0 || Boolean(actionLoading)}
                            title={
                              resultConcerns.length > 0
                                ? "Resolve the match-result concern before closing"
                                : "Close voting"
                            }
                          >
                            <Square className="h-4 w-4" /> Close
                          </Button>
                          <Button
                              variant="outline"
                              className="gap-2"
                              onClick={handleResendToNonVoters}
                              disabled={
                                !isReminderAvailable(sessionDetails) ||
                                !selectedTeamForDetail?.mvp_notifications_enabled ||
                                Boolean(actionLoading)
                              }
                              title={
                                selectedTeamForDetail?.mvp_notifications_enabled
                                  ? "Remind players who have not voted"
                                  : "Player MVP email notifications are off for this team"
                              }
                            >
                              <Mail className="h-4 w-4" /> Remind non-voters
                          </Button>
                        </>
                      )}
                      {(sessionDetails.status === "CLOSED" || isPastDeadline(sessionDetails)) &&
                        resultConcerns.length === 0 && (
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={() => openLifecycleDialog("reopen", sessionDetails)}
                          disabled={!selectedTeamForDetail?.mvp_enabled || Boolean(actionLoading)}
                        >
                          <RefreshCw className="h-4 w-4" /> Reopen
                        </Button>
                      )}
                      {(sessionDetails.status === "RESULT_DISPUTED" || resultConcerns.length > 0) && (
                        <Button
                          variant="destructive"
                          className="gap-2"
                          onClick={() => openLifecycleDialog("resolve", sessionDetails)}
                          disabled={!selectedTeamForDetail?.mvp_enabled || Boolean(actionLoading)}
                        >
                          <ShieldCheck className="h-4 w-4" /> Confirm corrected and reopen
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {(resultConcerns.length > 0 || sessionDetails.status === "RESULT_DISPUTED") && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-red-800">
                      <AlertTriangle className="h-4 w-4" /> Review result concern
                    </CardTitle>
                    <CardDescription>
                      {resultConcerns.length} player{resultConcerns.length === 1 ? " has" : "s have"} reported the result in
                      review round {sessionDetails.result_check_round}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 rounded-lg bg-muted/30 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div className="flex items-start gap-2">
                        <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <span>
                          {formatDate(sessionDetails.fixture?.fixture_date, getSessionTimezone(sessionDetails))}
                        </span>
                      </div>
                      <div className="font-semibold">
                        {sessionDetails.fixture?.home_score ?? "–"} – {sessionDetails.fixture?.away_score ?? "–"}
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <span>{getVenueName(sessionDetails.fixture?.venue_id)}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <span>{resultConcerns.length} incorrect report{resultConcerns.length === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                    {resultConcerns.length === 0 ? (
                      <p className="text-sm text-muted-foreground">The session is disputed, but no visible report was returned.</p>
                    ) : (
                      <div className="space-y-3">
                        {resultConcerns.map((concern) => (
                          <div key={concern.id} className="rounded-lg border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold">{concern.reporterName}</p>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(concern.created_at, getSessionTimezone(sessionDetails))}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {concern.comment || "No comment was provided."}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    <Alert>
                      <Lock className="h-4 w-4" />
                      <AlertTitle>Correct the fixture first</AlertTitle>
                      <AlertDescription>
                        This page does not edit scores. Use the existing fixture process, then select “Confirm corrected and
                        reopen”.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Trophy className="h-4 w-4 text-yellow-500" /> Aggregate result
                    </CardTitle>
                    <CardDescription>Results are available only after a clean close.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {!aggregatesEligible ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        <Lock className="mx-auto mb-2 h-5 w-5" />
                        Aggregate results are withheld until voting is closed with no unresolved concern.
                      </div>
                    ) : resultsError ? (
                      <div className="p-6 text-sm text-red-700">{resultsError}</div>
                    ) : results.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">No votes were submitted.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rank</TableHead>
                            <TableHead>Player</TableHead>
                            <TableHead className="text-right">Points</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.map((result, index) => (
                            <TableRow key={result.playerId}>
                              <TableCell className="font-semibold">{index + 1}</TableCell>
                              <TableCell>{result.name}</TableCell>
                              <TableCell className="text-right font-bold">{result.points}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-4 w-4" /> Voter completion
                    </CardTitle>
                    <CardDescription>Names and completion only. Ballot choices are not shown here.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {voters.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">No eligible voters found.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Player</TableHead>
                              <TableHead>Vote</TableHead>
                              <TableHead>Result check</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {voters.map((voter) => (
                              <TableRow key={voter.id}>
                                <TableCell className="font-medium">{voter.player_name}</TableCell>
                                <TableCell>
                                  {voter.voted_at ? (
                                    <Badge className="bg-green-100 text-green-800">Voted</Badge>
                                  ) : (
                                    <Badge variant="outline">Pending</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {voter.result_response === "INCORRECT" ? (
                                    <Badge className="bg-red-100 text-red-800">Not correct</Badge>
                                  ) : voter.result_response === "CORRECT" ? (
                                    <Badge className="bg-green-100 text-green-800">Correct</Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Not checked</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {!voter.voted_at && voter.result_response !== "INCORRECT" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleResendToVoter(voter)}
                                      disabled={
                                        !isReminderAvailable(sessionDetails) ||
                                        !selectedTeamForDetail?.mvp_notifications_enabled ||
                                        Boolean(actionLoading) ||
                                        Boolean(rowActionLoading)
                                      }
                                    >
                                      {rowActionLoading === `resend-${voter.id}` ? (
                                        <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Mail className="mr-1 h-3.5 w-3.5" />
                                      )}
                                      Resend
                                    </Button>
                                  ) : !voter.voted_at ? (
                                    <span className="text-xs font-medium text-red-700">Blocked this round</span>
                                  ) : canAuditRawBallotsForSession(sessionDetails) ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-700"
                                      onClick={() => {
                                        setWithdrawVoter(voter);
                                        setWithdrawReason("");
                                      }}
                                      disabled={!isWithdrawalAvailable(sessionDetails) || Boolean(actionLoading)}
                                      title={
                                        isWithdrawalAvailable(sessionDetails)
                                          ? "Withdraw this ballot"
                                          : "A published ballot cannot be withdrawn"
                                      }
                                    >
                                      Withdraw
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Complete</span>
                                  )}
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

              {aggregatesEligible && shoutouts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquare className="h-4 w-4" /> Team shoutouts
                    </CardTitle>
                    <CardDescription>Off-field recognition shared with the closed round.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {shoutouts.map((shoutout, index) => (
                        <div key={`${shoutout.voterName}-${index}`} className="rounded-lg border p-3">
                          <p className="text-sm">“{shoutout.text}”</p>
                          <p className="mt-1 text-xs text-muted-foreground">— {shoutout.voterName}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {canAuditRawBallotsForSession(sessionDetails) && (
                <Card className="border-blue-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Eye className="h-4 w-4" /> Restricted ballot audit
                    </CardTitle>
                    <CardDescription>
                      Only scoped association administrators and super administrators can see who voted for whom.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {rawBallots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No signed-in ballots are available for audit.</p>
                    ) : (
                      <div className="space-y-3">
                        {rawBallots.map((ballot) => (
                          <div key={ballot.voterId} className="rounded-lg border p-3">
                            <p className="font-semibold">{ballot.voterName}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {ballot.choices
                                .slice()
                                .sort((a, b) => b.points - a.points)
                                .map((choice) => (
                                  <Badge key={`${choice.points}-${choice.playerName}`} variant="outline">
                                    {choice.points} point{choice.points === 1 ? "" : "s"}: {choice.playerName}
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      <Dialog open={Boolean(lifecycleDialog)} onOpenChange={(open) => !open && setLifecycleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {lifecycleDialog?.kind === "open" && "Open MVP voting"}
              {lifecycleDialog?.kind === "close" && "Close MVP voting"}
              {lifecycleDialog?.kind === "reopen" && "Reopen MVP voting"}
              {lifecycleDialog?.kind === "resolve" && "Confirm corrected result and reopen"}
            </DialogTitle>
            <DialogDescription>
              {lifecycleDialog?.kind === "close"
                ? "Closing publishes aggregate results only when no result concern is unresolved."
                : lifecycleDialog?.kind === "resolve"
                  ? "Confirm the fixture score has been corrected. This starts a new result-review and reminder cycle while preserving all existing votes and checks."
                  : lifecycleDialog?.kind === "open"
                    ? "The first round closes when this team’s next scheduled match starts. If no later match is scheduled, it closes after 72 hours."
                    : "The default reopening window is 72 hours. You may choose an earlier closing time."}
            </DialogDescription>
          </DialogHeader>
          {(lifecycleDialog?.kind === "reopen" || lifecycleDialog?.kind === "resolve") && (
            <div className="space-y-2 py-2">
              <Label htmlFor="mvp-close-time">Voting closes (local time)</Label>
              <Input
                id="mvp-close-time"
                type="datetime-local"
                value={lifecycleCloseAt}
                max={maximumCloseValue()}
                onChange={(event) => setLifecycleCloseAt(event.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLifecycleDialog(null)} disabled={Boolean(actionLoading)}>
              Cancel
            </Button>
            <Button
              variant={lifecycleDialog?.kind === "close" || lifecycleDialog?.kind === "resolve" ? "destructive" : "default"}
              onClick={handleLifecycleConfirm}
              disabled={Boolean(actionLoading)}
            >
              {actionLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={teamToggleTarget !== null} onOpenChange={(open) => !open && setTeamToggleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{teamToggleTarget ? "Enable" : "Turn off"} MVP voting?</DialogTitle>
            <DialogDescription>
              {teamToggleTarget
                ? `Completed fixtures will automatically open Player MVP Voting for ${selectedTeam?.name || "this team"}.`
                : "This closes every pending and open round for the team in one audited action. Disputed rounds remain visible."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamToggleTarget(null)} disabled={Boolean(actionLoading)}>
              Cancel
            </Button>
            <Button
              variant={teamToggleTarget ? "default" : "destructive"}
              onClick={handleTeamToggleConfirm}
              disabled={Boolean(actionLoading)}
            >
              {actionLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              {teamToggleTarget ? "Enable" : "Turn off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(withdrawVoter)} onOpenChange={(open) => !open && setWithdrawVoter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" /> Withdraw submitted ballot
            </DialogTitle>
            <DialogDescription>
              This audited action removes {withdrawVoter?.player_name}’s three vote rows and submission marker together.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="withdraw-reason">Reason</Label>
            <Textarea
              id="withdraw-reason"
              value={withdrawReason}
              onChange={(event) => setWithdrawReason(event.target.value)}
              placeholder="Explain why this ballot must be withdrawn"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawVoter(null)} disabled={Boolean(actionLoading)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleWithdrawConfirm} disabled={Boolean(actionLoading)}>
              {actionLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Withdraw ballot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

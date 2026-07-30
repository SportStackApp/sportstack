import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FilePenLine,
  ListFilter,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  Unlink,
  Users,
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
import {
  AdminMultiSelectFilter,
  type AdminMultiSelectOption,
} from "@/components/admin/AdminMultiSelectFilter";
import { UmpireLinkedPlayerPicker } from "@/components/umpire/UmpireLinkedPlayerPicker";
import {
  loadUmpireLinkedPlayers,
  type UmpireLinkedPlayerOption,
} from "@/lib/umpireLinkedPlayers";

interface LooseQuery extends PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> {
  select: (columns?: string, options?: unknown) => LooseQuery;
  order: (column: string, options?: unknown) => LooseQuery;
  limit: (count: number) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  insert: (values: unknown) => LooseQuery;
  update: (values: unknown) => LooseQuery;
}

interface LooseSupabase {
  from: (table: string) => LooseQuery;
}

const moduleSupabase = originalSupabase as unknown as LooseSupabase;
const reviewSupabase = originalSupabase as unknown as {
  rpc: (
    functionName: string,
    parameters: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

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
  submitted_by_admin_name?: string | null;
  proxy_submitter_id?: string | null;
  proxy_submitter_name?: string | null;
  umpire_user_id?: string | null;
  is_public_submission?: boolean;
  public_submitter_name?: string | null;
  public_submitter_email?: string | null;
  public_identity_status?: "UNVERIFIED" | "LINKED" | null;
  public_submission_reference?: string | null;
  submitted_at: string;
}

interface VoteLineRow {
  id: string;
  submission_id: string;
  votes: number;
  profile_id: string | null;
  player_name: string;
  player_number: number | null;
  team_id: string | null;
}

interface ReviewLineDraft {
  id: string;
  votes: number;
  profileId: string | null;
  playerName: string;
  playerNumber: string;
  teamId: string | null;
}

interface ReviewRpcLine {
  id: string;
  votes: number;
  profile_id: string | null;
  player_name: string;
  player_number: number | null;
  team_id: string | null;
}

interface ReviewRpcResult {
  action: "SAVE" | "APPROVE" | "REOPEN";
  changed_fields: number;
  lines: ReviewRpcLine[];
}

interface NamedRow {
  id: string;
  name: string;
}

interface ClubRow {
  id: string;
  name: string;
  association_id: string;
}

interface DivisionRow {
  id: string;
  name: string;
  association_id: string;
  age_group: string | null;
}

interface TeamRow {
  id: string;
  name: string;
  club_id: string;
  division_id: string | null;
}

interface TeamDivisionRow {
  team_id: string;
  division_id: string;
  season_id: string | null;
}

interface FixtureRow {
  id: string;
  home_team_id: string;
  away_team_id: string | null;
  division_id: string | null;
  season_id: string | null;
  fixture_date: string | null;
  status: string;
  round_number: number | null;
  round_name: string | null;
}

interface SeasonRow {
  id: string;
  name: string;
  association_id: string;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface VotingScopeContext {
  associationId: string | null;
  clubIds: string[];
  divisionId: string | null;
  teamIds: string[];
  seasonId: string | null;
  roundNumber: number | null;
}

interface VotingScopeFilters {
  isSuperAdmin: boolean;
  scopedAssociationIds: string[];
  scopedClubIds: string[];
  scopedTeamIds: string[];
  associationIds: string[];
  clubIds: string[];
  divisionIds: string[];
  teamIds: string[];
  seasonIds: string[];
  rounds: string[];
}

interface RoundStatusRow {
  key: string;
  label: string;
  total: number;
  approved: number;
  pending: number;
  missing: number;
}

type FixtureVoteStatus = "APPROVED" | "PENDING" | "MISSING";

interface FixtureVotingStatusRow {
  id: string;
  voteStatus: FixtureVoteStatus;
  fixtureDate: string;
  roundKey: string;
  roundLabel: string;
  divisionName: string;
  homeTeamName: string;
  awayTeamName: string;
}

interface FixtureListFilter {
  voteStatus: FixtureVoteStatus | "ALL";
  roundKey: string | null;
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
  original_value?: string | null;
  new_value?: string | null;
  reason?: string | null;
  created_at?: string | null;
  changed_at?: string | null;
}

const getUmpireTeamLabel = (
  team: TeamRow | undefined,
  clubs: ClubRow[],
  divisions: DivisionRow[],
) => {
  if (!team) return "Unknown team";
  const club = clubs.find((item) => item.id === team.club_id);
  const division = divisions.find((item) => item.id === team.division_id);
  return [club?.name, division?.name, team.name].filter(Boolean).join(" - ");
};

const getEditFieldLabel = (fieldName: string | null | undefined) => {
  if (fieldName === "approval_status") return "Status";

  const linkedVoteFieldMatch = fieldName?.match(
    /^vote_line_[0-9a-f-]+_(profile_id|player_name|player_number|team_id)$/,
  );
  if (linkedVoteFieldMatch) {
    const labels: Record<string, string> = {
      profile_id: "Player link",
      player_name: "Player name",
      player_number: "Player number",
      team_id: "Player team",
    };
    return labels[linkedVoteFieldMatch[1]];
  }

  const voteFieldMatch = fieldName?.match(/^vote_(\d+)_(name|number)$/);
  if (voteFieldMatch) {
    const [, voteNumber, field] = voteFieldMatch;
    return `Vote ${voteNumber} ${field}`;
  }

  return fieldName?.replaceAll("_", " ") || "Change";
};

type SubmissionSource = "self" | "proxy" | "public_portal" | "public_portal_proxy" | "admin_proxy";
const UNASSIGNED_SEASON_VALUE = "__UNASSIGNED_SEASON__";

const getSubmissionSource = (submission: SubmissionRow): SubmissionSource => {
  if (submission.submitted_by_admin_id || submission.submitted_by_admin_name) return "admin_proxy";
  if (submission.is_public_submission) {
    return submission.proxy_umpire_name ? "public_portal_proxy" : "public_portal";
  }
  if (submission.proxy_submitter_id || submission.proxy_submitter_name || submission.proxy_umpire_name) return "proxy";
  return "self";
};

const getSubmissionSourceLabel = (source: SubmissionSource) => {
  if (source === "admin_proxy") return "Admin proxy";
  if (source === "public_portal_proxy") return "Public portal proxy";
  if (source === "public_portal") return "Public portal";
  if (source === "proxy") return "Proxy";
  return "Self";
};

const fixtureVoteStatusLabels: Record<FixtureVoteStatus, string> = {
  APPROVED: "Approved",
  PENDING: "Pending approval",
  MISSING: "Missing votes",
};

const formatFixtureDateTime = (value: string) => {
  const fixtureDate = new Date(value);
  if (Number.isNaN(fixtureDate.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Melbourne",
  }).format(fixtureDate);
};

const matchesVotingScope = (
  context: VotingScopeContext,
  filters: VotingScopeFilters,
) => {
  if (!filters.isSuperAdmin) {
    const hasAssociationAccess =
      Boolean(context.associationId) &&
      filters.scopedAssociationIds.includes(context.associationId as string);
    const hasClubAccess = context.clubIds.some((clubId) => filters.scopedClubIds.includes(clubId));
    const hasTeamAccess = context.teamIds.some((teamId) => filters.scopedTeamIds.includes(teamId));
    if (!hasAssociationAccess && !hasClubAccess && !hasTeamAccess) return false;
  }

  if (filters.associationIds.length > 0 && !filters.associationIds.includes(context.associationId || "")) {
    return false;
  }
  if (filters.clubIds.length > 0 && !context.clubIds.some((clubId) => filters.clubIds.includes(clubId))) {
    return false;
  }
  if (filters.divisionIds.length > 0 && !filters.divisionIds.includes(context.divisionId || "")) {
    return false;
  }
  if (filters.teamIds.length > 0 && !context.teamIds.some((teamId) => filters.teamIds.includes(teamId))) {
    return false;
  }
  if (filters.seasonIds.length > 0) {
    const seasonValue = context.seasonId || UNASSIGNED_SEASON_VALUE;
    if (!filters.seasonIds.includes(seasonValue)) return false;
  }
  if (filters.rounds.length > 0 && !filters.rounds.includes(String(context.roundNumber ?? ""))) {
    return false;
  }
  return true;
};

export default function UmpireVotingModule() {
  const { toast } = useToast();
  const {
    loading: scopeLoading,
    isSuperAdmin,
    highestScopedRole,
    scopedAssociationIds,
    scopedClubIds,
    scopedTeamIds,
  } = useAdminScope();
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [voteLines, setVoteLines] = useState<VoteLineRow[]>([]);
  const [editHistory, setEditHistory] = useState<EditHistoryRow[]>([]);
  const [associations, setAssociations] = useState<NamedRow[]>([]);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamDivisions, setTeamDivisions] = useState<TeamDivisionRow[]>([]);
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [associationFilters, setAssociationFilters] = useState<string[]>([]);
  const [seasonFilters, setSeasonFilters] = useState<string[]>([]);
  const [clubFilters, setClubFilters] = useState<string[]>([]);
  const [divisionFilters, setDivisionFilters] = useState<string[]>([]);
  const [teamFilters, setTeamFilters] = useState<string[]>([]);
  const [roundFilters, setRoundFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "DELETED" | "ALL">("PENDING");
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRow | null>(null);
  const [updatingSubmissionId, setUpdatingSubmissionId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<"SAVE" | "APPROVE" | "REOPEN" | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<ReviewLineDraft[]>([]);
  const [reviewBaseline, setReviewBaseline] = useState<ReviewLineDraft[]>([]);
  const [reviewPlayers, setReviewPlayers] = useState<UmpireLinkedPlayerOption[]>([]);
  const [reviewPlayersLoading, setReviewPlayersLoading] = useState(false);
  const [reviewPlayersError, setReviewPlayersError] = useState<string | null>(null);
  const [fixtureListFilter, setFixtureListFilter] = useState<FixtureListFilter | null>(null);

  const hasAccess = isSuperAdmin || highestScopedRole === "ASSOCIATION_ADMIN" || highestScopedRole === "CLUB_ADMIN";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        submissionRes,
        linesRes,
        assocRes,
        clubRes,
        divRes,
        teamRes,
        teamDivisionRes,
        fixtureRes,
        seasonRes,
        profileRes,
      ] = await Promise.all([
        moduleSupabase
          .from("player_vote_submissions")
          .select("id, fixture_id, association_id, division_id, round_number, home_team_id, away_team_id, is_approved, is_locked, is_deleted, proxy_umpire_name, proxy_reason, submitted_by_admin_id, submitted_by_admin_name, proxy_submitter_id, proxy_submitter_name, umpire_user_id, is_public_submission, public_submitter_name, public_submitter_email, public_identity_status, public_submission_reference, submitted_at")
          .order("submitted_at", { ascending: false })
          .limit(250),
        moduleSupabase.from("player_vote_lines").select("id, submission_id, votes, profile_id, player_name, player_number, team_id").limit(1000),
        moduleSupabase.from("associations").select("id, name").order("name"),
        moduleSupabase.from("clubs").select("id, name, association_id").order("name"),
        moduleSupabase.from("divisions").select("id, name, association_id, age_group").order("name"),
        moduleSupabase.from("teams").select("id, name, club_id, division_id").order("name"),
        moduleSupabase.from("team_divisions").select("team_id, division_id, season_id").limit(2000),
        moduleSupabase
          .from("fixtures")
          .select("id, home_team_id, away_team_id, division_id, season_id, fixture_date, status, round_number, round_name")
          .order("fixture_date", { ascending: false })
          .limit(1500),
        moduleSupabase.from("seasons").select("id, name, association_id").order("name", { ascending: false }),
        moduleSupabase.from("profiles").select("id, first_name, last_name").limit(2000),
      ]);

      if (submissionRes.error) throw submissionRes.error;
      if (linesRes.error) throw linesRes.error;
      if (assocRes.error) throw assocRes.error;
      if (clubRes.error) throw clubRes.error;
      if (divRes.error) throw divRes.error;
      if (teamRes.error) throw teamRes.error;
      if (teamDivisionRes.error) throw teamDivisionRes.error;
      if (fixtureRes.error) throw fixtureRes.error;
      if (seasonRes.error) throw seasonRes.error;

      setSubmissions((submissionRes.data || []) as SubmissionRow[]);
      setVoteLines((linesRes.data || []) as VoteLineRow[]);
      setAssociations((assocRes.data || []) as NamedRow[]);
      setClubs((clubRes.data || []) as ClubRow[]);
      setDivisions((divRes.data || []) as DivisionRow[]);
      setTeams((teamRes.data || []) as TeamRow[]);
      setTeamDivisions((teamDivisionRes.data || []) as TeamDivisionRow[]);
      setFixtures((fixtureRes.data || []) as FixtureRow[]);
      setSeasons((seasonRes.data || []) as SeasonRow[]);
      setProfiles(profileRes.error ? [] : ((profileRes.data || []) as ProfileRow[]));

      const editsRes = await moduleSupabase
        .from("player_vote_edits")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(1000);
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

  const teamNameMap = useMemo(
    () => new Map(teams.map((team) => [team.id, getUmpireTeamLabel(team, clubs, divisions)])),
    [teams, clubs, divisions],
  );
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const clubById = useMemo(() => new Map(clubs.map((club) => [club.id, club])), [clubs]);
  const associationNameMap = useMemo(
    () => new Map(associations.map((association) => [association.id, association.name])),
    [associations],
  );
  const divisionNameMap = useMemo(() => new Map(divisions.map((division) => [division.id, division.name])), [divisions]);
  const fixtureById = useMemo(() => new Map(fixtures.map((fixture) => [fixture.id, fixture])), [fixtures]);
  const profileNameMap = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [
          profile.id,
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Recorded user",
        ]),
      ),
    [profiles],
  );

  const teamDivisionsByTeam = useMemo(() => {
    const rows = new Map<string, TeamDivisionRow[]>();
    teamDivisions.forEach((teamDivision) => {
      const current = rows.get(teamDivision.team_id) || [];
      current.push(teamDivision);
      rows.set(teamDivision.team_id, current);
    });
    return rows;
  }, [teamDivisions]);

  const fixtureContextMap = useMemo(() => {
    const contexts = new Map<string, VotingScopeContext>();
    fixtures.forEach((fixture) => {
      const teamIds = [fixture.home_team_id, fixture.away_team_id].filter((id): id is string => Boolean(id));
      const fixtureTeams = teamIds.map((teamId) => teamById.get(teamId)).filter((team): team is TeamRow => Boolean(team));
      const clubIds = Array.from(new Set(fixtureTeams.map((team) => team.club_id)));
      const associationId = clubIds
        .map((clubId) => clubById.get(clubId)?.association_id)
        .find((id): id is string => Boolean(id)) || null;
      const teamDivisionCandidates = teamIds.flatMap((teamId) => teamDivisionsByTeam.get(teamId) || []);
      const linkedDivision =
        teamDivisionCandidates.find((row) => fixture.season_id && row.season_id === fixture.season_id) ||
        teamDivisionCandidates[0];

      contexts.set(fixture.id, {
        associationId,
        clubIds,
        divisionId: fixture.division_id || linkedDivision?.division_id || null,
        teamIds,
        seasonId: fixture.season_id,
        roundNumber: fixture.round_number,
      });
    });
    return contexts;
  }, [fixtures, teamById, clubById, teamDivisionsByTeam]);

  const matchesContextSelections = useCallback(
    (
      context: VotingScopeContext,
      selections: Partial<
        Pick<
          VotingScopeFilters,
          "associationIds" | "seasonIds" | "clubIds" | "divisionIds" | "teamIds" | "rounds"
        >
      > = {},
    ) =>
      matchesVotingScope(context, {
        isSuperAdmin,
        scopedAssociationIds,
        scopedClubIds,
        scopedTeamIds,
        associationIds: selections.associationIds || [],
        seasonIds: selections.seasonIds || [],
        clubIds: selections.clubIds || [],
        divisionIds: selections.divisionIds || [],
        teamIds: selections.teamIds || [],
        rounds: selections.rounds || [],
      }),
    [isSuperAdmin, scopedAssociationIds, scopedClubIds, scopedTeamIds],
  );

  const accessibleFixtureContexts = useMemo(
    () =>
      fixtures
        .map((fixture) => fixtureContextMap.get(fixture.id))
        .filter((context): context is VotingScopeContext => Boolean(context))
        .filter((context) => matchesContextSelections(context)),
    [fixtures, fixtureContextMap, matchesContextSelections],
  );

  const associationOptions = useMemo<AdminMultiSelectOption[]>(() => {
    if (isSuperAdmin) {
      return associations.map((association) => ({ value: association.id, label: association.name }));
    }

    const accessibleAssociationIds = new Set(scopedAssociationIds);
    scopedClubIds.forEach((clubId) => {
      const associationId = clubById.get(clubId)?.association_id;
      if (associationId) accessibleAssociationIds.add(associationId);
    });
    scopedTeamIds.forEach((teamId) => {
      const clubId = teamById.get(teamId)?.club_id;
      const associationId = clubId ? clubById.get(clubId)?.association_id : null;
      if (associationId) accessibleAssociationIds.add(associationId);
    });

    return associations
      .filter((association) => accessibleAssociationIds.has(association.id))
      .map((association) => ({ value: association.id, label: association.name }));
  }, [
    associations,
    isSuperAdmin,
    scopedAssociationIds,
    scopedClubIds,
    scopedTeamIds,
    clubById,
    teamById,
  ]);

  const associationContexts = useMemo(
    () =>
      associationFilters.length === 0
        ? []
        : accessibleFixtureContexts.filter((context) =>
            matchesContextSelections(context, { associationIds: associationFilters }),
          ),
    [accessibleFixtureContexts, associationFilters, matchesContextSelections],
  );

  const seasonOptions = useMemo<AdminMultiSelectOption[]>(() => {
    const availableSeasonIds = new Set(
      associationContexts
        .map((context) => context.seasonId)
        .filter((seasonId): seasonId is string => Boolean(seasonId)),
    );
    const prefixAssociation = associationFilters.length > 1;
    const options = seasons
      .filter(
        (season) =>
          associationFilters.includes(season.association_id) && availableSeasonIds.has(season.id),
      )
      .map((season) => ({
        value: season.id,
        label: prefixAssociation
          ? `${associationNameMap.get(season.association_id) || "Association"} - ${season.name}`
          : season.name,
      }));

    const unassignedContexts = associationContexts.filter((context) => !context.seasonId);
    if (unassignedContexts.length > 0) {
      const unassignedAssociationIds = Array.from(
        new Set(
          unassignedContexts
            .map((context) => context.associationId)
            .filter((associationId): associationId is string => Boolean(associationId)),
        ),
      );
      const associationPrefix =
        prefixAssociation && unassignedAssociationIds.length === 1
          ? `${associationNameMap.get(unassignedAssociationIds[0]) || "Association"} - `
          : "";
      options.push({
        value: UNASSIGNED_SEASON_VALUE,
        label: `${associationPrefix}Unassigned season`,
      });
    }

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [associationContexts, associationFilters, seasons, associationNameMap]);

  const seasonContexts = useMemo(
    () =>
      associationContexts.filter((context) =>
        matchesContextSelections(context, {
          associationIds: associationFilters,
          seasonIds: seasonFilters,
        }),
      ),
    [associationContexts, associationFilters, seasonFilters, matchesContextSelections],
  );

  const clubOptions = useMemo<AdminMultiSelectOption[]>(() => {
    const availableClubIds = new Set(seasonContexts.flatMap((context) => context.clubIds));
    return clubs
      .filter(
        (club) =>
          availableClubIds.has(club.id) &&
          (isSuperAdmin || scopedClubIds.includes(club.id)),
      )
      .map((club) => ({ value: club.id, label: club.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clubs, seasonContexts, isSuperAdmin, scopedClubIds]);

  const clubContexts = useMemo(
    () =>
      seasonContexts.filter((context) =>
        matchesContextSelections(context, {
          associationIds: associationFilters,
          seasonIds: seasonFilters,
          clubIds: clubFilters,
        }),
      ),
    [seasonContexts, associationFilters, seasonFilters, clubFilters, matchesContextSelections],
  );

  const divisionOptions = useMemo<AdminMultiSelectOption[]>(() => {
    const availableDivisionIds = new Set(
      clubContexts
        .map((context) => context.divisionId)
        .filter((divisionId): divisionId is string => Boolean(divisionId)),
    );
    const prefixAssociation = associationFilters.length > 1;
    return divisions
      .filter((division) => availableDivisionIds.has(division.id))
      .map((division) => ({
        value: division.id,
        label: prefixAssociation
          ? `${associationNameMap.get(division.association_id) || "Association"} - ${division.name}`
          : division.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clubContexts, divisions, associationFilters, associationNameMap]);

  const divisionContexts = useMemo(
    () =>
      clubContexts.filter((context) =>
        matchesContextSelections(context, {
          associationIds: associationFilters,
          seasonIds: seasonFilters,
          clubIds: clubFilters,
          divisionIds: divisionFilters,
        }),
      ),
    [
      clubContexts,
      associationFilters,
      seasonFilters,
      clubFilters,
      divisionFilters,
      matchesContextSelections,
    ],
  );

  const teamOptions = useMemo<AdminMultiSelectOption[]>(() => {
    if (divisionFilters.length === 0) return [];

    const availableTeamIds = new Set(divisionContexts.flatMap((context) => context.teamIds));
    return teams
      .filter((team) => {
        if (!availableTeamIds.has(team.id)) return false;
        if (!isSuperAdmin && !scopedTeamIds.includes(team.id)) return false;
        if (clubFilters.length > 0 && !clubFilters.includes(team.club_id)) return false;
        return true;
      })
      .map((team) => ({ value: team.id, label: teamNameMap.get(team.id) || team.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [
    teams,
    divisionContexts,
    divisionFilters,
    clubFilters,
    teamNameMap,
    isSuperAdmin,
    scopedTeamIds,
  ]);

  const teamContexts = useMemo(
    () =>
      divisionContexts.filter((context) =>
        matchesContextSelections(context, {
          associationIds: associationFilters,
          seasonIds: seasonFilters,
          clubIds: clubFilters,
          divisionIds: divisionFilters,
          teamIds: teamFilters,
        }),
      ),
    [
      divisionContexts,
      associationFilters,
      seasonFilters,
      clubFilters,
      divisionFilters,
      teamFilters,
      matchesContextSelections,
    ],
  );

  const roundOptions = useMemo<AdminMultiSelectOption[]>(
    () =>
      Array.from(
        new Set(
          teamContexts
            .map((context) => context.roundNumber)
            .filter((round): round is number => typeof round === "number"),
        ),
      )
        .sort((a, b) => a - b)
        .map((round) => ({ value: String(round), label: `Round ${round}` })),
    [teamContexts],
  );

  const handleAssociationChange = (associationIds: string[]) => {
    setAssociationFilters(associationIds);
    setSeasonFilters([]);
    setClubFilters([]);
    setDivisionFilters([]);
    setTeamFilters([]);
    setRoundFilters([]);
  };

  const handleSeasonChange = (seasonIds: string[]) => {
    setSeasonFilters(seasonIds);
    setClubFilters([]);
    setDivisionFilters([]);
    setTeamFilters([]);
    setRoundFilters([]);
  };

  const handleClubChange = (clubIds: string[]) => {
    setClubFilters(clubIds);
    setDivisionFilters([]);
    setTeamFilters([]);
    setRoundFilters([]);
  };

  const handleDivisionChange = (divisionIds: string[]) => {
    setDivisionFilters(divisionIds);
    setTeamFilters([]);
    setRoundFilters([]);
  };

  const handleTeamChange = (teamIds: string[]) => {
    setTeamFilters(teamIds);
    setRoundFilters([]);
  };

  const submissionContextMap = useMemo(() => {
    const contexts = new Map<string, VotingScopeContext>();
    submissions.forEach((submission) => {
      const fixtureContext = submission.fixture_id ? fixtureContextMap.get(submission.fixture_id) : undefined;
      const teamIds = [submission.home_team_id, submission.away_team_id].filter((id): id is string => Boolean(id));
      const submissionTeams = teamIds.map((teamId) => teamById.get(teamId)).filter((team): team is TeamRow => Boolean(team));
      const clubIds = submissionTeams.length > 0
        ? Array.from(new Set(submissionTeams.map((team) => team.club_id)))
        : fixtureContext?.clubIds || [];
      const associationFromTeams = clubIds
        .map((clubId) => clubById.get(clubId)?.association_id)
        .find((id): id is string => Boolean(id)) || null;

      contexts.set(submission.id, {
        associationId: submission.association_id || fixtureContext?.associationId || associationFromTeams,
        clubIds,
        divisionId: submission.division_id || fixtureContext?.divisionId || null,
        teamIds: teamIds.length > 0 ? teamIds : fixtureContext?.teamIds || [],
        seasonId: fixtureContext?.seasonId || null,
        roundNumber: submission.round_number || fixtureContext?.roundNumber || null,
      });
    });
    return contexts;
  }, [submissions, fixtureContextMap, teamById, clubById]);

  const scopeFilters = useMemo(
    () => ({
      isSuperAdmin,
      scopedAssociationIds,
      scopedClubIds,
      scopedTeamIds,
      associationIds: associationFilters,
      seasonIds: seasonFilters,
      clubIds: clubFilters,
      divisionIds: divisionFilters,
      teamIds: teamFilters,
      rounds: roundFilters,
    }),
    [
      isSuperAdmin,
      scopedAssociationIds,
      scopedClubIds,
      scopedTeamIds,
      associationFilters,
      seasonFilters,
      clubFilters,
      divisionFilters,
      teamFilters,
      roundFilters,
    ],
  );

  const isContextInScope = useCallback(
    (context: VotingScopeContext) => matchesVotingScope(context, scopeFilters),
    [scopeFilters],
  );

  const scopedSubmissions = useMemo(
    () => submissions.filter((submission) => {
      const context = submissionContextMap.get(submission.id);
      return context ? isContextInScope(context) : false;
    }),
    [submissions, submissionContextMap, isContextInScope],
  );

  const scopedFixtures = useMemo(
    () => fixtures.filter((fixture) => {
      const context = fixtureContextMap.get(fixture.id);
      return context ? isContextInScope(context) : false;
    }),
    [fixtures, fixtureContextMap, isContextInScope],
  );

  const getSubmittedForName = useCallback(
    (submission: SubmissionRow) =>
      submission.proxy_umpire_name ||
      (submission.is_public_submission ? submission.public_submitter_name : null) ||
      (submission.umpire_user_id ? profileNameMap.get(submission.umpire_user_id) : null) ||
      "Self",
    [profileNameMap],
  );

  const getSubmittedByName = useCallback(
    (submission: SubmissionRow) =>
      submission.submitted_by_admin_name ||
      (submission.submitted_by_admin_id ? profileNameMap.get(submission.submitted_by_admin_id) : null) ||
      submission.public_submitter_name ||
      submission.proxy_submitter_name ||
      (submission.proxy_submitter_id ? profileNameMap.get(submission.proxy_submitter_id) : null) ||
      (submission.umpire_user_id ? profileNameMap.get(submission.umpire_user_id) : null) ||
      "Recorded user",
    [profileNameMap],
  );

  const visibleSubmissions = useMemo(() => {
    const normalisedSearch = searchTerm.trim().toLowerCase();
    return scopedSubmissions.filter((submission) => {
      if (!showDeleted && submission.is_deleted) return false;
      if (statusFilter === "PENDING" && (submission.is_approved || submission.is_deleted)) return false;
      if (statusFilter === "APPROVED" && (!submission.is_approved || submission.is_deleted)) return false;
      if (statusFilter === "DELETED" && !submission.is_deleted) return false;
      if (normalisedSearch) {
        const lines = voteLines.filter((line) => line.submission_id === submission.id);
        const context = submissionContextMap.get(submission.id);
        const haystack = [
          getSubmittedForName(submission),
          getSubmittedByName(submission),
          getSubmissionSourceLabel(getSubmissionSource(submission)),
          submission.public_submitter_email,
          submission.public_submission_reference,
          submission.proxy_reason,
          context?.roundNumber ? `round ${context.roundNumber}` : "",
          context?.divisionId ? divisionNameMap.get(context.divisionId) : "",
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
    scopedSubmissions,
    showDeleted,
    statusFilter,
    searchTerm,
    voteLines,
    submissionContextMap,
    getSubmittedForName,
    getSubmittedByName,
    divisionNameMap,
    teamNameMap,
  ]);

  const approvedScopedSubmissionIds = useMemo(
    () => new Set(scopedSubmissions.filter((submission) => submission.is_approved && !submission.is_deleted).map((submission) => submission.id)),
    [scopedSubmissions],
  );

  const getSubmissionLines = useCallback(
    (submissionId: string) => voteLines.filter((line) => line.submission_id === submissionId),
    [voteLines],
  );

  const getSubmissionEdits = useCallback(
    (submissionId: string) =>
      editHistory
        .filter((row) => row.submission_id === submissionId)
        .sort((a, b) => {
          const aTime = new Date(a.changed_at || a.created_at || 0).getTime();
          const bTime = new Date(b.changed_at || b.created_at || 0).getTime();
          return bTime - aTime;
        }),
    [editHistory],
  );

  const leaderboard = useMemo(() => {
    const rows = new Map<string, LeaderboardRow>();
    voteLines
      .filter((line) => approvedScopedSubmissionIds.has(line.submission_id))
      .forEach((line) => {
        const playerKey = line.profile_id
          ? `profile-${line.profile_id}`
          : `legacy-${line.player_name.toLowerCase()}-${line.team_id || "none"}-${line.player_number || ""}`;
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
  }, [voteLines, approvedScopedSubmissionIds, teamNameMap]);

  const dashboard = useMemo(() => {
    const eligibleFixtures = scopedFixtures.filter((fixture) => {
      if (!fixture.away_team_id || !fixture.fixture_date) return false;
      if (["CANCELLED", "POSTPONED"].includes(fixture.status)) return false;
      return new Date(fixture.fixture_date).getTime() <= Date.now();
    });
    const submissionsByFixture = new Map<string, SubmissionRow[]>();
    scopedSubmissions.forEach((submission) => {
      if (!submission.fixture_id || submission.is_deleted) return;
      const current = submissionsByFixture.get(submission.fixture_id) || [];
      current.push(submission);
      submissionsByFixture.set(submission.fixture_id, current);
    });

    const fixtureStatuses: FixtureVotingStatusRow[] = eligibleFixtures.map((fixture) => {
      const fixtureSubmissions = submissionsByFixture.get(fixture.id) || [];
      const voteStatus: FixtureVoteStatus = fixtureSubmissions.some((submission) => submission.is_approved)
        ? "APPROVED"
        : fixtureSubmissions.length > 0
          ? "PENDING"
          : "MISSING";
      const roundKey = fixture.round_number === null ? "unallocated" : String(fixture.round_number);

      return {
        id: fixture.id,
        voteStatus,
        fixtureDate: fixture.fixture_date as string,
        roundKey,
        roundLabel:
          fixture.round_name ||
          (fixture.round_number === null ? "No round" : `Round ${fixture.round_number}`),
        divisionName: fixture.division_id
          ? divisionNameMap.get(fixture.division_id) || "Unknown division"
          : "No division",
        homeTeamName: teamNameMap.get(fixture.home_team_id) || "Unknown home team",
        awayTeamName: fixture.away_team_id
          ? teamNameMap.get(fixture.away_team_id) || "Unknown away team"
          : "No away team",
      };
    });

    const rounds = new Map<string, RoundStatusRow>();
    fixtureStatuses.forEach((fixture) => {
      const current = rounds.get(fixture.roundKey) || {
        key: fixture.roundKey,
        label: fixture.roundLabel,
        total: 0,
        approved: 0,
        pending: 0,
        missing: 0,
      };
      current.total += 1;
      if (fixture.voteStatus === "APPROVED") current.approved += 1;
      else if (fixture.voteStatus === "PENDING") current.pending += 1;
      else current.missing += 1;
      rounds.set(fixture.roundKey, current);
    });

    const scopedSubmissionIds = new Set(scopedSubmissions.map((submission) => submission.id));
    const nameCorrectionSubmissionIds = new Set(
      editHistory
        .filter((edit) => {
          const field = edit.field_name?.toLowerCase() || "";
          return Boolean(edit.submission_id && scopedSubmissionIds.has(edit.submission_id) && field.includes("player") && field.includes("name"));
        })
        .map((edit) => edit.submission_id as string),
    );

    return {
      totalFixtures: fixtureStatuses.length,
      missing: fixtureStatuses.filter((fixture) => fixture.voteStatus === "MISSING").length,
      pending: fixtureStatuses.filter((fixture) => fixture.voteStatus === "PENDING").length,
      approved: fixtureStatuses.filter((fixture) => fixture.voteStatus === "APPROVED").length,
      proxy: scopedSubmissions.filter((submission) => !submission.is_deleted && getSubmissionSource(submission) !== "self").length,
      nameCorrections: nameCorrectionSubmissionIds.size,
      deleted: scopedSubmissions.filter((submission) => submission.is_deleted).length,
      unlinkedSubmissions: scopedSubmissions.filter(
        (submission) => !submission.is_deleted && !submission.fixture_id,
      ).length,
      fixtureStatuses,
      rounds: Array.from(rounds.values()).sort((a, b) => {
        if (a.key === "unallocated") return 1;
        if (b.key === "unallocated") return -1;
        return Number(a.key) - Number(b.key);
      }),
    };
  }, [scopedFixtures, scopedSubmissions, editHistory, divisionNameMap, teamNameMap]);

  const listedFixtures = useMemo(() => {
    if (!fixtureListFilter) return [];

    return dashboard.fixtureStatuses
      .filter(
        (fixture) =>
          (fixtureListFilter.voteStatus === "ALL" ||
            fixture.voteStatus === fixtureListFilter.voteStatus) &&
          (!fixtureListFilter.roundKey || fixture.roundKey === fixtureListFilter.roundKey),
      )
      .sort(
        (a, b) =>
          new Date(a.fixtureDate).getTime() - new Date(b.fixtureDate).getTime() ||
          a.homeTeamName.localeCompare(b.homeTeamName),
      );
  }, [dashboard.fixtureStatuses, fixtureListFilter]);

  const fixtureListRoundLabel = fixtureListFilter?.roundKey
    ? dashboard.rounds.find((round) => round.key === fixtureListFilter.roundKey)?.label
    : null;

  const fixtureListTitle = fixtureListFilter
    ? `${
        fixtureListFilter.voteStatus === "ALL"
          ? "Past fixtures"
          : fixtureVoteStatusLabels[fixtureListFilter.voteStatus]
      }${fixtureListRoundLabel ? ` - ${fixtureListRoundLabel}` : ""}`
    : "Fixture voting status";

  const exportCsv = () => {
    const rows = visibleSubmissions.map((submission) => {
      const context = submissionContextMap.get(submission.id);
      const lines = getSubmissionLines(submission.id)
        .map((line) => `${line.votes} ${line.player_name || "Unknown"}${line.player_number ? ` #${line.player_number}` : ""}`)
        .join("; ");
      return [
        submission.submitted_at,
        context?.roundNumber ? `Round ${context.roundNumber}` : "",
        context?.divisionId ? divisionNameMap.get(context.divisionId) || "" : "",
        `${submission.home_team_id ? teamNameMap.get(submission.home_team_id) || "" : ""} vs ${submission.away_team_id ? teamNameMap.get(submission.away_team_id) || "" : ""}`,
        getSubmittedForName(submission),
        getSubmittedByName(submission),
        submission.public_submitter_email || "",
        getSubmissionSourceLabel(getSubmissionSource(submission)),
        submission.public_submission_reference || "",
        submission.proxy_reason || "",
        submission.is_deleted ? "Deleted" : submission.is_approved ? "Approved" : "Pending",
        lines,
      ];
    });
    const csv = [
      ["Submitted", "Round", "Division", "Match", "Submitted for", "Submitted by", "Submitter email", "Source", "Reference", "Proxy reason", "Status", "Votes"],
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

  const selectedSubmissionContext = selectedSubmission ? submissionContextMap.get(selectedSubmission.id) : undefined;
  const selectedFixture = selectedSubmission?.fixture_id ? fixtureById.get(selectedSubmission.fixture_id) : undefined;
  const selectedHomeTeamId = selectedSubmission?.home_team_id || selectedFixture?.home_team_id || null;
  const selectedAwayTeamId = selectedSubmission?.away_team_id || selectedFixture?.away_team_id || null;
  const selectedSubmissionEdits = selectedSubmission ? getSubmissionEdits(selectedSubmission.id) : [];
  const isUpdatingSelectedSubmission = selectedSubmission?.id === updatingSubmissionId;

  useEffect(() => {
    let cancelled = false;

    if (!selectedSubmission) {
      setReviewDrafts([]);
      setReviewBaseline([]);
      setReviewPlayers([]);
      setReviewPlayersLoading(false);
      setReviewPlayersError(null);
      return;
    }

    const nextDrafts = voteLines
      .filter((line) => line.submission_id === selectedSubmission.id)
      .sort((a, b) => b.votes - a.votes || a.id.localeCompare(b.id))
      .map((line) => ({
        id: line.id,
        votes: line.votes,
        profileId: line.profile_id,
        playerName: line.player_name || "",
        playerNumber: line.player_number === null ? "" : String(line.player_number),
        teamId: line.team_id,
      }));
    setReviewDrafts(nextDrafts);
    setReviewBaseline(nextDrafts);
    setReviewPlayers([]);
    setReviewPlayersError(null);

    const fixture = selectedSubmission.fixture_id
      ? fixtureById.get(selectedSubmission.fixture_id)
      : undefined;
    const homeTeamId = selectedSubmission.home_team_id || fixture?.home_team_id || null;
    const awayTeamId = selectedSubmission.away_team_id || fixture?.away_team_id || null;

    if (!homeTeamId || !awayTeamId) {
      setReviewPlayersLoading(false);
      setReviewPlayersError("This submission does not have two fixture teams, so linked players cannot be loaded.");
      return;
    }

    setReviewPlayersLoading(true);
    loadUmpireLinkedPlayers({
      fixtureId: selectedSubmission.fixture_id,
      homeTeamId,
      awayTeamId,
      homeTeamLabel: teamNameMap.get(homeTeamId) || "Home team",
      awayTeamLabel: teamNameMap.get(awayTeamId) || "Away team",
    })
      .then((players) => {
        if (!cancelled) setReviewPlayers(players);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Failed to load linked umpire vote players:", error);
        setReviewPlayersError("Linked players could not be loaded. Refresh and try again before changing a player.");
      })
      .finally(() => {
        if (!cancelled) setReviewPlayersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSubmission, voteLines, fixtureById, teamNameMap]);

  const reviewHasUnsavedChanges = useMemo(
    () => JSON.stringify(reviewDrafts) !== JSON.stringify(reviewBaseline),
    [reviewDrafts, reviewBaseline],
  );
  const reviewHasInvalidNumbers = useMemo(
    () =>
      reviewDrafts.some(
        (line) => line.playerNumber.trim() !== "" && !/^\d+$/.test(line.playerNumber.trim()),
      ),
    [reviewDrafts],
  );
  const reviewIncompleteCount = useMemo(
    () => reviewDrafts.filter((line) => !line.profileId || !line.teamId).length,
    [reviewDrafts],
  );

  const runReviewAction = async (action: "SAVE" | "APPROVE" | "REOPEN") => {
    if (!selectedSubmission) return false;

    if (action === "SAVE" && reviewHasInvalidNumbers) {
      toast({
        title: "Corrections not saved",
        description: "Player numbers must contain whole numbers only.",
        variant: "destructive",
      });
      return false;
    }

    setUpdatingSubmissionId(selectedSubmission.id);
    setReviewAction(action);

    try {
      const lines =
        action === "SAVE"
          ? reviewDrafts.map((line) => ({
              line_id: line.id,
              profile_id: line.profileId,
              player_name: line.playerName.trim(),
              player_number: line.playerNumber.trim() === "" ? null : Number(line.playerNumber),
              team_id: line.teamId,
            }))
          : null;

      const { data, error } = await reviewSupabase.rpc("review_umpire_vote_submission", {
        p_submission_id: selectedSubmission.id,
        p_action: action,
        p_lines: lines,
      });

      if (error) {
        toast({
          title:
            action === "SAVE"
              ? "Corrections not saved"
              : action === "APPROVE"
                ? "Submission not approved"
                : "Submission not reopened",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      const result = data as ReviewRpcResult;
      const savedLines = Array.isArray(result?.lines) ? result.lines : [];
      if (savedLines.length > 0) {
        const savedById = new Map(savedLines.map((line) => [line.id, line]));
        setVoteLines((current) =>
          current.map((line) => {
            const saved = savedById.get(line.id);
            return saved
              ? {
                  ...line,
                  votes: saved.votes,
                  profile_id: saved.profile_id,
                  player_name: saved.player_name,
                  player_number: saved.player_number,
                  team_id: saved.team_id,
                }
              : line;
          }),
        );

        const savedDrafts = savedLines.map((line) => ({
          id: line.id,
          votes: line.votes,
          profileId: line.profile_id,
          playerName: line.player_name || "",
          playerNumber: line.player_number === null ? "" : String(line.player_number),
          teamId: line.team_id,
        }));
        setReviewDrafts(savedDrafts);
        setReviewBaseline(savedDrafts);
      }

      if (action === "SAVE") {
        toast({
          title: "Corrections saved",
          description: `${result.changed_fields || 0} audited field change${result.changed_fields === 1 ? "" : "s"} recorded.`,
        });
      } else {
        toast({ title: action === "APPROVE" ? "Submission approved" : "Submission reopened" });
        setSelectedSubmission(null);
      }

      await loadData();
      return true;
    } finally {
      setUpdatingSubmissionId(null);
      setReviewAction(null);
    }
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
    <div className="w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-6 overflow-x-hidden lg:max-w-[calc(100vw-17rem)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Vote className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Umpire Voting</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin review, approvals and leaderboard for umpire best-player votes.
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading} className="w-fit self-start lg:self-auto">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Voting scope</CardTitle>
          <CardDescription>Filter the dashboard, submissions and leaderboard together.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <AdminMultiSelectFilter
              label="Association"
              options={associationOptions}
              selected={associationFilters}
              onChange={handleAssociationChange}
              allLabel="All associations"
              searchPlaceholder="Search associations..."
            />
            <AdminMultiSelectFilter
              label="Season"
              options={seasonOptions}
              selected={seasonFilters}
              onChange={handleSeasonChange}
              allLabel="All seasons"
              searchPlaceholder="Search seasons..."
              disabled={associationFilters.length === 0}
              disabledPlaceholder="Select an association first"
            />
            <AdminMultiSelectFilter
              label="Club"
              options={clubOptions}
              selected={clubFilters}
              onChange={handleClubChange}
              allLabel="All clubs"
              searchPlaceholder="Search clubs..."
              disabled={associationFilters.length === 0}
              disabledPlaceholder="Select an association first"
            />
            <AdminMultiSelectFilter
              label="Division"
              options={divisionOptions}
              selected={divisionFilters}
              onChange={handleDivisionChange}
              allLabel="All divisions"
              searchPlaceholder="Search divisions..."
              disabled={associationFilters.length === 0}
              disabledPlaceholder="Select an association first"
            />
            <AdminMultiSelectFilter
              label="Team"
              options={teamOptions}
              selected={teamFilters}
              onChange={handleTeamChange}
              allLabel="All teams"
              searchPlaceholder="Search teams..."
              disabled={associationFilters.length === 0 || divisionFilters.length === 0}
              disabledPlaceholder={
                associationFilters.length === 0
                  ? "Select an association first"
                  : "Select a division first"
              }
            />
            <AdminMultiSelectFilter
              label="Round"
              options={roundOptions}
              selected={roundFilters}
              onChange={setRoundFilters}
              allLabel="All rounds"
              searchPlaceholder="Search rounds..."
              disabled={associationFilters.length === 0}
              disabledPlaceholder="Select an association first"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="submissions">Vote Submissions</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Metric
              icon={CalendarDays}
              label="Past fixtures"
              value={dashboard.totalFixtures}
              onView={() => setFixtureListFilter({ voteStatus: "ALL", roundKey: null })}
            />
            <Metric
              icon={CalendarX2}
              label="Missing votes"
              value={dashboard.missing}
              onView={() => setFixtureListFilter({ voteStatus: "MISSING", roundKey: null })}
            />
            <Metric
              icon={Clock}
              label="Pending approval"
              value={dashboard.pending}
              onView={() => setFixtureListFilter({ voteStatus: "PENDING", roundKey: null })}
            />
            <Metric
              icon={CheckCircle2}
              label="Approved fixtures"
              value={dashboard.approved}
              onView={() => setFixtureListFilter({ voteStatus: "APPROVED", roundKey: null })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric icon={Users} label="Proxy submissions" value={dashboard.proxy} />
            <Metric icon={FilePenLine} label="Name corrections logged" value={dashboard.nameCorrections} />
            <Metric icon={Trash2} label="Deleted submissions" value={dashboard.deleted} />
            <Metric icon={Unlink} label="Unlinked submissions" value={dashboard.unlinkedSubmissions} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fixture voting status by round</CardTitle>
              <CardDescription>
                Fixtures whose scheduled start has passed. Each fixture is counted once.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading voting status...
                </div>
              ) : dashboard.rounds.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No eligible past fixtures were found in this scope.
                </p>
              ) : (
                <div className="space-y-5">
                  {dashboard.rounds.map((round) => (
                    <div key={round.key} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">{round.label}</span>
                        <span className="text-muted-foreground">{round.total} fixtures</span>
                      </div>
                      <div className="flex h-3 w-full overflow-hidden rounded-sm bg-muted" aria-label={`${round.label} voting status`}>
                        {round.approved > 0 && (
                          <div
                            className="bg-emerald-600"
                            style={{ width: `${(round.approved / round.total) * 100}%` }}
                            title={`${round.approved} approved fixture${round.approved === 1 ? "" : "s"}`}
                          />
                        )}
                        {round.pending > 0 && (
                          <div
                            className="bg-amber-500"
                            style={{ width: `${(round.pending / round.total) * 100}%` }}
                            title={`${round.pending} fixture${round.pending === 1 ? "" : "s"} pending approval`}
                          />
                        )}
                        {round.missing > 0 && (
                          <div
                            className="bg-rose-600"
                            style={{ width: `${(round.missing / round.total) * 100}%` }}
                            title={`${round.missing} fixture${round.missing === 1 ? "" : "s"} missing votes`}
                          />
                        )}
                      </div>
                      <div className="flex min-h-7 flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" />Approved {round.approved}</span>
                        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />Pending {round.pending}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-7 px-2 text-xs text-muted-foreground"
                          disabled={round.missing === 0}
                          onClick={() =>
                            setFixtureListFilter({ voteStatus: "MISSING", roundKey: round.key })
                          }
                        >
                          <ListFilter className="mr-1.5 h-3.5 w-3.5" />
                          Missing {round.missing}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Vote Submissions</CardTitle>
              <CardDescription>{loading ? "Loading..." : `${visibleSubmissions.length} submissions shown.`}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 border-b pb-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="space-y-2 md:col-span-2 xl:col-span-3">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Umpire, team, player, source or reason"
                  />
                </div>
              </div>
              <div className="space-y-2 xl:col-span-1">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                  <SelectTrigger className="w-full min-w-0 overflow-hidden"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="DELETED">Deleted</SelectItem>
                    <SelectItem value="ALL">All submissions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end xl:col-span-1">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={showDeleted} onCheckedChange={setShowDeleted} />
                  Show deleted
                </label>
              </div>
              <div className="flex items-end justify-end md:col-span-2 xl:col-span-1">
                <Button variant="outline" onClick={exportCsv} disabled={visibleSubmissions.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Round</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Fixture</TableHead>
                    <TableHead>Submitted for</TableHead>
                    <TableHead>Submitted by</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Votes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleSubmissions.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">No umpire submissions found for the selected filters.</TableCell></TableRow>
                  ) : (
                    visibleSubmissions.map((submission) => {
                      const lines = getSubmissionLines(submission.id);
                      const context = submissionContextMap.get(submission.id);
                      const fixture = submission.fixture_id ? fixtureById.get(submission.fixture_id) : undefined;
                      const homeTeamId = submission.home_team_id || fixture?.home_team_id || null;
                      const awayTeamId = submission.away_team_id || fixture?.away_team_id || null;
                      const source = getSubmissionSource(submission);
                      return (
                        <TableRow key={submission.id}>
                          <TableCell className="whitespace-nowrap font-medium">{context?.roundNumber ? `Round ${context.roundNumber}` : "-"}</TableCell>
                          <TableCell className="w-64 max-w-xs">{context?.divisionId ? divisionNameMap.get(context.divisionId) || "Unknown" : "-"}</TableCell>
                          <TableCell className="w-64 max-w-xs">
                            <div className="space-y-1 font-medium">
                              <div className="truncate" title={homeTeamId ? teamNameMap.get(homeTeamId) : "Custom home team"}>
                                <span className="sr-only">Home: </span>
                                {homeTeamId ? teamNameMap.get(homeTeamId) || "Home team" : "Custom home team"}
                              </div>
                              <div className="truncate" title={awayTeamId ? teamNameMap.get(awayTeamId) : "Custom away team"}>
                                <span className="sr-only">Away: </span>
                                {awayTeamId ? teamNameMap.get(awayTeamId) || "Away team" : "Custom away team"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{getSubmittedForName(submission)}</div>
                            {submission.proxy_reason && (
                              <div className="max-w-[220px] truncate text-xs text-muted-foreground">{submission.proxy_reason}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>{getSubmittedByName(submission)}</div>
                            {submission.public_submitter_email && (
                              <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                                {submission.public_submitter_email}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{getSubmissionSourceLabel(source)}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {lines.map((line) => (
                                <div key={line.id} className="max-w-[240px] truncate text-sm">
                                  <span className="font-semibold">{line.votes}</span> - {line.player_name}
                                  {line.player_number !== null && (
                                    <span className="ml-1 text-muted-foreground">#{line.player_number}</span>
                                  )}
                                </div>
                              ))}
                            </div>
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
                          <TableCell className="whitespace-nowrap text-sm">{new Date(submission.submitted_at).toLocaleString("en-AU")}</TableCell>
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
                  {leaderboard.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No approved vote lines were found in this scope.</TableCell></TableRow>
                  ) : (
                    leaderboard.slice(0, 100).map((row, index) => (
                      <TableRow key={row.playerKey}>
                        <TableCell className="font-semibold">{index + 1}</TableCell>
                        <TableCell>{row.playerName}</TableCell>
                        <TableCell>{row.teamName}</TableCell>
                        <TableCell className="text-center">{row.threes}</TableCell>
                        <TableCell className="text-center">{row.twos}</TableCell>
                        <TableCell className="text-center">{row.ones}</TableCell>
                        <TableCell className="text-center text-lg font-semibold">{row.total}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(fixtureListFilter)}
        onOpenChange={(open) => {
          if (!open) setFixtureListFilter(null);
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 px-6 pb-4 pt-6">
            <DialogTitle>{fixtureListTitle}</DialogTitle>
            <DialogDescription>
              {listedFixtures.length} fixture{listedFixtures.length === 1 ? "" : "s"} in the selected
              dashboard scope. Byes, cancelled and postponed fixtures are excluded.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto border-y px-6">
            {listedFixtures.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No fixtures match this status and scope.
              </p>
            ) : (
              <div className="divide-y">
                {listedFixtures.map((fixture) => (
                  <div
                    key={fixture.id}
                    className="grid min-w-0 gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium" title={fixture.homeTeamName}>
                        {fixture.homeTeamName}
                      </p>
                      <p className="truncate font-medium" title={fixture.awayTeamName}>
                        {fixture.awayTeamName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {fixture.roundLabel} - {fixture.divisionName}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      <time
                        dateTime={fixture.fixtureDate}
                        className="whitespace-nowrap text-xs text-muted-foreground"
                      >
                        {formatFixtureDateTime(fixture.fixtureDate)}
                      </time>
                      <Badge
                        variant="outline"
                        className={
                          fixture.voteStatus === "APPROVED"
                            ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-300"
                            : fixture.voteStatus === "PENDING"
                              ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                              : "border-rose-600/40 text-rose-700 dark:text-rose-300"
                        }
                      >
                        {fixtureVoteStatusLabels[fixture.voteStatus]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 px-6 py-4">
            <Button variant="outline" onClick={() => setFixtureListFilter(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedSubmission)}
        onOpenChange={(open) => {
          if (!open && !isUpdatingSelectedSubmission) setSelectedSubmission(null);
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          {selectedSubmission && (
            <>
              <DialogHeader className="shrink-0 px-6 pb-4 pt-6">
                <DialogTitle>Review umpire submission</DialogTitle>
                <DialogDescription>
                  Link each player, check their number and team, then save before approval.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-4">
                <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Fixture</p>
                    <div className="space-y-1 font-medium">
                      <p>{selectedHomeTeamId ? teamNameMap.get(selectedHomeTeamId) || "Home team" : "Custom home team"}</p>
                      <p>{selectedAwayTeamId ? teamNameMap.get(selectedAwayTeamId) || "Away team" : "Custom away team"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Round / Division</p>
                    <p className="font-medium">
                      Round {selectedSubmissionContext?.roundNumber || "-"} - {selectedSubmissionContext?.divisionId ? divisionNameMap.get(selectedSubmissionContext.divisionId) || "Unknown division" : "No division"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Submitted for</p>
                    <p className="font-medium">{getSubmittedForName(selectedSubmission)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Submitted by</p>
                    <p className="font-medium">{getSubmittedByName(selectedSubmission)}</p>
                    {selectedSubmission.public_submitter_email && (
                      <p className="text-xs text-muted-foreground">{selectedSubmission.public_submitter_email}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Source</p>
                    <Badge variant="outline">{getSubmissionSourceLabel(getSubmissionSource(selectedSubmission))}</Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Submitted</p>
                    <p className="font-medium">{new Date(selectedSubmission.submitted_at).toLocaleString("en-AU")}</p>
                  </div>
                  {selectedSubmission.public_submission_reference && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Public reference</p>
                      <p className="font-mono text-sm font-medium">{selectedSubmission.public_submission_reference}</p>
                      <Badge variant="secondary" className="mt-1">
                        {selectedSubmission.public_identity_status === "LINKED" ? "Identity linked" : "Identity unverified"}
                      </Badge>
                    </div>
                  )}
                  {selectedSubmission.proxy_reason && (
                    <div className="md:col-span-2">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Proxy/admin reason</p>
                      <p className="text-sm">{selectedSubmission.proxy_reason}</p>
                    </div>
                  )}
                </div>

                <div className="rounded-md border">
                  <div className="hidden grid-cols-[3.5rem_minmax(0,2fr)_5.5rem_minmax(0,1.4fr)] gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
                    <span>Points</span>
                    <span>Linked player</span>
                    <span>Number</span>
                    <span>Fixture team</span>
                  </div>
                  <div className="divide-y">
                    {reviewDrafts.map((line) => (
                      <div
                        key={line.id}
                        className="grid gap-3 p-3 md:grid-cols-[3.5rem_minmax(0,2fr)_5.5rem_minmax(0,1.4fr)] md:items-start"
                      >
                        <div>
                          <p className="mb-1 text-xs font-medium text-muted-foreground md:hidden">Points</p>
                          <Badge>{line.votes}</Badge>
                        </div>
                        <div className="min-w-0">
                          <p className="mb-1 text-xs font-medium text-muted-foreground md:hidden">Linked player</p>
                          <UmpireLinkedPlayerPicker
                            value={line.playerName}
                            profileId={line.profileId}
                            options={reviewPlayers}
                            loading={reviewPlayersLoading}
                            disabled={
                              selectedSubmission.is_approved ||
                              selectedSubmission.is_deleted ||
                              isUpdatingSelectedSubmission
                            }
                            onNameChange={(playerName) => {
                              setReviewDrafts((current) =>
                                current.map((draft) =>
                                  draft.id === line.id
                                    ? { ...draft, profileId: null, playerName }
                                    : draft,
                                ),
                              );
                            }}
                            onSelect={(player) => {
                              setReviewDrafts((current) =>
                                current.map((draft) =>
                                  draft.id === line.id
                                    ? {
                                        ...draft,
                                        profileId: player.profileId,
                                        playerName: player.name,
                                        playerNumber: player.number,
                                        teamId: player.teamId,
                                      }
                                    : draft,
                                ),
                              );
                            }}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`vote-line-number-${line.id}`}
                            className="mb-1 block text-xs font-medium text-muted-foreground md:hidden"
                          >
                            Number
                          </label>
                          <Input
                            id={`vote-line-number-${line.id}`}
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="1"
                            value={line.playerNumber}
                            disabled={
                              selectedSubmission.is_approved ||
                              selectedSubmission.is_deleted ||
                              isUpdatingSelectedSubmission
                            }
                            aria-label={`${line.votes} point player number`}
                            onChange={(event) => {
                              const playerNumber = event.target.value;
                              setReviewDrafts((current) =>
                                current.map((draft) =>
                                  draft.id === line.id ? { ...draft, playerNumber } : draft,
                                ),
                              );
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="mb-1 text-xs font-medium text-muted-foreground md:hidden">Fixture team</p>
                          <Select
                            value={line.teamId || "__none__"}
                            disabled={
                              selectedSubmission.is_approved ||
                              selectedSubmission.is_deleted ||
                              isUpdatingSelectedSubmission
                            }
                            onValueChange={(value) => {
                              setReviewDrafts((current) =>
                                current.map((draft) =>
                                  draft.id === line.id
                                    ? { ...draft, teamId: value === "__none__" ? null : value }
                                    : draft,
                                ),
                              );
                            }}
                          >
                            <SelectTrigger className="w-full min-w-0 overflow-hidden">
                              <SelectValue placeholder="Select fixture team" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Select fixture team</SelectItem>
                              {selectedHomeTeamId && (
                                <SelectItem value={selectedHomeTeamId}>
                                  {teamNameMap.get(selectedHomeTeamId) || "Home team"}
                                </SelectItem>
                              )}
                              {selectedAwayTeamId && (
                                <SelectItem value={selectedAwayTeamId}>
                                  {teamNameMap.get(selectedAwayTeamId) || "Away team"}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {reviewPlayersError && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{reviewPlayersError}</span>
                  </div>
                )}

                {!selectedSubmission.is_approved && !selectedSubmission.is_deleted && (
                  <div
                    className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                      reviewIncompleteCount > 0 || reviewHasUnsavedChanges || reviewHasInvalidNumbers
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                    }`}
                  >
                    {reviewIncompleteCount > 0 || reviewHasUnsavedChanges || reviewHasInvalidNumbers ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {reviewHasInvalidNumbers
                        ? "Player numbers must contain whole numbers only."
                        : reviewHasUnsavedChanges
                          ? "Save corrections before approving this submission."
                          : reviewIncompleteCount > 0
                            ? `${reviewIncompleteCount} vote line${reviewIncompleteCount === 1 ? "" : "s"} still need a linked profile and fixture team.`
                            : "All vote lines are linked and ready for approval."}
                    </span>
                  </div>
                )}

                <div className="rounded-md border p-3">
                  <p className="text-sm font-semibold">Submission history</p>
                  {selectedSubmissionEdits.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No history was recorded for this submission.</p>
                  ) : (
                    <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                      {selectedSubmissionEdits.map((edit) => {
                        const originalValue = edit.old_value || edit.original_value || "blank";
                        const newValue = edit.new_value || "blank";
                        const actorName = edit.changed_by_id
                          ? profileNameMap.get(edit.changed_by_id) || "Unknown admin"
                          : "Unknown admin";
                        const changedAt = new Date(
                          edit.created_at || edit.changed_at || selectedSubmission.submitted_at,
                        ).toLocaleString("en-AU");

                        return (
                          <div
                            key={edit.id}
                            className="grid min-w-0 gap-1 rounded-sm bg-muted/40 px-2 py-1.5 text-xs sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-2"
                          >
                            <Badge variant="outline" className="w-fit whitespace-nowrap text-xs">
                              {getEditFieldLabel(edit.field_name)}
                            </Badge>
                            <p className="min-w-0 truncate" title={`${originalValue} -> ${newValue}`}>
                              <span className="text-muted-foreground line-through">{originalValue}</span>
                              <span className="mx-1.5">-&gt;</span>
                              <span className="font-medium">{newValue}</span>
                            </p>
                            <span className="whitespace-nowrap text-muted-foreground">by {actorName}</span>
                            <span className="whitespace-nowrap text-muted-foreground">{changedAt}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="shrink-0 border-t px-6 py-4">
                <Button
                  variant="outline"
                  onClick={() => setSelectedSubmission(null)}
                  disabled={isUpdatingSelectedSubmission}
                >
                  Close
                </Button>
                {!selectedSubmission.is_deleted && (
                  selectedSubmission.is_approved ? (
                    <Button
                      variant="outline"
                      disabled={isUpdatingSelectedSubmission}
                      onClick={() => runReviewAction("REOPEN")}
                    >
                      {reviewAction === "REOPEN" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      {reviewAction === "REOPEN" ? "Reopening..." : "Reopen"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        disabled={
                          isUpdatingSelectedSubmission ||
                          !reviewHasUnsavedChanges ||
                          reviewHasInvalidNumbers
                        }
                        onClick={() => runReviewAction("SAVE")}
                      >
                        {reviewAction === "SAVE" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        {reviewAction === "SAVE" ? "Saving..." : "Save Corrections"}
                      </Button>
                      <Button
                        disabled={
                          isUpdatingSelectedSubmission ||
                          reviewDrafts.length === 0 ||
                          reviewHasUnsavedChanges ||
                          reviewHasInvalidNumbers ||
                          reviewIncompleteCount > 0
                        }
                        onClick={() => runReviewAction("APPROVE")}
                      >
                        {reviewAction === "APPROVE" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-2 h-4 w-4" />
                        )}
                        {reviewAction === "APPROVE" ? "Approving..." : "Approve"}
                      </Button>
                    </>
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

function Metric({
  icon: Icon,
  label,
  value,
  onView,
}: {
  icon: typeof Trophy;
  label: string;
  value: number;
  onView?: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex h-full min-h-28 flex-col p-4">
        <div className="flex items-center justify-between">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-2xl font-semibold">{value}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{label}</p>
        {onView && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 mt-auto h-7 w-fit px-2 text-xs"
            onClick={onView}
          >
            <ListFilter className="mr-1.5 h-3.5 w-3.5" />
            View fixtures
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

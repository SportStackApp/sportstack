import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Database,
  Download,
  Loader2,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { PlayerExplorerFilterBuilder } from "@/components/admin/PlayerExplorerFilterBuilder";
import { PlayerExplorerSavedSearches } from "@/components/admin/PlayerExplorerSavedSearches";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useToast } from "@/hooks/use-toast";
import { useTeamContext } from "@/contexts/TeamContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database as SupabaseDatabase } from "@/integrations/supabase/types";
import {
  aggregatePlayerExplorerRecords,
  createEmptyPlayerExplorerExpression,
  createPlayerExplorerMovementExample,
  filterPlayerExplorerRecords,
  resolvePlayerExplorerIdentity,
  validatePlayerExplorerExpression,
  type PlayerExplorerFilterExpression,
  type PlayerExplorerFilterOptions,
  type PlayerExplorerIdentityStatus,
  type PlayerExplorerProfile,
  type PlayerExplorerRecord,
  type PlayerExplorerResult,
} from "@/lib/playerExplorer";
import {
  buildPlayerExplorerCsv,
  buildPlayerExplorerTsv,
  sortPlayerExplorerResults,
  totalPlayerExplorerResults,
  type PlayerExplorerSortDirection,
  type PlayerExplorerSortKey,
} from "@/lib/playerExplorerResults";
import {
  getPlayerExplorerSessionStorageKey,
  readPlayerExplorerSessionState,
  writePlayerExplorerSessionState,
} from "@/lib/playerExplorerSession";
import {
  getPlayerExplorerAccessScopeKey,
  getPlayerExplorerLockedFilters,
} from "@/lib/playerExplorerScope";

type Tables = SupabaseDatabase["public"]["Tables"];
type AssociationRow = Pick<Tables["associations"]["Row"], "id" | "name">;
type ClubRow = Pick<Tables["clubs"]["Row"], "id" | "name" | "association_id">;
type DivisionRow = Pick<
  Tables["divisions"]["Row"],
  "id" | "name" | "association_id" | "competition_id" | "season_id"
>;
type TeamRow = Pick<Tables["teams"]["Row"], "id" | "name" | "club_id" | "division_id">;
type CompetitionRow = Pick<Tables["competitions"]["Row"], "id" | "name" | "association_id" | "season_id">;
type SeasonRow = Pick<Tables["seasons"]["Row"], "id" | "name" | "association_id" | "year">;
type FixtureRow = Pick<
  Tables["fixtures"]["Row"],
  "id" | "revsports_match_url" | "home_team_id" | "away_team_id" | "division_id" | "season_id"
>;
type SourceMatchRow = Pick<
  Tables["source_revsports_matches"]["Row"],
  "id" | "match_url" | "game_date" | "game_time" | "round_number" | "last_seen_at"
>;
type AppearanceRow = Pick<
  Tables["source_revsports_player_appearances"]["Row"],
  | "id"
  | "match_id"
  | "revsports_player_id"
  | "revsports_team_id"
  | "player_name"
  | "team_name"
  | "team_side"
  | "goals"
  | "green_cards"
  | "yellow_cards"
  | "red_cards"
>;
type ProfileRow = Pick<
  Tables["profiles"]["Row"],
  "id" | "first_name" | "last_name" | "is_placeholder" | "revsports_player_id"
>;
type ExternalEntityRow = Pick<
  Tables["external_entities"]["Row"],
  "id" | "entity_type" | "external_id" | "source"
>;
type ExternalLinkRow = Pick<
  Tables["external_entity_links"]["Row"],
  "external_entity_id" | "target_table" | "target_id" | "status"
>;

interface PageResponse<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface PlayerExplorerCatalogue {
  associations: AssociationRow[];
  clubs: ClubRow[];
  divisions: DivisionRow[];
  teams: TeamRow[];
  competitions: CompetitionRow[];
  seasons: SeasonRow[];
  fixtures: FixtureRow[];
  matches: SourceMatchRow[];
  profiles: ProfileRow[];
  externalEntities: ExternalEntityRow[];
  externalLinks: ExternalLinkRow[];
  latestSourceDataAt: string | null;
}

interface MatchContext {
  sourceMatchId: string;
  fixture: FixtureRow;
  roundNumber: number | null;
  gameDate: string | null;
  gameTime: string | null;
  associationId: string | null;
  divisionId: string | null;
  competitionId: string | null;
  seasonId: string | null;
}

const SOURCE_NAME = "revsports";
const PAGE_SIZE = 1000;
const MATCH_ID_CHUNK_SIZE = 50;
const RESULT_PAGE_SIZES = [10, 25, 50] as const;
const NUMERIC_SORT_KEYS = new Set<PlayerExplorerSortKey>([
  "gamesPlayed",
  "goals",
  "greenCards",
  "yellowCards",
  "redCards",
]);

const getErrorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Player Explorer data could not be loaded.";
};

const fetchAllPages = async <T,>(
  loadPage: (from: number, to: number) => PromiseLike<PageResponse<T>>,
) => {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
};

const chunkValues = <T,>(values: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const formatFreshness = (value: string | null) => {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Melbourne",
  }).format(new Date(value));
};

const identityStatusDetails: Record<
  PlayerExplorerIdentityStatus,
  { label: string; variant: BadgeProps["variant"] }
> = {
  linked: { label: "Linked", variant: "available" },
  placeholder: { label: "Placeholder", variant: "pending" },
  unlinked: { label: "Unlinked", variant: "outline" },
  identity_conflict: { label: "Identity conflict", variant: "destructive" },
};

const buildMatchContexts = (catalogue: PlayerExplorerCatalogue) => {
  const fixtureByUrl = new Map(
    catalogue.fixtures
      .filter((fixture) => fixture.revsports_match_url)
      .map((fixture) => [fixture.revsports_match_url as string, fixture]),
  );
  const divisionById = new Map(catalogue.divisions.map((division) => [division.id, division]));
  const contexts: MatchContext[] = [];

  for (const match of catalogue.matches) {
    const fixture = fixtureByUrl.get(match.match_url);
    if (!fixture) continue;
    const division = fixture.division_id ? divisionById.get(fixture.division_id) : undefined;
    const associationId = division?.association_id || null;
    const competitionId = division?.competition_id || null;
    const seasonId = fixture.season_id || division?.season_id || null;

    contexts.push({
      sourceMatchId: match.id,
      fixture,
      roundNumber: match.round_number,
      gameDate: match.game_date,
      gameTime: match.game_time,
      associationId,
      divisionId: fixture.division_id,
      competitionId,
      seasonId,
    });
  }

  return contexts;
};

const fetchAppearancesForMatches = async (matchIds: string[]) => {
  if (matchIds.length === 0) return [];
  const chunks = chunkValues(matchIds, MATCH_ID_CHUNK_SIZE);
  const pages = await Promise.all(chunks.map((matchIdChunk) =>
    fetchAllPages<AppearanceRow>((from, to) => supabase
      .from("source_revsports_player_appearances")
      .select("id, match_id, revsports_player_id, revsports_team_id, player_name, team_name, team_side, goals, green_cards, yellow_cards, red_cards")
      .in("match_id", matchIdChunk)
      .eq("attended", true)
      .eq("is_removed", false)
      .order("id")
      .range(from, to)),
  ));
  return pages.flat();
};

const fetchExternalIdentityDataForAppearances = async (appearances: AppearanceRow[]) => {
  const externalIds = Array.from(new Set(
    appearances.flatMap((appearance) => [
      appearance.revsports_player_id,
      appearance.revsports_team_id,
    ]).filter((id): id is string => Boolean(id)),
  ));

  if (externalIds.length === 0) {
    return { externalEntities: [] as ExternalEntityRow[], externalLinks: [] as ExternalLinkRow[] };
  }

  // Scoped RLS checks are intentionally expensive. Limiting the identity
  // queries to source IDs already visible in the active scope avoids scanning
  // every association player and timing out for team-level users.
  const entityPages = await Promise.all(chunkValues(externalIds, 100).map((externalIdChunk) =>
    fetchAllPages<ExternalEntityRow>((from, to) => supabase
      .from("external_entities")
      .select("id, entity_type, external_id, source")
      .eq("source", SOURCE_NAME)
      .in("entity_type", ["player", "team"])
      .in("external_id", externalIdChunk)
      .order("id")
      .range(from, to)),
  ));
  const externalEntities = entityPages.flat();
  const entityIds = externalEntities.map((entity) => entity.id);
  if (entityIds.length === 0) {
    return { externalEntities, externalLinks: [] as ExternalLinkRow[] };
  }

  const linkPages = await Promise.all(chunkValues(entityIds, 100).map((entityIdChunk) =>
    fetchAllPages<ExternalLinkRow>((from, to) => supabase
      .from("external_entity_links")
      .select("external_entity_id, target_table, target_id, status")
      .in("external_entity_id", entityIdChunk)
      .in("target_table", ["profiles", "teams"])
      .order("external_entity_id")
      .range(from, to)),
  ));

  return { externalEntities, externalLinks: linkPages.flat() };
};

const buildRecords = (
  appearances: AppearanceRow[],
  contexts: MatchContext[],
  catalogue: PlayerExplorerCatalogue,
): PlayerExplorerRecord[] => {
  const contextByMatchId = new Map(contexts.map((context) => [context.sourceMatchId, context]));
  const teamById = new Map(catalogue.teams.map((team) => [team.id, team]));
  const divisionById = new Map(catalogue.divisions.map((division) => [division.id, division]));
  const profilesById = new Map<string, PlayerExplorerProfile>(catalogue.profiles.map((profile) => [
    profile.id,
    {
      id: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      isPlaceholder: profile.is_placeholder,
    },
  ]));
  const directProfileIdByRevId = new Map(
    catalogue.profiles
      .filter((profile) => profile.revsports_player_id)
      .map((profile) => [profile.revsports_player_id as string, profile.id]),
  );
  const linkByEntityId = new Map(
    catalogue.externalLinks
      .filter((link) => link.status === "matched" && link.target_id)
      .map((link) => [link.external_entity_id, link]),
  );
  const externalProfileIdByRevId = new Map<string, string>();
  const externalTeamIdByRevId = new Map<string, string>();

  for (const entity of catalogue.externalEntities) {
    if (!entity.external_id) continue;
    const link = linkByEntityId.get(entity.id);
    if (!link?.target_id) continue;
    if (entity.entity_type === "player" && link.target_table === "profiles") {
      externalProfileIdByRevId.set(entity.external_id, link.target_id);
    }
    if (entity.entity_type === "team" && link.target_table === "teams") {
      externalTeamIdByRevId.set(entity.external_id, link.target_id);
    }
  }

  const identityByRevId = new Map<string, ReturnType<typeof resolvePlayerExplorerIdentity>>();
  const records: PlayerExplorerRecord[] = [];

  for (const appearance of appearances) {
    if (!appearance.match_id || !appearance.revsports_player_id) continue;
    const context = contextByMatchId.get(appearance.match_id);
    if (!context) continue;

    let teamId: string | null = null;
    if (appearance.team_side === "home") teamId = context.fixture.home_team_id;
    if (appearance.team_side === "away") teamId = context.fixture.away_team_id;
    if (!teamId && appearance.revsports_team_id) {
      teamId = externalTeamIdByRevId.get(appearance.revsports_team_id) || null;
    }

    const team = teamId ? teamById.get(teamId) : undefined;
    const division = context.divisionId ? divisionById.get(context.divisionId) : undefined;
    let identity = identityByRevId.get(appearance.revsports_player_id);
    if (!identity) {
      identity = resolvePlayerExplorerIdentity({
        revsportsPlayerId: appearance.revsports_player_id,
        sourcePlayerName: appearance.player_name,
        directProfileId: directProfileIdByRevId.get(appearance.revsports_player_id) || null,
        externalProfileId: externalProfileIdByRevId.get(appearance.revsports_player_id) || null,
        profilesById,
      });
      identityByRevId.set(appearance.revsports_player_id, identity);
    }

    records.push({
      appearanceId: appearance.id,
      matchId: appearance.match_id,
      revsportsPlayerId: appearance.revsports_player_id,
      sourcePlayerName: appearance.player_name,
      profileId: identity.profileId,
      displayName: identity.displayName,
      identityStatus: identity.identityStatus,
      teamId,
      teamName: team?.name || appearance.team_name,
      clubId: team?.club_id || null,
      associationId: context.associationId || division?.association_id || null,
      divisionId: context.divisionId,
      competitionId: context.competitionId,
      seasonId: context.seasonId,
      roundNumber: context.roundNumber,
      gameDate: context.gameDate,
      gameTime: context.gameTime,
      goals: appearance.goals,
      greenCards: appearance.green_cards,
      yellowCards: appearance.yellow_cards,
      redCards: appearance.red_cards,
    });
  }

  return records;
};

const loadCatalogue = async (includeGlobalIdentityData: boolean): Promise<PlayerExplorerCatalogue> => {
  const [
    associations,
    clubs,
    divisions,
    teams,
    competitions,
    seasons,
    fixtures,
    matches,
    profiles,
    externalEntities,
    externalLinks,
  ] = await Promise.all([
    fetchAllPages<AssociationRow>((from, to) => supabase.from("associations").select("id, name").order("id").range(from, to)),
    fetchAllPages<ClubRow>((from, to) => supabase.from("clubs").select("id, name, association_id").order("id").range(from, to)),
    fetchAllPages<DivisionRow>((from, to) => supabase.from("divisions").select("id, name, association_id, competition_id, season_id").order("id").range(from, to)),
    fetchAllPages<TeamRow>((from, to) => supabase.from("teams").select("id, name, club_id, division_id").order("id").range(from, to)),
    fetchAllPages<CompetitionRow>((from, to) => supabase.from("competitions").select("id, name, association_id, season_id").order("id").range(from, to)),
    fetchAllPages<SeasonRow>((from, to) => supabase.from("seasons").select("id, name, association_id, year").order("id").range(from, to)),
    fetchAllPages<FixtureRow>((from, to) => supabase.from("fixtures").select("id, revsports_match_url, home_team_id, away_team_id, division_id, season_id").order("id").range(from, to)),
    fetchAllPages<SourceMatchRow>((from, to) => supabase.from("source_revsports_matches").select("id, match_url, game_date, game_time, round_number, last_seen_at").order("id").range(from, to)),
    fetchAllPages<ProfileRow>((from, to) => supabase.from("profiles").select("id, first_name, last_name, is_placeholder, revsports_player_id").order("id").range(from, to)),
    includeGlobalIdentityData
      ? fetchAllPages<ExternalEntityRow>((from, to) => supabase
          .from("external_entities")
          .select("id, entity_type, external_id, source")
          .eq("source", SOURCE_NAME)
          .in("entity_type", ["player", "team"])
          .order("id")
          .range(from, to))
      : Promise.resolve([] as ExternalEntityRow[]),
    includeGlobalIdentityData
      ? fetchAllPages<ExternalLinkRow>((from, to) => supabase
          .from("external_entity_links")
          .select("external_entity_id, target_table, target_id, status")
          .in("target_table", ["profiles", "teams"])
          .order("id")
          .range(from, to))
      : Promise.resolve([] as ExternalLinkRow[]),
  ]);

  // Match freshness is already available in the catalogue. Reusing it avoids
  // an unbounded appearance-table scan through the scoped RLS policy.
  const latestSourceDataAt = matches.reduce<string | null>((latest, match) => {
    if (!match.last_seen_at) return latest;
    return !latest || match.last_seen_at > latest ? match.last_seen_at : latest;
  }, null);

  return {
    associations,
    clubs,
    divisions,
    teams,
    competitions,
    seasons,
    fixtures,
    matches,
    profiles,
    externalEntities,
    externalLinks,
    latestSourceDataAt,
  };
};

export default function PlayerExplorer() {
  const { user } = useAuth();
  const { scopeLoading, isSuperAdmin, actorMode } = useAdminScope();
  const {
    selectedAssociationId,
    selectedClubId,
    selectedTeamId,
  } = useTeamContext();
  const { toast } = useToast();
  const [catalogue, setCatalogue] = useState<PlayerExplorerCatalogue | null>(null);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [results, setResults] = useState<PlayerExplorerResult[]>([]);
  const [matchedAppearanceCount, setMatchedAppearanceCount] = useState(0);
  const [matchedMatchCount, setMatchedMatchCount] = useState(0);
  const [filterExpression, setFilterExpression] = useState<PlayerExplorerFilterExpression>(
    createEmptyPlayerExplorerExpression,
  );
  const recordsCacheRef = useRef<PlayerExplorerRecord[] | null>(null);

  const [resultSearch, setResultSearch] = useState("");
  const deferredResultSearch = useDeferredValue(resultSearch.trim().toLocaleLowerCase("en-AU"));
  const [pageSize, setPageSize] = useState<(typeof RESULT_PAGE_SIZES)[number]>(25);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<PlayerExplorerSortKey>("gamesPlayed");
  const [sortDirection, setSortDirection] = useState<PlayerExplorerSortDirection>("desc");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [restoredSessionKey, setRestoredSessionKey] = useState<string | null>(null);

  const accessScopeKey = getPlayerExplorerAccessScopeKey({
    actorMode,
    isSuperAdmin,
    selectedAssociationId,
    selectedClubId,
    selectedTeamId,
  });
  const canUsePlayerExplorer = accessScopeKey !== null;
  const sessionStorageKey = user?.id && accessScopeKey
    ? getPlayerExplorerSessionStorageKey(user.id, accessScopeKey)
    : null;

  const fetchCatalogue = useCallback(async () => {
    if (!canUsePlayerExplorer || !accessScopeKey) return;
    setCatalogueLoading(true);
    setCatalogueError(null);
    recordsCacheRef.current = null;
    try {
      setCatalogue(await loadCatalogue(isSuperAdmin));
    } catch (error) {
      setCatalogueError(getErrorMessage(error));
    } finally {
      setCatalogueLoading(false);
    }
  }, [accessScopeKey, canUsePlayerExplorer, isSuperAdmin]);

  useEffect(() => {
    if (!scopeLoading && canUsePlayerExplorer) void fetchCatalogue();
    if (!scopeLoading && !canUsePlayerExplorer) setCatalogueLoading(false);
  }, [canUsePlayerExplorer, fetchCatalogue, scopeLoading]);

  useEffect(() => {
    setRestoredSessionKey(null);
    const stored = sessionStorageKey
      ? readPlayerExplorerSessionState(window.sessionStorage, sessionStorageKey)
      : null;

    setFilterExpression(stored?.expression || createEmptyPlayerExplorerExpression());
    setSearchError(null);
    setHasRun(stored?.hasRun || false);
    setResults(stored?.results || []);
    setMatchedAppearanceCount(stored?.matchedAppearanceCount || 0);
    setMatchedMatchCount(stored?.matchedMatchCount || 0);
    setResultSearch(stored?.resultSearch || "");
    setPageSize(stored?.pageSize || 25);
    setPage(stored?.page || 1);
    setSortKey(stored?.sortKey || "gamesPlayed");
    setSortDirection(stored?.sortDirection || "desc");
    recordsCacheRef.current = null;
    setRestoredSessionKey(sessionStorageKey);
  }, [sessionStorageKey]);

  useEffect(() => {
    if (!sessionStorageKey || restoredSessionKey !== sessionStorageKey) return;
    writePlayerExplorerSessionState(window.sessionStorage, sessionStorageKey, {
      expression: filterExpression,
      hasRun,
      results,
      matchedAppearanceCount,
      matchedMatchCount,
      resultSearch,
      pageSize,
      page,
      sortKey,
      sortDirection,
    });
  }, [
    filterExpression,
    hasRun,
    matchedAppearanceCount,
    matchedMatchCount,
    page,
    pageSize,
    restoredSessionKey,
    resultSearch,
    results,
    sessionStorageKey,
    sortDirection,
    sortKey,
  ]);

  const scopeDetails = useMemo(() => {
    if (!catalogue || isSuperAdmin) {
      return {
        associationId: null,
        associationName: null,
        clubId: null,
        clubName: null,
        teamId: null,
        teamName: null,
      };
    }

    const teamId = actorMode === "team_manager" || actorMode === "coach"
      ? selectedTeamId
      : null;
    const team = teamId ? catalogue.teams.find((item) => item.id === teamId) : null;
    const clubId = actorMode === "club"
      ? selectedClubId
      : team?.club_id || null;
    const club = clubId ? catalogue.clubs.find((item) => item.id === clubId) : null;
    const associationId = actorMode === "association"
      ? selectedAssociationId
      : club?.association_id || null;
    const association = associationId
      ? catalogue.associations.find((item) => item.id === associationId)
      : null;

    return {
      associationId,
      associationName: association?.name || null,
      clubId,
      clubName: club?.name || null,
      teamId,
      teamName: team?.name || null,
    };
  }, [actorMode, catalogue, isSuperAdmin, selectedAssociationId, selectedClubId, selectedTeamId]);

  const lockedFilters = useMemo(
    () => getPlayerExplorerLockedFilters(isSuperAdmin, scopeDetails),
    [isSuperAdmin, scopeDetails],
  );

  const filterOptions = useMemo<PlayerExplorerFilterOptions>(() => {
    if (!catalogue) return {};
    const associationNames = new Map(catalogue.associations.map((item) => [item.id, item.name]));
    const clubNames = new Map(catalogue.clubs.map((item) => [item.id, item.name]));
    const labelled = <T extends { id: string; name: string }>(
      rows: T[],
      context: (row: T) => string | null | undefined,
    ) => rows.map((row) => ({
      value: row.id,
      label: [row.name, context(row)].filter(Boolean).join(" — "),
    })).sort((left, right) => left.label.localeCompare(right.label));

    if (isSuperAdmin) {
      return {
        association: labelled(catalogue.associations, () => null),
        club: labelled(catalogue.clubs, (club) => associationNames.get(club.association_id)),
        division: labelled(catalogue.divisions, (division) => associationNames.get(division.association_id)),
        team: labelled(catalogue.teams, (team) => team.club_id ? clubNames.get(team.club_id) : null),
        competition: labelled(catalogue.competitions, (competition) => associationNames.get(competition.association_id)),
        season: labelled(catalogue.seasons, (season) => associationNames.get(season.association_id)),
      };
    }

    const scopedClubs = catalogue.clubs.filter((club) =>
      actorMode === "association"
        ? club.association_id === scopeDetails.associationId
        : club.id === scopeDetails.clubId,
    );
    const scopedClubIds = new Set(scopedClubs.map((club) => club.id));
    const scopedTeams = catalogue.teams.filter((team) =>
      actorMode === "team_manager" || actorMode === "coach"
        ? team.id === scopeDetails.teamId
        : scopedClubIds.has(team.club_id),
    );
    const scopedTeamIds = new Set(scopedTeams.map((team) => team.id));
    const scopedFixtures = catalogue.fixtures.filter((fixture) =>
      (fixture.home_team_id && scopedTeamIds.has(fixture.home_team_id))
      || (fixture.away_team_id && scopedTeamIds.has(fixture.away_team_id)),
    );
    const scopedDivisionIds = new Set([
      ...scopedTeams.map((team) => team.division_id).filter((id): id is string => Boolean(id)),
      ...scopedFixtures.map((fixture) => fixture.division_id).filter((id): id is string => Boolean(id)),
    ]);
    const scopedDivisions = catalogue.divisions.filter((division) =>
      actorMode === "association"
        ? division.association_id === scopeDetails.associationId
        : scopedDivisionIds.has(division.id),
    );
    const scopedCompetitionIds = new Set(
      scopedDivisions.map((division) => division.competition_id).filter((id): id is string => Boolean(id)),
    );
    const scopedSeasonIds = new Set([
      ...scopedDivisions.map((division) => division.season_id).filter((id): id is string => Boolean(id)),
      ...scopedFixtures.map((fixture) => fixture.season_id).filter((id): id is string => Boolean(id)),
    ]);

    return {
      association: labelled(
        catalogue.associations.filter((association) => association.id === scopeDetails.associationId),
        () => null,
      ),
      club: labelled(scopedClubs, (club) => associationNames.get(club.association_id)),
      division: labelled(scopedDivisions, (division) => associationNames.get(division.association_id)),
      team: labelled(scopedTeams, (team) => team.club_id ? clubNames.get(team.club_id) : null),
      competition: labelled(
        catalogue.competitions.filter((competition) =>
          actorMode === "association"
            ? competition.association_id === scopeDetails.associationId
            : scopedCompetitionIds.has(competition.id),
        ),
        (competition) => associationNames.get(competition.association_id),
      ),
      season: labelled(
        catalogue.seasons.filter((season) =>
          actorMode === "association"
            ? season.association_id === scopeDetails.associationId
            : scopedSeasonIds.has(season.id),
        ),
        (season) => associationNames.get(season.association_id),
      ),
    };
  }, [actorMode, catalogue, isSuperAdmin, scopeDetails]);

  const resetFilters = () => {
    setFilterExpression(createEmptyPlayerExplorerExpression());
    setSearchError(null);
    setHasRun(false);
    setResults([]);
    setMatchedAppearanceCount(0);
    setMatchedMatchCount(0);
    setResultSearch("");
    setPage(1);
  };

  const runSearch = async () => {
    if (!catalogue) return;
    const validationError = validatePlayerExplorerExpression(filterExpression);
    if (validationError) {
      setSearchError(validationError);
      return;
    }

    setSearching(true);
    setSearchError(null);
    try {
      let records = recordsCacheRef.current;
      if (!records) {
        const contexts = buildMatchContexts(catalogue);
        const appearances = await fetchAppearancesForMatches(contexts.map((context) => context.sourceMatchId));
        const identityData = isSuperAdmin
          ? { externalEntities: catalogue.externalEntities, externalLinks: catalogue.externalLinks }
          : await fetchExternalIdentityDataForAppearances(appearances);
        records = buildRecords(appearances, contexts, { ...catalogue, ...identityData });
        recordsCacheRef.current = records;
      }
      const filteredRecords = filterPlayerExplorerRecords(records, filterExpression);
      setResults(aggregatePlayerExplorerRecords(filteredRecords));
      setMatchedMatchCount(new Set(filteredRecords.map((record) => record.matchId)).size);
      setMatchedAppearanceCount(filteredRecords.length);
      setHasRun(true);
      setPage(1);
    } catch (error) {
      setSearchError(getErrorMessage(error));
    } finally {
      setSearching(false);
    }
  };

  const filteredResults = useMemo(() => {
    const searchedResults = deferredResultSearch ? results.filter((result) => [
      result.displayName,
      result.sourcePlayerName,
      result.revsportsPlayerId,
      ...result.teamNames,
    ].some((value) => value.toLocaleLowerCase("en-AU").includes(deferredResultSearch))) : results;

    return sortPlayerExplorerResults(searchedResults, sortKey, sortDirection);
  }, [deferredResultSearch, results, sortDirection, sortKey]);
  const resultTotals = useMemo(
    () => totalPlayerExplorerResults(filteredResults),
    [filteredResults],
  );

  useEffect(() => setPage(1), [deferredResultSearch, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleResults = filteredResults.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const identityIssueCount = results.filter((result) =>
    result.identityStatus === "unlinked" || result.identityStatus === "identity_conflict",
  ).length;

  const updateSort = (nextSortKey: PlayerExplorerSortKey) => {
    if (nextSortKey === sortKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
    } else {
      setSortKey(nextSortKey);
      setSortDirection(NUMERIC_SORT_KEYS.has(nextSortKey) ? "desc" : "asc");
    }
    setPage(1);
  };

  const sortIcon = (headerSortKey: PlayerExplorerSortKey) => {
    if (headerSortKey !== sortKey) return <ArrowUpDown className="ml-1 h-3.5 w-3.5" />;
    return sortDirection === "asc"
      ? <ArrowUp className="ml-1 h-3.5 w-3.5" />
      : <ArrowDown className="ml-1 h-3.5 w-3.5" />;
  };

  const ariaSort = (headerSortKey: PlayerExplorerSortKey) => {
    if (headerSortKey !== sortKey) return "none" as const;
    return sortDirection === "asc" ? "ascending" as const : "descending" as const;
  };

  const downloadResults = () => {
    const csv = buildPlayerExplorerCsv(filteredResults);
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sportstack-player-explorer-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({
      title: "CSV downloaded",
      description: `${filteredResults.length} player result${filteredResults.length === 1 ? "" : "s"} exported.`,
    });
  };

  const copyResults = async () => {
    try {
      await navigator.clipboard.writeText(buildPlayerExplorerTsv(filteredResults));
      toast({
        title: "Results copied",
        description: `${filteredResults.length} player result${filteredResults.length === 1 ? "" : "s"} ready to paste into a spreadsheet.`,
      });
    } catch {
      toast({
        title: "Results could not be copied",
        description: "Use Download CSV instead, or allow clipboard access in your browser.",
        variant: "destructive",
      });
    }
  };

  if (scopeLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-72 w-full" /></div>;
  }

  if (!canUsePlayerExplorer) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Player Explorer access unavailable</AlertTitle>
        <AlertDescription>
          Select a confirmed Association Admin, Club Admin, Team Manager, Coach or Super Admin scope and try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-display font-bold">
            <Users className="h-8 w-8 text-primary" />
            Player Explorer
          </h1>
          <p className="mt-1 text-muted-foreground">
            Build Looker-style filters inside your access scope. Results are read-only.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          <Database className="mr-1 h-3 w-3" />
          V2 data: {formatFreshness(catalogue?.latestSourceDataAt || null)}
        </Badge>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Current scrape coverage applies</AlertTitle>
        <AlertDescription>
          Results include attended, active appearance rows only. An association without V2 appearance data will return no players.
        </AlertDescription>
      </Alert>

      {catalogueError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Player Explorer could not load</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{catalogueError}</span>
            <Button variant="outline" size="sm" onClick={() => void fetchCatalogue()}>Try again</Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {isSuperAdmin ? (
        <PlayerExplorerSavedSearches
          expression={filterExpression}
          disabled={catalogueLoading || searching}
          saveDialogOpen={saveDialogOpen}
          onSaveDialogOpenChange={setSaveDialogOpen}
          onLoad={(expression) => {
            setFilterExpression(expression);
            setSearchError(null);
            setHasRun(false);
            setResults([]);
            setMatchedAppearanceCount(0);
            setMatchedMatchCount(0);
            setResultSearch("");
            setPage(1);
          }}
        />
      ) : (
        <Alert>
          <Database className="h-4 w-4" />
          <AlertTitle>Manual scoped search</AlertTitle>
          <AlertDescription>
            Copy and CSV export are available. Saved recurring searches remain Super Admin-only for now.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" />Search filters</CardTitle>
          <CardDescription>
            Add optional scope and total filters, or use a sequence rule to prove one set of games happened before another.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {catalogueLoading || !catalogue ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20 w-full" />)}
            </div>
          ) : (
            <>
              <PlayerExplorerFilterBuilder
                expression={filterExpression}
                options={filterOptions}
                lockedFilters={lockedFilters}
                disabled={searching}
                onChange={(expression) => {
                  setFilterExpression(expression);
                  setSearchError(null);
                }}
              />

              <p className="text-sm text-muted-foreground">
                In an <strong>All conditions</strong> group, player totals are calculated inside that group&apos;s scope filters.
                Sequence rules use match date and time to confirm that the second division game happened afterwards.
              </p>

              {searchError ? (
                <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{searchError}</AlertDescription></Alert>
              ) : null}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={resetFilters} disabled={searching}>Reset filters</Button>
                <Button type="button" variant="outline" onClick={() => {
                  setFilterExpression(createPlayerExplorerMovementExample());
                  setSearchError(null);
                }} disabled={searching}>Use 7 then 1 example</Button>
                {isSuperAdmin ? (
                  <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(true)} disabled={searching || catalogueLoading}>
                    <BookmarkPlus className="mr-2 h-4 w-4" />Save filter
                  </Button>
                ) : null}
                <Button type="button" onClick={() => void runSearch()} disabled={searching || catalogueLoading}>
                  {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  {searching ? "Searching…" : "Run search"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {hasRun ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Players found</p><p className="text-2xl font-bold">{results.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Matches included</p><p className="text-2xl font-bold">{matchedMatchCount}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Appearances included</p><p className="text-2xl font-bold">{matchedAppearanceCount}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Identity issues</p><p className="text-2xl font-bold">{identityIssueCount}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <CardTitle>Players</CardTitle>
                <CardDescription>{filteredResults.length} result{filteredResults.length === 1 ? "" : "s"} shown after result search.</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <div className="relative min-w-0 sm:w-72">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={resultSearch} onChange={(event) => setResultSearch(event.target.value)} placeholder="Search player or team" className="pl-9" aria-label="Search Player Explorer results" />
                </div>
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value) as (typeof RESULT_PAGE_SIZES)[number])}>
                  <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{RESULT_PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size} rows</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => void copyResults()} disabled={filteredResults.length === 0}>
                  <ClipboardCopy className="mr-2 h-4 w-4" />Copy results
                </Button>
                <Button type="button" variant="outline" onClick={downloadResults} disabled={filteredResults.length === 0}>
                  <Download className="mr-2 h-4 w-4" />Download CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead aria-sort={ariaSort("displayName")}>
                        <Button type="button" variant="ghost" size="sm" className="-ml-3 h-8 px-3" onClick={() => updateSort("displayName")}>Player{sortIcon("displayName")}</Button>
                      </TableHead>
                      <TableHead aria-sort={ariaSort("identityStatus")}>
                        <Button type="button" variant="ghost" size="sm" className="-ml-3 h-8 px-3" onClick={() => updateSort("identityStatus")}>Identity{sortIcon("identityStatus")}</Button>
                      </TableHead>
                      <TableHead className="w-64 max-w-xs" aria-sort={ariaSort("teamNames")}>
                        <Button type="button" variant="ghost" size="sm" className="-ml-3 h-8 px-3" onClick={() => updateSort("teamNames")}>Teams{sortIcon("teamNames")}</Button>
                      </TableHead>
                      <TableHead className="text-right" aria-sort={ariaSort("gamesPlayed")}>
                        <Button type="button" variant="ghost" size="sm" className="-mr-3 ml-auto h-8 px-3" onClick={() => updateSort("gamesPlayed")}>Games{sortIcon("gamesPlayed")}</Button>
                      </TableHead>
                      <TableHead className="text-right" aria-sort={ariaSort("goals")}>
                        <Button type="button" variant="ghost" size="sm" className="-mr-3 ml-auto h-8 px-3" onClick={() => updateSort("goals")}>Goals{sortIcon("goals")}</Button>
                      </TableHead>
                      <TableHead className="text-right" aria-sort={ariaSort("greenCards")}>
                        <Button type="button" variant="ghost" size="sm" className="-mr-3 ml-auto h-8 px-3" onClick={() => updateSort("greenCards")}>Green{sortIcon("greenCards")}</Button>
                      </TableHead>
                      <TableHead className="text-right" aria-sort={ariaSort("yellowCards")}>
                        <Button type="button" variant="ghost" size="sm" className="-mr-3 ml-auto h-8 px-3" onClick={() => updateSort("yellowCards")}>Yellow{sortIcon("yellowCards")}</Button>
                      </TableHead>
                      <TableHead className="text-right" aria-sort={ariaSort("redCards")}>
                        <Button type="button" variant="ghost" size="sm" className="-mr-3 ml-auto h-8 px-3" onClick={() => updateSort("redCards")}>Red{sortIcon("redCards")}</Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleResults.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No players match these filters.</TableCell></TableRow>
                    ) : visibleResults.map((result) => {
                      const identity = identityStatusDetails[result.identityStatus];
                      return (
                        <TableRow key={result.revsportsPlayerId}>
                          <TableCell>
                            <p className="font-medium">{result.displayName}</p>
                            <p className="max-w-64 truncate text-xs text-muted-foreground" title={result.revsportsPlayerId}>RevSports: {result.revsportsPlayerId}</p>
                          </TableCell>
                          <TableCell><Badge variant={identity.variant}>{identity.label}</Badge></TableCell>
                          <TableCell className="w-64 max-w-xs"><span className="block truncate" title={result.teamNames.join(", ")}>{result.teamNames.join(", ") || "Unknown team"}</span></TableCell>
                          <TableCell className="text-right font-medium">{result.gamesPlayed}</TableCell>
                          <TableCell className="text-right">{result.goals}</TableCell>
                          <TableCell className="text-right">{result.greenCards}</TableCell>
                          <TableCell className="text-right">{result.yellowCards}</TableCell>
                          <TableCell className="text-right">{result.redCards}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  {filteredResults.length > 0 ? (
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3} className="font-semibold">Totals for {filteredResults.length} players</TableCell>
                        <TableCell className="text-right font-semibold">{resultTotals.gamesPlayed}</TableCell>
                        <TableCell className="text-right font-semibold">{resultTotals.goals}</TableCell>
                        <TableCell className="text-right font-semibold">{resultTotals.greenCards}</TableCell>
                        <TableCell className="text-right font-semibold">{resultTotals.yellowCards}</TableCell>
                        <TableCell className="text-right font-semibold">{resultTotals.redCards}</TableCell>
                      </TableRow>
                    </TableFooter>
                  ) : null}
                </Table>
              </div>

              <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>Page {currentPage} of {totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="mr-1 h-4 w-4" />Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>
                    Next<ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Ready to explore players</p>
            <p className="text-sm text-muted-foreground">Choose filters, then select Run search.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

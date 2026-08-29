import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, RefreshCw, Search, XCircle } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { supabase as originalSupabase } from "@/integrations/supabase/client";
import { SortableTableHead } from "@/components/admin/SortableTableHead";
import { nextSortState, stableSortRows, type SortState } from "@/lib/adminSorting";

const UNMATCHED_VALUE = "__none__";
const ALL_VALUE = "__all__";
const MAX_TARGET_OPTIONS = 80;
const MAX_CONTEXTUAL_TARGET_OPTIONS = 12;
const MAX_PROFILE_TARGET_OPTIONS = 20;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const NONE_VALUE = "__none__";

type EntityType = "competition" | "club" | "team" | "player" | "grade" | "venue" | "pitch";
type LinkStatus = "unmatched" | "matched" | "ignored" | "needs_review";
type PageSize = typeof PAGE_SIZE_OPTIONS[number];
type EntitySortKey = "scraped" | "context" | "match" | "status" | "last_seen";

interface EntityFilters {
  competition: string;
  grade: string;
  club: string;
  status: string;
}

const TARGET_TABLE_BY_ENTITY_TYPE: Record<EntityType, string> = {
  competition: "competitions",
  club: "clubs",
  team: "teams",
  player: "profiles",
  grade: "divisions",
  venue: "venues",
  pitch: "pitches",
};

interface ExternalEntity {
  id: string;
  entity_type: EntityType;
  external_id: string | null;
  external_name: string;
  association_name: string | null;
  competition_name: string | null;
  grade: string | null;
  club_name: string | null;
  team_name: string | null;
  source_url: string | null;
  raw_data: {
    venue_name?: string | null;
  } | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  status: string;
}

interface ExternalEntityLink {
  id: string;
  external_entity_id: string;
  target_table: string;
  target_id: string | null;
  status: LinkStatus;
}

interface TargetOption {
  id: string;
  label: string;
  helper: string;
  contexts?: TargetContext[];
  isPlaceholder?: boolean;
  externalId?: string | null;
}

interface TargetContext {
  associationName: string;
  clubName: string;
  teamName: string;
  divisionName: string;
  membershipType: string;
}

interface EntityConfig {
  label: string;
  entityType: EntityType;
  targetTable: string;
  targets: TargetOption[];
}

interface QueryError {
  message: string;
}

interface QueryResult<T> {
  data: T | null;
  error: QueryError | null;
}

interface SupabaseSelectBuilder {
  range(from: number, to: number): Promise<QueryResult<unknown[]>>;
}

interface SupabaseUpsertSelectBuilder {
  single(): Promise<QueryResult<ExternalEntityLink>>;
}

interface SupabaseUpsertBuilder {
  select(columns: string): SupabaseUpsertSelectBuilder;
}

interface SupabaseInsertSelectBuilder {
  single(): Promise<QueryResult<{ id: string }>>;
}

interface SupabaseInsertBuilder {
  select(columns: string): SupabaseInsertSelectBuilder;
  execute(): Promise<QueryResult<unknown[]>>;
}

interface SupabaseTableBuilder {
  select(columns: string): SupabaseSelectBuilder;
  upsert(row: Record<string, unknown>, options: { onConflict: string }): SupabaseUpsertBuilder;
  insert(row: Record<string, unknown> | Record<string, unknown>[]): SupabaseInsertBuilder;
}

interface SupabaseClientLike {
  from(tableName: string): SupabaseTableBuilder;
}

interface NamedRelation {
  name?: string | null;
}

interface ClubRow {
  id: string;
  name: string;
  association_id?: string | null;
  associations?: NamedRelation | null;
}

interface TeamRow {
  id: string;
  name: string;
  clubs?: NamedRelation & { association_id?: string | null; associations?: NamedRelation | null } | null;
  divisions?: (NamedRelation & { competition_id?: string | null; competitions?: NamedRelation | null }) | null;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  is_placeholder: boolean | null;
  revsports_player_id?: string | null;
}

interface MembershipTeamRow {
  name?: string | null;
  division?: string | null;
  clubs?: {
    name?: string | null;
    associations?: NamedRelation | null;
  } | null;
}

interface MembershipRow {
  user_id: string;
  membership_type: string;
  status: string;
  teams?: MembershipTeamRow | null;
}

interface DivisionRow {
  id: string;
  name: string;
  association_id?: string | null;
  competition_id?: string | null;
  associations?: NamedRelation | null;
  competitions?: NamedRelation | null;
}

interface VenueRow {
  id: string;
  name: string;
}

interface AssociationRow {
  id: string;
  name: string;
}

interface CompetitionRow {
  id: string;
  name: string;
  association_id: string | null;
  season_id: string | null;
  associations?: NamedRelation | null;
  seasons?: NamedRelation | null;
}

interface SeasonRow {
  id: string;
  name: string;
  association_id: string | null;
  year?: number | null;
}

interface AddNewForm {
  name: string;
  associationId: string;
  competitionId: string;
  seasonId: string;
  clubId: string;
  divisionId: string;
  venueId: string;
  firstName: string;
  lastName: string;
  gender: string;
  ageGroup: string;
}

interface PitchRow {
  id: string;
  name: string;
  venues?: NamedRelation | null;
}

const supabase = originalSupabase as unknown as SupabaseClientLike;

const getErrorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "Unknown error";
};

const getFunctionErrorMessage = async (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (body?.error) return String(body.error);
      } catch {
        // Fall through to the normal Supabase error message below.
      }
    }
  }

  return getErrorMessage(error) || fallback;
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const fetchAllRows = async (tableName: string, selectColumns: string) => {
  const pageSize = 1000;
  const rows: unknown[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectColumns)
      .range(from, from + pageSize - 1);

    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return { data: rows, error: null };
};

const getLinkKey = (entityId: string, targetTable: string) => `${entityId}|||${targetTable}`;

const getStatusVariant = (status: LinkStatus | string): BadgeProps["variant"] => {
  if (status === "matched") return "available";
  if (status === "ignored") return "secondary";
  if (status === "needs_review") return "pending";
  return "outline";
};

const DEFAULT_FILTERS: EntityFilters = {
  competition: ALL_VALUE,
  grade: ALL_VALUE,
  club: ALL_VALUE,
  status: "unmatched",
};
const REVIEW_FILTER_STORAGE_KEY = "sportstack.revsports-review.filters.v1";

const DEFAULT_ADD_NEW_FORM: AddNewForm = {
  name: "",
  associationId: NONE_VALUE,
  competitionId: NONE_VALUE,
  seasonId: NONE_VALUE,
  clubId: NONE_VALUE,
  divisionId: NONE_VALUE,
  venueId: NONE_VALUE,
  firstName: "",
  lastName: "",
  gender: NONE_VALUE,
  ageGroup: NONE_VALUE,
};

const buildFilterMap = <T,>(value: T): Record<EntityType, T> => ({
  competition: value,
  club: value,
  team: value,
  player: value,
  grade: value,
  venue: value,
  pitch: value,
});

const loadSavedReviewState = () => {
  try {
    return JSON.parse(sessionStorage.getItem(REVIEW_FILTER_STORAGE_KEY) || "{}") as {
      activeTab?: EntityType;
      searchTerm?: string;
      filtersByTab?: Partial<Record<EntityType, EntityFilters>>;
      rowsPerPageByTab?: Partial<Record<EntityType, PageSize>>;
    };
  } catch {
    return {};
  }
};

const normaliseMatchText = (value: string | null | undefined) =>
  (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const getBaseProfileName = (label: string) => label.split(" (")[0] || label;

const splitPersonName = (value: string | null | undefined) => {
  const parts = (value || "").replace(/\.$/, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
};

const guessGender = (grade: string | null | undefined) => {
  const value = normaliseMatchText(grade);
  if (value.includes("women") || value.includes("womens") || value.includes("girls")) return "Women";
  if (value.includes("men") || value.includes("boys") || value.includes("open") || value.includes("mixed")) return "Open";
  return NONE_VALUE;
};

const guessAgeGroup = (grade: string | null | undefined) => {
  const value = normaliseMatchText(grade);
  if (value.includes("under") || /\bu\d+\b/.test(value) || value.includes("junior")) return "Juniors";
  if (value.includes("master")) return "Masters";
  return "Seniors";
};

const getPlayerNameScore = (scrapedName: string | null | undefined, targetLabel: string) => {
  const scraped = normaliseMatchText(scrapedName);
  const target = normaliseMatchText(getBaseProfileName(targetLabel));
  if (!scraped || !target) return 0;
  if (scraped === target) return 300;
  if (target.includes(scraped) || scraped.includes(target)) return 220;

  const scrapedParts = scraped.split(" ");
  const targetParts = target.split(" ");
  const scrapedFirst = scrapedParts[0];
  const scrapedLast = scrapedParts[scrapedParts.length - 1];
  const targetFirst = targetParts[0];
  const targetLast = targetParts[targetParts.length - 1];

  if (
    scrapedFirst &&
    targetFirst &&
    scrapedLast &&
    targetLast &&
    scrapedFirst === targetFirst &&
    targetLast.startsWith(scrapedLast[0])
  ) {
    return 180;
  }

  return 0;
};

const textMatches = (left: string | null | undefined, right: string | null | undefined) => {
  const normalisedLeft = normaliseMatchText(left);
  const normalisedRight = normaliseMatchText(right);
  if (!normalisedLeft || !normalisedRight) return false;
  return normalisedLeft === normalisedRight ||
    normalisedLeft.includes(normalisedRight) ||
    normalisedRight.includes(normalisedLeft);
};

const normaliseDivisionText = (value: string | null | undefined) =>
  normaliseMatchText(value)
    .replace(/\bwomens\b/g, "women")
    .replace(/\bmens\b/g, "men")
    .replace(/\bu\s?(\d+)\b/g, "under $1")
    .replace(/\bboys\b/g, "open")
    .replace(/\bmixed\b/g, "open")
    .replace(/\bmen\b/g, "open");

const divisionMatches = (left: string | null | undefined, right: string | null | undefined) => {
  const normalisedLeft = normaliseDivisionText(left);
  const normalisedRight = normaliseDivisionText(right);
  if (!normalisedLeft || !normalisedRight) return false;
  return normalisedLeft === normalisedRight ||
    normalisedLeft.includes(normalisedRight) ||
    normalisedRight.includes(normalisedLeft);
};

const scoreTeamForEntity = (team: TargetOption, entity: ExternalEntity) => {
  let score = 0;
  if (textMatches(team.label, entity.team_name) || textMatches(team.label, entity.external_name)) score += 120;
  if (textMatches(team.helper, entity.club_name)) score += 90;
  if (divisionMatches(team.helper, entity.grade)) score += 90;
  if (textMatches(team.helper, entity.competition_name)) score += 50;
  if (textMatches(team.helper, entity.association_name)) score += 40;
  return score;
};

const getLikelyTeam = (entity: ExternalEntity, targetTeams: TargetOption[]) => {
  const ranked = targetTeams
    .map((team) => ({ team, score: scoreTeamForEntity(team, entity) }))
    .filter(({ score }) => score >= 180)
    .sort((a, b) => b.score - a.score || a.team.label.localeCompare(b.team.label));

  if (ranked.length === 0) return undefined;
  if (ranked[0].score > (ranked[1]?.score || 0)) return ranked[0].team;
  return undefined;
};

const getContextualEntityScore = (entity: ExternalEntity, target: TargetOption, targetTable: string) => {
  const targetLabel = getBaseProfileName(target.label);
  const targetHelper = target.helper;
  const targetText = `${targetLabel} ${targetHelper}`;

  if (targetTable === "teams") {
    const teamNameMatches = textMatches(entity.external_name, targetLabel) || textMatches(entity.team_name, targetLabel);
    const clubMatches = textMatches(entity.club_name, targetHelper);
    const gradeMatches = divisionMatches(entity.grade, targetHelper);
    const scrapedTeamIsClubName = textMatches(entity.external_name, entity.club_name) ||
      textMatches(entity.team_name, entity.club_name);

    if (!teamNameMatches && !(clubMatches && gradeMatches)) return null;

    let score = 0;
    if (teamNameMatches) score += 140;
    if (clubMatches) score += 90;
    if (gradeMatches) score += 70;
    if (scrapedTeamIsClubName && clubMatches && gradeMatches) score += 80;
    return score;
  }

  if (targetTable === "clubs") {
    if (!textMatches(entity.external_name, targetLabel) && !textMatches(entity.club_name, targetLabel)) return null;
    return 140 + (textMatches(entity.association_name, targetHelper) ? 30 : 0);
  }

  if (targetTable === "competitions") {
    if (!textMatches(entity.external_name, targetLabel) && !textMatches(entity.competition_name, targetLabel)) return null;
    return 140 + (textMatches(entity.association_name, targetHelper) ? 30 : 0);
  }

  if (targetTable === "divisions") {
    if (!divisionMatches(entity.external_name, targetLabel) && !divisionMatches(entity.grade, targetLabel)) return null;
    return 140 + (textMatches(entity.association_name, targetHelper) ? 30 : 0);
  }

  if (targetTable === "venues") {
    if (!textMatches(entity.external_name, targetLabel)) return null;
    return 140;
  }

  if (targetTable === "pitches") {
    if (!textMatches(entity.external_name, targetLabel)) return null;
    return 140 + (textMatches(entity.raw_data?.venue_name || "", targetHelper) ? 30 : 0);
  }

  return textMatches(entity.external_name, targetText) ? 100 : null;
};

const getCandidateTargets = (targets: TargetOption[], entity: ExternalEntity, currentValue: string, targetTable: string) => {
  const searchText = normaliseMatchText([
    entity.external_name,
    entity.competition_name,
    entity.club_name,
    entity.team_name,
    entity.grade,
  ].filter(Boolean).join(" "));

  const searchWords = new Set(searchText.split(" ").filter((word) => word.length > 1));

  const rankedTargets = targets
    .map((target) => {
      const targetText = normaliseMatchText(`${target.label} ${target.helper}`);
      let score = 0;
      const isCurrentSelection = currentValue === target.id;

      if (isCurrentSelection) score += 1000;

      if (targetTable === "profiles") {
        const playerNameScore = getPlayerNameScore(entity.external_name, target.label);
        if (!playerNameScore && !isCurrentSelection) {
          return { target, score: 0, include: false };
        }
        score += playerNameScore;
      }

      if (targetTable !== "profiles") {
        const contextualScore = getContextualEntityScore(entity, target, targetTable);
        if (contextualScore === null && !isCurrentSelection) {
          return { target, score: 0, include: false };
        }
        score += contextualScore || 0;
      }

      if (targetText === searchText) score += 100;
      if (targetText.includes(searchText) || searchText.includes(targetText)) score += 50;

      if (targetTable === "profiles" && target.contexts?.length) {
        target.contexts.forEach((context) => {
          if (normaliseMatchText(context.associationName) === normaliseMatchText(entity.association_name)) score += 20;
          if (normaliseMatchText(context.clubName) === normaliseMatchText(entity.club_name)) score += 80;
          if (normaliseMatchText(context.teamName) === normaliseMatchText(entity.team_name)) score += 60;
          if (normaliseMatchText(context.divisionName) === normaliseMatchText(entity.grade)) score += 35;
        });
      }

      if (targetTable === "profiles" && target.isPlaceholder) score += 5;

      searchWords.forEach((word) => {
        if (targetText.includes(word)) score += 5;
      });

      return { target, score, include: true };
    })
    .filter((item) => item.include && (item.score > 0 || currentValue === item.target.id))
    .sort((a, b) => b.score - a.score || a.target.label.localeCompare(b.target.label));

  const optionLimit = targetTable === "profiles"
    ? MAX_PROFILE_TARGET_OPTIONS
    : targetTable === "teams" || targetTable === "clubs" || targetTable === "divisions" || targetTable === "venues" || targetTable === "pitches"
      ? MAX_CONTEXTUAL_TARGET_OPTIONS
      : MAX_TARGET_OPTIONS;
  const candidates = rankedTargets.slice(0, optionLimit).map((item) => item.target);

  if (candidates.length === 0) {
    return targetTable === "profiles" ? [] : [];
  }

  return candidates;
};

export default function RevSportsEntityReview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { loading: scopeLoading, isSuperAdmin } = useAdminScope();

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const savedReviewState = useMemo(loadSavedReviewState, []);
  const [activeTab, setActiveTab] = useState<EntityType>(savedReviewState.activeTab || "team");
  const [searchTerm, setSearchTerm] = useState(savedReviewState.searchTerm || "");
  const [entities, setEntities] = useState<ExternalEntity[]>([]);
  const [links, setLinks] = useState<Record<string, ExternalEntityLink>>({});
  const [clubs, setClubs] = useState<TargetOption[]>([]);
  const [competitions, setCompetitions] = useState<TargetOption[]>([]);
  const [teams, setTeams] = useState<TargetOption[]>([]);
  const [profiles, setProfiles] = useState<TargetOption[]>([]);
  const [divisions, setDivisions] = useState<TargetOption[]>([]);
  const [venues, setVenues] = useState<TargetOption[]>([]);
  const [pitches, setPitches] = useState<TargetOption[]>([]);
  const [associationRows, setAssociationRows] = useState<AssociationRow[]>([]);
  const [competitionRows, setCompetitionRows] = useState<CompetitionRow[]>([]);
  const [seasonRows, setSeasonRows] = useState<SeasonRow[]>([]);
  const [clubRows, setClubRows] = useState<ClubRow[]>([]);
  const [divisionRows, setDivisionRows] = useState<DivisionRow[]>([]);
  const [venueRows, setVenueRows] = useState<VenueRow[]>([]);
  const [addNewEntity, setAddNewEntity] = useState<ExternalEntity | null>(null);
  const [addNewForm, setAddNewForm] = useState<AddNewForm>({ ...DEFAULT_ADD_NEW_FORM });
  const [creatingNew, setCreatingNew] = useState(false);
  const [filtersByTab, setFiltersByTab] = useState<Record<EntityType, EntityFilters>>(
    () => Object.fromEntries(Object.keys(buildFilterMap(DEFAULT_FILTERS)).map((key) => [key, { ...DEFAULT_FILTERS, ...savedReviewState.filtersByTab?.[key as EntityType] }])) as Record<EntityType, EntityFilters>
  );
  const [currentPageByTab, setCurrentPageByTab] = useState<Record<EntityType, number>>(
    () => buildFilterMap(1)
  );
  const [rowsPerPageByTab, setRowsPerPageByTab] = useState<Record<EntityType, PageSize>>(
    () => ({ ...buildFilterMap(25 as PageSize), ...savedReviewState.rowsPerPageByTab })
  );
  const [sortByTab, setSortByTab] = useState<Record<EntityType, SortState<EntitySortKey> | null>>(() => buildFilterMap(null));
  const [expandedTargetRows, setExpandedTargetRows] = useState<Set<string>>(() => new Set());

  const configs: Record<EntityType, EntityConfig> = useMemo(() => ({
    competition: { label: "Competitions", entityType: "competition", targetTable: "competitions", targets: competitions },
    club: { label: "Clubs", entityType: "club", targetTable: "clubs", targets: clubs },
    team: { label: "Teams", entityType: "team", targetTable: "teams", targets: teams },
    player: { label: "Players", entityType: "player", targetTable: "profiles", targets: profiles },
    grade: { label: "Divisions", entityType: "grade", targetTable: "divisions", targets: divisions },
    venue: { label: "Venues", entityType: "venue", targetTable: "venues", targets: venues },
    pitch: { label: "Pitches", entityType: "pitch", targetTable: "pitches", targets: pitches },
  }), [clubs, competitions, teams, profiles, divisions, venues, pitches]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        entitiesRes,
        linksRes,
        clubsRes,
        teamsRes,
        profilesRes,
        membershipsRes,
        divisionsRes,
        venuesRes,
        pitchesRes,
        associationsRes,
        competitionsRes,
        seasonsRes,
      ] = await Promise.all([
        fetchAllRows(
          "external_entities",
          "id, entity_type, external_id, external_name, association_name, competition_name, grade, club_name, team_name, source_url, raw_data, first_seen_at, last_seen_at, status"
        ),
        fetchAllRows("external_entity_links", "id, external_entity_id, target_table, target_id, status"),
        fetchAllRows("clubs", "id, name, association_id, associations(name)"),
        fetchAllRows("teams", "id, name, clubs(name, association_id, associations(name)), divisions(name, competition_id, competitions(name))"),
        fetchAllRows("profiles", "id, first_name, last_name, is_placeholder, revsports_player_id"),
        fetchAllRows(
          "team_memberships",
          "user_id, membership_type, status, teams(name, division, clubs(name, associations(name)))"
        ),
        fetchAllRows("divisions", "id, name, association_id, competition_id, associations(name), competitions(name)"),
        fetchAllRows("venues", "id, name"),
        fetchAllRows("pitches", "id, name, venues(name)"),
        fetchAllRows("associations", "id, name"),
        fetchAllRows("competitions", "id, name, association_id, season_id, associations(name), seasons(name)"),
        fetchAllRows("seasons", "id, name, association_id, year"),
      ]);

      const firstError = [
        entitiesRes.error,
        linksRes.error,
        clubsRes.error,
        teamsRes.error,
        profilesRes.error,
        membershipsRes.error,
        divisionsRes.error,
        venuesRes.error,
        pitchesRes.error,
        associationsRes.error,
        competitionsRes.error,
        seasonsRes.error,
      ].find(Boolean);

      if (firstError) throw firstError;

      setEntities(
        ((entitiesRes.data || []) as ExternalEntity[])
          .filter((entity) => Boolean(TARGET_TABLE_BY_ENTITY_TYPE[entity.entity_type]))
          .sort((a, b) =>
            a.entity_type.localeCompare(b.entity_type) ||
            (a.club_name || "").localeCompare(b.club_name || "") ||
            a.external_name.localeCompare(b.external_name)
          )
      );

      const nextLinks: Record<string, ExternalEntityLink> = {};
      ((linksRes.data || []) as ExternalEntityLink[]).forEach((link) => {
        nextLinks[getLinkKey(link.external_entity_id, link.target_table)] = link;
      });
      setLinks(nextLinks);

      setClubs(
        ((clubsRes.data || []) as ClubRow[]).map((club) => ({
          id: club.id,
          label: club.name,
          helper: club.associations?.name || "No association",
        }))
      );
      setClubRows((clubsRes.data || []) as ClubRow[]);
      setCompetitions(
        ((competitionsRes.data || []) as CompetitionRow[]).map((competition) => ({
          id: competition.id,
          label: competition.name,
          helper: [competition.associations?.name, competition.seasons?.name].filter(Boolean).join(" | ") || "No association or season",
        }))
      );
      setTeams(
        ((teamsRes.data || []) as TeamRow[]).map((team) => ({
          id: team.id,
          label: team.name,
          helper: [team.clubs?.name, team.divisions?.name, team.divisions?.competitions?.name, team.clubs?.associations?.name].filter(Boolean).join(" | ") || "No club, division, competition, or association",
        }))
      );

      const membershipsByProfileId = new Map<string, TargetContext[]>();
      ((membershipsRes.data || []) as MembershipRow[])
        .filter((membership) => membership.status === "ACTIVE")
        .forEach((membership) => {
          const team = membership.teams;
          const club = team?.clubs;
          const association = club?.associations;
          const context: TargetContext = {
            associationName: association?.name || "",
            clubName: club?.name || "",
            teamName: team?.name || "",
            divisionName: team?.division || "",
            membershipType: membership.membership_type,
          };

          const current = membershipsByProfileId.get(membership.user_id) || [];
          current.push(context);
          membershipsByProfileId.set(membership.user_id, current);
        });

      setProfiles(
        ((profilesRes.data || []) as ProfileRow[]).map((profile) => {
          const name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unnamed profile";
          const contexts = membershipsByProfileId.get(profile.id) || [];
          const helper = contexts.length
            ? contexts
                .slice(0, 2)
                .map((context) => [context.clubName, context.teamName, context.divisionName].filter(Boolean).join(" | "))
                .join("; ")
            : profile.is_placeholder
              ? "Placeholder profile"
              : "No active team";

          return {
            id: profile.id,
            label: profile.is_placeholder ? `${name} (placeholder)` : name,
            helper: profile.revsports_player_id ? `${helper} | RevSports ID: ${profile.revsports_player_id}` : helper,
            contexts,
            isPlaceholder: Boolean(profile.is_placeholder),
            externalId: profile.revsports_player_id || null,
          };
        })
      );
      setDivisions(
        ((divisionsRes.data || []) as DivisionRow[]).map((division) => ({
          id: division.id,
          label: division.name,
          helper: [division.associations?.name, division.competitions?.name].filter(Boolean).join(" | ") || "No association or competition",
        }))
      );
      setDivisionRows((divisionsRes.data || []) as DivisionRow[]);
      setVenues(
        ((venuesRes.data || []) as VenueRow[]).map((venue) => ({
          id: venue.id,
          label: venue.name,
          helper: "Venue",
        }))
      );
      setVenueRows((venuesRes.data || []) as VenueRow[]);
      setPitches(
        ((pitchesRes.data || []) as PitchRow[]).map((pitch) => ({
          id: pitch.id,
          label: pitch.name,
          helper: pitch.venues?.name || "No venue",
        }))
      );
      setAssociationRows((associationsRes.data || []) as AssociationRow[]);
      setCompetitionRows((competitionsRes.data || []) as CompetitionRow[]);
      setSeasonRows((seasonsRes.data || []) as SeasonRow[]);
    } catch (error: unknown) {
      toast({
        title: "Error loading RevSports review data",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!scopeLoading && !isSuperAdmin) {
      navigate("/dashboard");
    }
  }, [scopeLoading, isSuperAdmin, navigate]);

  useEffect(() => {
    if (!scopeLoading && isSuperAdmin) {
      loadData();
    }
  }, [scopeLoading, isSuperAdmin, loadData]);

  useEffect(() => {
    sessionStorage.setItem(REVIEW_FILTER_STORAGE_KEY, JSON.stringify({ activeTab, searchTerm, filtersByTab, rowsPerPageByTab }));
  }, [activeTab, filtersByTab, rowsPerPageByTab, searchTerm]);

  const tabEntities = useMemo(() => {
    const config = configs[activeTab];
    return entities.filter((entity) => entity.entity_type === config.entityType);
  }, [activeTab, configs, entities]);

  const filterOptions = useMemo(() => {
    const getUniqueValues = (field: keyof ExternalEntity) =>
      Array.from(new Set(tabEntities.map((entity) => entity[field]).filter(Boolean) as string[]))
        .sort((a, b) => a.localeCompare(b));

    return {
      competitions: getUniqueValues("competition_name"),
      grades: getUniqueValues("grade"),
      clubs: getUniqueValues("club_name"),
    };
  }, [tabEntities]);

  const filteredEntities = useMemo(() => {
    const config = configs[activeTab];
    const filters = filtersByTab[activeTab];
    const normalisedSearch = searchTerm.trim().toLowerCase();

    return tabEntities.filter((entity) => {
      if (entity.entity_type !== config.entityType) return false;

      const link = links[getLinkKey(entity.id, config.targetTable)];
      const status = link?.status || "unmatched";

      if (filters.status !== ALL_VALUE && status !== filters.status) return false;
      if (filters.competition !== ALL_VALUE && entity.competition_name !== filters.competition) return false;
      if (filters.grade !== ALL_VALUE && entity.grade !== filters.grade) return false;
      if (filters.club !== ALL_VALUE && entity.club_name !== filters.club) return false;

      if (!normalisedSearch) return true;

      return [
        entity.external_name,
        entity.external_id,
        entity.association_name,
        entity.grade,
        entity.club_name,
        entity.team_name,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalisedSearch));
    });
  }, [activeTab, configs, filtersByTab, links, searchTerm, tabEntities]);

  const sortedEntities = useMemo(() => {
    const sort = sortByTab[activeTab];
    if (!sort) return filteredEntities;
    const config = configs[activeTab];
    return stableSortRows(filteredEntities, sort, (entity, key) => {
      const link = links[getLinkKey(entity.id, config.targetTable)];
      if (key === "scraped") return entity.external_name;
      if (key === "context") return [entity.association_name, entity.competition_name, entity.grade, entity.club_name, entity.team_name].filter(Boolean).join(" | ");
      if (key === "match") return config.targets.find((target) => target.id === link?.target_id)?.label;
      if (key === "status") return link?.status || "unmatched";
      return entity.last_seen_at;
    });
  }, [activeTab, configs, filteredEntities, links, sortByTab]);
  const rowsPerPage = rowsPerPageByTab[activeTab];
  const currentPage = currentPageByTab[activeTab];
  const totalPages = Math.max(1, Math.ceil(sortedEntities.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * rowsPerPage;
  const pageEntities = sortedEntities.slice(pageStartIndex, pageStartIndex + rowsPerPage);

  useEffect(() => {
    setCurrentPageByTab((prev) => ({ ...prev, [activeTab]: 1 }));
  }, [activeTab, filtersByTab, rowsPerPageByTab, searchTerm]);

  const updateFilter = (key: keyof EntityFilters, value: string) => {
    setFiltersByTab((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [key]: value,
      },
    }));
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFiltersByTab((prev) => ({
      ...prev,
      [activeTab]: { ...DEFAULT_FILTERS },
    }));
  };

  const toggleExpandedTargets = (rowKey: string) => {
    setExpandedTargetRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  };

  const saveLink = async (entity: ExternalEntity, targetTable: string, targetId: string | null, status: LinkStatus) => {
    setSavingId(entity.id);
    try {
      const row = {
        external_entity_id: entity.id,
        target_table: targetTable,
        target_id: targetId,
        status,
        confidence: status === "matched" ? "manual" : "fallback",
        matched_by: user?.id || null,
        matched_at: status === "matched" ? new Date().toISOString() : null,
      };

      const { data, error } = await supabase
        .from("external_entity_links")
        .upsert(row, { onConflict: "external_entity_id,target_table" })
        .select("id, external_entity_id, target_table, target_id, status")
        .single();

      if (error) throw error;

      setLinks((prev) => ({
        ...prev,
        [getLinkKey(entity.id, targetTable)]: data,
      }));

      toast({
        title: status === "matched" ? "Link saved" : "Review status saved",
      });
    } catch (error: unknown) {
      toast({
        title: "Error saving link",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const openAddNewDialog = (entity: ExternalEntity) => {
    const association = associationRows.find((row) => textMatches(row.name, entity.association_name));
    const competition = competitionRows.find((row) =>
      textMatches(row.name, entity.competition_name) &&
      (!association || row.association_id === association.id)
    );
    const season = seasonRows.find((row) =>
      (!association || row.association_id === association.id) &&
      (
        (row.year && entity.competition_name?.includes(String(row.year))) ||
        textMatches(row.name, entity.competition_name)
      )
    );
    const club = clubRows.find((row) =>
      textMatches(row.name, entity.club_name) &&
      (!association || row.association_id === association.id)
    );
    const division = divisionRows.find((row) =>
      divisionMatches(row.name, entity.grade) &&
      (!association || row.association_id === association.id) &&
      (!competition || row.competition_id === competition.id)
    );
    const venue = venueRows.find((row) => textMatches(row.name, entity.raw_data?.venue_name || entity.external_name));
    const personName = splitPersonName(entity.external_name);
    const team = getLikelyTeam(entity, teams);

    setAddNewEntity(entity);
    setAddNewForm({
      ...DEFAULT_ADD_NEW_FORM,
      name: entity.entity_type === "player" ? entity.external_name : entity.team_name || entity.external_name,
      associationId: association?.id || NONE_VALUE,
      competitionId: competition?.id || NONE_VALUE,
      seasonId: competition?.season_id || season?.id || NONE_VALUE,
      clubId: club?.id || NONE_VALUE,
      divisionId: division?.id || NONE_VALUE,
      venueId: venue?.id || (entity.entity_type === "player" ? team?.id || NONE_VALUE : NONE_VALUE),
      firstName: personName.firstName,
      lastName: personName.lastName,
      gender: guessGender(entity.grade),
      ageGroup: guessAgeGroup(entity.grade),
    });
  };

  const createAndLinkNewRecord = async () => {
    if (!addNewEntity) return;

    const targetTable = TARGET_TABLE_BY_ENTITY_TYPE[addNewEntity.entity_type];
    if (!targetTable) return;

    setCreatingNew(true);
    try {
      let targetId = "";
      const cleanName = addNewForm.name.trim();

      if (addNewEntity.entity_type === "club") {
        if (!cleanName || addNewForm.associationId === NONE_VALUE) {
          throw new Error("Club name and association are required.");
        }
        const { data, error } = await supabase
          .from("clubs")
          .insert({ name: cleanName, association_id: addNewForm.associationId })
          .select("id")
          .single();
        if (error) throw error;
        targetId = data.id;
      }

      if (addNewEntity.entity_type === "competition") {
        if (!cleanName || addNewForm.associationId === NONE_VALUE || addNewForm.seasonId === NONE_VALUE) {
          throw new Error("Competition name, association, and season are required.");
        }
        const { data, error } = await supabase
          .from("competitions")
          .insert({
            name: cleanName,
            association_id: addNewForm.associationId,
            season_id: addNewForm.seasonId,
          })
          .select("id")
          .single();
        if (error) throw error;
        targetId = data.id;
      }

      if (addNewEntity.entity_type === "team") {
        if (
          !cleanName ||
          addNewForm.associationId === NONE_VALUE ||
          addNewForm.competitionId === NONE_VALUE ||
          addNewForm.clubId === NONE_VALUE ||
          addNewForm.divisionId === NONE_VALUE
        ) {
          throw new Error("Team name, association, competition, club, and division are required.");
        }
        const division = divisionRows.find((row) => row.id === addNewForm.divisionId);
        const { data, error } = await supabase
          .from("teams")
          .insert({
            name: cleanName,
            club_id: addNewForm.clubId,
            division_id: addNewForm.divisionId,
            division: division?.name || null,
            gender: addNewForm.gender === NONE_VALUE ? null : addNewForm.gender,
            age_group: addNewForm.ageGroup === NONE_VALUE ? null : addNewForm.ageGroup,
          })
          .select("id")
          .single();
        if (error) throw error;
        targetId = data.id;
      }

      if (addNewEntity.entity_type === "player") {
        if (!addNewForm.firstName.trim() || !addNewForm.lastName.trim() || addNewForm.venueId === NONE_VALUE) {
          throw new Error("First name, last name, and team are required.");
        }
        const { data, error } = await originalSupabase.functions.invoke("create-revsports-placeholder-player", {
          body: {
            external_entity_id: addNewEntity.id,
            revsports_player_id: addNewEntity.external_id || null,
            first_name: addNewForm.firstName.trim(),
            last_name: addNewForm.lastName.trim(),
            gender: addNewForm.gender === NONE_VALUE ? null : addNewForm.gender,
            team_id: addNewForm.venueId,
          },
        });
        if (error) {
          throw new Error(await getFunctionErrorMessage(error, "Could not create placeholder player."));
        }
        if (data?.error) {
          throw new Error(data.error);
        }
        targetId = data.profile_id;
      }

      if (addNewEntity.entity_type === "grade") {
        if (!cleanName || addNewForm.associationId === NONE_VALUE || addNewForm.competitionId === NONE_VALUE) {
          throw new Error("Division name, association, and competition are required.");
        }
        const competition = competitionRows.find((row) => row.id === addNewForm.competitionId);
        const { data, error } = await supabase
          .from("divisions")
          .insert({
            name: cleanName,
            association_id: addNewForm.associationId,
            competition_id: addNewForm.competitionId,
            season_id: competition?.season_id || null,
            gender: addNewForm.gender === NONE_VALUE ? null : addNewForm.gender,
            age_group: addNewForm.ageGroup === NONE_VALUE ? null : addNewForm.ageGroup,
          })
          .select("id")
          .single();
        if (error) throw error;
        targetId = data.id;
      }

      if (addNewEntity.entity_type === "venue") {
        if (!cleanName) {
          throw new Error("Venue name is required.");
        }
        const { data, error } = await supabase
          .from("venues")
          .insert({
            name: cleanName,
            association_id: addNewForm.associationId === NONE_VALUE ? null : addNewForm.associationId,
          })
          .select("id")
          .single();
        if (error) throw error;
        targetId = data.id;
      }

      if (addNewEntity.entity_type === "pitch") {
        if (!cleanName || addNewForm.venueId === NONE_VALUE) {
          throw new Error("Pitch name and venue are required.");
        }
        const { data, error } = await supabase
          .from("pitches")
          .insert({ name: cleanName, venue_id: addNewForm.venueId })
          .select("id")
          .single();
        if (error) throw error;
        targetId = data.id;
      }

      if (!targetId) throw new Error("Could not create a target record.");

      if (addNewEntity.entity_type !== "player") {
        await saveLink(addNewEntity, targetTable, targetId, "matched");
      }
      toast({ title: "Created and linked" });
      setAddNewEntity(null);
      setAddNewForm({ ...DEFAULT_ADD_NEW_FORM });
      await loadData();
    } catch (error: unknown) {
      toast({
        title: "Error creating record",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setCreatingNew(false);
    }
  };

  const renderEntityContext = (entity: ExternalEntity) => (
    <div className="space-y-1 text-xs text-muted-foreground">
      <div>{[entity.association_name, entity.competition_name, entity.grade].filter(Boolean).join(" | ") || "-"}</div>
      <div>{[entity.club_name, entity.team_name].filter(Boolean).join(" | ") || "-"}</div>
      {entity.external_id && <div className="font-mono">External ID: {entity.external_id}</div>}
    </div>
  );

  const availableCompetitions = competitionRows
    .filter((competition) => addNewForm.associationId === NONE_VALUE || competition.association_id === addNewForm.associationId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const availableSeasons = seasonRows
    .filter((season) => addNewForm.associationId === NONE_VALUE || season.association_id === addNewForm.associationId)
    .sort((a, b) => (b.year || 0) - (a.year || 0) || a.name.localeCompare(b.name));

  const availableClubs = clubRows
    .filter((club) => addNewForm.associationId === NONE_VALUE || club.association_id === addNewForm.associationId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const availableDivisions = divisionRows
    .filter((division) => addNewForm.associationId === NONE_VALUE || division.association_id === addNewForm.associationId)
    .filter((division) => addNewForm.competitionId === NONE_VALUE || division.competition_id === addNewForm.competitionId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const renderAddNewDialog = () => {
    if (!addNewEntity) return null;

    const titleByType: Record<EntityType, string> = {
      competition: "Add Competition",
      club: "Add Club",
      team: "Add Team",
      player: "Add Placeholder Player",
      grade: "Add Division",
      venue: "Add Venue",
      pitch: "Add Pitch",
    };
    const playerTeamOptions = addNewEntity.entity_type === "player"
      ? teams
          .map((team) => ({ team, score: scoreTeamForEntity(team, addNewEntity) }))
          .filter(({ score, team }) => score > 0 || team.id === addNewForm.venueId)
          .sort((a, b) => b.score - a.score || a.team.label.localeCompare(b.team.label))
          .map(({ team }) => team)
      : [];
    const visiblePlayerTeamOptions = playerTeamOptions.length ? playerTeamOptions : teams;

    return (
      <Dialog open={Boolean(addNewEntity)} onOpenChange={(open) => !open && setAddNewEntity(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{titleByType[addNewEntity.entity_type]}</DialogTitle>
            <DialogDescription>
              Create a SportStack record from this scraped RevSports item, then link it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{addNewEntity.external_name}</div>
              <div className="mt-1 text-muted-foreground">
                {[addNewEntity.association_name, addNewEntity.competition_name, addNewEntity.grade].filter(Boolean).join(" | ") || "-"}
              </div>
              <div className="text-muted-foreground">
                {[addNewEntity.club_name, addNewEntity.team_name].filter(Boolean).join(" | ") || "-"}
              </div>
              {addNewEntity.external_id && (
                <div className="font-mono text-xs text-muted-foreground">External ID: {addNewEntity.external_id}</div>
              )}
            </div>

            {addNewEntity.entity_type !== "pitch" && addNewEntity.entity_type !== "player" && (
              <div className="space-y-2">
                <Label>Association</Label>
                <Select
                  value={addNewForm.associationId}
                  onValueChange={(value) =>
                    setAddNewForm((prev) => ({
                      ...prev,
                      associationId: value,
                      competitionId: NONE_VALUE,
                      seasonId: NONE_VALUE,
                      clubId: NONE_VALUE,
                      divisionId: NONE_VALUE,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select association" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Select association</SelectItem>
                    {associationRows.map((association) => (
                      <SelectItem key={association.id} value={association.id}>
                        {association.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {addNewEntity.entity_type === "competition" && (
              <div className="space-y-2">
                <Label>Season</Label>
                <Select
                  value={addNewForm.seasonId}
                  onValueChange={(value) => setAddNewForm((prev) => ({ ...prev, seasonId: value }))}
                  disabled={addNewForm.associationId === NONE_VALUE}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select season" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Select season</SelectItem>
                    {availableSeasons.map((season) => (
                      <SelectItem key={season.id} value={season.id}>
                        {season.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(addNewEntity.entity_type === "team" || addNewEntity.entity_type === "grade") && (
              <div className="space-y-2">
                <Label>Competition</Label>
                <Select
                  value={addNewForm.competitionId}
                  onValueChange={(value) => setAddNewForm((prev) => ({ ...prev, competitionId: value, divisionId: NONE_VALUE }))}
                  disabled={addNewForm.associationId === NONE_VALUE}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select competition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Select competition</SelectItem>
                    {availableCompetitions.map((competition) => (
                      <SelectItem key={competition.id} value={competition.id}>
                        {competition.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {addNewEntity.entity_type === "team" && (
              <>
                <div className="space-y-2">
                  <Label>Club</Label>
                  <Select
                    value={addNewForm.clubId}
                    onValueChange={(value) => setAddNewForm((prev) => ({ ...prev, clubId: value }))}
                    disabled={addNewForm.associationId === NONE_VALUE}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select club" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Select club</SelectItem>
                      {availableClubs.map((club) => (
                        <SelectItem key={club.id} value={club.id}>
                          {club.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Division</Label>
                  <Select
                    value={addNewForm.divisionId}
                    onValueChange={(value) => setAddNewForm((prev) => ({ ...prev, divisionId: value }))}
                    disabled={addNewForm.competitionId === NONE_VALUE}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select division" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Select division</SelectItem>
                      {availableDivisions.map((division) => (
                        <SelectItem key={division.id} value={division.id}>
                          {division.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {addNewEntity.entity_type === "pitch" && (
              <div className="space-y-2">
                <Label>Venue</Label>
                <Select
                  value={addNewForm.venueId}
                  onValueChange={(value) => setAddNewForm((prev) => ({ ...prev, venueId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select venue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Select venue</SelectItem>
                    {venueRows.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        {venue.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {addNewEntity.entity_type === "player" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>First name</Label>
                    <Input
                      value={addNewForm.firstName}
                      onChange={(event) => setAddNewForm((prev) => ({ ...prev, firstName: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last name</Label>
                    <Input
                      value={addNewForm.lastName}
                      onChange={(event) => setAddNewForm((prev) => ({ ...prev, lastName: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Add to team</Label>
                  <Select
                    value={addNewForm.venueId}
                    onValueChange={(value) => setAddNewForm((prev) => ({ ...prev, venueId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Select team</SelectItem>
                      {visiblePlayerTeamOptions.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.label} ({team.helper})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={addNewForm.name}
                  onChange={(event) => setAddNewForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
            )}

            {(addNewEntity.entity_type === "team" || addNewEntity.entity_type === "grade" || addNewEntity.entity_type === "player") && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    value={addNewForm.gender}
                    onValueChange={(value) => setAddNewForm((prev) => ({ ...prev, gender: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="Women">Women</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {addNewEntity.entity_type !== "player" && (
                  <div className="space-y-2">
                    <Label>Age group</Label>
                    <Select
                      value={addNewForm.ageGroup}
                      onValueChange={(value) => setAddNewForm((prev) => ({ ...prev, ageGroup: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select age group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>None</SelectItem>
                        <SelectItem value="Juniors">Juniors</SelectItem>
                        <SelectItem value="Seniors">Seniors</SelectItem>
                        <SelectItem value="Masters">Masters</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNewEntity(null)} disabled={creatingNew}>
              Cancel
            </Button>
            <Button onClick={createAndLinkNewRecord} disabled={creatingNew}>
              {creatingNew ? "Creating..." : "Create and link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const renderReviewTable = (config: EntityConfig) => (
    <Card>
      <CardHeader>
        <div className="space-y-4">
          <div>
            <CardTitle>{config.label}</CardTitle>
            <CardDescription>
              Showing {pageEntities.length} of {filteredEntities.length} scraped item{filteredEntities.length === 1 ? "" : "s"}
            </CardDescription>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search"
                className="pl-8"
              />
            </div>
            <Select value={filtersByTab[activeTab].status} onValueChange={(value) => updateFilter("status", value)}>
              <SelectTrigger className="w-full min-w-0 overflow-hidden">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                <SelectItem value="unmatched">Unmatched</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
                <SelectItem value="needs_review">Needs review</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtersByTab[activeTab].competition} onValueChange={(value) => updateFilter("competition", value)}>
              <SelectTrigger className="w-full min-w-0 overflow-hidden">
                <SelectValue placeholder="Competition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All competitions</SelectItem>
                {filterOptions.competitions.map((competition) => (
                  <SelectItem key={competition} value={competition}>
                    {competition}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtersByTab[activeTab].grade} onValueChange={(value) => updateFilter("grade", value)}>
              <SelectTrigger className="w-full min-w-0 overflow-hidden">
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All divisions</SelectItem>
                {filterOptions.grades.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtersByTab[activeTab].club} onValueChange={(value) => updateFilter("club", value)}>
              <SelectTrigger className="w-full min-w-0 overflow-hidden">
                <SelectValue placeholder="Club" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All clubs</SelectItem>
                {filterOptions.clubs.map((club) => (
                  <SelectItem key={club} value={club}>
                    {club}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(value) =>
                setRowsPerPageByTab((prev) => ({ ...prev, [activeTab]: Number(value) as PageSize }))
              }
            >
              <SelectTrigger className="w-full min-w-0 overflow-hidden">
                <SelectValue placeholder="Rows" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" onClick={clearFilters} className="flex-1">
                Clear
              </Button>
              <Button variant="outline" onClick={loadData} className="flex-1 gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Scraped Item" sortKey="scraped" sort={sortByTab[activeTab]} onSort={(key) => setSortByTab((current) => ({ ...current, [activeTab]: nextSortState(current[activeTab], key) }))} />
                <SortableTableHead label="Context" sortKey="context" sort={sortByTab[activeTab]} onSort={(key) => setSortByTab((current) => ({ ...current, [activeTab]: nextSortState(current[activeTab], key) }))} />
                <SortableTableHead label="SportStack Match" sortKey="match" sort={sortByTab[activeTab]} onSort={(key) => setSortByTab((current) => ({ ...current, [activeTab]: nextSortState(current[activeTab], key) }))} className="w-64 max-w-xs" />
                <SortableTableHead label="Status" sortKey="status" sort={sortByTab[activeTab]} onSort={(key) => setSortByTab((current) => ({ ...current, [activeTab]: nextSortState(current[activeTab], key) }))} />
                <SortableTableHead label="Last Seen" sortKey="last_seen" sort={sortByTab[activeTab]} onSort={(key) => setSortByTab((current) => ({ ...current, [activeTab]: nextSortState(current[activeTab], key) }))} />
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageEntities.map((entity) => {
                const link = links[getLinkKey(entity.id, config.targetTable)];
                const currentValue = link?.target_id || UNMATCHED_VALUE;
                const rowTargetKey = getLinkKey(entity.id, config.targetTable);
                const isShowingAllTargets = expandedTargetRows.has(rowTargetKey);
                const likelyTargets = getCandidateTargets(config.targets, entity, currentValue, config.targetTable);
                const candidateTargets = isShowingAllTargets
                  ? [...config.targets].sort((a, b) => a.label.localeCompare(b.label) || a.helper.localeCompare(b.helper))
                  : likelyTargets;

                return (
                  <TableRow key={entity.id}>
                    <TableCell>
                      <div className="font-medium">{entity.external_name}</div>
                      {entity.source_url && (
                        <Link className="text-xs text-primary underline" to={entity.source_url} target="_blank">
                          Source
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>{renderEntityContext(entity)}</TableCell>
                    <TableCell className="w-64 max-w-xs">
                      <div className="space-y-2">
                        <Select
                          value={currentValue}
                          onValueChange={(value) =>
                            saveLink(
                              entity,
                              config.targetTable,
                              value === UNMATCHED_VALUE ? null : value,
                              value === UNMATCHED_VALUE ? "unmatched" : "matched"
                            )
                          }
                          disabled={savingId === entity.id}
                        >
                          <SelectTrigger className="w-full min-w-0 overflow-hidden">
                            <SelectValue placeholder="Select match" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNMATCHED_VALUE}>No match yet</SelectItem>
                            {candidateTargets.map((target) => (
                              <SelectItem key={target.id} value={target.id}>
                                {target.label} ({target.helper})
                              </SelectItem>
                            ))}
                            {candidateTargets.length === 0 && (
                              <SelectItem value="__no_likely_match__" disabled>
                                {config.targetTable === "profiles" ? "No likely name match" : "No likely match"}
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpandedTargets(rowTargetKey)}
                          className="h-7 px-2 text-xs"
                        >
                          {isShowingAllTargets ? "Show likely matches" : "Search all matches"}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(link?.status || "unmatched")}>
                        {link?.status || "unmatched"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(entity.last_seen_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {link?.status === "matched" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => saveLink(entity, config.targetTable, null, "unmatched")}
                          disabled={savingId === entity.id}
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Clear
                        </Button>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAddNewDialog(entity)}
                            disabled={savingId === entity.id}
                          >
                            Add new
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => saveLink(entity, config.targetTable, null, "ignored")}
                            disabled={savingId === entity.id}
                            className="gap-2"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Ignore
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredEntities.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No scraped items match this view.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {filteredEntities.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {safeCurrentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPageByTab((prev) => ({ ...prev, [activeTab]: safeCurrentPage - 1 }))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPageByTab((prev) => ({ ...prev, [activeTab]: safeCurrentPage + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (scopeLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <Skeleton className="h-[480px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RevSports Mapping Review</h1>
          <p className="text-muted-foreground">
            Match scraped RevSports competitions, clubs, teams, players, divisions, venues, and pitches to SportStack records.
          </p>
        </div>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="py-4">
          <CardTitle className="text-base">Current RevSports mapping page</CardTitle>
          <CardDescription>
            Fixture imports use these mappings. Competition mappings also supply the season; player mappings are optional and do not block fixtures or results.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EntityType)}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          {(Object.keys(configs) as EntityType[]).map((type) => (
            <TabsTrigger key={type} value={type}>
              {configs[type].label}
            </TabsTrigger>
          ))}
        </TabsList>
        {(Object.keys(configs) as EntityType[]).map((type) => (
          <TabsContent key={type} value={type}>
            {renderReviewTable(configs[type])}
          </TabsContent>
        ))}
      </Tabs>
      {renderAddNewDialog()}
    </div>
  );
}

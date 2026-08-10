/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase Edge Function responses are runtime-validated before use. */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type VoteSchemeKey = "classic_3_2_1" | "junior_2_1_split";

interface VoteSchemeLine {
  key: string;
  label: string;
  points: number;
}

interface FixtureContext {
  associationId: string;
  associationName: string;
  fixture: Record<string, any>;
  division: Record<string, any>;
  homeTeam: Record<string, any>;
  awayTeam: Record<string, any>;
  schemeKey: VoteSchemeKey;
  schemeLines: VoteSchemeLine[];
}

class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

const LOCAL_TURNSTILE_SECRET = "1x0000000000000000000000000000000AA";
const DEV_PROJECT_REF = "icqegnpjbizccjebjfhb";
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "https://dev.sportstackapp.com.au",
  "https://main.sportstackapp.com.au",
  "https://sportstack.grampianshockey.com.au",
  "https://hb.sportstackapp.com.au",
  "https://sportstackapp.com.au",
  "https://www.sportstackapp.com.au",
];

const voteSchemes: Record<VoteSchemeKey, VoteSchemeLine[]> = {
  classic_3_2_1: [
    { key: "best", label: "Best on Ground", points: 3 },
    { key: "second", label: "Second Best", points: 2 },
    { key: "third", label: "Third Best", points: 1 },
  ],
  junior_2_1_split: [
    { key: "best_male", label: "Best Male", points: 2 },
    { key: "second_male", label: "Second Male", points: 1 },
    { key: "best_female", label: "Best Female", points: 2 },
    { key: "second_female", label: "Second Female", points: 1 },
  ],
};

const getAllowedOrigins = () => {
  const configured = (Deno.env.get("PUBLIC_UMPIRE_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
};

const corsHeadersFor = (req: Request) => {
  const origin = req.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins();
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : null;
  return {
    "Access-Control-Allow-Origin": allowedOrigin || "null",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

const jsonResponse = (req: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });

const normaliseText = (value: unknown, maxLength: number) =>
  typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";

const normaliseNameKey = (value: string) =>
  value.toLocaleLowerCase("en-AU").replace(/[^a-z0-9]+/g, " ").trim();

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const chunksOf = <T>(values: T[], size = 100) => {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const getRequestIp = (req: Request) =>
  req.headers.get("cf-connecting-ip") ||
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "unknown";

const isJuniorDivision = (divisionName: string, ageGroup: string | null) => {
  const value = `${divisionName} ${ageGroup || ""}`.toLowerCase();
  return (
    value.includes("junior") ||
    value.includes("youth") ||
    value.includes("under") ||
    /(^|\s)u\d{1,2}(\s|$)/.test(value)
  );
};

const getScheme = (divisionName: string, ageGroup: string | null) => {
  const key: VoteSchemeKey = isJuniorDivision(divisionName, ageGroup)
    ? "junior_2_1_split"
    : "classic_3_2_1";
  return { key, lines: voteSchemes[key] };
};

const fixtureIsEligible = (fixture: Record<string, any>) => {
  if (["CANCELLED", "POSTPONED"].includes(String(fixture.status || "").toUpperCase())) {
    return false;
  }

  if (String(fixture.status || "").toUpperCase() === "COMPLETED") return true;

  const eligibleAt = fixture.scheduled_end_at || fixture.fixture_date;
  return Boolean(eligibleAt) && new Date(eligibleAt).getTime() <= Date.now();
};

const resolveAssociation = async (serviceClient: any) => {
  const configuredId = normaliseText(Deno.env.get("PUBLIC_UMPIRE_ASSOCIATION_ID"), 36);
  let query = serviceClient.from("associations").select("id, name");
  query = configuredId
    ? query.eq("id", configuredId)
    : query.ilike("name", "Hockey Ballarat");
  const { data, error } = await query.limit(2);
  if (error) throw error;
  if (!data || data.length !== 1) {
    throw new Error("Hockey Ballarat could not be resolved uniquely.");
  }
  return data[0] as { id: string; name: string };
};

const loadAssociationStructure = async (serviceClient: any, associationId: string) => {
  const { data: clubs, error: clubsError } = await serviceClient
    .from("clubs")
    .select("id, name, association_id")
    .eq("association_id", associationId);
  if (clubsError) throw clubsError;

  const clubIds = (clubs || []).map((club: any) => club.id);
  if (clubIds.length === 0) return { clubs: [], teams: [] };

  const { data: teams, error: teamsError } = await serviceClient
    .from("teams")
    .select("id, name, club_id, division_id")
    .in("club_id", clubIds);
  if (teamsError) throw teamsError;
  return { clubs: clubs || [], teams: teams || [] };
};

const loadModuleEnabledFixtureIds = async (
  serviceClient: any,
  fixtureIds: string[],
) => {
  const enabledFixtureIds = new Set<string>();
  for (const ids of chunksOf(Array.from(new Set(fixtureIds)), 500)) {
    if (ids.length === 0) continue;
    const { data, error } = await serviceClient.rpc(
      "umpire_match_voting_enabled_fixture_ids",
      { p_fixture_ids: ids },
    );
    if (error) throw error;
    for (const row of data || []) {
      if (isUuid(row?.fixture_id)) enabledFixtureIds.add(row.fixture_id);
    }
  }
  return enabledFixtureIds;
};

const loadFixtureContext = async (
  serviceClient: any,
  association: { id: string; name: string },
  fixtureId: string,
): Promise<FixtureContext> => {
  const { data: fixture, error: fixtureError } = await serviceClient
    .from("fixtures")
    .select(
      "id, home_team_id, away_team_id, division_id, round_number, round_name, fixture_date, scheduled_end_at, status",
    )
    .eq("id", fixtureId)
    .maybeSingle();
  if (fixtureError) throw fixtureError;
  if (!fixture?.away_team_id) throw new Error("The selected fixture could not be found.");

  const { data: fixtureTeams, error: teamsError } = await serviceClient
    .from("teams")
    .select("id, name, club_id, division_id")
    .in("id", [fixture.home_team_id, fixture.away_team_id]);
  if (teamsError) throw teamsError;
  if (!fixtureTeams || fixtureTeams.length !== 2) throw new Error("The fixture teams could not be resolved.");

  const homeTeam = fixtureTeams.find((team: any) => team.id === fixture.home_team_id);
  const awayTeam = fixtureTeams.find((team: any) => team.id === fixture.away_team_id);
  if (!homeTeam || !awayTeam) throw new Error("The fixture teams could not be resolved.");

  const { data: clubs, error: clubsError } = await serviceClient
    .from("clubs")
    .select("id, association_id")
    .in("id", [homeTeam.club_id, awayTeam.club_id]);
  if (clubsError) throw clubsError;
  if (
    !clubs ||
    clubs.length === 0 ||
    clubs.some((club: any) => club.association_id !== association.id)
  ) {
    throw new Error("The selected fixture does not belong to Hockey Ballarat.");
  }

  const divisionId = fixture.division_id || homeTeam.division_id || awayTeam.division_id;
  if (!divisionId) throw new Error("The selected fixture has no division.");

  const { data: division, error: divisionError } = await serviceClient
    .from("divisions")
    .select("id, name, association_id, age_group")
    .eq("id", divisionId)
    .maybeSingle();
  if (divisionError) throw divisionError;
  if (!division || division.association_id !== association.id) {
    throw new Error("The selected fixture division is not available.");
  }
  if (!fixtureIsEligible(fixture)) {
    throw new Error("Votes are not open for this fixture yet.");
  }
  const moduleEnabledFixtureIds = await loadModuleEnabledFixtureIds(
    serviceClient,
    [fixture.id],
  );
  if (!moduleEnabledFixtureIds.has(fixture.id)) {
    throw new RequestError("Umpire Match Voting is turned off for this fixture.", 403);
  }

  const scheme = getScheme(division.name, division.age_group);
  return {
    associationId: association.id,
    associationName: association.name,
    fixture: { ...fixture, division_id: division.id },
    division,
    homeTeam,
    awayTeam,
    schemeKey: scheme.key,
    schemeLines: scheme.lines,
  };
};

const loadMatchOptions = async (serviceClient: any, association: { id: string; name: string }) => {
  const { teams } = await loadAssociationStructure(serviceClient, association.id);
  const teamIds = teams.map((team: any) => team.id);
  if (teamIds.length === 0) return [];

  const [homeResult, awayResult] = await Promise.all([
    serviceClient
      .from("fixtures")
      .select(
        "id, home_team_id, away_team_id, division_id, round_number, round_name, fixture_date, scheduled_end_at, status",
      )
      .in("home_team_id", teamIds),
    serviceClient
      .from("fixtures")
      .select(
        "id, home_team_id, away_team_id, division_id, round_number, round_name, fixture_date, scheduled_end_at, status",
      )
      .in("away_team_id", teamIds),
  ]);
  if (homeResult.error) throw homeResult.error;
  if (awayResult.error) throw awayResult.error;

  const fixtureMap = new Map<string, Record<string, any>>();
  [...(homeResult.data || []), ...(awayResult.data || [])].forEach((fixture: any) => {
    fixtureMap.set(fixture.id, fixture);
  });
  const teamMap = new Map(teams.map((team: any) => [team.id, team]));
  const eligibleFixtures = Array.from(fixtureMap.values()).filter(
    (fixture) =>
      fixture.away_team_id &&
      teamMap.has(fixture.home_team_id) &&
      teamMap.has(fixture.away_team_id) &&
      fixture.round_number !== null &&
      fixtureIsEligible(fixture),
  );

  const divisionIds = Array.from(
    new Set(
      eligibleFixtures
        .map(
          (fixture) =>
            fixture.division_id ||
            teamMap.get(fixture.home_team_id)?.division_id ||
            teamMap.get(fixture.away_team_id)?.division_id,
        )
        .filter(Boolean),
    ),
  );
  const divisionRows: any[] = [];
  for (const ids of chunksOf(divisionIds)) {
    const { data, error } = await serviceClient
      .from("divisions")
      .select("id, name, association_id, age_group")
      .in("id", ids)
      .eq("association_id", association.id);
    if (error) throw error;
    divisionRows.push(...(data || []));
  }
  const divisionMap = new Map(divisionRows.map((division) => [division.id, division]));
  const moduleEnabledFixtureIds = await loadModuleEnabledFixtureIds(
    serviceClient,
    eligibleFixtures.map((fixture) => fixture.id),
  );

  const options: Record<string, unknown>[] = [];
  for (const fixture of eligibleFixtures) {
    const homeTeam = teamMap.get(fixture.home_team_id);
    const awayTeam = teamMap.get(fixture.away_team_id);
    const divisionId = fixture.division_id || homeTeam?.division_id || awayTeam?.division_id;
    const division = divisionMap.get(divisionId);
    if (!homeTeam || !awayTeam || !division) continue;
    if (!moduleEnabledFixtureIds.has(fixture.id)) continue;
    const scheme = getScheme(division.name, division.age_group);
    options.push({
      id: fixture.id,
      roundNumber: fixture.round_number,
      roundName: fixture.round_name,
      divisionId: division.id,
      divisionName: division.name,
      homeTeamId: homeTeam.id,
      homeTeamName: homeTeam.name,
      awayTeamId: awayTeam.id,
      awayTeamName: awayTeam.name,
      fixtureDate: fixture.fixture_date,
      status: fixture.status,
      schemeKey: scheme.key,
      schemeLines: scheme.lines,
    });
  }

  return options.sort(
    (left: any, right: any) =>
      left.roundNumber - right.roundNumber ||
      left.divisionName.localeCompare(right.divisionName) ||
      left.homeTeamName.localeCompare(right.homeTeamName),
  );
};

const loadPlayerOptions = async (serviceClient: any, context: FixtureContext) => {
  const fixtureTeamIds = [context.homeTeam.id, context.awayTeam.id];
  const [membershipResult, fillInResult, lineupResult, legacyLineupResult, appearanceResult] =
    await Promise.all([
      serviceClient
        .from("team_memberships")
        .select("user_id, team_id, jersey_number, membership_type")
        .in("team_id", fixtureTeamIds)
        .eq("status", "ACTIVE"),
      serviceClient
        .from("fixture_fill_ins")
        .select("player_id, team_id")
        .eq("fixture_id", context.fixture.id)
        .in("team_id", fixtureTeamIds)
        .eq("status", "SELECTED"),
      serviceClient
        .from("fixture_lineups")
        .select("id, team_id")
        .eq("fixture_id", context.fixture.id)
        .in("team_id", fixtureTeamIds),
      serviceClient
        .from("lineups")
        .select("player_id, team_id")
        .eq("fixture_id", context.fixture.id)
        .in("team_id", fixtureTeamIds),
      serviceClient
        .from("revsports_players")
        .select("player_name, profile_id, jersey, team_side")
        .eq("fixture_id", context.fixture.id)
        .eq("attended", true)
        .eq("is_removed", false),
    ]);
  const firstError = [membershipResult, fillInResult, lineupResult, legacyLineupResult, appearanceResult]
    .find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const membershipRows = membershipResult.data || [];
  const fillInRows = fillInResult.data || [];
  const fixtureLineups = lineupResult.data || [];
  const legacyLineupRows = legacyLineupResult.data || [];
  const appearanceRows = appearanceResult.data || [];
  const teamById = new Map([
    [context.homeTeam.id, context.homeTeam],
    [context.awayTeam.id, context.awayTeam],
  ]);
  const teamByLineupId = new Map(fixtureLineups.map((lineup: any) => [lineup.id, lineup.team_id]));
  const lineupIds = fixtureLineups.map((lineup: any) => lineup.id);
  const assignmentRows: any[] = [];
  for (const ids of chunksOf(lineupIds)) {
    const { data, error } = await serviceClient
      .from("fixture_lineup_assignments")
      .select("player_id, fixture_lineup_id")
      .in("fixture_lineup_id", ids);
    if (error) throw error;
    assignmentRows.push(...(data || []));
  }

  const participantByProfile = new Map<string, { teamId: string; number: string; context: string }>();
  const recordParticipant = (profileId: string | null, teamId: string | null, number: unknown, label: string) => {
    if (!profileId || !teamId || !teamById.has(teamId)) return;
    const existing = participantByProfile.get(profileId);
    participantByProfile.set(profileId, {
      teamId,
      number: number === null || number === undefined || number === "" ? existing?.number || "" : String(number),
      context: existing?.context || label,
    });
  };

  membershipRows.forEach((membership: any) =>
    recordParticipant(membership.user_id, membership.team_id, membership.jersey_number, "Active team member")
  );
  fillInRows.forEach((fillIn: any) =>
    recordParticipant(fillIn.player_id, fillIn.team_id, null, "Selected fill-in")
  );
  assignmentRows.forEach((assignment: any) =>
    recordParticipant(
      assignment.player_id,
      teamByLineupId.get(assignment.fixture_lineup_id) || null,
      null,
      "Published line-up",
    )
  );
  legacyLineupRows.forEach((lineup: any) =>
    recordParticipant(lineup.player_id, lineup.team_id, null, "Recorded line-up")
  );
  appearanceRows.forEach((appearance: any) =>
    recordParticipant(
      appearance.profile_id,
      appearance.team_side === "home" ? context.homeTeam.id : appearance.team_side === "away" ? context.awayTeam.id : null,
      appearance.jersey,
      "Recorded match participant",
    )
  );

  const profileIds = Array.from(participantByProfile.keys());
  const profileRows: any[] = [];
  for (const ids of chunksOf(profileIds)) {
    const { data, error } = await serviceClient
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", ids);
    if (error) throw error;
    profileRows.push(...(data || []));
  }

  const profileCandidates = new Map<string, any>();
  profileRows.forEach((profile) => {
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
    if (!name || profileCandidates.has(profile.id)) return;
    const participant = participantByProfile.get(profile.id);
    if (!participant) return;
    const team = teamById.get(participant.teamId);
    profileCandidates.set(profile.id, {
      optionId: `profile:${profile.id}`,
      profileId: profile.id,
      name,
      number: participant.number,
      teamId: team?.id || null,
      teamLabel: team?.name || "Fixture team",
      contextLabel: participant.context,
      source: "fixture",
    });
  });

  const unresolvedCandidates = new Map<string, any>();
  appearanceRows.forEach((appearance: any) => {
    if (appearance.profile_id) return;
    const name = normaliseText(appearance.player_name, 100);
    const nameKey = normaliseNameKey(name);
    const team = appearance.team_side === "home"
      ? context.homeTeam
      : appearance.team_side === "away"
      ? context.awayTeam
      : null;
    if (!nameKey || !team) return;
    unresolvedCandidates.set(nameKey, {
      name,
      number: appearance.jersey === null || appearance.jersey === undefined ? "" : String(appearance.jersey),
      teamId: team.id,
      teamLabel: team.name,
      contextLabel: "Recorded match participant",
    });
  });

  const { data: pendingSubmissions, error: pendingError } = await serviceClient
    .from("player_vote_submissions")
    .select("id")
    .eq("fixture_id", context.fixture.id)
    .eq("is_approved", false)
    .eq("is_deleted", false);
  if (pendingError) throw pendingError;

  const pendingSubmissionIds = (pendingSubmissions || []).map((submission: any) => submission.id);
  for (const ids of chunksOf(pendingSubmissionIds)) {
    const { data, error } = await serviceClient
      .from("player_vote_lines")
      .select("player_name, player_number, team_id")
      .in("submission_id", ids);
    if (error) throw error;
    (data || []).forEach((line: any) => {
      const name = normaliseText(line.player_name, 100);
      const nameKey = normaliseNameKey(name);
      const team = teamById.get(line.team_id);
      if (!nameKey || !team || unresolvedCandidates.has(nameKey)) return;
      unresolvedCandidates.set(nameKey, {
        name,
        number: line.player_number === null || line.player_number === undefined ? "" : String(line.player_number),
        teamId: team.id,
        teamLabel: team.name,
        contextLabel: "Pending vote for this fixture",
      });
    });
  }

  const candidates = Array.from(profileCandidates.values());
  const approvedNameKeys = new Set(candidates.map((candidate) => normaliseNameKey(candidate.name)));
  for (const [nameKey, unresolved] of unresolvedCandidates) {
    if (!nameKey || approvedNameKeys.has(nameKey)) continue;
    candidates.push({
      optionId: `unresolved:${await sha256(nameKey)}`,
      profileId: null,
      ...unresolved,
      source: "unresolved",
    });
  }

  return candidates.sort((left, right) =>
    left.name.localeCompare(right.name, "en-AU", { sensitivity: "base" }) ||
    (left.source === "fixture" ? -1 : 1),
  );
};

const recordRateEvent = async (
  serviceClient: any,
  eventType: "OPTIONS" | "SUBMIT_ATTEMPT" | "SUBMIT_SUCCESS",
  keyHash: string,
  limit: number,
  windowMinutes: number,
  record = true,
) => {
  const cutoff = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error: countError } = await serviceClient
    .from("public_umpire_portal_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", eventType)
    .eq("key_hash", keyHash)
    .gte("created_at", cutoff);
  if (countError) throw countError;
  if ((count || 0) >= limit) return false;

  if (record) {
    const { error: insertError } = await serviceClient
      .from("public_umpire_portal_events")
      .insert({ event_type: eventType, key_hash: keyHash });
    if (insertError) throw insertError;
  }
  return true;
};

const validateTurnstile = async (
  req: Request,
  token: string,
  idempotencyKey: string,
) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const isTestEnvironment =
    supabaseUrl.includes("127.0.0.1") ||
    supabaseUrl.includes("localhost") ||
    supabaseUrl.includes(DEV_PROJECT_REF);
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY") ||
    (isTestEnvironment ? LOCAL_TURNSTILE_SECRET : "");
  if (!secret) throw new Error("Public submission verification is not configured.");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: getRequestIp(req),
        idempotency_key: idempotencyKey,
      }),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok || !result.success) return false;
    if (result.action && result.action !== "umpire-vote-submit") return false;

    const origin = req.headers.get("Origin");
    if (origin && result.hostname) {
      const expectedHostname = new URL(origin).hostname;
      if (result.hostname !== expectedHostname && !isTestEnvironment) return false;
    }
    return true;
  } finally {
    clearTimeout(timeoutId);
  }
};

const validateProfiles = async (
  serviceClient: any,
  context: FixtureContext,
  profileIds: string[],
) => {
  if (profileIds.length === 0) return;
  const candidates = await loadPlayerOptions(serviceClient, context);
  const validIds = new Set(
    candidates.map((candidate: any) => candidate.profileId).filter(Boolean),
  );

  if (profileIds.some((id) => !validIds.has(id))) {
    throw new Error("One selected player is not recorded for this fixture.");
  }
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (origin && !getAllowedOrigins().has(origin)) {
    return jsonResponse(req, { error: "Origin not allowed." }, 403);
  }
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed." }, 405);

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > 25_000) return jsonResponse(req, { error: "Request is too large." }, 413);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(req, { error: "Portal service is unavailable." }, 503);
  }
  const isTestEnvironment =
    supabaseUrl.includes("127.0.0.1") ||
    supabaseUrl.includes("localhost") ||
    supabaseUrl.includes(DEV_PROJECT_REF);
  const enabledSetting = Deno.env.get("PUBLIC_UMPIRE_PORTAL_ENABLED");
  const enabled = enabledSetting ? enabledSetting === "true" : isTestEnvironment;
  if (!enabled) return jsonResponse(req, { error: "The public umpire portal is not enabled." }, 503);

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json();
    const action = normaliseText(body?.action, 40);
    const ipHash = await sha256(`ip:${getRequestIp(req)}`);
    const association = await resolveAssociation(serviceClient);

    if (action === "match-options") {
      const allowed = await recordRateEvent(serviceClient, "OPTIONS", ipHash, 60, 15);
      if (!allowed) return jsonResponse(req, { error: "Too many requests. Please try again shortly." }, 429);
      const fixtures = await loadMatchOptions(serviceClient, association);
      return jsonResponse(req, { association, fixtures });
    }

    if (action === "player-options") {
      const allowed = await recordRateEvent(serviceClient, "OPTIONS", ipHash, 60, 15);
      if (!allowed) return jsonResponse(req, { error: "Too many requests. Please try again shortly." }, 429);
      const fixtureId = normaliseText(body?.fixtureId, 36);
      if (!isUuid(fixtureId)) return jsonResponse(req, { error: "Select a valid fixture." }, 400);
      const context = await loadFixtureContext(serviceClient, association, fixtureId);
      const candidates = await loadPlayerOptions(serviceClient, context);
      return jsonResponse(req, { candidates });
    }

    if (action !== "submit") return jsonResponse(req, { error: "Unknown action." }, 400);

    const submitterName = normaliseText(body?.submitterName, 100);
    const submitterEmail = normaliseText(body?.submitterEmail, 254).toLowerCase();
    const submissionMode = body?.submissionMode === "proxy" ? "proxy" : "self";
    const proxyUmpireName = normaliseText(body?.proxyUmpireName, 100);
    const proxyReason = normaliseText(body?.proxyReason, 500);
    const fixtureId = normaliseText(body?.fixtureId, 36);
    const turnstileToken = normaliseText(body?.turnstileToken, 2048);
    const idempotencyKey = normaliseText(body?.idempotencyKey, 36);
    const honeypot = normaliseText(body?.website, 100);
    const votes = Array.isArray(body?.votes) ? body.votes : [];

    if (honeypot) return jsonResponse(req, { error: "Submission could not be accepted." }, 400);
    if (!submitterName || !isEmail(submitterEmail)) {
      return jsonResponse(req, { error: "Enter your full name and a valid email address." }, 400);
    }
    if (submissionMode === "proxy" && (!proxyUmpireName || !proxyReason)) {
      return jsonResponse(req, { error: "Enter the umpire's name and the reason for submitting on their behalf." }, 400);
    }
    if (!isUuid(fixtureId) || !isUuid(idempotencyKey)) {
      return jsonResponse(req, { error: "The submission details are invalid." }, 400);
    }

    const { data: existingRetry, error: retryError } = await serviceClient
      .from("player_vote_submissions")
      .select("public_submission_reference, fixture_id")
      .eq("public_idempotency_key", idempotencyKey)
      .maybeSingle();
    if (retryError) throw retryError;
    if (existingRetry?.public_submission_reference) {
      if (existingRetry.fixture_id !== fixtureId) {
        return jsonResponse(req, { error: "The submission reference belongs to a different fixture." }, 409);
      }
      const moduleEnabledFixtureIds = await loadModuleEnabledFixtureIds(
        serviceClient,
        [fixtureId],
      );
      if (!moduleEnabledFixtureIds.has(fixtureId)) {
        return jsonResponse(req, { error: "Umpire Match Voting is turned off for this fixture." }, 403);
      }
      return jsonResponse(req, {
        reference: existingRetry.public_submission_reference,
        status: "PENDING",
      });
    }

    const attemptAllowed = await recordRateEvent(serviceClient, "SUBMIT_ATTEMPT", ipHash, 10, 15);
    if (!attemptAllowed) {
      return jsonResponse(req, { error: "Too many submission attempts. Please wait 15 minutes and try again." }, 429);
    }

    // Only resolve the complete fixture after the cheap idempotency and rate
    // checks. This keeps legitimate retries stable and prevents invalid public
    // requests from triggering the expensive context/player query path.
    const context = await loadFixtureContext(serviceClient, association, fixtureId);

    const emailHash = await sha256(`email:${submitterEmail}`);
    const emailAllowed = await recordRateEvent(
      serviceClient,
      "SUBMIT_SUCCESS",
      emailHash,
      10,
      24 * 60,
      false,
    );
    if (!emailAllowed) {
      return jsonResponse(req, { error: "This email has reached today's submission limit." }, 429);
    }

    if (!turnstileToken || !(await validateTurnstile(req, turnstileToken, idempotencyKey))) {
      return jsonResponse(req, { error: "The security check expired or failed. Please try it again." }, 400);
    }

    if (votes.length !== context.schemeLines.length) {
      return jsonResponse(req, { error: "The vote card count does not match this division." }, 400);
    }

    const expectedLineMap = new Map(context.schemeLines.map((line) => [line.key, line]));
    const seenLineKeys = new Set<string>();
    const seenPeople = new Set<string>();
    const profileIds: string[] = [];
    const validatedLines: Record<string, unknown>[] = [];

    for (const rawLine of votes) {
      const lineKey = normaliseText(rawLine?.lineKey, 40);
      const expectedLine = expectedLineMap.get(lineKey);
      if (!expectedLine || seenLineKeys.has(lineKey)) {
        return jsonResponse(req, { error: "The vote card details are invalid." }, 400);
      }
      seenLineKeys.add(lineKey);

      const playerName = normaliseText(rawLine?.playerName, 100);
      const playerNumber = normaliseText(rawLine?.playerNumber, 10);
      const teamId = normaliseText(rawLine?.teamId, 36);
      const profileId = normaliseText(rawLine?.profileId, 36);
      if (!playerName && !playerNumber) {
        return jsonResponse(req, { error: `Enter a player name or number for ${expectedLine.label}.` }, 400);
      }
      if (playerNumber && !/^\d{1,3}$/.test(playerNumber)) {
        return jsonResponse(req, { error: `Enter a valid player number for ${expectedLine.label}.` }, 400);
      }
      if (![context.homeTeam.id, context.awayTeam.id].includes(teamId)) {
        return jsonResponse(req, { error: `Select a fixture team for ${expectedLine.label}.` }, 400);
      }
      if (profileId && !isUuid(profileId)) {
        return jsonResponse(req, { error: "A selected player is invalid." }, 400);
      }

      const personKey = `${normaliseNameKey(playerName) || `#${playerNumber}`}:${playerNumber}:${teamId}`;
      if (seenPeople.has(personKey)) {
        return jsonResponse(req, { error: "The same player cannot receive more than one vote." }, 400);
      }
      seenPeople.add(personKey);
      if (profileId) profileIds.push(profileId);
      validatedLines.push({
        votes: expectedLine.points,
        player_name: playerName,
        player_number: playerNumber,
        team_id: teamId,
        profile_id: profileId,
        scheme_line_key: expectedLine.key,
      });
    }

    await validateProfiles(serviceClient, context, Array.from(new Set(profileIds)));

    const submittedForName = submissionMode === "proxy" ? proxyUmpireName : submitterName;
    const duplicateKey = await sha256(
      `${context.fixture.id}:${normaliseNameKey(submittedForName)}:${submitterEmail}`,
    );
    const { data: duplicate, error: duplicateError } = await serviceClient
      .from("player_vote_submissions")
      .select("id")
      .eq("public_duplicate_key", duplicateKey)
      .eq("is_deleted", false)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) {
      return jsonResponse(req, { error: "Votes have already been submitted for this umpire and fixture." }, 409);
    }

    const reference = `HB-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const submissionPayload = {
      fixture_id: context.fixture.id,
      association_id: context.associationId,
      division_id: context.division.id,
      round_number: context.fixture.round_number,
      home_team_id: context.homeTeam.id,
      away_team_id: context.awayTeam.id,
      public_submitter_name: submitterName,
      public_submitter_email: submitterEmail,
      public_submission_reference: reference,
      public_idempotency_key: idempotencyKey,
      public_duplicate_key: duplicateKey,
      vote_scheme_key: context.schemeKey,
      proxy_submitter_name: submissionMode === "proxy" ? submitterName : "",
      proxy_umpire_name: submissionMode === "proxy" ? proxyUmpireName : "",
      proxy_reason: submissionMode === "proxy" ? proxyReason : "",
    };

    const { data: created, error: createError } = await serviceClient.rpc(
      "create_public_umpire_vote",
      { p_submission: submissionPayload, p_lines: validatedLines },
    );
    if (createError) {
      if (createError.code === "23505") {
        const { data: retry } = await serviceClient
          .from("player_vote_submissions")
          .select("public_submission_reference")
          .eq("public_idempotency_key", idempotencyKey)
          .maybeSingle();
        if (retry?.public_submission_reference) {
          return jsonResponse(req, { reference: retry.public_submission_reference, status: "PENDING" });
        }
        return jsonResponse(req, { error: "Votes have already been submitted for this umpire and fixture." }, 409);
      }
      throw createError;
    }
    if (!created?.[0]?.submission_reference) throw new Error("No submission reference was returned.");

    await recordRateEvent(serviceClient, "SUBMIT_SUCCESS", emailHash, 11, 24 * 60);

    return jsonResponse(req, { reference: created[0].submission_reference, status: "PENDING" });
  } catch (error) {
    console.error("public-umpire-match-voting:", error);
    return jsonResponse(req, {
      error: error instanceof Error ? error.message : "The portal could not complete this request.",
    }, error instanceof RequestError ? error.status : 500);
  }
});

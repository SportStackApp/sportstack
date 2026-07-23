import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sportstack-cron-secret",
};

type ReminderAction =
  | "scheduled"
  | "opened"
  | "three_day_reminder"
  | "two_day_reminder"
  | "one_day_reminder"
  | "manual_resend";
type ReminderEvent = Exclude<ReminderAction, "scheduled">;

type MvpSession = {
  id: string;
  fixture_id: string | null;
  team_id: string | null;
  status: string;
  opened_at: string | null;
  closes_at: string | null;
  game_date: string | null;
  grade: string | null;
  round: string | null;
  home_team: string | null;
  away_team: string | null;
  result_check_round: number;
  voting_cycle: number;
};

type TeamScope = {
  id: string;
  mvp_enabled: boolean;
  mvp_notifications_enabled: boolean;
  club_id: string;
  association_id: string | null;
  timezone: string;
};

type TeamScopeRow = {
  id: string;
  mvp_enabled: boolean;
  mvp_notifications_enabled: boolean;
  club_id: string;
  clubs: { association_id: string | null } | Array<{ association_id: string | null }> | null;
};

type EligiblePlayer = {
  id: string;
  player_name: string | null;
  profile_id: string | null;
  team_side: "home" | "away" | null;
};

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type CallerRole = {
  role: string;
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
};

type AuthResult =
  | { ok: true; callerId: string | null; isCron: boolean; roles: CallerRole[] }
  | { ok: false; error: string; status: number };

// The function remains schema-loose until the approved migrations are applied
// and the generated database types can be refreshed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = ReturnType<typeof createClient<any>>;

type SendBudget = {
  remaining: number;
};

const MELBOURNE_TZ = "Australia/Melbourne";
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const ADMIN_ROLES = ["SUPER_ADMIN", "ASSOCIATION_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"];
const EMAIL_SEND_DELAY_MS = 750;
const RATE_LIMIT_RETRY_DELAYS_MS = [1500, 3000];
const SESSION_PAGE_SIZE = 100;
const MAX_SCHEDULED_RECIPIENTS_PER_RUN = 20;
const MAX_SCHEDULED_FAILURE_ATTEMPTS = 3;
const STALE_EVENT_CLAIM_MS = 10 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
const THREE_DAYS_MS = 72 * 60 * 60 * 1000;
let lastEmailSendStartedAt = 0;

class EmailSendError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "EmailSendError";
    this.status = status;
  }
}

class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getEnv = (name: string) => Deno.env.get(name)?.trim() || "";
const normaliseSiteUrl = () =>
  (getEnv("SPORTSTACK_APP_URL") || "https://sportstackapp.com").replace(/\/$/, "");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function eventTitle(eventType: ReminderEvent) {
  if (eventType === "opened") return "MVP voting is open";
  return "MVP voting reminder";
}

function sessionTitle(session: MvpSession) {
  const teams = [session.home_team, session.away_team].filter(Boolean).join(" vs ");
  return [session.grade, session.round, teams].filter(Boolean).join(" - ") || "your match";
}

function formatCloseTime(value?: string | null, timeZone = MELBOURNE_TZ) {
  if (!value) return "the voting close time";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function profileName(profile: Profile | undefined, playerName?: string | null) {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return name || playerName || "there";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return replacements[character];
  });
}

function shouldSendEvent(session: MvpSession, eventType: ReminderEvent, now: Date) {
  if (eventType === "manual_resend") return true;
  if (session.status !== "OPEN" || !session.opened_at || !session.closes_at) return false;

  const openedAt = new Date(session.opened_at);
  const closesAt = new Date(session.closes_at);
  if (Number.isNaN(openedAt.getTime()) || Number.isNaN(closesAt.getTime())) return false;
  if (closesAt <= now) return false;
  if (eventType === "opened") return openedAt <= now;

  const delayMs = eventType === "one_day_reminder"
    ? ONE_DAY_MS
    : eventType === "two_day_reminder"
      ? TWO_DAYS_MS
      : THREE_DAYS_MS;
  const dueAt = new Date(openedAt.getTime() + delayMs);

  // Do not send a milestone after the next match has started or the round has
  // otherwise closed. The older two-day action remains accepted only for
  // compatibility; scheduled runs now use opening, +24 hours and +72 hours.
  return dueAt < closesAt && dueAt <= now;
}

function normaliseAction(value: unknown): ReminderAction | null {
  if (
    value === "scheduled" ||
    value === "opened" ||
    value === "three_day_reminder" ||
    value === "two_day_reminder" ||
    value === "one_day_reminder" ||
    value === "manual_resend"
  ) {
    return value;
  }
  return null;
}

async function authoriseRequest(
  req: Request,
  serviceClient: ServiceClient,
  action: ReminderAction,
): Promise<AuthResult> {
  const cronSecret = getEnv("SPORTSTACK_CRON_SECRET");
  const requestSecret = req.headers.get("x-sportstack-cron-secret") || "";
  if (cronSecret && requestSecret === cronSecret) {
    if (action !== "scheduled") {
      return { ok: false, error: "The scheduler may only run scheduled reminders.", status: 403 };
    }
    return { ok: true, callerId: null, isCron: true, roles: [] };
  }

  if (action === "scheduled") {
    return { ok: false, error: "Scheduled reminders require the cron secret.", status: 401 };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, error: "Unauthorised", status: 401 };
  }

  const anonClient = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
  const callerId = claimsData?.claims?.sub as string | undefined;
  if (claimsError || !callerId) {
    return { ok: false, error: "Unauthorised", status: 401 };
  }

  const { data: roles, error: rolesError } = await serviceClient
    .from("user_roles")
    .select("role, association_id, club_id, team_id")
    .eq("user_id", callerId)
    .in("role", ADMIN_ROLES);

  if (rolesError || !roles || roles.length === 0) {
    return { ok: false, error: "MVP voting manager access is required.", status: 403 };
  }

  return { ok: true, callerId, isCron: false, roles: roles as CallerRole[] };
}

async function loadSessions(
  serviceClient: ServiceClient,
  action: ReminderAction,
  sessionId?: string,
) {
  const columns =
    "id, fixture_id, team_id, status, opened_at, closes_at, game_date, grade, round, home_team, away_team, result_check_round, voting_cycle";

  if (sessionId) {
    const { data, error } = await serviceClient
      .from("mvp_voting_sessions")
      .select(columns)
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return data ? [data as MvpSession] : [];
  }

  if (action !== "scheduled") {
    throw new RequestError("A voting session is required for this reminder.");
  }

  const sessions: MvpSession[] = [];
  let offset = 0;
  const nowIso = new Date().toISOString();

  while (true) {
    const { data, error } = await serviceClient
      .from("mvp_voting_sessions")
      .select(columns)
      .eq("status", "OPEN")
      .not("team_id", "is", null)
      .gt("closes_at", nowIso)
      .order("closes_at", { ascending: true })
      .range(offset, offset + SESSION_PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data || []) as MvpSession[];
    sessions.push(...page);
    if (page.length < SESSION_PAGE_SIZE) break;
    offset += SESSION_PAGE_SIZE;
  }

  return sessions;
}

async function loadTeamScopes(
  serviceClient: ServiceClient,
  teamIds: string[],
) {
  if (teamIds.length === 0) return new Map<string, TeamScope>();

  const { data, error } = await serviceClient
    .from("teams")
    .select("id, mvp_enabled, mvp_notifications_enabled, club_id, clubs(association_id)")
    .in("id", teamIds);
  if (error) throw error;

  const teamRows = (data || []) as TeamScopeRow[];
  const associationIds = Array.from(new Set(teamRows.flatMap((row) => {
    const club = Array.isArray(row.clubs) ? row.clubs[0] : row.clubs;
    return club?.association_id ? [club.association_id] : [];
  })));
  const timezoneByAssociation = new Map<string, string>();
  if (associationIds.length > 0) {
    const { data: associationRows, error: associationError } = await serviceClient
      .from("associations")
      .select("id, timezone")
      .in("id", associationIds);
    if (associationError) throw associationError;
    ((associationRows || []) as Array<{ id: string; timezone: string | null }>).forEach((association) => {
      timezoneByAssociation.set(association.id, association.timezone || MELBOURNE_TZ);
    });
  }

  const teams = new Map<string, TeamScope>();
  for (const row of teamRows) {
    const club = Array.isArray(row.clubs) ? row.clubs[0] : row.clubs;
    teams.set(row.id, {
      id: row.id,
      mvp_enabled: Boolean(row.mvp_enabled),
      mvp_notifications_enabled: Boolean(row.mvp_notifications_enabled),
      club_id: row.club_id,
      association_id: club?.association_id || null,
      timezone: club?.association_id
        ? timezoneByAssociation.get(club.association_id) || MELBOURNE_TZ
        : MELBOURNE_TZ,
    });
  }
  return teams;
}

function callerCanManageTeam(roles: CallerRole[], team: TeamScope) {
  return roles.some((role) => {
    if (role.role === "SUPER_ADMIN") return true;
    if (role.role === "ASSOCIATION_ADMIN") return role.association_id === team.association_id;
    if (role.role === "CLUB_ADMIN") return role.club_id === team.club_id;
    if (role.role === "TEAM_MANAGER" || role.role === "COACH") return role.team_id === team.id;
    return false;
  });
}

async function loadNonVoters(
  serviceClient: ServiceClient,
  session: MvpSession,
  targetProfileId?: string,
) {
  if (!session.fixture_id || !session.team_id) return [];

  const { data: fixture, error: fixtureError } = await serviceClient
    .from("fixtures")
    .select("home_team_id, away_team_id")
    .eq("id", session.fixture_id)
    .single();
  if (fixtureError) throw fixtureError;

  const teamSide = fixture.home_team_id === session.team_id
    ? "home"
    : fixture.away_team_id === session.team_id
      ? "away"
      : null;
  if (!teamSide) throw new RequestError("The voting team is not part of this fixture.");

  const [playersRes, fillInsRes, submissionsRes, incorrectChecksRes] = await Promise.all([
    serviceClient
      .from("revsports_players")
      .select("id, player_name, profile_id, team_side")
      .eq("fixture_id", session.fixture_id)
      .eq("attended", true)
      .eq("team_side", teamSide)
      .not("profile_id", "is", null),
    serviceClient
      .from("fixture_fill_ins")
      .select("id, player_id")
      .eq("fixture_id", session.fixture_id)
      .eq("team_id", session.team_id)
      .eq("status", "SELECTED"),
    serviceClient
      .from("mvp_vote_submissions")
      .select("voter_profile_id")
      .eq("session_id", session.id),
    serviceClient
      .from("mvp_result_checks")
      .select("voter_profile_id")
      .eq("session_id", session.id)
      .eq("result_check_round", session.result_check_round)
      .eq("response", "INCORRECT"),
  ]);

  if (playersRes.error) throw playersRes.error;
  if (fillInsRes.error) throw fillInsRes.error;
  if (submissionsRes.error) throw submissionsRes.error;
  if (incorrectChecksRes.error) throw incorrectChecksRes.error;

  const submittedProfileIds = new Set(
    ((submissionsRes.data || []) as { voter_profile_id: string | null }[])
      .map((row) => row.voter_profile_id)
      .filter(Boolean),
  );
  const blockedProfileIds = new Set(
    ((incorrectChecksRes.data || []) as { voter_profile_id: string | null }[])
      .map((row) => row.voter_profile_id)
      .filter(Boolean),
  );
  const seen = new Set<string>();

  const attendedPlayers = (playersRes.data || []) as EligiblePlayer[];
  const selectedFillIns = ((fillInsRes.data || []) as Array<{ id: string; player_id: string | null }>).map(
    (fillIn): EligiblePlayer => ({
      id: `fill-in-${fillIn.id}`,
      player_name: null,
      profile_id: fillIn.player_id,
      team_side: teamSide,
    }),
  );

  return [...attendedPlayers, ...selectedFillIns]
    .filter((player) => player.profile_id && !submittedProfileIds.has(player.profile_id))
    .filter((player) => player.profile_id && !blockedProfileIds.has(player.profile_id))
    .filter((player) => !targetProfileId || player.profile_id === targetProfileId)
    .filter((player) => {
      if (!player.profile_id || seen.has(player.profile_id)) return false;
      seen.add(player.profile_id);
      return true;
    });
}

async function loadProfiles(serviceClient: ServiceClient, profileIds: string[]) {
  if (profileIds.length === 0) return new Map<string, Profile>();

  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", profileIds);
  if (error) throw error;
  return new Map(((data || []) as Profile[]).map((profile) => [profile.id, profile]));
}

async function hasSentEvent(
  serviceClient: ServiceClient,
  session: MvpSession,
  profileId: string,
  eventType: ReminderEvent,
) {
  if (eventType === "manual_resend") return false;

  const { data, error } = await serviceClient
    .from("mvp_voting_email_events")
    .select("status, created_at")
    .eq("session_id", session.id)
    .eq("profile_id", profileId)
    .eq("event_type", eventType)
    .eq("voting_cycle", session.voting_cycle)
    .in("status", ["sending", "sent", "skipped", "failed"])
    .limit(20);
  if (error) throw error;

  const staleBefore = Date.now() - STALE_EVENT_CLAIM_MS;
  const rows = (data || []) as Array<{ status: string; created_at: string | null }>;
  const failedAttempts = rows.filter((row) => row.status === "failed").length;
  if (failedAttempts >= MAX_SCHEDULED_FAILURE_ATTEMPTS) return true;

  return rows.some((row) => {
    if (row.status === "sent" || row.status === "skipped") return true;
    const createdAt = row.created_at ? new Date(row.created_at).getTime() : Number.NaN;
    return row.status === "sending" && (Number.isNaN(createdAt) || createdAt > staleBefore);
  });
}

async function claimEvent(
  serviceClient: ServiceClient,
  session: MvpSession,
  profileId: string,
  eventType: ReminderEvent,
  email: string | null,
) {
  if (eventType === "manual_resend") return null;

  const staleBefore = new Date(Date.now() - STALE_EVENT_CLAIM_MS).toISOString();
  const { error: staleClaimError } = await serviceClient
    .from("mvp_voting_email_events")
    .update({ status: "failed", error_message: "Recovered a stale reminder claim." })
    .eq("session_id", session.id)
    .eq("profile_id", profileId)
    .eq("event_type", eventType)
    .eq("voting_cycle", session.voting_cycle)
    .eq("status", "sending")
    .lt("created_at", staleBefore);
  if (staleClaimError) throw staleClaimError;

  const { data, error } = await serviceClient
    .from("mvp_voting_email_events")
    .insert({
      session_id: session.id,
      profile_id: profileId,
      event_type: eventType,
      voting_cycle: session.voting_cycle,
      email,
      status: "sending",
    })
    .select("id")
    .single();
  if (!error) return data?.id as string | undefined;
  if (error.code === "23505") return null;
  throw error;
}

async function recordManualEvent(
  serviceClient: ServiceClient,
  session: MvpSession,
  profileId: string,
  email: string | null,
  status: "sent" | "skipped" | "failed",
  errorMessage?: string,
) {
  await serviceClient.from("mvp_voting_email_events").insert({
    session_id: session.id,
    profile_id: profileId,
    event_type: "manual_resend",
    voting_cycle: session.voting_cycle,
    email,
    status,
    error_message: errorMessage || null,
  });
}

async function finishClaimedEvent(
  serviceClient: ServiceClient,
  eventId: string | null | undefined,
  status: "sent" | "skipped" | "failed",
  email: string | null,
  errorMessage?: string,
) {
  if (!eventId) return;
  await serviceClient
    .from("mvp_voting_email_events")
    .update({ status, email, error_message: errorMessage || null })
    .eq("id", eventId);
}

async function sendEmail(email: string, subject: string, html: string) {
  const apiKey = getEnv("RESEND_API_KEY");
  if (!apiKey) throw new Error("Missing RESEND_API_KEY Edge Function secret.");

  const fromEmail = getEnv("MVP_REMINDER_FROM_EMAIL") || "SportStack <noreply@sportstackapp.com>";
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to: [email], subject, html }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new EmailSendError(text || `Resend returned ${response.status}`, response.status);
  }
}

async function sendEmailWithRetry(email: string, subject: string, html: string) {
  const waitMs = EMAIL_SEND_DELAY_MS - (Date.now() - lastEmailSendStartedAt);
  if (waitMs > 0) await sleep(waitMs);
  lastEmailSendStartedAt = Date.now();

  for (let attempt = 0; attempt <= RATE_LIMIT_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await sendEmail(email, subject, html);
      return;
    } catch (error) {
      const isRateLimit = error instanceof EmailSendError && error.status === 429;
      const canRetry = attempt < RATE_LIMIT_RETRY_DELAYS_MS.length;
      if (!isRateLimit || !canRetry) throw error;
      await sleep(RATE_LIMIT_RETRY_DELAYS_MS[attempt]);
    }
  }
}

function buildEmailHtml(
  session: MvpSession,
  eventType: ReminderEvent,
  recipientName: string,
  timeZone: string,
) {
  const voteUrl = `${normaliseSiteUrl()}/mvp-votes/${session.id}`;
  const intro = eventType === "opened"
    ? "MVP voting is now open for this match."
    : "This is a reminder to submit your MVP votes for this match.";
  const safeName = escapeHtml(recipientName);
  const safeTitle = escapeHtml(sessionTitle(session));
  const safeCloseTime = escapeHtml(formatCloseTime(session.closes_at, timeZone));
  const safeTimeZone = escapeHtml(timeZone);

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <p>Hi ${safeName},</p>
      <p>${intro}</p>
      <p><strong>${safeTitle}</strong></p>
      <p>Voting closes ${safeCloseTime} (${safeTimeZone}).</p>
      <p>
        <a href="${voteUrl}" style="display: inline-block; padding: 10px 14px; background: #0f766e; color: #ffffff; text-decoration: none; border-radius: 6px;">
          Vote now
        </a>
      </p>
      <p>If the button does not work, sign in to SportStack and open MVP Votes.</p>
    </div>
  `;
}

async function sendForEvent(
  serviceClient: ServiceClient,
  session: MvpSession,
  eventType: ReminderEvent,
  timeZone: string,
  targetProfileId?: string,
  budget?: SendBudget,
) {
  const nonVoters = await loadNonVoters(serviceClient, session, targetProfileId);
  const profiles = await loadProfiles(
    serviceClient,
    nonVoters.map((player) => player.profile_id!).filter(Boolean),
  );
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let deferred = 0;

  for (let index = 0; index < nonVoters.length; index += 1) {
    if (budget && budget.remaining <= 0) {
      deferred += nonVoters.length - index;
      break;
    }

    const player = nonVoters[index];
    const profileId = player.profile_id!;
    if (await hasSentEvent(serviceClient, session, profileId, eventType)) {
      skipped += 1;
      continue;
    }

    if (budget) budget.remaining -= 1;

    const claimedEventId = await claimEvent(serviceClient, session, profileId, eventType, null);
    if (eventType !== "manual_resend" && !claimedEventId) {
      skipped += 1;
      continue;
    }

    const { data: userData, error: userError } = await serviceClient.auth.admin.getUserById(profileId);
    const email = userData?.user?.email || null;
    if (userError || !email) {
      const message = userError?.message || "No sign-in email found.";
      skipped += 1;
      if (eventType === "manual_resend") {
        await recordManualEvent(serviceClient, session, profileId, email, "skipped", message);
      } else {
        await finishClaimedEvent(serviceClient, claimedEventId, "skipped", email, message);
      }
      continue;
    }

    try {
      const name = profileName(profiles.get(profileId), player.player_name);
      await sendEmailWithRetry(
        email,
        `${eventTitle(eventType)} - ${sessionTitle(session)}`,
        buildEmailHtml(session, eventType, name, timeZone),
      );
      if (eventType === "manual_resend") {
        await recordManualEvent(serviceClient, session, profileId, email, "sent");
      } else {
        await finishClaimedEvent(serviceClient, claimedEventId, "sent", email);
      }
      sent += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Email failed.";
      if (eventType === "manual_resend") {
        await recordManualEvent(serviceClient, session, profileId, email, "failed", message);
      } else {
        await finishClaimedEvent(serviceClient, claimedEventId, "failed", email, message);
      }
    }
  }

  return { sent, skipped, failed, deferred };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const payload = (await req.json().catch(() => ({}))) as {
      action?: unknown;
      session_id?: string;
      profile_id?: string;
    };
    const action = normaliseAction(payload.action || "scheduled");
    if (!action) return jsonResponse({ error: "Unsupported reminder action." }, 400);

    const serviceClient = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    ) as ServiceClient;
    const auth = await authoriseRequest(req, serviceClient, action);
    if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

    const sessions = await loadSessions(serviceClient, action, payload.session_id);
    const teamIds = Array.from(new Set(sessions.map((session) => session.team_id).filter(Boolean))) as string[];
    const teamScopes = await loadTeamScopes(serviceClient, teamIds);
    const now = new Date();
    const totals = { sessions: 0, sent: 0, skipped: 0, failed: 0, deferred: 0 };
    const scheduledBudget: SendBudget | undefined = action === "scheduled"
      ? { remaining: MAX_SCHEDULED_RECIPIENTS_PER_RUN }
      : undefined;

    sessionLoop: for (const session of sessions) {
      if (!session.team_id) continue;
      const team = teamScopes.get(session.team_id);
      if (!team?.mvp_enabled) continue;
      if (!auth.isCron && !callerCanManageTeam(auth.roles, team)) {
        throw new RequestError("You do not manage this team.", 403);
      }
      if (!team.mvp_notifications_enabled) {
        if (!auth.isCron) {
          throw new RequestError("Player MVP email notifications are turned off for this team.", 409);
        }
        continue;
      }
      if (session.status !== "OPEN" || !session.closes_at || new Date(session.closes_at) <= now) {
        if (!auth.isCron) throw new RequestError("Voting is not open for this team.");
        continue;
      }

      const eventTypes: ReminderEvent[] = action === "scheduled"
        ? ["opened", "one_day_reminder", "three_day_reminder"]
        : [action];
      let processedSession = false;

      for (const eventType of eventTypes) {
        if (!shouldSendEvent(session, eventType, now)) continue;
        const result = await sendForEvent(
          serviceClient,
          session,
          eventType,
          team.timezone,
          payload.profile_id,
          scheduledBudget,
        );
        processedSession = true;
        totals.sent += result.sent;
        totals.skipped += result.skipped;
        totals.failed += result.failed;
        totals.deferred += result.deferred;
        if (scheduledBudget && scheduledBudget.remaining <= 0) break sessionLoop;
      }
      if (processedSession) totals.sessions += 1;
    }

    return jsonResponse({
      success: true,
      action,
      ...totals,
      budget_exhausted: Boolean(scheduledBudget && scheduledBudget.remaining <= 0),
    });
  } catch (error) {
    console.error("mvp-voting-email-reminders: unexpected error", error);
    const status = error instanceof RequestError ? error.status : 500;
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Internal server error" },
      status,
    );
  }
});

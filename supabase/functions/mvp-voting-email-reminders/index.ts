import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sportstack-cron-secret",
};

type ReminderAction = "scheduled" | "opened" | "three_day_reminder" | "one_day_reminder" | "manual_resend";
type ReminderEvent = "opened" | "three_day_reminder" | "one_day_reminder" | "manual_resend";

type MvpSession = {
  id: string;
  fixture_id: string | null;
  status: string;
  opened_at: string | null;
  closes_at: string | null;
  game_date: string | null;
  grade: string | null;
  round: string | null;
  home_team: string | null;
  away_team: string | null;
};

type EligiblePlayer = {
  id: string;
  player_name: string | null;
  profile_id: string | null;
  team: string | null;
};

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

const MELBOURNE_TZ = "Australia/Melbourne";
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const ADMIN_ROLES = ["SUPER_ADMIN", "ASSOCIATION_ADMIN"];
const EMAIL_SEND_DELAY_MS = 750;
const RATE_LIMIT_RETRY_DELAYS_MS = [1500, 3000];

class EmailSendError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "EmailSendError";
    this.status = status;
  }
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getEnv = (name: string) => Deno.env.get(name)?.trim() || "";

const normaliseSiteUrl = () => (getEnv("SPORTSTACK_APP_URL") || "https://sportstackapp.com").replace(/\/$/, "");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || "0");
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  // Adjust until the requested wall-clock time in Melbourne maps to the correct UTC instant.
  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedParts(utc, timeZone);
    const actual = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
    utc = new Date(utc.getTime() - (actual - wanted));
  }

  return utc;
}

function addMelbourneDays(date: Date, days: number) {
  const parts = getZonedParts(date, MELBOURNE_TZ);
  const moved = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 0, 0, 0));
  return getZonedParts(moved, "UTC");
}

function getThreeDayReminderTime(closesAt: string) {
  const closeDate = new Date(closesAt);
  const targetDate = addMelbourneDays(closeDate, -3);
  return zonedTimeToUtc(targetDate.year, targetDate.month, targetDate.day, 18, 0, MELBOURNE_TZ);
}

function getOneDayReminderTime(closesAt: string) {
  return new Date(new Date(closesAt).getTime() - 24 * 60 * 60 * 1000);
}

function eventTitle(eventType: ReminderEvent) {
  if (eventType === "opened") return "MVP voting is open";
  if (eventType === "three_day_reminder") return "MVP voting reminder";
  if (eventType === "one_day_reminder") return "MVP voting closes soon";
  return "MVP voting reminder";
}

function sessionTitle(session: MvpSession) {
  const teams = [session.home_team, session.away_team].filter(Boolean).join(" vs ");
  return [session.grade, session.round, teams].filter(Boolean).join(" - ") || "your match";
}

function formatCloseTime(value?: string | null) {
  if (!value) return "the voting close time";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TZ,
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

function shouldSendEvent(session: MvpSession, eventType: ReminderEvent, now: Date) {
  if (eventType === "manual_resend") return true;
  if (session.status !== "OPEN" || !session.closes_at) return false;
  if (new Date(session.closes_at) <= now) return false;

  if (eventType === "opened") {
    if (!session.opened_at) return false;
    const openedAt = new Date(session.opened_at);
    return openedAt <= now && now.getTime() - openedAt.getTime() <= 24 * 60 * 60 * 1000;
  }

  const dueAt = eventType === "three_day_reminder"
    ? getThreeDayReminderTime(session.closes_at)
    : getOneDayReminderTime(session.closes_at);

  return dueAt <= now;
}

async function authoriseRequest(req: Request, serviceClient: ReturnType<typeof createClient>) {
  const cronSecret = getEnv("SPORTSTACK_CRON_SECRET");
  const requestSecret = req.headers.get("x-sportstack-cron-secret") || "";
  if (cronSecret && requestSecret === cronSecret) {
    return { ok: true, callerId: null, isCron: true };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  const anonClient = createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
  const callerId = claimsData?.claims?.sub as string | undefined;
  if (claimsError || !callerId) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  const { data: roles, error: rolesError } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .in("role", ADMIN_ROLES);

  if (rolesError || !roles || roles.length === 0) {
    return { ok: false, error: "Super Admin or Association Admin access required", status: 403 };
  }

  return { ok: true, callerId, isCron: false };
}

async function loadSessions(serviceClient: ReturnType<typeof createClient>, action: ReminderAction, sessionId?: string) {
  if (sessionId) {
    const { data, error } = await serviceClient
      .from("mvp_voting_sessions")
      .select("id, fixture_id, status, opened_at, closes_at, game_date, grade, round, home_team, away_team")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) throw error;
    return data ? [data as MvpSession] : [];
  }

  const { data, error } = await serviceClient
    .from("mvp_voting_sessions")
    .select("id, fixture_id, status, opened_at, closes_at, game_date, grade, round, home_team, away_team")
    .eq("status", "OPEN")
    .not("fixture_id", "is", null)
    .not("closes_at", "is", null)
    .limit(action === "scheduled" ? 100 : 20);

  if (error) throw error;
  return (data || []) as MvpSession[];
}

async function loadNonVoters(
  serviceClient: ReturnType<typeof createClient>,
  session: MvpSession,
  targetProfileId?: string,
) {
  if (!session.fixture_id) return [];

  const [playersRes, submissionsRes] = await Promise.all([
    serviceClient
      .from("revsports_players")
      .select("id, player_name, profile_id, team")
      .eq("fixture_id", session.fixture_id)
      .eq("attended", true)
      .not("profile_id", "is", null),
    serviceClient
      .from("mvp_vote_submissions")
      .select("voter_profile_id")
      .eq("session_id", session.id),
  ]);

  if (playersRes.error) throw playersRes.error;
  if (submissionsRes.error) throw submissionsRes.error;

  const submittedProfileIds = new Set(
    ((submissionsRes.data || []) as { voter_profile_id: string | null }[]).map((row) => row.voter_profile_id),
  );
  const seen = new Set<string>();

  return ((playersRes.data || []) as EligiblePlayer[])
    .filter((player) => player.profile_id && (player.team === null || player.team === "Grampians Hockey Club"))
    .filter((player) => !targetProfileId || player.profile_id === targetProfileId)
    .filter((player) => {
      if (!player.profile_id || submittedProfileIds.has(player.profile_id) || seen.has(player.profile_id)) return false;
      seen.add(player.profile_id);
      return true;
    });
}

async function loadProfiles(serviceClient: ReturnType<typeof createClient>, profileIds: string[]) {
  if (profileIds.length === 0) return new Map<string, Profile>();

  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", profileIds);

  if (error) throw error;
  return new Map(((data || []) as Profile[]).map((profile) => [profile.id, profile]));
}

async function hasSentEvent(serviceClient: ReturnType<typeof createClient>, sessionId: string, profileId: string, eventType: ReminderEvent) {
  if (eventType === "manual_resend") return false;

  const { data, error } = await serviceClient
    .from("mvp_voting_email_events")
    .select("id")
    .eq("session_id", sessionId)
    .eq("profile_id", profileId)
    .eq("event_type", eventType)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function claimEvent(
  serviceClient: ReturnType<typeof createClient>,
  sessionId: string,
  profileId: string,
  eventType: ReminderEvent,
  email: string | null,
) {
  if (eventType === "manual_resend") return null;

  const { data, error } = await serviceClient
    .from("mvp_voting_email_events")
    .insert({
      session_id: sessionId,
      profile_id: profileId,
      event_type: eventType,
      email,
      status: "sending",
    })
    .select("id")
    .single();

  if (!error) return data?.id as string | undefined;

  if (error.code === "23505") return null;
  throw error;
}

async function recordEvent(
  serviceClient: ReturnType<typeof createClient>,
  sessionId: string,
  profileId: string,
  eventType: ReminderEvent,
  email: string | null,
  status: "sent" | "skipped" | "failed",
  errorMessage?: string,
) {
  await serviceClient.from("mvp_voting_email_events").insert({
    session_id: sessionId,
    profile_id: profileId,
    event_type: eventType,
    email,
    status,
    error_message: errorMessage || null,
  });
}

async function finishClaimedEvent(
  serviceClient: ReturnType<typeof createClient>,
  eventId: string | null | undefined,
  status: "sent" | "failed",
  errorMessage?: string,
) {
  if (!eventId) return;

  await serviceClient
    .from("mvp_voting_email_events")
    .update({
      status,
      error_message: errorMessage || null,
    })
    .eq("id", eventId);
}

async function sendEmail(email: string, subject: string, html: string) {
  const apiKey = getEnv("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY Edge Function secret.");
  }

  const fromEmail = getEnv("MVP_REMINDER_FROM_EMAIL") || "SportStack <noreply@sportstackapp.com>";
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new EmailSendError(text || `Resend returned ${response.status}`, response.status);
  }
}

async function sendEmailWithRetry(email: string, subject: string, html: string) {
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

function buildEmailHtml(session: MvpSession, eventType: ReminderEvent, recipientName: string) {
  const voteUrl = `${normaliseSiteUrl()}/mvp-votes/${session.id}`;
  const intro = eventType === "opened"
    ? "MVP voting is now open for this match."
    : "This is a reminder to submit your MVP votes for this match.";

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <p>Hi ${recipientName},</p>
      <p>${intro}</p>
      <p><strong>${sessionTitle(session)}</strong></p>
      <p>Voting closes ${formatCloseTime(session.closes_at)} Melbourne time.</p>
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
  serviceClient: ReturnType<typeof createClient>,
  session: MvpSession,
  eventType: ReminderEvent,
  targetProfileId?: string,
) {
  const nonVoters = await loadNonVoters(serviceClient, session, targetProfileId);
  const profiles = await loadProfiles(serviceClient, nonVoters.map((player) => player.profile_id!).filter(Boolean));
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let sendAttempts = 0;

  for (const player of nonVoters) {
    const profileId = player.profile_id!;
    if (await hasSentEvent(serviceClient, session.id, profileId, eventType)) {
      skipped += 1;
      continue;
    }

    const { data: userData, error: userError } = await serviceClient.auth.admin.getUserById(profileId);
    const email = userData?.user?.email || null;
    if (userError || !email) {
      skipped += 1;
      await recordEvent(serviceClient, session.id, profileId, eventType, email, "skipped", userError?.message || "No auth email found.");
      continue;
    }

    const claimedEventId = await claimEvent(serviceClient, session.id, profileId, eventType, email);
    if (eventType !== "manual_resend" && !claimedEventId) {
      skipped += 1;
      continue;
    }

    try {
      if (sendAttempts > 0) {
        await sleep(EMAIL_SEND_DELAY_MS);
      }
      sendAttempts += 1;
      const name = profileName(profiles.get(profileId), player.player_name);
      await sendEmailWithRetry(email, `${eventTitle(eventType)} - ${sessionTitle(session)}`, buildEmailHtml(session, eventType, name));
      if (eventType === "manual_resend") {
        await recordEvent(serviceClient, session.id, profileId, eventType, email, "sent");
      } else {
        await finishClaimedEvent(serviceClient, claimedEventId, "sent");
      }
      sent += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Email failed.";
      if (eventType === "manual_resend") {
        await recordEvent(serviceClient, session.id, profileId, eventType, email, "failed", message);
      } else {
        await finishClaimedEvent(serviceClient, claimedEventId, "failed", message);
      }
    }
  }

  return { sent, skipped, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const serviceClient = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const auth = await authoriseRequest(req, serviceClient);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error }, auth.status);
    }

    const payload = (await req.json().catch(() => ({}))) as { action?: ReminderAction; session_id?: string; profile_id?: string };
    const action = payload.action || "scheduled";
    const eventFilter = action === "scheduled" ? null : action;
    const sessions = await loadSessions(serviceClient, action, payload.session_id);
    const now = new Date();
    const totals = { sessions: 0, sent: 0, skipped: 0, failed: 0 };

    for (const session of sessions) {
      const eventTypes: ReminderEvent[] = eventFilter
        ? [eventFilter === "manual_resend" ? "manual_resend" : eventFilter]
        : ["opened", "three_day_reminder", "one_day_reminder"];

      for (const eventType of eventTypes) {
        if (!shouldSendEvent(session, eventType, now)) continue;
        const result = await sendForEvent(serviceClient, session, eventType, payload.profile_id);
        totals.sessions += 1;
        totals.sent += result.sent;
        totals.skipped += result.skipped;
        totals.failed += result.failed;
      }
    }

    return jsonResponse({ success: true, action, ...totals });
  } catch (error) {
    console.error("mvp-voting-email-reminders: unexpected error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});

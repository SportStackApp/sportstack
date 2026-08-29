import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processDuePlayerExplorerSearches } from "../_shared/playerExplorerScheduled.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sportstack-cron-secret",
};

type NotificationWork = {
  work_type: "AVAILABILITY" | "BROADCAST" | "PLAYER_EXPLORER" | "COORDINATION" | "MVP_TALLY";
  delivery_id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body_text: string;
  action_url: string;
  idempotency_key?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_DELAY_MS = 750;
const RETRY_DELAYS_MS = [1500, 3000];
let lastSendStartedAt = 0;

const getEnv = (name: string) => Deno.env.get(name)?.trim() || "";
const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return replacements[character];
  });

async function sendEmail(work: NotificationWork) {
  const resendKey = getEnv("RESEND_API_KEY");
  const fromEmail =
    getEnv("SPORTSTACK_NOTIFICATION_FROM_EMAIL") ||
    getEnv("MVP_REMINDER_FROM_EMAIL") ||
    "SportStack <notifications@sportstackapp.com.au>";
  const appUrl = (
    getEnv("SPORTSTACK_APP_URL") || "https://dev.sportstackapp.com.au"
  ).replace(/\/$/, "");

  if (!resendKey) throw new Error("RESEND_API_KEY is not configured");

  const link = `${appUrl}${work.action_url}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#172033">
      <h2 style="margin-bottom:8px">${escapeHtml(work.subject)}</h2>
      <p>Hi ${escapeHtml(work.recipient_name)},</p>
      <p style="white-space:pre-line">${escapeHtml(work.body_text)}</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(link)}" style="background:#3158e6;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">
          Open SportStack
        </a>
      </p>
      <p style="font-size:12px;color:#667085">${work.work_type === "MVP_TALLY"
        ? "You can turn off Player MVP results email in your SportStack notification preferences."
        : "Coordination assignment notices are operational messages and are always sent while the capability is active."}</p>
    </div>`;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const delay = Math.max(0, SEND_DELAY_MS - (Date.now() - lastSendStartedAt));
    if (delay > 0) await sleep(delay);
    lastSendStartedAt = Date.now();

    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    };
    if (work.idempotency_key) requestHeaders["Idempotency-Key"] = work.idempotency_key;

    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({
        from: fromEmail,
        to: [work.recipient_email],
        subject: work.subject,
        html,
      }),
    });

    if (response.ok) return;
    const detail = await response.text();
    if (response.status !== 429 || attempt === RETRY_DELAYS_MS.length) {
      throw new Error(`Resend returned ${response.status}: ${detail.slice(0, 500)}`);
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    await sleep(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : RETRY_DELAYS_MS[attempt],
    );
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SERVICE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Supabase service configuration is missing" }, 500);
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const requestSecret = request.headers.get("x-sportstack-cron-secret") || "";
  const { data: authorised, error: authError } = await serviceClient.rpc(
    "verify_sportstack_notification_cron",
    { p_secret: requestSecret },
  );
  if (authError || authorised !== true) {
    return jsonResponse({ error: "Invalid scheduler request" }, 401);
  }

  let playerExplorer = { claimed: 0, completed: 0, partial: 0, failed: 0 };
  try {
    playerExplorer = await processDuePlayerExplorerSearches(serviceClient, sendEmail);
  } catch (playerExplorerError) {
    const message = playerExplorerError instanceof Error
      ? playerExplorerError.message
      : "Unknown Player Explorer scheduler error";
    console.error("Player Explorer scheduled work failed", message);
    playerExplorer.failed += 1;
  }

  const { data, error } = await serviceClient.rpc(
    "claim_sportstack_notification_work",
    { p_limit: 50 },
  );
  if (error) {
    console.error("Unable to claim notification work", error.message);
    return jsonResponse({ error: "Unable to claim notification work" }, 500);
  }

  const { data: tallyData, error: tallyError } = await serviceClient.rpc(
    "claim_mvp_tally_notification_work",
    { p_limit: 50 },
  );
  if (tallyError) {
    console.error("Unable to claim Player MVP tally notification work", tallyError.message);
    return jsonResponse({ error: "Unable to claim Player MVP tally notification work" }, 500);
  }

  const workItems = [...(data || []), ...(tallyData || [])] as NotificationWork[];
  let sent = 0;
  let failed = 0;

  for (const work of workItems) {
    try {
      await sendEmail(work);
      const completion = work.work_type === "MVP_TALLY"
        ? await serviceClient.rpc("complete_mvp_tally_notification_work", {
            p_delivery_id: work.delivery_id,
            p_success: true,
            p_error: null,
          })
        : await serviceClient.rpc("complete_sportstack_notification_work", {
            p_work_type: work.work_type,
            p_delivery_id: work.delivery_id,
            p_success: true,
            p_error: null,
          });
      const completionError = completion.error;
      if (completionError) throw completionError;
      sent += 1;
    } catch (sendError) {
      failed += 1;
      const message = sendError instanceof Error ? sendError.message : "Unknown email error";
      console.error(`Notification delivery ${work.delivery_id} failed`, message);
      if (work.work_type === "MVP_TALLY") {
        await serviceClient.rpc("complete_mvp_tally_notification_work", {
          p_delivery_id: work.delivery_id,
          p_success: false,
          p_error: message.slice(0, 1000),
        });
      } else {
        await serviceClient.rpc("complete_sportstack_notification_work", {
          p_work_type: work.work_type,
          p_delivery_id: work.delivery_id,
          p_success: false,
          p_error: message.slice(0, 1000),
        });
      }
    }
  }

  return jsonResponse({ claimed: workItems.length, sent, failed, player_explorer: playerExplorer });
});

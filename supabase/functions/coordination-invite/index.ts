import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type InvitePayload = {
  email: string;
  capability_type: "UMPIRE" | "TECHNICAL_BENCH" | "VOLUNTEER" | "SUPERVISING_UMPIRE";
  scope_type: "ASSOCIATION" | "CLUB" | "TEAM";
  scope_id: string;
  actor_mode: string;
};

const response = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return response({ error: "You must be signed in." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey) return response({ error: "Server configuration is incomplete." }, 500);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authHeader.slice("Bearer ".length);
  const { data: claims, error: claimsError } = await callerClient.auth.getClaims(token);
  if (claimsError || !claims?.claims?.sub) return response({ error: "Your sign-in is no longer valid." }, 401);

  let payload: InvitePayload;
  try {
    payload = await request.json() as InvitePayload;
  } catch {
    return response({ error: "The invitation details were not valid." }, 400);
  }

  const email = payload.email?.trim().toLowerCase();
  if (!email || !email.includes("@") || !payload.scope_id) return response({ error: "Email and organisation scope are required." }, 400);

  const { data: canInvite, error: permissionError } = await callerClient.rpc(
    "coordination_can_invite_capability",
    {
      p_capability_type: payload.capability_type,
      p_scope_type: payload.scope_type,
      p_scope_id: payload.scope_id,
      p_actor_mode: payload.actor_mode,
    },
  );
  if (permissionError || canInvite !== true) {
    return response({ error: "You cannot invite this capability in the selected scope." }, 403);
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let invitedUserId: string | null = null;
  let page = 1;
  while (!invitedUserId && page <= 10) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return response({ error: "Existing accounts could not be checked." }, 500);
    invitedUserId = data.users.find((account) => account.email?.toLowerCase() === email)?.id || null;
    if (data.users.length < 1000) break;
    page += 1;
  }

  let accountInviteSent = false;
  if (!invitedUserId) {
    const appUrl = (Deno.env.get("SPORTSTACK_APP_URL") || "https://dev.sportstackapp.com.au").replace(/\/$/, "");
    const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/coordination/my-assignments`,
    });
    if (error || !data.user) return response({ error: error?.message || "The account invitation could not be sent." }, 400);
    invitedUserId = data.user.id;
    accountInviteSent = true;
  }

  const { data: invitationId, error: invitationError } = await callerClient.rpc(
    "coordination_create_capability_invite",
    {
      p_user_id: invitedUserId,
      p_capability_type: payload.capability_type,
      p_scope_type: payload.scope_type,
      p_scope_id: payload.scope_id,
      p_actor_mode: payload.actor_mode,
    },
  );
  if (invitationError) return response({ error: invitationError.message }, 403);

  return response({ success: true, invitation_id: invitationId, account_invite_sent: accountInviteSent });
});

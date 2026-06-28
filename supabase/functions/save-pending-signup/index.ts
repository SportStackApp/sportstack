import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ServiceClient = ReturnType<typeof createClient>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PendingSignupPayload {
  email: string;
  first_name: string;
  last_name: string;
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normaliseEmail = (email: string) => email.trim().toLowerCase();

async function findUserIdByEmail(serviceClient: ServiceClient, email: string) {
  const targetEmail = normaliseEmail(email);
  let page = 1;

  while (page <= 20) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;

    const users = data?.users || [];
    const match = users.find((user) => normaliseEmail(user.email || "") === targetEmail);
    if (match?.id) return match.id as string;

    if (users.length < 1000) break;
    page += 1;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = (await req.json()) as PendingSignupPayload;
    const email = normaliseEmail(payload.email || "");
    const firstName = payload.first_name?.trim() || null;
    const lastName = payload.last_name?.trim() || null;

    if (!email || !firstName || !lastName) {
      return jsonResponse({ error: "Missing required details." }, 400);
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userId = await findUserIdByEmail(serviceClient, email);

    // Do not reveal whether an email exists in Auth.
    if (!userId) {
      console.warn("save-pending-signup: auth user not found for submitted email");
      return jsonResponse({ success: true });
    }

    const { error: pendingError } = await serviceClient
      .from("pending_signups")
      .upsert(
        {
          user_id: userId,
          first_name: firstName,
          last_name: lastName,
          association_id: payload.association_id || null,
          club_id: payload.club_id || null,
          team_id: payload.team_id || null,
        },
        { onConflict: "user_id" }
      );

    if (pendingError) {
      console.error("save-pending-signup: failed to save pending signup", pendingError);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("save-pending-signup: unexpected error", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

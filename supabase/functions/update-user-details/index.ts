import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.2";
import {
  buildProfileUpdate,
  isValidEmail,
  normaliseEmail,
  PROFILE_FIELDS,
  saveUserDetails,
} from "./logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return jsonResponse({ error: "Unauthorized" }, 401);

    const callerId = claimsData.claims.sub as string;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerRoles, error: rolesError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    if (rolesError) return jsonResponse({ error: "Could not verify caller roles" }, 500);

    const isSuperAdmin = (callerRoles ?? []).some((role) => role.role === "SUPER_ADMIN");
    if (!isSuperAdmin) {
      return jsonResponse({ error: "Forbidden: Super Admin access required" }, 403);
    }

    let body: Record<string, unknown> = {};
    let targetUserId: string | null = null;
    let isReadOnly = req.method === "GET";
    if (req.method === "GET") {
      targetUserId = req.headers.get("x-user-id");
    } else {
      body = await req.json().catch(() => ({}));
      targetUserId = typeof body.user_id === "string" ? body.user_id : null;
      isReadOnly = body.action === "get";
    }

    if (!targetUserId) return jsonResponse({ error: "Missing target user_id" }, 400);

    if (isReadOnly) {
      const { data: profile, error: profileError } = await serviceClient
        .from("profiles")
        .select(PROFILE_FIELDS.join(", "))
        .eq("id", targetUserId)
        .maybeSingle();
      if (profileError) return jsonResponse({ error: profileError.message }, 400);
      if (!profile) return jsonResponse({ error: "Profile not found" }, 404);

      const { data: authData, error: authError } = await serviceClient.auth.admin.getUserById(targetUserId);
      if (authError || !authData.user) {
        return jsonResponse({ error: `Authentication lookup failed: ${authError?.message || "User not found"}` }, 400);
      }

      return jsonResponse({ ...profile, email: authData.user.email ?? null });
    }

    const requestedEmail = typeof body.email === "string" ? normaliseEmail(body.email) : "";
    if (requestedEmail && !isValidEmail(requestedEmail)) {
      return jsonResponse({ error: "Enter a valid authentication email address." }, 400);
    }

    const result = await saveUserDetails({
      userId: targetUserId,
      requestedEmail,
      profileUpdate: buildProfileUpdate(body),
      isSuperAdmin: true,
      auth: {
        getUserById: async (userId) => {
          const { data, error } = await serviceClient.auth.admin.getUserById(userId);
          return { user: data.user, error };
        },
        updateEmail: async (userId, email) => {
          const { error } = await serviceClient.auth.admin.updateUserById(userId, { email });
          return { error };
        },
      },
      profiles: {
        updateProfile: async (userId, update) => {
          const { data, error } = await serviceClient
            .from("profiles")
            .update(update)
            .eq("id", userId)
            .select("id")
            .maybeSingle();
          return { error: error || (data ? null : { message: "Profile not found" }) };
        },
      },
    });

    if (!result.ok) return jsonResponse({ error: result.error, rollback_failed: result.rollbackFailed ?? false }, result.status);
    return jsonResponse({ success: true, email_changed: result.emailChanged });
  } catch (error) {
    console.error("update-user-details: unexpected error", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

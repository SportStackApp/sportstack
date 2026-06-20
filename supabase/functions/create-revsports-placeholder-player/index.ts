import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PlaceholderPlayerPayload {
  external_entity_id: string;
  revsports_player_id: string | null;
  first_name: string;
  last_name: string;
  gender: string | null;
  team_id: string;
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanToken = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const callerId = claimsData.claims.sub as string;
    const payload: PlaceholderPlayerPayload = await req.json();

    if (!payload.external_entity_id || !payload.first_name?.trim() || !payload.last_name?.trim() || !payload.team_id) {
      return jsonResponse({ error: "Missing required fields." }, 400);
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: callerRoles } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    const isSuperAdmin = (callerRoles || []).some((roleRow) => roleRow.role === "SUPER_ADMIN");
    if (!isSuperAdmin) {
      return jsonResponse({ error: "Only super admins can create RevSports placeholder players." }, 403);
    }

    const { data: existingLink } = await serviceClient
      .from("external_entity_links")
      .select("target_id")
      .eq("external_entity_id", payload.external_entity_id)
      .eq("target_table", "profiles")
      .eq("status", "matched")
      .maybeSingle();

    if (existingLink?.target_id) {
      return jsonResponse({ error: "This RevSports player is already linked." }, 409);
    }

    if (payload.revsports_player_id) {
      const { data: existingProfile } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("revsports_player_id", payload.revsports_player_id)
        .maybeSingle();

      if (existingProfile?.id) {
        return jsonResponse({ error: "A profile already has this RevSports player ID." }, 409);
      }
    }

    const emailToken = cleanToken(payload.revsports_player_id || payload.external_entity_id || crypto.randomUUID());
    const placeholderEmail = `placeholder+revsports-${emailToken}@sportstackapp.com`;

    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email: placeholderEmail,
      email_confirm: true,
      password: crypto.randomUUID(),
      user_metadata: {
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        is_placeholder: true,
        source: "revsports",
      },
    });

    if (createError || !newUser?.user?.id) {
      return jsonResponse({ error: createError?.message || "Could not create placeholder auth user." }, 400);
    }

    const profileId = newUser.user.id;

    const { error: profileError } = await serviceClient
      .from("profiles")
      .update({
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        gender: payload.gender || null,
        is_placeholder: true,
        revsports_player_id: payload.revsports_player_id || null,
      })
      .eq("id", profileId);

    if (profileError) {
      await serviceClient.auth.admin.deleteUser(profileId);
      return jsonResponse({ error: profileError.message }, 400);
    }

    const { error: membershipError } = await serviceClient
      .from("team_memberships")
      .insert({
        user_id: profileId,
        team_id: payload.team_id,
        membership_type: "PRIMARY",
        status: "ACTIVE",
      });

    if (membershipError) {
      await serviceClient.auth.admin.deleteUser(profileId);
      return jsonResponse({ error: membershipError.message }, 400);
    }

    await serviceClient
      .from("user_roles")
      .insert({
        user_id: profileId,
        role: "PLAYER",
        team_id: payload.team_id,
      });

    const { error: linkError } = await serviceClient
      .from("external_entity_links")
      .upsert(
        {
          external_entity_id: payload.external_entity_id,
          target_table: "profiles",
          target_id: profileId,
          status: "matched",
          confidence: "manual",
          matched_by: callerId,
          matched_at: new Date().toISOString(),
          notes: "Created placeholder player from RevSports review.",
        },
        { onConflict: "external_entity_id,target_table" }
      );

    if (linkError) {
      await serviceClient.auth.admin.deleteUser(profileId);
      return jsonResponse({ error: linkError.message }, 400);
    }

    return jsonResponse({ success: true, profile_id: profileId });
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

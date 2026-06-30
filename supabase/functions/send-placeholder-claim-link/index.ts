import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type AdminRole = {
  role: string;
  association_id: string | null;
  club_id: string | null;
  team_id: string | null;
};

type TeamMembership = {
  team_id: string;
  teams: {
    club_id: string | null;
    clubs: {
      association_id: string | null;
    } | null;
  } | null;
};

type ClaimLinkPayload = {
  placeholder_profile_id?: string;
  email?: string;
};

const ADMIN_ROLES = ["SUPER_ADMIN", "ASSOCIATION_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"];

const normaliseEmail = (value: string) => value.trim().toLowerCase();

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const hasAdminScopeForPlaceholder = (roles: AdminRole[], memberships: TeamMembership[]) => {
  if (roles.some((role) => role.role === "SUPER_ADMIN")) return true;

  return memberships.some((membership) => {
    const clubId = membership.teams?.club_id;
    const associationId = membership.teams?.clubs?.association_id;

    return roles.some((role) => {
      if (!ADMIN_ROLES.includes(role.role)) return false;
      if (role.role === "ASSOCIATION_ADMIN") return role.association_id === associationId;
      if (role.role === "CLUB_ADMIN") return role.club_id === clubId;
      if (role.role === "TEAM_MANAGER" || role.role === "COACH") return role.team_id === membership.team_id;
      return false;
    });
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
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
    const payload = (await req.json()) as ClaimLinkPayload;
    const placeholderProfileId = payload.placeholder_profile_id;
    const email = payload.email ? normaliseEmail(payload.email) : "";

    if (!placeholderProfileId || !email) {
      return jsonResponse({ error: "Missing placeholder profile or email address." }, 400);
    }

    if (!isValidEmail(email)) {
      return jsonResponse({ error: "Enter a valid email address." }, 400);
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: callerRoles, error: rolesError } = await serviceClient
      .from("user_roles")
      .select("role, association_id, club_id, team_id")
      .eq("user_id", callerId);

    if (rolesError) {
      console.error("send-placeholder-claim-link: caller role lookup failed", rolesError);
      return jsonResponse({ error: "Could not check your admin access." }, 500);
    }

    if (!callerRoles || callerRoles.length === 0) {
      return jsonResponse({ error: "You do not have admin access." }, 403);
    }

    const { data: placeholder, error: placeholderError } = await serviceClient
      .from("profiles")
      .select("id, first_name, last_name, is_placeholder, revsports_player_id")
      .eq("id", placeholderProfileId)
      .maybeSingle();

    if (placeholderError) {
      console.error("send-placeholder-claim-link: placeholder lookup failed", placeholderError);
      return jsonResponse({ error: "Could not check the placeholder profile." }, 500);
    }

    if (!placeholder || placeholder.is_placeholder !== true) {
      return jsonResponse({ error: "This profile is not a placeholder profile." }, 400);
    }

    const { data: memberships, error: membershipError } = await serviceClient
      .from("team_memberships")
      .select("team_id, teams(club_id, clubs(association_id))")
      .eq("user_id", placeholderProfileId);

    if (membershipError) {
      console.error("send-placeholder-claim-link: membership lookup failed", membershipError);
      return jsonResponse({ error: "Could not check the placeholder team access." }, 500);
    }

    if (!hasAdminScopeForPlaceholder(callerRoles as AdminRole[], (memberships || []) as TeamMembership[])) {
      return jsonResponse({ error: "You do not have permission to send a claim link for this profile." }, 403);
    }

    const { data: existingApprovedClaim, error: existingClaimError } = await serviceClient
      .from("profile_claim_reviews")
      .select("id")
      .eq("placeholder_profile_id", placeholderProfileId)
      .eq("status", "approved")
      .maybeSingle();

    if (existingClaimError) {
      console.error("send-placeholder-claim-link: existing claim lookup failed", existingClaimError);
      return jsonResponse({ error: "Could not check for an existing claim link." }, 500);
    }

    if (existingApprovedClaim) {
      return jsonResponse({ error: "A claim link has already been sent for this placeholder profile." }, 409);
    }

    const redirectTo = `${req.headers.get("origin") || "https://sportstackapp.com"}/`;

    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name: placeholder.first_name,
        last_name: placeholder.last_name,
        placeholder_profile_id: placeholderProfileId,
      },
      redirectTo,
    });

    if (inviteError || !inviteData?.user?.id) {
      console.error("send-placeholder-claim-link: invite failed", inviteError);
      return jsonResponse({ error: inviteError?.message || "Could not send the claim link." }, 400);
    }

    const realProfileId = inviteData.user.id;

    const { error: profileError } = await serviceClient.from("profiles").upsert({
      id: realProfileId,
      first_name: placeholder.first_name,
      last_name: placeholder.last_name,
      is_placeholder: false,
      revsports_player_id: placeholder.revsports_player_id,
    });

    if (profileError) {
      console.error("send-placeholder-claim-link: real profile upsert failed", profileError);
      return jsonResponse({ error: "The invite was sent, but the real profile could not be prepared." }, 500);
    }

    const { error: reviewError } = await serviceClient
      .from("profile_claim_reviews")
      .insert({
        real_profile_id: realProfileId,
        placeholder_profile_id: placeholderProfileId,
        status: "approved",
        match_method: "admin_approved",
        match_value: email,
        reason: "claim link sent by admin",
        reviewed_by: callerId,
        reviewed_at: new Date().toISOString(),
      });

    if (reviewError) {
      console.error("send-placeholder-claim-link: review insert failed", reviewError);
      return jsonResponse({ error: "The invite was sent, but the claim approval could not be recorded." }, 500);
    }

    await serviceClient.from("profile_claim_audit").insert({
      real_profile_id: realProfileId,
      placeholder_profile_id: placeholderProfileId,
      status: "claim_link_sent",
      match_method: "admin_approved",
      match_value: email,
      reason: "admin sent placeholder claim link",
    });

    return jsonResponse({
      success: true,
      real_profile_id: realProfileId,
      placeholder_profile_id: placeholderProfileId,
    });
  } catch (err) {
    console.error("send-placeholder-claim-link: unexpected error", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

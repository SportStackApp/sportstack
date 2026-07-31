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
  profile_id?: string;
  email?: string;
};

type AuthUserSummary = {
  id: string;
  email?: string | null;
};

const ADMIN_ROLES = ["SUPER_ADMIN", "ASSOCIATION_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"];
const DEFAULT_APP_URL = "https://sportstack.grampianshockey.com.au";

const normaliseEmail = (value: string) => value.trim().toLowerCase();

const getAppBaseUrl = (req: Request) =>
  (req.headers.get("origin")?.trim() || Deno.env.get("SPORTSTACK_APP_URL")?.trim() || DEFAULT_APP_URL)
    .replace(/\/+$/, "");

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const formatMissingRequirements = (missing: string[]) =>
  `Add ${missing.join(", ")} before sending this link.`;

const findAuthUserByEmail = async (serviceClient: ReturnType<typeof createClient>, email: string) => {
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    const users = (data?.users || []) as AuthUserSummary[];
    const matchingUser = users.find((user) => user.email && normaliseEmail(user.email) === email);

    if (matchingUser) {
      return matchingUser;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }
};

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

  const appBaseUrl = getAppBaseUrl(req);

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
    const profileId = payload.profile_id;
    const email = payload.email ? normaliseEmail(payload.email) : "";

    if (!profileId) {
      return jsonResponse({ error: "Missing profile." }, 400);
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
      console.error("send-profile-access-link: caller role lookup failed", rolesError);
      return jsonResponse({ error: "Could not check your admin access." }, 500);
    }

    if (!callerRoles || callerRoles.length === 0) {
      return jsonResponse({ error: "You do not have admin access." }, 403);
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, first_name, last_name, is_placeholder, revsports_player_id")
      .eq("id", profileId)
      .maybeSingle();

    if (profileError) {
      console.error("send-profile-access-link: profile lookup failed", profileError);
      return jsonResponse({ error: "Could not check the profile." }, 500);
    }

    if (!profile) {
      return jsonResponse({ error: "Profile not found." }, 404);
    }

    const { data: memberships, error: membershipError } = await serviceClient
      .from("team_memberships")
      .select("team_id, teams(club_id, clubs(association_id))")
      .eq("user_id", profileId);

    if (membershipError) {
      console.error("send-profile-access-link: membership lookup failed", membershipError);
      return jsonResponse({ error: "Could not check the profile team access." }, 500);
    }

    if (!hasAdminScopeForPlaceholder(callerRoles as AdminRole[], (memberships || []) as TeamMembership[])) {
      return jsonResponse({ error: "You do not have permission to send an access link for this profile." }, 403);
    }

    const missingRequirements: string[] = [];
    if (!profile.first_name?.trim()) missingRequirements.push("first name");
    if (!profile.last_name?.trim()) missingRequirements.push("last name");

    const { data: activePrimaryMembership, error: primaryMembershipError } = await serviceClient
      .from("team_memberships")
      .select("id")
      .eq("user_id", profileId)
      .eq("membership_type", "PRIMARY")
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle();

    if (primaryMembershipError) {
      console.error("send-profile-access-link: primary membership lookup failed", primaryMembershipError);
      return jsonResponse({ error: "Could not check the primary team membership." }, 500);
    }

    if (!activePrimaryMembership) missingRequirements.push("active primary team");

    if (missingRequirements.length > 0) {
      return jsonResponse({ error: formatMissingRequirements(missingRequirements), missing_requirements: missingRequirements }, 400);
    }

    if (profile.is_placeholder !== true) {
      const { data: authUser, error: authUserError } = await serviceClient.auth.admin.getUserById(profileId);
      const accountEmail = authUser?.user?.email ? normaliseEmail(authUser.user.email) : "";

      if (authUserError || !accountEmail) {
        return jsonResponse({ error: "Add an account email before sending a password reset link." }, 400);
      }

      const { error: resetError } = await serviceClient.auth.resetPasswordForEmail(accountEmail, {
        redirectTo: `${appBaseUrl}/reset-password`,
      });

      if (resetError) {
        console.error("send-profile-access-link: password reset failed", resetError);
        return jsonResponse({ error: resetError.message || "Could not send the password reset link." }, 400);
      }

      return jsonResponse({
        success: true,
        link_type: "password_reset",
        profile_id: profileId,
      });
    }

    if (!email) {
      return jsonResponse({ error: "Enter the player's real email address." }, 400);
    }

    if (!isValidEmail(email)) {
      return jsonResponse({ error: "Enter a valid email address." }, 400);
    }

    const { data: existingApprovedClaim, error: existingClaimError } = await serviceClient
      .from("profile_claim_reviews")
      .select("id")
      .eq("placeholder_profile_id", profileId)
      .eq("status", "approved")
      .maybeSingle();

    if (existingClaimError) {
      console.error("send-profile-access-link: existing claim lookup failed", existingClaimError);
      return jsonResponse({ error: "Could not check for an existing claim link." }, 500);
    }

    if (existingApprovedClaim) {
      return jsonResponse({ error: "A claim link has already been sent for this placeholder profile." }, 409);
    }

    const redirectTo = `${appBaseUrl}/`;
    const passwordResetRedirectTo = `${appBaseUrl}/reset-password`;

    let existingAuthUser: AuthUserSummary | null = null;
    try {
      existingAuthUser = await findAuthUserByEmail(serviceClient, email);
    } catch (lookupError) {
      console.error("send-profile-access-link: auth email lookup failed", lookupError);
      return jsonResponse({ error: "Could not check whether that email already has an account." }, 500);
    }

    if (existingAuthUser) {
      const realProfileId = existingAuthUser.id;

      if (realProfileId === profileId) {
        const { error: profileActivationError } = await serviceClient.from("profiles").upsert({
          id: profileId,
          first_name: profile.first_name,
          last_name: profile.last_name,
          is_placeholder: false,
          revsports_player_id: profile.revsports_player_id,
        });

        if (profileActivationError) {
          console.error("send-profile-access-link: placeholder account activation failed", profileActivationError);
          return jsonResponse({ error: "Could not activate this account." }, 500);
        }

        await serviceClient.from("profile_claim_audit").insert({
          real_profile_id: profileId,
          placeholder_profile_id: profileId,
          status: "placeholder_account_activated",
          match_method: "admin_approved",
          match_value: email,
          reason: "admin activated placeholder profile that already had the real account email",
        });

        const { error: resetError } = await serviceClient.auth.resetPasswordForEmail(email, {
          redirectTo: passwordResetRedirectTo,
        });

        if (resetError) {
          console.error("send-profile-access-link: placeholder account password reset failed", resetError);
          return jsonResponse({ error: resetError.message || "The account was activated, but the email could not be sent." }, 400);
        }

        return jsonResponse({
          success: true,
          link_type: "existing_account_claim",
          real_profile_id: profileId,
          placeholder_profile_id: profileId,
        });
      }

      const { data: realProfile, error: realProfileLookupError } = await serviceClient
        .from("profiles")
        .select("id, first_name, last_name, is_placeholder")
        .eq("id", realProfileId)
        .maybeSingle();

      if (realProfileLookupError) {
        console.error("send-profile-access-link: existing real profile lookup failed", realProfileLookupError);
        return jsonResponse({ error: "Could not prepare the existing account for this claim." }, 500);
      }

      if (realProfile?.is_placeholder === true) {
        return jsonResponse({ error: "That email belongs to another placeholder profile. Merge the profiles manually first." }, 409);
      }

      const { error: realProfileError } = await serviceClient.from("profiles").upsert({
        id: realProfileId,
        first_name: realProfile?.first_name?.trim() || profile.first_name,
        last_name: realProfile?.last_name?.trim() || profile.last_name,
        is_placeholder: false,
        // The placeholder still owns its unique RevSports ID. The approved
        // claim transfers it atomically after the placeholder is archived.
      });

      if (realProfileError) {
        console.error("send-profile-access-link: existing profile upsert failed", realProfileError);
        return jsonResponse({ error: "Could not prepare the existing account for this claim." }, 500);
      }

      const { error: reviewError } = await serviceClient
        .from("profile_claim_reviews")
        .insert({
          real_profile_id: realProfileId,
          placeholder_profile_id: profileId,
          status: "approved",
          match_method: "admin_approved",
          match_value: email,
          reason: "existing account linked by admin",
          reviewed_by: callerId,
          reviewed_at: new Date().toISOString(),
        });

      if (reviewError) {
        console.error("send-profile-access-link: existing account review insert failed", reviewError);
        return jsonResponse({ error: "The existing account was found, but the claim approval could not be recorded." }, 500);
      }

      await serviceClient.from("profile_claim_audit").insert({
        real_profile_id: realProfileId,
        placeholder_profile_id: profileId,
        status: "existing_account_linked",
        match_method: "admin_approved",
        match_value: email,
        reason: "admin linked placeholder to existing account email",
      });

      const { error: resetError } = await serviceClient.auth.resetPasswordForEmail(email, {
        redirectTo: passwordResetRedirectTo,
      });

      if (resetError) {
        console.error("send-profile-access-link: existing account password reset failed", resetError);
        return jsonResponse({ error: resetError.message || "The account was linked, but the email could not be sent." }, 400);
      }

      return jsonResponse({
        success: true,
        link_type: "existing_account_claim",
        real_profile_id: realProfileId,
        placeholder_profile_id: profileId,
      });
    }

    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name: profile.first_name,
        last_name: profile.last_name,
        placeholder_profile_id: profileId,
      },
      redirectTo,
    });

    if (inviteError || !inviteData?.user?.id) {
      console.error("send-profile-access-link: invite failed", inviteError);
      return jsonResponse({ error: inviteError?.message || "Could not send the claim link." }, 400);
    }

    const realProfileId = inviteData.user.id;

    const { error: realProfileError } = await serviceClient.from("profiles").upsert({
      id: realProfileId,
      first_name: profile.first_name,
      last_name: profile.last_name,
      is_placeholder: false,
      // Do not copy the placeholder's unique RevSports ID before the claim.
      // claim_placeholder_profile transfers it during the merge.
    });

    if (realProfileError) {
      console.error("send-profile-access-link: real profile upsert failed", realProfileError);
      return jsonResponse({ error: "The invite was sent, but the real profile could not be prepared." }, 500);
    }

    const { error: reviewError } = await serviceClient
      .from("profile_claim_reviews")
      .insert({
        real_profile_id: realProfileId,
        placeholder_profile_id: profileId,
        status: "approved",
        match_method: "admin_approved",
        match_value: email,
        reason: "claim link sent by admin",
        reviewed_by: callerId,
        reviewed_at: new Date().toISOString(),
      });

    if (reviewError) {
      console.error("send-profile-access-link: review insert failed", reviewError);
      return jsonResponse({ error: "The invite was sent, but the claim approval could not be recorded." }, 500);
    }

    await serviceClient.from("profile_claim_audit").insert({
      real_profile_id: realProfileId,
      placeholder_profile_id: profileId,
      status: "claim_link_sent",
      match_method: "admin_approved",
      match_value: email,
      reason: "admin sent placeholder claim link",
    });

    return jsonResponse({
      success: true,
      link_type: "claim",
      real_profile_id: realProfileId,
      placeholder_profile_id: profileId,
    });
  } catch (err) {
    console.error("send-profile-access-link: unexpected error", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

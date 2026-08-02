import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEV_PROJECT_URL = "https://icqegnpjbizccjebjfhb.supabase.co";
const TEST_ROLE_CONFIG = {
  ASSOCIATION_ADMIN: {
    email: "codex.association-admin.dev@sportstackapp.com.au",
    label: "Association Admin",
  },
  CLUB_ADMIN: {
    email: "codex.club-admin.dev@sportstackapp.com.au",
    label: "Club Admin",
  },
  TEAM_MANAGER: {
    email: "codex.team-manager.dev@sportstackapp.com.au",
    label: "Team Manager",
  },
  COACH: {
    email: "codex.coach.dev@sportstackapp.com.au",
    label: "Coach",
  },
  PLAYER: {
    email: "codex.player.dev@sportstackapp.com.au",
    label: "Player",
  },
  UMPIRE: {
    email: "codex.umpire.dev@sportstackapp.com.au",
    label: "Umpire",
  },
  VOTER: {
    email: "codex.voter.dev@sportstackapp.com.au",
    label: "Voter",
  },
};

interface TestAccountPayload {
  email: string;
  password: string;
  role: string;
  association_id?: string | null;
  club_id?: string | null;
  team_id?: string | null;
}

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const projectUrl = Deno.env.get("SUPABASE_URL");
  if (projectUrl !== DEV_PROJECT_URL) {
    return respond({ error: "This function is restricted to SportStack Dev." }, 403);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return respond({ error: "Unauthorized." }, 401);

  try {
    const callerClient = createClient(
      projectUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.slice("Bearer ".length);
    // Ask Supabase Auth to validate the user against the live Auth service.
    // A locally valid JWT alone is not enough for this privileged Dev tool.
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
    const callerId = callerData.user?.id;
    if (callerError || !callerId) return respond({ error: "Unauthorized." }, 401);

    // The session id lets the database confirm that this exact login session
    // still exists and has not expired or been revoked.
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    const claimsCallerId = claimsData?.claims?.sub as string | undefined;
    const callerSessionId = claimsData?.claims?.session_id as string | undefined;
    if (
      claimsError
      || claimsCallerId !== callerId
      || !callerSessionId
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(callerSessionId)
    ) {
      return respond({ error: "Unauthorized." }, 401);
    }

    const serviceClient = createClient(
      projectUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: callerAuthorised, error: callerAuthorisationError } = await serviceClient.rpc(
      "authorise_dev_test_account_provisioning",
      { p_user_id: callerId, p_session_id: callerSessionId },
    );
    if (callerAuthorisationError || callerAuthorised !== true) {
      return respond({ error: "Only a Super Admin can create Dev test accounts." }, 403);
    }

    const payload = (await req.json()) as TestAccountPayload;
    const email = payload.email?.trim().toLowerCase();
    const role = payload.role?.trim().toUpperCase();
    const roleConfig = role
      ? TEST_ROLE_CONFIG[role as keyof typeof TEST_ROLE_CONFIG]
      : undefined;
    if (!roleConfig) {
      return respond({ error: "That test role is not supported." }, 400);
    }
    if (!email || email !== roleConfig.email) {
      return respond({ error: "The reserved Dev test email does not match the selected role." }, 400);
    }
    if (!payload.password || payload.password.length < 16) {
      return respond({ error: "The temporary password must be at least 16 characters." }, 400);
    }
    const testLastName = `${roleConfig.label} Test`;

    const teamScopedRole = ["TEAM_MANAGER", "COACH", "PLAYER"].includes(role);
    if (
      (role === "ASSOCIATION_ADMIN" && !payload.association_id)
      || (role === "CLUB_ADMIN" && (!payload.association_id || !payload.club_id))
      || (teamScopedRole && (!payload.association_id || !payload.club_id || !payload.team_id))
    ) {
      return respond({ error: "The selected role requires its organisation scope." }, 400);
    }

    let associationId: string | null = null;
    let clubId: string | null = null;
    let teamId: string | null = null;
    if (role === "ASSOCIATION_ADMIN") {
      const { data: association, error: associationError } = await serviceClient
        .from("associations")
        .select("id")
        .eq("id", payload.association_id)
        .maybeSingle();
      if (associationError || !association) return respond({ error: "The selected association was not found." }, 400);
      associationId = association.id;
    } else if (role === "CLUB_ADMIN" || teamScopedRole) {
      const { data: club, error: clubError } = await serviceClient
        .from("clubs")
        .select("id, association_id")
        .eq("id", payload.club_id)
        .maybeSingle();
      if (clubError || !club || club.association_id !== payload.association_id) {
        return respond({ error: "The selected club does not belong to that association." }, 400);
      }
      associationId = club.association_id;
      clubId = club.id;
    }
    if (teamScopedRole) {
      const { data: team, error: teamError } = await serviceClient
        .from("teams")
        .select("id, club_id")
        .eq("id", payload.team_id)
        .maybeSingle();
      if (teamError || !team || team.club_id !== clubId) {
        return respond({ error: "The selected team does not belong to that club." }, 400);
      }
      teamId = team.id;
    }

    // Existing Auth identities are deliberately not re-scoped or password-
    // reset here. Creating the fixed reserved email is atomic in Auth, so an
    // existing identity is rejected without listing or changing any users.
    // This also avoids Supabase Auth's list-users endpoint, which cannot scan
    // the permanent banned_until = infinity values used by Dev placeholders.
    const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { first_name: "Codex", last_name: testLastName },
      app_metadata: { sportstack_dev_test: true },
    });
    if (createError || !createdUser.user) {
      const existingIdentity = createError?.code === "email_exists";
      return respond({
        error: existingIdentity
          ? "That Dev test account already exists and cannot be reset automatically."
          : createError?.message || "The Dev test account could not be created.",
      }, existingIdentity ? 409 : 400);
    }

    const userId = createdUser.user.id;

    const rollbackNewUser = async () => {
      const { error: rollbackError } = await serviceClient.auth.admin.deleteUser(userId);
      if (rollbackError) {
        console.error("New Dev test Auth user could not be rolled back", {
          userId,
          message: rollbackError.message,
        });
      }
    };

    // All profile, role, membership and audit writes happen in one database
    // transaction. The newly-created Auth user is removed if that transaction
    // fails, so an account is never left without its intended database scope.
    const { data: provisionedAccount, error: provisionError } = await serviceClient.rpc(
      "provision_dev_test_account_data",
      {
        p_actor_id: callerId,
        p_user_id: userId,
        p_email: email,
        p_role: role,
        p_association_id: associationId,
        p_club_id: clubId,
        p_team_id: teamId,
        p_created: true,
      },
    );
    if (provisionError) {
      console.error("Dev test account database transaction failed", {
        code: provisionError.code,
        message: provisionError.message,
      });
      await rollbackNewUser();
      return respond({ error: "The Dev test account data could not be saved." }, 500);
    }

    return respond({
      success: true,
      created: true,
      user_id: userId,
      email,
      role,
      data: provisionedAccount,
    });
  } catch (error) {
    console.error("provision-dev-test-account failed", error);
    return respond({ error: "The Dev test account could not be provisioned." }, 500);
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TeamAssignment {
  team_id: string;
  membership_type: "PRIMARY" | "SECONDARY" | "FILL_IN";
}

interface PlayerPayload {
  email: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  date_of_birth: string | null;
  phone: string | null;
  suburb: string | null;
  hockey_vic_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  team_assignments: TeamAssignment[];
}

const ADMIN_ROLES = ["SUPER_ADMIN", "ASSOCIATION_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub as string;
    const payload: PlayerPayload = await req.json();

    if (!payload.email || !payload.first_name || !payload.last_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, first_name, last_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payload.team_assignments || payload.team_assignments.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one team assignment is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hasPrimary = payload.team_assignments.some((ta) => ta.membership_type === "PRIMARY");
    if (!hasPrimary) {
      return new Response(
        JSON.stringify({ error: "A PRIMARY team assignment is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch caller's roles
    const { data: callerRoles } = await serviceClient
      .from("user_roles")
      .select("role, association_id, club_id, team_id")
      .eq("user_id", callerId);

    if (!callerRoles || callerRoles.length === 0) {
      return new Response(JSON.stringify({ error: "No admin roles found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSuperAdmin = callerRoles.some((r) => r.role === "SUPER_ADMIN");

    // Scope-check each team assignment
    if (!isSuperAdmin) {
      const allTeamIds = payload.team_assignments.map((ta) => ta.team_id);

      const { data: targetTeams } = await serviceClient
        .from("teams")
        .select("id, club_id")
        .in("id", allTeamIds);

      if (!targetTeams || targetTeams.length !== allTeamIds.length) {
        return new Response(JSON.stringify({ error: "One or more teams not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const clubIds = [...new Set(targetTeams.map((t) => t.club_id))];
      const { data: targetClubs } = await serviceClient
        .from("clubs")
        .select("id, association_id")
        .in("id", clubIds);

      const clubMap = new Map((targetClubs || []).map((c) => [c.id, c]));

      for (const tt of targetTeams) {
        const club = clubMap.get(tt.club_id);
        let hasScope = false;

        for (const cr of callerRoles) {
          if (!ADMIN_ROLES.includes(cr.role)) continue;
          if (cr.role === "ASSOCIATION_ADMIN" && cr.association_id && club) {
            if (cr.association_id === club.association_id) { hasScope = true; break; }
          }
          if (cr.role === "CLUB_ADMIN" && cr.club_id) {
            if (cr.club_id === tt.club_id) { hasScope = true; break; }
          }
          if ((cr.role === "TEAM_MANAGER" || cr.role === "COACH") && cr.team_id) {
            if (cr.team_id === tt.id) { hasScope = true; break; }
          }
        }

        if (!hasScope) {
          return new Response(
            JSON.stringify({ error: `You do not have permission to assign players to team ${tt.id}` }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Invite user by email — player sets their own password via the link
    const { data: newUser, error: createError } = await serviceClient.auth.admin.inviteUserByEmail(
      payload.email,
      { data: { first_name: payload.first_name, last_name: payload.last_name } }
    );

    if (createError) {
      const isDuplicate = createError.message?.toLowerCase().includes("already been registered") ||
        createError.message?.toLowerCase().includes("already exists") ||
        createError.message?.toLowerCase().includes("duplicate");
      const errorMessage = isDuplicate
        ? `A user with email '${payload.email}' already exists. Use Bulk Import to add them to additional teams.`
        : createError.message;
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = newUser.user.id;

    // Update profile
    await serviceClient
      .from("profiles")
      .update({
        first_name: payload.first_name,
        last_name: payload.last_name,
        gender: payload.gender || null,
        date_of_birth: payload.date_of_birth || null,
        phone: payload.phone || null,
        suburb: payload.suburb || null,
        hockey_vic_number: payload.hockey_vic_number || null,
        emergency_contact_name: payload.emergency_contact_name || null,
        emergency_contact_phone: payload.emergency_contact_phone || null,
        emergency_contact_relationship: payload.emergency_contact_relationship || null,
      })
      .eq("id", userId);

    // Insert team memberships & player roles for each assignment
    for (const ta of payload.team_assignments) {
      await serviceClient.from("team_memberships").insert({
        user_id: userId,
        team_id: ta.team_id,
        membership_type: ta.membership_type,
        status: "ACTIVE",
      });

      await serviceClient.from("user_roles").insert({
        user_id: userId,
        role: "PLAYER",
        team_id: ta.team_id,
      });
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

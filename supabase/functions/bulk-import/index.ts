import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PlayerRow {
  first_name: string;
  last_name: string;
  email: string | null;
  gender: string | null;
  date_of_birth: string | null;
  hockey_vic_number: string | null;
  phone: string | null;
  suburb: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  team_id: string;
  row_number: number;
  is_primary_team: boolean;
  role: string | null;
}

interface Payload {
  association_id: string;
  players: PlayerRow[];
}

const VALID_ROLES = ["PLAYER", "COACH", "TEAM_MANAGER", "CLUB_ADMIN", "ASSOCIATION_ADMIN"];

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
    const payload: Payload = await req.json();

    if (!payload.association_id || !payload.players || payload.players.length === 0) {
      return new Response(
        JSON.stringify({ error: "association_id and at least one player required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller has admin role
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

    if (!isSuperAdmin) {
      const hasAssocScope = callerRoles.some(
        (r) => r.role === "ASSOCIATION_ADMIN" && r.association_id === payload.association_id
      );

      if (!hasAssocScope) {
        const { data: assocClubs } = await serviceClient
          .from("clubs")
          .select("id")
          .eq("association_id", payload.association_id);
        const assocClubIds = new Set((assocClubs || []).map((c) => c.id));

        const hasClubScope = callerRoles.some(
          (r) => r.role === "CLUB_ADMIN" && r.club_id && assocClubIds.has(r.club_id)
        );

        if (!hasClubScope) {
          const { data: assocTeams } = await serviceClient
            .from("teams")
            .select("id, club_id")
            .in("club_id", Array.from(assocClubIds));
          const assocTeamIds = new Set((assocTeams || []).map((t) => t.id));

          const hasTeamScope = callerRoles.some(
            (r) =>
              (r.role === "TEAM_MANAGER" || r.role === "COACH") &&
              r.team_id &&
              assocTeamIds.has(r.team_id)
          );

          if (!hasTeamScope) {
            return new Response(
              JSON.stringify({ error: "You do not have permission for this association" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // Pre-fetch all auth users for email lookup (to avoid repeated listUsers calls)
    const allEmails = new Set<string>();
    const { data: userList } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
    const authUsers = userList?.users || [];
    for (const u of authUsers) {
      if (u.email) allEmails.add(u.email.toLowerCase());
    }

    // Helper: generate unique mock email
    function generateMockEmail(firstName: string, lastName: string): string {
      const base = `${firstName.toLowerCase().replace(/[^a-z]/g, "")}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}`;
      let candidate = `${base}@grampianshockey.mock`;
      if (!allEmails.has(candidate)) {
        allEmails.add(candidate);
        return candidate;
      }
      let suffix = 2;
      while (true) {
        candidate = `${base}${suffix}@grampianshockey.mock`;
        if (!allEmails.has(candidate)) {
          allEmails.add(candidate);
          return candidate;
        }
        suffix++;
      }
    }

    // Helper: find existing user by email
    function findUserByEmail(email: string): string | null {
      const match = authUsers.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );
      return match ? match.id : null;
    }

    // Helper: determine role and scope for user_roles insert
    async function getRoleInsertData(
      player: PlayerRow,
      callerIsSuperAdmin: boolean,
      svcClient: any
    ) {
      let role = "PLAYER";
      if (callerIsSuperAdmin && player.role && VALID_ROLES.includes(player.role.toUpperCase())) {
        role = player.role.toUpperCase();
      }

      const scopeData: { role: string; team_id?: string; club_id?: string; association_id?: string } = { role };

      if (role === "PLAYER" || role === "COACH" || role === "TEAM_MANAGER") {
        scopeData.team_id = player.team_id;
      } else if (role === "CLUB_ADMIN") {
        // Look up club_id from team
        const { data: team } = await svcClient
          .from("teams")
          .select("club_id")
          .eq("id", player.team_id)
          .maybeSingle();
        scopeData.club_id = team?.club_id || null;
      } else if (role === "ASSOCIATION_ADMIN") {
        scopeData.association_id = payload.association_id;
      }

      return scopeData;
    }

    // Process each player
    const created: number[] = [];
    const added: number[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (const player of payload.players) {
      try {
        if (!player.first_name || !player.last_name) {
          errors.push({ row: player.row_number, error: "Missing first or last name" });
          continue;
        }
        if (!player.team_id) {
          errors.push({ row: player.row_number, error: "No team resolved" });
          continue;
        }

        // Fix 1: auto-generate mock email if none provided
        const email = player.email?.trim()
          ? player.email.trim()
          : generateMockEmail(player.first_name, player.last_name);

        const isPrimary = player.is_primary_team !== false;
        const membershipType = isPrimary ? "PRIMARY" : "PERMANENT";

        const existingUserId = findUserByEmail(email);

        if (existingUserId) {
          // User exists
          if (isPrimary) {
            const { data: existingMemberships } = await serviceClient
              .from("team_memberships")
              .select("id, team_id, membership_type")
              .eq("user_id", existingUserId)
              .eq("membership_type", "PRIMARY")
              .eq("status", "ACTIVE");

            if (existingMemberships && existingMemberships.length > 0) {
              const primaryTeamIds = existingMemberships.map((m) => m.team_id);
              const { data: primaryTeams } = await serviceClient
                .from("teams")
                .select("id, club_id")
                .in("id", primaryTeamIds);

              if (primaryTeams) {
                const clubIds = primaryTeams.map((t) => t.club_id);
                const { data: primaryClubs } = await serviceClient
                  .from("clubs")
                  .select("id, association_id")
                  .in("id", clubIds);

                const hasPrimaryInAssoc = primaryClubs?.some(
                  (c) => c.association_id === payload.association_id
                );

                if (hasPrimaryInAssoc) {
                  errors.push({
                    row: player.row_number,
                    error: "Already has a primary team in this association",
                  });
                  continue;
                }
              }
            }

            await serviceClient.from("profiles").update({
              first_name: player.first_name,
              last_name: player.last_name,
              gender: player.gender || null,
              date_of_birth: player.date_of_birth || null,
              phone: player.phone || null,
              suburb: player.suburb || null,
              hockey_vic_number: player.hockey_vic_number || null,
              emergency_contact_name: player.emergency_contact_name || null,
              emergency_contact_phone: player.emergency_contact_phone || null,
              emergency_contact_relationship: player.emergency_contact_relationship || null,
            }).eq("id", existingUserId);

            await serviceClient.from("team_memberships").insert({
              user_id: existingUserId,
              team_id: player.team_id,
              membership_type: "PRIMARY",
              status: "ACTIVE",
            });

            // Fix 5: role based on caller
            const roleData = await getRoleInsertData(player, isSuperAdmin, serviceClient);
            const { data: existingRole } = await serviceClient
              .from("user_roles")
              .select("id")
              .eq("user_id", existingUserId)
              .eq("role", roleData.role)
              .eq("team_id", roleData.team_id || "")
              .maybeSingle();

            if (!existingRole) {
              await serviceClient.from("user_roles").insert({
                user_id: existingUserId,
                ...roleData,
              });
            }

            added.push(player.row_number);
          } else {
            await serviceClient.from("team_memberships").insert({
              user_id: existingUserId,
              team_id: player.team_id,
              membership_type: "PERMANENT",
              status: "ACTIVE",
            });

            const roleData = await getRoleInsertData(player, isSuperAdmin, serviceClient);
            const { data: existingRole } = await serviceClient
              .from("user_roles")
              .select("id")
              .eq("user_id", existingUserId)
              .eq("role", roleData.role)
              .eq("team_id", roleData.team_id || "")
              .maybeSingle();

            if (!existingRole) {
              await serviceClient.from("user_roles").insert({
                user_id: existingUserId,
                ...roleData,
              });
            }

            added.push(player.row_number);
          }
        } else {
          // New user â€” invite by email
          const { data: newUser, error: createError } =
            await serviceClient.auth.admin.createUser({
              email: email,
              email_confirm: true,
              password: crypto.randomUUID(),
              user_metadata: { first_name: player.first_name, last_name: player.last_name },
            });

          if (createError) {
            errors.push({ row: player.row_number, error: createError.message });
            continue;
          }

          const userId = newUser.user.id;
          // Track newly created user so subsequent rows can find them
          authUsers.push({ id: userId, email } as any);
          allEmails.add(email.toLowerCase());

          if (isPrimary) {
            await serviceClient.from("profiles").update({
              first_name: player.first_name,
              last_name: player.last_name,
              gender: player.gender || null,
              date_of_birth: player.date_of_birth || null,
              phone: player.phone || null,
              suburb: player.suburb || null,
              hockey_vic_number: player.hockey_vic_number || null,
              emergency_contact_name: player.emergency_contact_name || null,
              emergency_contact_phone: player.emergency_contact_phone || null,
              emergency_contact_relationship: player.emergency_contact_relationship || null,
            }).eq("id", userId);
          }

          await serviceClient.from("team_memberships").insert({
            user_id: userId,
            team_id: player.team_id,
            membership_type: membershipType,
            status: "ACTIVE",
          });

          const roleData = await getRoleInsertData(player, isSuperAdmin, serviceClient);
          await serviceClient.from("user_roles").insert({
            user_id: userId,
            ...roleData,
          });

          created.push(player.row_number);
        }
      } catch (err) {
        console.error(`Row ${player.row_number} error:`, err);
        errors.push({ row: player.row_number, error: "Unexpected error" });
      }
    }

    return new Response(
      JSON.stringify({ created: created.length, added: added.length, errors }),
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


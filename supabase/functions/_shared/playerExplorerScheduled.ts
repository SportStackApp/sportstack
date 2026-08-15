import {
  aggregatePlayerExplorerRecords,
  filterPlayerExplorerRecords,
  normalisePlayerExplorerExpression,
  resolvePlayerExplorerIdentity,
  validatePlayerExplorerExpression,
  type PlayerExplorerProfile,
  type PlayerExplorerRecord,
  type PlayerExplorerResult,
} from "./playerExplorer.ts";

/* eslint-disable @typescript-eslint/no-explicit-any -- This server-only loader uses
 * Supabase's dynamic query builder because Edge Functions do not import the
 * browser-generated Database type. Result rows are narrowed as they are mapped. */

interface ClaimedSearch {
  id: string;
  owner_id: string;
  name: string;
  filter_expression: unknown;
  delivery_in_app: boolean;
  delivery_email: boolean;
}

interface ScheduledEmailWork {
  work_type: "PLAYER_EXPLORER";
  delivery_id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body_text: string;
  action_url: string;
  idempotency_key: string;
}

type ServiceClient = {
  from: (table: string) => any;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  auth: {
    admin: {
      getUserById: (id: string) => Promise<{
        data: { user: { email?: string | null } | null };
        error: { message: string } | null;
      }>;
    };
  };
};

interface ScheduledSearchStats {
  claimed: number;
  completed: number;
  partial: number;
  failed: number;
}

const PAGE_SIZE = 1000;

const fetchAll = async (
  client: ServiceClient,
  table: string,
  select: string,
  configure?: (query: any) => any,
) => {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.from(table).select(select).order("id").range(from, from + PAGE_SIZE - 1);
    if (configure) query = configure(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
};

const loadRecords = async (client: ServiceClient) => {
  const [divisions, teams, fixtures, matches, profiles, entities, links, appearances] = await Promise.all([
    fetchAll(client, "divisions", "id, association_id, competition_id, season_id"),
    fetchAll(client, "teams", "id, name, club_id, division_id"),
    fetchAll(client, "fixtures", "id, revsports_match_url, home_team_id, away_team_id, division_id, season_id"),
    fetchAll(client, "source_revsports_matches", "id, match_url, game_date, game_time, round_number"),
    fetchAll(client, "profiles", "id, first_name, last_name, is_placeholder, revsports_player_id"),
    fetchAll(
      client,
      "external_entities",
      "id, entity_type, external_id, source",
      (query) => query.eq("source", "revsports").in("entity_type", ["player", "team"]),
    ),
    fetchAll(
      client,
      "external_entity_links",
      "id, external_entity_id, target_table, target_id, status",
      (query) => query.eq("status", "matched").in("target_table", ["profiles", "teams"]),
    ),
    fetchAll(
      client,
      "source_revsports_player_appearances",
      "id, match_id, revsports_player_id, revsports_team_id, player_name, team_name, team_side, goals, green_cards, yellow_cards, red_cards",
      (query) => query.eq("attended", true).eq("is_removed", false),
    ),
  ]);

  const fixtureByUrl = new Map(
    fixtures.filter((fixture) => fixture.revsports_match_url).map((fixture) => [fixture.revsports_match_url, fixture]),
  );
  const divisionById = new Map(divisions.map((division) => [division.id, division]));
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const contextByMatchId = new Map<string, any>();
  for (const match of matches) {
    const fixture = fixtureByUrl.get(match.match_url);
    if (!fixture) continue;
    const division = fixture.division_id ? divisionById.get(fixture.division_id) : null;
    contextByMatchId.set(match.id, {
      fixture,
      roundNumber: match.round_number,
      gameDate: match.game_date,
      gameTime: match.game_time,
      associationId: division?.association_id || null,
      divisionId: fixture.division_id,
      competitionId: division?.competition_id || null,
      seasonId: fixture.season_id || division?.season_id || null,
    });
  }

  const profilesById = new Map<string, PlayerExplorerProfile>(profiles.map((profile) => [
    profile.id,
    {
      id: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      isPlaceholder: profile.is_placeholder,
    },
  ]));
  const directProfileIdByRevId = new Map(
    profiles.filter((profile) => profile.revsports_player_id).map((profile) => [profile.revsports_player_id, profile.id]),
  );
  const linkByEntityId = new Map(links.map((link) => [link.external_entity_id, link]));
  const externalProfileIdByRevId = new Map<string, string>();
  const externalTeamIdByRevId = new Map<string, string>();
  for (const entity of entities) {
    if (!entity.external_id) continue;
    const link = linkByEntityId.get(entity.id);
    if (!link?.target_id) continue;
    if (entity.entity_type === "player" && link.target_table === "profiles") {
      externalProfileIdByRevId.set(entity.external_id, link.target_id);
    }
    if (entity.entity_type === "team" && link.target_table === "teams") {
      externalTeamIdByRevId.set(entity.external_id, link.target_id);
    }
  }

  const identityByRevId = new Map<string, ReturnType<typeof resolvePlayerExplorerIdentity>>();
  const records: PlayerExplorerRecord[] = [];
  for (const appearance of appearances) {
    if (!appearance.match_id || !appearance.revsports_player_id) continue;
    const context = contextByMatchId.get(appearance.match_id);
    if (!context) continue;

    let teamId: string | null = null;
    if (appearance.team_side === "home") teamId = context.fixture.home_team_id;
    if (appearance.team_side === "away") teamId = context.fixture.away_team_id;
    if (!teamId && appearance.revsports_team_id) {
      teamId = externalTeamIdByRevId.get(appearance.revsports_team_id) || null;
    }

    const team = teamId ? teamById.get(teamId) : null;
    const division = context.divisionId ? divisionById.get(context.divisionId) : null;
    let identity = identityByRevId.get(appearance.revsports_player_id);
    if (!identity) {
      identity = resolvePlayerExplorerIdentity({
        revsportsPlayerId: appearance.revsports_player_id,
        sourcePlayerName: appearance.player_name,
        directProfileId: directProfileIdByRevId.get(appearance.revsports_player_id) || null,
        externalProfileId: externalProfileIdByRevId.get(appearance.revsports_player_id) || null,
        profilesById,
      });
      identityByRevId.set(appearance.revsports_player_id, identity);
    }

    records.push({
      appearanceId: appearance.id,
      matchId: appearance.match_id,
      revsportsPlayerId: appearance.revsports_player_id,
      sourcePlayerName: appearance.player_name,
      profileId: identity.profileId,
      displayName: identity.displayName,
      identityStatus: identity.identityStatus,
      teamId,
      teamName: team?.name || appearance.team_name,
      clubId: team?.club_id || null,
      associationId: context.associationId || division?.association_id || null,
      divisionId: context.divisionId,
      competitionId: context.competitionId,
      seasonId: context.seasonId,
      roundNumber: context.roundNumber,
      gameDate: context.gameDate,
      gameTime: context.gameTime,
      goals: appearance.goals,
      greenCards: appearance.green_cards,
      yellowCards: appearance.yellow_cards,
      redCards: appearance.red_cards,
    });
  }

  const ownerNames = new Map<string, string>(profiles.map((profile) => [
    profile.id,
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "Administrator",
  ]));
  return { records, ownerNames };
};

const resultSummary = (results: PlayerExplorerResult[]) => ({
  players: results.slice(0, 50).map((result) => ({
    revsportsPlayerId: result.revsportsPlayerId,
    displayName: result.displayName,
    teamNames: result.teamNames,
    gamesPlayed: result.gamesPlayed,
    goals: result.goals,
  })),
  truncated: results.length > 50,
});

export async function processDuePlayerExplorerSearches(
  client: ServiceClient,
  sendEmail: (work: ScheduledEmailWork) => Promise<void>,
): Promise<ScheduledSearchStats> {
  const { data, error } = await client.rpc("claim_due_player_explorer_searches", { p_limit: 5 });
  if (error) throw new Error(`Unable to claim Player Explorer work: ${error.message}`);
  const searches = (data || []) as ClaimedSearch[];
  const stats: ScheduledSearchStats = { claimed: searches.length, completed: 0, partial: 0, failed: 0 };
  if (searches.length === 0) return stats;

  const { records, ownerNames } = await loadRecords(client);
  for (const search of searches) {
    const { data: run, error: runError } = await client
      .from("player_explorer_search_runs")
      .insert({ saved_search_id: search.id, status: "RUNNING" })
      .select("id")
      .single();
    if (runError || !run) {
      console.error(`Unable to create Player Explorer run for ${search.id}`, runError?.message);
      stats.failed += 1;
      continue;
    }

    try {
      const expression = normalisePlayerExplorerExpression(search.filter_expression);
      const validationError = validatePlayerExplorerExpression(expression);
      if (validationError) throw new Error(validationError);
      const results = aggregatePlayerExplorerRecords(filterPlayerExplorerRecords(records, expression));
      const actionUrl = `/admin/player-explorer?savedSearch=${search.id}`;
      const subject = `Player Explorer: ${search.name} found ${results.length} player${results.length === 1 ? "" : "s"}`;
      const body = results.length > 0
        ? `${results.length} player${results.length === 1 ? " matches" : "s match"} the saved search “${search.name}”. Open Player Explorer to see the latest result.`
        : `No players currently match the saved search “${search.name}”.`;
      let inAppNotifiedAt: string | null = null;
      let emailNotifiedAt: string | null = null;
      const deliveryErrors: string[] = [];

      if (search.delivery_in_app) {
        const { error: notificationError } = await client.from("notifications").insert({
          user_id: search.owner_id,
          title: subject,
          body,
          message: body,
          type: "PLAYER_EXPLORER",
          action_url: actionUrl,
          dedupe_key: `player-explorer-run:${run.id}`,
        });
        if (notificationError) deliveryErrors.push(`In-app notification: ${notificationError.message}`);
        else inAppNotifiedAt = new Date().toISOString();
      }

      if (search.delivery_email) {
        const { data: userData, error: userError } = await client.auth.admin.getUserById(search.owner_id);
        if (userError || !userData.user?.email) {
          deliveryErrors.push(userError?.message || "The search owner has no email address.");
        } else {
          try {
            await sendEmail({
              work_type: "PLAYER_EXPLORER",
              delivery_id: run.id,
              recipient_email: userData.user.email,
              recipient_name: ownerNames.get(search.owner_id) || "Administrator",
              subject,
              body_text: body,
              action_url: actionUrl,
              idempotency_key: `player-explorer-run-${run.id}`,
            });
            emailNotifiedAt = new Date().toISOString();
          } catch (emailError) {
            deliveryErrors.push(emailError instanceof Error ? emailError.message : "Email delivery failed.");
          }
        }
      }

      const status = deliveryErrors.length > 0 ? "PARTIAL" : "SUCCEEDED";
      const { error: updateError } = await client.from("player_explorer_search_runs").update({
        status,
        matched_player_count: results.length,
        result_summary: resultSummary(results),
        error_message: deliveryErrors.length > 0 ? deliveryErrors.join(" ").slice(0, 1000) : null,
        completed_at: new Date().toISOString(),
        in_app_notified_at: inAppNotifiedAt,
        email_notified_at: emailNotifiedAt,
      }).eq("id", run.id);
      if (updateError) throw new Error(updateError.message);
      if (status === "PARTIAL") stats.partial += 1;
      else stats.completed += 1;
    } catch (runFailure) {
      const message = runFailure instanceof Error ? runFailure.message : "Unknown Player Explorer error";
      console.error(`Player Explorer run ${run.id} failed`, message);
      await client.from("player_explorer_search_runs").update({
        status: "FAILED",
        error_message: message.slice(0, 1000),
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);
      stats.failed += 1;
    }
  }
  return stats;
}

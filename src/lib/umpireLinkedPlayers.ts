import { supabase } from "@/integrations/supabase/client";

export interface UmpireLinkedPlayerContext {
  fixtureId: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamLabel: string;
  awayTeamLabel: string;
}

export interface UmpireLinkedPlayerOption {
  optionId: string;
  profileId: string | null;
  name: string;
  number: string;
  teamId: string | null;
  teamLabel: string;
  contextLabel: string;
  source: "roster" | "club" | "association" | "unresolved";
}

interface ProfileOptionRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  revsports_player_id: string | null;
}

interface TeamOptionRow {
  id: string;
  name: string;
  club_id: string;
}

interface CandidateAccumulator extends UmpireLinkedPlayerOption {
  contexts: Set<string>;
  fixtureTeamIds: Set<string>;
}

const profileName = (profile: ProfileOptionRow) =>
  [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "Unnamed profile";

const normaliseNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export async function loadUmpireLinkedPlayers(
  context: UmpireLinkedPlayerContext,
): Promise<UmpireLinkedPlayerOption[]> {
  const fixtureTeamIds = [context.homeTeamId, context.awayTeamId].filter(Boolean);
  if (fixtureTeamIds.length === 0) return [];

  const { data: fixtureTeams, error: fixtureTeamsError } = await supabase
    .from("teams")
    .select("id, name, club_id")
    .in("id", fixtureTeamIds);

  if (fixtureTeamsError) throw fixtureTeamsError;

  const fixtureTeamById = new Map(
    ((fixtureTeams || []) as TeamOptionRow[]).map((team) => [team.id, team]),
  );
  const homeTeam = fixtureTeamById.get(context.homeTeamId);
  const awayTeam = fixtureTeamById.get(context.awayTeamId);
  const clubIds = Array.from(
    new Set([homeTeam?.club_id, awayTeam?.club_id].filter((id): id is string => Boolean(id))),
  );

  const rosterRows = context.fixtureId
    ? await supabase
        .from("revsports_players")
        .select(
          "profile_id, revsports_player_id, player_name, jersey, team_side, team, team_label, club_name, attended, is_removed",
        )
        .eq("fixture_id", context.fixtureId)
        .eq("is_removed", false)
    : { data: [], error: null };

  if (rosterRows.error) throw rosterRows.error;

  const roster = rosterRows.data || [];
  const rosterRevSportsIds = Array.from(
    new Set(
      roster
        .map((row) => row.revsports_player_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const rosterProfileIds = Array.from(
    new Set(
      roster
        .map((row) => row.profile_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const profilesByRevSportsId = new Map<string, ProfileOptionRow>();
  if (rosterRevSportsIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, revsports_player_id")
      .in("revsports_player_id", rosterRevSportsIds);
    if (error) throw error;
    (data || []).forEach((profile) => {
      if (profile.revsports_player_id) {
        profilesByRevSportsId.set(profile.revsports_player_id, profile);
      }
    });
  }

  const profilesById = new Map<string, ProfileOptionRow>();
  if (rosterProfileIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, revsports_player_id")
      .in("id", rosterProfileIds);
    if (error) throw error;
    (data || []).forEach((profile) => profilesById.set(profile.id, profile));
  }

  let clubTeams: TeamOptionRow[] = [];
  if (clubIds.length > 0) {
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, club_id")
      .in("club_id", clubIds);
    if (error) throw error;
    clubTeams = (data || []) as TeamOptionRow[];
  }

  const clubTeamById = new Map(clubTeams.map((team) => [team.id, team]));
  const memberships =
    clubTeams.length > 0
      ? await supabase
          .from("team_memberships")
          .select("user_id, team_id, jersey_number")
          .in(
            "team_id",
            clubTeams.map((team) => team.id),
          )
          .eq("status", "ACTIVE")
      : { data: [], error: null };

  if (memberships.error) throw memberships.error;

  const membershipRows = memberships.data || [];
  const membershipProfileIds = Array.from(
    new Set(membershipRows.map((row) => row.user_id).filter(Boolean)),
  );
  if (membershipProfileIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, revsports_player_id")
      .in("id", membershipProfileIds);
    if (error) throw error;
    (data || []).forEach((profile) => profilesById.set(profile.id, profile));
  }

  const candidates = new Map<string, CandidateAccumulator>();

  const addCandidate = (option: UmpireLinkedPlayerOption) => {
    if (!option.profileId) return;
    const existing = candidates.get(option.profileId);
    if (!existing) {
      candidates.set(option.profileId, {
        ...option,
        contexts: new Set([option.contextLabel].filter(Boolean)),
        fixtureTeamIds: new Set(option.teamId ? [option.teamId] : []),
      });
      return;
    }

    existing.contexts.add(option.contextLabel);
    if (option.source === "roster" && existing.source !== "roster") {
      existing.source = "roster";
      existing.number = option.number || existing.number;
    } else if (!existing.number && option.number) {
      existing.number = option.number;
    }

    if (option.teamId) {
      existing.fixtureTeamIds.add(option.teamId);
      if (existing.fixtureTeamIds.size === 1) {
        existing.teamId = option.teamId;
        existing.teamLabel = option.teamLabel;
      } else {
        existing.teamId = null;
        existing.teamLabel = "Select fixture team";
      }
    }
  };

  roster.forEach((row) => {
    const profile =
      (row.revsports_player_id
        ? profilesByRevSportsId.get(row.revsports_player_id)
        : undefined) ||
      (row.profile_id ? profilesById.get(row.profile_id) : undefined);
    if (!profile) return;

    let teamId: string | null = null;
    let teamLabel = "Select fixture team";
    if (row.team_side?.toLowerCase() === "home") {
      teamId = context.homeTeamId;
      teamLabel = context.homeTeamLabel;
    } else if (row.team_side?.toLowerCase() === "away") {
      teamId = context.awayTeamId;
      teamLabel = context.awayTeamLabel;
    }

    addCandidate({
      optionId: `profile:${profile.id}`,
      profileId: profile.id,
      name: profileName(profile),
      number: normaliseNumber(row.jersey),
      teamId,
      teamLabel,
      contextLabel: row.team_label || row.team || row.club_name || "Fixture roster",
      source: "roster",
    });
  });

  membershipRows.forEach((membership) => {
    const profile = profilesById.get(membership.user_id);
    const membershipTeam = clubTeamById.get(membership.team_id);
    if (!profile || !membershipTeam) return;

    let teamId: string | null = null;
    let teamLabel = "Select fixture team";
    if (membership.team_id === context.homeTeamId) {
      teamId = context.homeTeamId;
      teamLabel = context.homeTeamLabel;
    } else if (membership.team_id === context.awayTeamId) {
      teamId = context.awayTeamId;
      teamLabel = context.awayTeamLabel;
    } else {
      const matchesHomeClub = membershipTeam.club_id === homeTeam?.club_id;
      const matchesAwayClub = membershipTeam.club_id === awayTeam?.club_id;
      if (matchesHomeClub !== matchesAwayClub) {
        teamId = matchesHomeClub ? context.homeTeamId : context.awayTeamId;
        teamLabel = matchesHomeClub ? context.homeTeamLabel : context.awayTeamLabel;
      }
    }

    addCandidate({
      optionId: `profile:${profile.id}`,
      profileId: profile.id,
      name: profileName(profile),
      number: normaliseNumber(membership.jersey_number),
      teamId,
      teamLabel,
      contextLabel: membershipTeam.name,
      source: "club",
    });
  });

  return Array.from(candidates.values())
    .map(({ contexts, fixtureTeamIds: _fixtureTeamIds, ...option }) => ({
      ...option,
      contextLabel: Array.from(contexts).filter(Boolean).join(" / "),
    }))
    .sort(
      (a, b) =>
        (a.source === b.source ? 0 : a.source === "roster" ? -1 : 1) ||
        a.name.localeCompare(b.name) ||
        a.teamLabel.localeCompare(b.teamLabel),
    );
}

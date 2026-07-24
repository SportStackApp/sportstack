import { supabase } from "@/integrations/supabase/client";

export interface PlayerHistoryRecord {
  id: string;
  fixtureId: string | null;
  date: string;
  teamName: string;
  clubName: string;
  associationName: string;
  opponent: string;
  location: string;
  result: string;
  goals: number;
  greenCards: number;
  yellowCards: number;
  redCards: number;
}

interface RevSportsAppearance {
  id: string;
  fixture_id: string | null;
  game_date: string | null;
  team: string | null;
  team_label: string | null;
  team_side: string | null;
  club_name: string | null;
  association: string | null;
  home_team: string | null;
  away_team: string | null;
  home_team_label: string | null;
  away_team_label: string | null;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
  pitch: string | null;
  goals: number | null;
  green_cards: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
}

const scoreResult = (row: RevSportsAppearance) => {
  if (row.home_score === null || row.away_score === null) return "Score not recorded";
  const side = row.team_side?.toLowerCase();
  const ownScore = side === "away" ? row.away_score : row.home_score;
  const opponentScore = side === "away" ? row.home_score : row.away_score;
  const outcome = ownScore > opponentScore ? "W" : ownScore < opponentScore ? "L" : "D";
  return `${outcome} ${ownScore}-${opponentScore}`;
};

export async function loadPlayerHistory(profileId: string, revsportsTeamId?: string | null) {
  let query = supabase
    .from("revsports_players")
    .select("id, fixture_id, game_date, team, team_label, team_side, club_name, association, home_team, away_team, home_team_label, away_team_label, home_score, away_score, venue, pitch, goals, green_cards, yellow_cards, red_cards")
    .eq("profile_id", profileId)
    .eq("attended", true)
    .eq("is_removed", false)
    .order("game_date", { ascending: false });

  if (revsportsTeamId) query = query.eq("revsports_team_id", revsportsTeamId);
  const { data, error } = await query;
  if (error) throw error;

  return ((data || []) as RevSportsAppearance[])
    .filter((row) => Boolean(row.game_date))
    .map((row): PlayerHistoryRecord => {
      const side = row.team_side?.toLowerCase();
      const opponent = side === "away"
        ? row.home_team_label || row.home_team || "Unknown opponent"
        : row.away_team_label || row.away_team || "Unknown opponent";
      return {
        id: row.id,
        fixtureId: row.fixture_id,
        date: row.game_date as string,
        teamName: row.team_label || row.team || "Unknown team",
        clubName: row.club_name || "Club not recorded",
        associationName: row.association || "Association not recorded",
        opponent,
        location: [row.venue, row.pitch].filter(Boolean).join(" • ") || "Venue not recorded",
        result: scoreResult(row),
        goals: row.goals || 0,
        greenCards: row.green_cards || 0,
        yellowCards: row.yellow_cards || 0,
        redCards: row.red_cards || 0,
      };
    });
}

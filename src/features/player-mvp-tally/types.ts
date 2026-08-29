export type MvpTallyStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "WITHDRAWN";
export type MvpTallyAudienceGroup = "PRIMARY" | "SECONDARY" | "FILL_IN";
export type MvpTallySpeed = 0.5 | 1 | 1.5 | 2;

export interface MvpTallyTheme {
  logoUrl: string | null;
  bannerUrl: string | null;
  backgroundStyle: "SPOTLIGHT" | "GRADIENT" | "SOLID";
  primaryColour: string;
  secondaryColour: string;
  accentColour: string;
}

export interface MvpTallyCard {
  cardId: string;
  points: 1 | 2 | 3;
  playerKey: string;
  playerId: string | null;
  playerName: string;
  avatarUrl: string | null;
  linked: boolean;
}

export interface MvpTallyRound {
  sessionId: string;
  roundLabel: string;
  gameDate: string | null;
  matchLabel: string;
  cards: MvpTallyCard[];
}

export interface MvpTallyCardSnapshot {
  version: 1;
  rounds: MvpTallyRound[];
}

export interface MvpTallyResult {
  playerKey: string;
  playerId: string | null;
  playerName: string;
  avatarUrl: string | null;
  linked: boolean;
  points: number;
  rank: number;
}

export interface MvpTallyAudienceMember {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  group: MvpTallyAudienceGroup;
  selected: boolean;
}

export interface MvpTallySessionOption {
  id: string;
  round: string;
  gameDate: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  voteCount: number;
  unlinkedCount: number;
}

export interface MvpTallyBranding {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColour: string;
  secondaryColour: string;
  accentColour: string;
}

export interface MvpTallyBuilderData {
  branding: MvpTallyBranding;
  sessions: MvpTallySessionOption[];
  audience: MvpTallyAudienceMember[];
}

export interface MvpTallyPresentationRecord {
  id: string;
  team_id: string;
  title: string;
  subtitle: string | null;
  status: MvpTallyStatus;
  theme: MvpTallyTheme;
  playback_speed: MvpTallySpeed;
  card_snapshot: MvpTallyCardSnapshot | null;
  result_snapshot: MvpTallyResult[] | null;
  previewed_at: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  validation_error: string | null;
  replaces_presentation_id: string | null;
  created_at: string;
}

export type MvpTallyFrame =
  | { kind: "INTRO"; revealedCards: number; roundIndex: 0 }
  | { kind: "ROUND_INTRO"; revealedCards: number; roundIndex: number }
  | { kind: "CARD"; revealedCards: number; roundIndex: number; card: MvpTallyCard }
  | { kind: "ROUND_SUMMARY"; revealedCards: number; roundIndex: number }
  | { kind: "FINAL"; revealedCards: number; roundIndex: number };

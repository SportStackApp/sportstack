import type {
  MvpTallyCardSnapshot,
  MvpTallyFrame,
  MvpTallyResult,
  MvpTallySpeed,
  MvpTallyTheme,
} from "./types";

export const DEFAULT_TALLY_THEME: MvpTallyTheme = {
  logoUrl: null,
  bannerUrl: null,
  backgroundStyle: "SPOTLIGHT",
  primaryColour: "#6D28D9",
  secondaryColour: "#1E1B4B",
  accentColour: "#F5C84C",
};

export const buildPlaybackFrames = (snapshot: MvpTallyCardSnapshot): MvpTallyFrame[] => {
  const frames: MvpTallyFrame[] = [{ kind: "INTRO", revealedCards: 0, roundIndex: 0 }];
  let revealedCards = 0;

  snapshot.rounds.forEach((round, roundIndex) => {
    frames.push({ kind: "ROUND_INTRO", revealedCards, roundIndex });
    round.cards.forEach((card) => {
      revealedCards += 1;
      frames.push({ kind: "CARD", revealedCards, roundIndex, card });
    });
    frames.push({ kind: "ROUND_SUMMARY", revealedCards, roundIndex });
  });
  frames.push({
    kind: "FINAL",
    revealedCards,
    roundIndex: Math.max(snapshot.rounds.length - 1, 0),
  });
  return frames;
};

export const calculateLeaderboard = (
  snapshot: MvpTallyCardSnapshot,
  revealedCards: number,
): MvpTallyResult[] => {
  const totals = new Map<string, Omit<MvpTallyResult, "points" | "rank"> & { points: number }>();
  const cards = snapshot.rounds.flatMap((round) => round.cards).slice(0, revealedCards);

  cards.forEach((card) => {
    const current = totals.get(card.playerKey);
    totals.set(card.playerKey, {
      playerKey: card.playerKey,
      playerId: card.playerId,
      playerName: card.playerName,
      avatarUrl: card.avatarUrl,
      linked: card.linked,
      points: (current?.points || 0) + card.points,
    });
  });

  const ordered = [...totals.values()].sort(
    (left, right) => right.points - left.points || left.playerName.localeCompare(right.playerName),
  );
  let rank = 0;
  let previousPoints: number | null = null;
  return ordered.map((result) => {
    if (result.points !== previousPoints) rank += 1;
    previousPoints = result.points;
    return { ...result, rank };
  });
};

export const playbackDelayMs = (speed: MvpTallySpeed, reducedMotion: boolean) => {
  if (reducedMotion) return 350;
  return Math.round(2200 / speed);
};

export const podiumResults = (results: MvpTallyResult[]) =>
  results.filter((result) => result.rank <= 3);

export const mergeInheritedTheme = (
  inherited: Partial<MvpTallyTheme>,
  override: Partial<MvpTallyTheme> = {},
): MvpTallyTheme => ({ ...DEFAULT_TALLY_THEME, ...inherited, ...override });

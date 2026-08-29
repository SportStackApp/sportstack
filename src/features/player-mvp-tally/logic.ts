import type {
  MvpTallyCardSnapshot,
  MvpTallyCommentarySnapshot,
  MvpTallyFrame,
  MvpTallyResult,
  MvpTallySpeed,
  MvpTallyTheme,
} from "./types";

export const DEFAULT_TALLY_THEME: MvpTallyTheme = {
  logoUrl: null,
  logoStoragePath: null,
  bannerUrl: null,
  backgroundStyle: "SPOTLIGHT",
  primaryColour: "#6D28D9",
  secondaryColour: "#1E1B4B",
  accentColour: "#F5C84C",
  leaderboardLimit: 10,
};

export const TALLY_SPEEDS: MvpTallySpeed[] = [0.5, 1, 1.5, 2, 3, 4, 5, 7.5, 10];

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

export const frameDelayMs = (
  frame: Pick<MvpTallyFrame, "kind">,
  speed: MvpTallySpeed,
  reducedMotion: boolean,
) => frame.kind === "ROUND_SUMMARY" ? Math.round(6000 / speed) : playbackDelayMs(speed, reducedMotion);

export const limitLeaderboard = (results: MvpTallyResult[], limit?: number | null) => {
  if (limit == null || limit >= results.length) return results;
  const cutoffRank = results[Math.max(0, limit - 1)]?.rank;
  return cutoffRank == null ? results : results.filter((result) => result.rank <= cutoffRank);
};

export const buildRuleCommentary = (snapshot: MvpTallyCardSnapshot): MvpTallyCommentarySnapshot => {
  let revealedCards = 0;
  let previous: MvpTallyResult[] = [];
  const rounds = snapshot.rounds.map((round, roundIndex) => {
    revealedCards += round.cards.length;
    const current = calculateLeaderboard(snapshot, revealedCards);
    const previousByPlayer = new Map(previous.map((result) => [result.playerKey, result]));
    const biggestMover = current
      .map((result) => {
        const old = previousByPlayer.get(result.playerKey);
        const gained = result.points - (old?.points || 0);
        const climbed = old ? old.rank - result.rank : 0;
        return { result, gained, climbed };
      })
      .filter((item) => item.climbed >= 3 || item.gained >= 6)
      .sort((left, right) => right.climbed - left.climbed || right.gained - left.gained)[0];
    const leader = current[0];
    const runnerUp = current.find((result) => result.rank > (leader?.rank || 0));
    const gap = leader && runnerUp ? leader.points - runnerUp.points : 0;
    const remaining = snapshot.rounds.length - roundIndex - 1;

    let text: string;
    if (biggestMover) {
      text = `${biggestMover.result.playerName} is powering up the leaderboard after a huge round.`;
    } else if (leader && current.filter((result) => result.rank === 1).length > 1) {
      text = `It is neck and neck at the top after ${round.roundLabel}.`;
    } else if (remaining === 2 && gap <= 2) {
      text = "Only two rounds remain and it is anybody’s tally from here.";
    } else if (leader && runnerUp && gap <= 2) {
      text = `It is a tight one — just ${gap} ${gap === 1 ? "point separates" : "points separate"} the leaders.`;
    } else if (leader && runnerUp && (gap >= 6 || gap >= leader.points * 0.25)) {
      text = `${leader.playerName} is the clear leader, but there is still time for the chase.`;
    } else {
      text = "The leaderboard is taking shape and every point still matters.";
    }
    previous = current;
    return { sessionId: round.sessionId, text };
  });

  return { version: 1, source: "RULES", rounds };
};

export const podiumResults = (results: MvpTallyResult[]) =>
  results.filter((result) => result.rank <= 3);

export const mergeInheritedTheme = (
  inherited: Partial<MvpTallyTheme>,
  override: Partial<MvpTallyTheme> = {},
): MvpTallyTheme => ({ ...DEFAULT_TALLY_THEME, ...inherited, ...override });

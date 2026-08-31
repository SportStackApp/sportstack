import { describe, expect, it } from "vitest";
import {
  buildPlaybackFrames,
  buildRuleCommentary,
  calculateLeaderboard,
  deduplicateAudience,
  frameDelayMs,
  limitLeaderboard,
  mergeInheritedTheme,
  playbackDelayMs,
  podiumResults,
} from "./logic";
import type { MvpTallyCardSnapshot } from "./types";

const snapshot: MvpTallyCardSnapshot = {
  version: 1,
  rounds: [
    {
      sessionId: "round-1",
      roundLabel: "Round 1",
      gameDate: "2026-08-01",
      matchLabel: "Pumas v Tigers",
      cards: [
        { cardId: "1", points: 3, playerKey: "a", playerId: "a", playerName: "Alex", avatarUrl: null, linked: true },
        { cardId: "2", points: 2, playerKey: "b", playerId: "b", playerName: "Bailey", avatarUrl: null, linked: true },
        { cardId: "3", points: 1, playerKey: "b", playerId: "b", playerName: "Bailey", avatarUrl: null, linked: true },
      ],
    },
    {
      sessionId: "round-2",
      roundLabel: "Round 2",
      gameDate: "2026-08-08",
      matchLabel: "Pumas v Hawks",
      cards: [
        { cardId: "4", points: 3, playerKey: "c", playerId: null, playerName: "Casey", avatarUrl: null, linked: false },
      ],
    },
  ],
};

describe("Player MVP tally playback", () => {
  it("derives totals from the current card position without duplicating points", () => {
    expect(calculateLeaderboard(snapshot, 2).map(({ playerName, points }) => ({ playerName, points }))).toEqual([
      { playerName: "Alex", points: 3 },
      { playerName: "Bailey", points: 2 },
    ]);
    expect(calculateLeaderboard(snapshot, 2)[0].points).toBe(3);
  });

  it("uses shared ranks and includes every tied podium player", () => {
    const results = calculateLeaderboard(snapshot, 4);
    expect(results.map(({ playerName, rank }) => ({ playerName, rank }))).toEqual([
      { playerName: "Alex", rank: 1 },
      { playerName: "Bailey", rank: 1 },
      { playerName: "Casey", rank: 1 },
    ]);
    expect(podiumResults(results)).toHaveLength(3);
  });

  it("builds round summaries and one final frame", () => {
    const frames = buildPlaybackFrames(snapshot);
    expect(frames.filter((frame) => frame.kind === "ROUND_SUMMARY")).toHaveLength(2);
    expect(frames.at(-1)?.kind).toBe("FINAL");
  });

  it("preserves the 3-2-1 reveal order within a ballot snapshot", () => {
    const cardFrames = buildPlaybackFrames(snapshot)
      .filter((frame) => frame.kind === "CARD" && frame.roundIndex === 0);
    expect(cardFrames.map((frame) => frame.kind === "CARD" ? frame.card.points : null)).toEqual([3, 2, 1]);
  });

  it("adjusts timing for speed and reduced motion", () => {
    expect(playbackDelayMs(2, false)).toBe(1100);
    expect(playbackDelayMs(0.5, false)).toBe(4400);
    expect(playbackDelayMs(1, true)).toBe(350);
    expect(frameDelayMs({ kind: "ROUND_SUMMARY" }, 1, false)).toBe(6000);
    expect(frameDelayMs({ kind: "ROUND_SUMMARY" }, 10, true)).toBe(600);
  });

  it("limits the leaderboard without splitting a tied cutoff rank", () => {
    const results = [
      { playerKey: "a", playerId: "a", playerName: "A", avatarUrl: null, linked: true, points: 9, rank: 1 },
      { playerKey: "b", playerId: "b", playerName: "B", avatarUrl: null, linked: true, points: 8, rank: 2 },
      { playerKey: "c", playerId: "c", playerName: "C", avatarUrl: null, linked: true, points: 7, rank: 3 },
      { playerKey: "d", playerId: "d", playerName: "D", avatarUrl: null, linked: true, points: 7, rank: 3 },
      { playerKey: "e", playerId: "e", playerName: "E", avatarUrl: null, linked: true, points: 5, rank: 4 },
    ];
    expect(limitLeaderboard(results, 3).map((result) => result.playerName)).toEqual(["A", "B", "C", "D"]);
    expect(limitLeaderboard(results, null)).toHaveLength(5);
  });

  it("creates positive rule commentary for every round", () => {
    const commentary = buildRuleCommentary(snapshot);
    expect(commentary.source).toBe("RULES");
    expect(commentary.rounds).toHaveLength(snapshot.rounds.length);
    expect(commentary.rounds.every((round) => round.text.length > 0 && round.text.length <= 180)).toBe(true);
  });

  it("recognises a clear leader and a close contest", () => {
    const clearLeadSnapshot: MvpTallyCardSnapshot = {
      version: 1,
      rounds: [{
        sessionId: "clear",
        roundLabel: "Round 1",
        gameDate: null,
        matchLabel: "A v B",
        cards: [
          { cardId: "a1", points: 3, playerKey: "a", playerId: "a", playerName: "Alex", avatarUrl: null, linked: true },
          { cardId: "a2", points: 3, playerKey: "a", playerId: "a", playerName: "Alex", avatarUrl: null, linked: true },
          { cardId: "b1", points: 1, playerKey: "b", playerId: "b", playerName: "Bailey", avatarUrl: null, linked: true },
        ],
      }],
    };
    expect(buildRuleCommentary(clearLeadSnapshot).rounds[0].text).toContain("Alex");
    expect(buildRuleCommentary(snapshot).rounds[0].text).toMatch(/neck and neck|tight one|leaderboard/);
  });

  it("inherits branding while keeping explicit overrides", () => {
    expect(mergeInheritedTheme({ primaryColour: "#111111" }, { accentColour: "#abcdef" })).toMatchObject({
      primaryColour: "#111111",
      accentColour: "#abcdef",
      backgroundStyle: "SPOTLIGHT",
      leaderboardLimit: 10,
    });
  });

  it("shows each audience member once and prefers their Primary group", () => {
    const audience = deduplicateAudience([
      { profileId: "reuben", name: "Reuben Pougnault", avatarUrl: null, group: "SECONDARY", selected: false },
      { profileId: "reuben", name: "Reuben Pougnault", avatarUrl: null, group: "SECONDARY", selected: true },
      { profileId: "alex", name: "Alex Test", avatarUrl: null, group: "SECONDARY", selected: true },
      { profileId: "alex", name: "Alex Test", avatarUrl: null, group: "PRIMARY", selected: true },
    ]);

    expect(audience).toHaveLength(2);
    expect(audience.find((person) => person.profileId === "reuben")).toMatchObject({ group: "SECONDARY", selected: true });
    expect(audience.find((person) => person.profileId === "alex")?.group).toBe("PRIMARY");
  });
});

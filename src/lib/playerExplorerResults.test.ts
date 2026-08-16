import { describe, expect, it } from "vitest";
import type { PlayerExplorerResult } from "@/lib/playerExplorer";
import {
  buildPlayerExplorerCsv,
  buildPlayerExplorerTsv,
  sortPlayerExplorerResults,
} from "@/lib/playerExplorerResults";

const result = (
  overrides: Partial<PlayerExplorerResult> & Pick<PlayerExplorerResult, "revsportsPlayerId" | "displayName">,
): PlayerExplorerResult => ({
  profileId: null,
  sourcePlayerName: overrides.displayName,
  identityStatus: "linked",
  teamNames: [],
  gamesPlayed: 0,
  goals: 0,
  greenCards: 0,
  yellowCards: 0,
  redCards: 0,
  roundsPlayed: [],
  latestGameDate: null,
  ...overrides,
});

describe("Player Explorer result sorting", () => {
  it("sorts numeric columns without changing the original result order", () => {
    const original = [
      result({ revsportsPlayerId: "1", displayName: "Alex", goals: 2 }),
      result({ revsportsPlayerId: "2", displayName: "Blair", goals: 8 }),
    ];

    const sorted = sortPlayerExplorerResults(original, "goals", "desc");

    expect(sorted.map((item) => item.displayName)).toEqual(["Blair", "Alex"]);
    expect(original.map((item) => item.displayName)).toEqual(["Alex", "Blair"]);
  });

  it("sorts text columns using Australian case-insensitive ordering", () => {
    const original = [
      result({ revsportsPlayerId: "2", displayName: "zoe" }),
      result({ revsportsPlayerId: "1", displayName: "Aaron" }),
    ];

    expect(sortPlayerExplorerResults(original, "displayName", "asc").map((item) => item.displayName))
      .toEqual(["Aaron", "zoe"]);
  });
});

describe("Player Explorer result exports", () => {
  const exportResult = result({
    revsportsPlayerId: "rev-1",
    displayName: 'Mullane, "Aaron"',
    profileId: "profile-1",
    teamNames: ["Division 1", "Division 2"],
    gamesPlayed: 8,
    goals: 4,
    roundsPlayed: [1, 2, 8],
    latestGameDate: "2026-08-15",
  });

  it("creates a quoted CSV with identifiers, totals and Australian dates", () => {
    const csv = buildPlayerExplorerCsv([exportResult]);

    expect(csv).toContain('"Mullane, ""Aaron"""');
    expect(csv).toContain('"rev-1","profile-1","Linked","Division 1, Division 2","8","4"');
    expect(csv).toContain('"1, 2, 8","15/08/2026"');
  });

  it("creates tab-separated clipboard data that pastes into a spreadsheet", () => {
    const tsv = buildPlayerExplorerTsv([exportResult]);

    expect(tsv.split("\r\n")).toHaveLength(2);
    expect(tsv).toContain("Player\tRevSports player ID\tProfile ID");
    expect(tsv).toContain("\t8\t4\t0\t0\t0\t1, 2, 8\t15/08/2026");
  });

  it("guards spreadsheet formula values", () => {
    const csv = buildPlayerExplorerCsv([
      result({ revsportsPlayerId: "rev-2", displayName: "=HYPERLINK(\"bad\")" }),
    ]);

    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
  });
});

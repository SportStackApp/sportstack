import { describe, expect, it } from "vitest";
import { buildUmpireVoteExportSheets } from "@/lib/umpireVotingExport";

const baseSubmission = {
  submittedAt: "20/08/2026 4:31 pm",
  roundLabel: "Round 7",
  divisionName: "Division 1 Open",
  fixtureLabel: "Blaze vs Gold",
  submittedFor: "Alex Umpire",
  submittedBy: "Alex Umpire",
  submitterEmail: "",
  source: "Self",
  reference: "",
  proxyReason: "",
  status: "Approved",
  isJuniorDivision: false,
};

describe("Umpire Match Voting workbook export", () => {
  it("puts senior votes in separate 3, 2 and 1 point columns", () => {
    const sheets = buildUmpireVoteExportSheets([
      { ...baseSubmission, id: "senior", voteSchemeKey: "classic_3_2_1" },
    ], [
      { submissionId: "senior", votes: 3, playerName: "A", playerNumber: 4, teamName: "Blaze", schemeLineKey: "best" },
      { submissionId: "senior", votes: 2, playerName: "B", playerNumber: null, teamName: "Gold", schemeLineKey: "second" },
      { submissionId: "senior", votes: 1, playerName: "C", playerNumber: null, teamName: "Blaze", schemeLineKey: "third" },
    ]);

    expect(sheets.seniors[0].slice(-3)).toEqual(["3 points", "2 points", "1 point"]);
    expect(sheets.seniors[1].slice(-3)).toEqual(["A #4 — Blaze", "B — Gold", "C — Blaze"]);
  });

  it("uses neutral A and B slots for legacy junior lines without scheme keys", () => {
    const sheets = buildUmpireVoteExportSheets([
      { ...baseSubmission, id: "junior", voteSchemeKey: "junior_2_1_split", isJuniorDivision: true },
    ], [
      { submissionId: "junior", votes: 2, playerName: "A", playerNumber: null, teamName: "Blue", schemeLineKey: null },
      { submissionId: "junior", votes: 1, playerName: "B", playerNumber: null, teamName: "Blue", schemeLineKey: null },
      { submissionId: "junior", votes: 2, playerName: "C", playerNumber: null, teamName: "Gold", schemeLineKey: null },
      { submissionId: "junior", votes: 1, playerName: "D", playerNumber: null, teamName: "Gold", schemeLineKey: null },
    ]);

    expect(sheets.juniors[0].slice(-4)).toEqual(["2 points A", "1 point A", "2 points B", "1 point B"]);
    expect(sheets.juniors[1].slice(-4)).toEqual(["A — Blue", "B — Blue", "C — Gold", "D — Gold"]);
  });
});

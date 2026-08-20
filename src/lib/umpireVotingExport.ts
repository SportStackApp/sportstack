export interface UmpireVoteExportSubmission {
  id: string;
  submittedAt: string;
  roundLabel: string;
  divisionName: string;
  fixtureLabel: string;
  submittedFor: string;
  submittedBy: string;
  submitterEmail: string;
  source: string;
  reference: string;
  proxyReason: string;
  status: string;
  voteSchemeKey: string | null;
  isJuniorDivision: boolean;
}

export interface UmpireVoteExportLine {
  submissionId: string;
  votes: number;
  playerName: string;
  playerNumber: number | null;
  teamName: string;
  schemeLineKey: string | null;
}

const COMMON_HEADERS = [
  "Submitted",
  "Round",
  "Division",
  "Fixture",
  "Submitted for",
  "Submitted by",
  "Submitter email",
  "Source",
  "Reference",
  "Proxy reason",
  "Status",
];

const lineLabel = (line: UmpireVoteExportLine | undefined) => {
  if (!line) return "";
  const number = line.playerNumber === null ? "" : ` #${line.playerNumber}`;
  const team = line.teamName ? ` — ${line.teamName}` : "";
  return `${line.playerName || "Unknown"}${number}${team}`;
};

const commonCells = (submission: UmpireVoteExportSubmission) => [
  submission.submittedAt,
  submission.roundLabel,
  submission.divisionName,
  submission.fixtureLabel,
  submission.submittedFor,
  submission.submittedBy,
  submission.submitterEmail,
  submission.source,
  submission.reference,
  submission.proxyReason,
  submission.status,
];

const takeLegacyLine = (
  lines: UmpireVoteExportLine[],
  votes: number,
  index: number,
) => lines.filter((line) => !line.schemeLineKey && line.votes === votes)[index];

export const buildUmpireVoteExportSheets = (
  submissions: UmpireVoteExportSubmission[],
  lines: UmpireVoteExportLine[],
) => {
  const linesBySubmission = new Map<string, UmpireVoteExportLine[]>();
  lines.forEach((line) => {
    const current = linesBySubmission.get(line.submissionId) || [];
    current.push(line);
    linesBySubmission.set(line.submissionId, current);
  });

  const seniors: (string | number)[][] = [[
    ...COMMON_HEADERS,
    "3 points",
    "2 points",
    "1 point",
  ]];
  const juniors: (string | number)[][] = [[
    ...COMMON_HEADERS,
    "2 points A",
    "1 point A",
    "2 points B",
    "1 point B",
  ]];

  submissions.forEach((submission) => {
    const submissionLines = linesBySubmission.get(submission.id) || [];
    const isJunior = submission.voteSchemeKey === "junior_2_1_split"
      || (!submission.voteSchemeKey && submission.isJuniorDivision);

    if (!isJunior) {
      const find = (key: string, votes: number) =>
        submissionLines.find((line) => line.schemeLineKey === key)
        || takeLegacyLine(submissionLines, votes, 0);
      seniors.push([
        ...commonCells(submission),
        lineLabel(find("best", 3)),
        lineLabel(find("second", 2)),
        lineLabel(find("third", 1)),
      ]);
      return;
    }

    const findJunior = (key: string, votes: number, legacyIndex: number) =>
      submissionLines.find((line) => line.schemeLineKey === key)
      || takeLegacyLine(submissionLines, votes, legacyIndex);
    juniors.push([
      ...commonCells(submission),
      lineLabel(findJunior("best_male", 2, 0)),
      lineLabel(findJunior("second_male", 1, 0)),
      lineLabel(findJunior("best_female", 2, 1)),
      lineLabel(findJunior("second_female", 1, 1)),
    ]);
  });

  return { seniors, juniors };
};

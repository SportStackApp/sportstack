import type { PlayerExplorerResult } from "@/lib/playerExplorer";

export type PlayerExplorerSortKey =
  | "displayName"
  | "identityStatus"
  | "teamNames"
  | "gamesPlayed"
  | "goals"
  | "greenCards"
  | "yellowCards"
  | "redCards";

export type PlayerExplorerSortDirection = "asc" | "desc";

export interface PlayerExplorerTotals {
  gamesPlayed: number;
  goals: number;
  greenCards: number;
  yellowCards: number;
  redCards: number;
}

const identityLabels: Record<PlayerExplorerResult["identityStatus"], string> = {
  linked: "Linked",
  placeholder: "Placeholder",
  unlinked: "Unlinked",
  identity_conflict: "Identity conflict",
};

const getSortValue = (result: PlayerExplorerResult, key: PlayerExplorerSortKey) => {
  if (key === "teamNames") return result.teamNames.join(", ");
  if (key === "identityStatus") return identityLabels[result.identityStatus];
  return result[key];
};

export const sortPlayerExplorerResults = (
  results: PlayerExplorerResult[],
  key: PlayerExplorerSortKey,
  direction: PlayerExplorerSortDirection,
) => [...results].sort((left, right) => {
  const leftValue = getSortValue(left, key);
  const rightValue = getSortValue(right, key);
  const comparison = typeof leftValue === "number" && typeof rightValue === "number"
    ? leftValue - rightValue
    : String(leftValue).localeCompare(String(rightValue), "en-AU", { sensitivity: "base" });

  if (comparison !== 0) return direction === "asc" ? comparison : -comparison;
  return left.displayName.localeCompare(right.displayName, "en-AU", { sensitivity: "base" })
    || left.revsportsPlayerId.localeCompare(right.revsportsPlayerId);
});

export const totalPlayerExplorerResults = (
  results: PlayerExplorerResult[],
): PlayerExplorerTotals => results.reduce<PlayerExplorerTotals>((totals, result) => ({
  gamesPlayed: totals.gamesPlayed + result.gamesPlayed,
  goals: totals.goals + result.goals,
  greenCards: totals.greenCards + result.greenCards,
  yellowCards: totals.yellowCards + result.yellowCards,
  redCards: totals.redCards + result.redCards,
}), {
  gamesPlayed: 0,
  goals: 0,
  greenCards: 0,
  yellowCards: 0,
  redCards: 0,
});

const formatExportDate = (value: string | null) => {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const protectSpreadsheetValue = (value: string | number) => {
  const text = String(value);
  return /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
};

const getExportRows = (results: PlayerExplorerResult[]) => [
  [
    "Player",
    "RevSports player ID",
    "Profile ID",
    "Identity",
    "Teams",
    "Games",
    "Goals",
    "Green cards",
    "Yellow cards",
    "Red cards",
    "Rounds played",
    "Latest game date",
  ],
  ...results.map((result) => [
    result.displayName,
    result.revsportsPlayerId,
    result.profileId || "",
    identityLabels[result.identityStatus],
    result.teamNames.join(", "),
    result.gamesPlayed,
    result.goals,
    result.greenCards,
    result.yellowCards,
    result.redCards,
    result.roundsPlayed.join(", "),
    formatExportDate(result.latestGameDate),
  ]),
];

const escapeCsvValue = (value: string | number) =>
  `"${protectSpreadsheetValue(value).replaceAll('"', '""')}"`;

export const buildPlayerExplorerCsv = (results: PlayerExplorerResult[]) =>
  getExportRows(results)
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");

export const buildPlayerExplorerTsv = (results: PlayerExplorerResult[]) =>
  getExportRows(results)
    .map((row) => row.map((value) => protectSpreadsheetValue(value).replace(/[\t\r\n]+/g, " ")).join("\t"))
    .join("\r\n");

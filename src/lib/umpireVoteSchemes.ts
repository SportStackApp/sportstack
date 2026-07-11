export type UmpireVoteSchemeKey = "classic_3_2_1" | "junior_2_1_split";

export interface UmpireVoteSchemeLine {
  key: string;
  label: string;
  points: number;
  badgeType?: "gold" | "silver" | "bronze";
}

export interface UmpireVoteScheme {
  key: UmpireVoteSchemeKey;
  name: string;
  description: string;
  lines: UmpireVoteSchemeLine[];
}

export const UMPIRE_VOTE_SCHEMES: Record<UmpireVoteSchemeKey, UmpireVoteScheme> = {
  classic_3_2_1: {
    key: "classic_3_2_1",
    name: "Classic 3/2/1",
    description: "Best on ground, second best and third best.",
    lines: [
      { key: "best", label: "Best on Ground", points: 3, badgeType: "gold" },
      { key: "second", label: "Second Best", points: 2, badgeType: "silver" },
      { key: "third", label: "Third Best", points: 1, badgeType: "bronze" },
    ],
  },
  junior_2_1_split: {
    key: "junior_2_1_split",
    name: "2/1 Male + 2/1 Female",
    description: "Separate best and second-best lines for male and female players.",
    lines: [
      { key: "best_male", label: "Best Male", points: 2, badgeType: "silver" },
      { key: "second_male", label: "Second Male", points: 1, badgeType: "bronze" },
      { key: "best_female", label: "Best Female", points: 2, badgeType: "silver" },
      { key: "second_female", label: "Second Female", points: 1, badgeType: "bronze" },
    ],
  },
};

export const getDefaultUmpireVoteScheme = (divisionName: string): UmpireVoteScheme => {
  const normalised = divisionName.toLowerCase();
  const isJunior =
    normalised.includes("under") ||
    normalised.includes("u11") ||
    normalised.includes("u14") ||
    normalised.includes("u16");

  return isJunior ? UMPIRE_VOTE_SCHEMES.junior_2_1_split : UMPIRE_VOTE_SCHEMES.classic_3_2_1;
};

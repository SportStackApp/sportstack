import {
  buildScopedDraftKey,
  loadScopedDraft,
  removeScopedDraft,
  saveScopedDraft,
  type DraftStorage,
} from "@/lib/scopedDraftStorage";
import type { UmpireVoteSchemeKey } from "@/lib/umpireVoteSchemes";

const VALID_SCHEMES = new Set<UmpireVoteSchemeKey>(["classic_3_2_1", "junior_2_1_split"]);

export interface UmpireBallotDraftVoteCard {
  schemeLineKey: string;
  label: string;
  points: number;
  profileId: string | null;
  playerName: string;
  playerNumber: string;
  teamId: string;
  badgeType?: "gold" | "silver" | "bronze";
}

export interface UmpireBallotDraft {
  step: 1 | 2 | 3;
  isProxy: boolean;
  proxyUmpireName: string;
  proxyUmpireProfileId: string | null;
  proxyReason: string;
  selectedAssociationId: string;
  selectedRound: string;
  selectedDivisionId: string;
  selectedFixtureId: string;
  selectedSchemeKey: UmpireVoteSchemeKey;
  voteCards: UmpireBallotDraftVoteCard[];
  numberOnlyAcknowledged: boolean;
}

export function isMeaningfulUmpireBallotDraft(draft: UmpireBallotDraft): boolean {
  return draft.step !== 1
    || draft.isProxy
    || Boolean(draft.proxyUmpireName.trim() || draft.proxyUmpireProfileId || draft.proxyReason.trim())
    || Boolean(draft.selectedRound || draft.selectedDivisionId || draft.selectedFixtureId)
    || draft.voteCards.length > 0
    || draft.numberOnlyAcknowledged;
}

// Callers use sessionStorage: each tab owns an independent copy, even after Duplicate Tab.
export function buildUmpireBallotDraftKey(accountId: string): string {
  return buildScopedDraftKey({
    accountId,
    scopeType: "umpire-ballot",
    scopeId: "signed-in",
    recordType: "tab",
    recordId: "current",
  });
}

const isVoteCard = (value: unknown): value is UmpireBallotDraftVoteCard => {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<UmpireBallotDraftVoteCard>;
  return typeof card.schemeLineKey === "string"
    && typeof card.label === "string"
    && typeof card.points === "number"
    && (card.profileId === null || typeof card.profileId === "string")
    && typeof card.playerName === "string"
    && typeof card.playerNumber === "string"
    && typeof card.teamId === "string"
    && (card.badgeType === undefined || ["gold", "silver", "bronze"].includes(card.badgeType));
};

export function isUmpireBallotDraft(value: unknown): value is UmpireBallotDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<UmpireBallotDraft>;
  return [1, 2, 3].includes(draft.step ?? 0)
    && typeof draft.isProxy === "boolean"
    && typeof draft.proxyUmpireName === "string"
    && (draft.proxyUmpireProfileId === null || typeof draft.proxyUmpireProfileId === "string")
    && typeof draft.proxyReason === "string"
    && typeof draft.selectedAssociationId === "string"
    && typeof draft.selectedRound === "string"
    && typeof draft.selectedDivisionId === "string"
    && typeof draft.selectedFixtureId === "string"
    && VALID_SCHEMES.has(draft.selectedSchemeKey as UmpireVoteSchemeKey)
    && Array.isArray(draft.voteCards)
    && draft.voteCards.every(isVoteCard)
    && typeof draft.numberOnlyAcknowledged === "boolean";
}

export function saveUmpireBallotDraft(key: string, draft: UmpireBallotDraft, storage: DraftStorage) {
  return saveScopedDraft(key, draft, storage);
}

export function loadUmpireBallotDraft(key: string, storage: DraftStorage) {
  return loadScopedDraft(key, isUmpireBallotDraft, storage);
}

export function clearUmpireBallotDraft(key: string, storage: DraftStorage) {
  return removeScopedDraft(key, storage);
}

export function retireLegacyUmpireBallotDraft(accountId: string, storage: DraftStorage) {
  try {
    storage.removeItem(`sportstack:umpire-ballot:${accountId}`);
    return true;
  } catch {
    return false;
  }
}

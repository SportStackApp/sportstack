import type { DisciplineEvidenceStatusEvent } from "./types";

export type EvidenceStatusTarget = "EVIDENCE" | "WITNESS";

export function latestEvidenceStatusEvent(
  events: DisciplineEvidenceStatusEvent[],
  targetType: EvidenceStatusTarget,
  targetId: string,
) {
  return events
    .filter((event) =>
      event.target_type === targetType
      && (targetType === "EVIDENCE"
        ? event.evidence_id === targetId
        : event.witness_id === targetId),
    )
    .sort((left, right) => right.event_sequence - left.event_sequence)[0] ?? null;
}

export function evidenceStatusNeedsDecision(
  event: DisciplineEvidenceStatusEvent | null,
) {
  return event?.status === "WITHDRAWAL_REQUESTED";
}

export function evidenceStatusPreventsReliance(
  event: DisciplineEvidenceStatusEvent | null,
) {
  return event?.status === "WITHDRAWAL_REQUESTED"
    || event?.status === "EXCLUDED_FROM_RELIANCE";
}

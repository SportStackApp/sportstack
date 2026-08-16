import { describe, expect, it } from "vitest";
import type { DisciplineEvidenceStatusEvent } from "./types";
import {
  evidenceStatusNeedsDecision,
  evidenceStatusPreventsReliance,
  latestEvidenceStatusEvent,
} from "./evidenceStatus";

const event = (
  id: string,
  status: string,
  recordedAt: string,
): DisciplineEvidenceStatusEvent => ({
  case_id: "case-1",
  evidence_id: "evidence-1",
  event_sequence: Number(id),
  id,
  pressure_or_intimidation_concern: false,
  reason: "A sufficiently detailed test reason.",
  recorded_at: recordedAt,
  recorded_by: "person-1",
  request_source: "WITNESS",
  safety_concern: false,
  source_references: ["HV Rule 7.19(f)-(g)"],
  status,
  target_type: "EVIDENCE",
  witness_id: null,
});

describe("discipline evidence status", () => {
  it("uses the latest append-only event for an evidence item", () => {
    const latest = latestEvidenceStatusEvent([
      event("1", "WITHDRAWAL_REQUESTED", "2026-08-16T09:00:00Z"),
      event("2", "RETAINED_LIMITED_WEIGHT", "2026-08-16T10:00:00Z"),
    ], "EVIDENCE", "evidence-1");
    expect(latest?.status).toBe("RETAINED_LIMITED_WEIGHT");
  });

  it("pauses reliance while a request awaits a decision", () => {
    const pending = event("1", "WITHDRAWAL_REQUESTED", "2026-08-16T09:00:00Z");
    expect(evidenceStatusNeedsDecision(pending)).toBe(true);
    expect(evidenceStatusPreventsReliance(pending)).toBe(true);
  });

  it("keeps excluded evidence visible but unavailable for reliance", () => {
    const excluded = event("1", "EXCLUDED_FROM_RELIANCE", "2026-08-16T09:00:00Z");
    expect(evidenceStatusNeedsDecision(excluded)).toBe(false);
    expect(evidenceStatusPreventsReliance(excluded)).toBe(true);
  });
});

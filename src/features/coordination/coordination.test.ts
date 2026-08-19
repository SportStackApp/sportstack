import { describe, expect, it } from "vitest";
import {
  capOfferDeadline,
  coordinationAvailabilityLabel,
  coordinationTabsForAccess,
  defaultOfferDeadline,
  formatCoordinationStatus,
  isCoordinationAvailability,
  isUrgentOffer,
} from "./coordination";

describe("Coordination offer rules", () => {
  it("caps the default 72-hour deadline at the fixture start", () => {
    const now = new Date("2026-08-17T00:00:00Z");
    expect(defaultOfferDeadline("2026-08-18T00:00:00Z", now).toISOString()).toBe("2026-08-18T00:00:00.000Z");
  });

  it("keeps a requested deadline that is before the fixture start", () => {
    const requested = new Date("2026-08-17T12:00:00Z");
    expect(capOfferDeadline("2026-08-18T00:00:00Z", requested)).toBe(requested);
  });

  it("marks windows under two hours as urgent", () => {
    const now = new Date("2026-08-17T00:00:00Z");
    expect(isUrgentOffer("2026-08-17T01:59:00Z", now)).toBe(true);
    expect(isUrgentOffer("2026-08-17T02:00:00Z", now)).toBe(false);
  });

  it("turns database states into readable labels", () => {
    expect(formatCoordinationStatus("ACCEPTED_AWAITING_CONFIRMATION")).toBe("Accepted awaiting confirmation");
  });

  it("recognises only Coordination-owned availability states", () => {
    expect(isCoordinationAvailability("UMPIRING")).toBe(true);
    expect(isCoordinationAvailability("AVAILABLE")).toBe(false);
  });

  it("labels confirmed fixture duties clearly", () => {
    expect(coordinationAvailabilityLabel("TECHNICAL_BENCH")).toBe("Technical Bench");
  });

  it("keeps an ordinary Umpire on personal Coordination work", () => {
    expect(coordinationTabsForAccess({
      can_manage_umpires: false,
      can_manage_technical_bench: false,
      can_manage_volunteers: false,
      can_manage_matrix: false,
      can_review_roster_mismatches: false,
    })).toEqual(["mine"]);
  });

  it("shows only the Umpire Coordinator tabs", () => {
    expect(coordinationTabsForAccess({
      can_manage_umpires: true,
      can_manage_technical_bench: false,
      can_manage_volunteers: false,
      can_manage_matrix: true,
      can_review_roster_mismatches: true,
    })).toEqual(["fixtures", "mine", "matrix", "roster-checks"]);
  });

  it("keeps Volunteer Coordinator access separate", () => {
    expect(coordinationTabsForAccess({
      can_manage_umpires: false,
      can_manage_technical_bench: false,
      can_manage_volunteers: true,
      can_manage_matrix: false,
      can_review_roster_mismatches: false,
    })).toEqual(["mine", "activities"]);
  });
});

import { describe, expect, it } from "vitest";
import { blankPhase2Payload, validatePhase2Stage } from "./phase2Logic";

describe("post-referral discipline workflow", () => {
  it("requires explicit simulation acknowledgement", () => {
    expect(validatePhase2Stage("NOTICE", "DRAFT", "SIMULATION", blankPhase2Payload("NOTICE"))).toContain(
      "Confirm that this record is a workflow simulation only.",
    );
  });

  it("blocks an incomplete issued notice", () => {
    const value = blankPhase2Payload("NOTICE");
    value.simulation_acknowledged = true;
    expect(validatePhase2Stage("NOTICE", "ISSUED", "SIMULATION", value).length).toBeGreaterThan(0);
  });

  it("requires penalty safeguards only when a charge is proved", () => {
    const value = blankPhase2Payload("DETERMINATION");
    value.simulation_acknowledged = true;
    value.charge_results = "All three simulated charges were considered separately.";
    value.majority_basis = "Unanimous simulated panel.";
    value.reasons = "Simulation reasons based only on the supplied incident reports.";
    expect(validatePhase2Stage("DETERMINATION", "FINAL", "SIMULATION", value)).toEqual([]);
    value.any_charge_proved = true;
    expect(validatePhase2Stage("DETERMINATION", "FINAL", "SIMULATION", value)).toContain(
      "Invite penalty submissions and record sanctions for a proved charge.",
    );
  });

  it("requires every closure safeguard", () => {
    const value = blankPhase2Payload("CLOSURE");
    value.simulation_acknowledged = true;
    value.closure_summary = "The simulated case record is complete and retained for workflow testing.";
    expect(validatePhase2Stage("CLOSURE", "CLOSED", "SIMULATION", value).length).toBeGreaterThan(0);
  });

  it("requires the complete Appeal Board safeguards before a final appeal", () => {
    const value = blankPhase2Payload("APPEAL");
    value.simulation_acknowledged = true;
    value.decision_notified_at = "2026-08-20T20:00";
    value.appeal_deadline_at = "2026-08-24T12:00";
    value.pathway_confirmation = "Dev pathway confirmation only.";
    value.appeal_outcome = "The simulated appeal was dismissed.";
    expect(validatePhase2Stage("APPEAL", "FINAL", "SIMULATION", value)).toContain(
      "Complete the Appeal Board appointment, independence, Chair, hearing and majority checks.",
    );
  });
});

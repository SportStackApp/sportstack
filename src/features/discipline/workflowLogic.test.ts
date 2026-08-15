import { describe, expect, it } from "vitest";
import {
  canCompleteWorkflowStage,
  neutralReferencePrefix,
  predictiveMatches,
  validateRiskDraft,
} from "./workflowLogic";

describe("discipline workflow rules", () => {
  it("waits for three characters before showing predictive matches", () => {
    const options = [{ label: "Tim Dhillon" }, { label: "Tina Example" }];
    expect(predictiveMatches("Ti", options)).toEqual([]);
    expect(predictiveMatches("Tim", options)).toEqual([{ label: "Tim Dhillon" }]);
  });

  it("uses neutral references and never labels a reported person accused", () => {
    expect(neutralReferencePrefix("REPORTER")).toBe("Reporter");
    expect(neutralReferencePrefix("REPORTED_PERSON")).toBe("Reported Person");
  });

  it("requires all four core risk fields", () => {
    expect(validateRiskDraft({ riskDescription: "", likelihood: "", severity: "", mitigationAction: "" })).toHaveLength(4);
    expect(validateRiskDraft({ riskDescription: "Possible contact injury", likelihood: "POSSIBLE", severity: "MAJOR", mitigationAction: "Stand down from matches pending review" })).toEqual([]);
  });

  it("separates committee, Tribunal and appeal responsibilities", () => {
    expect(canCompleteWorkflowStage("NOTICE", ["CASE_COORDINATOR"])).toBe(true);
    expect(canCompleteWorkflowStage("DETERMINATION", ["CASE_COORDINATOR"])).toBe(false);
    expect(canCompleteWorkflowStage("DETERMINATION", ["TRIBUNAL_MEMBER"])).toBe(true);
    expect(canCompleteWorkflowStage("APPEAL", ["APPEAL_BOARD_MEMBER"])).toBe(true);
  });
});

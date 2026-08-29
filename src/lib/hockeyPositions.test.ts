import { describe, expect, it } from "vitest";
import { areaPositionCode, combinedPositionCode, describeHockeyPosition, HOCKEY_POSITION_CHOICES, hockeyPositionChoiceFromCode, inferHockeyPosition, sidePositionCode } from "./hockeyPositions";

describe("hockey position traits", () => {
  it("supports area-only, side-only and combined positions", () => {
    expect(describeHockeyPosition("DEFENDER", null)).toBe("Defender");
    expect(describeHockeyPosition(null, "LEFT")).toBe("Left");
    expect(describeHockeyPosition("ATTACKER", "RIGHT")).toBe("Attacker - Right");
  });

  it("never adds a side to goalkeeper", () => {
    expect(describeHockeyPosition("GOALKEEPER", "LEFT")).toBe("Goalkeeper");
    expect(inferHockeyPosition("Goalkeeper", "GK")).toEqual({ area: "GOALKEEPER", side: null });
  });

  it("maps familiar formation labels to the underlying traits", () => {
    expect(inferHockeyPosition("Left Half", "LH")).toEqual({ area: "MIDFIELDER", side: "LEFT" });
    expect(inferHockeyPosition("Centre Forward", "CF")).toEqual({ area: "ATTACKER", side: "CENTRE" });
  });

  it("uses stable canonical storage keys", () => {
    expect(areaPositionCode("DEFENDER")).toBe("AREA_DEFENDER");
    expect(sidePositionCode("RIGHT")).toBe("SIDE_RIGHT");
    expect(combinedPositionCode("MIDFIELDER", "LEFT")).toBe("POSITION_MIDFIELDER_LEFT");
  });

  it("offers paired positions plus deliberate area-only and side-only choices", () => {
    expect(HOCKEY_POSITION_CHOICES.map((choice) => choice.label)).toContain("Defender - Left");
    expect(HOCKEY_POSITION_CHOICES.map((choice) => choice.label)).toContain("Attacker - Right");
    expect(HOCKEY_POSITION_CHOICES.map((choice) => choice.label)).toContain("Left side - any area");
    expect(hockeyPositionChoiceFromCode("POSITION_DEFENDER_CENTRE")).toMatchObject({
      area: "DEFENDER",
      side: "CENTRE",
      canonicalGroup: "DEFENCE",
    });
  });

  console.log("hockey position tests passed");
});

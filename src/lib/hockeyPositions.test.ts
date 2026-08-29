import { describe, expect, it } from "vitest";
import { areaPositionCode, describeHockeyPosition, inferHockeyPosition, sidePositionCode } from "./hockeyPositions";

describe("hockey position traits", () => {
  it("supports area-only, side-only and combined positions", () => {
    expect(describeHockeyPosition("DEFENDER", null)).toBe("Defender");
    expect(describeHockeyPosition(null, "LEFT")).toBe("Left");
    expect(describeHockeyPosition("ATTACKER", "RIGHT")).toBe("Right Attacker");
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
  });

  console.log("hockey position tests passed");
});

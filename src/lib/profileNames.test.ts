import { describe, expect, it } from "vitest";
import { formatPitchPlayerName, formatStandardName } from "./profileNames";

describe("profile name formatting", () => {
  it("keeps preferred name stored but unwired from the ordinary display name", () => {
    expect(formatStandardName({ firstName: "Aaron", preferredName: "Az", lastName: "Mullane" }))
      .toBe("Aaron Mullane");
  });

  it("uses first initial and surname on the pitch", () => {
    expect(formatPitchPlayerName({ firstName: "Hugh", lastName: "Cullen" }, false)).toBe("H. Cullen");
  });

  it("uses a nickname only when explicitly enabled", () => {
    const person = { firstName: "Hugh", lastName: "Cullen", nickname: "H" };
    expect(formatPitchPlayerName(person, true)).toBe("H");
    expect(formatPitchPlayerName(person, false)).toBe("H. Cullen");
  });

  it("falls back safely when part of a name is missing", () => {
    expect(formatPitchPlayerName({ lastName: "Cullen" }, false)).toBe("Cullen");
    expect(formatPitchPlayerName({ nickname: "Rocket" }, false)).toBe("Rocket");
  });

  console.log("profile name tests passed");
});

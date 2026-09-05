import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MvpTallyPresentationPage route changes", () => {
  it("clears unavailable presentation state before loading the next route id", () => {
    const source = readFileSync(new URL("./MvpTallyPresentationPage.tsx", import.meta.url), "utf8");
    const loadStart = source.indexOf("const load = async () => {");
    const unavailableReset = source.indexOf("setUnavailable(false);", loadStart);
    const presentationReset = source.indexOf("setPresentation(null);", loadStart);
    const requestStart = source.indexOf("await getMvpTallyPresentation(id)", loadStart);

    expect(loadStart).toBeGreaterThanOrEqual(0);
    expect(unavailableReset).toBeGreaterThan(loadStart);
    expect(presentationReset).toBeGreaterThan(loadStart);
    expect(requestStart).toBeGreaterThan(unavailableReset);
    expect(requestStart).toBeGreaterThan(presentationReset);
  });
});

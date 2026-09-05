import { describe, expect, it } from "vitest";
import { getFunctionErrorMessage } from "./function-error-message";

describe("getFunctionErrorMessage", () => {
  it("returns the Edge Function response message", async () => {
    const error = {
      context: new Response(JSON.stringify({ error: "Authentication lookup failed" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    };

    await expect(getFunctionErrorMessage(error, "Fallback")).resolves.toBe("Authentication lookup failed");
  });

  it("falls back to a normal Error message", async () => {
    await expect(getFunctionErrorMessage(new Error("Network unavailable"), "Fallback")).resolves.toBe(
      "Network unavailable",
    );
  });
});

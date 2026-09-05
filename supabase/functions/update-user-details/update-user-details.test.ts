import { describe, expect, it, vi } from "vitest";
import { saveUserDetails } from "./logic";

const makeGateways = () => {
  const calls: string[] = [];
  const auth = {
    getUserById: vi.fn(async () => {
      calls.push("auth:get");
      return { user: { email: "old@example.com" }, error: null };
    }),
    updateEmail: vi.fn(async (_userId: string, email: string) => {
      calls.push(`auth:update:${email}`);
      return { error: null };
    }),
  };
  const profiles = {
    updateProfile: vi.fn(async () => {
      calls.push("profile:update");
      return { error: null };
    }),
  };
  return { auth, profiles, calls };
};

describe("saveUserDetails", () => {
  it("stops before the profile write when Auth cannot be read", async () => {
    const { auth, profiles } = makeGateways();
    auth.getUserById.mockResolvedValueOnce({ user: null, error: { message: "bad ban value" } });

    const result = await saveUserDetails({
      userId: "player-1",
      requestedEmail: "new@example.com",
      profileUpdate: { first_name: "New" },
      isSuperAdmin: true,
      auth,
      profiles,
    });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(profiles.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects an Association Admin email change before changing profile data", async () => {
    const { auth, profiles } = makeGateways();
    const result = await saveUserDetails({
      userId: "player-1",
      requestedEmail: "new@example.com",
      profileUpdate: { first_name: "New" },
      isSuperAdmin: false,
      auth,
      profiles,
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(auth.updateEmail).not.toHaveBeenCalled();
    expect(profiles.updateProfile).not.toHaveBeenCalled();
  });

  it("updates Auth before profile data", async () => {
    const { auth, profiles, calls } = makeGateways();
    const result = await saveUserDetails({
      userId: "player-1",
      requestedEmail: "new@example.com",
      profileUpdate: { first_name: "New" },
      isSuperAdmin: true,
      auth,
      profiles,
    });

    expect(result).toEqual({ ok: true, emailChanged: true });
    expect(calls).toEqual(["auth:get", "auth:update:new@example.com", "profile:update"]);
  });

  it("restores the old Auth email when the profile write fails", async () => {
    const { auth, profiles, calls } = makeGateways();
    profiles.updateProfile.mockImplementationOnce(async () => {
      calls.push("profile:update");
      return { error: { message: "profile failed" } };
    });

    const result = await saveUserDetails({
      userId: "player-1",
      requestedEmail: "new@example.com",
      profileUpdate: { first_name: "New" },
      isSuperAdmin: true,
      auth,
      profiles,
    });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(calls).toEqual([
      "auth:get",
      "auth:update:new@example.com",
      "profile:update",
      "auth:update:old@example.com",
    ]);
  });
});

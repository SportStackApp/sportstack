import { describe, expect, it } from "vitest";
import {
  hasAssignedAccountAccess,
  hasDisciplineRouteAccess,
  isAccountEntryPath,
} from "./accountAccess";

describe("account access", () => {
  it("keeps an unassigned account in the entry experience", () => {
    expect(hasAssignedAccountAccess({ roleCount: 0, activeMembershipCount: 0 })).toBe(false);
  });

  it("allows either a role or an active membership", () => {
    expect(hasAssignedAccountAccess({ roleCount: 1, activeMembershipCount: 0 })).toBe(true);
    expect(hasAssignedAccountAccess({ roleCount: 0, activeMembershipCount: 1 })).toBe(true);
  });

  it("allows only the dashboard and applicable profile through the entry gate", () => {
    expect(isAccountEntryPath("/dashboard", "/profile")).toBe(true);
    expect(isAccountEntryPath("/profile", "/profile")).toBe(true);
    expect(isAccountEntryPath("/games", "/profile")).toBe(false);
  });

  it("allows case-assigned access only on discipline routes", () => {
    expect(hasDisciplineRouteAccess("/discipline/cases/case-1", true)).toBe(true);
    expect(hasDisciplineRouteAccess("/games", true)).toBe(false);
    expect(hasDisciplineRouteAccess("/discipline", false)).toBe(false);
  });
});

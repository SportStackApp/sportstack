import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

import {
  approvePrimaryTeamChange,
  cancelPrimaryTeamChange,
  confirmPrimaryTeamChange,
  declinePrimaryTeamChange,
  requestPrimaryTeamChange,
  type PrimaryTeamChangeRpcClient,
} from "./primaryTeamChangeRpc";

const createClient = () => {
  const rpc = vi.fn().mockResolvedValue({ data: { status: "ok" }, error: null });
  return { client: { rpc } as PrimaryTeamChangeRpcClient, rpc };
};

describe("primary-team change RPC helpers", () => {
  it("uses the audited player request function", async () => {
    const { client, rpc } = createClient();

    await requestPrimaryTeamChange("team-1", client);

    expect(rpc).toHaveBeenCalledWith("request_primary_team_change", {
      p_to_team_id: "team-1",
    });
  });

  it("uses the scoped admin approval function", async () => {
    const { client, rpc } = createClient();

    await approvePrimaryTeamChange("request-1", client);

    expect(rpc).toHaveBeenCalledWith("approve_primary_team_change", {
      p_request_id: "request-1",
    });
  });

  it("uses the atomic player confirmation function", async () => {
    const { client, rpc } = createClient();

    await confirmPrimaryTeamChange("request-2", client);

    expect(rpc).toHaveBeenCalledWith("confirm_primary_team_change", {
      p_request_id: "request-2",
    });
  });

  it("uses the audited player cancellation function", async () => {
    const { client, rpc } = createClient();

    await cancelPrimaryTeamChange("request-3", client);

    expect(rpc).toHaveBeenCalledWith("cancel_primary_team_change", {
      p_request_id: "request-3",
    });
  });

  it("uses the scoped admin decline function", async () => {
    const { client, rpc } = createClient();

    await declinePrimaryTeamChange("request-4", client);

    expect(rpc).toHaveBeenCalledWith("decline_primary_team_change", {
      p_request_id: "request-4",
    });
  });
});

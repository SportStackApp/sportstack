import { supabase } from "@/integrations/supabase/client";

interface RpcResult<T> {
  data: T | null;
  error: unknown;
}

export interface PrimaryTeamChangeRpcClient {
  rpc: (
    functionName:
      | "request_primary_team_change"
      | "approve_primary_team_change"
      | "confirm_primary_team_change"
      | "cancel_primary_team_change"
      | "decline_primary_team_change",
    args: { p_request_id: string } | { p_to_team_id: string },
  ) => Promise<RpcResult<Record<string, unknown>>>;
}

const primaryTeamChangeClient = supabase as unknown as PrimaryTeamChangeRpcClient;

export const requestPrimaryTeamChange = (
  toTeamId: string,
  client: PrimaryTeamChangeRpcClient = primaryTeamChangeClient,
) => client.rpc("request_primary_team_change", { p_to_team_id: toTeamId });

export const approvePrimaryTeamChange = (
  requestId: string,
  client: PrimaryTeamChangeRpcClient = primaryTeamChangeClient,
) => client.rpc("approve_primary_team_change", { p_request_id: requestId });

export const confirmPrimaryTeamChange = (
  requestId: string,
  client: PrimaryTeamChangeRpcClient = primaryTeamChangeClient,
) => client.rpc("confirm_primary_team_change", { p_request_id: requestId });

export const cancelPrimaryTeamChange = (
  requestId: string,
  client: PrimaryTeamChangeRpcClient = primaryTeamChangeClient,
) => client.rpc("cancel_primary_team_change", { p_request_id: requestId });

export const declinePrimaryTeamChange = (
  requestId: string,
  client: PrimaryTeamChangeRpcClient = primaryTeamChangeClient,
) => client.rpc("decline_primary_team_change", { p_request_id: requestId });

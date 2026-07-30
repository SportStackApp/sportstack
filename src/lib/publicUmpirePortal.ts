import { supabase } from "@/integrations/supabase/client";
import type { UmpireLinkedPlayerOption } from "@/lib/umpireLinkedPlayers";

export interface PublicUmpireVoteLineDefinition {
  key: string;
  label: string;
  points: number;
}

export interface PublicUmpireFixture {
  id: string;
  roundNumber: number;
  roundName: string | null;
  divisionId: string;
  divisionName: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  fixtureDate: string | null;
  status: string;
  schemeKey: "classic_3_2_1" | "junior_2_1_split";
  schemeLines: PublicUmpireVoteLineDefinition[];
}

export interface PublicUmpireVoteInput {
  lineKey: string;
  profileId: string | null;
  playerName: string;
  playerNumber: string;
  teamId: string;
}

interface FunctionErrorContext {
  json?: () => Promise<{ error?: string }>;
}

async function invokePublicUmpireFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("public-umpire-match-voting", {
    body,
  });

  if (error) {
    let message = error.message || "The umpire portal could not complete this request.";
    const context = (error as unknown as { context?: FunctionErrorContext }).context;
    if (context?.json) {
      try {
        const errorBody = await context.json();
        if (errorBody?.error) message = errorBody.error;
      } catch {
        // Keep the safe fallback message when a gateway response is not JSON.
      }
    }
    throw new Error(message);
  }

  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const loadPublicUmpireFixtures = () =>
  invokePublicUmpireFunction<{
    association: { id: string; name: string };
    fixtures: PublicUmpireFixture[];
  }>({ action: "match-options" });

export const loadPublicUmpirePlayers = (fixtureId: string) =>
  invokePublicUmpireFunction<{ candidates: UmpireLinkedPlayerOption[] }>({
    action: "player-options",
    fixtureId,
  });

export const submitPublicUmpireVotes = (input: {
  submitterName: string;
  submitterEmail: string;
  submissionMode: "self" | "proxy";
  proxyUmpireName: string;
  proxyReason: string;
  fixtureId: string;
  turnstileToken: string;
  idempotencyKey: string;
  website: string;
  votes: PublicUmpireVoteInput[];
}) =>
  invokePublicUmpireFunction<{ reference: string; status: "PENDING" }>({
    action: "submit",
    ...input,
  });

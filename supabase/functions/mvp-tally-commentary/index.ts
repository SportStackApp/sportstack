import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.2";

type Provider = "OPENAI" | "ANTHROPIC";
type AggregatePlayer = { token: string; total: number; rank: number; roundGain: number; rankChange: number };
type AggregateRound = { round: number; players: AggregatePlayer[]; roundsRemaining: number };
type ProviderComment = { round: number; text: string };

const allowedOrigins = new Set([
  "http://localhost:8081",
  "https://dev.sportstackapp.com.au",
  "https://main.sportstackapp.com.au",
]);
const headersFor = (request: Request) => {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://dev.sportstackapp.com.au",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
};
const respond = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: headersFor(request) });

const parseJson = (text: string) => {
  const trimmed = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1)) as { rounds?: ProviderComment[] };
};

const rankTotals = (totals: Map<string, number>) => {
  const ordered = [...totals.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  let rank = 0;
  let previous: number | null = null;
  return ordered.map(([key, points]) => {
    if (points !== previous) rank += 1;
    previous = points;
    return { key, points, rank };
  });
};

const buildAggregates = (snapshot: unknown) => {
  const rounds = snapshot && typeof snapshot === "object" && Array.isArray((snapshot as { rounds?: unknown }).rounds)
    ? (snapshot as { rounds: Array<Record<string, unknown>> }).rounds
    : [];
  const tokenByKey = new Map<string, string>();
  const nameByToken = new Map<string, string>();
  const totals = new Map<string, number>();
  let previousRanks = new Map<string, number>();

  const aggregateRounds: AggregateRound[] = rounds.map((round, roundIndex) => {
    const gains = new Map<string, number>();
    const cards = Array.isArray(round.cards) ? round.cards as Array<Record<string, unknown>> : [];
    for (const card of cards) {
      const key = String(card.playerKey || "");
      const name = String(card.playerName || "Player");
      const points = Number(card.points || 0);
      if (!key || ![1, 2, 3].includes(points)) continue;
      if (!tokenByKey.has(key)) tokenByKey.set(key, `P${tokenByKey.size + 1}`);
      const token = tokenByKey.get(key)!;
      nameByToken.set(token, name);
      totals.set(token, (totals.get(token) || 0) + points);
      gains.set(token, (gains.get(token) || 0) + points);
    }
    const ranked = rankTotals(totals);
    const players = ranked.map((result) => ({
      token: result.key,
      total: result.points,
      rank: result.rank,
      roundGain: gains.get(result.key) || 0,
      rankChange: previousRanks.has(result.key) ? previousRanks.get(result.key)! - result.rank : 0,
    }));
    previousRanks = new Map(ranked.map((result) => [result.key, result.rank]));
    return { round: roundIndex + 1, players, roundsRemaining: rounds.length - roundIndex - 1 };
  });

  return {
    rounds,
    aggregateRounds,
    nameByToken,
  };
};

const promptFor = (rounds: AggregateRound[]) => `Write one upbeat Australian-English sports-broadcast sentence for each round.
Use only the aggregate data below. Players are anonymous tokens. Never infer identity, a voter, or a ballot.
Prioritise: a climb of 3+ ranks or gain of 6+ points; ties or a gap of 2 points; a close contest with 2 rounds remaining; a leader ahead by 6+ points or 25%; otherwise an open contest.
Stay positive. Do not mention bottom, last, poor, bad, losing, struggling or low-ranked players. Maximum 180 characters each.
Return only JSON in this shape: {"rounds":[{"round":1,"text":"..."}]}.
Aggregate data: ${JSON.stringify(rounds)}`;

const callOpenAi = async (prompt: string) => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_NOT_CONFIGURED");
  const model = "gpt-5.6-luna";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(2300),
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 1200,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      text: {
        format: {
          type: "json_schema",
          name: "mvp_round_commentary",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["rounds"],
            properties: {
              rounds: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["round", "text"],
                  properties: { round: { type: "integer" }, text: { type: "string", maxLength: 180 } },
                },
              },
            },
          },
        },
      },
    }),
  });
  const raw = await response.json();
  if (!response.ok) throw new Error(raw?.error?.message || `OpenAI returned ${response.status}.`);
  const text = raw.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || [])
    .find((item: { type?: string }) => item.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI returned no commentary.");
  return { provider: "OPENAI" as Provider, model, value: parseJson(text) };
};

const callAnthropic = async (prompt: string) => {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_NOT_CONFIGURED");
  const model = "claude-haiku-4-5";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    signal: AbortSignal.timeout(2300),
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0,
      system: "Return only valid JSON. Follow the privacy and positive-language rules exactly.",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    }),
  });
  const raw = await response.json();
  if (!response.ok) throw new Error(raw?.error?.message || `Anthropic returned ${response.status}.`);
  const text = raw.content?.filter((item: { type?: string }) => item.type === "text")
    .map((item: { text?: string }) => item.text || "").join("\n");
  if (!text) throw new Error("Anthropic returned no commentary.");
  return { provider: "ANTHROPIC" as Provider, model, value: parseJson(text) };
};

const validateAndRestoreNames = (
  comments: ProviderComment[] | undefined,
  roundRows: Array<Record<string, unknown>>,
  nameByToken: Map<string, string>,
) => {
  if (!Array.isArray(comments) || comments.length !== roundRows.length) throw new Error("AI_COMMENTARY_INVALID_ROUND_COUNT");
  const banned = /\b(bottom|last|poor|bad|losing|struggling|low[- ]ranked|worst)\b/i;
  return comments.map((comment, index) => {
    if (comment.round !== index + 1 || typeof comment.text !== "string") throw new Error("AI_COMMENTARY_INVALID_ROUND");
    let text = comment.text.trim();
    if (!text || text.length > 180 || banned.test(text)) throw new Error("AI_COMMENTARY_INVALID_WORDING");
    for (const token of text.match(/\bP\d+\b/g) || []) {
      const name = nameByToken.get(token);
      if (!name) throw new Error("AI_COMMENTARY_UNKNOWN_PLAYER_TOKEN");
      text = text.replaceAll(token, name);
    }
    if (/\bP\d+\b/.test(text) || text.length > 180) throw new Error("AI_COMMENTARY_INVALID_PLAYER_REFERENCE");
    return { sessionId: String(roundRows[index].sessionId), text };
  });
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: headersFor(request) });
  if (request.method !== "POST") return respond(request, { error: "Method not allowed." }, 405);
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return respond(request, { error: "Origin not allowed." }, 403);
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return respond(request, { error: "Sign in is required." }, 401);

  try {
    const body = await request.json();
    const presentationId = String(body.presentationId || "");
    const sourceFingerprint = String(body.sourceFingerprint || "");
    if (!/^[0-9a-f-]{36}$/i.test(presentationId) || !sourceFingerprint) {
      return respond(request, { error: "Choose a valid tally preview." }, 400);
    }
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!url || !anonKey) return respond(request, { error: "Commentary is not configured." }, 503);
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await client.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (authError || !authData.user) return respond(request, { error: "Your session is invalid." }, 401);
    const { data: presentation, error: presentationError } = await client
      .from("mvp_tally_presentations")
      .select("id,status,card_snapshot,source_fingerprint")
      .eq("id", presentationId)
      .single();
    if (presentationError || !presentation || presentation.status !== "DRAFT"
      || presentation.source_fingerprint !== sourceFingerprint) {
      return respond(request, { error: "This tally preview changed. Build it again." }, 409);
    }

    const { rounds, aggregateRounds, nameByToken } = buildAggregates(presentation.card_snapshot);
    if (!rounds.length) return respond(request, { error: "This tally has no rounds." }, 400);
    const prompt = promptFor(aggregateRounds);
    let generated: Awaited<ReturnType<typeof callOpenAi>> | Awaited<ReturnType<typeof callAnthropic>>;
    try {
      generated = await callOpenAi(prompt);
    } catch (openAiError) {
      console.warn("OpenAI tally commentary failed; trying Anthropic", openAiError instanceof Error ? openAiError.message : openAiError);
      generated = await callAnthropic(prompt);
    }
    const commentary = {
      version: 1,
      source: "AI",
      provider: generated.provider,
      model: generated.model,
      rounds: validateAndRestoreNames(generated.value.rounds, rounds, nameByToken),
    };
    const { error: saveError } = await client.rpc("save_mvp_tally_commentary", {
      p_presentation_id: presentationId,
      p_source_fingerprint: sourceFingerprint,
      p_commentary: commentary,
    });
    if (saveError) throw saveError;
    return respond(request, { commentary });
  } catch (error) {
    console.error("Player MVP tally commentary failed", error instanceof Error ? error.message : error);
    return respond(request, { error: "Rule-based commentary will be used." }, 503);
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import { extractWithFallback } from "../_shared/expense-ai-provider.ts";

const allowedOrigins = new Set(["http://localhost:8081", "https://dev.sportstackapp.com.au", "https://main.sportstackapp.com.au"]);
const headersFor = (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  return { "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://dev.sportstackapp.com.au", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json", Vary: "Origin" };
};
const respond = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headersFor(req) });
const fieldValue = (value: unknown) => value && typeof value === "object" && "value" in value ? (value as { value: unknown }).value : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: headersFor(req) });
  if (req.method !== "POST") return respond(req, { error: "Method not allowed." }, 405);
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return respond(req, { error: "Origin not allowed." }, 403);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return respond(req, { error: "Sign in is required." }, 401);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !anonKey || !serviceKey || (!Deno.env.get("OPENAI_API_KEY") && !Deno.env.get("ANTHROPIC_API_KEY"))) return respond(req, { error: "Statement scanning is not configured." }, 503);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  let importId: string | null = null;
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return respond(req, { error: "Your session is invalid." }, 401);
    const body = await req.json();
    importId = String(body.importId || "");
    if (!/^[0-9a-f-]{36}$/i.test(importId)) return respond(req, { error: "Choose a valid statement." }, 400);
    const { data: statement, error: statementError } = await userClient.from("expense_statement_imports").select("id, owner_user_id, storage_path, original_filename, mime_type, status, attempt_count").eq("id", importId).single();
    if (statementError || !statement) return respond(req, { error: "Statement not found or access denied." }, 404);
    if (statement.mime_type !== "application/pdf" && !statement.original_filename.toLowerCase().endsWith(".pdf")) return respond(req, { error: "AI statement scanning is only used for PDF files." }, 400);
    if (statement.status === "PROCESSING") return respond(req, { error: "This statement is already being scanned." }, 409);
    if (statement.attempt_count >= 5) return respond(req, { error: "This statement has reached the five-scan limit. Export it as CSV or continue manually." }, 429);
    const { count } = await userClient.from("expense_statement_lines").select("id", { count: "exact", head: true }).eq("import_id", importId);
    if (count) return respond(req, { error: "This statement already contains imported transactions." }, 409);
    const startedAt = new Date().toISOString();
    await admin.from("expense_statement_imports").update({ status: "PROCESSING", attempt_count: statement.attempt_count + 1, processing_started_at: startedAt, processing_completed_at: null, error_message: null, updated_at: startedAt, updated_by: authData.user.id }).eq("id", importId);
    const { data: file, error: downloadError } = await userClient.storage.from("expense-imports").download(statement.storage_path);
    if (downloadError || !file) throw downloadError || new Error("Statement download failed.");
    const extraction = await extractWithFallback(new Uint8Array(await file.arrayBuffer()), "application/pdf", statement.original_filename, "STATEMENT");
    const validated = extraction.validated as Record<string, unknown>;
    const rows = validated.transactions as Array<Record<string, unknown>>;
    const currency = String(fieldValue(validated.currency) || "AUD").toUpperCase().slice(0, 3);
    const { error: insertError } = await admin.from("expense_statement_lines").insert(rows.map((row, index) => ({
      import_id: importId,
      owner_user_id: statement.owner_user_id,
      line_number: index + 1,
      transaction_date: row.transaction_date,
      description: String(row.description).trim().slice(0, 500),
      reference: row.reference ? String(row.reference).slice(0, 250) : null,
      amount: Number(row.amount),
      balance: row.balance === null || row.balance === undefined ? null : Number(row.balance),
      currency_code: /^[A-Z]{3}$/.test(currency) ? currency : "AUD",
      raw_data: { extraction_confidence: Number(row.confidence || 0), source: "AI_PDF" },
    })));
    if (insertError) throw insertError;
    const completedAt = new Date().toISOString();
    const { error: updateError } = await admin.from("expense_statement_imports").update({
      bank_name: fieldValue(validated.bank_name), account_hint: fieldValue(validated.account_hint), status: "NEEDS_REVIEW", row_count: rows.length,
      provider: extraction.provider, model: extraction.model, input_tokens: extraction.inputTokens, output_tokens: extraction.outputTokens, estimated_cost_usd: extraction.estimatedCostUsd,
      processing_completed_at: completedAt, updated_at: completedAt, updated_by: authData.user.id,
    }).eq("id", importId);
    if (updateError) throw updateError;
    return respond(req, { importId, rowCount: rows.length, provider: extraction.provider, model: extraction.model, estimatedCostUsd: extraction.estimatedCostUsd });
  } catch (error) {
    if (importId) await admin.from("expense_statement_imports").update({ status: "FAILED", error_message: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error", processing_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", importId);
    console.error("expense-statement-extract", error instanceof Error ? error.message : error);
    return respond(req, { error: error instanceof Error ? error.message : "Statement scanning failed. The uploaded statement has been retained." }, 500);
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const allowedOrigins = new Set(["http://localhost:8081", "https://dev.sportstackapp.com.au", "https://main.sportstackapp.com.au"]);
const headersFor = (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  return { "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://dev.sportstackapp.com.au", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json", Vary: "Origin" };
};
const respond = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headersFor(req) });
const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["supplier_name", "supplier_abn", "invoice_number", "invoice_date", "due_date", "description", "subtotal", "gst_amount", "total_amount", "currency", "document_type", "overall_confidence"],
  properties: {
    supplier_name: { type: ["string", "null"] }, supplier_abn: { type: ["string", "null"] }, invoice_number: { type: ["string", "null"] },
    invoice_date: { type: ["string", "null"] }, due_date: { type: ["string", "null"] }, description: { type: ["string", "null"] },
    subtotal: { type: ["number", "null"] }, gst_amount: { type: ["number", "null"] }, total_amount: { type: ["number", "null"] },
    currency: { type: ["string", "null"] }, document_type: { type: ["string", "null"] }, overall_confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

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
  const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!url || !anonKey || !serviceKey || !openAiKey) return respond(req, { error: "Document scanning is not configured." }, 503);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let jobId: string | null = null;
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return respond(req, { error: "Your session is invalid." }, 401);
    const { attachmentId } = await req.json();
    if (!/^[0-9a-f-]{36}$/i.test(String(attachmentId || ""))) return respond(req, { error: "Choose a valid document." }, 400);
    const { data: attachment, error: attachmentError } = await userClient.from("expense_attachments").select("id, expense_id, storage_path, original_filename, mime_type").eq("id", attachmentId).single();
    if (attachmentError || !attachment) return respond(req, { error: "Document not found or access denied." }, 404);
    const { data: expense, error: expenseError } = await userClient.from("expenses").select("id, expense_date, total_amount").eq("id", attachment.expense_id).single();
    if (expenseError || !expense) return respond(req, { error: "Expense not found or access denied." }, 404);
    const { data: job, error: jobError } = await admin.from("expense_ai_processing_jobs").insert({ attachment_id: attachment.id, expense_id: expense.id, status: "PROCESSING", provider: "OPENAI", model: "gpt-5.6-luna", attempt_count: 1, started_at: new Date().toISOString(), created_by: authData.user.id }).select("id").single();
    if (jobError) throw jobError;
    jobId = job.id;
    const { data: file, error: downloadError } = await userClient.storage.from("expense-documents").download(attachment.storage_path);
    if (downloadError || !file) throw downloadError || new Error("Document download failed.");
    const fileData = `data:${attachment.mime_type};base64,${toBase64(new Uint8Array(await file.arrayBuffer()))}`;
    const documentInput = attachment.mime_type.startsWith("image/")
      ? { type: "input_image", image_url: fileData, detail: "low" }
      : { type: "input_file", filename: attachment.original_filename, file_data: fileData, detail: "low" };
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({
      model: "gpt-5.6-luna", store: false, reasoning: { effort: "low" },
      input: [{ role: "user", content: [documentInput, { type: "input_text", text: "Extract only values visible in this invoice or receipt. Use null when a value is absent. Dates must be YYYY-MM-DD. Do not invent values." }] }],
      text: { format: { type: "json_schema", name: "expense_document", strict: true, schema } },
    }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error?.message || "OpenAI extraction failed.");
    const outputText = result.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || []).find((item: { type?: string }) => item.type === "output_text")?.text;
    if (!outputText) throw new Error("The provider returned no structured result.");
    const validated = JSON.parse(outputText);
    const { data: extraction, error: extractionError } = await admin.from("expense_ai_extraction_results").insert({ processing_job_id: job.id, raw_result: result, validated_result: validated, overall_confidence: validated.overall_confidence }).select("id").single();
    if (extractionError) throw extractionError;
    const fields = Object.entries(validated).filter(([name]) => name !== "overall_confidence").map(([field_name, suggested_value]) => ({ processing_job_id: job.id, field_name, suggested_value, confidence_score: validated.overall_confidence, suggestion_source: "DOCUMENT" }));
    const { error: suggestionError } = await admin.from("expense_ai_field_suggestions").insert(fields);
    if (suggestionError) throw suggestionError;
    const amountMatches = validated.total_amount !== null && Math.abs(Number(validated.total_amount) - Math.abs(Number(expense.total_amount))) < 0.01;
    const dateMatches = !validated.invoice_date || validated.invoice_date === expense.expense_date;
    const evidenceStatus = amountMatches && dateMatches ? "VERIFIED" : "MISMATCH";
    await admin.from("expense_statement_lines").update({ evidence_status: evidenceStatus, updated_at: new Date().toISOString() }).eq("expense_id", expense.id);
    await admin.from("expense_ai_processing_jobs").update({ status: "READY_FOR_REVIEW", completed_at: new Date().toISOString(), input_tokens: result.usage?.input_tokens || null, output_tokens: result.usage?.output_tokens || null }).eq("id", job.id);
    return respond(req, { jobId: job.id, extractionId: extraction.id, evidenceStatus, result: validated });
  } catch (error) {
    if (jobId) await admin.from("expense_ai_processing_jobs").update({ status: "PROCESSING_FAILED", completed_at: new Date().toISOString(), error_message: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error" }).eq("id", jobId);
    console.error("expense-document-extract", error instanceof Error ? error.message : error);
    return respond(req, { error: error instanceof Error ? error.message : "Document scanning failed." }, 500);
  }
});

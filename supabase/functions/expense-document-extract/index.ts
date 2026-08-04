import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import { extractWithFallback } from "../_shared/expense-ai-provider.ts";

const allowedOrigins = new Set(["http://localhost:8081", "https://dev.sportstackapp.com.au", "https://main.sportstackapp.com.au"]);
const headersFor = (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  return { "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://dev.sportstackapp.com.au", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json", Vary: "Origin" };
};
const respond = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headersFor(req) });
const normalise = (value: unknown) => String(value || "").toLocaleLowerCase("en-AU").replace(/\b(pty|limited|ltd|australia|australian|au)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const fieldValue = (value: unknown) => value && typeof value === "object" && "value" in value ? (value as { value: unknown }).value : null;
const fieldConfidence = (value: unknown) => value && typeof value === "object" && "confidence" in value ? Number((value as { confidence: unknown }).confidence) : null;

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
  if (!url || !anonKey || !serviceKey || (!Deno.env.get("OPENAI_API_KEY") && !Deno.env.get("ANTHROPIC_API_KEY"))) return respond(req, { error: "Document scanning is not configured." }, 503);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let jobId: string | null = null;
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return respond(req, { error: "Your session is invalid." }, 401);
    const body = await req.json();

    if (body.action === "APPROVE") {
      if (!/^[0-9a-f-]{36}$/i.test(String(body.jobId || ""))) return respond(req, { error: "Choose a valid scan." }, 400);
      const { data: job, error: jobError } = await userClient.from("expense_ai_processing_jobs").select("id, expense_id, status").eq("id", body.jobId).single();
      if (jobError || !job) return respond(req, { error: "Scan not found or access denied." }, 404);
      if (job.status !== "READY_FOR_REVIEW") return respond(req, { error: "This scan is no longer waiting for approval." }, 409);
      const values = body.values && typeof body.values === "object" ? body.values as Record<string, unknown> : {};
      const update: Record<string, unknown> = { updated_by: authData.user.id, last_change_reason: "Approved AI-assisted invoice review" };
      if (typeof values.supplier_id === "string" && /^[0-9a-f-]{36}$/i.test(values.supplier_id)) update.supplier_id = values.supplier_id;
      if (typeof values.expense_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(values.expense_date)) update.expense_date = values.expense_date;
      if (typeof values.invoice_number === "string" || values.invoice_number === null) update.invoice_number = values.invoice_number;
      if (typeof values.description === "string" && values.description.trim()) update.description = values.description.trim().slice(0, 500);
      if (Number.isFinite(Number(values.total_amount)) && Number(values.total_amount) >= 0) update.total_amount = Number(values.total_amount);
      if (Number.isFinite(Number(values.gst_amount)) && Number(values.gst_amount) >= 0 && Number(values.gst_amount) <= Number(values.total_amount)) { update.gst_amount = Number(values.gst_amount); update.gst_entry_method = "MANUAL"; }
      if (typeof values.category_id === "string" && /^[0-9a-f-]{36}$/i.test(values.category_id)) update.category_id = values.category_id;
      if (Number.isFinite(Number(values.business_use_percentage)) && Number(values.business_use_percentage) >= 0 && Number(values.business_use_percentage) <= 100) update.business_use_percentage = Number(values.business_use_percentage);
      const { error: updateError } = await userClient.from("expenses").update(update).eq("id", job.expense_id);
      if (updateError) throw updateError;
      const approvedAt = new Date().toISOString();
      const { data: suggestions } = await admin.from("expense_ai_field_suggestions").select("id, field_name, suggested_value").eq("processing_job_id", job.id);
      for (const suggestion of suggestions || []) {
        const approvedValue = Object.prototype.hasOwnProperty.call(values, suggestion.field_name) ? values[suggestion.field_name] : suggestion.suggested_value;
        await admin.from("expense_ai_field_suggestions").update({ approved_value: approvedValue, was_changed: JSON.stringify(approvedValue) !== JSON.stringify(suggestion.suggested_value), approved_by: authData.user.id, approved_at: approvedAt }).eq("id", suggestion.id);
      }
      await admin.from("expense_ai_processing_jobs").update({ status: "APPROVED", approved_by: authData.user.id, approved_at: approvedAt }).eq("id", job.id);
      await admin.from("expense_statement_lines").update({ evidence_status: "VERIFIED", updated_at: approvedAt }).eq("expense_id", job.expense_id);
      return respond(req, { approved: true, expenseId: job.expense_id });
    }

    const attachmentId = body.attachmentId;
    if (!/^[0-9a-f-]{36}$/i.test(String(attachmentId || ""))) return respond(req, { error: "Choose a valid document." }, 400);
    const { data: attachment, error: attachmentError } = await userClient.from("expense_attachments").select("id, expense_id, storage_path, original_filename, mime_type").eq("id", attachmentId).single();
    if (attachmentError || !attachment) return respond(req, { error: "Document not found or access denied." }, 404);
    const { data: expense, error: expenseError } = await userClient.from("expenses").select("id, expense_date, total_amount, supplier_id, category_id, business_use_percentage").eq("id", attachment.expense_id).single();
    if (expenseError || !expense) return respond(req, { error: "Expense not found or access denied." }, 404);
    const { data: oldJobs, error: jobsError } = await userClient.from("expense_ai_processing_jobs").select("id, status").eq("attachment_id", attachment.id);
    if (jobsError) throw jobsError;
    if (oldJobs?.some((job) => job.status === "PROCESSING")) return respond(req, { error: "This document is already being scanned." }, 409);
    if ((oldJobs?.length || 0) >= 5) return respond(req, { error: "This document has reached the five-scan limit. Continue with manual entry." }, 429);
    await admin.from("expense_ai_extraction_results").update({ raw_result: null }).lt("retained_until", new Date().toISOString()).not("raw_result", "is", null);
    const { data: statementLine } = await userClient.from("expense_statement_lines").select("id").eq("expense_id", expense.id).maybeSingle();
    const { data: job, error: jobError } = await admin.from("expense_ai_processing_jobs").insert({ attachment_id: attachment.id, expense_id: expense.id, statement_line_id: statementLine?.id || null, status: "PROCESSING", provider: "OPENAI", model: "gpt-5.6-luna", attempt_count: (oldJobs?.length || 0) + 1, started_at: new Date().toISOString(), created_by: authData.user.id }).select("id").single();
    if (jobError) throw jobError;
    jobId = job.id;
    const { data: file, error: downloadError } = await userClient.storage.from("expense-documents").download(attachment.storage_path);
    if (downloadError || !file) throw downloadError || new Error("Document download failed.");
    const extraction = await extractWithFallback(new Uint8Array(await file.arrayBuffer()), attachment.mime_type, attachment.original_filename, "INVOICE");
    const validated = extraction.validated as Record<string, unknown>;
    const { data: result, error: extractionError } = await admin.from("expense_ai_extraction_results").insert({ processing_job_id: job.id, raw_result: extraction.raw, validated_result: validated, overall_confidence: Number(validated.overall_confidence) }).select("id").single();
    if (extractionError) throw extractionError;

    const documentSuggestions = Object.entries(validated).filter(([name]) => !["overall_confidence", "line_items"].includes(name)).map(([field_name, suggested]) => ({ processing_job_id: job.id, field_name, suggested_value: fieldValue(suggested), confidence_score: fieldConfidence(suggested), suggestion_source: "DOCUMENT" }));
    const supplierName = fieldValue(validated.supplier_name);
    const supplierAbn = normalise(fieldValue(validated.supplier_abn));
    const [{ data: suppliers }, { data: aliases }] = await Promise.all([
      userClient.from("expense_suppliers").select("id, display_name, legal_name, abn, default_category_id, default_business_use_percentage"),
      userClient.from("expense_supplier_aliases").select("supplier_id, alias_name"),
    ]);
    const supplierNeedle = normalise(supplierName);
    const aliasMatch = aliases?.find((alias) => normalise(alias.alias_name) === supplierNeedle);
    const matched = suppliers?.find((supplier) => supplier.id === aliasMatch?.supplier_id || normalise(supplier.display_name) === supplierNeedle || normalise(supplier.legal_name) === supplierNeedle || (supplierAbn && normalise(supplier.abn) === supplierAbn));
    const extraSuggestions: Array<Record<string, unknown>> = [];
    if (matched) {
      extraSuggestions.push({ processing_job_id: job.id, field_name: "supplier_id", suggested_value: matched.id, confidence_score: aliasMatch || normalise(matched.display_name) === supplierNeedle ? 1 : 0.95, suggestion_source: aliasMatch ? "HISTORY" : "DOCUMENT" });
      let categoryId = matched.default_category_id;
      let businessUse = matched.default_business_use_percentage;
      let source = "SUPPLIER_DEFAULT";
      if (!categoryId || businessUse === null) {
        const { data: history } = await userClient.from("expenses").select("category_id, business_use_percentage").eq("supplier_id", matched.id).eq("expense_status", "READY").order("expense_date", { ascending: false }).limit(1).maybeSingle();
        categoryId ||= history?.category_id || null;
        businessUse ??= history?.business_use_percentage ?? null;
        if (history) source = "HISTORY";
      }
      if (categoryId) extraSuggestions.push({ processing_job_id: job.id, field_name: "category_id", suggested_value: categoryId, confidence_score: 1, suggestion_source: source });
      if (businessUse !== null) extraSuggestions.push({ processing_job_id: job.id, field_name: "business_use_percentage", suggested_value: Number(businessUse), confidence_score: 1, suggestion_source: source });
    }
    const { error: suggestionError } = await admin.from("expense_ai_field_suggestions").insert([...documentSuggestions, ...extraSuggestions]);
    if (suggestionError) throw suggestionError;
    const total = fieldValue(validated.total_amount);
    const date = fieldValue(validated.invoice_date);
    const amountMatches = total !== null && Math.abs(Number(total) - Math.abs(Number(expense.total_amount))) < 0.01;
    const dateMatches = !date || date === expense.expense_date;
    const evidenceStatus = amountMatches && dateMatches ? "VERIFIED" : "MISMATCH";
    await admin.from("expense_statement_lines").update({ evidence_status: evidenceStatus, updated_at: new Date().toISOString() }).eq("expense_id", expense.id);
    await admin.from("expense_ai_processing_jobs").update({ status: "READY_FOR_REVIEW", provider: extraction.provider, model: extraction.model, completed_at: new Date().toISOString(), input_tokens: extraction.inputTokens, output_tokens: extraction.outputTokens, estimated_cost_usd: extraction.estimatedCostUsd }).eq("id", job.id);
    return respond(req, { jobId: job.id, extractionId: result.id, evidenceStatus, provider: extraction.provider, model: extraction.model, estimatedCostUsd: extraction.estimatedCostUsd, result: validated, suggestions: extraSuggestions });
  } catch (error) {
    if (jobId) await admin.from("expense_ai_processing_jobs").update({ status: "PROCESSING_FAILED", completed_at: new Date().toISOString(), error_message: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error" }).eq("id", jobId);
    console.error("expense-document-extract", error instanceof Error ? error.message : error);
    return respond(req, { error: error instanceof Error ? error.message : "Document scanning failed." }, 500);
  }
});

export type ProviderName = "OPENAI" | "ANTHROPIC";
export type ExtractionKind = "INVOICE" | "STATEMENT";

export interface ProviderExtraction<T = Record<string, unknown>> {
  provider: ProviderName;
  model: string;
  validated: T;
  raw: unknown;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

type FieldSchema = { type: "object"; additionalProperties: false; required: ["value", "confidence"]; properties: Record<string, unknown> };
const field = (valueType: string | string[]): FieldSchema => ({
  type: "object",
  additionalProperties: false,
  required: ["value", "confidence"],
  properties: {
    value: { type: valueType },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
});

const invoiceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["supplier_name", "supplier_abn", "invoice_number", "invoice_date", "due_date", "description", "subtotal", "gst_amount", "total_amount", "currency", "document_type", "line_items", "overall_confidence"],
  properties: {
    supplier_name: field(["string", "null"]), supplier_abn: field(["string", "null"]), invoice_number: field(["string", "null"]),
    invoice_date: field(["string", "null"]), due_date: field(["string", "null"]), description: field(["string", "null"]),
    subtotal: field(["number", "null"]), gst_amount: field(["number", "null"]), total_amount: field(["number", "null"]),
    currency: field(["string", "null"]), document_type: field(["string", "null"]),
    line_items: {
      type: "array", maxItems: 200, items: { type: "object", additionalProperties: false,
        required: ["description", "quantity", "unit_price", "gst_amount", "total_amount", "confidence"],
        properties: { description: { type: ["string", "null"] }, quantity: { type: ["number", "null"] }, unit_price: { type: ["number", "null"] }, gst_amount: { type: ["number", "null"] }, total_amount: { type: ["number", "null"] }, confidence: { type: "number", minimum: 0, maximum: 1 } },
      },
    },
    overall_confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

const statementSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bank_name", "account_hint", "statement_start_date", "statement_end_date", "currency", "transactions", "overall_confidence"],
  properties: {
    bank_name: field(["string", "null"]), account_hint: field(["string", "null"]), statement_start_date: field(["string", "null"]), statement_end_date: field(["string", "null"]), currency: field(["string", "null"]),
    transactions: {
      type: "array", maxItems: 1000, items: { type: "object", additionalProperties: false,
        required: ["transaction_date", "description", "reference", "amount", "balance", "confidence"],
        properties: { transaction_date: { type: "string" }, description: { type: "string" }, reference: { type: ["string", "null"] }, amount: { type: "number" }, balance: { type: ["number", "null"] }, confidence: { type: "number", minimum: 0, maximum: 1 } },
      },
    },
    overall_confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

const schemaFor = (kind: ExtractionKind) => kind === "INVOICE" ? invoiceSchema : statementSchema;
const promptFor = (kind: ExtractionKind) => kind === "INVOICE"
  ? "Extract only values visible in this invoice or receipt. Use null when absent. Dates must be YYYY-MM-DD. Include visible line items. Do not infer or invent financial values. Return only the requested JSON."
  : "Extract every transaction row visible in this bank statement. Dates must be YYYY-MM-DD. Preserve debit amounts as negative and credits as positive where the document indicates direction. Use null when optional values are absent. Do not invent transactions. Return only the requested JSON.";

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
};

const estimate = (provider: ProviderName, inputTokens: number, outputTokens: number) => {
  // Rates checked 04/08/2026: GPT-5.6 Luna USD 0.20/1.20 and Claude Haiku 4.5 USD 1/5 per million tokens.
  const rates = provider === "OPENAI" ? { input: 0.20, output: 1.20 } : { input: 1, output: 5 };
  return Number(((inputTokens * rates.input + outputTokens * rates.output) / 1_000_000).toFixed(6));
};

function parseJson(text: string) {
  const trimmed = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The provider returned no JSON object.");
  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

function validate(kind: ExtractionKind, value: Record<string, unknown>) {
  const confidence = Number(value.overall_confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error("The provider returned an invalid confidence score.");
  if (kind === "STATEMENT") {
    if (!Array.isArray(value.transactions) || value.transactions.length === 0 || value.transactions.length > 1000) throw new Error("No valid statement transactions were returned.");
    value.transactions.forEach((item, index) => {
      if (!item || typeof item !== "object") throw new Error(`Statement row ${index + 1} is invalid.`);
      const row = item as Record<string, unknown>;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.transaction_date || "")) || !String(row.description || "").trim() || !Number.isFinite(Number(row.amount))) throw new Error(`Statement row ${index + 1} is incomplete.`);
    });
  }
  return value;
}

async function openAi(bytes: Uint8Array, mimeType: string, filename: string, kind: ExtractionKind): Promise<ProviderExtraction> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_NOT_CONFIGURED");
  const model = "gpt-5.6-luna";
  const dataUrl = `data:${mimeType};base64,${toBase64(bytes)}`;
  const input = mimeType.startsWith("image/")
    ? { type: "input_image", image_url: dataUrl, detail: "low" }
    : { type: "input_file", filename, file_data: dataUrl };
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({
    model, store: false, reasoning: { effort: "low" }, max_output_tokens: kind === "STATEMENT" ? 24000 : 6000,
    input: [{ role: "user", content: [input, { type: "input_text", text: promptFor(kind) }] }],
    text: { format: { type: "json_schema", name: kind === "INVOICE" ? "expense_document" : "bank_statement", strict: true, schema: schemaFor(kind) } },
  }) });
  const raw = await response.json();
  if (!response.ok) throw new Error(raw?.error?.message || `OpenAI returned ${response.status}.`);
  const outputText = raw.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || []).find((item: { type?: string }) => item.type === "output_text")?.text;
  if (!outputText) throw new Error("OpenAI returned no structured result.");
  const validated = validate(kind, parseJson(outputText));
  const inputTokens = Number(raw.usage?.input_tokens || 0);
  const outputTokens = Number(raw.usage?.output_tokens || 0);
  return { provider: "OPENAI", model, validated, raw, inputTokens, outputTokens, estimatedCostUsd: estimate("OPENAI", inputTokens, outputTokens) };
}

async function anthropic(bytes: Uint8Array, mimeType: string, _filename: string, kind: ExtractionKind): Promise<ProviderExtraction> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_NOT_CONFIGURED");
  const model = "claude-haiku-4-5";
  const media = mimeType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(bytes) } }
    : { type: "image", source: { type: "base64", media_type: mimeType, data: toBase64(bytes) } };
  const schemaText = JSON.stringify(schemaFor(kind));
  const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }, body: JSON.stringify({
    model, max_tokens: kind === "STATEMENT" ? 24000 : 6000, temperature: 0,
    system: `Return only JSON matching this schema exactly: ${schemaText}`,
    messages: [{ role: "user", content: [media, { type: "text", text: promptFor(kind) }] }],
  }) });
  const raw = await response.json();
  if (!response.ok) throw new Error(raw?.error?.message || `Anthropic returned ${response.status}.`);
  const outputText = raw.content?.filter((item: { type?: string }) => item.type === "text").map((item: { text?: string }) => item.text || "").join("\n");
  if (!outputText) throw new Error("Anthropic returned no structured result.");
  const validated = validate(kind, parseJson(outputText));
  const inputTokens = Number(raw.usage?.input_tokens || 0);
  const outputTokens = Number(raw.usage?.output_tokens || 0);
  return { provider: "ANTHROPIC", model, validated, raw, inputTokens, outputTokens, estimatedCostUsd: estimate("ANTHROPIC", inputTokens, outputTokens) };
}

export async function extractWithFallback(bytes: Uint8Array, mimeType: string, filename: string, kind: ExtractionKind) {
  try {
    return await openAi(bytes, mimeType, filename, kind);
  } catch (openAiError) {
    console.warn("OpenAI extraction failed; trying Anthropic fallback", openAiError instanceof Error ? openAiError.message : openAiError);
    try {
      return await anthropic(bytes, mimeType, filename, kind);
    } catch (anthropicError) {
      const first = openAiError instanceof Error ? openAiError.message : "OpenAI failed";
      const second = anthropicError instanceof Error ? anthropicError.message : "Anthropic failed";
      throw new Error(`Document processing failed with both providers. OpenAI: ${first}. Anthropic: ${second}.`);
    }
  }
}

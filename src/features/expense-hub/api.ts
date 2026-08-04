import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type {
  AttachmentDocumentType,
  ExpenseAttachment,
  ExpenseFormValues,
} from "./types";
import { calculateGstFromInclusiveTotal, safeFilename, sha256File } from "./utils";
import type { ParsedStatementLine } from "./statementParser";

const nullable = (value: string) => value || null;

export async function saveExpense(userId: string, values: ExpenseFormValues) {
  const ownership = values.ownershipType;
  const total = Number(values.totalAmount);
  const gst = values.gstEntryMethod === "NONE"
    ? 0
    : values.gstEntryMethod === "CALCULATED"
      ? calculateGstFromInclusiveTotal(total)
      : Number(values.gstAmount || 0);
  const signedTotal = values.documentType === "CREDIT_NOTE" ? -Math.abs(total) : Math.abs(total);
  const signedGst = values.documentType === "CREDIT_NOTE" ? -Math.abs(gst) : Math.abs(gst);
  const common = {
    ownership_type: ownership,
    association_id: ownership === "PERSONAL" ? null : nullable(values.associationId),
    club_id: ownership === "CLUB" ? nullable(values.clubId) : null,
    supplier_id: values.supplierId,
    expense_date: values.expenseDate,
    invoice_number: nullable(values.invoiceNumber.trim()),
    description: values.description.trim(),
    category_id: nullable(values.categoryId),
    subcategory_id: nullable(values.subcategoryId),
    total_amount: signedTotal,
    gst_amount: signedGst,
    gst_entry_method: values.gstEntryMethod,
    business_use_percentage: Number(values.businessUsePercentage),
    business_use_reason: nullable(values.businessUseReason.trim()),
    payment_method_id: nullable(values.paymentMethodId),
    payment_status: values.paymentStatus,
    expense_status: values.expenseStatus,
    document_type: values.documentType,
    notes: nullable(values.notes.trim()),
    last_change_reason: nullable(values.lastChangeReason.trim()),
    updated_by: userId,
  } satisfies TablesUpdate<"expenses">;

  if (values.id) {
    const { data, error } = await supabase
      .from("expenses")
      .update(common)
      .eq("id", values.id)
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  const insert = {
    ...common,
    owner_user_id: userId,
    created_by: userId,
  } satisfies TablesInsert<"expenses">;
  const { data, error } = await supabase
    .from("expenses")
    .insert(insert)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function archiveExpense(expenseId: string, userId: string, archived: boolean) {
  const { error } = await supabase.from("expenses").update({
    archived_at: archived ? new Date().toISOString() : null,
    archived_by: archived ? userId : null,
    updated_by: userId,
    last_change_reason: archived ? "Expense archived" : "Expense restored",
  }).eq("id", expenseId);
  if (error) throw error;
}

export async function saveSupplier(userId: string, input: {
  id?: string;
  ownershipType: "PERSONAL" | "ASSOCIATION" | "CLUB";
  associationId?: string;
  clubId?: string;
  displayName: string;
  legalName?: string;
  abn?: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
  defaultCategoryId?: string;
  defaultBusinessUsePercentage?: number | null;
  isActive?: boolean;
}) {
  if (input.ownershipType !== "PERSONAL" && !input.associationId) throw new Error("Choose an association for this supplier.");
  if (input.ownershipType === "CLUB" && !input.clubId) throw new Error("Choose a club for this supplier.");
  const associationId = input.ownershipType === "PERSONAL" ? null : input.associationId || null;
  const clubId = input.ownershipType === "CLUB" ? input.clubId || null : null;
  const payload = {
    association_id: associationId,
    club_id: clubId,
    display_name: input.displayName.trim(),
    legal_name: nullable(input.legalName?.trim() || ""),
    abn: nullable(input.abn?.trim() || ""),
    email: nullable(input.email?.trim() || ""),
    phone: nullable(input.phone?.trim() || ""),
    website: nullable(input.website?.trim() || ""),
    notes: nullable(input.notes?.trim() || ""),
    default_category_id: input.defaultCategoryId || null,
    default_business_use_percentage: input.defaultBusinessUsePercentage ?? null,
    is_active: input.isActive ?? true,
    updated_by: userId,
  } satisfies TablesUpdate<"expense_suppliers">;

  if (input.id) {
    const { data, error } = await supabase.from("expense_suppliers")
      .update(payload).eq("id", input.id).select("id").single();
    if (error) throw error;
    return data.id;
  }

  const { data, error } = await supabase.from("expense_suppliers").insert({
    ...payload,
    owner_user_id: userId,
    created_by: userId,
  } as TablesInsert<"expense_suppliers">).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function addSupplierAlias(supplierId: string, aliasName: string, userId: string) {
  const { error } = await supabase.from("expense_supplier_aliases").insert({
    supplier_id: supplierId,
    alias_name: aliasName.trim(),
    created_by: userId,
  });
  if (error) throw error;
}

export async function removeSupplierAlias(aliasId: string) {
  const { error } = await supabase.from("expense_supplier_aliases").delete().eq("id", aliasId);
  if (error) throw error;
}

export async function savePaymentMethod(userId: string, input: {
  id?: string;
  ownershipType: "PERSONAL" | "ASSOCIATION" | "CLUB";
  associationId?: string;
  clubId?: string;
  name: string;
  accountHint?: string;
  isBusinessAccount: boolean;
  isActive?: boolean;
}) {
  if (input.ownershipType !== "PERSONAL" && !input.associationId) throw new Error("Choose an association for this payment method.");
  if (input.ownershipType === "CLUB" && !input.clubId) throw new Error("Choose a club for this payment method.");
  const payload = {
    association_id: input.ownershipType === "PERSONAL" ? null : input.associationId || null,
    club_id: input.ownershipType === "CLUB" ? input.clubId || null : null,
    name: input.name.trim(),
    account_hint: nullable(input.accountHint?.trim() || ""),
    is_business_account: input.isBusinessAccount,
    is_active: input.isActive ?? true,
    updated_by: userId,
  } satisfies TablesUpdate<"expense_payment_methods">;

  if (input.id) {
    const { data, error } = await supabase.from("expense_payment_methods")
      .update(payload).eq("id", input.id).select("id").single();
    if (error) throw error;
    return data.id;
  }

  const { data, error } = await supabase.from("expense_payment_methods").insert({
    ...payload,
    owner_user_id: userId,
    created_by: userId,
  } as TablesInsert<"expense_payment_methods">).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function saveCategory(input: {
  id?: string;
  ownerUserId?: string;
  associationId?: string;
  clubId?: string;
  name: string;
  description?: string;
  parentCategoryId?: string;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const payload = {
    association_id: input.associationId || null,
    club_id: input.clubId || null,
    name: input.name.trim(),
    description: nullable(input.description?.trim() || ""),
    parent_category_id: input.parentCategoryId || null,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
  } satisfies TablesUpdate<"expense_categories">;

  if (input.id) {
    const { error } = await supabase.from("expense_categories").update(payload).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }

  const { data, error } = await supabase.from("expense_categories")
    .insert({ ...payload, owner_user_id: input.ownerUserId || null } as TablesInsert<"expense_categories">).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function uploadExpenseAttachment(
  expenseId: string,
  userId: string,
  file: File,
  documentType: AttachmentDocumentType,
) {
  if (file.size > 20 * 1024 * 1024) throw new Error("The file is larger than the 20 MB limit.");
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
    throw new Error("Choose a PDF, JPG or PNG file.");
  }

  const attachmentId = crypto.randomUUID();
  const storagePath = `${expenseId}/${attachmentId}/${safeFilename(file.name)}`;
  const fileHash = await sha256File(file);
  const { data: existing } = await supabase.from("expense_attachments")
    .select("id, original_filename")
    .eq("file_hash", fileHash)
    .limit(1);
  if (existing?.length) {
    throw new Error(`This file appears to have already been uploaded as ${existing[0].original_filename}.`);
  }

  const { error: uploadError } = await supabase.storage.from("expense-documents").upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { error: metadataError } = await supabase.from("expense_attachments").insert({
    id: attachmentId,
    expense_id: expenseId,
    owner_user_id: userId,
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: file.type,
    file_size: file.size,
    document_type: documentType,
    file_hash: fileHash,
    uploaded_by: userId,
  });
  if (metadataError) {
    await supabase.storage.from("expense-documents").remove([storagePath]);
    throw metadataError;
  }
  await supabase.from("expense_statement_lines").update({ evidence_status: "ATTACHED", updated_at: new Date().toISOString() }).eq("expense_id", expenseId);
}

export async function openExpenseAttachment(attachment: ExpenseAttachment) {
  const { data, error } = await supabase.storage.from("expense-documents")
    .createSignedUrl(attachment.storage_path, 60);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export async function deleteExpenseAttachment(attachment: ExpenseAttachment) {
  const { error: storageError } = await supabase.storage.from("expense-documents")
    .remove([attachment.storage_path]);
  if (storageError) throw storageError;
  const { error: metadataError } = await supabase.from("expense_attachments")
    .delete().eq("id", attachment.id);
  if (metadataError) throw new Error(`The private file was removed, but its record cleanup failed: ${metadataError.message}`);
  const { count } = await supabase.from("expense_attachments").select("id", { count: "exact", head: true }).eq("expense_id", attachment.expense_id);
  if (!count) await supabase.from("expense_statement_lines").update({ evidence_status: "MISSING", updated_at: new Date().toISOString() }).eq("expense_id", attachment.expense_id);
}

export async function scanExpenseAttachment(attachmentId: string) {
  const { data, error } = await supabase.functions.invoke("expense-document-extract", { body: { attachmentId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function importBankStatement(userId: string, file: File, lines: ParsedStatementLine[]) {
  if (file.size > 20 * 1024 * 1024) throw new Error("The statement is larger than the 20 MB limit.");
  const fileHash = await sha256File(file);
  const importId = crypto.randomUUID();
  const storagePath = `${importId}/${safeFilename(file.name)}`;
  const { error: recordError } = await supabase.from("expense_statement_imports").insert({
    id: importId,
    owner_user_id: userId,
    ownership_type: "PERSONAL",
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: file.type || "application/octet-stream",
    file_size: file.size,
    file_hash: fileHash,
    status: "UPLOADED",
    row_count: lines.length,
    created_by: userId,
    updated_by: userId,
  });
  if (recordError) throw recordError;

  const contentType = file.type || (file.name.toLowerCase().endsWith(".ofx") ? "application/x-ofx" : "text/csv");
  const { error: uploadError } = await supabase.storage.from("expense-imports").upload(storagePath, file, { upsert: false, contentType });
  if (uploadError) throw uploadError;

  const { error: linesError } = await supabase.from("expense_statement_lines").insert(lines.map((line) => ({
    import_id: importId,
    owner_user_id: userId,
    line_number: line.lineNumber,
    transaction_date: line.transactionDate,
    description: line.description,
    reference: line.reference || null,
    amount: line.amount,
    balance: line.balance,
    raw_data: line.rawData,
  })));
  if (linesError) throw linesError;
  const { error: statusError } = await supabase.from("expense_statement_imports").update({
    status: "NEEDS_REVIEW",
    updated_at: new Date().toISOString(),
    updated_by: userId,
  }).eq("id", importId);
  if (statusError) throw statusError;
  return importId;
}

export async function reviewStatementLine(lineId: string, userId: string, input: {
  decision: "BUSINESS" | "PERSONAL" | "NOT_RELEVANT";
  businessUsePercentage: number;
  supplierId?: string;
  categoryId?: string;
  paymentMethodId?: string;
  notes?: string;
}) {
  const { error } = await supabase.from("expense_statement_lines").update({
    decision: input.decision,
    business_use_percentage: input.decision === "PERSONAL" || input.decision === "NOT_RELEVANT" ? 0 : input.businessUsePercentage,
    supplier_id: input.supplierId || null,
    category_id: input.categoryId || null,
    payment_method_id: input.paymentMethodId || null,
    review_notes: input.notes || null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: userId,
    updated_at: new Date().toISOString(),
  }).eq("id", lineId);
  if (error) throw error;
}

export async function createDraftExpenseFromStatementLine(userId: string, lineId: string) {
  const { data: line, error: lineError } = await supabase.from("expense_statement_lines")
    .select("*, expense_statement_imports!inner(ownership_type, association_id, club_id)")
    .eq("id", lineId).single();
  if (lineError) throw lineError;
  if (!line.supplier_id) throw new Error("Choose a supplier before creating the draft expense.");
  const scope = line.expense_statement_imports;
  const { data: expense, error: expenseError } = await supabase.from("expenses").insert({
    owner_user_id: userId,
    ownership_type: scope.ownership_type,
    association_id: scope.association_id,
    club_id: scope.club_id,
    supplier_id: line.supplier_id,
    expense_date: line.transaction_date,
    invoice_number: line.reference,
    description: line.description,
    category_id: line.category_id,
    total_amount: Math.abs(Number(line.amount)),
    gst_amount: 0,
    gst_entry_method: "NONE",
    business_use_percentage: Number(line.business_use_percentage),
    payment_method_id: line.payment_method_id,
    payment_status: "PAID",
    expense_status: "NEEDS_REVIEW",
    document_type: "EXPENSE",
    notes: line.review_notes,
    last_change_reason: "Created from bank statement import",
    created_by: userId,
    updated_by: userId,
  }).select("id").single();
  if (expenseError) throw expenseError;
  const { error: linkError } = await supabase.from("expense_statement_lines").update({
    expense_id: expense.id,
    evidence_status: "MISSING",
    updated_at: new Date().toISOString(),
  }).eq("id", lineId);
  if (linkError) throw linkError;
  return expense.id;
}

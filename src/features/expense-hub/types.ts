import type { Tables } from "@/integrations/supabase/types";

export type Expense = Tables<"expenses">;
export type ExpenseSupplier = Tables<"expense_suppliers">;
export type ExpenseSupplierAlias = Tables<"expense_supplier_aliases">;
export type ExpenseCategory = Tables<"expense_categories">;
export type ExpensePaymentMethod = Tables<"expense_payment_methods">;
export type ExpenseAttachment = Tables<"expense_attachments">;
export type ExpenseAuditEvent = Tables<"expense_audit_events">;
export type ExpenseExportBatch = Tables<"expense_export_batches">;
export type ExpenseExportItem = Tables<"expense_export_items">;
export type AssociationOption = Pick<Tables<"associations">, "id" | "name">;
export type ClubOption = Pick<Tables<"clubs">, "id" | "name" | "association_id">;

export interface ExpenseSupplierWithAliases extends ExpenseSupplier {
  aliases: ExpenseSupplierAlias[];
}

export type OwnershipType = "PERSONAL" | "ASSOCIATION" | "CLUB";
export type ExpenseStatus = "DRAFT" | "READY" | "NEEDS_REVIEW";
export type PaymentStatus =
  | "UNPAID"
  | "PAID"
  | "REIMBURSEMENT_EXPECTED"
  | "REIMBURSED"
  | "NOT_APPLICABLE";
export type ExpenseDocumentType = "EXPENSE" | "CREDIT_NOTE";
export type AttachmentDocumentType =
  | "INVOICE"
  | "RECEIPT"
  | "CREDIT_NOTE"
  | "STATEMENT"
  | "SUPPORTING_DOCUMENT"
  | "OTHER";

export interface ExpenseRecord extends Expense {
  supplier?: ExpenseSupplierWithAliases;
  category?: ExpenseCategory;
  subcategory?: ExpenseCategory;
  paymentMethod?: ExpensePaymentMethod;
  attachments: ExpenseAttachment[];
  auditEvents: ExpenseAuditEvent[];
  exportItems: ExpenseExportItem[];
}

export interface ExpenseFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  financialYear: string;
  supplierId: string;
  categoryId: string;
  subcategoryId: string;
  paymentMethodId: string;
  status: string;
  businessUseMin: string;
  businessUseMax: string;
  amountMin: string;
  amountMax: string;
  attachmentState: "ALL" | "WITH" | "WITHOUT";
  useType: "ALL" | "BUSINESS" | "PERSONAL" | "MIXED";
  exportState: "ALL" | "EXPORTED" | "NOT_EXPORTED";
  archiveState: "ACTIVE" | "ARCHIVED" | "ALL";
}

export interface ExpenseFormValues {
  id?: string;
  ownershipType: OwnershipType;
  associationId: string;
  clubId: string;
  supplierId: string;
  expenseDate: string;
  invoiceNumber: string;
  description: string;
  categoryId: string;
  subcategoryId: string;
  totalAmount: string;
  gstAmount: string;
  gstEntryMethod: "MANUAL" | "CALCULATED" | "NONE";
  businessUsePercentage: string;
  businessUseReason: string;
  paymentMethodId: string;
  paymentStatus: PaymentStatus;
  expenseStatus: ExpenseStatus;
  documentType: ExpenseDocumentType;
  notes: string;
  lastChangeReason: string;
}

export interface ExpenseTotals {
  totalAmount: number;
  businessAmount: number;
  personalAmount: number;
  gstAmount: number;
  businessGstAmount: number;
  expenseCount: number;
}

export const EMPTY_EXPENSE_FILTERS: ExpenseFilters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  financialYear: "ALL",
  supplierId: "ALL",
  categoryId: "ALL",
  subcategoryId: "ALL",
  paymentMethodId: "ALL",
  status: "ALL",
  businessUseMin: "",
  businessUseMax: "",
  amountMin: "",
  amountMax: "",
  attachmentState: "ALL",
  useType: "ALL",
  exportState: "ALL",
  archiveState: "ACTIVE",
};

export const createEmptyExpenseForm = (): ExpenseFormValues => ({
  ownershipType: "PERSONAL",
  associationId: "",
  clubId: "",
  supplierId: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  invoiceNumber: "",
  description: "",
  categoryId: "",
  subcategoryId: "",
  totalAmount: "",
  gstAmount: "0.00",
  gstEntryMethod: "MANUAL",
  businessUsePercentage: "100",
  businessUseReason: "",
  paymentMethodId: "",
  paymentStatus: "PAID",
  expenseStatus: "DRAFT",
  documentType: "EXPENSE",
  notes: "",
  lastChangeReason: "",
});

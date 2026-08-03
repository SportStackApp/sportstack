import type {
  ExpenseFilters,
  ExpenseRecord,
  ExpenseTotals,
} from "./types";

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateGstFromInclusiveTotal(totalAmount: number) {
  return roundMoney(totalAmount / 11);
}

export function calculateExpenseAmounts(
  totalAmount: number,
  gstAmount: number,
  businessUsePercentage: number,
) {
  const safePercentage = Math.min(100, Math.max(0, businessUsePercentage || 0));
  const businessAmount = roundMoney(totalAmount * safePercentage / 100);
  return {
    amountExcludingGst: roundMoney(totalAmount - gstAmount),
    businessAmount,
    personalAmount: roundMoney(totalAmount - businessAmount),
    businessGstAmount: roundMoney(gstAmount * safePercentage / 100),
  };
}

export function formatCurrency(value: number | null | undefined, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(Number(value || 0));
}

export function formatAustralianDate(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function financialYearForDate(value: string) {
  const [yearText, monthText] = value.slice(0, 10).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return "Unknown";
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}–${String(startYear + 1).slice(-2)}`;
}

export function normaliseSupplierName(value: string) {
  return value
    .toLocaleLowerCase("en-AU")
    .replace(/\b(pty|limited|ltd|australia|australian|au)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function bigrams(value: string) {
  const compact = normaliseSupplierName(value).replace(/\s/g, "");
  if (compact.length < 2) return new Set([compact]);
  return new Set(Array.from({ length: compact.length - 1 }, (_, index) => compact.slice(index, index + 2)));
}

export function supplierSimilarity(left: string, right: string) {
  const leftNormal = normaliseSupplierName(left);
  const rightNormal = normaliseSupplierName(right);
  if (!leftNormal || !rightNormal) return 0;
  if (leftNormal === rightNormal) return 1;
  const leftBigrams = bigrams(left);
  const rightBigrams = bigrams(right);
  const intersection = [...leftBigrams].filter((item) => rightBigrams.has(item)).length;
  return (2 * intersection) / (leftBigrams.size + rightBigrams.size);
}

export function calculateExpenseTotals(expenses: ExpenseRecord[]): ExpenseTotals {
  return expenses.reduce<ExpenseTotals>((totals, expense) => ({
    totalAmount: roundMoney(totals.totalAmount + Number(expense.total_amount)),
    businessAmount: roundMoney(totals.businessAmount + Number(expense.business_amount)),
    personalAmount: roundMoney(totals.personalAmount + Number(expense.personal_amount)),
    gstAmount: roundMoney(totals.gstAmount + Number(expense.gst_amount)),
    businessGstAmount: roundMoney(totals.businessGstAmount + Number(expense.business_gst_amount)),
    expenseCount: totals.expenseCount + 1,
  }), {
    totalAmount: 0,
    businessAmount: 0,
    personalAmount: 0,
    gstAmount: 0,
    businessGstAmount: 0,
    expenseCount: 0,
  });
}

const includesSearch = (expense: ExpenseRecord, search: string) => {
  const needle = search.trim().toLocaleLowerCase("en-AU");
  if (!needle) return true;
  const aliasNames = expense.supplier?.aliases.map((alias) => alias.alias_name) || [];
  return [
    expense.supplier?.display_name,
    expense.supplier?.legal_name,
    ...aliasNames,
    expense.description,
    expense.invoice_number,
    expense.notes,
  ].some((value) => value?.toLocaleLowerCase("en-AU").includes(needle));
};

export function filterExpenses(expenses: ExpenseRecord[], filters: ExpenseFilters) {
  const minimumUse = filters.businessUseMin === "" ? null : Number(filters.businessUseMin);
  const maximumUse = filters.businessUseMax === "" ? null : Number(filters.businessUseMax);
  const minimumAmount = filters.amountMin === "" ? null : Number(filters.amountMin);
  const maximumAmount = filters.amountMax === "" ? null : Number(filters.amountMax);

  return expenses.filter((expense) => {
    const businessUse = Number(expense.business_use_percentage);
    const absoluteAmount = Math.abs(Number(expense.total_amount));
    if (!includesSearch(expense, filters.search)) return false;
    if (filters.dateFrom && expense.expense_date < filters.dateFrom) return false;
    if (filters.dateTo && expense.expense_date > filters.dateTo) return false;
    if (filters.financialYear !== "ALL" && financialYearForDate(expense.expense_date) !== filters.financialYear) return false;
    if (filters.supplierId !== "ALL" && expense.supplier_id !== filters.supplierId) return false;
    if (filters.categoryId !== "ALL" && expense.category_id !== filters.categoryId) return false;
    if (filters.subcategoryId !== "ALL" && expense.subcategory_id !== filters.subcategoryId) return false;
    if (filters.paymentMethodId !== "ALL" && expense.payment_method_id !== filters.paymentMethodId) return false;
    if (filters.status !== "ALL" && expense.expense_status !== filters.status) return false;
    if (minimumUse !== null && businessUse < minimumUse) return false;
    if (maximumUse !== null && businessUse > maximumUse) return false;
    if (minimumAmount !== null && absoluteAmount < minimumAmount) return false;
    if (maximumAmount !== null && absoluteAmount > maximumAmount) return false;
    if (filters.attachmentState === "WITH" && expense.attachments.length === 0) return false;
    if (filters.attachmentState === "WITHOUT" && expense.attachments.length > 0) return false;
    if (filters.useType === "BUSINESS" && businessUse !== 100) return false;
    if (filters.useType === "PERSONAL" && businessUse !== 0) return false;
    if (filters.useType === "MIXED" && (businessUse <= 0 || businessUse >= 100)) return false;
    if (filters.exportState === "EXPORTED" && expense.exportItems.length === 0) return false;
    if (filters.exportState === "NOT_EXPORTED" && expense.exportItems.length > 0) return false;
    if (filters.archiveState === "ACTIVE" && expense.archived_at) return false;
    if (filters.archiveState === "ARCHIVED" && !expense.archived_at) return false;
    return true;
  });
}

export function safeFilename(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "document";
}

export async function sha256File(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

import type * as XLSXType from "xlsx";
import type { jsPDF as JsPdfDocument } from "jspdf";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import type { ExpenseFilters, ExpenseRecord } from "./types";
import {
  calculateExpenseTotals,
  financialYearForDate,
  formatAustralianDate,
  formatCurrency,
  safeFilename,
} from "./utils";

const filterSummary = (filters: ExpenseFilters) => Object.entries(filters)
  .filter(([, value]) => value !== "" && value !== "ALL" && value !== "ACTIVE")
  .map(([key, value]) => `${key}: ${value}`);

const detailRows = (expenses: ExpenseRecord[]) => expenses.map((expense) => ({
  Date: formatAustralianDate(expense.expense_date),
  "Financial year": financialYearForDate(expense.expense_date),
  Supplier: expense.supplier?.display_name || "Unknown supplier",
  "Invoice number": expense.invoice_number || "",
  Description: expense.description,
  Category: expense.category?.name || "",
  Subcategory: expense.subcategory?.name || "",
  "Total amount": Number(expense.total_amount),
  GST: Number(expense.gst_amount),
  "Business use": Number(expense.business_use_percentage) / 100,
  "Business amount": Number(expense.business_amount),
  "Personal amount": Number(expense.personal_amount),
  "Business GST": Number(expense.business_gst_amount),
  "Payment method": expense.paymentMethod?.name || "",
  "Payment status": expense.payment_status.replaceAll("_", " "),
  Status: expense.expense_status.replaceAll("_", " "),
  Notes: expense.notes || "",
  "Attachment references": expense.attachments.map((attachment) => attachment.original_filename).join("; "),
}));

const groupedSummary = (expenses: ExpenseRecord[], key: "supplier" | "category") => {
  const groups = new Map<string, ExpenseRecord[]>();
  expenses.forEach((expense) => {
    const label = key === "supplier"
      ? expense.supplier?.display_name || "Unknown supplier"
      : expense.category?.name || "Uncategorised";
    groups.set(label, [...(groups.get(label) || []), expense]);
  });
  return [...groups.entries()].map(([name, rows]) => ({
    [key === "supplier" ? "Supplier" : "Category"]: name,
    Expenses: rows.length,
    "Total amount": calculateExpenseTotals(rows).totalAmount,
    "Business amount": calculateExpenseTotals(rows).businessAmount,
    "Personal amount": calculateExpenseTotals(rows).personalAmount,
    GST: calculateExpenseTotals(rows).gstAmount,
  })).sort((left, right) => Number(right["Total amount"]) - Number(left["Total amount"]));
};

async function recordExport(
  userId: string,
  format: "XLSX" | "PDF",
  expenses: ExpenseRecord[],
  filters: ExpenseFilters,
) {
  const totals = calculateExpenseTotals(expenses);
  const { data: batch, error: batchError } = await supabase.from("expense_export_batches").insert({
    owner_user_id: userId,
    export_format: format,
    report_name: `Expense Hub ${format} report`,
    filters: filters as unknown as Json,
    total_amount: totals.totalAmount,
    total_business_amount: totals.businessAmount,
    total_personal_amount: totals.personalAmount,
    total_gst_amount: totals.gstAmount,
    expense_count: totals.expenseCount,
    created_by: userId,
  }).select("id").single();
  if (batchError) throw batchError;

  if (expenses.length > 0) {
    const { error: itemError } = await supabase.from("expense_export_items").insert(
      expenses.map((expense) => ({
        export_batch_id: batch.id,
        expense_id: expense.id,
        expense_snapshot: expense as unknown as Json,
      })),
    );
    if (itemError) throw itemError;
  }
}

async function formatNumberColumns(
  worksheet: XLSXType.WorkSheet,
  headers: string[],
  targetHeaders: string[],
  numberFormat: string,
) {
  const XLSX = await import("xlsx");
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  targetHeaders.forEach((header) => {
    const column = headers.indexOf(header);
    if (column < 0) return;
    for (let row = 1; row <= range.e.r; row += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell) cell.z = numberFormat;
    }
  });
}

export async function exportExpensesToExcel(
  userId: string,
  expenses: ExpenseRecord[],
  filters: ExpenseFilters,
) {
  const XLSX = await import("xlsx");
  const totals = calculateExpenseTotals(expenses);
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ["SportStack Expense Hub"],
    ["Generated", new Date().toLocaleString("en-AU")],
    ["Expense count", totals.expenseCount],
    ["Total amount", totals.totalAmount],
    ["Business amount", totals.businessAmount],
    ["Personal amount", totals.personalAmount],
    ["GST recorded", totals.gstAmount],
    ["Business-use GST", totals.businessGstAmount],
    [],
    ["Active filters"],
    ...filterSummary(filters).map((item) => [item]),
  ]);
  summary["!cols"] = [{ wch: 28 }, { wch: 24 }];
  ["B4", "B5", "B6", "B7", "B8"].forEach((address) => {
    if (summary[address]) summary[address].z = "$#,##0.00;[Red]-$#,##0.00";
  });
  XLSX.utils.book_append_sheet(workbook, summary, "Expense Summary");

  const details = detailRows(expenses);
  const detailSheet = XLSX.utils.json_to_sheet(details);
  detailSheet["!cols"] = Object.keys(details[0] || { Expense: "" }).map((key) => ({
    wch: ["Description", "Notes", "Attachment references"].includes(key) ? 38 : 18,
  }));
  const detailHeaders = Object.keys(details[0] || {});
  await formatNumberColumns(
    detailSheet,
    detailHeaders,
    ["Total amount", "GST", "Business amount", "Personal amount", "Business GST"],
    "$#,##0.00;[Red]-$#,##0.00",
  );
  await formatNumberColumns(detailSheet, detailHeaders, ["Business use"], "0%");
  XLSX.utils.book_append_sheet(workbook, detailSheet, "Expense Detail");

  const supplierSummaryRows = groupedSummary(expenses, "supplier");
  const supplierSummarySheet = XLSX.utils.json_to_sheet(supplierSummaryRows);
  await formatNumberColumns(supplierSummarySheet, Object.keys(supplierSummaryRows[0] || {}), ["Total amount", "Business amount", "Personal amount", "GST"], "$#,##0.00;[Red]-$#,##0.00");
  XLSX.utils.book_append_sheet(workbook, supplierSummarySheet, "Supplier Summary");
  const categorySummaryRows = groupedSummary(expenses, "category");
  const categorySummarySheet = XLSX.utils.json_to_sheet(categorySummaryRows);
  await formatNumberColumns(categorySummarySheet, Object.keys(categorySummaryRows[0] || {}), ["Total amount", "Business amount", "Personal amount", "GST"], "$#,##0.00;[Red]-$#,##0.00");
  XLSX.utils.book_append_sheet(workbook, categorySummarySheet, "Category Summary");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Export date and time", new Date().toLocaleString("en-AU")],
    ["Exported by", userId],
    ["Module version", "Stage 1"],
    ["Filters", filterSummary(filters).join("; ") || "None"],
  ]), "Export Information");

  const filename = `sportstack-expenses-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
  await recordExport(userId, "XLSX", expenses, filters);
}

export async function exportExpensesToPdf(
  userId: string,
  expenses: ExpenseRecord[],
  filters: ExpenseFilters,
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const totals = calculateExpenseTotals(expenses);
  const document = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  document.setFontSize(18);
  document.text("SportStack Expense Hub", 14, 16);
  document.setFontSize(9);
  document.text(`Generated ${new Date().toLocaleString("en-AU")}`, 14, 23);
  document.text(`Filters: ${filterSummary(filters).join("; ") || "None"}`, 14, 29, { maxWidth: 265 });

  autoTable(document, {
    startY: 36,
    head: [["Expenses", "Total", "Business", "Personal", "GST", "Business GST"]],
    body: [[
      String(totals.expenseCount),
      formatCurrency(totals.totalAmount),
      formatCurrency(totals.businessAmount),
      formatCurrency(totals.personalAmount),
      formatCurrency(totals.gstAmount),
      formatCurrency(totals.businessGstAmount),
    ]],
    styles: { fontSize: 9 },
    theme: "grid",
  });

  const previousTable = document as JsPdfDocument & { lastAutoTable?: { finalY: number } };
  const categorySummary = groupedSummary(expenses, "category") as Array<Record<string, string | number>>;
  autoTable(document, {
    startY: (previousTable.lastAutoTable?.finalY || 48) + 6,
    head: [["Category", "Expenses", "Total", "Business", "Personal", "GST"]],
    body: categorySummary.map((row) => [
      String(row.Category),
      String(row.Expenses),
      formatCurrency(Number(row["Total amount"])),
      formatCurrency(Number(row["Business amount"])),
      formatCurrency(Number(row["Personal amount"])),
      formatCurrency(Number(row.GST)),
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [26, 83, 92] },
  });

  const supplierSummary = groupedSummary(expenses, "supplier") as Array<Record<string, string | number>>;
  autoTable(document, {
    startY: (previousTable.lastAutoTable?.finalY || 48) + 6,
    head: [["Supplier", "Expenses", "Total", "Business", "Personal", "GST"]],
    body: supplierSummary.map((row) => [
      String(row.Supplier),
      String(row.Expenses),
      formatCurrency(Number(row["Total amount"])),
      formatCurrency(Number(row["Business amount"])),
      formatCurrency(Number(row["Personal amount"])),
      formatCurrency(Number(row.GST)),
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [26, 83, 92] },
  });

  autoTable(document, {
    startY: (previousTable.lastAutoTable?.finalY || 48) + 8,
    head: [["Date", "Supplier", "Description", "Category", "Total", "Business %", "Business", "GST", "Status"]],
    body: expenses.map((expense) => [
      formatAustralianDate(expense.expense_date),
      expense.supplier?.display_name || "Unknown",
      expense.description,
      expense.category?.name || "Uncategorised",
      formatCurrency(Number(expense.total_amount)),
      `${Number(expense.business_use_percentage).toFixed(0)}%`,
      formatCurrency(Number(expense.business_amount)),
      formatCurrency(Number(expense.gst_amount)),
      expense.expense_status.replaceAll("_", " "),
    ]),
    styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [26, 83, 92] },
    columnStyles: {
      0: { cellWidth: 19 },
      1: { cellWidth: 34 },
      2: { cellWidth: 55 },
      3: { cellWidth: 35 },
      4: { cellWidth: 24 },
      5: { cellWidth: 20 },
      6: { cellWidth: 24 },
      7: { cellWidth: 22 },
      8: { cellWidth: 25 },
    },
    didDrawPage: ({ pageNumber }) => {
      document.setFontSize(7);
      document.text(`SportStack Expense Hub • Page ${pageNumber}`, 14, 202);
    },
  });

  const filename = safeFilename(`sportstack-expenses-${new Date().toISOString().slice(0, 10)}.pdf`);
  document.save(filename);
  await recordExport(userId, "PDF", expenses, filters);
}

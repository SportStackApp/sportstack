import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  AssociationOption,
  ClubOption,
  Expense,
  ExpenseAttachment,
  ExpenseAuditEvent,
  ExpenseCategory,
  ExpenseExportBatch,
  ExpenseExportItem,
  ExpensePaymentMethod,
  ExpenseRecord,
  ExpenseSupplier,
  ExpenseSupplierAlias,
  ExpenseSupplierWithAliases,
} from "./types";

interface ExpenseHubContextValue {
  loading: boolean;
  error: string | null;
  expenses: ExpenseRecord[];
  suppliers: ExpenseSupplierWithAliases[];
  categories: ExpenseCategory[];
  paymentMethods: ExpensePaymentMethod[];
  exportBatches: ExpenseExportBatch[];
  associations: AssociationOption[];
  clubs: ClubOption[];
  refresh: () => Promise<void>;
}

const ExpenseHubContext = createContext<ExpenseHubContextValue | null>(null);

function groupBy<T>(items: T[], key: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  items.forEach((item) => {
    const itemKey = key(item);
    grouped.set(itemKey, [...(grouped.get(itemKey) || []), item]);
  });
  return grouped;
}

export function ExpenseHubProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [suppliers, setSuppliers] = useState<ExpenseSupplierWithAliases[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<ExpensePaymentMethod[]>([]);
  const [exportBatches, setExportBatches] = useState<ExpenseExportBatch[]>([]);
  const [associations, setAssociations] = useState<AssociationOption[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [
      expenseResult,
      supplierResult,
      aliasResult,
      categoryResult,
      paymentResult,
      attachmentResult,
      auditResult,
      exportBatchResult,
      exportItemResult,
      associationResult,
      clubResult,
    ] = await Promise.all([
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
      supabase.from("expense_suppliers").select("*").order("display_name"),
      supabase.from("expense_supplier_aliases").select("*").order("alias_name"),
      supabase.from("expense_categories").select("*").order("sort_order").order("name"),
      supabase.from("expense_payment_methods").select("*").order("name"),
      supabase.from("expense_attachments").select("*").order("uploaded_at", { ascending: false }),
      supabase.from("expense_audit_events").select("*").order("changed_at", { ascending: false }),
      supabase.from("expense_export_batches").select("*").order("created_at", { ascending: false }),
      supabase.from("expense_export_items").select("*"),
      supabase.from("associations").select("id, name").order("name"),
      supabase.from("clubs").select("id, name, association_id").order("name"),
    ]);

    const failed = [
      expenseResult,
      supplierResult,
      aliasResult,
      categoryResult,
      paymentResult,
      attachmentResult,
      auditResult,
      exportBatchResult,
      exportItemResult,
      associationResult,
      clubResult,
    ].find((result) => result.error);

    if (failed?.error) {
      setError(failed.error.message);
      setLoading(false);
      return;
    }

    const loadedAliases = (aliasResult.data || []) as ExpenseSupplierAlias[];
    const aliasesBySupplier = groupBy(loadedAliases, (alias) => alias.supplier_id);
    const loadedSuppliers = ((supplierResult.data || []) as ExpenseSupplier[]).map((supplier) => ({
      ...supplier,
      aliases: aliasesBySupplier.get(supplier.id) || [],
    }));
    const loadedAttachments = (attachmentResult.data || []) as ExpenseAttachment[];
    const loadedAudit = (auditResult.data || []) as ExpenseAuditEvent[];
    const loadedExportItems = (exportItemResult.data || []) as ExpenseExportItem[];
    const loadedCategories = (categoryResult.data || []) as ExpenseCategory[];
    const loadedPayments = (paymentResult.data || []) as ExpensePaymentMethod[];
    const suppliersById = new Map(loadedSuppliers.map((supplier) => [supplier.id, supplier]));
    const categoriesById = new Map(loadedCategories.map((category) => [category.id, category]));
    const paymentsById = new Map(loadedPayments.map((method) => [method.id, method]));
    const attachmentsByExpense = groupBy(loadedAttachments, (attachment) => attachment.expense_id);
    const auditByExpense = groupBy(loadedAudit, (event) => event.expense_id);
    const exportsByExpense = groupBy(loadedExportItems, (item) => item.expense_id);

    setSuppliers(loadedSuppliers);
    setCategories(loadedCategories);
    setPaymentMethods(loadedPayments);
    setExportBatches((exportBatchResult.data || []) as ExpenseExportBatch[]);
    setAssociations((associationResult.data || []) as AssociationOption[]);
    setClubs((clubResult.data || []) as ClubOption[]);
    setExpenses(((expenseResult.data || []) as Expense[]).map((expense) => ({
      ...expense,
      supplier: suppliersById.get(expense.supplier_id),
      category: expense.category_id ? categoriesById.get(expense.category_id) : undefined,
      subcategory: expense.subcategory_id ? categoriesById.get(expense.subcategory_id) : undefined,
      paymentMethod: expense.payment_method_id ? paymentsById.get(expense.payment_method_id) : undefined,
      attachments: attachmentsByExpense.get(expense.id) || [],
      auditEvents: auditByExpense.get(expense.id) || [],
      exportItems: exportsByExpense.get(expense.id) || [],
    })));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ExpenseHubContextValue>(() => ({
    loading,
    error,
    expenses,
    suppliers,
    categories,
    paymentMethods,
    exportBatches,
    associations,
    clubs,
    refresh,
  }), [
    loading,
    error,
    expenses,
    suppliers,
    categories,
    paymentMethods,
    exportBatches,
    associations,
    clubs,
    refresh,
  ]);

  return <ExpenseHubContext.Provider value={value}>{children}</ExpenseHubContext.Provider>;
}

// This hook intentionally shares the provider's context from the same module.
// eslint-disable-next-line react-refresh/only-export-components
export function useExpenseHub() {
  const context = useContext(ExpenseHubContext);
  if (!context) throw new Error("useExpenseHub must be used inside ExpenseHubProvider.");
  return context;
}

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, ExternalLink, FileText, History, Loader2, Paperclip, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  deleteExpenseAttachment,
  openExpenseAttachment,
  saveExpense,
  scanExpenseAttachment,
  uploadExpenseAttachment,
} from "@/features/expense-hub/api";
import { useExpenseHub } from "@/features/expense-hub/ExpenseHubContext";
import {
  createEmptyExpenseForm,
  type AttachmentDocumentType,
  type ExpenseFormValues,
  type ExpenseRecord,
} from "@/features/expense-hub/types";
import { calculateExpenseAmounts, calculateGstFromInclusiveTotal, formatAustralianDate, formatCurrency } from "@/features/expense-hub/utils";

const selectClass = "w-full min-w-0 overflow-hidden";
const AUDIT_HIDDEN_FIELDS = new Set(["updated_at", "updated_by", "last_change_reason"]);
type ScanResult = { supplier_name: string | null; invoice_number: string | null; invoice_date: string | null; total_amount: number | null; gst_amount: number | null; overall_confidence: number };

function auditChanges(previousData: unknown, newData: unknown) {
  if (!previousData || !newData || typeof previousData !== "object" || typeof newData !== "object" || Array.isArray(previousData) || Array.isArray(newData)) return [];
  const previous = previousData as Record<string, unknown>;
  const next = newData as Record<string, unknown>;
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])]
    .filter((field) => !AUDIT_HIDDEN_FIELDS.has(field) && JSON.stringify(previous[field]) !== JSON.stringify(next[field]))
    .map((field) => ({ field, previous: previous[field], next: next[field] }));
}

function auditValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function expenseToForm(expense: ExpenseRecord, duplicate = false): ExpenseFormValues {
  return {
    id: duplicate ? undefined : expense.id,
    ownershipType: expense.ownership_type as ExpenseFormValues["ownershipType"],
    associationId: expense.association_id || "",
    clubId: expense.club_id || "",
    supplierId: expense.supplier_id,
    expenseDate: expense.expense_date,
    invoiceNumber: duplicate ? "" : expense.invoice_number || "",
    description: expense.description,
    categoryId: expense.category_id || "",
    subcategoryId: expense.subcategory_id || "",
    totalAmount: String(Math.abs(Number(expense.total_amount))),
    gstAmount: String(Math.abs(Number(expense.gst_amount))),
    gstEntryMethod: expense.gst_entry_method as ExpenseFormValues["gstEntryMethod"],
    businessUsePercentage: String(expense.business_use_percentage),
    businessUseReason: expense.business_use_reason || "",
    paymentMethodId: expense.payment_method_id || "",
    paymentStatus: expense.payment_status as ExpenseFormValues["paymentStatus"],
    expenseStatus: duplicate ? "DRAFT" : expense.expense_status as ExpenseFormValues["expenseStatus"],
    documentType: expense.document_type as ExpenseFormValues["documentType"],
    notes: expense.notes || "",
    lastChangeReason: duplicate ? `Duplicated from ${expense.invoice_number || expense.id}` : "",
  };
}

export default function ExpenseEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { expenses, suppliers, categories, paymentMethods, associations, clubs, loading, refresh } = useExpenseHub();
  const [values, setValues] = useState<ExpenseFormValues>(() => createEmptyExpenseForm());
  const [files, setFiles] = useState<File[]>([]);
  const [attachmentType, setAttachmentType] = useState<AttachmentDocumentType>("INVOICE");
  const [saving, setSaving] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const existing = id ? expenses.find((expense) => expense.id === id) : undefined;
  useEffect(() => {
    const source = id ? expenses.find((expense) => expense.id === id) : duplicateId ? expenses.find((expense) => expense.id === duplicateId) : undefined;
    if (source) setValues(expenseToForm(source, Boolean(duplicateId)));
  }, [duplicateId, expenses, id]);

  const update = <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const matchesScope = (item: { association_id: string | null; club_id: string | null }) => {
    if (values.ownershipType === "PERSONAL") return item.association_id === null && item.club_id === null;
    if (values.ownershipType === "ASSOCIATION") return item.association_id === values.associationId && item.club_id === null;
    return item.association_id === values.associationId && item.club_id === values.clubId;
  };
  const scopedSuppliers = suppliers.filter((supplier) => supplier.is_active && matchesScope(supplier));
  const scopedCategories = categories.filter((category) => category.owner_user_id === null || matchesScope(category));
  const scopedPayments = paymentMethods.filter((method) => method.is_active && matchesScope(method));
  const parentCategories = scopedCategories.filter((category) => !category.parent_category_id && category.is_active);
  const subcategories = scopedCategories.filter((category) => category.parent_category_id === values.categoryId && category.is_active);
  const availableClubs = clubs.filter((club) => club.association_id === values.associationId);
  const total = Number(values.totalAmount || 0);
  const gst = values.gstEntryMethod === "NONE" ? 0 : values.gstEntryMethod === "CALCULATED" ? calculateGstFromInclusiveTotal(total) : Number(values.gstAmount || 0);
  const split = calculateExpenseAmounts(total, gst, Number(values.businessUsePercentage || 0));
  const likelyDuplicates = useMemo(() => expenses.filter((expense) => {
    if (expense.id === values.id || expense.archived_at) return false;
    const sameSupplier = expense.supplier_id === values.supplierId;
    const sameInvoice = Boolean(values.invoiceNumber.trim()) && expense.invoice_number?.toLocaleLowerCase("en-AU") === values.invoiceNumber.trim().toLocaleLowerCase("en-AU");
    const sameDateAndAmount = expense.expense_date === values.expenseDate && Math.abs(Number(expense.total_amount)) === Math.abs(total);
    return sameSupplier && (sameInvoice || sameDateAndAmount);
  }), [expenses, total, values.expenseDate, values.id, values.invoiceNumber, values.supplierId]);

  const chooseSupplier = (supplierId: string) => {
    const supplier = suppliers.find((item) => item.id === supplierId);
    setValues((current) => ({
      ...current,
      supplierId,
      categoryId: supplier?.default_category_id || current.categoryId,
      subcategoryId: "",
      businessUsePercentage: supplier?.default_business_use_percentage === null || supplier?.default_business_use_percentage === undefined
        ? current.businessUsePercentage
        : String(supplier.default_business_use_percentage),
    }));
  };

  const validate = () => {
    if (!values.supplierId || !values.expenseDate || !values.description.trim() || !values.totalAmount) return "Supplier, date, description and total amount are required.";
    if (total < 0) return "Enter a positive amount and choose Credit note when needed.";
    if (gst < 0 || gst > total) return "GST must be between $0 and the total amount.";
    const percentage = Number(values.businessUsePercentage);
    if (percentage < 0 || percentage > 100) return "Business use must be between 0% and 100%.";
    if (values.ownershipType !== "PERSONAL" && !values.associationId) return "Choose an association for a shared expense.";
    if (values.ownershipType === "CLUB" && !values.clubId) return "Choose a club for a club expense.";
    if (values.expenseStatus === "READY" && (!values.categoryId || !values.paymentMethodId)) return "Ready expenses need a category and payment method.";
    return null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const validationError = validate();
    if (validationError) {
      toast({ variant: "destructive", title: "Check the expense", description: validationError });
      return;
    }
    if (likelyDuplicates.length > 0 && !allowDuplicate) {
      toast({ variant: "destructive", title: "Possible duplicate found", description: "Review the matching expense below, then choose Save anyway if this is valid." });
      return;
    }
    setSaving(true);
    try {
      const expenseId = await saveExpense(user.id, values);
      for (const file of files) await uploadExpenseAttachment(expenseId, user.id, file, attachmentType);
      await refresh();
      toast({ title: values.id ? "Expense updated" : "Expense saved", description: files.length > 0 ? `${files.length} document${files.length === 1 ? "" : "s"} uploaded.` : "No supporting document was attached." });
      navigate(`/expense-hub/expenses/${expenseId}/edit`, { replace: true });
      setFiles([]);
      setAllowDuplicate(false);
    } catch (caught) {
      toast({ variant: "destructive", title: "Expense could not be saved", description: caught instanceof Error ? caught.message : "Try again." });
    } finally {
      setSaving(false);
    }
  };

  const removeAttachment = async (attachment: ExpenseRecord["attachments"][number]) => {
    setSaving(true);
    try {
      await deleteExpenseAttachment(attachment);
      await refresh();
      toast({ title: "Document removed" });
    } catch (caught) {
      toast({ variant: "destructive", title: "Document could not be removed", description: caught instanceof Error ? caught.message : "Try again." });
    } finally {
      setSaving(false);
    }
  };

  const scanAttachment = async (attachment: ExpenseRecord["attachments"][number]) => {
    setSaving(true);
    try {
      const result = await scanExpenseAttachment(attachment.id);
      setScanResult(result.result as ScanResult);
      await refresh();
      toast({
        title: "Invoice scan ready for review",
        description: result.evidenceStatus === "VERIFIED"
          ? "The invoice amount and date match this expense."
          : "The invoice differs from the expense. Check the extracted values.",
      });
    } catch (caught) {
      toast({ variant: "destructive", title: "Invoice scan failed", description: caught instanceof Error ? caught.message : "You can continue with manual entry." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card><CardContent className="p-8 text-muted-foreground">Loading expense…</CardContent></Card>;
  if (id && !existing) return <Alert variant="destructive"><AlertTitle>Expense not found</AlertTitle><AlertDescription>The record is unavailable or you do not have access.</AlertDescription></Alert>;

  return (
    <form className="space-y-6" onSubmit={submit}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">{values.id ? "Edit expense" : duplicateId ? "Duplicate expense" : "Add expense"}</h2><p className="text-sm text-muted-foreground">Amounts use Australian dollars and dates display as DD/MM/YYYY after saving.</p></div><div className="flex gap-2"><Button type="button" variant="outline" asChild><Link to="/expense-hub/expenses">Back</Link></Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{likelyDuplicates.length > 0 && !values.id && !allowDuplicate ? "Check duplicate" : "Save expense"}</Button></div></div>

      <Card><CardHeader><CardTitle>1. Basic details</CardTitle><CardDescription>Identify the supplier, document and amount.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Supplier" className="xl:col-span-2"><Select value={values.supplierId || undefined} onValueChange={chooseSupplier}><SelectTrigger className={selectClass}><SelectValue placeholder="Choose a supplier" /></SelectTrigger><SelectContent>{scopedSuppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.display_name}</SelectItem>)}</SelectContent></Select><Button type="button" variant="link" size="sm" className="h-auto px-0" asChild><Link to="/expense-hub/suppliers">Create or manage suppliers</Link></Button></Field>
        <Field label="Expense date"><Input type="date" value={values.expenseDate} onChange={(event) => update("expenseDate", event.target.value)} /></Field>
        <Field label="Invoice number"><Input value={values.invoiceNumber} onChange={(event) => update("invoiceNumber", event.target.value)} maxLength={120} /></Field>
        <Field label="Description" className="md:col-span-2 xl:col-span-3"><Input value={values.description} onChange={(event) => update("description", event.target.value)} maxLength={500} /></Field>
        <Field label="Document type"><Select value={values.documentType} onValueChange={(value) => update("documentType", value as ExpenseFormValues["documentType"])}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EXPENSE">Expense</SelectItem><SelectItem value="CREDIT_NOTE">Credit note</SelectItem></SelectContent></Select></Field>
        <Field label="Total amount"><Input type="number" min="0" step="0.01" value={values.totalAmount} onChange={(event) => update("totalAmount", event.target.value)} /></Field>
        <Field label="GST treatment"><Select value={values.gstEntryMethod} onValueChange={(value) => { const method = value as ExpenseFormValues["gstEntryMethod"]; update("gstEntryMethod", method); if (method === "NONE") update("gstAmount", "0.00"); }}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MANUAL">Enter GST manually</SelectItem><SelectItem value="CALCULATED">Calculate GST as 1/11</SelectItem><SelectItem value="NONE">No GST</SelectItem></SelectContent></Select></Field>
        <Field label="GST amount"><Input type="number" min="0" step="0.01" disabled={values.gstEntryMethod !== "MANUAL"} value={values.gstEntryMethod === "CALCULATED" ? gst.toFixed(2) : values.gstAmount} onChange={(event) => update("gstAmount", event.target.value)} /></Field>
        <div className="rounded-lg border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Amount excluding GST</p><p className="text-xl font-semibold">{formatCurrency(split.amountExcludingGst)}</p></div>
        {values.expenseDate > new Date().toISOString().slice(0, 10) && <Alert className="md:col-span-2 xl:col-span-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Future expense date</AlertTitle><AlertDescription>Check that this date is intentional before saving.</AlertDescription></Alert>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>2. Ownership and classification</CardTitle><CardDescription>Keep personal, association and club records in the correct scope.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Record belongs to"><Select value={values.ownershipType} onValueChange={(value) => setValues((current) => ({ ...current, ownershipType: value as ExpenseFormValues["ownershipType"], associationId: "", clubId: "", supplierId: "", categoryId: "", subcategoryId: "", paymentMethodId: "" }))}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PERSONAL">My personal business records</SelectItem><SelectItem value="ASSOCIATION">Association workspace</SelectItem><SelectItem value="CLUB">Club workspace</SelectItem></SelectContent></Select></Field>
        {values.ownershipType !== "PERSONAL" && <Field label="Association"><Select value={values.associationId || undefined} onValueChange={(value) => setValues((current) => ({ ...current, associationId: value, clubId: "", supplierId: "", categoryId: "", subcategoryId: "", paymentMethodId: "" }))}><SelectTrigger className={selectClass}><SelectValue placeholder="Choose association" /></SelectTrigger><SelectContent>{associations.map((association) => <SelectItem key={association.id} value={association.id}>{association.name}</SelectItem>)}</SelectContent></Select></Field>}
        {values.ownershipType === "CLUB" && <Field label="Club"><Select value={values.clubId || undefined} onValueChange={(value) => setValues((current) => ({ ...current, clubId: value, supplierId: "", categoryId: "", subcategoryId: "", paymentMethodId: "" }))}><SelectTrigger className={selectClass}><SelectValue placeholder="Choose club" /></SelectTrigger><SelectContent>{availableClubs.map((club) => <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>)}</SelectContent></Select></Field>}
        <Field label="Category"><Select value={values.categoryId || undefined} onValueChange={(value) => setValues((current) => ({ ...current, categoryId: value, subcategoryId: "" }))}><SelectTrigger className={selectClass}><SelectValue placeholder="Choose category" /></SelectTrigger><SelectContent>{parentCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Subcategory"><Select value={values.subcategoryId || "__none__"} onValueChange={(value) => update("subcategoryId", value === "__none__" ? "" : value)} disabled={subcategories.length === 0}><SelectTrigger className={selectClass}><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent><SelectItem value="__none__">No subcategory</SelectItem>{subcategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Payment method"><Select value={values.paymentMethodId || undefined} onValueChange={(value) => update("paymentMethodId", value)}><SelectTrigger className={selectClass}><SelectValue placeholder="Choose payment method" /></SelectTrigger><SelectContent>{scopedPayments.map((method) => <SelectItem key={method.id} value={method.id}>{method.name}{method.account_hint ? ` · ${method.account_hint}` : ""}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Payment status"><Select value={values.paymentStatus} onValueChange={(value) => update("paymentStatus", value as ExpenseFormValues["paymentStatus"])}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PAID">Paid</SelectItem><SelectItem value="UNPAID">Unpaid</SelectItem><SelectItem value="REIMBURSEMENT_EXPECTED">Reimbursement expected</SelectItem><SelectItem value="REIMBURSED">Reimbursed</SelectItem><SelectItem value="NOT_APPLICABLE">Not applicable</SelectItem></SelectContent></Select></Field>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>3. Business and personal split</CardTitle><CardDescription>The system stores the percentage and calculates both portions.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Button type="button" variant={values.businessUsePercentage === "100" ? "default" : "outline"} onClick={() => update("businessUsePercentage", "100")}>100% business</Button><Button type="button" variant={values.businessUsePercentage === "0" ? "default" : "outline"} onClick={() => update("businessUsePercentage", "0")}>0% business</Button><Field label="Custom percentage"><Input type="number" min="0" max="100" step="0.01" value={values.businessUsePercentage} onChange={(event) => update("businessUsePercentage", event.target.value)} /></Field></div><div className="grid gap-3 sm:grid-cols-3"><Amount label="Total" value={total} /><Amount label="Business portion" value={split.businessAmount} /><Amount label="Personal portion" value={split.personalAmount} /></div><Field label="Reason for the percentage (recommended for mixed use)"><Textarea value={values.businessUseReason} onChange={(event) => update("businessUseReason", event.target.value)} placeholder="For example, phone plan used for work three days per week." /></Field></CardContent></Card>

      <Card><CardHeader><CardTitle>4. Supporting documents</CardTitle><CardDescription>Private PDF, JPG and PNG files up to 20 MB each.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-[220px_1fr]"><Field label="Document type"><Select value={attachmentType} onValueChange={(value) => setAttachmentType(value as AttachmentDocumentType)}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INVOICE">Invoice</SelectItem><SelectItem value="RECEIPT">Receipt</SelectItem><SelectItem value="CREDIT_NOTE">Credit note</SelectItem><SelectItem value="STATEMENT">Statement</SelectItem><SelectItem value="SUPPORTING_DOCUMENT">Supporting document</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></Field><Field label="Choose files"><Input type="file" accept="application/pdf,image/jpeg,image/png" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /></Field></div>{files.length > 0 ? <p className="text-sm text-muted-foreground">Ready to upload: {files.map((file) => file.name).join(", ")}</p> : (!existing || existing.attachments.length === 0) && <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>No document attached</AlertTitle><AlertDescription>You can save without a document, but the record will appear in the missing-document summary.</AlertDescription></Alert>}{existing?.attachments.map((attachment) => <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div className="flex min-w-0 items-center gap-3"><Paperclip className="h-4 w-4 shrink-0" /><div className="min-w-0"><p className="truncate text-sm font-medium">{attachment.original_filename}</p><p className="text-xs text-muted-foreground">{attachment.document_type.replaceAll("_", " ")} · {(attachment.file_size / 1024 / 1024).toFixed(2)} MB</p></div></div><div className="flex gap-1"><Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void scanAttachment(attachment)}>Scan invoice</Button><Button type="button" size="sm" variant="ghost" onClick={() => void openExpenseAttachment(attachment)}><ExternalLink className="mr-2 h-4 w-4" />Open</Button><Button type="button" size="icon" variant="ghost" disabled={saving} onClick={() => void removeAttachment(attachment)} aria-label={`Remove ${attachment.original_filename}`}><Trash2 className="h-4 w-4" /></Button></div></div>)}</CardContent></Card>

      {scanResult && <Alert><FileText className="h-4 w-4" /><AlertTitle>Extracted invoice values — check before changing the expense</AlertTitle><AlertDescription><div className="mt-2 grid gap-1 text-sm sm:grid-cols-2"><span>Supplier: {scanResult.supplier_name || "Not found"}</span><span>Invoice: {scanResult.invoice_number || "Not found"}</span><span>Date: {scanResult.invoice_date ? formatAustralianDate(scanResult.invoice_date) : "Not found"}</span><span>Total: {scanResult.total_amount === null ? "Not found" : formatCurrency(scanResult.total_amount)}</span><span>GST: {scanResult.gst_amount === null ? "Not found" : formatCurrency(scanResult.gst_amount)}</span><span>Confidence: {(scanResult.overall_confidence * 100).toFixed(0)}%</span></div></AlertDescription></Alert>}

      <Card><CardHeader><CardTitle>5. Notes and status</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Field label="Notes"><Textarea rows={5} value={values.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Project, reimbursement or tax-time notes." /></Field><div className="space-y-4"><Field label="Save status"><Select value={values.expenseStatus} onValueChange={(value) => update("expenseStatus", value as ExpenseFormValues["expenseStatus"])}><SelectTrigger className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DRAFT">Draft</SelectItem><SelectItem value="READY">Ready</SelectItem><SelectItem value="NEEDS_REVIEW">Needs review</SelectItem></SelectContent></Select></Field>{values.id && <Field label="Reason for this change"><Input value={values.lastChangeReason} onChange={(event) => update("lastChangeReason", event.target.value)} placeholder="For example, corrected business percentage" /></Field>}</div></CardContent></Card>

      {likelyDuplicates.length > 0 && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Possible duplicate expense</AlertTitle><AlertDescription><div className="mt-2 space-y-2">{likelyDuplicates.map((duplicate) => <div key={duplicate.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-destructive/30 p-2"><span>{duplicate.supplier?.display_name} · {formatAustralianDate(duplicate.expense_date)} · {formatCurrency(Number(duplicate.total_amount))} · {duplicate.invoice_number || "No invoice number"}</span><Button type="button" size="sm" variant="outline" asChild><Link to={`/expense-hub/expenses/${duplicate.id}/edit`}>Open existing</Link></Button></div>)}<Button type="button" size="sm" variant={allowDuplicate ? "secondary" : "destructive"} onClick={() => setAllowDuplicate((current) => !current)}>{allowDuplicate ? "Saving duplicate is allowed" : "Save anyway"}</Button></div></AlertDescription></Alert>}

      {existing && <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Audit history</CardTitle><CardDescription>Changes are recorded automatically.</CardDescription></CardHeader><CardContent className="space-y-3">{existing.auditEvents.map((event) => { const changes = auditChanges(event.previous_data, event.new_data); return <div key={event.id} className="rounded-lg border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{event.action_type.replaceAll("_", " ")}</span><span className="text-muted-foreground">{new Date(event.changed_at).toLocaleString("en-AU")}</span></div>{event.field_changed && <p className="mt-1 text-muted-foreground">{event.field_changed.replaceAll("_", " ")}: {event.previous_value || "—"} → {event.new_value || "—"}</p>}{changes.length > 0 && <div className="mt-2 space-y-1 text-xs text-muted-foreground">{changes.map((change) => <p key={change.field}><span className="font-medium text-foreground">{change.field.replaceAll("_", " ")}:</span> {auditValue(change.previous)} → {auditValue(change.next)}</p>)}</div>}{event.reason_for_change && <p className="mt-2">Reason: {event.reason_for_change}</p>}</div>; })}{existing.auditEvents.length === 0 && <p className="text-sm text-muted-foreground">No history entries are available.</p>}</CardContent></Card>}

      <div className="flex justify-end gap-2"><Button type="button" variant="outline" asChild><Link to="/expense-hub/expenses">Cancel</Link></Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save expense</Button></div>
    </form>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}><Label>{label}</Label>{children}</div>;
}

function Amount({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{formatCurrency(value)}</p></div>;
}

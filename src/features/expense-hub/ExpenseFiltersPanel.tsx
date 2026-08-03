import { FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  ExpenseCategory,
  ExpenseFilters,
  ExpensePaymentMethod,
  ExpenseSupplierWithAliases,
} from "./types";
import { EMPTY_EXPENSE_FILTERS } from "./types";

interface ExpenseFiltersPanelProps {
  filters: ExpenseFilters;
  onChange: (filters: ExpenseFilters) => void;
  suppliers: ExpenseSupplierWithAliases[];
  categories: ExpenseCategory[];
  paymentMethods: ExpensePaymentMethod[];
  financialYears: string[];
}

const selectTriggerClass = "w-full min-w-0 overflow-hidden";

export function ExpenseFiltersPanel({
  filters,
  onChange,
  suppliers,
  categories,
  paymentMethods,
  financialYears,
}: ExpenseFiltersPanelProps) {
  const update = <K extends keyof ExpenseFilters>(key: K, value: ExpenseFilters[K]) => onChange({ ...filters, [key]: value });
  const parentCategories = categories.filter((category) => !category.parent_category_id && category.is_active);
  const subcategories = categories.filter((category) => category.parent_category_id === filters.categoryId && category.is_active);
  const activeCount = Object.entries(filters).filter(([key, value]) => {
    const defaultValue = EMPTY_EXPENSE_FILTERS[key as keyof ExpenseFilters];
    return value !== defaultValue;
  }).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Filters {activeCount > 0 && `(${activeCount})`}</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...EMPTY_EXPENSE_FILTERS })} disabled={activeCount === 0}>
          <FilterX className="mr-2 h-4 w-4" />Clear filters
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="expense-search">Search</Label>
          <Input id="expense-search" value={filters.search} onChange={(event) => update("search", event.target.value)} placeholder="Supplier, invoice, description or notes" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-date-from">From</Label>
          <Input id="expense-date-from" type="date" value={filters.dateFrom} onChange={(event) => update("dateFrom", event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-date-to">To</Label>
          <Input id="expense-date-to" type="date" value={filters.dateTo} onChange={(event) => update("dateTo", event.target.value)} />
        </div>
        <FilterSelect label="Financial year" value={filters.financialYear} onValueChange={(value) => update("financialYear", value)} options={financialYears.map((value) => ({ value, label: value }))} />
        <FilterSelect label="Supplier" value={filters.supplierId} onValueChange={(value) => update("supplierId", value)} options={suppliers.filter((supplier) => supplier.is_active).map((supplier) => ({ value: supplier.id, label: supplier.display_name }))} />
        <FilterSelect label="Category" value={filters.categoryId} onValueChange={(value) => onChange({ ...filters, categoryId: value, subcategoryId: "ALL" })} options={parentCategories.map((category) => ({ value: category.id, label: category.name }))} />
        <FilterSelect label="Subcategory" value={filters.subcategoryId} onValueChange={(value) => update("subcategoryId", value)} options={subcategories.map((category) => ({ value: category.id, label: category.name }))} disabled={subcategories.length === 0} />
        <FilterSelect label="Payment method" value={filters.paymentMethodId} onValueChange={(value) => update("paymentMethodId", value)} options={paymentMethods.filter((method) => method.is_active).map((method) => ({ value: method.id, label: method.name }))} />
        <FilterSelect label="Status" value={filters.status} onValueChange={(value) => update("status", value)} options={[{ value: "DRAFT", label: "Draft" }, { value: "READY", label: "Ready" }, { value: "NEEDS_REVIEW", label: "Needs review" }]} />
        <FilterSelect label="Documents" value={filters.attachmentState} onValueChange={(value) => update("attachmentState", value as ExpenseFilters["attachmentState"])} options={[{ value: "WITH", label: "With documents" }, { value: "WITHOUT", label: "Without documents" }]} />
        <FilterSelect label="Use" value={filters.useType} onValueChange={(value) => update("useType", value as ExpenseFilters["useType"])} options={[{ value: "BUSINESS", label: "100% business" }, { value: "PERSONAL", label: "100% personal" }, { value: "MIXED", label: "Mixed use" }]} />
        <FilterSelect label="Export history" value={filters.exportState} onValueChange={(value) => update("exportState", value as ExpenseFilters["exportState"])} options={[{ value: "EXPORTED", label: "Previously exported" }, { value: "NOT_EXPORTED", label: "Not exported" }]} />
        <FilterSelect label="Archive" value={filters.archiveState} onValueChange={(value) => update("archiveState", value as ExpenseFilters["archiveState"])} options={[{ value: "ACTIVE", label: "Active only" }, { value: "ARCHIVED", label: "Archived only" }]} allLabel="Active and archived" />
        <NumberRange label="Business use %" minimum={filters.businessUseMin} maximum={filters.businessUseMax} onMinimum={(value) => update("businessUseMin", value)} onMaximum={(value) => update("businessUseMax", value)} />
        <NumberRange label="Amount" minimum={filters.amountMin} maximum={filters.amountMax} onMinimum={(value) => update("amountMin", value)} onMaximum={(value) => update("amountMax", value)} />
      </CardContent>
    </Card>
  );
}

function FilterSelect({ label, value, onValueChange, options, disabled, allLabel = "All" }: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  allLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{allLabel}</SelectItem>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function NumberRange({ label, minimum, maximum, onMinimum, onMaximum }: {
  label: string;
  minimum: string;
  maximum: string;
  onMinimum: (value: string) => void;
  onMaximum: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" min="0" value={minimum} onChange={(event) => onMinimum(event.target.value)} placeholder="Min" aria-label={`${label} minimum`} />
        <Input type="number" min="0" value={maximum} onChange={(event) => onMaximum(event.target.value)} placeholder="Max" aria-label={`${label} maximum`} />
      </div>
    </div>
  );
}

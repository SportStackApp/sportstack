-- Follow-up hardening for the applied Expense Hub foundation.
-- The helpers can use SECURITY INVOKER because every underlying table has
-- explicit authenticated grants and matching RLS. This removes avoidable
-- SECURITY DEFINER exposure while preserving the same current-user checks.

alter function public.has_expense_hub_access() security invoker;
alter function public.expense_scope_allows(uuid, uuid, uuid) security invoker;
alter function public.expense_record_access(uuid) security invoker;
alter function public.expense_storage_can_access(text) security invoker;

-- Cover every Expense Hub foreign key used for scoped checks, joins and
-- retention operations. Existing leading-column indexes are not duplicated.
create index expense_hub_access_association_idx
  on public.expense_hub_access (association_id);
create index expense_hub_access_club_idx
  on public.expense_hub_access (club_id);
create index expense_hub_access_granted_by_idx
  on public.expense_hub_access (granted_by);

create index expense_categories_association_idx
  on public.expense_categories (association_id);
create index expense_categories_club_idx
  on public.expense_categories (club_id);
create index expense_categories_parent_idx
  on public.expense_categories (parent_category_id);

create index expense_suppliers_association_idx
  on public.expense_suppliers (association_id);
create index expense_suppliers_club_idx
  on public.expense_suppliers (club_id);
create index expense_suppliers_default_category_idx
  on public.expense_suppliers (default_category_id);
create index expense_suppliers_created_by_idx
  on public.expense_suppliers (created_by);
create index expense_suppliers_updated_by_idx
  on public.expense_suppliers (updated_by);

create index expense_supplier_aliases_created_by_idx
  on public.expense_supplier_aliases (created_by);

create index expense_payment_methods_association_idx
  on public.expense_payment_methods (association_id);
create index expense_payment_methods_club_idx
  on public.expense_payment_methods (club_id);
create index expense_payment_methods_created_by_idx
  on public.expense_payment_methods (created_by);
create index expense_payment_methods_updated_by_idx
  on public.expense_payment_methods (updated_by);

create index expenses_club_idx
  on public.expenses (club_id);
create index expenses_subcategory_idx
  on public.expenses (subcategory_id);
create index expenses_payment_method_idx
  on public.expenses (payment_method_id);
create index expenses_created_by_idx
  on public.expenses (created_by);
create index expenses_updated_by_idx
  on public.expenses (updated_by);
create index expenses_archived_by_idx
  on public.expenses (archived_by);

create index expense_attachments_uploaded_by_idx
  on public.expense_attachments (uploaded_by);

create index expense_export_batches_association_idx
  on public.expense_export_batches (association_id);
create index expense_export_batches_club_idx
  on public.expense_export_batches (club_id);
create index expense_export_batches_created_by_idx
  on public.expense_export_batches (created_by);

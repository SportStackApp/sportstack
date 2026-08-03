-- Allow explicitly authorised finance administrators to manage records in
-- their granted association or club scope without allowing ownership changes.

create or replace function private.expense_prevent_owner_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'Expense Hub record ownership cannot be changed.';
  end if;
  return new;
end;
$function$;

create trigger expense_category_owner_immutable
before update on public.expense_categories
for each row execute function private.expense_prevent_owner_change();

create trigger expense_supplier_owner_immutable
before update on public.expense_suppliers
for each row execute function private.expense_prevent_owner_change();

create trigger expense_payment_method_owner_immutable
before update on public.expense_payment_methods
for each row execute function private.expense_prevent_owner_change();

create trigger expense_owner_immutable
before update on public.expenses
for each row execute function private.expense_prevent_owner_change();

create trigger expense_attachment_owner_immutable
before update on public.expense_attachments
for each row execute function private.expense_prevent_owner_change();

drop policy expense_categories_update on public.expense_categories;
create policy expense_categories_update
on public.expense_categories for update to authenticated
using (
  owner_user_id is not null
  and public.expense_scope_allows(owner_user_id, association_id, club_id)
)
with check (
  owner_user_id is not null
  and public.expense_scope_allows(owner_user_id, association_id, club_id)
);

drop policy expense_suppliers_update on public.expense_suppliers;
create policy expense_suppliers_update
on public.expense_suppliers for update to authenticated
using (public.expense_scope_allows(owner_user_id, association_id, club_id))
with check (public.expense_scope_allows(owner_user_id, association_id, club_id));

drop policy expense_payment_methods_update on public.expense_payment_methods;
create policy expense_payment_methods_update
on public.expense_payment_methods for update to authenticated
using (public.expense_scope_allows(owner_user_id, association_id, club_id))
with check (public.expense_scope_allows(owner_user_id, association_id, club_id));

drop policy expenses_update on public.expenses;
create policy expenses_update
on public.expenses for update to authenticated
using (public.expense_scope_allows(owner_user_id, association_id, club_id))
with check (public.expense_scope_allows(owner_user_id, association_id, club_id));

drop policy expense_attachments_update on public.expense_attachments;
create policy expense_attachments_update
on public.expense_attachments for update to authenticated
using (public.expense_record_access(expense_id))
with check (public.expense_record_access(expense_id));

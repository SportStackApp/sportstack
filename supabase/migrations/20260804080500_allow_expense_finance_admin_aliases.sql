-- Supplier aliases are part of organisation supplier management. Permit an
-- explicitly authorised finance administrator to manage aliases in scope.

drop policy expense_supplier_aliases_insert on public.expense_supplier_aliases;
create policy expense_supplier_aliases_insert
on public.expense_supplier_aliases for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.expense_suppliers supplier
    where supplier.id = supplier_id
      and public.expense_scope_allows(
        supplier.owner_user_id,
        supplier.association_id,
        supplier.club_id
      )
  )
);

drop policy expense_supplier_aliases_delete on public.expense_supplier_aliases;
create policy expense_supplier_aliases_delete
on public.expense_supplier_aliases for delete to authenticated
using (
  exists (
    select 1
    from public.expense_suppliers supplier
    where supplier.id = supplier_id
      and public.expense_scope_allows(
        supplier.owner_user_id,
        supplier.association_id,
        supplier.club_id
      )
  )
);

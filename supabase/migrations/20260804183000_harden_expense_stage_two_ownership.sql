-- Keep imported ownership/scope immutable and reserve AI job writes for the server-side processor.

create or replace function private.expense_prevent_import_scope_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.owner_user_id is distinct from old.owner_user_id
    or new.ownership_type is distinct from old.ownership_type
    or new.association_id is distinct from old.association_id
    or new.club_id is distinct from old.club_id then
    raise exception 'Statement import ownership and scope cannot be changed';
  end if;
  return new;
end;
$function$;

create trigger expense_statement_import_scope_immutable
before update on public.expense_statement_imports
for each row execute function private.expense_prevent_import_scope_change();

create trigger expense_statement_line_owner_immutable
before update on public.expense_statement_lines
for each row execute function private.expense_prevent_owner_change();

drop policy expense_ai_jobs_insert on public.expense_ai_processing_jobs;
drop policy expense_ai_jobs_update on public.expense_ai_processing_jobs;
revoke insert, update on public.expense_ai_processing_jobs from authenticated;

drop policy expense_statement_lines_insert on public.expense_statement_lines;
create policy expense_statement_lines_insert
on public.expense_statement_lines for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.expense_statement_imports i
    where i.id = import_id
      and i.owner_user_id = public.expense_statement_lines.owner_user_id
      and public.expense_scope_allows(i.owner_user_id, i.association_id, i.club_id)
  )
);

drop policy expense_statement_lines_update on public.expense_statement_lines;
create policy expense_statement_lines_update
on public.expense_statement_lines for update to authenticated
using (
  exists (
    select 1 from public.expense_statement_imports i
    where i.id = import_id
      and public.expense_scope_allows(i.owner_user_id, i.association_id, i.club_id)
  )
)
with check (
  exists (
    select 1 from public.expense_statement_imports i
    where i.id = import_id
      and i.owner_user_id = public.expense_statement_lines.owner_user_id
      and public.expense_scope_allows(i.owner_user_id, i.association_id, i.club_id)
  )
);

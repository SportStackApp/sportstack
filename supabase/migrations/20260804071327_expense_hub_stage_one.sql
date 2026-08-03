-- SportStack Expense Hub - complete manual Stage 1 foundation.
-- Personal records stay private. Association and club sharing requires an
-- explicit Expense Hub access grant; ordinary SportStack admin roles do not
-- bypass these controls.

create table public.expense_hub_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  access_level text not null default 'OWNER'
    check (access_level in ('OWNER', 'FINANCE_ADMIN')),
  association_id uuid references public.associations(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  is_active boolean not null default true,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (club_id is null or association_id is not null)
);

create unique index expense_hub_access_scope_unique
  on public.expense_hub_access (
    user_id,
    coalesce(association_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(club_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete cascade,
  association_id uuid references public.associations(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  description text,
  parent_category_id uuid references public.expense_categories(id) on delete restrict,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (owner_user_id is null and association_id is null and club_id is null)
    or owner_user_id is not null
  ),
  check (club_id is null or association_id is not null)
);

create unique index expense_categories_system_name_unique
  on public.expense_categories (lower(name))
  where owner_user_id is null;
create index expense_categories_owner_scope_idx
  on public.expense_categories (owner_user_id, association_id, club_id, is_active, sort_order);

create table public.expense_suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  association_id uuid references public.associations(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  legal_name text,
  abn text,
  email text,
  phone text,
  website text,
  notes text,
  default_category_id uuid references public.expense_categories(id) on delete set null,
  default_business_use_percentage numeric(5,2)
    check (default_business_use_percentage between 0 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  check (club_id is null or association_id is not null)
);

create index expense_suppliers_owner_scope_name_idx
  on public.expense_suppliers (owner_user_id, association_id, club_id, lower(display_name));
create index expense_suppliers_abn_idx
  on public.expense_suppliers (abn)
  where abn is not null;

create table public.expense_supplier_aliases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.expense_suppliers(id) on delete cascade,
  alias_name text not null check (length(trim(alias_name)) between 1 and 200),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict
);

create unique index expense_supplier_alias_unique
  on public.expense_supplier_aliases (supplier_id, lower(alias_name));

create table public.expense_payment_methods (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  association_id uuid references public.associations(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  account_hint text check (account_hint is null or length(account_hint) <= 80),
  is_business_account boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  check (club_id is null or association_id is not null)
);

create unique index expense_payment_methods_owner_scope_name_unique
  on public.expense_payment_methods (
    owner_user_id,
    coalesce(association_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(club_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  ownership_type text not null default 'PERSONAL'
    check (ownership_type in ('PERSONAL', 'ASSOCIATION', 'CLUB')),
  association_id uuid references public.associations(id) on delete restrict,
  club_id uuid references public.clubs(id) on delete restrict,
  supplier_id uuid not null references public.expense_suppliers(id) on delete restrict,
  expense_date date not null,
  invoice_number text,
  description text not null check (length(trim(description)) between 1 and 500),
  category_id uuid references public.expense_categories(id) on delete restrict,
  subcategory_id uuid references public.expense_categories(id) on delete restrict,
  total_amount numeric(14,2) not null,
  gst_amount numeric(14,2) not null default 0,
  gst_entry_method text not null default 'MANUAL'
    check (gst_entry_method in ('MANUAL', 'CALCULATED', 'NONE')),
  amount_excluding_gst numeric(14,2)
    generated always as (round(total_amount - gst_amount, 2)) stored,
  business_use_percentage numeric(5,2) not null default 100
    check (business_use_percentage between 0 and 100),
  business_amount numeric(14,2)
    generated always as (round(total_amount * business_use_percentage / 100, 2)) stored,
  personal_amount numeric(14,2)
    generated always as (
      round(total_amount - round(total_amount * business_use_percentage / 100, 2), 2)
    ) stored,
  business_gst_amount numeric(14,2)
    generated always as (round(gst_amount * business_use_percentage / 100, 2)) stored,
  business_use_reason text,
  payment_method_id uuid references public.expense_payment_methods(id) on delete restrict,
  payment_status text not null default 'PAID'
    check (payment_status in (
      'UNPAID',
      'PAID',
      'REIMBURSEMENT_EXPECTED',
      'REIMBURSED',
      'NOT_APPLICABLE'
    )),
  expense_status text not null default 'DRAFT'
    check (expense_status in ('DRAFT', 'READY', 'NEEDS_REVIEW')),
  document_type text not null default 'EXPENSE'
    check (document_type in ('EXPENSE', 'CREDIT_NOTE')),
  currency_code text not null default 'AUD'
    check (currency_code ~ '^[A-Z]{3}$'),
  notes text,
  last_change_reason text,
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  check (
    (ownership_type = 'PERSONAL' and association_id is null and club_id is null)
    or (ownership_type = 'ASSOCIATION' and association_id is not null and club_id is null)
    or (ownership_type = 'CLUB' and association_id is not null and club_id is not null)
  ),
  check (
    (document_type = 'EXPENSE' and total_amount >= 0 and gst_amount >= 0)
    or (document_type = 'CREDIT_NOTE' and total_amount <= 0 and gst_amount <= 0)
  ),
  check (abs(gst_amount) <= abs(total_amount)),
  check (
    expense_status <> 'READY'
    or (category_id is not null and payment_method_id is not null)
  )
);

create index expenses_owner_date_idx
  on public.expenses (owner_user_id, expense_date desc);
create index expenses_scope_date_idx
  on public.expenses (association_id, club_id, expense_date desc);
create index expenses_supplier_invoice_idx
  on public.expenses (supplier_id, lower(invoice_number))
  where invoice_number is not null;
create index expenses_category_status_idx
  on public.expenses (category_id, expense_status, expense_date desc);
create index expenses_active_idx
  on public.expenses (owner_user_id, expense_date desc)
  where archived_at is null;

create table public.expense_attachments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  document_type text not null default 'INVOICE'
    check (document_type in (
      'INVOICE',
      'RECEIPT',
      'CREDIT_NOTE',
      'STATEMENT',
      'SUPPORTING_DOCUMENT',
      'OTHER'
    )),
  file_hash text check (file_hash is null or file_hash ~ '^[a-f0-9]{64}$'),
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  is_primary_document boolean not null default false
);

create index expense_attachments_expense_idx
  on public.expense_attachments (expense_id, uploaded_at desc);
create index expense_attachments_hash_idx
  on public.expense_attachments (owner_user_id, file_hash)
  where file_hash is not null;

create table public.expense_audit_events (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  action_type text not null,
  previous_data jsonb,
  new_data jsonb,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  reason_for_change text
);

create index expense_audit_events_expense_idx
  on public.expense_audit_events (expense_id, changed_at desc);
create index expense_audit_events_actor_idx
  on public.expense_audit_events (changed_by, changed_at desc);

create table public.expense_export_batches (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  association_id uuid references public.associations(id) on delete restrict,
  club_id uuid references public.clubs(id) on delete restrict,
  export_format text not null check (export_format in ('XLSX', 'PDF')),
  report_name text not null,
  filters jsonb not null default '{}'::jsonb,
  total_amount numeric(14,2) not null default 0,
  total_business_amount numeric(14,2) not null default 0,
  total_personal_amount numeric(14,2) not null default 0,
  total_gst_amount numeric(14,2) not null default 0,
  expense_count integer not null check (expense_count >= 0),
  module_version text not null default 'stage-1',
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  check (club_id is null or association_id is not null)
);

create index expense_export_batches_owner_created_idx
  on public.expense_export_batches (owner_user_id, created_at desc);

create table public.expense_export_items (
  id uuid primary key default gen_random_uuid(),
  export_batch_id uuid not null references public.expense_export_batches(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete restrict,
  expense_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (export_batch_id, expense_id)
);

create index expense_export_items_expense_idx
  on public.expense_export_items (expense_id, created_at desc);

-- Explicit access helpers. They read auth.uid() internally so callers cannot
-- ask whether another user has access.
create or replace function public.has_expense_hub_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.expense_hub_access access_row
    where access_row.user_id = (select auth.uid())
      and access_row.is_active
  );
$function$;

create or replace function public.expense_scope_allows(
  p_owner_user_id uuid,
  p_association_id uuid,
  p_club_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (
      p_owner_user_id = (select auth.uid())
      and public.has_expense_hub_access()
    )
    or exists (
      select 1
      from public.expense_hub_access access_row
      where access_row.user_id = (select auth.uid())
        and access_row.is_active
        and access_row.access_level in ('OWNER', 'FINANCE_ADMIN')
        and (
          (p_club_id is not null and access_row.club_id = p_club_id)
          or (
            p_association_id is not null
            and access_row.association_id = p_association_id
            and access_row.club_id is null
          )
        )
    );
$function$;

create or replace function public.expense_record_access(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.expenses expense_row
    where expense_row.id = p_expense_id
      and public.expense_scope_allows(
        expense_row.owner_user_id,
        expense_row.association_id,
        expense_row.club_id
      )
  );
$function$;

create or replace function public.expense_storage_can_access(p_storage_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_expense_id uuid;
begin
  begin
    v_expense_id := split_part(p_storage_name, '/', 1)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return public.expense_record_access(v_expense_id);
end;
$function$;

revoke all on function public.has_expense_hub_access() from public, anon;
revoke all on function public.expense_scope_allows(uuid, uuid, uuid) from public, anon;
revoke all on function public.expense_record_access(uuid) from public, anon;
revoke all on function public.expense_storage_can_access(text) from public, anon;
grant execute on function public.has_expense_hub_access() to authenticated;
grant execute on function public.expense_scope_allows(uuid, uuid, uuid) to authenticated;
grant execute on function public.expense_record_access(uuid) to authenticated;
grant execute on function public.expense_storage_can_access(text) to authenticated;

create or replace function private.expense_prepare_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_club_association_id uuid;
  v_supplier public.expense_suppliers%rowtype;
  v_payment public.expense_payment_methods%rowtype;
  v_category public.expense_categories%rowtype;
begin
  if new.ownership_type = 'CLUB' then
    select club.association_id
    into v_club_association_id
    from public.clubs club
    where club.id = new.club_id;

    if v_club_association_id is distinct from new.association_id then
      raise exception 'The selected club does not belong to the selected association.';
    end if;
  end if;

  select * into v_supplier
  from public.expense_suppliers
  where id = new.supplier_id;

  if not found
    or v_supplier.owner_user_id <> new.owner_user_id
    or v_supplier.association_id is distinct from new.association_id
    or v_supplier.club_id is distinct from new.club_id then
    raise exception 'The selected supplier does not belong to this expense scope.';
  end if;

  if new.payment_method_id is not null then
    select * into v_payment
    from public.expense_payment_methods
    where id = new.payment_method_id;

    if not found
      or v_payment.owner_user_id <> new.owner_user_id
      or v_payment.association_id is distinct from new.association_id
      or v_payment.club_id is distinct from new.club_id then
      raise exception 'The selected payment method does not belong to this expense scope.';
    end if;
  end if;

  if new.category_id is not null then
    select * into v_category
    from public.expense_categories
    where id = new.category_id;

    if not found
      or (
        v_category.owner_user_id is not null
        and (
          v_category.owner_user_id <> new.owner_user_id
          or v_category.association_id is distinct from new.association_id
          or v_category.club_id is distinct from new.club_id
        )
      ) then
      raise exception 'The selected category does not belong to this expense scope.';
    end if;
  end if;

  if new.subcategory_id is not null then
    select * into v_category
    from public.expense_categories
    where id = new.subcategory_id;

    if not found or v_category.parent_category_id is distinct from new.category_id then
      raise exception 'The selected subcategory does not belong to the selected category.';
    end if;
  end if;

  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$function$;

create trigger expense_prepare_record
before insert or update on public.expenses
for each row execute function private.expense_prepare_record();

create or replace function private.expense_prepare_scoped_reference()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_club_association_id uuid;
begin
  if new.club_id is not null then
    select club.association_id
    into v_club_association_id
    from public.clubs club
    where club.id = new.club_id;
    if v_club_association_id is distinct from new.association_id then
      raise exception 'The selected club does not belong to the selected association.';
    end if;
  end if;
  new.updated_at := now();
  if to_jsonb(new) ? 'updated_by' then
    new.updated_by := coalesce((select auth.uid()), new.updated_by);
  end if;
  return new;
end;
$function$;

create trigger expense_supplier_prepare
before insert or update on public.expense_suppliers
for each row execute function private.expense_prepare_scoped_reference();

create trigger expense_payment_method_prepare
before insert or update on public.expense_payment_methods
for each row execute function private.expense_prepare_scoped_reference();

create or replace function private.expense_write_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text;
  v_reason text;
begin
  if tg_op = 'INSERT' then
    v_action := 'CREATED';
    v_reason := coalesce(nullif(trim(new.last_change_reason), ''), 'Expense created');
    insert into public.expense_audit_events (
      expense_id,
      action_type,
      previous_data,
      new_data,
      changed_by,
      reason_for_change
    ) values (
      new.id,
      v_action,
      null,
      to_jsonb(new) - 'last_change_reason',
      coalesce((select auth.uid()), new.created_by),
      v_reason
    );
    return new;
  end if;

  if (to_jsonb(old) - array['updated_at', 'updated_by', 'last_change_reason'])
    = (to_jsonb(new) - array['updated_at', 'updated_by', 'last_change_reason']) then
    return new;
  end if;

  v_action := case
    when old.archived_at is null and new.archived_at is not null then 'ARCHIVED'
    when old.archived_at is not null and new.archived_at is null then 'RESTORED'
    else 'UPDATED'
  end;
  v_reason := coalesce(nullif(trim(new.last_change_reason), ''), 'Expense updated');

  insert into public.expense_audit_events (
    expense_id,
    action_type,
    previous_data,
    new_data,
    changed_by,
    reason_for_change
  ) values (
    new.id,
    v_action,
    to_jsonb(old) - 'last_change_reason',
    to_jsonb(new) - 'last_change_reason',
    coalesce((select auth.uid()), new.updated_by),
    v_reason
  );
  return new;
end;
$function$;

create trigger expense_write_audit
after insert or update on public.expenses
for each row execute function private.expense_write_audit();

create or replace function private.expense_attachment_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row public.expense_attachments%rowtype;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  insert into public.expense_audit_events (
    expense_id,
    action_type,
    previous_data,
    new_data,
    changed_by,
    reason_for_change
  ) values (
    v_row.expense_id,
    case
      when tg_op = 'INSERT' then 'DOCUMENT_ADDED'
      when tg_op = 'DELETE' then 'DOCUMENT_REMOVED'
      else 'DOCUMENT_UPDATED'
    end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    coalesce((select auth.uid()), v_row.uploaded_by),
    case
      when tg_op = 'INSERT' then 'Supporting document added'
      when tg_op = 'DELETE' then 'Supporting document removed'
      else 'Supporting document updated'
    end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

create trigger expense_attachment_write_audit
after insert or update or delete on public.expense_attachments
for each row execute function private.expense_attachment_audit();

-- Seed configurable system categories.
insert into public.expense_categories (name, description, sort_order)
values
  ('Software and subscriptions', 'Software licences and recurring subscriptions.', 10),
  ('Hosting and domains', 'Web hosting, cloud services and domain registrations.', 20),
  ('Computer equipment', 'Computers, peripherals and related equipment.', 30),
  ('Office equipment', 'General office equipment and supplies.', 40),
  ('Phone and internet', 'Phone, mobile and internet services.', 50),
  ('Professional services', 'Accounting, legal, consulting and other professional services.', 60),
  ('Advertising and marketing', 'Advertising, promotion and marketing costs.', 70),
  ('Travel', 'Eligible work-related travel costs.', 80),
  ('Training and education', 'Courses, training and professional learning.', 90),
  ('Insurance', 'Business-related insurance.', 100),
  ('Banking and transaction fees', 'Bank, merchant and transaction fees.', 110),
  ('Club or sporting costs', 'Sporting club and related operational costs.', 120),
  ('Other business expense', 'Business expenses not covered by another category.', 130),
  ('Personal or non-deductible', 'Personal or non-deductible expenditure.', 140),
  ('Review required', 'Temporary category for records requiring classification.', 150)
on conflict do nothing;

-- Seed the initial private prototype access grant for Aaron's confirmed Dev
-- account. The INSERT is harmless in environments where that account is absent.
insert into public.expense_hub_access (
  user_id,
  access_level,
  granted_by
)
select auth_user.id, 'OWNER', auth_user.id
from auth.users auth_user
join public.profiles profile on profile.id = auth_user.id
where lower(auth_user.email) = 'admin@sportstackapp.com.au'
on conflict do nothing;

-- Private document bucket. Files are stored as
-- <expense UUID>/<attachment UUID>/<safe filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-documents',
  'expense-documents',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.expense_hub_access enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expense_suppliers enable row level security;
alter table public.expense_supplier_aliases enable row level security;
alter table public.expense_payment_methods enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_attachments enable row level security;
alter table public.expense_audit_events enable row level security;
alter table public.expense_export_batches enable row level security;
alter table public.expense_export_items enable row level security;

create policy expense_hub_access_select
on public.expense_hub_access for select to authenticated
using (user_id = (select auth.uid()));

create policy expense_categories_select
on public.expense_categories for select to authenticated
using (
  owner_user_id is null
  or public.expense_scope_allows(owner_user_id, association_id, club_id)
);

create policy expense_categories_insert
on public.expense_categories for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and public.expense_scope_allows(owner_user_id, association_id, club_id)
);

create policy expense_categories_update
on public.expense_categories for update to authenticated
using (
  owner_user_id = (select auth.uid())
  and public.expense_scope_allows(owner_user_id, association_id, club_id)
)
with check (
  owner_user_id = (select auth.uid())
  and public.expense_scope_allows(owner_user_id, association_id, club_id)
);

create policy expense_suppliers_select
on public.expense_suppliers for select to authenticated
using (public.expense_scope_allows(owner_user_id, association_id, club_id));

create policy expense_suppliers_insert
on public.expense_suppliers for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and public.expense_scope_allows(owner_user_id, association_id, club_id)
);

create policy expense_suppliers_update
on public.expense_suppliers for update to authenticated
using (public.expense_scope_allows(owner_user_id, association_id, club_id))
with check (
  owner_user_id = (select auth.uid())
  and public.expense_scope_allows(owner_user_id, association_id, club_id)
);

create policy expense_supplier_aliases_select
on public.expense_supplier_aliases for select to authenticated
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

create policy expense_supplier_aliases_insert
on public.expense_supplier_aliases for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.expense_suppliers supplier
    where supplier.id = supplier_id
      and supplier.owner_user_id = (select auth.uid())
      and public.expense_scope_allows(
        supplier.owner_user_id,
        supplier.association_id,
        supplier.club_id
      )
  )
);

create policy expense_supplier_aliases_delete
on public.expense_supplier_aliases for delete to authenticated
using (
  exists (
    select 1
    from public.expense_suppliers supplier
    where supplier.id = supplier_id
      and supplier.owner_user_id = (select auth.uid())
      and public.expense_scope_allows(
        supplier.owner_user_id,
        supplier.association_id,
        supplier.club_id
      )
  )
);

create policy expense_payment_methods_select
on public.expense_payment_methods for select to authenticated
using (public.expense_scope_allows(owner_user_id, association_id, club_id));

create policy expense_payment_methods_insert
on public.expense_payment_methods for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and public.expense_scope_allows(owner_user_id, association_id, club_id)
);

create policy expense_payment_methods_update
on public.expense_payment_methods for update to authenticated
using (public.expense_scope_allows(owner_user_id, association_id, club_id))
with check (
  owner_user_id = (select auth.uid())
  and public.expense_scope_allows(owner_user_id, association_id, club_id)
);

create policy expenses_select
on public.expenses for select to authenticated
using (public.expense_scope_allows(owner_user_id, association_id, club_id));

create policy expenses_insert
on public.expenses for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and public.expense_scope_allows(owner_user_id, association_id, club_id)
);

create policy expenses_update
on public.expenses for update to authenticated
using (public.expense_scope_allows(owner_user_id, association_id, club_id))
with check (
  owner_user_id = (select auth.uid())
  and public.expense_scope_allows(owner_user_id, association_id, club_id)
);

create policy expense_attachments_select
on public.expense_attachments for select to authenticated
using (public.expense_record_access(expense_id));

create policy expense_attachments_insert
on public.expense_attachments for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and uploaded_by = (select auth.uid())
  and public.expense_record_access(expense_id)
);

create policy expense_attachments_update
on public.expense_attachments for update to authenticated
using (public.expense_record_access(expense_id))
with check (
  owner_user_id = (select auth.uid())
  and public.expense_record_access(expense_id)
);

create policy expense_attachments_delete
on public.expense_attachments for delete to authenticated
using (public.expense_record_access(expense_id));

create policy expense_audit_events_select
on public.expense_audit_events for select to authenticated
using (public.expense_record_access(expense_id));

create policy expense_export_batches_select
on public.expense_export_batches for select to authenticated
using (public.expense_scope_allows(owner_user_id, association_id, club_id));

create policy expense_export_batches_insert
on public.expense_export_batches for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and created_by = (select auth.uid())
  and public.expense_scope_allows(owner_user_id, association_id, club_id)
);

create policy expense_export_items_select
on public.expense_export_items for select to authenticated
using (
  public.expense_record_access(expense_id)
  and exists (
    select 1
    from public.expense_export_batches batch
    where batch.id = export_batch_id
      and public.expense_scope_allows(
        batch.owner_user_id,
        batch.association_id,
        batch.club_id
      )
  )
);

create policy expense_export_items_insert
on public.expense_export_items for insert to authenticated
with check (
  public.expense_record_access(expense_id)
  and exists (
    select 1
    from public.expense_export_batches batch
    where batch.id = export_batch_id
      and batch.created_by = (select auth.uid())
      and public.expense_scope_allows(
        batch.owner_user_id,
        batch.association_id,
        batch.club_id
      )
  )
);

create policy expense_documents_select
on storage.objects for select to authenticated
using (
  bucket_id = 'expense-documents'
  and public.expense_storage_can_access(name)
);

create policy expense_documents_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'expense-documents'
  and public.expense_storage_can_access(name)
);

create policy expense_documents_update
on storage.objects for update to authenticated
using (
  bucket_id = 'expense-documents'
  and public.expense_storage_can_access(name)
)
with check (
  bucket_id = 'expense-documents'
  and public.expense_storage_can_access(name)
);

create policy expense_documents_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'expense-documents'
  and public.expense_storage_can_access(name)
);

revoke all on table
  public.expense_hub_access,
  public.expense_categories,
  public.expense_suppliers,
  public.expense_supplier_aliases,
  public.expense_payment_methods,
  public.expenses,
  public.expense_attachments,
  public.expense_audit_events,
  public.expense_export_batches,
  public.expense_export_items
from public, anon, authenticated;

grant select on table public.expense_hub_access to authenticated;
grant select, insert, update on table public.expense_categories to authenticated;
grant select, insert, update on table public.expense_suppliers to authenticated;
grant select, insert, delete on table public.expense_supplier_aliases to authenticated;
grant select, insert, update on table public.expense_payment_methods to authenticated;
grant select, insert, update on table public.expenses to authenticated;
grant select, insert, update, delete on table public.expense_attachments to authenticated;
grant select on table public.expense_audit_events to authenticated;
grant select, insert on table public.expense_export_batches to authenticated;
grant select, insert on table public.expense_export_items to authenticated;

grant all on table
  public.expense_hub_access,
  public.expense_categories,
  public.expense_suppliers,
  public.expense_supplier_aliases,
  public.expense_payment_methods,
  public.expenses,
  public.expense_attachments,
  public.expense_audit_events,
  public.expense_export_batches,
  public.expense_export_items
to service_role;

comment on table public.expense_hub_access is
  'Explicit membership and finance grants for the private Expense Hub.';
comment on table public.expenses is
  'Manual Expense Hub records with database-generated business, personal and GST amounts.';
comment on table public.expense_audit_events is
  'Append-only Expense Hub record and attachment history.';
comment on table public.expense_export_batches is
  'Tracked Excel and PDF exports, including the exact filters and totals used.';
comment on table public.expense_export_items is
  'Immutable expense snapshots included in each tracked export.';
comment on table public.expense_attachments is
  'Private invoices, receipts and supporting-document metadata for expense-documents Storage.';

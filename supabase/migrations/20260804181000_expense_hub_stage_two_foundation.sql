-- Expense Hub Stage 2 foundation: bank statement review and AI evidence extraction.

create table public.expense_statement_imports (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id),
  ownership_type text not null default 'PERSONAL' check (ownership_type in ('PERSONAL', 'ASSOCIATION', 'CLUB')),
  association_id uuid references public.associations(id),
  club_id uuid references public.clubs(id),
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  file_hash text not null check (file_hash ~ '^[a-f0-9]{64}$'),
  bank_name text,
  account_hint text,
  status text not null default 'UPLOADED' check (status in ('UPLOADED', 'PARSED', 'NEEDS_REVIEW', 'COMPLETED', 'FAILED')),
  row_count integer not null default 0 check (row_count >= 0),
  error_message text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  check (
    (ownership_type = 'PERSONAL' and association_id is null and club_id is null)
    or (ownership_type = 'ASSOCIATION' and association_id is not null and club_id is null)
    or (ownership_type = 'CLUB' and association_id is not null and club_id is not null)
  )
);

create table public.expense_statement_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.expense_statement_imports(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id),
  line_number integer not null check (line_number > 0),
  transaction_date date not null,
  description text not null check (length(trim(description)) between 1 and 500),
  reference text,
  amount numeric(14,2) not null,
  balance numeric(14,2),
  currency_code text not null default 'AUD' check (currency_code ~ '^[A-Z]{3}$'),
  raw_data jsonb not null default '{}'::jsonb,
  decision text not null default 'PENDING' check (decision in ('PENDING', 'BUSINESS', 'PERSONAL', 'NOT_RELEVANT')),
  business_use_percentage numeric(5,2) not null default 100 check (business_use_percentage between 0 and 100),
  supplier_id uuid references public.expense_suppliers(id),
  category_id uuid references public.expense_categories(id),
  payment_method_id uuid references public.expense_payment_methods(id),
  expense_id uuid references public.expenses(id),
  evidence_status text not null default 'MISSING' check (evidence_status in ('MISSING', 'ATTACHED', 'VERIFIED', 'MISMATCH')),
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_id, line_number)
);

create table public.expense_ai_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.expense_attachments(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  statement_line_id uuid references public.expense_statement_lines(id) on delete set null,
  status text not null default 'UPLOADED' check (status in ('UPLOADED', 'PROCESSING', 'READY_FOR_REVIEW', 'PROCESSING_FAILED', 'APPROVED', 'CANCELLED')),
  provider text not null check (provider in ('OPENAI', 'ANTHROPIC')),
  model text not null,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(12,6),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id)
);

create table public.expense_ai_extraction_results (
  id uuid primary key default gen_random_uuid(),
  processing_job_id uuid not null unique references public.expense_ai_processing_jobs(id) on delete cascade,
  raw_result jsonb,
  validated_result jsonb not null,
  overall_confidence numeric(4,3) check (overall_confidence between 0 and 1),
  retained_until timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

create table public.expense_ai_field_suggestions (
  id uuid primary key default gen_random_uuid(),
  processing_job_id uuid not null references public.expense_ai_processing_jobs(id) on delete cascade,
  field_name text not null,
  suggested_value jsonb not null,
  confidence_score numeric(4,3) check (confidence_score between 0 and 1),
  suggestion_source text not null check (suggestion_source in ('DOCUMENT', 'SUPPLIER_DEFAULT', 'HISTORY', 'USER')),
  approved_value jsonb,
  was_changed boolean,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (processing_job_id, field_name)
);

create index expense_statement_imports_scope_idx on public.expense_statement_imports(owner_user_id, association_id, club_id, created_at desc);
create unique index expense_statement_imports_owner_hash_idx on public.expense_statement_imports(owner_user_id, file_hash);
create index expense_statement_lines_import_idx on public.expense_statement_lines(import_id, line_number);
create index expense_statement_lines_review_idx on public.expense_statement_lines(owner_user_id, decision, transaction_date desc);
create index expense_statement_lines_match_idx on public.expense_statement_lines(transaction_date, amount);
create index expense_ai_jobs_expense_idx on public.expense_ai_processing_jobs(expense_id, created_at desc);
create index expense_ai_jobs_line_idx on public.expense_ai_processing_jobs(statement_line_id) where statement_line_id is not null;
create index expense_ai_suggestions_job_idx on public.expense_ai_field_suggestions(processing_job_id);

alter table public.expense_statement_imports enable row level security;
alter table public.expense_statement_lines enable row level security;
alter table public.expense_ai_processing_jobs enable row level security;
alter table public.expense_ai_extraction_results enable row level security;
alter table public.expense_ai_field_suggestions enable row level security;

create policy expense_statement_imports_select on public.expense_statement_imports for select to authenticated
using (public.expense_scope_allows(owner_user_id, association_id, club_id));
create policy expense_statement_imports_insert on public.expense_statement_imports for insert to authenticated
with check (owner_user_id = (select auth.uid()) and created_by = (select auth.uid()) and updated_by = (select auth.uid()) and public.expense_scope_allows(owner_user_id, association_id, club_id));
create policy expense_statement_imports_update on public.expense_statement_imports for update to authenticated
using (public.expense_scope_allows(owner_user_id, association_id, club_id))
with check (public.expense_scope_allows(owner_user_id, association_id, club_id));

create policy expense_statement_lines_select on public.expense_statement_lines for select to authenticated
using (exists (select 1 from public.expense_statement_imports i where i.id = import_id and public.expense_scope_allows(i.owner_user_id, i.association_id, i.club_id)));
create policy expense_statement_lines_insert on public.expense_statement_lines for insert to authenticated
with check (owner_user_id = (select auth.uid()) and exists (select 1 from public.expense_statement_imports i where i.id = import_id and i.owner_user_id = owner_user_id and public.expense_scope_allows(i.owner_user_id, i.association_id, i.club_id)));
create policy expense_statement_lines_update on public.expense_statement_lines for update to authenticated
using (exists (select 1 from public.expense_statement_imports i where i.id = import_id and public.expense_scope_allows(i.owner_user_id, i.association_id, i.club_id)))
with check (exists (select 1 from public.expense_statement_imports i where i.id = import_id and i.owner_user_id = owner_user_id and public.expense_scope_allows(i.owner_user_id, i.association_id, i.club_id)));

create policy expense_ai_jobs_select on public.expense_ai_processing_jobs for select to authenticated using (public.expense_record_access(expense_id));
create policy expense_ai_jobs_insert on public.expense_ai_processing_jobs for insert to authenticated with check (created_by = (select auth.uid()) and public.expense_record_access(expense_id));
create policy expense_ai_jobs_update on public.expense_ai_processing_jobs for update to authenticated using (public.expense_record_access(expense_id)) with check (public.expense_record_access(expense_id));
create policy expense_ai_results_select on public.expense_ai_extraction_results for select to authenticated using (exists (select 1 from public.expense_ai_processing_jobs j where j.id = processing_job_id and public.expense_record_access(j.expense_id)));
create policy expense_ai_suggestions_select on public.expense_ai_field_suggestions for select to authenticated using (exists (select 1 from public.expense_ai_processing_jobs j where j.id = processing_job_id and public.expense_record_access(j.expense_id)));
create policy expense_ai_suggestions_update on public.expense_ai_field_suggestions for update to authenticated using (exists (select 1 from public.expense_ai_processing_jobs j where j.id = processing_job_id and public.expense_record_access(j.expense_id))) with check (exists (select 1 from public.expense_ai_processing_jobs j where j.id = processing_job_id and public.expense_record_access(j.expense_id)));

grant select, insert, update on public.expense_statement_imports, public.expense_statement_lines, public.expense_ai_processing_jobs to authenticated;
grant select on public.expense_ai_extraction_results to authenticated;
grant select, update on public.expense_ai_field_suggestions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-imports', 'expense-imports', false, 20971520, array['text/csv','application/csv','application/vnd.ms-excel','application/x-ofx','application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.expense_import_storage_can_access(object_name text)
returns boolean language sql stable security invoker set search_path = '' as $function$
  select exists (
    select 1 from public.expense_statement_imports i
    where i.id::text = (storage.foldername(object_name))[1]
      and public.expense_scope_allows(i.owner_user_id, i.association_id, i.club_id)
  );
$function$;
revoke all on function public.expense_import_storage_can_access(text) from public, anon;
grant execute on function public.expense_import_storage_can_access(text) to authenticated;

create policy expense_imports_storage_select on storage.objects for select to authenticated
using (bucket_id = 'expense-imports' and public.expense_import_storage_can_access(name));
create policy expense_imports_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'expense-imports' and public.expense_import_storage_can_access(name));
create policy expense_imports_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'expense-imports' and public.expense_import_storage_can_access(name));

comment on table public.expense_statement_lines is 'Imported bank statement transactions awaiting relevance, business-use and evidence review.';
comment on table public.expense_ai_extraction_results is 'Restricted AI extraction output retained for 30 days by default.';

-- Complete Expense Hub Stage 2 provider usage, statement processing and approval tracking.

alter table public.expense_statement_imports
  drop constraint expense_statement_imports_status_check,
  add constraint expense_statement_imports_status_check
    check (status in ('UPLOADED', 'PROCESSING', 'PARSED', 'NEEDS_REVIEW', 'COMPLETED', 'FAILED')),
  add column provider text check (provider in ('OPENAI', 'ANTHROPIC')),
  add column model text,
  add column processing_started_at timestamptz,
  add column processing_completed_at timestamptz,
  add column input_tokens integer check (input_tokens is null or input_tokens >= 0),
  add column output_tokens integer check (output_tokens is null or output_tokens >= 0),
  add column estimated_cost_usd numeric(12,6) check (estimated_cost_usd is null or estimated_cost_usd >= 0);

alter table public.expense_ai_processing_jobs
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles(id),
  add constraint expense_ai_job_tokens_nonnegative check (
    (input_tokens is null or input_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
    and (estimated_cost_usd is null or estimated_cost_usd >= 0)
  );

create index expense_ai_jobs_activity_idx
  on public.expense_ai_processing_jobs(created_at desc, provider, status);

create index expense_statement_imports_activity_idx
  on public.expense_statement_imports(created_at desc, provider, status);

comment on column public.expense_statement_imports.estimated_cost_usd is
  'Estimated provider cost using the model rates configured in the statement extraction function.';
comment on column public.expense_ai_processing_jobs.estimated_cost_usd is
  'Estimated provider cost using the model rates configured in the document extraction function.';

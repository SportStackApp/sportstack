-- Limit repeated AI scans of the same PDF bank statement.

alter table public.expense_statement_imports
  add column attempt_count integer not null default 0
    check (attempt_count between 0 and 5);

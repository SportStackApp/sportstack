-- Player Explorer saved searches and recurring run history.
-- Search evaluation remains application-side; this migration stores protected
-- definitions/results and atomically claims due work for the existing scheduler.

create table public.player_explorer_saved_searches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  filter_expression jsonb not null default '{"logic":"and","groups":[],"sequences":[]}'::jsonb,
  schedule_frequency text not null default 'MANUAL',
  schedule_enabled boolean not null default false,
  delivery_in_app boolean not null default true,
  delivery_email boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_explorer_saved_searches_name_check
    check (char_length(btrim(name)) between 1 and 100),
  constraint player_explorer_saved_searches_expression_check
    check (jsonb_typeof(filter_expression) = 'object' and octet_length(filter_expression::text) <= 100000),
  constraint player_explorer_saved_searches_frequency_check
    check (schedule_frequency in ('MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY')),
  constraint player_explorer_saved_searches_schedule_check
    check (not schedule_enabled or schedule_frequency <> 'MANUAL'),
  constraint player_explorer_saved_searches_delivery_check
    check (not schedule_enabled or delivery_in_app or delivery_email)
);

create table public.player_explorer_search_runs (
  id uuid primary key default gen_random_uuid(),
  saved_search_id uuid not null references public.player_explorer_saved_searches(id) on delete cascade,
  status text not null default 'RUNNING',
  matched_player_count integer not null default 0,
  result_summary jsonb not null default '{"players":[],"truncated":false}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  in_app_notified_at timestamptz,
  email_notified_at timestamptz,
  constraint player_explorer_search_runs_status_check
    check (status in ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED')),
  constraint player_explorer_search_runs_count_check
    check (matched_player_count >= 0),
  constraint player_explorer_search_runs_summary_check
    check (jsonb_typeof(result_summary) = 'object')
);

create index player_explorer_saved_searches_owner_idx
  on public.player_explorer_saved_searches(owner_id, updated_at desc);
create index player_explorer_saved_searches_due_idx
  on public.player_explorer_saved_searches(next_run_at)
  where schedule_enabled and next_run_at is not null;
create index player_explorer_search_runs_saved_idx
  on public.player_explorer_search_runs(saved_search_id, started_at desc);

alter table public.player_explorer_saved_searches enable row level security;
alter table public.player_explorer_search_runs enable row level security;

create policy "Super Admins manage their Player Explorer searches"
on public.player_explorer_saved_searches
for all
to authenticated
using (
  owner_id = (select auth.uid())
  and (select public.is_super_admin())
)
with check (
  owner_id = (select auth.uid())
  and (select public.is_super_admin())
);

create policy "Super Admins read their Player Explorer runs"
on public.player_explorer_search_runs
for select
to authenticated
using (
  (select public.is_super_admin())
  and exists (
    select 1
    from public.player_explorer_saved_searches saved
    where saved.id = player_explorer_search_runs.saved_search_id
      and saved.owner_id = (select auth.uid())
  )
);

create or replace function private.prepare_player_explorer_schedule()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.name := btrim(new.name);
  new.updated_at := now();

  if not new.schedule_enabled or new.schedule_frequency = 'MANUAL' then
    new.next_run_at := null;
  elsif tg_op = 'INSERT'
     or old.schedule_enabled is distinct from new.schedule_enabled
     or old.schedule_frequency is distinct from new.schedule_frequency
     or new.next_run_at is null then
    new.next_run_at := case new.schedule_frequency
      when 'DAILY' then now() + interval '1 day'
      when 'WEEKLY' then now() + interval '7 days'
      when 'MONTHLY' then now() + interval '1 month'
    end;
  end if;

  return new;
end;
$$;

create trigger player_explorer_saved_searches_prepare_schedule
before insert or update on public.player_explorer_saved_searches
for each row execute function private.prepare_player_explorer_schedule();

create or replace function public.claim_due_player_explorer_searches(p_limit integer default 5)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  filter_expression jsonb,
  delivery_in_app boolean,
  delivery_email boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if session_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  return query
  with candidates as (
    select saved.id
    from public.player_explorer_saved_searches saved
    where saved.schedule_enabled
      and saved.schedule_frequency <> 'MANUAL'
      and saved.next_run_at <= now()
    order by saved.next_run_at, saved.created_at
    limit least(greatest(p_limit, 1), 20)
    for update skip locked
  ), claimed as (
    update public.player_explorer_saved_searches saved
    set last_run_at = now(),
        next_run_at = case saved.schedule_frequency
          when 'DAILY' then now() + interval '1 day'
          when 'WEEKLY' then now() + interval '7 days'
          when 'MONTHLY' then now() + interval '1 month'
        end,
        updated_at = now()
    from candidates
    where saved.id = candidates.id
    returning saved.*
  )
  select claimed.id, claimed.owner_id, claimed.name, claimed.filter_expression,
         claimed.delivery_in_app, claimed.delivery_email
  from claimed;
end;
$$;

revoke all on table public.player_explorer_saved_searches from public, anon;
revoke all on table public.player_explorer_search_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.player_explorer_saved_searches to authenticated;
grant select, insert, update, delete on table public.player_explorer_saved_searches to service_role;
grant select on table public.player_explorer_search_runs to authenticated;
grant select, insert, update, delete on table public.player_explorer_search_runs to service_role;

revoke all on function private.prepare_player_explorer_schedule() from public, anon, authenticated;
revoke all on function public.claim_due_player_explorer_searches(integer) from public, anon, authenticated;
grant execute on function public.claim_due_player_explorer_searches(integer) to service_role;

comment on table public.player_explorer_saved_searches is
  'Super Admin-owned Player Explorer filter definitions and recurring delivery settings.';
comment on table public.player_explorer_search_runs is
  'Protected summaries from recurring Player Explorer executions.';
comment on function public.claim_due_player_explorer_searches(integer) is
  'Service-role-only atomic claim used by the existing SportStack notification scheduler.';

notify pgrst, 'reload schema';

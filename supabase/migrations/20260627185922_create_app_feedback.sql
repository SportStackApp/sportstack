create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(trim(message)) between 1 and 1000),
  page_path text,
  user_agent text,
  status text not null default 'OPEN' check (status in ('OPEN', 'REVIEWED', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_feedback enable row level security;

grant select, insert, update on public.app_feedback to authenticated;

create policy "Users can create their own feedback"
on public.app_feedback
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can view their own feedback"
on public.app_feedback
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Admins can view feedback"
on public.app_feedback
for select
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
  )
);

create policy "Admins can update feedback status"
on public.app_feedback
for update
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
  )
);

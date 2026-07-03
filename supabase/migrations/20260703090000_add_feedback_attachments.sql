create table if not exists public.app_feedback_attachments (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.app_feedback(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text,
  content_type text,
  file_size integer,
  created_at timestamptz not null default now()
);

create index if not exists app_feedback_attachments_feedback_id_idx
on public.app_feedback_attachments(feedback_id);

alter table public.app_feedback_attachments enable row level security;

grant select, insert on public.app_feedback_attachments to authenticated;

drop policy if exists "Users can create their own feedback attachments" on public.app_feedback_attachments;
create policy "Users can create their own feedback attachments"
on public.app_feedback_attachments
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.app_feedback af
    where af.id = feedback_id
      and af.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can view their own feedback attachments" on public.app_feedback_attachments;
create policy "Users can view their own feedback attachments"
on public.app_feedback_attachments
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Admins can view feedback attachments" on public.app_feedback_attachments;
create policy "Admins can view feedback attachments"
on public.app_feedback_attachments
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

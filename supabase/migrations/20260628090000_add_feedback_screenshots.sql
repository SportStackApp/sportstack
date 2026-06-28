alter table public.app_feedback
  add column if not exists screenshot_path text;

insert into storage.buckets (id, name, public)
values ('feedback-screenshots', 'feedback-screenshots', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can upload feedback screenshots" on storage.objects;
create policy "Users can upload feedback screenshots"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'feedback-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can view their own feedback screenshots" on storage.objects;
create policy "Users can view their own feedback screenshots"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'feedback-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Admins can view feedback screenshots" on storage.objects;
create policy "Admins can view feedback screenshots"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'feedback-screenshots'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
    )
  )
);

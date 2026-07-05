-- MVP voting email reminders.
-- Local migration only until applied to live Supabase.
--
-- Required Edge Function secrets before enabling live sends:
-- - RESEND_API_KEY
-- - MVP_REMINDER_FROM_EMAIL, for example SportStack <votes@sportstackapp.com>
-- - SPORTSTACK_APP_URL, for example https://sportstackapp.com
-- - SPORTSTACK_CRON_SECRET
--
-- Required Supabase Vault secret before the cron job can call the function:
-- select vault.create_secret('same-secret-value', 'mvp_reminder_cron_secret');

create table if not exists public.mvp_voting_email_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mvp_voting_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('opened', 'three_day_reminder', 'one_day_reminder', 'manual_resend')),
  email text,
  status text not null check (status in ('sending', 'sent', 'skipped', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists mvp_voting_email_events_session_idx
  on public.mvp_voting_email_events (session_id, event_type, created_at desc);

create index if not exists mvp_voting_email_events_profile_idx
  on public.mvp_voting_email_events (profile_id, created_at desc);

create unique index if not exists mvp_voting_email_events_once_per_scheduled_event_idx
  on public.mvp_voting_email_events (session_id, profile_id, event_type)
  where status in ('sending', 'sent') and event_type <> 'manual_resend';

alter table public.mvp_voting_email_events enable row level security;

drop policy if exists "Super and association admins can view MVP email events" on public.mvp_voting_email_events;
create policy "Super and association admins can view MVP email events"
on public.mvp_voting_email_events
for select
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role::text = 'ASSOCIATION_ADMIN'
  )
);

-- Writes happen from the Edge Function using the service role.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists supabase_vault with schema vault;

do $$
begin
  perform cron.unschedule('mvp-voting-email-reminders');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'mvp-voting-email-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://svierarfcolhcfjpmwck.functions.supabase.co/mvp-voting-email-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sportstack-cron-secret', coalesce((
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'mvp_reminder_cron_secret'
        limit 1
      ), '')
    ),
    body := jsonb_build_object('action', 'scheduled'),
    timeout_milliseconds := 30000
  );
  $$
);

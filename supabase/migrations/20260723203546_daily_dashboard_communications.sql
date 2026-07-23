-- Daily dashboard, availability reminders and scoped communications foundation.
-- Additive only. The live Dev dry-run found 1,235 ACTIVE memberships to backfill.
-- Production must not receive this migration until separately approved.

create schema if not exists private;

alter table public.team_memberships
  add column if not exists activated_at timestamptz;

update public.team_memberships
set activated_at = coalesce(created_at, now())
where status = 'ACTIVE'
  and activated_at is null;

create or replace function private.set_team_membership_activation_date()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'ACTIVE' then
    new.activated_at := coalesce(new.activated_at, now());
  elsif tg_op = 'UPDATE' and new.status = 'ACTIVE'
        and (old.status is distinct from 'ACTIVE' or new.activated_at is null) then
    new.activated_at := coalesce(new.activated_at, now());
  elsif new.status is distinct from 'ACTIVE' then
    new.activated_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_team_membership_activation_date on public.team_memberships;
create trigger set_team_membership_activation_date
before insert or update on public.team_memberships
for each row execute function private.set_team_membership_activation_date();

revoke all on function private.set_team_membership_activation_date() from public, anon, authenticated;

create table public.communication_channels (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('TEAM', 'CLUB', 'ASSOCIATION')),
  team_id uuid references public.teams(id),
  club_id uuid references public.clubs(id),
  association_id uuid references public.associations(id),
  created_at timestamptz not null default now(),
  check (
    (scope_type = 'TEAM' and team_id is not null and club_id is null and association_id is null)
    or (scope_type = 'CLUB' and team_id is null and club_id is not null and association_id is null)
    or (scope_type = 'ASSOCIATION' and team_id is null and club_id is null and association_id is not null)
  )
);

create unique index communication_channels_team_unique
  on public.communication_channels(team_id) where team_id is not null;
create unique index communication_channels_club_unique
  on public.communication_channels(club_id) where club_id is not null;
create unique index communication_channels_association_unique
  on public.communication_channels(association_id) where association_id is not null;

insert into public.communication_channels(scope_type, team_id)
select 'TEAM', id from public.teams
on conflict do nothing;

insert into public.communication_channels(scope_type, club_id)
select 'CLUB', id from public.clubs
on conflict do nothing;

insert into public.communication_channels(scope_type, association_id)
select 'ASSOCIATION', id from public.associations
on conflict do nothing;

create table public.communication_permissions (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.communication_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  can_publish boolean not null default false,
  can_moderate boolean not null default false,
  granted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel_id, user_id),
  check (can_publish or can_moderate)
);
create index communication_permissions_user_idx
  on public.communication_permissions(user_id, channel_id);

create table public.communication_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.communication_channels(id) on delete cascade,
  message_type text not null check (message_type in ('CHAT', 'BROADCAST')),
  author_id uuid not null references public.profiles(id),
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  reply_to_id uuid references public.communication_messages(id),
  is_important boolean not null default false,
  edited_at timestamptz,
  removed_at timestamptz,
  removed_by uuid references public.profiles(id),
  moderation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((removed_at is null and removed_by is null) or (removed_at is not null and removed_by is not null))
);

create index communication_messages_channel_created_idx
  on public.communication_messages(channel_id, created_at desc);
create index communication_messages_reply_idx
  on public.communication_messages(reply_to_id) where reply_to_id is not null;

create table public.communication_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.communication_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  emoji text not null check (emoji in ('👍', '❤️', '😊', '🎉')),
  created_at timestamptz not null default now(),
  unique(message_id, user_id, emoji)
);
create index communication_reactions_user_idx
  on public.communication_reactions(user_id, message_id);

create table public.communication_mentions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.communication_messages(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(message_id, mentioned_user_id)
);
create index communication_mentions_user_idx
  on public.communication_mentions(mentioned_user_id, created_at desc);

create table public.communication_read_state (
  channel_id uuid not null references public.communication_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  last_read_message_id uuid references public.communication_messages(id),
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(channel_id, user_id)
);
create index communication_read_state_user_idx
  on public.communication_read_state(user_id, channel_id);

create table public.communication_moderation_audit (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.communication_messages(id),
  channel_id uuid not null references public.communication_channels(id),
  actor_id uuid not null references public.profiles(id),
  action text not null check (action in ('EDITED', 'AUTHOR_REMOVED', 'MODERATOR_REMOVED')),
  reason text,
  previous_content text not null,
  replacement_content text,
  created_at timestamptz not null default now()
);
create index communication_moderation_audit_channel_idx
  on public.communication_moderation_audit(channel_id, created_at desc);
create index communication_moderation_audit_actor_idx
  on public.communication_moderation_audit(actor_id, created_at desc);

create table public.notification_category_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('AVAILABILITY_REMINDERS', 'BROADCASTS', 'MENTIONS')),
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(user_id, category)
);

create table public.club_availability_reminder_settings (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  reminder_days integer[] not null default array[7, 3, 1],
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  check (
    cardinality(reminder_days) between 1 and 3
    and 0 < all(reminder_days)
    and 365 >= all(reminder_days)
  )
);

insert into public.club_availability_reminder_settings(club_id)
select id from public.clubs
on conflict do nothing;

create table public.team_availability_reminder_settings (
  team_id uuid primary key references public.teams(id) on delete cascade,
  enabled boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.team_availability_reminder_settings(team_id)
select id from public.teams
on conflict do nothing;

create table public.availability_reminder_dispatches (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_days integer not null check (reminder_days > 0),
  channel text not null check (channel in ('IN_APP', 'EMAIL')),
  due_at timestamptz not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(fixture_id, team_id, user_id, reminder_days, channel)
);

create index availability_reminder_dispatches_due_idx
  on public.availability_reminder_dispatches(status, due_at)
  where status in ('PENDING', 'FAILED', 'SENDING');

create table public.availability_reminder_delivery_log (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.availability_reminder_dispatches(id),
  attempt_number integer not null,
  event_type text not null check (event_type in ('QUEUED', 'CLAIMED', 'SENT', 'FAILED', 'SKIPPED')),
  detail text,
  created_at timestamptz not null default now()
);
create index availability_reminder_delivery_log_dispatch_idx
  on public.availability_reminder_delivery_log(dispatch_id, created_at);

create table public.communication_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.communication_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED')),
  attempts integer not null default 0,
  last_error text,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(message_id, user_id)
);
create index communication_email_deliveries_queue_idx
  on public.communication_email_deliveries(status, created_at)
  where status in ('PENDING', 'FAILED', 'SENDING');
create index communication_email_deliveries_user_idx
  on public.communication_email_deliveries(user_id, created_at desc);

alter table public.notifications
  add column if not exists communication_message_id uuid references public.communication_messages(id),
  add column if not exists fixture_id uuid references public.fixtures(id),
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_unique
  on public.notifications(dedupe_key) where dedupe_key is not null;
create index if not exists notifications_communication_message_idx
  on public.notifications(communication_message_id) where communication_message_id is not null;
create index if not exists notifications_fixture_idx
  on public.notifications(fixture_id) where fixture_id is not null;

create or replace function private.communication_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'SUPER_ADMIN'
  );
$$;

create or replace function private.communication_has_channel_access(
  p_channel_id uuid,
  p_message_created_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.communication_is_super_admin()
  or exists (
    select 1
    from public.communication_channels ch
    where ch.id = p_channel_id
      and (
        (
          ch.scope_type = 'TEAM'
          and (
            exists (
              select 1 from public.team_memberships tm
              where tm.user_id = (select auth.uid())
                and tm.team_id = ch.team_id
                and tm.status = 'ACTIVE'
                and coalesce(tm.activated_at, tm.created_at) <= p_message_created_at
            )
            or exists (
              select 1 from public.user_roles ur
              join public.teams t on t.id = ch.team_id
              join public.clubs c on c.id = t.club_id
              where ur.user_id = (select auth.uid())
                and (
                  (ur.role in ('COACH', 'TEAM_MANAGER') and ur.team_id = ch.team_id)
                  or (ur.role = 'CLUB_ADMIN' and ur.club_id = t.club_id)
                  or (ur.role = 'ASSOCIATION_ADMIN' and ur.association_id = c.association_id)
                )
            )
          )
        )
        or (
          ch.scope_type = 'CLUB'
          and (
            exists (
              select 1 from public.team_memberships tm
              join public.teams t on t.id = tm.team_id
              where tm.user_id = (select auth.uid())
                and tm.status = 'ACTIVE'
                and t.club_id = ch.club_id
            )
            or exists (
              select 1 from public.user_roles ur
              join public.clubs c on c.id = ch.club_id
              where ur.user_id = (select auth.uid())
                and (
                  (ur.role = 'CLUB_ADMIN' and ur.club_id = ch.club_id)
                  or (ur.role = 'ASSOCIATION_ADMIN' and ur.association_id = c.association_id)
                )
            )
          )
        )
        or (
          ch.scope_type = 'ASSOCIATION'
          and (
            exists (
              select 1 from public.team_memberships tm
              join public.teams t on t.id = tm.team_id
              join public.clubs c on c.id = t.club_id
              where tm.user_id = (select auth.uid())
                and tm.status = 'ACTIVE'
                and c.association_id = ch.association_id
            )
            or exists (
              select 1 from public.user_roles ur
              where ur.user_id = (select auth.uid())
                and ur.role = 'ASSOCIATION_ADMIN'
                and ur.association_id = ch.association_id
            )
          )
        )
      )
  );
$$;

create or replace function private.communication_can_administer(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.communication_is_super_admin()
  or exists (
    select 1
    from public.communication_channels ch
    where ch.id = p_channel_id
      and exists (
        select 1
        from public.user_roles ur
        left join public.teams t on t.id = ch.team_id
        left join public.clubs channel_club on channel_club.id = coalesce(ch.club_id, t.club_id)
        where ur.user_id = (select auth.uid())
          and (
            (ur.role = 'ASSOCIATION_ADMIN' and ur.association_id = coalesce(ch.association_id, channel_club.association_id))
            or (ur.role = 'CLUB_ADMIN' and ch.scope_type in ('TEAM', 'CLUB') and ur.club_id = channel_club.id)
          )
      )
  );
$$;

create or replace function private.communication_can_publish(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.communication_can_administer(p_channel_id)
  or exists (
    select 1 from public.communication_permissions cp
    where cp.channel_id = p_channel_id
      and cp.user_id = (select auth.uid())
      and cp.can_publish
  );
$$;

create or replace function private.communication_can_moderate(p_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.communication_can_administer(p_channel_id)
  or exists (
    select 1 from public.communication_permissions cp
    where cp.channel_id = p_channel_id
      and cp.user_id = (select auth.uid())
      and cp.can_moderate
  );
$$;

revoke all on function private.communication_is_super_admin() from public, anon;
revoke all on function private.communication_has_channel_access(uuid, timestamptz) from public, anon;
revoke all on function private.communication_can_administer(uuid) from public, anon;
revoke all on function private.communication_can_publish(uuid) from public, anon;
revoke all on function private.communication_can_moderate(uuid) from public, anon;
grant execute on function private.communication_is_super_admin() to authenticated;
grant execute on function private.communication_has_channel_access(uuid, timestamptz) to authenticated;
grant execute on function private.communication_can_administer(uuid) to authenticated;
grant execute on function private.communication_can_publish(uuid) to authenticated;
grant execute on function private.communication_can_moderate(uuid) to authenticated;

alter table public.communication_channels enable row level security;
alter table public.communication_permissions enable row level security;
alter table public.communication_messages enable row level security;
alter table public.communication_reactions enable row level security;
alter table public.communication_mentions enable row level security;
alter table public.communication_read_state enable row level security;
alter table public.communication_moderation_audit enable row level security;
alter table public.notification_category_preferences enable row level security;
alter table public.club_availability_reminder_settings enable row level security;
alter table public.team_availability_reminder_settings enable row level security;
alter table public.availability_reminder_dispatches enable row level security;
alter table public.availability_reminder_delivery_log enable row level security;
alter table public.communication_email_deliveries enable row level security;

create policy communication_channels_select
on public.communication_channels for select to authenticated
using (private.communication_has_channel_access(id, now()));

create policy communication_channels_insert
on public.communication_channels for insert to authenticated
with check (
  private.communication_is_super_admin()
  or (
    scope_type = 'TEAM'
    and exists (
      select 1 from public.team_memberships tm
      where tm.user_id = (select auth.uid())
        and tm.team_id = communication_channels.team_id
        and tm.status = 'ACTIVE'
    )
  )
  or (
    scope_type = 'CLUB'
    and exists (
      select 1 from public.user_roles ur
      join public.clubs c on c.id = communication_channels.club_id
      where ur.user_id = (select auth.uid())
        and (
          (ur.role = 'CLUB_ADMIN' and ur.club_id = communication_channels.club_id)
          or (ur.role = 'ASSOCIATION_ADMIN' and ur.association_id = c.association_id)
        )
    )
  )
  or (
    scope_type = 'ASSOCIATION'
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role = 'ASSOCIATION_ADMIN'
        and ur.association_id = communication_channels.association_id
    )
  )
);

create policy communication_permissions_select
on public.communication_permissions for select to authenticated
using (user_id = (select auth.uid()) or private.communication_can_administer(channel_id));

create policy communication_permissions_insert
on public.communication_permissions for insert to authenticated
with check (private.communication_can_administer(channel_id) and granted_by = (select auth.uid()));

create policy communication_permissions_update
on public.communication_permissions for update to authenticated
using (private.communication_can_administer(channel_id))
with check (private.communication_can_administer(channel_id));

create policy communication_permissions_delete
on public.communication_permissions for delete to authenticated
using (private.communication_can_administer(channel_id));

create policy communication_messages_select
on public.communication_messages for select to authenticated
using (private.communication_has_channel_access(channel_id, created_at));

create policy communication_messages_insert
on public.communication_messages for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (
    (message_type = 'CHAT' and private.communication_has_channel_access(channel_id, now()))
    or (message_type = 'BROADCAST' and private.communication_can_publish(channel_id))
  )
);

create policy communication_messages_update
on public.communication_messages for update to authenticated
using (author_id = (select auth.uid()) or private.communication_can_moderate(channel_id))
with check (author_id = author_id and (author_id = (select auth.uid()) or private.communication_can_moderate(channel_id)));

create policy communication_reactions_select
on public.communication_reactions for select to authenticated
using (exists (
  select 1 from public.communication_messages m
  where m.id = message_id
    and private.communication_has_channel_access(m.channel_id, m.created_at)
));

create policy communication_reactions_insert
on public.communication_reactions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.communication_messages m
    where m.id = message_id
      and m.removed_at is null
      and private.communication_has_channel_access(m.channel_id, m.created_at)
  )
);

create policy communication_reactions_delete
on public.communication_reactions for delete to authenticated
using (user_id = (select auth.uid()));

create policy communication_mentions_select
on public.communication_mentions for select to authenticated
using (
  mentioned_user_id = (select auth.uid())
  or exists (
    select 1 from public.communication_messages m
    where m.id = message_id
      and (m.author_id = (select auth.uid()) or private.communication_can_moderate(m.channel_id))
  )
);

create policy communication_mentions_insert
on public.communication_mentions for insert to authenticated
with check (exists (
  select 1 from public.communication_messages m
  where m.id = message_id
    and m.author_id = (select auth.uid())
    and m.message_type = 'CHAT'
    and private.communication_has_channel_access(m.channel_id, m.created_at)
));

create policy communication_read_state_select
on public.communication_read_state for select to authenticated
using (user_id = (select auth.uid()));

create policy communication_read_state_insert
on public.communication_read_state for insert to authenticated
with check (user_id = (select auth.uid()) and private.communication_has_channel_access(channel_id, now()));

create policy communication_read_state_update
on public.communication_read_state for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and private.communication_has_channel_access(channel_id, now()));

create policy communication_moderation_audit_select
on public.communication_moderation_audit for select to authenticated
using (private.communication_can_moderate(channel_id));

create policy notification_category_preferences_select
on public.notification_category_preferences for select to authenticated
using (user_id = (select auth.uid()));

create policy notification_category_preferences_insert
on public.notification_category_preferences for insert to authenticated
with check (user_id = (select auth.uid()));

create policy notification_category_preferences_update
on public.notification_category_preferences for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy notification_category_preferences_delete
on public.notification_category_preferences for delete to authenticated
using (user_id = (select auth.uid()));

create policy club_availability_reminder_settings_select
on public.club_availability_reminder_settings for select to authenticated
using (exists (
  select 1 from public.communication_channels ch
  where ch.club_id = club_id and private.communication_has_channel_access(ch.id, now())
));

create policy club_availability_reminder_settings_write
on public.club_availability_reminder_settings for all to authenticated
using (exists (
  select 1 from public.communication_channels ch
  where ch.club_id = club_id and private.communication_can_administer(ch.id)
))
with check (exists (
  select 1 from public.communication_channels ch
  where ch.club_id = club_id and private.communication_can_administer(ch.id)
));

create policy team_availability_reminder_settings_select
on public.team_availability_reminder_settings for select to authenticated
using (exists (
  select 1 from public.communication_channels ch
  where ch.team_id = team_id and private.communication_has_channel_access(ch.id, now())
));

create policy team_availability_reminder_settings_write
on public.team_availability_reminder_settings for all to authenticated
using (exists (
  select 1 from public.communication_channels ch
  where ch.team_id = team_id
    and (private.communication_can_administer(ch.id) or exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.team_id = team_id
        and ur.role in ('COACH', 'TEAM_MANAGER')
    ))
))
with check (exists (
  select 1 from public.communication_channels ch
  where ch.team_id = team_id
    and (private.communication_can_administer(ch.id) or exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.team_id = team_id
        and ur.role in ('COACH', 'TEAM_MANAGER')
    ))
));

create policy availability_reminder_dispatches_admin_select
on public.availability_reminder_dispatches for select to authenticated
using (private.communication_is_super_admin());

create policy availability_reminder_delivery_log_admin_select
on public.availability_reminder_delivery_log for select to authenticated
using (private.communication_is_super_admin());

create policy communication_email_deliveries_admin_select
on public.communication_email_deliveries for select to authenticated
using (exists (
  select 1 from public.communication_messages m
  where m.id = message_id and private.communication_can_administer(m.channel_id)
));

grant select, insert on public.communication_channels to authenticated;
grant select, insert, update, delete on public.communication_permissions to authenticated;
grant select, insert, update on public.communication_messages to authenticated;
grant select, insert, delete on public.communication_reactions to authenticated;
grant select, insert on public.communication_mentions to authenticated;
grant select, insert, update on public.communication_read_state to authenticated;
grant select on public.communication_moderation_audit to authenticated;
grant select, insert, update, delete on public.notification_category_preferences to authenticated;
grant select, insert, update on public.club_availability_reminder_settings to authenticated;
grant select, insert, update on public.team_availability_reminder_settings to authenticated;
grant select on public.availability_reminder_dispatches to authenticated;
grant select on public.availability_reminder_delivery_log to authenticated;
grant select on public.communication_email_deliveries to authenticated;

-- The obsolete team_messages table had unsafe broad policies. Keep it for audit
-- compatibility, but remove all browser access instead of dropping data/history.
do $$
declare policy_record record;
begin
  for policy_record in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'team_messages'
  loop
    execute format('drop policy if exists %I on public.team_messages', policy_record.policyname);
  end loop;
end;
$$;
alter table public.team_messages enable row level security;
revoke all on public.team_messages from anon, authenticated;

create or replace function private.guard_communication_message_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  reply_channel uuid;
  channel_scope text;
  actor uuid := auth.uid();
  action_name text;
begin
  if tg_op = 'INSERT' then
    select scope_type into channel_scope
    from public.communication_channels
    where id = new.channel_id;
    if (new.message_type = 'CHAT' and channel_scope is distinct from 'TEAM')
       or (new.message_type = 'BROADCAST' and channel_scope not in ('CLUB', 'ASSOCIATION')) then
      raise exception 'Message type does not match the communication channel';
    end if;
    if new.message_type = 'CHAT' and new.reply_to_id is not null then
      select channel_id into reply_channel
      from public.communication_messages
      where id = new.reply_to_id and removed_at is null;
      if reply_channel is distinct from new.channel_id then
        raise exception 'Quoted reply must belong to the same channel';
      end if;
    elsif new.message_type = 'BROADCAST' and new.reply_to_id is not null then
      raise exception 'Broadcasts cannot have text replies';
    end if;
    new.content := btrim(new.content);
    return new;
  end if;

  if new.id is distinct from old.id
     or new.channel_id is distinct from old.channel_id
     or new.message_type is distinct from old.message_type
     or new.author_id is distinct from old.author_id
     or new.reply_to_id is distinct from old.reply_to_id
     or new.is_important is distinct from old.is_important
     or new.created_at is distinct from old.created_at then
    raise exception 'Immutable message fields cannot be changed';
  end if;

  if actor = old.author_id then
    if old.removed_at is not null then
      raise exception 'Removed messages cannot be changed';
    end if;
    if new.moderation_reason is distinct from old.moderation_reason then
      raise exception 'Authors cannot add moderation reasons';
    end if;
    if new.content is distinct from old.content then
      if new.removed_at is distinct from old.removed_at
         or new.removed_by is distinct from old.removed_by then
        raise exception 'Edit and removal must be separate actions';
      end if;
      new.content := btrim(new.content);
      new.edited_at := now();
      action_name := 'EDITED';
    elsif new.removed_at is not null and old.removed_at is null then
      new.removed_at := now();
      new.removed_by := actor;
      action_name := 'AUTHOR_REMOVED';
    else
      raise exception 'No permitted message change was supplied';
    end if;
  elsif private.communication_can_moderate(old.channel_id) then
    if new.content is distinct from old.content
       or new.removed_at is null
       or old.removed_at is not null
       or nullif(btrim(new.moderation_reason), '') is null then
      raise exception 'Moderators may only soft-delete content with a reason';
    end if;
    new.removed_at := now();
    new.removed_by := actor;
    action_name := 'MODERATOR_REMOVED';
  else
    raise exception 'Not authorised to change this message';
  end if;

  new.updated_at := now();
  insert into public.communication_moderation_audit(
    message_id, channel_id, actor_id, action, reason, previous_content, replacement_content
  ) values (
    old.id, old.channel_id, actor, action_name, new.moderation_reason, old.content,
    case when action_name = 'EDITED' then new.content else null end
  );
  return new;
end;
$$;

create trigger guard_communication_message_insert
before insert on public.communication_messages
for each row execute function private.guard_communication_message_write();

create trigger guard_communication_message_update
before update on public.communication_messages
for each row execute function private.guard_communication_message_write();

revoke all on function private.guard_communication_message_write() from public, anon, authenticated;

create or replace function private.notify_communication_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  channel_record public.communication_channels%rowtype;
begin
  select * into channel_record from public.communication_channels where id = new.channel_id;

  if new.message_type = 'BROADCAST' then
    with recipients as (
      select distinct tm.user_id
      from public.team_memberships tm
      join auth.users recipient_auth on recipient_auth.id = tm.user_id
      join public.teams t on t.id = tm.team_id
      join public.clubs c on c.id = t.club_id
      where tm.status = 'ACTIVE'
        and (
          (channel_record.scope_type = 'CLUB' and c.id = channel_record.club_id)
          or (channel_record.scope_type = 'ASSOCIATION' and c.association_id = channel_record.association_id)
        )
    )
    insert into public.notifications(
      user_id, title, body, message, type, action_url, communication_message_id, dedupe_key
    )
    select r.user_id,
      case when channel_record.scope_type = 'CLUB' then 'Club update' else 'Association update' end,
      left(new.content, 240), left(new.content, 240), 'COMMUNICATION_BROADCAST',
      '/chat?tab=' || case when channel_record.scope_type = 'CLUB' then 'club' else 'association' end || '&message=' || new.id,
      new.id, 'broadcast:' || new.id || ':' || r.user_id
    from recipients r
    on conflict (dedupe_key) where dedupe_key is not null do nothing;

    insert into public.communication_email_deliveries(message_id, user_id)
    select distinct new.id, tm.user_id
    from public.team_memberships tm
    join auth.users recipient_auth on recipient_auth.id = tm.user_id and recipient_auth.email is not null
    join public.teams t on t.id = tm.team_id
    join public.clubs c on c.id = t.club_id
    left join public.notification_category_preferences pref
      on pref.user_id = tm.user_id and pref.category = 'BROADCASTS'
    where tm.status = 'ACTIVE'
      and coalesce(pref.email_enabled, true)
      and (
        (channel_record.scope_type = 'CLUB' and c.id = channel_record.club_id)
        or (channel_record.scope_type = 'ASSOCIATION' and c.association_id = channel_record.association_id)
      )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger notify_communication_message
after insert on public.communication_messages
for each row execute function private.notify_communication_message();

revoke all on function private.notify_communication_message() from public, anon, authenticated;

create or replace function private.notify_communication_mention()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  source_message public.communication_messages%rowtype;
  source_team_id uuid;
  author_name text;
  allow_in_app boolean;
begin
  select * into source_message from public.communication_messages where id = new.message_id;
  if source_message.author_id = new.mentioned_user_id then
    return new;
  end if;
  select team_id into source_team_id
  from public.communication_channels
  where id = source_message.channel_id and scope_type = 'TEAM';
  if source_team_id is null or not (
    exists (
      select 1 from public.team_memberships tm
      where tm.team_id = source_team_id
        and tm.user_id = new.mentioned_user_id
        and tm.status = 'ACTIVE'
    )
    or exists (
      select 1 from public.user_roles ur
      where ur.team_id = source_team_id
        and ur.user_id = new.mentioned_user_id
        and ur.role in ('COACH', 'TEAM_MANAGER')
    )
  ) then
    raise exception 'Mentioned person is not active in this team';
  end if;
  select concat_ws(' ', first_name, last_name) into author_name
  from public.profiles where id = source_message.author_id;
  select coalesce(in_app_enabled, true) into allow_in_app
  from public.notification_category_preferences
  where user_id = new.mentioned_user_id and category = 'MENTIONS';
  if coalesce(allow_in_app, true) then
    insert into public.notifications(
      user_id, title, body, message, type, action_url, communication_message_id, dedupe_key
    ) values (
      new.mentioned_user_id, 'You were mentioned',
      coalesce(nullif(author_name, ''), 'A team member') || ' mentioned you',
      left(source_message.content, 240), 'COMMUNICATION_MENTION',
      '/chat?tab=team&message=' || source_message.id,
      source_message.id, 'mention:' || source_message.id || ':' || new.mentioned_user_id
    ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end;
$$;

create trigger notify_communication_mention
after insert on public.communication_mentions
for each row execute function private.notify_communication_mention();

revoke all on function private.notify_communication_mention() from public, anon, authenticated;

create or replace function public.claim_sportstack_notification_work(p_limit integer default 50)
returns table (
  work_type text,
  delivery_id uuid,
  recipient_email text,
  recipient_name text,
  subject text,
  body_text text,
  action_url text
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if session_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  with due_work as (
    select distinct
      f.id fixture_id,
      team_fixture.team_id,
      tm.user_id,
      reminder_day,
      channel_name,
      f.fixture_date - make_interval(days => reminder_day) due_at
    from public.fixtures f
    cross join lateral (values (f.home_team_id), (f.away_team_id)) team_fixture(team_id)
    join public.teams t on t.id = team_fixture.team_id
    join public.team_availability_reminder_settings team_setting
      on team_setting.team_id = t.id and team_setting.enabled
    join public.club_availability_reminder_settings club_setting on club_setting.club_id = t.club_id
    cross join lateral unnest(club_setting.reminder_days) reminder_day
    join public.team_memberships tm
      on tm.team_id = t.id and tm.status = 'ACTIVE'
    join auth.users recipient_auth on recipient_auth.id = tm.user_id
    left join public.fixture_availability fa
      on fa.fixture_id = f.id and fa.user_id = tm.user_id
    cross join lateral (values ('IN_APP'::text), ('EMAIL'::text)) channels(channel_name)
    left join public.notification_category_preferences pref
      on pref.user_id = tm.user_id and pref.category = 'AVAILABILITY_REMINDERS'
    where f.status = 'SCHEDULED'
      and f.fixture_date > now()
      and f.fixture_date - make_interval(days => reminder_day) <= now()
      and (fa.id is null or fa.status = 'UNSURE')
      and (
        (channel_name = 'IN_APP' and coalesce(pref.in_app_enabled, true))
        or (channel_name = 'EMAIL' and coalesce(pref.email_enabled, true))
      )
  ), inserted as (
    insert into public.availability_reminder_dispatches(
      fixture_id, team_id, user_id, reminder_days, channel, due_at
    )
    select fixture_id, team_id, user_id, reminder_day, channel_name, due_at
    from due_work
    on conflict do nothing
    returning id, attempts
  )
  insert into public.availability_reminder_delivery_log(dispatch_id, attempt_number, event_type)
  select id, attempts, 'QUEUED' from inserted;

  with sent_in_app as (
    update public.availability_reminder_dispatches d
    set status = 'SENT', attempts = attempts + 1, last_attempt_at = now(),
        completed_at = now(), updated_at = now()
    where d.channel = 'IN_APP' and d.status in ('PENDING', 'FAILED')
      and d.attempts < 4
    returning d.*
  ), notification_rows as (
    insert into public.notifications(
      user_id, title, body, message, type, action_url, fixture_id, team_id, dedupe_key
    )
    select s.user_id, 'Availability needed',
      'Please confirm whether you can play in the upcoming fixture.',
      'Please confirm whether you can play in the upcoming fixture.',
      'AVAILABILITY_REMINDER', '/dashboard?fixture=' || s.fixture_id,
      s.fixture_id, s.team_id, 'availability:' || s.id
    from sent_in_app s
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning dedupe_key
  )
  insert into public.availability_reminder_delivery_log(dispatch_id, attempt_number, event_type)
  select s.id, s.attempts, 'SENT' from sent_in_app s;

  return query
  with candidates as (
    select d.id
    from public.availability_reminder_dispatches d
    where d.channel = 'EMAIL'
      and d.attempts < 4
      and (
        d.status in ('PENDING', 'FAILED')
        or (d.status = 'SENDING' and d.last_attempt_at < now() - interval '30 minutes')
      )
    order by d.due_at, d.created_at
    limit greatest(p_limit, 1)
    for update skip locked
  ), claimed as (
    update public.availability_reminder_dispatches d
    set status = 'SENDING', attempts = attempts + 1, last_attempt_at = now(), updated_at = now()
    from candidates c
    where d.id = c.id
    returning d.*
  ), logged as (
    insert into public.availability_reminder_delivery_log(dispatch_id, attempt_number, event_type)
    select id, attempts, 'CLAIMED' from claimed
    returning dispatch_id
  )
  select 'AVAILABILITY'::text, c.id, u.email::text,
    coalesce(nullif(concat_ws(' ', p.first_name, p.last_name), ''), 'Player')::text,
    'Please confirm your availability'::text,
    ('Your availability is still needed for ' || home.name || ' v ' || coalesce(away.name, 'Bye') ||
      ' on ' || to_char(f.fixture_date at time zone coalesce(a.timezone, 'Australia/Melbourne'), 'DD/MM/YYYY at HH12:MIam'))::text,
    ('/dashboard?fixture=' || f.id)::text
  from claimed c
  join auth.users u on u.id = c.user_id
  join public.profiles p on p.id = c.user_id
  join public.fixtures f on f.id = c.fixture_id
  join public.teams home on home.id = f.home_team_id
  left join public.teams away on away.id = f.away_team_id
  left join public.associations a on a.id = f.association_id
  where u.email is not null;

  return query
  with candidates as (
    select ced.id
    from public.communication_email_deliveries ced
    where ced.attempts < 4
      and (
        ced.status in ('PENDING', 'FAILED')
        or (ced.status = 'SENDING' and ced.last_attempt_at < now() - interval '30 minutes')
      )
    order by ced.created_at
    limit greatest(p_limit, 1)
    for update skip locked
  ), claimed as (
    update public.communication_email_deliveries ced
    set status = 'SENDING', attempts = attempts + 1,
        last_attempt_at = now(), updated_at = now()
    from candidates c
    where ced.id = c.id
    returning ced.*
  )
  select 'BROADCAST'::text, delivery.id, u.email::text,
    coalesce(nullif(concat_ws(' ', p.first_name, p.last_name), ''), 'Member')::text,
    case when ch.scope_type = 'CLUB' then 'New club update' else 'New association update' end,
    left(m.content, 2000)::text,
    ('/chat?tab=' || case when ch.scope_type = 'CLUB' then 'club' else 'association' end || '&message=' || m.id)::text
  from claimed delivery
  join public.communication_messages m on m.id = delivery.message_id
  join public.communication_channels ch on ch.id = m.channel_id
  join auth.users u on u.id = delivery.user_id
  join public.profiles p on p.id = delivery.user_id
  where u.email is not null;
end;
$$;

create or replace function public.complete_sportstack_notification_work(
  p_work_type text,
  p_delivery_id uuid,
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare current_attempt integer;
begin
  if session_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_work_type = 'AVAILABILITY' then
    update public.availability_reminder_dispatches
    set status = case when p_success then 'SENT' else 'FAILED' end,
        last_error = case when p_success then null else left(p_error, 1000) end,
        completed_at = case when p_success then now() else null end,
        updated_at = now()
    where id = p_delivery_id
    returning attempts into current_attempt;
    insert into public.availability_reminder_delivery_log(
      dispatch_id, attempt_number, event_type, detail
    ) values (
      p_delivery_id, current_attempt,
      case when p_success then 'SENT' else 'FAILED' end,
      case when p_success then null else left(p_error, 1000) end
    );
  elsif p_work_type = 'BROADCAST' then
    update public.communication_email_deliveries
    set status = case when p_success then 'SENT' else 'FAILED' end,
        last_error = case when p_success then null else left(p_error, 1000) end,
        completed_at = case when p_success then now() else null end,
        updated_at = now()
    where id = p_delivery_id;
  else
    raise exception 'Unsupported work type';
  end if;
end;
$$;

revoke all on function public.claim_sportstack_notification_work(integer) from public, anon, authenticated;
revoke all on function public.complete_sportstack_notification_work(text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_sportstack_notification_work(integer) to service_role;
grant execute on function public.complete_sportstack_notification_work(text, uuid, boolean, text) to service_role;

-- Store the scheduler credential in Vault. The plaintext value is never placed
-- in source control, migration output or the Edge Function environment.
do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'sportstack-notification-cron-secret'
  ) then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'sportstack-notification-cron-secret',
      'Authenticates the 15-minute SportStack notification cron request'
    );
  end if;
end;
$$;

create or replace function public.verify_sportstack_notification_cron(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, vault
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'sportstack-notification-cron-secret'
      and decrypted_secret = p_secret
  );
$$;

create or replace function public.configure_sportstack_notification_cron(p_project_url text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, cron, net, vault
as $$
declare
  existing_job bigint;
  job_command text;
  normalised_url text := rtrim(p_project_url, '/');
begin
  if session_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if normalised_url !~ '^https://[a-z0-9.-]+$' then
    raise exception 'A valid HTTPS Supabase project URL is required';
  end if;
  select jobid into existing_job
  from cron.job
  where jobname = 'sportstack-notification-dispatch';
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  job_command := format(
    $command$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-sportstack-cron-secret', (
            select decrypted_secret from vault.decrypted_secrets
            where name = 'sportstack-notification-cron-secret'
          )
        ),
        body := '{"source":"pg_cron"}'::jsonb,
        timeout_milliseconds := 10000
      );
    $command$,
    normalised_url || '/functions/v1/sportstack-notification-dispatch'
  );
  perform cron.schedule(
    'sportstack-notification-dispatch',
    '*/15 * * * *',
    job_command
  );
end;
$$;

revoke all on function public.verify_sportstack_notification_cron(text) from public, anon, authenticated;
revoke all on function public.configure_sportstack_notification_cron(text) from public, anon, authenticated;
grant execute on function public.verify_sportstack_notification_cron(text) to service_role;
grant execute on function public.configure_sportstack_notification_cron(text) to service_role;

revoke all on public.availability_reminder_dispatches from anon, authenticated;
revoke all on public.availability_reminder_delivery_log from anon, authenticated;
revoke all on public.communication_email_deliveries from anon;

-- Postgres Changes honours the source-table RLS policies above.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'communication_messages'
  ) then
    alter publication supabase_realtime add table public.communication_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'communication_reactions'
  ) then
    alter publication supabase_realtime add table public.communication_reactions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'communication_read_state'
  ) then
    alter publication supabase_realtime add table public.communication_read_state;
  end if;
end;
$$;

comment on table public.communication_moderation_audit is
  'Administrator-only immutable history of edits and soft-deletions.';
comment on table public.availability_reminder_delivery_log is
  'Append-only delivery attempt history. Browser roles have no write permission.';
comment on column public.team_memberships.activated_at is
  'Start of the member current active period; used to limit team-chat history.';

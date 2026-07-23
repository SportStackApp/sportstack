-- Address performance adviser findings for the daily dashboard communications tables.

create index if not exists communication_messages_author_idx
  on public.communication_messages(author_id, created_at desc);

create index if not exists communication_messages_removed_by_idx
  on public.communication_messages(removed_by)
  where removed_by is not null;

create index if not exists communication_moderation_audit_message_idx
  on public.communication_moderation_audit(message_id);

create index if not exists communication_permissions_granted_by_idx
  on public.communication_permissions(granted_by);

create index if not exists communication_read_state_last_message_idx
  on public.communication_read_state(last_read_message_id)
  where last_read_message_id is not null;

create index if not exists club_availability_reminder_settings_updated_by_idx
  on public.club_availability_reminder_settings(updated_by)
  where updated_by is not null;

create index if not exists team_availability_reminder_settings_updated_by_idx
  on public.team_availability_reminder_settings(updated_by)
  where updated_by is not null;

create index if not exists availability_reminder_dispatches_team_idx
  on public.availability_reminder_dispatches(team_id);

create index if not exists availability_reminder_dispatches_user_idx
  on public.availability_reminder_dispatches(user_id);

-- The original FOR ALL policies also applied to SELECT, creating an avoidable
-- second permissive read policy. Preserve write access with action-specific rules.

drop policy if exists club_availability_reminder_settings_write
  on public.club_availability_reminder_settings;

create policy club_availability_reminder_settings_insert
on public.club_availability_reminder_settings for insert to authenticated
with check (exists (
  select 1 from public.communication_channels ch
  where ch.club_id = club_id and private.communication_can_administer(ch.id)
));

create policy club_availability_reminder_settings_update
on public.club_availability_reminder_settings for update to authenticated
using (exists (
  select 1 from public.communication_channels ch
  where ch.club_id = club_id and private.communication_can_administer(ch.id)
))
with check (exists (
  select 1 from public.communication_channels ch
  where ch.club_id = club_id and private.communication_can_administer(ch.id)
));

create policy club_availability_reminder_settings_delete
on public.club_availability_reminder_settings for delete to authenticated
using (exists (
  select 1 from public.communication_channels ch
  where ch.club_id = club_id and private.communication_can_administer(ch.id)
));

drop policy if exists team_availability_reminder_settings_write
  on public.team_availability_reminder_settings;

create policy team_availability_reminder_settings_insert
on public.team_availability_reminder_settings for insert to authenticated
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

create policy team_availability_reminder_settings_update
on public.team_availability_reminder_settings for update to authenticated
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

create policy team_availability_reminder_settings_delete
on public.team_availability_reminder_settings for delete to authenticated
using (exists (
  select 1 from public.communication_channels ch
  where ch.team_id = team_id
    and (private.communication_can_administer(ch.id) or exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.team_id = team_id
        and ur.role in ('COACH', 'TEAM_MANAGER')
    ))
));

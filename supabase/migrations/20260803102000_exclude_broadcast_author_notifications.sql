-- Do not notify or email the author about their own official update.
create or replace function private.notify_communication_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  channel_record public.communication_channels%rowtype;
begin
  select * into channel_record
  from public.communication_channels
  where id = new.channel_id;

  if new.message_type = 'BROADCAST' then
    with recipients as (
      select distinct tm.user_id
      from public.team_memberships tm
      join auth.users recipient_auth on recipient_auth.id = tm.user_id
      join public.teams t on t.id = tm.team_id
      join public.clubs c on c.id = t.club_id
      where tm.status = 'ACTIVE'
        and tm.user_id <> new.author_id
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
      and tm.user_id <> new.author_id
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

revoke all on function private.notify_communication_message() from public, anon, authenticated;

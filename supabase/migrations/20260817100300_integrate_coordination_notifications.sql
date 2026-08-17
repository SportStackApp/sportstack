-- Add mandatory Coordination email work to the existing SportStack notification worker.

create or replace function public.claim_sportstack_notification_work(p_limit integer default 50)
returns table (
  work_type text, delivery_id uuid, recipient_email text, recipient_name text,
  subject text, body_text text, action_url text
)
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  if session_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  perform public.coordination_process_due_work();

  with due_work as (
    select distinct f.id fixture_id, team_fixture.team_id, tm.user_id, reminder_day,
      channel_name, f.fixture_date - make_interval(days => reminder_day) due_at
    from public.fixtures f
    cross join lateral (values (f.home_team_id), (f.away_team_id)) team_fixture(team_id)
    join public.teams t on t.id = team_fixture.team_id
    join public.team_availability_reminder_settings team_setting on team_setting.team_id = t.id and team_setting.enabled
    join public.club_availability_reminder_settings club_setting on club_setting.club_id = t.club_id
    cross join lateral unnest(club_setting.reminder_days) reminder_day
    join public.team_memberships tm on tm.team_id = t.id and tm.status = 'ACTIVE'
    join auth.users recipient_auth on recipient_auth.id = tm.user_id
    left join public.fixture_availability fa on fa.fixture_id = f.id and fa.user_id = tm.user_id
    cross join lateral (values ('IN_APP'::text), ('EMAIL'::text)) channels(channel_name)
    left join public.notification_category_preferences pref on pref.user_id = tm.user_id and pref.category = 'AVAILABILITY_REMINDERS'
    where f.status = 'SCHEDULED' and f.fixture_date > now()
      and f.fixture_date - make_interval(days => reminder_day) <= now()
      and (fa.id is null or fa.status in ('MAYBE', 'NO_RESPONSE'))
      and ((channel_name = 'IN_APP' and coalesce(pref.in_app_enabled, true))
        or (channel_name = 'EMAIL' and coalesce(pref.email_enabled, true)))
  ), inserted as (
    insert into public.availability_reminder_dispatches(fixture_id, team_id, user_id, reminder_days, channel, due_at)
    select fixture_id, team_id, user_id, reminder_day, channel_name, due_at from due_work
    on conflict do nothing returning id, attempts
  )
  insert into public.availability_reminder_delivery_log(dispatch_id, attempt_number, event_type)
  select id, attempts, 'QUEUED' from inserted;

  with sent_in_app as (
    update public.availability_reminder_dispatches d
    set status = 'SENT', attempts = attempts + 1, last_attempt_at = now(), completed_at = now(), updated_at = now()
    where d.channel = 'IN_APP' and d.status in ('PENDING', 'FAILED') and d.attempts < 4 returning d.*
  ), notification_rows as (
    insert into public.notifications(user_id, title, body, message, type, action_url, fixture_id, team_id, dedupe_key)
    select s.user_id, 'Availability needed', 'Please confirm whether you can play in the upcoming fixture.',
      'Please confirm whether you can play in the upcoming fixture.', 'AVAILABILITY_REMINDER',
      '/dashboard?fixture=' || s.fixture_id, s.fixture_id, s.team_id, 'availability:' || s.id
    from sent_in_app s on conflict (dedupe_key) where dedupe_key is not null do nothing returning dedupe_key
  )
  insert into public.availability_reminder_delivery_log(dispatch_id, attempt_number, event_type)
  select s.id, s.attempts, 'SENT' from sent_in_app s;

  return query
  with candidates as (
    select d.id from public.availability_reminder_dispatches d
    where d.channel = 'EMAIL' and d.attempts < 4
      and (d.status in ('PENDING', 'FAILED') or (d.status = 'SENDING' and d.last_attempt_at < now() - interval '30 minutes'))
    order by d.due_at, d.created_at limit greatest(p_limit, 1) for update skip locked
  ), claimed as (
    update public.availability_reminder_dispatches d
    set status = 'SENDING', attempts = attempts + 1, last_attempt_at = now(), updated_at = now()
    from candidates c where d.id = c.id returning d.*
  ), logged as (
    insert into public.availability_reminder_delivery_log(dispatch_id, attempt_number, event_type)
    select id, attempts, 'CLAIMED' from claimed returning dispatch_id
  )
  select 'AVAILABILITY'::text, c.id, u.email::text,
    coalesce(nullif(concat_ws(' ', p.first_name, p.last_name), ''), 'Player')::text,
    'Please confirm your availability'::text,
    ('Your availability is still needed for ' || home.name || ' v ' || coalesce(away.name, 'Bye') ||
      ' on ' || to_char(f.fixture_date at time zone coalesce(a.timezone, 'Australia/Melbourne'), 'DD/MM/YYYY at HH12:MIam'))::text,
    ('/dashboard?fixture=' || f.id)::text
  from claimed c join auth.users u on u.id = c.user_id join public.profiles p on p.id = c.user_id
  join public.fixtures f on f.id = c.fixture_id join public.teams home on home.id = f.home_team_id
  left join public.teams away on away.id = f.away_team_id join public.clubs home_club on home_club.id=home.club_id
  left join public.associations a on a.id = home_club.association_id where u.email is not null;

  return query
  with candidates as (
    select ced.id from public.communication_email_deliveries ced
    where ced.attempts < 4 and (ced.status in ('PENDING', 'FAILED')
      or (ced.status = 'SENDING' and ced.last_attempt_at < now() - interval '30 minutes'))
    order by ced.created_at limit greatest(p_limit, 1) for update skip locked
  ), claimed as (
    update public.communication_email_deliveries ced
    set status = 'SENDING', attempts = attempts + 1, last_attempt_at = now(), updated_at = now()
    from candidates c where ced.id = c.id returning ced.*
  )
  select 'BROADCAST'::text, delivery.id, u.email::text,
    coalesce(nullif(concat_ws(' ', p.first_name, p.last_name), ''), 'Member')::text,
    case when ch.scope_type = 'CLUB' then 'New club update' else 'New association update' end,
    left(m.content, 2000)::text,
    ('/chat?tab=' || case when ch.scope_type = 'CLUB' then 'club' else 'association' end || '&message=' || m.id)::text
  from claimed delivery join public.communication_messages m on m.id = delivery.message_id
  join public.communication_channels ch on ch.id = m.channel_id join auth.users u on u.id = delivery.user_id
  join public.profiles p on p.id = delivery.user_id where u.email is not null;

  return query
  with candidates as (
    select d.id from public.coordination_notification_deliveries d
    where d.channel='EMAIL' and d.attempts<4
      and (d.status in ('QUEUED','FAILED') or (d.status='SENDING' and d.last_attempt_at<now()-interval '30 minutes'))
    order by d.created_at limit greatest(p_limit,1) for update skip locked
  ), claimed as (
    update public.coordination_notification_deliveries d
    set status='SENDING',attempts=attempts+1,last_attempt_at=now(),updated_at=now()
    from candidates c where d.id=c.id returning d.*
  )
  select 'COORDINATION'::text,c.id,u.email::text,
    coalesce(nullif(concat_ws(' ',p.first_name,p.last_name),''),'Member')::text,
    c.subject,c.body_text,coalesce(c.action_url,'/coordination/my-assignments')::text
  from claimed c join auth.users u on u.id=c.user_id join public.profiles p on p.id=c.user_id
  where u.email is not null;
end;
$function$;

create or replace function public.complete_sportstack_notification_work(
  p_work_type text, p_delivery_id uuid, p_success boolean, p_error text default null
)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare current_attempt integer;
begin
  if session_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  if p_work_type = 'AVAILABILITY' then
    update public.availability_reminder_dispatches
    set status = case when p_success then 'SENT' else 'FAILED' end,
      last_error = case when p_success then null else left(p_error, 1000) end,
      completed_at = case when p_success then now() else null end, updated_at = now()
    where id = p_delivery_id returning attempts into current_attempt;
    insert into public.availability_reminder_delivery_log(dispatch_id, attempt_number, event_type, detail)
    values (p_delivery_id, current_attempt, case when p_success then 'SENT' else 'FAILED' end,
      case when p_success then null else left(p_error, 1000) end);
  elsif p_work_type = 'BROADCAST' then
    update public.communication_email_deliveries
    set status = case when p_success then 'SENT' else 'FAILED' end,
      last_error = case when p_success then null else left(p_error, 1000) end,
      completed_at = case when p_success then now() else null end, updated_at = now()
    where id = p_delivery_id;
  elsif p_work_type = 'COORDINATION' then
    update public.coordination_notification_deliveries
    set status=case when p_success then 'SENT' else 'FAILED' end,
      last_error=case when p_success then null else left(p_error,1000) end,
      sent_at=case when p_success then now() else null end,updated_at=now()
    where id=p_delivery_id;
  else raise exception 'Unsupported work type'; end if;
end;
$function$;

revoke all on function public.claim_sportstack_notification_work(integer) from public, anon, authenticated;
revoke all on function public.complete_sportstack_notification_work(text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_sportstack_notification_work(integer) to service_role;
grant execute on function public.complete_sportstack_notification_work(text, uuid, boolean, text) to service_role;

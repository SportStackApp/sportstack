\set ON_ERROR_STOP on

-- The migration must have removed every legacy browser policy and privilege.
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'team_messages'
  ) then
    raise exception 'Legacy team_messages policies still exist';
  end if;
end;
$$;

select id as team_a_channel
from public.communication_channels
where team_id = '30000000-0000-0000-0000-000000000001' \gset
select id as team_b_channel
from public.communication_channels
where team_id = '30000000-0000-0000-0000-000000000002' \gset
select id as club_a_channel
from public.communication_channels
where club_id = '20000000-0000-0000-0000-000000000001' \gset
select set_config('test.team_a_channel', :'team_a_channel', false);
select set_config('test.team_b_channel', :'team_b_channel', false);

set request.jwt.claim.sub = '40000000-0000-0000-0000-000000000001';
set request.jwt.claim.role = 'authenticated';
set role authenticated;

do $$
begin
  if (select count(*) from public.communication_channels) <> 3 then
    raise exception 'Player A should see only its team, club and association channels';
  end if;
end;
$$;

insert into public.communication_messages(channel_id, message_type, author_id, content)
values (:'team_a_channel', 'CHAT', '40000000-0000-0000-0000-000000000001', 'Allowed team message');

do $$
begin
  begin
    insert into public.communication_messages(channel_id, message_type, author_id, content)
    values (
      current_setting('test.team_b_channel')::uuid,
      'CHAT',
      '40000000-0000-0000-0000-000000000001',
      'This must be denied'
    );
    raise exception 'Cross-team insert unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
update public.team_memberships
set status = 'INACTIVE'
where user_id = '40000000-0000-0000-0000-000000000001';
set role authenticated;
do $$
begin
  if (select count(*) from public.communication_channels) <> 0 then
    raise exception 'Inactive member retained communication access';
  end if;
end;
$$;
reset role;
update public.team_memberships
set status = 'ACTIVE'
where user_id = '40000000-0000-0000-0000-000000000001';
set role authenticated;
do $$
begin
  if (select count(*) from public.communication_messages where channel_id = current_setting('test.team_a_channel')::uuid) <> 0 then
    raise exception 'Reactivated member saw team history from before the new activation date';
  end if;
end;
$$;
reset role;

set request.jwt.claim.sub = '40000000-0000-0000-0000-000000000003';
set request.jwt.claim.role = 'authenticated';
set role authenticated;
insert into public.communication_messages(channel_id, message_type, author_id, content, is_important)
values (:'club_a_channel', 'BROADCAST', '40000000-0000-0000-0000-000000000003', 'Official club update', true);
reset role;

update public.team_availability_reminder_settings
set enabled = true
where team_id = '30000000-0000-0000-0000-000000000001';

-- The first claim returns one availability email plus the club broadcast email.
create temporary table claimed_work as
select * from public.claim_sportstack_notification_work(50);

do $$
begin
  if (select count(*) from claimed_work where work_type = 'AVAILABILITY') <> 1 then
    raise exception 'Expected one availability email claim';
  end if;
  if (select count(*) from claimed_work where work_type = 'BROADCAST') <> 1 then
    raise exception 'Expected one broadcast email claim';
  end if;
  if (select count(*) from public.notifications where type = 'AVAILABILITY_REMINDER') <> 1 then
    raise exception 'Expected one in-app availability reminder';
  end if;
end;
$$;

-- A second immediate run must not claim or create duplicates.
do $$
begin
  if (select count(*) from public.claim_sportstack_notification_work(50)) <> 0 then
    raise exception 'Duplicate notification work was claimed';
  end if;
  if (select count(*) from public.notifications where type = 'AVAILABILITY_REMINDER') <> 1 then
    raise exception 'Duplicate in-app availability reminder was created';
  end if;
end;
$$;

select 'daily dashboard communications assertions passed' as result;

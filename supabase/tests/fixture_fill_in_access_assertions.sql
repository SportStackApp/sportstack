\set ON_ERROR_STOP on

do $$
begin
  if (select registered_club_id from public.profiles where id = '40000000-0000-0000-0000-000000000001')
     <> '20000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'Unambiguous registered club backfill failed';
  end if;
end;
$$;

set request.jwt.claim.sub = '40000000-0000-0000-0000-000000000003';
set role authenticated;

insert into public.fixture_fill_ins(
  fixture_id, team_id, player_id, added_by
) values (
  '50000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000003'
);

-- Create an already-expired historical selection. Its MVP permission should
-- remain while the session is open, but team resources must be unavailable.
insert into public.fixture_fill_ins(
  fixture_id, team_id, player_id, access_starts_at, added_by
) values (
  '50000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000002',
  now() - interval '5 hours',
  '40000000-0000-0000-0000-000000000003'
);

reset role;
set request.jwt.claim.sub = '40000000-0000-0000-0000-000000000002';
set role authenticated;

do $$
begin
  if (select count(*) from public.fixture_fill_ins) <> 2 then
    raise exception 'Fill-in cannot see own current and historical selections';
  end if;

  if not private.communication_has_channel_access(
    '60000000-0000-0000-0000-000000000001',
    now()
  ) then
    raise exception 'Current fill-in did not receive team chat access';
  end if;

  if (select count(*) from public.fixture_lineups) <> 1 then
    raise exception 'Fill-in should see only the current fixture line-up';
  end if;

  if not private.mvp_player_is_eligible(
    '40000000-0000-0000-0000-000000000002',
    '80000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Expired team-resource access incorrectly removed Player MVP eligibility';
  end if;
end;
$$;

reset role;
set request.jwt.claim.sub = '40000000-0000-0000-0000-000000000004';
set role authenticated;

do $$
begin
  if (select count(*) from public.fixture_fill_ins) <> 0 then
    raise exception 'Unrelated player can read another team fill-in selection';
  end if;

  if private.communication_has_channel_access(
    '60000000-0000-0000-0000-000000000001',
    now()
  ) then
    raise exception 'Unrelated player received team chat access';
  end if;

  if (select count(*) from public.fixture_lineups) <> 0 then
    raise exception 'Unrelated player can read another team line-up';
  end if;
end;
$$;

reset role;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'associations' and column_name = 'primary_colour'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teams' and column_name = 'primary_colour'
  ) then
    raise exception 'Theme inheritance columns are missing';
  end if;
end;
$$;

select 'fixture fill-in access assertions passed' as result;

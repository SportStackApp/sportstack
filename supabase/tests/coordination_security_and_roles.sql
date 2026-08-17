-- Transactional Dev test for capability invitations, Technical Bench age
-- warnings, supervision, voting roster flags and API privilege boundaries.
begin;

do $test$
begin
  if not public.resolve_module_enabled('coordination', null, null, null, null) then
    raise exception 'Coordination should be enabled by default.';
  end if;
end $test$;

do $test$
declare v_table text;
begin
  foreach v_table in array array['coordination_assignments','coordination_offer_batches','coordination_offer_recipients','umpire_coordinator_notes'] loop
    if has_table_privilege('anon',format('public.%I',v_table),'SELECT') then raise exception 'Anonymous role can read %',v_table; end if;
    if not has_table_privilege('authenticated',format('public.%I',v_table),'SELECT') then raise exception 'Authenticated Data API grant missing for %',v_table; end if;
  end loop;
  if has_function_privilege('anon','public.coordination_send_offer(uuid,uuid[],text,timestamptz,text,text)','EXECUTE') then raise exception 'Anonymous role can call send offer.'; end if;
  if has_function_privilege('anon','public.coordination_can_invite_capability(text,text,uuid,text)','EXECUTE') then raise exception 'Anonymous role can call the account-invite permission check.'; end if;
end $test$;

create temp table coordination_role_test as
select
  (select user_id from public.user_roles where role::text='SUPER_ADMIN' order by created_at limit 1) coordinator_id,
  f.id fixture_id,
  f.fixture_date fixture_start,
  c.association_id,
  (select id from public.profiles order by id limit 1) person_one,
  (select id from public.profiles order by id offset 1 limit 1) person_two,
  (select id from public.profiles order by id offset 2 limit 1) person_three,
  (select id from public.profiles order by id offset 3 limit 1) person_four
from public.fixtures f join public.teams t on t.id=f.home_team_id join public.clubs c on c.id=t.club_id
where f.fixture_date>now()+interval '6 hours' order by f.fixture_date limit 1;

select set_config('request.jwt.claims',jsonb_build_object('sub',coordinator_id,'role','authenticated')::text,true) from coordination_role_test;

do $test$ begin
  if not (select public.coordination_can_invite_capability('VOLUNTEER','ASSOCIATION',association_id,'super_admin') from coordination_role_test) then
    raise exception 'Authorised coordinator invitation check was rejected.';
  end if;
end $test$;

-- Capability is absent before acceptance and present only after the invitee accepts.
select public.coordination_create_capability_invite(person_one,'VOLUNTEER','ASSOCIATION',association_id,'super_admin') from coordination_role_test;
do $test$ begin
  if exists(select 1 from coordination_role_test s join public.coordination_capabilities c on c.user_id=s.person_one and c.capability_type='VOLUNTEER' and c.scope_id=s.association_id and c.active) then raise exception 'Capability was granted before invitation acceptance.'; end if;
end $test$;
select set_config('request.jwt.claims',jsonb_build_object('sub',person_one,'role','authenticated')::text,true) from coordination_role_test;
do $test$ begin
  if (select public.coordination_can_invite_capability('UMPIRE','ASSOCIATION',association_id,'umpire') from coordination_role_test) then
    raise exception 'Unauthorised account invitation check was allowed.';
  end if;
end $test$;
select public.coordination_respond_capability_invite(i.id,true)
from coordination_role_test s join public.coordination_capability_invitations i on i.user_id=s.person_one and i.scope_id=s.association_id and i.status='PENDING';
do $test$ begin
  if not exists(select 1 from coordination_role_test s join public.coordination_capabilities c on c.user_id=s.person_one and c.capability_type='VOLUNTEER' and c.scope_id=s.association_id and c.active) then raise exception 'Accepted capability invitation was not granted.'; end if;
end $test$;

-- Prepare two Technical Bench positions and make both test people under 18 on fixture day.
select set_config('request.jwt.claims',jsonb_build_object('sub',coordinator_id,'role','authenticated')::text,true) from coordination_role_test;
select public.coordination_get_fixture_positions(fixture_id,'super_admin') from coordination_role_test;
update public.profiles p set date_of_birth=(s.fixture_start::date-interval '17 years')::date,is_umpire=true
from coordination_role_test s where p.id in (s.person_one,s.person_two);
insert into public.coordination_capabilities(user_id,capability_type,scope_type,scope_id,granted_by)
select person_id,'TECHNICAL_BENCH','ASSOCIATION',association_id,coordinator_id
from coordination_role_test s cross join lateral (values(s.person_one),(s.person_two)) people(person_id)
on conflict (user_id,capability_type,scope_type,scope_id) where active do nothing;

-- Directly create confirmed Tech Bench duty one; the second confirmation must warn for two minors.
insert into public.coordination_assignments(position_id,assigned_user_id,assigned_by,confirmed_by,starts_at,ends_at)
select p.id,s.person_one,s.coordinator_id,s.coordinator_id,p.starts_at,p.ends_at
from coordination_role_test s join public.coordination_positions p on p.fixture_id=s.fixture_id
join public.coordination_position_types pt on pt.id=p.position_type_id and pt.code='TECHNICAL_BENCH'
where p.slot_number=1;
update public.coordination_positions p set state='FILLED'
from coordination_role_test s,public.coordination_position_types pt
where p.fixture_id=s.fixture_id and p.position_type_id=pt.id and pt.code='TECHNICAL_BENCH' and p.slot_number=1;

select public.coordination_send_offer(p.id,array[s.person_two],'Age warning test',least(now()+interval '2 hours',s.fixture_start),'super_admin',null)
from coordination_role_test s join public.coordination_positions p on p.fixture_id=s.fixture_id
join public.coordination_position_types pt on pt.id=p.position_type_id and pt.code='TECHNICAL_BENCH'
where p.slot_number=2;
select set_config('request.jwt.claims',jsonb_build_object('sub',person_two,'role','authenticated')::text,true) from coordination_role_test;
select public.coordination_respond_to_offer(r.id,'ACCEPT',null)
from coordination_role_test s join public.coordination_positions p on p.fixture_id=s.fixture_id
join public.coordination_position_types pt on pt.id=p.position_type_id and pt.code='TECHNICAL_BENCH'
join public.coordination_offer_batches b on b.position_id=p.id and b.status='ACTIVE'
join public.coordination_offer_recipients r on r.offer_batch_id=b.id and r.user_id=s.person_two where p.slot_number=2;
select set_config('request.jwt.claims',jsonb_build_object('sub',coordinator_id,'role','authenticated')::text,true) from coordination_role_test;
do $test$
declare v_recipient uuid;
begin
  select r.id into v_recipient from coordination_role_test s join public.coordination_positions p on p.fixture_id=s.fixture_id
  join public.coordination_position_types pt on pt.id=p.position_type_id and pt.code='TECHNICAL_BENCH'
  join public.coordination_offer_batches b on b.position_id=p.id and b.status='ACTIVE'
  join public.coordination_offer_recipients r on r.offer_batch_id=b.id and r.user_id=s.person_two where p.slot_number=2;
  begin
    perform public.coordination_confirm_offer(v_recipient,'super_admin',null);
    raise exception 'Expected under-18 pairing warning did not occur.';
  exception when raise_exception then
    if sqlerrm='Expected under-18 pairing warning did not occur.' then raise; end if;
  end;
  perform public.coordination_confirm_offer(v_recipient,'super_admin','Coordinator accepts the two-under-18 pairing warning for this test.');
end $test$;

-- A normal Umpire assignment may supervise the other Umpire, but never itself.
do $test$
declare s coordination_role_test%rowtype; v_position_one uuid; v_position_two uuid; v_assignment_one uuid; v_assignment_two uuid;
begin
  select * into s from coordination_role_test;
  select p.id into v_position_one from public.coordination_positions p join public.coordination_position_types pt on pt.id=p.position_type_id where p.fixture_id=s.fixture_id and pt.code='UMPIRE' and p.slot_number=1;
  select p.id into v_position_two from public.coordination_positions p join public.coordination_position_types pt on pt.id=p.position_type_id where p.fixture_id=s.fixture_id and pt.code='UMPIRE' and p.slot_number=2;
  insert into public.coordination_assignments(position_id,assigned_user_id,assigned_by,confirmed_by,starts_at,ends_at)
  select v_position_one,s.person_three,s.coordinator_id,s.coordinator_id,p.starts_at,p.ends_at from public.coordination_positions p where p.id=v_position_one returning id into v_assignment_one;
  insert into public.coordination_assignments(position_id,assigned_user_id,assigned_by,confirmed_by,starts_at,ends_at)
  select v_position_two,s.person_four,s.coordinator_id,s.coordinator_id,p.starts_at,p.ends_at from public.coordination_positions p where p.id=v_position_two returning id into v_assignment_two;
  begin
    perform public.coordination_add_supervision_link(v_assignment_one,v_assignment_one,'super_admin');
    raise exception 'Expected self-supervision rejection did not occur.';
  exception when raise_exception then
    if sqlerrm='Expected self-supervision rejection did not occur.' then raise; end if;
  end;
  perform public.coordination_add_supervision_link(v_assignment_one,v_assignment_two,'super_admin');
end $test$;

-- Roster mismatch creates a flag but leaves the Umpire Match Voting submission untouched.
do $test$
declare s coordination_role_test%rowtype; v_submission uuid; v_before boolean; v_other_user uuid;
begin
  select * into s from coordination_role_test;
  select id into v_other_user from public.profiles where id not in (s.person_one,s.person_two,s.person_three,s.person_four) order by id limit 1;
  insert into public.player_vote_submissions(fixture_id,umpire_user_id) values(s.fixture_id,v_other_user) returning id,is_approved into v_submission,v_before;
  if not exists(select 1 from public.umpire_match_roster_checks where submission_id=v_submission and result='MISMATCH') then raise exception 'Roster mismatch flag was not created.'; end if;
  if (select is_approved from public.player_vote_submissions where id=v_submission) is distinct from v_before then raise exception 'Roster check changed the voting submission.'; end if;
end $test$;

-- Exercise the two offer policies as an authenticated Data API role. This
-- catches circular policy expansion that a migration-owner query would bypass.
select set_config('request.jwt.claims',jsonb_build_object('sub',coordinator_id,'role','authenticated')::text,true) from coordination_role_test;
set local role authenticated;
select count(*) from public.coordination_offer_batches;
select count(*) from public.coordination_offer_recipients;
reset role;

rollback;

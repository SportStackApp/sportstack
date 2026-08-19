-- Transactional Dev test for the Coordination offer, confirm, replacement,
-- reminder, overlap, availability and reconfirmation rules.
begin;

create temp table coordination_test_state (
  coordinator_id uuid,
  fixture_id uuid,
  fixture_start timestamptz,
  position_one uuid,
  position_two uuid,
  umpire_one uuid,
  umpire_two uuid,
  first_recipient uuid,
  first_assignment uuid,
  replacement_assignment uuid
) on commit drop;

insert into coordination_test_state(coordinator_id,fixture_id,fixture_start,umpire_one,umpire_two)
select
  (select user_id from public.user_roles where role::text='SUPER_ADMIN' order by created_at limit 1),
  f.id,
  f.fixture_date,
  (select user_id from public.user_roles where role::text='UMPIRE' and association_id=c.association_id order by user_id limit 1),
  (select user_id from public.user_roles where role::text='UMPIRE' and association_id=c.association_id order by user_id offset 1 limit 1)
from public.fixtures f
join public.teams home_team on home_team.id=f.home_team_id
join public.clubs c on c.id=home_team.club_id
where f.fixture_date>now()+interval '6 hours'
  and (select count(*) from public.user_roles role_row where role_row.role::text='UMPIRE' and role_row.association_id=c.association_id)>=2
order by f.fixture_date
limit 1;

do $test$
begin
  if not exists(select 1 from coordination_test_state where coordinator_id is not null and fixture_id is not null and umpire_one is not null and umpire_two is not null) then
    raise exception 'Coordination test prerequisites are missing.';
  end if;
end $test$;

select set_config('request.jwt.claims',jsonb_build_object('sub',coordinator_id,'role','authenticated')::text,true)
from coordination_test_state;

select public.coordination_get_fixture_positions(fixture_id,'super_admin') from coordination_test_state;

update coordination_test_state s set
  position_one=(select p.id from public.coordination_positions p join public.coordination_position_types pt on pt.id=p.position_type_id where p.fixture_id=s.fixture_id and pt.code='UMPIRE' and p.slot_number=1),
  position_two=(select p.id from public.coordination_positions p join public.coordination_position_types pt on pt.id=p.position_type_id where p.fixture_id=s.fixture_id and pt.code='UMPIRE' and p.slot_number=2);

select public.coordination_send_offer(
  position_one,array[umpire_one,umpire_two],
  'Transactional test offer',least(now()+interval '2 hours',fixture_start),
  'super_admin','Test override for grade and availability warnings'
) from coordination_test_state;

do $test$
begin
  if exists (
    select 1
    from coordination_test_state state
    join public.coordination_capabilities capability
      on capability.user_id in (state.umpire_one, state.umpire_two)
     and capability.capability_type='UMPIRE'
     and capability.active
  ) then
    raise exception 'Workflow test requires Umpire role eligibility without a capability row.';
  end if;
end $test$;

update coordination_test_state s set first_recipient=(
  select r.id from public.coordination_offer_recipients r
  join public.coordination_offer_batches b on b.id=r.offer_batch_id
  where b.position_id=s.position_one and r.user_id=s.umpire_one and b.status='ACTIVE'
);

select set_config('request.jwt.claims',jsonb_build_object('sub',umpire_one,'role','authenticated')::text,true)
from coordination_test_state;
select public.coordination_respond_to_offer(first_recipient,'ACCEPT',null) from coordination_test_state;

select set_config('request.jwt.claims',jsonb_build_object('sub',umpire_two,'role','authenticated')::text,true)
from coordination_test_state;
select public.coordination_respond_to_offer(recipient.id,'DECLINE','Unavailable for this test')
from coordination_test_state state
join public.coordination_offer_batches batch on batch.position_id=state.position_one and batch.status='ACTIVE'
join public.coordination_offer_recipients recipient on recipient.offer_batch_id=batch.id and recipient.user_id=state.umpire_two;

do $test$
begin
  if not exists(select 1 from coordination_test_state s join public.coordination_offer_recipients r on r.id=s.first_recipient where r.status='ACCEPTED_AWAITING_CONFIRMATION') then
    raise exception 'Recipient acceptance incorrectly rostered or did not enter awaiting confirmation.';
  end if;
  if exists(select 1 from coordination_test_state s join public.coordination_assignments a on a.position_id=s.position_one) then
    raise exception 'No until yes failed: acceptance created an assignment.';
  end if;
end $test$;

select set_config('request.jwt.claims',jsonb_build_object('sub',coordinator_id,'role','authenticated')::text,true)
from coordination_test_state;
update coordination_test_state s set first_assignment=public.coordination_confirm_offer(s.first_recipient,'super_admin','Test confirmation override');

do $test$
begin
  if not exists(select 1 from coordination_test_state s join public.coordination_assignments a on a.id=s.first_assignment where a.assigned_user_id=s.umpire_one and a.status='CONFIRMED') then raise exception 'Coordinator confirmation did not create the official assignment.'; end if;
  if exists(select 1 from coordination_test_state s join public.coordination_offer_recipients r on r.user_id=s.umpire_two join public.coordination_offer_batches b on b.id=r.offer_batch_id where b.position_id=s.position_one and r.status not in ('NOT_SELECTED','DECLINED')) then raise exception 'Unselected recipients were not closed.'; end if;
  if not exists(select 1 from coordination_test_state s join public.fixture_availability fa on fa.fixture_id=s.fixture_id and fa.user_id=s.umpire_one where fa.status='UMPIRING') then raise exception 'Confirmed Umpire availability state was not written.'; end if;
end $test$;

-- Availability cannot be changed back to Available over a confirmed duty.
do $test$
begin
  begin
    update public.fixture_availability fa set status='AVAILABLE'
    from coordination_test_state s where fa.fixture_id=s.fixture_id and fa.user_id=s.umpire_one;
    raise exception 'Expected availability overlap rejection did not occur.';
  exception when raise_exception then
    if sqlerrm='Expected availability overlap rejection did not occur.' then raise; end if;
  end;
  begin
    update public.fixture_availability fa set status='UNAVAILABLE'
    from coordination_test_state s where fa.fixture_id=s.fixture_id and fa.user_id=s.umpire_one;
    raise exception 'Expected confirmed role availability protection did not occur.';
  exception when raise_exception then
    if sqlerrm='Expected confirmed role availability protection did not occur.' then raise; end if;
  end;
  begin
    delete from public.fixture_availability fa
    using coordination_test_state s where fa.fixture_id=s.fixture_id and fa.user_id=s.umpire_one;
    raise exception 'Expected confirmed role availability delete protection did not occur.';
  exception when raise_exception then
    if sqlerrm='Expected confirmed role availability delete protection did not occur.' then raise; end if;
  end;
end $test$;

-- A person cannot be confirmed into any overlapping position.
do $test$
declare s coordination_test_state%rowtype; v_activity uuid; v_position uuid;
begin
  select * into s from coordination_test_state;
  insert into public.coordination_activities(name,scope_type,association_id,starts_at,ends_at,coordinator_id)
  select 'Overlap test','ASSOCIATION',p.association_id,p.starts_at,p.ends_at,s.coordinator_id
  from public.coordination_positions p where p.id=s.position_one returning id into v_activity;
  insert into public.coordination_positions(activity_id,association_id,position_type_id,position_label,starts_at,ends_at,created_by)
  select v_activity,p.association_id,p.position_type_id,'Overlap test',p.starts_at,p.ends_at,s.coordinator_id
  from public.coordination_positions p where p.id=s.position_one returning id into v_position;
  begin
    insert into public.coordination_assignments(position_id,assigned_user_id,assigned_by,confirmed_by,starts_at,ends_at)
    select v_position,s.umpire_one,s.coordinator_id,s.coordinator_id,p.starts_at,p.ends_at from public.coordination_positions p where p.id=v_position;
    raise exception 'Expected hard overlap rejection did not occur.';
  exception when exclusion_violation then null;
  end;
end $test$;

-- Replacement requires a note and keeps the old person until a new confirmation.
select set_config('request.jwt.claims',jsonb_build_object('sub',umpire_one,'role','authenticated')::text,true) from coordination_test_state;
select public.coordination_request_replacement(first_assignment,'Unable to attend the test fixture') from coordination_test_state;

select set_config('request.jwt.claims',jsonb_build_object('sub',coordinator_id,'role','authenticated')::text,true) from coordination_test_state;
select public.coordination_send_offer(position_one,array[umpire_two],'Replacement test offer',least(now()+interval '2 hours',fixture_start),'super_admin','Replacement test override') from coordination_test_state;

select set_config('request.jwt.claims',jsonb_build_object('sub',umpire_two,'role','authenticated')::text,true) from coordination_test_state;
select public.coordination_respond_to_offer(r.id,'ACCEPT',null)
from coordination_test_state s join public.coordination_offer_batches b on b.position_id=s.position_one and b.status='ACTIVE'
join public.coordination_offer_recipients r on r.offer_batch_id=b.id and r.user_id=s.umpire_two;

select set_config('request.jwt.claims',jsonb_build_object('sub',coordinator_id,'role','authenticated')::text,true) from coordination_test_state;
update coordination_test_state s set replacement_assignment=public.coordination_confirm_offer(r.id,'super_admin','Replacement confirmation override')
from public.coordination_offer_batches b join public.coordination_offer_recipients r on r.offer_batch_id=b.id
where b.position_id=s.position_one and b.status='ACTIVE' and r.user_id=s.umpire_two;

do $test$
begin
  if not exists(select 1 from coordination_test_state s join public.coordination_assignments a on a.id=s.first_assignment where a.status='REPLACED' and a.replaced_by_assignment_id=s.replacement_assignment) then raise exception 'The old assignment was not closed as Replaced.'; end if;
  if not exists(select 1 from coordination_test_state s join public.coordination_assignments a on a.id=s.replacement_assignment where a.status='CONFIRMED' and a.assigned_user_id=s.umpire_two) then raise exception 'The replacement was not confirmed.'; end if;
  if exists(select 1 from coordination_test_state s join public.fixture_availability fa on fa.fixture_id=s.fixture_id and fa.user_id=s.umpire_one) then raise exception 'The replaced person availability state was not cleared.'; end if;
end $test$;

-- A material fixture change must require fresh recipient acceptance and coordinator confirmation.
update public.fixtures f set fixture_date=f.fixture_date+interval '1 minute' from coordination_test_state s where f.id=s.fixture_id;
do $test$
begin
  if not exists(select 1 from coordination_test_state s join public.coordination_assignments a on a.id=s.replacement_assignment where a.status='RECONFIRMATION_REQUIRED') then raise exception 'Material fixture change did not require reconfirmation.'; end if;
  if exists(select 1 from coordination_test_state s join public.fixture_availability fa on fa.fixture_id=s.fixture_id and fa.user_id=s.umpire_two) then raise exception 'Material fixture change did not clear role availability.'; end if;
end $test$;

select set_config('request.jwt.claims',jsonb_build_object('sub',umpire_two,'role','authenticated')::text,true) from coordination_test_state;
select public.coordination_respond_to_offer(r.id,'ACCEPT',null)
from coordination_test_state s join public.coordination_offer_batches b on b.position_id=s.position_one and b.status='ACTIVE'
join public.coordination_offer_recipients r on r.offer_batch_id=b.id and r.user_id=s.umpire_two;
select set_config('request.jwt.claims',jsonb_build_object('sub',coordinator_id,'role','authenticated')::text,true) from coordination_test_state;
select public.coordination_confirm_offer(r.id,'super_admin','Reconfirmation test override')
from coordination_test_state s join public.coordination_offer_batches b on b.position_id=s.position_one and b.status='ACTIVE'
join public.coordination_offer_recipients r on r.offer_batch_id=b.id and r.user_id=s.umpire_two;

-- Reminder work is deduplicated and queues one mandatory email for each reminder event.
select public.coordination_send_offer(position_two,array[umpire_one],'Reminder test offer',least(now()+interval '3 hours',fixture_start),'super_admin','Reminder test override') from coordination_test_state;
update public.coordination_offer_reminders rem set due_at=now()-interval '1 minute'
from coordination_test_state s,public.coordination_offer_batches b,public.coordination_offer_recipients r
where b.position_id=s.position_two and b.status='ACTIVE' and r.offer_batch_id=b.id and rem.recipient_id=r.id;
select public.coordination_process_due_work();
select public.coordination_process_due_work();

do $test$
begin
  if exists(select 1 from public.coordination_notification_deliveries group by dedupe_key having count(*)>1) then raise exception 'Reminder delivery deduplication failed.'; end if;
  if not exists(select 1 from public.coordination_notification_deliveries where event_type='OFFER_REMINDER' and channel='EMAIL') then raise exception 'Reminder email was not queued.'; end if;
end $test$;

rollback;

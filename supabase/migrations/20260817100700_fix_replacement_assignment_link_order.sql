-- A BEFORE INSERT trigger can close the old assignment so unique/overlap checks pass,
-- but the foreign key to the new assignment must be written by an AFTER INSERT trigger.

create or replace function private.coordination_prepare_replacement_assignment()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_old public.coordination_assignments%rowtype; v_fixture uuid;
begin
  select * into v_old from public.coordination_assignments
  where position_id=new.position_id and status='REPLACEMENT_REQUESTED' for update;
  if found then
    update public.coordination_assignments
    set status='REPLACED',updated_at=now()
    where id=v_old.id;
    update public.coordination_replacement_requests
    set status='RESOLVED',resolved_by=new.confirmed_by,resolved_at=now(),updated_at=now()
    where assignment_id=v_old.id and status='OPEN';
    select fixture_id into v_fixture from public.coordination_positions where id=new.position_id;
    if v_fixture is not null then
      delete from public.fixture_availability where fixture_id=v_fixture and user_id=v_old.assigned_user_id;
    end if;
    insert into public.coordination_assignment_events(assignment_id,position_id,event_type,actor_id,detail)
    values(v_old.id,new.position_id,'REPLACED',new.confirmed_by,jsonb_build_object('replacement_assignment_id',new.id));
    perform private.coordination_queue_notice(v_old.assigned_user_id,'REPLACED','ASSIGNMENT',v_old.id,
      'Replacement confirmed','A replacement has been confirmed and you are no longer rostered for this duty.',
      '/coordination/my-assignments','coordination:replaced:'||v_old.id||':'||new.id);
  end if;
  return new;
end;
$function$;

create or replace function private.coordination_link_replacement_assignment()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  update public.coordination_assignments old_assignment
  set replaced_by_assignment_id=new.id,updated_at=now()
  where old_assignment.position_id=new.position_id
    and old_assignment.status='REPLACED'
    and old_assignment.replaced_by_assignment_id is null
    and exists(select 1 from public.coordination_assignment_events event where event.assignment_id=old_assignment.id and event.event_type='REPLACED' and event.detail->>'replacement_assignment_id'=new.id::text);
  return new;
end;
$function$;

drop trigger if exists coordination_link_replacement_assignment on public.coordination_assignments;
create trigger coordination_link_replacement_assignment
after insert on public.coordination_assignments
for each row execute function private.coordination_link_replacement_assignment();

revoke all on function private.coordination_link_replacement_assignment() from public,anon,authenticated;

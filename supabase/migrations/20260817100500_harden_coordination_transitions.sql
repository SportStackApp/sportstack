-- Close workflow gaps found during the first application test review.

create or replace function private.coordination_prepare_replacement_assignment()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_old public.coordination_assignments%rowtype; v_fixture uuid;
begin
  select * into v_old from public.coordination_assignments
  where position_id=new.position_id and status='REPLACEMENT_REQUESTED' for update;
  if found then
    update public.coordination_assignments
    set status='REPLACED',replaced_by_assignment_id=new.id,updated_at=now()
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

drop trigger if exists coordination_prepare_replacement_assignment on public.coordination_assignments;
create trigger coordination_prepare_replacement_assignment
before insert on public.coordination_assignments
for each row execute function private.coordination_prepare_replacement_assignment();

create or replace function private.coordination_guard_available_status()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_window record;
begin
  if new.status<>'AVAILABLE' then return new; end if;
  select * into v_window from private.coordination_fixture_window(new.fixture_id);
  if found and exists(
    select 1 from public.coordination_assignments a
    where a.assigned_user_id=new.user_id
      and a.status in ('CONFIRMED','RECONFIRMATION_REQUIRED','REPLACEMENT_REQUESTED','DISPUTED')
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(v_window.starts_at,v_window.ends_at,'[)')
  ) then
    raise exception 'Availability cannot be marked Available over a confirmed Coordination duty.';
  end if;
  return new;
end;
$function$;

drop trigger if exists coordination_guard_available_status on public.fixture_availability;
create trigger coordination_guard_available_status
before insert or update of status on public.fixture_availability
for each row execute function private.coordination_guard_available_status();

create or replace function public.coordination_process_due_work()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_due record; v_reminders integer:=0; v_expired integer:=0;
begin
  if session_user not in ('postgres','supabase_admin') and coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Service role required'; end if;
  for v_due in
    select rem.id,rem.recipient_id,r.user_id
    from public.coordination_offer_reminders rem
    join public.coordination_offer_recipients r on r.id=rem.recipient_id
    join public.coordination_offer_batches b on b.id=r.offer_batch_id
    where rem.status='PENDING' and rem.due_at<=now() and r.status='PENDING' and b.status='ACTIVE'
    order by rem.due_at for update of rem skip locked
  loop
    update public.coordination_offer_reminders set status='SENT',processed_at=now(),attempts=attempts+1 where id=v_due.id;
    perform private.coordination_queue_notice(v_due.user_id,'OFFER_REMINDER','OFFER_RECIPIENT',v_due.recipient_id,
      'Coordination offer reminder','Your Coordination offer is waiting for a response.',
      '/coordination/my-assignments','coordination:reminder:'||v_due.id);
    v_reminders:=v_reminders+1;
  end loop;
  with expired as (
    update public.coordination_offer_recipients r set status='EXPIRED',responded_at=now(),updated_at=now()
    from public.coordination_offer_batches b
    where r.offer_batch_id=b.id and b.status='ACTIVE' and b.response_deadline<=now() and r.status='PENDING'
    returning r.id
  ) select count(*) into v_expired from expired;
  update public.coordination_offer_batches b set status='EXPIRED',updated_at=now()
  where b.status='ACTIVE' and b.response_deadline<=now()
    and not exists(select 1 from public.coordination_offer_recipients r where r.offer_batch_id=b.id and r.status='ACCEPTED_AWAITING_CONFIRMATION');
  return jsonb_build_object('reminders',v_reminders,'expired',v_expired);
end;
$function$;

create or replace function private.coordination_finish_fixture_assignments()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_status text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status::text in ('COMPLETED','FINAL','FINALISED') then v_status:='COMPLETED';
  elsif new.status::text in ('CANCELLED','ABANDONED') then v_status:='CANCELLED';
  else return new; end if;
  update public.coordination_assignments a
  set status=v_status,completed_at=case when v_status='COMPLETED' then now() else null end,updated_at=now()
  from public.coordination_positions p
  where a.position_id=p.id and p.fixture_id=new.id
    and a.status in ('CONFIRMED','RECONFIRMATION_REQUIRED','REPLACEMENT_REQUESTED');
  update public.coordination_positions set state=v_status,updated_at=now() where fixture_id=new.id and state not in ('CANCELLED','COMPLETED');
  delete from public.fixture_availability fa
  using public.coordination_assignments a,public.coordination_positions p
  where a.position_id=p.id and p.fixture_id=new.id and fa.fixture_id=new.id and fa.user_id=a.assigned_user_id;
  return new;
end;
$function$;

drop trigger if exists coordination_finish_fixture_assignments on public.fixtures;
create trigger coordination_finish_fixture_assignments after update of status on public.fixtures
for each row execute function private.coordination_finish_fixture_assignments();

create or replace function private.coordination_recheck_roster_after_assignment()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_fixture uuid;
begin
  select fixture_id into v_fixture from public.coordination_positions where id=coalesce(new.position_id,old.position_id);
  if v_fixture is not null then
    update public.player_vote_submissions set umpire_user_id=umpire_user_id where fixture_id=v_fixture;
  end if;
  return coalesce(new,old);
end;
$function$;

drop trigger if exists coordination_recheck_roster_after_assignment on public.coordination_assignments;
create trigger coordination_recheck_roster_after_assignment
after insert or update of status,assigned_user_id on public.coordination_assignments
for each row execute function private.coordination_recheck_roster_after_assignment();

create or replace function public.coordination_record_grade_signoff(
  p_user_id uuid,p_association_id uuid,p_division_id uuid,p_status text,p_effective_date date,p_reason text,p_actor_mode text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_id uuid;
begin
  if not private.coordination_permission_allowed('coordination.umpire_matrix.manage',p_actor_mode,p_association_id) then raise exception 'You cannot update grade sign-offs.'; end if;
  if not exists(select 1 from public.divisions where id=p_division_id and association_id=p_association_id) then raise exception 'The grade is outside this association.'; end if;
  if upper(p_status)<>'SIGNED_OFF' and nullif(btrim(p_reason),'') is null then raise exception 'A reason is required for suspension or removal.'; end if;
  insert into public.umpire_grade_signoffs(user_id,association_id,division_id,status,effective_date,reason,signed_by)
  values(p_user_id,p_association_id,p_division_id,upper(p_status),coalesce(p_effective_date,current_date),nullif(btrim(p_reason),''),auth.uid()) returning id into v_id;
  perform private.coordination_queue_notice(p_user_id,'GRADE_SIGNOFF_CHANGED','GRADE_SIGNOFF',v_id,'Umpire grade eligibility updated',
    'Your Umpire grade eligibility was updated to '||lower(replace(upper(p_status),'_',' '))||'.',
    '/coordination/my-assignments','coordination:grade:'||v_id);
  return v_id;
end;
$function$;

create or replace function public.coordination_add_umpire_qualification(
  p_user_id uuid,p_association_id uuid,p_name text,p_issuer text,p_issued_on date,p_expires_on date,p_note text,p_actor_mode text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_id uuid;
begin
  if not private.coordination_permission_allowed('coordination.umpire_matrix.manage',p_actor_mode,p_association_id) then raise exception 'You cannot add qualifications.'; end if;
  insert into public.umpire_qualifications(user_id,association_id,name,issuer,issued_on,expires_on,note,added_by)
  values(p_user_id,p_association_id,btrim(p_name),nullif(btrim(p_issuer),''),p_issued_on,p_expires_on,nullif(btrim(p_note),''),auth.uid()) returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.coordination_add_umpire_note(
  p_user_id uuid,p_association_id uuid,p_content text,p_note_kind text default 'GENERAL',p_actor_mode text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_id uuid;
begin
  if not private.coordination_permission_allowed('coordination.umpire_matrix.manage',p_actor_mode,p_association_id) then raise exception 'You cannot add restricted Umpire notes.'; end if;
  insert into public.umpire_coordinator_notes(user_id,association_id,content,note_kind,created_by)
  values(p_user_id,p_association_id,btrim(p_content),upper(p_note_kind),auth.uid()) returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.coordination_redact_umpire_note(
  p_note_id uuid,p_reason text,p_actor_mode text default null
) returns void language plpgsql security definer set search_path=''
as $function$
declare v_note public.umpire_coordinator_notes%rowtype;
begin
  if nullif(btrim(p_reason),'') is null then raise exception 'A redaction reason is required.'; end if;
  select * into v_note from public.umpire_coordinator_notes where id=p_note_id for update;
  if not private.coordination_permission_allowed('coordination.sensitive_notes.redact',p_actor_mode,v_note.association_id) then raise exception 'You do not have privacy-redaction permission.'; end if;
  update public.umpire_coordinator_notes set content='[Redacted by privacy administrator]',redacted_at=now(),redacted_by=auth.uid(),redaction_reason=btrim(p_reason) where id=p_note_id;
end;
$function$;

create or replace function public.coordination_review_roster_check(
  p_check_id uuid,p_reviewed_status text,p_note text,p_actor_mode text default null
) returns void language plpgsql security definer set search_path=''
as $function$
declare v_check public.umpire_match_roster_checks%rowtype; v_association uuid;
begin
  select * into v_check from public.umpire_match_roster_checks where id=p_check_id for update;
  select c.association_id into v_association from public.fixtures f join public.teams t on t.id=f.home_team_id join public.clubs c on c.id=t.club_id where f.id=v_check.fixture_id;
  if not private.coordination_permission_allowed('coordination.roster_mismatches.review',p_actor_mode,v_association) then raise exception 'You cannot review this roster check.'; end if;
  update public.umpire_match_roster_checks set reviewed_status=upper(p_reviewed_status),reviewed_by=auth.uid(),reviewed_at=now(),review_note=nullif(btrim(p_note),'') where id=p_check_id;
end;
$function$;

revoke all on function public.coordination_record_grade_signoff(uuid,uuid,uuid,text,date,text,text) from public,anon;
revoke all on function public.coordination_add_umpire_qualification(uuid,uuid,text,text,date,date,text,text) from public,anon;
revoke all on function public.coordination_add_umpire_note(uuid,uuid,text,text,text) from public,anon;
revoke all on function public.coordination_redact_umpire_note(uuid,text,text) from public,anon;
revoke all on function public.coordination_review_roster_check(uuid,text,text,text) from public,anon;
grant execute on function public.coordination_record_grade_signoff(uuid,uuid,uuid,text,date,text,text) to authenticated;
grant execute on function public.coordination_add_umpire_qualification(uuid,uuid,text,text,date,date,text,text) to authenticated;
grant execute on function public.coordination_add_umpire_note(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.coordination_redact_umpire_note(uuid,text,text) to authenticated;
grant execute on function public.coordination_review_roster_check(uuid,text,text,text) to authenticated;

revoke all on function private.coordination_prepare_replacement_assignment() from public,anon,authenticated;
revoke all on function private.coordination_guard_available_status() from public,anon,authenticated;
revoke all on function private.coordination_finish_fixture_assignments() from public,anon,authenticated;
revoke all on function private.coordination_recheck_roster_after_assignment() from public,anon,authenticated;

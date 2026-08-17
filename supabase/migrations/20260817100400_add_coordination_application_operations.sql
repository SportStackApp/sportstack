-- Application-facing Coordination operations. All writes remain permission and scope checked.

create or replace function public.coordination_get_fixture_positions(p_fixture_id uuid,p_actor_mode text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_window record; v_allowed boolean;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select * into v_window from private.coordination_fixture_window(p_fixture_id);
  if not found then raise exception 'Fixture date or organisation could not be resolved.'; end if;
  v_allowed:=private.coordination_permission_allowed('coordination.umpires.manage',p_actor_mode,v_window.association_id)
    or private.coordination_permission_allowed('coordination.technical_bench.manage',p_actor_mode,v_window.association_id);
  if not v_allowed then raise exception 'You do not have Coordination access for this fixture.'; end if;
  perform private.coordination_ensure_fixture_positions(p_fixture_id,auth.uid());
  update public.coordination_positions set created_by=coalesce(created_by,auth.uid()) where fixture_id=p_fixture_id;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',p.id,'label',p.position_label,'state',p.state,'starts_at',p.starts_at,'ends_at',p.ends_at,
      'type',pt.code,'type_label',pt.label,
      'assignment',case when a.id is null then null else jsonb_build_object('id',a.id,'user_id',a.assigned_user_id,'name',concat_ws(' ',pr.first_name,pr.last_name),'status',a.status,'late',a.late_assignment) end,
      'offer',case when b.id is null then null else jsonb_build_object('id',b.id,'deadline',b.response_deadline,'note',b.note,'urgent',b.urgent,'owner_id',b.current_owner_id,'recipients',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'name',concat_ws(' ',rp.first_name,rp.last_name),'status',r.status,'reason',r.decline_reason) order by concat_ws(' ',rp.first_name,rp.last_name)) from public.coordination_offer_recipients r join public.profiles rp on rp.id=r.user_id where r.offer_batch_id=b.id),'[]'::jsonb)) end
    ) order by pt.code,p.slot_number)
    from public.coordination_positions p join public.coordination_position_types pt on pt.id=p.position_type_id
    left join public.coordination_assignments a on a.position_id=p.id and a.status in ('CONFIRMED','RECONFIRMATION_REQUIRED','REPLACEMENT_REQUESTED','DISPUTED')
    left join public.profiles pr on pr.id=a.assigned_user_id
    left join public.coordination_offer_batches b on b.position_id=p.id and b.status='ACTIVE'
    where p.fixture_id=p_fixture_id
  ),'[]'::jsonb);
end;
$function$;

create or replace function public.coordination_list_eligible_people(p_position_id uuid,p_actor_mode text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_p record; v_division uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select p.*,pt.required_capability,pt.coordinator_permission,pt.code into v_p
  from public.coordination_positions p join public.coordination_position_types pt on pt.id=p.position_type_id where p.id=p_position_id;
  if not found or not private.coordination_permission_allowed(v_p.coordinator_permission,p_actor_mode,v_p.association_id,v_p.club_id,v_p.team_id) then raise exception 'You cannot view people for this position.'; end if;
  select division_id into v_division from public.fixtures where id=v_p.fixture_id;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id',pr.id,'name',coalesce(nullif(concat_ws(' ',pr.first_name,pr.last_name),''),'Unnamed user'),
      'availability',fa.status,'confirmed_load',(select count(*) from public.coordination_assignments load where load.assigned_user_id=pr.id and load.status in ('CONFIRMED','RECONFIRMATION_REQUIRED','REPLACEMENT_REQUESTED')),
      'completed_count',(select count(*) from public.coordination_assignments done join public.coordination_positions dp on dp.id=done.position_id join public.coordination_position_types dt on dt.id=dp.position_type_id where done.assigned_user_id=pr.id and done.status='COMPLETED' and dt.code=v_p.code),
      'grade_signed_off',case when v_p.code<>'UMPIRE' or v_division is null then true else exists(select 1 from public.umpire_grade_signoffs s where s.user_id=pr.id and s.association_id=v_p.association_id and s.division_id=v_division and s.status='SIGNED_OFF' and not exists(select 1 from public.umpire_grade_signoffs n where n.user_id=s.user_id and n.association_id=s.association_id and n.division_id=s.division_id and n.created_at>s.created_at)) end,
      'age_state',case when v_p.code<>'TECHNICAL_BENCH' then null when pr.date_of_birth is null then 'UNKNOWN' when age(v_p.starts_at::date,pr.date_of_birth)>=interval '18 years' then 'ADULT' else 'UNDER_18' end
    ) order by pr.last_name,pr.first_name)
    from public.profiles pr
    left join public.fixture_availability fa on fa.fixture_id=v_p.fixture_id and fa.user_id=pr.id
    where private.coordination_user_has_capability(pr.id,v_p.required_capability,v_p.association_id,v_p.club_id,v_p.team_id,v_p.starts_at::date)
  ),'[]'::jsonb);
end;
$function$;

create or replace function public.coordination_create_activity(
  p_name text,p_activity_type text,p_description text,p_scope_type text,p_scope_id uuid,
  p_starts_at timestamptz,p_ends_at timestamptz,p_location text,p_notes text,p_positions jsonb,p_actor_mode text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_scope record; v_activity uuid; v_item jsonb; v_type uuid; v_slot integer; v_count integer; v_label text;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select * into v_scope from private.coordination_scope_details(upper(p_scope_type),p_scope_id);
  if not found then raise exception 'The selected scope is invalid.'; end if;
  if not private.coordination_permission_allowed('coordination.activities.create',p_actor_mode,v_scope.association_id,v_scope.club_id,v_scope.team_id) then raise exception 'You cannot create an activity in this scope.'; end if;
  if p_ends_at<=p_starts_at then raise exception 'End time must be after start time.'; end if;
  insert into public.coordination_activities(name,activity_type,description,scope_type,association_id,club_id,team_id,starts_at,ends_at,location,status,coordinator_id,notes)
  values(btrim(p_name),coalesce(nullif(btrim(p_activity_type),''),'OTHER'),nullif(btrim(p_description),''),upper(p_scope_type),v_scope.association_id,v_scope.club_id,v_scope.team_id,p_starts_at,p_ends_at,nullif(btrim(p_location),''),'OPEN',auth.uid(),nullif(btrim(p_notes),'')) returning id into v_activity;
  for v_item in select value from jsonb_array_elements(coalesce(p_positions,'[]'::jsonb)) loop
    v_label:=btrim(v_item->>'label'); v_count:=greatest(1,least(50,coalesce((v_item->>'count')::integer,1)));
    select id into v_type from public.coordination_position_types where code=coalesce(nullif(v_item->>'type',''),'VOLUNTEER') and active;
    if v_type is null then select id into v_type from public.coordination_position_types where code='VOLUNTEER'; end if;
    for v_slot in 1..v_count loop
      insert into public.coordination_positions(activity_id,association_id,club_id,team_id,position_type_id,position_label,slot_number,starts_at,ends_at,created_by)
      values(v_activity,v_scope.association_id,v_scope.club_id,v_scope.team_id,v_type,coalesce(nullif(v_label,''),'Volunteer')||case when v_count>1 then ' '||v_slot else '' end,v_slot,p_starts_at,p_ends_at,auth.uid());
    end loop;
  end loop;
  return v_activity;
end;
$function$;

create or replace function public.coordination_late_assign(
  p_position_id uuid,p_user_id uuid,p_note text default null,p_actor_mode text default null,p_warning_override_note text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_p record; v_assignment uuid; v_warning text; v_status public.availability_status_enum;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  select p.*,pt.required_capability,pt.coordinator_permission,pt.code into v_p from public.coordination_positions p join public.coordination_position_types pt on pt.id=p.position_type_id where p.id=p_position_id for update of p;
  if not found or now()<v_p.starts_at then raise exception 'Late assignment is only available after the start time.'; end if;
  if not private.coordination_permission_allowed(v_p.coordinator_permission,p_actor_mode,v_p.association_id,v_p.club_id,v_p.team_id) then raise exception 'You cannot assign this position.'; end if;
  if not private.coordination_user_has_capability(p_user_id,v_p.required_capability,v_p.association_id,v_p.club_id,v_p.team_id,v_p.starts_at::date) then raise exception 'The person does not have the required capability.'; end if;
  if v_p.fixture_id is not null and exists(select 1 from public.fixture_availability where fixture_id=v_p.fixture_id and user_id=p_user_id and status='UNAVAILABLE') then v_warning:='EXPLICITLY_UNAVAILABLE'; end if;
  if v_warning is not null and nullif(btrim(p_warning_override_note),'') is null then raise exception 'A warning override note is required: %',v_warning; end if;
  insert into public.coordination_assignments(position_id,assigned_user_id,assigned_by,confirmed_by,starts_at,ends_at,late_assignment,confirmation_note)
  values(v_p.id,p_user_id,auth.uid(),auth.uid(),v_p.starts_at,v_p.ends_at,true,coalesce(nullif(btrim(p_warning_override_note),''),nullif(btrim(p_note),''))) returning id into v_assignment;
  update public.coordination_positions set state='FILLED',updated_at=now() where id=v_p.id;
  if v_p.fixture_id is not null then
    v_status:=case v_p.code when 'UMPIRE' then 'UMPIRING'::public.availability_status_enum when 'TECHNICAL_BENCH' then 'TECHNICAL_BENCH'::public.availability_status_enum else 'VOLUNTEERING'::public.availability_status_enum end;
    insert into public.fixture_availability(fixture_id,user_id,status,note) values(v_p.fixture_id,p_user_id,v_status,'Late Coordination assignment') on conflict(fixture_id,user_id) do update set status=excluded.status,note=excluded.note,updated_at=now();
  end if;
  insert into public.coordination_assignment_events(assignment_id,position_id,event_type,actor_id,detail) values(v_assignment,v_p.id,'LATE_ASSIGNMENT',auth.uid(),jsonb_build_object('note',nullif(btrim(p_note),'')));
  perform private.coordination_queue_notice(p_user_id,'LATE_ASSIGNMENT','ASSIGNMENT',v_assignment,'Roster confirmation','You were added to the completed match roster. Report this if it is incorrect.','/coordination/my-assignments?report='||v_assignment,'coordination:late:'||v_assignment);
  return v_assignment;
end;
$function$;

create or replace function public.coordination_dispute_late_assignment(p_assignment_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_a public.coordination_assignments%rowtype;
begin
  if nullif(btrim(p_reason),'') is null then raise exception 'A reason is required.'; end if;
  select * into v_a from public.coordination_assignments where id=p_assignment_id for update;
  if not found or v_a.assigned_user_id<>auth.uid() or not v_a.late_assignment or v_a.status<>'CONFIRMED' then raise exception 'This late roster entry cannot be disputed by you.'; end if;
  update public.coordination_assignments set status='DISPUTED',updated_at=now() where id=v_a.id;
  insert into public.coordination_assignment_events(assignment_id,position_id,event_type,actor_id,detail) values(v_a.id,v_a.position_id,'DISPUTED',auth.uid(),jsonb_build_object('reason',btrim(p_reason)));
  update public.umpire_match_roster_checks set result='ROSTER_DISPUTED',reviewed_status='PENDING',reviewed_by=null,reviewed_at=null where fixture_id=(select fixture_id from public.coordination_positions where id=v_a.position_id);
  perform private.coordination_queue_notice(v_a.confirmed_by,'LATE_ASSIGNMENT_DISPUTED','ASSIGNMENT',v_a.id,'Roster entry disputed','The person says this late roster entry is incorrect.','/coordination','coordination:late-dispute:'||v_a.id);
end;
$function$;

create or replace function public.coordination_create_capability_invite(
  p_user_id uuid,p_capability_type text,p_scope_type text,p_scope_id uuid,p_actor_mode text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_scope record; v_permission text; v_id uuid;
begin
  select * into v_scope from private.coordination_scope_details(upper(p_scope_type),p_scope_id);
  v_permission:=case upper(p_capability_type) when 'UMPIRE' then 'coordination.umpires.manage' when 'SUPERVISING_UMPIRE' then 'coordination.umpires.manage' when 'TECHNICAL_BENCH' then 'coordination.technical_bench.manage' else 'coordination.volunteers.manage' end;
  if not private.coordination_permission_allowed(v_permission,p_actor_mode,v_scope.association_id,v_scope.club_id,v_scope.team_id) then raise exception 'You cannot invite this capability in the selected scope.'; end if;
  insert into public.coordination_capability_invitations(user_id,capability_type,scope_type,scope_id,invited_by)
  values(p_user_id,upper(p_capability_type),upper(p_scope_type),p_scope_id,auth.uid()) returning id into v_id;
  perform private.coordination_queue_notice(p_user_id,'CAPABILITY_INVITE','CAPABILITY_INVITE',v_id,'Coordination capability invitation','Accept this invitation before you can receive assignments for this role.','/coordination/my-assignments','coordination:capability-invite:'||v_id);
  return v_id;
end;
$function$;

create or replace function public.coordination_respond_capability_invite(p_invitation_id uuid,p_accept boolean)
returns text language plpgsql security definer set search_path=''
as $function$
declare v_i public.coordination_capability_invitations%rowtype; v_status text;
begin
  select * into v_i from public.coordination_capability_invitations where id=p_invitation_id for update;
  if not found or v_i.user_id<>auth.uid() or v_i.status<>'PENDING' or v_i.expires_at<now() then raise exception 'This invitation is not available.'; end if;
  v_status:=case when p_accept then 'ACCEPTED' else 'DECLINED' end;
  update public.coordination_capability_invitations set status=v_status,responded_at=now(),updated_at=now() where id=v_i.id;
  if p_accept then
    insert into public.coordination_capabilities(user_id,capability_type,scope_type,scope_id,granted_by)
    values(v_i.user_id,v_i.capability_type,v_i.scope_type,v_i.scope_id,v_i.invited_by)
    on conflict (user_id,capability_type,scope_type,scope_id) where active do nothing;
  end if;
  perform private.coordination_queue_notice(v_i.invited_by,'CAPABILITY_INVITE_RESPONSE','CAPABILITY_INVITE',v_i.id,'Capability invitation response','The invitation was '||lower(v_status)||'.','/coordination','coordination:capability-response:'||v_i.id);
  return v_status;
end;
$function$;

create or replace function public.coordination_get_umpire_matrix(p_association_id uuid,p_actor_mode text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
begin
  if not private.coordination_permission_allowed('coordination.umpire_matrix.manage',p_actor_mode,p_association_id) and not private.coordination_permission_allowed('coordination.umpires.manage',p_actor_mode,p_association_id) then raise exception 'You cannot view this Umpire Matrix.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'user_id',p.id,'name',coalesce(nullif(concat_ws(' ',p.first_name,p.last_name),''),'Unnamed Umpire'),
    'completed_games',(select count(*) from public.coordination_assignments a join public.coordination_positions cp on cp.id=a.position_id join public.coordination_position_types pt on pt.id=cp.position_type_id where a.assigned_user_id=p.id and cp.association_id=p_association_id and pt.code='UMPIRE' and a.status='COMPLETED'),
    'upcoming_games',(select count(*) from public.coordination_assignments a join public.coordination_positions cp on cp.id=a.position_id join public.coordination_position_types pt on pt.id=cp.position_type_id where a.assigned_user_id=p.id and cp.association_id=p_association_id and pt.code='UMPIRE' and a.status in ('CONFIRMED','RECONFIRMATION_REQUIRED','REPLACEMENT_REQUESTED')),
    'grades',(select coalesce(jsonb_agg(jsonb_build_object('division_id',s.division_id,'division',d.name,'status',s.status,'effective_date',s.effective_date,'signed_by',concat_ws(' ',sp.first_name,sp.last_name),'created_at',s.created_at) order by s.created_at desc),'[]'::jsonb) from public.umpire_grade_signoffs s join public.divisions d on d.id=s.division_id join public.profiles sp on sp.id=s.signed_by where s.user_id=p.id and s.association_id=p_association_id),
    'qualifications',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'name',q.name,'issuer',q.issuer,'issued_on',q.issued_on,'expires_on',q.expires_on,'note',q.note) order by q.created_at desc),'[]'::jsonb) from public.umpire_qualifications q where q.user_id=p.id and q.association_id=p_association_id),
    'replacement_requests',(select count(*) from public.coordination_replacement_requests rr join public.coordination_assignments a on a.id=rr.assignment_id join public.coordination_positions cp on cp.id=a.position_id where a.assigned_user_id=p.id and cp.association_id=p_association_id)
  ) order by p.last_name,p.first_name) from public.profiles p where p.is_umpire or exists(select 1 from public.user_roles ur where ur.user_id=p.id and ur.role::text='UMPIRE') or exists(select 1 from public.coordination_capabilities c where c.user_id=p.id and c.capability_type='UMPIRE' and c.scope_type='ASSOCIATION' and c.scope_id=p_association_id and c.active)),'[]'::jsonb);
end;
$function$;

create or replace function public.coordination_add_supervision_link(p_supervisor_assignment_id uuid,p_supervised_assignment_id uuid,p_actor_mode text default null)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_s record; v_t record; v_id uuid;
begin
  select a.*,p.fixture_id,p.association_id,pt.code into v_s from public.coordination_assignments a join public.coordination_positions p on p.id=a.position_id join public.coordination_position_types pt on pt.id=p.position_type_id where a.id=p_supervisor_assignment_id;
  select a.*,p.fixture_id,p.association_id,pt.code into v_t from public.coordination_assignments a join public.coordination_positions p on p.id=a.position_id join public.coordination_position_types pt on pt.id=p.position_type_id where a.id=p_supervised_assignment_id;
  if v_s.assigned_user_id=v_t.assigned_user_id then raise exception 'An Umpire cannot supervise themselves.'; end if;
  if v_s.fixture_id is null or v_s.fixture_id<>v_t.fixture_id or v_s.code not in ('UMPIRE','SUPERVISING_UMPIRE') or v_t.code<>'UMPIRE' then raise exception 'Supervision must link different Umpires on the same fixture.'; end if;
  if not private.coordination_permission_allowed('coordination.umpires.manage',p_actor_mode,v_s.association_id) then raise exception 'You cannot add supervision for this fixture.'; end if;
  insert into public.coordination_supervision_links(supervisor_assignment_id,supervised_assignment_id,created_by) values(v_s.id,v_t.id,auth.uid()) returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.coordination_add_supervision_note(p_link_id uuid,p_content text,p_actor_mode text default null)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_link record; v_id uuid; v_allowed boolean;
begin
  if nullif(btrim(p_content),'') is null then raise exception 'A note is required.'; end if;
  select l.*,sa.assigned_user_id supervisor_user_id,p.association_id into v_link from public.coordination_supervision_links l join public.coordination_assignments sa on sa.id=l.supervisor_assignment_id join public.coordination_positions p on p.id=sa.position_id where l.id=p_link_id;
  v_allowed:=v_link.supervisor_user_id=auth.uid() or private.coordination_permission_allowed('coordination.umpires.manage',p_actor_mode,v_link.association_id);
  if not v_allowed then raise exception 'You cannot add this supervision note.'; end if;
  insert into public.coordination_supervision_notes(supervision_link_id,author_id,content) values(p_link_id,auth.uid(),btrim(p_content)) returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.coordination_get_fixture_positions(uuid,text) from public,anon;
revoke all on function public.coordination_list_eligible_people(uuid,text) from public,anon;
revoke all on function public.coordination_create_activity(text,text,text,text,uuid,timestamptz,timestamptz,text,text,jsonb,text) from public,anon;
revoke all on function public.coordination_late_assign(uuid,uuid,text,text,text) from public,anon;
revoke all on function public.coordination_dispute_late_assignment(uuid,text) from public,anon;
revoke all on function public.coordination_create_capability_invite(uuid,text,text,uuid,text) from public,anon;
revoke all on function public.coordination_respond_capability_invite(uuid,boolean) from public,anon;
revoke all on function public.coordination_get_umpire_matrix(uuid,text) from public,anon;
revoke all on function public.coordination_add_supervision_link(uuid,uuid,text) from public,anon;
revoke all on function public.coordination_add_supervision_note(uuid,text,text) from public,anon;
grant execute on function public.coordination_get_fixture_positions(uuid,text) to authenticated;
grant execute on function public.coordination_list_eligible_people(uuid,text) to authenticated;
grant execute on function public.coordination_create_activity(text,text,text,text,uuid,timestamptz,timestamptz,text,text,jsonb,text) to authenticated;
grant execute on function public.coordination_late_assign(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.coordination_dispute_late_assignment(uuid,text) to authenticated;
grant execute on function public.coordination_create_capability_invite(uuid,text,text,uuid,text) to authenticated;
grant execute on function public.coordination_respond_capability_invite(uuid,boolean) to authenticated;
grant execute on function public.coordination_get_umpire_matrix(uuid,text) to authenticated;
grant execute on function public.coordination_add_supervision_link(uuid,uuid,text) to authenticated;
grant execute on function public.coordination_add_supervision_note(uuid,text,text) to authenticated;

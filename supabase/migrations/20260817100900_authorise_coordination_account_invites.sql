-- Allow the invitation Edge Function to verify scope permission before it
-- performs the external side effect of sending an Auth account email.

create or replace function public.coordination_can_invite_capability(
  p_capability_type text,
  p_scope_type text,
  p_scope_id uuid,
  p_actor_mode text default null
) returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_scope record;
  v_permission text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select *
  into v_scope
  from private.coordination_scope_details(upper(p_scope_type),p_scope_id);

  if v_scope.association_id is null then
    return false;
  end if;

  v_permission:=case upper(p_capability_type)
    when 'UMPIRE' then 'coordination.umpires.manage'
    when 'SUPERVISING_UMPIRE' then 'coordination.umpires.manage'
    when 'TECHNICAL_BENCH' then 'coordination.technical_bench.manage'
    when 'VOLUNTEER' then 'coordination.volunteers.manage'
    else null
  end;

  if v_permission is null then
    return false;
  end if;

  return private.coordination_permission_allowed(
    v_permission,
    p_actor_mode,
    v_scope.association_id,
    v_scope.club_id,
    v_scope.team_id
  );
exception
  when others then
    return false;
end;
$function$;

revoke all on function public.coordination_can_invite_capability(text,text,uuid,text)
  from public,anon;
grant execute on function public.coordination_can_invite_capability(text,text,uuid,text)
  to authenticated;

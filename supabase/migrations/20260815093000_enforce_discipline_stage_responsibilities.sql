-- Enforce the displayed workflow responsibilities at the RPC boundary.

alter table public.discipline_case_members
  drop constraint discipline_case_members_role_check;

alter table public.discipline_case_members
  add constraint discipline_case_members_role_check check (
    case_role in (
      'CASE_COORDINATOR', 'LEAD_INVESTIGATOR', 'SUPPORT_INVESTIGATOR',
      'DECISION_MAKER', 'TRIBUNAL_MEMBER', 'TRIBUNAL_ADMINISTRATOR',
      'APPEAL_BOARD_MEMBER', 'READ_ONLY'
    )
  );

create or replace function private.discipline_can_read_case(
  p_case_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.discipline_has_case_role(
    p_case_id,
    array[
      'CASE_COORDINATOR', 'LEAD_INVESTIGATOR', 'SUPPORT_INVESTIGATOR',
      'DECISION_MAKER', 'TRIBUNAL_MEMBER', 'TRIBUNAL_ADMINISTRATOR',
      'APPEAL_BOARD_MEMBER', 'READ_ONLY'
    ]::text[],
    p_user_id
  );
$function$;

create or replace function private.discipline_can_complete_phase2_stage(
  p_case_id uuid,
  p_stage text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case p_stage
    when 'NOTICE' then private.discipline_has_case_role(
      p_case_id, array['CASE_COORDINATOR', 'TRIBUNAL_ADMINISTRATOR']::text[], p_user_id
    )
    when 'HEARING' then private.discipline_has_case_role(
      p_case_id, array['TRIBUNAL_MEMBER']::text[], p_user_id
    )
    when 'DETERMINATION' then private.discipline_has_case_role(
      p_case_id, array['TRIBUNAL_MEMBER']::text[], p_user_id
    )
    when 'APPEAL' then private.discipline_has_case_role(
      p_case_id, array['CASE_COORDINATOR', 'APPEAL_BOARD_MEMBER']::text[], p_user_id
    )
    when 'CLOSURE' then private.discipline_has_case_role(
      p_case_id, array['CASE_COORDINATOR']::text[], p_user_id
    )
    else false
  end;
$function$;

do $rewrite_phase2_permissions$
declare
  v_definition text;
  v_old text := $old$
  if v_actor_id is null or not private.discipline_can_manage_case(p_case_id, v_actor_id) then
    raise exception 'Only a Case Coordinator can save the post-referral workflow.';
  end if;$old$;
  v_new text := $new$
  if v_actor_id is null or not private.discipline_can_complete_phase2_stage(p_case_id, p_stage, v_actor_id) then
    raise exception 'Your assigned role cannot complete this post-referral stage.';
  end if;$new$;
begin
  select pg_get_functiondef(
    'public.save_discipline_phase2_stage(uuid,text,text,text,jsonb)'::regprocedure
  ) into v_definition;
  if position(v_old in v_definition) = 0 then
    raise exception 'The post-referral function permission block did not match the expected version.';
  end if;
  execute replace(v_definition, v_old, v_new);
end;
$rewrite_phase2_permissions$;

revoke all on function private.discipline_can_complete_phase2_stage(uuid, text, uuid) from public, anon;
grant execute on function private.discipline_can_complete_phase2_stage(uuid, text, uuid) to authenticated;

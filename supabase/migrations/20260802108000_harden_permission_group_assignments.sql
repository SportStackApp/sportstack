-- Prevent direct RPC callers from applying a permission group outside the
-- group's exact scope or to group members who are outside the caller's role
-- hierarchy. The UI already filters these groups; these checks enforce the
-- same boundary in the authoritative database write path.

create or replace function public.save_permission_assignment(
  p_assignment_id uuid,
  p_permission_set_id uuid,
  p_subject_type text,
  p_subject_key text,
  p_scope_type text,
  p_scope_id uuid,
  p_active boolean default true,
  p_actor_mode text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing public.permission_assignments%rowtype;
  v_set public.permission_sets%rowtype;
  v_group public.permission_groups%rowtype;
begin
  if not public.permission_mode_scope_allows(p_actor_mode, p_scope_type, p_scope_id) then
    raise exception 'You cannot assign permissions at this scope from the selected mode.';
  end if;

  if p_assignment_id is not null then
    select *
    into v_existing
    from public.permission_assignments assignment
    where assignment.id = p_assignment_id
    for update;

    if v_existing.id is not null
      and not public.permission_mode_scope_allows(
        p_actor_mode,
        v_existing.scope_type,
        v_existing.scope_id
      ) then
      raise exception 'The existing permission assignment is outside the selected mode scope.';
    end if;
  end if;

  select *
  into v_set
  from public.permission_sets set_row
  where set_row.id = p_permission_set_id
    and set_row.active
  for share;

  if v_set.id is null then
    raise exception 'The selected permission set was not found.';
  end if;
  if not public.permission_mode_scope_allows(
    p_actor_mode,
    v_set.owner_scope_type,
    v_set.owner_scope_id
  ) then
    raise exception 'The selected permission set is outside the selected mode scope.';
  end if;

  if not public.permission_subject_manageable(p_actor_mode, p_subject_type, p_subject_key) then
    raise exception 'You cannot assign permissions to this role or account from the selected mode.';
  end if;

  if p_subject_type = 'GROUP' then
    select *
    into v_group
    from public.permission_groups group_row
    where group_row.id::text = p_subject_key
      and group_row.active
    for share;

    if v_group.id is null then
      raise exception 'The selected permission group was not found.';
    end if;
    if v_group.scope_type is distinct from p_scope_type
      or v_group.scope_id is distinct from p_scope_id then
      raise exception 'The selected permission group must belong to the assignment scope.';
    end if;
    if not public.permission_mode_scope_allows(
      p_actor_mode,
      v_group.scope_type,
      v_group.scope_id
    ) then
      raise exception 'The selected permission group is outside the selected mode scope.';
    end if;
    if exists (
      select 1
      from public.permission_group_members group_member
      where group_member.group_id = v_group.id
        and (
          not public.permission_user_in_scope(
            group_member.user_id,
            p_scope_type,
            p_scope_id
          )
          or not public.permission_subject_manageable(
            p_actor_mode,
            'USER',
            group_member.user_id::text
          )
        )
    ) then
      raise exception 'The selected permission group contains an account outside this scope or role hierarchy.';
    end if;
  end if;

  return public.permission_save_assignment_unchecked(
    p_assignment_id,
    p_permission_set_id,
    p_subject_type,
    p_subject_key,
    p_scope_type,
    p_scope_id,
    p_active,
    p_actor_mode
  );
end;
$function$;

create or replace function public.save_permission_override(
  p_permission_key text,
  p_subject_type text,
  p_subject_key text,
  p_scope_type text,
  p_scope_id uuid,
  p_allowed boolean,
  p_reason text default null,
  p_active boolean default true,
  p_actor_mode text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing public.permission_overrides%rowtype;
  v_group public.permission_groups%rowtype;
begin
  if not public.permission_mode_scope_allows(p_actor_mode, p_scope_type, p_scope_id) then
    raise exception 'You cannot set permission overrides at this scope from the selected mode.';
  end if;

  select *
  into v_existing
  from public.permission_overrides override_row
  where override_row.permission_key = p_permission_key
    and override_row.subject_type = p_subject_type
    and override_row.subject_key = p_subject_key
    and override_row.scope_type = p_scope_type
    and override_row.scope_id = p_scope_id
    and override_row.active
  for update;

  if v_existing.id is not null
    and not public.permission_mode_scope_allows(
      p_actor_mode,
      v_existing.scope_type,
      v_existing.scope_id
    ) then
    raise exception 'The existing permission override is outside the selected mode scope.';
  end if;

  if not public.permission_subject_manageable(p_actor_mode, p_subject_type, p_subject_key) then
    raise exception 'You cannot set an exception for this role or account from the selected mode.';
  end if;

  if p_subject_type = 'GROUP' then
    select *
    into v_group
    from public.permission_groups group_row
    where group_row.id::text = p_subject_key
      and group_row.active
    for share;

    if v_group.id is null then
      raise exception 'The selected permission group was not found.';
    end if;
    if v_group.scope_type is distinct from p_scope_type
      or v_group.scope_id is distinct from p_scope_id then
      raise exception 'The selected permission group must belong to the override scope.';
    end if;
    if not public.permission_mode_scope_allows(
      p_actor_mode,
      v_group.scope_type,
      v_group.scope_id
    ) then
      raise exception 'The selected permission group is outside the selected mode scope.';
    end if;
    if exists (
      select 1
      from public.permission_group_members group_member
      where group_member.group_id = v_group.id
        and (
          not public.permission_user_in_scope(
            group_member.user_id,
            p_scope_type,
            p_scope_id
          )
          or not public.permission_subject_manageable(
            p_actor_mode,
            'USER',
            group_member.user_id::text
          )
        )
    ) then
      raise exception 'The selected permission group contains an account outside this scope or role hierarchy.';
    end if;
  end if;

  return public.permission_save_override_unchecked(
    p_permission_key,
    p_subject_type,
    p_subject_key,
    p_scope_type,
    p_scope_id,
    p_allowed,
    p_reason,
    p_active,
    p_actor_mode
  );
end;
$function$;

-- Public functions default to EXECUTE for PUBLIC. Rebuild the explicit Data
-- API boundary after replacing each SECURITY DEFINER wrapper.
revoke all on function public.save_permission_assignment(uuid, uuid, text, text, text, uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.save_permission_override(text, text, text, text, uuid, boolean, text, boolean, text)
  from public, anon, authenticated;

grant execute on function public.save_permission_assignment(uuid, uuid, text, text, text, uuid, boolean, text)
  to authenticated;
grant execute on function public.save_permission_override(text, text, text, text, uuid, boolean, text, boolean, text)
  to authenticated;

comment on function public.save_permission_assignment(uuid, uuid, text, text, text, uuid, boolean, text) is
  'Saves a mode-scoped permission assignment after validating the subject hierarchy and exact group scope.';
comment on function public.save_permission_override(text, text, text, text, uuid, boolean, text, boolean, text) is
  'Saves a mode-scoped permission override after validating the subject hierarchy and exact group scope.';

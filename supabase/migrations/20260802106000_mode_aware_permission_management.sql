-- Restrict advanced permission management to the scope of the caller's
-- selected "Viewing as" mode, not merely the highest role on their account.
-- Existing save implementations remain private so their validation and audit
-- behaviour is preserved behind the mode-aware wrappers below.

create or replace function public.permission_mode_scope_allows(
  p_actor_mode text,
  p_scope_type text,
  p_scope_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_details record;
begin
  -- Permission administration is deliberately unavailable in team-manager,
  -- coach and player modes, even if the signed-in account has a higher role.
  if v_mode not in ('super_admin', 'association', 'club') then
    return false;
  end if;

  select *
  into v_details
  from public.permission_scope_details(p_scope_type, p_scope_id);

  if not found then
    return false;
  end if;

  return public.administration_scope_allows(
    v_mode,
    v_details.association_id,
    v_details.club_id,
    v_details.team_id
  );
end;
$function$;

create or replace function public.permission_visible_profiles_for_mode(
  p_scope_type text,
  p_scope_id uuid,
  p_actor_mode text default null
)
returns table (profile_id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not public.permission_mode_scope_allows(p_actor_mode, p_scope_type, p_scope_id) then
    raise exception 'You cannot view permission subjects at this scope from the selected mode.';
  end if;

  return query
  select profile.id,
    coalesce(
      nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
      profile.id::text
    )
  from public.profiles profile
  where public.permission_user_in_scope(profile.id, p_scope_type, p_scope_id)
    and public.permission_subject_manageable(p_actor_mode, 'USER', profile.id::text)
  order by 2;
end;
$function$;

alter function public.save_permission_set(uuid, text, text, text, uuid, jsonb, boolean, text)
  rename to permission_save_set_unchecked;

create or replace function public.save_permission_group(
  p_group_id uuid,
  p_name text,
  p_description text,
  p_scope_type text,
  p_scope_id uuid,
  p_member_ids uuid[] default '{}',
  p_active boolean default true,
  p_actor_mode text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing public.permission_groups%rowtype;
begin
  if not public.permission_mode_scope_allows(p_actor_mode, p_scope_type, p_scope_id) then
    raise exception 'You cannot manage permission groups at this scope from the selected mode.';
  end if;

  if p_group_id is not null then
    select *
    into v_existing
    from public.permission_groups group_row
    where group_row.id = p_group_id
    for update;

    if v_existing.id is not null
      and not public.permission_mode_scope_allows(
        p_actor_mode,
        v_existing.scope_type,
        v_existing.scope_id
      ) then
      raise exception 'The existing permission group is outside the selected mode scope.';
    end if;
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_member_ids, '{}'::uuid[])) member_id
    where member_id is not null
      and not public.permission_subject_manageable(p_actor_mode, 'USER', member_id::text)
  ) then
    raise exception 'A selected group member is an equal or higher-role account.';
  end if;

  return public.permission_save_group_unchecked(
    p_group_id,
    p_name,
    p_description,
    p_scope_type,
    p_scope_id,
    p_member_ids,
    p_active,
    p_actor_mode
  );
end;
$function$;

create or replace function public.save_permission_set(
  p_permission_set_id uuid,
  p_name text,
  p_description text,
  p_scope_type text,
  p_scope_id uuid,
  p_permissions jsonb,
  p_active boolean default true,
  p_actor_mode text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing public.permission_sets%rowtype;
begin
  if not public.permission_mode_scope_allows(p_actor_mode, p_scope_type, p_scope_id) then
    raise exception 'You cannot manage permission sets at this scope from the selected mode.';
  end if;

  if p_permission_set_id is not null then
    select *
    into v_existing
    from public.permission_sets set_row
    where set_row.id = p_permission_set_id
    for update;

    if v_existing.id is not null
      and not public.permission_mode_scope_allows(
        p_actor_mode,
        v_existing.owner_scope_type,
        v_existing.owner_scope_id
      ) then
      raise exception 'The existing permission set is outside the selected mode scope.';
    end if;
  end if;

  return public.permission_save_set_unchecked(
    p_permission_set_id,
    p_name,
    p_description,
    p_scope_type,
    p_scope_id,
    p_permissions,
    p_active,
    p_actor_mode
  );
end;
$function$;

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
    if not public.permission_mode_scope_allows(
      p_actor_mode,
      v_group.scope_type,
      v_group.scope_id
    ) then
      raise exception 'The selected permission group is outside the selected mode scope.';
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
    if not public.permission_mode_scope_allows(
      p_actor_mode,
      v_group.scope_type,
      v_group.scope_id
    ) then
      raise exception 'The selected permission group is outside the selected mode scope.';
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

-- Owner-to-owner helpers only. They are not browser-callable Data API
-- endpoints, including the renamed implementation that retained the old
-- wrapper's privileges during ALTER FUNCTION.
revoke all on function public.permission_mode_scope_allows(text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.permission_scope_details(text, uuid)
  from public, anon, authenticated;
revoke all on function public.permission_user_in_scope(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.permission_subject_manageable(text, text, text)
  from public, anon, authenticated;
revoke all on function public.permission_save_group_unchecked(uuid, text, text, text, uuid, uuid[], boolean, text)
  from public, anon, authenticated;
revoke all on function public.permission_save_set_unchecked(uuid, text, text, text, uuid, jsonb, boolean, text)
  from public, anon, authenticated;
revoke all on function public.permission_save_assignment_unchecked(uuid, uuid, text, text, text, uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.permission_save_override_unchecked(text, text, text, text, uuid, boolean, text, boolean, text)
  from public, anon, authenticated;

-- Explicit Data API boundary: only signed-in callers may execute the guarded
-- wrappers. Every wrapper validates the selected mode and requested scope.
revoke all on function public.permission_visible_profiles_for_mode(text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.save_permission_group(uuid, text, text, text, uuid, uuid[], boolean, text)
  from public, anon, authenticated;
revoke all on function public.save_permission_set(uuid, text, text, text, uuid, jsonb, boolean, text)
  from public, anon, authenticated;
revoke all on function public.save_permission_assignment(uuid, uuid, text, text, text, uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.save_permission_override(text, text, text, text, uuid, boolean, text, boolean, text)
  from public, anon, authenticated;

grant execute on function public.permission_visible_profiles_for_mode(text, uuid, text)
  to authenticated;
grant execute on function public.save_permission_group(uuid, text, text, text, uuid, uuid[], boolean, text)
  to authenticated;
grant execute on function public.save_permission_set(uuid, text, text, text, uuid, jsonb, boolean, text)
  to authenticated;
grant execute on function public.save_permission_assignment(uuid, uuid, text, text, text, uuid, boolean, text)
  to authenticated;
grant execute on function public.save_permission_override(text, text, text, text, uuid, boolean, text, boolean, text)
  to authenticated;

comment on function public.permission_mode_scope_allows(text, text, uuid) is
  'Internal mode-aware scope guard for advanced permission administration.';

-- Keep permission management inside the same role hierarchy as user administration.
-- The original scoped save functions remain private implementation details; the
-- public wrappers below reject attempts to target an equal or higher role.

create or replace function public.permission_subject_manageable(
  p_actor_mode text,
  p_subject_type text,
  p_subject_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_user_id uuid;
begin
  if v_mode = 'super_admin' then return true; end if;

  if p_subject_type = 'GROUP' then return true; end if;

  if p_subject_type = 'ROLE' then
    if v_mode = 'association' then
      return p_subject_key in ('CLUB_ADMIN','TEAM_MANAGER','COACH','PLAYER','UMPIRE','VOTER','UMPIRE_ADMIN');
    elsif v_mode = 'club' then
      return p_subject_key in ('TEAM_MANAGER','COACH','PLAYER','UMPIRE','VOTER');
    end if;
    return false;
  end if;

  if p_subject_type <> 'USER' then return false; end if;
  begin
    v_user_id := p_subject_key::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if v_mode = 'association' then
    return not exists (
      select 1 from public.user_roles role_row
      where role_row.user_id = v_user_id
        and role_row.role::text in ('SUPER_ADMIN','ASSOCIATION_ADMIN')
    );
  elsif v_mode = 'club' then
    return not exists (
      select 1 from public.user_roles role_row
      where role_row.user_id = v_user_id
        and role_row.role::text in ('SUPER_ADMIN','ASSOCIATION_ADMIN','CLUB_ADMIN')
    );
  end if;
  return false;
end;
$function$;

alter function public.save_permission_group(uuid, text, text, text, uuid, uuid[], boolean, text)
  rename to permission_save_group_unchecked;
alter function public.save_permission_assignment(uuid, uuid, text, text, text, uuid, boolean, text)
  rename to permission_save_assignment_unchecked;
alter function public.save_permission_override(text, text, text, text, uuid, boolean, text, boolean, text)
  rename to permission_save_override_unchecked;

revoke all on function public.permission_save_group_unchecked(uuid, text, text, text, uuid, uuid[], boolean, text)
  from public, anon, authenticated;
revoke all on function public.permission_save_assignment_unchecked(uuid, uuid, text, text, text, uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.permission_save_override_unchecked(text, text, text, text, uuid, boolean, text, boolean, text)
  from public, anon, authenticated;

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
begin
  if exists (
    select 1 from unnest(coalesce(p_member_ids, '{}'::uuid[])) member_id
    where not public.permission_subject_manageable(p_actor_mode, 'USER', member_id::text)
  ) then
    raise exception 'A selected group member is an equal or higher-role account.';
  end if;
  return public.permission_save_group_unchecked(
    p_group_id, p_name, p_description, p_scope_type, p_scope_id,
    p_member_ids, p_active, p_actor_mode
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
begin
  if not public.permission_subject_manageable(p_actor_mode, p_subject_type, p_subject_key) then
    raise exception 'You cannot assign permissions to this role or account from the selected mode.';
  end if;
  return public.permission_save_assignment_unchecked(
    p_assignment_id, p_permission_set_id, p_subject_type, p_subject_key,
    p_scope_type, p_scope_id, p_active, p_actor_mode
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
begin
  if not public.permission_subject_manageable(p_actor_mode, p_subject_type, p_subject_key) then
    raise exception 'You cannot set an exception for this role or account from the selected mode.';
  end if;
  return public.permission_save_override_unchecked(
    p_permission_key, p_subject_type, p_subject_key, p_scope_type, p_scope_id,
    p_allowed, p_reason, p_active, p_actor_mode
  );
end;
$function$;

create or replace function public.permission_visible_profiles_for_mode(
  p_scope_type text,
  p_scope_id uuid,
  p_actor_mode text default null
)
returns table (profile_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $function$
  select profile.id,
    coalesce(nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''), profile.id::text)
  from public.profiles profile
  where public.permission_user_in_scope(profile.id, p_scope_type, p_scope_id)
    and public.permission_subject_manageable(p_actor_mode, 'USER', profile.id::text)
  order by 2;
$function$;

revoke all on function public.permission_subject_manageable(text, text, text) from public, anon, authenticated;
revoke all on function public.permission_visible_profiles_for_mode(text, uuid, text) from public, anon;
grant execute on function public.permission_visible_profiles_for_mode(text, uuid, text) to authenticated;

revoke all on function public.save_permission_group(uuid, text, text, text, uuid, uuid[], boolean, text) from public, anon;
revoke all on function public.save_permission_assignment(uuid, uuid, text, text, text, uuid, boolean, text) from public, anon;
revoke all on function public.save_permission_override(text, text, text, text, uuid, boolean, text, boolean, text) from public, anon;
grant execute on function public.save_permission_group(uuid, text, text, text, uuid, uuid[], boolean, text) to authenticated;
grant execute on function public.save_permission_assignment(uuid, uuid, text, text, text, uuid, boolean, text) to authenticated;
grant execute on function public.save_permission_override(text, text, text, text, uuid, boolean, text, boolean, text) to authenticated;

comment on function public.permission_subject_manageable(text, text, text) is
  'Enforces the administration role hierarchy for permission groups, sets and direct exceptions.';

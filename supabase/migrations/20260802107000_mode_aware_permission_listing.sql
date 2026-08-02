-- Advanced permission administration must honour the selected "Viewing as"
-- mode for reads as well as writes. The browser receives only records for the
-- currently selected scope through this guarded RPC; direct Data API reads of
-- the underlying management tables are removed from authenticated users.

create or replace function public.list_permission_management_records_for_mode(
  p_scope_type text,
  p_scope_id uuid,
  p_actor_mode text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_groups jsonb;
  v_group_members jsonb;
  v_sets jsonb;
  v_set_permissions jsonb;
  v_assignments jsonb;
  v_overrides jsonb;
begin
  if not public.permission_mode_scope_allows(
    p_actor_mode,
    p_scope_type,
    p_scope_id
  ) then
    raise exception 'You cannot view permission records at this scope from the selected mode.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(group_row) order by group_row.name, group_row.id), '[]'::jsonb)
  into v_groups
  from public.permission_groups group_row
  where group_row.scope_type = p_scope_type
    and group_row.scope_id = p_scope_id
    and not exists (
      select 1
      from public.permission_group_members hidden_member
      where hidden_member.group_id = group_row.id
        and (
          not public.permission_user_in_scope(hidden_member.user_id, p_scope_type, p_scope_id)
          or not public.permission_subject_manageable(p_actor_mode, 'USER', hidden_member.user_id::text)
        )
    );

  select coalesce(jsonb_agg(to_jsonb(member_row) order by member_row.added_at, member_row.user_id), '[]'::jsonb)
  into v_group_members
  from public.permission_group_members member_row
  join public.permission_groups group_row on group_row.id = member_row.group_id
  where group_row.scope_type = p_scope_type
    and group_row.scope_id = p_scope_id
    and public.permission_user_in_scope(member_row.user_id, p_scope_type, p_scope_id)
    and public.permission_subject_manageable(p_actor_mode, 'USER', member_row.user_id::text)
    and not exists (
      select 1
      from public.permission_group_members hidden_member
      where hidden_member.group_id = group_row.id
        and (
          not public.permission_user_in_scope(hidden_member.user_id, p_scope_type, p_scope_id)
          or not public.permission_subject_manageable(p_actor_mode, 'USER', hidden_member.user_id::text)
        )
    );

  select coalesce(jsonb_agg(to_jsonb(set_row) order by set_row.name, set_row.id), '[]'::jsonb)
  into v_sets
  from public.permission_sets set_row
  where set_row.owner_scope_type = p_scope_type
    and set_row.owner_scope_id = p_scope_id;

  select coalesce(jsonb_agg(to_jsonb(set_permission) order by set_permission.permission_set_id, set_permission.permission_key), '[]'::jsonb)
  into v_set_permissions
  from public.permission_set_permissions set_permission
  join public.permission_sets set_row on set_row.id = set_permission.permission_set_id
  where set_row.owner_scope_type = p_scope_type
    and set_row.owner_scope_id = p_scope_id;

  select coalesce(jsonb_agg(to_jsonb(assignment) order by assignment.created_at desc, assignment.id), '[]'::jsonb)
  into v_assignments
  from public.permission_assignments assignment
  where assignment.scope_type = p_scope_type
    and assignment.scope_id = p_scope_id
    and public.permission_subject_manageable(
      p_actor_mode,
      assignment.subject_type,
      assignment.subject_key
    )
    and (
      assignment.subject_type <> 'GROUP'
      or exists (
        select 1
        from public.permission_groups subject_group
        where subject_group.id::text = assignment.subject_key
          and subject_group.scope_type = p_scope_type
          and subject_group.scope_id = p_scope_id
          and not exists (
            select 1
            from public.permission_group_members hidden_member
            where hidden_member.group_id = subject_group.id
              and (
                not public.permission_user_in_scope(hidden_member.user_id, p_scope_type, p_scope_id)
                or not public.permission_subject_manageable(p_actor_mode, 'USER', hidden_member.user_id::text)
              )
          )
      )
    )
    and (
      assignment.subject_type <> 'USER'
      or exists (
        select 1
        from public.profiles subject_profile
        where subject_profile.id::text = assignment.subject_key
          and public.permission_user_in_scope(subject_profile.id, p_scope_type, p_scope_id)
      )
    )
    and exists (
      select 1
      from public.permission_sets assigned_set
      where assigned_set.id = assignment.permission_set_id
        and assigned_set.owner_scope_type = p_scope_type
        and assigned_set.owner_scope_id = p_scope_id
    );

  select coalesce(jsonb_agg(to_jsonb(override_row) order by override_row.created_at desc, override_row.id), '[]'::jsonb)
  into v_overrides
  from public.permission_overrides override_row
  where override_row.scope_type = p_scope_type
    and override_row.scope_id = p_scope_id
    and public.permission_subject_manageable(
      p_actor_mode,
      override_row.subject_type,
      override_row.subject_key
    )
    and (
      override_row.subject_type <> 'GROUP'
      or exists (
        select 1
        from public.permission_groups subject_group
        where subject_group.id::text = override_row.subject_key
          and subject_group.scope_type = p_scope_type
          and subject_group.scope_id = p_scope_id
          and not exists (
            select 1
            from public.permission_group_members hidden_member
            where hidden_member.group_id = subject_group.id
              and (
                not public.permission_user_in_scope(hidden_member.user_id, p_scope_type, p_scope_id)
                or not public.permission_subject_manageable(p_actor_mode, 'USER', hidden_member.user_id::text)
              )
          )
      )
    )
    and (
      override_row.subject_type <> 'USER'
      or exists (
        select 1
        from public.profiles subject_profile
        where subject_profile.id::text = override_row.subject_key
          and public.permission_user_in_scope(subject_profile.id, p_scope_type, p_scope_id)
      )
    );

  return jsonb_build_object(
    'groups', v_groups,
    'group_members', v_group_members,
    'sets', v_sets,
    'set_permissions', v_set_permissions,
    'assignments', v_assignments,
    'overrides', v_overrides
  );
end;
$function$;

-- Preserve the existing RLS policies as defence in depth, but remove the
-- account-level direct read path that could ignore a lower Viewing-as mode.
revoke select on table public.permission_groups from authenticated;
revoke select on table public.permission_group_members from authenticated;
revoke select on table public.permission_sets from authenticated;
revoke select on table public.permission_set_permissions from authenticated;
revoke select on table public.permission_assignments from authenticated;
revoke select on table public.permission_overrides from authenticated;

revoke all on function public.list_permission_management_records_for_mode(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.list_permission_management_records_for_mode(text, uuid, text)
  to authenticated;

comment on function public.list_permission_management_records_for_mode(text, uuid, text) is
  'Returns advanced permission records only for one scope authorised by the selected administration mode.';

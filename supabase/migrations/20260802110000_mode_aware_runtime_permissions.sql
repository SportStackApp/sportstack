-- Runtime module access must honour the active Viewing-as mode. The previous
-- resolver inspected every role on the signed-in account, so a higher stored
-- role could still win while the interface was deliberately in a lower mode.

create or replace function public.permission_subject_matches_for_mode(
  p_user_id uuid,
  p_effective_mode text,
  p_subject_type text,
  p_subject_key text,
  p_rule_scope_type text,
  p_rule_scope_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case p_subject_type
    when 'USER' then p_subject_key = p_user_id::text
    when 'GROUP' then exists (
      select 1
      from public.permission_group_members member
      join public.permission_groups group_row
        on group_row.id = member.group_id
       and group_row.active
       and group_row.scope_type = p_rule_scope_type
       and group_row.scope_id = p_rule_scope_id
      where member.user_id = p_user_id
        and group_row.id::text = p_subject_key
    )
    when 'ROLE' then case p_effective_mode
      when 'super_admin' then p_subject_key = 'SUPER_ADMIN'
      when 'association' then p_subject_key = 'ASSOCIATION_ADMIN'
      when 'club' then p_subject_key = 'CLUB_ADMIN'
      when 'team_manager' then p_subject_key = 'TEAM_MANAGER'
      when 'coach' then p_subject_key = 'COACH'
      when 'player' then
        (
          p_subject_key = 'PLAYER'
          and public.permission_user_in_scope(
            p_user_id, p_rule_scope_type, p_rule_scope_id
          )
        )
        or (
          p_subject_key in ('UMPIRE', 'VOTER', 'UMPIRE_ADMIN')
          and exists (
            select 1
            from public.user_roles role_row
            where role_row.user_id = p_user_id
              and role_row.role::text = p_subject_key
          )
        )
      else false
    end
    else false
  end;
$function$;

create or replace function public.resolve_effective_permission_for_mode(
  p_permission_key text,
  p_actor_mode text,
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_division_id uuid default null,
  p_team_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_mode text;
  v_module_key text;
  v_default boolean;
  v_allowed boolean;
  v_source text;
  v_scope_type text;
  v_scope_id uuid;
  v_association_id uuid := p_association_id;
  v_club_id uuid := p_club_id;
  v_division_id uuid := p_division_id;
  v_team_id uuid := p_team_id;
  v_actual_association_id uuid;
  v_actual_club_id uuid;
  v_actual_division_id uuid;
  v_is_super_admin boolean;
  v_scope_allowed boolean := false;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  -- This validates that the requested mode is actually available to the
  -- caller. A real Super Admin may deliberately request a lower preview mode.
  v_mode := public.administration_effective_mode(p_actor_mode);
  v_is_super_admin := public.is_super_admin();

  select catalogue.module_key, catalogue.default_allowed
  into v_module_key, v_default
  from public.permission_catalogue catalogue
  where catalogue.permission_key = p_permission_key;
  if not found then
    raise exception 'Unknown permission key.';
  end if;

  -- Canonicalise and verify the cascade before evaluating any rule. This
  -- prevents a caller combining IDs from unrelated organisations.
  if v_team_id is not null then
    select club.association_id, team.club_id, team.division_id
    into v_actual_association_id, v_actual_club_id, v_actual_division_id
    from public.teams team
    join public.clubs club on club.id = team.club_id
    where team.id = v_team_id;

    if not found then
      raise exception 'The selected team does not exist.';
    end if;
    if v_association_id is not null and v_association_id <> v_actual_association_id then
      raise exception 'The selected team is outside the association scope.';
    end if;
    if v_club_id is not null and v_club_id <> v_actual_club_id then
      raise exception 'The selected team is outside the club scope.';
    end if;
    v_association_id := v_actual_association_id;
    v_club_id := v_actual_club_id;

    -- A team can be linked to several divisions through team_divisions, and
    -- legacy teams can have a null or different teams.division_id. Keep the
    -- requested cascade division when either source confirms the mapping.
    if v_division_id is not null then
      if v_division_id is distinct from v_actual_division_id
        and not exists (
          select 1
          from public.team_divisions team_division
          where team_division.team_id = v_team_id
            and team_division.division_id = v_division_id
        )
      then
        raise exception 'The selected team is outside the division scope.';
      end if;
    else
      v_division_id := v_actual_division_id;
    end if;
  end if;

  if v_club_id is not null then
    select club.association_id
    into v_actual_association_id
    from public.clubs club
    where club.id = v_club_id;

    if not found then
      raise exception 'The selected club does not exist.';
    end if;
    if v_association_id is not null and v_association_id <> v_actual_association_id then
      raise exception 'The selected club is outside the association scope.';
    end if;
    v_association_id := v_actual_association_id;
  end if;

  if v_division_id is not null then
    select division.association_id
    into v_actual_association_id
    from public.divisions division
    where division.id = v_division_id;

    if not found then
      raise exception 'The selected division does not exist.';
    end if;
    if v_association_id is not null and v_association_id <> v_actual_association_id then
      raise exception 'The selected division is outside the association scope.';
    end if;
    v_association_id := v_actual_association_id;
  end if;

  if v_association_id is not null and not exists (
    select 1 from public.associations association
    where association.id = v_association_id
  ) then
    raise exception 'The selected association does not exist.';
  end if;

  -- Validate the selected scope against the active mode. Coach and Player
  -- are runtime modes rather than permission-administration modes, so their
  -- team access is checked directly here.
  if v_mode = 'super_admin' then
    v_scope_allowed := v_is_super_admin;
  elsif v_mode = 'association' then
    v_scope_allowed := v_association_id is not null
      and public.administration_scope_allows(
        v_mode, v_association_id, v_club_id, v_team_id
      );
  elsif v_mode = 'club' then
    v_scope_allowed := v_club_id is not null
      and public.administration_scope_allows(
        v_mode, v_association_id, v_club_id, v_team_id
      );
  elsif v_mode = 'team_manager' then
    v_scope_allowed := v_team_id is not null
      and public.administration_scope_allows(
        v_mode, v_association_id, v_club_id, v_team_id
      );
  elsif v_mode = 'coach' then
    v_scope_allowed := v_team_id is not null and (
      v_is_super_admin
      or exists (
        select 1
        from public.user_roles role_row
        where role_row.user_id = v_user_id
          and role_row.role::text = 'COACH'
          and role_row.team_id = v_team_id
      )
    );
  elsif v_mode = 'player' then
    v_scope_allowed := (
      v_team_id is not null
      and (
        v_is_super_admin
        or exists (
          select 1
          from public.user_roles role_row
          where role_row.user_id = v_user_id
            and role_row.role::text = 'PLAYER'
            and role_row.team_id = v_team_id
        )
        or exists (
          select 1
          from public.team_memberships membership
          where membership.user_id = v_user_id
            and membership.team_id = v_team_id
            and membership.status::text = 'ACTIVE'
        )
      )
    ) or exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = v_user_id
        and role_row.role::text in ('UMPIRE', 'VOTER', 'UMPIRE_ADMIN')
    );
  end if;

  if not v_scope_allowed then
    raise exception 'The selected scope is not available in the active mode.';
  end if;

  with scope_chain as (
    select 'ASSOCIATION'::text as scope_type, v_association_id as scope_id, 1 as scope_rank
    where v_association_id is not null
    union all
    select 'CLUB', v_club_id, 2 where v_club_id is not null
    union all
    select 'DIVISION', v_division_id, 3 where v_division_id is not null
    union all
    select 'TEAM', v_team_id, 4 where v_team_id is not null
  ), candidates as (
    select override_row.allowed,
      'DIRECT_' || override_row.subject_type as source,
      chain.scope_type,
      chain.scope_id,
      chain.scope_rank,
      case override_row.subject_type
        when 'USER' then 300 when 'GROUP' then 200 else 100
      end as subject_rank,
      20 as rule_rank,
      override_row.updated_at
    from public.permission_overrides override_row
    join scope_chain chain
      on chain.scope_type = override_row.scope_type
     and chain.scope_id = override_row.scope_id
    where override_row.permission_key = p_permission_key
      and override_row.active
      and public.permission_subject_matches_for_mode(
        v_user_id,
        v_mode,
        override_row.subject_type,
        override_row.subject_key,
        chain.scope_type,
        chain.scope_id
      )

    union all

    select set_permission.allowed,
      'SET_' || assignment.subject_type,
      chain.scope_type,
      chain.scope_id,
      chain.scope_rank,
      case assignment.subject_type
        when 'USER' then 300 when 'GROUP' then 200 else 100
      end,
      10,
      assignment.updated_at
    from public.permission_assignments assignment
    join public.permission_sets set_row
      on set_row.id = assignment.permission_set_id
     and set_row.active
    join public.permission_set_permissions set_permission
      on set_permission.permission_set_id = set_row.id
    join scope_chain chain
      on chain.scope_type = assignment.scope_type
     and chain.scope_id = assignment.scope_id
    where set_permission.permission_key = p_permission_key
      and assignment.active
      and public.permission_subject_matches_for_mode(
        v_user_id,
        v_mode,
        assignment.subject_type,
        assignment.subject_key,
        chain.scope_type,
        chain.scope_id
      )
  )
  select candidate.allowed,
    candidate.source,
    candidate.scope_type,
    candidate.scope_id
  into v_allowed, v_source, v_scope_type, v_scope_id
  from candidates candidate
  order by candidate.scope_rank desc,
    candidate.subject_rank desc,
    candidate.rule_rank desc,
    candidate.allowed asc,
    candidate.updated_at desc
  limit 1;

  if v_allowed is null and p_permission_key like 'module.%.access' then
    v_allowed := public.resolve_module_enabled(
      v_module_key,
      v_association_id,
      v_club_id,
      v_division_id,
      v_team_id
    );
    v_source := 'MODULE_SCOPE';
  end if;

  if v_allowed is null then
    v_allowed := v_default;
    v_source := 'CATALOGUE_DEFAULT';
  end if;

  return jsonb_build_object(
    'permission_key', p_permission_key,
    'actor_mode', v_mode,
    'allowed', coalesce(v_allowed, false),
    'source', v_source,
    'scope_type', v_scope_type,
    'scope_id', v_scope_id
  );
end;
$function$;

-- The older account-level resolver and boolean helper cannot express an
-- active UI mode, so they are no longer browser-callable. They remain
-- service-only for controlled maintenance and backwards-compatible internal
-- function calls.
revoke all on function public.resolve_effective_permission(
  text, uuid, uuid, uuid, uuid, uuid
) from public, anon, authenticated;
revoke all on function public.has_effective_permission(
  text, uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.resolve_effective_permission(
  text, uuid, uuid, uuid, uuid, uuid
) to service_role;
grant execute on function public.has_effective_permission(
  text, uuid, uuid, uuid, uuid
) to service_role;

revoke all on function public.permission_subject_matches_for_mode(
  uuid, text, text, text, text, uuid
) from public, anon, authenticated;
revoke all on function public.resolve_effective_permission_for_mode(
  text, text, uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.resolve_effective_permission_for_mode(
  text, text, uuid, uuid, uuid, uuid
) to authenticated;

comment on function public.permission_subject_matches_for_mode(
  uuid, text, text, text, text, uuid
) is
  'Private subject matcher that applies only the active role mode and exact group scope.';
comment on function public.resolve_effective_permission_for_mode(
  text, text, uuid, uuid, uuid, uuid
) is
  'Resolves runtime permission for the signed-in user after validating active mode and cascade scope.';

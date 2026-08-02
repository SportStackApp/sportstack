-- Extend the live-session permission mode with the selected organisation
-- cascade. Runtime permissions must use this stored, server-validated context
-- instead of trusting independently supplied browser mode and scope values.

alter table private.auth_session_permission_modes
  add column if not exists association_id uuid
    references public.associations(id) on delete set null,
  add column if not exists club_id uuid
    references public.clubs(id) on delete set null,
  add column if not exists division_id uuid
    references public.divisions(id) on delete set null,
  add column if not exists team_id uuid
    references public.teams(id) on delete set null;

create or replace function private.permission_context_canonical_scope(
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_division_id uuid default null,
  p_team_id uuid default null
)
returns table (
  association_id uuid,
  club_id uuid,
  division_id uuid,
  team_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_association_id uuid := p_association_id;
  v_club_id uuid := p_club_id;
  v_division_id uuid := p_division_id;
  v_team_id uuid := p_team_id;
  v_actual_association_id uuid;
  v_actual_club_id uuid;
  v_actual_division_id uuid;
begin
  if v_team_id is not null then
    select club.association_id, team.club_id, team.division_id
    into v_actual_association_id, v_actual_club_id, v_actual_division_id
    from public.teams team
    join public.clubs club on club.id = team.club_id
    where team.id = v_team_id;

    if not found then
      raise exception 'The selected team does not exist.';
    end if;

    -- Some imported teams use the team_divisions junction instead of the
    -- legacy teams.division_id column. Choose one deterministic division so a
    -- bootstrapped team context still contains the complete cascade.
    if v_actual_division_id is null then
      select team_division.division_id
      into v_actual_division_id
      from public.team_divisions team_division
      where team_division.team_id = v_team_id
      order by team_division.division_id
      limit 1;
    end if;
    if v_association_id is not null
      and v_association_id <> v_actual_association_id then
      raise exception 'The selected team is outside the association scope.';
    end if;
    if v_club_id is not null and v_club_id <> v_actual_club_id then
      raise exception 'The selected team is outside the club scope.';
    end if;

    v_association_id := v_actual_association_id;
    v_club_id := v_actual_club_id;

    if v_division_id is not null then
      if v_division_id is distinct from v_actual_division_id
        and not exists (
          select 1
          from public.team_divisions team_division
          where team_division.team_id = v_team_id
            and team_division.division_id = v_division_id
        ) then
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
    if v_association_id is not null
      and v_association_id <> v_actual_association_id then
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
    if v_association_id is not null
      and v_association_id <> v_actual_association_id then
      raise exception 'The selected division is outside the association scope.';
    end if;
    v_association_id := v_actual_association_id;
  end if;

  if v_association_id is not null and not exists (
    select 1
    from public.associations association
    where association.id = v_association_id
  ) then
    raise exception 'The selected association does not exist.';
  end if;

  -- A division is association-owned rather than club-owned. When the browser
  -- supplies both without a team, require at least one club team in that
  -- division so unrelated cascade values cannot be combined.
  if v_team_id is null and v_club_id is not null and v_division_id is not null
    and not exists (
      select 1
      from public.teams team
      where team.club_id = v_club_id
        and (
          team.division_id = v_division_id
          or exists (
            select 1
            from public.team_divisions team_division
            where team_division.team_id = team.id
              and team_division.division_id = v_division_id
          )
        )
    ) then
    raise exception 'The selected division is outside the club scope.';
  end if;

  return query
  select v_association_id, v_club_id, v_division_id, v_team_id;
end;
$function$;

revoke all on function private.permission_context_canonical_scope(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated;

create or replace function private.active_permission_mode_for_current_session()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_mode text;
begin
  if v_user_id is null then
    return null;
  end if;

  begin
    v_session_id := nullif(auth.jwt()->>'session_id', '')::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;

  if v_session_id is null then
    return null;
  end if;

  select mode_row.active_mode
  into v_mode
  from private.auth_session_permission_modes mode_row
  join auth.sessions session_row
    on session_row.id = mode_row.session_id
   and session_row.user_id = mode_row.user_id
  where mode_row.session_id = v_session_id
    and mode_row.user_id = v_user_id
    and (session_row.not_after is null or session_row.not_after > now());

  return v_mode;
end;
$function$;

revoke all on function private.active_permission_mode_for_current_session()
  from public, anon, authenticated;

create or replace function public.get_active_permission_mode()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  begin
    v_session_id := nullif(auth.jwt()->>'session_id', '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'The current authentication session is not valid.';
  end;

  if v_session_id is null or not exists (
    select 1
    from auth.sessions session_row
    where session_row.id = v_session_id
      and session_row.user_id = v_user_id
      and (session_row.not_after is null or session_row.not_after > now())
  ) then
    raise exception 'The current authentication session is no longer active.';
  end if;

  return (
    select jsonb_build_object(
      'root_mode', mode_row.root_mode,
      'active_mode', mode_row.active_mode,
      'association_id', mode_row.association_id,
      'club_id', mode_row.club_id,
      'division_id', mode_row.division_id,
      'team_id', mode_row.team_id,
      'revision', mode_row.revision
    )
    from private.auth_session_permission_modes mode_row
    where mode_row.session_id = v_session_id
      and mode_row.user_id = v_user_id
  );
end;
$function$;

revoke all on function public.get_active_permission_mode()
  from public, anon, authenticated;
grant execute on function public.get_active_permission_mode()
  to authenticated;

create or replace function public.set_active_permission_context(
  p_root_mode text,
  p_active_mode text,
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_division_id uuid default null,
  p_team_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_root_mode text;
  v_active_mode text;
  v_association_id uuid;
  v_club_id uuid;
  v_division_id uuid;
  v_team_id uuid;
  v_revision bigint;
  v_result jsonb;
  v_actual_super_admin boolean;
  v_scope_is_empty boolean;
  v_required_role text;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  begin
    v_session_id := nullif(auth.jwt()->>'session_id', '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'The current authentication session is not valid.';
  end;

  if v_session_id is null or not exists (
    select 1
    from auth.sessions session_row
    where session_row.id = v_session_id
      and session_row.user_id = v_user_id
      and (session_row.not_after is null or session_row.not_after > now())
  ) then
    raise exception 'The current authentication session is no longer active.';
  end if;

  if lower(trim(coalesce(p_root_mode, ''))) not in (
    'super_admin', 'association', 'club', 'team_manager', 'coach', 'player'
  ) or lower(trim(coalesce(p_active_mode, ''))) not in (
    'super_admin', 'association', 'club', 'team_manager', 'coach', 'player'
  ) then
    raise exception 'The selected mode is not recognised.';
  end if;

  v_root_mode := public.administration_effective_mode(lower(trim(p_root_mode)));
  v_active_mode := public.administration_effective_mode(lower(trim(p_active_mode)));

  if v_root_mode <> 'super_admin' and v_active_mode <> v_root_mode then
    raise exception 'The active mode must match the selected account mode.';
  end if;

  select scope.association_id, scope.club_id, scope.division_id, scope.team_id
  into v_association_id, v_club_id, v_division_id, v_team_id
  from private.permission_context_canonical_scope(
    p_association_id,
    p_club_id,
    p_division_id,
    p_team_id
  ) scope;

  v_actual_super_admin := public.is_super_admin();

  -- A fresh Auth session may have no local cascade yet. Select the first
  -- deterministic scope actually assigned for the active lower mode. A real
  -- Super Admin preview can select from all valid records, while ordinary
  -- accounts are bootstrapped only from their assigned role or membership.
  if v_active_mode = 'association' and v_association_id is null then
    if v_actual_super_admin then
      select association.id
      into v_association_id
      from public.associations association
      order by association.name, association.id
      limit 1;
    else
      select role_row.association_id
      into v_association_id
      from public.user_roles role_row
      join public.associations association
        on association.id = role_row.association_id
      where role_row.user_id = v_user_id
        and role_row.role::text = 'ASSOCIATION_ADMIN'
        and role_row.association_id is not null
      order by association.name, association.id
      limit 1;
    end if;
  elsif v_active_mode = 'club' and v_club_id is null then
    if v_actual_super_admin then
      select club.id
      into v_club_id
      from public.clubs club
      where v_association_id is null
        or club.association_id = v_association_id
      order by club.name, club.id
      limit 1;
    else
      select role_row.club_id
      into v_club_id
      from public.user_roles role_row
      join public.clubs club on club.id = role_row.club_id
      where role_row.user_id = v_user_id
        and role_row.role::text = 'CLUB_ADMIN'
        and role_row.club_id is not null
        and (
          v_association_id is null
          or club.association_id = v_association_id
        )
      order by club.name, club.id
      limit 1;
    end if;
  elsif v_active_mode in ('team_manager', 'coach', 'player')
    and v_team_id is null then
    if v_actual_super_admin then
      select team.id
      into v_team_id
      from public.teams team
      join public.clubs club on club.id = team.club_id
      where (v_association_id is null or club.association_id = v_association_id)
        and (v_club_id is null or team.club_id = v_club_id)
        and (
          v_division_id is null
          or team.division_id = v_division_id
          or exists (
            select 1
            from public.team_divisions team_division
            where team_division.team_id = team.id
              and team_division.division_id = v_division_id
          )
        )
      order by team.name, team.id
      limit 1;
    elsif v_active_mode in ('team_manager', 'coach') then
      v_required_role := case v_active_mode
        when 'team_manager' then 'TEAM_MANAGER'
        else 'COACH'
      end;

      select role_row.team_id
      into v_team_id
      from public.user_roles role_row
      join public.teams team on team.id = role_row.team_id
      join public.clubs club on club.id = team.club_id
      where role_row.user_id = v_user_id
        and role_row.role::text = v_required_role
        and role_row.team_id is not null
        and (v_association_id is null or club.association_id = v_association_id)
        and (v_club_id is null or team.club_id = v_club_id)
        and (
          v_division_id is null
          or team.division_id = v_division_id
          or exists (
            select 1
            from public.team_divisions team_division
            where team_division.team_id = team.id
              and team_division.division_id = v_division_id
          )
        )
      order by team.name, team.id
      limit 1;
    else
      select candidate.team_id
      into v_team_id
      from (
        select membership.team_id,
          case membership.membership_type::text
            when 'PRIMARY' then 0
            when 'PERMANENT' then 1
            when 'SECONDARY' then 2
            else 3
          end as priority
        from public.team_memberships membership
        where membership.user_id = v_user_id
          and membership.status::text = 'ACTIVE'
        union all
        select role_row.team_id, 4 as priority
        from public.user_roles role_row
        where role_row.user_id = v_user_id
          and role_row.role::text = 'PLAYER'
          and role_row.team_id is not null
      ) candidate
      join public.teams team on team.id = candidate.team_id
      join public.clubs club on club.id = team.club_id
      where (v_association_id is null or club.association_id = v_association_id)
        and (v_club_id is null or team.club_id = v_club_id)
        and (
          v_division_id is null
          or team.division_id = v_division_id
          or exists (
            select 1
            from public.team_divisions team_division
            where team_division.team_id = team.id
              and team_division.division_id = v_division_id
          )
        )
      order by candidate.priority, team.name, team.id
      limit 1;
    end if;
  end if;

  -- Re-canonicalise after bootstrap so inferred parent IDs and junction-backed
  -- divisions are stored together with the selected role boundary.
  select scope.association_id, scope.club_id, scope.division_id, scope.team_id
  into v_association_id, v_club_id, v_division_id, v_team_id
  from private.permission_context_canonical_scope(
    v_association_id,
    v_club_id,
    v_division_id,
    v_team_id
  ) scope;

  if v_active_mode = 'association' and v_association_id is null then
    raise exception 'No assigned association is available for Association Admin mode.';
  end if;
  if v_active_mode = 'club' and v_club_id is null then
    raise exception 'No assigned club is available for Club Admin mode.';
  end if;
  if v_active_mode in ('team_manager', 'coach', 'player')
    and v_team_id is null then
    raise exception 'No assigned team is available for the selected mode.';
  end if;

  v_scope_is_empty := v_association_id is null
    and v_club_id is null
    and v_division_id is null
    and v_team_id is null;

  if not v_scope_is_empty and not v_actual_super_admin then
    if v_active_mode = 'association' then
      if v_association_id is null or not exists (
        select 1
        from public.user_roles role_row
        where role_row.user_id = v_user_id
          and role_row.role::text = 'ASSOCIATION_ADMIN'
          and role_row.association_id = v_association_id
      ) then
        raise exception 'The selected scope is not assigned in Association Admin mode.';
      end if;
    elsif v_active_mode = 'club' then
      if v_club_id is null or not exists (
        select 1
        from public.user_roles role_row
        where role_row.user_id = v_user_id
          and role_row.role::text = 'CLUB_ADMIN'
          and role_row.club_id = v_club_id
      ) then
        raise exception 'The selected scope is not assigned in Club Admin mode.';
      end if;
    elsif v_active_mode = 'team_manager' then
      if v_team_id is null or not exists (
        select 1
        from public.user_roles role_row
        where role_row.user_id = v_user_id
          and role_row.role::text = 'TEAM_MANAGER'
          and role_row.team_id = v_team_id
      ) then
        raise exception 'The selected scope is not assigned in Team Manager mode.';
      end if;
    elsif v_active_mode = 'coach' then
      if v_team_id is null or not exists (
        select 1
        from public.user_roles role_row
        where role_row.user_id = v_user_id
          and role_row.role::text = 'COACH'
          and role_row.team_id = v_team_id
      ) then
        raise exception 'The selected scope is not assigned in Coach mode.';
      end if;
    elsif v_active_mode = 'player' then
      if v_team_id is null or not (
        exists (
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
      ) then
        raise exception 'The selected team is not assigned in Player mode.';
      end if;
    end if;
  end if;

  v_revision := nextval('private.auth_session_permission_mode_revision_seq'::regclass);

  insert into private.auth_session_permission_modes (
    session_id,
    user_id,
    root_mode,
    active_mode,
    association_id,
    club_id,
    division_id,
    team_id,
    revision,
    updated_at
  ) values (
    v_session_id,
    v_user_id,
    v_root_mode,
    v_active_mode,
    v_association_id,
    v_club_id,
    v_division_id,
    v_team_id,
    v_revision,
    now()
  )
  on conflict (session_id, user_id) do update
  set root_mode = excluded.root_mode,
      active_mode = excluded.active_mode,
      association_id = excluded.association_id,
      club_id = excluded.club_id,
      division_id = excluded.division_id,
      team_id = excluded.team_id,
      revision = excluded.revision,
      updated_at = excluded.updated_at
  where excluded.revision > private.auth_session_permission_modes.revision;

  select jsonb_build_object(
    'root_mode', mode_row.root_mode,
    'active_mode', mode_row.active_mode,
    'association_id', mode_row.association_id,
    'club_id', mode_row.club_id,
    'division_id', mode_row.division_id,
    'team_id', mode_row.team_id,
    'revision', mode_row.revision
  )
  into v_result
  from private.auth_session_permission_modes mode_row
  where mode_row.session_id = v_session_id
    and mode_row.user_id = v_user_id;

  return v_result;
end;
$function$;

revoke all on function public.set_active_permission_context(
  text, text, uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.set_active_permission_context(
  text, text, uuid, uuid, uuid, uuid
) to authenticated;

-- Temporary compatibility for a browser build that has initialised mode but
-- has not yet upgraded to the atomic context call. Existing stored scope is
-- preserved. New code must use set_active_permission_context.
create or replace function public.set_active_permission_mode(
  p_root_mode text,
  p_active_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_association_id uuid;
  v_club_id uuid;
  v_division_id uuid;
  v_team_id uuid;
begin
  begin
    v_session_id := nullif(auth.jwt()->>'session_id', '')::uuid;
  exception
    when invalid_text_representation then
      v_session_id := null;
  end;

  select mode_row.association_id,
    mode_row.club_id,
    mode_row.division_id,
    mode_row.team_id
  into v_association_id, v_club_id, v_division_id, v_team_id
  from private.auth_session_permission_modes mode_row
  where mode_row.session_id = v_session_id
    and mode_row.user_id = v_user_id;

  return public.set_active_permission_context(
    p_root_mode,
    p_active_mode,
    v_association_id,
    v_club_id,
    v_division_id,
    v_team_id
  );
end;
$function$;

revoke all on function public.set_active_permission_mode(text, text)
  from public, anon, authenticated;
grant execute on function public.set_active_permission_mode(text, text)
  to authenticated;

create or replace function private.current_session_scope_allows(
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_division_id uuid default null,
  p_team_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_root_mode text;
  v_active_mode text;
  v_stored_association_id uuid;
  v_stored_club_id uuid;
  v_stored_division_id uuid;
  v_stored_team_id uuid;
  v_requested_association_id uuid;
  v_requested_club_id uuid;
  v_requested_division_id uuid;
  v_requested_team_id uuid;
  v_requested_empty boolean;
  v_stored_empty boolean;
begin
  if v_user_id is null then
    return false;
  end if;

  begin
    v_session_id := nullif(auth.jwt()->>'session_id', '')::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  if v_session_id is null then
    return false;
  end if;

  select mode_row.root_mode,
    mode_row.active_mode,
    mode_row.association_id,
    mode_row.club_id,
    mode_row.division_id,
    mode_row.team_id
  into v_root_mode,
    v_active_mode,
    v_stored_association_id,
    v_stored_club_id,
    v_stored_division_id,
    v_stored_team_id
  from private.auth_session_permission_modes mode_row
  join auth.sessions session_row
    on session_row.id = mode_row.session_id
   and session_row.user_id = mode_row.user_id
  where mode_row.session_id = v_session_id
    and mode_row.user_id = v_user_id
    and (session_row.not_after is null or session_row.not_after > now());

  if not found then
    return false;
  end if;

  select scope.association_id, scope.club_id, scope.division_id, scope.team_id
  into v_requested_association_id,
    v_requested_club_id,
    v_requested_division_id,
    v_requested_team_id
  from private.permission_context_canonical_scope(
    p_association_id,
    p_club_id,
    p_division_id,
    p_team_id
  ) scope;

  -- True Super Admin mode keeps its global authority. A lower active mode,
  -- including a Super Admin preview, remains bound to the selected cascade.
  if v_root_mode = 'super_admin'
    and v_active_mode = 'super_admin'
    and public.is_super_admin() then
    return true;
  end if;

  v_requested_empty := v_requested_association_id is null
    and v_requested_club_id is null
    and v_requested_division_id is null
    and v_requested_team_id is null;
  v_stored_empty := v_stored_association_id is null
    and v_stored_club_id is null
    and v_stored_division_id is null
    and v_stored_team_id is null;

  -- Only true Super Admin mode may operate without a selected scope. Lower
  -- modes, including Super Admin preview modes, remain closed until the
  -- browser has stored a concrete cascade for this Auth session.
  if v_requested_empty or v_stored_empty then
    return false;
  end if;

  -- Containment follows the active role's real authority boundary, not the
  -- deepest UI selection. An Association Admin may use the association record
  -- and any descendant in that association even while a team is selected. A
  -- Club Admin receives the same behaviour within the selected club. Team
  -- roles remain tied to one exact team and cannot widen to club/association.
  if v_active_mode = 'association' then
    return v_stored_association_id is not null
      and v_requested_association_id = v_stored_association_id;
  end if;
  if v_active_mode = 'club' then
    return v_stored_club_id is not null
      and v_requested_club_id = v_stored_club_id;
  end if;
  if v_active_mode in ('team_manager', 'coach', 'player') then
    return v_stored_team_id is not null
      and v_requested_team_id = v_stored_team_id;
  end if;

  return false;
exception
  when others then
    return false;
end;
$function$;

revoke all on function private.current_session_scope_allows(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated;

create or replace function public.administration_scope_allows(
  p_requested_mode text,
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_team_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_mode text;
  v_session_mode text;
  v_association_id uuid;
  v_club_id uuid;
  v_team_id uuid;
  v_is_super_admin boolean;
begin
  if v_actor is null then
    return false;
  end if;

  begin
    v_mode := public.administration_effective_mode(p_requested_mode);
  exception
    when others then
      return false;
  end;
  v_session_mode := private.active_permission_mode_for_current_session();

  if v_session_mode is null or v_session_mode <> v_mode then
    return false;
  end if;
  if not private.current_session_scope_allows(
    p_association_id,
    p_club_id,
    null,
    p_team_id
  ) then
    return false;
  end if;

  select scope.association_id, scope.club_id, scope.team_id
  into v_association_id, v_club_id, v_team_id
  from private.permission_context_canonical_scope(
    p_association_id,
    p_club_id,
    null,
    p_team_id
  ) scope;

  v_is_super_admin := public.is_super_admin();
  if v_mode = 'super_admin' then
    return v_is_super_admin;
  end if;
  if v_is_super_admin then
    if v_mode = 'association' then return v_association_id is not null; end if;
    if v_mode = 'club' then return v_club_id is not null; end if;
    if v_mode = 'team_manager' then return v_team_id is not null; end if;
    return false;
  end if;

  if v_mode = 'association' then
    return v_association_id is not null and exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = v_actor
        and role_row.role::text = 'ASSOCIATION_ADMIN'
        and role_row.association_id = v_association_id
    );
  end if;
  if v_mode = 'club' then
    return v_club_id is not null and exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = v_actor
        and role_row.role::text = 'CLUB_ADMIN'
        and role_row.club_id = v_club_id
    );
  end if;
  if v_mode = 'team_manager' then
    return v_team_id is not null and exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = v_actor
        and role_row.role::text = 'TEAM_MANAGER'
        and role_row.team_id = v_team_id
    );
  end if;
  return false;
end;
$function$;

revoke all on function public.administration_scope_allows(
  text, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.administration_scope_allows(
  text, uuid, uuid, uuid
) to authenticated;

-- Preserve the reviewed resolver implementation behind a session-context
-- wrapper. The implementation still performs its full role, cascade and rule
-- precedence validation, but browsers can no longer call it directly.
alter function public.resolve_effective_permission_for_mode(
  text, text, uuid, uuid, uuid, uuid
) rename to resolve_effective_permission_for_mode_unchecked;

revoke all on function public.resolve_effective_permission_for_mode_unchecked(
  text, text, uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.resolve_effective_permission_for_mode_unchecked(
  text, text, uuid, uuid, uuid, uuid
) to service_role;

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
  v_active_mode text := private.active_permission_mode_for_current_session();
begin
  if v_active_mode is null
    or lower(trim(coalesce(p_actor_mode, ''))) <> v_active_mode then
    raise exception 'The requested mode is not active for this session.';
  end if;

  if not private.current_session_scope_allows(
    p_association_id,
    p_club_id,
    p_division_id,
    p_team_id
  ) then
    raise exception 'The requested scope is not active for this session.';
  end if;

  return public.resolve_effective_permission_for_mode_unchecked(
    p_permission_key,
    v_active_mode,
    p_association_id,
    p_club_id,
    p_division_id,
    p_team_id
  );
end;
$function$;

revoke all on function public.resolve_effective_permission_for_mode(
  text, text, uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.resolve_effective_permission_for_mode(
  text, text, uuid, uuid, uuid, uuid
) to authenticated;

create or replace function private.module_allowed_for_current_session(
  p_module_key text,
  p_association_id uuid default null,
  p_club_id uuid default null,
  p_division_id uuid default null,
  p_team_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_mode text := private.active_permission_mode_for_current_session();
  v_result jsonb;
begin
  if v_mode is null or not private.current_session_scope_allows(
    p_association_id,
    p_club_id,
    p_division_id,
    p_team_id
  ) then
    return false;
  end if;

  v_result := public.resolve_effective_permission_for_mode(
    'module.' || lower(trim(coalesce(p_module_key, ''))) || '.access',
    v_mode,
    p_association_id,
    p_club_id,
    p_division_id,
    p_team_id
  );

  return coalesce((v_result->>'allowed')::boolean, false);
exception
  when others then
    return false;
end;
$function$;

revoke all on function private.module_allowed_for_current_session(
  text, uuid, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function private.module_allowed_for_current_session(
  text, uuid, uuid, uuid, uuid
) to authenticated;

comment on table private.auth_session_permission_modes is
  'Private active permission mode and selected cascade for each live Supabase Auth session.';
comment on function public.get_active_permission_mode() is
  'Returns the signed-in caller canonical mode and selected scope for the current live Auth session.';
comment on function public.set_active_permission_context(
  text, text, uuid, uuid, uuid, uuid
) is
  'Atomically validates and stores the signed-in caller mode and selected cascade for the current live Auth session.';
comment on function private.current_session_scope_allows(
  uuid, uuid, uuid, uuid
) is
  'Fail-closed compatibility check between a requested cascade and the current live session selected scope.';
comment on function public.administration_scope_allows(
  text, uuid, uuid, uuid
) is
  'Checks role scope only when the requested mode and scope match the current live session context.';
comment on function public.resolve_effective_permission_for_mode(
  text, text, uuid, uuid, uuid, uuid
) is
  'Resolves runtime permissions only for the mode and selected scope stored for the current live session.';
comment on function private.module_allowed_for_current_session(
  text, uuid, uuid, uuid, uuid
) is
  'Fail-closed module gate bound to the current live session mode and selected cascade.';

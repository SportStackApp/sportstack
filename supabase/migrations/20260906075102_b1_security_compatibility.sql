-- B1b: dormant access-control functions, seed catalogue, scoped read
-- policies, integrity triggers and minimum grants. This migration is designed
-- to follow 20260906063905_b1_foundation_compatibility.sql.
--
-- Coordination, incident/discipline and membership mutation functions remain
-- excluded for later packages. All browser access is denied first and then
-- explicitly granted to the narrow current-Dev allow-list.

insert into public.permission_catalogue
  (permission_key, module_key, label, description, category, default_allowed)
values
  ('module.player_mvp.access', 'player_mvp', 'Access Player MVP Voting', 'Open Player MVP Voting routes and navigation.', 'MODULE', true),
  ('module.umpire_match_voting.access', 'umpire_match_voting', 'Access Umpire Match Voting', 'Open Umpire Match Voting routes and navigation.', 'MODULE', true),
  ('module.committee.access', 'committee', 'Access Committee Management', 'Open committee work and administration where committee membership also permits it.', 'MODULE', true),
  ('module.safety_risk.access', 'safety_risk', 'Access Safety Hub', 'Open Risk and Quality Improvement workflows inside the selected scope.', 'MODULE', true),
  ('module.hockey_trace.access', 'hockey_trace', 'Access Hockey Trace Lab', 'Open the experimental Hockey Trace tools.', 'MODULE', false),
  ('player_mvp.submit', 'player_mvp', 'Submit Player MVP ballot', 'Submit an eligible Player MVP ballot.', 'ACTION', true),
  ('player_mvp.view_results', 'player_mvp', 'View Player MVP results', 'View Player MVP result and leaderboard information permitted by scope.', 'ACTION', false),
  ('umpire_match_voting.submit', 'umpire_match_voting', 'Submit Umpire Match ballot', 'Submit an authorised Umpire Match ballot.', 'ACTION', true),
  ('umpire_match_voting.manage', 'umpire_match_voting', 'Manage Umpire Match voting', 'Review, correct and approve Umpire Match voting submissions.', 'ACTION', false),
  ('committee.chat.post', 'committee', 'Post committee chat', 'Post to private committee chat when committee position access also permits it.', 'ACTION', false),
  ('committee.poll.vote', 'committee', 'Vote in committee polls', 'Respond to committee polls when committee position access also permits it.', 'ACTION', false),
  ('safety_risk.manage', 'safety_risk', 'Manage Safety Hub records', 'Create and update in-scope Risk and Quality Improvement records.', 'ACTION', false)
on conflict (permission_key) do update set
  module_key = excluded.module_key,
  label = excluded.label,
  description = excluded.description,
  category = excluded.category;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'SUPER_ADMIN'
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_module_scope(p_user_id uuid, p_scope_type text, p_scope_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_user_id is not null
    and (
      p_user_id = auth.uid()
      or auth.role() = 'service_role'
    )
    and p_scope_id is not null
    and exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = p_user_id
        and (
          role_row.role = 'SUPER_ADMIN'::public.user_role_enum
          or (
            role_row.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
            and (
              (p_scope_type = 'ASSOCIATION' and role_row.association_id = p_scope_id)
              or (
                p_scope_type = 'CLUB'
                and exists (
                  select 1 from public.clubs club
                  where club.id = p_scope_id
                    and club.association_id = role_row.association_id
                )
              )
              or (
                p_scope_type = 'DIVISION'
                and exists (
                  select 1 from public.divisions division
                  where division.id = p_scope_id
                    and division.association_id = role_row.association_id
                )
              )
              or (
                p_scope_type = 'TEAM'
                and exists (
                  select 1
                  from public.teams team
                  join public.clubs club on club.id = team.club_id
                  where team.id = p_scope_id
                    and club.association_id = role_row.association_id
                )
              )
            )
          )
          or (
            role_row.role = 'CLUB_ADMIN'::public.user_role_enum
            and (
              (p_scope_type = 'CLUB' and role_row.club_id = p_scope_id)
              or (
                p_scope_type = 'TEAM'
                and exists (
                  select 1 from public.teams team
                  where team.id = p_scope_id
                    and team.club_id = role_row.club_id
                )
              )
            )
          )
        )
    );
$function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'permission_scope_details'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_scope_type text, p_scope_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.permission_scope_details(p_scope_type text, p_scope_id uuid)
 RETURNS TABLE(association_id uuid, club_id uuid, division_id uuid, team_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_scope_type = 'ASSOCIATION' then
    return query select association.id, null::uuid, null::uuid, null::uuid
    from public.associations association where association.id = p_scope_id;
  elsif p_scope_type = 'CLUB' then
    return query select club.association_id, club.id, null::uuid, null::uuid
    from public.clubs club where club.id = p_scope_id;
  elsif p_scope_type = 'DIVISION' then
    return query select division.association_id, null::uuid, division.id, null::uuid
    from public.divisions division where division.id = p_scope_id;
  elsif p_scope_type = 'TEAM' then
    return query
    select club.association_id, team.club_id, team.division_id, team.id
    from public.teams team
    join public.clubs club on club.id = team.club_id
    where team.id = p_scope_id;
  end if;
end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'resolve_module_enabled'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_module_key text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.resolve_module_enabled(p_module_key text, p_association_id uuid DEFAULT NULL::uuid, p_club_id uuid DEFAULT NULL::uuid, p_division_id uuid DEFAULT NULL::uuid, p_team_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_enabled boolean;
begin
  if p_module_key not in (
    'player_mvp', 'umpire_match_voting', 'committee', 'safety_risk',
    'hockey_trace'
  ) then
    raise exception 'Unknown SportStack module.';
  end if;

  select flag.enabled into v_enabled
  from public.module_feature_flags flag
  where flag.module_key = p_module_key
    and (
      (flag.scope_type = 'TEAM' and flag.scope_id = p_team_id)
      or (flag.scope_type = 'DIVISION' and flag.scope_id = p_division_id)
      or (flag.scope_type = 'CLUB' and flag.scope_id = p_club_id)
      or (flag.scope_type = 'ASSOCIATION' and flag.scope_id = p_association_id)
    )
  order by case flag.scope_type
    when 'TEAM' then 1
    when 'DIVISION' then 2
    when 'CLUB' then 3
    when 'ASSOCIATION' then 4
  end
  limit 1;

  return coalesce(v_enabled, p_module_key <> 'hockey_trace');
end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'permission_user_in_scope'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_user_id uuid, p_scope_type text, p_scope_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.permission_user_in_scope(p_user_id uuid, p_scope_type text, p_scope_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with scope as (
    select * from public.permission_scope_details(p_scope_type, p_scope_id)
  )
  select exists (
    select 1
    from scope
    where exists (
      select 1
      from public.team_memberships membership
      join public.teams team on team.id = membership.team_id
      join public.clubs club on club.id = team.club_id
      where membership.user_id = p_user_id
        and membership.status::text in ('ACTIVE', 'PENDING', 'INVITED')
        and (scope.team_id is null or team.id = scope.team_id)
        and (scope.division_id is null or team.division_id = scope.division_id)
        and (scope.club_id is null or club.id = scope.club_id)
        and club.association_id = scope.association_id
    )
    or exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = p_user_id
        and (
          role_row.role::text = 'SUPER_ADMIN'
          or (role_row.role::text = 'ASSOCIATION_ADMIN' and role_row.association_id = scope.association_id)
          or (role_row.role::text = 'CLUB_ADMIN' and role_row.club_id = scope.club_id)
          or (role_row.role::text in ('TEAM_MANAGER', 'COACH') and role_row.team_id = scope.team_id)
        )
    )
  );
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'permission_subject_matches'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_user_id uuid, p_subject_type text, p_subject_key text, p_association_id uuid, p_club_id uuid, p_team_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.permission_subject_matches(p_user_id uuid, p_subject_type text, p_subject_key text, p_association_id uuid, p_club_id uuid, p_team_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case p_subject_type
    when 'USER' then p_subject_key = p_user_id::text
    when 'GROUP' then exists (
      select 1
      from public.permission_group_members member
      join public.permission_groups group_row on group_row.id = member.group_id and group_row.active
      where member.user_id = p_user_id and group_row.id::text = p_subject_key
    )
    when 'ROLE' then exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = p_user_id
        and role_row.role::text = p_subject_key
        and (
          role_row.role::text in ('SUPER_ADMIN', 'UMPIRE', 'VOTER', 'UMPIRE_ADMIN')
          or (role_row.role::text = 'ASSOCIATION_ADMIN' and role_row.association_id = p_association_id)
          or (role_row.role::text = 'CLUB_ADMIN' and role_row.club_id = p_club_id)
          or (role_row.role::text in ('TEAM_MANAGER', 'COACH') and role_row.team_id = p_team_id)
          or (role_row.role::text = 'PLAYER' and (
            role_row.team_id = p_team_id
            or exists (
              select 1 from public.team_memberships membership
              where membership.user_id = p_user_id
                and membership.team_id = p_team_id
                and membership.status::text = 'ACTIVE'
            )
          ))
        )
    )
    else false
  end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'permission_subject_matches_for_mode'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_user_id uuid, p_effective_mode text, p_subject_type text, p_subject_key text, p_rule_scope_type text, p_rule_scope_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.permission_subject_matches_for_mode(p_user_id uuid, p_effective_mode text, p_subject_type text, p_subject_key text, p_rule_scope_type text, p_rule_scope_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'administration_effective_mode'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_requested_mode text'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.administration_effective_mode(p_requested_mode text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_requested text := lower(coalesce(p_requested_mode, ''));
  v_has_super boolean;
begin
  if v_actor is null then
    raise exception 'You must be signed in.';
  end if;

  select exists (
    select 1 from public.user_roles role_row
    where role_row.user_id = v_actor and role_row.role::text = 'SUPER_ADMIN'
  ) into v_has_super;

  if v_requested in ('super_admin', 'association', 'club', 'team_manager', 'coach', 'player') then
    if v_has_super then
      return v_requested;
    end if;

    if v_requested = 'association' and exists (
      select 1 from public.user_roles role_row
      where role_row.user_id = v_actor and role_row.role::text = 'ASSOCIATION_ADMIN'
    ) then return v_requested; end if;
    if v_requested = 'club' and exists (
      select 1 from public.user_roles role_row
      where role_row.user_id = v_actor and role_row.role::text = 'CLUB_ADMIN'
    ) then return v_requested; end if;
    if v_requested = 'team_manager' and exists (
      select 1 from public.user_roles role_row
      where role_row.user_id = v_actor and role_row.role::text = 'TEAM_MANAGER'
    ) then return v_requested; end if;
    if v_requested = 'coach' and exists (
      select 1 from public.user_roles role_row
      where role_row.user_id = v_actor and role_row.role::text = 'COACH'
    ) then return v_requested; end if;
    if v_requested = 'player' then return v_requested; end if;

    raise exception 'The selected mode is not assigned to this account.';
  end if;

  if v_has_super then return 'super_admin'; end if;
  if exists (select 1 from public.user_roles r where r.user_id = v_actor and r.role::text = 'ASSOCIATION_ADMIN') then return 'association'; end if;
  if exists (select 1 from public.user_roles r where r.user_id = v_actor and r.role::text = 'CLUB_ADMIN') then return 'club'; end if;
  if exists (select 1 from public.user_roles r where r.user_id = v_actor and r.role::text = 'TEAM_MANAGER') then return 'team_manager'; end if;
  if exists (select 1 from public.user_roles r where r.user_id = v_actor and r.role::text = 'COACH') then return 'coach'; end if;
  return 'player';
end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'private'
      and procedure_row.proname = 'permission_context_canonical_scope'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION private.permission_context_canonical_scope(p_association_id uuid DEFAULT NULL::uuid, p_club_id uuid DEFAULT NULL::uuid, p_division_id uuid DEFAULT NULL::uuid, p_team_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(association_id uuid, club_id uuid, division_id uuid, team_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'private'
      and procedure_row.proname = 'active_permission_mode_for_current_session'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = ''
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION private.active_permission_mode_for_current_session()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'private'
      and procedure_row.proname = 'current_session_scope_allows'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION private.current_session_scope_allows(p_association_id uuid DEFAULT NULL::uuid, p_club_id uuid DEFAULT NULL::uuid, p_division_id uuid DEFAULT NULL::uuid, p_team_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'administration_scope_allows'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_requested_mode text, p_association_id uuid, p_club_id uuid, p_team_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.administration_scope_allows(p_requested_mode text, p_association_id uuid DEFAULT NULL::uuid, p_club_id uuid DEFAULT NULL::uuid, p_team_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'permission_mode_scope_allows'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_actor_mode text, p_scope_type text, p_scope_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.permission_mode_scope_allows(p_actor_mode text, p_scope_type text, p_scope_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'permission_subject_manageable'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_actor_mode text, p_subject_type text, p_subject_key text'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.permission_subject_manageable(p_actor_mode text, p_subject_type text, p_subject_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'resolve_effective_permission'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_permission_key text, p_user_id uuid, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.resolve_effective_permission(p_permission_key text, p_user_id uuid DEFAULT NULL::uuid, p_association_id uuid DEFAULT NULL::uuid, p_club_id uuid DEFAULT NULL::uuid, p_division_id uuid DEFAULT NULL::uuid, p_team_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_module_key text;
  v_default boolean;
  v_allowed boolean;
  v_source text;
  v_scope_type text;
  v_scope_id uuid;
begin
  if v_user_id is null then raise exception 'You must be signed in.'; end if;
  if p_user_id is not null and p_user_id <> auth.uid() and not public.is_super_admin() then
    raise exception 'Only a Super Admin can preview another user''s effective permissions.';
  end if;

  select catalogue.module_key, catalogue.default_allowed
  into v_module_key, v_default
  from public.permission_catalogue catalogue
  where catalogue.permission_key = p_permission_key;
  if not found then raise exception 'Unknown permission key.'; end if;

  with scope_chain as (
    select 'ASSOCIATION'::text as scope_type, p_association_id as scope_id, 1 as scope_rank where p_association_id is not null
    union all select 'CLUB', p_club_id, 2 where p_club_id is not null
    union all select 'DIVISION', p_division_id, 3 where p_division_id is not null
    union all select 'TEAM', p_team_id, 4 where p_team_id is not null
  ), candidates as (
    select override_row.allowed, 'DIRECT_' || override_row.subject_type as source,
           chain.scope_type, chain.scope_id, chain.scope_rank,
           case override_row.subject_type when 'USER' then 300 when 'GROUP' then 200 else 100 end as subject_rank,
           20 as rule_rank, override_row.updated_at
    from public.permission_overrides override_row
    join scope_chain chain on chain.scope_type = override_row.scope_type and chain.scope_id = override_row.scope_id
    where override_row.permission_key = p_permission_key
      and override_row.active
      and public.permission_subject_matches(
        v_user_id, override_row.subject_type, override_row.subject_key,
        p_association_id, p_club_id, p_team_id
      )
    union all
    select set_permission.allowed, 'SET_' || assignment.subject_type,
           chain.scope_type, chain.scope_id, chain.scope_rank,
           case assignment.subject_type when 'USER' then 300 when 'GROUP' then 200 else 100 end,
           10, assignment.updated_at
    from public.permission_assignments assignment
    join public.permission_sets set_row on set_row.id = assignment.permission_set_id and set_row.active
    join public.permission_set_permissions set_permission on set_permission.permission_set_id = set_row.id
    join scope_chain chain on chain.scope_type = assignment.scope_type and chain.scope_id = assignment.scope_id
    where set_permission.permission_key = p_permission_key
      and assignment.active
      and public.permission_subject_matches(
        v_user_id, assignment.subject_type, assignment.subject_key,
        p_association_id, p_club_id, p_team_id
      )
  )
  select candidate.allowed, candidate.source, candidate.scope_type, candidate.scope_id
  into v_allowed, v_source, v_scope_type, v_scope_id
  from candidates candidate
  order by candidate.scope_rank desc, candidate.subject_rank desc, candidate.rule_rank desc,
           candidate.allowed asc, candidate.updated_at desc
  limit 1;

  if v_allowed is null and p_permission_key like 'module.%.access' then
    v_allowed := public.resolve_module_enabled(
      v_module_key, p_association_id, p_club_id, p_division_id, p_team_id
    );
    v_source := 'MODULE_SCOPE';
  end if;
  if v_allowed is null then
    v_allowed := v_default;
    v_source := 'CATALOGUE_DEFAULT';
  end if;

  return jsonb_build_object(
    'permission_key', p_permission_key,
    'allowed', v_allowed,
    'source', v_source,
    'scope_type', v_scope_type,
    'scope_id', v_scope_id
  );
end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'resolve_effective_permission_for_mode_unchecked'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_permission_key text, p_actor_mode text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.resolve_effective_permission_for_mode_unchecked(p_permission_key text, p_actor_mode text, p_association_id uuid DEFAULT NULL::uuid, p_club_id uuid DEFAULT NULL::uuid, p_division_id uuid DEFAULT NULL::uuid, p_team_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'resolve_effective_permission_for_mode'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_permission_key text, p_actor_mode text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.resolve_effective_permission_for_mode(p_permission_key text, p_actor_mode text, p_association_id uuid DEFAULT NULL::uuid, p_club_id uuid DEFAULT NULL::uuid, p_division_id uuid DEFAULT NULL::uuid, p_team_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'private'
      and procedure_row.proname = 'module_allowed_for_current_session'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_module_key text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION private.module_allowed_for_current_session(p_module_key text, p_association_id uuid DEFAULT NULL::uuid, p_club_id uuid DEFAULT NULL::uuid, p_division_id uuid DEFAULT NULL::uuid, p_team_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'has_effective_permission'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_permission_key text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.has_effective_permission(p_permission_key text, p_association_id uuid DEFAULT NULL::uuid, p_club_id uuid DEFAULT NULL::uuid, p_division_id uuid DEFAULT NULL::uuid, p_team_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((public.resolve_effective_permission(
    p_permission_key, auth.uid(), p_association_id, p_club_id, p_division_id, p_team_id
  )->>'allowed')::boolean, false);
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'permission_visible_profiles'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_scope_type text, p_scope_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.permission_visible_profiles(p_scope_type text, p_scope_id uuid)
 RETURNS TABLE(profile_id uuid, display_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.can_manage_module_scope(auth.uid(), p_scope_type, p_scope_id) then
    raise exception 'You cannot view permission subjects at this scope.';
  end if;
  return query
  select profile.id,
         coalesce(nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''), 'Unnamed user')
  from public.profiles profile
  where public.permission_user_in_scope(profile.id, p_scope_type, p_scope_id)
  order by profile.first_name nulls last, profile.last_name nulls last, profile.id;
end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'permission_visible_profiles_for_mode'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_scope_type text, p_scope_id uuid, p_actor_mode text'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.permission_visible_profiles_for_mode(p_scope_type text, p_scope_id uuid, p_actor_mode text DEFAULT NULL::text)
 RETURNS TABLE(profile_id uuid, display_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'permission_save_group_unchecked'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_group_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_member_ids uuid[], p_active boolean, p_actor_mode text'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.permission_save_group_unchecked(p_group_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_member_ids uuid[] DEFAULT '{}'::uuid[], p_active boolean DEFAULT true, p_actor_mode text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_id uuid := coalesce(p_group_id, gen_random_uuid());
  v_details record;
  v_old jsonb;
begin
  if not public.can_manage_module_scope(v_actor, p_scope_type, p_scope_id) then
    raise exception 'You cannot manage permission groups at this scope.';
  end if;
  select * into v_details from public.permission_scope_details(p_scope_type, p_scope_id);
  if not found then raise exception 'The selected permission scope was not found.'; end if;
  select to_jsonb(group_row) into v_old from public.permission_groups group_row where group_row.id = v_id for update;
  if v_old is not null and not public.can_manage_module_scope(
    v_actor, v_old->>'scope_type', (v_old->>'scope_id')::uuid
  ) then raise exception 'The existing permission group is outside your authority.'; end if;
  if exists (
    select 1 from unnest(coalesce(p_member_ids, '{}'::uuid[])) member_id
    where member_id is not null
      and not public.permission_user_in_scope(member_id, p_scope_type, p_scope_id)
  ) then raise exception 'A selected group member is outside this permission scope.'; end if;

  insert into public.permission_groups (
    id, name, description, scope_type, scope_id, active, created_by, updated_by
  ) values (
    v_id, btrim(p_name), nullif(btrim(p_description), ''), p_scope_type, p_scope_id,
    p_active, v_actor, v_actor
  )
  on conflict (id) do update set
    name = excluded.name, description = excluded.description, active = excluded.active,
    updated_by = v_actor, updated_at = now();

  delete from public.permission_group_members member where member.group_id = v_id;
  insert into public.permission_group_members (group_id, user_id, added_by)
  select v_id, member_id, v_actor
  from unnest(coalesce(p_member_ids, '{}'::uuid[])) member_id
  where member_id is not null
  on conflict do nothing;

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id,
    association_id, club_id, team_id, old_data, new_data
  ) values (
    v_actor, v_mode, case when p_group_id is null then 'PERMISSION_GROUP_CREATED' else 'PERMISSION_GROUP_UPDATED' end,
    'permission_group', v_id, v_details.association_id, v_details.club_id, v_details.team_id,
    v_old, jsonb_build_object('name', btrim(p_name), 'active', p_active, 'member_ids', coalesce(p_member_ids, '{}'::uuid[]))
  );
  return v_id;
end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'permission_save_set_unchecked'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_permission_set_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_permissions jsonb, p_active boolean, p_actor_mode text'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.permission_save_set_unchecked(p_permission_set_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_permissions jsonb, p_active boolean DEFAULT true, p_actor_mode text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_id uuid := coalesce(p_permission_set_id, gen_random_uuid());
  v_details record;
  v_old jsonb;
begin
  if not public.can_manage_module_scope(v_actor, p_scope_type, p_scope_id) then
    raise exception 'You cannot manage permission sets at this scope.';
  end if;
  select * into v_details from public.permission_scope_details(p_scope_type, p_scope_id);
  if not found then raise exception 'The selected permission scope was not found.'; end if;
  if jsonb_typeof(p_permissions) <> 'object' then raise exception 'Permissions must be supplied as an object.'; end if;
  if exists (
    select 1 from jsonb_object_keys(p_permissions) supplied(permission_key)
    where not exists (select 1 from public.permission_catalogue catalogue where catalogue.permission_key = supplied.permission_key)
  ) then raise exception 'One or more permission keys are not recognised.'; end if;

  select to_jsonb(set_row) into v_old from public.permission_sets set_row where set_row.id = v_id for update;
  if v_old is not null and not public.can_manage_module_scope(
    v_actor, v_old->>'owner_scope_type', (v_old->>'owner_scope_id')::uuid
  ) then raise exception 'The existing permission set is outside your authority.'; end if;
  insert into public.permission_sets (
    id, name, description, owner_scope_type, owner_scope_id, active, created_by, updated_by
  ) values (
    v_id, btrim(p_name), nullif(btrim(p_description), ''), p_scope_type, p_scope_id,
    p_active, v_actor, v_actor
  )
  on conflict (id) do update set
    name = excluded.name, description = excluded.description, active = excluded.active,
    updated_by = v_actor, updated_at = now();

  delete from public.permission_set_permissions set_permission where set_permission.permission_set_id = v_id;
  insert into public.permission_set_permissions (permission_set_id, permission_key, allowed)
  select v_id, entry.key, (entry.value #>> '{}')::boolean
  from jsonb_each(p_permissions) entry;

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id,
    association_id, club_id, team_id, old_data, new_data
  ) values (
    v_actor, v_mode, case when p_permission_set_id is null then 'PERMISSION_SET_CREATED' else 'PERMISSION_SET_UPDATED' end,
    'permission_set', v_id, v_details.association_id, v_details.club_id, v_details.team_id,
    v_old, jsonb_build_object('name', btrim(p_name), 'active', p_active, 'permissions', p_permissions)
  );
  return v_id;
end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'permission_save_assignment_unchecked'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_assignment_id uuid, p_permission_set_id uuid, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_active boolean, p_actor_mode text'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.permission_save_assignment_unchecked(p_assignment_id uuid, p_permission_set_id uuid, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_active boolean DEFAULT true, p_actor_mode text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_id uuid := coalesce(p_assignment_id, gen_random_uuid());
  v_details record;
  v_old jsonb;
  v_set public.permission_sets%rowtype;
  v_group public.permission_groups%rowtype;
begin
  if p_subject_type not in ('ROLE', 'GROUP', 'USER') then raise exception 'Unknown permission subject type.'; end if;
  if not public.can_manage_module_scope(v_actor, p_scope_type, p_scope_id) then
    raise exception 'You cannot assign permissions at this scope.';
  end if;
  select * into v_set from public.permission_sets set_row
  where set_row.id = p_permission_set_id and set_row.active;
  if not found then raise exception 'The selected permission set was not found.'; end if;
  if not public.can_manage_module_scope(v_actor, v_set.owner_scope_type, v_set.owner_scope_id) then
    raise exception 'The selected permission set is outside your authority.';
  end if;
  if p_subject_type = 'ROLE' and p_subject_key not in (
    'SUPER_ADMIN','ASSOCIATION_ADMIN','CLUB_ADMIN','TEAM_MANAGER','COACH','PLAYER','UMPIRE','VOTER','UMPIRE_ADMIN'
  ) then raise exception 'The selected role was not recognised.'; end if;
  if p_subject_type = 'GROUP' then
    select * into v_group from public.permission_groups group_row
    where group_row.id::text = p_subject_key and group_row.active;
    if not found then raise exception 'The selected permission group was not found.'; end if;
    if not public.can_manage_module_scope(v_actor, v_group.scope_type, v_group.scope_id) then
      raise exception 'The selected permission group is outside your authority.';
    end if;
  end if;
  if p_subject_type = 'USER' and not public.permission_user_in_scope(
    p_subject_key::uuid, p_scope_type, p_scope_id
  ) then raise exception 'The selected user is outside this permission scope.'; end if;

  select * into v_details from public.permission_scope_details(p_scope_type, p_scope_id);
  if not found then raise exception 'The selected permission scope was not found.'; end if;
  select to_jsonb(assignment) into v_old from public.permission_assignments assignment where assignment.id = v_id for update;
  if v_old is not null and not public.can_manage_module_scope(
    v_actor, v_old->>'scope_type', (v_old->>'scope_id')::uuid
  ) then raise exception 'The existing permission assignment is outside your authority.'; end if;

  insert into public.permission_assignments (
    id, permission_set_id, subject_type, subject_key, scope_type, scope_id,
    active, created_by, updated_by
  ) values (
    v_id, p_permission_set_id, p_subject_type, p_subject_key, p_scope_type, p_scope_id,
    p_active, v_actor, v_actor
  )
  on conflict (id) do update set
    permission_set_id = excluded.permission_set_id, subject_type = excluded.subject_type,
    subject_key = excluded.subject_key, scope_type = excluded.scope_type, scope_id = excluded.scope_id,
    active = excluded.active, updated_by = v_actor, updated_at = now();

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id,
    association_id, club_id, team_id, old_data, new_data
  ) values (
    v_actor, v_mode, 'PERMISSION_ASSIGNMENT_SAVED', 'permission_assignment', v_id,
    v_details.association_id, v_details.club_id, v_details.team_id, v_old,
    jsonb_build_object('permission_set_id', p_permission_set_id, 'subject_type', p_subject_type,
      'subject_key', p_subject_key, 'active', p_active)
  );
  return v_id;
end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'permission_save_override_unchecked'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_permission_key text, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_allowed boolean, p_reason text, p_active boolean, p_actor_mode text'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.permission_save_override_unchecked(p_permission_key text, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_allowed boolean, p_reason text DEFAULT NULL::text, p_active boolean DEFAULT true, p_actor_mode text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_mode text := public.administration_effective_mode(p_actor_mode);
  v_id uuid;
  v_details record;
  v_old jsonb;
begin
  if not exists (select 1 from public.permission_catalogue catalogue where catalogue.permission_key = p_permission_key) then
    raise exception 'Unknown permission key.';
  end if;
  if p_subject_type not in ('ROLE', 'GROUP', 'USER') then raise exception 'Unknown permission subject type.'; end if;
  if not public.can_manage_module_scope(v_actor, p_scope_type, p_scope_id) then
    raise exception 'You cannot set permission overrides at this scope.';
  end if;
  select * into v_details from public.permission_scope_details(p_scope_type, p_scope_id);
  if not found then raise exception 'The selected permission scope was not found.'; end if;
  if p_subject_type = 'ROLE' and p_subject_key not in (
    'SUPER_ADMIN','ASSOCIATION_ADMIN','CLUB_ADMIN','TEAM_MANAGER','COACH','PLAYER','UMPIRE','VOTER','UMPIRE_ADMIN'
  ) then raise exception 'The selected role was not recognised.'; end if;
  if p_subject_type = 'GROUP' and not exists (
    select 1 from public.permission_groups group_row
    where group_row.id::text = p_subject_key
      and group_row.active
      and public.can_manage_module_scope(v_actor, group_row.scope_type, group_row.scope_id)
  ) then raise exception 'The selected permission group was not found in your scope.'; end if;
  if p_subject_type = 'USER' and not public.permission_user_in_scope(
    p_subject_key::uuid, p_scope_type, p_scope_id
  ) then raise exception 'The selected user is outside this permission scope.'; end if;

  select override_row.id, to_jsonb(override_row)
  into v_id, v_old
  from public.permission_overrides override_row
  where override_row.permission_key = p_permission_key
    and override_row.subject_type = p_subject_type
    and override_row.subject_key = p_subject_key
    and override_row.scope_type = p_scope_type
    and override_row.scope_id = p_scope_id
    and override_row.active
  for update;
  v_id := coalesce(v_id, gen_random_uuid());

  insert into public.permission_overrides (
    id, permission_key, subject_type, subject_key, scope_type, scope_id,
    allowed, reason, active, created_by, updated_by
  ) values (
    v_id, p_permission_key, p_subject_type, p_subject_key, p_scope_type, p_scope_id,
    p_allowed, nullif(btrim(p_reason), ''), p_active, v_actor, v_actor
  )
  on conflict (id) do update set
    allowed = excluded.allowed, reason = excluded.reason, active = excluded.active,
    updated_by = v_actor, updated_at = now();

  insert into public.administration_audit_log (
    actor_id, actor_mode, action, record_type, record_id,
    association_id, club_id, team_id, old_data, new_data
  ) values (
    v_actor, v_mode, 'PERMISSION_OVERRIDE_SAVED', 'permission_override', v_id,
    v_details.association_id, v_details.club_id, v_details.team_id, v_old,
    jsonb_build_object('permission_key', p_permission_key, 'subject_type', p_subject_type,
      'subject_key', p_subject_key, 'allowed', p_allowed, 'active', p_active, 'reason', p_reason)
  );
  return v_id;
end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'save_permission_group'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_group_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_member_ids uuid[], p_active boolean, p_actor_mode text'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.save_permission_group(p_group_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_member_ids uuid[] DEFAULT '{}'::uuid[], p_active boolean DEFAULT true, p_actor_mode text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'save_permission_set'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_permission_set_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_permissions jsonb, p_active boolean, p_actor_mode text'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.save_permission_set(p_permission_set_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_permissions jsonb, p_active boolean DEFAULT true, p_actor_mode text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'save_permission_assignment'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_assignment_id uuid, p_permission_set_id uuid, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_active boolean, p_actor_mode text'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.save_permission_assignment(p_assignment_id uuid, p_permission_set_id uuid, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_active boolean DEFAULT true, p_actor_mode text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'save_permission_override'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_permission_key text, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_allowed boolean, p_reason text, p_active boolean, p_actor_mode text'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.save_permission_override(p_permission_key text, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_allowed boolean, p_reason text DEFAULT NULL::text, p_active boolean DEFAULT true, p_actor_mode text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'set_module_feature_flag'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_module_key text, p_scope_type text, p_scope_id uuid, p_enabled boolean, p_notes text'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.set_module_feature_flag(p_module_key text, p_scope_type text, p_scope_id uuid, p_enabled boolean, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor_id uuid := auth.uid();
  v_flag_id uuid;
begin
  if p_module_key not in (
    'player_mvp', 'umpire_match_voting', 'committee', 'safety_risk',
    'hockey_trace'
  ) then
    raise exception 'Unknown SportStack module.';
  end if;
  if p_scope_type not in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM') then
    raise exception 'Unknown module scope.';
  end if;
  if not public.can_manage_module_scope(v_actor_id, p_scope_type, p_scope_id) then
    raise exception 'You do not have permission to manage modules at this scope.';
  end if;
  if (p_scope_type = 'ASSOCIATION' and not exists (select 1 from public.associations where id = p_scope_id))
    or (p_scope_type = 'CLUB' and not exists (select 1 from public.clubs where id = p_scope_id))
    or (p_scope_type = 'DIVISION' and not exists (select 1 from public.divisions where id = p_scope_id))
    or (p_scope_type = 'TEAM' and not exists (select 1 from public.teams where id = p_scope_id)) then
    raise exception 'The selected module scope was not found.';
  end if;

  insert into public.module_feature_flags (
    module_key, scope_type, scope_id, enabled, notes, created_by, updated_by
  ) values (
    p_module_key, p_scope_type, p_scope_id, p_enabled,
    nullif(btrim(p_notes), ''), v_actor_id, v_actor_id
  )
  on conflict (module_key, scope_type, scope_id) do update set
    enabled = excluded.enabled,
    notes = excluded.notes,
    updated_by = v_actor_id,
    updated_at = now()
  returning id into v_flag_id;

  return jsonb_build_object(
    'id', v_flag_id,
    'module_key', p_module_key,
    'scope_type', p_scope_type,
    'scope_id', p_scope_id,
    'enabled', p_enabled
  );
end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'clear_module_feature_flag'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_module_key text, p_scope_type text, p_scope_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.clear_module_feature_flag(p_module_key text, p_scope_type text, p_scope_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.can_manage_module_scope(auth.uid(), p_scope_type, p_scope_id) then
    raise exception 'You do not have permission to manage modules at this scope.';
  end if;

  delete from public.module_feature_flags
  where module_key = p_module_key
    and scope_type = p_scope_type
    and scope_id = p_scope_id;

  return found;
end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'get_active_permission_mode'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = ''
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.get_active_permission_mode()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'set_active_permission_context'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_root_mode text, p_active_mode text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.set_active_permission_context(p_root_mode text, p_active_mode text, p_association_id uuid DEFAULT NULL::uuid, p_club_id uuid DEFAULT NULL::uuid, p_division_id uuid DEFAULT NULL::uuid, p_team_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'set_active_permission_mode'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_root_mode text, p_active_mode text'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.set_active_permission_mode(p_root_mode text, p_active_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'list_permission_management_records_for_mode'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_scope_type text, p_scope_id uuid, p_actor_mode text'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.list_permission_management_records_for_mode(p_scope_type text, p_scope_id uuid, p_actor_mode text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'permission_scope_contains'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = 'p_owner_scope_type text, p_owner_scope_id uuid, p_assignment_scope_type text, p_assignment_scope_id uuid'
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.permission_scope_contains(p_owner_scope_type text, p_owner_scope_id uuid, p_assignment_scope_type text, p_assignment_scope_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_owner record;
  v_assignment record;
begin
  if p_owner_scope_type not in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM')
    or p_assignment_scope_type not in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM')
    or p_owner_scope_id is null
    or p_assignment_scope_id is null then
    return false;
  end if;

  select *
  into v_owner
  from public.permission_scope_details(p_owner_scope_type, p_owner_scope_id);
  if not found then
    return false;
  end if;

  select *
  into v_assignment
  from public.permission_scope_details(p_assignment_scope_type, p_assignment_scope_id);
  if not found then
    return false;
  end if;

  -- Every valid scope contains itself.
  if p_owner_scope_type = p_assignment_scope_type
    and p_owner_scope_id = p_assignment_scope_id then
    return true;
  end if;

  -- Associations contain all of their clubs, divisions and teams.
  if p_owner_scope_type = 'ASSOCIATION' then
    return v_owner.association_id = v_assignment.association_id;
  end if;

  -- Club and division are separate branches. A club contains its teams, but
  -- does not contain an association-wide division.
  if p_owner_scope_type = 'CLUB' then
    return p_assignment_scope_type = 'TEAM'
      and v_owner.association_id = v_assignment.association_id
      and v_owner.club_id = v_assignment.club_id;
  end if;

  -- A division contains teams linked through either the legacy division_id
  -- column or the authoritative team_divisions junction.
  if p_owner_scope_type = 'DIVISION' then
    return p_assignment_scope_type = 'TEAM'
      and v_owner.association_id = v_assignment.association_id
      and (
        v_owner.division_id = v_assignment.division_id
        or exists (
          select 1
          from public.team_divisions team_division
          where team_division.team_id = v_assignment.team_id
            and team_division.division_id = v_owner.division_id
        )
      );
  end if;

  -- Team-owned sets may only be assigned back to that exact team; the exact
  -- match returned above is therefore the only valid team case.
  return false;
end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'enforce_permission_assignment_scope'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = ''
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.enforce_permission_assignment_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_set public.permission_sets%rowtype;
begin
  -- SHARE prevents an owner-scope change racing this assignment write.
  select *
  into v_set
  from public.permission_sets set_row
  where set_row.id = new.permission_set_id
  for share;

  if v_set.id is null then
    raise exception 'The selected permission set was not found.';
  end if;

  if not public.permission_scope_contains(
    v_set.owner_scope_type,
    v_set.owner_scope_id,
    new.scope_type,
    new.scope_id
  ) then
    raise exception 'The permission set owner scope must contain the assignment scope.';
  end if;

  return new;
end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

do $b1b_function$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'enforce_permission_set_owner_scope'
      and pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) = ''
  ) then
    execute $b1b_definition$
CREATE OR REPLACE FUNCTION public.enforce_permission_set_owner_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.owner_scope_type is not distinct from new.owner_scope_type
    and old.owner_scope_id is not distinct from new.owner_scope_id then
    return new;
  end if;

  if exists (
    select 1
    from public.permission_assignments assignment
    where assignment.permission_set_id = old.id
      and not public.permission_scope_contains(
        new.owner_scope_type,
        new.owner_scope_id,
        assignment.scope_type,
        assignment.scope_id
      )
  ) then
    raise exception 'The permission set owner scope cannot exclude an existing assignment.';
  end if;

  return new;
end;
$function$;
$b1b_definition$;
  end if;
end;
$b1b_function$;

-- RLS is explicit even though B1a already enables it on a fresh target.
alter table public.module_feature_flags enable row level security;
alter table public.administration_audit_log enable row level security;
alter table public.administration_integrity_snapshot_batches enable row level security;
alter table public.administration_membership_integrity_snapshot enable row level security;
alter table public.permission_catalogue enable row level security;
alter table public.permission_groups enable row level security;
alter table public.permission_group_members enable row level security;
alter table public.permission_sets enable row level security;
alter table public.permission_set_permissions enable row level security;
alter table public.permission_assignments enable row level security;
alter table public.permission_overrides enable row level security;
alter table private.auth_session_permission_modes enable row level security;
alter table private.auth_session_permission_modes force row level security;

drop policy if exists administration_audit_read_scoped on public.administration_audit_log;
create policy administration_audit_read_scoped on public.administration_audit_log
  for select to authenticated
  using (
    actor_id = (select auth.uid())
    or public.is_super_admin()
    or exists (
      select 1
      from public.user_roles role_row
      where role_row.user_id = (select auth.uid())
        and (
          (role_row.role::text = 'ASSOCIATION_ADMIN' and role_row.association_id = administration_audit_log.association_id)
          or (role_row.role::text = 'CLUB_ADMIN' and role_row.club_id = administration_audit_log.club_id)
          or (role_row.role::text = 'TEAM_MANAGER' and role_row.team_id = administration_audit_log.team_id)
        )
    )
  );

drop policy if exists administration_integrity_batches_super_read on public.administration_integrity_snapshot_batches;
create policy administration_integrity_batches_super_read on public.administration_integrity_snapshot_batches
  for select to authenticated using (public.is_super_admin());

drop policy if exists administration_integrity_snapshot_super_read on public.administration_membership_integrity_snapshot;
create policy administration_integrity_snapshot_super_read on public.administration_membership_integrity_snapshot
  for select to authenticated using (public.is_super_admin());

drop policy if exists module_feature_flags_select on public.module_feature_flags;
create policy module_feature_flags_select on public.module_feature_flags
  for select to authenticated
  using (public.can_manage_module_scope((select auth.uid()), scope_type, scope_id));

drop policy if exists permission_catalogue_authenticated_read on public.permission_catalogue;
create policy permission_catalogue_authenticated_read on public.permission_catalogue
  for select to authenticated using (true);

drop policy if exists permission_groups_scoped_read on public.permission_groups;
create policy permission_groups_scoped_read on public.permission_groups
  for select to authenticated
  using (public.can_manage_module_scope((select auth.uid()), scope_type, scope_id));

drop policy if exists permission_group_members_scoped_read on public.permission_group_members;
create policy permission_group_members_scoped_read on public.permission_group_members
  for select to authenticated
  using (exists (
    select 1
    from public.permission_groups group_row
    where group_row.id = group_id
      and public.can_manage_module_scope((select auth.uid()), group_row.scope_type, group_row.scope_id)
  ));

drop policy if exists permission_sets_scoped_read on public.permission_sets;
create policy permission_sets_scoped_read on public.permission_sets
  for select to authenticated
  using (public.can_manage_module_scope((select auth.uid()), owner_scope_type, owner_scope_id));

drop policy if exists permission_set_permissions_scoped_read on public.permission_set_permissions;
create policy permission_set_permissions_scoped_read on public.permission_set_permissions
  for select to authenticated
  using (exists (
    select 1
    from public.permission_sets set_row
    where set_row.id = permission_set_id
      and public.can_manage_module_scope((select auth.uid()), set_row.owner_scope_type, set_row.owner_scope_id)
  ));

drop policy if exists permission_assignments_scoped_read on public.permission_assignments;
create policy permission_assignments_scoped_read on public.permission_assignments
  for select to authenticated
  using (public.can_manage_module_scope((select auth.uid()), scope_type, scope_id));

drop policy if exists permission_overrides_scoped_read on public.permission_overrides;
create policy permission_overrides_scoped_read on public.permission_overrides
  for select to authenticated
  using (public.can_manage_module_scope((select auth.uid()), scope_type, scope_id));

drop trigger if exists permission_assignment_scope_guard on public.permission_assignments;
create trigger permission_assignment_scope_guard
  before insert or update of permission_set_id, scope_type, scope_id
  on public.permission_assignments
  for each row execute function public.enforce_permission_assignment_scope();

drop trigger if exists permission_set_owner_scope_guard on public.permission_sets;
create trigger permission_set_owner_scope_guard
  before update of owner_scope_type, owner_scope_id
  on public.permission_sets
  for each row execute function public.enforce_permission_set_owner_scope();

-- Tables are API-private by default. Only the five read surfaces used by the
-- current administration screens are exposed to authenticated users.
revoke all on table
  public.module_feature_flags,
  public.administration_audit_log,
  public.administration_integrity_snapshot_batches,
  public.administration_membership_integrity_snapshot,
  public.permission_catalogue,
  public.permission_groups,
  public.permission_group_members,
  public.permission_sets,
  public.permission_set_permissions,
  public.permission_assignments,
  public.permission_overrides,
  private.auth_session_permission_modes
from public, anon, authenticated;

grant select on table
  public.module_feature_flags,
  public.administration_audit_log,
  public.administration_integrity_snapshot_batches,
  public.administration_membership_integrity_snapshot,
  public.permission_catalogue
to authenticated;

grant all on table
  public.module_feature_flags,
  public.administration_audit_log,
  public.administration_integrity_snapshot_batches,
  public.administration_membership_integrity_snapshot,
  public.permission_catalogue,
  public.permission_groups,
  public.permission_group_members,
  public.permission_sets,
  public.permission_set_permissions,
  public.permission_assignments,
  public.permission_overrides
to service_role;

revoke all on sequence private.auth_session_permission_mode_revision_seq
  from public, anon, authenticated;
grant usage, select, update on sequence private.auth_session_permission_mode_revision_seq
  to service_role;

grant usage on schema private to authenticated, service_role;

-- Remove PostgreSQL's default PUBLIC execution before applying the explicit
-- authenticated and service-role allow-lists below.

revoke all on function public.is_super_admin() from public, anon, authenticated, service_role;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_super_admin() to service_role;

revoke all on function public.can_manage_module_scope(p_user_id uuid, p_scope_type text, p_scope_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.can_manage_module_scope(p_user_id uuid, p_scope_type text, p_scope_id uuid) to authenticated;
grant execute on function public.can_manage_module_scope(p_user_id uuid, p_scope_type text, p_scope_id uuid) to service_role;

revoke all on function public.permission_scope_details(p_scope_type text, p_scope_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.permission_scope_details(p_scope_type text, p_scope_id uuid) to service_role;

revoke all on function public.resolve_module_enabled(p_module_key text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.resolve_module_enabled(p_module_key text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) to authenticated;
grant execute on function public.resolve_module_enabled(p_module_key text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) to service_role;

revoke all on function public.permission_user_in_scope(p_user_id uuid, p_scope_type text, p_scope_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.permission_user_in_scope(p_user_id uuid, p_scope_type text, p_scope_id uuid) to service_role;

revoke all on function public.permission_subject_matches(p_user_id uuid, p_subject_type text, p_subject_key text, p_association_id uuid, p_club_id uuid, p_team_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.permission_subject_matches(p_user_id uuid, p_subject_type text, p_subject_key text, p_association_id uuid, p_club_id uuid, p_team_id uuid) to service_role;

revoke all on function public.permission_subject_matches_for_mode(p_user_id uuid, p_effective_mode text, p_subject_type text, p_subject_key text, p_rule_scope_type text, p_rule_scope_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.permission_subject_matches_for_mode(p_user_id uuid, p_effective_mode text, p_subject_type text, p_subject_key text, p_rule_scope_type text, p_rule_scope_id uuid) to service_role;

revoke all on function public.administration_effective_mode(p_requested_mode text) from public, anon, authenticated, service_role;
grant execute on function public.administration_effective_mode(p_requested_mode text) to authenticated;
grant execute on function public.administration_effective_mode(p_requested_mode text) to service_role;

revoke all on function private.permission_context_canonical_scope(p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) from public, anon, authenticated, service_role;

revoke all on function private.active_permission_mode_for_current_session() from public, anon, authenticated, service_role;

revoke all on function private.current_session_scope_allows(p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) from public, anon, authenticated, service_role;

revoke all on function public.administration_scope_allows(p_requested_mode text, p_association_id uuid, p_club_id uuid, p_team_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.administration_scope_allows(p_requested_mode text, p_association_id uuid, p_club_id uuid, p_team_id uuid) to authenticated;
grant execute on function public.administration_scope_allows(p_requested_mode text, p_association_id uuid, p_club_id uuid, p_team_id uuid) to service_role;

revoke all on function public.permission_mode_scope_allows(p_actor_mode text, p_scope_type text, p_scope_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.permission_mode_scope_allows(p_actor_mode text, p_scope_type text, p_scope_id uuid) to service_role;

revoke all on function public.permission_subject_manageable(p_actor_mode text, p_subject_type text, p_subject_key text) from public, anon, authenticated, service_role;
grant execute on function public.permission_subject_manageable(p_actor_mode text, p_subject_type text, p_subject_key text) to service_role;

revoke all on function public.resolve_effective_permission(p_permission_key text, p_user_id uuid, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.resolve_effective_permission(p_permission_key text, p_user_id uuid, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) to service_role;

revoke all on function public.resolve_effective_permission_for_mode_unchecked(p_permission_key text, p_actor_mode text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.resolve_effective_permission_for_mode_unchecked(p_permission_key text, p_actor_mode text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) to service_role;

revoke all on function public.resolve_effective_permission_for_mode(p_permission_key text, p_actor_mode text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.resolve_effective_permission_for_mode(p_permission_key text, p_actor_mode text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) to authenticated;
grant execute on function public.resolve_effective_permission_for_mode(p_permission_key text, p_actor_mode text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) to service_role;

revoke all on function private.module_allowed_for_current_session(p_module_key text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) from public, anon, authenticated, service_role;
grant execute on function private.module_allowed_for_current_session(p_module_key text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) to authenticated;

revoke all on function public.has_effective_permission(p_permission_key text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.has_effective_permission(p_permission_key text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) to service_role;

revoke all on function public.permission_visible_profiles(p_scope_type text, p_scope_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.permission_visible_profiles(p_scope_type text, p_scope_id uuid) to service_role;

revoke all on function public.permission_visible_profiles_for_mode(p_scope_type text, p_scope_id uuid, p_actor_mode text) from public, anon, authenticated, service_role;
grant execute on function public.permission_visible_profiles_for_mode(p_scope_type text, p_scope_id uuid, p_actor_mode text) to authenticated;
grant execute on function public.permission_visible_profiles_for_mode(p_scope_type text, p_scope_id uuid, p_actor_mode text) to service_role;

revoke all on function public.permission_save_group_unchecked(p_group_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_member_ids uuid[], p_active boolean, p_actor_mode text) from public, anon, authenticated, service_role;
grant execute on function public.permission_save_group_unchecked(p_group_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_member_ids uuid[], p_active boolean, p_actor_mode text) to service_role;

revoke all on function public.permission_save_set_unchecked(p_permission_set_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_permissions jsonb, p_active boolean, p_actor_mode text) from public, anon, authenticated, service_role;
grant execute on function public.permission_save_set_unchecked(p_permission_set_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_permissions jsonb, p_active boolean, p_actor_mode text) to service_role;

revoke all on function public.permission_save_assignment_unchecked(p_assignment_id uuid, p_permission_set_id uuid, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_active boolean, p_actor_mode text) from public, anon, authenticated, service_role;
grant execute on function public.permission_save_assignment_unchecked(p_assignment_id uuid, p_permission_set_id uuid, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_active boolean, p_actor_mode text) to service_role;

revoke all on function public.permission_save_override_unchecked(p_permission_key text, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_allowed boolean, p_reason text, p_active boolean, p_actor_mode text) from public, anon, authenticated, service_role;
grant execute on function public.permission_save_override_unchecked(p_permission_key text, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_allowed boolean, p_reason text, p_active boolean, p_actor_mode text) to service_role;

revoke all on function public.save_permission_group(p_group_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_member_ids uuid[], p_active boolean, p_actor_mode text) from public, anon, authenticated, service_role;
grant execute on function public.save_permission_group(p_group_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_member_ids uuid[], p_active boolean, p_actor_mode text) to authenticated;
grant execute on function public.save_permission_group(p_group_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_member_ids uuid[], p_active boolean, p_actor_mode text) to service_role;

revoke all on function public.save_permission_set(p_permission_set_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_permissions jsonb, p_active boolean, p_actor_mode text) from public, anon, authenticated, service_role;
grant execute on function public.save_permission_set(p_permission_set_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_permissions jsonb, p_active boolean, p_actor_mode text) to authenticated;
grant execute on function public.save_permission_set(p_permission_set_id uuid, p_name text, p_description text, p_scope_type text, p_scope_id uuid, p_permissions jsonb, p_active boolean, p_actor_mode text) to service_role;

revoke all on function public.save_permission_assignment(p_assignment_id uuid, p_permission_set_id uuid, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_active boolean, p_actor_mode text) from public, anon, authenticated, service_role;
grant execute on function public.save_permission_assignment(p_assignment_id uuid, p_permission_set_id uuid, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_active boolean, p_actor_mode text) to authenticated;
grant execute on function public.save_permission_assignment(p_assignment_id uuid, p_permission_set_id uuid, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_active boolean, p_actor_mode text) to service_role;

revoke all on function public.save_permission_override(p_permission_key text, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_allowed boolean, p_reason text, p_active boolean, p_actor_mode text) from public, anon, authenticated, service_role;
grant execute on function public.save_permission_override(p_permission_key text, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_allowed boolean, p_reason text, p_active boolean, p_actor_mode text) to authenticated;
grant execute on function public.save_permission_override(p_permission_key text, p_subject_type text, p_subject_key text, p_scope_type text, p_scope_id uuid, p_allowed boolean, p_reason text, p_active boolean, p_actor_mode text) to service_role;

revoke all on function public.set_module_feature_flag(p_module_key text, p_scope_type text, p_scope_id uuid, p_enabled boolean, p_notes text) from public, anon, authenticated, service_role;
grant execute on function public.set_module_feature_flag(p_module_key text, p_scope_type text, p_scope_id uuid, p_enabled boolean, p_notes text) to authenticated;
grant execute on function public.set_module_feature_flag(p_module_key text, p_scope_type text, p_scope_id uuid, p_enabled boolean, p_notes text) to service_role;

revoke all on function public.clear_module_feature_flag(p_module_key text, p_scope_type text, p_scope_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.clear_module_feature_flag(p_module_key text, p_scope_type text, p_scope_id uuid) to authenticated;
grant execute on function public.clear_module_feature_flag(p_module_key text, p_scope_type text, p_scope_id uuid) to service_role;

revoke all on function public.get_active_permission_mode() from public, anon, authenticated, service_role;
grant execute on function public.get_active_permission_mode() to authenticated;
grant execute on function public.get_active_permission_mode() to service_role;

revoke all on function public.set_active_permission_context(p_root_mode text, p_active_mode text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.set_active_permission_context(p_root_mode text, p_active_mode text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) to authenticated;
grant execute on function public.set_active_permission_context(p_root_mode text, p_active_mode text, p_association_id uuid, p_club_id uuid, p_division_id uuid, p_team_id uuid) to service_role;

revoke all on function public.set_active_permission_mode(p_root_mode text, p_active_mode text) from public, anon, authenticated, service_role;
grant execute on function public.set_active_permission_mode(p_root_mode text, p_active_mode text) to authenticated;
grant execute on function public.set_active_permission_mode(p_root_mode text, p_active_mode text) to service_role;

revoke all on function public.list_permission_management_records_for_mode(p_scope_type text, p_scope_id uuid, p_actor_mode text) from public, anon, authenticated, service_role;
grant execute on function public.list_permission_management_records_for_mode(p_scope_type text, p_scope_id uuid, p_actor_mode text) to authenticated;
grant execute on function public.list_permission_management_records_for_mode(p_scope_type text, p_scope_id uuid, p_actor_mode text) to service_role;

revoke all on function public.permission_scope_contains(p_owner_scope_type text, p_owner_scope_id uuid, p_assignment_scope_type text, p_assignment_scope_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.permission_scope_contains(p_owner_scope_type text, p_owner_scope_id uuid, p_assignment_scope_type text, p_assignment_scope_id uuid) to service_role;

revoke all on function public.enforce_permission_assignment_scope() from public, anon, authenticated, service_role;
grant execute on function public.enforce_permission_assignment_scope() to service_role;

revoke all on function public.enforce_permission_set_owner_scope() from public, anon, authenticated, service_role;
grant execute on function public.enforce_permission_set_owner_scope() to service_role;

-- Allow Player Explorer reads only inside the signed-in user's active
-- association, club or team scope. Super Admin mode keeps global access.

create or replace function private.player_explorer_super_admin_mode()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin()
    and private.active_permission_mode_for_current_session() = 'super_admin';
$$;

create or replace function private.player_explorer_team_in_scope(p_team_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_mode text;
  v_association_id uuid;
  v_club_id uuid;
begin
  if v_actor is null or p_team_id is null then
    return false;
  end if;

  select club.association_id, team.club_id
  into v_association_id, v_club_id
  from public.teams team
  join public.clubs club on club.id = team.club_id
  where team.id = p_team_id;

  if not found then
    return false;
  end if;

  v_mode := private.active_permission_mode_for_current_session();
  if v_mode not in ('super_admin', 'association', 'club', 'team_manager', 'coach') then
    return false;
  end if;

  if not private.current_session_scope_allows(
    v_association_id,
    v_club_id,
    null,
    p_team_id
  ) then
    return false;
  end if;

  -- A Super Admin in a lower preview mode is still restricted above by the
  -- active Auth-session scope. True Super Admin mode is global.
  if public.is_super_admin() then
    return true;
  end if;

  return exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = v_actor
      and (
        (v_mode = 'association'
          and role_row.role::text = 'ASSOCIATION_ADMIN'
          and role_row.association_id = v_association_id)
        or (v_mode = 'club'
          and role_row.role::text = 'CLUB_ADMIN'
          and role_row.club_id = v_club_id)
        or (v_mode = 'team_manager'
          and role_row.role::text = 'TEAM_MANAGER'
          and role_row.team_id = p_team_id)
        or (v_mode = 'coach'
          and role_row.role::text = 'COACH'
          and role_row.team_id = p_team_id)
      )
  );
exception
  when others then
    return false;
end;
$$;

create or replace function private.player_explorer_appearance_in_scope(p_appearance_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_revsports_team_id text;
begin
  select
    case appearance.team_side
      when 'home' then fixture.home_team_id
      when 'away' then fixture.away_team_id
    end,
    appearance.revsports_team_id
  into v_team_id, v_revsports_team_id
  from public.source_revsports_player_appearances appearance
  join public.source_revsports_matches source_match
    on source_match.id = appearance.match_id
  left join public.fixtures fixture
    on fixture.revsports_match_url = source_match.match_url
  where appearance.id = p_appearance_id
  order by fixture.id
  limit 1;

  if not found then
    return false;
  end if;

  if v_team_id is null and v_revsports_team_id is not null then
    select link.target_id
    into v_team_id
    from public.external_entities entity
    join public.external_entity_links link
      on link.external_entity_id = entity.id
     and link.target_table = 'teams'
     and link.status = 'matched'
    where entity.source = 'revsports'
      and entity.entity_type = 'team'
      and entity.external_id = v_revsports_team_id
    order by link.id
    limit 1;
  end if;

  return private.player_explorer_team_in_scope(v_team_id);
exception
  when others then
    return false;
end;
$$;

create or replace function private.player_explorer_match_in_scope(p_match_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_home_team_id uuid;
  v_away_team_id uuid;
begin
  select fixture.home_team_id, fixture.away_team_id
  into v_home_team_id, v_away_team_id
  from public.source_revsports_matches source_match
  join public.fixtures fixture
    on fixture.revsports_match_url = source_match.match_url
  where source_match.id = p_match_id
  order by fixture.id
  limit 1;

  if not found then
    return false;
  end if;

  return private.player_explorer_team_in_scope(v_home_team_id)
    or private.player_explorer_team_in_scope(v_away_team_id);
exception
  when others then
    return false;
end;
$$;

create or replace function private.player_explorer_external_entity_in_scope(p_entity_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_entity_type text;
  v_external_id text;
begin
  select entity.entity_type, entity.external_id
  into v_entity_type, v_external_id
  from public.external_entities entity
  where entity.id = p_entity_id
    and entity.source = 'revsports';

  if not found or v_external_id is null then
    return false;
  end if;

  if v_entity_type = 'team' then
    return exists (
      select 1
      from public.external_entity_links link
      where link.external_entity_id = p_entity_id
        and link.target_table = 'teams'
        and link.status = 'matched'
        and private.player_explorer_team_in_scope(link.target_id)
    );
  end if;

  if v_entity_type = 'player' then
    return exists (
      select 1
      from public.source_revsports_player_appearances appearance
      where appearance.revsports_player_id = v_external_id
        and private.player_explorer_appearance_in_scope(appearance.id)
    );
  end if;

  return false;
exception
  when others then
    return false;
end;
$$;

revoke all on function private.player_explorer_super_admin_mode()
  from public, anon;
revoke all on function private.player_explorer_team_in_scope(uuid)
  from public, anon;
revoke all on function private.player_explorer_appearance_in_scope(uuid)
  from public, anon;
revoke all on function private.player_explorer_match_in_scope(uuid)
  from public, anon;
revoke all on function private.player_explorer_external_entity_in_scope(uuid)
  from public, anon;

grant execute on function private.player_explorer_super_admin_mode()
  to authenticated, service_role;
grant execute on function private.player_explorer_team_in_scope(uuid)
  to authenticated, service_role;
grant execute on function private.player_explorer_appearance_in_scope(uuid)
  to authenticated, service_role;
grant execute on function private.player_explorer_match_in_scope(uuid)
  to authenticated, service_role;
grant execute on function private.player_explorer_external_entity_in_scope(uuid)
  to authenticated, service_role;

-- Replace the original global Super Admin reads with active-mode-aware
-- versions so "Viewing as" cannot retain global Player Explorer access.
drop policy if exists "Admins can view source revsports matches"
  on public.source_revsports_matches;
create policy "Admins can view source revsports matches"
on public.source_revsports_matches
for select
to authenticated
using (private.player_explorer_super_admin_mode());

drop policy if exists "Admins can view source revsports player appearances"
  on public.source_revsports_player_appearances;
create policy "Admins can view source revsports player appearances"
on public.source_revsports_player_appearances
for select
to authenticated
using (private.player_explorer_super_admin_mode());

drop policy if exists "Admins can view external entities"
  on public.external_entities;
create policy "Admins can view external entities"
on public.external_entities
for select
to authenticated
using (private.player_explorer_super_admin_mode());

drop policy if exists "Admins can view external entity links"
  on public.external_entity_links;
create policy "Admins can view external entity links"
on public.external_entity_links
for select
to authenticated
using (private.player_explorer_super_admin_mode());

drop policy if exists "Admins can manage external entity links"
  on public.external_entity_links;
create policy "Admins can manage external entity links"
on public.external_entity_links
for all
to authenticated
using (private.player_explorer_super_admin_mode())
with check (private.player_explorer_super_admin_mode());

create policy "Scoped roles can view Player Explorer matches"
on public.source_revsports_matches
for select
to authenticated
using (private.player_explorer_match_in_scope(id));

create policy "Scoped roles can view Player Explorer appearances"
on public.source_revsports_player_appearances
for select
to authenticated
using (private.player_explorer_appearance_in_scope(id));

create policy "Scoped roles can view Player Explorer entities"
on public.external_entities
for select
to authenticated
using (private.player_explorer_external_entity_in_scope(id));

create policy "Scoped roles can view Player Explorer links"
on public.external_entity_links
for select
to authenticated
using (private.player_explorer_external_entity_in_scope(external_entity_id));

comment on function private.player_explorer_team_in_scope(uuid) is
  'Fail-closed Player Explorer scope check for the current Auth session and active app mode.';
comment on function private.player_explorer_super_admin_mode() is
  'True only for a real Super Admin whose current Auth session remains in global Super Admin mode.';
comment on function private.player_explorer_appearance_in_scope(uuid) is
  'Restricts a RevSports player appearance to its resolved SportStack team scope.';
comment on function private.player_explorer_match_in_scope(uuid) is
  'Allows match context only when the fixture involves a team inside the active Player Explorer scope.';
comment on function private.player_explorer_external_entity_in_scope(uuid) is
  'Restricts RevSports team and player identity rows to the active Player Explorer scope.';

notify pgrst, 'reload schema';

-- Keep the shared module controls aware of the Coordination module.
-- Coordination defaults to enabled until an administrator adds a scoped override.

alter table public.module_feature_flags
  drop constraint if exists module_feature_flags_module_key_check;
alter table public.module_feature_flags
  add constraint module_feature_flags_module_key_check check (
    module_key in (
      'player_mvp', 'umpire_match_voting', 'committee', 'safety_risk',
      'hockey_trace', 'incident_discipline', 'coordination'
    )
  );

create or replace function public.set_module_feature_flag(
  p_module_key text,
  p_scope_type text,
  p_scope_id uuid,
  p_enabled boolean,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_flag_id uuid;
begin
  if p_module_key not in (
    'player_mvp', 'umpire_match_voting', 'committee', 'safety_risk',
    'hockey_trace', 'incident_discipline', 'coordination'
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

create or replace function public.resolve_module_enabled(
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
  v_enabled boolean;
begin
  if p_module_key not in (
    'player_mvp', 'umpire_match_voting', 'committee', 'safety_risk',
    'hockey_trace', 'incident_discipline', 'coordination'
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

  return coalesce(v_enabled, p_module_key not in ('hockey_trace', 'incident_discipline'));
end;
$function$;

revoke all on function public.set_module_feature_flag(text, text, uuid, boolean, text)
  from public, anon;
revoke all on function public.resolve_module_enabled(text, uuid, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.set_module_feature_flag(text, text, uuid, boolean, text)
  to authenticated;
grant execute on function public.resolve_module_enabled(text, uuid, uuid, uuid, uuid)
  to authenticated;

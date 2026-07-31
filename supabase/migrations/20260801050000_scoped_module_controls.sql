-- Allow association and club administrators to control SportStack modules at
-- association, club, division and team scope. A missing row inherits from the
-- closest parent; all current modules remain enabled by default.

create table if not exists public.module_feature_flags (
  id uuid primary key default gen_random_uuid(),
  module_key text not null,
  scope_type text not null,
  scope_id uuid not null,
  enabled boolean not null,
  association_id uuid references public.associations(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  division_id uuid references public.divisions(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The older integration draft may have created this table with separate scope
-- columns. Bring that shape forward without losing a reviewed legacy row.
alter table public.module_feature_flags
  add column if not exists scope_type text,
  add column if not exists scope_id uuid,
  add column if not exists association_id uuid references public.associations(id) on delete cascade,
  add column if not exists club_id uuid references public.clubs(id) on delete cascade,
  add column if not exists division_id uuid references public.divisions(id) on delete cascade,
  add column if not exists team_id uuid references public.teams(id) on delete cascade,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

update public.module_feature_flags
set
  scope_type = case
    when team_id is not null then 'TEAM'
    when division_id is not null then 'DIVISION'
    when club_id is not null then 'CLUB'
    when association_id is not null then 'ASSOCIATION'
    else scope_type
  end,
  scope_id = coalesce(team_id, division_id, club_id, association_id, scope_id)
where scope_type is null or scope_id is null;

update public.module_feature_flags
set module_key = 'umpire_match_voting'
where module_key = 'umpire_voting';

do $migration_check$
begin
  if exists (
    select 1 from public.module_feature_flags
    where scope_type is null or scope_id is null
  ) then
    raise exception 'A legacy global module flag needs a scope before module controls can be upgraded.';
  end if;
end;
$migration_check$;

alter table public.module_feature_flags
  alter column scope_type set not null,
  alter column scope_id set not null,
  drop constraint if exists module_feature_flags_module_key_check,
  drop constraint if exists module_feature_flags_scope_type_check;

alter table public.module_feature_flags
  add constraint module_feature_flags_module_key_check check (
    module_key in ('player_mvp', 'umpire_match_voting', 'committee', 'safety_risk', 'hockey_trace')
  ),
  add constraint module_feature_flags_scope_type_check check (
    scope_type in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM')
  );

drop index if exists public.module_feature_flags_scope_key;
create unique index if not exists module_feature_flags_module_scope_key
  on public.module_feature_flags (module_key, scope_type, scope_id);

comment on table public.module_feature_flags is
  'Explicit module enable or disable overrides. Missing rows inherit from the closest parent scope.';

create index if not exists module_feature_flags_scope_idx
  on public.module_feature_flags (scope_type, scope_id, module_key);

create or replace function public.can_manage_module_scope(
  p_user_id uuid,
  p_scope_type text,
  p_scope_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_user_id is not null
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

revoke all on function public.can_manage_module_scope(uuid, text, uuid)
  from public, anon;
grant execute on function public.can_manage_module_scope(uuid, text, uuid)
  to authenticated;

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
  if p_module_key not in ('player_mvp', 'umpire_match_voting', 'committee', 'safety_risk', 'hockey_trace') then
    raise exception 'Unknown SportStack module.';
  end if;
  if p_scope_type not in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM') then
    raise exception 'Unknown module scope.';
  end if;

  if not public.can_manage_module_scope(v_actor_id, p_scope_type, p_scope_id) then
    raise exception 'You do not have permission to manage modules at this scope.';
  end if;

  -- Confirm the polymorphic scope ID points to the named entity type.
  if (p_scope_type = 'ASSOCIATION' and not exists (select 1 from public.associations where id = p_scope_id))
    or (p_scope_type = 'CLUB' and not exists (select 1 from public.clubs where id = p_scope_id))
    or (p_scope_type = 'DIVISION' and not exists (select 1 from public.divisions where id = p_scope_id))
    or (p_scope_type = 'TEAM' and not exists (select 1 from public.teams where id = p_scope_id)) then
    raise exception 'The selected module scope was not found.';
  end if;

  insert into public.module_feature_flags (
    module_key,
    scope_type,
    scope_id,
    enabled,
    notes,
    created_by,
    updated_by
  )
  values (
    p_module_key,
    p_scope_type,
    p_scope_id,
    p_enabled,
    nullif(btrim(p_notes), ''),
    v_actor_id,
    v_actor_id
  )
  on conflict (module_key, scope_type, scope_id)
  do update set
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

create or replace function public.clear_module_feature_flag(
  p_module_key text,
  p_scope_type text,
  p_scope_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
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
  if p_module_key not in ('player_mvp', 'umpire_match_voting', 'committee', 'safety_risk', 'hockey_trace') then
    raise exception 'Unknown SportStack module.';
  end if;

  select flag.enabled
  into v_enabled
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

  -- Preserve every currently available module until an administrator records
  -- an explicit override at an organisation scope.
  return coalesce(v_enabled, p_module_key <> 'hockey_trace');
end;
$function$;

revoke all on function public.set_module_feature_flag(text, text, uuid, boolean, text)
  from public, anon;
revoke all on function public.clear_module_feature_flag(text, text, uuid)
  from public, anon;
revoke all on function public.resolve_module_enabled(text, uuid, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.set_module_feature_flag(text, text, uuid, boolean, text)
  to authenticated;
grant execute on function public.clear_module_feature_flag(text, text, uuid)
  to authenticated;
grant execute on function public.resolve_module_enabled(text, uuid, uuid, uuid, uuid)
  to authenticated;

alter table public.module_feature_flags enable row level security;

drop policy if exists module_feature_flags_select on public.module_feature_flags;
create policy module_feature_flags_select
on public.module_feature_flags
for select
to authenticated
using (
  public.can_manage_module_scope(
    (select auth.uid()),
    module_feature_flags.scope_type,
    module_feature_flags.scope_id
  )
);

revoke all on table public.module_feature_flags from public, anon, authenticated;
grant select on table public.module_feature_flags to authenticated;
grant all on table public.module_feature_flags to service_role;

comment on function public.resolve_module_enabled(text, uuid, uuid, uuid, uuid) is
  'Returns the closest explicit team, division, club or association module override; current modules default to enabled.';

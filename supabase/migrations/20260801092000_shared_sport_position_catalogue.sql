create table if not exists public.sport_position_groups (
  code text primary key check (code in ('GOALKEEPER', 'DEFENCE', 'MIDFIELD', 'FORWARD')),
  label text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.sport_position_groups (code, label, sort_order)
values
  ('GOALKEEPER', 'Goalkeeper', 1),
  ('DEFENCE', 'Defence / Back', 2),
  ('MIDFIELD', 'Midfield', 3),
  ('FORWARD', 'Forward / Striker', 4)
on conflict (code) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    updated_at = now();

create table if not exists public.sport_position_aliases (
  id uuid primary key default gen_random_uuid(),
  sport text not null default 'field_hockey',
  canonical_group text not null references public.sport_position_groups(code),
  local_code text not null,
  local_label text not null,
  association_id uuid references public.associations(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sport_position_alias_scope_check check (
    (team_id is not null)
    or (club_id is not null and team_id is null)
    or (association_id is not null and club_id is null and team_id is null)
    or (association_id is null and club_id is null and team_id is null)
  )
);

create unique index if not exists sport_position_aliases_scope_code_key
on public.sport_position_aliases (
  sport,
  coalesce(association_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(club_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(local_code)
);

alter table public.formation_positions
  add column if not exists canonical_group text references public.sport_position_groups(code);

alter table public.player_position_preferences
  add column if not exists canonical_group text references public.sport_position_groups(code);

alter table public.sport_position_groups enable row level security;
alter table public.sport_position_aliases enable row level security;

drop policy if exists "Authenticated users read position groups" on public.sport_position_groups;
create policy "Authenticated users read position groups"
on public.sport_position_groups for select to authenticated
using (true);

drop policy if exists "Authenticated users read position aliases" on public.sport_position_aliases;
create policy "Authenticated users read position aliases"
on public.sport_position_aliases for select to authenticated
using (true);

drop policy if exists "Scoped admins manage position aliases" on public.sport_position_aliases;
create policy "Scoped admins manage position aliases"
on public.sport_position_aliases for all to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and (
        (ur.role = 'ASSOCIATION_ADMIN' and ur.association_id = sport_position_aliases.association_id)
        or (ur.role = 'CLUB_ADMIN' and ur.club_id = sport_position_aliases.club_id)
        or (ur.role in ('TEAM_MANAGER', 'COACH') and ur.team_id = sport_position_aliases.team_id)
      )
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and (
        (ur.role = 'ASSOCIATION_ADMIN' and ur.association_id = sport_position_aliases.association_id)
        or (ur.role = 'CLUB_ADMIN' and ur.club_id = sport_position_aliases.club_id)
        or (ur.role in ('TEAM_MANAGER', 'COACH') and ur.team_id = sport_position_aliases.team_id)
      )
  )
);

grant select on public.sport_position_groups to authenticated;
grant select, insert, update, delete on public.sport_position_aliases to authenticated;

comment on table public.sport_position_aliases is
  'Local association, club and team position labels mapped to four canonical SportStack position groups.';

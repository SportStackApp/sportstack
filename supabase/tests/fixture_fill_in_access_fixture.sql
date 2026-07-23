-- Minimal disposable schema for fixture-scoped fill-in migration checks.
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$$;

create schema if not exists private authorization postgres;

create type public.user_role_enum as enum (
  'SUPER_ADMIN', 'ASSOCIATION_ADMIN', 'CLUB_ADMIN', 'TEAM_MANAGER', 'COACH', 'PLAYER', 'UMPIRE', 'VOTER', 'UMPIRE_ADMIN'
);

create table public.associations (
  id uuid primary key,
  name text not null,
  timezone text default 'Australia/Melbourne'
);

create table public.clubs (
  id uuid primary key,
  association_id uuid not null references public.associations(id),
  name text not null
);

create table public.teams (
  id uuid primary key,
  club_id uuid not null references public.clubs(id),
  name text not null,
  banner_url text
);

create table public.profiles (
  id uuid primary key,
  first_name text,
  last_name text
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  role public.user_role_enum not null,
  association_id uuid references public.associations(id),
  club_id uuid references public.clubs(id),
  team_id uuid references public.teams(id)
);

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  team_id uuid not null references public.teams(id),
  status text not null default 'ACTIVE',
  membership_type text not null default 'PRIMARY',
  activated_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.fixtures (
  id uuid primary key,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  fixture_date timestamptz not null,
  status text not null default 'SCHEDULED'
);

create table public.communication_channels (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null,
  association_id uuid references public.associations(id),
  club_id uuid references public.clubs(id),
  team_id uuid references public.teams(id)
);

create table public.fixture_lineups (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id),
  team_id uuid not null references public.teams(id)
);
alter table public.fixture_lineups enable row level security;

create table public.mvp_voting_sessions (
  id uuid primary key,
  fixture_id uuid not null references public.fixtures(id),
  team_id uuid references public.teams(id),
  status text not null default 'OPEN',
  closes_at timestamptz
);

create table public.revsports_players (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id),
  profile_id uuid references public.profiles(id),
  attended boolean not null default false,
  team_side text
);

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'SUPER_ADMIN'
  )
$$;

create or replace function private.communication_is_super_admin()
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'SUPER_ADMIN'
  )
$$;

grant usage on schema public, private to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on public.fixture_lineups to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function private.communication_is_super_admin() to authenticated;

insert into public.associations(id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Association A'),
  ('10000000-0000-0000-0000-000000000002', 'Association B');

insert into public.clubs(id, association_id, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Club A'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Club B');

insert into public.teams(id, club_id, name) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Team A'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Team B');

insert into public.profiles(id, first_name, last_name) values
  ('40000000-0000-0000-0000-000000000001', 'Regular', 'Player'),
  ('40000000-0000-0000-0000-000000000002', 'Fixture', 'Fill-in'),
  ('40000000-0000-0000-0000-000000000003', 'Club', 'Manager'),
  ('40000000-0000-0000-0000-000000000004', 'Other', 'Player');

insert into public.team_memberships(user_id, team_id, status, membership_type) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'ACTIVE', 'PRIMARY'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'ACTIVE', 'PRIMARY');

insert into public.user_roles(user_id, role, club_id) values
  ('40000000-0000-0000-0000-000000000003', 'CLUB_ADMIN', '20000000-0000-0000-0000-000000000001');

insert into public.fixtures(id, home_team_id, away_team_id, fixture_date) values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', now() + interval '2 days'),
  ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', now() - interval '3 hours');

insert into public.communication_channels(id, scope_type, team_id) values
  ('60000000-0000-0000-0000-000000000001', 'TEAM', '30000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000002', 'TEAM', '30000000-0000-0000-0000-000000000002');

insert into public.fixture_lineups(id, fixture_id, team_id) values
  ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
  ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001');

insert into public.mvp_voting_sessions(id, fixture_id, team_id, status, closes_at) values
  ('80000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'OPEN', now() + interval '2 days');

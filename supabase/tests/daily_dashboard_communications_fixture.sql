-- Minimal isolated fixture for validating the daily dashboard communications migration.
-- Run only against a disposable local PostgreSQL database.

create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault cascade;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$$;

drop schema if exists auth cascade;
create schema auth authorization postgres;
create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.jwt()
returns jsonb language sql stable
as $$ select jsonb_build_object('role', current_setting('request.jwt.claim.role', true)) $$;

create type public.user_role_enum as enum (
  'SUPER_ADMIN', 'ASSOCIATION_ADMIN', 'CLUB_ADMIN', 'TEAM_MANAGER', 'COACH', 'PLAYER', 'UMPIRE', 'VOTER', 'UMPIRE_ADMIN'
);

create table auth.users (
  id uuid primary key,
  email text
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
  name text not null
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
  created_at timestamptz not null default now()
);

create table public.fixtures (
  id uuid primary key,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid references public.teams(id),
  association_id uuid references public.associations(id),
  fixture_date timestamptz not null,
  status text not null default 'SCHEDULED'
);

create table public.fixture_availability (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id),
  user_id uuid not null references public.profiles(id),
  status text not null default 'UNSURE'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  type text,
  message text,
  game_id uuid,
  team_id uuid references public.teams(id),
  action_url text
);

create table public.team_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id),
  user_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.team_messages enable row level security;
create policy team_messages_unsafe_fixture on public.team_messages
  for select to authenticated using (true);
grant select, insert on public.team_messages to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

insert into public.associations(id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Association A'),
  ('10000000-0000-0000-0000-000000000002', 'Association B');
insert into public.clubs(id, association_id, name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Club A'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Club B');
insert into public.teams(id, club_id, name) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Team A'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Team B');
insert into auth.users(id, email) values
  ('40000000-0000-0000-0000-000000000001', 'player-a@example.test'),
  ('40000000-0000-0000-0000-000000000002', 'player-b@example.test'),
  ('40000000-0000-0000-0000-000000000003', 'admin-a@example.test');
insert into public.profiles(id, first_name, last_name)
select id,
  case email when 'player-a@example.test' then 'Player' when 'player-b@example.test' then 'Other' else 'Admin' end,
  case email when 'player-a@example.test' then 'A' when 'player-b@example.test' then 'B' else 'A' end
from auth.users;
insert into public.team_memberships(user_id, team_id, membership_type) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'PRIMARY'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'PRIMARY');
insert into public.user_roles(user_id, role, club_id) values
  ('40000000-0000-0000-0000-000000000003', 'CLUB_ADMIN', '20000000-0000-0000-0000-000000000001');
insert into public.fixtures(id, home_team_id, away_team_id, association_id, fixture_date) values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', now() + interval '6 days');

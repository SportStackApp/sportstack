-- Draft migration only. Do not apply until reviewed against live data and RLS expectations.
-- This keeps old Lovable module data out of duplicate competition tables.

create table if not exists public.module_feature_flags (
  id uuid primary key default gen_random_uuid(),
  module_key text not null,
  enabled boolean not null default false,
  status text not null default 'draft',
  association_id uuid references public.associations(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint module_feature_flags_module_key_check check (
    module_key in ('safety_risk', 'umpire_voting', 'hockey_trace')
  ),
  constraint module_feature_flags_status_check check (
    status in ('draft', 'experimental', 'enabled', 'retired')
  )
);

create unique index if not exists module_feature_flags_scope_key
  on public.module_feature_flags (
    module_key,
    coalesce(association_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(club_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists public.hockey_trace_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  association_id uuid references public.associations(id) on delete set null,
  club_id uuid references public.clubs(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  player_id uuid references public.profiles(id) on delete set null,
  session_name text not null,
  session_date date,
  source_label text,
  status text not null default 'experimental',
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hockey_trace_sessions_status_check check (
    status in ('experimental', 'review', 'archived')
  )
);

create table if not exists public.hockey_trace_points (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.hockey_trace_sessions(id) on delete cascade,
  time_ms integer not null,
  x numeric,
  y numeric,
  latitude numeric,
  longitude numeric,
  speed_mps numeric,
  heart_rate integer,
  accel_mag numeric,
  gyro_mag numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.hockey_trace_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.hockey_trace_sessions(id) on delete cascade,
  time_ms integer not null,
  event_type text not null,
  confidence numeric not null,
  x numeric,
  y numeric,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint hockey_trace_events_type_check check (
    event_type in ('hit', 'trap', 'sprint', 'swing', 'note')
  ),
  constraint hockey_trace_events_confidence_check check (
    confidence >= 0 and confidence <= 100
  )
);

create index if not exists hockey_trace_sessions_scope_idx
  on public.hockey_trace_sessions (association_id, club_id, team_id, created_at desc);

create index if not exists hockey_trace_points_session_time_idx
  on public.hockey_trace_points (session_id, time_ms);

create index if not exists hockey_trace_events_session_time_idx
  on public.hockey_trace_events (session_id, time_ms);

grant select on public.module_feature_flags to authenticated;
grant select, insert, update on public.module_feature_flags to service_role;

grant select, insert, update, delete on public.hockey_trace_sessions to authenticated;
grant select, insert, update, delete on public.hockey_trace_points to authenticated;
grant select, insert, update, delete on public.hockey_trace_events to authenticated;
grant select, insert, update, delete on public.hockey_trace_sessions to service_role;
grant select, insert, update, delete on public.hockey_trace_points to service_role;
grant select, insert, update, delete on public.hockey_trace_events to service_role;

alter table public.module_feature_flags enable row level security;
alter table public.hockey_trace_sessions enable row level security;
alter table public.hockey_trace_points enable row level security;
alter table public.hockey_trace_events enable row level security;

drop policy if exists "Admins can read module feature flags" on public.module_feature_flags;
create policy "Admins can read module feature flags"
on public.module_feature_flags
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'SUPER_ADMIN'::public.app_role)
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('ASSOCIATION_ADMIN'::public.app_role, 'CLUB_ADMIN'::public.app_role)
      and (
        module_feature_flags.association_id is null
        or ur.association_id = module_feature_flags.association_id
        or ur.club_id = module_feature_flags.club_id
      )
  )
);

drop policy if exists "Admins can manage module feature flags" on public.module_feature_flags;
create policy "Admins can manage module feature flags"
on public.module_feature_flags
for all
to authenticated
using (
  public.has_role((select auth.uid()), 'SUPER_ADMIN'::public.app_role)
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('ASSOCIATION_ADMIN'::public.app_role, 'CLUB_ADMIN'::public.app_role)
      and (
        ur.association_id = module_feature_flags.association_id
        or ur.club_id = module_feature_flags.club_id
      )
  )
)
with check (
  public.has_role((select auth.uid()), 'SUPER_ADMIN'::public.app_role)
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('ASSOCIATION_ADMIN'::public.app_role, 'CLUB_ADMIN'::public.app_role)
      and (
        ur.association_id = module_feature_flags.association_id
        or ur.club_id = module_feature_flags.club_id
      )
  )
);

drop policy if exists "Trace sessions are visible to owner and scoped admins" on public.hockey_trace_sessions;
create policy "Trace sessions are visible to owner and scoped admins"
on public.hockey_trace_sessions
for select
to authenticated
using (
  created_by = (select auth.uid())
  or player_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'SUPER_ADMIN'::public.app_role)
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('ASSOCIATION_ADMIN'::public.app_role, 'CLUB_ADMIN'::public.app_role, 'TEAM_MANAGER'::public.app_role, 'COACH'::public.app_role)
      and (
        ur.association_id = hockey_trace_sessions.association_id
        or ur.club_id = hockey_trace_sessions.club_id
        or ur.team_id = hockey_trace_sessions.team_id
      )
  )
);

drop policy if exists "Trace session owners can create sessions" on public.hockey_trace_sessions;
create policy "Trace session owners can create sessions"
on public.hockey_trace_sessions
for insert
to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "Trace session owners can update sessions" on public.hockey_trace_sessions;
create policy "Trace session owners can update sessions"
on public.hockey_trace_sessions
for update
to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

drop policy if exists "Trace child rows follow visible sessions" on public.hockey_trace_points;
create policy "Trace child rows follow visible sessions"
on public.hockey_trace_points
for select
to authenticated
using (
  exists (
    select 1
    from public.hockey_trace_sessions s
    where s.id = hockey_trace_points.session_id
  )
);

drop policy if exists "Trace owners can insert points" on public.hockey_trace_points;
create policy "Trace owners can insert points"
on public.hockey_trace_points
for insert
to authenticated
with check (
  exists (
    select 1
    from public.hockey_trace_sessions s
    where s.id = hockey_trace_points.session_id
      and s.created_by = (select auth.uid())
  )
);

drop policy if exists "Trace event rows follow visible sessions" on public.hockey_trace_events;
create policy "Trace event rows follow visible sessions"
on public.hockey_trace_events
for select
to authenticated
using (
  exists (
    select 1
    from public.hockey_trace_sessions s
    where s.id = hockey_trace_events.session_id
  )
);

drop policy if exists "Trace owners can insert events" on public.hockey_trace_events;
create policy "Trace owners can insert events"
on public.hockey_trace_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.hockey_trace_sessions s
    where s.id = hockey_trace_events.session_id
      and s.created_by = (select auth.uid())
  )
);

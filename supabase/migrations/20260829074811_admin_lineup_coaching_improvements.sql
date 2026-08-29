-- Admin, line-up and coaching improvements approved on 29 August 2026.
-- This migration is additive except for replacing the raw Player MVP audit
-- policy with the narrower Super Admin and Club Admin rules.

alter table public.profiles
  add column if not exists preferred_name text,
  add column if not exists nickname text;

comment on column public.profiles.preferred_name is
  'Optional future display name. Stored now but not yet used in shared name formatting.';
comment on column public.profiles.nickname is
  'Optional nickname used only when a feature explicitly opts in.';

alter table public.formation_positions
  add column if not exists position_area text,
  add column if not exists position_side text;

alter table public.formation_positions
  drop constraint if exists formation_positions_position_area_check,
  add constraint formation_positions_position_area_check
    check (position_area is null or position_area in ('DEFENDER', 'MIDFIELDER', 'ATTACKER', 'GOALKEEPER')),
  drop constraint if exists formation_positions_position_side_check,
  add constraint formation_positions_position_side_check
    check (position_side is null or position_side in ('LEFT', 'CENTRE', 'RIGHT')),
  drop constraint if exists formation_positions_goalkeeper_side_check,
  add constraint formation_positions_goalkeeper_side_check
    check (position_area is distinct from 'GOALKEEPER' or position_side is null);

update public.formation_positions
set position_area = case
  when canonical_group = 'GOALKEEPER' or lower(name) ~ '(goalkeeper|goalie|keeper)' or upper(code) = 'GK' then 'GOALKEEPER'
  when canonical_group = 'DEFENCE' or lower(name) ~ '(defen|back|sweeper)' then 'DEFENDER'
  when canonical_group = 'MIDFIELD' or lower(name) ~ '(mid|half|inside)' then 'MIDFIELDER'
  when canonical_group = 'FORWARD' or lower(name) ~ '(attack|forward|striker|wing)' then 'ATTACKER'
  else position_area
end,
position_side = case
  when canonical_group = 'GOALKEEPER' or lower(name) ~ '(goalkeeper|goalie|keeper)' or upper(code) = 'GK' then null
  when lower(name) ~ '(^|[[:space:]])left([[:space:]]|$)' or upper(code) in ('LB', 'LH', 'LI', 'LW', 'LF') then 'LEFT'
  when lower(name) ~ '(^|[[:space:]])right([[:space:]]|$)' or upper(code) in ('RB', 'RH', 'RI', 'RW', 'RF') then 'RIGHT'
  when lower(name) ~ '(^|[[:space:]])(centre|center)([[:space:]]|$)' or upper(code) in ('CB', 'CH', 'CI', 'CM', 'CF') then 'CENTRE'
  else position_side
end
where position_area is null or (position_side is null and position_area is distinct from 'GOALKEEPER');

comment on column public.formation_positions.position_area is
  'Canonical hockey area behind the formation-specific display name.';
comment on column public.formation_positions.position_side is
  'Optional pitch side behind the formation-specific display name.';

create table if not exists public.fixture_lineup_roster_selections (
  id uuid primary key default gen_random_uuid(),
  fixture_lineup_id uuid not null references public.fixture_lineups(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  sort_order integer not null default 0,
  display_nickname boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_lineup_id, player_id)
);

create index if not exists fixture_lineup_roster_player_idx
  on public.fixture_lineup_roster_selections (player_id);

insert into public.fixture_lineup_roster_selections (
  fixture_lineup_id,
  player_id,
  sort_order
)
select
  fixture_lineup_id,
  player_id,
  min(sort_order)
from public.fixture_lineup_assignments
group by fixture_lineup_id, player_id
on conflict (fixture_lineup_id, player_id) do nothing;

create table if not exists public.fixture_lineup_position_overrides (
  id uuid primary key default gen_random_uuid(),
  fixture_lineup_id uuid not null references public.fixture_lineups(id) on delete cascade,
  formation_position_id uuid not null references public.formation_positions(id) on delete cascade,
  x_percent numeric(6,3) not null check (x_percent between 0 and 100),
  y_percent numeric(6,3) not null check (y_percent between 0 and 100),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_lineup_id, formation_position_id)
);

create index if not exists fixture_lineup_position_overrides_lineup_idx
  on public.fixture_lineup_position_overrides (fixture_lineup_id);

create table if not exists public.coach_player_fixture_notes (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  note text not null check (length(btrim(note)) > 0),
  source text not null default 'MANUAL' check (source in ('MANUAL', 'COACH_NARRATIVE')),
  coach_narrative_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_player_fixture_notes_lookup_idx
  on public.coach_player_fixture_notes (author_id, player_id, team_id, fixture_id, created_at desc);

drop trigger if exists update_fixture_lineup_roster_selections_updated_at
  on public.fixture_lineup_roster_selections;
create trigger update_fixture_lineup_roster_selections_updated_at
before update on public.fixture_lineup_roster_selections
for each row execute function public.update_updated_at();

drop trigger if exists update_fixture_lineup_position_overrides_updated_at
  on public.fixture_lineup_position_overrides;
create trigger update_fixture_lineup_position_overrides_updated_at
before update on public.fixture_lineup_position_overrides
for each row execute function public.update_updated_at();

drop trigger if exists update_coach_player_fixture_notes_updated_at
  on public.coach_player_fixture_notes;
create trigger update_coach_player_fixture_notes_updated_at
before update on public.coach_player_fixture_notes
for each row execute function public.update_updated_at();

alter table public.fixture_lineup_roster_selections enable row level security;
alter table public.fixture_lineup_position_overrides enable row level security;
alter table public.coach_player_fixture_notes enable row level security;

revoke all on public.fixture_lineup_roster_selections from public, anon, authenticated;
revoke all on public.fixture_lineup_position_overrides from public, anon, authenticated;
revoke all on public.coach_player_fixture_notes from public, anon, authenticated;
grant select, insert, update, delete on public.fixture_lineup_roster_selections to authenticated;
grant select, insert, update, delete on public.fixture_lineup_position_overrides to authenticated;
grant select, insert, update, delete on public.coach_player_fixture_notes to authenticated;
grant all on public.fixture_lineup_roster_selections to service_role;
grant all on public.fixture_lineup_position_overrides to service_role;
grant all on public.coach_player_fixture_notes to service_role;

drop policy if exists "Fixture lineup roster scoped select"
  on public.fixture_lineup_roster_selections;
create policy "Fixture lineup roster scoped select"
on public.fixture_lineup_roster_selections for select to authenticated
using (
  exists (
    select 1
    from public.fixture_lineups lineup
    where lineup.id = fixture_lineup_roster_selections.fixture_lineup_id
  )
);

drop policy if exists "Fixture lineup roster scoped manage"
  on public.fixture_lineup_roster_selections;
create policy "Fixture lineup roster scoped manage"
on public.fixture_lineup_roster_selections for all to authenticated
using (
  exists (
    select 1
    from public.fixture_lineups lineup
    where lineup.id = fixture_lineup_roster_selections.fixture_lineup_id
      and private.can_manage_fixture_team((select auth.uid()), lineup.team_id)
  )
)
with check (
  exists (
    select 1
    from public.fixture_lineups lineup
    where lineup.id = fixture_lineup_roster_selections.fixture_lineup_id
      and private.can_manage_fixture_team((select auth.uid()), lineup.team_id)
  )
);

drop policy if exists "Fixture lineup position overrides scoped select"
  on public.fixture_lineup_position_overrides;
create policy "Fixture lineup position overrides scoped select"
on public.fixture_lineup_position_overrides for select to authenticated
using (
  exists (
    select 1
    from public.fixture_lineups lineup
    where lineup.id = fixture_lineup_position_overrides.fixture_lineup_id
  )
);

drop policy if exists "Fixture lineup position overrides scoped manage"
  on public.fixture_lineup_position_overrides;
create policy "Fixture lineup position overrides scoped manage"
on public.fixture_lineup_position_overrides for all to authenticated
using (
  exists (
    select 1
    from public.fixture_lineups lineup
    where lineup.id = fixture_lineup_position_overrides.fixture_lineup_id
      and private.can_manage_fixture_team((select auth.uid()), lineup.team_id)
  )
)
with check (
  exists (
    select 1
    from public.fixture_lineups lineup
    where lineup.id = fixture_lineup_position_overrides.fixture_lineup_id
      and private.can_manage_fixture_team((select auth.uid()), lineup.team_id)
  )
);

drop policy if exists "Authors read own coach fixture notes"
  on public.coach_player_fixture_notes;
create policy "Authors read own coach fixture notes"
on public.coach_player_fixture_notes for select to authenticated
using (author_id = (select auth.uid()));

drop policy if exists "Authors add own coach fixture notes"
  on public.coach_player_fixture_notes;
create policy "Authors add own coach fixture notes"
on public.coach_player_fixture_notes for insert to authenticated
with check (
  author_id = (select auth.uid())
  and private.can_manage_fixture_team((select auth.uid()), team_id)
  and private.is_active_team_member(player_id, team_id)
  and exists (
    select 1 from public.fixtures fixture
    where fixture.id = coach_player_fixture_notes.fixture_id
      and coach_player_fixture_notes.team_id in (fixture.home_team_id, fixture.away_team_id)
  )
);

drop policy if exists "Authors update own coach fixture notes"
  on public.coach_player_fixture_notes;
create policy "Authors update own coach fixture notes"
on public.coach_player_fixture_notes for update to authenticated
using (author_id = (select auth.uid()))
with check (
  author_id = (select auth.uid())
  and private.can_manage_fixture_team((select auth.uid()), team_id)
  and private.is_active_team_member(player_id, team_id)
  and exists (
    select 1 from public.fixtures fixture
    where fixture.id = coach_player_fixture_notes.fixture_id
      and coach_player_fixture_notes.team_id in (fixture.home_team_id, fixture.away_team_id)
  )
);

drop policy if exists "Authors delete own coach fixture notes"
  on public.coach_player_fixture_notes;
create policy "Authors delete own coach fixture notes"
on public.coach_player_fixture_notes for delete to authenticated
using (author_id = (select auth.uid()));

drop policy if exists "Super Association admin full access - mvp_votes" on public.mvp_votes;
drop policy if exists "Super admin full access - mvp_votes" on public.mvp_votes;
drop policy if exists "Club admins read own club mvp_votes" on public.mvp_votes;

create policy "Super admin full access - mvp_votes"
on public.mvp_votes for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "Club admins read own club mvp_votes"
on public.mvp_votes for select to authenticated
using (
  exists (
    select 1
    from public.mvp_voting_sessions session
    join public.teams team on team.id = session.team_id
    join public.user_roles role
      on role.user_id = (select auth.uid())
     and role.role = 'CLUB_ADMIN'::public.user_role_enum
     and role.club_id = team.club_id
    where session.id = mvp_votes.session_id
  )
);

comment on table public.fixture_lineup_roster_selections is
  'Players selected for one fixture roster, including the per-fixture nickname-display choice.';
comment on table public.fixture_lineup_position_overrides is
  'Fixture-only marker positions that never alter the reusable formation template.';
comment on table public.coach_player_fixture_notes is
  'Author-private coaching notes for a player in a specific fixture; future Coach Narrative notes use the same record shape.';

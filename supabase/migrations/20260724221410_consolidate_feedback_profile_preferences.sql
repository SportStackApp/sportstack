-- Consolidated feedback foundation for account theme, team-scoped position
-- preferences and feedback photo reconciliation.

alter table public.profiles
  add column if not exists theme_preference text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_theme_preference_check'
  ) then
    alter table public.profiles
      add constraint profiles_theme_preference_check
      check (theme_preference is null or theme_preference in ('light', 'dark'));
  end if;
end
$$;

comment on column public.profiles.theme_preference is
  'The signed-in member light or dark theme choice. Null keeps the browser preference.';

alter table public.player_position_preferences
  add column if not exists team_id uuid references public.teams(id) on delete cascade;

alter table public.player_position_preferences
  drop constraint if exists player_position_preferences_player_id_position_code_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.player_position_preferences'::regclass
      and conname = 'player_position_preferences_player_team_position_key'
  ) then
    alter table public.player_position_preferences
      add constraint player_position_preferences_player_team_position_key
      unique (player_id, team_id, position_code);
  end if;
end
$$;

-- Preserve uniqueness for any older unscoped records while new records are
-- deliberately stored against a regular team.
create unique index if not exists player_position_preferences_legacy_position_key
  on public.player_position_preferences (player_id, position_code)
  where team_id is null;

create index if not exists player_position_preferences_team_player_idx
  on public.player_position_preferences (team_id, player_id);

alter table public.player_position_preferences enable row level security;

revoke all on table public.player_position_preferences from anon, authenticated;
grant select, insert, update, delete on table public.player_position_preferences to authenticated;
grant all on table public.player_position_preferences to service_role;

drop policy if exists "Players manage own preferences" on public.player_position_preferences;
create policy "Players manage regular team preferences"
on public.player_position_preferences
for all
to authenticated
using (
  player_id = (select auth.uid())
  and (
    team_id is null
    or exists (
      select 1
      from public.team_memberships tm
      where tm.user_id = (select auth.uid())
        and tm.team_id = player_position_preferences.team_id
        and tm.status::text = 'ACTIVE'
        and tm.membership_type::text in ('PRIMARY', 'SECONDARY', 'PERMANENT')
    )
  )
)
with check (
  player_id = (select auth.uid())
  and team_id is not null
  and exists (
    select 1
    from public.team_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.team_id = player_position_preferences.team_id
      and tm.status::text = 'ACTIVE'
      and tm.membership_type::text in ('PRIMARY', 'SECONDARY', 'PERMANENT')
  )
);

drop policy if exists "Coaches can read squad preferences" on public.player_position_preferences;
create policy "Team staff can read squad preferences"
on public.player_position_preferences
for select
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.user_roles ur
    join public.team_memberships tm
      on tm.team_id = player_position_preferences.team_id
     and tm.user_id = player_position_preferences.player_id
     and tm.status::text = 'ACTIVE'
    where ur.user_id = (select auth.uid())
      and ur.team_id = player_position_preferences.team_id
      and ur.role::text in ('COACH', 'TEAM_MANAGER')
  )
);

alter table public.coach_position_assessments
  drop constraint if exists coach_position_assessments_coach_id_player_id_position_code_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.coach_position_assessments'::regclass
      and conname = 'coach_position_assessments_coach_player_team_position_key'
  ) then
    alter table public.coach_position_assessments
      add constraint coach_position_assessments_coach_player_team_position_key
      unique (coach_id, player_id, team_id, position_code);
  end if;
end
$$;

create index if not exists coach_position_assessments_team_player_idx
  on public.coach_position_assessments (team_id, player_id);

alter table public.coach_position_assessments enable row level security;

revoke all on table public.coach_position_assessments from anon, authenticated;
grant select, insert, update, delete on table public.coach_position_assessments to authenticated;
grant all on table public.coach_position_assessments to service_role;

drop policy if exists "Coaches manage own assessments" on public.coach_position_assessments;
create policy "Team staff manage own assessments"
on public.coach_position_assessments
for all
to authenticated
using (
  coach_id = (select auth.uid())
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.team_id = coach_position_assessments.team_id
        and ur.role::text in ('COACH', 'TEAM_MANAGER')
    )
  )
)
with check (
  coach_id = (select auth.uid())
  and exists (
    select 1
    from public.team_memberships tm
    where tm.user_id = coach_position_assessments.player_id
      and tm.team_id = coach_position_assessments.team_id
      and tm.status::text = 'ACTIVE'
  )
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.team_id = coach_position_assessments.team_id
        and ur.role::text in ('COACH', 'TEAM_MANAGER')
    )
  )
);

create table if not exists public.app_feedback_attachments (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.app_feedback(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text,
  content_type text,
  file_size integer,
  created_at timestamptz not null default now()
);

create index if not exists app_feedback_attachments_feedback_id_idx
  on public.app_feedback_attachments (feedback_id);

create unique index if not exists app_feedback_attachments_feedback_path_key
  on public.app_feedback_attachments (feedback_id, storage_path);

alter table public.app_feedback_attachments enable row level security;

revoke all on table public.app_feedback_attachments from anon, authenticated;
grant select, insert on table public.app_feedback_attachments to authenticated;
grant all on table public.app_feedback_attachments to service_role;

drop policy if exists "Users can create their own feedback attachments" on public.app_feedback_attachments;
create policy "Users can create their own feedback attachments"
on public.app_feedback_attachments
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.app_feedback af
    where af.id = app_feedback_attachments.feedback_id
      and af.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can view their own feedback attachments" on public.app_feedback_attachments;
create policy "Users can view their own feedback attachments"
on public.app_feedback_attachments
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Admins can view feedback attachments" on public.app_feedback_attachments;
create policy "Admins can view feedback attachments"
on public.app_feedback_attachments
for select
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role::text = 'ASSOCIATION_ADMIN'
  )
);

-- Reconcile the legacy single-photo field without deleting it. The insert is
-- idempotent so the migration is safe when the earlier attachment migration
-- exists in one environment but not another.
insert into public.app_feedback_attachments (
  feedback_id,
  user_id,
  storage_path,
  file_name
)
select
  af.id,
  af.user_id,
  af.screenshot_path,
  regexp_replace(af.screenshot_path, '^.*/', '')
from public.app_feedback af
where af.screenshot_path is not null
  and btrim(af.screenshot_path) <> ''
on conflict (feedback_id, storage_path) do nothing;

comment on table public.app_feedback_attachments is
  'Private photos attached to app feedback. Access follows the parent feedback row.';

-- Correct team-position RLS checks so staff scope is evaluated without being
-- blocked by the underlying user_roles and team_memberships policies.

create or replace function private.is_active_team_member(
  p_user_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.team_memberships tm
    where tm.user_id = p_user_id
      and tm.team_id = p_team_id
      and tm.status::text = 'ACTIVE'
  );
$function$;

revoke all on function private.is_active_team_member(uuid, uuid) from public, anon;
grant execute on function private.is_active_team_member(uuid, uuid) to authenticated, service_role;

drop policy if exists "Team staff can read squad preferences"
  on public.player_position_preferences;
create policy "Team staff can read squad preferences"
on public.player_position_preferences
for select
to authenticated
using (
  public.is_super_admin()
  or private.can_manage_fixture_team((select auth.uid()), team_id)
);

drop policy if exists "Team staff manage own assessments"
  on public.coach_position_assessments;
create policy "Team staff manage own assessments"
on public.coach_position_assessments
for all
to authenticated
using (
  coach_id = (select auth.uid())
  and private.can_manage_fixture_team((select auth.uid()), team_id)
)
with check (
  coach_id = (select auth.uid())
  and private.can_manage_fixture_team((select auth.uid()), team_id)
  and private.is_active_team_member(player_id, team_id)
);

comment on function private.is_active_team_member(uuid, uuid) is
  'RLS-safe team membership check used by tightly scoped coaching policies.';

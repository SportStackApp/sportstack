-- Clear adviser findings introduced by the feedback and position foundation.

create index if not exists app_feedback_attachments_user_id_idx
  on public.app_feedback_attachments (user_id);

create index if not exists coach_position_assessments_player_id_idx
  on public.coach_position_assessments (player_id);

drop policy if exists "Players manage regular team preferences"
  on public.player_position_preferences;
drop policy if exists "Team staff can read squad preferences"
  on public.player_position_preferences;

create policy "Players and staff can read team preferences"
on public.player_position_preferences
for select
to authenticated
using (
  (
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
  or public.is_super_admin()
  or private.can_manage_fixture_team((select auth.uid()), team_id)
);

create policy "Players can add regular team preferences"
on public.player_position_preferences
for insert
to authenticated
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

create policy "Players can update regular team preferences"
on public.player_position_preferences
for update
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

create policy "Players can remove regular team preferences"
on public.player_position_preferences
for delete
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
);

drop policy if exists "Users can view their own feedback attachments"
  on public.app_feedback_attachments;
drop policy if exists "Admins can view feedback attachments"
  on public.app_feedback_attachments;

create policy "Owners and admins can view feedback attachments"
on public.app_feedback_attachments
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role::text = 'ASSOCIATION_ADMIN'
  )
);

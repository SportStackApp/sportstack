-- Active regular team members need read-only access to the position names in
-- their team's formations so profile preferences use team-defined positions.
-- Existing formation write policies are unchanged.

drop policy if exists "Regular members can read team formations"
  on public.formations;

create policy "Regular members can read team formations"
on public.formations
for select
to authenticated
using (
  owner_scope = 'TEAM'::public.formation_owner_scope
  and exists (
    select 1
    from public.team_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.team_id = formations.team_id
      and tm.status = 'ACTIVE'::public.membership_status_enum
      and tm.membership_type = any (
        array[
          'PRIMARY'::public.membership_type_enum,
          'SECONDARY'::public.membership_type_enum,
          'PERMANENT'::public.membership_type_enum
        ]
      )
  )
);

comment on policy "Regular members can read team formations" on public.formations is
  'Allows active regular members to read their team-owned formation and position definitions without granting write access.';

drop policy if exists "Regular members can read team formation positions"
  on public.formation_positions;

create policy "Regular members can read team formation positions"
on public.formation_positions
for select
to authenticated
using (
  exists (
    select 1
    from public.formations f
    join public.team_memberships tm
      on tm.team_id = f.team_id
     and tm.user_id = (select auth.uid())
     and tm.status = 'ACTIVE'::public.membership_status_enum
     and tm.membership_type = any (
       array[
         'PRIMARY'::public.membership_type_enum,
         'SECONDARY'::public.membership_type_enum,
         'PERMANENT'::public.membership_type_enum
       ]
     )
    where f.id = formation_positions.formation_id
      and f.owner_scope = 'TEAM'::public.formation_owner_scope
  )
);

comment on policy "Regular members can read team formation positions" on public.formation_positions is
  'Allows active regular members to read position definitions from their team-owned formations without granting write access.';

-- Fold regular-member visibility into the existing scoped read policy so
-- PostgreSQL evaluates one formation visibility policy instead of an extra
-- permissive policy for every row.

drop policy if exists "Regular members can read team formation positions"
  on public.formation_positions;
drop policy if exists "Regular members can read team formations"
  on public.formations;

drop policy if exists "Formation scoped select" on public.formations;
create policy "Formation scoped select"
on public.formations
for select
to authenticated
using (
  public.is_super_admin()
  or owner_scope = 'SUPER_ADMIN'::public.formation_owner_scope
  or (
    owner_scope = 'ASSOCIATION'::public.formation_owner_scope
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and (
          ur.role = 'SUPER_ADMIN'::public.user_role_enum
          or (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum and ur.association_id = formations.association_id)
          or exists (
            select 1
            from public.clubs c
            join public.teams t on t.club_id = c.id
            where c.association_id = formations.association_id
              and (
                (ur.role = 'CLUB_ADMIN'::public.user_role_enum and ur.club_id = c.id)
                or (ur.role = any (array['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) and ur.team_id = t.id)
              )
          )
        )
    )
  )
  or (
    owner_scope = 'CLUB'::public.formation_owner_scope
    and exists (
      select 1
      from public.user_roles ur
      left join public.teams t on t.id = ur.team_id
      where ur.user_id = (select auth.uid())
        and (
          (ur.role = 'CLUB_ADMIN'::public.user_role_enum and ur.club_id = formations.club_id)
          or (ur.role = any (array['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) and t.club_id = formations.club_id)
          or (
            ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
            and exists (
              select 1
              from public.clubs c
              where c.id = formations.club_id
                and c.association_id = ur.association_id
            )
          )
        )
    )
  )
  or (
    owner_scope = 'TEAM'::public.formation_owner_scope
    and (
      exists (
        select 1
        from public.user_roles ur
        join public.teams t on t.id = formations.team_id
        join public.clubs c on c.id = t.club_id
        where ur.user_id = (select auth.uid())
          and (
            (ur.role = any (array['TEAM_MANAGER'::public.user_role_enum, 'COACH'::public.user_role_enum]) and ur.team_id = formations.team_id)
            or (ur.role = 'CLUB_ADMIN'::public.user_role_enum and ur.club_id = c.id)
            or (ur.role = 'ASSOCIATION_ADMIN'::public.user_role_enum and ur.association_id = c.association_id)
          )
      )
      or exists (
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
    )
  )
);

comment on policy "Formation scoped select" on public.formations is
  'Scoped formation visibility for administrators, team staff and active regular members of team-owned formations.';

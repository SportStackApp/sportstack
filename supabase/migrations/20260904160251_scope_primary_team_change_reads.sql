-- Scoped administrators must be able to see the same requests that the
-- approve/decline functions authorise them to action.
create or replace function public.can_review_primary_team_change(
  p_to_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.teams team
    join public.clubs club on club.id = team.club_id
    join public.user_roles role_row on role_row.user_id = auth.uid()
    where team.id = p_to_team_id
      and (
        role_row.role::text = 'SUPER_ADMIN'
        or (role_row.role::text = 'ASSOCIATION_ADMIN' and role_row.association_id = club.association_id)
        or (role_row.role::text = 'CLUB_ADMIN' and role_row.club_id = team.club_id)
      )
  );
$function$;

revoke all on function public.can_review_primary_team_change(uuid) from public, anon;
grant execute on function public.can_review_primary_team_change(uuid) to authenticated;

drop policy if exists primary_change_requests_read_scoped_admin
  on public.primary_change_requests;
create policy primary_change_requests_read_scoped_admin
  on public.primary_change_requests
  for select
  to authenticated
  using (public.can_review_primary_team_change(to_team_id));

comment on function public.can_review_primary_team_change(uuid) is
  'Returns whether the signed-in administrator may review requests for one destination team.';

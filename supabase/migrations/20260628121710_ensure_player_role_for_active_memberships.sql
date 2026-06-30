-- Keep team membership and player role records in sync.
-- If a user becomes ACTIVE on a team, they should also have a scoped PLAYER role.

create or replace function public.ensure_player_role_for_active_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
  v_association_id uuid;
begin
  if new.status <> 'ACTIVE' then
    return new;
  end if;

  select t.club_id, c.association_id
    into v_club_id, v_association_id
  from public.teams t
  join public.clubs c on c.id = t.club_id
  where t.id = new.team_id;

  if v_club_id is null or v_association_id is null then
    return new;
  end if;

  insert into public.user_roles (user_id, role, association_id, club_id, team_id)
  select new.user_id, 'PLAYER'::public.user_role_enum, v_association_id, v_club_id, new.team_id
  where not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = new.user_id
      and ur.role = 'PLAYER'::public.user_role_enum
      and ur.team_id = new.team_id
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.ensure_player_role_for_active_membership() from public;

drop trigger if exists ensure_player_role_for_active_membership_trigger on public.team_memberships;

create trigger ensure_player_role_for_active_membership_trigger
after insert or update of status, team_id, user_id on public.team_memberships
for each row
when (new.status = 'ACTIVE')
execute function public.ensure_player_role_for_active_membership();

-- Backfill existing active memberships that were created without a PLAYER role.
insert into public.user_roles (user_id, role, association_id, club_id, team_id)
select distinct tm.user_id, 'PLAYER'::public.user_role_enum, c.association_id, t.club_id, tm.team_id
from public.team_memberships tm
join public.teams t on t.id = tm.team_id
join public.clubs c on c.id = t.club_id
where tm.status = 'ACTIVE'
  and not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = tm.user_id
      and ur.role = 'PLAYER'::public.user_role_enum
      and ur.team_id = tm.team_id
  )
on conflict do nothing;

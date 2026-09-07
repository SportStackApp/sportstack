-- Allow the trusted membership trigger to keep the legacy registered club in
-- step with a newly approved Primary team. Direct profile edits remain limited
-- to the existing Super, Association and Club Admin scopes.

create or replace function private.guard_registered_club_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if new.registered_club_id is not distinct from old.registered_club_id
     or v_user_id is null then
    return new;
  end if;

  -- The Primary-membership synchroniser updates profiles from inside a
  -- team_memberships trigger. Permit only that nested, derived value and only
  -- when it matches an active Primary membership for this profile.
  if pg_catalog.pg_trigger_depth() > 1 and exists (
    select 1
    from public.team_memberships membership
    join public.teams team on team.id = membership.team_id
    where membership.user_id = new.id
      and membership.status::text = 'ACTIVE'
      and membership.membership_type::text = 'PRIMARY'
      and team.club_id = new.registered_club_id
  ) then
    return new;
  end if;

  if not exists (
    select 1
    from public.user_roles role_row
    left join public.clubs new_club on new_club.id = new.registered_club_id
    left join public.clubs old_club on old_club.id = old.registered_club_id
    where role_row.user_id = v_user_id
      and (
        role_row.role::text = 'SUPER_ADMIN'
        or (
          role_row.role::text = 'ASSOCIATION_ADMIN'
          and role_row.association_id in (new_club.association_id, old_club.association_id)
        )
        or (
          role_row.role::text = 'CLUB_ADMIN'
          and role_row.club_id in (new.registered_club_id, old.registered_club_id)
        )
      )
  ) then
    raise exception using errcode = '42501', message = 'REGISTERED_CLUB_CHANGE_NOT_AUTHORISED';
  end if;

  return new;
end;
$function$;

revoke all on function private.guard_registered_club_change()
  from public, anon, authenticated;

comment on function private.guard_registered_club_change() is
  'Protects direct registered-club edits while allowing the trusted Primary-membership trigger to synchronise a matching active Primary club.';

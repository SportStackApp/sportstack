-- Keep permission sets inside the organisation scope that owns them.
-- An owner scope may assign at the same scope or below it, but never into a
-- sibling scope or another organisation. This invariant is enforced at the
-- table boundary as well as by the guarded administration RPCs.

create or replace function public.permission_scope_contains(
  p_owner_scope_type text,
  p_owner_scope_id uuid,
  p_assignment_scope_type text,
  p_assignment_scope_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_owner record;
  v_assignment record;
begin
  if p_owner_scope_type not in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM')
    or p_assignment_scope_type not in ('ASSOCIATION', 'CLUB', 'DIVISION', 'TEAM')
    or p_owner_scope_id is null
    or p_assignment_scope_id is null then
    return false;
  end if;

  select *
  into v_owner
  from public.permission_scope_details(p_owner_scope_type, p_owner_scope_id);
  if not found then
    return false;
  end if;

  select *
  into v_assignment
  from public.permission_scope_details(p_assignment_scope_type, p_assignment_scope_id);
  if not found then
    return false;
  end if;

  -- Every valid scope contains itself.
  if p_owner_scope_type = p_assignment_scope_type
    and p_owner_scope_id = p_assignment_scope_id then
    return true;
  end if;

  -- Associations contain all of their clubs, divisions and teams.
  if p_owner_scope_type = 'ASSOCIATION' then
    return v_owner.association_id = v_assignment.association_id;
  end if;

  -- Club and division are separate branches. A club contains its teams, but
  -- does not contain an association-wide division.
  if p_owner_scope_type = 'CLUB' then
    return p_assignment_scope_type = 'TEAM'
      and v_owner.association_id = v_assignment.association_id
      and v_owner.club_id = v_assignment.club_id;
  end if;

  -- A division contains teams linked through either the legacy division_id
  -- column or the authoritative team_divisions junction.
  if p_owner_scope_type = 'DIVISION' then
    return p_assignment_scope_type = 'TEAM'
      and v_owner.association_id = v_assignment.association_id
      and (
        v_owner.division_id = v_assignment.division_id
        or exists (
          select 1
          from public.team_divisions team_division
          where team_division.team_id = v_assignment.team_id
            and team_division.division_id = v_owner.division_id
        )
      );
  end if;

  -- Team-owned sets may only be assigned back to that exact team; the exact
  -- match returned above is therefore the only valid team case.
  return false;
end;
$function$;

create or replace function public.enforce_permission_assignment_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_set public.permission_sets%rowtype;
begin
  -- SHARE prevents an owner-scope change racing this assignment write.
  select *
  into v_set
  from public.permission_sets set_row
  where set_row.id = new.permission_set_id
  for share;

  if v_set.id is null then
    raise exception 'The selected permission set was not found.';
  end if;

  if not public.permission_scope_contains(
    v_set.owner_scope_type,
    v_set.owner_scope_id,
    new.scope_type,
    new.scope_id
  ) then
    raise exception 'The permission set owner scope must contain the assignment scope.';
  end if;

  return new;
end;
$function$;

drop trigger if exists permission_assignment_scope_guard
  on public.permission_assignments;
create trigger permission_assignment_scope_guard
before insert or update of permission_set_id, scope_type, scope_id
on public.permission_assignments
for each row
execute function public.enforce_permission_assignment_scope();

create or replace function public.enforce_permission_set_owner_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.owner_scope_type is not distinct from new.owner_scope_type
    and old.owner_scope_id is not distinct from new.owner_scope_id then
    return new;
  end if;

  if exists (
    select 1
    from public.permission_assignments assignment
    where assignment.permission_set_id = old.id
      and not public.permission_scope_contains(
        new.owner_scope_type,
        new.owner_scope_id,
        assignment.scope_type,
        assignment.scope_id
      )
  ) then
    raise exception 'The permission set owner scope cannot exclude an existing assignment.';
  end if;

  return new;
end;
$function$;

drop trigger if exists permission_set_owner_scope_guard
  on public.permission_sets;
create trigger permission_set_owner_scope_guard
before update of owner_scope_type, owner_scope_id
on public.permission_sets
for each row
execute function public.enforce_permission_set_owner_scope();

-- These are trigger/internal helpers, never browser-callable endpoints.
revoke all on function public.permission_scope_contains(text, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.enforce_permission_assignment_scope()
  from public, anon, authenticated;
revoke all on function public.enforce_permission_set_owner_scope()
  from public, anon, authenticated;

comment on function public.permission_scope_contains(text, uuid, text, uuid) is
  'Internal scope-tree guard: a permission-set owner must contain the assignment scope.';
comment on function public.enforce_permission_assignment_scope() is
  'Rejects permission assignments outside their permission set owner scope.';
comment on function public.enforce_permission_set_owner_scope() is
  'Prevents a permission-set owner change from orphaning existing assignments outside the new scope.';

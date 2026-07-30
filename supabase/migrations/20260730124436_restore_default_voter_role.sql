-- Restore one limited, unscoped VOTER role for every newly-created auth user.
-- Player-specific workflows may still add PLAYER when a person is deliberately
-- assigned to an active team. Existing users and roles are not backfilled.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'first_name',
      split_part(new.raw_user_meta_data->>'full_name', ' ', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'last_name',
      split_part(new.raw_user_meta_data->>'full_name', ' ', 2)
    )
  )
  on conflict (id) do nothing;

  if not exists (
    select 1
    from public.user_roles
    where user_id = new.id
      and role = 'VOTER'::public.user_role_enum
      and association_id is null
      and club_id is null
      and team_id is null
  ) then
    insert into public.user_roles (user_id, role)
    values (new.id, 'VOTER'::public.user_role_enum);
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

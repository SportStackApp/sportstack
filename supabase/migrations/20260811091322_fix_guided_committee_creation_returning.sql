-- Avoid INSERT ... RETURNING checks against committee read policies while
-- preserving security-invoker RLS and one atomic transaction.

create or replace function public.create_committee_with_setup(
  p_committee jsonb,
  p_positions jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_committee_id uuid := gen_random_uuid();
  v_parent_id uuid;
  v_association_id uuid;
  v_club_id uuid;
  v_scope_type text;
  v_position jsonb;
  v_position_id uuid;
  v_member_id_text text;
  v_permissions jsonb;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to create a committee.';
  end if;
  if jsonb_typeof(p_committee) <> 'object'
    or jsonb_typeof(p_positions) <> 'array' then
    raise exception 'Committee setup data is not valid.';
  end if;
  if nullif(btrim(p_committee ->> 'name'), '') is null
    or nullif(btrim(p_committee ->> 'description'), '') is null then
    raise exception 'A committee name and purpose are required.';
  end if;

  v_parent_id := nullif(p_committee ->> 'parent_committee_id', '')::uuid;
  if v_parent_id is not null then
    select association_id, club_id, scope_type
    into v_association_id, v_club_id, v_scope_type
    from public.committees
    where id = v_parent_id;
    if not found then
      raise exception 'The selected parent committee does not exist.';
    end if;
  else
    v_association_id := nullif(p_committee ->> 'association_id', '')::uuid;
    v_club_id := nullif(p_committee ->> 'club_id', '')::uuid;
    v_scope_type := coalesce(nullif(p_committee ->> 'scope_type', ''), 'ASSOCIATION');
  end if;

  insert into public.committees (
    id,
    association_id,
    club_id,
    scope_type,
    parent_committee_id,
    lifecycle_type,
    starts_on,
    target_end_on,
    name,
    description,
    created_by
  ) values (
    v_committee_id,
    v_association_id,
    case when v_scope_type = 'CLUB' then v_club_id else null end,
    v_scope_type,
    v_parent_id,
    coalesce(nullif(p_committee ->> 'lifecycle_type', ''), 'STANDING'),
    coalesce(nullif(p_committee ->> 'starts_on', '')::date, current_date),
    nullif(p_committee ->> 'target_end_on', '')::date,
    btrim(p_committee ->> 'name'),
    nullif(btrim(p_committee ->> 'description'), ''),
    v_user_id
  );

  for v_position in select value from jsonb_array_elements(p_positions)
  loop
    if nullif(btrim(v_position ->> 'title'), '') is null then
      raise exception 'Every selected position needs a title.';
    end if;

    v_position_id := gen_random_uuid();
    v_permissions := jsonb_build_object(
      'manage_committee', coalesce((v_position -> 'permissions' ->> 'manage_committee')::boolean, false),
      'manage_members', coalesce((v_position -> 'permissions' ->> 'manage_members')::boolean, false),
      'manage_documents', coalesce((v_position -> 'permissions' ->> 'manage_documents')::boolean, false),
      'manage_polls', coalesce((v_position -> 'permissions' ->> 'manage_polls')::boolean, false),
      'vote', coalesce((v_position -> 'permissions' ->> 'vote')::boolean, false),
      'manage_meetings', coalesce((v_position -> 'permissions' ->> 'manage_meetings')::boolean, false),
      'record_minutes', coalesce((v_position -> 'permissions' ->> 'record_minutes')::boolean, false),
      'chat', coalesce((v_position -> 'permissions' ->> 'chat')::boolean, false)
    );

    insert into public.committee_positions (
      id,
      committee_id,
      title,
      description,
      is_president,
      permissions,
      sort_order
    ) values (
      v_position_id,
      v_committee_id,
      btrim(v_position ->> 'title'),
      nullif(btrim(v_position ->> 'description'), ''),
      coalesce((v_position ->> 'is_president')::boolean, false),
      v_permissions,
      coalesce((v_position ->> 'sort_order')::integer, 0)
    );

    for v_member_id_text in
      select value
      from jsonb_array_elements_text(
        coalesce(v_position -> 'member_ids', '[]'::jsonb)
      )
    loop
      insert into public.committee_members (
        committee_id,
        position_id,
        user_id,
        start_date,
        appointed_by
      ) values (
        v_committee_id,
        v_position_id,
        v_member_id_text::uuid,
        coalesce(nullif(p_committee ->> 'starts_on', '')::date, current_date),
        v_user_id
      );
    end loop;
  end loop;

  return v_committee_id;
end;
$function$;

revoke all on function public.create_committee_with_setup(jsonb, jsonb)
  from public, anon;
grant execute on function public.create_committee_with_setup(jsonb, jsonb)
  to authenticated, service_role;

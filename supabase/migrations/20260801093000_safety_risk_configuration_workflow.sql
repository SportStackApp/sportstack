-- Audited, organisation-scoped Safety Hub matrix and category configuration.

create or replace function private.rg_prevent_category_rename()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.category = 'RISK_CATEGORY'
     and (new.label is distinct from old.label or new.value is distinct from old.value) then
    raise exception 'Risk category names are permanent after creation. Hide the category or edit its description.';
  end if;
  return new;
end;
$$;

revoke all on function private.rg_prevent_category_rename() from public, anon, authenticated;

drop trigger if exists rg_15_prevent_category_rename on public.rg_dropdown_values;
create trigger rg_15_prevent_category_rename
before update on public.rg_dropdown_values
for each row execute function private.rg_prevent_category_rename();

create or replace function public.save_safety_risk_configuration(
  p_association_id uuid,
  p_club_id uuid,
  p_likelihoods jsonb,
  p_consequences jsonb,
  p_matrix jsonb,
  p_categories jsonb,
  p_change_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_settings_id uuid;
  v_scope_level text;
  v_scope_name text;
  v_item jsonb;
  v_index integer;
  v_existing_id uuid;
  v_rating text;
  v_category_name text;
  v_category_value text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;
  if length(trim(coalesce(p_change_reason, ''))) < 3 then
    raise exception 'A meaningful change reason is required.';
  end if;
  if jsonb_array_length(coalesce(p_likelihoods, '[]'::jsonb)) <> 5
     or jsonb_array_length(coalesce(p_consequences, '[]'::jsonb)) <> 5
     or jsonb_array_length(coalesce(p_matrix, '[]'::jsonb)) <> 25 then
    raise exception 'Risk configuration requires five likelihoods, five consequences and 25 matrix cells.';
  end if;

  if p_club_id is not null then
    if p_association_id is null
       or not exists (
         select 1 from public.clubs c
         where c.id = p_club_id and c.association_id = p_association_id
       ) then
      raise exception 'The selected club does not belong to the selected association.';
    end if;
    v_scope_level := 'CLUB';
    v_scope_name := 'Club risk settings';
  elsif p_association_id is not null then
    v_scope_level := 'ASSOCIATION';
    v_scope_name := 'Association risk settings';
  else
    if not public.is_super_admin() then
      raise exception 'Only a Super Admin can configure global risk settings.';
    end if;
    v_scope_level := 'GLOBAL';
    v_scope_name := 'SportStack global risk settings';
  end if;

  if not private.rg_can_manage_scope(p_association_id, p_club_id, null) then
    raise exception 'You do not have permission to configure this organisation.';
  end if;

  select s.id into v_settings_id
  from public.rg_risk_settings s
  where (v_scope_level = 'GLOBAL' and s.scope_level = 'GLOBAL')
     or (v_scope_level = 'ASSOCIATION' and s.scope_level = 'ASSOCIATION' and s.association_id = p_association_id)
     or (v_scope_level = 'CLUB' and s.scope_level = 'CLUB' and s.club_id = p_club_id)
  limit 1;

  if v_settings_id is null then
    insert into public.rg_risk_settings (
      scope_level, association_id, club_id, name, is_active, is_provisional,
      created_by, last_change_reason
    ) values (
      v_scope_level, p_association_id, p_club_id, v_scope_name, true, false,
      auth.uid(), trim(p_change_reason)
    ) returning id into v_settings_id;
  else
    update public.rg_risk_settings
    set is_active = true,
        is_provisional = false,
        updated_by = auth.uid(),
        last_change_reason = trim(p_change_reason)
    where id = v_settings_id;
  end if;

  v_index := 0;
  for v_item in select value from jsonb_array_elements(p_likelihoods)
  loop
    v_index := v_index + 1;
    if length(trim(coalesce(v_item->>'name', ''))) = 0 then
      raise exception 'Each likelihood needs a name.';
    end if;
    insert into public.rg_dropdown_values (
      settings_id, category, label, value, description, sort_order, is_active,
      created_by, last_change_reason
    ) values (
      v_settings_id, 'LIKELIHOOD', trim(v_item->>'name'), v_index::text,
      nullif(trim(coalesce(v_item->>'description', '')), ''), v_index, true,
      auth.uid(), trim(p_change_reason)
    )
    on conflict (settings_id, category, value) do update
      set label = excluded.label,
          description = excluded.description,
          sort_order = excluded.sort_order,
          is_active = true,
          updated_by = auth.uid(),
          last_change_reason = trim(p_change_reason);
  end loop;

  v_index := 0;
  for v_item in select value from jsonb_array_elements(p_consequences)
  loop
    v_index := v_index + 1;
    if length(trim(coalesce(v_item->>'name', ''))) = 0 then
      raise exception 'Each consequence needs a name.';
    end if;
    insert into public.rg_dropdown_values (
      settings_id, category, label, value, description, sort_order, is_active,
      created_by, last_change_reason
    ) values (
      v_settings_id, 'CONSEQUENCE', trim(v_item->>'name'), v_index::text,
      nullif(trim(coalesce(v_item->>'description', '')), ''), v_index, true,
      auth.uid(), trim(p_change_reason)
    )
    on conflict (settings_id, category, value) do update
      set label = excluded.label,
          description = excluded.description,
          sort_order = excluded.sort_order,
          is_active = true,
          updated_by = auth.uid(),
          last_change_reason = trim(p_change_reason);
  end loop;

  for v_item in select value from jsonb_array_elements(p_matrix)
  loop
    v_rating := trim(coalesce(v_item->>'rating', ''));
    if (v_item->>'likelihood')::integer not between 1 and 5
       or (v_item->>'consequence')::integer not between 1 and 5
       or v_rating not in ('Low', 'Medium', 'High', 'Very High') then
      raise exception 'Every matrix cell must use a valid coordinate and rating.';
    end if;
    insert into public.rg_risk_matrix (
      settings_id, likelihood, consequence, risk_level, color,
      created_by, last_change_reason
    ) values (
      v_settings_id,
      (v_item->>'likelihood')::integer,
      (v_item->>'consequence')::integer,
      v_rating,
      case v_rating
        when 'Low' then '#059669'
        when 'Medium' then '#d97706'
        when 'High' then '#ea580c'
        else '#be123c'
      end,
      auth.uid(), trim(p_change_reason)
    )
    on conflict (settings_id, likelihood, consequence) do update
      set risk_level = excluded.risk_level,
          color = excluded.color,
          updated_by = auth.uid(),
          last_change_reason = trim(p_change_reason);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb))
  loop
    v_existing_id := nullif(v_item->>'id', '')::uuid;
    if v_existing_id is not null then
      update public.rg_dropdown_values
      set description = nullif(trim(coalesce(v_item->>'description', '')), ''),
          is_active = coalesce((v_item->>'isActive')::boolean, true),
          updated_by = auth.uid(),
          last_change_reason = trim(p_change_reason)
      where id = v_existing_id
        and settings_id = v_settings_id
        and category = 'RISK_CATEGORY';
      if not found then
        raise exception 'The selected risk category is not part of this organisation configuration.';
      end if;
    else
      v_category_name := trim(coalesce(v_item->>'name', ''));
      if length(v_category_name) = 0 then
        raise exception 'Each new risk category needs a name.';
      end if;
      select d.id into v_existing_id
      from public.rg_dropdown_values d
      where d.settings_id = v_settings_id
        and d.category = 'RISK_CATEGORY'
        and lower(d.label) = lower(v_category_name)
      limit 1;
      if v_existing_id is not null then
        update public.rg_dropdown_values
        set description = nullif(trim(coalesce(v_item->>'description', '')), ''),
            is_active = true,
            updated_by = auth.uid(),
            last_change_reason = trim(p_change_reason)
        where id = v_existing_id;
      else
        v_category_value := lower(regexp_replace(v_category_name, '[^a-zA-Z0-9]+', '_', 'g'));
        v_category_value := trim(both '_' from v_category_value) || '_' || substr(md5(gen_random_uuid()::text), 1, 8);
        insert into public.rg_dropdown_values (
          settings_id, category, label, value, description, sort_order, is_active,
          created_by, last_change_reason
        ) values (
          v_settings_id, 'RISK_CATEGORY', v_category_name, v_category_value,
          nullif(trim(coalesce(v_item->>'description', '')), ''),
          coalesce((select max(d.sort_order) + 1 from public.rg_dropdown_values d where d.settings_id = v_settings_id and d.category = 'RISK_CATEGORY'), 1),
          true, auth.uid(), trim(p_change_reason)
        );
      end if;
    end if;
  end loop;

  return v_settings_id;
end;
$$;

revoke all on function public.save_safety_risk_configuration(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text)
  from public, anon;
grant execute on function public.save_safety_risk_configuration(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text)
  to authenticated;

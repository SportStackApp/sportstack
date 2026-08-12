-- Case-level access, deadline calculation, immutable revisions and atomic
-- Phase 1 workflow operations.

create table public.discipline_natural_justice_overrides (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.discipline_cases(id) on delete restrict,
  reason text not null,
  authorised_by uuid not null references public.profiles(id) on delete restrict,
  authorised_at timestamptz not null default now(),
  used_by_snapshot_id uuid references public.discipline_report_snapshots(id) on delete restrict,
  constraint discipline_natural_justice_overrides_reason_check
    check (length(btrim(reason)) between 10 and 2000)
);

create or replace function private.discipline_has_case_role(
  p_case_id uuid,
  p_roles text[],
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_user_id is not null
    and exists (
      select 1
      from public.discipline_case_members member
      where member.case_id = p_case_id
        and member.user_id = p_user_id
        and member.active
        and member.case_role = any (p_roles)
    );
$function$;

create or replace function private.discipline_can_read_case(
  p_case_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.discipline_has_case_role(
    p_case_id,
    array[
      'CASE_COORDINATOR', 'LEAD_INVESTIGATOR', 'SUPPORT_INVESTIGATOR',
      'DECISION_MAKER', 'READ_ONLY'
    ]::text[],
    p_user_id
  );
$function$;

create or replace function private.discipline_can_manage_case(
  p_case_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.discipline_has_case_role(
    p_case_id,
    array['CASE_COORDINATOR']::text[],
    p_user_id
  );
$function$;

create or replace function private.discipline_can_investigate(
  p_case_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.discipline_has_case_role(
    p_case_id,
    array['CASE_COORDINATOR', 'LEAD_INVESTIGATOR', 'SUPPORT_INVESTIGATOR']::text[],
    p_user_id
  );
$function$;

create or replace function private.discipline_can_manage_config(
  p_association_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_user_id is not null and (
    exists (
      select 1
      from public.discipline_portal_access access
      where access.association_id = p_association_id
        and access.user_id = p_user_id
        and access.active
        and access.can_manage_config
    )
    or exists (
      select 1
      from public.user_roles role
      where role.user_id = p_user_id
        and (
          role.role = 'SUPER_ADMIN'::public.user_role_enum
          or (
            role.role = 'ASSOCIATION_ADMIN'::public.user_role_enum
            and role.association_id = p_association_id
          )
        )
    )
  );
$function$;

create or replace function private.discipline_can_create_case(
  p_association_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.discipline_can_manage_config(p_association_id, p_user_id)
    or exists (
      select 1
      from public.discipline_portal_access access
      where access.association_id = p_association_id
        and access.user_id = p_user_id
        and access.active
        and access.can_create_cases
    );
$function$;

create or replace function private.discipline_has_association_access(
  p_association_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_user_id is not null and (
    private.discipline_can_manage_config(p_association_id, p_user_id)
    or exists (
      select 1
      from public.discipline_portal_access access
      where access.association_id = p_association_id
        and access.user_id = p_user_id
        and access.active
    )
    or exists (
      select 1
      from public.discipline_case_members member
      join public.discipline_cases incident_case on incident_case.id = member.case_id
      where incident_case.association_id = p_association_id
        and member.user_id = p_user_id
        and member.active
    )
  );
$function$;

create or replace function private.discipline_business_deadline(
  p_association_id uuid,
  p_trigger_at timestamptz,
  p_business_day_number integer,
  p_due_local_time time,
  p_timezone text
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_date date := (p_trigger_at at time zone p_timezone)::date;
  v_count integer := 0;
begin
  if p_business_day_number < 1 then
    raise exception 'Business-day number must be at least one.';
  end if;

  while v_count < p_business_day_number loop
    v_date := v_date + 1;
    if extract(isodow from v_date) < 6
       and not exists (
         select 1
         from public.discipline_calendar_exclusions exclusion
         where exclusion.association_id = p_association_id
           and exclusion.exclusion_date = v_date
           and exclusion.active
       ) then
      v_count := v_count + 1;
    end if;
  end loop;

  return make_timestamptz(
    extract(year from v_date)::integer,
    extract(month from v_date)::integer,
    extract(day from v_date)::integer,
    extract(hour from p_due_local_time)::integer,
    extract(minute from p_due_local_time)::integer,
    extract(second from p_due_local_time),
    p_timezone
  );
end;
$function$;

create or replace function private.discipline_initialise_deadlines(
  p_case_id uuid,
  p_actor_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_case public.discipline_cases%rowtype;
  v_pack public.discipline_rule_packs%rowtype;
  v_definition public.discipline_deadline_definitions%rowtype;
  v_deadline_id uuid;
  v_due_at timestamptz;
begin
  select * into v_case from public.discipline_cases where id = p_case_id;
  if v_case.id is null then raise exception 'Case not found.'; end if;
  if v_case.pathway not in ('REGULAR', 'DIRECT_TRIBUNAL') then return; end if;

  select * into v_pack from public.discipline_rule_packs where id = v_case.rule_pack_id;

  for v_definition in
    select *
    from public.discipline_deadline_definitions definition
    where definition.rule_pack_id = v_case.rule_pack_id
      and definition.pathway = v_case.pathway
    order by definition.sort_order, definition.action_key
  loop
    v_due_at := private.discipline_business_deadline(
      v_case.association_id,
      v_case.match_concluded_at,
      v_definition.business_day_number,
      v_definition.due_local_time,
      v_pack.timezone
    );

    insert into public.discipline_deadlines (
      case_id, definition_id, action_key, label, trigger_at,
      calculation_text, due_at, rule_reference
    ) values (
      v_case.id,
      v_definition.id,
      v_definition.action_key,
      v_definition.label,
      v_case.match_concluded_at,
      format(
        'Business day %s after the match at %s (%s). HB business-day interpretation is pending approval.',
        v_definition.business_day_number,
        to_char(v_definition.due_local_time, 'HH24:MI'),
        v_pack.timezone
      ),
      v_due_at,
      v_definition.rule_reference
    )
    returning id into v_deadline_id;

    insert into public.discipline_deadline_events (
      case_id, deadline_id, event_type, new_due_at, reason, actor_id
    ) values (
      v_case.id, v_deadline_id, 'INITIAL_CALCULATION', v_due_at, p_reason, p_actor_id
    );
  end loop;
end;
$function$;

create or replace function private.discipline_capture_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reason text := nullif(current_setting('app.discipline_change_reason', true), '');
  v_actor_id uuid := nullif(current_setting('app.discipline_actor_id', true), '')::uuid;
begin
  if v_reason is null or v_actor_id is null then
    raise exception 'A change reason is required for this record.';
  end if;

  if tg_table_name = 'discipline_allegations' then
    insert into public.discipline_allegation_revisions (
      allegation_id, case_id, revision_number, snapshot, change_reason, changed_by
    ) values (
      old.id, old.case_id, old.revision_number, to_jsonb(old), v_reason, v_actor_id
    );
    new.revision_number := old.revision_number + 1;
    new.updated_by := v_actor_id;
  elsif tg_table_name = 'discipline_findings' then
    insert into public.discipline_finding_revisions (
      finding_id, case_id, revision_number, snapshot, change_reason, changed_by
    ) values (
      old.id, old.case_id, old.revision_number, to_jsonb(old), v_reason, v_actor_id
    );
    new.revision_number := old.revision_number + 1;
    new.updated_by := v_actor_id;
  end if;
  return new;
end;
$function$;

create trigger discipline_allegations_revision
before update on public.discipline_allegations
for each row execute function private.discipline_capture_revision();
create trigger discipline_findings_revision
before update on public.discipline_findings
for each row execute function private.discipline_capture_revision();

create or replace function private.discipline_capture_row_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_payload jsonb := coalesce(v_new, v_old);
  v_case_id uuid;
  v_association_id uuid;
  v_entity_id text;
begin
  if tg_table_name = 'discipline_cases' then
    v_case_id := (v_payload ->> 'id')::uuid;
    v_association_id := (v_payload ->> 'association_id')::uuid;
  else
    v_case_id := nullif(v_payload ->> 'case_id', '')::uuid;
    select association_id into v_association_id
    from public.discipline_cases where id = v_case_id;
  end if;
  v_entity_id := coalesce(v_payload ->> 'id', v_payload ->> 'case_id');

  if v_association_id is not null then
    insert into public.discipline_audit_events (
      case_id, association_id, event_type, entity_type, entity_id,
      previous_data, new_data, reason, actor_id
    ) values (
      v_case_id,
      v_association_id,
      tg_op,
      tg_table_name,
      v_entity_id,
      v_old,
      v_new,
      nullif(current_setting('app.discipline_change_reason', true), ''),
      auth.uid()
    );
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

do $audit_triggers$
declare
  v_table text;
begin
  foreach v_table in array array[
    'discipline_cases', 'discipline_case_members', 'discipline_case_people',
    'discipline_allegations', 'discipline_classification_assessments',
    'discipline_investigator_setups', 'discipline_notifications',
    'discipline_witnesses', 'discipline_evidence',
    'discipline_natural_justice_checks', 'discipline_findings',
    'discipline_report_snapshots', 'discipline_decisions',
    'discipline_natural_justice_overrides'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.discipline_capture_row_audit()',
      v_table || '_audit',
      v_table
    );
  end loop;
end
$audit_triggers$;

create or replace function public.get_discipline_portal_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with actor_access as (
    select
      access.association_id,
      access.account_mode,
      access.can_create_cases,
      access.can_manage_config
    from public.discipline_portal_access access
    where access.user_id = auth.uid() and access.active
  ), case_access as (
    select distinct incident_case.association_id
    from public.discipline_case_members member
    join public.discipline_cases incident_case on incident_case.id = member.case_id
    where member.user_id = auth.uid() and member.active
  )
  select jsonb_build_object(
    'allowed', exists (select 1 from actor_access)
      or exists (select 1 from case_access)
      or exists (
        select 1 from public.user_roles role
        where role.user_id = auth.uid()
          and role.role in (
            'SUPER_ADMIN'::public.user_role_enum,
            'ASSOCIATION_ADMIN'::public.user_role_enum
          )
      ),
    'discipline_only', exists (
      select 1 from actor_access where account_mode = 'DISCIPLINE_ONLY'
    ),
    'can_create_cases', exists (
      select 1 from actor_access where can_create_cases or can_manage_config
    ) or exists (
      select 1 from public.user_roles role
      where role.user_id = auth.uid()
        and role.role in (
          'SUPER_ADMIN'::public.user_role_enum,
          'ASSOCIATION_ADMIN'::public.user_role_enum
        )
    ),
    'can_manage_config', exists (
      select 1 from actor_access where can_manage_config
    ) or exists (
      select 1 from public.user_roles role
      where role.user_id = auth.uid()
        and role.role in (
          'SUPER_ADMIN'::public.user_role_enum,
          'ASSOCIATION_ADMIN'::public.user_role_enum
        )
    ),
    'association_ids', coalesce((
      select jsonb_agg(distinct association_id)
      from (
        select association_id from actor_access
        union
        select association_id from case_access
      ) associations
    ), '[]'::jsonb)
  );
$function$;

create or replace function public.set_discipline_portal_access(
  p_association_id uuid,
  p_user_id uuid,
  p_account_mode text,
  p_can_create_cases boolean,
  p_can_manage_config boolean,
  p_active boolean,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_access_id uuid;
begin
  if not private.discipline_can_manage_config(p_association_id, v_actor_id) then
    raise exception 'You do not have permission to manage discipline access.';
  end if;
  if p_account_mode not in ('FULL_APP', 'DISCIPLINE_ONLY') then
    raise exception 'Account mode is not valid.';
  end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'A reason is required.'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found.';
  end if;

  insert into public.discipline_portal_access (
    association_id, user_id, account_mode, can_create_cases,
    can_manage_config, active, reason, granted_by, revoked_by, revoked_at
  ) values (
    p_association_id, p_user_id, p_account_mode, coalesce(p_can_create_cases, false),
    coalesce(p_can_manage_config, false), coalesce(p_active, true), btrim(p_reason),
    v_actor_id,
    case when coalesce(p_active, true) then null else v_actor_id end,
    case when coalesce(p_active, true) then null else now() end
  )
  on conflict (association_id, user_id) do update set
    account_mode = excluded.account_mode,
    can_create_cases = excluded.can_create_cases,
    can_manage_config = excluded.can_manage_config,
    active = excluded.active,
    reason = excluded.reason,
    granted_by = case when excluded.active then v_actor_id else public.discipline_portal_access.granted_by end,
    granted_at = case when excluded.active then now() else public.discipline_portal_access.granted_at end,
    revoked_by = case when excluded.active then null else v_actor_id end,
    revoked_at = case when excluded.active then null else now() end
  returning id into v_access_id;

  return v_access_id;
end;
$function$;

create or replace function public.create_discipline_case(p_intake jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_association_id uuid := nullif(p_intake ->> 'association_id', '')::uuid;
  v_rule_pack_id uuid := nullif(p_intake ->> 'rule_pack_id', '')::uuid;
  v_case_id uuid;
  v_case_number text;
  v_round_type text := coalesce(nullif(p_intake ->> 'round_type', ''), 'REGULAR');
  v_relevant_club_participating boolean := nullif(p_intake ->> 'relevant_club_participating', '')::boolean;
  v_jurisdiction text := coalesce(nullif(p_intake ->> 'jurisdiction_path', ''), 'UNASSESSED');
  v_immediate_risk boolean := coalesce((p_intake ->> 'immediate_safety_risk')::boolean, false);
  v_pathway text;
  v_status text := 'DRAFT';
  v_match_concluded_at timestamptz := nullif(p_intake ->> 'match_concluded_at', '')::timestamptz;
begin
  if v_actor_id is null then raise exception 'Sign in is required.'; end if;
  if v_association_id is null or not private.discipline_can_create_case(v_association_id, v_actor_id) then
    raise exception 'You do not have permission to create a discipline case for this association.';
  end if;
  if v_match_concluded_at is null then raise exception 'Match conclusion time is required.'; end if;
  if nullif(btrim(p_intake ->> 'title'), '') is null then raise exception 'Case title is required.'; end if;
  if v_round_type not in ('REGULAR', 'LAST_REGULAR', 'FINALS') then raise exception 'Round type is not valid.'; end if;
  if v_round_type <> 'REGULAR' and v_relevant_club_participating is null then
    raise exception 'Record whether the relevant club is participating in that competition.';
  end if;
  if v_jurisdiction not in (
    'UNASSESSED', 'COMPETITION_RULE_7', 'NIF_REFERRAL',
    'EXTERNAL_SAFETY_REFERRAL', 'OTHER_REFERRAL'
  ) then raise exception 'Jurisdiction path is not valid.'; end if;
  if v_immediate_risk and nullif(btrim(p_intake ->> 'immediate_safety_action'), '') is null then
    raise exception 'Record the immediate safety action taken.';
  end if;

  if v_rule_pack_id is null then
    select pack.id into v_rule_pack_id
    from public.discipline_rule_packs pack
    where pack.association_id = v_association_id
      and pack.status in ('PUBLISHED', 'REVIEW_REQUIRED')
    order by case pack.status when 'PUBLISHED' then 0 else 1 end, pack.created_at desc
    limit 1;
  end if;
  if not exists (
    select 1 from public.discipline_rule_packs pack
    where pack.id = v_rule_pack_id and pack.association_id = v_association_id
  ) then raise exception 'An association rule pack is required.'; end if;

  if v_immediate_risk or v_jurisdiction in ('NIF_REFERRAL', 'EXTERNAL_SAFETY_REFERRAL', 'OTHER_REFERRAL') then
    v_pathway := 'EXTERNAL_REFERRAL';
    v_status := 'REFERRED';
  elsif v_jurisdiction = 'UNASSESSED' then
    v_pathway := 'REVIEW_REQUIRED';
  elsif v_round_type in ('LAST_REGULAR', 'FINALS') and v_relevant_club_participating then
    v_pathway := 'DIRECT_TRIBUNAL';
  else
    v_pathway := 'REGULAR';
  end if;

  v_case_number := format(
    'HB-DIS-%s-%s',
    extract(year from (v_match_concluded_at at time zone 'Australia/Melbourne'))::integer,
    lpad(nextval('public.discipline_case_number_seq')::text, 4, '0')
  );

  perform set_config('app.discipline_change_reason', 'Initial case creation', true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  insert into public.discipline_cases (
    case_number, association_id, rule_pack_id, status, title,
    jurisdiction_path, jurisdiction_reason, immediate_safety_risk,
    immediate_safety_action, fixture_id, safety_record_id, committee_id,
    competition, grade, round_label, round_type, relevant_club_participating,
    first_named_team, second_named_team, match_concluded_at, incident_at,
    venue, incident_location, report_received_at, report_method,
    report_in_writing, prescribed_form_used, report_complete,
    desired_outcome_included, prior_presentation_completed,
    pathway, created_by, updated_by
  ) values (
    v_case_number, v_association_id, v_rule_pack_id, v_status, btrim(p_intake ->> 'title'),
    v_jurisdiction, nullif(btrim(p_intake ->> 'jurisdiction_reason'), ''), v_immediate_risk,
    nullif(btrim(p_intake ->> 'immediate_safety_action'), ''),
    nullif(p_intake ->> 'fixture_id', '')::uuid,
    nullif(p_intake ->> 'safety_record_id', '')::uuid,
    nullif(p_intake ->> 'committee_id', '')::uuid,
    nullif(btrim(p_intake ->> 'competition'), ''), nullif(btrim(p_intake ->> 'grade'), ''),
    nullif(btrim(p_intake ->> 'round_label'), ''), v_round_type, v_relevant_club_participating,
    nullif(btrim(p_intake ->> 'first_named_team'), ''), nullif(btrim(p_intake ->> 'second_named_team'), ''),
    v_match_concluded_at, nullif(p_intake ->> 'incident_at', '')::timestamptz,
    nullif(btrim(p_intake ->> 'venue'), ''), nullif(btrim(p_intake ->> 'incident_location'), ''),
    nullif(p_intake ->> 'report_received_at', '')::timestamptz,
    nullif(btrim(p_intake ->> 'report_method'), ''),
    nullif(p_intake ->> 'report_in_writing', '')::boolean,
    nullif(p_intake ->> 'prescribed_form_used', '')::boolean,
    nullif(p_intake ->> 'report_complete', '')::boolean,
    nullif(p_intake ->> 'desired_outcome_included', '')::boolean,
    nullif(p_intake ->> 'prior_presentation_completed', '')::boolean,
    v_pathway, v_actor_id, v_actor_id
  ) returning id into v_case_id;

  insert into public.discipline_case_members (
    case_id, user_id, case_role, assignment_reason, assigned_by
  ) values (
    v_case_id, v_actor_id, 'CASE_COORDINATOR', 'Automatically assigned as case creator.', v_actor_id
  );

  insert into public.discipline_natural_justice_checks (case_id, check_key, label)
  values
    (v_case_id, 'allegations_particularised', 'Every allegation and sufficient particulars were provided.'),
    (v_case_id, 'evidence_identified', 'Evidence relied upon was identified or provided.'),
    (v_case_id, 'response_opportunity', 'A reasonable opportunity to respond was provided.'),
    (v_case_id, 'investigator_independence', 'Investigator independence and conflicts were checked.'),
    (v_case_id, 'changes_put_to_person', 'Any new allegation or changed classification was put before reliance.');

  if v_pathway in ('REGULAR', 'DIRECT_TRIBUNAL') then
    perform private.discipline_initialise_deadlines(
      v_case_id, v_actor_id, 'Initial calculation when the case was created.'
    );
  end if;

  return v_case_id;
end;
$function$;

create or replace function public.assign_discipline_case_member(
  p_case_id uuid,
  p_user_id uuid,
  p_case_role text,
  p_active boolean,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_member_id uuid;
begin
  if not private.discipline_can_manage_case(p_case_id, v_actor_id) then
    raise exception 'Only a Case Coordinator can change case access.';
  end if;
  if p_case_role not in (
    'CASE_COORDINATOR', 'LEAD_INVESTIGATOR', 'SUPPORT_INVESTIGATOR',
    'DECISION_MAKER', 'READ_ONLY'
  ) then raise exception 'Case role is not valid.'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'An assignment reason is required.'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'User not found.'; end if;
  if p_user_id = v_actor_id and not coalesce(p_active, true) and not exists (
    select 1 from public.discipline_case_members member
    where member.case_id = p_case_id and member.active
      and member.case_role = 'CASE_COORDINATOR' and member.user_id <> v_actor_id
  ) then raise exception 'Assign another Case Coordinator before removing your own access.'; end if;

  perform set_config('app.discipline_change_reason', btrim(p_reason), true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  insert into public.discipline_case_members (
    case_id, user_id, case_role, active, assignment_reason, assigned_by,
    revoked_by, revoked_at
  ) values (
    p_case_id, p_user_id, p_case_role, coalesce(p_active, true), btrim(p_reason), v_actor_id,
    case when coalesce(p_active, true) then null else v_actor_id end,
    case when coalesce(p_active, true) then null else now() end
  )
  on conflict (case_id, user_id) do update set
    case_role = excluded.case_role,
    active = excluded.active,
    assignment_reason = excluded.assignment_reason,
    assigned_by = case when excluded.active then v_actor_id else public.discipline_case_members.assigned_by end,
    assigned_at = case when excluded.active then now() else public.discipline_case_members.assigned_at end,
    revoked_by = case when excluded.active then null else v_actor_id end,
    revoked_at = case when excluded.active then null else now() end
  returning id into v_member_id;

  return v_member_id;
end;
$function$;

create or replace function public.save_discipline_intake(
  p_case_id uuid,
  p_intake jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_before public.discipline_cases%rowtype;
  v_round_type text;
  v_relevant boolean;
  v_pathway text;
  v_needs_recalculation boolean;
begin
  if not private.discipline_can_manage_case(p_case_id, v_actor_id) then
    raise exception 'Only a Case Coordinator can update intake.';
  end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'A change reason is required.'; end if;
  select * into v_before from public.discipline_cases where id = p_case_id;
  if v_before.status in ('REPORT_SIGNED', 'HB_DECISION', 'CLOSED', 'REFERRED') then
    raise exception 'Signed or final cases cannot be changed through intake.';
  end if;

  v_round_type := coalesce(nullif(p_intake ->> 'round_type', ''), v_before.round_type);
  v_relevant := coalesce(nullif(p_intake ->> 'relevant_club_participating', '')::boolean, v_before.relevant_club_participating);
  if v_round_type <> 'REGULAR' and v_relevant is null then
    raise exception 'Record whether the relevant club is participating in that competition.';
  end if;
  v_pathway := case
    when coalesce(nullif(p_intake ->> 'jurisdiction_path', ''), v_before.jurisdiction_path)
         in ('NIF_REFERRAL', 'EXTERNAL_SAFETY_REFERRAL', 'OTHER_REFERRAL')
      or coalesce(nullif(p_intake ->> 'immediate_safety_risk', '')::boolean, v_before.immediate_safety_risk)
      then 'EXTERNAL_REFERRAL'
    when coalesce(nullif(p_intake ->> 'jurisdiction_path', ''), v_before.jurisdiction_path) = 'UNASSESSED'
      then 'REVIEW_REQUIRED'
    when v_round_type in ('LAST_REGULAR', 'FINALS') and v_relevant then 'DIRECT_TRIBUNAL'
    else 'REGULAR'
  end;

  v_needs_recalculation :=
    coalesce(nullif(p_intake ->> 'match_concluded_at', '')::timestamptz, v_before.match_concluded_at)
      is distinct from v_before.match_concluded_at
    or v_pathway is distinct from v_before.pathway;

  perform set_config('app.discipline_change_reason', btrim(p_reason), true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  update public.discipline_cases set
    title = coalesce(nullif(btrim(p_intake ->> 'title'), ''), title),
    jurisdiction_path = coalesce(nullif(p_intake ->> 'jurisdiction_path', ''), jurisdiction_path),
    jurisdiction_reason = coalesce(nullif(btrim(p_intake ->> 'jurisdiction_reason'), ''), jurisdiction_reason),
    immediate_safety_risk = coalesce(nullif(p_intake ->> 'immediate_safety_risk', '')::boolean, immediate_safety_risk),
    immediate_safety_action = coalesce(nullif(btrim(p_intake ->> 'immediate_safety_action'), ''), immediate_safety_action),
    competition = coalesce(nullif(btrim(p_intake ->> 'competition'), ''), competition),
    grade = coalesce(nullif(btrim(p_intake ->> 'grade'), ''), grade),
    round_label = coalesce(nullif(btrim(p_intake ->> 'round_label'), ''), round_label),
    round_type = v_round_type,
    relevant_club_participating = v_relevant,
    first_named_team = coalesce(nullif(btrim(p_intake ->> 'first_named_team'), ''), first_named_team),
    second_named_team = coalesce(nullif(btrim(p_intake ->> 'second_named_team'), ''), second_named_team),
    match_concluded_at = coalesce(nullif(p_intake ->> 'match_concluded_at', '')::timestamptz, match_concluded_at),
    incident_at = coalesce(nullif(p_intake ->> 'incident_at', '')::timestamptz, incident_at),
    venue = coalesce(nullif(btrim(p_intake ->> 'venue'), ''), venue),
    incident_location = coalesce(nullif(btrim(p_intake ->> 'incident_location'), ''), incident_location),
    report_received_at = coalesce(nullif(p_intake ->> 'report_received_at', '')::timestamptz, report_received_at),
    report_method = coalesce(nullif(btrim(p_intake ->> 'report_method'), ''), report_method),
    report_in_writing = coalesce(nullif(p_intake ->> 'report_in_writing', '')::boolean, report_in_writing),
    prescribed_form_used = coalesce(nullif(p_intake ->> 'prescribed_form_used', '')::boolean, prescribed_form_used),
    report_complete = coalesce(nullif(p_intake ->> 'report_complete', '')::boolean, report_complete),
    desired_outcome_included = coalesce(nullif(p_intake ->> 'desired_outcome_included', '')::boolean, desired_outcome_included),
    prior_presentation_completed = coalesce(nullif(p_intake ->> 'prior_presentation_completed', '')::boolean, prior_presentation_completed),
    pathway = v_pathway,
    status = case when v_pathway = 'EXTERNAL_REFERRAL' then 'REFERRED' else status end,
    updated_by = v_actor_id
  where id = p_case_id;

  return jsonb_build_object(
    'case_id', p_case_id,
    'pathway', v_pathway,
    'deadlines_need_recalculation', v_needs_recalculation
  );
end;
$function$;

create or replace function public.recalculate_discipline_deadlines(
  p_case_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_case public.discipline_cases%rowtype;
  v_pack public.discipline_rule_packs%rowtype;
  v_definition public.discipline_deadline_definitions%rowtype;
  v_deadline public.discipline_deadlines%rowtype;
  v_new_due_at timestamptz;
begin
  if not private.discipline_can_manage_case(p_case_id, v_actor_id) then
    raise exception 'Only a Case Coordinator can recalculate deadlines.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'A clear recalculation reason is required.'; end if;
  select * into v_case from public.discipline_cases where id = p_case_id;
  if v_case.pathway not in ('REGULAR', 'DIRECT_TRIBUNAL') then
    raise exception 'This case does not currently have a calculable Rule 7 timing path.';
  end if;
  select * into v_pack from public.discipline_rule_packs where id = v_case.rule_pack_id;

  perform set_config('app.discipline_change_reason', btrim(p_reason), true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  for v_definition in
    select * from public.discipline_deadline_definitions definition
    where definition.rule_pack_id = v_case.rule_pack_id
      and definition.pathway = v_case.pathway
    order by definition.sort_order
  loop
    v_new_due_at := private.discipline_business_deadline(
      v_case.association_id, v_case.match_concluded_at,
      v_definition.business_day_number, v_definition.due_local_time, v_pack.timezone
    );
    select * into v_deadline from public.discipline_deadlines
    where case_id = p_case_id and action_key = v_definition.action_key;

    if v_deadline.id is null then
      insert into public.discipline_deadlines (
        case_id, definition_id, action_key, label, trigger_at,
        calculation_text, due_at, rule_reference
      ) values (
        p_case_id, v_definition.id, v_definition.action_key, v_definition.label,
        v_case.match_concluded_at,
        format(
          'Business day %s after the match at %s (%s). HB business-day interpretation is pending approval.',
          v_definition.business_day_number, to_char(v_definition.due_local_time, 'HH24:MI'), v_pack.timezone
        ),
        v_new_due_at, v_definition.rule_reference
      ) returning * into v_deadline;
    else
      update public.discipline_deadlines set
        definition_id = v_definition.id,
        label = v_definition.label,
        trigger_at = v_case.match_concluded_at,
        calculation_text = format(
          'Business day %s after the match at %s (%s). HB business-day interpretation is pending approval.',
          v_definition.business_day_number, to_char(v_definition.due_local_time, 'HH24:MI'), v_pack.timezone
        ),
        due_at = v_new_due_at,
        rule_reference = v_definition.rule_reference
      where id = v_deadline.id;
    end if;

    insert into public.discipline_deadline_events (
      case_id, deadline_id, event_type, previous_due_at, new_due_at, reason, actor_id
    ) values (
      p_case_id, v_deadline.id, 'RECALCULATED', v_deadline.due_at, v_new_due_at,
      btrim(p_reason), v_actor_id
    );
  end loop;
end;
$function$;

create or replace function public.set_discipline_deadline_completion(
  p_deadline_id uuid,
  p_completed boolean,
  p_completed_at timestamptz,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_deadline public.discipline_deadlines%rowtype;
  v_new_completed_at timestamptz;
begin
  select * into v_deadline from public.discipline_deadlines where id = p_deadline_id;
  if v_deadline.id is null or not private.discipline_can_manage_case(v_deadline.case_id, v_actor_id) then
    raise exception 'You do not have permission to complete this deadline.';
  end if;
  v_new_completed_at := case when coalesce(p_completed, false) then coalesce(p_completed_at, now()) else null end;

  update public.discipline_deadlines set
    completed_at = v_new_completed_at,
    completed_by = case when v_new_completed_at is null then null else v_actor_id end,
    completion_note = nullif(btrim(p_note), '')
  where id = p_deadline_id;

  insert into public.discipline_deadline_events (
    case_id, deadline_id, event_type, previous_completed_at,
    new_completed_at, reason, actor_id
  ) values (
    v_deadline.case_id, v_deadline.id,
    case when v_new_completed_at is null then 'REOPENED' else 'COMPLETED' end,
    v_deadline.completed_at, v_new_completed_at,
    coalesce(nullif(btrim(p_note), ''), 'Deadline status updated.'), v_actor_id
  );
end;
$function$;

create or replace function public.save_discipline_allegation(
  p_case_id uuid,
  p_allegation_id uuid,
  p_title text,
  p_description text,
  p_incident_at timestamptz,
  p_location text,
  p_change_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_allegation_id uuid;
  v_number integer;
begin
  if not private.discipline_can_investigate(p_case_id, v_actor_id) then
    raise exception 'You do not have permission to record allegations.';
  end if;
  if length(btrim(coalesce(p_title, ''))) < 3 or length(btrim(coalesce(p_description, ''))) < 5 then
    raise exception 'An allegation title and factual description are required.';
  end if;
  if p_allegation_id is not null and length(btrim(coalesce(p_change_reason, ''))) < 5 then
    raise exception 'A change reason is required when revising an allegation.';
  end if;
  perform set_config('app.discipline_change_reason', coalesce(nullif(btrim(p_change_reason), ''), 'Initial allegation'), true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  if p_allegation_id is null then
    select coalesce(max(allegation_number), 0) + 1 into v_number
    from public.discipline_allegations where case_id = p_case_id;
    insert into public.discipline_allegations (
      case_id, allegation_number, title, description, incident_at,
      location, created_by, updated_by
    ) values (
      p_case_id, v_number, btrim(p_title), btrim(p_description), p_incident_at,
      nullif(btrim(p_location), ''), v_actor_id, v_actor_id
    ) returning id into v_allegation_id;
  else
    update public.discipline_allegations set
      title = btrim(p_title),
      description = btrim(p_description),
      incident_at = p_incident_at,
      location = nullif(btrim(p_location), '')
    where id = p_allegation_id and case_id = p_case_id
    returning id into v_allegation_id;
  end if;
  if v_allegation_id is null then raise exception 'Allegation not found.'; end if;
  return v_allegation_id;
end;
$function$;

create or replace function public.record_discipline_classification(
  p_case_id uuid,
  p_allegation_id uuid,
  p_assessment_stage text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_rule public.discipline_classification_rules%rowtype;
  v_rule_pack_id uuid;
  v_code text := 'CLASSIFICATION_REVIEW_REQUIRED';
  v_label text := 'Classification Review Required';
  v_readiness text := 'AMBER';
  v_penalty text;
  v_explanation text := 'No single verified decision-table row matched the recorded facts. Human classification review is required.';
begin
  if not private.discipline_can_investigate(p_case_id, v_actor_id) then
    raise exception 'You do not have permission to record classification screening.';
  end if;
  if p_assessment_stage not in ('PRELIMINARY', 'INVESTIGATOR_RECOMMENDATION') then
    raise exception 'Assessment stage is not valid.';
  end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Classification answers must be an object.'; end if;
  if not exists (
    select 1 from public.discipline_allegations allegation
    where allegation.id = p_allegation_id and allegation.case_id = p_case_id
  ) then raise exception 'Allegation not found.'; end if;
  select rule_pack_id into v_rule_pack_id from public.discipline_cases where id = p_case_id;

  select rule.* into v_rule
  from public.discipline_classification_rules rule
  where rule.rule_pack_id = v_rule_pack_id
    and p_answers @> rule.criteria
  order by rule.priority desc, rule.created_at
  limit 1;

  if v_rule.id is not null then
    v_code := v_rule.classification_code;
    v_label := v_rule.label;
    v_readiness := case when v_rule.tribunal_required then 'RED' else 'GREEN' end;
    v_penalty := v_rule.recommended_penalty_text;
    v_explanation := format(
      'The recorded facts match %s. This is preliminary guidance under %s, not a finding or automatic penalty.',
      v_rule.label, v_rule.rule_reference
    );
  end if;

  insert into public.discipline_classification_assessments (
    case_id, allegation_id, assessment_stage, answers, classification_rule_id,
    classification_code, classification_label, tribunal_readiness,
    penalty_guidance, explanation, assessed_by
  ) values (
    p_case_id, p_allegation_id, p_assessment_stage, p_answers, v_rule.id,
    v_code, v_label, v_readiness, v_penalty, v_explanation, v_actor_id
  );

  perform set_config('app.discipline_change_reason', 'New classification assessment recorded', true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);
  if p_assessment_stage = 'PRELIMINARY' then
    update public.discipline_allegations
    set initial_classification_code = v_code
    where id = p_allegation_id;
  else
    update public.discipline_allegations
    set recommended_classification_code = v_code
    where id = p_allegation_id;
  end if;

  return jsonb_build_object(
    'classification_code', v_code,
    'classification_label', v_label,
    'tribunal_readiness', v_readiness,
    'penalty_guidance', v_penalty,
    'explanation', v_explanation,
    'source_warning', v_rule.source_warning
  );
end;
$function$;

create or replace function public.save_discipline_finding(
  p_case_id uuid,
  p_allegation_id uuid,
  p_finding jsonb,
  p_change_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_id uuid;
  v_result text := p_finding ->> 'recommended_finding';
begin
  if not private.discipline_has_case_role(p_case_id, array['LEAD_INVESTIGATOR']::text[], v_actor_id) then
    raise exception 'Only the Lead Investigator can record formal findings.';
  end if;
  if v_result not in ('SUBSTANTIATED', 'UNSUBSTANTIATED', 'UNABLE_TO_DETERMINE') then
    raise exception 'Recommended finding is not valid.';
  end if;
  if length(btrim(coalesce(p_finding ->> 'supporting_evidence', ''))) < 3
     or length(btrim(coalesce(p_finding ->> 'reasoning', ''))) < 10 then
    raise exception 'Supporting evidence and clear reasoning are required.';
  end if;
  perform set_config('app.discipline_change_reason', coalesce(nullif(btrim(p_change_reason), ''), 'Initial finding'), true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  insert into public.discipline_findings (
    case_id, allegation_id, supporting_evidence, contradicting_evidence,
    inconsistencies, missing_evidence, reported_person_response, reasoning,
    recommended_finding, recommended_classification_code,
    classification_change_reason, recorded_by, updated_by
  ) values (
    p_case_id, p_allegation_id, btrim(p_finding ->> 'supporting_evidence'),
    nullif(btrim(p_finding ->> 'contradicting_evidence'), ''),
    nullif(btrim(p_finding ->> 'inconsistencies'), ''),
    nullif(btrim(p_finding ->> 'missing_evidence'), ''),
    nullif(btrim(p_finding ->> 'reported_person_response'), ''),
    btrim(p_finding ->> 'reasoning'), v_result,
    nullif(p_finding ->> 'recommended_classification_code', ''),
    nullif(btrim(p_finding ->> 'classification_change_reason'), ''),
    v_actor_id, v_actor_id
  )
  on conflict (allegation_id) do update set
    supporting_evidence = excluded.supporting_evidence,
    contradicting_evidence = excluded.contradicting_evidence,
    inconsistencies = excluded.inconsistencies,
    missing_evidence = excluded.missing_evidence,
    reported_person_response = excluded.reported_person_response,
    reasoning = excluded.reasoning,
    recommended_finding = excluded.recommended_finding,
    recommended_classification_code = excluded.recommended_classification_code,
    classification_change_reason = excluded.classification_change_reason
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.complete_discipline_stage(
  p_case_id uuid,
  p_next_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_current text;
  v_allowed boolean := false;
begin
  if not private.discipline_can_manage_case(p_case_id, v_actor_id)
     and not private.discipline_has_case_role(p_case_id, array['LEAD_INVESTIGATOR']::text[], v_actor_id) then
    raise exception 'You do not have permission to advance this case.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'A stage-change reason is required.'; end if;
  select status into v_current from public.discipline_cases where id = p_case_id;
  v_allowed := (v_current, p_next_status) in (
    ('DRAFT', 'SCREENING'),
    ('SCREENING', 'INVESTIGATOR_SETUP'),
    ('INVESTIGATOR_SETUP', 'INVESTIGATING'),
    ('INVESTIGATING', 'FINDINGS'),
    ('REPORT_SIGNED', 'HB_DECISION')
  );
  if not v_allowed then raise exception 'That stage transition is not allowed.'; end if;
  if p_next_status = 'INVESTIGATING' and not exists (
    select 1 from public.discipline_investigator_setups setup
    where setup.case_id = p_case_id and setup.conflict_decision <> 'REPLACE_INVESTIGATOR'
  ) then raise exception 'Record a suitable Investigation Officer and conflict decision first.'; end if;

  perform set_config('app.discipline_change_reason', btrim(p_reason), true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);
  update public.discipline_cases set status = p_next_status, updated_by = v_actor_id where id = p_case_id;
end;
$function$;

create or replace function public.reopen_discipline_stage(
  p_case_id uuid,
  p_previous_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_current text;
  v_allowed boolean := false;
begin
  if not private.discipline_can_manage_case(p_case_id, v_actor_id) then
    raise exception 'Only a Case Coordinator can reopen a stage.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'A clear reopening reason is required.'; end if;
  select status into v_current from public.discipline_cases where id = p_case_id;
  v_allowed := (v_current, p_previous_status) in (
    ('SCREENING', 'DRAFT'),
    ('INVESTIGATOR_SETUP', 'SCREENING'),
    ('INVESTIGATING', 'INVESTIGATOR_SETUP'),
    ('FINDINGS', 'INVESTIGATING')
  );
  if not v_allowed then raise exception 'That stage cannot be reopened from the current status.'; end if;
  perform set_config('app.discipline_change_reason', btrim(p_reason), true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);
  update public.discipline_cases set status = p_previous_status, updated_by = v_actor_id where id = p_case_id;
end;
$function$;

create or replace function public.authorise_discipline_natural_justice_override(
  p_case_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_id uuid;
begin
  if not private.discipline_can_manage_case(p_case_id, v_actor_id) then
    raise exception 'Only a Case Coordinator can authorise this override.';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'A detailed override reason is required.'; end if;
  insert into public.discipline_natural_justice_overrides (case_id, reason, authorised_by)
  values (p_case_id, btrim(p_reason), v_actor_id)
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.sign_discipline_report(p_case_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_case public.discipline_cases%rowtype;
  v_snapshot jsonb;
  v_snapshot_id uuid;
  v_snapshot_number integer;
  v_override public.discipline_natural_justice_overrides%rowtype;
  v_missing_count integer;
begin
  if not private.discipline_has_case_role(p_case_id, array['LEAD_INVESTIGATOR']::text[], v_actor_id) then
    raise exception 'Only the Lead Investigator can sign the investigation report.';
  end if;
  select * into v_case from public.discipline_cases where id = p_case_id;
  if v_case.status <> 'FINDINGS' then raise exception 'The case must be at Findings before report sign-off.'; end if;
  if not exists (select 1 from public.discipline_findings where case_id = p_case_id) then
    raise exception 'Record allegation findings before report sign-off.';
  end if;
  select count(*) into v_missing_count
  from public.discipline_natural_justice_checks check_item
  where check_item.case_id = p_case_id and check_item.required and not check_item.completed;

  if v_missing_count > 0 then
    select * into v_override
    from public.discipline_natural_justice_overrides override_row
    where override_row.case_id = p_case_id and override_row.used_by_snapshot_id is null
    order by override_row.authorised_at desc
    limit 1;
    if v_override.id is null then
      raise exception 'Natural justice checks are incomplete and no Case Coordinator override is authorised.';
    end if;
  end if;

  select coalesce(max(snapshot_number), 0) + 1 into v_snapshot_number
  from public.discipline_report_snapshots where case_id = p_case_id;
  v_snapshot_id := gen_random_uuid();

  select jsonb_build_object(
    'case', to_jsonb(v_case),
    'rule_pack', (select to_jsonb(pack) from public.discipline_rule_packs pack where pack.id = v_case.rule_pack_id),
    'investigator_setup', (select to_jsonb(setup) from public.discipline_investigator_setups setup where setup.case_id = p_case_id order by setup.recorded_at desc limit 1),
    'allegations', coalesce((select jsonb_agg(to_jsonb(a) order by a.allegation_number) from public.discipline_allegations a where a.case_id = p_case_id), '[]'::jsonb),
    'classifications', coalesce((select jsonb_agg(to_jsonb(c) order by c.assessed_at) from public.discipline_classification_assessments c where c.case_id = p_case_id), '[]'::jsonb),
    'evidence_register', coalesce((select jsonb_agg(to_jsonb(e) - 'storage_path' - 'external_url' order by e.created_at) from public.discipline_evidence e where e.case_id = p_case_id), '[]'::jsonb),
    'natural_justice', coalesce((select jsonb_agg(to_jsonb(n) order by n.check_key) from public.discipline_natural_justice_checks n where n.case_id = p_case_id), '[]'::jsonb),
    'findings', coalesce((select jsonb_agg(to_jsonb(f) order by f.recorded_at) from public.discipline_findings f where f.case_id = p_case_id), '[]'::jsonb),
    'signed_at', now(),
    'signed_by', v_actor_id
  ) into v_snapshot;

  insert into public.discipline_report_snapshots (
    id, case_id, snapshot_number, report_data, natural_justice_override_reason,
    signed_by, sha256
  ) values (
    v_snapshot_id, p_case_id, v_snapshot_number, v_snapshot, v_override.reason, v_actor_id,
    encode(digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'), 'hex')
  );

  if v_override.id is not null then
    update public.discipline_natural_justice_overrides
    set used_by_snapshot_id = v_snapshot_id where id = v_override.id;
  end if;

  perform set_config('app.discipline_change_reason', 'Lead Investigation Officer signed report snapshot', true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);
  update public.discipline_cases set status = 'REPORT_SIGNED', updated_by = v_actor_id where id = p_case_id;
  return v_snapshot_id;
end;
$function$;

create or replace function public.record_discipline_decision(
  p_case_id uuid,
  p_outcome text,
  p_decision_reason text,
  p_rule_reference text,
  p_recommendation_followed boolean,
  p_difference_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_decision_id uuid;
  v_final_status text;
begin
  if not private.discipline_has_case_role(p_case_id, array['DECISION_MAKER']::text[], v_actor_id) then
    raise exception 'Only an assigned Decision Maker can record the HB decision.';
  end if;
  if not exists (
    select 1 from public.discipline_cases incident_case
    where incident_case.id = p_case_id and incident_case.status in ('REPORT_SIGNED', 'HB_DECISION')
  ) then raise exception 'A signed investigation report is required first.'; end if;
  if p_outcome not in (
    'NO_ACTION', 'MISCONDUCT_PENALTY_GUIDANCE', 'TRIBUNAL_REFERRAL',
    'MEDIATION_REFERRAL', 'COMBINATION_REFERRAL', 'OTHER_APPROPRIATE_COURSE'
  ) then raise exception 'Decision outcome is not valid.'; end if;
  if length(btrim(coalesce(p_decision_reason, ''))) < 10 then raise exception 'Decision reasoning is required.'; end if;
  if nullif(btrim(p_rule_reference), '') is null then raise exception 'A rule source is required.'; end if;
  if p_recommendation_followed is false and length(btrim(coalesce(p_difference_reason, ''))) < 5 then
    raise exception 'Explain why the recommendation was not followed.';
  end if;
  v_final_status := case
    when p_outcome in ('NO_ACTION', 'MISCONDUCT_PENALTY_GUIDANCE') then 'CLOSED'
    else 'REFERRED'
  end;

  insert into public.discipline_decisions (
    case_id, outcome, decision_reason, rule_reference,
    recommendation_followed, difference_reason, decided_by
  ) values (
    p_case_id, p_outcome, btrim(p_decision_reason), btrim(p_rule_reference),
    p_recommendation_followed, nullif(btrim(p_difference_reason), ''), v_actor_id
  ) returning id into v_decision_id;

  perform set_config('app.discipline_change_reason', 'HB decision recorded', true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);
  update public.discipline_cases set
    status = v_final_status,
    closed_at = now(),
    updated_by = v_actor_id
  where id = p_case_id;
  return v_decision_id;
end;
$function$;

create or replace function private.discipline_storage_case_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  v_first text := split_part(p_name, '/', 1);
begin
  if v_first ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return v_first::uuid;
  end if;
  return null;
end;
$function$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'discipline-evidence',
  'discipline-evidence',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy discipline_evidence_objects_select
on storage.objects for select to authenticated
using (
  bucket_id = 'discipline-evidence'
  and private.discipline_can_read_case(private.discipline_storage_case_id(name), (select auth.uid()))
);

create policy discipline_evidence_objects_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'discipline-evidence'
  and private.discipline_has_case_role(
    private.discipline_storage_case_id(name),
    array['CASE_COORDINATOR', 'LEAD_INVESTIGATOR', 'SUPPORT_INVESTIGATOR']::text[],
    (select auth.uid())
  )
);

-- RLS is enabled on every exposed table. Reference data is limited to people
-- with a discipline association context; case content is assignment-only.
alter table public.discipline_rule_packs enable row level security;
alter table public.discipline_rule_clauses enable row level security;
alter table public.discipline_deadline_definitions enable row level security;
alter table public.discipline_classification_rules enable row level security;
alter table public.discipline_calendar_exclusions enable row level security;
alter table public.discipline_local_variations enable row level security;
alter table public.discipline_portal_access enable row level security;
alter table public.discipline_cases enable row level security;
alter table public.discipline_case_members enable row level security;
alter table public.discipline_case_people enable row level security;
alter table public.discipline_allegations enable row level security;
alter table public.discipline_allegation_revisions enable row level security;
alter table public.discipline_classification_assessments enable row level security;
alter table public.discipline_deadlines enable row level security;
alter table public.discipline_deadline_events enable row level security;
alter table public.discipline_investigator_setups enable row level security;
alter table public.discipline_notifications enable row level security;
alter table public.discipline_witnesses enable row level security;
alter table public.discipline_evidence enable row level security;
alter table public.discipline_natural_justice_checks enable row level security;
alter table public.discipline_findings enable row level security;
alter table public.discipline_finding_revisions enable row level security;
alter table public.discipline_report_snapshots enable row level security;
alter table public.discipline_decisions enable row level security;
alter table public.discipline_audit_events enable row level security;
alter table public.discipline_natural_justice_overrides enable row level security;

create policy discipline_rule_packs_select on public.discipline_rule_packs
for select to authenticated
using (private.discipline_has_association_access(association_id, (select auth.uid())));
create policy discipline_rule_clauses_select on public.discipline_rule_clauses
for select to authenticated
using (exists (
  select 1 from public.discipline_rule_packs pack
  where pack.id = discipline_rule_clauses.rule_pack_id
    and private.discipline_has_association_access(pack.association_id, (select auth.uid()))
));
create policy discipline_deadline_definitions_select on public.discipline_deadline_definitions
for select to authenticated
using (exists (
  select 1 from public.discipline_rule_packs pack
  where pack.id = discipline_deadline_definitions.rule_pack_id
    and private.discipline_has_association_access(pack.association_id, (select auth.uid()))
));
create policy discipline_classification_rules_select on public.discipline_classification_rules
for select to authenticated
using (exists (
  select 1 from public.discipline_rule_packs pack
  where pack.id = discipline_classification_rules.rule_pack_id
    and private.discipline_has_association_access(pack.association_id, (select auth.uid()))
));
create policy discipline_calendar_exclusions_select on public.discipline_calendar_exclusions
for select to authenticated
using (private.discipline_has_association_access(association_id, (select auth.uid())));
create policy discipline_local_variations_select on public.discipline_local_variations
for select to authenticated
using (exists (
  select 1 from public.discipline_rule_packs pack
  where pack.id = discipline_local_variations.rule_pack_id
    and private.discipline_has_association_access(pack.association_id, (select auth.uid()))
));
create policy discipline_portal_access_select on public.discipline_portal_access
for select to authenticated
using (
  user_id = (select auth.uid())
  or private.discipline_can_manage_config(association_id, (select auth.uid()))
);
create policy discipline_cases_select on public.discipline_cases
for select to authenticated
using (private.discipline_can_read_case(id, (select auth.uid())));

do $case_select_policies$
declare
  v_table text;
begin
  foreach v_table in array array[
    'discipline_case_members', 'discipline_case_people', 'discipline_allegations',
    'discipline_allegation_revisions', 'discipline_classification_assessments',
    'discipline_deadlines', 'discipline_deadline_events',
    'discipline_investigator_setups', 'discipline_notifications',
    'discipline_witnesses', 'discipline_evidence',
    'discipline_natural_justice_checks', 'discipline_findings',
    'discipline_finding_revisions', 'discipline_report_snapshots',
    'discipline_decisions', 'discipline_audit_events',
    'discipline_natural_justice_overrides'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.discipline_can_read_case(case_id, (select auth.uid())))',
      v_table || '_select',
      v_table
    );
  end loop;
end
$case_select_policies$;

create policy discipline_case_people_insert on public.discipline_case_people
for insert to authenticated
with check (
  private.discipline_can_manage_case(case_id, (select auth.uid()))
  and created_by = (select auth.uid())
);
create policy discipline_case_people_update on public.discipline_case_people
for update to authenticated
using (private.discipline_can_manage_case(case_id, (select auth.uid())))
with check (
  private.discipline_can_manage_case(case_id, (select auth.uid()))
  and updated_by = (select auth.uid())
);
create policy discipline_investigator_setups_insert on public.discipline_investigator_setups
for insert to authenticated
with check (
  private.discipline_can_manage_case(case_id, (select auth.uid()))
  and recorded_by = (select auth.uid())
);
create policy discipline_notifications_insert on public.discipline_notifications
for insert to authenticated
with check (
  private.discipline_can_manage_case(case_id, (select auth.uid()))
  and created_by = (select auth.uid())
);
create policy discipline_notifications_update on public.discipline_notifications
for update to authenticated
using (private.discipline_can_manage_case(case_id, (select auth.uid())))
with check (
  private.discipline_can_manage_case(case_id, (select auth.uid()))
  and updated_by = (select auth.uid())
);
create policy discipline_witnesses_insert on public.discipline_witnesses
for insert to authenticated
with check (
  private.discipline_can_investigate(case_id, (select auth.uid()))
  and created_by = (select auth.uid())
);
create policy discipline_witnesses_update on public.discipline_witnesses
for update to authenticated
using (private.discipline_can_investigate(case_id, (select auth.uid())))
with check (
  private.discipline_can_investigate(case_id, (select auth.uid()))
  and updated_by = (select auth.uid())
);
create policy discipline_evidence_insert on public.discipline_evidence
for insert to authenticated
with check (
  private.discipline_can_investigate(case_id, (select auth.uid()))
  and created_by = (select auth.uid())
);
create policy discipline_natural_justice_update on public.discipline_natural_justice_checks
for update to authenticated
using (private.discipline_can_investigate(case_id, (select auth.uid())))
with check (private.discipline_can_investigate(case_id, (select auth.uid())));

revoke all on table
  public.discipline_rule_packs, public.discipline_rule_clauses,
  public.discipline_deadline_definitions, public.discipline_classification_rules,
  public.discipline_calendar_exclusions, public.discipline_local_variations,
  public.discipline_portal_access, public.discipline_cases,
  public.discipline_case_members, public.discipline_case_people,
  public.discipline_allegations, public.discipline_allegation_revisions,
  public.discipline_classification_assessments, public.discipline_deadlines,
  public.discipline_deadline_events, public.discipline_investigator_setups,
  public.discipline_notifications, public.discipline_witnesses,
  public.discipline_evidence, public.discipline_natural_justice_checks,
  public.discipline_findings, public.discipline_finding_revisions,
  public.discipline_report_snapshots, public.discipline_decisions,
  public.discipline_audit_events, public.discipline_natural_justice_overrides
from public, anon, authenticated;

grant select on table
  public.discipline_rule_packs, public.discipline_rule_clauses,
  public.discipline_deadline_definitions, public.discipline_classification_rules,
  public.discipline_calendar_exclusions, public.discipline_local_variations,
  public.discipline_portal_access, public.discipline_cases,
  public.discipline_case_members, public.discipline_case_people,
  public.discipline_allegations, public.discipline_allegation_revisions,
  public.discipline_classification_assessments, public.discipline_deadlines,
  public.discipline_deadline_events, public.discipline_investigator_setups,
  public.discipline_notifications, public.discipline_witnesses,
  public.discipline_evidence, public.discipline_natural_justice_checks,
  public.discipline_findings, public.discipline_finding_revisions,
  public.discipline_report_snapshots, public.discipline_decisions,
  public.discipline_audit_events, public.discipline_natural_justice_overrides
to authenticated;

grant insert, update on table public.discipline_case_people to authenticated;
grant insert on table public.discipline_investigator_setups to authenticated;
grant insert, update on table public.discipline_notifications to authenticated;
grant insert, update on table public.discipline_witnesses to authenticated;
grant insert on table public.discipline_evidence to authenticated;
grant update on table public.discipline_natural_justice_checks to authenticated;

grant all on table
  public.discipline_rule_packs, public.discipline_rule_clauses,
  public.discipline_deadline_definitions, public.discipline_classification_rules,
  public.discipline_calendar_exclusions, public.discipline_local_variations,
  public.discipline_portal_access, public.discipline_cases,
  public.discipline_case_members, public.discipline_case_people,
  public.discipline_allegations, public.discipline_allegation_revisions,
  public.discipline_classification_assessments, public.discipline_deadlines,
  public.discipline_deadline_events, public.discipline_investigator_setups,
  public.discipline_notifications, public.discipline_witnesses,
  public.discipline_evidence, public.discipline_natural_justice_checks,
  public.discipline_findings, public.discipline_finding_revisions,
  public.discipline_report_snapshots, public.discipline_decisions,
  public.discipline_audit_events, public.discipline_natural_justice_overrides
to service_role;
grant usage, select on sequence public.discipline_case_number_seq to service_role;

revoke all on function private.discipline_business_deadline(uuid, timestamptz, integer, time, text) from public, anon, authenticated;
revoke all on function private.discipline_initialise_deadlines(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.discipline_capture_revision() from public, anon, authenticated;
revoke all on function private.discipline_capture_row_audit() from public, anon, authenticated;
revoke all on function private.discipline_set_updated_at() from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.discipline_has_case_role(uuid, text[], uuid) to authenticated;
grant execute on function private.discipline_can_read_case(uuid, uuid) to authenticated;
grant execute on function private.discipline_can_manage_case(uuid, uuid) to authenticated;
grant execute on function private.discipline_can_investigate(uuid, uuid) to authenticated;
grant execute on function private.discipline_can_manage_config(uuid, uuid) to authenticated;
grant execute on function private.discipline_can_create_case(uuid, uuid) to authenticated;
grant execute on function private.discipline_has_association_access(uuid, uuid) to authenticated;
grant execute on function private.discipline_storage_case_id(text) to authenticated;

revoke all on function public.get_discipline_portal_context() from public, anon;
revoke all on function public.set_discipline_portal_access(uuid, uuid, text, boolean, boolean, boolean, text) from public, anon;
revoke all on function public.create_discipline_case(jsonb) from public, anon;
revoke all on function public.assign_discipline_case_member(uuid, uuid, text, boolean, text) from public, anon;
revoke all on function public.save_discipline_intake(uuid, jsonb, text) from public, anon;
revoke all on function public.recalculate_discipline_deadlines(uuid, text) from public, anon;
revoke all on function public.set_discipline_deadline_completion(uuid, boolean, timestamptz, text) from public, anon;
revoke all on function public.save_discipline_allegation(uuid, uuid, text, text, timestamptz, text, text) from public, anon;
revoke all on function public.record_discipline_classification(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.save_discipline_finding(uuid, uuid, jsonb, text) from public, anon;
revoke all on function public.complete_discipline_stage(uuid, text, text) from public, anon;
revoke all on function public.reopen_discipline_stage(uuid, text, text) from public, anon;
revoke all on function public.authorise_discipline_natural_justice_override(uuid, text) from public, anon;
revoke all on function public.sign_discipline_report(uuid) from public, anon;
revoke all on function public.record_discipline_decision(uuid, text, text, text, boolean, text) from public, anon;

grant execute on function public.get_discipline_portal_context() to authenticated;
grant execute on function public.set_discipline_portal_access(uuid, uuid, text, boolean, boolean, boolean, text) to authenticated;
grant execute on function public.create_discipline_case(jsonb) to authenticated;
grant execute on function public.assign_discipline_case_member(uuid, uuid, text, boolean, text) to authenticated;
grant execute on function public.save_discipline_intake(uuid, jsonb, text) to authenticated;
grant execute on function public.recalculate_discipline_deadlines(uuid, text) to authenticated;
grant execute on function public.set_discipline_deadline_completion(uuid, boolean, timestamptz, text) to authenticated;
grant execute on function public.save_discipline_allegation(uuid, uuid, text, text, timestamptz, text, text) to authenticated;
grant execute on function public.record_discipline_classification(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.save_discipline_finding(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.complete_discipline_stage(uuid, text, text) to authenticated;
grant execute on function public.reopen_discipline_stage(uuid, text, text) to authenticated;
grant execute on function public.authorise_discipline_natural_justice_override(uuid, text) to authenticated;
grant execute on function public.sign_discipline_report(uuid) to authenticated;
grant execute on function public.record_discipline_decision(uuid, text, text, text, boolean, text) to authenticated;


-- Linked records inherit the source record scope. This replaces the initial
-- function without rewriting its applied migration history.
create or replace function public.save_safety_hub_form(
  p_mode text,
  p_record_id uuid,
  p_association_id uuid,
  p_club_id uuid,
  p_team_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_record_id uuid := p_record_id;
  v_source_type text := p_mode;
  v_association_id uuid := p_association_id;
  v_club_id uuid := p_club_id;
  v_team_id uuid := p_team_id;
  v_risk_id uuid := nullif(p_payload ->> 'linked_risk_id', '')::uuid;
  v_action_id uuid := nullif(p_payload ->> 'linked_action_id', '')::uuid;
  v_qi_id uuid := nullif(p_payload ->> 'linked_qi_id', '')::uuid;
  v_idea_id uuid := nullif(p_payload ->> 'linked_idea_id', '')::uuid;
  v_change_reason text := nullif(btrim(p_payload ->> 'change_reason'), '');
begin
  if auth.uid() is null then
    raise exception 'Sign in before saving Safety Hub records.';
  end if;
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Safety Hub form data must be an object.';
  end if;

  if p_mode in ('risk', 'action', 'qi', 'idea') and p_record_id is null
     and p_association_id is null then
    raise exception 'Select an association before creating a Safety Hub record.';
  end if;

  -- A record created from another Safety Hub record inherits the permanent
  -- source scope. Mixed-scope links are rejected later by the existing trigger.
  if p_record_id is null and v_risk_id is not null then
    select association_id, club_id, team_id into v_association_id, v_club_id, v_team_id
    from public.rg_risk_register where id = v_risk_id;
  elsif p_record_id is null and v_action_id is not null then
    select association_id, club_id, team_id into v_association_id, v_club_id, v_team_id
    from public.rg_be_smart_actions where id = v_action_id;
  elsif p_record_id is null and v_qi_id is not null then
    select association_id, club_id, team_id into v_association_id, v_club_id, v_team_id
    from public.rg_quality_improvement_items where id = v_qi_id;
  elsif p_record_id is null and v_idea_id is not null then
    select association_id, club_id, team_id into v_association_id, v_club_id, v_team_id
    from public.rg_bright_ideas where id = v_idea_id;
  end if;

  case p_mode
    when 'risk' then
      if p_record_id is null then
        insert into public.rg_risk_register (
          association_id, club_id, team_id, title, description, risk_event,
          consequences, risk_type, category, owner_id, status, likelihood,
          consequence, inherent_likelihood, inherent_consequence,
          inherent_rating, residual_likelihood, residual_consequence,
          residual_rating, target_rating, existing_controls,
          treatment_plan, review_frequency, next_review_date, evidence,
          last_change_reason
        ) values (
          v_association_id, v_club_id, v_team_id, btrim(p_payload ->> 'title'),
          nullif(btrim(p_payload ->> 'summary'), ''),
          nullif(btrim(p_payload ->> 'risk_event'), ''),
          nullif(btrim(p_payload ->> 'consequences'), ''),
          nullif(btrim(p_payload ->> 'risk_type'), ''),
          nullif(btrim(p_payload ->> 'category'), ''),
          nullif(p_payload ->> 'owner_id', '')::uuid,
          (p_payload ->> 'status')::public.risk_status_enum,
          (p_payload ->> 'residual_likelihood')::integer,
          (p_payload ->> 'residual_consequence')::integer,
          (p_payload ->> 'inherent_likelihood')::integer,
          (p_payload ->> 'inherent_consequence')::integer,
          p_payload ->> 'inherent_rating',
          (p_payload ->> 'residual_likelihood')::integer,
          (p_payload ->> 'residual_consequence')::integer,
          p_payload ->> 'residual_rating', p_payload ->> 'target_rating',
          nullif(btrim(p_payload ->> 'existing_controls'), ''),
          nullif(btrim(p_payload ->> 'treatment_plan'), ''),
          nullif(btrim(p_payload ->> 'review_frequency'), ''),
          nullif(p_payload ->> 'next_review_date', '')::date,
          nullif(btrim(p_payload ->> 'evidence'), ''), 'Created in Safety Hub'
        ) returning id into v_record_id;
      else
        if v_change_reason is null then raise exception 'A change reason is required.'; end if;
        update public.rg_risk_register set
          title = btrim(p_payload ->> 'title'),
          description = nullif(btrim(p_payload ->> 'summary'), ''),
          risk_event = nullif(btrim(p_payload ->> 'risk_event'), ''),
          consequences = nullif(btrim(p_payload ->> 'consequences'), ''),
          risk_type = nullif(btrim(p_payload ->> 'risk_type'), ''),
          category = nullif(btrim(p_payload ->> 'category'), ''),
          owner_id = nullif(p_payload ->> 'owner_id', '')::uuid,
          status = (p_payload ->> 'status')::public.risk_status_enum,
          likelihood = (p_payload ->> 'residual_likelihood')::integer,
          consequence = (p_payload ->> 'residual_consequence')::integer,
          inherent_likelihood = (p_payload ->> 'inherent_likelihood')::integer,
          inherent_consequence = (p_payload ->> 'inherent_consequence')::integer,
          inherent_rating = p_payload ->> 'inherent_rating',
          residual_likelihood = (p_payload ->> 'residual_likelihood')::integer,
          residual_consequence = (p_payload ->> 'residual_consequence')::integer,
          residual_rating = p_payload ->> 'residual_rating',
          target_rating = p_payload ->> 'target_rating',
          existing_controls = nullif(btrim(p_payload ->> 'existing_controls'), ''),
          treatment_plan = nullif(btrim(p_payload ->> 'treatment_plan'), ''),
          review_frequency = nullif(btrim(p_payload ->> 'review_frequency'), ''),
          next_review_date = nullif(p_payload ->> 'next_review_date', '')::date,
          evidence = nullif(btrim(p_payload ->> 'evidence'), ''),
          last_change_reason = v_change_reason
        where id = p_record_id;
        if not found then raise exception 'Risk record not found or not accessible.'; end if;
      end if;
      v_risk_id := v_record_id;

    when 'action' then
      if p_record_id is null then
        insert into public.rg_be_smart_actions (
          association_id, club_id, team_id, risk_id, title, action_text,
          assigned_to, status, due_date, baseline, evaluate, specific,
          measurable, achievable, relevant, time_bound, resources,
          last_change_reason
        ) values (
          v_association_id, v_club_id, v_team_id, v_risk_id,
          btrim(p_payload ->> 'title'),
          coalesce(nullif(btrim(p_payload ->> 'specific'), ''), btrim(p_payload ->> 'title')),
          nullif(p_payload ->> 'owner_id', '')::uuid,
          (p_payload ->> 'status')::public.action_status_enum,
          nullif(p_payload ->> 'due_date', '')::date,
          nullif(btrim(p_payload ->> 'baseline'), ''),
          nullif(btrim(p_payload ->> 'evaluate'), ''),
          nullif(btrim(p_payload ->> 'specific'), ''),
          nullif(btrim(p_payload ->> 'measurable'), ''),
          nullif(btrim(p_payload ->> 'achievable'), ''),
          nullif(btrim(p_payload ->> 'relevant'), ''),
          nullif(btrim(p_payload ->> 'time_bound'), ''),
          nullif(btrim(p_payload ->> 'resources'), ''), 'Created in Safety Hub'
        ) returning id into v_record_id;
      else
        if v_change_reason is null then raise exception 'A change reason is required.'; end if;
        update public.rg_be_smart_actions set
          title = btrim(p_payload ->> 'title'),
          action_text = coalesce(nullif(btrim(p_payload ->> 'specific'), ''), btrim(p_payload ->> 'title')),
          assigned_to = nullif(p_payload ->> 'owner_id', '')::uuid,
          status = (p_payload ->> 'status')::public.action_status_enum,
          due_date = nullif(p_payload ->> 'due_date', '')::date,
          baseline = nullif(btrim(p_payload ->> 'baseline'), ''),
          evaluate = nullif(btrim(p_payload ->> 'evaluate'), ''),
          specific = nullif(btrim(p_payload ->> 'specific'), ''),
          measurable = nullif(btrim(p_payload ->> 'measurable'), ''),
          achievable = nullif(btrim(p_payload ->> 'achievable'), ''),
          relevant = nullif(btrim(p_payload ->> 'relevant'), ''),
          time_bound = nullif(btrim(p_payload ->> 'time_bound'), ''),
          resources = nullif(btrim(p_payload ->> 'resources'), ''),
          last_change_reason = v_change_reason
        where id = p_record_id;
        if not found then raise exception 'Action record not found or not accessible.'; end if;
      end if;
      v_action_id := v_record_id;

    when 'qi' then
      if p_record_id is null then
        insert into public.rg_quality_improvement_items (
          association_id, club_id, team_id, title, description, source, area,
          owner_id, priority, status, due_date, issue, required_action,
          outcome, last_change_reason
        ) values (
          v_association_id, v_club_id, v_team_id, btrim(p_payload ->> 'title'),
          nullif(btrim(p_payload ->> 'issue'), ''),
          nullif(btrim(p_payload ->> 'source'), ''),
          nullif(btrim(p_payload ->> 'area'), ''),
          nullif(p_payload ->> 'owner_id', '')::uuid,
          p_payload ->> 'priority',
          (p_payload ->> 'status')::public.action_status_enum,
          nullif(p_payload ->> 'due_date', '')::date,
          nullif(btrim(p_payload ->> 'issue'), ''),
          nullif(btrim(p_payload ->> 'required_action'), ''),
          nullif(btrim(p_payload ->> 'outcome'), ''), 'Created in Safety Hub'
        ) returning id into v_record_id;
      else
        if v_change_reason is null then raise exception 'A change reason is required.'; end if;
        update public.rg_quality_improvement_items set
          title = btrim(p_payload ->> 'title'),
          description = nullif(btrim(p_payload ->> 'issue'), ''),
          source = nullif(btrim(p_payload ->> 'source'), ''),
          area = nullif(btrim(p_payload ->> 'area'), ''),
          owner_id = nullif(p_payload ->> 'owner_id', '')::uuid,
          priority = p_payload ->> 'priority',
          status = (p_payload ->> 'status')::public.action_status_enum,
          due_date = nullif(p_payload ->> 'due_date', '')::date,
          issue = nullif(btrim(p_payload ->> 'issue'), ''),
          required_action = nullif(btrim(p_payload ->> 'required_action'), ''),
          outcome = nullif(btrim(p_payload ->> 'outcome'), ''),
          last_change_reason = v_change_reason
        where id = p_record_id;
        if not found then raise exception 'QI record not found or not accessible.'; end if;
      end if;
      v_qi_id := v_record_id;

    when 'idea' then
      insert into public.rg_bright_ideas (
        association_id, club_id, team_id, title, why_needed,
        suggested_implementation, suggested_evaluation, could_assist,
        other_information, status, submitted_by, last_change_reason
      ) values (
        v_association_id, v_club_id, v_team_id, btrim(p_payload ->> 'title'),
        btrim(p_payload ->> 'why_needed'),
        nullif(btrim(p_payload ->> 'suggested_implementation'), ''),
        nullif(btrim(p_payload ->> 'suggested_evaluation'), ''),
        nullif(btrim(p_payload ->> 'could_assist'), ''),
        nullif(btrim(p_payload ->> 'other_information'), ''),
        p_payload ->> 'status', auth.uid(), 'Submitted in Safety Hub'
      ) returning id into v_record_id;
      v_idea_id := v_record_id;

    when 'committee-review' then
      v_source_type := 'idea';
      v_idea_id := p_record_id;
      update public.rg_bright_ideas set
        decision = nullif(p_payload ->> 'decision', ''),
        status = p_payload ->> 'status',
        committee_notes = nullif(btrim(p_payload ->> 'committee_notes'), ''),
        decision_reason = nullif(btrim(p_payload ->> 'decision_reason'), ''),
        decided_at = now(), decided_by = auth.uid(),
        last_change_reason = coalesce(nullif(btrim(p_payload ->> 'decision_reason'), ''), 'Committee review')
      where id = p_record_id;
      if not found then raise exception 'Bright Idea not found or not accessible.'; end if;

    when 'risk-review' then
      v_source_type := 'risk';
      v_risk_id := p_record_id;
      select association_id, club_id, team_id
      into v_association_id, v_club_id, v_team_id
      from public.rg_risk_register where id = p_record_id;
      if not found then raise exception 'Risk record not found or not accessible.'; end if;

      insert into public.rg_risk_reviews (
        risk_id, association_id, club_id, team_id, reviewed_by, reviewed_at,
        residual_likelihood, residual_consequence, residual_rating, new_status,
        next_review_date, notes, evidence, review_reason, last_change_reason
      ) values (
        p_record_id, v_association_id, v_club_id, v_team_id, auth.uid(),
        (p_payload ->> 'reviewed_at')::timestamptz,
        (p_payload ->> 'residual_likelihood')::integer,
        (p_payload ->> 'residual_consequence')::integer,
        p_payload ->> 'residual_rating',
        (p_payload ->> 'status')::public.risk_status_enum,
        nullif(p_payload ->> 'next_review_date', '')::date,
        nullif(btrim(p_payload ->> 'review_notes'), ''),
        nullif(btrim(p_payload ->> 'evidence'), ''),
        btrim(p_payload ->> 'review_notes'),
        btrim(p_payload ->> 'review_notes')
      ) returning id into v_record_id;

      update public.rg_risk_register set
        likelihood = (p_payload ->> 'residual_likelihood')::integer,
        consequence = (p_payload ->> 'residual_consequence')::integer,
        residual_likelihood = (p_payload ->> 'residual_likelihood')::integer,
        residual_consequence = (p_payload ->> 'residual_consequence')::integer,
        residual_rating = p_payload ->> 'residual_rating',
        status = (p_payload ->> 'status')::public.risk_status_enum,
        next_review_date = nullif(p_payload ->> 'next_review_date', '')::date,
        evidence = nullif(btrim(p_payload ->> 'evidence'), ''),
        last_change_reason = 'Risk review: ' || btrim(p_payload ->> 'review_notes')
      where id = p_record_id;
      return v_record_id;

    when 'link-records' then
      v_source_type := p_payload ->> 'source_type';
      if v_source_type = 'risk' then v_risk_id := p_record_id;
      elsif v_source_type = 'action' then v_action_id := p_record_id;
      elsif v_source_type = 'qi' then v_qi_id := p_record_id;
      elsif v_source_type = 'idea' then v_idea_id := p_record_id;
      else raise exception 'Unknown Safety Hub source record type.';
      end if;

    else
      raise exception 'Unknown Safety Hub form mode.';
  end case;

  if v_source_type = 'risk' then
    select association_id, club_id, team_id into v_association_id, v_club_id, v_team_id
    from public.rg_risk_register where id = v_risk_id;
  elsif v_source_type = 'action' then
    select association_id, club_id, team_id into v_association_id, v_club_id, v_team_id
    from public.rg_be_smart_actions where id = v_action_id;
  elsif v_source_type = 'qi' then
    select association_id, club_id, team_id into v_association_id, v_club_id, v_team_id
    from public.rg_quality_improvement_items where id = v_qi_id;
  elsif v_source_type in ('idea', 'committee-review') then
    select association_id, club_id, team_id into v_association_id, v_club_id, v_team_id
    from public.rg_bright_ideas where id = v_idea_id;
  end if;

  insert into public.rg_record_links (
    association_id, club_id, team_id, risk_id, action_id, qi_item_id,
    bright_idea_id, link_reason, last_change_reason
  )
  select
    v_association_id, v_club_id, v_team_id, pair.risk_id, pair.action_id,
    pair.qi_id, pair.idea_id,
    coalesce(nullif(btrim(p_payload ->> 'link_reason'), ''), 'Related Safety Hub records'),
    coalesce(nullif(btrim(p_payload ->> 'link_reason'), ''), 'Safety Hub relationship created')
  from (
    values
      (v_risk_id, v_action_id, null::uuid, null::uuid),
      (v_risk_id, null::uuid, v_qi_id, null::uuid),
      (v_risk_id, null::uuid, null::uuid, v_idea_id),
      (null::uuid, v_action_id, v_qi_id, null::uuid),
      (null::uuid, v_action_id, null::uuid, v_idea_id),
      (null::uuid, null::uuid, v_qi_id, v_idea_id)
  ) as pair(risk_id, action_id, qi_id, idea_id)
  where num_nonnulls(pair.risk_id, pair.action_id, pair.qi_id, pair.idea_id) = 2
    and (
      (v_source_type = 'risk' and pair.risk_id = v_record_id)
      or (v_source_type = 'action' and pair.action_id = v_record_id)
      or (v_source_type = 'qi' and pair.qi_id = v_record_id)
      or (v_source_type in ('idea', 'committee-review') and pair.idea_id = coalesce(v_record_id, v_idea_id))
    )
    and not exists (
      select 1 from public.rg_record_links existing
      where existing.is_active
        and existing.risk_id is not distinct from pair.risk_id
        and existing.action_id is not distinct from pair.action_id
        and existing.qi_item_id is not distinct from pair.qi_id
        and existing.bright_idea_id is not distinct from pair.idea_id
    );

  return v_record_id;
end;
$function$;

revoke all on function public.save_safety_hub_form(text, uuid, uuid, uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.save_safety_hub_form(text, uuid, uuid, uuid, uuid, jsonb)
  to authenticated;

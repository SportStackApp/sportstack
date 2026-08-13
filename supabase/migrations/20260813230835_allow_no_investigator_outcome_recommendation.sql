-- A signed investigation report may record findings without recommending one overall Rule 7.7 outcome.
alter table public.discipline_review_panel_votes
  alter column recommendation_followed drop not null;

alter table public.discipline_review_panel_votes
  drop constraint discipline_review_panel_votes_difference_check;

alter table public.discipline_review_panel_votes
  add constraint discipline_review_panel_votes_difference_check check (
    recommendation_followed is distinct from false
    or length(btrim(coalesce(difference_reason, ''))) >= 5
  );

create or replace function public.record_discipline_review_panel_vote(
  p_case_id uuid,
  p_vote jsonb,
  p_change_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_panel public.discipline_review_panels%rowtype;
  v_member public.discipline_review_panel_members%rowtype;
  v_previous public.discipline_review_panel_votes%rowtype;
  v_vote_id uuid;
  v_outcome text := p_vote ->> 'outcome';
  v_recommendation_followed boolean := (p_vote ->> 'recommendation_followed')::boolean;
begin
  select panel.* into v_panel
  from public.discipline_review_panels panel
  join public.discipline_cases incident_case on incident_case.id = panel.case_id
  where panel.case_id = p_case_id
    and panel.status in ('READY', 'DELIBERATING')
    and incident_case.status = 'HB_DECISION';
  if v_panel.id is null then
    raise exception 'The review panel must be ready and the case opened for deliberation.';
  end if;

  select member.* into v_member
  from public.discipline_review_panel_members member
  where member.panel_id = v_panel.id
    and member.profile_id = v_actor_id
    and member.active
    and member.invitation_status = 'ACCEPTED'
    and member.conflict_decision <> 'REPLACE_MEMBER'
    and not member.actual_conflict;
  if v_member.id is null then
    raise exception 'Only an accepted independent panel member can record a vote.';
  end if;
  if v_outcome not in (
    'NO_ACTION', 'MISCONDUCT_PENALTY_GUIDANCE', 'TRIBUNAL_REFERRAL',
    'MEDIATION_REFERRAL', 'COMBINATION_REFERRAL', 'OTHER_APPROPRIATE_COURSE'
  ) then
    raise exception 'Decision outcome is not valid.';
  end if;
  if length(btrim(coalesce(p_vote ->> 'decision_reason', ''))) < 10
     or length(btrim(coalesce(p_vote ->> 'rule_reference', ''))) < 3 then
    raise exception 'Independent reasoning and a rule source are required.';
  end if;
  if v_recommendation_followed is false
     and length(btrim(coalesce(p_vote ->> 'difference_reason', ''))) < 5 then
    raise exception 'Explain why the investigator recommendation was not followed.';
  end if;

  select vote.* into v_previous
  from public.discipline_review_panel_votes vote
  where vote.panel_member_id = v_member.id
  order by vote.revision_number desc
  limit 1;
  if v_previous.id is not null and length(btrim(coalesce(p_change_reason, ''))) < 10 then
    raise exception 'Explain why the earlier vote is being revised.';
  end if;

  perform set_config('app.discipline_change_reason', coalesce(nullif(btrim(p_change_reason), ''), 'Independent panel vote recorded'), true);
  perform set_config('app.discipline_actor_id', v_actor_id::text, true);

  insert into public.discipline_review_panel_votes (
    panel_id, case_id, panel_member_id, revision_number, supersedes_vote_id,
    outcome, decision_reason, rule_reference, recommendation_followed,
    difference_reason, change_reason, submitted_by
  ) values (
    v_panel.id, p_case_id, v_member.id, coalesce(v_previous.revision_number, 0) + 1,
    v_previous.id, v_outcome, btrim(p_vote ->> 'decision_reason'),
    btrim(p_vote ->> 'rule_reference'), v_recommendation_followed,
    nullif(btrim(p_vote ->> 'difference_reason'), ''),
    nullif(btrim(p_change_reason), ''), v_actor_id
  ) returning id into v_vote_id;

  update public.discipline_review_panels
  set status = 'DELIBERATING', updated_by = v_actor_id
  where id = v_panel.id;

  return v_vote_id;
end;
$function$;

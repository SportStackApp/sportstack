-- Restore the complete Player MVP deadline lifecycle after the manual-only
-- Production tally slice. This is safe to apply after either the full Dev
-- tally migrations or the narrow Production release.

create or replace function private.close_due_mvp_voting_sessions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.mvp_voting_sessions%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_has_concern boolean;
  v_closed integer := 0;
  v_disputed integer := 0;
begin
  for v_session in
    select session.*
    from public.mvp_voting_sessions session
    where session.status = 'OPEN'::public.mvp_session_status
      and session.closes_at is not null
      and session.closes_at <= now()
    order by session.closes_at, session.id
    for update skip locked
  loop
    v_old := to_jsonb(v_session);
    select exists (
      select 1
      from public.mvp_result_checks result_check
      where result_check.session_id = v_session.id
        and result_check.result_check_round = v_session.result_check_round
        and result_check.response = 'INCORRECT'
    ) into v_has_concern;

    if v_has_concern then
      update public.mvp_voting_sessions session
      set status = 'RESULT_DISPUTED'::public.mvp_session_status
      where session.id = v_session.id
      returning to_jsonb(session) into v_new;

      insert into public.mvp_vote_audit(
        session_id, changed_by, action, old_data, new_data, reason, team_id, details
      ) values (
        v_session.id, null, 'SESSION_STATUS_CHANGED', v_old, v_new,
        'RESULT_DISPUTED_AT_DEADLINE', v_session.team_id,
        jsonb_build_object('source', 'AUTOMATIC_DEADLINE_JOB', 'deadline', v_session.closes_at)
      );
      v_disputed := v_disputed + 1;
    else
      update public.mvp_voting_sessions session
      set status = 'CLOSED'::public.mvp_session_status,
        closed_at = v_session.closes_at,
        closed_by = null,
        locked_at = v_session.closes_at,
        locked_by = null,
        locked_reason = 'CLOSED_AT_DEADLINE'
      where session.id = v_session.id
      returning to_jsonb(session) into v_new;

      insert into public.mvp_vote_audit(
        session_id, changed_by, action, old_data, new_data, reason, team_id, details
      ) values (
        v_session.id, null, 'SESSION_STATUS_CHANGED', v_old, v_new,
        'CLOSED_AT_DEADLINE', v_session.team_id,
        jsonb_build_object('source', 'AUTOMATIC_DEADLINE_JOB', 'deadline', v_session.closes_at)
      );
      v_closed := v_closed + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'processed', v_closed + v_disputed,
    'closed', v_closed,
    'resultDisputed', v_disputed
  );
end;
$$;

create or replace function private.enforce_mvp_voting_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.mvp_session_status;
  v_closes_at timestamptz;
begin
  select session.status, session.closes_at
  into v_status, v_closes_at
  from public.mvp_voting_sessions session
  where session.id = new.session_id;

  if v_status is distinct from 'OPEN'::public.mvp_session_status then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_NOT_OPEN';
  end if;
  if v_closes_at is not null and v_closes_at <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'MVP_SESSION_DEADLINE_PASSED';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_mvp_voting_deadline_on_votes on public.mvp_votes;
create trigger enforce_mvp_voting_deadline_on_votes
before insert or update on public.mvp_votes
for each row execute function private.enforce_mvp_voting_deadline();

drop trigger if exists enforce_mvp_voting_deadline_on_submissions on public.mvp_vote_submissions;
create trigger enforce_mvp_voting_deadline_on_submissions
before insert or update on public.mvp_vote_submissions
for each row execute function private.enforce_mvp_voting_deadline();

revoke all on function private.close_due_mvp_voting_sessions()
  from public, anon, authenticated;
revoke all on function private.enforce_mvp_voting_deadline()
  from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'close-due-player-mvp-voting';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'close-due-player-mvp-voting',
    '* * * * *',
    'select private.close_due_mvp_voting_sessions();'
  );
end;
$$;

-- Reconcile already-overdue sessions immediately. Release execution must
-- capture the dry-run counts and backup before applying this migration.
select private.close_due_mvp_voting_sessions();

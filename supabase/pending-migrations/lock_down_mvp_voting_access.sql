-- Final MVP access lockdown.
--
-- Apply only after the team-owned UI and reminder function have passed the
-- approved live pilot. Mutations then flow through the scoped RPCs created by
-- expand_team_mvp_voting; legacy token data remains stored but is not exposed.

alter table public.mvp_voting_sessions enable row level security;
alter table public.mvp_vote_submissions enable row level security;
alter table public.mvp_votes enable row level security;
alter table public.mvp_result_checks enable row level security;
alter table public.mvp_vote_audit enable row level security;
alter table public.mvp_voting_email_events enable row level security;

-- Remove legacy broad/role-only policies from MVP objects. Notification
-- policies are deliberately not included: non-MVP profile/team-request flows
-- still create notifications directly and must remain compatible.
do $migration$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'mvp_voting_sessions',
    'mvp_vote_submissions',
    'mvp_votes',
    'mvp_result_checks',
    'mvp_vote_audit',
    'mvp_voting_email_events'
  ]
  loop
    for v_policy in
      select p.policyname
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = v_table
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        v_policy.policyname,
        v_table
      );
    end loop;
  end loop;
end
$migration$;

-- Sessions: players see non-pending rounds only for the side they attended.
-- Their own validated submission remains visible as history even if a later
-- attendance import changes. Scoped managers/admins retain their audit view.
create policy "Scoped MVP session read"
on public.mvp_voting_sessions
for select
to authenticated
using (
  private.mvp_can_audit_session((select auth.uid()), id)
  or (
    team_id is not null
    and status::text <> 'PENDING'
    and opened_at is not null
    and private.mvp_player_is_eligible((select auth.uid()), id)
  )
  or exists (
    select 1
    from public.mvp_vote_submissions sub
    where sub.session_id = mvp_voting_sessions.id
      and sub.voter_profile_id = (select auth.uid())
  )
);

-- Submission markers expose completion and shoutouts, never ballot choices.
create policy "Own or scoped MVP submission read"
on public.mvp_vote_submissions
for select
to authenticated
using (
  voter_profile_id = (select auth.uid())
  or private.mvp_can_audit_session((select auth.uid()), session_id)
);

-- Raw 3/2/1 ballot lines are private to the voter and to scoped association or
-- super-admin audit. Coaches, team managers and club admins cannot read them.
create policy "Own MVP ballot read"
on public.mvp_votes
for select
to authenticated
using (voter_profile_id = (select auth.uid()));

create policy "Association scoped raw MVP ballot audit"
on public.mvp_votes
for select
to authenticated
using (private.mvp_can_raw_audit_session((select auth.uid()), session_id));

-- A player can read their own immutable check. Scoped managers can review the
-- reporters and comments for sessions they manage.
create policy "Own MVP result check read"
on public.mvp_result_checks
for select
to authenticated
using (voter_profile_id = (select auth.uid()));

create policy "Scoped MVP result concern review"
on public.mvp_result_checks
for select
to authenticated
using (private.mvp_can_audit_session((select auth.uid()), session_id));

-- Audit and delivery logs can contain sensitive voter/delivery information.
create policy "Association scoped MVP audit read"
on public.mvp_vote_audit
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role::text = 'SUPER_ADMIN'
  )
  or (
    session_id is not null
    and private.mvp_can_raw_audit_session((select auth.uid()), session_id)
  )
  or (
    team_id is not null
    and exists (
      select 1
      from public.teams t
      join public.clubs c on c.id = t.club_id
      join public.user_roles ur
        on ur.user_id = (select auth.uid())
       and ur.role::text = 'ASSOCIATION_ADMIN'
       and ur.association_id = c.association_id
      where t.id = mvp_vote_audit.team_id
    )
  )
);

create policy "Association scoped MVP email event read"
on public.mvp_voting_email_events
for select
to authenticated
using (private.mvp_can_raw_audit_session((select auth.uid()), session_id));

-- Explicit Data API privileges. Direct vote, submission, check, lifecycle and
-- audit writes are revoked; the SECURITY DEFINER commands perform all checks.
revoke all on public.mvp_voting_sessions from public, anon, authenticated;
revoke all on public.mvp_vote_submissions from public, anon, authenticated;
revoke all on public.mvp_votes from public, anon, authenticated;
revoke all on public.mvp_result_checks from public, anon, authenticated;
revoke all on public.mvp_vote_audit from public, anon, authenticated;
revoke all on public.mvp_voting_email_events from public, anon, authenticated;

grant select on public.mvp_voting_sessions to authenticated;
grant select on public.mvp_vote_submissions to authenticated;
grant select on public.mvp_votes to authenticated;
grant select on public.mvp_result_checks to authenticated;
grant select on public.mvp_vote_audit to authenticated;
grant select on public.mvp_voting_email_events to authenticated;

grant all on public.mvp_voting_sessions to service_role;
grant all on public.mvp_vote_submissions to service_role;
grant all on public.mvp_votes to service_role;
grant all on public.mvp_result_checks to service_role;
grant all on public.mvp_vote_audit to service_role;
grant all on public.mvp_voting_email_events to service_role;

-- Retire all public/private-link token table access without deleting any token
-- or token-era vote history. Cope with the known legacy table-name variants.
do $migration$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'mvp_vote_tokens',
    'mvp_voting_tokens',
    'mvp_tokens'
  ]
  loop
    if pg_catalog.to_regclass('public.' || v_table) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', v_table);

    for v_policy in
      select p.policyname
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = v_table
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        v_policy.policyname,
        v_table
      );
    end loop;

    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      v_table
    );
    execute format('grant all on table public.%I to service_role', v_table);
  end loop;
end
$migration$;

-- Keep only the approved authenticated RPC surface. Trigger helpers and all
-- default PUBLIC execution are explicitly revoked.
revoke all on function public.create_mvp_session_for_fixture() from public, anon, authenticated;

revoke all on function public.set_team_mvp_enabled(uuid, boolean) from public, anon;
revoke all on function public.open_mvp_voting_session(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.close_mvp_voting_session(uuid) from public, anon;
revoke all on function public.reopen_mvp_voting_session(uuid, timestamptz) from public, anon;
revoke all on function public.record_mvp_result_check(uuid, text, text) from public, anon;
revoke all on function public.resolve_mvp_result_dispute(uuid, timestamptz) from public, anon;
revoke all on function public.submit_mvp_ballot(uuid, uuid, uuid, uuid, text) from public, anon;
revoke all on function public.request_mvp_session_reopen(uuid) from public, anon;
revoke all on function public.withdraw_mvp_submission(uuid, uuid, text) from public, anon;
revoke all on function public.get_mvp_result_check_state(uuid) from public, anon;
revoke all on function public.get_mvp_session_results(uuid) from public, anon;
revoke all on function public.close_legacy_mvp_sessions_for_cutover(text) from public, anon;

grant execute on function public.set_team_mvp_enabled(uuid, boolean) to authenticated;
grant execute on function public.open_mvp_voting_session(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.close_mvp_voting_session(uuid) to authenticated;
grant execute on function public.reopen_mvp_voting_session(uuid, timestamptz) to authenticated;
grant execute on function public.record_mvp_result_check(uuid, text, text) to authenticated;
grant execute on function public.resolve_mvp_result_dispute(uuid, timestamptz) to authenticated;
grant execute on function public.submit_mvp_ballot(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.request_mvp_session_reopen(uuid) to authenticated;
grant execute on function public.withdraw_mvp_submission(uuid, uuid, text) to authenticated;
grant execute on function public.get_mvp_result_check_state(uuid) to authenticated;
grant execute on function public.get_mvp_session_results(uuid) to authenticated;
grant execute on function public.close_legacy_mvp_sessions_for_cutover(text) to authenticated;

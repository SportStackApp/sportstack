-- Allow logged-in MVP voters to submit votes for sessions reopened by admins.
-- The app treats mvp_voting_sessions.status = 'OPEN' as the source of truth;
-- closes_at can be stale for reopened historical rounds.

drop policy if exists "Voter can submit own votes" on public.mvp_votes;

create policy "Voter can submit own votes"
on public.mvp_votes
for insert
to authenticated
with check (
  voter_profile_id = (select auth.uid())
  and exists (
    select 1
    from public.mvp_voting_sessions s
    where s.id = mvp_votes.session_id
      and s.status = 'OPEN'::public.mvp_session_status
  )
);

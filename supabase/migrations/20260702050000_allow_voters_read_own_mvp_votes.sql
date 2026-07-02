-- Allow voters to review only their own MVP vote rows.
-- Admin vote privacy remains handled by the existing Super/Association admin policy.

drop policy if exists "Voter can read own votes" on public.mvp_votes;

create policy "Voter can read own votes"
on public.mvp_votes
for select
to authenticated
using (
  voter_profile_id = (select auth.uid())
);

-- Keep each panel member's vote private until the majority is finalised.
drop policy if exists discipline_review_panel_votes_select
on public.discipline_review_panel_votes;

create policy discipline_review_panel_votes_select
on public.discipline_review_panel_votes
for select to authenticated
using (
  submitted_by = (select auth.uid())
  or exists (
    select 1
    from public.discipline_review_panels panel
    where panel.id = discipline_review_panel_votes.panel_id
      and panel.status = 'COMPLETE'
  )
);

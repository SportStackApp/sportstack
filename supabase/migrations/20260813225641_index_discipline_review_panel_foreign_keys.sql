-- Cover review-panel foreign keys used by role checks, audit lookups and safe parent updates.
create index discipline_review_panels_created_by_idx
  on public.discipline_review_panels (created_by);
create index discipline_review_panels_updated_by_idx
  on public.discipline_review_panels (updated_by);

create index discipline_review_panel_members_profile_idx
  on public.discipline_review_panel_members (profile_id)
  where profile_id is not null;
create index discipline_review_panel_members_created_by_idx
  on public.discipline_review_panel_members (created_by);
create index discipline_review_panel_members_updated_by_idx
  on public.discipline_review_panel_members (updated_by);

create index discipline_review_panel_votes_panel_idx
  on public.discipline_review_panel_votes (panel_id);
create index discipline_review_panel_votes_submitted_by_idx
  on public.discipline_review_panel_votes (submitted_by);
create index discipline_review_panel_votes_supersedes_idx
  on public.discipline_review_panel_votes (supersedes_vote_id)
  where supersedes_vote_id is not null;

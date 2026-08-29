-- Cover Player MVP tally presentation foreign keys reported by the Dev performance advisor.
create index if not exists mvp_tally_presentations_created_by_idx
  on public.mvp_tally_presentations(created_by);
create index if not exists mvp_tally_presentations_updated_by_idx
  on public.mvp_tally_presentations(updated_by);
create index if not exists mvp_tally_presentations_published_by_idx
  on public.mvp_tally_presentations(published_by)
  where published_by is not null;
create index if not exists mvp_tally_presentations_withdrawn_by_idx
  on public.mvp_tally_presentations(withdrawn_by)
  where withdrawn_by is not null;
create index if not exists mvp_tally_presentations_replaces_idx
  on public.mvp_tally_presentations(replaces_presentation_id)
  where replaces_presentation_id is not null;

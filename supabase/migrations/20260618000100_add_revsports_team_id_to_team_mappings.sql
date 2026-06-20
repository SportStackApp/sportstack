alter table public.revsports_team_mappings
  add column if not exists revsports_team_id text;

create index if not exists revsports_team_mappings_revsports_team_id_idx
  on public.revsports_team_mappings (revsports_team_id)
  where revsports_team_id is not null and btrim(revsports_team_id) <> '';

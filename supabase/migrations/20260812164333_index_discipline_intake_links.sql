-- Cover the optional intake links and tag-assignment audit links added by the
-- preceding migration. Partial indexes stay compact while most links are null.

create index if not exists discipline_cases_competition_id_idx
  on public.discipline_cases (competition_id) where competition_id is not null;
create index if not exists discipline_cases_division_id_idx
  on public.discipline_cases (division_id) where division_id is not null;
create index if not exists discipline_cases_home_team_id_idx
  on public.discipline_cases (home_team_id) where home_team_id is not null;
create index if not exists discipline_cases_away_team_id_idx
  on public.discipline_cases (away_team_id) where away_team_id is not null;
create index if not exists discipline_cases_venue_id_idx
  on public.discipline_cases (venue_id) where venue_id is not null;
create index if not exists discipline_case_people_profile_id_idx
  on public.discipline_case_people (profile_id) where profile_id is not null;
create index if not exists discipline_case_people_club_id_idx
  on public.discipline_case_people (club_id) where club_id is not null;
create index if not exists discipline_case_tags_assigned_by_idx
  on public.discipline_case_tags (assigned_by) where assigned_by is not null;
create index if not exists discipline_allegation_tags_assigned_by_idx
  on public.discipline_allegation_tags (assigned_by) where assigned_by is not null;

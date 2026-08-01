-- Store the official Umpire Match Voting scheme with the division so the
-- ballot cannot choose a different scheme from the configured competition.
alter table public.divisions
  add column if not exists umpire_vote_scheme_key text not null default 'classic_3_2_1';

-- The Dev dry-run found 12 explicitly junior divisions. Preserve the existing
-- inferred junior behaviour when moving the setting into the division record.
update public.divisions
set umpire_vote_scheme_key = 'junior_2_1_split'
where lower(coalesce(age_group, '')) = 'juniors'
  and umpire_vote_scheme_key = 'classic_3_2_1';

alter table public.divisions
  drop constraint if exists divisions_umpire_vote_scheme_key_check;

alter table public.divisions
  add constraint divisions_umpire_vote_scheme_key_check
  check (umpire_vote_scheme_key in ('classic_3_2_1', 'junior_2_1_split'));

comment on column public.divisions.umpire_vote_scheme_key is
  'Official vote scheme used by Umpire Match Voting ballots for this division.';

alter table public.teams
  add column if not exists logo_url text;

comment on column public.teams.logo_url is
  'Optional team-specific logo URL used in scoreboards and team displays.';

update public.teams t
set logo_url = c.logo_url
from public.clubs c
where t.club_id = c.id
  and t.logo_url is null
  and c.logo_url is not null
  and btrim(c.logo_url) <> '';

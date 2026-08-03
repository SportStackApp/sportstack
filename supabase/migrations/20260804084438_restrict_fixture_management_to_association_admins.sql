-- Limit fixture mutations to the active Super Admin mode or the selected
-- Association Admin scope. Club and team roles retain authenticated read access.

drop policy if exists fixtures_write on public.fixtures;

create policy fixtures_write
on public.fixtures
for all
to authenticated
using (
  public.administration_scope_allows('super_admin', null, null, null)
  or (
    (home_team_id is not null or away_team_id is not null)
    and (
      home_team_id is null
      or exists (
        select 1
        from public.teams home_team
        join public.clubs home_club on home_club.id = home_team.club_id
        where home_team.id = fixtures.home_team_id
          and public.administration_scope_allows(
            'association',
            home_club.association_id,
            null,
            null
          )
      )
    )
    and (
      away_team_id is null
      or exists (
        select 1
        from public.teams away_team
        join public.clubs away_club on away_club.id = away_team.club_id
        where away_team.id = fixtures.away_team_id
          and public.administration_scope_allows(
            'association',
            away_club.association_id,
            null,
            null
          )
      )
    )
  )
)
with check (
  public.administration_scope_allows('super_admin', null, null, null)
  or (
    (home_team_id is not null or away_team_id is not null)
    and (
      home_team_id is null
      or exists (
        select 1
        from public.teams home_team
        join public.clubs home_club on home_club.id = home_team.club_id
        where home_team.id = fixtures.home_team_id
          and public.administration_scope_allows(
            'association',
            home_club.association_id,
            null,
            null
          )
      )
    )
    and (
      away_team_id is null
      or exists (
        select 1
        from public.teams away_team
        join public.clubs away_club on away_club.id = away_team.club_id
        where away_team.id = fixtures.away_team_id
          and public.administration_scope_allows(
            'association',
            away_club.association_id,
            null,
            null
          )
      )
    )
  )
);

comment on policy fixtures_write on public.fixtures is
  'Only the active Super Admin mode or the selected Association Admin scope may mutate fixtures.';

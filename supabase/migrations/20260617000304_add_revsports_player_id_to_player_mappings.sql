alter table public.revsports_player_mappings
  add column if not exists revsports_player_id text;

create index if not exists revsports_player_mappings_revsports_player_id_idx
  on public.revsports_player_mappings (revsports_player_id)
  where revsports_player_id is not null and btrim(revsports_player_id) <> '';

with protected_players(full_name, revsports_player_id) as (
  values
    ('Aaron Mullane', 'qzrbDcZ'),
    ('Ben Sturmfels', 'UMP-ben-sturmfels'),
    ('Bonnie Arnel', '7DM2qi8'),
    ('Chris Provis-Vincent', 'zaaPLhB'),
    ('Craig Stevens', 'UMP-craig-stevens'),
    ('Daniel Ryan', '8kJ3nsD'),
    ('Ethan Oldaker', 'kRnWMSR'),
    ('Fraser Cullen', 'OBzjqt9'),
    ('Garry Baker', 'DDvveuk'),
    ('Glen Cosgriff', '3DkXkTw'),
    ('Hayden Bourne', '9wKAgHX'),
    ('Hugh Cullen', 'Dj9PWuk'),
    ('I Edgar', 'UMP-i-edgar'),
    ('Jason Hargreaves', 'j9AXluN'),
    ('Jeff Sly', 'UMP-jeff-sly'),
    ('Jordan Clark', 'L3ELeFn'),
    ('Joshua Sly', 'Vleg8fw'),
    ('Lachlan Stevens', 'zwYaxhB'),
    ('Liam Cosgriff', 'ykVvnf1'),
    ('Luke Rudolph', 'zwaqECB'),
    ('Mitchell Stevens', 'L3ZNVun'),
    ('Nicholas Hargreaves', '1wOWai2'),
    ('Noah Andrew', 'kZRVgcR'),
    ('Sara Weuffen-Humphrey', '0PAbJt3'),
    ('Shepherd J', 'qlkQMtZ'),
    ('Thomas Batchelor', 'Vwe6gFw'),
    ('Traiyth Leffler', 'K73Erhm'),
    ('Tucker Kooloos', 'rJlKkcg')
),
matched_profiles as (
  select
    pp.full_name,
    pp.revsports_player_id,
    p.id as profile_id
  from protected_players pp
  join public.profiles p
    on lower(btrim(concat_ws(' ', p.first_name, p.last_name))) = lower(pp.full_name)
)
update public.revsports_player_mappings rpm
set
  revsports_player_id = mp.revsports_player_id,
  profile_id = mp.profile_id,
  updated_at = now()
from matched_profiles mp
where rpm.profile_id = mp.profile_id;

with protected_players(full_name, revsports_player_id) as (
  values
    ('Aaron Mullane', 'qzrbDcZ'),
    ('Ben Sturmfels', 'UMP-ben-sturmfels'),
    ('Bonnie Arnel', '7DM2qi8'),
    ('Chris Provis-Vincent', 'zaaPLhB'),
    ('Craig Stevens', 'UMP-craig-stevens'),
    ('Daniel Ryan', '8kJ3nsD'),
    ('Ethan Oldaker', 'kRnWMSR'),
    ('Fraser Cullen', 'OBzjqt9'),
    ('Garry Baker', 'DDvveuk'),
    ('Glen Cosgriff', '3DkXkTw'),
    ('Hayden Bourne', '9wKAgHX'),
    ('Hugh Cullen', 'Dj9PWuk'),
    ('I Edgar', 'UMP-i-edgar'),
    ('Jason Hargreaves', 'j9AXluN'),
    ('Jeff Sly', 'UMP-jeff-sly'),
    ('Jordan Clark', 'L3ELeFn'),
    ('Joshua Sly', 'Vleg8fw'),
    ('Lachlan Stevens', 'zwYaxhB'),
    ('Liam Cosgriff', 'ykVvnf1'),
    ('Luke Rudolph', 'zwaqECB'),
    ('Mitchell Stevens', 'L3ZNVun'),
    ('Nicholas Hargreaves', '1wOWai2'),
    ('Noah Andrew', 'kZRVgcR'),
    ('Sara Weuffen-Humphrey', '0PAbJt3'),
    ('Shepherd J', 'qlkQMtZ'),
    ('Thomas Batchelor', 'Vwe6gFw'),
    ('Traiyth Leffler', 'K73Erhm'),
    ('Tucker Kooloos', 'rJlKkcg')
),
matched_profiles as (
  select
    pp.full_name,
    pp.revsports_player_id,
    p.id as profile_id
  from protected_players pp
  join public.profiles p
    on lower(btrim(concat_ws(' ', p.first_name, p.last_name))) = lower(pp.full_name)
)
insert into public.revsports_player_mappings (
  revsports_player_name,
  grade,
  team,
  club_name,
  jersey,
  is_fillin,
  profile_id,
  revsports_player_id,
  created_at,
  updated_at
)
select
  mp.full_name,
  '',
  '',
  null,
  null,
  false,
  mp.profile_id,
  mp.revsports_player_id,
  now(),
  now()
from matched_profiles mp
where not exists (
  select 1
  from public.revsports_player_mappings rpm
  where rpm.profile_id = mp.profile_id
     or rpm.revsports_player_id = mp.revsports_player_id
);

update public.revsports_player_registry rpr
set profile_id = rpm.profile_id
from (
  select revsports_player_id, min(profile_id::text)::uuid as profile_id
  from public.revsports_player_mappings
  where revsports_player_id is not null
    and btrim(revsports_player_id) <> ''
    and profile_id is not null
  group by revsports_player_id
) rpm
where rpr.revsports_player_id = rpm.revsports_player_id
  and rpr.profile_id is distinct from rpm.profile_id;

update public.revsports_players rp
set profile_id = rpm.profile_id
from (
  select revsports_player_id, min(profile_id::text)::uuid as profile_id
  from public.revsports_player_mappings
  where revsports_player_id is not null
    and btrim(revsports_player_id) <> ''
    and profile_id is not null
  group by revsports_player_id
) rpm
where rp.revsports_player_id = rpm.revsports_player_id
  and rp.profile_id is distinct from rpm.profile_id;

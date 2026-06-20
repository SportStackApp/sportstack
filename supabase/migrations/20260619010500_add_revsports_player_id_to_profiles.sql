alter table public.profiles
add column if not exists revsports_player_id text;

create unique index if not exists profiles_revsports_player_id_key
on public.profiles (revsports_player_id)
where revsports_player_id is not null and btrim(revsports_player_id) <> '';

update public.profiles p
set revsports_player_id = ee.external_id
from public.external_entity_links eel
join public.external_entities ee on ee.id = eel.external_entity_id
where eel.target_table = 'profiles'
  and eel.status = 'matched'
  and eel.target_id = p.id
  and ee.source = 'revsports'
  and ee.entity_type = 'player'
  and ee.external_id is not null
  and btrim(ee.external_id) <> ''
  and (p.revsports_player_id is null or btrim(p.revsports_player_id) = '');

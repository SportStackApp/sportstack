-- Transactional regression coverage for private Player MVP tally presentations.
-- All synthetic records roll back.
begin;

do $test$
declare
  v_manager constant uuid := 'f1000000-0000-0000-0000-000000000001';
  v_recipient constant uuid := 'f1000000-0000-0000-0000-000000000002';
  v_outsider constant uuid := 'f1000000-0000-0000-0000-000000000003';
  v_association constant uuid := 'f2000000-0000-0000-0000-000000000001';
  v_club constant uuid := 'f3000000-0000-0000-0000-000000000001';
  v_team constant uuid := 'f4000000-0000-0000-0000-000000000001';
  v_session constant uuid := 'f5000000-0000-0000-0000-000000000001';
  v_open_session constant uuid := 'f5000000-0000-0000-0000-000000000002';
  v_submission constant uuid := 'f6000000-0000-0000-0000-000000000001';
  v_player_one constant uuid := 'f7000000-0000-0000-0000-000000000001';
  v_player_two constant uuid := 'f7000000-0000-0000-0000-000000000002';
  v_player_three constant uuid := 'f7000000-0000-0000-0000-000000000003';
  v_presentation uuid;
  v_replacement uuid;
  v_preview jsonb;
  v_original_points integer;
  v_failed boolean := false;
begin
  insert into auth.users(id, email) values
    (v_manager, 'tally-manager@example.invalid'),
    (v_recipient, 'tally-recipient@example.invalid'),
    (v_outsider, 'tally-outsider@example.invalid');
  update public.profiles
  set first_name = 'Tally',
    last_name = case id when v_manager then 'Manager' when v_recipient then 'Recipient' else 'Outsider' end
  where id in (v_manager, v_recipient, v_outsider);
  insert into public.associations(id, name) values (v_association, 'Tally Test Association');
  insert into public.clubs(id, association_id, name) values (v_club, v_association, 'Tally Test Club');
  insert into public.teams(id, club_id, name, mvp_notifications_enabled)
    values (v_team, v_club, 'Tally Test Team', true);
  insert into public.user_roles(user_id, role, team_id)
    values (v_manager, 'TEAM_MANAGER', v_team);
  insert into public.team_memberships(user_id, team_id, membership_type, status)
    values (v_recipient, v_team, 'PRIMARY', 'ACTIVE');

  insert into public.mvp_voting_sessions(id, team_id, grade, round, game_date, home_team, away_team, status)
  values
    (v_session, v_team, 'Test Grade', 'Round 1', current_date, 'Tally Test Team', 'Visitors', 'CLOSED'),
    (v_open_session, v_team, 'Test Grade', 'Round 2', current_date, 'Tally Test Team', 'Visitors', 'OPEN');
  insert into public.revsports_players(id, match_url, player_name, profile_id, attended, appearance_key)
  values
    (v_player_one, 'https://example.invalid/tally-test', 'Alex Test', v_recipient, true, 'tally-test-1'),
    (v_player_two, 'https://example.invalid/tally-test', 'Bailey Test', null, true, 'tally-test-2'),
    (v_player_three, 'https://example.invalid/tally-test', 'Casey Test', null, true, 'tally-test-3');
  insert into public.mvp_vote_submissions(id, session_id, voter_profile_id)
    values (v_submission, v_session, v_manager);
  insert into public.mvp_votes(session_id, player_id, points, voter_profile_id)
  values
    (v_session, v_player_one, 3, v_manager),
    (v_session, v_player_two, 2, v_manager),
    (v_session, v_player_three, 1, v_manager);

  select sum(points) into v_original_points from public.mvp_votes where session_id = v_session;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_manager, 'role', 'authenticated')::text, true);

  v_presentation := public.save_mvp_tally_draft(
    null, v_team, 'Transactional tally test', null,
    jsonb_build_object('backgroundStyle','SPOTLIGHT','primaryColour','#6D28D9',
      'secondaryColour','#1E1B4B','accentColour','#F5C84C','logoUrl',null,'bannerUrl',null),
    1, array[v_session],
    jsonb_build_array(jsonb_build_object('profileId', v_recipient, 'group', 'PRIMARY')),
    null
  );
  v_preview := public.preview_mvp_tally(v_presentation);

  if v_preview::text ~* 'voter|submission|token' then
    raise exception 'Anonymous tally snapshot exposes ballot identity fields';
  end if;
  if v_preview #>> '{cards,rounds,0,cards,0,points}' <> '3'
     or v_preview #>> '{cards,rounds,0,cards,1,points}' <> '2'
     or v_preview #>> '{cards,rounds,0,cards,2,points}' <> '1' then
    raise exception 'Anonymous ballot was not revealed in 3-2-1 order';
  end if;

  update public.mvp_votes set updated_at = now() + interval '1 second'
  where session_id = v_session and player_id = v_player_one;
  begin
    perform public.publish_mvp_tally(v_presentation, null);
  exception when sqlstate 'P0001' then
    v_failed := sqlerrm = 'MVP_TALLY_PREVIEW_STALE';
  end;
  if not v_failed then raise exception 'Source change did not invalidate preview'; end if;

  perform public.preview_mvp_tally(v_presentation);
  if public.publish_mvp_tally(v_presentation, null) <> 'PUBLISHED' then
    raise exception 'Immediate publication failed';
  end if;
  perform private.mvp_tally_publish_now(v_presentation, v_manager);

  if (select count(*) from public.notifications where dedupe_key = 'mvp-tally:' || v_presentation || ':' || v_recipient) <> 1 then
    raise exception 'In-app publication notification was not deduplicated';
  end if;
  if (select email_status from public.mvp_tally_recipients where presentation_id = v_presentation and profile_id = v_recipient) <> 'QUEUED' then
    raise exception 'Player MVP result email was not queued';
  end if;
  if (select sum(points) from public.mvp_votes where session_id = v_session) <> v_original_points then
    raise exception 'Source Player MVP votes were modified';
  end if;

  perform public.withdraw_mvp_tally(v_presentation, 'Replacement required for test');
  v_replacement := public.save_mvp_tally_draft(
    null, v_team, 'Replacement tally test', null,
    jsonb_build_object('backgroundStyle','SOLID','primaryColour','#6D28D9',
      'secondaryColour','#1E1B4B','accentColour','#F5C84C','logoUrl',null,'bannerUrl',null),
    1, array[v_session],
    jsonb_build_array(jsonb_build_object('profileId', v_recipient, 'group', 'PRIMARY')),
    v_presentation
  );
  if (select replaces_presentation_id from public.mvp_tally_presentations where id = v_replacement) <> v_presentation then
    raise exception 'Replacement presentation was not linked';
  end if;
  perform public.preview_mvp_tally(v_replacement);
  if public.publish_mvp_tally(v_replacement, now() + interval '5 minutes') <> 'SCHEDULED' then
    raise exception 'Scheduled publication was not accepted';
  end if;
  update public.mvp_tally_presentations set scheduled_for = now() - interval '1 minute'
  where id = v_replacement;
  perform private.publish_due_mvp_tallies();
  if (select status from public.mvp_tally_presentations where id = v_replacement) <> 'PUBLISHED' then
    raise exception 'Due scheduled publication was not published';
  end if;

  v_failed := false;
  begin
    perform public.save_mvp_tally_draft(
      null, v_team, 'Open round must fail', null, '{}'::jsonb, 1,
      array[v_open_session],
      jsonb_build_array(jsonb_build_object('profileId', v_recipient, 'group', 'PRIMARY')),
      null
    );
  exception when sqlstate 'P0001' then
    v_failed := sqlerrm = 'MVP_TALLY_ROUNDS_CHANGED';
  end;
  if not v_failed then raise exception 'Open session was accepted'; end if;

  v_failed := false;
  begin
    perform public.save_mvp_tally_draft(
      null, v_team, 'Ineligible audience must fail', null, '{}'::jsonb, 1,
      array[v_session],
      jsonb_build_array(jsonb_build_object('profileId', v_outsider, 'group', 'PRIMARY')),
      null
    );
  exception when sqlstate 'P0001' then
    v_failed := sqlerrm = 'MVP_TALLY_AUDIENCE_CHANGED';
  end;
  if not v_failed then raise exception 'Ineligible audience was accepted'; end if;
end
$test$;

-- Recipient can read the published row before withdrawal is tested in the block above.
-- Recreate one fixed published row to exercise recipient-only RLS without calling lifecycle RPCs.
insert into public.mvp_tally_presentations(
  id, team_id, title, status, theme, card_snapshot, result_snapshot, source_fingerprint,
  previewed_at, published_at, created_by, updated_by
) values (
  'f8000000-0000-0000-0000-000000000001',
  'f4000000-0000-0000-0000-000000000001',
  'RLS tally test', 'PUBLISHED', '{}'::jsonb,
  '{"version":1,"rounds":[]}'::jsonb, '[]'::jsonb, 'test', now(), now(),
  'f1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001'
);
insert into public.mvp_tally_recipients(presentation_id, profile_id, audience_group)
values ('f8000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002', 'PRIMARY');

select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
do $recipient_rls$
begin
  if (select count(*) from public.mvp_tally_presentations where id = 'f8000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'Selected recipient cannot read published tally';
  end if;
end
$recipient_rls$;
reset role;

select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
do $outsider_rls$
begin
  if (select count(*) from public.mvp_tally_presentations where id = 'f8000000-0000-0000-0000-000000000001') <> 0 then
    raise exception 'Unrelated player can read a private tally';
  end if;
end
$outsider_rls$;
reset role;

do $security$
declare
  v_table text;
  v_function text;
begin
  foreach v_table in array array['mvp_tally_presentations','mvp_tally_sessions','mvp_tally_recipients'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || v_table)::regclass) then
      raise exception 'RLS is disabled on %', v_table;
    end if;
    if has_table_privilege('anon', 'public.' || v_table, 'SELECT') then
      raise exception 'Anonymous SELECT remains on %', v_table;
    end if;
    if has_table_privilege('authenticated', 'public.' || v_table, 'INSERT')
       or has_table_privilege('authenticated', 'public.' || v_table, 'UPDATE')
       or has_table_privilege('authenticated', 'public.' || v_table, 'DELETE') then
      raise exception 'Direct authenticated lifecycle write remains on %', v_table;
    end if;
  end loop;

  foreach v_function in array array[
    'public.save_mvp_tally_draft(uuid,uuid,text,text,jsonb,numeric,uuid[],jsonb,uuid)',
    'public.preview_mvp_tally(uuid)',
    'public.publish_mvp_tally(uuid,timestamp with time zone)',
    'public.withdraw_mvp_tally(uuid,text)'
  ] loop
    if has_function_privilege('anon', v_function, 'EXECUTE') then
      raise exception 'Anonymous EXECUTE remains on %', v_function;
    end if;
    if not has_function_privilege('authenticated', v_function, 'EXECUTE') then
      raise exception 'Authenticated EXECUTE missing on %', v_function;
    end if;
  end loop;
end
$security$;

rollback;

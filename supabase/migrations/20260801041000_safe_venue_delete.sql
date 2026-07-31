-- Delete an unused venue in one transaction. Historical fixture, umpire and
-- RevSports mapping links must be reassigned first so ON DELETE SET NULL does
-- not silently remove useful data-quality context.

create or replace function public.delete_unused_venue(p_venue_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_venue_name text;
  v_primary_association_id uuid;
  v_pitch_count integer;
  v_team_count integer;
  v_fixture_count integer;
  v_umpire_fixture_count integer;
  v_mapping_count integer;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to delete a venue.';
  end if;

  select venue.name, venue.association_id
  into v_venue_name, v_primary_association_id
  from public.venues venue
  where venue.id = p_venue_id
  for update;

  if not found then
    raise exception 'The venue was not found.';
  end if;

  if not exists (
    select 1
    from public.user_roles role_row
    where role_row.user_id = v_actor_id
      and (
        role_row.role::text = 'SUPER_ADMIN'
        or (
          role_row.role::text = 'ASSOCIATION_ADMIN'
          and (
            role_row.association_id = v_primary_association_id
            or exists (
              select 1
              from public.venue_associations venue_link
              where venue_link.venue_id = p_venue_id
                and venue_link.association_id = role_row.association_id
            )
          )
        )
      )
  ) then
    raise exception 'You do not have permission to delete this venue.';
  end if;

  select count(*) into v_pitch_count
  from public.pitches pitch
  where pitch.venue_id = p_venue_id;

  select count(*) into v_team_count
  from public.teams team
  where team.home_venue_id = p_venue_id;

  select count(*) into v_fixture_count
  from public.fixtures fixture
  where fixture.venue_id = p_venue_id
    or exists (
      select 1
      from public.pitches pitch
      where pitch.venue_id = p_venue_id
        and pitch.id = fixture.pitch_id
    );

  select count(*) into v_umpire_fixture_count
  from public.umpire_fixtures fixture
  where fixture.venue_id = p_venue_id
    or exists (
      select 1
      from public.pitches pitch
      where pitch.venue_id = p_venue_id
        and pitch.id = fixture.pitch_id
    );

  select
    (select count(*) from public.revsports_venue_mappings mapping where mapping.venue_id = p_venue_id)
    +
    (
      select count(*)
      from public.revsports_pitch_mappings mapping
      where exists (
        select 1
        from public.pitches pitch
        where pitch.venue_id = p_venue_id
          and pitch.id = mapping.pitch_id
      )
    )
  into v_mapping_count;

  if v_fixture_count > 0 or v_umpire_fixture_count > 0 or v_mapping_count > 0 then
    raise exception 'This venue is still linked to % fixtures, % umpire fixtures and % RevSports mappings. Reassign those links before deleting it.',
      v_fixture_count,
      v_umpire_fixture_count,
      v_mapping_count;
  end if;

  delete from public.venues venue
  where venue.id = p_venue_id;

  return jsonb_build_object(
    'venue_id', p_venue_id,
    'venue_name', v_venue_name,
    'deleted_pitches', v_pitch_count,
    'cleared_home_teams', v_team_count
  );
end;
$function$;

revoke all on function public.delete_unused_venue(uuid)
  from public, anon;
grant execute on function public.delete_unused_venue(uuid)
  to authenticated;

comment on function public.delete_unused_venue(uuid) is
  'Deletes an unused scoped venue without silently clearing fixture or RevSports mapping links.';

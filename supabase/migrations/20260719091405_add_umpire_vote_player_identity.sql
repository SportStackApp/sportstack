-- Link Umpire Match Voting lines to current SportStack identities and force
-- review changes through one audited transaction.

alter table public.player_vote_lines
  add column if not exists profile_id uuid
  references public.profiles(id)
  on delete set null;

create index if not exists player_vote_lines_profile_id_idx
  on public.player_vote_lines (profile_id);

comment on column public.player_vote_lines.profile_id is
  'Confirmed SportStack profile for this historical or current Umpire Match Voting line.';

-- Scoped admins need read access to review submissions, but all writes below
-- are deliberately routed through review_umpire_vote_submission().
drop policy if exists "Admins can view all submissions"
  on public.player_vote_submissions;
drop policy if exists "Admins can update submissions"
  on public.player_vote_submissions;

create policy "Scoped admins can view umpire match submissions"
on public.player_vote_submissions
for select
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.user_roles ur
    left join public.fixtures fixture
      on fixture.id = player_vote_submissions.fixture_id
    left join public.teams home_team
      on home_team.id = coalesce(
        player_vote_submissions.home_team_id,
        fixture.home_team_id
      )
    left join public.clubs home_club
      on home_club.id = home_team.club_id
    left join public.teams away_team
      on away_team.id = coalesce(
        player_vote_submissions.away_team_id,
        fixture.away_team_id
      )
    left join public.clubs away_club
      on away_club.id = away_team.club_id
    where ur.user_id = (select auth.uid())
      and (
        (
          ur.role::text = 'ASSOCIATION_ADMIN'
          and ur.association_id = coalesce(
            player_vote_submissions.association_id,
            home_club.association_id,
            away_club.association_id
          )
        )
        or (
          ur.role::text = 'CLUB_ADMIN'
          and ur.club_id in (home_team.club_id, away_team.club_id)
        )
      )
  )
);

drop policy if exists "Admins can view all vote lines"
  on public.player_vote_lines;
drop policy if exists "Admins can manage vote lines"
  on public.player_vote_lines;

create policy "Scoped admins can view umpire match vote lines"
on public.player_vote_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.player_vote_submissions submission
    left join public.fixtures fixture
      on fixture.id = submission.fixture_id
    left join public.teams home_team
      on home_team.id = coalesce(submission.home_team_id, fixture.home_team_id)
    left join public.clubs home_club
      on home_club.id = home_team.club_id
    left join public.teams away_team
      on away_team.id = coalesce(submission.away_team_id, fixture.away_team_id)
    left join public.clubs away_club
      on away_club.id = away_team.club_id
    where submission.id = player_vote_lines.submission_id
      and (
        public.is_super_admin()
        or exists (
          select 1
          from public.user_roles ur
          where ur.user_id = (select auth.uid())
            and (
              (
                ur.role::text = 'ASSOCIATION_ADMIN'
                and ur.association_id = coalesce(
                  submission.association_id,
                  home_club.association_id,
                  away_club.association_id
                )
              )
              or (
                ur.role::text = 'CLUB_ADMIN'
                and ur.club_id in (home_team.club_id, away_team.club_id)
              )
            )
        )
      )
  )
);

drop policy if exists "Admins can view vote edits"
  on public.player_vote_edits;
drop policy if exists "Admins can insert vote edits"
  on public.player_vote_edits;

create policy "Scoped admins can view umpire match vote history"
on public.player_vote_edits
for select
to authenticated
using (
  exists (
    select 1
    from public.player_vote_submissions submission
    left join public.fixtures fixture
      on fixture.id = submission.fixture_id
    left join public.teams home_team
      on home_team.id = coalesce(submission.home_team_id, fixture.home_team_id)
    left join public.clubs home_club
      on home_club.id = home_team.club_id
    left join public.teams away_team
      on away_team.id = coalesce(submission.away_team_id, fixture.away_team_id)
    left join public.clubs away_club
      on away_club.id = away_team.club_id
    where submission.id = player_vote_edits.submission_id
      and (
        public.is_super_admin()
        or exists (
          select 1
          from public.user_roles ur
          where ur.user_id = (select auth.uid())
            and (
              (
                ur.role::text = 'ASSOCIATION_ADMIN'
                and ur.association_id = coalesce(
                  submission.association_id,
                  home_club.association_id,
                  away_club.association_id
                )
              )
              or (
                ur.role::text = 'CLUB_ADMIN'
                and ur.club_id in (home_team.club_id, away_team.club_id)
              )
            )
        )
      )
  )
);

create or replace function public.review_umpire_vote_submission(
  p_submission_id uuid,
  p_action text,
  p_lines jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_action text := upper(trim(coalesce(p_action, '')));
  v_submission public.player_vote_submissions%rowtype;
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_home_club_id uuid;
  v_away_club_id uuid;
  v_association_id uuid;
  v_input jsonb;
  v_line public.player_vote_lines%rowtype;
  v_line_id uuid;
  v_profile_id uuid;
  v_team_id uuid;
  v_player_number integer;
  v_player_name text;
  v_old_profile_label text;
  v_new_profile_label text;
  v_old_team_label text;
  v_new_team_label text;
  v_changed_fields integer := 0;
  v_lines jsonb;
begin
  if v_actor_id is null then
    raise exception 'You must be signed in to review an umpire submission.';
  end if;

  select submission.*
  into v_submission
  from public.player_vote_submissions submission
  where submission.id = p_submission_id
  for update;

  if not found then
    raise exception 'Umpire submission % was not found.', p_submission_id;
  end if;

  select
    coalesce(v_submission.home_team_id, fixture.home_team_id),
    coalesce(v_submission.away_team_id, fixture.away_team_id)
  into v_home_team_id, v_away_team_id
  from (select 1) seed
  left join public.fixtures fixture
    on fixture.id = v_submission.fixture_id;

  select team.club_id
  into v_home_club_id
  from public.teams team
  where team.id = v_home_team_id;

  select team.club_id
  into v_away_club_id
  from public.teams team
  where team.id = v_away_team_id;

  select coalesce(
    v_submission.association_id,
    home_club.association_id,
    away_club.association_id
  )
  into v_association_id
  from (select 1) seed
  left join public.clubs home_club
    on home_club.id = v_home_club_id
  left join public.clubs away_club
    on away_club.id = v_away_club_id;

  if not (
    public.is_super_admin()
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = v_actor_id
        and (
          (
            ur.role::text = 'ASSOCIATION_ADMIN'
            and ur.association_id = v_association_id
          )
          or (
            ur.role::text = 'CLUB_ADMIN'
            and ur.club_id in (v_home_club_id, v_away_club_id)
          )
        )
    )
  ) then
    raise exception 'You do not have access to review this umpire submission.';
  end if;

  if v_submission.is_deleted then
    raise exception 'Deleted umpire submissions cannot be changed or approved.';
  end if;

  if v_action not in ('SAVE', 'APPROVE', 'REOPEN') then
    raise exception 'Review action must be SAVE, APPROVE or REOPEN.';
  end if;

  if v_action = 'REOPEN' then
    if not v_submission.is_approved then
      raise exception 'Only an approved umpire submission can be reopened.';
    end if;

    update public.player_vote_submissions
    set
      is_approved = false,
      is_locked = false,
      updated_at = now()
    where id = p_submission_id;

    insert into public.player_vote_edits (
      submission_id,
      changed_by_id,
      field_name,
      original_value,
      new_value
    )
    values (
      p_submission_id,
      v_actor_id,
      'approval_status',
      'Approved',
      'Reopened'
    );

    v_changed_fields := 1;
  else
    if v_submission.is_approved or v_submission.is_locked then
      raise exception 'Reopen this umpire submission before editing it.';
    end if;

    if p_lines is not null and jsonb_typeof(p_lines) <> 'array' then
      raise exception 'Vote line changes must be supplied as a JSON array.';
    end if;

    if v_action = 'APPROVE'
      and coalesce(jsonb_array_length(p_lines), 0) > 0 then
      raise exception 'Save corrections before approving this umpire submission.';
    end if;

    if exists (
      select 1
      from (
        select (item ->> 'line_id')::uuid as line_id, count(*) as row_count
        from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) item
        group by (item ->> 'line_id')::uuid
      ) duplicate_lines
      where duplicate_lines.row_count > 1
    ) then
      raise exception 'A vote line was supplied more than once.';
    end if;

    for v_input in
      select value
      from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
    loop
      v_line_id := nullif(v_input ->> 'line_id', '')::uuid;

      select line.*
      into v_line
      from public.player_vote_lines line
      where line.id = v_line_id
        and line.submission_id = p_submission_id
      for update;

      if not found then
        raise exception 'Vote line % does not belong to this submission.', v_line_id;
      end if;

      v_profile_id := nullif(v_input ->> 'profile_id', '')::uuid;
      v_team_id := nullif(v_input ->> 'team_id', '')::uuid;

      if v_input ? 'player_number'
        and jsonb_typeof(v_input -> 'player_number') <> 'null'
        and trim(v_input ->> 'player_number') <> '' then
        v_player_number := (v_input ->> 'player_number')::integer;
      else
        v_player_number := null;
      end if;

      if v_team_id is not null
        and v_team_id is distinct from v_home_team_id
        and v_team_id is distinct from v_away_team_id then
        raise exception 'Vote line % must use one of the two fixture teams.', v_line_id;
      end if;

      if v_profile_id is not null then
        select
          coalesce(
            (
              select registry.player_name
              from public.revsports_player_registry registry
              where registry.revsports_player_id = profile.revsports_player_id
              order by registry.scraped_at desc nulls last, registry.id
              limit 1
            ),
            nullif(trim(concat_ws(' ', profile.first_name, profile.last_name)), '')
          )
        into v_player_name
        from public.profiles profile
        where profile.id = v_profile_id;

        if not found or v_player_name is null then
          raise exception 'Selected SportStack profile % was not found or has no name.', v_profile_id;
        end if;
      else
        v_player_name := trim(coalesce(v_input ->> 'player_name', v_line.player_name, ''));
      end if;

      if v_line.profile_id is distinct from v_profile_id then
        select coalesce(
          nullif(trim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
          v_line.profile_id::text
        )
        into v_old_profile_label
        from public.profiles profile
        where profile.id = v_line.profile_id;

        select coalesce(
          nullif(trim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
          v_profile_id::text
        )
        into v_new_profile_label
        from public.profiles profile
        where profile.id = v_profile_id;

        insert into public.player_vote_edits (
          submission_id,
          changed_by_id,
          field_name,
          original_value,
          new_value
        )
        values (
          p_submission_id,
          v_actor_id,
          'vote_line_' || v_line.id::text || '_profile_id',
          coalesce(v_old_profile_label, v_line.profile_id::text),
          coalesce(v_new_profile_label, v_profile_id::text)
        );

        v_changed_fields := v_changed_fields + 1;
      end if;

      if v_line.player_name is distinct from v_player_name then
        insert into public.player_vote_edits (
          submission_id,
          changed_by_id,
          field_name,
          original_value,
          new_value
        )
        values (
          p_submission_id,
          v_actor_id,
          'vote_line_' || v_line.id::text || '_player_name',
          v_line.player_name,
          v_player_name
        );

        v_changed_fields := v_changed_fields + 1;
      end if;

      if v_line.player_number is distinct from v_player_number then
        insert into public.player_vote_edits (
          submission_id,
          changed_by_id,
          field_name,
          original_value,
          new_value
        )
        values (
          p_submission_id,
          v_actor_id,
          'vote_line_' || v_line.id::text || '_player_number',
          v_line.player_number::text,
          v_player_number::text
        );

        v_changed_fields := v_changed_fields + 1;
      end if;

      if v_line.team_id is distinct from v_team_id then
        select concat_ws(' - ', club.name, division.name, team.name)
        into v_old_team_label
        from public.teams team
        join public.clubs club
          on club.id = team.club_id
        left join public.divisions division
          on division.id = team.division_id
        where team.id = v_line.team_id;

        select concat_ws(' - ', club.name, division.name, team.name)
        into v_new_team_label
        from public.teams team
        join public.clubs club
          on club.id = team.club_id
        left join public.divisions division
          on division.id = team.division_id
        where team.id = v_team_id;

        insert into public.player_vote_edits (
          submission_id,
          changed_by_id,
          field_name,
          original_value,
          new_value
        )
        values (
          p_submission_id,
          v_actor_id,
          'vote_line_' || v_line.id::text || '_team_id',
          coalesce(v_old_team_label, v_line.team_id::text),
          coalesce(v_new_team_label, v_team_id::text)
        );

        v_changed_fields := v_changed_fields + 1;
      end if;

      update public.player_vote_lines
      set
        profile_id = v_profile_id,
        player_name = v_player_name,
        player_number = v_player_number,
        team_id = v_team_id
      where id = v_line.id;
    end loop;

    if v_action = 'APPROVE' then
      if exists (
        select 1
        from public.player_vote_lines line
        where line.submission_id = p_submission_id
          and (
            line.profile_id is null
            or line.team_id is null
            or (
              line.team_id is distinct from v_home_team_id
              and line.team_id is distinct from v_away_team_id
            )
          )
      ) then
        raise exception 'Link every vote line to a SportStack profile and fixture team before approval.';
      end if;

      update public.player_vote_submissions
      set
        is_approved = true,
        is_locked = true,
        updated_at = now()
      where id = p_submission_id;

      insert into public.player_vote_edits (
        submission_id,
        changed_by_id,
        field_name,
        original_value,
        new_value
      )
      values (
        p_submission_id,
        v_actor_id,
        'approval_status',
        'Pending',
        'Approved'
      );

      v_changed_fields := v_changed_fields + 1;
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', line.id,
        'votes', line.votes,
        'profile_id', line.profile_id,
        'player_name', line.player_name,
        'player_number', line.player_number,
        'team_id', line.team_id
      )
      order by line.votes desc, line.created_at, line.id
    ),
    '[]'::jsonb
  )
  into v_lines
  from public.player_vote_lines line
  where line.submission_id = p_submission_id;

  return jsonb_build_object(
    'submission_id', p_submission_id,
    'action', v_action,
    'changed_fields', v_changed_fields,
    'is_approved', v_action = 'APPROVE',
    'is_locked', v_action = 'APPROVE',
    'lines', v_lines
  );
end;
$function$;

revoke execute on function public.review_umpire_vote_submission(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.review_umpire_vote_submission(uuid, text, jsonb)
  to authenticated;

-- Restricted Matrix log and Umpire Match Voting roster review queues.

create or replace function public.coordination_get_umpire_notes(p_user_id uuid,p_association_id uuid,p_actor_mode text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
begin
  if not private.coordination_permission_allowed('coordination.umpire_matrix.manage',p_actor_mode,p_association_id) then raise exception 'You cannot view restricted Umpire notes.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',n.id,'content',n.content,'kind',n.note_kind,'created_at',n.created_at,
    'created_by',concat_ws(' ',p.first_name,p.last_name),'redacted_at',n.redacted_at,'redaction_reason',n.redaction_reason
  ) order by n.created_at desc) from public.umpire_coordinator_notes n join public.profiles p on p.id=n.created_by where n.user_id=p_user_id and n.association_id=p_association_id),'[]'::jsonb);
end;
$function$;

create or replace function public.coordination_get_roster_review_queue(p_association_id uuid,p_actor_mode text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
begin
  if not private.coordination_permission_allowed('coordination.roster_mismatches.review',p_actor_mode,p_association_id)
    and not private.coordination_permission_allowed('coordination.umpires.manage',p_actor_mode,p_association_id) then raise exception 'You cannot view roster checks.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',rc.id,'submission_id',rc.submission_id,'fixture_id',rc.fixture_id,'result',rc.result,
    'reviewed_status',rc.reviewed_status,'detail',rc.detail,'checked_at',rc.checked_at,
    'fixture',home.name||' v '||coalesce(away.name,'Bye'),'fixture_date',f.fixture_date,
    'roster',rc.roster_snapshot
  ) order by rc.checked_at desc)
  from public.umpire_match_roster_checks rc
  join public.fixtures f on f.id=rc.fixture_id join public.teams home on home.id=f.home_team_id
  join public.clubs c on c.id=home.club_id left join public.teams away on away.id=f.away_team_id
  where c.association_id=p_association_id and rc.result in ('MISMATCH','NO_ROSTER','UNVERIFIABLE','ROSTER_DISPUTED')
    and rc.reviewed_status='PENDING'),'[]'::jsonb);
end;
$function$;

revoke all on function public.coordination_get_umpire_notes(uuid,uuid,text) from public,anon;
revoke all on function public.coordination_get_roster_review_queue(uuid,text) from public,anon;
grant execute on function public.coordination_get_umpire_notes(uuid,uuid,text) to authenticated;
grant execute on function public.coordination_get_roster_review_queue(uuid,text) to authenticated;

-- Allow Player MVP Voting to run without sending opening or reminder emails.
alter table public.teams
  add column if not exists mvp_notifications_enabled boolean not null default true;

comment on column public.teams.mvp_notifications_enabled is
  'Controls Player MVP opening and reminder emails for this team. Voting access is controlled separately by mvp_enabled.';

-- Keep both Player MVP team settings behind scoped database commands. The
-- transaction flag is set only inside those commands before their update.
create or replace function private.guard_team_mvp_enabled_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if tg_op = 'INSERT' then
    if (new.mvp_enabled is true or new.mvp_notifications_enabled is false)
       and coalesce(current_setting('app.mvp_team_setting_write', true), '') <> 'allowed' then
      raise exception using
        errcode = 'P0001',
        message = 'MVP_TEAM_SETTING_RPC_REQUIRED';
    end if;
  elsif (old.mvp_enabled is distinct from new.mvp_enabled
         or old.mvp_notifications_enabled is distinct from new.mvp_notifications_enabled)
        and coalesce(current_setting('app.mvp_team_setting_write', true), '') <> 'allowed' then
    raise exception using
      errcode = 'P0001',
      message = 'MVP_TEAM_SETTING_RPC_REQUIRED';
  end if;
  return new;
end
$function$;

drop trigger if exists guard_team_mvp_notifications_write on public.teams;
create trigger guard_team_mvp_notifications_write
before update of mvp_notifications_enabled on public.teams
for each row execute function private.guard_team_mvp_enabled_write();

create or replace function public.set_team_mvp_notifications_enabled(
  p_team_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_previous boolean;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'MVP_NOT_AUTHENTICATED';
  end if;

  select t.mvp_notifications_enabled
  into v_previous
  from public.teams t
  where t.id = p_team_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MVP_TEAM_NOT_FOUND';
  end if;

  if not private.mvp_can_manage_team(v_user_id, p_team_id) then
    raise exception using errcode = '42501', message = 'MVP_NOT_AUTHORISED';
  end if;

  perform pg_catalog.set_config('app.mvp_team_setting_write', 'allowed', true);
  update public.teams
  set mvp_notifications_enabled = p_enabled
  where id = p_team_id;

  perform private.mvp_write_audit(
    null,
    p_team_id,
    case
      when p_enabled then 'TEAM_MVP_NOTIFICATIONS_ENABLED'
      else 'TEAM_MVP_NOTIFICATIONS_DISABLED'
    end,
    case
      when p_enabled then 'Player MVP email notifications enabled'
      else 'Player MVP email notifications disabled'
    end,
    v_user_id,
    null,
    pg_catalog.jsonb_build_object(
      'previous_enabled', v_previous,
      'enabled', p_enabled
    )
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'team_id', p_team_id,
    'notifications_enabled', p_enabled
  );
end
$function$;

revoke all on function private.guard_team_mvp_enabled_write() from public, anon, authenticated;
revoke all on function public.set_team_mvp_notifications_enabled(uuid, boolean) from public, anon;
grant execute on function public.set_team_mvp_notifications_enabled(uuid, boolean) to authenticated;

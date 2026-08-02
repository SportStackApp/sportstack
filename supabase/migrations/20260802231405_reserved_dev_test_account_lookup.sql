-- Service-only lookup for the seven reserved disposable SportStack Dev test
-- identities. The Edge Function still performs live-session and Super Admin
-- authorisation before calling this helper.

create or replace function public.get_reserved_dev_test_account_id(
  p_email text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := upper(trim(coalesce(p_role, '')));
  v_expected_email text;
  v_user_id uuid;
begin
  v_expected_email := case v_role
    when 'ASSOCIATION_ADMIN' then 'codex.association-admin.dev@sportstackapp.com.au'
    when 'CLUB_ADMIN' then 'codex.club-admin.dev@sportstackapp.com.au'
    when 'TEAM_MANAGER' then 'codex.team-manager.dev@sportstackapp.com.au'
    when 'COACH' then 'codex.coach.dev@sportstackapp.com.au'
    when 'PLAYER' then 'codex.player.dev@sportstackapp.com.au'
    when 'UMPIRE' then 'codex.umpire.dev@sportstackapp.com.au'
    when 'VOTER' then 'codex.voter.dev@sportstackapp.com.au'
    else null
  end;

  if v_expected_email is null or v_email <> v_expected_email then
    raise exception using
      errcode = '22023',
      message = 'The reserved Dev test email does not match the selected role.';
  end if;

  select auth_user.id
  into v_user_id
  from auth.users auth_user
  where lower(auth_user.email) = v_email
    and coalesce(auth_user.raw_app_meta_data, '{}'::jsonb)
      @> '{"sportstack_dev_test": true}'::jsonb;

  return v_user_id;
end;
$function$;

revoke all on function public.get_reserved_dev_test_account_id(text, text)
from public, anon, authenticated;
grant execute on function public.get_reserved_dev_test_account_id(text, text)
to service_role;

comment on function public.get_reserved_dev_test_account_id(text, text) is
  'Returns the Auth user ID for one exact reserved disposable SportStack Dev test account. Service role only.';

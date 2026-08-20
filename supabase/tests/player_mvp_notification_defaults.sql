-- Player MVP email delivery is an explicit opt-in. Existing teams may remain
-- on only when an audited administrator action deliberately enabled emails.
begin;

do $test$
declare
  v_default text;
  v_inherited_on integer;
begin
  select column_default
  into v_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'teams'
    and column_name = 'mvp_notifications_enabled';

  if v_default is distinct from 'false' then
    raise exception 'Player MVP email default must be false; found %.', v_default;
  end if;

  select count(*)
  into v_inherited_on
  from public.teams team
  where team.mvp_notifications_enabled is true
    and not exists (
      select 1
      from public.mvp_vote_audit audit
      where audit.team_id = team.id
        and audit.action = 'TEAM_MVP_NOTIFICATIONS_ENABLED'
    );

  if v_inherited_on <> 0 then
    raise exception '% teams have inherited email-on without an audited opt-in.', v_inherited_on;
  end if;
end
$test$;

rollback;

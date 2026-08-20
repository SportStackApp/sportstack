-- Player MVP Voting remains available independently of email delivery.
-- New teams must opt in to opening and reminder emails.
alter table public.teams
  alter column mvp_notifications_enabled set default false;

-- The original column migration defaulted every existing team to on. Preserve
-- any team that was deliberately enabled through the audited setting command,
-- while moving inherited values to the new off-by-default behaviour.
select pg_catalog.set_config('app.mvp_team_setting_write', 'allowed', true);

update public.teams team
set mvp_notifications_enabled = false
where team.mvp_notifications_enabled is true
  and not exists (
    select 1
    from public.mvp_vote_audit audit
    where audit.team_id = team.id
      and audit.action = 'TEAM_MVP_NOTIFICATIONS_ENABLED'
  );

comment on column public.teams.mvp_notifications_enabled is
  'Controls Player MVP opening and reminder emails for this team. Defaults off and requires a separate opt-in from Player MVP Voting access.';

-- Review panels were an earlier local safeguard and are not the formal Rule 7
-- Tribunal. Preserve every existing row as immutable audit history.

create or replace function private.discipline_lock_legacy_review_history()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'Legacy review-panel records are read-only audit history. Use the Hockey Ballarat Rule 7.7 decision or formal Tribunal workflow.';
end;
$function$;

drop trigger if exists discipline_review_panels_read_only on public.discipline_review_panels;
create trigger discipline_review_panels_read_only
before insert or update or delete on public.discipline_review_panels
for each row execute function private.discipline_lock_legacy_review_history();

drop trigger if exists discipline_review_panel_members_read_only on public.discipline_review_panel_members;
create trigger discipline_review_panel_members_read_only
before insert or update or delete on public.discipline_review_panel_members
for each row execute function private.discipline_lock_legacy_review_history();

drop trigger if exists discipline_review_panel_votes_read_only on public.discipline_review_panel_votes;
create trigger discipline_review_panel_votes_read_only
before insert or update or delete on public.discipline_review_panel_votes
for each row execute function private.discipline_lock_legacy_review_history();

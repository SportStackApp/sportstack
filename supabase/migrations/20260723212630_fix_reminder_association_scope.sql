-- Live fixtures derive association scope through teams -> clubs.
-- Replace only the invalid direct fixtures.association_id join in the function
-- created by the immediately preceding additive migration.

do $migration$
declare
  function_definition text;
  corrected_definition text;
begin
  select pg_get_functiondef('public.claim_sportstack_notification_work(integer)'::regprocedure)
  into function_definition;

  corrected_definition := replace(
    function_definition,
    'left join public.associations a on a.id = f.association_id',
    'join public.clubs home_club on home_club.id = home.club_id
  left join public.associations a on a.id = home_club.association_id'
  );

  if corrected_definition = function_definition then
    raise exception 'Expected reminder association join was not found';
  end if;

  execute corrected_definition;
end;
$migration$;

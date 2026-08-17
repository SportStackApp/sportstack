-- Avoid reciprocal RLS policy expansion between offer batches and recipients.
-- These private helpers run as the migration owner and return only a boolean.

create or replace function private.coordination_is_offer_recipient(
  p_offer_batch_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_user_id is not null
    and p_user_id = auth.uid()
    and exists (
      select 1
      from public.coordination_offer_recipients recipient
      where recipient.offer_batch_id = p_offer_batch_id
        and recipient.user_id = p_user_id
    );
$function$;

create or replace function private.coordination_is_offer_owner(
  p_offer_batch_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_user_id is not null
    and p_user_id = auth.uid()
    and exists (
      select 1
      from public.coordination_offer_batches batch
      where batch.id = p_offer_batch_id
        and batch.current_owner_id = p_user_id
    );
$function$;

revoke all on function private.coordination_is_offer_recipient(uuid, uuid)
  from public, anon;
revoke all on function private.coordination_is_offer_owner(uuid, uuid)
  from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.coordination_is_offer_recipient(uuid, uuid)
  to authenticated;
grant execute on function private.coordination_is_offer_owner(uuid, uuid)
  to authenticated;

drop policy if exists coordination_offer_batches_read
  on public.coordination_offer_batches;
create policy coordination_offer_batches_read
  on public.coordination_offer_batches
  for select
  to authenticated
  using (
    offered_by = (select auth.uid())
    or current_owner_id = (select auth.uid())
    or (select public.is_super_admin())
    or private.coordination_is_offer_recipient(id, (select auth.uid()))
  );

drop policy if exists coordination_offer_recipients_read
  on public.coordination_offer_recipients;
create policy coordination_offer_recipients_read
  on public.coordination_offer_recipients
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_super_admin())
    or private.coordination_is_offer_owner(offer_batch_id, (select auth.uid()))
  );

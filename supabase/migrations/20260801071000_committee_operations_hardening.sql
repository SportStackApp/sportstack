-- Trigger helpers are internal database functions and must not be callable
-- through the public API.
revoke all on function public.audit_committee_activity() from public, anon, authenticated;
revoke all on function public.set_committee_updated_at() from public, anon, authenticated;


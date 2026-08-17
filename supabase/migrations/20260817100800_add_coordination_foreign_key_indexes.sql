-- Supporting indexes for Coordination Module foreign keys identified by the
-- Supabase database adviser after the initial schema was applied.

create index if not exists coordination_assignment_events_actor_id_idx
  on public.coordination_assignment_events (actor_id);

create index if not exists coordination_assignments_confirmed_by_idx
  on public.coordination_assignments (confirmed_by);

create index if not exists coordination_assignments_offer_recipient_id_idx
  on public.coordination_assignments (offer_recipient_id);

create index if not exists coordination_assignments_replaced_by_assignment_id_idx
  on public.coordination_assignments (replaced_by_assignment_id);

create index if not exists coordination_capabilities_granted_by_idx
  on public.coordination_capabilities (granted_by);

create index if not exists coordination_offer_batches_offered_by_idx
  on public.coordination_offer_batches (offered_by);

create index if not exists coordination_position_templates_position_type_id_idx
  on public.coordination_position_templates (position_type_id);

create index if not exists coordination_position_types_coordinator_permission_idx
  on public.coordination_position_types (coordinator_permission);

create index if not exists coordination_positions_club_id_idx
  on public.coordination_positions (club_id);

create index if not exists coordination_positions_created_by_idx
  on public.coordination_positions (created_by);

create index if not exists coordination_positions_team_id_idx
  on public.coordination_positions (team_id);

create index if not exists coordination_replacement_requests_resolved_by_idx
  on public.coordination_replacement_requests (resolved_by);

create index if not exists coordination_supervision_links_created_by_idx
  on public.coordination_supervision_links (created_by);

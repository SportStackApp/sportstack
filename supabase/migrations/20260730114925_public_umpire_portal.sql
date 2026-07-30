-- Public Umpire Match Voting submissions are written only by the guarded Edge Function.
-- Existing authenticated submission and review behaviour remains unchanged.

alter table public.player_vote_submissions
  add column if not exists is_public_submission boolean not null default false,
  add column if not exists public_submitter_name text,
  add column if not exists public_submitter_email text,
  add column if not exists public_identity_status text,
  add column if not exists public_submission_reference text,
  add column if not exists public_idempotency_key uuid,
  add column if not exists public_duplicate_key text,
  add column if not exists vote_scheme_key text;

alter table public.player_vote_lines
  add column if not exists scheme_line_key text;

alter table public.player_vote_submissions
  add constraint player_vote_submissions_public_identity_status_check
  check (
    public_identity_status is null
    or public_identity_status in ('UNVERIFIED', 'LINKED')
  ),
  add constraint player_vote_submissions_public_fields_check
  check (
    not is_public_submission
    or (
      nullif(btrim(public_submitter_name), '') is not null
      and nullif(btrim(public_submitter_email), '') is not null
      and public_identity_status is not null
      and public_submission_reference is not null
      and public_idempotency_key is not null
      and public_duplicate_key is not null
      and vote_scheme_key is not null
    )
  );

create unique index if not exists player_vote_submissions_public_reference_uidx
  on public.player_vote_submissions (public_submission_reference)
  where public_submission_reference is not null;

create unique index if not exists player_vote_submissions_public_idempotency_uidx
  on public.player_vote_submissions (public_idempotency_key)
  where public_idempotency_key is not null;

create unique index if not exists player_vote_submissions_public_duplicate_uidx
  on public.player_vote_submissions (public_duplicate_key)
  where is_public_submission and not is_deleted and public_duplicate_key is not null;

create unique index if not exists player_vote_lines_scheme_line_uidx
  on public.player_vote_lines (submission_id, scheme_line_key)
  where scheme_line_key is not null;

create table if not exists public.public_umpire_portal_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('OPTIONS', 'SUBMIT_ATTEMPT', 'SUBMIT_SUCCESS')),
  key_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists public_umpire_portal_events_lookup_idx
  on public.public_umpire_portal_events (event_type, key_hash, created_at desc);

alter table public.public_umpire_portal_events enable row level security;

revoke all on table public.public_umpire_portal_events from anon, authenticated;
revoke all on sequence public.public_umpire_portal_events_id_seq from anon, authenticated;

comment on table public.public_umpire_portal_events is
  'Hashed, service-only rate-limit events for the public Umpire Match Voting portal.';

comment on column public.player_vote_submissions.public_submitter_email is
  'Lower-case email entered in the public portal. Visible only through existing scoped admin access.';

create or replace function public.create_public_umpire_vote(
  p_submission jsonb,
  p_lines jsonb
)
returns table (submission_id uuid, submission_reference text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_submission_id uuid;
  v_reference text;
begin
  insert into public.player_vote_submissions (
    fixture_id,
    association_id,
    division_id,
    round_number,
    home_team_id,
    away_team_id,
    umpire_user_id,
    is_approved,
    is_public_submission,
    public_submitter_name,
    public_submitter_email,
    public_identity_status,
    public_submission_reference,
    public_idempotency_key,
    public_duplicate_key,
    vote_scheme_key,
    proxy_submitter_name,
    proxy_umpire_name,
    proxy_reason
  )
  values (
    (p_submission->>'fixture_id')::uuid,
    (p_submission->>'association_id')::uuid,
    (p_submission->>'division_id')::uuid,
    (p_submission->>'round_number')::integer,
    (p_submission->>'home_team_id')::uuid,
    (p_submission->>'away_team_id')::uuid,
    null,
    false,
    true,
    p_submission->>'public_submitter_name',
    lower(p_submission->>'public_submitter_email'),
    'UNVERIFIED',
    p_submission->>'public_submission_reference',
    (p_submission->>'public_idempotency_key')::uuid,
    p_submission->>'public_duplicate_key',
    p_submission->>'vote_scheme_key',
    nullif(p_submission->>'proxy_submitter_name', ''),
    nullif(p_submission->>'proxy_umpire_name', ''),
    nullif(p_submission->>'proxy_reason', '')
  )
  returning id, public_submission_reference
  into v_submission_id, v_reference;

  insert into public.player_vote_lines (
    submission_id,
    votes,
    player_name,
    player_number,
    team_id,
    profile_id,
    scheme_line_key
  )
  select
    v_submission_id,
    (line->>'votes')::integer,
    coalesce(line->>'player_name', ''),
    nullif(line->>'player_number', '')::integer,
    (line->>'team_id')::uuid,
    nullif(line->>'profile_id', '')::uuid,
    line->>'scheme_line_key'
  from jsonb_array_elements(p_lines) as line;

  return query select v_submission_id, v_reference;
end;
$$;

revoke all on function public.create_public_umpire_vote(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_public_umpire_vote(jsonb, jsonb) to service_role;

comment on function public.create_public_umpire_vote(jsonb, jsonb) is
  'Service-only atomic insert used by the guarded public Umpire Match Voting Edge Function.';

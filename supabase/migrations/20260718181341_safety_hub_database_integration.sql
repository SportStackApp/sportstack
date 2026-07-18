-- Safety Hub database integration.
--
-- Approved for SportStack Dev first, then Production after Dev verification.
--
-- This migration preserves the existing rg_* tables and data while adding the
-- fields, relationships, settings and audit controls required by the approved
-- mock prototype. Existing matrix values remain provisional.

-- ---------------------------------------------------------------------------
-- Preflight: stop instead of guessing when the existing Safety schema differs.
-- ---------------------------------------------------------------------------

do $migration$
declare
  v_table text;
begin
  foreach v_table in array array[
    'rg_audit_log',
    'rg_be_smart_actions',
    'rg_comments',
    'rg_dropdown_values',
    'rg_quality_improvement_items',
    'rg_risk_guidance_sections',
    'rg_risk_matrix',
    'rg_risk_register',
    'rg_risk_reviews'
  ]
  loop
    if to_regclass('public.' || v_table) is null then
      raise exception using
        errcode = 'P0001',
        message = 'SAFETY_HUB_PREFLIGHT_MISSING_TABLE',
        detail = format('Expected public.%s to exist before this migration.', v_table);
    end if;
  end loop;

  if exists (
    select 1
    from public.rg_risk_register r
    where r.association_id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'SAFETY_HUB_PREFLIGHT_UNSCOPED_RISK',
      detail = 'Existing risks need an association_id before this migration can be applied.';
  end if;

  if exists (
    select 1
    from public.rg_be_smart_actions a
    left join public.rg_risk_register r on r.id = a.risk_id
    where r.id is null or r.association_id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'SAFETY_HUB_PREFLIGHT_UNSCOPED_ACTION',
      detail = 'Existing actions must point to a scoped risk before this migration can be applied.';
  end if;

  if exists (
    select 1
    from public.rg_quality_improvement_items q
    where q.association_id is null
      and q.club_id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'SAFETY_HUB_PREFLIGHT_UNSCOPED_QI',
      detail = 'Existing QI items need an association_id or club_id before this migration can be applied.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename like 'rg\_%' escape '\'
      and p.policyname not in (
        'rg_audit_admin',
        'rg_actions_read',
        'rg_actions_write',
        'rg_comments_insert',
        'rg_comments_read',
        'rg_dropdown_read',
        'rg_qi_read',
        'rg_guidance_read',
        'rg_matrix_read',
        'rg_register_read',
        'rg_register_write',
        'rg_reviews_insert',
        'rg_reviews_read'
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'SAFETY_HUB_PREFLIGHT_POLICY_DRIFT',
      detail = 'Unexpected Safety Hub policies exist. Review them before replacing RLS.';
  end if;
end
$migration$;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Existing enums are expanded without renaming or removing historical values.
alter type public.risk_status_enum add value if not exists 'CONTROLLED';
alter type public.risk_status_enum add value if not exists 'ENTERED_IN_ERROR';

alter type public.action_status_enum add value if not exists 'NEW';
alter type public.action_status_enum add value if not exists 'AWAITING_DECISION';
alter type public.action_status_enum add value if not exists 'APPROVED';
alter type public.action_status_enum add value if not exists 'BLOCKED';
alter type public.action_status_enum add value if not exists 'ENTERED_IN_ERROR';

-- ---------------------------------------------------------------------------
-- Organisation-scoped matrix and guidance settings.
-- ---------------------------------------------------------------------------

create table if not exists public.rg_risk_settings (
  id uuid primary key default gen_random_uuid(),
  scope_level text not null,
  association_id uuid references public.associations(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  is_provisional boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null,
  last_change_reason text not null default 'Created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rg_risk_settings_scope_level_check
    check (scope_level in ('GLOBAL', 'ASSOCIATION', 'CLUB')),
  constraint rg_risk_settings_scope_check
    check (
      (
        scope_level = 'GLOBAL'
        and association_id is null
        and club_id is null
      )
      or (
        scope_level = 'ASSOCIATION'
        and association_id is not null
        and club_id is null
      )
      or (
        scope_level = 'CLUB'
        and association_id is not null
        and club_id is not null
      )
    ),
  constraint rg_risk_settings_reason_check
    check (length(trim(last_change_reason)) > 0)
);

create unique index if not exists rg_risk_settings_global_uidx
  on public.rg_risk_settings (scope_level)
  where scope_level = 'GLOBAL';

create unique index if not exists rg_risk_settings_association_uidx
  on public.rg_risk_settings (association_id)
  where scope_level = 'ASSOCIATION';

create unique index if not exists rg_risk_settings_club_uidx
  on public.rg_risk_settings (club_id)
  where scope_level = 'CLUB';

create index if not exists rg_risk_settings_created_by_idx
  on public.rg_risk_settings (created_by);

insert into public.rg_risk_settings (
  scope_level,
  name,
  is_provisional,
  last_change_reason
)
select
  'GLOBAL',
  'SportStack provisional global risk settings',
  true,
  'Attached the existing provisional matrix to a settings profile'
where not exists (
  select 1
  from public.rg_risk_settings s
  where s.scope_level = 'GLOBAL'
);

alter table public.rg_risk_matrix
  add column if not exists settings_id uuid
    references public.rg_risk_settings(id) on delete cascade,
  add column if not exists created_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists last_change_reason text not null
    default 'Existing provisional matrix value',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.rg_risk_guidance_sections
  add column if not exists settings_id uuid
    references public.rg_risk_settings(id) on delete cascade,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists last_change_reason text not null
    default 'Existing guidance value',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.rg_dropdown_values
  add column if not exists settings_id uuid
    references public.rg_risk_settings(id) on delete cascade,
  add column if not exists description text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists last_change_reason text not null
    default 'Existing dropdown value',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.rg_risk_matrix
set settings_id = (
  select s.id
  from public.rg_risk_settings s
  where s.scope_level = 'GLOBAL'
  limit 1
)
where settings_id is null;

update public.rg_risk_guidance_sections
set settings_id = (
  select s.id
  from public.rg_risk_settings s
  where s.scope_level = 'GLOBAL'
  limit 1
)
where settings_id is null;

update public.rg_dropdown_values
set settings_id = (
  select s.id
  from public.rg_risk_settings s
  where s.scope_level = 'GLOBAL'
  limit 1
)
where settings_id is null;

alter table public.rg_risk_matrix
  alter column settings_id set not null;

alter table public.rg_risk_guidance_sections
  alter column settings_id set not null;

alter table public.rg_dropdown_values
  alter column settings_id set not null;

alter table public.rg_risk_matrix
  drop constraint if exists rg_risk_matrix_likelihood_consequence_key;

create unique index if not exists rg_risk_matrix_settings_cell_uidx
  on public.rg_risk_matrix (settings_id, likelihood, consequence);

create unique index if not exists rg_dropdown_settings_value_uidx
  on public.rg_dropdown_values (settings_id, category, value);

create index if not exists rg_guidance_settings_category_idx
  on public.rg_risk_guidance_sections (settings_id, category, sort_order);

-- ---------------------------------------------------------------------------
-- Existing register expansion.
-- ---------------------------------------------------------------------------

alter table public.rg_risk_register
  add column if not exists display_number bigint generated by default as identity,
  add column if not exists risk_type text,
  add column if not exists risk_event text,
  add column if not exists consequences text,
  add column if not exists inherent_likelihood integer,
  add column if not exists inherent_consequence integer,
  add column if not exists inherent_rating text,
  add column if not exists residual_likelihood integer,
  add column if not exists residual_consequence integer,
  add column if not exists residual_rating text,
  add column if not exists target_rating text,
  add column if not exists existing_controls text,
  add column if not exists treatment_plan text,
  add column if not exists review_frequency text,
  add column if not exists next_review_date date,
  add column if not exists evidence text,
  add column if not exists created_by uuid
    references public.profiles(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists last_change_reason text not null default 'Created';

update public.rg_risk_register
set risk_event = coalesce(risk_event, title),
    consequences = coalesce(consequences, description),
    inherent_likelihood = coalesce(inherent_likelihood, likelihood),
    inherent_consequence = coalesce(inherent_consequence, consequence),
    residual_likelihood = coalesce(residual_likelihood, likelihood),
    residual_consequence = coalesce(residual_consequence, consequence)
where risk_event is null
   or consequences is null
   or inherent_likelihood is null
   or inherent_consequence is null
   or residual_likelihood is null
   or residual_consequence is null;

update public.rg_risk_register r
set inherent_rating = coalesce(r.inherent_rating, m.risk_level),
    residual_rating = coalesce(r.residual_rating, m.risk_level)
from public.rg_risk_matrix m
where m.settings_id = (
    select s.id
    from public.rg_risk_settings s
    where s.scope_level = 'GLOBAL'
    limit 1
  )
  and m.likelihood = r.likelihood
  and m.consequence = r.consequence
  and (r.inherent_rating is null or r.residual_rating is null);

alter table public.rg_risk_register
  alter column association_id set not null;

create unique index if not exists rg_risk_register_display_number_uidx
  on public.rg_risk_register (display_number);

create index if not exists rg_risk_register_scope_idx
  on public.rg_risk_register (association_id, club_id, team_id);

create index if not exists rg_risk_register_owner_idx
  on public.rg_risk_register (owner_id);

create index if not exists rg_risk_register_status_review_idx
  on public.rg_risk_register (status, next_review_date);

alter table public.rg_be_smart_actions
  add column if not exists display_number bigint generated by default as identity,
  add column if not exists association_id uuid
    references public.associations(id) on delete cascade,
  add column if not exists club_id uuid
    references public.clubs(id) on delete cascade,
  add column if not exists team_id uuid
    references public.teams(id) on delete cascade,
  add column if not exists title text,
  add column if not exists baseline text,
  add column if not exists evaluate text,
  add column if not exists specific text,
  add column if not exists measurable text,
  add column if not exists achievable text,
  add column if not exists relevant text,
  add column if not exists time_bound text,
  add column if not exists resources text,
  add column if not exists created_by uuid
    references public.profiles(id) on delete set null default auth.uid(),
  add column if not exists updated_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists last_change_reason text not null default 'Created';

alter table public.rg_be_smart_actions
  alter column risk_id drop not null;

update public.rg_be_smart_actions a
set association_id = coalesce(a.association_id, r.association_id),
    club_id = coalesce(a.club_id, r.club_id),
    team_id = coalesce(a.team_id, r.team_id),
    title = coalesce(a.title, a.action_text),
    specific = coalesce(a.specific, a.action_text)
from public.rg_risk_register r
where a.risk_id = r.id;

alter table public.rg_be_smart_actions
  alter column association_id set not null,
  alter column title set not null;

create unique index if not exists rg_be_smart_actions_display_number_uidx
  on public.rg_be_smart_actions (display_number);

create index if not exists rg_be_smart_actions_scope_idx
  on public.rg_be_smart_actions (association_id, club_id, team_id);

create index if not exists rg_be_smart_actions_risk_idx
  on public.rg_be_smart_actions (risk_id);

create index if not exists rg_be_smart_actions_assigned_due_idx
  on public.rg_be_smart_actions (assigned_to, due_date);

alter table public.rg_quality_improvement_items
  add column if not exists display_number bigint generated by default as identity,
  add column if not exists team_id uuid
    references public.teams(id) on delete cascade,
  add column if not exists owner_id uuid
    references public.profiles(id) on delete set null,
  add column if not exists source text,
  add column if not exists area text,
  add column if not exists priority text not null default 'MEDIUM',
  add column if not exists due_date date,
  add column if not exists issue text,
  add column if not exists required_action text,
  add column if not exists outcome text,
  add column if not exists updated_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists last_change_reason text not null default 'Created';

update public.rg_quality_improvement_items q
set association_id = c.association_id
from public.clubs c
where q.club_id = c.id
  and q.association_id is null;

update public.rg_quality_improvement_items
set issue = coalesce(issue, description)
where issue is null;

alter table public.rg_quality_improvement_items
  alter column association_id set not null;

create unique index if not exists rg_qi_display_number_uidx
  on public.rg_quality_improvement_items (display_number);

create index if not exists rg_qi_scope_idx
  on public.rg_quality_improvement_items (association_id, club_id, team_id);

create index if not exists rg_qi_owner_due_idx
  on public.rg_quality_improvement_items (owner_id, due_date);

-- ---------------------------------------------------------------------------
-- Bright Ideas and cross-register links.
-- ---------------------------------------------------------------------------

create table if not exists public.rg_bright_ideas (
  id uuid primary key default gen_random_uuid(),
  display_number bigint generated by default as identity,
  association_id uuid not null
    references public.associations(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  submitted_at timestamptz not null default now(),
  title text not null,
  why_needed text not null,
  suggested_implementation text,
  suggested_evaluation text,
  could_assist text,
  other_information text,
  status text not null default 'SUBMITTED',
  decision text,
  committee_notes text,
  decision_reason text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null,
  last_change_reason text not null default 'Created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rg_bright_ideas_status_check
    check (
      status in (
        'SUBMITTED',
        'UNDER_REVIEW',
        'ACCEPTED',
        'DEFERRED',
        'CLOSED',
        'ENTERED_IN_ERROR'
      )
    ),
  constraint rg_bright_ideas_decision_check
    check (
      decision is null
      or decision in ('ACCEPT', 'DEFER', 'REJECT', 'CLOSE')
    ),
  constraint rg_bright_ideas_reason_check
    check (length(trim(last_change_reason)) > 0)
);

create unique index if not exists rg_bright_ideas_display_number_uidx
  on public.rg_bright_ideas (display_number);

create index if not exists rg_bright_ideas_scope_idx
  on public.rg_bright_ideas (association_id, club_id, team_id);

create index if not exists rg_bright_ideas_status_submitted_idx
  on public.rg_bright_ideas (status, submitted_at desc);

create index if not exists rg_bright_ideas_submitted_by_idx
  on public.rg_bright_ideas (submitted_by);

create table if not exists public.rg_record_links (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null
    references public.associations(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  risk_id uuid references public.rg_risk_register(id) on delete cascade,
  action_id uuid references public.rg_be_smart_actions(id) on delete cascade,
  qi_item_id uuid references public.rg_quality_improvement_items(id) on delete cascade,
  bright_idea_id uuid references public.rg_bright_ideas(id) on delete cascade,
  link_reason text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null,
  last_change_reason text not null default 'Linked records',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rg_record_links_two_records_check
    check (num_nonnulls(risk_id, action_id, qi_item_id, bright_idea_id) = 2),
  constraint rg_record_links_reason_check
    check (length(trim(last_change_reason)) > 0)
);

create unique index if not exists rg_record_links_risk_action_uidx
  on public.rg_record_links (risk_id, action_id)
  where risk_id is not null and action_id is not null;

create unique index if not exists rg_record_links_risk_qi_uidx
  on public.rg_record_links (risk_id, qi_item_id)
  where risk_id is not null and qi_item_id is not null;

create unique index if not exists rg_record_links_risk_idea_uidx
  on public.rg_record_links (risk_id, bright_idea_id)
  where risk_id is not null and bright_idea_id is not null;

create unique index if not exists rg_record_links_action_qi_uidx
  on public.rg_record_links (action_id, qi_item_id)
  where action_id is not null and qi_item_id is not null;

create unique index if not exists rg_record_links_action_idea_uidx
  on public.rg_record_links (action_id, bright_idea_id)
  where action_id is not null and bright_idea_id is not null;

create unique index if not exists rg_record_links_qi_idea_uidx
  on public.rg_record_links (qi_item_id, bright_idea_id)
  where qi_item_id is not null and bright_idea_id is not null;

create index if not exists rg_record_links_scope_idx
  on public.rg_record_links (association_id, club_id, team_id);

insert into public.rg_record_links (
  association_id,
  club_id,
  team_id,
  risk_id,
  action_id,
  link_reason,
  created_by,
  last_change_reason
)
select
  a.association_id,
  a.club_id,
  a.team_id,
  a.risk_id,
  a.id,
  'Migrated from the legacy action risk_id relationship',
  a.created_by,
  'Migrated the legacy action and risk relationship'
from public.rg_be_smart_actions a
where a.risk_id is not null
  and not exists (
    select 1
    from public.rg_record_links l
    where l.risk_id = a.risk_id
      and l.action_id = a.id
  );

-- ---------------------------------------------------------------------------
-- Reviews and comments become scoped, append-only records.
-- ---------------------------------------------------------------------------

alter table public.rg_risk_reviews
  add column if not exists association_id uuid
    references public.associations(id) on delete cascade,
  add column if not exists club_id uuid
    references public.clubs(id) on delete cascade,
  add column if not exists team_id uuid
    references public.teams(id) on delete cascade,
  add column if not exists next_review_date date,
  add column if not exists residual_likelihood integer,
  add column if not exists residual_consequence integer,
  add column if not exists residual_rating text,
  add column if not exists evidence text,
  add column if not exists review_reason text,
  add column if not exists last_change_reason text not null
    default 'Risk review recorded';

update public.rg_risk_reviews rr
set association_id = r.association_id,
    club_id = r.club_id,
    team_id = r.team_id,
    residual_likelihood = coalesce(rr.residual_likelihood, r.residual_likelihood),
    residual_consequence = coalesce(rr.residual_consequence, r.residual_consequence),
    residual_rating = coalesce(rr.residual_rating, r.residual_rating),
    review_reason = coalesce(rr.review_reason, rr.notes, 'Existing risk review'),
    last_change_reason = coalesce(rr.notes, 'Existing risk review')
from public.rg_risk_register r
where rr.risk_id = r.id;

alter table public.rg_risk_reviews
  alter column association_id set not null;

create index if not exists rg_risk_reviews_scope_date_idx
  on public.rg_risk_reviews (association_id, club_id, team_id, reviewed_at desc);

create index if not exists rg_risk_reviews_risk_date_idx
  on public.rg_risk_reviews (risk_id, reviewed_at desc);

alter table public.rg_comments
  add column if not exists association_id uuid
    references public.associations(id) on delete cascade,
  add column if not exists club_id uuid
    references public.clubs(id) on delete cascade,
  add column if not exists team_id uuid
    references public.teams(id) on delete cascade,
  add column if not exists last_change_reason text not null
    default 'Comment added';

update public.rg_comments c
set association_id = r.association_id,
    club_id = r.club_id,
    team_id = r.team_id
from public.rg_risk_register r
where c.record_id = r.id
  and c.table_name in ('risk', 'rg_risk_register')
  and c.association_id is null;

update public.rg_comments c
set association_id = a.association_id,
    club_id = a.club_id,
    team_id = a.team_id
from public.rg_be_smart_actions a
where c.record_id = a.id
  and c.table_name in ('action', 'rg_be_smart_actions')
  and c.association_id is null;

update public.rg_comments c
set association_id = q.association_id,
    club_id = q.club_id,
    team_id = q.team_id
from public.rg_quality_improvement_items q
where c.record_id = q.id
  and c.table_name in ('qi', 'rg_quality_improvement_items')
  and c.association_id is null;

do $migration$
begin
  if exists (
    select 1
    from public.rg_comments c
    where c.association_id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'SAFETY_HUB_UNSCOPED_COMMENT',
      detail = 'An existing Safety comment could not be matched to a scoped record.';
  end if;

  if exists (
    with safety_scopes as (
      select association_id, club_id, team_id
      from public.rg_risk_register
      union all
      select association_id, club_id, team_id
      from public.rg_be_smart_actions
      union all
      select association_id, club_id, team_id
      from public.rg_quality_improvement_items
      union all
      select association_id, club_id, team_id
      from public.rg_risk_reviews
      union all
      select association_id, club_id, team_id
      from public.rg_comments
    )
    select 1
    from safety_scopes s
    where (
      s.club_id is not null
      and not exists (
        select 1
        from public.clubs c
        where c.id = s.club_id
          and c.association_id = s.association_id
      )
    )
    or (
      s.team_id is not null
      and (
        s.club_id is null
        or not exists (
          select 1
          from public.teams t
          where t.id = s.team_id
            and t.club_id = s.club_id
        )
      )
    )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'SAFETY_HUB_SCOPE_HIERARCHY_MISMATCH',
      detail = 'An existing Safety record has an association, club or team mismatch.';
  end if;

  if exists (
    select 1
    from public.rg_be_smart_actions a
    join public.rg_risk_register r on r.id = a.risk_id
    where a.association_id is distinct from r.association_id
       or a.club_id is distinct from r.club_id
       or a.team_id is distinct from r.team_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'SAFETY_HUB_LEGACY_ACTION_SCOPE_MISMATCH',
      detail = 'An existing action and its legacy risk link do not have the same scope.';
  end if;
end
$migration$;

alter table public.rg_comments
  alter column association_id set not null;

create index if not exists rg_comments_scope_date_idx
  on public.rg_comments (association_id, club_id, team_id, created_at desc);

create index if not exists rg_comments_record_idx
  on public.rg_comments (table_name, record_id, created_at);

do $migration$
declare
  v_check record;
begin
  for v_check in
    select *
    from (
      values
        ('rg_risk_matrix', 'rg_matrix_reason_check'),
        ('rg_risk_guidance_sections', 'rg_guidance_reason_check'),
        ('rg_dropdown_values', 'rg_dropdown_reason_check'),
        ('rg_risk_register', 'rg_risk_reason_check'),
        ('rg_be_smart_actions', 'rg_action_reason_check'),
        ('rg_quality_improvement_items', 'rg_qi_reason_check'),
        ('rg_risk_reviews', 'rg_review_reason_check'),
        ('rg_comments', 'rg_comment_reason_check')
    ) as checks(table_name, constraint_name)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_constraint c
      where c.conrelid = ('public.' || v_check.table_name)::regclass
        and c.conname = v_check.constraint_name
    ) then
      execute format(
        'alter table public.%I add constraint %I check (length(trim(last_change_reason)) > 0)',
        v_check.table_name,
        v_check.constraint_name
      );
    end if;
  end loop;

  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.rg_risk_register'::regclass
      and c.conname = 'rg_risk_register_expanded_ratings_check'
  ) then
    alter table public.rg_risk_register
      add constraint rg_risk_register_expanded_ratings_check
      check (
        (inherent_likelihood is null or inherent_likelihood between 1 and 5)
        and (inherent_consequence is null or inherent_consequence between 1 and 5)
        and (residual_likelihood is null or residual_likelihood between 1 and 5)
        and (residual_consequence is null or residual_consequence between 1 and 5)
      );
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.rg_risk_reviews'::regclass
      and c.conname = 'rg_risk_reviews_residual_ratings_check'
  ) then
    alter table public.rg_risk_reviews
      add constraint rg_risk_reviews_residual_ratings_check
      check (
        (residual_likelihood is null or residual_likelihood between 1 and 5)
        and (residual_consequence is null or residual_consequence between 1 and 5)
      );
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.rg_quality_improvement_items'::regclass
      and c.conname = 'rg_qi_priority_check'
  ) then
    alter table public.rg_quality_improvement_items
      add constraint rg_qi_priority_check
      check (priority in ('LOW', 'MEDIUM', 'HIGH'));
  end if;
end
$migration$;

create index if not exists rg_risk_register_club_idx
  on public.rg_risk_register (club_id);

create index if not exists rg_risk_register_team_idx
  on public.rg_risk_register (team_id);

create index if not exists rg_be_smart_actions_club_idx
  on public.rg_be_smart_actions (club_id);

create index if not exists rg_be_smart_actions_team_idx
  on public.rg_be_smart_actions (team_id);

create index if not exists rg_qi_club_idx
  on public.rg_quality_improvement_items (club_id);

create index if not exists rg_qi_team_idx
  on public.rg_quality_improvement_items (team_id);

create index if not exists rg_bright_ideas_club_idx
  on public.rg_bright_ideas (club_id);

create index if not exists rg_bright_ideas_team_idx
  on public.rg_bright_ideas (team_id);

create index if not exists rg_record_links_risk_idx
  on public.rg_record_links (risk_id);

create index if not exists rg_record_links_action_idx
  on public.rg_record_links (action_id);

create index if not exists rg_record_links_qi_idx
  on public.rg_record_links (qi_item_id);

create index if not exists rg_record_links_bright_idea_idx
  on public.rg_record_links (bright_idea_id);

create index if not exists rg_record_links_club_idx
  on public.rg_record_links (club_id);

create index if not exists rg_record_links_team_idx
  on public.rg_record_links (team_id);

create index if not exists rg_risk_reviews_club_idx
  on public.rg_risk_reviews (club_id);

create index if not exists rg_risk_reviews_team_idx
  on public.rg_risk_reviews (team_id);

create index if not exists rg_comments_club_idx
  on public.rg_comments (club_id);

create index if not exists rg_comments_team_idx
  on public.rg_comments (team_id);

-- ---------------------------------------------------------------------------
-- Scope and change-reason validation.
-- ---------------------------------------------------------------------------

create or replace function private.rg_validate_record_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if new.association_id is null then
    raise exception using
      errcode = '23514',
      message = 'SAFETY_HUB_ASSOCIATION_REQUIRED';
  end if;

  if new.club_id is not null
     and not exists (
       select 1
       from public.clubs c
       where c.id = new.club_id
         and c.association_id = new.association_id
     ) then
    raise exception using
      errcode = '23514',
      message = 'SAFETY_HUB_CLUB_SCOPE_MISMATCH';
  end if;

  if new.team_id is not null
     and (
       new.club_id is null
       or not exists (
         select 1
         from public.teams t
         where t.id = new.team_id
           and t.club_id = new.club_id
       )
     ) then
    raise exception using
      errcode = '23514',
      message = 'SAFETY_HUB_TEAM_SCOPE_MISMATCH';
  end if;

  return new;
end
$function$;

create or replace function private.rg_validate_settings_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if new.scope_level = 'CLUB'
     and not exists (
       select 1
       from public.clubs c
       where c.id = new.club_id
         and c.association_id = new.association_id
     ) then
    raise exception using
      errcode = '23514',
      message = 'SAFETY_HUB_SETTINGS_SCOPE_MISMATCH';
  end if;

  return new;
end
$function$;

create or replace function private.rg_prepare_audited_record()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, v_user_id);
    new.updated_by := coalesce(v_user_id, new.updated_by, new.created_by);
    new.last_change_reason := coalesce(
      nullif(trim(new.last_change_reason), ''),
      'Created'
    );
  else
    if nullif(trim(new.last_change_reason), '') is null
       or new.last_change_reason is not distinct from old.last_change_reason then
      raise exception using
        errcode = '23514',
        message = 'SAFETY_HUB_CHANGE_REASON_REQUIRED';
    end if;

    new.updated_by := coalesce(v_user_id, new.updated_by);
    new.updated_at := now();
  end if;

  return new;
end
$function$;

create or replace function private.rg_prepare_review()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
  new.reviewed_at := coalesce(new.reviewed_at, now());
  new.review_reason := coalesce(
    nullif(trim(new.review_reason), ''),
    nullif(trim(new.notes), ''),
    'Risk review recorded'
  );
  new.last_change_reason := coalesce(
    nullif(trim(new.last_change_reason), ''),
    new.review_reason
  );
  return new;
end
$function$;

create or replace function private.rg_prepare_comment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  new.user_id := coalesce(new.user_id, auth.uid());
  new.last_change_reason := coalesce(
    nullif(trim(new.last_change_reason), ''),
    'Comment added'
  );
  return new;
end
$function$;

create or replace function private.rg_validate_link_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_association_id uuid;
  v_club_id uuid;
  v_team_id uuid;
  v_record_association_id uuid;
  v_record_club_id uuid;
  v_record_team_id uuid;
begin
  if new.risk_id is not null then
    select r.association_id, r.club_id, r.team_id
    into v_record_association_id, v_record_club_id, v_record_team_id
    from public.rg_risk_register r
    where r.id = new.risk_id;

    v_association_id := v_record_association_id;
    v_club_id := v_record_club_id;
    v_team_id := v_record_team_id;
  end if;

  if new.action_id is not null then
    select a.association_id, a.club_id, a.team_id
    into v_record_association_id, v_record_club_id, v_record_team_id
    from public.rg_be_smart_actions a
    where a.id = new.action_id;

    if v_association_id is not null
       and v_association_id is distinct from v_record_association_id then
      raise exception using
        errcode = '23514',
        message = 'SAFETY_HUB_CROSS_ASSOCIATION_LINK';
    end if;

    if v_club_id is not null
       and v_record_club_id is not null
       and v_club_id is distinct from v_record_club_id then
      raise exception using
        errcode = '23514',
        message = 'SAFETY_HUB_CROSS_CLUB_LINK';
    end if;

    if v_team_id is not null
       and v_record_team_id is not null
       and v_team_id is distinct from v_record_team_id then
      raise exception using
        errcode = '23514',
        message = 'SAFETY_HUB_CROSS_TEAM_LINK';
    end if;

    v_association_id := coalesce(v_association_id, v_record_association_id);
    v_club_id := coalesce(v_club_id, v_record_club_id);
    v_team_id := coalesce(v_team_id, v_record_team_id);
  end if;

  if new.qi_item_id is not null then
    select q.association_id, q.club_id, q.team_id
    into v_record_association_id, v_record_club_id, v_record_team_id
    from public.rg_quality_improvement_items q
    where q.id = new.qi_item_id;

    if v_association_id is not null
       and v_association_id is distinct from v_record_association_id then
      raise exception using
        errcode = '23514',
        message = 'SAFETY_HUB_CROSS_ASSOCIATION_LINK';
    end if;

    if v_club_id is not null
       and v_record_club_id is not null
       and v_club_id is distinct from v_record_club_id then
      raise exception using
        errcode = '23514',
        message = 'SAFETY_HUB_CROSS_CLUB_LINK';
    end if;

    if v_team_id is not null
       and v_record_team_id is not null
       and v_team_id is distinct from v_record_team_id then
      raise exception using
        errcode = '23514',
        message = 'SAFETY_HUB_CROSS_TEAM_LINK';
    end if;

    v_association_id := coalesce(v_association_id, v_record_association_id);
    v_club_id := coalesce(v_club_id, v_record_club_id);
    v_team_id := coalesce(v_team_id, v_record_team_id);
  end if;

  if new.bright_idea_id is not null then
    select b.association_id, b.club_id, b.team_id
    into v_record_association_id, v_record_club_id, v_record_team_id
    from public.rg_bright_ideas b
    where b.id = new.bright_idea_id;

    if v_association_id is not null
       and v_association_id is distinct from v_record_association_id then
      raise exception using
        errcode = '23514',
        message = 'SAFETY_HUB_CROSS_ASSOCIATION_LINK';
    end if;

    if v_club_id is not null
       and v_record_club_id is not null
       and v_club_id is distinct from v_record_club_id then
      raise exception using
        errcode = '23514',
        message = 'SAFETY_HUB_CROSS_CLUB_LINK';
    end if;

    if v_team_id is not null
       and v_record_team_id is not null
       and v_team_id is distinct from v_record_team_id then
      raise exception using
        errcode = '23514',
        message = 'SAFETY_HUB_CROSS_TEAM_LINK';
    end if;

    v_association_id := coalesce(v_association_id, v_record_association_id);
    v_club_id := coalesce(v_club_id, v_record_club_id);
    v_team_id := coalesce(v_team_id, v_record_team_id);
  end if;

  if new.association_id is distinct from v_association_id
     or new.club_id is distinct from v_club_id
     or new.team_id is distinct from v_team_id then
    raise exception using
      errcode = '23514',
      message = 'SAFETY_HUB_LINK_SCOPE_MISMATCH';
  end if;

  return new;
end
$function$;

create or replace function private.rg_validate_action_risk_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_association_id uuid;
  v_club_id uuid;
  v_team_id uuid;
begin
  if new.risk_id is null then
    return new;
  end if;

  select r.association_id, r.club_id, r.team_id
  into v_association_id, v_club_id, v_team_id
  from public.rg_risk_register r
  where r.id = new.risk_id;

  if new.association_id is distinct from v_association_id
     or new.club_id is distinct from v_club_id
     or new.team_id is distinct from v_team_id then
    raise exception using
      errcode = '23514',
      message = 'SAFETY_HUB_ACTION_RISK_SCOPE_MISMATCH';
  end if;

  return new;
end
$function$;

create or replace function private.rg_validate_review_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_association_id uuid;
  v_club_id uuid;
  v_team_id uuid;
begin
  select r.association_id, r.club_id, r.team_id
  into v_association_id, v_club_id, v_team_id
  from public.rg_risk_register r
  where r.id = new.risk_id;

  if new.association_id is distinct from v_association_id
     or new.club_id is distinct from v_club_id
     or new.team_id is distinct from v_team_id then
    raise exception using
      errcode = '23514',
      message = 'SAFETY_HUB_REVIEW_SCOPE_MISMATCH';
  end if;

  return new;
end
$function$;

create or replace function private.rg_validate_comment_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_association_id uuid;
  v_club_id uuid;
  v_team_id uuid;
begin
  case new.table_name
    when 'risk' then
      select r.association_id, r.club_id, r.team_id
      into v_association_id, v_club_id, v_team_id
      from public.rg_risk_register r
      where r.id = new.record_id;
    when 'rg_risk_register' then
      select r.association_id, r.club_id, r.team_id
      into v_association_id, v_club_id, v_team_id
      from public.rg_risk_register r
      where r.id = new.record_id;
    when 'action' then
      select a.association_id, a.club_id, a.team_id
      into v_association_id, v_club_id, v_team_id
      from public.rg_be_smart_actions a
      where a.id = new.record_id;
    when 'rg_be_smart_actions' then
      select a.association_id, a.club_id, a.team_id
      into v_association_id, v_club_id, v_team_id
      from public.rg_be_smart_actions a
      where a.id = new.record_id;
    when 'qi' then
      select q.association_id, q.club_id, q.team_id
      into v_association_id, v_club_id, v_team_id
      from public.rg_quality_improvement_items q
      where q.id = new.record_id;
    when 'rg_quality_improvement_items' then
      select q.association_id, q.club_id, q.team_id
      into v_association_id, v_club_id, v_team_id
      from public.rg_quality_improvement_items q
      where q.id = new.record_id;
    when 'bright_idea' then
      select b.association_id, b.club_id, b.team_id
      into v_association_id, v_club_id, v_team_id
      from public.rg_bright_ideas b
      where b.id = new.record_id;
    when 'rg_bright_ideas' then
      select b.association_id, b.club_id, b.team_id
      into v_association_id, v_club_id, v_team_id
      from public.rg_bright_ideas b
      where b.id = new.record_id;
    else
      raise exception using
        errcode = '23514',
        message = 'SAFETY_HUB_COMMENT_RECORD_TYPE_INVALID';
  end case;

  if v_association_id is null then
    raise exception using
      errcode = '23503',
      message = 'SAFETY_HUB_COMMENT_RECORD_NOT_FOUND';
  end if;

  if new.association_id is distinct from v_association_id
     or new.club_id is distinct from v_club_id
     or new.team_id is distinct from v_team_id then
    raise exception using
      errcode = '23514',
      message = 'SAFETY_HUB_COMMENT_SCOPE_MISMATCH';
  end if;

  return new;
end
$function$;

revoke all on function private.rg_validate_record_scope()
  from public, anon, authenticated;
revoke all on function private.rg_validate_settings_scope()
  from public, anon, authenticated;
revoke all on function private.rg_prepare_audited_record()
  from public, anon, authenticated;
revoke all on function private.rg_prepare_review()
  from public, anon, authenticated;
revoke all on function private.rg_prepare_comment()
  from public, anon, authenticated;
revoke all on function private.rg_validate_link_scope()
  from public, anon, authenticated;
revoke all on function private.rg_validate_action_risk_scope()
  from public, anon, authenticated;
revoke all on function private.rg_validate_review_scope()
  from public, anon, authenticated;
revoke all on function private.rg_validate_comment_scope()
  from public, anon, authenticated;

drop trigger if exists rg_10_prepare_change on public.rg_risk_settings;
create trigger rg_10_prepare_change
before insert or update on public.rg_risk_settings
for each row execute function private.rg_prepare_audited_record();

drop trigger if exists rg_20_validate_scope on public.rg_risk_settings;
create trigger rg_20_validate_scope
before insert or update on public.rg_risk_settings
for each row execute function private.rg_validate_settings_scope();

drop trigger if exists rg_10_prepare_change on public.rg_risk_matrix;
create trigger rg_10_prepare_change
before insert or update on public.rg_risk_matrix
for each row execute function private.rg_prepare_audited_record();

drop trigger if exists rg_10_prepare_change on public.rg_risk_guidance_sections;
create trigger rg_10_prepare_change
before insert or update on public.rg_risk_guidance_sections
for each row execute function private.rg_prepare_audited_record();

drop trigger if exists rg_10_prepare_change on public.rg_dropdown_values;
create trigger rg_10_prepare_change
before insert or update on public.rg_dropdown_values
for each row execute function private.rg_prepare_audited_record();

drop trigger if exists rg_10_prepare_change on public.rg_risk_register;
create trigger rg_10_prepare_change
before insert or update on public.rg_risk_register
for each row execute function private.rg_prepare_audited_record();

drop trigger if exists rg_20_validate_scope on public.rg_risk_register;
create trigger rg_20_validate_scope
before insert or update on public.rg_risk_register
for each row execute function private.rg_validate_record_scope();

drop trigger if exists rg_10_prepare_change on public.rg_be_smart_actions;
create trigger rg_10_prepare_change
before insert or update on public.rg_be_smart_actions
for each row execute function private.rg_prepare_audited_record();

drop trigger if exists rg_20_validate_scope on public.rg_be_smart_actions;
create trigger rg_20_validate_scope
before insert or update on public.rg_be_smart_actions
for each row execute function private.rg_validate_record_scope();

drop trigger if exists rg_30_validate_legacy_risk on public.rg_be_smart_actions;
create trigger rg_30_validate_legacy_risk
before insert or update on public.rg_be_smart_actions
for each row execute function private.rg_validate_action_risk_scope();

drop trigger if exists rg_10_prepare_change on public.rg_quality_improvement_items;
create trigger rg_10_prepare_change
before insert or update on public.rg_quality_improvement_items
for each row execute function private.rg_prepare_audited_record();

drop trigger if exists rg_20_validate_scope on public.rg_quality_improvement_items;
create trigger rg_20_validate_scope
before insert or update on public.rg_quality_improvement_items
for each row execute function private.rg_validate_record_scope();

drop trigger if exists rg_10_prepare_change on public.rg_bright_ideas;
create trigger rg_10_prepare_change
before insert or update on public.rg_bright_ideas
for each row execute function private.rg_prepare_audited_record();

drop trigger if exists rg_20_validate_scope on public.rg_bright_ideas;
create trigger rg_20_validate_scope
before insert or update on public.rg_bright_ideas
for each row execute function private.rg_validate_record_scope();

drop trigger if exists rg_10_prepare_change on public.rg_record_links;
create trigger rg_10_prepare_change
before insert or update on public.rg_record_links
for each row execute function private.rg_prepare_audited_record();

drop trigger if exists rg_20_validate_scope on public.rg_record_links;
create trigger rg_20_validate_scope
before insert or update on public.rg_record_links
for each row execute function private.rg_validate_record_scope();

drop trigger if exists rg_30_validate_link_scope on public.rg_record_links;
create trigger rg_30_validate_link_scope
before insert or update on public.rg_record_links
for each row execute function private.rg_validate_link_scope();

drop trigger if exists rg_10_prepare_review on public.rg_risk_reviews;
create trigger rg_10_prepare_review
before insert on public.rg_risk_reviews
for each row execute function private.rg_prepare_review();

drop trigger if exists rg_20_validate_scope on public.rg_risk_reviews;
create trigger rg_20_validate_scope
before insert on public.rg_risk_reviews
for each row execute function private.rg_validate_record_scope();

drop trigger if exists rg_30_validate_review_scope on public.rg_risk_reviews;
create trigger rg_30_validate_review_scope
before insert on public.rg_risk_reviews
for each row execute function private.rg_validate_review_scope();

drop trigger if exists rg_10_prepare_comment on public.rg_comments;
create trigger rg_10_prepare_comment
before insert on public.rg_comments
for each row execute function private.rg_prepare_comment();

drop trigger if exists rg_20_validate_scope on public.rg_comments;
create trigger rg_20_validate_scope
before insert on public.rg_comments
for each row execute function private.rg_validate_record_scope();

drop trigger if exists rg_30_validate_comment_scope on public.rg_comments;
create trigger rg_30_validate_comment_scope
before insert on public.rg_comments
for each row execute function private.rg_validate_comment_scope();

-- ---------------------------------------------------------------------------
-- Field-level immutable audit history.
-- ---------------------------------------------------------------------------

alter table public.rg_audit_log
  add column if not exists record_type text,
  add column if not exists record_reference text,
  add column if not exists record_title text,
  add column if not exists field_name text,
  add column if not exists previous_value jsonb,
  add column if not exists new_value jsonb,
  add column if not exists reason text,
  add column if not exists association_id uuid
    references public.associations(id) on delete set null,
  add column if not exists club_id uuid
    references public.clubs(id) on delete set null,
  add column if not exists team_id uuid
    references public.teams(id) on delete set null,
  add column if not exists related_record_type text,
  add column if not exists related_record_id uuid,
  add column if not exists related_record_reference text,
  add column if not exists related_record_title text;

create index if not exists rg_audit_scope_changed_idx
  on public.rg_audit_log (
    association_id,
    club_id,
    team_id,
    changed_at desc
  );

create index if not exists rg_audit_record_idx
  on public.rg_audit_log (table_name, record_id, changed_at desc);

create index if not exists rg_audit_user_action_idx
  on public.rg_audit_log (user_id, action, changed_at desc);

create or replace function private.rg_write_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_row jsonb;
  v_old_data jsonb;
  v_new_data jsonb;
  v_record_id uuid;
  v_record_type text;
  v_record_reference text;
  v_record_title text;
  v_reason text;
  v_association_id uuid;
  v_club_id uuid;
  v_team_id uuid;
  v_related_record_type text;
  v_related_record_id uuid;
  v_related_record_reference text;
  v_related_record_title text;
  v_field text;
begin
  if tg_op = 'DELETE' then
    v_old_data := to_jsonb(old);
    v_new_data := null;
    v_row := v_old_data;
  elsif tg_op = 'INSERT' then
    v_old_data := null;
    v_new_data := to_jsonb(new);
    v_row := v_new_data;
  else
    v_old_data := to_jsonb(old);
    v_new_data := to_jsonb(new);
    v_row := v_new_data;
  end if;

  v_record_id := nullif(v_row ->> 'id', '')::uuid;
  v_reason := coalesce(
    nullif(trim(v_row ->> 'last_change_reason'), ''),
    nullif(trim(v_row ->> 'review_reason'), ''),
    'System change'
  );
  v_association_id := nullif(v_row ->> 'association_id', '')::uuid;
  v_club_id := nullif(v_row ->> 'club_id', '')::uuid;
  v_team_id := nullif(v_row ->> 'team_id', '')::uuid;

  case tg_table_name
    when 'rg_risk_register' then
      v_record_type := 'Risk';
      v_record_reference := 'R-' || lpad(v_row ->> 'display_number', 3, '0');
      v_record_title := v_row ->> 'title';
    when 'rg_be_smart_actions' then
      v_record_type := 'Action';
      v_record_reference := 'A-' || lpad(v_row ->> 'display_number', 3, '0');
      v_record_title := v_row ->> 'title';
    when 'rg_quality_improvement_items' then
      v_record_type := 'QI';
      v_record_reference := 'QI-' || lpad(v_row ->> 'display_number', 3, '0');
      v_record_title := v_row ->> 'title';
    when 'rg_bright_ideas' then
      v_record_type := 'Bright Idea';
      v_record_reference := 'BI-' || lpad(v_row ->> 'display_number', 3, '0');
      v_record_title := v_row ->> 'title';
    when 'rg_risk_reviews' then
      v_record_type := 'Risk Review';
      select
        'R-' || lpad(r.display_number::text, 3, '0'),
        r.title,
        r.id
      into
        v_record_reference,
        v_record_title,
        v_related_record_id
      from public.rg_risk_register r
      where r.id = nullif(v_row ->> 'risk_id', '')::uuid;
      v_related_record_type := 'Risk';
      v_related_record_reference := v_record_reference;
      v_related_record_title := v_record_title;
    when 'rg_record_links' then
      v_record_type := 'Link';
      v_record_reference := 'LINK-' || upper(substring(v_record_id::text from 1 for 8));
      v_record_title := 'Linked Safety Hub records';
    when 'rg_risk_settings' then
      v_record_type := 'Settings';
      v_record_reference := 'SETTINGS-' || upper(substring(v_record_id::text from 1 for 8));
      v_record_title := v_row ->> 'name';
    when 'rg_risk_matrix' then
      v_record_type := 'Settings';
      v_record_reference := 'MATRIX-' || upper(substring(v_record_id::text from 1 for 8));
      v_record_title := format(
        'Likelihood %s / consequence %s',
        v_row ->> 'likelihood',
        v_row ->> 'consequence'
      );
    when 'rg_risk_guidance_sections' then
      v_record_type := 'Settings';
      v_record_reference := 'GUIDANCE-' || upper(substring(v_record_id::text from 1 for 8));
      v_record_title := v_row ->> 'title';
    when 'rg_dropdown_values' then
      v_record_type := 'Settings';
      v_record_reference := 'OPTION-' || upper(substring(v_record_id::text from 1 for 8));
      v_record_title := v_row ->> 'label';
    when 'rg_comments' then
      v_record_type := 'Comment';
      v_record_reference := 'COMMENT-' || upper(substring(v_record_id::text from 1 for 8));
      v_record_title := 'Safety Hub comment';
    else
      v_record_type := 'Safety Hub';
      v_record_reference := upper(substring(v_record_id::text from 1 for 8));
      v_record_title := tg_table_name;
  end case;

  if tg_table_name in (
    'rg_risk_matrix',
    'rg_risk_guidance_sections',
    'rg_dropdown_values'
  ) then
    select s.association_id, s.club_id
    into v_association_id, v_club_id
    from public.rg_risk_settings s
    where s.id = nullif(v_row ->> 'settings_id', '')::uuid;
  end if;

  if tg_table_name = 'rg_be_smart_actions'
     and nullif(v_row ->> 'risk_id', '') is not null then
    select
      'Risk',
      r.id,
      'R-' || lpad(r.display_number::text, 3, '0'),
      r.title
    into
      v_related_record_type,
      v_related_record_id,
      v_related_record_reference,
      v_related_record_title
    from public.rg_risk_register r
    where r.id = (v_row ->> 'risk_id')::uuid;
  end if;

  if tg_table_name = 'rg_record_links' then
    if nullif(v_row ->> 'risk_id', '') is not null then
      select
        'Risk',
        r.id,
        'R-' || lpad(r.display_number::text, 3, '0'),
        r.title
      into
        v_related_record_type,
        v_related_record_id,
        v_related_record_reference,
        v_related_record_title
      from public.rg_risk_register r
      where r.id = (v_row ->> 'risk_id')::uuid;
    elsif nullif(v_row ->> 'action_id', '') is not null then
      select
        'Action',
        a.id,
        'A-' || lpad(a.display_number::text, 3, '0'),
        a.title
      into
        v_related_record_type,
        v_related_record_id,
        v_related_record_reference,
        v_related_record_title
      from public.rg_be_smart_actions a
      where a.id = (v_row ->> 'action_id')::uuid;
    elsif nullif(v_row ->> 'qi_item_id', '') is not null then
      select
        'QI',
        q.id,
        'QI-' || lpad(q.display_number::text, 3, '0'),
        q.title
      into
        v_related_record_type,
        v_related_record_id,
        v_related_record_reference,
        v_related_record_title
      from public.rg_quality_improvement_items q
      where q.id = (v_row ->> 'qi_item_id')::uuid;
    elsif nullif(v_row ->> 'bright_idea_id', '') is not null then
      select
        'Bright Idea',
        b.id,
        'BI-' || lpad(b.display_number::text, 3, '0'),
        b.title
      into
        v_related_record_type,
        v_related_record_id,
        v_related_record_reference,
        v_related_record_title
      from public.rg_bright_ideas b
      where b.id = (v_row ->> 'bright_idea_id')::uuid;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    for v_field in
      select changed.key
      from jsonb_object_keys(v_new_data) as changed(key)
      where changed.key not in (
        'updated_at',
        'updated_by',
        'last_change_reason'
      )
        and (v_old_data -> changed.key)
          is distinct from (v_new_data -> changed.key)
    loop
      insert into public.rg_audit_log (
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        record_type,
        record_reference,
        record_title,
        field_name,
        previous_value,
        new_value,
        reason,
        association_id,
        club_id,
        team_id,
        related_record_type,
        related_record_id,
        related_record_reference,
        related_record_title
      )
      values (
        auth.uid(),
        tg_op,
        tg_table_name,
        v_record_id,
        v_old_data,
        v_new_data,
        v_record_type,
        v_record_reference,
        v_record_title,
        v_field,
        v_old_data -> v_field,
        v_new_data -> v_field,
        v_reason,
        v_association_id,
        v_club_id,
        v_team_id,
        v_related_record_type,
        v_related_record_id,
        v_related_record_reference,
        v_related_record_title
      );
    end loop;
  else
    insert into public.rg_audit_log (
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data,
      record_type,
      record_reference,
      record_title,
      field_name,
      previous_value,
      new_value,
      reason,
      association_id,
      club_id,
      team_id,
      related_record_type,
      related_record_id,
      related_record_reference,
      related_record_title
    )
    values (
      auth.uid(),
      tg_op,
      tg_table_name,
      v_record_id,
      v_old_data,
      v_new_data,
      v_record_type,
      v_record_reference,
      v_record_title,
      case when tg_op = 'INSERT' then 'Record created' else 'Record removed' end,
      case when tg_op = 'DELETE' then to_jsonb('Present'::text) else null end,
      case when tg_op = 'INSERT' then to_jsonb('Created'::text) else null end,
      v_reason,
      v_association_id,
      v_club_id,
      v_team_id,
      v_related_record_type,
      v_related_record_id,
      v_related_record_reference,
      v_related_record_title
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$function$;

create or replace function private.rg_prevent_immutable_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  raise exception using
    errcode = 'P0001',
    message = 'SAFETY_HUB_RECORD_IMMUTABLE';
end
$function$;

revoke all on function private.rg_write_audit()
  from public, anon, authenticated;
revoke all on function private.rg_prevent_immutable_changes()
  from public, anon, authenticated;

drop trigger if exists rg_audit_log_immutable on public.rg_audit_log;
create trigger rg_audit_log_immutable
before update or delete on public.rg_audit_log
for each row execute function private.rg_prevent_immutable_changes();

drop trigger if exists rg_risk_reviews_immutable on public.rg_risk_reviews;
create trigger rg_risk_reviews_immutable
before update or delete on public.rg_risk_reviews
for each row execute function private.rg_prevent_immutable_changes();

drop trigger if exists rg_comments_immutable on public.rg_comments;
create trigger rg_comments_immutable
before update or delete on public.rg_comments
for each row execute function private.rg_prevent_immutable_changes();

drop trigger if exists rg_90_audit on public.rg_risk_settings;
create trigger rg_90_audit
after insert or update on public.rg_risk_settings
for each row execute function private.rg_write_audit();

drop trigger if exists rg_90_audit on public.rg_risk_matrix;
create trigger rg_90_audit
after insert or update on public.rg_risk_matrix
for each row execute function private.rg_write_audit();

drop trigger if exists rg_90_audit on public.rg_risk_guidance_sections;
create trigger rg_90_audit
after insert or update on public.rg_risk_guidance_sections
for each row execute function private.rg_write_audit();

drop trigger if exists rg_90_audit on public.rg_dropdown_values;
create trigger rg_90_audit
after insert or update on public.rg_dropdown_values
for each row execute function private.rg_write_audit();

drop trigger if exists rg_90_audit on public.rg_risk_register;
create trigger rg_90_audit
after insert or update on public.rg_risk_register
for each row execute function private.rg_write_audit();

drop trigger if exists rg_90_audit on public.rg_be_smart_actions;
create trigger rg_90_audit
after insert or update on public.rg_be_smart_actions
for each row execute function private.rg_write_audit();

drop trigger if exists rg_90_audit on public.rg_quality_improvement_items;
create trigger rg_90_audit
after insert or update on public.rg_quality_improvement_items
for each row execute function private.rg_write_audit();

drop trigger if exists rg_90_audit on public.rg_bright_ideas;
create trigger rg_90_audit
after insert or update on public.rg_bright_ideas
for each row execute function private.rg_write_audit();

drop trigger if exists rg_90_audit on public.rg_record_links;
create trigger rg_90_audit
after insert or update or delete on public.rg_record_links
for each row execute function private.rg_write_audit();

drop trigger if exists rg_90_audit on public.rg_risk_reviews;
create trigger rg_90_audit
after insert on public.rg_risk_reviews
for each row execute function private.rg_write_audit();

drop trigger if exists rg_90_audit on public.rg_comments;
create trigger rg_90_audit
after insert on public.rg_comments
for each row execute function private.rg_write_audit();

-- ---------------------------------------------------------------------------
-- Scoped access helpers.
-- ---------------------------------------------------------------------------

create index if not exists user_roles_safety_scope_idx
  on public.user_roles (user_id, role, association_id, club_id);

create or replace function private.rg_is_safety_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role::text in (
        'SUPER_ADMIN',
        'ASSOCIATION_ADMIN',
        'CLUB_ADMIN'
      )
  );
$function$;

create or replace function private.rg_can_read_scope(
  p_association_id uuid,
  p_club_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.user_roles ur
    left join public.clubs admin_club on admin_club.id = ur.club_id
    where ur.user_id = (select auth.uid())
      and (
        ur.role::text = 'SUPER_ADMIN'
        or (
          ur.role::text = 'ASSOCIATION_ADMIN'
          and ur.association_id = p_association_id
        )
        or (
          ur.role::text = 'CLUB_ADMIN'
          and (
            ur.club_id = p_club_id
            or (
              p_club_id is null
              and admin_club.association_id = p_association_id
            )
          )
        )
      )
  );
$function$;

create or replace function private.rg_can_manage_scope(
  p_association_id uuid,
  p_club_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and (
        ur.role::text = 'SUPER_ADMIN'
        or (
          ur.role::text = 'ASSOCIATION_ADMIN'
          and ur.association_id = p_association_id
        )
        or (
          ur.role::text = 'CLUB_ADMIN'
          and p_club_id is not null
          and ur.club_id = p_club_id
        )
      )
  );
$function$;

create or replace function private.rg_can_read_settings(
  p_settings_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.rg_risk_settings s
    join public.user_roles ur on ur.user_id = (select auth.uid())
    left join public.clubs admin_club on admin_club.id = ur.club_id
    where s.id = p_settings_id
      and (
        ur.role::text = 'SUPER_ADMIN'
        or (
          s.scope_level = 'GLOBAL'
          and ur.role::text in ('ASSOCIATION_ADMIN', 'CLUB_ADMIN')
        )
        or (
          s.scope_level = 'ASSOCIATION'
          and (
            (
              ur.role::text = 'ASSOCIATION_ADMIN'
              and ur.association_id = s.association_id
            )
            or (
              ur.role::text = 'CLUB_ADMIN'
              and admin_club.association_id = s.association_id
            )
          )
        )
        or (
          s.scope_level = 'CLUB'
          and (
            (
              ur.role::text = 'ASSOCIATION_ADMIN'
              and ur.association_id = s.association_id
            )
            or (
              ur.role::text = 'CLUB_ADMIN'
              and ur.club_id = s.club_id
            )
          )
        )
      )
  );
$function$;

create or replace function private.rg_can_manage_settings(
  p_settings_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.rg_risk_settings s
    join public.user_roles ur on ur.user_id = (select auth.uid())
    where s.id = p_settings_id
      and (
        ur.role::text = 'SUPER_ADMIN'
        or (
          s.scope_level in ('ASSOCIATION', 'CLUB')
          and ur.role::text = 'ASSOCIATION_ADMIN'
          and ur.association_id = s.association_id
        )
        or (
          s.scope_level = 'CLUB'
          and ur.role::text = 'CLUB_ADMIN'
          and ur.club_id = s.club_id
        )
      )
  );
$function$;

revoke all on function private.rg_is_safety_admin()
  from public, anon, authenticated;
revoke all on function private.rg_can_read_scope(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.rg_can_manage_scope(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.rg_can_read_settings(uuid)
  from public, anon, authenticated;
revoke all on function private.rg_can_manage_settings(uuid)
  from public, anon, authenticated;

grant execute on function private.rg_is_safety_admin()
  to authenticated;
grant execute on function private.rg_can_read_scope(uuid, uuid, uuid)
  to authenticated;
grant execute on function private.rg_can_manage_scope(uuid, uuid, uuid)
  to authenticated;
grant execute on function private.rg_can_read_settings(uuid)
  to authenticated;
grant execute on function private.rg_can_manage_settings(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Data API privileges: least privilege, with no record deletes.
-- ---------------------------------------------------------------------------

revoke all on public.rg_risk_settings
  from public, anon, authenticated;
revoke all on public.rg_risk_matrix
  from public, anon, authenticated;
revoke all on public.rg_risk_guidance_sections
  from public, anon, authenticated;
revoke all on public.rg_dropdown_values
  from public, anon, authenticated;
revoke all on public.rg_risk_register
  from public, anon, authenticated;
revoke all on public.rg_be_smart_actions
  from public, anon, authenticated;
revoke all on public.rg_quality_improvement_items
  from public, anon, authenticated;
revoke all on public.rg_bright_ideas
  from public, anon, authenticated;
revoke all on public.rg_record_links
  from public, anon, authenticated;
revoke all on public.rg_risk_reviews
  from public, anon, authenticated;
revoke all on public.rg_comments
  from public, anon, authenticated;
revoke all on public.rg_audit_log
  from public, anon, authenticated;

grant select, insert, update on public.rg_risk_settings
  to authenticated;
grant select, insert, update on public.rg_risk_matrix
  to authenticated;
grant select, insert, update on public.rg_risk_guidance_sections
  to authenticated;
grant select, insert, update on public.rg_dropdown_values
  to authenticated;
grant select, insert, update on public.rg_risk_register
  to authenticated;
grant select, insert, update on public.rg_be_smart_actions
  to authenticated;
grant select, insert, update on public.rg_quality_improvement_items
  to authenticated;
grant select, insert, update on public.rg_bright_ideas
  to authenticated;
grant select, insert, update on public.rg_record_links
  to authenticated;
grant select, insert on public.rg_risk_reviews
  to authenticated;
grant select, insert on public.rg_comments
  to authenticated;
grant select on public.rg_audit_log
  to authenticated;

grant all on public.rg_risk_settings to service_role;
grant all on public.rg_risk_matrix to service_role;
grant all on public.rg_risk_guidance_sections to service_role;
grant all on public.rg_dropdown_values to service_role;
grant all on public.rg_risk_register to service_role;
grant all on public.rg_be_smart_actions to service_role;
grant all on public.rg_quality_improvement_items to service_role;
grant all on public.rg_bright_ideas to service_role;
grant all on public.rg_record_links to service_role;
grant all on public.rg_risk_reviews to service_role;
grant all on public.rg_comments to service_role;
grant all on public.rg_audit_log to service_role;

revoke all on sequence public.rg_risk_register_display_number_seq
  from public, anon;
revoke all on sequence public.rg_be_smart_actions_display_number_seq
  from public, anon;
revoke all on sequence public.rg_quality_improvement_items_display_number_seq
  from public, anon;
revoke all on sequence public.rg_bright_ideas_display_number_seq
  from public, anon;

grant usage, select on sequence public.rg_risk_register_display_number_seq
  to authenticated, service_role;
grant usage, select on sequence public.rg_be_smart_actions_display_number_seq
  to authenticated, service_role;
grant usage, select on sequence public.rg_quality_improvement_items_display_number_seq
  to authenticated, service_role;
grant usage, select on sequence public.rg_bright_ideas_display_number_seq
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Replace broad authenticated-read policies with organisation-scoped RLS.
-- ---------------------------------------------------------------------------

alter table public.rg_risk_settings enable row level security;
alter table public.rg_risk_matrix enable row level security;
alter table public.rg_risk_guidance_sections enable row level security;
alter table public.rg_dropdown_values enable row level security;
alter table public.rg_risk_register enable row level security;
alter table public.rg_be_smart_actions enable row level security;
alter table public.rg_quality_improvement_items enable row level security;
alter table public.rg_bright_ideas enable row level security;
alter table public.rg_record_links enable row level security;
alter table public.rg_risk_reviews enable row level security;
alter table public.rg_comments enable row level security;
alter table public.rg_audit_log enable row level security;

drop policy if exists rg_audit_admin on public.rg_audit_log;
drop policy if exists rg_actions_read on public.rg_be_smart_actions;
drop policy if exists rg_actions_write on public.rg_be_smart_actions;
drop policy if exists rg_comments_insert on public.rg_comments;
drop policy if exists rg_comments_read on public.rg_comments;
drop policy if exists rg_dropdown_read on public.rg_dropdown_values;
drop policy if exists rg_qi_read on public.rg_quality_improvement_items;
drop policy if exists rg_guidance_read on public.rg_risk_guidance_sections;
drop policy if exists rg_matrix_read on public.rg_risk_matrix;
drop policy if exists rg_register_read on public.rg_risk_register;
drop policy if exists rg_register_write on public.rg_risk_register;
drop policy if exists rg_reviews_insert on public.rg_risk_reviews;
drop policy if exists rg_reviews_read on public.rg_risk_reviews;

create policy rg_risk_settings_scoped_select
on public.rg_risk_settings
for select
to authenticated
using (private.rg_can_read_settings(id));

create policy rg_risk_settings_scoped_insert
on public.rg_risk_settings
for insert
to authenticated
with check (
  private.rg_can_manage_scope(association_id, club_id, null)
  and created_by = (select auth.uid())
);

create policy rg_risk_settings_scoped_update
on public.rg_risk_settings
for update
to authenticated
using (private.rg_can_manage_settings(id))
with check (
  private.rg_can_manage_scope(association_id, club_id, null)
  and updated_by = (select auth.uid())
);

create policy rg_matrix_scoped_select
on public.rg_risk_matrix
for select
to authenticated
using (private.rg_can_read_settings(settings_id));

create policy rg_matrix_scoped_insert
on public.rg_risk_matrix
for insert
to authenticated
with check (
  private.rg_can_manage_settings(settings_id)
  and created_by = (select auth.uid())
);

create policy rg_matrix_scoped_update
on public.rg_risk_matrix
for update
to authenticated
using (private.rg_can_manage_settings(settings_id))
with check (
  private.rg_can_manage_settings(settings_id)
  and updated_by = (select auth.uid())
);

create policy rg_guidance_scoped_select
on public.rg_risk_guidance_sections
for select
to authenticated
using (private.rg_can_read_settings(settings_id));

create policy rg_guidance_scoped_insert
on public.rg_risk_guidance_sections
for insert
to authenticated
with check (
  private.rg_can_manage_settings(settings_id)
  and created_by = (select auth.uid())
);

create policy rg_guidance_scoped_update
on public.rg_risk_guidance_sections
for update
to authenticated
using (private.rg_can_manage_settings(settings_id))
with check (
  private.rg_can_manage_settings(settings_id)
  and updated_by = (select auth.uid())
);

create policy rg_dropdown_scoped_select
on public.rg_dropdown_values
for select
to authenticated
using (private.rg_can_read_settings(settings_id));

create policy rg_dropdown_scoped_insert
on public.rg_dropdown_values
for insert
to authenticated
with check (
  private.rg_can_manage_settings(settings_id)
  and created_by = (select auth.uid())
);

create policy rg_dropdown_scoped_update
on public.rg_dropdown_values
for update
to authenticated
using (private.rg_can_manage_settings(settings_id))
with check (
  private.rg_can_manage_settings(settings_id)
  and updated_by = (select auth.uid())
);

create policy rg_register_scoped_select
on public.rg_risk_register
for select
to authenticated
using (private.rg_can_read_scope(association_id, club_id, team_id));

create policy rg_register_scoped_insert
on public.rg_risk_register
for insert
to authenticated
with check (
  private.rg_can_manage_scope(association_id, club_id, team_id)
  and created_by = (select auth.uid())
);

create policy rg_register_scoped_update
on public.rg_risk_register
for update
to authenticated
using (private.rg_can_manage_scope(association_id, club_id, team_id))
with check (
  private.rg_can_manage_scope(association_id, club_id, team_id)
  and updated_by = (select auth.uid())
);

create policy rg_actions_scoped_select
on public.rg_be_smart_actions
for select
to authenticated
using (private.rg_can_read_scope(association_id, club_id, team_id));

create policy rg_actions_scoped_insert
on public.rg_be_smart_actions
for insert
to authenticated
with check (
  private.rg_can_manage_scope(association_id, club_id, team_id)
  and created_by = (select auth.uid())
);

create policy rg_actions_scoped_update
on public.rg_be_smart_actions
for update
to authenticated
using (private.rg_can_manage_scope(association_id, club_id, team_id))
with check (
  private.rg_can_manage_scope(association_id, club_id, team_id)
  and updated_by = (select auth.uid())
);

create policy rg_qi_scoped_select
on public.rg_quality_improvement_items
for select
to authenticated
using (private.rg_can_read_scope(association_id, club_id, team_id));

create policy rg_qi_scoped_insert
on public.rg_quality_improvement_items
for insert
to authenticated
with check (
  private.rg_can_manage_scope(association_id, club_id, team_id)
  and created_by = (select auth.uid())
);

create policy rg_qi_scoped_update
on public.rg_quality_improvement_items
for update
to authenticated
using (private.rg_can_manage_scope(association_id, club_id, team_id))
with check (
  private.rg_can_manage_scope(association_id, club_id, team_id)
  and updated_by = (select auth.uid())
);

create policy rg_bright_ideas_scoped_select
on public.rg_bright_ideas
for select
to authenticated
using (private.rg_can_read_scope(association_id, club_id, team_id));

create policy rg_bright_ideas_scoped_insert
on public.rg_bright_ideas
for insert
to authenticated
with check (
  private.rg_can_manage_scope(association_id, club_id, team_id)
  and submitted_by = (select auth.uid())
  and created_by = (select auth.uid())
);

create policy rg_bright_ideas_scoped_update
on public.rg_bright_ideas
for update
to authenticated
using (private.rg_can_manage_scope(association_id, club_id, team_id))
with check (
  private.rg_can_manage_scope(association_id, club_id, team_id)
  and updated_by = (select auth.uid())
);

create policy rg_links_scoped_select
on public.rg_record_links
for select
to authenticated
using (private.rg_can_read_scope(association_id, club_id, team_id));

create policy rg_links_scoped_insert
on public.rg_record_links
for insert
to authenticated
with check (
  private.rg_can_manage_scope(association_id, club_id, team_id)
  and created_by = (select auth.uid())
);

create policy rg_links_scoped_update
on public.rg_record_links
for update
to authenticated
using (private.rg_can_manage_scope(association_id, club_id, team_id))
with check (
  private.rg_can_manage_scope(association_id, club_id, team_id)
  and updated_by = (select auth.uid())
);

create policy rg_reviews_scoped_select
on public.rg_risk_reviews
for select
to authenticated
using (private.rg_can_read_scope(association_id, club_id, team_id));

create policy rg_reviews_scoped_insert
on public.rg_risk_reviews
for insert
to authenticated
with check (
  private.rg_can_manage_scope(association_id, club_id, team_id)
  and reviewed_by = (select auth.uid())
);

create policy rg_comments_scoped_select
on public.rg_comments
for select
to authenticated
using (private.rg_can_read_scope(association_id, club_id, team_id));

create policy rg_comments_scoped_insert
on public.rg_comments
for insert
to authenticated
with check (
  private.rg_can_manage_scope(association_id, club_id, team_id)
  and user_id = (select auth.uid())
);

create policy rg_audit_scoped_select
on public.rg_audit_log
for select
to authenticated
using (
  private.rg_can_read_scope(association_id, club_id, team_id)
  or (
    association_id is null
    and club_id is null
    and team_id is null
    and private.rg_is_safety_admin()
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role::text = 'SUPER_ADMIN'
    )
  )
);

-- This migration intentionally does not:
-- - insert final matrix guidance or category values;
-- - seed Safety Hub test records;
-- - grant Safety Hub access to Team Managers, Coaches or ordinary members;
-- - create a member-facing Bright Idea submission route;
-- - apply or deploy itself to any Supabase project.

# Safety Hub Database Integration Plan

Status: database migration applied to Dev and Production on 18 July 2026;
Dev-only test data and the local read-only frontend connection are complete

Migration source:

- `supabase/migrations/20260718181341_safety_hub_database_integration.sql`

The database foundation for the approved `/admin/safety-risk` mock prototype is
now present in both SportStack Supabase projects. The local UI reads scoped
register, link, matrix and audit data from Supabase. Forms remain local-only and
do not write to Supabase. This does not approve the final risk matrix values or
claim that form writes or settings screens are connected.

Applied migration history:

- Dev: `20260718085105 safety_hub_database_integration`
- Production: `20260718085414 safety_hub_database_integration`

## Confirmed Pre-Migration State

The read-only Dev audit on 18 July 2026 confirmed:

- The local app and Supabase CLI point to the SportStack Dev project.
- Nine existing `rg_*` tables have RLS enabled.
- All Safety record tables are empty. Only `rg_risk_matrix` has data (25 rows).
- There is no Bright Ideas table.
- Actions must currently belong to one risk.
- There is no general link table for risks, actions, QI items and Bright Ideas.
- Risk, Action and QI tables do not contain the fields required by the approved
  forms and drawers.
- Matrix guidance and dropdown tables are empty and are not organisation scoped.
- The audit table has no triggers, so normal record changes do not create audit
  events.
- Existing read policies allow every signed-in user to read Safety records
  across all organisations. This does not match the SportStack scope model.

Connecting the current UI directly would either hide approved fields, lose data,
show empty registers, or expose records outside the selected organisation.

## Recommended First Permission Model

- Super Admin: manage all Safety Hub records and settings.
- Association Admin: manage records and settings for their association.
- Club Admin: manage records and club overrides for their club.
- Team Manager and Coach: no Safety Hub admin access in the first live package.
- Other signed-in users: no Safety Hub register access in the first live package.
- Member Bright Idea submission: keep as a separate later access decision rather
  than exposing the full admin register.

Every policy should use `user_roles` and the record's association, club or team
scope. The current global authenticated-read policies should be replaced.

## Required Schema Package

### 1. Risk Register

Keep `rg_risk_register` and add the approved prototype fields:

- Stable display number for `R-001` style references.
- Risk type, risk event and consequences.
- Separate inherent and residual likelihood and consequence values.
- Target rating.
- Existing controls and treatment plan.
- Review frequency, next review date and evidence.
- Created by, updated by and last change reason.

Keep the current UUID as the database key. The display number is for people.

### 2. BE SMART Actions

Keep `rg_be_smart_actions` and add:

- Stable `A-001` style display number.
- Organisation scope fields.
- Title, baseline and evaluation.
- Specific, measurable, achievable, relevant and time-bound fields.
- Resources or support needed.
- Created by, updated by and last change reason.

Make the current `risk_id` optional. Relationships should be managed through the
link table so an action can be independent or linked to a risk and a QI item.

### 3. QI Register

Keep `rg_quality_improvement_items` and add:

- Stable `QI-001` style display number.
- Team scope where applicable.
- Source, area, owner, priority and due date.
- Issue or opportunity, required action and outcome.
- Created by, updated by and last change reason.

Expand the current status values to support the approved QI workflow without
removing existing enum values.

### 4. Bright Ideas

Create `rg_bright_ideas` with:

- Stable `BI-001` style display number.
- Association, club and optional team scope.
- Submitter and submitted date.
- Title, why needed, suggested implementation and evaluation.
- Who could assist and other information.
- Workflow status, committee decision, discussion and decision reason.
- Created by, updated by and last change reason.

Committee review stays attached to the Bright Idea rather than becoming a
separate top-level record.

### 5. Linked Records

Create `rg_record_links` with real foreign keys to the Risk, Action, QI and
Bright Idea tables.

Each link must connect exactly two different record types. Store:

- Link reason or notes.
- Active state so unlinking is an audited update rather than a hard delete.
- Created by and created date.
- Organisation scope copied for secure filtering.

This supports the expandable associated-record summaries and clickable links
without relying on text IDs.

### 6. Reviews and Audit

Extend `rg_risk_reviews` with:

- Next review date.
- Residual likelihood and consequence snapshot.
- Evidence or follow-up.
- Review reason.

Extend `rg_audit_log` with:

- Record type and display reference.
- Field changed.
- Previous and new values.
- Reason.
- Association, club and team scope.
- Related record details.

Add database triggers so Safety record changes create immutable audit events.
The UI must supply a change reason when saving. Normal users should not be able
to update or delete audit rows.

### 7. Organisation Settings

Create one Safety settings profile for each supported scope:

- Global default maintained by Super Admin.
- Association override maintained by Association Admin.
- Club override maintained by Club Admin.

Club settings inherit from the association unless a club override exists.
Team-level matrix overrides are out of scope for the first package.

Attach existing matrix, guidance and dropdown records to a settings profile:

- Five likelihood definitions.
- Five consequence definitions.
- Matrix cells and rating colours.
- Rating response guidance.
- Review guidance.
- Editable risk categories.

The existing 25 matrix rows remain provisional. This package must not describe
their current values as approved.

## Delivery Steps and Pulse Checks

### Step 1 - Migration Draft

Status: complete.

- Create one additive migration file using the Supabase CLI.
- Include preflight checks and data-preserving backfills.
- Include explicit Data API grants and scoped RLS policies.
- Keep it review-only until approval is recorded.

Pulse check:

- Review the table changes, permission model and migration SQL.
- Confirm no Production project is targeted.

### Step 2 - Apply to Dev

Status: complete for the current Super Admin read-only connection. Generated
TypeScript types were refreshed from Dev. Association Admin and Club Admin
browser testing remains part of release readiness.

- Apply the approved migration to SportStack Dev before Production.
- Regenerate Supabase TypeScript types.
- Run Supabase security and performance advisors.

Pulse check:

- Confirm tables, columns, foreign keys, policies and triggers.
- Confirm Association and Club Admin scope tests.

### Step 3 - Tagged Dev Test Data

Status: complete.

- Insert a small, clearly labelled Safety Hub test set into Dev only.
- Include one complete Bright Idea to QI to Risk to Action chain.
- Include one overdue review and one audit-producing edit.

Pulse check:

- Confirm the records and links directly in Dev.
- Confirm no Production rows changed.

Result:

- Dev contains one `[DEV TEST]` Bright Idea, QI item, Risk and Action chain,
  four links, one overdue review and an audited control update.
- Production remains empty across the Safety Hub record, link and review
  tables.

### Step 4 - Read-Only UI Connection

Status: complete locally; not committed, pushed or deployed.

- Replace mock register and dashboard arrays with scoped Supabase reads.
- Keep forms disabled until reads, filters, drawers and links are verified.
- Show a clear Dev/test-data label.

Pulse check:

- Dashboard totals match Dev queries.
- All registers, drawers, links, matrix settings and audit rows match Dev.

Result:

- The dashboard, registers, associated-record summaries, matrix and audit
  history use scoped Supabase reads.
- The UI clearly states that the connection is read-only.
- Prototype forms use `Validate draft` and do not perform Supabase writes.
- Super Admin browser checks passed against the Dev test chain.

### Step 5 - Forms and Reviews

- Connect create and edit forms.
- Require a save reason for edits.
- Connect risk reviews, committee Bright Idea reviews and link management.
- Add unsaved-change warnings.

Pulse check:

- Create, edit, review and link one Dev test chain.
- Confirm audit rows contain old value, new value, user, scope and reason.

### Step 6 - Settings Screen

- Add Association and Club Admin settings for definitions, responses,
  categories and review guidance.
- Show when a club is inheriting association settings.

Pulse check:

- Change a Dev club override and confirm only that club is affected.
- Restore inheritance and confirm the association value returns.

### Step 7 - Release Readiness

- Run focused lint, TypeScript, build and browser checks.
- Test Super Admin, Association Admin and Club Admin access.
- Confirm mobile and tablet behaviour.
- Update `docs/current-state.md` after the package is verified.

The Production database migration was separately approved and applied on
18 July 2026. No Production Safety Hub record seeding, frontend deployment or
live form write was included.

## Current Approval Gate

The next action requiring Aaron's approval is:

> Commit and push the read-only Safety Hub connection through the normal
> `dev`-first workflow, then test Association Admin and Club Admin scope before
> enabling any form writes.

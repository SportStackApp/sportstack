# Main-to-Production reconciliation map — 6 September 2026

## Decision

**Stage 1 inventory is complete. The broad Main branch is not safe to merge directly to
Production.** Production remains unchanged at `a1d23c7`.

This review was read-only. It inspected Git, the public Production database schema, Supabase
migration history, deployed Edge Function metadata/source and current GitHub workflow runs. It did
not read table data, print a credential, apply a migration, deploy a function, change a workflow or
move the `prod` branch.

## Frozen comparison

| Item | Value |
| --- | --- |
| Dev | `dcd6f4243c94794a13c9494f125ed7178b0c4841` |
| Main | `af21ae3c06a2d66d2eb9c4edf64bb2c185869927` |
| Production | `a1d23c741b79de02c32763a879597192a1c1ebd5` |
| Main-only commits | 266 |
| Production-only commits | 1 |
| Changed paths | 438 |
| Changed application paths under `src` | 221 |
| Changed migration paths | 115: 114 Main-only and 1 Production-only |
| Changed Edge Function files | 15 |
| Changed workflow files | 3 |

The one Production-only migration is
`20260905040425_add_manual_player_mvp_tally_presentations.sql`. It must remain part of the
Production baseline and must never be reapplied or deleted. The later lifecycle migration
`20260905131718_restore_player_mvp_voting_lifecycle_after_production_slice.sql` is identical in
Main and Production.

## Migration-history finding

Production's remote migration history and Main's migration-file directory are substantially
different:

| Measure | Count |
| --- | ---: |
| Recorded Production migration versions | 159 |
| Migration files on Main | 186 |
| Same version present in both | 8 |
| Production history versions without a same-named Main file | 151 |
| Main files not recorded in Production history | 178 |

This does not mean 178 migrations should be run. Migration tracking and actual schema state are
separate. A filename-only push or a bulk migration-history repair could either replay changes that
already exist or mark absent objects as complete. Each release batch therefore needs a new,
additive compatibility migration built from the live Production schema and rehearsed against a
fresh Production-derived copy.

The detailed 115-row register is
`MAIN-PRODUCTION-MIGRATION-MAP-2026-09-06.csv`. Its schema-name signal is a triage aid only; a name
appearing in a schema dump is not proof that its columns, policies, grants, functions or behaviour
match Main.

### First-pass migration decisions

| Decision | Count | Meaning |
| --- | ---: | --- |
| `CURATE_AND_REHEARSE` | 103 | Inspect live equivalence and dependencies; do not apply the historical file directly yet. |
| `REPLACED_BY_PRODUCTION_TALLY_SLICE` | 5 | The narrow Production tally migration replaces these historical Main files. |
| `EXCLUDE_DEV_ONLY` | 4 | Reserved/disposable Dev-account material; never include in Production. |
| `PRESERVE_PRODUCTION_BASELINE` | 1 | The Production-only tally migration already applied. |
| `REPLACE_WITH_COMPATIBILITY_BRIDGE` | 1 | The historical file is known not to run against Production. |
| `SPLIT_PRODUCTION_AND_DEV_CONTENT` | 1 | Keep only the generic Production-safe role guard; exclude Dev provisioning content. |

The first deterministic failure remains
`20260801013000_harden_field_template_grants.sql`: it grants access on
`public.field_templates`, which does not exist in Production. This proves that the historical Main
sequence cannot be used as the Production release sequence.

## Proposed release batches

The batches are dependency groups, not approvals. No historical migration is on a direct-apply
allow-list yet.

| Batch | Migration rows | Scope | Initial boundary |
| --- | ---: | --- | --- |
| B1 | 33 | Shared database foundation, identity, roles, permissions and scoped administration | Start here. Replace historical files with the minimum additive compatibility bridge required by the selected app screens. Exclude the two Dev-only rows and split the mixed Dev/Production guard. |
| B2 | 7 | Player MVP presentation and lifecycle | Preserve the Production tally slice, retain the already-applied lifecycle migration and treat five older tally files as superseded. Only new Player MVP enhancements need later additive migrations. |
| B3 | 19 | Hockey operations, Umpire Match Voting and communications | Hold until B1 is proven. Keep the two reserved Dev Umpire-account rows excluded. Review the scraper workflow separately. |
| B4 | 48 | Coordination, committee, Safety Hub and discipline | Release as smaller feature slices after their access and audit dependencies are proven. |
| B5 | 8 | Expense Hub | Release last and include its AI/function configuration only after a separate secret and data-handling review. |

### First proposed allow-list

The safe Stage 1 allow-list is deliberately narrow:

1. **Preserve, do not run:** Production migration `20260905040425`.
2. **Already represented, do not rerun:** lifecycle migration `20260905131718`.
3. **Never promote:** the four rows marked `EXCLUDE_DEV_ONLY` and Edge Function
   `provision-dev-test-account`.
4. **Do not direct-apply:** all 103 `CURATE_AND_REHEARSE` historical files, the five superseded
   tally files, the broken field-template grant and the mixed Dev/Production guard.
5. **Next candidate:** a newly authored B1 compatibility migration, after live object-by-object
   comparison and isolated rehearsal. Its exact contents are not approved by this inventory.

This means the current direct-apply migration allow-list is empty. That is the safe result of the
evidence, not an incomplete release decision.

## Edge Function reconciliation

Production has 11 deployed functions. Comparing downloaded deployed source with the Git blobs
shows:

| Function | Production deployment | Source relationship | Stage 1 decision |
| --- | --- | --- | --- |
| `claim-placeholder-profile` | v2, JWT on | deployed = Prod = Main | Retain; no deployment needed. |
| `get-user-emails` | v2, JWT on | deployed = Prod = Main | Retain; no deployment needed. |
| `save-pending-signup` | v2, JWT off | deployed = Prod = Main | Retain; no deployment needed. |
| `mvp-voting-email-reminders` | v6, JWT off | deployed = Prod; Main differs | Hold until the Main change and email side effects are rehearsed. |
| `sportstack-notification-dispatch` | v1, JWT off | deployed = Prod; Main differs | Hold until its notification dependencies are mapped. |
| `bulk-import` | v3, JWT on | deployed differs from Prod and Main | Preserve deployed source; investigate drift before replacement. |
| `create-player` | v3, JWT on | deployed differs from Prod and Main | Preserve deployed source; investigate drift before replacement. |
| `create-revsports-placeholder-player` | v3, JWT on | deployed differs from Prod and Main | Preserve deployed source; investigate drift before replacement. |
| `send-profile-access-link` | v5, JWT on | deployed differs from Prod and Main; Prod and Main also differ | Preserve deployed source; reconcile all three versions. |
| `update-user-details` | v4, JWT on | absent from Prod Git; deployed differs from Main | Preserve deployed source; reconcile against Main and current UI requirements. |
| `bulk-import-players` | v2, JWT on | deployed only; absent from Prod and Main Git | Treat as live legacy until usage and dependency checks prove it can be retired. |

Main also contains nine function directories not deployed to Production:

- `clear-test-data` and `provision-dev-test-account`: exclude from Production;
- `profile-claim` and `profile-claim-admin`: no current application invocation was found; hold as
  historical candidates until their retirement is proven;
- `coordination-invite`, `expense-document-extract`, `expense-statement-extract`,
  `mvp-tally-commentary` and `public-umpire-match-voting`: release only with their matching feature
  batch and database dependencies.

Main's `supabase/config.toml` also says JWT verification is off for `create-player` and
`bulk-import`, while the live Production deployments report it on. The live setting must not be
weakened accidentally during a later deployment.

No Edge Function is on the current deployment allow-list.

## Workflow reconciliation

GitHub's default branch is `main`. Scheduled workflows therefore use the workflow definition on
Main, not the copy on the `prod` branch.

| Workflow | Current finding | Decision |
| --- | --- | --- |
| `production-scrapers.yml` | The latest six scheduled runs are green, including run `34015450755` on Main `af21ae3`. The named-final blank-round fix remains Dev-only, so the known edge case is not yet proven resolved in the operational Production workflow. | Keep outside the app/database release. Review and approve separately. |
| `dev-scrapers.yml` | Recent recorded scheduled runs are green after two older failures. It also runs from Main because Main is the default branch. | Reconcile schedule intent separately; do not infer environment from filename alone. |
| `quality-dev.yml` | Quality checks only; changed between Prod and Main. | Keep as repository quality tooling. It is not part of a Production runtime deployment. |

The earlier statement that the Production scraper workflow was currently red is now stale. Its
latest runs are green, but that does not close the named-final defect or approve workflow changes.

## Stage 1 result and next action

Stage 1 establishes the release boundary, but readiness gates R16 and R17 remain open. The next
safe work is:

1. compare B1 tables, columns, constraints, functions, RLS policies and grants between Main's
   intended state and the live Production schema;
2. author the smallest additive B1 compatibility migration on Dev without changing historical
   files;
3. restore a fresh Production backup into an isolated environment, then test rollback, real apply,
   repeat apply and permission denial;
4. freeze the B1 application paths and any required Edge Functions;
5. independently review the exact package before asking Aaron for a new Production approval.

Production must remain unchanged until that later exact package has passed rehearsal and Aaron has
explicitly approved it.

### B1a update

The object-by-object comparison is now complete and the dormant B1a foundation migration
`20260906063905_b1_foundation_compatibility.sql` has passed Production-copy apply, repeat apply,
transactional rollback and Dev-schema no-op checks. It creates 12 missing tables and one private
sequence with RLS enabled and no browser access. It deliberately does not add the 54 missing B1
functions, 12 policies, five triggers or catalogue/application data. Those remain in B1b/B1c, with
the application allow-list in B1d. See `B1-FOUNDATION-REHEARSAL-2026-09-06.md`.

## Verification

- the read-only Production verifier passed against Git `a1d23c7`, the public bundle and the pinned
  Production Supabase project;
- the audit script passes PowerShell parsing and completed without changing Production;
- the migration-map generator passes Node syntax checking, regenerates exactly 115 rows and passes
  Git whitespace checking;
- 46 Vitest files and 181 tests pass;
- TypeScript and the Production build pass;
- focused development-plan lint passes;
- full repository lint reports 346 errors and 77 warnings. None is in the new audit/map scripts,
  but this is three errors above the older recorded 343-error baseline and must be reconciled before
  claiming a new whole-repository lint baseline.

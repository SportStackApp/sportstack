# B1 foundation reconciliation and rehearsal — 6 September 2026

## Outcome

The first B1 sub-batch is deployed to Development and ready for further review. It is a dormant,
additive foundation only. It creates the missing tables and private session structure required by
the later access/identity package, but deliberately adds no browser access, functions, policies,
triggers or application data.

Production was inspected read-only and was not changed.

## Pinned environment state

| Environment | Git commit | Supabase project | Recorded migrations | Edge Functions |
|---|---|---|---:|---:|
| Development | `d70fc28731d394b792661cf34ca5f9fc8a48f3e8` | `icqegnpjbizccjebjfhb` | 144 | 19 |
| Main/staging | `af21ae3c06a2d66d2eb9c4edf64bb2c185869927` | shares Development | n/a | n/a |
| Production | `a1d23c741b79de02c32763a879597192a1c1ebd5` | `svierarfcolhcfjpmwck` | 159 | 11 |

The refreshed structural comparison records 878 B1/dependency rows. The B1-owned Production gap
contains 12 tables, one sequence, 25 indexes, 62 constraints, 55 functions, 12 policies, five
triggers and their associated grants. Existing Production-only primary-team policies and its
current `is_super_admin()` grants remain preserved for investigation; this foundation migration
does not replace them.

## B1a exact scope

Migration `20260906063905_b1_foundation_compatibility.sql` creates these missing structures:

- `public.module_feature_flags`
- `public.administration_audit_log`
- `public.administration_integrity_snapshot_batches`
- `public.administration_membership_integrity_snapshot`
- `public.permission_catalogue`
- `public.permission_groups`
- `public.permission_group_members`
- `public.permission_sets`
- `public.permission_set_permissions`
- `public.permission_assignments`
- `public.permission_overrides`
- `private.auth_session_permission_modes`
- `private.auth_session_permission_mode_revision_seq`

New tables have row-level security enabled. The private session table also forces row-level
security. Browser-role privileges are explicitly removed only when the migration creates an object;
existing Development grants and policies are not changed. No catalogue seed, snapshot row or other
application data is written.

The following later-feature details are excluded:

- Coordination permission-set keys and availability values;
- incident/discipline module keys;
- preferred-name/nickname profile columns;
- Umpire Match Voting division fields;
- Player MVP notification defaults;
- scraper workflows and reserved Development accounts.

## Rehearsal evidence

The verified 6 September Production logical backup was restored into an isolated local PostgreSQL
container with no published host port. Hosted Supabase Auth is not included completely in the
logical schema dump, so a minimal local-only `auth.sessions` table was supplied to satisfy the same
foreign key that exists in hosted Supabase. The full data script generated managed Auth/Storage
compatibility and follow-on parser errors, so this is not a faithful hosted Auth/Storage restore.
The three relevant public baselines did restore:

| Check | Before | First apply | Repeat apply |
|---|---:|---:|---:|
| B1a structures | 0 | 13 | 13 |
| `profiles` rows | 757 | 757 | 757 |
| `team_memberships` rows | 1,260 | 1,260 | 1,260 |
| `primary_change_requests` rows | 6 | 6 | 6 |
| Browser grants on newly created B1a tables | 0 | 0 | 0 |
| Policies on newly created B1a tables | 0 | 0 | 0 |

The exact migration passed with `ON_ERROR_STOP`, passed a second apply, and passed a separate
transactional rollback: the structure count returned from zero to zero. A Development-schema
before/after repeat comparison matched all 10,382 public/private catalogue entries, proving the
migration is a structural no-op when the current Dev objects already exist. One unrelated GiST
index could not be recreated in the local Dev schema copy because the extension operator class was
not loaded; it is outside B1 and did not affect the comparison.

The migration version is now recorded on Development. A fresh hosted comparison shows 144 Dev
migration versions and the same 19 Edge Functions. Production remains at 159 migration versions and
11 Edge Functions. The Production migration list is byte-for-byte unchanged from the pre-apply
snapshot.

Dev Quality run `34019337864` passed for the final B1a implementation/audit commit
`d70fc28731d394b792661cf34ca5f9fc8a48f3e8`. GitHub deployment `6290411884` also completed
successfully at `https://sportstack-ihfr8erlw-sportstackapps-projects.vercel.app`. That exact
deployment and `https://dev.sportstackapp.com.au` returned identical app-shell hashes, confirming
the Dev alias serves the tested commit. The local Vercel CLI remains deliberately unlinked because
its current account context points to a different project.

## Remaining B1 sub-batches

1. **B1b security layer:** curate the current final functions, catalogue seed, RLS policies,
   triggers and minimum grants. Remove anonymous execution where the final design requires it.
2. **B1c membership workflow:** reconcile the existing Production `primary_change_requests`
   policies and deploy the final atomic request/approve/decline/cancel functions only after data
   preconditions and actual-role denial tests pass.
3. **B1d application allow-list:** freeze only the roles, users, module-control, permission-context
   and membership screens/hooks that depend on B1. No Edge Function is included unless its deployed
   Production source is reconciled first.
4. Restore the complete B1 package into a fresh Production-compatible hosted staging environment;
   repeat the permission-denial and application smoke tests before requesting Production approval.

## Release boundary

B1a is not a Production release packet by itself. Production must remain unchanged until B1b–B1d,
the hosted rehearsal and an independent review pass, followed by Aaron's explicit approval of the
exact frozen package.

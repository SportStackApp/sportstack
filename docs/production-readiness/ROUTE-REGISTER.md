# Production Readiness Route Register

Last refreshed: 31/08/2026 from `src/App.tsx` and current route gates.

Status meanings: **Passed** is observed Dev evidence; **Source checked** is code evidence awaiting a
browser cycle; **Blocked** names missing authority or test data. Every protected route first passes
`ProtectedRoute`; `ModeRouteGate` also honours the active **Viewing as** mode.

## Public and authentication

| Route | Owner | Expected audience/state | Latest result |
|---|---|---|---|
| `/` | App shell | Public landing; Umpire hostname uses Umpire landing | Source checked |
| `/login` | Identity | Public sign-in with safe `returnTo` | Passed 30/08 |
| `/signup` | Identity | Public account application | Source checked |
| `/forgot-password` | Identity | Public reset request | Source checked |
| `/reset-password` | Identity | Public password update | Source checked |
| `/pending` | Identity | Pending-account explanation | Source checked |
| `/vote/:token` | Player MVP | Retired token-route notice | Source checked |
| `/umpire` | Umpire Match Voting | Public Umpire landing | Source checked |
| `/umpire/public-vote` | Umpire Match Voting | Public ballot | Passed 29/08 |
| `*` | App shell | Useful Not Found state | Source checked |

## Discipline

| Route | Owner | Expected audience/state | Latest result |
|---|---|---|---|
| `/discipline` | Discipline | Assigned discipline users | Source checked |
| `/discipline/new` | Discipline | Users authorised to lodge a case | Source checked |
| `/discipline/cases/:caseId` | Discipline | Assigned/authorised case users | Source checked |
| `/discipline/profile` | Discipline | Discipline-only profile | Source checked |

## Standard signed-in application

| Route | Owner | Expected audience/state | Latest result |
|---|---|---|---|
| `/dashboard` | App shell | Any signed-in user; internally scoped | Source checked |
| `/games` | Fixtures | Any signed-in user; internally scoped | Source checked |
| `/games/:id` | Fixtures | Record access enforced internally and by RLS | Source checked |
| `/games/:id/lineup` | Line-up | Signed-in; edit rights enforced internally | Passed desktop/mobile 30/08 |
| `/roster` | Coaching | Signed-in; internally scoped | Passed 30/08 |
| `/coaching` | Coaching | Signed-in; team context internally scoped | Passed 30/08 |
| `/coaching/formations` | Coaching | Signed-in formation library | Source checked |
| `/coaching/formations/builder` | Coaching | Signed-in builder | Source checked |
| `/coaching/formations/templates/builder` | Coaching | Signed-in template builder | Source checked |
| `/coaching/trace` | Coaching | Signed-in plus Hockey Trace enabled | Source checked |
| `/coaching/:playerId` | Coaching | Player visibility enforced internally/RLS | Passed 30/08 |
| `/chat` | Communications | Signed-in; destination scoped internally | Passed desktop 31/08 |
| `/umpire/vote` | Umpire Match Voting | Super/Association or actual Umpire in Player mode; module enabled | Passed actual Umpire 30/08 |
| `/voting` | Voting landing | Signed-in legacy hub | Source checked; module gate gap noted |
| `/mvp-votes` | Player MVP | Signed-in plus module enabled | Passed actual Player/Voter 30/08 |
| `/mvp-votes/:sessionId` | Player MVP | Same; draft isolated per session | Source checked |
| `/mvp-votes/tallies/:id` | Player MVP | Signed-in authorised recipient | Source checked |
| `/profile` | Profile | Any signed-in user | Passed 30/08 |
| `/committee` | Committee | Signed-in plus module; capability enforced internally | Passed desktop tabs 31/08 |
| `/coordination` | Coordination | Signed-in plus module; capability enforced internally | Passed desktop tabs 31/08 |
| `/coordination/my-assignments` | Coordination | Same component and gate as Coordination | Source checked |

## Expense Hub

All routes require `ExpenseHubGate` and an allowed scoped responsibility.

| Route | Owner | Latest result |
|---|---|---|
| `/expense-hub` | Expense Hub | Source checked |
| `/expense-hub/expenses` | Expense Hub | Passed desktop/empty state 31/08 |
| `/expense-hub/expenses/new` | Expense Hub | Source checked |
| `/expense-hub/expenses/:id/edit` | Expense Hub | Source checked |
| `/expense-hub/statements` | Expense Hub | Source checked |
| `/expense-hub/ai-activity` | Expense Hub | Source checked |
| `/expense-hub/suppliers` | Expense Hub | Source checked |
| `/expense-hub/reports` | Expense Hub | Source checked |

## Administration

Mode key: S Super Admin; A Association Admin; C Club Admin; TM Team Manager.

| Route | Owner | Expected mode/module | Latest result |
|---|---|---|---|
| `/admin` | Administration | S/A/C | Passed 30/08 |
| `/admin/associations` | Organisation | S | Source checked |
| `/admin/competitions` | Organisation | S/A | Source checked |
| `/admin/clubs` | Organisation | S/A | Source checked |
| `/admin/teams` | Organisation | S/A/C | Source checked |
| `/admin/divisions` | Organisation | S/A/C | Source checked |
| `/admin/users` | People | S/A/C | Source checked |
| `/admin/add-player` | People | S/A/C | Source checked |
| `/admin/bulk-import` | People | S/A/C | Source checked |
| `/admin/revsports-mappings` | Data quality | S | Source checked |
| `/admin/revsports-unmatched` | Data quality | S | Source checked |
| `/admin/error-logs` | Support | S | Source checked |
| `/admin/feedback` | Support | S/A | Source checked |
| `/admin/revsports-entities` | Data quality | S | Passed sorting/persistence 30/08 |
| `/admin/player-explorer` | Data quality | S/A/C/TM/Coach | Passed source tests; broader roles pending |
| `/admin/fixtures` | Fixtures | S/A | Passed sorting 30/08 |
| `/admin/fixture-import` | Fixtures | S | Source checked |
| `/admin/venues` | Organisation | S/A | Source checked |
| `/admin/requests` | Membership | S/A/C | Source checked |
| `/admin/mvp-voting` | Player MVP | S/A/C/TM plus module | Passed actual roles/sorting 30/08 |
| `/admin/mvp-voting/tallies` | Player MVP | S/A/C/TM plus module | Source checked |
| `/admin/umpire-voting` | Umpire Match Voting | S/A plus module | Source checked |
| `/admin/safety-risk` | Safety | S/A/C plus module | Passed desktop/sorting 31/08 |
| `/admin/analytics` | Player MVP analytics | S/A/C; individual log S or actual C | Passed actual A/C 30/08 |
| `/admin/roles-permissions` | Access controls | S/A/C; controls internally scoped | Passed S pre-flight 31/08 |
| `/admin/module-preview` | Administration | S | Source checked |

## Entity dashboards

| Route | Owner | Expected audience/state | Latest result |
|---|---|---|---|
| `/associations/:id` | Organisation | Signed-in; internal/RLS scope required | Source checked; direct-role cycle pending |
| `/clubs/:id` | Organisation | Signed-in; internal/RLS scope required | Source checked; direct-role cycle pending |
| `/divisions/:id` | Organisation | Signed-in; internal/RLS scope required | Source checked; direct-role cycle pending |
| `/admin/division` | Organisation | Signed-in; internal/RLS scope required | Source checked; explicit mode gate absent |
| `/teams/:id` | Organisation | Signed-in; internal/RLS scope required | Source checked; direct-role cycle pending |

## Open route-gate checks

- Entity dashboards, coaching, roster and game-detail routes rely heavily on page/RLS enforcement;
  direct URLs must be tested with lower roles rather than inferred from hidden navigation.
- `/voting` is not module-gated although its destination modules are.
- Committee and Coordination module gates do not prove action capability; actions require separate
  internal permission tests.
- Actual Coordinator coverage is **Blocked** because no reserved Coordinator identity exists.


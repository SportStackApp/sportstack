# Gates: SportStack admin, line-up and coaching improvements

Scope: Complete the approved Development batch without changing Production or deleting existing data.

- [x] G1: Profile personal details store preferred name and nickname while leaving preferred-name display precedence parked
  CHECK: npx vitest run src/lib/profileNames.test.ts
  EXPECT: 1 test file passed
  EVIDENCE: Passed as part of the 4-file focused run; 15 focused tests passed.

- [x] G2: Requested admin tables expose deterministic accessible ascending and descending sorting
  CHECK: npx vitest run src/lib/adminSorting.test.ts
  EXPECT: 1 test file passed
  EVIDENCE: Passed as part of the 4-file focused run; focused changed-file ESLint also passed.

- [x] G3: The fixture roster workflow persists selected players, nickname display choices and position overrides
  CHECK: npx vitest run src/lib/lineupPlanner.test.ts
  EXPECT: 1 test file passed
  EVIDENCE: Passed as part of the 4-file focused run; live Dev schema contains both RLS-protected line-up tables.

- [x] G4: Coaching position traits support area-only, side-only, combined and goalkeeper cases
  CHECK: npx vitest run src/lib/hockeyPositions.test.ts
  EXPECT: 1 test file passed
  EVIDENCE: Passed as part of the 4-file focused run.

- [x] G5: Development database migration and RLS regression checks pass without retained test data
  EVIDENCE: Linked CLI test was blocked by Supabase HTTP 403. The exact migration plus assertions passed inside BEGIN/ROLLBACK through the authorised Supabase connection, then applied to Dev. Post-apply counts were 2 profile columns, 3 RLS tables and 2 intended MVP policies.

- [x] G6: Focused frontend tests pass
  CHECK: npx vitest run
  EXPECT: Test Files
  EVIDENCE: 28 files and 111 tests passed.

- [x] G7: TypeScript validates the complete application
  CHECK: npx tsc --noEmit
  EXPECT: /(?:^|\n)\s*$/
  EVIDENCE: Passed with exit code 0 and no diagnostics.

- [x] G8: Production build succeeds
  CHECK: npm run build
  EXPECT: built in
  EVIDENCE: Vite built 3,123 modules in 2.15 seconds. Existing chunk/Browserslist warnings remain.

- [x] G9: Full lint is measured and any pre-existing baseline debt is reported separately from new errors
  EVIDENCE: Full lint reproduced repository debt at 350 errors/78 warnings. Focused lint over changed implementation files passed with zero findings; Profile, AdminDashboard and Analytics retain pre-existing any/hook debt.

- [x] G10: Signed-in Development browser smoke confirms the completed workflows on desktop and mobile
  EVIDENCE: The 30 August walk-away run used actual Player, Coach and Club Admin Dev accounts. READY-001 through READY-008 passed; five new issues were recorded separately with desktop and mobile evidence.

- [x] G11: Canonical documentation is updated and Big Brain synchronisation passes after the Development commit
  CHECK: pwsh -NoProfile -File scripts/sync-sportstack-notes-to-obsidian.ps1 -Check
  EXPECT: CHECK_OK
  EVIDENCE: SYNC_OK and CHECK_OK passed against origin/dev commit 16839fe; 57 files mirrored to Big Brain.

- [x] G12: Club Admin can open Player MVP analytics while individual ballots remain limited to Super Admin and Club Admin scope
  CHECK: npx vitest run src/lib/adminAnalyticsAccess.test.ts
  EXPECT: Test Files
  EVIDENCE: Focused access tests passed, including the separate route and individual-ballot rules.

- [x] G13: The explicitly chosen line-up team survives refresh without overriding an invalid or inaccessible team
  CHECK: npx vitest run src/lib/lineupTeamSelection.test.ts
  EXPECT: Test Files
  EVIDENCE: Focused tests passed for valid restore, inaccessible restore rejection, scoped-team fallback and per-user/per-fixture storage keys.

- [x] G14: The mobile pitch uses a portrait mapping and converts dragged coordinates back to the saved landscape formation
  CHECK: npx vitest run src/lib/lineupPlanner.test.ts
  EXPECT: Test Files
  EVIDENCE: Line-up planner tests passed for portrait rotation, orientation detection and drag conversion back to canonical landscape coordinates.

- [x] G15: Every Profile role, including Legacy Umpire Admin, has a visible label and icon
  CHECK: npx vitest run src/lib/profileRoles.test.ts
  EXPECT: Test Files
  EVIDENCE: Focused role-catalogue test passed for all nine live enum values.

- [ ] G16: The formation selector has an accessible name and the repaired line-up passes desktop and mobile browser checks without marker overlap or clipping
  EVIDENCE: Formation now has the accessible name in code; deployed desktop/mobile browser evidence remains pending.

- [x] G17: Focused lint, the complete Vitest suite, TypeScript and the Production build pass for the repair batch
  EVIDENCE: Focused lint and TypeScript passed with no diagnostics; 33 Vitest files/127 tests and the Production build passed. Full lint remains unchanged at the established 350 errors/78 warnings.

- [ ] G18: Actual-role Dev testing records Association Admin, Club Admin, Team Manager, Coach, Player, Umpire and Voter outcomes without changing normal accounts
  EVIDENCE: Player, Coach and Club Admin have earlier actual-role evidence. The remaining roles could not be run after deployment because the controllable browser had no authenticated Dev session.

- [ ] G19: The walk-away findings and repair results are committed to Dev, mirrored into Big Brain and verified by the sync check
  CHECK: pwsh -NoProfile -File scripts/sync-sportstack-notes-to-obsidian.ps1 -Check
  EXPECT: CHECK_OK
  EVIDENCE: pending

ABANDON: G16 Current unattended run cannot reach the authenticated line-up; the in-app tab is not controllable and the normal Chrome profile attempt timed out and reached Dev signed out.
ABANDON: G18 Current unattended run cannot reset or sign into the reserved Dev accounts because the controllable browser lost its authenticated Super Admin hand-off.

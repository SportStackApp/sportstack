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
  CHECK: npm run lint
  EVIDENCE: Full lint reproduced repository debt at 350 errors/78 warnings. Focused lint over changed implementation files passed with zero findings; Profile, AdminDashboard and Analytics retain pre-existing any/hook debt.

- [ ] G10: Signed-in Development browser smoke confirms the completed workflows on desktop and mobile
  EVIDENCE: pending

- [ ] G11: Canonical documentation is updated and Big Brain synchronisation passes after the Development commit
  CHECK: pwsh -NoProfile -File scripts/sync-sportstack-notes-to-obsidian.ps1 -Check
  EXPECT: CHECK_OK
  EVIDENCE: pending

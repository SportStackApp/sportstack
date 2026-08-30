# Gates: SportStack admin, line-up and coaching improvements

Scope: Complete the approved Development batch without changing Production or deleting existing data.

- [x] G1: Profile personal details store preferred name and nickname while leaving preferred-name display precedence parked
  CHECK: npx vitest run src/lib/profileNames.test.ts
  EXPECT: Test Files
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\AI-Workspace\Projects\Local-Projects\SportStackApp\sportstack; path=41a31e43f690/55 entries; output=Duration  158ms (transform 17ms, setup 0ms, import 29ms, tests 2ms, environment 0ms) | [vite:react-swc] We recommend switching to `@vitejs/plugin-react` for improved performance as no swc plugins are used. More information at https://vite.d

- [x] G2: Requested admin tables expose deterministic accessible ascending and descending sorting
  CHECK: npx vitest run src/lib/adminSorting.test.ts
  EXPECT: Test Files
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\AI-Workspace\Projects\Local-Projects\SportStackApp\sportstack; path=41a31e43f690/55 entries; output=Duration  180ms (transform 20ms, setup 0ms, import 33ms, tests 8ms, environment 0ms) | [vite:react-swc] We recommend switching to `@vitejs/plugin-react` for improved performance as no swc plugins are used. More information at https://vite.d

- [x] G3: The fixture roster workflow persists selected players, nickname display choices and position overrides
  CHECK: npx vitest run src/lib/lineupPlanner.test.ts
  EXPECT: Test Files
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\AI-Workspace\Projects\Local-Projects\SportStackApp\sportstack; path=41a31e43f690/55 entries; output=Duration  170ms (transform 25ms, setup 0ms, import 38ms, tests 3ms, environment 0ms) | [vite:react-swc] We recommend switching to `@vitejs/plugin-react` for improved performance as no swc plugins are used. More information at https://vite.d

- [x] G4: Coaching position traits support area-only, side-only, combined and goalkeeper cases
  CHECK: npx vitest run src/lib/hockeyPositions.test.ts
  EXPECT: Test Files
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\AI-Workspace\Projects\Local-Projects\SportStackApp\sportstack; path=41a31e43f690/55 entries; output=Duration  171ms (transform 22ms, setup 0ms, import 34ms, tests 4ms, environment 0ms) | [vite:react-swc] We recommend switching to `@vitejs/plugin-react` for improved performance as no swc plugins are used. More information at https://vite.d

- [x] G5: Development database migration and RLS regression checks pass without retained test data
  EVIDENCE: Linked CLI test was blocked by Supabase HTTP 403. The exact migration plus assertions passed inside BEGIN/ROLLBACK through the authorised Supabase connection, then applied to Dev. Post-apply counts were 2 profile columns, 3 RLS tables and 2 intended MVP policies.

- [x] G6: Focused frontend tests pass
  CHECK: npx vitest run
  EXPECT: Test Files
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\AI-Workspace\Projects\Local-Projects\SportStackApp\sportstack; path=41a31e43f690/55 entries; output=Duration  871ms (transform 2.04s, setup 0ms, import 3.05s, tests 180ms, environment 3ms) | [vite:react-swc] We recommend switching to `@vitejs/plugin-react` for improved performance as no swc plugins are used. More information at https://vi

- [x] G7: TypeScript validates the complete application
  CHECK: npx tsc --noEmit
  EXPECT: /(?:^|\n)\s*$/
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\AI-Workspace\Projects\Local-Projects\SportStackApp\sportstack; path=41a31e43f690/55 entries; output=(no output)

- [x] G8: Production build succeeds
  CHECK: npm run build
  EXPECT: built in
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\AI-Workspace\Projects\Local-Projects\SportStackApp\sportstack; path=41a31e43f690/55 entries; output=- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting | - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

- [x] G9: Full lint is measured and any pre-existing baseline debt is reported separately from new errors
  EVIDENCE: Full lint reproduced repository debt at 350 errors/78 warnings. Focused lint over changed implementation files passed with zero findings; Profile, AdminDashboard and Analytics retain pre-existing any/hook debt.

- [x] G10: Signed-in Development browser smoke confirms the completed workflows on desktop and mobile
  EVIDENCE: The 30 August walk-away run used actual Player, Coach and Club Admin Dev accounts. READY-001 through READY-008 passed; five new issues were recorded separately with desktop and mobile evidence.

- [x] G11: Canonical documentation is updated and Big Brain synchronisation passes after the Development commit
  CHECK: pwsh -NoProfile -File scripts/sync-sportstack-notes-to-obsidian.ps1 -Check
  EXPECT: CHECK_OK
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\AI-Workspace\Projects\Local-Projects\SportStackApp\sportstack; path=41a31e43f690/55 entries; output=CHECK_OK ref=origin/dev commit=5a3cfd33960192e405341a6d02841176c7a1172d files=61 vault=C:\Users\mulla\OneDrive\Documents\Big Brain

- [x] G12: Club Admin can open Player MVP analytics while individual ballots remain limited to Super Admin and Club Admin scope
  CHECK: npx vitest run src/lib/adminAnalyticsAccess.test.ts
  EXPECT: Test Files
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\AI-Workspace\Projects\Local-Projects\SportStackApp\sportstack; path=41a31e43f690/55 entries; output=Duration  160ms (transform 17ms, setup 0ms, import 29ms, tests 2ms, environment 0ms) | [vite:react-swc] We recommend switching to `@vitejs/plugin-react` for improved performance as no swc plugins are used. More information at https://vite.d

- [x] G13: The explicitly chosen line-up team survives refresh without overriding an invalid or inaccessible team
  CHECK: npx vitest run src/lib/lineupTeamSelection.test.ts
  EXPECT: Test Files
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\AI-Workspace\Projects\Local-Projects\SportStackApp\sportstack; path=41a31e43f690/55 entries; output=Duration  155ms (transform 16ms, setup 0ms, import 26ms, tests 2ms, environment 0ms) | [vite:react-swc] We recommend switching to `@vitejs/plugin-react` for improved performance as no swc plugins are used. More information at https://vite.d

- [x] G14: The mobile pitch uses a portrait mapping, keeps markers inside safe mobile bounds and converts dragged coordinates back to the saved landscape formation
  CHECK: npx vitest run src/lib/lineupPlanner.test.ts
  EXPECT: Test Files
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\AI-Workspace\Projects\Local-Projects\SportStackApp\sportstack; path=41a31e43f690/55 entries; output=Duration  161ms (transform 24ms, setup 0ms, import 36ms, tests 3ms, environment 0ms) | [vite:react-swc] We recommend switching to `@vitejs/plugin-react` for improved performance as no swc plugins are used. More information at https://vite.d

- [x] G15: Every Profile role, including Legacy Umpire Admin, has a visible label and icon
  CHECK: npx vitest run src/lib/profileRoles.test.ts
  EXPECT: Test Files
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\AI-Workspace\Projects\Local-Projects\SportStackApp\sportstack; path=41a31e43f690/55 entries; output=Duration  154ms (transform 17ms, setup 0ms, import 27ms, tests 2ms, environment 0ms) | [vite:react-swc] We recommend switching to `@vitejs/plugin-react` for improved performance as no swc plugins are used. More information at https://vite.d

- [x] G16: The formation selector has an accessible name and the repaired line-up passes desktop and mobile browser checks without marker overlap or clipping
  EVIDENCE: The deployed 3a4ffd4 Dev line-up kept Pumas after refresh, exposed Formation and Line-up team names, had no horizontal overflow at 390x844 or 1569x912, and showed all eleven labels without the earlier collision. Axe reported zero WCAG A/AA violations after the icon-only control repair; two Radix/contrast checks remained tool-incomplete rather than failed.

- [x] G17: Focused lint, the complete Vitest suite, TypeScript and the Production build pass for the repair batch
  EVIDENCE: Focused lint and TypeScript passed with no diagnostics; 33 Vitest files/128 tests and the Production build passed. Full lint remains unchanged at the established 350 errors/78 warnings.

- [x] G18: Actual-role Dev testing records Association Admin, Club Admin, Team Manager, Coach, Player, Umpire and Voter outcomes without changing normal accounts
  EVIDENCE: Reserved disposable Dev identities supplied actual-role evidence for all seven roles. Club Admin reached its club-scoped Individual Votes Log; Association Admin stayed aggregate-only; Team Manager reached Player MVP Voting and was denied Roles & modules; Umpire reached /umpire/vote and was denied Roles & modules; Voter reached /mvp-votes and was denied Roles & modules. Earlier current-cycle evidence covers Coach and Player. Only reserved Dev accounts were reset; no normal account changed.

- [x] G19: The walk-away findings and repair results are committed to Dev, mirrored into Big Brain and verified by the sync check
  CHECK: pwsh -NoProfile -File scripts/sync-sportstack-notes-to-obsidian.ps1 -Check
  EXPECT: CHECK_OK
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\AI-Workspace\Projects\Local-Projects\SportStackApp\sportstack; path=41a31e43f690/55 entries; output=CHECK_OK ref=origin/dev commit=5a3cfd33960192e405341a6d02841176c7a1172d files=61 vault=C:\Users\mulla\OneDrive\Documents\Big Brain

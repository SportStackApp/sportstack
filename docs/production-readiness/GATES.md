# Gates: SportStack Production readiness

Scope: Prove the frozen SportStack release package is safe to offer to Aaron for a separate Production approval decision.

- [ ] R1: the route, table and form registers cover every current user-visible route, table, column and form with an explicit owner and latest result
  EVIDENCE: pending

- [ ] R2: every known Blocker and High defect is fixed on Dev and the original plus adjacent regression steps pass
  EVIDENCE: pending

- [ ] R3: every Medium defect is fixed or has an explicit owner-approved deferral with reason and impact
  EVIDENCE: pending

- [ ] R4: every meaningful table column follows the documented two-way sorting contract and action-only columns are explicitly non-sortable
  EVIDENCE: The complete table/column register exists. Fixtures, RevSports Review, Player MVP, Expense Hub, Error Logs and Feedback pass the contract; remaining register gaps keep this gate open.

- [ ] R5: every form, filter, search and modal follows the documented persistence and sensitive-data contract
  EVIDENCE: RevSports tab filters/default-Unmatched, Quick Actions and line-up team refresh persistence pass. The complete form/filter/modal register is still pending.

- [ ] R6: actual-role Dev testing covers Super Admin, Association Admin, Club Admin, Team Manager, Coach, Player, Umpire and Coordinator at their real scopes
  EVIDENCE: Super Admin plus the reserved Association Admin, Club Admin, Team Manager, Coach, Player and Umpire identities have current results. Voter was also tested. Coordinator remains blocked because the controlled browser is signed out and the reserved helper cannot provision the direct permission bundle.

- [ ] R7: the high-risk workflows pass on desktop and mobile, with tablet evidence where the layout needs it
  EVIDENCE: The repaired line-up passes 1569x912 and 390x844 visual, overflow and accessibility checks. Safety Hub also passes 1440x900 and 390x844 with zero Axe WCAG A/AA violations. Remaining high-risk workflows and any necessary tablet layouts are pending.

- [ ] R8: public, signed-out, direct-link, refresh, back-forward, keyboard, empty, error and unavailable-module states have current results
  EVIDENCE: Current signed-out checks pass for protected-route returnTo, public Umpire ballot, forgot-password and useful 404. Additional error, unavailable-module, back-forward and keyboard coverage remains pending.

- [x] R9: focused regression tests and the complete Vitest suite pass
  CHECK: npx vitest run
  EXPECT: Test Files
  EVIDENCE: The 5 September frozen Dev candidate passed 46 files and 181 tests; Dev Quality run `33969370123` also passed.

- [x] R10: TypeScript validates the complete application
  CHECK: npx tsc --noEmit
  EXPECT: /(?:^|\n)\s*$/
  EVIDENCE: npx tsc --noEmit passed on the 5 September frozen candidate.

- [x] R11: the Production application build succeeds and build warnings are reviewed
  CHECK: npm run build
  EXPECT: built in
  EVIDENCE: npm run build passed on the 5 September frozen candidate. The known large-bundle/dynamic-import and stale Browserslist warnings remain non-blocking debt.

- [x] R12: full lint is measured and no new error exists beyond the documented legacy baseline
  EVIDENCE: Full lint is 343 errors/77 warnings, exactly at and not above the accepted current baseline. The locked baseline verifier passed.

- [ ] R13: at least one complete read-only walk-away cycle has current evidence and no unresolved Blocker or High finding
  EVIDENCE: The 30 August Dev UI cycle found no new Blocker or High application defect, but READY-009 remains an unresolved High operational scraper item.

- [x] R14: any authorised disposable-data cycle proves create, save, reopen and recoverable cleanup without retained test damage
  EVIDENCE: Two labelled Vote Tally presentations were created in Dev, published to one reserved Player, reopened through the deep link, denied to an unrelated Voter, then withdrawn with audit reasons. The required withdrawn audit rows remain retained.

- [x] R15: the reviewed Dev package is integrated into Main and passes staging deployment plus proportionate smoke testing
  EVIDENCE: Main was integrated by merge commit e6fda0f. The earlier signed-in Main Player presentation result is reused because the playback runtime files are unchanged; it covered Axe, overflow, replay, pause/resume and skip before withdrawal. The new candidate passed focused tally tests and signed-out direct-route checks. Coordinator remains separately open under R6.

- [ ] R16: the exact frozen Main-to-Production application, migration, function, job and workflow package is independently reconciled against live Production
  EVIDENCE: Current Prod-to-Main inventory is 259 commits, 434 paths, 115 added migrations, one applied Production-only migration absent from Main, 15 Edge Function files and three workflows. Live Production state is recorded. The migration map and curated function allow-list remain open, so this gate does not pass.

- [ ] R17: Production backup, migration dry-run, rollback and post-release smoke procedures are proven without exposing secrets
  EVIDENCE: The Player MVP lifecycle migration passed a Production-derived transactional rollback and isolated real apply, closing the expected 355 sessions without changing notification/email counts. The broader 115-file sequence is blocked at migration 20260801013000 because Production lacks public.field_templates, so the whole-release rehearsal is not complete.

- [ ] R18: required Dev, Main and Production-capable workflow checks, including scrapers, are green or have an explicitly accepted operational exception
  EVIDENCE: The named-final blank-round repair passed 21 focused tests and a public fixture check on Dev, but it is deliberately absent from Main. The latest four Production Supabase Scrapers runs 33932103274, 33945079394, 33955841032 and 33965158128 failed; the latest log confirms blank TARGET_ROUND_NUMBER values. The entire Production scraper workflow remains excluded pending separate review and approval, so this gate stays open.

- [ ] R19: Aaron explicitly approves the exact frozen Production package after reviewing risks, accepted debt and rollback evidence
  EVIDENCE: pending

- [ ] R20: the approved Production release passes signed-out and signed-in smoke tests, diagnostics and scheduled-job observation within the rollback window
  EVIDENCE: pending

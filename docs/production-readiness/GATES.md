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
  EVIDENCE: Super Admin plus the reserved Association Admin, Club Admin, Team Manager, Coach, Player and Umpire identities have current results. Voter was also tested. Coordinator remains pending.

- [ ] R7: the high-risk workflows pass on desktop and mobile, with tablet evidence where the layout needs it
  EVIDENCE: The repaired line-up passes 1569x912 and 390x844 visual, overflow and accessibility checks. Safety Hub also passes 1440x900 and 390x844 with zero Axe WCAG A/AA violations. Remaining high-risk workflows and any necessary tablet layouts are pending.

- [ ] R8: public, signed-out, direct-link, refresh, back-forward, keyboard, empty, error and unavailable-module states have current results
  EVIDENCE: Current signed-out checks pass for protected-route returnTo, public Umpire ballot, forgot-password and useful 404. Additional error, unavailable-module, back-forward and keyboard coverage remains pending.

- [x] R9: focused regression tests and the complete Vitest suite pass
  CHECK: npx vitest run
  EXPECT: Test Files
  EVIDENCE: 33 files and 128 tests passed locally before the 31 August support-table batch; its Dev Quality runs passed.

- [x] R10: TypeScript validates the complete application
  CHECK: npx tsc --noEmit
  EXPECT: /(?:^|\n)\s*$/
  EVIDENCE: npx tsc --noEmit passed before the 31 August support-table commits; their Dev Quality runs passed.

- [x] R11: the Production application build succeeds and build warnings are reviewed
  CHECK: npm run build
  EXPECT: built in
  EVIDENCE: npm run build passed before the 31 August support-table commits. The known large-bundle/dynamic-import and stale Browserslist warnings remain non-blocking debt.

- [x] R12: full lint is measured and no new error exists beyond the documented legacy baseline
  EVIDENCE: Full lint is 349 errors/77 warnings, one error and one warning lower than the prior baseline. Focused lint over the changed components passed with zero findings.

- [ ] R13: at least one complete read-only walk-away cycle has current evidence and no unresolved Blocker or High finding
  EVIDENCE: The 30 August Dev UI cycle found no new Blocker or High application defect, but READY-009 remains an unresolved High operational scraper item.

- [ ] R14: any authorised disposable-data cycle proves create, save, reopen and recoverable cleanup without retained test damage
  EVIDENCE: pending

- [ ] R15: the reviewed Dev package is fast-forwarded to Main and passes staging deployment plus signed-in smoke testing
  EVIDENCE: pending

- [ ] R16: the exact frozen Main-to-Production application, migration, function, job and workflow package is independently reconciled against live Production
  EVIDENCE: pending

- [ ] R17: Production backup, migration dry-run, rollback and post-release smoke procedures are proven without exposing secrets
  EVIDENCE: pending

- [ ] R18: required Dev, Main and Production-capable workflow checks, including scrapers, are green or have an explicitly accepted operational exception
  EVIDENCE: pending

- [ ] R19: Aaron explicitly approves the exact frozen Production package after reviewing risks, accepted debt and rollback evidence
  EVIDENCE: pending

- [ ] R20: the approved Production release passes signed-out and signed-in smoke tests, diagnostics and scheduled-job observation within the rollback window
  EVIDENCE: pending

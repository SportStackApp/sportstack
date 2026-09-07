# Gates: B1 Primary team policy

Scope: Allow one Primary team per association and complete a player-submitted Primary request when an authorised destination administrator approves it, without changing Production.

- [x] P1: the additive migration enforces at most one active Primary membership per person per association while permitting Primary memberships in different associations
  CHECK: python -m unittest tests.test_b1_primary_team_policy -v
  EXPECT: B1_PRIMARY_POLICY_STATIC_OK
  EVIDENCE: 7/7 static tests passed; the staging and Dev runtime inserted two cross-association Primaries and rejected a second Primary in one association.

- [x] P2: a player-submitted request records the current Primary only in the destination association and destination approval completes the membership change without another player action
  EVIDENCE: B1_PRIMARY_TEAM_POLICY_RUNTIME_OK on disposable staging and Dev; approval returned COMPLETED without confirm_primary_team_change.

- [x] P3: same-association approval demotes only the previous Primary in that association and leaves a Primary in another association unchanged
  EVIDENCE: transaction asserted Old A=SECONDARY, New A=PRIMARY and Association B=PRIMARY, then rolled back with no retained test users.

- [x] P4: destination team and club administrators can approve, unrelated administrators are denied, and function grants remain restricted
  EVIDENCE: actual-role Team Manager and Club Admin approvals passed; unrelated user and anon were denied; the private mutation helper is service-role only.

- [x] P5: the Profile and Requests screens describe the one-Primary-per-association and approval-completes-change behaviour
  CHECK: npx vitest run src/lib/primaryTeamMemberships.test.ts src/lib/primaryTeamChangeRpc.test.ts
  EXPECT: Test Files
  EVIDENCE: 2 focused Vitest files/7 tests passed; Profile renders all Primary teams and request/admin wording reflects immediate completion.

- [x] P6: TypeScript and the Production application build pass
  CHECK: npx tsc --noEmit && npm run build
  EXPECT: built in
  EVIDENCE: the frozen candidate passed npx tsc --noEmit and npm run build, five Vitest files/21 tests, 13 focused Python policy tests and 96 tracked Python tests. Dev Quality also passed at deployed commit ed68664. Full lint remains baseline debt.

- [x] P7: the frozen candidate, release packet and Big Brain mirror record the confirmed policy and verified evidence
  CHECK: pwsh -NoProfile -File scripts/sync-sportstack-notes-to-obsidian.ps1 -Check
  EXPECT: CHECK_OK
  EVIDENCE: SYNC_OK and CHECK_OK passed for origin/dev commit 858207a69f51cd93c3e520b41b3355e494bfa3bb, publishing 82 files to D:\AI-Workspace\Memory\Big Brain.

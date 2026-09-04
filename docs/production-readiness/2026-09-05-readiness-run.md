# 5 September 2026 readiness run — evidence

This is a run record, not another plan. The only active queue is
[`../consolidated-open-items-plan.md`](../consolidated-open-items-plan.md).

## Run boundary and timing

- Original start: 05/09/2026 01:14 AEST; six-hour budget; final-hour reserve from 06:14;
  original deadline 07:14.
- The run was interrupted by platform/usage limits. The owner requested continuation; at the
  08:40 resumption the original deadline had already passed. Work was limited to finishing the
  open persistence package, correcting review findings and completing verification/handoff.
  This is not evidence of six uninterrupted working hours or a newly started overnight run.
- `dev` only. Main, `prod`, Production data/functions/secrets/DNS and destructive cleanup are
  excluded. No normal player account changes or external messages were part of this run.
- Existing dependencies were reused; no dependency or global tool installation was required.

## Delivered packages

| Package | Scope | Recorded deployment |
|---|---|---|
| 1 | Unassigned/pending route isolation; atomic primary-team change; scoped line-up/formation/template drafts; Player MVP eligibility regression; first shared control/date sizing batch | Dev `3a52bd9`; Dev Quality `33893606813` passed |
| 2 | Meaningful-column sorting before pagination for Associations, Competitions, Clubs, Divisions, Teams and Venues | Dev `7134f49`; Dev Quality `33895737532` passed |
| 3 | Safer Fixture dialog continuity; isolated Umpire Match ballot drafts; structured Chat drafts and late-response protection | Dev `464d809`; Dev Quality `33928475268` passed |

Package 1 applied Dev-only additive migrations `20260904153312`, `20260904155953` and
`20260904160251`. Rollback, forged-write rejection, authorised workflow and unrelated/scoped-admin
checks passed. Packages 2 and 3 include no database migration.

## Package 3 behaviour and limits

- Fixture Add/Edit/Details identity is remembered per account, role mode and organisation cascade.
  Delete confirmations are never restored. Actual unsaved Add/Edit field values remain transient.
- Signed-in Umpire Match ballots use native per-tab session storage. Copied tabs start with
  independent copies, so edits or Reset in one cannot clear the other. Account keys are separate.
  Successful hierarchy/fixture/player loads validate saved IDs; failed loads retain work.
  Closing the tab is not durable storage; unfinished ballots have a leave-page warning.
- Chat saves text, reply identity, Important and selected mention IDs together per account/channel.
  Old replies outside the first page are checked by ID and channel. Failed validation retains work
  and blocks unsafe sends; member checks have Retry. Cancel Reply keeps typed text. Editing a sent
  message preserves the separate unsent draft. Late channel/message responses cannot replace the
  current scope, and delayed sends must not erase a newer persisted draft.
- The older unvalidated Fixture/Umpire keys are retired rather than used to restore potentially
  destructive or incorrectly scoped state. Old Chat text-only drafts migrate within account/channel.

## Verification evidence

| Check | Result | Boundary |
|---|---|---|
| Vitest | 45 files / 180 tests passed after final send correction | Local logic regressions |
| TypeScript and locked development-plan lint | Passed after final send correction; locked lint covers 218 files | Not equivalent to whole-repository lint |
| Production-mode build | Passed after final send correction | Build mode only; not a Production deployment |
| Python unittest discovery | 153 passed | Existing regression suite; expected guard-denial messages are assertions |
| Umpire refresh/back source checks | 5 passed | Source assertions, not signed-in interaction |
| Umpire copied-tab storage | Passed | Actual helper in local Chromium: copy, edit independently, clear parent, reload child |
| Shared control dimensions | Passed at 390x844, 820x1180 and 1440x900 | Actual Input, SelectTrigger and Button: 44 px; no page overflow |
| Actual Chat component with mocked backend | Seven assertions passed; zero page errors in fresh session | Artificial delays/failures; no Dev authentication or live delivery proof |
| Independent final review | Passed after final corrections | Source and evidence review, not owner acceptance |

The final whole-repository lint run exits non-zero with existing debt of 343 errors / 77 warnings,
unchanged by package 3 and down from 349 / 77 before package 2. Scratch harness files are not shipped
and are lint-clean, so they do not obscure the application baseline.
The build still warns about the large main bundle, mixed static/dynamic SheetJS imports and old
Browserslist data. Those remain in the consolidated queue; they were not silently suppressed.

Scratch artifacts are retained locally at `.unlazy/readiness-20260905/`, including browser result
records, gates, review reports and the isolated harnesses. They are not part of the Big Brain mirror.

The Chat browser source SHA-256 was
`3cfb44360438cefa8c862e69dcfcae7641a05fe7b6d705ccc2561d7eba12d978`, matching the committed component.
The seven cases covered channel lookup and message response races, older-reply restoration,
failed-member Retry with retained mentions, separate team drafts, delayed-send newer-draft
retention and ordinary successful clearing. Real transport/realtime, role access and a second
Chat tab were not exercised; the second-tab storage guard has source and helper-test evidence only.

## Feedback and open acceptance

The live Dev `app_feedback` count was rechecked on 05/09: **88 retained, 0 OPEN, 53 REVIEWED,
35 CLOSED**. No reviewed item was closed because of source tests or isolated mocks alone.

The controlled browser is signed out and cannot inherit the user's in-app login. The following
remain unverified on the deployed bundle:

- Actual-role new-user/pending-user access, primary-team approval and Player MVP eligibility.
- Full signed-in Fixture, Umpire Match ballot and Chat navigation/reload/send workflows.
- All 42 date controls across 16 files, route-specific size overrides, Safari/iPhone and 200% zoom.
- Whole-site sorting/filter persistence and the remaining workflow cycles in the active plan.

Aaron still needs to define the intended audience of **named Player MVP shout-outs**. This is
separate from the earlier club-scoped individual-ballot access decision.

Source review also found that Chat can silently ignore a failed mention insert after the message
itself succeeds. The delivery impact needs a disposable failure test; it is recorded in the active
acceptance queue, not claimed fixed by draft persistence work.

## Handoff

- Dev source commit: `464d80977dd75747264d66d1f1249ceea1c94ff8`.
- Dev Quality run `33928475268` passed every step, including Python and pinned workflow validation.
- Vercel Preview deployment `6274429070` (GitHub deployment ID) succeeded at
  `https://sportstack-3b2wcbb8e-sportstackapps-projects.vercel.app`. It and the Dev alias return HTTP
  200 and serve `/assets/index-DWsFbnAl.js`; the bundle contains the expected source commit and repair.
- Deployed signed-out `/chat` redirects to `/login?returnTo=%2Fchat` with no observed page errors.
  The initial `/communications` probe returned 404 because it is not a registered route; the
  source-defined `/chat` route was then used. This is not a Chat route regression.
- Final documentation is a separate docs-only follow-up to the tested application commit. Its
  own CI/deployment and committed-source Big Brain sync/check must be verified before final handoff.
- To unblock actual-role tests, sign a reserved disposable Dev account into the explicitly
  controlled test browser and verify the account/role before resuming writes. An in-app sign-in
  alone is not evidence that the automation session is authenticated.
- Next eligible implementation queue: Requests and RevSports Mappings sorting/state, remaining
  filter/date size overrides, then other prioritised persistence findings. Do not restart a
  six-hour run merely because one package is complete.
- Main promotion and Production approval remain gated by the consolidated plan.

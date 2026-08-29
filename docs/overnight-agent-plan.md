# SportStack Overnight Agent Plan

Last updated: 29/07/2026

For current unattended UI/UX readiness runs, use
`docs/production-readiness/WALK-AWAY-CHARTER.md`. This older document remains the narrower plan for
an unattended Dev code/diagnosis job and does not replace the current Production readiness
programme.

## Purpose

Keep useful SportStack work progressing during an unattended overnight window without creating uncontrolled production, database or deployment risk.

## Operating boundary

### Allowed tonight

- Read repository code, documentation, Git history and non-secret GitHub metadata.
- Inspect GitHub Actions run summaries and redacted logs.
- Run lint, TypeScript checks, builds and existing non-destructive tests.
- Compare failed and successful Dev scraper runs.
- Make one small, evidence-backed, low-risk improvement on `dev`.
- Commit and push that improvement to `dev` only after required checks pass.
- Perform an independent review and, if necessary, push a narrowly scoped correction to `dev`.
- Produce one morning briefing with evidence, commit identifiers, checks and blockers.

### Not allowed tonight

- No checkout, commit, push, merge or deployment involving `prod`.
- No production database, Auth, Storage, Edge Function, secret, DNS, Cloudflare or Vercel change.
- No database migration or live database write in any environment.
- No secret access and no reading `.env` or `.env.local`.
- No destructive operation, force-push, history rewrite, branch deletion or check bypass.
- No GitHub branch-protection, ruleset, environment-policy or repository-settings change.
- No automatic `dev` -> `main` promotion. Recheck current divergence at the start of every run;
  any promotion needs an intentional reviewed task rather than an unattended blanket merge.
- No workflow change capable of selecting Production or using Production secret names.

## Job sequence

### 1. Baseline and diagnosis — immediate

- Verify `dev`, `origin`, effective Git identity and a clean working tree.
- Read `AGENTS.md`, `docs/current-state.md` and `docs/project-brief.md`.
- Run the repository quality gates without changing dependencies or lockfiles.
- Inspect recent GitHub Actions failures and the next successful run.
- Determine whether the scraper failure is transient, code-driven or Dev-database-driven.
- Return a concise evidence-based baseline; make no source change.

### 2. One bounded Dev improvement — approximately two hours

- Consume the baseline output.
- Stop if the tree is dirty, branch identity is wrong, remote state changed unexpectedly or the task reaches a protected boundary.
- Select exactly one low-risk improvement supported by repository evidence.
- Prefer a deterministic application, scraper or documentation fix with a clear verification path.
- Run focused checks plus lint, TypeScript and build gates.
- Commit and push to `dev` only if the change is scoped, explainable and no new failure is introduced.

### 3. Independent Dev review — approximately five hours

- Review the baseline and implementation outputs and inspect the actual current Git diff/history.
- Re-run relevant checks.
- Correct only a clear defect introduced by the overnight change; otherwise make no edit.
- Keep all work on `dev`.

### 4. Morning briefing — approximately eight hours

Report:

- What was inspected and changed.
- Exact files and commits, if any.
- Quality-gate outcomes, distinguishing pre-existing failures from regressions.
- GitHub Actions diagnosis.
- Current `dev`/`main` divergence.
- Blockers requiring Aaron.
- One recommended next action and its risk.

## Stop conditions

Every job must stop safely and report rather than improvise if:

- The working tree contains unexpected changes.
- Authentication no longer resolves to `SportStackApp`.
- The repository is not on the expected branch.
- A change requires a secret or production access.
- A migration, live database write, destructive command or remote-policy change would be required.
- The evidence does not support one clear low-risk change.
- Required checks cannot be completed within the bounded run.

## Audit and delivery

- Intermediate job outputs remain local and are chained into later jobs.
- Only the final morning briefing is delivered to this conversation.
- Jobs run from the configured SportStack workspace. Confirm the actual path at the start of every
  run rather than relying on an older machine-specific path.
- Each scheduled agent run has Hermes' scheduler time limit; there is no unbounded autonomous loop.

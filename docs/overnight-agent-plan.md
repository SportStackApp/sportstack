# SportStack Overnight Agent Plan

Last updated: 31/08/2026

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
- Work through the approved queue of evidence-backed, low-risk improvements on `dev` while time
  and verification capacity remain.
- Commit and push coherent improvements to `dev` only after required checks pass.
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

### 2. Approved Dev fix queue — until the final verification reserve

- Consume the baseline output.
- Stop if the tree is dirty, branch identity is wrong, remote state changed unexpectedly or the task reaches a protected boundary.
- Order reproducible findings by severity, direct relevance, confidence and verification cost.
- Accept only improvements within the authorised fix classes. Prefer deterministic application,
  scraper or documentation fixes with clear verification paths.
- Make each change coherent and run its focused check before starting the next one. Group changes
  only when they share the same cause or verification path.
- Do not impose a numerical fix cap. Continue while eligible work and enough verification time
  remain.
- Stop accepting new fixes at least 60 minutes before the run ends, or earlier when mandatory
  checks need longer.
- Run the complete lint-baseline comparison, TypeScript, build and relevant test gates during that
  reserve.
- Commit and push coherent changes to `dev` only if they are scoped, explainable and introduce no
  new failure.

### 3. Independent Dev review — final verification reserve

- Review the baseline and implementation outputs and inspect the actual current Git diff/history.
- Re-run relevant checks.
- Correct a clear defect introduced by the overnight changes and re-run the affected gates. Do not
  begin another unrelated fix during the reserve.
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
- The evidence does not support any clear low-risk change within the approved fix classes.
- Required checks cannot be completed within the bounded run.

## Audit and delivery

- Intermediate job outputs remain local and are chained into later jobs.
- Only the final morning briefing is delivered to this conversation.
- Jobs run from the configured SportStack workspace. Confirm the actual path at the start of every
  run rather than relying on an older machine-specific path.
- Each scheduled agent run has Hermes' scheduler time limit; there is no unbounded autonomous loop.

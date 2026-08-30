# SportStack Walk-Away Night Test Charter

Status: **template — complete before each unattended run**

## Safe default

Unless Aaron has explicitly authorised more in the completed run details, the run is:

- target: Dev only;
- mode: read-only and report-only;
- identities: already-authorised signed-out or Dev test sessions only;
- viewports: desktop and mobile;
- data changes: none;
- fixes, commits and pushes: none; and
- Production, `prod`, Production Supabase, secrets, DNS and domains: prohibited.

## Run details

- Run ID:
- Start time and maximum duration:
- Dev commit and deployment:
- Route bundle:
- Authorised identities and exact Working-as scopes:
- Viewports:
- Read-only or named disposable Dev data:
- Mode: report-only or fix-and-retest:
- Authorised fix classes, if any:
- Final verification reserve:
- Evidence folder:
- Known findings to retest:

If a field is unanswered, use the safe default and record it in `decisions.md`.

## Allowed read-only actions

- Navigate, refresh, use back/forward and open direct links.
- Search, filter, sort, change page size and switch non-destructive tabs.
- Open and dismiss read-only details and modals.
- Test keyboard focus, Enter and Escape where they do not submit data.
- Capture screenshots and non-secret browser diagnostics.
- Compare visible role/scope behaviour against the route register.

## Data-changing boundary

Treat Save, Submit, Send, Vote, Approve, Reject, Escalate, Assign, Invite, Join, Leave, Upload,
Archive, Delete and role/scope changes as data-changing.

Do not cross this boundary unless the run details name the Dev identity, disposable record, expected
change and recoverable cleanup. Never guess that a final button is harmless. Test up to the button
and mark the step Blocked when authority or disposable data is missing.

## Night sequence

### 1. Preflight

- Confirm the repository is on `dev`, the working tree has no unexpected changes and remote Dev has
  not moved unexpectedly.
- Confirm the live Dev build matches the recorded commit.
- Run the repository-pinned browser tool through `npx agent-browser` and confirm it starts.
- Confirm the controllable browser—not only a separate Codex in-app tab—is the intended authorised
  Dev identity and scope.
- Open one protected route and complete one harmless interaction in that controllable browser.
- If actual-role testing is planned, confirm the reserved disposable Dev account and permitted
  recoverable changes. Never record its temporary credentials.
- Create an isolated evidence folder.
- Copy these run details into `charter.md` and start `decisions.md`.

The run status remains **NOT READY** until every required preflight item above passes. Report the
smallest owner action immediately; do not wait until the unattended period has started.

### 2. Baseline health

- Check the current Dev Quality, Dev deployment and relevant scraper/job status.
- Open the landing, login and one protected direct link.
- Record console or failed-network problems before beginning the route bundle.

### 3. Route bundle review

For each screen, check purpose, navigation, visibility, interaction feedback, loading/empty/error
states, responsive layout, keyboard basics, Australian English, privacy and diagnostics.

For every table:

- compare headers with the table register;
- test each intended ascending and descending sort;
- confirm the indicator and accessible direction;
- combine sorting with a filter and pagination where present; and
- confirm action-only columns are not presented as sortable.

For every form/filter/modal:

- enter harmless non-sensitive draft/filter text;
- switch browser tabs and application focus;
- use back/forward or refresh only where the persistence register expects survival;
- confirm a higher scope change clears invalid lower selections; and
- confirm no password, token or file input is stored.

### 4. Finding and retest

- Record one finding per underlying problem with severity, route, role/scope, viewport, reproduction,
  expected/actual result, impact and evidence.
- Retest known findings using their original steps.
- Do not call a problem fixed from code inspection alone.
- Continue past ordinary Low/Medium findings when the remaining route bundle is safe.

### 5. Authorised fix-and-retest

Skip this section in report-only mode.

- Build an ordered queue from reproducible findings that fit the authorised fix classes.
- Accept a fix only when it is directly relevant, low risk, supported by evidence and has a clear
  verification path.
- Do not impose an arbitrary numerical fix limit. Continue through eligible fixes while enough
  time remains for the final verification reserve.
- Make the smallest coherent change and run its focused check before starting another. Group fixes
  only when they share the same cause or verification path.
- Stop accepting new fixes when the final verification reserve begins.
- During the reserve, run the complete required quality checks, inspect the final diff, retest the
  repaired behaviour and prepare the handoff.
- Commit or push only when the run details and repository rules authorise it and all required gates
  pass.

### 6. Close-out

- Save `summary.md`, `issues.md`, `decisions.md` and screenshots.
- Record Passed, Failed, Blocked and Not tested coverage separately.
- Confirm whether any data, code, Git branch or deployment changed.
- Give one recommended next action.

## Route-bundle rotation

| Night | Primary coverage |
|---|---|
| A | Admin dashboard, entity management, Fixtures and RevSports Review |
| B | Profile, Roster, availability, line-up and Coaching |
| C | Player MVP Voting, Umpire Match Voting and analytics |
| D | Communications, Coordination, Committee, Safety, Expense and Discipline |
| E | Mobile/tablet replay of repaired and still-open findings |

Repeat a bundle after a meaningful repair. Do not interpret one desktop pass as mobile, role or
write-workflow coverage.

## Evidence folder

Use a temporary folder outside the repository:

```text
sportstack-ui-ux-review-YYYYMMDD-HHMMSS/
|-- charter.md
|-- decisions.md
|-- summary.md
|-- issues.md
|-- screenshots/
`-- diagnostics/
```

Do not store passwords, tokens, browser authentication state, full personal records or secrets.
Evidence is not committed unless Aaron later asks for a reviewed evidence package.

## Stop conditions

Stop safely and report if:

- the target is not Dev or the browser identity/scope is uncertain;
- the working tree contains unexpected changes;
- the deployed commit changed during a finding reproduction;
- a test needs Production, a secret, permission elevation or destructive cleanup;
- personal or sensitive information appears outside the expected scope;
- repeated failed requests make results unreliable;
- the authenticated session expires and cannot be safely restored; or
- a Blocker or High issue creates a risk of data loss by continuing.

## Morning report

Report only:

- overall outcome;
- Blocker, High, Medium and Low counts;
- important passed coverage;
- blocked/not-tested coverage and the smallest action needed;
- whether any code or data changed;
- the single best next action; and
- the absolute evidence-folder path.

## Unexpected decision format

```markdown
## DEC-001 - Short decision title

- Encountered: route and step
- Problem: what prevented the planned path
- Options considered: safe alternatives only
- Decision taken: safest option within the charter
- Why: reason
- Effect: what continued, stopped or became Blocked
```

The decision log cannot authorise Production or another prohibited action.

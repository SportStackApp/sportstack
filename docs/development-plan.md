# SportStack Development Plan

Status: historical implementation order from 1 August 2026.

> Current priorities and remaining work are consolidated in
> `docs/consolidated-open-items-plan.md`. Keep this file as implementation history and detailed
> evidence; do not use its older pending-status wording as the active priority list.

The blocks below are completed in order where practical. Work starts on `dev`, is tested and
documented, then moves to `main` for staging. Production, DNS, redirects and destructive changes
remain separately approval-gated.

## Owner-test remediation package — implemented on Dev, integrated verification active

The owner-test findings collected from 31 July to 2 August are matched line by line in
`docs/owner-test-matrix.md`. The package has since reached Main staging; remaining acceptance and
cleanup work is tracked in the consolidated plan. Production Supabase, domains and redirects remain
separately approval-gated.

1. **Permissions and data integrity:** scoped server functions, role hierarchy, Viewing-as data
   restrictions, protected higher-role accounts, membership write guards, administration audit
   history, a pre-cleanup duplicate-membership snapshot, and reusable module permission groups,
   sets, role/user assignments and direct exceptions.
2. **Stability and persistence:** route error recovery, URL-backed scope/tabs/filters, retained
   drafts, restored chat context and account-backed theme preference.
3. **Navigation and dashboards:** consistent dashboard/overview names, Team Overview cascade
   behaviour, assigned-scope cascade options, scoped KPI links, compact menus and separate MVP and
   Umpiring navigation.
4. **Fixtures and communications:** working fixture view controls, readable competition/round/bye
   display, immutable chat revision history, newest-first entry, 50-message upward pagination and
   no self-notifications.
5. **Player MVP Voting:** SportStack player identity and numbers, status/time remaining, complete
   fixture details, selector deduplication, stronger result reporting and three separate analytics
   tabs with persistent filters.
6. **Umpire Match Voting:** one-character SportStack name suggestions, division-driven vote scheme,
   round dates, inline ballot validation, acknowledged number-only warnings, retained Back state,
   correction history/name fixes and persistent leaderboard scope.
7. **Coaching and profile:** deduplicated Squad/Roster, relationship KPIs, shared canonical position
   groups, Team Player Details, landscape/focus Formation Builder controls, scoped formation sharing
   and complete role/scope display.
8. **Safety Hub:** compact lists and KPIs, stable linked-record/edit routes, BE SMART layout,
   multi-record links, simplified Bright Idea form and audited organisation-specific 5x5 matrix and
   category configuration.
9. **Committee Management:** Committee Work and Administration areas, meeting calendar/scheduling,
   attendance/apologies/minutes/actions, searchable minutes, private 20 MB uploads, archived agenda
   templates, reorderable sections and multi-record Safety Hub links.
10. **Verification and handoff:** the advanced permission resolver, hierarchy and mode-aware
    read/write/listing/runtime paths have passed rolled-back Dev checks. Duplicate role rejection,
    live-session provisioning authorisation and function-access checks pass. Baseline-aware plan
    lint, TypeScript, build and 30 focused migration/security tests pass; actual-role browser testing
    is still required before staging.

The duplicate-membership snapshot contains 201 duplicate user/team groups and 44 users with
multiple active Primary memberships, covering 490 captured historical rows. New duplicates are
blocked. No historical membership row has been changed; cleanup remains a separate approval gate.

## 1. Finish RevSports work — complete 1 August 2026

- Repair the unfinished fixture importer file without losing valid work.
- Complete fixture matching and import safety checks.
- Test, document, commit and push the completed package.

The unfinished importer was proven to contain duplicated conflict text only, backed up outside the
repository, restored to the committed implementation and verified with 94 Python tests plus the
frontend TypeScript and build gates.

## 2. Complete Umpire Portal release — approval-gated

- Run the read-only Production preflight using the encrypted Vercel and Supabase access.
- Release the prepared Umpire Portal package after the required Production approval.
- Test both login choices and one clearly marked test ballot.

The future Umpire Portal address is `hb.sportstackapp.com.au`. Connecting it remains part of the
separately approval-gated domain rollout.

The read-only release preflight now reaches the branch-alignment gate. Promoting the current
`dev` package to `main` needs Aaron's explicit approval because that package includes a GitHub
workflow capable of selecting Production targets. No Production action has been taken.

## 3. Formation and Lineup Planner — implemented on Dev, owner smoke pending

- Finish Formation Builder reliability and saved-template behaviour.
- Improve fixture lineup selection and player eligibility.
- Improve mobile formation and pitch controls.

Dev now has reusable field-template persistence with four existing formations safely backfilled,
scoped RLS policies and hardened grants. The app also has persistent custom icon uploads, safer
line-up replacement, team-scoped position preferences, a two-team selector for authorised admins,
formation-change protection and clearer mobile controls.

## 4. New domain rollout — repository ready, live rollout approval-gated

- Update the prepared domain work and keep all current URLs operating.
- Add the new domains alongside the existing addresses.
- Verify authentication and links before enabling redirects.

The repository now maps `hb.sportstackapp.com.au` to the existing SportStack Umpire Portal and
preserves the normal home page on every other hostname. Edge Function origin, email-link fallback
and environment-label preparation is complete. Live Vercel, DNS, Supabase Auth, Turnstile,
deployment and redirect work has not started and still needs explicit approval.

## 5. Navigation and menus — implemented on Dev, owner smoke pending

- Review every route, menu item and permission.
- Put everyday tasks first and group related tools logically.
- Keep desktop and mobile navigation clean, current and consistent.

The signed-in menus now use a consistent everyday workflow, separate Player MVP Voting from
Umpire Match Voting, expose the existing competition and import pages to the correct administrators,
and keep detail/build screens contextual. Association and club menu choices are explicitly scoped;
page checks, RLS and Edge Functions remain the security boundary.

## 6. Dashboard and availability — implemented on Dev, owner smoke pending

- Improve primary-team information and upcoming fixture details.
- Make player availability easier to understand and update.
- Keep the Association to Club to Division to Team workflow consistent.

The dashboard now identifies the selected team's Primary, Secondary or Fill-in relationship, makes
home/away, division, date, time, venue and published line-up information easier to scan, and shows
availability only for the signed-in player's eligible fixtures. Availability uses accessible
buttons, prevents repeat writes while saving and reports load failures separately from empty data.

## 7. Communications — implemented on Dev, owner smoke pending

- Improve team communications and notices.
- Add club and association broadcasts.
- Improve reminders and relevant audience controls.

Team Chat, Club Updates and Association Updates are live as separate scoped areas. This reliability
pass adds a visible audience summary, requires confirmation before an official update is published,
keeps Enter-to-send limited to Team Chat, preserves deep links to older messages, resets scope
permission/settings state safely and distinguishes load failures from empty conversations.

## 8. Voting reliability — implemented on Dev, owner smoke pending

- Improve Player MVP Voting reliability and administration.
- Improve Umpire Match Voting administration and audit history.
- Keep the two voting modules clearly separated.

Player MVP Voting already saves each 3-2-1 ballot through one locked database function and its
live Dev integrity audit is clean. Signed-in Umpire Match Voting now shows completed fixtures only,
validates the full ballot and saves its header plus every vote line through one atomic database
function. Direct browser inserts are blocked, duplicate ballots are serialised and blocked, Super
Admin access is consistent with navigation, and the two modules use explicit names throughout.

## 9. Core administration — implemented on Dev, owner smoke pending

- Improve user, team and organisation management.
- Improve fixtures, venues, requests and data-quality tools.
- Add safer warnings and clearer admin workflows.

Fixture imports now resolve exact Club - Division - Team labels, reject ambiguous or mixed-division
rows, save division and season links, and require an all-valid preview plus confirmation. Normal
fixture add/edit also saves those links. Membership-request approval and safe unused-venue deletion
now use scoped atomic database functions so partial browser writes and silent historical-link loss
are blocked. Existing duplicate membership data was audited and parked for a separate dry-run review.

## 10. Permissions and module controls — implemented on Dev, owner smoke pending

- Separate permissions for each module.
- Support association, club, division and team scope.
- Add committee positions, inherited access and controlled exclusions.

Dev now has live scoped module controls for Player MVP Voting, Umpire Match Voting, Committee
Management, Risk and Quality Improvement, and the experimental Hockey Trace Lab. Association and
Club administrators can create confirmed child overrides only inside their managed scope, restore
inheritance and see the effective result. Signed-in routes and menus apply the closest team,
division, club or association setting; the existing modules remain enabled by default.

The 2 August extension adds named permission groups, reusable module-access sets, assignments to a
role/group/user and reasoned direct exceptions. The server enforces scope and administrator
hierarchy, archives instead of hard-deleting configuration and audits every change. Rolled-back Dev
tests confirm a direct user exception overrides a group set and Club Admin mode cannot target
Super, Association or Club Admin accounts. Action-level catalogue entries remain hidden until their
individual workflow write paths enforce them end to end.

The follow-up Dev migrations ending `105000`, `106000`, `107000`, `108000`, `109000`, `110000`,
`113500`, `114000` and `115000` are applied after successful rollback compile/runtime checks. The
actual Admin Sportstack `SUPER_ADMIN` is signed in, and the secured version 6 Dev-account
provisioner has JWT verification enabled, checks the live session and refuses to reset existing
identities. Module visibility and
active Viewing-as mode now use the mode-aware application resolver alongside existing workflow
RLS; permission groups also enforce exact scope and member hierarchy. Full action-level permission
wiring remains future work. Seven isolated Dev role accounts are prepared; the actual-role browser
matrix is pending.

## 11. Committee setup — implemented on Dev, owner smoke pending

- Create association-level and club-level committees.
- Add custom position titles and assign positions to users.
- Add position permissions, appointment dates, governance documents and qualification records.

Dev now has private association and club committees with custom position titles and eight explicit
position permissions. Current appointments inherit their position permissions and carry start/end
dates. Scoped administrators and authorised position holders can maintain appointments, governance
document links and qualification/expiry records; anonymous users cannot read committee data.

## 12. Committee operations — implemented on Dev, owner smoke pending

- Add polls with free-text, choose-one, choose-multiple and Yes/No/Abstain questions.
- Add reusable meeting templates, agendas, minutes, decisions and assigned actions.
- Add private committee chat with access limited to current committee members.

Dev now has atomic committee poll creation and one-response-per-member submission, including all
four planned question styles. Reusable agenda templates create meeting agendas with separate
minutes, decisions and assigned actions beside every point. Current members can read private chat;
posting and voting require explicit position permissions. An append-only activity view records
committee setup, poll, meeting, minutes and chat changes.

## 13. Risk and Quality Improvement — implemented on Dev, owner smoke pending

- Complete Risk Register, risk review and BE SMART Action write workflows.
- Complete Quality Improvement and Bright Idea workflows.
- Link committee decisions and maintain a complete audit history.

The existing live Safety Hub now saves Risk Register, BE SMART Action, Quality Improvement, Bright
Idea, committee-review, risk-review and record-link forms instead of retaining browser-only drafts.
One RLS-protected transaction saves each record and its permanent links, while the existing
append-only audit triggers record every change. Committee meeting decisions can link to accessible
Risk or Quality records only when the record is real and inside the committee's organisation scope.

## 14. Testing and reliability — implemented on Dev, ongoing monitoring

- Expand focused automated and browser workflow checks.
- Monitor scrapers, notifications, backups and storage.
- Keep current-state, handover and Obsidian notes accurate.

The Dev-only quality workflow now runs on every `dev` push and relevant pull request. It checks the
locked development-plan TypeScript package, TypeScript compilation, the production build, 100
Python regression tests and every GitHub workflow with checksum-verified `actionlint` 1.7.12.
The first complete remote run passed. Read-only monitoring also confirmed successful current Dev
and Production scraper runs, successful notification schedules and the expected aggregate backup
and Storage totals. Signed-in browser workflows remain an owner smoke-test step because they need a
real user session and role context.

## Operating boundary

- Routine, reversible work may continue on `dev` and reviewed staging work may move to `main`.
- No `prod` promotion, Production service change, DNS change or redirect activation without Aaron's
  explicit approval for that package.
- No destructive database or file operation without exact target verification and approval.
- Existing user changes are preserved and never silently discarded.

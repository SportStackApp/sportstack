# PROJECT SCOPE, UI/UX, CURRENT STATE, AND IMPLEMENTATION PLAN

**Project:** SportStack
**Companion to:** `TECHNICAL_SPECIFICATION_AND_SYSTEM_HANDOFF.md`
**Prepared:** 15 June 2026
**Grounding:** Live Supabase projects (`icqegnpjbizccjebjfhb` for Dev/Main and `svierarfcolhcfjpmwck` for Production), the real repo `SportStackApp/sportstack`, `docs/project-brief.md`, and `notes/` session handoffs. Deployment topology refreshed 22 July 2026.

> Marking convention: **UNKNOWN — needs confirmation** and **ASSUMPTION — confirm before implementation** as in Doc 1.

---

## 1. Product summary

- **What it is:** A private web app that turns RevSports hockey competition data into a clean, admin-friendly system for regional Victorian associations, plus team/player tools, Player MVP Voting, and Umpire Match Voting.
- **Who it's for:** Hockey Ballarat (HB), Sunraysia Hockey Association (SHA), Wimmera Hockey Association (WHA) — their admins, clubs, teams, coaches, players, and umpires. The super admin/owner runs the platform.
- **Problem it solves:** RevSports is read-only and clunky for admins; clubs juggle spreadsheets. SportStack centralises fixtures, rosters, results, player history, Player MVP Voting, and Umpire Match Voting.
- **Success looks like:** Each association's fixtures/results/rosters load automatically from scrapers with clean mappings; admins manage entities without spreadsheets; Player MVP Voting runs end-to-end for a real game; and authorised umpires can submit and administrators can review Umpire Match Voting records.
- **What it is NOT (current scope):** not multi-sport yet, not multi-tenant/commercial, no payments, no full custom formation builder, no push notifications. (Per `docs/project-brief.md` "Do Not Build Unless Explicitly Asked".)

---

## 2. Current state

Terminology used below:

- **Player MVP Voting**: players vote for peers after a game. Short UI label: **Player MVP**. Suggested future namespace: `player_mvp`.
- **Umpire Match Voting**: assigned or authorised umpires submit official post-match votes for eligible people associated with a completed fixture. Short UI label: **Umpire Votes**. Suggested future namespace: `umpire_match_votes`.
- The modules have separate permissions, workflows, submissions, and results. Do not shorten either to a generic "Voting" or "Votes" label where the meaning could be unclear.

| Feature | Status | Notes | Files/components | Next action |
|---|---|---|---|---|
| Associations / Clubs / Teams / Divisions / Venues / Competitions CRUD | **Built** | Admin screens exist; data present (3/19/87/21/10/3) | `src/pages/admin/*Management.tsx` | Verify scope cascade + truncation UI standard |
| Auth (email + Google SSO) | **Built** | Supabase Auth; `ProtectedRoute`; `/pending` gate | `contexts/AuthContext.tsx`, `components/auth/ProtectedRoute.tsx` | Confirm Google redirect URLs in prod |
| 4-level scope cascade (Assoc→Club→Div→Team) | **Built** | reset-below-on-change learned the hard way | `AppModeContext`, `TeamContext`, `useAdminScope.ts` | Regression test resets |
| RevSports scrapers (HB, SHA, WHA) | **Built / evolving** | scheduled via Actions; CSV + Supabase upsert | `scraper/scraper.py`, workflows | Merge `sunraysia_test_scraper` improvements (per memory) |
| Player registry & history scrapers | **Built** | registry 742 rows, history 4,014 rows | `player_registry_scraper.py`, `history_scraper.py` | Confirm full history run completed |
| RevSports mapping admin | **Built** | mappings populated (teams 169, players 1,638, etc.) | `RevSportsMappings.tsx`, `RevSportsUnmatched.tsx` | Fix status flip-to-matched bug (per notes) |
| Fixture import bridge | **Partial / buggy** | imports teams + scores but NOT division_id/season_id | `scraper/fixture_import.py` | Fix null FKs + backfill 517 rows |
| Fixtures management | **Built** | 517 fixtures; 221 completed with scores | `FixturesManagement.tsx`, `Games.tsx`, `GameDetail.tsx` | Depends on FK fix |
| Bulk import / Add player | **Built** | Edge Functions back these | `BulkImport.tsx`, `AddPlayer.tsx`, edge fns | Reconcile `bulk-import-players` repo↔deploy |
| Team memberships / roster | **Built** | 1,212 memberships | `Roster.tsx`, `team_memberships` | Verify single ACTIVE badge per user (per memory) |
| Player MVP Voting | **Partial in this dated plan** | infra built (sessions, tokens, RLS, audit); 2 sessions, 0 tokens/votes | `VotingPortal.tsx`, `MvpVotingAdmin.tsx`, `mvp_*` tables | Player matching, email sending, auto-close |
| Umpire Match Voting | **Partial in this dated plan** | legacy umpire-portal submissions and lines migrated | `UmpireVoteSubmit.tsx`, `player_vote_*` tables | Re-link historical submissions to umpire profiles where safe |
| Umpire rating schema (separate, not Umpire Match Voting) | **Schema only** | `umpire_vote_*` tables contain umpire-rating fields and 0 rows | generated Supabase types, `umpire_*` tables | **UNKNOWN — needs confirmation** before product planning |
| Coaching squad / assessments | **Partial** | UI present; assessment/preference tables empty | `coaching/*`, `coach_position_assessments`, `player_position_preferences` | Confirm scope |
| Lineup planner | **Schema only** | `lineups` table empty; DnD libs installed | `Lineup.tsx`, `components/lineup/*` | Build (design agreed in memory) |
| Chat / team messages | **Stub** | route exists; `team_messages` empty | `Chat.tsx` | Confirm if in scope |
| Notifications (in-app) | **Stub** | tables empty, unwired | `notifications*` tables | Parked |
| Email (Player MVP Voting links/reminders) | **Not built** | no provider/SDK | — | Choose provider; build sending |
| Risk/Governance (`rg_*`) | **Schema only** | full schema + RLS; ~0 data; matrix seeded | `rg_*` tables | Confirm whether in SportStack scope |
| Automated tests / CI build gate | **Not built** | none | — | Add CI |

**Works locally:** the SPA against the shared Supabase project; scrapers run from PowerShell.
**Works in production:** the deployed SPA (Vercel) + scheduled scrapers.
**Broken/uncertain in this dated plan:** fixture FK population (division/season); Player MVP Voting end-to-end; Player MVP Voting email; and the separate umpire-rating schema status.

---

## 3. User roles and personas

Roles (live enum, 9): SUPER_ADMIN, ASSOCIATION_ADMIN, CLUB_ADMIN, TEAM_MANAGER, COACH, PLAYER, UMPIRE, VOTER, UMPIRE_ADMIN.

| Role | Can see | Can do | Cannot do | Main screens | Edge cases |
|---|---|---|---|---|---|
| SUPER_ADMIN | Everything across all associations | All CRUD, mappings, imports, Player MVP Voting admin, Umpire Match Voting admin, user roles | n/a | all `/admin/*` | Only 1 exists (the owner); seed row reportedly disappears |
| ASSOCIATION_ADMIN | Their association's clubs/teams/fixtures | Manage within association | Cross-association data | `/admin/*` scoped | Scope cascade must enforce association |
| CLUB_ADMIN | Their club's teams/players | Manage club teams, rosters | Other clubs | club-scoped admin/dashboards | |
| TEAM_MANAGER | Their team | Manage roster, lineup, availability | Other teams | `/roster`, `/games`, `/games/:id/lineup` | Often same person as COACH |
| COACH | Their team + coaching tools | Assessments, squad view, lineup | Admin CRUD | `/coaching`, `/coaching/:playerId` | |
| PLAYER | Their team(s), own profile | View games, set availability, participate in Player MVP Voting | Admin/other teams | `/dashboard`, `/games`, `/profile`, `/mvp-votes` | Many are placeholder accounts |
| UMPIRE | Umpire Match Voting screens | Submit official Umpire Match Voting choices | Admin | `/umpire/vote` | Needs SportStack account |
| UMPIRE_ADMIN | Umpire scheduling and Umpire Match Voting admin | Manage umpire rounds and authorised submissions | non-umpire admin | umpire admin (UNKNOWN — confirm screen) | |
| VOTER (historical public Player MVP token flow) | A single Player MVP Voting page | Cast 3/2/1 Player MVP choices via `/vote/:token` | Anything else | `/vote/:token` (no login) | Token expiry + single-use |

---

## 4. User journeys

> Loading/error/empty states below are the **target** behaviour; current implementation completeness varies (see §2).

**First-time user (sign up)**
- Trigger: visits `/signup`. Steps: enter details / Google SSO → auth user + profile created (`handle_new_user`) → redirected to `/pending` if no role. Result: awaits admin role grant. Errors: duplicate email; weak password. Empty: "no teams yet". Data changed: `auth.users`, `profiles`.

**Returning user (login)**
- Trigger: `/login`. Steps: email/password or Google → session restored from `localStorage` → `/dashboard`. Permission: role-scoped nav. Errors: bad credentials, unconfirmed email.

**Admin: manage an entity (e.g. create a team)**
- Trigger: `/admin/teams` → "Add". Steps: pick club + division → save (RLS-gated insert). Result: team appears; `team_divisions` row expected. Errors: duplicate name within association (see duplicate-name risk). Data: `teams` (+ `team_divisions`).

**Admin: RevSports mapping**
- Trigger: `/admin/revsports-mappings`. Steps: review unmapped names → select internal entity → save → status should flip to `matched`. Result: future imports resolve. Known bug: status stays `unmatched` on save (notes). Empty state: "all mapped". Data: `revsports_*_mappings`.

**Data entry: scraper → fixtures (automated)**
- Trigger: scheduled Action or `/admin/fixture-import`. Steps: scrape → upsert `revsports_players` → `fixture_import.py` dedupes to one row/game, resolves mappings, upserts `fixtures` on `revsports_match_url`. Result: fixtures populated (currently missing division/season). Errors: unmapped rows → `revsports_unmatched_items`. Data: `fixtures`.

**Editing records**
- Trigger: admin edit form. `updated_at` maintained by triggers. Confirm before overwriting scraped values.

**Deleting/archiving**
- Trigger: admin delete. **Order matters** for fixtures with Umpire Match Voting data: delete `player_vote_edits` → `player_vote_lines` → `player_vote_submissions` → `fixtures`. Always confirm (destructive on prod).

**Searching/filtering**
- Users page: planned Division/Team filter dropdowns + rows-per-page (10/25/50, default 25) across admin pages (per memory).

**Importing/exporting**
- `/admin/bulk-import` (xlsx). Bulk import must **not** email players.

**Player MVP Voting email/notification flow (PLANNED)**
- Trigger: open Player MVP Voting session → issue tokens → send links → 48h/24h reminders. Currently no sending mechanism in this dated plan.

**Player MVP Voting (historical public-token journey)**
- Trigger: voter opens `/vote/:token`. Steps: see eligible players (attended, no self-vote) → assign 3/2/1 → submit → token marked voted. Result: `mvp_votes` rows. Errors: expired/used token. Empty: closed Player MVP Voting session.

**Umpire Match Voting**
- Trigger: assigned or authorised umpire opens `/umpire/vote`. Steps: select completed fixture → enter official eligible-person votes → review → submit. Result: `player_vote_submissions` and `player_vote_lines` rows. Admin review/history uses `player_vote_edits`.

**Error recovery**
- Toasts via `sonner`; failed writes surface errors. No global error boundary confirmed (consider adding).

---

## 5. UI structure

- **Shell:** `AppLayout` (`src/components/layout/`) wraps protected routes — header + nav + content outlet. Theme toggle (`ThemeToggle.tsx`, `next-themes`).
- **Navigation:** role/scope-aware; the 4-level scope selector (`ScopedTeamSelector`) drives Association→Club→Division→Team.
- **Mobile:** `use-mobile.tsx` hook; Tailwind responsive; touch DnD backend for lineup.
- **Patterns:** shadcn/ui (dialogs, drawers/`vaul`, tables, cards, selects, tabs, toasts).

### Screen-by-screen (routes from `src/App.tsx`)

**Public/auth**
| Screen | Route | Access | Purpose |
|---|---|---|---|
| Landing | `/` | public | marketing/entry |
| Login | `/login` | public | email/Google login |
| Signup | `/signup` | public | registration |
| Forgot/Reset password | `/forgot-password`, `/reset-password` | public | password flow |
| Pending | `/pending` | public/auth | awaiting role grant |
| Player MVP Voting portal (historical public flow) | `/vote/:token` | token | cast Player MVP choices |

**Protected app**
| Screen | Route | Access | Purpose |
|---|---|---|---|
| Dashboard | `/dashboard` | all logged-in | role-aware home |
| Games / Game detail | `/games`, `/games/:id` | team users | fixtures + results |
| Lineup | `/games/:id/lineup` | manager/coach | (planner — schema only) |
| Roster | `/roster` | team users | team members |
| Coaching squad / player | `/coaching`, `/coaching/:playerId` | coach | assessments |
| Chat | `/chat` | team users | team messages (stub) |
| Umpire Match Voting submission | `/umpire/vote` | umpire | submit official completed-fixture votes |
| Player MVP Voting portal (legacy internal route) | `/voting` | logged-in | legacy Player MVP portal |
| Profile | `/profile` | self | edit profile/avatar |

**Admin** (`/admin` + 16 subroutes)
`/admin`, `/admin/associations`, `/admin/competitions`, `/admin/clubs`, `/admin/teams`, `/admin/divisions`, `/admin/users`, `/admin/add-player`, `/admin/bulk-import`, `/admin/revsports-mappings`, `/admin/revsports-unmatched`, `/admin/fixtures`, `/admin/fixture-import`, `/admin/venues`, `/admin/requests`, `/admin/mvp-voting` (Player MVP Voting), `/admin/umpire-voting` (Umpire Match Voting).

**Entity dashboards** `/associations/:id`, `/clubs/:id`, `/admin/division`, `/teams/:id`.

For each admin screen: purpose = CRUD over its entity; data source = matching table(s); actions = create/edit/delete/(map); validation = zod + DB checks; empty/loading/error = shadcn skeleton + toast (verify each); future = pagination + filters + truncation standard.

---

## 6. UX rules and design principles

- **Tone:** clear, friendly, practical; admin-utility first.
- **Language/format:** **Australian English** spelling; AU date format (`DD/MM/YYYY`); times in the association's timezone (`Australia/Melbourne` default on `associations.timezone`). A frontend timezone display fix (passing `timeZone` to `toLocaleDateString`) is drafted but unapplied (memory).
- **Confirmation:** always confirm destructive actions.
- **Errors/success:** toasts (`sonner`); concise messages.
- **Tables:** dropdown truncation standard — `SelectTrigger` uses `className="w-full min-w-0 overflow-hidden"`; the "Maps To"/display `TableCell` uses `className="w-64 max-w-xs"`; truncate with ellipsis, never widen columns; full value shows on open. Apply consistently.
- **Pagination (planned):** rows-per-page 10/25/50, default 25, across all admin pages.
- **Accessibility/mobile:** Radix primitives give baseline a11y; mobile responsive; no formal audit yet.
- **shadcn rule:** never use `value=""` on `<SelectItem>` — use a `"__none__"` sentinel.

---

## 7. Data model from a product perspective

| Entity | Represents | Created by | Edited by | Deleted/archived by | Appears in UI | Related | Business rules |
|---|---|---|---|---|---|---|---|
| Association | A governing body (HB/SHA/WHA) | super admin | super/assoc admin | super admin | admin, dashboards | clubs, seasons, divisions, venues | timezone defaults Australia/Melbourne |
| Club | A club within an association | assoc admin | club/assoc admin | assoc admin | admin, dashboards | teams | unique abbreviation |
| Season / Competition | Season period / competition within it | assoc admin | assoc admin | assoc admin | admin | divisions, fixtures | SHA has Grass Field + Indoor; HB Winter |
| Division | A grade (age/gender) | assoc admin | assoc admin | assoc admin | admin | teams, fixtures | age bounds via `min_age`/`max_age` |
| Team | A team (club + division) | club/assoc admin | manager/admin | admin | admin, roster, dashboards | memberships, fixtures | prefer `team_divisions` over text `division` |
| Player/Profile | A person | signup / import / scraper | self/admin | admin | profile, roster | memberships, Player MVP Voting records, Umpire Match Voting eligibility | placeholder vs real (`is_placeholder`) |
| Team membership | Player↔team link | manager/admin | manager/admin | manager/admin | roster | profile, team | one PRIMARY per player (intended) |
| Fixture | A scheduled/played game | import/admin | admin | admin (ordered delete) | games, fixtures | teams, scores | `revsports_match_url` unique key |
| Player MVP Voting session | One player-to-player voting round per game/team | admin | admin | admin | Player MVP Voting admin | tokens/submissions/vote lines | only eligible attendees vote/are voted; no self-vote; time-limited |
| Player MVP Voting token | Historical private per-voter link | system on open | — | admin | emailed Player MVP link | Player MVP Voting session | random, expiring, single-use (target) |
| Umpire Match Voting submission | One official umpire submission for a completed fixture | assigned/authorised umpire or approved proxy | authorised admin | authorised admin | Umpire Match Voting admin | `player_vote_lines`, `player_vote_edits`, fixture | separate permissions and results from Player MVP Voting |
| RevSports staging rows | Raw scraped data | scraper | pipeline | admin | mappings/unmatched | mappings | not the final profile source |

Future fields (ASSUMPTION): player DOB / Hockey Vic number (needs association export); umpire profile links; club colours/logos.

---

## 8. Feature inventory

### Completed
- **Entity CRUD (assoc/club/team/division/venue/competition):** in `src/pages/admin/*Management.tsx`; test by creating/editing each; limitation — scope cascade edge cases.
- **Auth + scope cascade:** `contexts/*`, `hooks/useAdminScope.ts`; test by switching scope; limitation — must reset levels below.
- **Scrapers + mappings:** `scraper/*`, workflows, `RevSports*` pages; test via manual `workflow_dispatch`; limitation — WHA player cards login-gated; mapping status-save bug.

### In-progress
- **Fixture import bridge** — progress: imports teams/scores; remaining: populate `division_id`/`season_id`, backfill 517; blocker: none; **Codex task:** see Phase 2 T-B1.
- **Player MVP Voting** — progress in this dated plan: schema + admin + portal; remaining: player matching, email sending, auto-close; blocker: email provider; **Codex task:** Phase 3 T-V1..V3.
- **Coaching** — progress: UI; remaining: confirm assessment flow; blocker: scope confirmation.

### Planned
- **Lineup Planner** — purpose: pick/position a team for a fixture; priority: medium; deps: fixtures stable; approach: fixture-scoped DnD + formation picker writing to `lineups`; acceptance: save/load a lineup per fixture.
- **Umpire Match Voting UI** — purpose: official completed-fixture votes by authorised umpires; priority: medium; current active identifiers: `/umpire/vote`, `/admin/umpire-voting`, and `player_vote_*`.
- **Umpire rating schema review** — purpose: decide whether `umpire_vote_*` rating tables are still a separate planned product; status: **UNKNOWN — needs confirmation**.
- **Email system** — purpose: Player MVP Voting links + reminders; priority: high (unblocks that module); deps: provider choice + domain DNS; approach: server-side send via Edge Function/provider SDK.
- **Stats/Ladder** — purpose: standings from fixtures; priority: medium; deps: fixture FK fix.
- **Player Compliance/Registration, Committee Management** — future modules.

### Future ideas
- Multi-sport support — useful long-term; high complexity; risk: premature abstraction; **do later/not yet**.
- Push notifications — UI stub exists; **not yet**.
- Custom formation builder — parked; **not yet**.
- Commercial/multi-tenant — out of current scope.

---

## 9. Implementation plan (phased, Codex-ready)

> Global rule: single prod Supabase project — **confirm before any destructive/migration step**; prefer additive migrations + backfills with dry-runs.

**Phase 0 — Repo understanding & safety checks**
- Goal: Codex confirms reality matches the docs. Tasks: clone, `npm install`, `npm run dev`, `npm run build`, read brief/notes, diff live schema vs migrations, list repo↔deploy edge-fn drift. Files: whole repo. Risks: none (read-only). Acceptance: a written "findings & mismatches" report; no code changes. Tests: build succeeds. Manual: app loads at :8081.

**Phase 1 — Stabilise current app**
- Goal: a green build gate + lockfile/tooling cleanup. Tasks: add `.github/workflows/ci.yml` (lint + tsc + build on PRs to `main`); add a `typecheck` script; decide lockfile (npm) and remove the other; create `.env.example`, `README` setup refresh, `AGENTS.md`. Files: workflows, `package.json`, root. Risks: low. Acceptance: CI runs on PR; clean `npm ci`. Tests: CI passes.

**Phase 2 — Fix known bugs**
- Goal: correct fixture FKs + mapping save bug. Tasks: (T-B1) make `fixture_import.py` populate `division_id` (via `revsports_grade_mappings`) and `season_id` (via `revsports_competition_mappings`); backfill 517 rows; (T-B2) fix mapping status flip-to-`matched`; (T-B3) duplicate-team-name import preview warning. Files: `scraper/fixture_import.py`, `RevSportsMappings.tsx`, `FixtureImport.tsx`. Risks: writes to prod — dry-run first. Acceptance: `fixtures WHERE division_id IS NULL` = 0; mappings save as matched. Tests: import dry-run counts; manual UI check.

**Phase 3 — Complete unfinished core features**
- Goal: Player MVP Voting end-to-end. Tasks: (T-V1) link `revsports_players.profile_id` via player mappings; (T-V2) email provider + send links + 48h/24h reminders; (T-V3) session auto-close (scheduler). Files: scrapers/mapping admin, new email Edge Function, `MvpVotingAdmin.tsx`, `VotingPortal.tsx`. Risks: emailing real people — gate behind a test mode. Acceptance: a test game runs open→vote→close. Tests: Player MVP token single-use; no self-vote; attendee-only.

**Phase 4 — Improve UI/UX**
- Goal: consistency. Tasks: apply dropdown-truncation standard everywhere; add rows-per-page (10/25/50) + Division/Team filters to admin pages; single ACTIVE badge per user on Users; team column format `Association / Club / Division / Team (+N more)`; apply timezone display fix. Files: `src/pages/admin/*`, shared table components. Risks: low. Acceptance: visual checks per page. Tests: build + manual.

**Phase 5 — Improve data/database quality**
- Goal: integrity. Tasks: idempotent SUPER_ADMIN seed migration; reconcile RLS-on-zero-policy tables; capture out-of-band SQL-editor changes as migrations; confirm `mvp_tokens` dead and drop. Files: `supabase/migrations/*`. Risks: schema — confirm each. Acceptance: schema reproducible from migrations. Tests: apply on a branch DB.

**Phase 6 — Automation/integrations**
- Goal: reduce manual ops. Tasks: WHA player-card scraping (needs credentials); merge `sunraysia_test_scraper` improvements into `scraper.py`; optional Activepieces/Zapier hooks. Files: `scraper/*`, workflows. Risks: scraping fragility. Acceptance: WHA player data populated. Tests: dry-run scrape.

**Phase 7 — Production hardening**
- Goal: safety. Tasks: separate dev/prod Supabase (or branch workflow); add error boundary + optional Sentry; `npm audit`/Dependabot; rotate/verify secrets; lock down `logos` write policy. Files: config, infra. Risks: infra change. Acceptance: dev work cannot hit prod. Tests: staged.

**Phase 8 — Future enhancements**
- Goal: new modules. Tasks: Lineup Planner, Stats/Ladder, Umpire Management UI, Compliance, Committee. Acceptance: per-feature criteria in §8.

---

## 10. Codex-ready task list

> Each task: small, testable. Risk: Low/Med/High. "Confirm?" = needs owner sign-off first.

### Setup
- **T-S1** Create `.env.example`. Context: no example exists. Instruction: add the file from Doc 1 §5 (no secret values). Inspect: `.gitignore`, `client.ts`. Edit: new `.env.example`. Acceptance: file present, ignored values match `VITE_*`. Tests: `npm run build`. Risk: Low. Confirm? No.
- **T-S2** Add CI workflow. Instruction: add `.github/workflows/ci.yml` running `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build` on PRs to `main`. Edit: new workflow. Acceptance: check runs on PR. Risk: Low. Confirm? No.
- **T-S3** Resolve lockfiles. Instruction: keep npm, delete `bun.lock`/`bun.lockb` (or vice-versa per owner). Risk: Med. Confirm? **Yes.**

### Bugs
- **T-B1** Populate `division_id`+`season_id` in fixture import. Inspect: `scraper/fixture_import.py`, `revsports_grade_mappings`, `revsports_competition_mappings`. Edit: `fixture_import.py` (+ optional backfill migration). Acceptance: 0 null division/season on fixtures after run. Tests: dry-run logs, post-run counts. Risk: High (prod writes). Confirm? **Yes.**
- **T-B2** Mapping status flips to `matched` on save. Inspect/Edit: `RevSportsMappings.tsx`. Acceptance: saving with an id sets status `matched`. Risk: Low. Confirm? No.
- **T-B3** Duplicate team-name import warning (Option C). Inspect/Edit: `FixtureImport.tsx`, `fixture_import.py`. Acceptance: preview flags duplicates. Risk: Med. Confirm? No.
- **T-B4** Guard `AssociationsManagement.tsx` stray `>` ~line 727. Acceptance: builds clean. Risk: Low. Confirm? No.

### UI
- **T-U1** Apply dropdown-truncation standard across admin tables. Risk: Low.
- **T-U2** Rows-per-page (10/25/50, default 25) on all admin pages. Risk: Low.
- **T-U3** Users page: single ACTIVE badge per user + team column format `Assoc / Club / Division / Team (+N more)` + Division/Team filters. Risk: Med.
- **T-U4** Apply timezone display fix (`timeZone` in `toLocaleDateString`). Risk: Low.

### Backend
- **T-K1** Reconcile Edge Functions repo↔deploy (`clear-test-data`, `bulk-import-players`). Risk: Med. Confirm? **Yes.**
- **T-K2** Document `admin_save_user_roles` overload signatures. Risk: Low.

### Database
- **T-D1** Idempotent SUPER_ADMIN seed migration. Risk: Med. Confirm? **Yes.**
- **T-D2** RLS policy review for `revsports_player_registry/history`. Risk: Med. Confirm? **Yes.**
- **T-D3** Capture SQL-editor drift into migrations. Risk: Med. Confirm? **Yes.**

### Auth
- **T-A1** Verify Google OAuth redirect URLs in prod Supabase. Risk: Low. Confirm? No (config only).
- **T-A2** Add a global error boundary + `/pending` polish. Risk: Low.

### Emails
- **T-E1** Choose provider + add DNS (SPF/DKIM/DMARC). Risk: Med. Confirm? **Yes.**
- **T-E2** Email-sending Edge Function (test mode first). Risk: High (real recipients). Confirm? **Yes.**
- **T-E3** Wire 48h/24h reminders to token timestamps. Risk: Med. Confirm? **Yes.**

### Deployment
- **T-P1** Add build gate before `main` deploy (depends on T-S2). Risk: Low.
- **T-P2** Plan dev/prod Supabase separation. Risk: High. Confirm? **Yes.**

### Testing
- **T-T1** Add Vitest + first unit tests (utils, role hooks). Risk: Low.
- **T-T2** Add a Playwright smoke test for login + admin load. Risk: Low.

### Documentation
- **T-DOC1** Add `AGENTS.md`, `DEPLOYMENT.md`, `DATABASE.md`, `TESTING.md`, `SECURITY.md`, `CHANGELOG.md`. Risk: Low.

### Future features
- **T-F1** Lineup Planner (writes `lineups`). **T-F2** Stats/Ladder (needs T-B1). **T-F3** Umpire Match Voting UI. Risk: Med–High; each Confirm? **Yes.**

---

## 11. Completed work log

| Date | Area | Completed item | Evidence | Follow-up |
|---|---|---|---|---|
| ~Dec 2025 | DB | Initial schema migrations begin | `supabase/migrations/2025122*` | — |
| 14 Apr 2026 | Pipeline | Duplicate team-name risk logged | `notes/known-issues.md` | T-B3 |
| 15 Apr 2026 | Session | Handoff note | `notes/session-2026-04-15.md` | — |
| 21 May 2026 | Session | Handoff note | `notes/session-2026-05-21.md` | — |
| 30 May 2026 | Session | Handoff note | `notes/session-2026-05-30.md` | — |
| 2 Jun 2026 | Scrapers | Scraper session | `notes/session-2026-06-02-scrapers.md` | merge improvements |
| 4 Jun 2026 | Data | Data audit handoff | `notes/session-handoff-data-audit-2026-06-04.md` | — |
| 5 Jun 2026 | Data | Cleanup: deleted dirty rows, fixed grade mappings, split SHA seasons, wiped HB/SHA fixtures for re-import | `notes/session-2026-06-05-data-alignment.md` | T-B1 |
| date unknown | Pipeline | `revsports_match_url` unique key + re-scrape (fixtures now 517) | live DB | division/season still null |
| date unknown | Umpire Match Voting | Legacy umpire-portal migration | `player_vote_*` rows | re-link umpires |
| date unknown | CI | Node 24 deprecation fix + fixture_import step in workflows | workflow YAMLs | — |

---

## 12. Decisions made

| Decision | Reason | Date | Impact | Revisit? |
|---|---|---|---|---|
| Single Supabase project for dev+prod | Simplicity/cost | unknown | dev work risks prod | **Yes** (Phase 7) |
| `revsports_match_url` is the fixture unique key | only reliable per-game id | ~Jun 2026 | upsert conflict key | No |
| Prefer `team_divisions`+`divisions` over text `teams.division` | text unreliable | unknown | join source of truth | No |
| Bulk import must not email players | avoid spam | unknown | import design | No |
| Workflow YAMLs commit to `main`; other code via `dev`→`main` | deploy control | unknown | branch discipline | No |
| SHA split into Grass Field + Indoor competitions | reflects reality | 5 Jun 2026 | season modelling | No |
| shadcn `<SelectItem>` uses `"__none__"` sentinel | empty value crashes | unknown | UI rule | No |
| Use Australian English everywhere | audience | unknown | copy | No |
| Antigravity/Copilot as IDE, Claude for planning | workflow | unknown | process | No |

---

## 13. Open questions

**Product**
- [BLOCKER] Is the `rg_*` risk/governance suite part of SportStack or a separate product sharing the DB?
- Is Chat/team messaging in scope now or parked?

**UI/UX**
- Which screens still lack proper empty/loading/error states?
- Final design for Users page team column + filters?

**Technical**
- [BLOCKER] Exact `admin_save_user_roles` signatures and `create-player`/`bulk-import*` request contracts?
- Is the Supabase CLI used locally, or is the SQL editor the only path? (affects migrations)
- Confirm npm vs Bun as canonical.

**Database**
- [BLOCKER] Why are `division_id`/`season_id` null — is it purely the import script, or also missing mappings?
- Is `mvp_tokens` (vs `mvp_vote_tokens`) dead?
- Are `revsports_player_registry/history` meant to be frontend-readable?

**Hosting**
- Which domain serves prod, and via Cloudflare or Hostinger DNS?
- Vercel project name + env values present?

**Third-party**
- [BLOCKER for Player MVP Voting] Email provider choice (Resend?) + sending domain.
- Role of Activepieces/Zapier (if any) for SportStack.

**Security**
- Has the service key ever been exposed anywhere needing rotation?
- `logos` bucket write policy correct?

**Cost**
- Supabase plan/limits for current row volumes?

**Future scope**
- Multi-sport timeline? Stats/Ladder priority vs Lineup Planner?

*Blockers (must answer before related implementation): rg_* scope, function contracts, division/season null cause, email provider.*

---

## 14. Instructions to add to future AI/Codex chats

```
PROJECT CONTEXT
- SportStack: React 18 + TypeScript + Vite + Tailwind + shadcn/ui SPA, Supabase backend
  (Postgres + Auth + Storage + Edge Functions), deployed on Vercel.
- Data comes from RevSports via Python scrapers in GitHub Actions, staged in revsports_*
  tables, mapped via revsports_*_mappings, imported to live tables by fixture_import.py.
- Environments: dev -> dev.sportstackapp.com.au -> Dev Supabase icqegnpjbizccjebjfhb;
  main -> main.sportstackapp.com.au -> the same Dev Supabase project;
  prod -> sportstack.grampianshockey.com.au -> Production Supabase svierarfcolhcfjpmwck.
- Release app changes dev -> main -> prod. The prod branch is Vercel Production and requires
  explicit owner approval.
- The live DB schema is the source of truth; migrations may have drifted.

CODING STYLE
- Reuse existing shadcn components and app patterns. Keep changes small and scoped.
- TypeScript strict; Australian English in all user-facing text; AU date format.
- Don't hand-edit src/integrations/supabase/{client,types}.ts or src/components/ui/*.

EXPLANATION STYLE (the owner, Aaron)
- Plain, beginner-friendly; explain jargon; one or two steps at a time; structured.
- Offer choices as clear options before deciding.

SAFETY RULES
- Never read/print/expose .env or secrets. Never put the service key in frontend code.
- Confirm before ANY destructive DB action, migration, RLS/auth/enum change, or anything
  that deploys to main. Single prod project — be cautious.

TESTING EXPECTATIONS
- Before completing: npm run lint, npx tsc --noEmit, npm run build must pass; do the
  relevant manual smoke test; describe what to test next.

UNKNOWNS
- If a fact isn't in the handoff docs or the live DB, mark "UNKNOWN — needs confirmation"
  and ask rather than guess.

REPORTING COMPLETED WORK
- Plain-English summary, list of files changed, how to test, risk level, any migration.
```

---

## 15. Final handoff summary

- **Plain-English summary:** SportStack scrapes hockey data from RevSports, cleans and maps it in Supabase, and presents admin/team/player tools plus separate Player MVP Voting and Umpire Match Voting flows for three Victorian associations.
- **Current state in this dated plan:** Core CRUD, auth, scrapers, and mappings work. Fixtures import but are missing division/season links. Player MVP Voting is built but not yet running end-to-end (needs player matching + email). Umpire Match Voting uses the historical `player_vote_*` data path. No tests/CI gate.
- **Highest-risk areas:** (1) single prod Supabase project; (2) no build gate before auto-deploy to `main`; (3) fixture FK nulls breaking downstream joins; (4) service key in CI.
- **Best first Codex task:** **Phase 0 findings report** (read-only) — confirm the docs vs the repo/DB and list mismatches. No code changes.
- **Best second Codex task:** **T-S2 (CI build gate)** then **T-B1 (fix fixture `division_id`/`season_id`)** with a dry-run and owner confirmation.
- **What the owner should prepare:** answers to the four blockers (§13); confirmation of npm vs Bun; Supabase service key kept secret; an email provider decision; a test game for the Player MVP Voting flow.
- **What Codex should NOT touch yet:** RLS/auth/role enum, Edge Functions, destructive data scripts, and anything that deploys to `main` — until Phase 0 is reviewed and the owner confirms.

*End of Document 2.*

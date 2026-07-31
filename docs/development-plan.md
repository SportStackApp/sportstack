# SportStack Development Plan

Status: locked development order, active from 1 August 2026.

The blocks below are completed in order where practical. Work starts on `dev`, is tested and
documented, then moves to `main` for staging. Production, DNS, redirects and destructive changes
remain separately approval-gated.

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

## 4. New domain rollout

- Update the prepared domain work and keep all current URLs operating.
- Add the new domains alongside the existing addresses.
- Verify authentication and links before enabling redirects.

## 5. Navigation and menus

- Review every route, menu item and permission.
- Put everyday tasks first and group related tools logically.
- Keep desktop and mobile navigation clean, current and consistent.

## 6. Dashboard and availability

- Improve primary-team information and upcoming fixture details.
- Make player availability easier to understand and update.
- Keep the Association to Club to Division to Team workflow consistent.

## 7. Communications

- Improve team communications and notices.
- Add club and association broadcasts.
- Improve reminders and relevant audience controls.

## 8. Voting reliability

- Improve Player MVP Voting reliability and administration.
- Improve Umpire Match Voting administration and audit history.
- Keep the two voting modules clearly separated.

## 9. Core administration

- Improve user, team and organisation management.
- Improve fixtures, venues, requests and data-quality tools.
- Add safer warnings and clearer admin workflows.

## 10. Permissions and module controls

- Separate permissions for each module.
- Support association, club, division and team scope.
- Add committee positions, inherited access and controlled exclusions.

## 11. Committee setup

- Create association-level and club-level committees.
- Add custom position titles and assign positions to users.
- Add position permissions, appointment dates, governance documents and qualification records.

## 12. Committee operations

- Add polls with free-text, choose-one, choose-multiple and Yes/No/Abstain questions.
- Add reusable meeting templates, agendas, minutes, decisions and assigned actions.
- Add private committee chat with access limited to current committee members.

## 13. Risk and Quality Improvement

- Complete Risk Register, risk review and BE SMART Action write workflows.
- Complete Quality Improvement and Bright Idea workflows.
- Link committee decisions and maintain a complete audit history.

## 14. Testing and reliability

- Expand focused automated and browser workflow checks.
- Monitor scrapers, notifications, backups and storage.
- Keep current-state, handover and Obsidian notes accurate.

## Operating boundary

- Routine, reversible work may continue on `dev` and reviewed staging work may move to `main`.
- No `prod` promotion, Production service change, DNS change or redirect activation without Aaron's
  explicit approval for that package.
- No destructive database or file operation without exact target verification and approval.
- Existing user changes are preserved and never silently discarded.

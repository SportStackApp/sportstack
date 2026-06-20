# Testing

SportStack does not have an automated test suite yet. Every change should include the required checks below plus relevant manual smoke testing.

## Required checks

Run all of these before completing work:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Manual smoke checklist

Use the parts of this checklist that match the change:

- App loads locally with `npm run dev` and no obvious console errors.
- Login, logout, and protected-route redirects still work.
- Dashboard and core navigation render on desktop and mobile widths.
- Admin scope cascade works as expected: Association → Club → Division → Team, with lower levels reset when a higher level changes.
- Relevant admin tables retain usable column widths, dropdown truncation, and mobile behaviour.
- Fixtures, teams, clubs, associations, divisions, venues, users, and player flows touched by the change can still be opened.
- Bulk import or RevSports import screens touched by the change still preview data safely before write actions.
- Date display remains DD/MM/YYYY and timezone-aware where association timezone matters.
- Public/token-based pages do not expose private tokens, admin-only data, or sensitive player details.

## What to report

In the completion note, include:

- Which required checks passed, failed, or could not be run.
- What manual smoke testing was performed.
- What the owner should test next.

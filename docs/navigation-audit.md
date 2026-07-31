# SportStack Navigation Audit

Last reviewed: 1 August 2026

## Navigation structure

- Everyday work stays in the left menu and the mobile menu: dashboard, fixtures, communications,
  Player MVP, coaching and role-specific umpiring.
- Administration stays in the top Admin menu and is filtered to the current Super Admin,
  Association Admin or Club Admin mode.
- Player MVP Voting and Umpire Match Voting are named and grouped separately.
- Formation Library is the coaching entry point. Formation Builder and Template Builder remain
  contextual actions from the library.

## Direct menu routes

- General: `/dashboard`, `/games`, `/chat`, `/mvp-votes`, `/roster`, `/coaching`,
  `/coaching/formations`, `/coaching/trace`.
- Umpiring: `/umpire/vote` is shown to Umpire and Super Admin roles. The public `/umpire` portal
  remains outside signed-in app navigation.
- Admin overview: `/admin`, `/admin/fixtures`.
- Organisation: `/admin/associations`, `/admin/competitions`, `/admin/clubs`,
  `/admin/divisions`, `/admin/teams`, `/admin/venues` according to scope.
- People and access: `/admin/users`, `/admin/requests`, `/admin/roles-permissions` according to
  scope.
- Data quality: `/admin/bulk-import`, `/admin/fixture-import`, `/admin/revsports-entities`,
  `/admin/revsports-mappings`, `/admin/revsports-unmatched` for Super Admin.
- Voting: `/admin/mvp-voting`, `/admin/umpire-voting`, `/admin/analytics` according to scope.
- Modules and support: `/admin/safety-risk`, `/admin/module-preview`, `/admin/feedback`,
  `/admin/error-logs` according to scope.

## Contextual routes kept out of the menu

- Fixture and line-up detail: `/games/:id`, `/games/:id/lineup`.
- Formation editing: `/coaching/formations/builder`,
  `/coaching/formations/templates/builder`.
- Player coaching detail: `/coaching/:playerId`.
- Entity dashboards: `/associations/:id`, `/clubs/:id`, `/divisions/:id`, `/teams/:id`.
- Profile and vote detail: `/profile`, `/mvp-votes/:sessionId`.
- Add-player is an action from user management rather than a permanent menu item.

## Permission boundary

Menu visibility is a usability aid, not the security boundary. Pages, Supabase RLS and Edge
Functions must continue enforcing their own role and organisation scope. This review changes no
database policy or backend permission.

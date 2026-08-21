# Dev Feedback Register Reconciliation — 21 August 2026

Status: **completed on Development**

Scope: `public.app_feedback` in SportStack Dev only. No feedback row was deleted and Production was
not queried or changed.

## Result

- Starting register: **88 total — 79 Open, 9 Closed**.
- Reconciled register: **88 total — 53 Open, 35 Closed**.
- **26** stale or completed Open items were closed with an evidence note.
- **1** duplicate was retained for audit, closed and linked to its still-Open canonical item.
- One confirmed small defect was fixed during reconciliation: Player mode listed **My coordination**
  in both Core and Umpiring. It now appears once in Core.

An item was closed only when current source, an existing deployed owner check, or both covered the
whole request. Partial matches remain Open.

## Closed groups

### Access, administration and feedback

- `56ab234c-b673-45dd-a87b-ac1a98420d4c` — Users page loading performance.
- `841cf1ea-2a5f-4c57-a833-87d375b96bc2` — inherited module controls and warnings.
- `29d66184-a78f-4799-83c0-c339bfff1a5a` — feedback submitter names instead of user IDs.
- `16cc8cb7-a69c-4bcd-aa3f-cac4a1bab075` — multiple feedback screenshots.
- `1bea0367-da5d-4592-91c8-3963790b6c45` — pasted feedback screenshots.
- `8e30ea43-07da-43c6-b665-6e45b7face62` — duplicate Player navigation link.
- `7c531ba2-9433-4295-99b2-3ab7c2777ce3` — duplicate of still-Open Safety item
  `5a88f057-d79d-4d0b-b2d5-28493c2a88af`.
- `6d4ca642-07d9-4070-a53b-79e45e6a2b3d` — test-only record with no standalone requirement.

### Profile, theme and common presentation

- `2b03c727-8495-492d-b2bd-1ea9abeb66ec` — persistent light/dark preference.
- `5993757c-9b81-4357-a0e2-7f3273865ae9` — Dev-only profile tools and RevSports link.
- `bfcb3835-c449-47f1-9b82-078399e5edd0` — per-team multiple preferred positions.
- `c0655ee6-8614-4e17-8c1c-ef93c1f3022f` — consistent Primary, Secondary and Fill-in colours.
- `df093a79-bf53-4c12-bd34-3114a333702e` — environment and version indicators. The later request
  to relocate and recolour them remains Open as `08c67e8e-b43f-4baf-a0b2-dc5ccf7d5b96`.

### Dashboard and Player MVP Voting

- `de4e439b-a14e-46f5-bb57-f3ea1d7767d8` and
  `786f2f3a-6f39-4c70-baf3-33051484f058` — calendar membership and availability indicators.
- `da04e9b0-9bfe-4d3f-83a0-bf5a75267317`, `a0bf3034-5c4f-41a3-a26e-ba57480fa31c`,
  `a86cc7a0-cdfa-4031-a173-82084754d834` and `452b449a-bca2-4210-8bd3-ef46f8a0564f` — Player
  MVP history, submitted state and player names.
- `eb471abb-8390-4eff-a21d-2b31767061a2` and
  `c9e99dcb-99c4-45fb-a09d-cdcaf8539e2b` — Player MVP Analytics scope filters and voter completion.

### Formation Library and Builder

- `33de14b3-855d-4137-93e4-3be54919117a` — collapsible/focused canvas tools.
- `ea79e0bd-c639-458d-947c-140c11317a9c` and
  `211ed735-952e-4406-b8dd-eed5e54a7065` — real canvas rotation, zoom, fit and centring.
- `5bbb4299-0250-4ee6-b12d-78e6c9df66d7` and
  `8d7d0af4-95be-47cc-a898-3cea7b375fc7` — reusable field templates separated from formations.

## Open work merged into the single plan

### In progress now

- Prove that a Pending team application grants no team data or Player permissions before approval
  (`9aa4b8ab-be7b-4ca0-81de-a135d4d19ba9`). Treat any leak as a security defect.
- Complete the remaining real-role access matrix when browser credential handling permits it.
- Retest the mobile scope cascade, including the iPhone tap target and horizontal overflow reports.

### Next implementation or cleanup batch

- Division match timing structure: configurable quarters and breaks with calculated total duration.
- Committee hierarchy, appointment history and stronger committee-close safeguards.
- Expense statement upload progress and persistent exclusion rules.
- Standard team ordering by division/category wherever lists are shown.
- Coaching squad linkage to player position preferences and match history.
- Safety Hub associated-link table headings/wrapping, date controls and selected-tab emphasis.
- Remaining Requests, RevSports review, roster readability and profile-photo workflow defects.

### Parked for later

- Environment/version relocation and environment-coloured navigation.
- Full personal, team, club and association dashboard/KPI redesign.
- Full Roles & modules information architecture and action-level permission matrix.
- Formation asset deletion with server-side usage checks, icon-role variants and icon sizing.
- Address lookup/restructure and broader profile polish.

The live `/admin/feedback` register remains the detailed item list. This document records the
reconciliation decision without creating a second competing backlog.

## Verification boundary

- The register clean-up changes only `status`, `admin_notes` and `updated_at` on the 26 named Dev
  rows.
- The duplicate Safety report remains stored; its note points to the canonical Open row.
- No database schema, Row Level Security policy, Auth record, fixture, membership or historical
  application data changed.
- Production remains untouched.

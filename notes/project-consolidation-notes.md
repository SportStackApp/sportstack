# Project Consolidation Notes
_Migrated from old Lovable/Hockey Hub project — reviewed 25 April 2026_

> Historical idea list only. Current open work is tracked in
> `docs/consolidated-open-items-plan.md`. Some items below have since been implemented, replaced or
> deliberately parked; do not treat this note as a current to-do list.

## Umpire Slot Management
- At fixture import, each umpire slot is assigned to a **club** (not an individual)
- That club can optionally assign a **specific person** to the slot later
- No accept/decline flow required at this stage

## Future Implementation List
The following features are planned but not yet scheduled:
- **Push notification wiring** — UI toggle exists but is not connected
- **Custom formation builder** — deferred until core features are stable
- **Invite email flow** — use Supabase's `inviteUserByEmail` to onboard new users
  via email rather than manual workarounds
- **Dark mode** ⚡ NEAR-TERM PRIORITY — Tailwind + shadcn/ui support this
  natively; just needs wiring to a toggle

## Future Module — Lineup Planner
A standalone prototype called "Field Hockey Position Planner V2" exists as an
early proof-of-concept for a lineup planning module in SportsStack.
Key features in the prototype:
- Visual draggable pitch with player markers
- Per-player position preferences (Experienced / Capable / Limited / Uncomfortable)
- Auto-generate best lineup based on ratings
- Formation switching (2-3-2-3, 4-3-3, 4-4-2, 3-4-3)
- Lock players into slots, share lineup via encoded snapshot code
When this becomes a SportsStack module, it will need:
- Integration with Supabase (save lineups per fixture)
- Scoped to club/team/fixture context
- Player pool pulled from the team roster, not entered manually

## Architectural Awareness — Multi-Sport Support
SportsStack is intended to eventually support multiple sports beyond hockey.
No multi-sport features need to be built now, but design decisions should
avoid making it difficult to add later.
Recommended approach when the time comes:
- Sport type set at **division level**
- Three-layer system: base layer → sport-specific module → optional features
- Avoids rebuilding core when adding a new sport

## Parked — Confirm Later
- **Player team-change request workflow** — player submits, admin approves,
  player confirms. May already exist in SportsStack — verify before building.

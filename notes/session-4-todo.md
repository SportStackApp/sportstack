# SportStack — Session 4 To-Do List
**Date:** 23 May 2026

---

## 🗂️ Teams Page

1. Add filters to the Teams page
2. Add an "Association" column to the teams table
3. Edit/Create team form — add ability to assign an Association
4. Cascade selector in edit/create form: Association → Club → Division (each level filters based on the one above)
5. Fix "Bobcats White" — shows as "Unknown" in Team Mappings because it was saved without an association link (fix AFTER cascade selector is built)

---

## 👤 Player Mappings

1. Player names from RevSports need to be mapped to Players in the app
2. Display name should concatenate: Player name + Team + Division + Club
   - Example: "John Smith — Bobcats White, Under 11 Open, Bobcats"

---

## 🏟️ Venue Mappings

1. Scraped venue names need to be mapped to Venues in the app (similar to Team Mappings)

---

## 🏟️ Venues Page

1. A venue should support multiple associations — change the single Association dropdown to a multi-select
2. ❌ Bug: Editing a venue fails — "Failed to update venue" error — needs investigation

---

## 🗓️ Fixtures — Add Fixture Form

1. ❌ Bug: Teams don't load in Home Team / Away Team dropdowns
2. Needs a cascade selector (Association → Division) so the form knows which teams to show

---

## 🗳️ VOTER Dashboard (parked — dependency)

- Depends on Player Mappings being built first
- Once player mappings exist, show each voter the open sessions for games where scrape data confirms they played
- VOTER login should redirect to a stripped-down dashboard (no sidebar)

---

## ✅ Completed this session

- Team Mappings page — grade/division context added to both columns
- VOTER role added to DB enum, TypeScript types, useUserRole hook, and Users Management page

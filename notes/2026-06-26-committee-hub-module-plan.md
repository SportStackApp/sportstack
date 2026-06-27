# Committee Hub & Future Modules — Planning Notes
**Date:** 2026-06-26
**Status:** Backlogged — reference/planning only, no code or DB changes yet

---

## Context

Three reference projects exist locally in `modules/` (not yet integrated):

1. **Field Hockey Ace** — standalone line-up/position planner. No Supabase. Reference for future Formation/Lineup Builder ideas.
2. **Hockey Safety Hub** — simple risk/action/QI register, spreadsheet-like. Table names too broad/open for direct reuse (`risks`, `actions`, `qi_items`).
3. **Hockey Risk Guard** — fuller risk management system (risk register, BE SMART actions, QI register, audit log, comments, dashboard, risk matrix, settings). Safer table naming (`rg_` prefix). Strongest reference of the three.

**Decision:** None of these get merged directly. They're reference material for screen layout and workflow ideas only. SportStack's existing auth, roles, routing, and Supabase patterns must be respected in any rebuild.

---

## Proposed Future Module: "Committee Hub"

Merges Hockey Safety Hub + Hockey Risk Guard, plus new governance features.

**Scope:**
- Risk register
- Risk assessments / risk matrix
- BE SMART action plans
- Quality Improvement (QI) register
- Audit / history log
- Governance document storage (constitution, bylaws, policies, procedures)
- Committee member register
- First Aid certificate expiry tracking
- Working With Children Check (WWCC) expiry tracking
- File uploads for certificates/documents
- Committee polls/voting (Yes / No / Abstain / Other, with audit trail)

### Recommendation: Risk Guard as the base
Risk Guard has the more complete feature set and safer table naming. Where Safety Hub and Risk Guard overlap, Risk Guard's structure should generally win — Safety Hub is only useful as a "simpler layout" reference if Risk Guard's screens feel too complex for volunteer committee members.

### Added scope note: expiry tracking needs notifications eventually
First Aid / WWCC expiry tracking shouldn't just be a static date in a table — it needs a notification/reminder mechanism down the track, or nobody will check it. Not needed for v1, but should be designed with this in mind (e.g. don't make expiry dates hard to query later).

### Design note: Committee Voting as a reusable pattern
Voting (create poll → cast vote → close → tally) is a generic pattern. SportStack already has something similar in MVP voting. Worth designing Committee Voting so its logic isn't hard-locked to "committee" context only — it could live inside Committee Hub in the UI, but the underlying voting logic should be generic enough to reuse elsewhere later.

---

## Suggested Build Order (when picked up — NOT scheduled yet)

1. Feature matrix — compare Safety Hub vs Risk Guard overlaps in detail
2. Governance doc storage + committee member register (simplest, lowest risk)
3. Risk register + QI register (bigger piece, needs the matrix done first)
4. Committee voting (built as a reusable pattern, not committee-only)
5. Expiry tracking + notifications

---

## Sequencing Risk

Committee Hub is a large module. Starting it before Formation Builder is finished risks splitting focus across two big builds at once.

**Recommendation:** Keep Committee Hub fully backlogged until Formation Builder (Phases 1–5) ships.

---

## Next Step (when ready to resume this thread)

Build the feature matrix comparing Hockey Safety Hub and Hockey Risk Guard, field by field, to decide the final combined Committee Hub structure before any DB or UI work starts.

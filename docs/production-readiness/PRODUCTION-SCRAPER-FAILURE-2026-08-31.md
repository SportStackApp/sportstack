# Production scraper failure diagnosis — 31 August 2026

Status: **confirmed High operational defect; repair is approval-gated**

This was a read-only diagnosis. No workflow, Production system, database or secret was changed.

## Evidence

- Failed runs `33312990690`, `33298976412` and `33286035646` used Main commit `d48239d`.
- The latest affected RevSports games were `2629793` to `2629796`, plus `2629798`.
- Each failed job received an empty `TARGET_ROUND_NUMBER`; the schedule verifier rejected that
  missing required value before scraping.
- Finals pages expose a display label such as **Semi Finals** and a numeric round identifier in the
  URL, such as `/round/16`.
- `scraper/scraper.py` initially extracts the correct numeric value from the URL, but the current
  output path retains only the display label. A later digit extraction from **Semi Finals** returns
  null, which the target selector serialises as an empty matrix value.
- The existing focused selector tests cover numeric labels such as **Round 12**, not finals labels.

## Root cause

The workflow treats the human-readable round label as if it were also the stable numeric round
identifier. That happens to work for labels containing a number and fails for finals labels.

## Required repair package

1. Preserve the numeric RevSports round identifier separately from its display label through the
   scraper output path, using label parsing only as a backwards-compatible fallback.
2. Make the target selector reject an incomplete matrix before jobs fan out.
3. Add regression tests for Semi Finals and other non-numeric labels.
4. Run a full Hockey Ballarat refresh, then a controlled target verification.

The repair includes a Production-capable workflow path and therefore requires Aaron's separate
approval before implementation or rollout. Until it is repaired and a controlled rerun passes,
Production readiness gates R13 and R18 remain open.

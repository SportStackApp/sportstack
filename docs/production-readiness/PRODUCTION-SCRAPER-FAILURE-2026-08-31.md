# Production scraper failure diagnosis — 31 August 2026

Status: **repaired, aligned to Main and verified by the first scheduled run**

**8 September close-out:** Aaron approved the exact workflow alignment at source commit `58927de`.
Scheduled run `34140644053` succeeded on that commit. The `Select completed fixture windows` job ran
the guarded due-fixture selector, found zero due fixtures and safely skipped the target-game update
job. No manual Production run was started and no Production application, branch, secret or migration
was changed.

**8 September update:** Dev repair `4bdc5c2` binds schedule timing to the target match's exact
fixture card and rejects ambiguous context. Eight focused tests and all five affected public fixtures
pass. The approved home-team URL workflow input is now in Main through source alignment commit
`58927de`. See `NAMED-FINALS-PARSER-VERIFICATION-2026-09-08.json`.

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

The repair's Production-capable workflow path received Aaron's separate approval and its first
scheduled run passed. Production readiness gate R18 is closed. R13 remains open only for the broader
read-only walk-away evidence requirement recorded in the central gate register.

# Player MVP lifecycle Production-backup rehearsal — 5 September 2026

## Scope

This is a sanitised durable copy of the isolated rehearsal result. It covers only Production's
existing narrow Player MVP tally migration followed by the additive lifecycle repair. It does not
prove that the full Main migration history can be applied to Production.

- Source: verified 5 September Production logical backup captured before tally release `15223e9`
- Production slice: migration `20260905040425_add_manual_player_mvp_tally_presentations.sql`
- Candidate repair:
  `20260905131718_restore_player_mvp_voting_lifecycle_after_production_slice.sql`
- Environment: disposable local PostgreSQL container with external networking disabled

## Restore limitation

The local PostgreSQL image's managed Auth and Storage schemas differed from the hosted Supabase
backup. Twenty-nine raw restore errors were confined to those managed schemas. Public SportStack
data restored, and a minimal local-only Storage compatibility scaffold allowed the exact Production
tally migration to apply.

The lifecycle data, functions, triggers, permissions and job tests below are valid for the restored
public application data. This was not a completely faithful hosted Auth/Storage restore and must not
be presented as one. A fresh exact curated package still needs a final Production-compatible
rehearsal before approval.

## Baseline

- Profiles: 757
- Player MVP sessions: 647
- Overdue `OPEN` sessions: 355
- Existing `CLOSED` sessions: 5
- Current-round incorrect checks among overdue sessions: 0
- Player MVP audit rows: 40
- Notifications: 24
- Player MVP email events: 328
- Teams with Player MVP email enabled: 96
- Deadline closure job, functions and triggers: absent

## Transactional rehearsal and rollback

- Candidate migration processed 355 sessions: 355 became `CLOSED`, none became
  `RESULT_DISPUTED`.
- Overdue `OPEN` sessions became zero.
- Audit rows became 395, exactly one new row per reconciled session.
- Notifications remained 24.
- Player MVP email events remained 328.
- Exactly one `close-due-player-mvp-voting` job and two deadline triggers existed.
- Browser roles `anon` and `authenticated` had no execute privilege on either private function.
- Transaction rollback restored 355 overdue `OPEN` sessions, 40 audit rows, unchanged email and
  notification counts, and no closure job or function.

Result: transactional assertions passed and the exact application-data baseline returned.

## Isolated real apply

- Post-apply: zero overdue `OPEN`, 360 `CLOSED`, zero `RESULT_DISPUTED`, 395 audit rows.
- Notifications remained 24 and Player MVP email events remained 328.
- One closure job and two deadline triggers existed.
- A second closure call processed zero sessions.
- A transaction-only incorrect-result scenario moved its session to `RESULT_DISPUTED`.
- A transaction-only overdue vote update was rejected with `MVP_SESSION_DEADLINE_PASSED`.

Result: lifecycle apply, idempotence, disputed-session and deadline-trigger checks passed.

No hosted Development or Production database was changed during this rehearsal.

# B1 Production pre-flight — 7 September 2026

## Outcome

**PASS — ready for Aaron's exact package approval. Production remains unchanged.**

The six technical pre-flight gates for frozen candidate `3d9bc53` passed. No Production migration,
application deployment, data write, Auth change, function deployment, secret change or scheduled-job
change occurred during this pre-flight.

## Frozen package

- Production base: `a1d23c741b79de02c32763a879597192a1c1ebd5`
- Candidate: `3d9bc530b04ada938da751d68b1fea908371c5b0`
- Relationship: candidate is seven commits ahead and zero behind Production.
- Changed paths: 38.
- Binary patch SHA-256: `c51d468e2015189488b4689acc691acf725f021a51b64ffbce51556cf5fd0216`.
- Exclusions confirmed: no Edge Function, workflow or scraper path.
- Git identity: `Aaron Mullane <admin@sportstackapp.com.au>`.
- GitHub account: `SportStackApp`.

## Fresh read-only Production baseline

The Windows-encrypted, Production-pinned Supabase profile successfully completed fresh schema,
membership and pre-flight audits.

| Check | Fresh result |
|---|---:|
| Production migration versions | 159 |
| B1 versions already present | 0 of 10 |
| Schema SHA-256 | `a8a570fafd21145bf13f66cd6291856ef8ed852f04e736a07382b742790dc488` |
| Profiles | 757 |
| Team memberships | 1,260 |
| Primary-team requests | 6 |
| Edge Functions | 11 |

The schema fingerprint exactly matches the previous 6 September Production-shaped rehearsal
baseline. The current grants and policies therefore have no detected structural drift from that
reviewed baseline. The ten candidate migration files also match every SHA-256 recorded in the
approval packet.

Production currently has three active database schedules:

- `mvp-voting-email-reminders` — every minute;
- `sportstack-notification-dispatch` — every 15 minutes;
- `close-due-player-mvp-voting` — every minute.

No scraper schedule is present. The ten B1 migrations contain no cron scheduling, `pg_net`/HTTP,
email-send, notification-dispatch or scraper effect, so applying the package cannot create or invoke
an outbound delivery or scraper job. Existing independent schedules remain outside this package.

Supabase reports the Production project in `ap-southeast-2`, WAL-G enabled and point-in-time recovery
disabled. Its API returned no discrete physical backup rows. The independently verified encrypted
logical backup below is therefore the required release restore point.

## Encrypted logical backup

- Folder:
  `C:\Users\mulla\AppData\Local\SportStack\backups\prod\2026-09-07-141416-pre-b1-3d9bc53`
- Retained archive: `production-logical-backup.tar.gz.aes`
- Encryption: AES-256-CBC with HMAC-SHA256 authentication.
- Keys: protected for Aaron's current Windows account with DPAPI.
- Encrypted archive size: 6,994,352 bytes.
- Encrypted archive SHA-256:
  `19e58098664f1f3320f727c569cfdb16306b47b0d4e16368dce1de294e8c4840`.
- Contents: roles, schema and data SQL dumps.

The verifier authenticated and decrypted the retained archive in a separate temporary folder,
listed and extracted exactly the three expected files, compared every size and SHA-256, and confirmed
the schema and data dumps contained readable SQL. All plaintext temporary folders were removed and
the retained backup folder contains no plaintext SQL.

## Gate result

- [x] Git base, candidate, ancestry and identity.
- [x] Exact package digest, paths and exclusions.
- [x] Public Production application health.
- [x] Read-only Production Supabase access.
- [x] Fresh schema, migrations, grants/policies, schedules, protected counts and outbound-effect check.
- [x] Fresh encrypted logical backup and isolated readability.
- [ ] Aaron's exact approval for this frozen package.

The only remaining approval sentence is:

`RELEASE B1 ACCESS PACKAGE 3d9bc53 TO PRODUCTION`

It authorises only the package recorded here and in the approval packet.

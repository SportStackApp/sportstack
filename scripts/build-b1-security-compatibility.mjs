#!/usr/bin/env node

/**
 * Historical tool intentionally disabled.
 *
 * It previously converted live database inventory text into executable SQL.
 * That makes provenance difficult to prove and could reproduce an unreviewed
 * database definition. Future compatibility work must use reviewed repository
 * SQL and an explicit rollback-only verifier.
 */

throw new Error(
  "This historical generator is disabled. Build future B1 compatibility checks from reviewed repository SQL.",
);

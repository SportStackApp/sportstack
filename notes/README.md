# Notes Folder Guide

Last reviewed: 30/07/2026

- `known-issues.md` is the active parked-task list.
- Dated Markdown files are historical session records. Their branch, deployment, database counts
  and next-step statements may have been superseded by later work.
- The two `.sql` files are rollback/reference snapshots, not pending migrations. Do not run them
  without a separate database review and approval.
- Use `AGENTS.md`, then `docs/current-state.md`, then `CODEX_HANDOFF.md` for current status.
- Committed Markdown notes are mirrored into the Hermes Obsidian Vault by
  `scripts/sync-sportstack-notes-to-obsidian.ps1`. Edit the repository copy, not the generated Vault
  mirror. The close-out sync and `-Check` verification are mandatory for meaningful tasks.

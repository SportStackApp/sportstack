# Security

## Secret handling

- Never commit `.env`, `.env.local`, Supabase service keys, private tokens, or production credentials.
- Use `.env.example` for safe placeholders only.
- Never print, log, or expose real environment variable values in terminal output, browser output, screenshots, PR descriptions, or documentation.
- Never add secrets behind a `VITE_` prefix. `VITE_` variables are bundled into frontend code.

## Supabase key boundary

- Frontend code may only use public browser-safe values:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID`
- Server/CI-only values must stay outside frontend code:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- The Supabase service key is for trusted server/CI contexts only and must never be exposed to the browser.

## Confirmation-required areas

Confirm with the owner before:

- Any destructive database operation, including `DELETE`, `DROP`, or `TRUNCATE`.
- Any schema migration or backfill.
- Any RLS, auth, Edge Function, or role enum change.
- Anything touching secrets or credential handling.
- Anything deployment-sensitive, especially changes that may auto-deploy from `main`.

## Data safety

The same Supabase project is used for development and production data. Treat all data as real, keep admin scope checks intact, and avoid exposing private player, team, token, or admin-only data.

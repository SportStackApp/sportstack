# Deployment

## Hosting

SportStack is deployed on Vercel. Pushes to `main` auto-deploy, so non-workflow changes should go to `dev` first and only reach `main` through the agreed merge process.

## Build and output

The app is a React + TypeScript + Vite single-page application.

Required production build command:

```bash
npm run build
```

Vite writes the production output to `dist/` by default.

## Runtime configuration

Frontend deployment requires only browser-safe Supabase values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Do not expose service-role credentials to Vercel frontend runtime variables.

## GitHub Actions scraper schedule summary

The repository includes scheduled and manually runnable GitHub Actions for RevSports-related scraping:

- `Player Registry Scraper` runs daily.
- `Player History Scraper` runs weekly on Wednesday and Sunday.
- `Scrape — Hockey Ballarat` runs daily plus frequent Saturday and Sunday match-day refreshes.
- `Scrape — Sunraysia Hockey Association` runs daily plus frequent Friday, Saturday, and Sunday match-day refreshes.
- `Scrape — Wimmera Hockey Association` runs daily plus frequent Saturday and Sunday match-day refreshes.

Scraper workflows use server/CI-only Supabase credentials and should not expose service keys to frontend code.

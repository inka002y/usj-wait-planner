# USJ Wait Planner

Expo app for checking Universal Studios Japan wait times, storing local wait samples, analyzing trends, and generating a simple visit plan.

## Development

```powershell
npm install
npm start
```

For web preview on localhost, run the local CORS proxy in another terminal:

```powershell
npm run dev:proxy
```

## Checks

```powershell
npm run typecheck
npm run verify:no-mojibake
npm run collect:waits
npm run analyze:waits
```

## Data Sources

- Live wait times: Queue-Times park `284`
- Opening hours: ThemeParks.wiki USJ park entity

The app displays `Powered by Queue-Times.com` attribution as required for the live wait-time API.

## Supabase

This repo includes:

- `supabase/migrations/20260627090000_init_usj_wait_planner.sql`
- `supabase/functions/collect-waits/index.ts`

The collector fetches Queue-Times data and writes to:

- `public.usj_attractions`
- `public.usj_wait_samples`

Required local app env:

```powershell
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Required Edge Function secret:

```powershell
COLLECT_WAITS_TOKEN=
```

The deployed project uses `pg_cron` to call the collector every 15 minutes.

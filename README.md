# USJ Wait Planner

Expo app for checking Universal Studios Japan wait times, storing local wait samples, analyzing trends, and generating optimized visit plans.

## Route Planning

Plans are generated with exact dynamic programming over the selected attractions. For a 13-attraction plan, the app avoids brute-forcing `13!` routes directly and instead compresses the search into reusable states while still optimizing across the full route-order space for the app's wait-time/travel-time model.

Supported plan modes:

- `効率`: maximize scheduled attractions, then minimize the weighted wait/travel score.
- `移動少なめ`: maximize scheduled attractions, then minimize total travel minutes.

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
npm run verify:plans
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

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

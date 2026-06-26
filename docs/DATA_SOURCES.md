# USJ Wait Planner data sources

This app uses public, attribution-friendly sources:

- Live wait times: Queue-Times park `284`, `https://queue-times.com/parks/284/queue_times.json`
- Opening hours: ThemeParks.wiki park `47f61fac-7586-41ac-ae80-61c9257cf33e`

Queue-Times requires a visible `Powered by Queue-Times.com` link in apps or services using the real-time API.

The app also stores fetched live rows on-device with AsyncStorage. Those samples become a small local wait-time database for hourly averages, trends, best-time estimates, and route planning. The Supabase schema is included for a hosted collector later.

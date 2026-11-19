# Peak

A personal Garmin Connect client. Activities with GPS map, splits and heart-rate zones; sleep stages; Body Battery,
stress, HRV and resting heart rate; training status, load, VO2 max and race predictions. Light and dark theme,
custom accent color, metric or imperial units.

Built with the same structure, design system and animations as Winner for Life.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

The app runs in **demo mode** for now: tap **Explore with demo data** on the sign-in screen. Accounts live in the
browser and one year of Garmin-like data (activities, sleep, wellness) is generated on the fly.

## Screens

| Route | What |
|---|---|
| `/` | Today: steps, Body Battery, sleep and readiness cards, vitals, 24 h timeline, week steps, recent activities |
| `/activities` | List by week with search and sport filters, 12-week volume, calendar view |
| `/activities/:id` | Route map, stats, training effect, heart rate / pace / elevation / cadence charts, zones, splits, strength sets |
| `/sleep` | Score, hypnogram, stages vs ideal ranges, overnight vitals, insights, 7-night and 4-week trends |
| `/health` | Health snapshot (today vs your normal range) and tiles for every metric |
| `/health/:metric` | One metric over 7 days / 4 weeks / 3 months / 1 year, stats, weigh-ins |
| `/training` | Training status, load ratio, 8-week load, readiness, VO2 max, race predictor, intensity minutes, sport mix |
| `/profile` | Year totals, personal records, badges |
| `/settings` | Garmin connection (sync, replace key, disconnect), appearance, units, timezone, goals, heart-rate zones |

## Where things live

- `src/data/repo.ts` — the `Repo` interface every screen uses
- `src/data/localRepo.ts`, `src/data/demoSeed.ts` — demo backend and data generator
- `src/domain/` — pure training and stats logic (tested)
- `src/config/` — app identity, metrics, sports, badges
- `src/components/ui.tsx`, `src/components/charts.tsx` — design system and charts
- `src/screens/` — UI

## Next: connect Supabase

1. Create `supabaseRepo.ts` implementing `Repo` and select it in `repo.ts` when `VITE_SUPABASE_URL` is set.
2. Tables for profiles, daily summaries, sleep, activities (+ detail JSON) and weights, with RLS per user.
3. An edge function that stores the Garmin Personal API key encrypted and syncs on a schedule
   (the `garmin` function in Winner for Life is the starting point).

# TTC Late Note

Late because of the TTC? Get a note.

You tell us when and where your trip went wrong. We find the delay in the TTC's
own records and write a formal apology, on the TTC's behalf, to whoever you kept
waiting.

_A parody. Not affiliated with the Toronto Transit Commission._

## How it's built

- **[React Router](https://reactrouter.com/)** (framework mode) for pages and server code
- **[Cloudflare Workers](https://developers.cloudflare.com/workers/)** to host it
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** (SQLite) for data
- **Cron triggers** to keep the data fresh

```
app/
  root.tsx            page shell
  routes.ts           list of pages
  routes/             one file per page
  server/
    opendata.ts       imports official delay logs from Toronto Open Data
    alerts.ts         records TTC live service alerts
workers/app.ts        Worker entry: handles web requests and scheduled jobs
migrations/           database schema
wrangler.jsonc        Cloudflare config: database binding and cron schedules
```

## Where the data comes from

| Source | What it has | Freshness |
| --- | --- | --- |
| [Toronto Open Data](https://open.toronto.ca/dataset/ttc-subway-delay-data/): subway, streetcar and bus delay logs | Every logged delay: date, time, line, location, cause code, minutes delayed | Published monthly, 1–2 months behind |
| [TTC live alerts](https://www.ttc.ca/service-alerts) | Current disruptions: route, cause, effect, start and end | Live, but only shows what's happening now |

Because the official logs run 1–2 months behind, we also record the live alerts
every 5 minutes. That gives us our own history of recent disruptions.

### Scheduled jobs

| Schedule | Job |
| --- | --- |
| Every 5 minutes | `syncAlerts`: saves the current TTC alerts and updates `last_seen` on ones already saved |
| Hourly | `syncOpenData`: imports up to 12 new days per mode, then refreshes the cause-code list |

The Open Data import remembers the last day it finished for each mode
(`sync_state` table). It stops after 12 days so each run stays within the Workers
free plan's limit of 50 outgoing requests. A fresh database catches up from
January 2025 in about 55 runs.

### Quirks in the source data

- About 0.2% of rows are exact duplicates. The import keeps one copy of each.
- Some text is double-encoded (`â€“` instead of `–`). The import repairs it.
- About 5% of delays use cause codes that aren't in any published code list.

## Running it locally

Requires Node 22.22+.

```sh
npm install
npm run db:migrate     # create the local database
npm run dev            # http://localhost:5173
```

While the dev server is running, trigger the scheduled jobs by hand:

```sh
curl "localhost:5173/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*"   # record live alerts
curl "localhost:5173/cdn-cgi/handler/scheduled?cron=17+*+*+*+*"    # import 12 days of delays
```

Run the second one repeatedly (about 55 times) to load everything since January 2025.

## Deploying

The database already exists (its id is in `wrangler.jsonc`). To deploy:

```sh
npx wrangler login         # once per machine
npm run db:migrate:remote  # only when there's a new migration
npm run deploy
```

Live at https://ttc-late-note.ttc-late-note.workers.dev. The cron jobs run on their own once deployed.
The initial import of about 180,000 rows takes a couple of days of hourly runs on the free plan,
which allows 100,000 database row writes per day.

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
  root.tsx            page shell: header, footer, error page
  routes.ts           list of pages
  routes/
    home.tsx          /          landing page
    new.tsx           /new       pick a day, line and delay; write the note
    note.tsx          /n/:id     the letter (the page people share)
    status.tsx        /status    what data has been loaded
  components/         small shared UI pieces
  lib/
    lines.ts          matches line names between the two data sources
    causes.ts         turns TTC cause codes into plain English
    format.ts         dates, times and names
  server/
    opendata.ts       imports official delay logs from Toronto Open Data
    alerts.ts         records TTC live service alerts
    incidents.ts      finds delays and alerts for a day, in one shape
    notes.ts          saves and loads notes
  app.css             all the styles
workers/app.ts        Worker entry: handles web requests and scheduled jobs
migrations/           database schema
wrangler.jsonc        Cloudflare config: database binding and cron schedules
```

## How a note is made

1. On `/new`, you pick a day and a vehicle type. We list the lines that had a recorded
   incident that day, from either source.
2. You pick your line and the incident that made you late, and enter who the note is for.
3. We save the note with its own copy of the incident details, so the letter never changes,
   and send you to `/n/<id>` to share it.

Each choice on `/new` is kept in the URL, so the page needs no client-side state and works
without JavaScript.

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
| Hourly | `syncOpenData`: imports up to 4 new days per mode, then refreshes the cause-code list |

The Open Data import remembers the last day it finished for each mode
(`sync_state` table). It stops after 4 days so a day of hourly runs stays within
the Workers free plan's 100,000 database row writes (each delay costs 2: the row
and its unique index). A fresh database catches up from January 2025 in about
a week; each monthly release takes about 8 hours.

### Quirks in the source data

- About 0.2% of rows are exact duplicates. The import keeps one copy of each.
- Some text is double-encoded (`â€“` instead of `–`). The import repairs it.
- About 5% of delays use cause codes that aren't in any published code list.

## Health check

`/health` returns `ok` (status 200), or a list of problems (status 503) when:

- the alerts poller hasn't succeeded in 20 minutes,
- the import hasn't succeeded in 3 hours, or
- the newest official data is more than 80 days old (the City may have moved the dataset).

Each scheduled run records its result in the `heartbeats` table, which is what
this reads. An UptimeRobot monitor checks it every 5 minutes and emails on failure.

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
curl "localhost:5173/cdn-cgi/handler/scheduled?cron=17+*+*+*+*"    # import 4 days of delays
```

Run the second one repeatedly (about 160 times) to load everything since January 2025. Locally there's no write limit.

## Deploying

The database already exists (its id is in `wrangler.jsonc`). To deploy:

```sh
npx wrangler login         # once per machine
npm run db:migrate:remote  # only when there's a new migration
npm run deploy
```

Live at https://latenote.to (www redirects to it). The cron jobs run on their own once deployed.
The initial import of about 180,000 rows takes about a week of hourly runs on the free plan.

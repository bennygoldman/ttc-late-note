// A plain-text check for an uptime monitor: "ok" with status 200, or the
// problems found with status 503. It catches failures that would otherwise
// be silent, like a source changing format or the import going stale.

import { env } from "cloudflare:workers";

// How long each check can go before it counts as a problem.
const ALERTS_MAX_MINUTES = 20; // the alerts poller runs every 5 minutes
const OPENDATA_MAX_MINUTES = 180; // the import runs hourly
// The City publishes each month a few weeks after it ends, so the newest
// official data is normally 25 to 60 days old.
const OFFICIAL_DATA_MAX_DAYS = 80;

type Heartbeat = { job: string; last_run: string; last_ok: string | null; last_error: string | null };

export async function loader() {
  const problems: string[] = [];
  const now = Date.now();
  const minutesSince = (iso: string) => Math.round((now - Date.parse(iso)) / 60000);

  const { results: heartbeats } = await env.DB.prepare(`SELECT * FROM heartbeats`).all<Heartbeat>();
  const limits: Record<string, number> = { alerts: ALERTS_MAX_MINUTES, opendata: OPENDATA_MAX_MINUTES };

  for (const beat of heartbeats) {
    const limit = limits[beat.job];
    if (!limit) continue;
    if (!beat.last_ok || minutesSince(beat.last_ok) > limit) {
      const since = beat.last_ok ? `${minutesSince(beat.last_ok)} minutes` : "ever";
      problems.push(`${beat.job}: no successful run in ${since}. Last error: ${beat.last_error ?? "none recorded"}`);
    }
  }

  const synced = await env.DB.prepare(`SELECT MIN(last_synced_date) AS day FROM sync_state`).first<{ day: string | null }>();
  if (synced?.day) {
    const days = Math.floor((now - Date.parse(`${synced.day}T00:00:00Z`)) / 86_400_000);
    if (days > OFFICIAL_DATA_MAX_DAYS) {
      problems.push(`opendata: newest official data is ${days} days old (through ${synced.day}). The source may have moved.`);
    }
  }

  const body = problems.length === 0 ? "ok\n" : problems.join("\n") + "\n";
  return new Response(body, {
    status: problems.length === 0 ? 200 : 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

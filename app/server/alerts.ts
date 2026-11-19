// Records TTC live service alerts. The TTC only publishes what is active right
// now, so polling every few minutes and saving what we see is how we get a
// history of recent disruptions. That covers the 1–2 months before the
// official delay logs (see opendata.ts) are published.

const LIVE_ALERTS_URL = "https://alerts.ttc.ca/api/alerts/live-alerts";

// The fields we use from an alert in the TTC feed.
type SourceAlert = {
  id: string;
  route: string;
  routeType: string;
  alertType: string;
  headerText: string;
  title: string;
  effect: string;
  effectDesc: string | null;
  cause: string;
  causeDescription: string | null;
  severity: string;
  direction: string | null;
  stopStart: string | null;
  stopEnd: string | null;
  activePeriod: { start: string; end: string };
};

export async function syncAlerts(db: D1Database) {
  const response = await fetch(LIVE_ALERTS_URL);
  if (!response.ok) {
    throw new Error(`TTC alerts request failed (${response.status})`);
  }
  const feed = (await response.json()) as { routes: SourceAlert[] };
  const now = new Date().toISOString();

  // Insert new alerts; for ones we've seen before, refresh their details
  // (the TTC edits alerts as things change) and push last_seen forward.
  const upsert = db.prepare(
    `INSERT INTO alerts (
       id, route, route_type, alert_type, header_text, effect, effect_desc,
       cause, cause_desc, severity, direction, stop_start, stop_end,
       active_start, active_end, first_seen, last_seen
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       header_text  = excluded.header_text,
       effect       = excluded.effect,
       effect_desc  = excluded.effect_desc,
       cause        = excluded.cause,
       cause_desc   = excluded.cause_desc,
       severity     = excluded.severity,
       direction    = excluded.direction,
       stop_start   = excluded.stop_start,
       stop_end     = excluded.stop_end,
       active_start = excluded.active_start,
       active_end   = excluded.active_end,
       last_seen    = excluded.last_seen`,
  );

  const alerts = feed.routes ?? [];
  if (alerts.length > 0) {
    await db.batch(
      alerts.map((a) =>
        upsert.bind(
          a.id,
          a.route,
          a.routeType,
          a.alertType,
          a.headerText || a.title,
          a.effect,
          a.effectDesc ?? "",
          a.cause,
          a.causeDescription ?? "",
          a.severity,
          a.direction ?? "",
          a.stopStart ?? "",
          a.stopEnd ?? "",
          toTimestamp(a.activePeriod?.start),
          toTimestamp(a.activePeriod?.end),
          now,
          now,
        ),
      ),
    );
  }

  return { alerts: `recorded ${alerts.length} active alerts` };
}

// The feed uses '0001-01-01T00:00:00Z' to mean "no time given".
function toTimestamp(value: string | undefined) {
  if (!value || value.startsWith("0001-")) return null;
  return new Date(value).toISOString();
}

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

  // Insert new alerts. For ones we've seen before, refresh their details (the
  // TTC edits alerts as things change) and push last_seen forward.
  //
  // When a disruption ends, the TTC changes the same alert to "Regular service
  // has resumed" (effect NO_EFFECT). Then we keep the disruption's details as
  // they were and record the time it ended in resolved_at.
  const upsert = db.prepare(
    `INSERT INTO alerts (
       id, route, route_type, alert_type, header_text, effect, effect_desc,
       cause, cause_desc, severity, direction, stop_start, stop_end,
       active_start, active_end, first_seen, last_seen
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       last_seen   = excluded.last_seen,
       resolved_at = CASE WHEN excluded.effect = 'NO_EFFECT'
                          THEN COALESCE(alerts.resolved_at, excluded.last_seen)
                          ELSE NULL END,
       header_text  = CASE WHEN excluded.effect = 'NO_EFFECT' THEN alerts.header_text  ELSE excluded.header_text  END,
       effect       = CASE WHEN excluded.effect = 'NO_EFFECT' THEN alerts.effect       ELSE excluded.effect       END,
       effect_desc  = CASE WHEN excluded.effect = 'NO_EFFECT' THEN alerts.effect_desc  ELSE excluded.effect_desc  END,
       cause        = CASE WHEN excluded.effect = 'NO_EFFECT' THEN alerts.cause        ELSE excluded.cause        END,
       cause_desc   = CASE WHEN excluded.effect = 'NO_EFFECT' THEN alerts.cause_desc   ELSE excluded.cause_desc   END,
       severity     = CASE WHEN excluded.effect = 'NO_EFFECT' THEN alerts.severity     ELSE excluded.severity     END,
       direction    = CASE WHEN excluded.effect = 'NO_EFFECT' THEN alerts.direction    ELSE excluded.direction    END,
       stop_start   = CASE WHEN excluded.effect = 'NO_EFFECT' THEN alerts.stop_start   ELSE excluded.stop_start   END,
       stop_end     = CASE WHEN excluded.effect = 'NO_EFFECT' THEN alerts.stop_end     ELSE excluded.stop_end     END,
       active_start = CASE WHEN excluded.effect = 'NO_EFFECT' THEN alerts.active_start ELSE excluded.active_start END,
       active_end   = CASE WHEN excluded.effect = 'NO_EFFECT' THEN alerts.active_end   ELSE excluded.active_end   END`,
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

// Times in the feed are Toronto local time, even though they end in "Z"
// (checked against the feed's own lastUpdated, which runs 4–5 hours behind
// UTC). '0001-01-01T00:00:00Z' means "no time given".
function toTimestamp(value: string | undefined) {
  if (!value || value.startsWith("0001-")) return null;
  const wallClock = Date.parse(value.replace(/Z$/, "") + "Z");
  return new Date(wallClock - torontoOffsetMinutes(wallClock) * 60000).toISOString();
}

// Toronto's offset from UTC in minutes at a given moment: -300 (EST) or -240 (EDT).
function torontoOffsetMinutes(timestamp: number) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", timeZoneName: "longOffset" })
    .formatToParts(timestamp)
    .find((p) => p.type === "timeZoneName")!.value; // 'GMT-05:00'
  const [, sign, hours, minutes] = name.match(/([+-])(\d\d):(\d\d)/)!;
  return (sign === "-" ? -1 : 1) * (Number(hours) * 60 + Number(minutes));
}

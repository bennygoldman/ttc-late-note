// Finds incidents (official delays and recorded live alerts) for a given day,
// and puts both into one shape the pages can use.

import { causeFromAlert, causeFromDelay } from "~/lib/causes";
import { formatTime, titleCase, torontoDateTime } from "~/lib/format";
import { lineName, routeFromAlertRoute, routeFromDelayLine, type Mode } from "~/lib/lines";

export type Incident = {
  ref: string; // 'delay:123' or 'alert:80509', used in forms
  source: "delay" | "alert";
  sourceId: string;
  mode: Mode;
  date: string; // 'YYYY-MM-DD', Toronto time
  time: string; // 'HH:MM', Toronto time
  route: string; // '504'
  lineName: string; // '504 King'
  location: string; // 'King and Parliament'
  cause: string; // 'a collision'
  causeOfficial: string; // 'TTC COLLISION – PROPERTY DAMAGE'
  minutes: number | null;
  details: string; // the alert text, '' for official delays
  summary: string; // one line for pick lists
};

type DelayRow = {
  id: number;
  mode: Mode;
  date: string;
  time: string;
  line: string;
  station: string;
  code: string;
  min_delay: number;
  description: string | null;
};

type AlertRow = {
  id: string;
  route: string;
  route_type: string;
  header_text: string;
  cause: string;
  cause_desc: string;
  effect_desc: string;
  stop_start: string;
  stop_end: string;
  active_start: string | null;
  first_seen: string;
  last_seen: string;
};

const DELAY_COLUMNS = `d.id, d.mode, d.date, d.time, d.line, d.station, d.code, d.min_delay, c.description`;

// Every incident for one mode on one day, sorted by time.
export async function incidentsOn(db: D1Database, date: string, mode: Mode) {
  const { results: delays } = await db
    .prepare(
      `SELECT ${DELAY_COLUMNS}
       FROM delays d LEFT JOIN delay_codes c ON c.code = d.code
       WHERE d.date = ? AND d.mode = ? AND d.min_delay > 0`,
    )
    .bind(date, mode)
    .all<DelayRow>();

  // Alerts are stored in UTC. Fetch a generous window, then keep the ones
  // that were active at some point on this Toronto day.
  const { results: alerts } = await db
    .prepare(
      `SELECT * FROM alerts
       WHERE lower(route_type) = ?
         AND COALESCE(active_start, first_seen) < date(?, '+2 days')
         AND last_seen > date(?, '-1 day')`,
    )
    .bind(mode, date, date)
    .all<AlertRow>();

  const fromAlerts = alerts.filter((a) => wasActiveOn(a, date)).map((a) => alertToIncident(a, mode, date));
  const fromDelays = delays.map(delayToIncident);

  return [...fromDelays, ...fromAlerts]
    .filter((i): i is Incident => i !== null)
    .sort((a, b) => a.time.localeCompare(b.time));
}

// One incident by its ref, for creating a note. `date` is the day the person
// picked; an alert can span several days, and the note should name that one.
export async function findIncident(db: D1Database, ref: string, date: string): Promise<Incident | null> {
  const [source, id] = ref.split(":");

  if (source === "delay") {
    const row = await db
      .prepare(`SELECT ${DELAY_COLUMNS} FROM delays d LEFT JOIN delay_codes c ON c.code = d.code WHERE d.id = ?`)
      .bind(Number(id))
      .first<DelayRow>();
    return row ? delayToIncident(row) : null;
  }

  if (source === "alert") {
    const row = await db.prepare(`SELECT * FROM alerts WHERE id = ?`).bind(id).first<AlertRow>();
    if (!row || !wasActiveOn(row, date)) return null;
    return alertToIncident(row, row.route_type.toLowerCase() as Mode, date);
  }

  return null;
}

// What dates we have data for, so the form can say so.
export async function coverage(db: D1Database) {
  const row = await db
    .prepare(
      `SELECT (SELECT MIN(date) FROM delays) AS delays_from,
              (SELECT MAX(date) FROM delays) AS delays_to,
              (SELECT MIN(first_seen) FROM alerts) AS alerts_from`,
    )
    .first<{ delays_from: string | null; delays_to: string | null; alerts_from: string | null }>();

  return {
    delaysFrom: row?.delays_from ?? null,
    delaysTo: row?.delays_to ?? null,
    alertsFrom: row?.alerts_from ? torontoDateTime(row.alerts_from).date : null,
  };
}

// --- Converting rows ---

function delayToIncident(row: DelayRow): Incident | null {
  const route = routeFromDelayLine(row.mode, row.line);
  if (!route) return null;

  const name = lineName(row.mode, route, row.line);
  const location = titleCase(row.station);
  return {
    ref: `delay:${row.id}`,
    source: "delay",
    sourceId: String(row.id),
    mode: row.mode,
    date: row.date,
    time: row.time,
    route,
    lineName: name,
    location,
    cause: causeFromDelay(row.code, row.description),
    causeOfficial: row.description ?? row.code,
    minutes: row.min_delay,
    details: "",
    summary: `${formatTime(row.time)} near ${location}: ${row.min_delay} min`,
  };
}

function alertToIncident(row: AlertRow, mode: Mode, date: string): Incident | null {
  const route = routeFromAlertRoute(row.route);
  if (!route) return null;

  // If the alert started before this day, call it "in effect" from midnight.
  const start = torontoDateTime(row.active_start ?? row.first_seen);
  const time = start.date === date ? start.time : "00:00";

  const location = [row.stop_start, row.stop_end].filter(Boolean).join(" to ");
  const message = row.header_text.split(":").slice(1).join(":").trim() || row.header_text;
  return {
    ref: `alert:${row.id}`,
    source: "alert",
    sourceId: row.id,
    mode,
    date,
    time,
    route,
    lineName: lineName(mode, route, row.header_text),
    location,
    cause: causeFromAlert(row.cause),
    causeOfficial: row.cause_desc || row.effect_desc || row.cause,
    minutes: null,
    details: row.header_text,
    summary: `${time === "00:00" ? "All day" : formatTime(time)}: ${message}`,
  };
}

// Whether an alert was active at some point during a Toronto day. We count it
// as active from its start time until the last time our poller saw it.
function wasActiveOn(alert: AlertRow, date: string) {
  const start = torontoDateTime(alert.active_start ?? alert.first_seen).date;
  const end = torontoDateTime(alert.last_seen).date;
  return start <= date && date <= end;
}

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
  time: string; // 'HH:MM', Toronto time; '' if it started on an earlier day
  route: string; // '504'
  lineName: string; // '504 King'
  location: string; // 'King and Parliament', or for alerts 'between Jane and Keele stations'
  effect: string; // alerts only: 'was suspended', 'was on a detour'; '' for official delays
  cause: string; // 'a collision'
  causeOfficial: string; // 'TTC COLLISION – PROPERTY DAMAGE'
  minutes: number | null; // official delay length, or roughly how long an alert lasted
  details: string; // the alert's own text, kept for reference but never shown
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
  effect: string;
  effect_desc: string;
  cause: string;
  cause_desc: string;
  stop_start: string;
  stop_end: string;
  active_start: string | null;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
};

const DELAY_COLUMNS = `d.id, d.mode, d.date, d.time, d.line, d.station, d.code, d.min_delay, c.description`;

// Alerts that don't describe a disruption.
const NOT_DISRUPTIONS = ["NO_EFFECT", "ADDITIONAL_SERVICE", "OTHER_EFFECT", "UNKNOWN_EFFECT"];

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
         AND COALESCE(resolved_at, last_seen) > date(?, '-1 day')`,
    )
    .bind(mode, date, date)
    .all<AlertRow>();

  const fromAlerts = alerts
    .filter((a) => isDisruption(a) && wasActiveOn(a, date))
    .map((a) => alertToIncident(a, mode, date));
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
    if (!row || !isDisruption(row) || !wasActiveOn(row, date)) return null;
    return alertToIncident(row, row.route_type.toLowerCase() as Mode, date);
  }

  return null;
}

// The most recent official delay of 15 minutes or more, for the home page.
export async function latestDelay(db: D1Database) {
  const row = await db
    .prepare(
      `SELECT ${DELAY_COLUMNS}
       FROM delays d LEFT JOIN delay_codes c ON c.code = d.code
       WHERE d.min_delay >= 15
       ORDER BY d.date DESC, d.time DESC
       LIMIT 1`,
    )
    .first<DelayRow>();
  return row ? delayToIncident(row) : null;
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

// --- Official delays ---

function delayToIncident(row: DelayRow): Incident | null {
  const route = routeFromDelayLine(row.mode, row.line);
  if (!route) return null;

  const ref = `delay:${row.id}`;
  const location = titleCase(row.station);
  return {
    ref,
    source: "delay",
    sourceId: String(row.id),
    mode: row.mode,
    date: row.date,
    time: row.time,
    route,
    lineName: lineName(row.mode, route, row.line),
    location,
    effect: "",
    cause: causeFromDelay(row.code, row.description, ref),
    causeOfficial: row.description ?? row.code,
    minutes: row.min_delay,
    details: "",
    summary: `${formatTime(row.time)} near ${location}: ${row.min_delay} min`,
  };
}

// --- Live alerts ---

// How each kind of alert reads in the letter: '<route> service was suspended ...'
const EFFECTS: Record<string, string> = {
  NO_SERVICE: "was suspended",
  REDUCED_SERVICE: "was reduced",
  SIGNIFICANT_DELAYS: "was significantly delayed",
  DETOUR: "was on a detour",
  MODIFIED_SERVICE: "was disrupted",
  STOP_MOVED: "was disrupted",
};

function alertToIncident(row: AlertRow, mode: Mode, date: string): Incident | null {
  const route = routeFromAlertRoute(row.route);
  if (!route) return null;

  // If the alert started before this day, there's no start time to give.
  const start = torontoDateTime(row.active_start ?? row.first_seen);
  const time = start.date === date ? start.time : "";

  const ref = `alert:${row.id}`;
  const effect = /closure/i.test(row.effect_desc)
    ? "was closed"
    : row.effect_desc === "Reduced Speed Zone"
      ? "ran slower than usual"
      : (EFFECTS[row.effect] ?? "was disrupted");
  const location = stretch(mode, row.stop_start, row.stop_end);
  const minutes = row.resolved_at ? roughMinutes(row.first_seen, row.resolved_at) : null;

  const summary = [
    time ? formatTime(time) : "Ongoing",
    `: service ${effect.replace(/^was /, "")}`,
    location && ` ${location}`,
    minutes && `, about ${minutes} min`,
  ].join("");

  return {
    ref,
    source: "alert",
    sourceId: row.id,
    mode,
    date,
    time,
    route,
    lineName: lineName(mode, route, row.header_text),
    location,
    effect,
    cause: causeFromAlert(row.cause, row.cause_desc, ref),
    causeOfficial: row.cause_desc || row.cause,
    minutes,
    details: row.header_text,
    summary,
  };
}

function isDisruption(alert: AlertRow) {
  return !NOT_DISRUPTIONS.includes(alert.effect);
}

// Whether an alert was active at some point during a Toronto day: from its
// start until it was resolved, or until the last time our poller saw it.
function wasActiveOn(alert: AlertRow, date: string) {
  const start = torontoDateTime(alert.active_start ?? alert.first_seen).date;
  const end = torontoDateTime(alert.resolved_at ?? alert.last_seen).date;
  return start <= date && date <= end;
}

// 'between Victoria Park and Kennedy stations', 'between Dundas St West at
// Spadina Ave and Dundas St West at Sterling Rd'. Bus bay numbers are dropped.
function stretch(mode: Mode, from: string, to: string) {
  const clean = (stop: string) => stop.replace(/\s*(at\s+)?(Bus\s+)?Bay\s+\d+$/i, "").trim();
  const [a, b] = [clean(from), clean(to)];
  if (!a) return "";
  if (!b || a === b) return `near ${a}`;
  return mode === "subway" ? `between ${a} and ${b} stations` : `between ${a} and ${b}`;
}

// Minutes between two timestamps, to the nearest 5. Our poller checks every
// 5 minutes, so anything finer would be made up.
function roughMinutes(from: string, to: string) {
  const minutes = (Date.parse(to) - Date.parse(from)) / 60000;
  return Math.max(5, Math.round(minutes / 5) * 5);
}

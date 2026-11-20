// Imports the TTC delay logs that the City of Toronto publishes on its
// Open Data portal. The data is refreshed monthly, so this runs on a schedule
// and imports whole days it hasn't seen yet, a few at a time.
//
// Portal pages:
//   https://open.toronto.ca/dataset/ttc-subway-delay-data/
//   https://open.toronto.ca/dataset/ttc-streetcar-delay-data/
//   https://open.toronto.ca/dataset/ttc-bus-delay-data/

const API = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search";

// The "since 2025" resources. Older years are published as separate files.
const DATASETS = {
  subway: {
    delays: "6088e14f-e46e-4f5c-9daa-dea1359ad396",
    codes: "9e9efbb6-3a2f-4934-ac94-9150ecaeb548",
  },
  streetcar: {
    delays: "7d545629-745c-4fbf-a348-76692bb2772d",
    codes: "b1fc714c-c533-424c-8ce4-4994e9c6fb1d",
  },
  bus: {
    delays: "c3451ac9-c04a-4645-bd80-0e2a3b7d7199",
    codes: "816f2214-97e2-4c4b-820e-24b425ed08e0",
  },
} as const;

export type Mode = keyof typeof DATASETS;
const MODES = Object.keys(DATASETS) as Mode[];

// Where to start when the database is empty.
export const FIRST_DAY = "2025-01-01";

// How many days to import per mode in one run. This is limited by the free
// plan's 100,000 row writes a day: a day of delays is about 280 rows across
// all modes, and each row costs 2 writes (the row and its unique index).
// 4 days an hour is about 54,000 writes a day, which leaves room for the
// alerts poller. A full import from scratch takes about a week; a month of
// new data takes about 8 hours.
const MAX_DAYS_PER_MODE = 4;

// A row as the Open Data API returns it.
type SourceRow = {
  Date: string; // '2026-09-30' or '2026-09-30T00:00:00' (bus)
  Time: string;
  Line: string | null;
  Station: string | null;
  Code: string | null;
  "Min Delay": string | null;
  "Min Gap": string | null;
  Bound: string | null;
  Vehicle: string | null;
};

export async function syncOpenData(db: D1Database) {
  const summary: Record<string, string> = {};

  for (const mode of MODES) {
    const lastSynced = await getLastSyncedDate(db, mode);
    const newestPublished = await fetchNewestPublishedDate(mode);
    const days = daysAfter(lastSynced, newestPublished).slice(0, MAX_DAYS_PER_MODE);

    if (days.length === 0) {
      summary[mode] = `up to date through ${lastSynced}`;
      continue;
    }

    let rows = 0;
    for (const day of days) {
      const records = await fetchDay(mode, day);
      await insertDelays(db, mode, records);
      await setLastSyncedDate(db, mode, day);
      rows += records.length;
    }
    summary[mode] = `imported ${rows} rows for ${days[0]} to ${days.at(-1)}`;
  }

  await syncCodes(db);
  return { openData: summary };
}

// --- Fetching from Open Data ---

async function query<T>(params: Record<string, string>): Promise<T[]> {
  const url = `${API}?${new URLSearchParams(params)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open Data request failed (${response.status}): ${url}`);
  }
  const body = (await response.json()) as { success: boolean; result: { records: T[] } };
  if (!body.success) {
    throw new Error(`Open Data request was not successful: ${url}`);
  }
  return body.result.records;
}

async function fetchNewestPublishedDate(mode: Mode) {
  const [newest] = await query<SourceRow>({
    resource_id: DATASETS[mode].delays,
    sort: "_id desc",
    limit: "1",
  });
  return newest.Date.slice(0, 10);
}

function fetchDay(mode: Mode, day: string) {
  return query<SourceRow>({
    resource_id: DATASETS[mode].delays,
    filters: JSON.stringify({ Date: day }),
    limit: "5000", // a busy day of bus delays is a few hundred rows
  });
}

// --- Writing to D1 ---

async function insertDelays(db: D1Database, mode: Mode, records: SourceRow[]) {
  if (records.length === 0) return;

  const insert = db.prepare(
    `INSERT OR IGNORE INTO delays
       (mode, date, time, line, station, code, min_delay, min_gap, bound, vehicle)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  await db.batch(
    records.map((r) =>
      insert.bind(
        mode,
        r.Date.slice(0, 10),
        r.Time,
        clean(r.Line),
        clean(r.Station),
        clean(r.Code),
        toNumber(r["Min Delay"]),
        toNumber(r["Min Gap"]),
        clean(r.Bound),
        clean(r.Vehicle),
      ),
    ),
  );
}

async function syncCodes(db: D1Database) {
  const upsert = db.prepare(
    `INSERT INTO delay_codes (code, description) VALUES (?, ?)
     ON CONFLICT (code) DO UPDATE SET description = excluded.description`,
  );

  for (const mode of MODES) {
    const codes = await query<{ CODE: string; DESCRIPTION: string }>({
      resource_id: DATASETS[mode].codes,
      limit: "1000",
    });
    await db.batch(codes.map((c) => upsert.bind(clean(c.CODE), clean(c.DESCRIPTION))));
  }
}

async function getLastSyncedDate(db: D1Database, mode: Mode) {
  const row = await db
    .prepare("SELECT last_synced_date FROM sync_state WHERE mode = ?")
    .bind(mode)
    .first<{ last_synced_date: string }>();
  return row?.last_synced_date ?? addDays(FIRST_DAY, -1);
}

async function setLastSyncedDate(db: D1Database, mode: Mode, day: string) {
  await db
    .prepare(
      `INSERT INTO sync_state (mode, last_synced_date) VALUES (?, ?)
       ON CONFLICT (mode) DO UPDATE SET last_synced_date = excluded.last_synced_date`,
    )
    .bind(mode, day)
    .run();
}

// --- Small helpers ---

// The source uses the text "None" (or null) for missing values.
function clean(value: string | null) {
  const text = fixEncoding((value ?? "").trim());
  return text === "None" ? "" : text;
}

// Some source text was double-encoded, so an en dash shows up as "â€“".
// If a string looks like that, decode it properly; otherwise leave it alone.
function fixEncoding(text: string) {
  const looksDoubleEncoded = /[\u00c2-\u00f4][\u0080-\u00bf]/.test(text) && !/[^\u0000-\u00ff]/.test(text);
  if (!looksDoubleEncoded) return text;
  try {
    const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return text;
  }
}

function toNumber(value: string | null) {
  const n = Number.parseInt(clean(value), 10);
  return Number.isNaN(n) ? 0 : n;
}

// 'YYYY-MM-DD' plus n days.
function addDays(day: string, n: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

// Every day after `from`, up to and including `to`.
function daysAfter(from: string, to: string) {
  const days: string[] = [];
  for (let day = addDays(from, 1); day <= to; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

-- Official delay log entries from Toronto Open Data (published monthly).
-- Dates and times are Toronto local time, exactly as published.
CREATE TABLE delays (
  id         INTEGER PRIMARY KEY,
  mode       TEXT NOT NULL,          -- 'subway' | 'streetcar' | 'bus'
  date       TEXT NOT NULL,          -- 'YYYY-MM-DD'
  time       TEXT NOT NULL,          -- 'HH:MM'
  line       TEXT NOT NULL,          -- as published: 'YU', '504 KING', '54 LAWRENCE EAST'
  station    TEXT NOT NULL,          -- where it happened, e.g. 'KING AND PARLIAMENT'
  code       TEXT NOT NULL,          -- cause code; see delay_codes
  min_delay  INTEGER NOT NULL,       -- minutes of delay
  min_gap    INTEGER NOT NULL,       -- minutes between vehicles
  bound      TEXT NOT NULL,          -- direction: 'N' | 'S' | 'E' | 'W' | ''
  vehicle    TEXT NOT NULL,
  -- The source has no stable id, so the row itself is the identity.
  UNIQUE (mode, date, time, line, station, code, vehicle)
);

CREATE INDEX delays_by_day ON delays (date, mode, line);

-- What each cause code means. The City publishes a list per mode, but the
-- lists don't conflict and lines sometimes use another mode's codes, so we
-- keep one combined list. Some codes in the delay logs aren't in any list.
CREATE TABLE delay_codes (
  code        TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

-- How far the Open Data import has got for each mode.
CREATE TABLE sync_state (
  mode             TEXT PRIMARY KEY,
  last_synced_date TEXT NOT NULL     -- last day fully imported, 'YYYY-MM-DD'
);

-- TTC live service alerts, recorded as we see them. The TTC feed only shows
-- what is active right now, so this table is our own history of it.
-- Timestamps are ISO 8601 UTC.
CREATE TABLE alerts (
  id                TEXT PRIMARY KEY,  -- TTC's alert id
  route             TEXT NOT NULL,     -- '1', '504', '59B'
  route_type        TEXT NOT NULL,     -- 'Subway' | 'Streetcar' | 'Bus' | ...
  alert_type        TEXT NOT NULL,     -- 'Planned' | 'Unplanned' | ...
  header_text       TEXT NOT NULL,     -- the full human-readable message
  effect            TEXT NOT NULL,     -- 'DETOUR', 'REDUCED_SERVICE', ...
  effect_desc       TEXT NOT NULL,
  cause             TEXT NOT NULL,     -- 'ACCIDENT', 'MAINTENANCE', ...
  cause_desc        TEXT NOT NULL,
  severity          TEXT NOT NULL,
  direction         TEXT NOT NULL,
  stop_start        TEXT NOT NULL,
  stop_end          TEXT NOT NULL,
  active_start      TEXT,              -- when the TTC says it started
  active_end        TEXT,              -- when the TTC says it ends (null if open-ended)
  first_seen        TEXT NOT NULL,     -- first time our poller saw it
  last_seen         TEXT NOT NULL      -- most recent time our poller saw it
);

CREATE INDEX alerts_by_route ON alerts (route, first_seen);

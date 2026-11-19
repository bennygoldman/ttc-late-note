-- A late note. It keeps its own copy of the incident details so the letter
-- reads the same forever, even if the source data is corrected later.
CREATE TABLE notes (
  id          TEXT PRIMARY KEY,   -- short random id used in the share link
  created_at  TEXT NOT NULL,      -- ISO 8601 UTC

  from_name   TEXT NOT NULL,      -- the person who was late
  to_name     TEXT NOT NULL,      -- the person they kept waiting
  event       TEXT NOT NULL,      -- what they were late for

  source      TEXT NOT NULL,      -- 'delay' (official log) | 'alert' (live alert)
  source_id   TEXT NOT NULL,      -- delays.id or alerts.id
  mode        TEXT NOT NULL,      -- 'subway' | 'streetcar' | 'bus'
  date        TEXT NOT NULL,      -- 'YYYY-MM-DD', Toronto time
  time        TEXT NOT NULL,      -- 'HH:MM', Toronto time
  line_name   TEXT NOT NULL,      -- e.g. '504 King', 'Line 1 Yonge-University'
  location    TEXT NOT NULL,      -- e.g. 'King and Parliament'
  cause       TEXT NOT NULL,      -- plain-English cause, e.g. 'a collision'
  cause_official TEXT NOT NULL,   -- the TTC's own wording
  minutes     INTEGER,            -- minutes of delay (official logs only)
  details     TEXT NOT NULL       -- alert text at the time ('' for official logs)
);

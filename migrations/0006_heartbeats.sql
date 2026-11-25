-- When each scheduled job last ran, last succeeded, and its last error.
-- /health reads this to tell whether the jobs are still working.
CREATE TABLE heartbeats (
  job        TEXT PRIMARY KEY,   -- 'alerts' | 'opendata'
  last_run   TEXT NOT NULL,      -- ISO 8601 UTC
  last_ok    TEXT,               -- last run that finished without an error
  last_error TEXT                -- message from the most recent failed run
);

-- When an alert changed to "Regular service has resumed". The TTC reuses the
-- same alert for that message, so we keep the disruption's details and note
-- the time it ended here instead of overwriting them.
ALTER TABLE alerts ADD COLUMN resolved_at TEXT;

-- How an alert-based note describes what happened: 'was suspended',
-- 'was on a detour'. Empty for notes from the official delay logs.
ALTER TABLE notes ADD COLUMN effect TEXT NOT NULL DEFAULT '';

-- Alert start and end times were saved as UTC, but the TTC feed gives Toronto
-- local time. Every alert so far was recorded in November 2026 (EST, UTC-5).
UPDATE alerts
SET active_start = strftime('%Y-%m-%dT%H:%M:%fZ', active_start, '+5 hours'),
    active_end   = strftime('%Y-%m-%dT%H:%M:%fZ', active_end, '+5 hours');

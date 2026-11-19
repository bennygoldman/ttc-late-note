-- The route number, so the letter can show the route the way TTC signs do.
ALTER TABLE notes ADD COLUMN route TEXT NOT NULL DEFAULT '';

-- Every index is written on every insert, and the free plan allows 100,000
-- row writes a day. The unique index on delays already starts with
-- (mode, date, ...), which serves the same lookups, so this one goes.
DROP INDEX delays_by_day;

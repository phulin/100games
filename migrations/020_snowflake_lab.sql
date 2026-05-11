-- Migration 020: Snowflake Lab — persist user-submitted flake params for novelty scoring & gallery.
CREATE TABLE IF NOT EXISTS snowflakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  params TEXT NOT NULL,
  author TEXT,
  daily_seed INTEGER,
  novelty INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snowflakes_created
  ON snowflakes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_snowflakes_daily
  ON snowflakes (daily_seed, created_at DESC);

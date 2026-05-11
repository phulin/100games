-- Migration: Refraction (Game030)
-- User-designed prism/mirror puzzle levels (UGC).

CREATE TABLE IF NOT EXISTS refraction_levels (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL CHECK (length(title) > 0 AND length(title) <= 60),
  grid       TEXT NOT NULL CHECK (length(grid) <= 8192),
  author     TEXT,
  solves     INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refraction_levels_created_at
  ON refraction_levels (created_at DESC);

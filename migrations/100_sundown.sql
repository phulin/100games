-- Migration 100: Sundown — daily seeded reaction game leaderboard.
CREATE TABLE IF NOT EXISTS sundown_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  author TEXT NOT NULL,
  handle TEXT NOT NULL,
  offset_ms INTEGER NOT NULL,
  abs_offset_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(day, author)
);

CREATE INDEX IF NOT EXISTS idx_sundown_scores_day
  ON sundown_scores (day);

CREATE INDEX IF NOT EXISTS idx_sundown_scores_day_abs
  ON sundown_scores (day, abs_offset_ms);

-- Migration: Sundown v2 (Game100)
-- Tracks per-author streak and lifetime stats so we can show streak/percentile
-- without enumerating all daily entries client-side.
CREATE TABLE IF NOT EXISTS sundown_author_stats (
  author TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_day TEXT,
  total_plays INTEGER NOT NULL DEFAULT 0,
  best_abs_offset_ms INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sundown_author_stats_streak
  ON sundown_author_stats (current_streak DESC);

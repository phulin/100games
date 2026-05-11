-- Migration: Compass Rose (Game056)
-- Daily blindfolded-walk puzzle: deterministic seed per UTC day,
-- single correct answer, global leaderboard of fastest correct solves.

CREATE TABLE IF NOT EXISTS compass_scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  day        TEXT NOT NULL,                       -- YYYY-MM-DD (UTC)
  seed       TEXT NOT NULL,
  author     TEXT NOT NULL,                       -- anonymous client id
  handle     TEXT NOT NULL DEFAULT 'anon' CHECK (length(handle) <= 20),
  solve_ms   INTEGER NOT NULL,
  correct    INTEGER NOT NULL CHECK (correct IN (0, 1)),
  created_at INTEGER NOT NULL,
  UNIQUE (day, author)
);

CREATE INDEX IF NOT EXISTS idx_compass_scores_day
  ON compass_scores (day);

CREATE INDEX IF NOT EXISTS idx_compass_scores_day_solve
  ON compass_scores (day, correct, solve_ms);

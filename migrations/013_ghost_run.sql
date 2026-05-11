-- Migration 013: Ghost Run — persist player runs for global ghost racing.
CREATE TABLE IF NOT EXISTS ghost_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level_seed TEXT NOT NULL,
  finish_ms INTEGER NOT NULL,
  frames TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ghost_runs_level_finish
  ON ghost_runs (level_seed, finish_ms);

CREATE INDEX IF NOT EXISTS idx_ghost_runs_level_seed
  ON ghost_runs (level_seed);

CREATE INDEX IF NOT EXISTS idx_ghost_runs_finish_ms
  ON ghost_runs (finish_ms);

-- Migration 013 v2: Ghost Run — add optional handle column.
-- The existing `author` column stores an anonymous client id; `handle` is a
-- human-chosen display name shown on the leaderboard. Nullable for back-compat.
ALTER TABLE ghost_runs ADD COLUMN handle TEXT;

CREATE INDEX IF NOT EXISTS idx_ghost_runs_level_handle
  ON ghost_runs (level_seed, handle);

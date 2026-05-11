-- Migration 017: Constellation — persist user-submitted constellations and votes.
CREATE TABLE IF NOT EXISTS constellations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seed INTEGER NOT NULL,
  name TEXT NOT NULL,
  stars TEXT NOT NULL,
  edges TEXT NOT NULL,
  author TEXT,
  votes_fit INTEGER NOT NULL DEFAULT 0,
  votes_total INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_constellations_seed_created
  ON constellations (seed, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_constellations_created
  ON constellations (created_at DESC);

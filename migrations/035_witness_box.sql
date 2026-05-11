-- Migration: Witness Box (Game035)
-- Player-authored crime/event cases: an ordered list of truths plus a set of lies.
-- Pulled at random for other players to reconstruct.

CREATE TABLE IF NOT EXISTS witness_cases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL CHECK (length(name) > 0 AND length(name) <= 80),
  truths      TEXT NOT NULL CHECK (length(truths) <= 4096),   -- JSON array of strings (ordered)
  lies        TEXT NOT NULL CHECK (length(lies) <= 4096),     -- JSON array of strings
  author      TEXT,
  solves      INTEGER NOT NULL DEFAULT 0,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_witness_cases_created_at
  ON witness_cases (created_at DESC);

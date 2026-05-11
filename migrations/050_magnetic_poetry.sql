-- Migration: Magnetic Poetry (Game050)
-- Shared daily-themed poems with idempotent upvotes.

CREATE TABLE IF NOT EXISTS magnetic_poems (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  theme      TEXT NOT NULL,
  text       TEXT NOT NULL CHECK (length(text) > 0 AND length(text) <= 500),
  author     TEXT NOT NULL DEFAULT 'anon',
  votes      INTEGER NOT NULL DEFAULT 0,
  day        TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_magnetic_poems_day ON magnetic_poems (day);
CREATE INDEX IF NOT EXISTS idx_magnetic_poems_day_votes ON magnetic_poems (day, votes DESC);

CREATE TABLE IF NOT EXISTS magnetic_votes (
  poem_id INTEGER NOT NULL,
  author  TEXT NOT NULL,
  UNIQUE (poem_id, author)
);

CREATE INDEX IF NOT EXISTS idx_magnetic_votes_poem ON magnetic_votes (poem_id);

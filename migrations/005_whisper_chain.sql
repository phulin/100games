-- Migration: Whisper Chain (Game005)
-- Append-only shared "telephone" chain. Each row is one link.

CREATE TABLE IF NOT EXISTS whisper_chain (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  text       TEXT NOT NULL CHECK (length(text) > 0 AND length(text) <= 280),
  author     TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whisper_chain_id ON whisper_chain (id);

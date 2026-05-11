-- Migration 079: The Translator — community translations of fictional-language poems.
CREATE TABLE IF NOT EXISTS translator_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  poem_id    TEXT NOT NULL,
  text       TEXT NOT NULL CHECK (length(text) > 0 AND length(text) <= 600),
  author     TEXT,
  votes      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_translator_entries_poem_id
  ON translator_entries (poem_id);

CREATE INDEX IF NOT EXISTS idx_translator_entries_poem_votes
  ON translator_entries (poem_id, votes DESC);

CREATE TABLE IF NOT EXISTS translator_votes (
  entry_id   INTEGER NOT NULL,
  author     TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (entry_id, author),
  FOREIGN KEY (entry_id) REFERENCES translator_entries(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_translator_votes_unique
  ON translator_votes (entry_id, author);

CREATE INDEX IF NOT EXISTS idx_translator_votes_entry
  ON translator_votes (entry_id);

-- Migration 039: The Cartomancer — fortunes written for seeded tarot spreads.
CREATE TABLE IF NOT EXISTS cartomancer_fortunes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  spread_key TEXT NOT NULL,
  text       TEXT NOT NULL CHECK (length(text) > 0 AND length(text) <= 400),
  author     TEXT,
  votes      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cartomancer_fortunes_spread_key
  ON cartomancer_fortunes (spread_key);

CREATE TABLE IF NOT EXISTS cartomancer_votes (
  fortune_id INTEGER NOT NULL,
  author     TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (fortune_id, author),
  FOREIGN KEY (fortune_id) REFERENCES cartomancer_fortunes(id)
);

CREATE INDEX IF NOT EXISTS idx_cartomancer_votes_fortune
  ON cartomancer_votes (fortune_id);

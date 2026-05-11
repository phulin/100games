-- Migration 023: Wordweaver — daily seeded word-chain leaderboard.
CREATE TABLE IF NOT EXISTS wordweaver_chains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  author TEXT NOT NULL,
  handle TEXT NOT NULL,
  chain_len INTEGER NOT NULL,
  word TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(day, author)
);

CREATE INDEX IF NOT EXISTS idx_wordweaver_chains_day
  ON wordweaver_chains (day);

CREATE INDEX IF NOT EXISTS idx_wordweaver_chains_day_len
  ON wordweaver_chains (day, chain_len DESC);

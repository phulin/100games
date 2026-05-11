-- Migration 090: Mage Duel — asynchronous PvP sealed-sequence duels.
CREATE TABLE IF NOT EXISTS mage_matches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  challenger      TEXT NOT NULL,
  challenger_seq  TEXT NOT NULL,
  defender        TEXT,
  defender_seq    TEXT,
  result          TEXT CHECK (result IN ('challenger_win','defender_win','draw')),
  created_at      INTEGER NOT NULL,
  resolved_at     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_mage_matches_resolved_at
  ON mage_matches (resolved_at);

CREATE INDEX IF NOT EXISTS idx_mage_matches_challenger
  ON mage_matches (challenger);

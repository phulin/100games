-- Migration 070: Querulous Garden — leaderboard of best diagnoses per player.

CREATE TABLE IF NOT EXISTS querulous_garden_scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player      TEXT NOT NULL CHECK (length(player) > 0 AND length(player) <= 64),
  score       INTEGER NOT NULL CHECK (score >= 0 AND score <= 6),
  seed        INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_querulous_garden_scores_player
  ON querulous_garden_scores (player);

CREATE INDEX IF NOT EXISTS idx_querulous_garden_scores_score
  ON querulous_garden_scores (score DESC, created_at ASC);

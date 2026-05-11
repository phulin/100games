-- Migration 065: Fortune Cookie — players write fortunes for strangers,
-- draw random fortunes, and rate them. Shared global pool.

CREATE TABLE IF NOT EXISTS fortune_cookies (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  text          TEXT NOT NULL CHECK (length(text) > 0 AND length(text) <= 200),
  author        TEXT,
  rating_sum    INTEGER NOT NULL DEFAULT 0,
  rating_count  INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fortune_cookies_author
  ON fortune_cookies (author);

CREATE TABLE IF NOT EXISTS fortune_ratings (
  fortune_id  INTEGER NOT NULL,
  author      TEXT NOT NULL,
  stars       INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  created_at  INTEGER NOT NULL,
  UNIQUE (fortune_id, author),
  FOREIGN KEY (fortune_id) REFERENCES fortune_cookies(id)
);

CREATE INDEX IF NOT EXISTS idx_fortune_ratings_fortune
  ON fortune_ratings (fortune_id);

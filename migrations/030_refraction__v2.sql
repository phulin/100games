-- Migration: Refraction v2 (Game030)
-- Adds an index on solves to support sort-by-popular queries efficiently.
-- The solves column already exists from v1; this migration only adds the index.

CREATE INDEX IF NOT EXISTS idx_refraction_levels_solves
  ON refraction_levels (solves DESC);

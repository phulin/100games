-- Migration: Whisper Chain v2 (Game005)
-- Adds a normalized text column for server-side duplicate detection.
-- The latest link's normalized form is compared against incoming submissions
-- so a player cannot just resubmit the exact sentence they were shown.

ALTER TABLE whisper_chain ADD COLUMN normalized TEXT;

CREATE INDEX IF NOT EXISTS idx_whisper_chain_normalized ON whisper_chain (normalized);

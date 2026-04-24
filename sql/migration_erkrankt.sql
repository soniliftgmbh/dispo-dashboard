-- Migration: Erkrankt als eigene Spalte
-- Einmalig im Supabase SQL-Editor ausführen

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS erkrankt BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_entries_erkrankt ON entries(erkrankt);

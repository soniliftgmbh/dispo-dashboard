-- Migration: dispo_required Flag
-- Einmalig im Supabase SQL-Editor ausführen

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS dispo_required BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_entries_dispo_required ON entries(dispo_required);

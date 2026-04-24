-- Migration: KI-Analyse Felder
-- Einmalig im Supabase SQL-Editor ausführen

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS ki_notiz TEXT,
  ADD COLUMN IF NOT EXISTS ki_grund TEXT;

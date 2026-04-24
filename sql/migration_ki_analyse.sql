-- Migration: Erweiterte KI-Analyse Felder
-- Einmalig im Supabase SQL-Editor ausführen

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS ki_vorname             TEXT,
  ADD COLUMN IF NOT EXISTS ki_nachname            TEXT,
  ADD COLUMN IF NOT EXISTS ki_direction           TEXT,
  ADD COLUMN IF NOT EXISTS ki_agent              TEXT,
  ADD COLUMN IF NOT EXISTS ki_termin_ergebnis    TEXT,
  ADD COLUMN IF NOT EXISTS ki_rueckruf_wunsch    TEXT,
  ADD COLUMN IF NOT EXISTS ki_naechste_aktion    TEXT,
  ADD COLUMN IF NOT EXISTS ki_stimmung           TEXT,
  ADD COLUMN IF NOT EXISTS ki_angehoeriger       TEXT,
  ADD COLUMN IF NOT EXISTS ki_zuverlaessigkeit   TEXT,
  ADD COLUMN IF NOT EXISTS ki_gespraechsqualitaet TEXT,
  ADD COLUMN IF NOT EXISTS ki_gespraechsende     TEXT,
  ADD COLUMN IF NOT EXISTS ki_frage              TEXT,
  ADD COLUMN IF NOT EXISTS ki_erklaerung_wiederholt TEXT,
  ADD COLUMN IF NOT EXISTS ki_zusammenfassung    TEXT;

-- ============================================================
-- Anna Dashboard — Migration v3c
-- Neue Kanban-Spalte "Abgebrochen" (outcome = 'abgebrochen')
-- Im Supabase SQL-Editor ausführen
-- ============================================================

-- Bestehende "manuell abgebrochen"-Einträge in die neue Spalte verschieben
-- (bisher landeten diese in outcome = 'nacharbeiten')
UPDATE entries
SET outcome = 'abgebrochen'
WHERE abbruchgrund = 'manuell abgebrochen'
  AND outcome = 'nacharbeiten';

-- Index für neue outcome-Werte (optional, schadet nicht)
CREATE INDEX IF NOT EXISTS idx_entries_outcome ON entries(outcome);

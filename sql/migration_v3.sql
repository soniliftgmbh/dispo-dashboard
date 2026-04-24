-- ============================================================
-- Anna Dashboard — Migration v3
-- Board-System, Permissions, Comments, Settings, Outcome-Status
-- Im Supabase SQL-Editor ausführen
-- ============================================================

-- ── 1. ENTRIES: neue Spalten ─────────────────────────────────

-- Board-Typ (aus Praxedo-ID-Präfix abgeleitet)
ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS board_type TEXT,
  ADD COLUMN IF NOT EXISTS outcome TEXT,           -- 'bestaetigt' | 'nacharbeiten' | null
  ADD COLUMN IF NOT EXISTS nacharbeiten_abschluss TEXT,
  ADD COLUMN IF NOT EXISTS is_calling BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unread_by TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS erkrankt BOOLEAN NOT NULL DEFAULT false;

-- Bestehende Einträge: board_type aus praxedo_id ableiten
UPDATE entries SET board_type =
  CASE
    WHEN praxedo_id ILIKE 'NEUINSTALLATION%' THEN 'neuinstallation'
    WHEN praxedo_id ILIKE 'NOTDIENST%'
      OR praxedo_id ILIKE 'STOERUNG%'
      OR praxedo_id ILIKE 'DEMONTAGE%' THEN 'reklamation'
    ELSE 'wartung'
  END
WHERE board_type IS NULL;

-- Bestehende Einträge: auftragstyp aus praxedo_id ableiten (nur wenn noch null)
UPDATE entries SET auftragstyp =
  CASE
    WHEN praxedo_id ILIKE 'NEUINSTALLATION%' THEN 'Neuinstallation'
    WHEN praxedo_id ILIKE 'NOTDIENST%'       THEN 'Notdienst'
    WHEN praxedo_id ILIKE 'STOERUNG%'        THEN 'Störung'
    WHEN praxedo_id ILIKE 'DEMONTAGE%'       THEN 'Demontage'
    WHEN praxedo_id ILIKE 'WARTUNG%'         THEN 'Wartung'
    ELSE auftragstyp
  END
WHERE auftragstyp IS NULL;

-- Bestehende dispo_info='-' Einträge in outcome überführen
UPDATE entries SET outcome = 'bestaetigt'
WHERE dispo_info IN ('-', 'Übergeben', 'uebergeben') AND outcome IS NULL;

-- Indizes
CREATE INDEX IF NOT EXISTS idx_entries_board_type ON entries(board_type);
CREATE INDEX IF NOT EXISTS idx_entries_outcome    ON entries(outcome);
CREATE INDEX IF NOT EXISTS idx_entries_is_calling ON entries(is_calling);

-- ── 2. USERS: Permissions + Power-User-Rolle ─────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';

-- Rolle erweitern um 'power_user'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'user', 'power_user'));

-- ── 3. KOMMENTARE ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comments (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id   UUID        NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  username   TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  mentions   TEXT[]      NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_entry_id  ON comments(entry_id);
CREATE INDEX IF NOT EXISTS idx_comments_created   ON comments(created_at DESC);

ALTER TABLE comments DISABLE ROW LEVEL SECURITY;

-- ── 4. EINSTELLUNGEN ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- Standard-Einstellungen
INSERT INTO settings (key, value) VALUES
  ('auto_archive_days_bestaetigt', '2'),
  ('last_call_run', '')
ON CONFLICT (key) DO NOTHING;

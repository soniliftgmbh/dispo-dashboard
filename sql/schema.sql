-- ============================================================
-- Anna Weber Dashboard — Datenbankschema
-- Supabase / PostgreSQL
-- Einmalig im Supabase SQL-Editor ausführen
-- ============================================================

-- UUID-Erweiterung (in Supabase standardmäßig aktiv)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── BENUTZER ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  username    TEXT        UNIQUE NOT NULL,
  password_hash TEXT      NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  active      BOOLEAN     NOT NULL DEFAULT true,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── EINTRÄGE (to_schedule + archive in einer Tabelle) ────────
CREATE TABLE IF NOT EXISTS entries (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  praxedo_id          TEXT        UNIQUE NOT NULL,
  kundenname          TEXT,
  telefon             TEXT,
  email               TEXT,
  termin              TIMESTAMPTZ,
  zeitraum            TEXT,
  techniker           TEXT,
  letzter_wahlversuch TIMESTAMPTZ,
  wahlversuche        INTEGER     NOT NULL DEFAULT 0,
  callback_time       TIMESTAMPTZ,
  abbruchgrund        TEXT,
  final               BOOLEAN     NOT NULL DEFAULT false,
  failure_reason      TEXT,
  dispo_info          TEXT,
  ruckrufe            INTEGER     NOT NULL DEFAULT 0,
  auftragstyp         TEXT,
  notiz               TEXT,
  erstellungsdatum    TIMESTAMPTZ DEFAULT NOW(),
  archived            BOOLEAN     NOT NULL DEFAULT false,
  archived_at         TIMESTAMPTZ,
  added_by            TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Index für schnelle Status-Abfragen
CREATE INDEX IF NOT EXISTS idx_entries_archived    ON entries(archived);
CREATE INDEX IF NOT EXISTS idx_entries_dispo_info  ON entries(dispo_info);
CREATE INDEX IF NOT EXISTS idx_entries_praxedo_id  ON entries(praxedo_id);

-- Automatisches updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS entries_updated_at ON entries;
CREATE TRIGGER entries_updated_at
  BEFORE UPDATE ON entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── AKTIVITÄTSLOG ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  username   TEXT        NOT NULL,
  action     TEXT        NOT NULL,
  details    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_created ON activity_log(created_at DESC);

-- ── ERSTER ADMIN-BENUTZER ────────────────────────────────────
-- Passwort: admin123 (bcrypt hash, 10 rounds)
-- SOFORT nach erstem Login ändern!
INSERT INTO users (username, password_hash, role)
VALUES (
  'admin',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHuu',
  'admin'
) ON CONFLICT (username) DO NOTHING;

-- ── RLS DEAKTIVIEREN (internes Tool, Auth über App) ──────────
-- Supabase aktiviert RLS standardmäßig — für interne Tools
-- mit eigener Auth reicht das aus:
ALTER TABLE entries      DISABLE ROW LEVEL SECURITY;
ALTER TABLE users        DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log DISABLE ROW LEVEL SECURITY;

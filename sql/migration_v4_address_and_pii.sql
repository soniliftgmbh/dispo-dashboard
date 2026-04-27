-- ============================================================
-- Migration v4 — Adresse, Anrede + Auto-PII-Strip beim Archivieren
-- Anna Dashboard redesign/v2
-- ============================================================

-- ── Adress- und Anredefelder (für Druckdokumente) ─────────────
ALTER TABLE entries ADD COLUMN IF NOT EXISTS anrede     TEXT;  -- 'Herr' | 'Frau' | 'Divers' | 'Familie' | NULL
ALTER TABLE entries ADD COLUMN IF NOT EXISTS strasse    TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS hausnummer TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS plz        TEXT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS ort        TEXT;

-- ── Auto-Strip aller PII beim Archivieren ─────────────────────
-- Trigger: sobald archived = true gesetzt wird, werden personenbezogene Daten geleert.
-- Reporting-Felder (outcome, abbruchgrund, wahlversuche, board_type, KI-Aggregate, Termin-Datum)
-- bleiben erhalten.

CREATE OR REPLACE FUNCTION strip_pii_on_archive()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.archived = true AND (OLD.archived IS DISTINCT FROM true) THEN
    NEW.kundenname  := NULL;
    NEW.telefon     := NULL;
    NEW.email       := NULL;
    NEW.notiz       := NULL;
    NEW.dispo_info  := NULL;
    NEW.anrede      := NULL;
    NEW.strasse     := NULL;
    NEW.hausnummer  := NULL;
    NEW.plz         := NULL;
    NEW.ort         := NULL;
    -- KI-Felder mit PII löschen, aggregierte/anonyme behalten
    NEW.ki_notiz             := NULL;
    NEW.ki_grund             := NULL;
    NEW.ki_vorname           := NULL;
    NEW.ki_nachname          := NULL;
    NEW.ki_zusammenfassung   := NULL;
    NEW.ki_frage             := NULL;
    NEW.ki_angehoeriger      := NULL;
    -- Behalten (Reporting): outcome, abbruchgrund, failure_reason, wahlversuche,
    -- board_type, auftragstyp, termin (Datum), techniker, ruckrufe,
    -- ki_termin_ergebnis, ki_stimmung, ki_zuverlaessigkeit, ki_gespraechsqualitaet,
    -- ki_naechste_aktion, ki_rueckruf_wunsch, ki_direction, ki_agent,
    -- ki_gespraechsende, ki_erklaerung_wiederholt
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS entries_strip_pii ON entries;
CREATE TRIGGER entries_strip_pii
  BEFORE UPDATE ON entries
  FOR EACH ROW EXECUTE FUNCTION strip_pii_on_archive();

-- Index für Konflikt-Check (gibt es Praxedo-ID schon im Archiv?)
CREATE INDEX IF NOT EXISTS idx_entries_praxedo_archived ON entries(praxedo_id, archived);

-- ── Praxedo-ID darf mehrfach existieren, sofern alte Versionen archiviert sind ──
-- Drop the old global unique constraint and replace with a partial unique
-- that only enforces uniqueness on currently active (non-archived) rows.
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_praxedo_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_praxedo_id
  ON entries(praxedo_id) WHERE archived = false;


-- Migration: Erweiterte Anruf-Logik für Anna Weber
-- Einmalig im Supabase SQL-Editor ausführen

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS tagesversuche          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consecutive_failed_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS erster_anruftag        DATE,
  ADD COLUMN IF NOT EXISTS letzter_anruftag       DATE;

-- entries_ready View: erweitert um 14-Tage-Grenze
CREATE OR REPLACE VIEW entries_ready AS
SELECT * FROM entries
WHERE
  archived      = false
  AND kundenname IS NOT NULL
  AND kundenname != ''
  AND abbruchgrund IS NULL
  AND (dispo_info IS NULL OR dispo_info NOT IN ('-', 'Übergeben', 'uebergeben'))
  AND (
    callback_time IS NULL
    OR callback_time <= NOW()
  )
  AND (
    erster_anruftag IS NULL
    OR erster_anruftag > CURRENT_DATE - INTERVAL '14 days'
  )
ORDER BY
  callback_time ASC NULLS LAST,
  created_at    ASC;

-- ============================================================
-- Anna Dashboard — Migration v3b
-- Anruflogik-Einstellungen in settings-Tabelle
-- Im Supabase SQL-Editor ausführen
-- ============================================================

INSERT INTO settings (key, value) VALUES
  -- Reguläre Anruflogik
  ('regular_max_days',            '14'),  -- Wie viele Tage versucht Anna es insgesamt
  ('regular_max_per_day_early',    '3'),  -- Versuche/Tag an den ersten 3 Tagen
  ('regular_max_per_day_late',     '2'),  -- Versuche/Tag ab Tag 4
  ('regular_interval_first_min',  '90'),  -- Pause nach Versuch 1 am 1. Tag (Minuten)
  ('regular_interval_second_min', '120'), -- Pause ab Versuch 2 am 1. Tag (Minuten)
  ('regular_interval_late_min',   '300'), -- Pause zwischen Versuchen ab Tag 2 (Minuten)
  -- Erkrankt-Anruflogik
  ('erkrankt_max_days',            '2'),  -- Wie viele Tage versucht Anna es insgesamt
  ('erkrankt_max_day1',            '8'),  -- Versuche an Tag 1
  ('erkrankt_max_day2',            '4'),  -- Versuche an Tag 2
  ('erkrankt_interval_min_min',   '45'),  -- Kürzeste Pause zwischen Versuchen (Minuten)
  ('erkrankt_interval_max_min',   '60')   -- Längste Pause zwischen Versuchen (Minuten)
ON CONFLICT (key) DO NOTHING;

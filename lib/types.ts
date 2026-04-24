export type Role   = 'admin' | 'user';
export type Status = 'neu' | 'bereit' | 'in_kontakt' | 'ruckruf' | 'uebergeben' | 'erkrankt' | 'final';

export interface Entry {
  id:                   string;
  praxedo_id:           string;
  kundenname:           string | null;
  telefon:              string | null;
  email:                string | null;
  termin:               string | null;
  zeitraum:             string | null;
  techniker:            string | null;
  letzter_wahlversuch:  string | null;
  wahlversuche:         number;
  callback_time:        string | null;
  abbruchgrund:         string | null;
  final:                boolean;
  failure_reason:       string | null;
  dispo_info:           string | null;
  ruckrufe:             number;
  auftragstyp:          string | null;
  erkrankt:             boolean;
  notiz:                string | null;
  ki_notiz:                  string | null;
  ki_grund:                  string | null;
  ki_vorname:                string | null;
  ki_nachname:               string | null;
  ki_direction:              string | null;
  ki_agent:                  string | null;
  ki_termin_ergebnis:        string | null;
  ki_rueckruf_wunsch:        string | null;
  ki_naechste_aktion:        string | null;
  ki_stimmung:               string | null;
  ki_angehoeriger:           string | null;
  ki_zuverlaessigkeit:       string | null;
  ki_gespraechsqualitaet:    string | null;
  ki_gespraechsende:         string | null;
  ki_frage:                  string | null;
  ki_erklaerung_wiederholt:  string | null;
  ki_zusammenfassung:        string | null;
  erstellungsdatum:     string | null;
  archived:             boolean;
  created_at:           string;
  updated_at:           string;
  status?:              Status;
}

export interface User {
  id:         string;
  username:   string;
  role:       Role;
  active:     boolean;
  last_login: string | null;
  created_at: string;
}

export interface ActivityLog {
  id:         string;
  username:   string;
  action:     string;
  details:    string | null;
  created_at: string;
}

export interface Stats {
  total:       number;
  neu:         number;
  bereit:      number;
  in_kontakt:  number;
  ruckruf:     number;
  uebergeben:  number;
  heute:       number;
}

export function isErkrankt(e: Entry): boolean {
  return e.erkrankt === true;
}

// Status-Ableitung — Single Source of Truth
export function deriveStatus(e: Entry): Status {
  if (e.final) return 'final';
  // Erkrankt-Einträge bekommen immer ihren eigenen Status — unabhängig von allem anderen
  if (isErkrankt(e)) return 'erkrankt';
  const dispo = (e.dispo_info ?? '').trim().toLowerCase();
  if (dispo === '-' || dispo === 'übergeben' || dispo === 'uebergeben') return 'uebergeben';
  if (e.callback_time) return 'ruckruf';
  if (!e.kundenname) return 'neu';
  if (e.wahlversuche === 0) return 'bereit';
  return 'in_kontakt';
}

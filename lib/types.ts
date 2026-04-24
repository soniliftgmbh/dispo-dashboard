export type Role      = 'admin' | 'user' | 'power_user';
export type Status    = 'ausstehend' | 'aktiv' | 'nacharbeiten' | 'abgebrochen' | 'bestaetigt' | 'final';
export type BoardType = 'neuinstallation' | 'reklamation' | 'wartung';

// Berechtigungen
export type Permission =
  | 'board:neuinstallation'
  | 'board:reklamation'
  | 'board:wartung'
  | 'view:logs'
  | 'view:archive'
  | 'view:stats';

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
  // Outcome-Status (gesetzt durch post_call Webhook)
  outcome:              'bestaetigt' | 'nacharbeiten' | 'abgebrochen' | null;
  nacharbeiten_abschluss: string | null;
  // Board
  board_type:           BoardType | null;
  // Aktiv-Erkennung
  is_calling:           boolean;
  // Ungelesen-Marker
  unread_by:            string[];
  // KI-Analyse
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
  // Abgeleiteter Status (client-seitig)
  status?:              Status;
}

export interface User {
  id:          string;
  username:    string;
  role:        Role;
  active:      boolean;
  last_login:  string | null;
  created_at:  string;
  permissions: string[];
}

export interface ActivityLog {
  id:         string;
  username:   string;
  action:     string;
  details:    string | null;
  created_at: string;
}

export interface Comment {
  id:         string;
  entry_id:   string;
  username:   string;
  body:       string;
  mentions:   string[];
  created_at: string;
}

export interface Stats {
  total:       number;
  ausstehend:  number;
  aktiv:       number;
  nacharbeiten: number;
  bestaetigt:  number;
  heute:       number;
}

export interface StatsOverview {
  total:                number;
  bestaetigt:           number;
  nacharbeiten:         number;
  ausstehend:           number;
  success_rate:         number;  // bestaetigt / total
  first_attempt_rate:   number;  // bestätigt beim 1. Versuch / bestaetigt gesamt
  avg_attempts:         number;  // Ø Versuche bis Bestätigung
  rejection_reasons:    { reason: string; count: number }[];
  by_board:             { board: string; total: number; bestaetigt: number }[];
}

// ── Board-Ableitung aus Praxedo-ID ─────────────────────────────
export function deriveBoard(praxedoId: string): BoardType {
  const prefix = praxedoId.split('-')[0].toUpperCase();
  if (prefix === 'NEUINSTALLATION') return 'neuinstallation';
  if (['NOTDIENST', 'STOERUNG', 'DEMONTAGE'].includes(prefix)) return 'reklamation';
  return 'wartung';
}

// ── Auftragstyp aus Praxedo-ID ─────────────────────────────────
export function auftragsTypFromId(praxedoId: string): string {
  const map: Record<string, string> = {
    NEUINSTALLATION: 'Neuinstallation',
    NOTDIENST:       'Notdienst',
    STOERUNG:        'Störung',
    DEMONTAGE:       'Demontage',
    WARTUNG:         'Wartung',
  };
  const prefix = praxedoId.split('-')[0].toUpperCase();
  return map[prefix] ?? prefix;
}

// ── Status-Ableitung — Single Source of Truth ──────────────────
export function deriveStatus(e: Entry): Status {
  if (e.final)                        return 'final';
  if (e.is_calling)                   return 'aktiv';
  if (e.outcome === 'bestaetigt')     return 'bestaetigt';
  if (e.outcome === 'nacharbeiten')   return 'nacharbeiten';
  if (e.outcome === 'abgebrochen')    return 'abgebrochen';
  return 'ausstehend';
}

// ── Board-Label ────────────────────────────────────────────────
export function boardLabel(b: BoardType): string {
  const map: Record<BoardType, string> = {
    neuinstallation: 'Neuinstallation',
    reklamation:     'Reklamation',
    wartung:         'Wartung',
  };
  return map[b];
}

// ── Berechtigungen prüfen ──────────────────────────────────────
export function hasPermission(role: Role, permissions: string[], perm: Permission): boolean {
  if (role === 'admin') return true;
  return permissions.includes(perm);
}

export function allowedBoards(role: Role, permissions: string[]): BoardType[] {
  if (role === 'admin') return ['neuinstallation', 'reklamation', 'wartung'];
  return (['neuinstallation', 'reklamation', 'wartung'] as BoardType[]).filter(
    b => permissions.includes(`board:${b}`)
  );
}

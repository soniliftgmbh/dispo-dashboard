'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Entry, Stats, ActivityLog, User, Comment, StatsOverview,
  Status, BoardType, Role,
  deriveStatus, boardLabel, allowedBoards,
} from '@/lib/types';
import { Wordmark } from '@/lib/ui/Wordmark';
import { ThemeToggle } from '@/lib/ui/ThemeToggle';
import { StatusPill, StatusDot } from '@/lib/ui/StatusPill';
import { ToastContainer, ToastMsg, ToastType } from '@/lib/ui/Toast';
import { Modal, ModalHeader } from '@/lib/ui/Modal';
import { SlidePanel, SlidePanelHeader, SlidePanelFooter } from '@/lib/ui/SlidePanel';
import { Toggle } from '@/lib/ui/Toggle';
import { Checkbox } from '@/lib/ui/Checkbox';
import { boardColorRgb, boardColorSoftRgb } from '@/lib/types';

// ── Cancellation reasons (Abbruchgrund-Picker) ──────────────────
const ABBRUCHGRUENDE = [
  'Kunde nicht erreichbar',
  'Kunde verstorben',
  'Kunde umgezogen',
  'Kein Interesse mehr',
  'Termin bereits vereinbart (extern)',
  'Falsche Telefonnummer',
  'Demontage gewünscht',
  'Sonstiges',
];

// ── Sort options ────────────────────────────────────────────────
type SortKey =
  | 'default'
  | 'termin_asc' | 'termin_desc'
  | 'wahl_asc'   | 'wahl_desc'
  | 'lk_desc'    | 'lk_asc'
  | 'name_asc'   | 'name_desc';

const SORT_LABELS: Record<SortKey, string> = {
  default:    'Standard',
  termin_asc: 'Termin (älteste zuerst)',
  termin_desc:'Termin (neueste zuerst)',
  wahl_asc:   'Wahlversuche (wenig)',
  wahl_desc:  'Wahlversuche (viel)',
  lk_desc:    'Letzter Kontakt (neueste)',
  lk_asc:     'Letzter Kontakt (älteste)',
  name_asc:   'Kundenname A→Z',
  name_desc:  'Kundenname Z→A',
};

function applySort(arr: Entry[], key: SortKey): Entry[] {
  if (key === 'default') return arr;
  const c = [...arr];
  const cmpDate = (a: string | null, b: string | null, dir: 1 | -1) => {
    const av = a ? new Date(a).getTime() : 0;
    const bv = b ? new Date(b).getTime() : 0;
    return (av - bv) * dir;
  };
  switch (key) {
    case 'termin_asc':  return c.sort((a, b) => cmpDate(a.termin, b.termin, 1));
    case 'termin_desc': return c.sort((a, b) => cmpDate(a.termin, b.termin, -1));
    case 'wahl_asc':    return c.sort((a, b) => a.wahlversuche - b.wahlversuche);
    case 'wahl_desc':   return c.sort((a, b) => b.wahlversuche - a.wahlversuche);
    case 'lk_desc':     return c.sort((a, b) => cmpDate(a.letzter_wahlversuch, b.letzter_wahlversuch, -1));
    case 'lk_asc':      return c.sort((a, b) => cmpDate(a.letzter_wahlversuch, b.letzter_wahlversuch, 1));
    case 'name_asc':    return c.sort((a, b) => (a.kundenname ?? '').localeCompare(b.kundenname ?? ''));
    case 'name_desc':   return c.sort((a, b) => (b.kundenname ?? '').localeCompare(a.kundenname ?? ''));
  }
}

// ── Status → board-aware bar color helper ──────────────────────
function StatusBarBoard({ board, className = '' }: { board: BoardType; className?: string }) {
  return (
    <span
      className={`block w-full ${className}`}
      style={{ backgroundColor: boardColorRgb(board), height: 3, borderRadius: 2 }}
      aria-hidden
    />
  );
}

// ── HELPERS ──────────────────────────────────────────────────
function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDT(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function toInputDT(s: string | null) {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16);
}
function timeSince(s: string): string {
  const diff = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
  if (diff < 1)  return 'gerade eben';
  if (diff < 60) return `vor ${diff} Min.`;
  return `vor ${Math.floor(diff / 60)} Std.`;
}
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── COLUMN CONFIG ─────────────────────────────────────────────
// Each status drives its own color (board-übergreifend identisch).
const COL_CONFIG: { id: Status; label: string; statusVar: string }[] = [
  { id: 'ausstehend',   label: 'Ausstehend',   statusVar: 'pending' },
  { id: 'aktiv',        label: 'Aktiv',        statusVar: 'active' },
  { id: 'nacharbeiten', label: 'Nacharbeiten', statusVar: 'rework' },
  { id: 'abgebrochen',  label: 'Abgebrochen',  statusVar: 'cancelled' },
  { id: 'bestaetigt',   label: 'Bestätigt',    statusVar: 'confirmed' },
];

// ── KANBAN CARD ───────────────────────────────────────────────
function KanbanCard({
  entry, board, username, selected, onSelect, onClick,
}: {
  entry: Entry; board: BoardType; username: string;
  selected: boolean; onSelect: (e: React.MouseEvent) => void; onClick: () => void;
}) {
  const isUnread   = (entry.unread_by ?? []).includes(username);
  const isErkrankt = entry.erkrankt;
  const status     = entry.status ?? 'ausstehend';

  return (
    <div
      onClick={onClick}
      className={`card card-hover group relative cursor-pointer p-3 pl-9 pr-3.5 transition-all
        ${selected ? '!border-primary' : ''}`}
      style={selected ? { boxShadow: '0 0 0 2px rgb(var(--primary-base) / 0.30), 0 4px 10px rgb(0 0 0 / 0.06)' } : undefined}
    >
      {/* Bulk-select checkbox — top-left, always visible */}
      <div className="absolute top-2.5 left-2.5 z-10">
        <Checkbox
          checked={selected}
          onChange={() => {
            const fakeEv = { stopPropagation: () => {} } as React.MouseEvent;
            onSelect(fakeEv);
          }}
          ariaLabel={selected ? 'Auswahl entfernen' : 'Auswählen'}
          stopProp
        />
      </div>

      {/* Top row: subtype/badge + status pill */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          {board === 'reklamation' && entry.auftragstyp && (
            <div className="text-[10px] font-medium uppercase tracking-wider text-ink-faint mb-0.5">
              {entry.auftragstyp}
            </div>
          )}
          <div className="text-sm font-medium text-ink truncate leading-snug">
            {entry.kundenname || <span className="italic text-ink-faint font-normal">Wird angereichert …</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isUnread && (
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'rgb(var(--primary-base))' }}
              aria-label="Ungelesen"
            />
          )}
          <StatusPill status={status} />
        </div>
      </div>

      {/* Erkrankt chip */}
      {isErkrankt && (
        <span
          className="inline-flex items-center gap-1 mt-0.5 mb-1 px-1.5 py-0.5 text-[10px] font-medium rounded-sm"
          style={{
            color: 'rgb(var(--status-cancelled))',
            backgroundColor: 'rgb(var(--status-cancelled) / 0.10)',
          }}
        >
          <span className="material-icons-round" style={{ fontSize: 11 }}>sick</span>
          Erkrankt
        </span>
      )}

      {/* Meta lines */}
      <div className="mt-2 space-y-1">
        {entry.termin && (
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="material-icons-round text-ink-faint" style={{ fontSize: 13 }}>event</span>
            <time className="tabular-nums">{fmtDate(entry.termin)}</time>
          </div>
        )}
        {entry.zeitraum && (
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="material-icons-round text-ink-faint" style={{ fontSize: 13 }}>access_time</span>
            <span className="tabular-nums">{entry.zeitraum}</span>
          </div>
        )}
        {entry.techniker && (
          <div className="flex items-center gap-1.5 text-xs text-ink-muted truncate">
            <span className="material-icons-round text-ink-faint" style={{ fontSize: 13 }}>engineering</span>
            <span className="truncate">{entry.techniker}</span>
          </div>
        )}
      </div>

      {entry.wahlversuche > 0 && (
        <div
          className="mt-2 text-xs font-medium tabular-nums"
          style={entry.wahlversuche >= 4
            ? { color: 'rgb(var(--status-cancelled))' }
            : undefined}
        >
          <span className={entry.wahlversuche >= 4 ? '' : 'text-ink-faint'}>
            {entry.wahlversuche} {entry.wahlversuche === 1 ? 'Versuch' : 'Versuche'}
          </span>
        </div>
      )}

      {entry.notiz && (
        <div
          className="mt-2 px-2 py-1.5 rounded-sm text-xs"
          style={{
            backgroundColor: 'rgb(var(--status-rework) / 0.10)',
            color: 'rgb(var(--status-rework))',
          }}
        >
          {entry.notiz.substring(0, 70)}{entry.notiz.length > 70 ? '…' : ''}
        </div>
      )}

      {entry.status === 'nacharbeiten' && entry.nacharbeiten_abschluss && (
        <div
          className="mt-2 flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-medium"
          style={{
            backgroundColor: 'rgb(var(--status-rework) / 0.10)',
            color: 'rgb(var(--status-rework))',
          }}
        >
          <span className="material-icons-round" style={{ fontSize: 12 }}>assignment_late</span>
          {entry.nacharbeiten_abschluss}
        </div>
      )}

      {entry.failure_reason && entry.status === 'ausstehend' && (
        <div className="mt-2 flex items-center gap-1 px-2 py-1 rounded-sm bg-bg-sunken text-xs text-ink-faint">
          <span className="material-icons-round" style={{ fontSize: 12 }}>phone_missed</span>
          <span className="truncate">{entry.failure_reason}</span>
        </div>
      )}
    </div>
  );
}

// ── BOARD TILE ────────────────────────────────────────────────
function BoardTile({
  board, count, onClick,
}: {
  board: BoardType; count: number; onClick: () => void;
}) {
  const cfg: Record<BoardType, { icon: string; desc: string }> = {
    neuinstallation: { icon: 'install_desktop', desc: 'Neue Treppenlifte und Erstinstallationen' },
    reklamation:     { icon: 'build_circle',    desc: 'Störungen, Notdienst, Demontagen' },
    wartung:         { icon: 'handyman',        desc: 'Regelmäßige Wartungsaufträge' },
  };
  const c = cfg[board];
  return (
    <button
      onClick={onClick}
      className="card card-hover group p-6 text-left flex flex-col gap-4 min-h-[180px] transition-all relative overflow-hidden"
    >
      {/* Top color bar in board-identity color */}
      <span
        aria-hidden
        className="absolute top-0 left-0 right-0"
        style={{ height: 3, backgroundColor: boardColorRgb(board) }}
      />
      <div className="flex items-center justify-between">
        <span
          className="material-icons-round transition-colors"
          style={{ fontSize: 28, color: boardColorRgb(board) }}
        >
          {c.icon}
        </span>
        {count > 0 && (
          <span
            className="pill tabular-nums"
            style={{ backgroundColor: boardColorSoftRgb(board), color: boardColorRgb(board) }}
          >
            {count} offen
          </span>
        )}
      </div>
      <div className="mt-auto">
        <div className="text-base font-semibold text-ink">{boardLabel(board)}</div>
        <div className="text-sm text-ink-muted mt-0.5">{c.desc}</div>
      </div>
    </button>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();

  // State
  const [selectedBoard, setSelectedBoard]     = useState<BoardType | null>(null);
  const [view, setView]                       = useState<'kanban'|'archive'|'log'|'admin'|'stats'>('kanban');
  const [entries, setEntries]                 = useState<Entry[]>([]);
  const [archive, setArchive]                 = useState<Entry[]>([]);
  const [stats, setStats]                     = useState<Stats | null>(null);
  const [boardCounts, setBoardCounts]         = useState<Record<BoardType, number>>({ neuinstallation: 0, reklamation: 0, wartung: 0 });
  const [logs, setLogs]                       = useState<ActivityLog[]>([]);
  const [users, setUsers]                     = useState<User[]>([]);
  const [overview, setOverview]               = useState<StatsOverview | null>(null);
  const [search, setSearch]                   = useState('');
  const [filterTechniker, setFilterTechniker] = useState('');
  const [filterSubtype, setFilterSubtype]     = useState('');
  const [filterStatus, setFilterStatus]       = useState<Status | ''>('');
  const [toasts, setToasts]                   = useState<ToastMsg[]>([]);
  const [toastId, setToastId]                 = useState(0);
  const [lastRefresh, setLR]                  = useState('');
  const [lastCallRun, setLastCallRun]         = useState('');
  const [username, setUsername]               = useState('');
  const [role, setRole]                       = useState<Role>('user');
  const [permissions, setPermissions]         = useState<string[]>([]);
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set());
  const refreshRef                            = useRef<ReturnType<typeof setInterval>>();

  // Detail Modal (slide panel)
  const [detailEntry,         setDetailEntry]         = useState<Entry | null>(null);
  const [detailNotiz,         setDetailNotiz]         = useState('');
  const [detailCb,            setDetailCb]            = useState('');
  const [detailTelefon,       setDetailTelefon]       = useState('');
  const [detailAnrede,        setDetailAnrede]        = useState('');
  const [detailKundenname,    setDetailKundenname]    = useState('');
  const [detailEmail,         setDetailEmail]         = useState('');
  const [detailStrasse,       setDetailStrasse]       = useState('');
  const [detailHausnummer,    setDetailHausnummer]    = useState('');
  const [detailPlz,           setDetailPlz]           = useState('');
  const [detailOrt,           setDetailOrt]           = useState('');
  const [detailComments,      setDetailComments]      = useState<Comment[]>([]);
  const [newComment,          setNewComment]          = useState('');
  const [nacharbeitenAbschl,  setNacharbeitenAbschl]  = useState('');

  // Inline pickers
  const [showCancelPicker,    setShowCancelPicker]    = useState(false);
  const [cancelGrund,         setCancelGrund]         = useState('');
  const [showHardDelete,      setShowHardDelete]      = useState(false);
  const [showArchivedConflict,setShowArchivedConflict]= useState(false);
  const [conflictPraxedoId,   setConflictPraxedoId]   = useState('');

  // Sort
  const [sortKey, setSortKey]               = useState<SortKey>('default');
  const [sortMenuOpen, setSortMenuOpen]     = useState(false);

  // Archive filters
  const [archiveSearch,        setArchiveSearch]        = useState('');
  const [archiveFilterTyp,     setArchiveFilterTyp]     = useState('');
  const [archiveFilterBoard,   setArchiveFilterBoard]   = useState<BoardType | ''>('');
  const [archiveFilterOutcome, setArchiveFilterOutcome] = useState('');

  // New Entry Modal
  const [showNew,      setShowNew]      = useState(false);
  const [showBulk,     setShowBulk]     = useState(false);
  const [newId,        setNewId]        = useState('');
  const [newErkrankt,  setNewErkrankt]  = useState(false);
  const [newLoading,   setNewLoading]   = useState(false);
  const [bulkRaw,      setBulkRaw]      = useState('');
  const [bulkErkrankt, setBulkErkrankt] = useState(false);
  const [bulkLoading,  setBulkLoading]  = useState(false);
  const [bulkResult,   setBulkResult]   = useState<null | { summary: { total: number; imported: number; failed: number }; results: { id: string; ok: boolean; error?: string }[] }>(null);

  // Admin form
  const [newUser, setNewUser]         = useState({ username: '', password: '', role: 'user', permissions: [] as string[] });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [settings, setSettings]       = useState<Record<string, string>>({
    auto_archive_days_bestaetigt: '2',
    regular_max_days:             '14',
    regular_max_per_day_early:    '3',
    regular_max_per_day_late:     '2',
    regular_interval_first_min:   '90',
    regular_interval_second_min:  '120',
    regular_interval_late_min:    '300',
    erkrankt_max_days:            '2',
    erkrankt_max_day1:            '8',
    erkrankt_max_day2:            '4',
    erkrankt_interval_min_min:    '45',
    erkrankt_interval_max_min:    '60',
  });

  // ── TOAST ────────────────────────────────────────────────────
  const toast = useCallback((msg: string, type: ToastType = 'info') => {
    const id = toastId + 1; setToastId(id);
    setToasts(t => [...t, { id, msg, type }]);
  }, [toastId]);
  const dismissToast = useCallback((id: number) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  // ── API ──────────────────────────────────────────────────────
  async function api<T>(url: string, opts?: RequestInit): Promise<T> {
    const res  = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) router.push('/login');
      throw new Error(data.error ?? 'Fehler');
    }
    return data;
  }

  // ── LOAD ENTRIES ─────────────────────────────────────────────
  const loadEntries = useCallback(async (board?: BoardType | null) => {
    const b = board ?? selectedBoard;
    try {
      const url  = b ? `/api/entries?board=${b}` : '/api/entries';
      const data = await api<{ entries: Entry[] }>(url);
      setEntries(data.entries.map(e => ({ ...e, status: deriveStatus(e) })));
      setLR(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }, [selectedBoard]); // eslint-disable-line

  const loadStats = useCallback(async (board?: BoardType | null) => {
    const b = board ?? selectedBoard;
    try {
      const url  = b ? `/api/stats?board=${b}` : '/api/stats';
      const data = await api<{ stats: Stats }>(url);
      setStats(data.stats);
    } catch { /* silent */ }
  }, [selectedBoard]); // eslint-disable-line

  const loadBoardCounts = useCallback(async () => {
    try {
      const [n, r, w] = await Promise.all([
        api<{ stats: Stats }>('/api/stats?board=neuinstallation'),
        api<{ stats: Stats }>('/api/stats?board=reklamation'),
        api<{ stats: Stats }>('/api/stats?board=wartung'),
      ]);
      setBoardCounts({
        neuinstallation: Number(n.stats.ausstehend) + Number(n.stats.aktiv) + Number(n.stats.nacharbeiten),
        reklamation:     Number(r.stats.ausstehend) + Number(r.stats.aktiv) + Number(r.stats.nacharbeiten),
        wartung:         Number(w.stats.ausstehend) + Number(w.stats.aktiv) + Number(w.stats.nacharbeiten),
      });
    } catch { /* silent */ }
  }, []); // eslint-disable-line

  const loadLastCallRun = useCallback(async () => {
    try {
      const data = await api<{ setting: { value: string } | null }>('/api/settings?key=last_call_run');
      if (data.setting?.value) setLastCallRun(data.setting.value);
    } catch { /* silent */ }
  }, []); // eslint-disable-line

  // ── INIT ─────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('session_info');
    if (stored) {
      try {
        const info = JSON.parse(stored);
        setUsername(info.username ?? '');
        setRole(info.role ?? 'user');
        setPermissions(info.permissions ?? []);
      } catch { /* ignore */ }
    }

    loadBoardCounts();
    loadLastCallRun();
    refreshRef.current = setInterval(() => {
      loadBoardCounts();
      loadLastCallRun();
      if (selectedBoard) { loadEntries(); loadStats(); }
    }, 3000);
    return () => clearInterval(refreshRef.current);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (selectedBoard) {
      loadEntries(selectedBoard);
      loadStats(selectedBoard);
      setSelectedIds(new Set());
    }
  }, [selectedBoard]); // eslint-disable-line

  // ── BOARD AUSWAHL ─────────────────────────────────────────────
  function selectBoard(b: BoardType) {
    setSelectedBoard(b);
    setView('kanban');
    setSearch('');
    setFilterTechniker('');
    setFilterSubtype('');
  }

  function backToBoards() {
    setSelectedBoard(null);
    loadBoardCounts();
  }

  // ── NEW ENTRY ────────────────────────────────────────────────
  async function submitNew() {
    if (!newId.trim()) { toast('Bitte eine Praxedo ID eingeben.', 'error'); return; }
    setNewLoading(true);
    const trimmed = newId.trim();
    try {
      const res = await fetch('/api/entries', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ praxedoId: trimmed, erkrankt: newErkrankt, board: selectedBoard }),
      });
      const data = await res.json();
      if (res.status === 409 && data.error === 'archived_exists') {
        setConflictPraxedoId(trimmed);
        setShowArchivedConflict(true);
        setShowNew(false);
        return;
      }
      if (!res.ok) {
        if (res.status === 401) router.push('/login');
        toast(data.message ?? data.error ?? 'Fehler', 'error');
        return;
      }
      toast(`ID ${trimmed} eingetragen.`, 'success');
      setShowNew(false); setNewId(''); setNewErkrankt(false);
      loadEntries(); loadStats();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
    finally { setNewLoading(false); }
  }

  async function recreateFromArchive() {
    try {
      await api('/api/entries/recreate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ praxedoId: conflictPraxedoId, erkrankt: newErkrankt }),
      });
      toast(`ID ${conflictPraxedoId} neu angelegt.`, 'success');
      setShowArchivedConflict(false);
      setNewId(''); setNewErkrankt(false); setConflictPraxedoId('');
      loadEntries(); loadStats();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  async function submitBulk() {
    if (!bulkRaw.trim()) { toast('Keine IDs eingegeben.', 'error'); return; }
    setBulkLoading(true);
    try {
      const data = await api<{ results: { id: string; ok: boolean; error?: string }[]; summary: { total: number; imported: number; failed: number } }>(
        '/api/entries/bulk',
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: bulkRaw, board: selectedBoard, erkrankt: bulkErkrankt }) }
      );
      setBulkResult(data);
      loadEntries(); loadStats();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
    finally { setBulkLoading(false); }
  }

  // ── DETAIL ────────────────────────────────────────────────────
  async function openDetail(e: Entry) {
    setDetailEntry(e); setDetailNotiz(e.notiz ?? '');
    setDetailCb(toInputDT(e.callback_time)); setDetailTelefon(e.telefon ?? '');
    setDetailAnrede(e.anrede ?? '');
    setDetailKundenname(e.kundenname ?? '');
    setDetailEmail(e.email ?? '');
    setDetailStrasse(e.strasse ?? '');
    setDetailHausnummer(e.hausnummer ?? '');
    setDetailPlz(e.plz ?? '');
    setDetailOrt(e.ort ?? '');
    setNacharbeitenAbschl(''); setNewComment('');
    setShowCancelPicker(false); setShowHardDelete(false); setCancelGrund('');
    if ((e.unread_by ?? []).includes(username)) {
      api(`/api/entries/${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_read' }) }).catch(() => {});
    }
    try {
      const data = await api<{ comments: Comment[] }>(`/api/comments?entry_id=${e.id}`);
      setDetailComments(data.comments);
    } catch { setDetailComments([]); }
  }

  async function saveDetail() {
    if (!detailEntry) return;
    try {
      await api(`/api/entries/${detailEntry.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          notiz: detailNotiz,
          callbackTime: detailCb || null,
          telefon: detailTelefon,
          anrede: detailAnrede || null,
          kundenname: detailKundenname || null,
          email: detailEmail || null,
          strasse: detailStrasse || null,
          hausnummer: detailHausnummer || null,
          plz: detailPlz || null,
          ort: detailOrt || null,
        }),
      });
      toast('Gespeichert.', 'success');
      setDetailEntry(null); loadEntries();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  async function callNextRun() {
    if (!detailEntry) return;
    try {
      await api(`/api/entries/${detailEntry.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'call_next_run' }),
      });
      toast('Wird im nächsten Lauf angerufen.', 'success');
      setDetailEntry(null); loadEntries();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  async function nacharbeitenAbschliessen() {
    if (!detailEntry || !nacharbeitenAbschl) { toast('Bitte Abschlussgrund wählen.', 'error'); return; }
    try {
      await api(`/api/entries/${detailEntry.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'nacharbeiten_abschluss', abschluss: nacharbeitenAbschl }),
      });
      toast('Nacharbeit abgeschlossen.', 'success');
      setDetailEntry(null); loadEntries(); loadStats();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  function cancelEntry() {
    if (!detailEntry) return;
    setCancelGrund('');
    setShowCancelPicker(true);
  }

  async function confirmCancelWithReason() {
    if (!detailEntry) return;
    if (!cancelGrund) { toast('Bitte einen Grund auswählen.', 'error'); return; }
    try {
      await api(`/api/entries/${detailEntry.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', abbruchgrund: cancelGrund }),
      });
      toast('Kontakt abgebrochen.', 'info');
      setShowCancelPicker(false);
      setDetailEntry(null); loadEntries(); loadStats();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  async function hardDeleteEntry(id: string) {
    try {
      await api(`/api/entries/${id}/hard-delete`, { method: 'DELETE' });
      toast('Eintrag unwiderruflich gelöscht.', 'success');
      setShowHardDelete(false);
      setDetailEntry(null);
      loadEntries(); loadStats();
      // Aus Archiv-Liste entfernen
      setArchive(arr => arr.filter(x => x.id !== id));
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  function openPrint() {
    if (!detailEntry) return;
    window.open(`/print/${detailEntry.id}`, '_blank');
  }

  async function archiveEntry() {
    if (!detailEntry || !confirm(`"${detailEntry.kundenname || detailEntry.praxedo_id}" archivieren?`)) return;
    try {
      await api(`/api/entries/${detailEntry.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      });
      toast('Archiviert.', 'info');
      setDetailEntry(null); loadEntries(); loadStats();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  async function addComment() {
    if (!detailEntry || !newComment.trim()) return;
    try {
      const data = await api<{ comment: Comment }>('/api/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: detailEntry.id, body: newComment.trim() }),
      });
      setDetailComments(c => [...c, data.comment]);
      setNewComment('');
      if (data.comment.mentions.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`${username} hat dich erwähnt`, {
          body: newComment.substring(0, 100),
          icon: '/favicon.ico',
        });
      }
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  async function bulkArchive() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length} Kontakte archivieren?`)) return;
    try {
      await api(`/api/entries/${ids[0]}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_archive', ids }),
      });
      toast(`${ids.length} Einträge archiviert.`, 'success');
      setSelectedIds(new Set());
      loadEntries(); loadStats();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  function switchView(v: typeof view) {
    setView(v);
    if (v === 'archive' && archive.length === 0) {
      api<{ entries: Entry[] }>(selectedBoard ? `/api/archive?board=${selectedBoard}` : '/api/archive')
        .then(d => setArchive(d.entries)).catch(() => {});
    }
    if (v === 'log')    api<{ logs: ActivityLog[] }>('/api/logs').then(d => setLogs(d.logs)).catch(() => {});
    if (v === 'admin')  loadUsers();
    if (v === 'stats')  api<{ overview: StatsOverview }>('/api/stats/overview').then(d => setOverview(d.overview)).catch(() => {});
  }

  async function loadUsers() {
    try { const d = await api<{ users: User[] }>('/api/admin/users'); setUsers(d.users); }
    catch { /* nicht admin */ }
    try {
      const d = await api<{ settings: { key: string; value: string }[] }>('/api/settings');
      const map: Record<string, string> = {};
      for (const s of d.settings) map[s.key] = s.value;
      setSettings(prev => ({ ...prev, ...map }));
    } catch { /* silent */ }
  }

  async function createUser() {
    if (!newUser.username || !newUser.password) { toast('Felder ausfüllen.', 'error'); return; }
    try {
      await api('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser) });
      toast(`Benutzer ${newUser.username} angelegt.`, 'success');
      setNewUser({ username: '', password: '', role: 'user', permissions: [] }); loadUsers();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  async function updateUser(u: User, patch: Partial<User & { newPassword?: string }>) {
    try {
      await api('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, ...patch }) });
      toast('Gespeichert.', 'success'); loadUsers();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  async function resetPw(u: User) {
    const pw = prompt(`Neues Passwort für "${u.username}":`);
    if (!pw) return;
    updateUser(u, { newPassword: pw });
  }

  async function saveSettings() {
    try {
      await Promise.all(
        Object.entries(settings).map(([key, value]) =>
          api('/api/settings', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value }),
          })
        )
      );
      toast('Einstellungen gespeichert.', 'success');
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('session_info');
    router.push('/login');
  }

  // ── FILTER + SORT ────────────────────────────────────────────
  const filtered = applySort(
    entries.filter(e => {
      if (e.status === 'final') return false;
      if (search && ![ e.praxedo_id, e.kundenname, e.telefon, e.techniker ].some(v => v?.toLowerCase().includes(search.toLowerCase()))) return false;
      if (filterTechniker && e.techniker !== filterTechniker) return false;
      if (filterSubtype && selectedBoard === 'reklamation' && e.auftragstyp !== filterSubtype) return false;
      if (filterStatus && e.status !== filterStatus) return false;
      return true;
    }),
    sortKey
  );

  // Persist sort per board
  useEffect(() => {
    if (!selectedBoard) return;
    const saved = localStorage.getItem(`sort_${selectedBoard}`) as SortKey | null;
    setSortKey(saved && saved in SORT_LABELS ? saved : 'default');
  }, [selectedBoard]);
  useEffect(() => {
    if (!selectedBoard) return;
    localStorage.setItem(`sort_${selectedBoard}`, sortKey);
  }, [sortKey, selectedBoard]);

  const technikerList = Array.from(new Set(entries.map(e => e.techniker).filter((v): v is string => !!v)));
  const subtypeList   = Array.from(new Set(entries.map(e => e.auftragstyp).filter((v): v is string => !!v)));

  const allowed = allowedBoards(role, permissions);
  const canLogs    = role === 'admin' || permissions.includes('view:logs');
  const canArchive = role === 'admin' || permissions.includes('view:archive');
  const canStats   = role === 'admin' || permissions.includes('view:stats');
  const navCount   = entries.filter(e => e.status !== 'final' && e.status !== 'bestaetigt').length;

  // ── NAV ITEM ──────────────────────────────────────────────────
  function NavItem({ id, icon, label, badge }: { id: typeof view; icon: string; label: string; badge?: number }) {
    const active = view === id;
    return (
      <button
        onClick={() => switchView(id)}
        className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors duration-120
          ${active
            ? 'bg-bg-elevated text-ink shadow-sm border border-line'
            : 'text-ink-muted hover:bg-bg-sunken hover:text-ink border border-transparent'}`}
      >
        <span className="material-icons-round" style={{ fontSize: 17 }}>{icon}</span>
        {label}
        {badge !== undefined && (
          <span className="ml-auto pill bg-bg-sunken text-ink-muted tabular-nums !px-1.5 !py-0">
            {badge}
          </span>
        )}
      </button>
    );
  }

  // ── BOARD SWITCHER (segmented control in top bar) ────────────
  function BoardSwitcher() {
    if (!selectedBoard) return null;
    return (
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-bg-sunken border border-line">
        {allowed.map(b => {
          const active = b === selectedBoard;
          return (
            <button
              key={b}
              onClick={() => selectBoard(b)}
              className={`px-3 h-7 text-xs font-medium rounded-[5px] transition-colors duration-120 relative
                ${active
                  ? 'bg-bg-elevated text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'}`}
              style={active ? {
                boxShadow: `0 1px 2px rgb(0 0 0 / 0.06), 0 0 0 1px rgb(var(--board-${b}) / 0.30), 0 4px 12px rgb(var(--board-${b}) / 0.18)`,
              } : undefined}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full"
                  style={{
                    background: `linear-gradient(90deg, rgb(var(--board-${b}) / 0) 0%, rgb(var(--board-${b}-glow)) 50%, rgb(var(--board-${b}) / 0) 100%)`,
                  }}
                />
              )}
              {boardLabel(b)}
            </button>
          );
        })}
      </div>
    );
  }

  // ── BOARD TILE SCREEN ─────────────────────────────────────────
  if (!selectedBoard) {
    return (
      <div className="min-h-screen flex flex-col bg-bg-subtle">
        {/* Header */}
        <header className="h-14 bg-bg-elevated border-b border-line flex items-center gap-4 px-6 flex-shrink-0">
          <Wordmark className="h-5 text-ink" style={{ width: 'auto' }} />
          <span className="text-sm text-ink-faint">Disposition</span>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
              style={{ backgroundColor: 'rgb(var(--primary-soft))', color: 'rgb(var(--primary-base))' }}
            >
              {username ? username[0].toUpperCase() : 'U'}
            </div>
            <span className="text-sm text-ink-muted hidden md:inline">{username}</span>
            <button
              onClick={logout}
              className="btn btn-ghost !h-8 !w-8 !p-0"
              title="Abmelden"
              aria-label="Abmelden"
            >
              <span className="material-icons-round" style={{ fontSize: 18 }}>logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-12">
          <div className="w-full max-w-3xl animate-slide-up">
            {/* Sonilift logo header — only on the Auftragstyp picker */}
            <div className="flex flex-col items-center mb-6">
              <img
                src="/sonilift-logo.png"
                alt="Sonilift"
                style={{ maxHeight: 28, width: 'auto' }}
              />
              <div className="mt-3 w-full max-w-md border-t border-line" />
            </div>
            <h1 className="text-2xl font-semibold text-ink mb-1 text-center">Auftragstyp wählen</h1>
            <p className="text-sm text-ink-muted mb-8 text-center">Wähle ein Board, um mit der Disposition zu beginnen.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {allowed.map(b => (
                <BoardTile key={b} board={b} count={boardCounts[b]} onClick={() => selectBoard(b)} />
              ))}
            </div>
          </div>
        </main>

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // ── DASHBOARD (Board gewählt) ─────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-bg-subtle">

      {/* Ambient board-color strip — sits at the very top, ultra-subtle */}
      <div
        aria-hidden
        className="h-[2px] flex-shrink-0"
        style={{
          background: `linear-gradient(90deg,
            rgb(var(--board-${selectedBoard}) / 0) 0%,
            rgb(var(--board-${selectedBoard}-glow)) 35%,
            rgb(var(--board-${selectedBoard})) 50%,
            rgb(var(--board-${selectedBoard}-glow)) 65%,
            rgb(var(--board-${selectedBoard}) / 0) 100%)`,
        }}
      />

      {/* ── TOP BAR ──────────────────────────────────────────── */}
      <header className="h-14 bg-bg-elevated border-b border-line flex items-center gap-3 px-4 flex-shrink-0">
        <button
          onClick={backToBoards}
          className="btn btn-ghost !h-8 !w-8 !p-0"
          title="Zurück zur Boardauswahl"
          aria-label="Zurück"
        >
          <span className="material-icons-round" style={{ fontSize: 18 }}>arrow_back</span>
        </button>

        <Wordmark className="h-5 text-ink mr-1" style={{ width: 'auto' }} />

        {/* Board switcher (segmented) — center-ish */}
        <div className="ml-2 flex items-center gap-2">
          <BoardSwitcher />
          {/* Sort menu */}
          <div className="relative">
            <button
              onClick={() => setSortMenuOpen(o => !o)}
              className="btn btn-secondary btn-sm"
              title="Sortierung"
            >
              <span className="material-icons-round" style={{ fontSize: 14 }}>sort</span>
              {sortKey === 'default' ? 'Sortierung' : SORT_LABELS[sortKey]}
            </button>
            {sortMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSortMenuOpen(false)} />
                <div className="absolute top-full left-0 mt-1 z-50 floating bg-bg-elevated border-[1.5px] border-line rounded-md py-1 min-w-[240px]" style={{ borderRadius: 6 }}>
                  {(Object.keys(SORT_LABELS) as SortKey[]).filter(k => k !== 'default').map(k => (
                    <button
                      key={k}
                      onClick={() => { setSortKey(k); setSortMenuOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-bg-sunken ${sortKey === k ? 'text-primary font-medium' : 'text-ink'}`}
                    >
                      {SORT_LABELS[k]}
                    </button>
                  ))}
                  <div className="border-t border-line mt-1 pt-1">
                    <button
                      onClick={() => { setSortKey('default'); setSortMenuOpen(false); }}
                      className="w-full text-left px-3 py-1.5 text-sm text-ink-muted hover:bg-bg-sunken"
                    >
                      Standard wiederherstellen
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative ml-auto max-w-sm w-full">
          <span
            className="material-icons-round absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
            style={{ fontSize: 16 }}
          >
            search
          </span>
          <input
            className="input !pl-8"
            placeholder="Name, ID, Techniker …"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <ThemeToggle />

        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
          style={{ backgroundColor: 'rgb(var(--primary-soft))', color: 'rgb(var(--primary-base))' }}
        >
          {username ? username[0].toUpperCase() : 'U'}
        </div>
        <button
          onClick={logout}
          className="btn btn-ghost !h-8 !w-8 !p-0"
          title="Abmelden"
          aria-label="Abmelden"
        >
          <span className="material-icons-round" style={{ fontSize: 18 }}>logout</span>
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR ──────────────────────────────────────────── */}
        <nav className="w-[220px] flex-shrink-0 bg-bg-subtle border-r-[1.5px] border-line flex flex-col p-3 gap-1 relative">
          {/* Board color rail */}
          <span
            aria-hidden
            className="absolute top-0 bottom-0 left-0"
            style={{ width: 3, backgroundColor: boardColorRgb(selectedBoard) }}
          />
          <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint px-2.5 mt-1 mb-1.5">
            Disposition
          </p>
          <NavItem id="kanban" icon="view_kanban" label="Kanban" badge={navCount} />
          {canArchive && <NavItem id="archive" icon="inventory_2" label="Archiv" />}
          {canStats   && <NavItem id="stats"   icon="bar_chart"   label="Statistiken" />}

          <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint px-2.5 mt-4 mb-1.5">
            System
          </p>
          {canLogs           && <NavItem id="log"   icon="history"              label="Aktivitätslog" />}
          {role === 'admin'  && <NavItem id="admin" icon="admin_panel_settings" label="Admin" />}

          {/* Status — sticky bottom */}
          <div className="mt-auto pt-3 border-t border-line space-y-1.5 px-2.5">
            {lastCallRun ? (
              <div className="text-[11px] text-ink-faint flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: 'rgb(var(--status-confirmed))' }}
                />
                <span>Anrufschleife: <time className="tabular-nums">{timeSince(lastCallRun)}</time></span>
              </div>
            ) : (
              <div className="text-[11px] text-ink-faint">Noch keine Anrufschleife</div>
            )}
            <div className="text-[11px] text-ink-faint tabular-nums">
              {lastRefresh ? `Aktualisiert ${lastRefresh}` : 'Lade …'}
            </div>
          </div>
        </nav>

        {/* ── MAIN CONTENT ─────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden flex flex-col">

          {/* KANBAN */}
          {view === 'kanban' && (
            <>
              {/* Toolbar */}
              <div
                className="flex items-center gap-3 px-6 pt-4 pb-2 flex-shrink-0"
                style={{
                  ['--board-color' as string]: `var(--board-${selectedBoard ?? 'wartung'})`,
                  ['--board-color-glow' as string]: `var(--board-${selectedBoard ?? 'wartung'}-glow)`,
                  ['--board-color-soft' as string]: `var(--board-${selectedBoard ?? 'wartung'}-soft)`,
                }}
              >
                <span className="board-pill">{boardLabel(selectedBoard)}</span>
                <span className="text-xs text-ink-faint tabular-nums">{filtered.length} Einträge</span>

                {/* Filter-Leiste */}
                <div className="flex gap-1.5 ml-2">
                  <select
                    className="input !h-7 !text-xs !pl-2 !pr-6 w-auto"
                    value={filterTechniker}
                    onChange={e => setFilterTechniker(e.target.value)}
                  >
                    <option value="">Alle Techniker</option>
                    {technikerList.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {selectedBoard === 'reklamation' && (
                    <select
                      className="input !h-7 !text-xs !pl-2 !pr-6 w-auto"
                      value={filterSubtype}
                      onChange={e => setFilterSubtype(e.target.value)}
                    >
                      <option value="">Alle Typen</option>
                      {subtypeList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  {(filterTechniker || filterSubtype || filterStatus) && (
                    <button
                      onClick={() => { setFilterTechniker(''); setFilterSubtype(''); setFilterStatus(''); }}
                      className="btn btn-ghost btn-sm"
                    >
                      Filter löschen
                    </button>
                  )}
                </div>

                <div className="ml-auto flex gap-1.5">
                  <button
                    onClick={() => { loadEntries(); loadStats(); }}
                    className="btn btn-secondary btn-sm"
                  >
                    <span className="material-icons-round" style={{ fontSize: 14 }}>refresh</span>
                    Aktualisieren
                  </button>
                  <button onClick={() => setShowBulk(true)} className="btn btn-secondary btn-sm">
                    <span className="material-icons-round" style={{ fontSize: 14 }}>playlist_add</span>
                    Bulk
                  </button>
                  <button onClick={() => setShowNew(true)} className="btn btn-primary btn-sm">
                    <span className="material-icons-round" style={{ fontSize: 14 }}>add</span>
                    Neue ID
                  </button>
                </div>
              </div>

              {/* Stats strip — quiet horizontal row */}
              {stats && (
                <div className="flex items-center gap-1 px-6 pb-2 flex-wrap">
                  {COL_CONFIG.map(col => {
                    const val = Number(stats[col.id as keyof Stats] ?? 0);
                    const active = filterStatus === col.id;
                    return (
                      <button
                        key={col.id}
                        onClick={() => setFilterStatus(filterStatus === col.id ? '' : col.id)}
                        className={`inline-flex items-center gap-1.5 px-2 h-6 rounded-sm text-xs font-medium transition-colors
                          ${active
                            ? 'bg-bg-sunken text-ink border border-line-strong'
                            : 'text-ink-muted hover:bg-bg-sunken border border-transparent'}`}
                      >
                        <StatusDot status={col.id} />
                        <span>{col.label}</span>
                        <span className="tabular-nums text-ink-faint">{val}</span>
                      </button>
                    );
                  })}
                  <span className="inline-flex items-center gap-1.5 px-2 h-6 rounded-sm text-xs font-medium text-ink-muted">
                    <span className="material-icons-round text-ink-faint" style={{ fontSize: 12 }}>today</span>
                    <span>Heute</span>
                    <span className="tabular-nums text-ink-faint">{Number(stats.heute)}</span>
                  </span>
                </div>
              )}

              {/* Bulk-Select Bar */}
              {selectedIds.size > 0 && (
                <div
                  className="mx-6 mb-2 flex items-center gap-3 px-3.5 py-2 rounded-md border animate-slide-up"
                  style={{
                    backgroundColor: 'rgb(var(--primary-soft))',
                    borderColor: 'rgb(var(--primary-base) / 0.25)',
                  }}
                >
                  <span
                    className="text-sm font-medium tabular-nums"
                    style={{ color: 'rgb(var(--primary-base))' }}
                  >
                    {selectedIds.size} ausgewählt
                  </span>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-ink-muted hover:text-ink"
                  >
                    Auswahl aufheben
                  </button>
                  <div className="ml-auto flex gap-1.5">
                    <button onClick={bulkArchive} className="btn btn-secondary btn-sm">
                      <span className="material-icons-round" style={{ fontSize: 14 }}>archive</span>
                      Archivieren
                    </button>
                  </div>
                </div>
              )}

              {/* Anreicherungs-Warning */}
              {(() => {
                const stale = entries.filter(e =>
                  !e.kundenname &&
                  !e.is_calling &&
                  new Date(e.created_at).getTime() < Date.now() - 2 * 60 * 60 * 1000
                );
                if (stale.length === 0) return null;
                return (
                  <div
                    className="mx-6 mb-2 flex items-center gap-2 px-3.5 py-2 rounded-md border text-sm"
                    style={{
                      backgroundColor: 'rgb(var(--status-rework) / 0.10)',
                      borderColor: 'rgb(var(--status-rework) / 0.25)',
                      color: 'rgb(var(--status-rework))',
                    }}
                  >
                    <span className="material-icons-round" style={{ fontSize: 16 }}>warning</span>
                    <span>
                      <strong className="tabular-nums">{stale.length}</strong> ID{stale.length > 1 ? 's' : ''} wurden seit über 2 Stunden nicht angereichert, bitte Praxedo-Automation prüfen.
                    </span>
                  </div>
                );
              })()}

              {/* Kanban Columns — Atelier tiles, board-tinted canvas */}
              <div
                className="kanban-frame flex-1 overflow-x-auto overflow-y-hidden flex gap-3 px-6 pt-3 pb-6 mx-4 mb-4"
                style={{
                  ['--board-color' as string]: `var(--board-${selectedBoard ?? 'wartung'})`,
                  ['--board-color-glow' as string]: `var(--board-${selectedBoard ?? 'wartung'}-glow)`,
                  ['--board-color-soft' as string]: `var(--board-${selectedBoard ?? 'wartung'}-soft)`,
                }}
              >
                {COL_CONFIG.map(col => {
                  const colCards = filtered.filter(e => e.status === col.id);
                  return (
                    <div
                      key={col.id}
                      className="kanban-tile flex-shrink-0 w-[288px]"
                      style={{
                        ['--status-color' as string]: `var(--status-${col.statusVar})`,
                        ['--status-color-glow' as string]: `var(--status-${col.statusVar}-glow)`,
                      }}
                    >
                      {/* Tile head: count tile + bold caps label */}
                      <div className="kanban-tile__head">
                        <div className="kanban-tile__count">{colCards.length}</div>
                        <div className="kanban-tile__label">{col.label}</div>
                      </div>

                      <div className="kanban-tile__body">
                        {colCards.length === 0 ? (
                          <div className="text-center py-10 text-xs text-ink-faint italic">
                            Leer
                          </div>
                        ) : colCards.map(e => (
                          <KanbanCard
                            key={e.id}
                            entry={e}
                            board={selectedBoard}
                            username={username}
                            selected={selectedIds.has(e.id)}
                            onSelect={(ev) => {
                              ev.stopPropagation();
                              setSelectedIds(prev => {
                                const next = new Set(prev);
                                next.has(e.id) ? next.delete(e.id) : next.add(e.id);
                                return next;
                              });
                            }}
                            onClick={() => openDetail(e)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ARCHIV */}
          {view === 'archive' && (() => {
            // Filter
            const q = archiveSearch.trim().toLowerCase();
            const filteredArchive = archive.filter(e => {
              if (q && !(
                (e.praxedo_id ?? '').toLowerCase().includes(q) ||
                (e.techniker ?? '').toLowerCase().includes(q) ||
                (e.auftragstyp ?? '').toLowerCase().includes(q) ||
                (e.nacharbeiten_abschluss ?? '').toLowerCase().includes(q) ||
                (e.abbruchgrund ?? '').toLowerCase().includes(q)
              )) return false;
              if (archiveFilterBoard && e.board_type !== archiveFilterBoard) return false;
              if (archiveFilterTyp && (e.auftragstyp ?? '') !== archiveFilterTyp) return false;
              if (archiveFilterOutcome) {
                const out = e.outcome ?? (e.abbruchgrund ? 'abgebrochen' : '—');
                if (out !== archiveFilterOutcome) return false;
              }
              return true;
            });

            // Group by month (YYYY-MM)
            const groups = new Map<string, Entry[]>();
            for (const e of filteredArchive) {
              const ts = e.archived_at ?? e.updated_at ?? e.created_at;
              const d = ts ? new Date(ts) : new Date();
              const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(e);
            }
            const sortedKeys = Array.from(groups.keys()).sort().reverse();
            const monthLabel = (k: string) => {
              const [y, m] = k.split('-').map(Number);
              return new Date(y, m-1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
            };

            const allTypes  = Array.from(new Set(archive.map(e => e.auftragstyp).filter(Boolean))) as string[];
            const allOutcomes = ['bestaetigt','nacharbeiten','abgebrochen'];

            return (
              <>
                <div className="flex items-center gap-3 px-6 pt-4 pb-3 flex-shrink-0">
                  <h2 className="text-lg font-semibold text-ink">Archiv</h2>
                  <span className="text-xs text-ink-faint tabular-nums">
                    {filteredArchive.length}{filteredArchive.length !== archive.length ? ` / ${archive.length}` : ''} Einträge
                  </span>
                  <button
                    onClick={() => api<{ entries: Entry[] }>(selectedBoard ? `/api/archive?board=${selectedBoard}` : '/api/archive').then(d => setArchive(d.entries)).catch(() => {})}
                    className="btn btn-secondary btn-sm ml-auto"
                    title="Aktualisieren"
                  >
                    <span className="material-icons-round" style={{ fontSize: 14 }}>refresh</span>
                  </button>
                </div>

                {/* Filter bar */}
                <div className="px-6 pb-3 flex flex-wrap items-center gap-2 flex-shrink-0">
                  <div className="relative flex-1 min-w-[220px] max-w-md">
                    <span
                      className="material-icons-round absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
                      style={{ fontSize: 16 }}
                    >search</span>
                    <input
                      value={archiveSearch}
                      onChange={e => setArchiveSearch(e.target.value)}
                      placeholder="Praxedo ID, Techniker, Grund …"
                      className="input pl-9 h-9 text-sm w-full"
                    />
                  </div>
                  {!selectedBoard && (
                    <select
                      value={archiveFilterBoard}
                      onChange={e => setArchiveFilterBoard(e.target.value as BoardType | '')}
                      className="input h-9 text-sm"
                    >
                      <option value="">Alle Boards</option>
                      <option value="neuinstallation">Neuinstallation</option>
                      <option value="reklamation">Reklamation</option>
                      <option value="wartung">Wartung</option>
                    </select>
                  )}
                  <select
                    value={archiveFilterTyp}
                    onChange={e => setArchiveFilterTyp(e.target.value)}
                    className="input h-9 text-sm"
                  >
                    <option value="">Alle Typen</option>
                    {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select
                    value={archiveFilterOutcome}
                    onChange={e => setArchiveFilterOutcome(e.target.value)}
                    className="input h-9 text-sm"
                  >
                    <option value="">Alle Ergebnisse</option>
                    {allOutcomes.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
                  </select>
                  {(archiveSearch || archiveFilterBoard || archiveFilterTyp || archiveFilterOutcome) && (
                    <button
                      onClick={() => { setArchiveSearch(''); setArchiveFilterBoard(''); setArchiveFilterTyp(''); setArchiveFilterOutcome(''); }}
                      className="btn btn-ghost btn-sm"
                      title="Filter zurücksetzen"
                    >
                      <span className="material-icons-round" style={{ fontSize: 14 }}>close</span>
                      Zurücksetzen
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-auto px-6 pb-6">
                  {sortedKeys.length === 0 && (
                    <p className="py-10 text-center text-ink-faint text-sm">Keine archivierten Einträge.</p>
                  )}
                  {sortedKeys.map(key => {
                    const rows = groups.get(key)!;
                    return (
                      <section key={key} className="mb-6">
                        {/* Bauhaus-style month header */}
                        <div
                          className="flex items-baseline gap-3 mb-2 pb-2 border-b-[3px]"
                          style={{ borderColor: 'rgb(var(--text))' }}
                        >
                          <h3 className="text-base font-bold uppercase tracking-[0.08em] text-ink">
                            {monthLabel(key)}
                          </h3>
                          <span className="text-xs text-ink-faint tabular-nums">{rows.length} Einträge</span>
                        </div>
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr>
                              {['Praxedo ID','Board','Typ','Termin','Techniker','Versuche','Ergebnis','Grund/Abschluss','Archiviert'].map(h => (
                                <th
                                  key={h}
                                  className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-ink-faint whitespace-nowrap bg-bg-subtle border-b border-line"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(e => {
                              const out = e.outcome ?? (e.abbruchgrund ? 'abgebrochen' : '—');
                              const outColor =
                                out === 'bestaetigt' ? 'rgb(var(--status-confirmed))' :
                                out === 'nacharbeiten' ? 'rgb(var(--status-rework))' :
                                out === 'abgebrochen' ? 'rgb(var(--status-cancelled))' :
                                'rgb(var(--text-faint))';
                              return (
                                <tr key={e.id} className="border-b border-line hover:bg-bg-elevated transition-colors">
                                  <td className="py-2 px-3 font-mono text-xs text-ink">{e.praxedo_id}</td>
                                  <td className="py-2 px-3 text-ink-muted text-xs capitalize">{e.board_type ?? '—'}</td>
                                  <td className="py-2 px-3 text-ink-muted text-xs">{e.auftragstyp || '—'}</td>
                                  <td className="py-2 px-3 text-ink-muted tabular-nums whitespace-nowrap">{fmtDate(e.termin)}</td>
                                  <td className="py-2 px-3 text-ink-muted">{e.techniker || '—'}</td>
                                  <td className="py-2 px-3 text-ink-muted tabular-nums">{e.wahlversuche}</td>
                                  <td className="py-2 px-3">
                                    <span
                                      className="text-xs font-semibold uppercase tracking-wide"
                                      style={{ color: outColor }}
                                    >
                                      {out}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-ink-muted text-xs">{e.nacharbeiten_abschluss || e.abbruchgrund || '—'}</td>
                                  <td className="py-2 px-3 text-ink-faint tabular-nums whitespace-nowrap text-xs">
                                    {fmtDate(e.archived_at ?? e.updated_at ?? e.created_at)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </section>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {/* AKTIVITÄTSLOG */}
          {view === 'log' && (
            <>
              <div className="flex items-center gap-3 px-6 pt-4 pb-3 flex-shrink-0">
                <h2 className="text-lg font-semibold text-ink">Aktivitätslog</h2>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {logs.map(l => (
                  <div key={l.id} className="flex gap-4 py-2 border-b border-line text-sm">
                    <time className="text-xs font-mono text-ink-faint whitespace-nowrap min-w-[140px] tabular-nums">{fmtDT(l.created_at)}</time>
                    <span className="font-medium text-ink min-w-[100px]">{l.username}</span>
                    <span className="font-medium text-ink-muted min-w-[160px]">{l.action}</span>
                    <span className="text-ink-faint">{l.details}</span>
                  </div>
                ))}
                {logs.length === 0 && <p className="py-10 text-center text-ink-faint">Keine Einträge.</p>}
              </div>
            </>
          )}

          {/* STATISTIKEN */}
          {view === 'stats' && overview && (
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-lg font-semibold text-ink mb-1">Statistiken</h2>
              <p className="text-sm text-ink-muted mb-6">Überblick über alle Boards.</p>

              {/* Quiet stat strip — text hierarchy, no card grid */}
              <div className="card p-5 mb-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-4 gap-x-6">
                  {[
                    { label: 'Gesamt',       val: overview.total },
                    { label: 'Bestätigt',    val: overview.bestaetigt },
                    { label: 'Nacharbeiten', val: overview.nacharbeiten },
                    { label: 'Erfolgsrate',  val: `${overview.success_rate ?? 0} %` },
                    { label: 'Ø Versuche',   val: overview.avg_attempts ?? '—' },
                    { label: '1. Versuch',   val: `${overview.first_attempt_rate ?? 0} %` },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="text-[10px] text-ink-faint uppercase tracking-wider mb-1">{s.label}</div>
                      <div className="text-xl font-semibold text-ink tabular-nums">{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-ink mb-3">Häufigste Ablehnungsgründe</h3>
                  {(overview.rejection_reasons ?? []).length === 0 ? (
                    <p className="text-sm text-ink-faint">Keine Daten</p>
                  ) : (overview.rejection_reasons ?? []).map(r => (
                    <div key={r.reason} className="flex items-center gap-3 py-1.5 border-b border-line last:border-0">
                      <span className="text-sm text-ink-muted flex-1">{r.reason || '(kein Grund)'}</span>
                      <span className="text-sm font-medium text-ink tabular-nums">{r.count}</span>
                    </div>
                  ))}
                </div>

                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-ink mb-3">Erfolg nach Board</h3>
                  {(overview.by_board ?? []).map(b => {
                    const pct = b.total > 0 ? Math.round(Number(b.bestaetigt) / Number(b.total) * 100) : 0;
                    return (
                      <div key={b.board} className="flex items-center gap-3 py-2">
                        <span className="text-sm font-medium text-ink w-32 capitalize">{b.board}</span>
                        <div className="flex-1 bg-bg-sunken rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: 'rgb(var(--status-confirmed))' }}
                          />
                        </div>
                        <span className="text-xs text-ink-faint tabular-nums">{b.bestaetigt}/{b.total}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ADMIN */}
          {view === 'admin' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <h2 className="text-lg font-semibold text-ink">Administration</h2>

              {/* Neuer Benutzer */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-line text-sm font-semibold text-ink flex items-center gap-2">
                  <span className="material-icons-round text-ink-muted" style={{ fontSize: 16 }}>person_add</span>
                  Neuen Benutzer anlegen
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-faint uppercase tracking-wide mb-1.5">Benutzername</label>
                    <input
                      className="input"
                      value={newUser.username}
                      onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))}
                      placeholder="benutzername"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-faint uppercase tracking-wide mb-1.5">Passwort</label>
                    <input
                      type="password"
                      className="input"
                      value={newUser.password}
                      onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                      placeholder="Temporäres Passwort"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-faint uppercase tracking-wide mb-1.5">Rolle</label>
                    <select
                      className="input"
                      value={newUser.role}
                      onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                    >
                      <option value="user">Mitarbeiter</option>
                      <option value="power_user">Power User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button onClick={createUser} className="btn btn-primary w-full">
                      <span className="material-icons-round" style={{ fontSize: 14 }}>add</span>
                      Anlegen
                    </button>
                  </div>

                  {newUser.role !== 'admin' && (
                    <div className="col-span-full">
                      <label className="block text-xs font-medium text-ink-faint uppercase tracking-wide mb-2">Board-Zugriff</label>
                      <div className="flex gap-4 flex-wrap">
                        {(['neuinstallation','reklamation','wartung'] as BoardType[]).map(b => (
                          <label key={b} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newUser.permissions.includes(`board:${b}`)}
                              onChange={e => setNewUser(u => ({
                                ...u,
                                permissions: e.target.checked
                                  ? [...u.permissions, `board:${b}`]
                                  : u.permissions.filter(p => p !== `board:${b}`),
                              }))}
                            />
                            <span className="text-ink-muted">{boardLabel(b)}</span>
                          </label>
                        ))}
                      </div>
                      {newUser.role === 'power_user' && (
                        <>
                          <label className="block text-xs font-medium text-ink-faint uppercase tracking-wide mb-2 mt-3">Erweiterte Rechte</label>
                          <div className="flex gap-4 flex-wrap">
                            {[['view:logs','Logs'],['view:archive','Archiv'],['view:stats','Statistiken']].map(([perm, label]) => (
                              <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newUser.permissions.includes(perm)}
                                  onChange={e => setNewUser(u => ({
                                    ...u,
                                    permissions: e.target.checked
                                      ? [...u.permissions, perm]
                                      : u.permissions.filter(p => p !== perm),
                                  }))}
                                />
                                <span className="text-ink-muted">{label}</span>
                              </label>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Benutzerliste */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-line text-sm font-semibold text-ink flex items-center gap-2">
                  <span className="material-icons-round text-ink-muted" style={{ fontSize: 16 }}>group</span>
                  Benutzer
                </div>
                <div className="divide-y divide-line">
                  {users.map(u => (
                    <div key={u.id} className={`px-5 py-3.5 ${!u.active ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
                          style={{ backgroundColor: 'rgb(var(--primary-soft))', color: 'rgb(var(--primary-base))' }}
                        >
                          {u.username[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-ink">{u.username}</div>
                          <div className="text-xs text-ink-faint">
                            {u.role === 'admin' ? 'Admin' : u.role === 'power_user' ? 'Power User' : 'Mitarbeiter'}
                            {' · '}
                            <time className="tabular-nums">{u.last_login ? fmtDT(u.last_login) : 'Noch nie'}</time>
                          </div>
                          {u.permissions?.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {u.permissions.map(p => (
                                <span
                                  key={p}
                                  className="text-[10px] px-1.5 py-0.5 rounded-sm bg-bg-sunken text-ink-muted border border-line"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setEditingUser(editingUser?.id === u.id ? null : u)}
                            className="btn btn-secondary btn-sm"
                          >
                            Bearbeiten
                          </button>
                          <button onClick={() => resetPw(u)} className="btn btn-secondary btn-sm" title="Passwort zurücksetzen">
                            <span className="material-icons-round" style={{ fontSize: 14 }}>key</span>
                          </button>
                          <button
                            onClick={() => updateUser(u, { active: !u.active })}
                            className={u.active ? 'btn btn-danger btn-sm' : 'btn btn-secondary btn-sm'}
                          >
                            {u.active ? 'Deakt.' : 'Aktiv.'}
                          </button>
                        </div>
                      </div>

                      {editingUser?.id === u.id && u.role !== 'admin' && (
                        <div className="mt-3 pl-11 animate-slide-up">
                          <p className="text-xs font-medium text-ink-faint mb-2 uppercase tracking-wide">Board-Zugriff</p>
                          <div className="flex gap-4 mb-2 flex-wrap">
                            {(['neuinstallation','reklamation','wartung'] as BoardType[]).map(b => (
                              <label key={b} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={(editingUser.permissions ?? []).includes(`board:${b}`)}
                                  onChange={e => {
                                    const next = e.target.checked
                                      ? [...(editingUser.permissions ?? []), `board:${b}`]
                                      : (editingUser.permissions ?? []).filter(p => p !== `board:${b}`);
                                    setEditingUser({ ...editingUser, permissions: next });
                                  }}
                                />
                                <span className="text-ink-muted">{boardLabel(b)}</span>
                              </label>
                            ))}
                          </div>
                          {u.role === 'power_user' && (
                            <>
                              <p className="text-xs font-medium text-ink-faint mb-2 uppercase tracking-wide">Erweiterte Rechte</p>
                              <div className="flex gap-4 mb-3 flex-wrap">
                                {[['view:logs','Logs'],['view:archive','Archiv'],['view:stats','Statistiken']].map(([perm, label]) => (
                                  <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={(editingUser.permissions ?? []).includes(perm)}
                                      onChange={e => {
                                        const next = e.target.checked
                                          ? [...(editingUser.permissions ?? []), perm]
                                          : (editingUser.permissions ?? []).filter(p => p !== perm);
                                        setEditingUser({ ...editingUser, permissions: next });
                                      }}
                                    />
                                    <span className="text-ink-muted">{label}</span>
                                  </label>
                                ))}
                              </div>
                            </>
                          )}
                          <button
                            onClick={() => { updateUser(u, { permissions: editingUser.permissions }); setEditingUser(null); }}
                            className="btn btn-primary btn-sm"
                          >
                            Speichern
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {users.length === 0 && <p className="py-6 text-center text-ink-faint text-sm">Keine Benutzer.</p>}
                </div>
              </div>

              {/* Einstellungen */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-line text-sm font-semibold text-ink flex items-center gap-2">
                  <span className="material-icons-round text-ink-muted" style={{ fontSize: 16 }}>settings</span>
                  Einstellungen
                </div>
                <div className="p-5">
                  <label className="block text-xs font-medium text-ink-faint uppercase tracking-wide mb-2">
                    Auto-Archivierung "Bestätigt" nach X Tagen
                  </label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="number" min="0" max="30"
                      className="input !w-24"
                      value={settings.auto_archive_days_bestaetigt}
                      onChange={e => setSettings(s => ({ ...s, auto_archive_days_bestaetigt: e.target.value }))}
                    />
                    <span className="text-sm text-ink-muted">Tage (0 = deaktiviert)</span>
                  </div>

                  <div className="mt-7 mb-3 text-xs font-medium text-ink-faint uppercase tracking-wide border-t border-line pt-5">
                    Anruflogik, reguläre Kunden
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {([
                      { key: 'regular_max_days',            label: 'Max. Tage insgesamt',                     unit: 'Tage' },
                      { key: 'regular_max_per_day_early',   label: 'Max. Versuche pro Tag (Tag 1, 3)',        unit: 'Versuche' },
                      { key: 'regular_max_per_day_late',    label: 'Max. Versuche pro Tag (ab Tag 4)',        unit: 'Versuche' },
                      { key: 'regular_interval_first_min',  label: 'Wartezeit nach Versuch 1',                unit: 'Min' },
                      { key: 'regular_interval_second_min', label: 'Wartezeit ab Versuch 2 (Tag 1)',          unit: 'Min' },
                      { key: 'regular_interval_late_min',   label: 'Wartezeit zwischen Versuchen (ab Tag 2)', unit: 'Min' },
                    ] as { key: string; label: string; unit: string }[]).map(({ key, label, unit }) => (
                      <div key={key}>
                        <label className="block text-xs text-ink-muted mb-1">{label}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min="0"
                            className="input !w-24 !h-8 !text-sm"
                            value={settings[key] ?? ''}
                            onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                          />
                          <span className="text-xs text-ink-faint">{unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-7 mb-3 text-xs font-medium text-ink-faint uppercase tracking-wide border-t border-line pt-5">
                    Anruflogik, Erkrankt-Kunden
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {([
                      { key: 'erkrankt_max_days',         label: 'Max. Tage insgesamt',                  unit: 'Tage' },
                      { key: 'erkrankt_max_day1',         label: 'Max. Versuche Tag 1',                  unit: 'Versuche' },
                      { key: 'erkrankt_max_day2',         label: 'Max. Versuche Tag 2',                  unit: 'Versuche' },
                      { key: 'erkrankt_interval_min_min', label: 'Mindest-Wartezeit zwischen Versuchen', unit: 'Min' },
                      { key: 'erkrankt_interval_max_min', label: 'Max. Wartezeit zwischen Versuchen',    unit: 'Min' },
                    ] as { key: string; label: string; unit: string }[]).map(({ key, label, unit }) => (
                      <div key={key}>
                        <label className="block text-xs text-ink-muted mb-1">{label}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min="0"
                            className="input !w-24 !h-8 !text-sm"
                            value={settings[key] ?? ''}
                            onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                          />
                          <span className="text-xs text-ink-faint">{unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={saveSettings} className="btn btn-primary mt-6">
                    Alle Einstellungen speichern
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── MODAL: NEUE ID ────────────────────────────────────── */}
      <Modal open={showNew} onClose={() => setShowNew(false)} maxWidth={460}>
        <ModalHeader
          title={`Neue Praxedo ID, ${boardLabel(selectedBoard)}`}
          onClose={() => setShowNew(false)}
        />
        <div className="p-6">
          <label className="block text-xs font-medium text-ink-faint uppercase tracking-wide mb-2">
            Praxedo ID
          </label>
          <input
            className="input !h-11 font-mono tracking-wider"
            value={newId}
            onChange={e => setNewId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitNew()}
            placeholder={`${selectedBoard === 'wartung' ? 'WARTUNG' : selectedBoard === 'reklamation' ? 'NOTDIENST' : 'NEUINSTALLATION'}-…`}
            autoFocus
          />

          <button
            type="button"
            onClick={() => setNewErkrankt(v => !v)}
            className={`mt-4 w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors
              ${newErkrankt ? 'border-line-strong bg-bg-sunken' : 'border-line bg-bg-elevated hover:border-line-strong'}`}
          >
            <span
              className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0`}
              style={{
                backgroundColor: newErkrankt
                  ? 'rgb(var(--status-cancelled))'
                  : 'rgb(var(--border-strong))',
              }}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform
                  ${newErkrankt ? 'translate-x-4' : ''}`}
              />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-ink">Techniker erkrankt</span>
              <span className="block text-xs text-ink-faint">Andere Anruflogik, 2 Tage, alle 45 bis 60 Min.</span>
            </span>
          </button>

          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setShowNew(false)} className="btn btn-secondary">Abbrechen</button>
            <button onClick={submitNew} disabled={newLoading} className="btn btn-primary">
              {newLoading ? 'Wird eingetragen …' : (
                <>
                  <span className="material-icons-round" style={{ fontSize: 14 }}>send</span>
                  Eintragen
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: BULK IMPORT ───────────────────────────────── */}
      <Modal
        open={showBulk}
        onClose={() => { setShowBulk(false); setBulkResult(null); setBulkRaw(''); setBulkErkrankt(false); }}
        maxWidth={580}
      >
        <ModalHeader
          title={`Bulk Import, ${boardLabel(selectedBoard)}`}
          onClose={() => { setShowBulk(false); setBulkResult(null); setBulkRaw(''); setBulkErkrankt(false); }}
        />
        <div className="p-6">
          {!bulkResult ? (
            <>
              <label className="block text-xs font-medium text-ink-faint uppercase tracking-wide mb-2">
                IDs einfügen (eine pro Zeile)
              </label>
              <textarea
                className="input font-mono !text-xs"
                rows={8}
                placeholder={`WARTUNG-CC592F8DA74D417AA5C9DD4DC8E9EE17-20260415010014\nWARTUNG-7EDC134CBF48497C9F3DBAC0A288D205-20260325112701`}
                value={bulkRaw}
                onChange={e => setBulkRaw(e.target.value)}
              />
              <p className="text-xs text-ink-faint mt-2">
                IDs werden nach Zeilenumbruch, Tab oder Komma aufgeteilt. Der Auftragstyp wird automatisch aus der ID erkannt.
              </p>

              <button
                type="button"
                onClick={() => setBulkErkrankt(v => !v)}
                className={`mt-4 w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors
                  ${bulkErkrankt ? 'border-line-strong bg-bg-sunken' : 'border-line bg-bg-elevated hover:border-line-strong'}`}
              >
                <span
                  className="w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: bulkErkrankt ? 'rgb(var(--status-cancelled))' : 'transparent',
                    borderColor: bulkErkrankt ? 'rgb(var(--status-cancelled))' : 'rgb(var(--border-strong))',
                  }}
                >
                  {bulkErkrankt && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </span>
                <span className="material-icons-round text-ink-muted" style={{ fontSize: 16 }}>sick</span>
                <span className="text-sm text-ink-muted">Techniker erkrankt, gilt für alle IDs in dieser Eingabe</span>
              </button>

              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => { setShowBulk(false); setBulkRaw(''); setBulkErkrankt(false); }}
                  className="btn btn-secondary"
                >
                  Abbrechen
                </button>
                <button onClick={submitBulk} disabled={bulkLoading} className="btn btn-primary">
                  {bulkLoading ? 'Wird importiert …' : (
                    <>
                      <span className="material-icons-round" style={{ fontSize: 14 }}>upload</span>
                      Importieren
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="card p-4 text-center">
                  <div className="text-[10px] text-ink-faint uppercase tracking-wider">Importiert</div>
                  <div
                    className="text-2xl font-semibold tabular-nums mt-1"
                    style={{ color: 'rgb(var(--status-confirmed))' }}
                  >
                    {bulkResult.summary.imported}
                  </div>
                </div>
                <div className="card p-4 text-center">
                  <div className="text-[10px] text-ink-faint uppercase tracking-wider">Fehlgeschlagen</div>
                  <div
                    className="text-2xl font-semibold tabular-nums mt-1"
                    style={{ color: 'rgb(var(--status-cancelled))' }}
                  >
                    {bulkResult.summary.failed}
                  </div>
                </div>
                <div className="card p-4 text-center">
                  <div className="text-[10px] text-ink-faint uppercase tracking-wider">Gesamt</div>
                  <div className="text-2xl font-semibold text-ink tabular-nums mt-1">{bulkResult.summary.total}</div>
                </div>
              </div>
              {bulkResult.results.filter(r => !r.ok).length > 0 && (
                <div
                  className="max-h-40 overflow-y-auto rounded-md border p-3"
                  style={{
                    borderColor: 'rgb(var(--status-cancelled) / 0.25)',
                    backgroundColor: 'rgb(var(--status-cancelled) / 0.06)',
                  }}
                >
                  {bulkResult.results.filter(r => !r.ok).map(r => (
                    <div
                      key={r.id}
                      className="text-xs py-1 border-b last:border-0"
                      style={{ borderColor: 'rgb(var(--status-cancelled) / 0.15)', color: 'rgb(var(--status-cancelled))' }}
                    >
                      <span className="font-mono">{r.id}</span>, {r.error}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-5">
                <button
                  onClick={() => { setShowBulk(false); setBulkResult(null); setBulkRaw(''); }}
                  className="btn btn-primary"
                >
                  Schließen
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ── SLIDE PANEL: DETAIL ───────────────────────────────── */}
      <SlidePanel
        open={!!detailEntry}
        onClose={() => setDetailEntry(null)}
        width={720}
        ariaLabel="Kontaktdetails"
      >
        {detailEntry && (
          <>
            <SlidePanelHeader
              title={detailEntry.kundenname || `ID ${detailEntry.praxedo_id}`}
              subtitle={
                <button
                  onClick={() => { copyToClipboard(`%${detailEntry.kundenname ?? detailEntry.praxedo_id}`); toast('Name kopiert (mit %-Prefix)', 'success'); }}
                  className="font-mono text-xs text-ink-faint hover:text-ink flex items-center gap-1 group"
                  title="Kundenname für Praxedo-Suche kopieren (mit %)"
                >
                  {detailEntry.praxedo_id}
                  <span
                    className="material-icons-round opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ fontSize: 12 }}
                  >
                    content_copy
                  </span>
                </button>
              }
              onClose={() => setDetailEntry(null)}
              right={
                <div className="flex items-center gap-2">
                  {detailEntry.erkrankt && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-sm"
                      style={{
                        color: 'rgb(var(--status-cancelled))',
                        backgroundColor: 'rgb(var(--status-cancelled) / 0.10)',
                      }}
                    >
                      <span className="material-icons-round" style={{ fontSize: 12 }}>sick</span>
                      Erkrankt
                    </span>
                  )}
                  {detailEntry.status && <StatusPill status={detailEntry.status} />}
                </div>
              }
            />

            <div className="flex-1 overflow-y-auto p-6">
              {/* Kundendaten */}
              <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint mb-2">Kundendaten</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
                {[
                  { label: 'Auftragstyp', val: detailEntry.auftragstyp },
                  { label: 'E-Mail',      val: detailEntry.email },
                  { label: 'Termin',      val: fmtDate(detailEntry.termin) },
                  { label: 'Zeitraum',    val: detailEntry.zeitraum },
                  { label: 'Techniker',   val: detailEntry.techniker },
                  { label: 'Erstellt',    val: fmtDate(detailEntry.erstellungsdatum) },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-bg-sunken border border-line rounded-md px-3 py-2">
                    <div className="text-[10px] text-ink-faint uppercase tracking-wider mb-0.5">{label}</div>
                    <div className="text-sm font-medium text-ink truncate">{val || '—'}</div>
                  </div>
                ))}
              </div>

              {/* Telefon mit Click-to-Call */}
              <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint mb-2">Telefon</p>
              <div className="flex gap-2 mb-5">
                <input
                  className="input flex-1"
                  type="tel"
                  value={detailTelefon}
                  onChange={e => setDetailTelefon(e.target.value)}
                  placeholder="Telefonnummer"
                />
                {detailTelefon && (
                  <a
                    href={`tel:${detailTelefon.replace(/\s/g, '')}`}
                    className="btn btn-secondary"
                    title="Anrufen"
                    style={{ color: 'rgb(var(--status-confirmed))' }}
                  >
                    <span className="material-icons-round" style={{ fontSize: 14 }}>call</span>
                    Anrufen
                  </a>
                )}
              </div>

              {/* Anrufverlauf */}
              <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint mb-2">Anrufverlauf</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                {[
                  { label: 'Anrufversuche',   val: String(detailEntry.wahlversuche) },
                  { label: 'Letzter Versuch', val: fmtDT(detailEntry.letzter_wahlversuch) },
                  { label: 'Fehlergrund',     val: detailEntry.failure_reason },
                  { label: 'Rückrufe',        val: String(detailEntry.ruckrufe) },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-bg-sunken border border-line rounded-md px-3 py-2">
                    <div className="text-[10px] text-ink-faint uppercase tracking-wider mb-0.5">{label}</div>
                    <div className="text-sm font-medium text-ink truncate tabular-nums">{val || '—'}</div>
                  </div>
                ))}
              </div>

              {detailEntry.status === 'ausstehend' && (
                <button
                  onClick={callNextRun}
                  className="btn btn-secondary w-full mb-5"
                  style={{ color: 'rgb(var(--primary-base))' }}
                >
                  <span className="material-icons-round" style={{ fontSize: 14 }}>play_arrow</span>
                  Im nächsten Lauf mitnehmen
                </button>
              )}

              {/* KI-Analyse */}
              {(detailEntry.ki_zusammenfassung || detailEntry.ki_termin_ergebnis || detailEntry.ki_stimmung) && (
                <div className="mb-5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint mb-2">
                    KI-Gesprächsanalyse
                  </p>
                  <div
                    className="rounded-md border overflow-hidden divide-y"
                    style={{
                      borderColor: 'rgb(var(--primary-base) / 0.20)',
                      backgroundColor: 'rgb(var(--primary-soft))',
                    }}
                  >
                    {detailEntry.ki_zusammenfassung && (
                      <div className="px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgb(var(--primary-base))' }}>
                          Zusammenfassung
                        </div>
                        <div className="text-sm text-ink">{detailEntry.ki_zusammenfassung}</div>
                      </div>
                    )}
                    {(detailEntry.ki_termin_ergebnis || detailEntry.ki_naechste_aktion || detailEntry.ki_stimmung) && (
                      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3" style={{ borderColor: 'rgb(var(--primary-base) / 0.15)' }}>
                        {[
                          { label: 'Terminergebnis',  val: detailEntry.ki_termin_ergebnis },
                          { label: 'Nächste Aktion',  val: detailEntry.ki_naechste_aktion },
                          { label: 'Stimmung',         val: detailEntry.ki_stimmung },
                          { label: 'Verlässlichkeit',  val: detailEntry.ki_zuverlaessigkeit },
                          { label: 'Gesprächsende',    val: detailEntry.ki_gespraechsende },
                          { label: 'Angehöriger',      val: detailEntry.ki_angehoeriger },
                        ].filter(f => f.val).map(f => (
                          <div key={f.label}>
                            <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'rgb(var(--primary-base))' }}>
                              {f.label}
                            </div>
                            <div className="text-sm text-ink">{f.val}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Nacharbeiten Abschluss */}
              {detailEntry.status === 'nacharbeiten' && (
                <div
                  className="mb-5 p-4 rounded-md border"
                  style={{
                    backgroundColor: 'rgb(var(--status-rework) / 0.08)',
                    borderColor: 'rgb(var(--status-rework) / 0.25)',
                  }}
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                    style={{ color: 'rgb(var(--status-rework))' }}
                  >
                    <span className="material-icons-round" style={{ fontSize: 12 }}>build</span>
                    Nacharbeit abschließen
                  </p>
                  <select
                    className="input mb-2"
                    value={nacharbeitenAbschl}
                    onChange={e => setNacharbeitenAbschl(e.target.value)}
                  >
                    <option value="">Abschlussgrund wählen …</option>
                    <option value="Neuen Termin vereinbart">Neuen Termin vereinbart</option>
                    <option value="Demontage planen">Demontage planen</option>
                    <option value="Storniert">Storniert</option>
                    <option value="Direkt kontaktiert">Direkt kontaktiert</option>
                    <option value="Kein Interesse">Kein Interesse</option>
                    <option value="Erreichbar, Termin bestätigt">Erreichbar, Termin bestätigt</option>
                    <option value="Sonstiges">Sonstiges</option>
                  </select>
                  <button
                    onClick={nacharbeitenAbschliessen}
                    className="btn w-full"
                    style={{
                      backgroundColor: 'rgb(var(--status-rework))',
                      color: 'white',
                    }}
                  >
                    <span className="material-icons-round" style={{ fontSize: 14 }}>check_circle</span>
                    Abschließen
                  </button>
                </div>
              )}

              {/* Interne Notiz */}
              <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint mb-2">Interne Notiz</p>
              <textarea
                className="input mb-5"
                rows={3}
                value={detailNotiz}
                onChange={e => setDetailNotiz(e.target.value)}
                placeholder="Notiz zum Kontakt …"
              />

              {/* Rückrufzeit */}
              <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint mb-2">Rückrufzeit überschreiben</p>
              <input
                className="input mb-5 tabular-nums"
                type="datetime-local"
                value={detailCb}
                onChange={e => setDetailCb(e.target.value)}
              />

              {/* Kommentare */}
              <p className="text-[10px] font-medium uppercase tracking-wider text-ink-faint mb-2">Kommentare</p>
              <div className="mb-3 space-y-2 max-h-48 overflow-y-auto">
                {detailComments.length === 0 ? (
                  <p className="text-xs text-ink-faint py-2">Noch keine Kommentare.</p>
                ) : detailComments.map(c => (
                  <div key={c.id} className="bg-bg-sunken border border-line rounded-md px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-ink">{c.username}</span>
                      <time className="text-xs text-ink-faint tabular-nums">{fmtDT(c.created_at)}</time>
                    </div>
                    <div className="text-sm text-ink-muted">
                      {c.body.split(/(@\w+)/g).map((part, i) =>
                        /^@\w+/.test(part)
                          ? <span key={i} className="font-medium" style={{ color: 'rgb(var(--primary-base))' }}>{part}</span>
                          : <span key={i}>{part}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mb-5">
                <input
                  className="input flex-1"
                  placeholder="Kommentar … @benutzername für Erwähnung"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addComment())}
                />
                <button
                  onClick={addComment}
                  className="btn btn-primary"
                  disabled={!newComment.trim()}
                  aria-label="Kommentar senden"
                >
                  <span className="material-icons-round" style={{ fontSize: 14 }}>send</span>
                </button>
              </div>

              {/* Danger Zone */}
              {!['bestaetigt', 'abgebrochen'].includes(detailEntry.status ?? '') && (
                <div
                  className="mb-5 p-3.5 rounded-md border"
                  style={{
                    borderColor: 'rgb(var(--status-cancelled) / 0.25)',
                    backgroundColor: 'rgb(var(--status-cancelled) / 0.06)',
                  }}
                >
                  <div
                    className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'rgb(var(--status-cancelled))' }}
                  >
                    <span className="material-icons-round" style={{ fontSize: 12 }}>warning</span>
                    Aktionen
                  </div>
                  <button onClick={cancelEntry} className="btn btn-danger btn-sm">
                    <span className="material-icons-round" style={{ fontSize: 14 }}>cancel</span>
                    Kontakt abbrechen
                  </button>
                </div>
              )}

            </div>
            <SlidePanelFooter>
              <button onClick={archiveEntry} className="btn btn-ghost btn-sm">
                <span className="material-icons-round" style={{ fontSize: 14 }}>archive</span>
                Archivieren
              </button>
              <div className="flex gap-2">
                <button onClick={() => setDetailEntry(null)} className="btn btn-secondary">Schließen</button>
                <button onClick={saveDetail} className="btn btn-primary">
                  <span className="material-icons-round" style={{ fontSize: 14 }}>save</span>
                  Speichern
                </button>
              </div>
            </SlidePanelFooter>
          </>
        )}
      </SlidePanel>

      {/* ── CANCEL PICKER ────────────────────────────────────── */}
      <Modal open={showCancelPicker} onClose={() => setShowCancelPicker(false)} maxWidth={520}>
        <ModalHeader title="Kontakt abbrechen" subtitle="Wähle einen Grund — wird im Reporting gespeichert." onClose={() => setShowCancelPicker(false)} />
        <div className="px-5 pb-5">
          <div className="flex flex-col gap-1.5 mb-5">
            {ABBRUCHGRUENDE.map(g => (
              <label
                key={g}
                className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-[1.5px] transition-colors ${
                  cancelGrund === g
                    ? 'border-[rgb(var(--status-cancelled))] bg-[rgb(var(--status-cancelled)/0.08)]'
                    : 'border-line hover:border-line-strong bg-bg-elevated'
                }`}
                style={{ borderRadius: 4 }}
              >
                <input
                  type="radio"
                  name="abbruchgrund"
                  value={g}
                  checked={cancelGrund === g}
                  onChange={() => setCancelGrund(g)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className="flex-shrink-0 w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center"
                  style={{
                    borderColor: cancelGrund === g ? 'rgb(var(--status-cancelled))' : 'rgb(var(--border-strong))',
                    backgroundColor: cancelGrund === g ? 'rgb(var(--status-cancelled))' : 'transparent',
                  }}
                >
                  {cancelGrund === g && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                <span className="text-sm text-ink">{g}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCancelPicker(false)} className="btn btn-secondary">Zurück</button>
            <button onClick={confirmCancelWithReason} className="btn btn-danger" disabled={!cancelGrund}>
              <span className="material-icons-round" style={{ fontSize: 14 }}>cancel</span>
              Abbrechen bestätigen
            </button>
          </div>
        </div>
      </Modal>

      {/* ── TOASTS ───────────────────────────────────────────── */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

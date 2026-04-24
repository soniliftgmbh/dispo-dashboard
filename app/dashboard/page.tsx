'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Entry, Stats, ActivityLog, User, Comment, StatsOverview,
  Status, BoardType, Role,
  deriveStatus, boardLabel, allowedBoards,
} from '@/lib/types';

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

// ── TOAST ─────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';
interface ToastMsg { id: number; msg: string; type: ToastType }
function Toast({ t }: { t: ToastMsg }) {
  const cls = {
    success: 'bg-brand-50 border-brand-200 text-brand-800',
    error:   'bg-red-50 border-red-200 text-red-700',
    info:    'bg-blue-50 border-blue-200 text-blue-700',
  }[t.type];
  return (
    <div className={`flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium shadow ${cls} min-w-64`}>
      <span className="font-bold">{{ success: '✓', error: '✗', info: 'i' }[t.type]}</span> {t.msg}
    </div>
  );
}

// ── COLUMN CONFIG ─────────────────────────────────────────────
const COL_CONFIG: { id: Status; label: string; dot: string; count: string }[] = [
  { id: 'ausstehend',  label: 'Ausstehend',  dot: 'bg-gray-400',   count: 'bg-gray-100 text-gray-600' },
  { id: 'aktiv',       label: 'Aktiv',       dot: 'bg-blue-500',   count: 'bg-blue-50 text-blue-700' },
  { id: 'nacharbeiten',label: 'Nacharbeiten',dot: 'bg-amber-500',  count: 'bg-amber-50 text-amber-700' },
  { id: 'bestaetigt',  label: 'Bestätigt',   dot: 'bg-green-500',  count: 'bg-green-50 text-green-700' },
];

// ── SUBTYPE BADGE (Reklamation) ───────────────────────────────
function SubtypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  return (
    <div className="text-[10px] font-bold tracking-wide uppercase mb-1"
         style={{ color: '#1e3a5f', letterSpacing: '0.08em' }}>
      {type}
    </div>
  );
}

// ── KANBAN CARD ───────────────────────────────────────────────
function KanbanCard({
  entry, board, username, selected, onSelect, onClick,
}: {
  entry: Entry; board: BoardType; username: string;
  selected: boolean; onSelect: (e: React.MouseEvent) => void; onClick: () => void;
}) {
  const isUnread  = (entry.unread_by ?? []).includes(username);
  const isErkrankt = entry.erkrankt;

  return (
    <div
      onClick={onClick}
      className={`relative bg-white border rounded-lg p-3.5 cursor-pointer transition-all group
        ${selected ? 'border-brand-500 ring-2 ring-brand-400/30 shadow-md' : 'border-gray-200 hover:border-brand-400 hover:shadow-md hover:shadow-brand-500/10'}`}
    >
      {/* Bulk-Select Checkbox */}
      <div
        className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onSelect}
      >
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
          ${selected ? 'bg-brand-500 border-brand-500' : 'border-gray-300 bg-white'}`}>
          {selected && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5"/></svg>}
        </div>
      </div>

      {/* Unread dot */}
      {isUnread && (
        <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-brand-500 shadow shadow-brand-500/50" />
      )}

      {/* Subtype für Reklamation */}
      {board === 'reklamation' && <SubtypeBadge type={entry.auftragstyp} />}

      {/* Name */}
      <div className="font-semibold text-gray-900 text-sm">
        {entry.kundenname || <span className="text-gray-400 italic text-xs">Wird angereichert…</span>}
      </div>

      {/* Erkrankt Badge */}
      {isErkrankt && (
        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
          <span className="material-icons-round text-[10px]">sick</span> Erkrankt
        </span>
      )}

      <div className="h-px bg-gray-100 my-2" />

      <div className="space-y-1">
        {entry.termin && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="material-icons-round text-gray-400" style={{fontSize:13}}>event</span>
            {fmtDate(entry.termin)}
          </div>
        )}
        {entry.zeitraum && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="material-icons-round text-gray-400" style={{fontSize:13}}>access_time</span>
            {entry.zeitraum}
          </div>
        )}
        {entry.techniker && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="material-icons-round text-gray-400" style={{fontSize:13}}>engineering</span>
            {entry.techniker}
          </div>
        )}
      </div>

      {/* Anrufversuche als Text */}
      {entry.wahlversuche > 0 && (
        <div className={`mt-2 text-xs font-medium ${entry.wahlversuche >= 4 ? 'text-red-500' : 'text-gray-400'}`}>
          {entry.wahlversuche} {entry.wahlversuche === 1 ? 'Versuch' : 'Versuche'}
        </div>
      )}

      {entry.notiz && (
        <div className="mt-2 px-2 py-1.5 bg-amber-50 border border-amber-100 rounded text-xs text-amber-700">
          {entry.notiz.substring(0, 70)}{entry.notiz.length > 70 ? '…' : ''}
        </div>
      )}

      {/* Nacharbeiten-Grund */}
      {entry.status === 'nacharbeiten' && entry.abbruchgrund && (
        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 rounded px-2 py-1">
          <span className="material-icons-round" style={{fontSize:12}}>warning</span>
          {entry.abbruchgrund}
        </div>
      )}
    </div>
  );
}

// ── BOARD TILE ────────────────────────────────────────────────
function BoardTile({
  board, count, onClick
}: {
  board: BoardType; count: number; onClick: () => void;
}) {
  const cfg: Record<BoardType, { icon: string; color: string; bg: string; border: string; desc: string }> = {
    neuinstallation: {
      icon:   'install_desktop',
      color:  'text-blue-700',
      bg:     'bg-blue-50 hover:bg-blue-100',
      border: 'border-blue-200 hover:border-blue-400',
      desc:   'Neue Treppenlifte & Erstinstallationen',
    },
    reklamation: {
      icon:   'build_circle',
      color:  'text-amber-700',
      bg:     'bg-amber-50 hover:bg-amber-100',
      border: 'border-amber-200 hover:border-amber-400',
      desc:   'Störungen, Notdienst & Demontagen',
    },
    wartung: {
      icon:   'handyman',
      color:  'text-green-700',
      bg:     'bg-green-50 hover:bg-green-100',
      border: 'border-green-200 hover:border-green-400',
      desc:   'Regelmäßige Wartungsaufträge',
    },
  };
  const c = cfg[board];
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-4 p-8 rounded-2xl border-2 transition-all cursor-pointer ${c.bg} ${c.border} group`}
    >
      <span className={`material-icons-round text-5xl ${c.color} transition`}>
        {c.icon}
      </span>
      <div className="text-center">
        <div className={`text-xl font-bold ${c.color}`}>{boardLabel(board)}</div>
        <div className="text-sm text-gray-500 mt-1">{c.desc}</div>
      </div>
      {count > 0 && (
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${c.bg} ${c.color} border ${c.border}`}>
          {count} offen
        </span>
      )}
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

  // Detail Modal
  const [detailEntry,         setDetailEntry]         = useState<Entry | null>(null);
  const [detailNotiz,         setDetailNotiz]         = useState('');
  const [detailCb,            setDetailCb]            = useState('');
  const [detailTelefon,       setDetailTelefon]       = useState('');
  const [detailComments,      setDetailComments]      = useState<Comment[]>([]);
  const [newComment,          setNewComment]          = useState('');
  const [nacharbeitenAbschl,  setNacharbeitenAbschl]  = useState('');

  // New Entry Modal
  const [showNew,      setShowNew]      = useState(false);
  const [showBulk,     setShowBulk]     = useState(false);
  const [newId,        setNewId]        = useState('');
  const [newErkrankt,  setNewErkrankt]  = useState(false);
  const [newLoading,   setNewLoading]   = useState(false);
  const [bulkRaw,      setBulkRaw]      = useState('');
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
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, [toastId]);

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

  // Board-Counts für Tile-View
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

  // Letzte Anrufschleife
  const loadLastCallRun = useCallback(async () => {
    try {
      const data = await api<{ setting: { value: string } | null }>('/api/settings?key=last_call_run');
      if (data.setting?.value) setLastCallRun(data.setting.value);
    } catch { /* silent */ }
  }, []); // eslint-disable-line

  // ── INIT ─────────────────────────────────────────────────────
  useEffect(() => {
    // Session-Info aus Login-Response lesen (in localStorage gespeichert)
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

  // Board wechseln → Daten neu laden
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
    try {
      await api('/api/entries', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ praxedoId: newId.trim(), erkrankt: newErkrankt, board: selectedBoard }),
      });
      toast(`ID ${newId.trim()} eingetragen.`, 'success');
      setShowNew(false); setNewId(''); setNewErkrankt(false);
      loadEntries(); loadStats();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
    finally { setNewLoading(false); }
  }

  // ── BULK IMPORT ───────────────────────────────────────────────
  async function submitBulk() {
    if (!bulkRaw.trim()) { toast('Keine IDs eingegeben.', 'error'); return; }
    setBulkLoading(true);
    try {
      const data = await api<{ results: { id: string; ok: boolean; error?: string }[]; summary: { total: number; imported: number; failed: number } }>(
        '/api/entries/bulk',
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: bulkRaw, board: selectedBoard }) }
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
    setNacharbeitenAbschl(''); setNewComment('');
    // Als gelesen markieren
    if ((e.unread_by ?? []).includes(username)) {
      api(`/api/entries/${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_read' }) }).catch(() => {});
    }
    // Kommentare laden
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
        body: JSON.stringify({ action: 'update', notiz: detailNotiz, callbackTime: detailCb || null, telefon: detailTelefon }),
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

  async function cancelEntry() {
    if (!detailEntry || !confirm(`"${detailEntry.kundenname || detailEntry.praxedo_id}" manuell abbrechen?`)) return;
    try {
      await api(`/api/entries/${detailEntry.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      toast('Kontakt abgebrochen → Nacharbeiten.', 'info');
      setDetailEntry(null); loadEntries(); loadStats();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
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
      // Browser-Benachrichtigung für @mentions
      if (data.comment.mentions.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`${username} hat dich erwähnt`, {
          body: newComment.substring(0, 100),
          icon: '/favicon.ico',
        });
      }
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  // ── BULK ARCHIVE ──────────────────────────────────────────────
  async function bulkArchive() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length} Kontakte archivieren?`)) return;
    try {
      // Archivierung über einzelne PATCH-Calls (bulk_archive über ersten Eintrag)
      await api(`/api/entries/${ids[0]}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_archive', ids }),
      });
      toast(`${ids.length} Einträge archiviert.`, 'success');
      setSelectedIds(new Set());
      loadEntries(); loadStats();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  // ── VIEW SWITCH ──────────────────────────────────────────────
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

  // ── FILTER ────────────────────────────────────────────────────
  const filtered = entries.filter(e => {
    if (e.status === 'final') return false;
    if (search && ![ e.praxedo_id, e.kundenname, e.telefon, e.techniker ].some(v => v?.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filterTechniker && e.techniker !== filterTechniker) return false;
    if (filterSubtype && selectedBoard === 'reklamation' && e.auftragstyp !== filterSubtype) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    return true;
  });

  // Eindeutige Techniker für Filter-Dropdown
  const technikerList = Array.from(new Set(entries.map(e => e.techniker).filter((v): v is string => !!v)));
  // Subtypes für Reklamation
  const subtypeList   = Array.from(new Set(entries.map(e => e.auftragstyp).filter((v): v is string => !!v)));

  const allowed = allowedBoards(role, permissions);
  const canLogs    = role === 'admin' || permissions.includes('view:logs');
  const canArchive = role === 'admin' || permissions.includes('view:archive');
  const canStats   = role === 'admin' || permissions.includes('view:stats');
  const navCount   = entries.filter(e => e.status !== 'final' && e.status !== 'bestaetigt').length;

  // ── NAV ITEM ──────────────────────────────────────────────────
  function NavItem({ id, icon, label, badge }: { id: typeof view; icon: string; label: string; badge?: number }) {
    return (
      <button onClick={() => switchView(id)}
        className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition
          ${view === id ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
        <span className="material-icons-round text-[18px]">{icon}</span>
        {label}
        {badge !== undefined && <span className="ml-auto bg-brand-100 text-brand-700 text-xs font-bold px-2 py-0.5 rounded-full">{badge}</span>}
      </button>
    );
  }

  // ── BOARD TILE SCREEN ─────────────────────────────────────────
  if (!selectedBoard) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center gap-4 px-6 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white shadow text-lg">🔔</div>
            <span className="font-bold text-gray-900">Anna Weber — Disposition</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-sm">
              {username ? username[0].toUpperCase() : 'U'}
            </div>
            <span className="text-sm text-gray-500">{username}</span>
            <button onClick={logout} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Abmelden">
              <span className="material-icons-round text-[20px]">logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Auftragstyp wählen</h1>
          <p className="text-gray-500 mb-10">Wähle ein Board, um mit der Disposition zu beginnen.</p>
          <div className="grid grid-cols-3 gap-6 w-full max-w-3xl">
            {allowed.map(b => (
              <BoardTile key={b} board={b} count={boardCounts[b]} onClick={() => selectBoard(b)} />
            ))}
          </div>
        </main>

        {/* Toasts */}
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
          {toasts.map(t => <Toast key={t.id} t={t} />)}
        </div>
      </div>
    );
  }

  // ── DASHBOARD (Board gewählt) ─────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-50">

      {/* ── TOP BAR ──────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center gap-3 px-6 flex-shrink-0 shadow-sm">
        {/* Back + Board */}
        <button onClick={backToBoards} className="flex items-center gap-1.5 text-gray-400 hover:text-brand-600 transition mr-1" title="Zurück zur Boardauswahl">
          <span className="material-icons-round text-[20px]">arrow_back</span>
        </button>
        <div className="flex items-center gap-2 min-w-[160px]">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white shadow text-lg">🔔</div>
          <div>
            <span className="font-bold text-gray-900 text-sm">Anna Weber</span>
            <div className="text-xs text-brand-600 font-medium">{boardLabel(selectedBoard)}</div>
          </div>
        </div>

        {/* Stats Badges (klickbar) */}
        {stats && (
          <div className="flex gap-1.5 flex-wrap">
            {COL_CONFIG.map(col => {
              const val = stats[col.id as keyof Stats] ?? 0;
              return (
                <button key={col.id}
                  onClick={() => setFilterStatus(filterStatus === col.id ? '' : col.id)}
                  className={`text-xs font-semibold px-3 py-1 rounded-full border transition
                    ${filterStatus === col.id ? 'ring-2 ring-brand-400' : ''}
                    ${col.count}`}>
                  {Number(val)} {col.label}
                </button>
              );
            })}
            <span className="text-xs font-semibold px-3 py-1 rounded-full border bg-red-50 text-red-600 border-red-200">
              {Number(stats.heute)} Heute
            </span>
          </div>
        )}

        {/* Search */}
        <div className="relative ml-auto">
          <span className="material-icons-round absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
          <input
            className="pl-9 pr-3 py-2 bg-gray-100 border border-transparent rounded-lg text-sm focus:outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-400/20 transition w-48 focus:w-64"
            placeholder="Name, ID, Techniker…" value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* User */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-sm">
            {username ? username[0].toUpperCase() : 'U'}
          </div>
          <button onClick={logout} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Abmelden">
            <span className="material-icons-round text-[20px]">logout</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR ──────────────────────────────────────────── */}
        <nav className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col p-3 gap-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 mt-2 mb-1">Disposition</p>
          <NavItem id="kanban" icon="view_kanban" label="Kanban" badge={navCount} />
          {canArchive && <NavItem id="archive" icon="inventory_2" label="Archiv" />}
          {canStats   && <NavItem id="stats"   icon="bar_chart"   label="Statistiken" />}
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 mt-3 mb-1">System</p>
          {canLogs  && <NavItem id="log"   icon="history"              label="Aktivitätslog" />}
          {role === 'admin' && <NavItem id="admin" icon="admin_panel_settings" label="Admin" />}

          {/* Anrufschleife Status */}
          <div className="mt-auto pt-3 border-t border-gray-100 px-3 space-y-1">
            {lastCallRun ? (
              <div className="text-[11px] text-gray-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
                Letzte Anrufschleife: {timeSince(lastCallRun)}
              </div>
            ) : (
              <div className="text-[11px] text-gray-400">Noch keine Anrufschleife</div>
            )}
            <div className="text-[11px] text-gray-400">
              {lastRefresh ? `↻ ${lastRefresh}` : 'Lade…'}
            </div>
          </div>
        </nav>

        {/* ── MAIN CONTENT ─────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden flex flex-col">

          {/* KANBAN */}
          {view === 'kanban' && (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-3 px-6 pt-5 pb-3 flex-shrink-0">
                <h2 className="text-xl font-bold">Disposition — {boardLabel(selectedBoard)}</h2>
                <span className="text-sm text-gray-400">{filtered.length} Einträge</span>

                {/* Filter-Leiste */}
                <div className="flex gap-2 ml-2">
                  <select
                    className="text-xs px-2.5 py-1.5 bg-gray-100 border border-transparent rounded-lg focus:outline-none focus:border-brand-400 text-gray-600"
                    value={filterTechniker} onChange={e => setFilterTechniker(e.target.value)}>
                    <option value="">Alle Techniker</option>
                    {technikerList.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {selectedBoard === 'reklamation' && (
                    <select
                      className="text-xs px-2.5 py-1.5 bg-gray-100 border border-transparent rounded-lg focus:outline-none focus:border-brand-400 text-gray-600"
                      value={filterSubtype} onChange={e => setFilterSubtype(e.target.value)}>
                      <option value="">Alle Typen</option>
                      {subtypeList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  {(filterTechniker || filterSubtype || filterStatus) && (
                    <button onClick={() => { setFilterTechniker(''); setFilterSubtype(''); setFilterStatus(''); }}
                      className="text-xs px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition">
                      Filter löschen
                    </button>
                  )}
                </div>

                <div className="ml-auto flex gap-2">
                  {/* Bulk Archive */}
                  {selectedIds.size > 0 && (
                    <button onClick={bulkArchive}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition">
                      <span className="material-icons-round text-[16px]">archive</span>
                      {selectedIds.size} archivieren
                    </button>
                  )}
                  <button onClick={() => { loadEntries(); loadStats(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 transition">
                    <span className="material-icons-round text-[16px]">refresh</span> Aktualisieren
                  </button>
                  <button onClick={() => setShowBulk(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 transition">
                    <span className="material-icons-round text-[16px]">playlist_add</span> Bulk
                  </button>
                  <button onClick={() => setShowNew(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold shadow shadow-brand-500/30 transition">
                    <span className="material-icons-round text-[16px]">add</span> Neue ID
                  </button>
                </div>
              </div>

              {/* Anreicherungs-Warning: IDs die seit > 2h nicht angereichert wurden */}
              {(() => {
                const stale = entries.filter(e =>
                  !e.kundenname &&
                  !e.is_calling &&
                  new Date(e.created_at).getTime() < Date.now() - 2 * 60 * 60 * 1000
                );
                if (stale.length === 0) return null;
                return (
                  <div className="mx-6 mb-2 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                    <span className="material-icons-round text-[16px]">warning</span>
                    <span><strong>{stale.length}</strong> ID{stale.length > 1 ? 's' : ''} wurden seit über 2 Stunden nicht angereichert — bitte Praxedo-Automation prüfen.</span>
                  </div>
                );
              })()}

              {/* Kanban Columns */}
              <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-3.5 p-6 pt-2 pb-6">
                {COL_CONFIG.map(col => {
                  const colCards = filtered.filter(e => e.status === col.id);
                  return (
                    <div key={col.id} className="flex-shrink-0 w-72 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                        <div className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                        <span className="text-sm font-bold text-gray-800">{col.label}</span>
                        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${col.count}`}>{colCards.length}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
                        {colCards.length === 0
                          ? <div className="text-center py-10 text-xs text-gray-400">Keine Einträge</div>
                          : colCards.map(e => (
                            <KanbanCard key={e.id} entry={e} board={selectedBoard} username={username}
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
                          ))
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ARCHIV */}
          {view === 'archive' && (
            <>
              <div className="flex items-center gap-3 px-6 pt-5 pb-4 flex-shrink-0">
                <h2 className="text-xl font-bold">Archiv</h2>
                <span className="text-sm text-gray-400">{archive.length} Einträge</span>
                <button onClick={() => api<{ entries: Entry[] }>(selectedBoard ? `/api/archive?board=${selectedBoard}` : '/api/archive').then(d => setArchive(d.entries)).catch(() => {})}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 transition">
                  <span className="material-icons-round text-[16px]">refresh</span>
                </button>
              </div>
              <div className="flex-1 overflow-auto px-6 pb-6">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      {['Praxedo ID','Name','Telefon','Termin','Zeitraum','Techniker','Typ','Versuche','Abschluss'].map(h => (
                        <th key={h} className="text-left py-2.5 px-3 text-xs font-bold uppercase tracking-wide text-gray-400 whitespace-nowrap bg-white sticky top-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {archive.map(e => (
                      <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-mono text-xs text-gray-500">{e.praxedo_id}</td>
                        <td className="py-2.5 px-3 font-medium">{e.kundenname || '—'}</td>
                        <td className="py-2.5 px-3 text-gray-500">{e.telefon || '—'}</td>
                        <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{fmtDate(e.termin)}</td>
                        <td className="py-2.5 px-3 text-gray-500">{e.zeitraum || '—'}</td>
                        <td className="py-2.5 px-3 text-gray-500">{e.techniker || '—'}</td>
                        <td className="py-2.5 px-3 text-gray-500 text-xs">{e.auftragstyp || '—'}</td>
                        <td className="py-2.5 px-3 text-gray-500">{e.wahlversuche}</td>
                        <td className="py-2.5 px-3 text-gray-500">{e.nacharbeiten_abschluss || e.abbruchgrund || '—'}</td>
                      </tr>
                    ))}
                    {archive.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-gray-400">Keine archivierten Einträge.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* AKTIVITÄTSLOG */}
          {view === 'log' && (
            <>
              <div className="flex items-center gap-3 px-6 pt-5 pb-4 flex-shrink-0">
                <h2 className="text-xl font-bold">Aktivitätslog</h2>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {logs.map(l => (
                  <div key={l.id} className="flex gap-4 py-2.5 border-b border-gray-100 text-sm">
                    <span className="text-xs font-mono text-gray-400 whitespace-nowrap min-w-[130px]">{fmtDT(l.created_at)}</span>
                    <span className="font-semibold text-brand-600 min-w-[90px]">{l.username}</span>
                    <span className="font-medium text-gray-700 min-w-[160px]">{l.action}</span>
                    <span className="text-gray-400">{l.details}</span>
                  </div>
                ))}
                {logs.length === 0 && <p className="py-10 text-center text-gray-400">Keine Einträge.</p>}
              </div>
            </>
          )}

          {/* STATISTIKEN */}
          {view === 'stats' && overview && (
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-xl font-bold mb-6">Statistiken</h2>
              <div className="grid grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Gesamt',      val: overview.total,                       cls: 'bg-gray-50' },
                  { label: 'Bestätigt',   val: overview.bestaetigt,                  cls: 'bg-green-50' },
                  { label: 'Nacharbeiten',val: overview.nacharbeiten,                cls: 'bg-amber-50' },
                  { label: 'Erfolgsrate', val: `${overview.success_rate ?? 0} %`,    cls: 'bg-blue-50' },
                  { label: 'Ø Versuche',  val: overview.avg_attempts ?? '—',         cls: 'bg-purple-50' },
                  { label: '1. Versuch',  val: `${overview.first_attempt_rate ?? 0} %`, cls: 'bg-green-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.cls} border border-gray-200 rounded-xl p-5`}>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{s.label}</div>
                    <div className="text-3xl font-bold text-gray-900">{s.val}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Ablehnungsgründe */}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-700 mb-4">Häufigste Ablehnungsgründe</h3>
                  {(overview.rejection_reasons ?? []).length === 0
                    ? <p className="text-sm text-gray-400">Keine Daten</p>
                    : (overview.rejection_reasons ?? []).map(r => (
                      <div key={r.reason} className="flex items-center gap-3 mb-2">
                        <span className="text-sm text-gray-600 flex-1">{r.reason || '(kein Grund)'}</span>
                        <span className="font-bold text-gray-800">{r.count}</span>
                      </div>
                    ))
                  }
                </div>

                {/* Pro Board */}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-700 mb-4">Erfolg nach Board</h3>
                  {(overview.by_board ?? []).map(b => (
                    <div key={b.board} className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-medium text-gray-700 w-32 capitalize">{b.board}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-2 bg-green-400 rounded-full"
                          style={{ width: `${b.total > 0 ? Math.round(Number(b.bestaetigt) / Number(b.total) * 100) : 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{b.bestaetigt}/{b.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ADMIN */}
          {view === 'admin' && (
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-xl font-bold mb-5">Administration</h2>

              {/* Neuer Benutzer */}
              <div className="bg-white border border-gray-200 rounded-xl mb-5 overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 font-semibold text-sm flex items-center gap-2">
                  <span className="material-icons-round text-brand-500 text-[18px]">person_add</span> Neuen Benutzer anlegen
                </div>
                <div className="p-5 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Benutzername</label>
                    <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))} placeholder="benutzername" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Passwort</label>
                    <input type="password" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} placeholder="Temporäres Passwort" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Rolle</label>
                    <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none"
                      value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                      <option value="user">Mitarbeiter</option>
                      <option value="power_user">Power User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button onClick={createUser} className="w-full flex items-center justify-center gap-1.5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold transition shadow shadow-brand-500/20">
                      <span className="material-icons-round text-[16px]">add</span> Anlegen
                    </button>
                  </div>

                  {/* Board-Berechtigungen */}
                  {newUser.role !== 'admin' && (
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Board-Zugriff</label>
                      <div className="flex gap-4">
                        {(['neuinstallation','reklamation','wartung'] as BoardType[]).map(b => (
                          <label key={b} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" className="rounded border-gray-300 text-brand-500"
                              checked={newUser.permissions.includes(`board:${b}`)}
                              onChange={e => setNewUser(u => ({
                                ...u,
                                permissions: e.target.checked
                                  ? [...u.permissions, `board:${b}`]
                                  : u.permissions.filter(p => p !== `board:${b}`)
                              }))}
                            />
                            {boardLabel(b)}
                          </label>
                        ))}
                      </div>
                      {(newUser.role === 'power_user') && (
                        <>
                          <label className="block text-xs font-semibold text-gray-500 mb-2 mt-3 uppercase tracking-wide">Erweiterte Rechte</label>
                          <div className="flex gap-4">
                            {[['view:logs','Logs'],['view:archive','Archiv'],['view:stats','Statistiken']].map(([perm, label]) => (
                              <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" className="rounded border-gray-300 text-brand-500"
                                  checked={newUser.permissions.includes(perm)}
                                  onChange={e => setNewUser(u => ({
                                    ...u,
                                    permissions: e.target.checked
                                      ? [...u.permissions, perm]
                                      : u.permissions.filter(p => p !== perm)
                                  }))}
                                />
                                {label}
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
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-5">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 font-semibold text-sm flex items-center gap-2">
                  <span className="material-icons-round text-brand-500 text-[18px]">group</span> Benutzer
                </div>
                <div className="divide-y divide-gray-100">
                  {users.map(u => (
                    <div key={u.id} className={`px-5 py-4 ${!u.active ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-sm">{u.username[0].toUpperCase()}</div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{u.username}</div>
                          <div className="text-xs text-gray-400">
                            {u.role === 'admin' ? '👑 Admin' : u.role === 'power_user' ? '⚡ Power User' : '👤 Mitarbeiter'}
                            {' · '}{u.last_login ? fmtDT(u.last_login) : 'Noch nie'}
                          </div>
                          {/* Permissions Anzeige */}
                          {u.permissions?.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {u.permissions.map(p => (
                                <span key={p} className="text-[10px] px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded-full border border-brand-200">{p}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingUser(editingUser?.id === u.id ? null : u)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 transition">
                            Bearbeiten
                          </button>
                          <button onClick={() => resetPw(u)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 transition">🔑</button>
                          <button onClick={() => updateUser(u, { active: !u.active })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${u.active ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'}`}>
                            {u.active ? 'Deakt.' : 'Aktiv.'}
                          </button>
                        </div>
                      </div>

                      {/* Inline Edit Permissions */}
                      {editingUser?.id === u.id && u.role !== 'admin' && (
                        <div className="mt-3 pl-12">
                          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Board-Zugriff</p>
                          <div className="flex gap-4 mb-2">
                            {(['neuinstallation','reklamation','wartung'] as BoardType[]).map(b => (
                              <label key={b} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" className="rounded border-gray-300 text-brand-500"
                                  checked={(editingUser.permissions ?? []).includes(`board:${b}`)}
                                  onChange={e => {
                                    const next = e.target.checked
                                      ? [...(editingUser.permissions ?? []), `board:${b}`]
                                      : (editingUser.permissions ?? []).filter(p => p !== `board:${b}`);
                                    setEditingUser({ ...editingUser, permissions: next });
                                  }}
                                />
                                {boardLabel(b)}
                              </label>
                            ))}
                          </div>
                          {u.role === 'power_user' && (
                            <>
                              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Erweiterte Rechte</p>
                              <div className="flex gap-4 mb-3">
                                {[['view:logs','Logs'],['view:archive','Archiv'],['view:stats','Statistiken']].map(([perm, label]) => (
                                  <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="checkbox" className="rounded border-gray-300 text-brand-500"
                                      checked={(editingUser.permissions ?? []).includes(perm)}
                                      onChange={e => {
                                        const next = e.target.checked
                                          ? [...(editingUser.permissions ?? []), perm]
                                          : (editingUser.permissions ?? []).filter(p => p !== perm);
                                        setEditingUser({ ...editingUser, permissions: next });
                                      }}
                                    />
                                    {label}
                                  </label>
                                ))}
                              </div>
                            </>
                          )}
                          <button onClick={() => { updateUser(u, { permissions: editingUser.permissions }); setEditingUser(null); }}
                            className="px-4 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-semibold hover:bg-brand-600 transition">
                            Speichern
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {users.length === 0 && <p className="py-6 text-center text-gray-400 text-sm">Keine Benutzer.</p>}
                </div>
              </div>

              {/* Einstellungen */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 font-semibold text-sm flex items-center gap-2">
                  <span className="material-icons-round text-brand-500 text-[18px]">settings</span> Einstellungen
                </div>
                <div className="p-5">
                  <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                    Auto-Archivierung "Bestätigt" nach X Tagen
                  </label>
                  <div className="flex gap-3 items-center">
                    <input type="number" min="0" max="30"
                      className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-500"
                      value={settings.auto_archive_days_bestaetigt}
                      onChange={e => setSettings(s => ({ ...s, auto_archive_days_bestaetigt: e.target.value }))}
                    />
                    <span className="text-sm text-gray-500">Tage (0 = deaktiviert)</span>
                  </div>

                  {/* Anruflogik – Regulär */}
                  <div className="mt-7 mb-1 text-xs font-bold text-gray-400 uppercase tracking-wide border-t border-gray-100 pt-5">
                    Anruflogik — Reguläre Kunden
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-3">
                    {([
                      { key: 'regular_max_days',            label: 'Max. Tage insgesamt',              unit: 'Tage' },
                      { key: 'regular_max_per_day_early',   label: 'Max. Versuche pro Tag (Tag 1–3)',   unit: 'Versuche' },
                      { key: 'regular_max_per_day_late',    label: 'Max. Versuche pro Tag (ab Tag 4)', unit: 'Versuche' },
                      { key: 'regular_interval_first_min',  label: 'Wartezeit nach Versuch 1',          unit: 'Min' },
                      { key: 'regular_interval_second_min', label: 'Wartezeit ab Versuch 2 (Tag 1)',    unit: 'Min' },
                      { key: 'regular_interval_late_min',   label: 'Wartezeit zwischen Versuchen (ab Tag 2)', unit: 'Min' },
                    ] as { key: string; label: string; unit: string }[]).map(({ key, label, unit }) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-500 mb-1">{label}</label>
                        <div className="flex items-center gap-2">
                          <input type="number" min="0"
                            className="w-20 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-500"
                            value={settings[key] ?? ''}
                            onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                          />
                          <span className="text-xs text-gray-400">{unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Anruflogik – Erkrankt */}
                  <div className="mt-7 mb-1 text-xs font-bold text-gray-400 uppercase tracking-wide border-t border-gray-100 pt-5">
                    Anruflogik — Erkrankt-Kunden
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-3">
                    {([
                      { key: 'erkrankt_max_days',         label: 'Max. Tage insgesamt',         unit: 'Tage' },
                      { key: 'erkrankt_max_day1',         label: 'Max. Versuche Tag 1',          unit: 'Versuche' },
                      { key: 'erkrankt_max_day2',         label: 'Max. Versuche Tag 2',          unit: 'Versuche' },
                      { key: 'erkrankt_interval_min_min', label: 'Mindest-Wartezeit zwischen Versuchen', unit: 'Min' },
                      { key: 'erkrankt_interval_max_min', label: 'Max. Wartezeit zwischen Versuchen',    unit: 'Min' },
                    ] as { key: string; label: string; unit: string }[]).map(({ key, label, unit }) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-500 mb-1">{label}</label>
                        <div className="flex items-center gap-2">
                          <input type="number" min="0"
                            className="w-20 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-500"
                            value={settings[key] ?? ''}
                            onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                          />
                          <span className="text-xs text-gray-400">{unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={saveSettings}
                    className="mt-6 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 transition shadow shadow-brand-500/20">
                    Alle Einstellungen speichern
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── MODAL: NEUE ID ────────────────────────────────────── */}
      {showNew && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="bg-white rounded-2xl p-7 w-[440px] shadow-2xl border border-gray-100">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="material-icons-round text-brand-500">add_circle</span>
              <h3 className="text-lg font-bold">Neue Praxedo ID — {boardLabel(selectedBoard)}</h3>
              <button onClick={() => setShowNew(false)} className="ml-auto p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Praxedo ID *</label>
            <input
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-lg font-bold font-mono tracking-widest focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
              value={newId} onChange={e => setNewId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitNew()}
              placeholder={`${selectedBoard === 'wartung' ? 'WARTUNG' : selectedBoard === 'reklamation' ? 'NOTDIENST' : 'NEUINSTALLATION'}-...`}
              autoFocus
            />
            <div
              onClick={() => setNewErkrankt(v => !v)}
              className={`mt-4 flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${newErkrankt ? 'bg-red-50 border-red-400' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}
            >
              <div className={`w-10 h-6 rounded-full flex items-center transition-colors ${newErkrankt ? 'bg-red-500' : 'bg-gray-300'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${newErkrankt ? 'translate-x-4' : ''}`} />
              </div>
              <div>
                <div className={`text-sm font-semibold ${newErkrankt ? 'text-red-700' : 'text-gray-600'}`}>Techniker erkrankt</div>
                <div className="text-xs text-gray-400">Andere Anruflogik — 2 Tage, alle 45–60 Min</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Abbrechen</button>
              <button onClick={submitNew} disabled={newLoading} className="flex items-center gap-1.5 px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold shadow shadow-brand-500/20 transition disabled:opacity-60">
                {newLoading ? 'Wird eingetragen…' : <><span className="material-icons-round text-[16px]">send</span> Eintragen</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BULK IMPORT ───────────────────────────────── */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center" onClick={e => e.target === e.currentTarget && (setShowBulk(false), setBulkResult(null), setBulkRaw(''))}>
          <div className="bg-white rounded-2xl p-7 w-[560px] shadow-2xl border border-gray-100">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="material-icons-round text-brand-500">playlist_add</span>
              <h3 className="text-lg font-bold">Bulk Import — {boardLabel(selectedBoard)}</h3>
              <button onClick={() => { setShowBulk(false); setBulkResult(null); setBulkRaw(''); }} className="ml-auto p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
                <span className="material-icons-round">close</span>
              </button>
            </div>

            {!bulkResult ? (
              <>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">IDs einfügen (eine pro Zeile)</label>
                <textarea
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition resize-none"
                  rows={8}
                  placeholder={`WARTUNG-CC592F8DA74D417AA5C9DD4DC8E9EE17-20260415010014\nWARTUNG-7EDC134CBF48497C9F3DBAC0A288D205-20260325112701`}
                  value={bulkRaw}
                  onChange={e => setBulkRaw(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-2">IDs werden nach Zeilenumbruch, Tab oder Komma aufgeteilt. Der Auftragstyp wird automatisch aus der ID erkannt.</p>
                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => { setShowBulk(false); setBulkRaw(''); }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Abbrechen</button>
                  <button onClick={submitBulk} disabled={bulkLoading} className="flex items-center gap-1.5 px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold shadow shadow-brand-500/20 transition disabled:opacity-60">
                    {bulkLoading ? 'Wird importiert…' : <><span className="material-icons-round text-[16px]">upload</span> Importieren</>}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-3 mb-4">
                  <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">{bulkResult.summary.imported}</div>
                    <div className="text-xs text-green-600 mt-1">Importiert</div>
                  </div>
                  <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-red-700">{bulkResult.summary.failed}</div>
                    <div className="text-xs text-red-600 mt-1">Fehlgeschlagen</div>
                  </div>
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-gray-700">{bulkResult.summary.total}</div>
                    <div className="text-xs text-gray-500 mt-1">Gesamt</div>
                  </div>
                </div>
                {bulkResult.results.filter(r => !r.ok).length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-red-100 bg-red-50 p-3">
                    {bulkResult.results.filter(r => !r.ok).map(r => (
                      <div key={r.id} className="text-xs text-red-700 py-1 border-b border-red-100 last:border-0">
                        <span className="font-mono">{r.id}</span> — {r.error}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end mt-5">
                  <button onClick={() => { setShowBulk(false); setBulkResult(null); setBulkRaw(''); }}
                    className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold shadow shadow-brand-500/20 transition">
                    Schließen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: DETAIL ─────────────────────────────────────── */}
      {detailEntry && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center" onClick={e => e.target === e.currentTarget && setDetailEntry(null)}>
          <div className="bg-white rounded-2xl p-7 w-[620px] max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-100">

            {/* Header */}
            <div className="flex items-start gap-3 mb-5">
              <span className="material-icons-round text-brand-500 mt-0.5">assignment</span>
              <div className="flex-1">
                <h3 className="text-lg font-bold">{detailEntry.kundenname || `ID ${detailEntry.praxedo_id}`}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-400">Praxedo ID: </span>
                  <button
                    onClick={() => { copyToClipboard(`%${detailEntry.kundenname ?? detailEntry.praxedo_id}`); toast('Name kopiert (mit %-Prefix)', 'success'); }}
                    className="font-mono text-xs text-gray-500 hover:text-brand-600 flex items-center gap-1 group"
                    title="Kundenname für Praxedo-Suche kopieren (mit %)"
                  >
                    {detailEntry.praxedo_id}
                    <span className="material-icons-round text-[12px] opacity-0 group-hover:opacity-100 transition">content_copy</span>
                  </button>
                </div>
              </div>
              {detailEntry.erkrankt && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
                  <span className="material-icons-round text-[12px]">sick</span> Erkrankt
                </span>
              )}
              <button onClick={() => setDetailEntry(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
                <span className="material-icons-round">close</span>
              </button>
            </div>

            {/* Kundendaten */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">Kundendaten</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: 'Auftragstyp', val: detailEntry.auftragstyp },
                { label: 'E-Mail',      val: detailEntry.email },
                { label: 'Termin',      val: fmtDate(detailEntry.termin) },
                { label: 'Zeitraum',    val: detailEntry.zeitraum },
                { label: 'Techniker',   val: detailEntry.techniker },
                { label: 'Erstellt',    val: fmtDate(detailEntry.erstellungsdatum) },
              ].map(({ label, val }) => (
                <div key={label} className="bg-gray-50 border border-gray-100 rounded-lg px-3.5 py-2.5">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
                  <div className="text-sm font-medium text-gray-900">{val || '—'}</div>
                </div>
              ))}
            </div>

            {/* Telefon mit Click-to-Call */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Telefon</p>
            <div className="flex gap-2 mb-4">
              <input className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                type="tel" value={detailTelefon} onChange={e => setDetailTelefon(e.target.value)} placeholder="Telefonnummer" />
              {detailTelefon && (
                <a href={`tel:${detailTelefon.replace(/\s/g, '')}`}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition"
                  title="Anrufen">
                  <span className="material-icons-round text-[16px]">call</span> Anrufen
                </a>
              )}
            </div>

            {/* Anrufverlauf */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">Anrufverlauf</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: 'Anrufversuche',   val: String(detailEntry.wahlversuche) },
                { label: 'Letzter Versuch', val: fmtDT(detailEntry.letzter_wahlversuch) },
                { label: 'Fehlergrund',     val: detailEntry.failure_reason },
                { label: 'Rückrufe',        val: String(detailEntry.ruckrufe) },
              ].map(({ label, val }) => (
                <div key={label} className="bg-gray-50 border border-gray-100 rounded-lg px-3.5 py-2.5">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
                  <div className="text-sm font-medium text-gray-900">{val || '—'}</div>
                </div>
              ))}
            </div>

            {/* "Im nächsten Lauf mitnehmen" Button */}
            {detailEntry.status === 'ausstehend' && (
              <div className="mb-4">
                <button onClick={callNextRun}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition w-full justify-center">
                  <span className="material-icons-round text-[16px]">play_arrow</span>
                  Im nächsten Lauf mitnehmen
                </button>
              </div>
            )}

            {/* KI-Analyse */}
            {(detailEntry.ki_zusammenfassung || detailEntry.ki_termin_ergebnis || detailEntry.ki_stimmung) && (
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">KI-Gesprächsanalyse</p>
                <div className="rounded-xl border border-blue-100 bg-blue-50 overflow-hidden divide-y divide-blue-100">
                  {detailEntry.ki_zusammenfassung && (
                    <div className="px-4 py-3">
                      <div className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">Zusammenfassung</div>
                      <div className="text-sm text-gray-700">{detailEntry.ki_zusammenfassung}</div>
                    </div>
                  )}
                  {(detailEntry.ki_termin_ergebnis || detailEntry.ki_naechste_aktion || detailEntry.ki_stimmung) && (
                    <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
                      {[
                        { label: 'Terminergebnis',  val: detailEntry.ki_termin_ergebnis },
                        { label: 'Nächste Aktion',  val: detailEntry.ki_naechste_aktion },
                        { label: 'Stimmung',         val: detailEntry.ki_stimmung },
                        { label: 'Verlässlichkeit',  val: detailEntry.ki_zuverlaessigkeit },
                        { label: 'Gesprächsende',    val: detailEntry.ki_gespraechsende },
                        { label: 'Angehöriger',      val: detailEntry.ki_angehoeriger },
                      ].filter(f => f.val).map(f => (
                        <div key={f.label}>
                          <div className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-0.5">{f.label}</div>
                          <div className="text-sm text-gray-700">{f.val}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Nacharbeiten Abschluss */}
            {detailEntry.status === 'nacharbeiten' && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-3 flex items-center gap-1.5">
                  <span className="material-icons-round text-[14px]">build</span> Nacharbeit abschließen
                </p>
                <select className="w-full px-3.5 py-2.5 bg-white border border-amber-200 rounded-lg text-sm mb-3 focus:outline-none focus:border-brand-500"
                  value={nacharbeitenAbschl} onChange={e => setNacharbeitenAbschl(e.target.value)}>
                  <option value="">Abschlussgrund wählen…</option>
                  <option value="Neuen Termin vereinbart">Neuen Termin vereinbart</option>
                  <option value="Demontage planen">Demontage planen</option>
                  <option value="Storniert">Storniert</option>
                  <option value="Direkt kontaktiert">Direkt kontaktiert</option>
                  <option value="Kein Interesse">Kein Interesse</option>
                  <option value="Erreichbar — Termin bestätigt">Erreichbar — Termin bestätigt</option>
                  <option value="Sonstiges">Sonstiges</option>
                </select>
                <button onClick={nacharbeitenAbschliessen}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition">
                  <span className="material-icons-round text-[16px]">check_circle</span> Abschließen
                </button>
              </div>
            )}

            {/* Interne Notiz */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Interne Notiz</p>
            <textarea className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition mb-4"
              rows={3} value={detailNotiz} onChange={e => setDetailNotiz(e.target.value)} placeholder="Notiz zum Kontakt…" />

            {/* Rückrufzeit */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Rückrufzeit überschreiben</p>
            <input className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm mb-5 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
              type="datetime-local" value={detailCb} onChange={e => setDetailCb(e.target.value)} />

            {/* Kommentare */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">Kommentare</p>
            <div className="mb-3 space-y-2 max-h-48 overflow-y-auto">
              {detailComments.length === 0
                ? <p className="text-xs text-gray-400 py-2">Noch keine Kommentare.</p>
                : detailComments.map(c => (
                  <div key={c.id} className="bg-gray-50 border border-gray-100 rounded-lg px-3.5 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-brand-600">{c.username}</span>
                      <span className="text-xs text-gray-400">{fmtDT(c.created_at)}</span>
                    </div>
                    <div className="text-sm text-gray-700">
                      {c.body.split(/(@\w+)/g).map((part, i) =>
                        /^@\w+/.test(part)
                          ? <span key={i} className="text-brand-600 font-semibold">{part}</span>
                          : <span key={i}>{part}</span>
                      )}
                    </div>
                  </div>
                ))
              }
            </div>
            <div className="flex gap-2 mb-5">
              <input
                className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                placeholder="Kommentar … @Benutzername für Erwähnung"
                value={newComment} onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addComment())}
              />
              <button onClick={addComment}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60"
                disabled={!newComment.trim()}>
                <span className="material-icons-round text-[16px]">send</span>
              </button>
            </div>

            {/* Danger Zone */}
            {detailEntry.status !== 'bestaetigt' && (
              <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-500 mb-1.5">
                  <span className="material-icons-round text-[14px]">warning</span> Aktionen
                </div>
                <div className="flex gap-2">
                  <button onClick={cancelEntry} className="flex items-center gap-1.5 px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition">
                    <span className="material-icons-round text-[14px]">cancel</span> Kontakt abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <button onClick={archiveEntry} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition">
                <span className="material-icons-round text-[14px]">archive</span> Archivieren
              </button>
              <div className="flex gap-2">
                <button onClick={() => setDetailEntry(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 transition">Schließen</button>
                <button onClick={saveDetail} className="flex items-center gap-1.5 px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold shadow shadow-brand-500/20 transition">
                  <span className="material-icons-round text-[16px]">save</span> Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TOASTS ───────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map(t => <Toast key={t.id} t={t} />)}
      </div>
    </div>
  );
}

'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Entry, Stats, ActivityLog, User, Status, deriveStatus } from '@/lib/types';

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

// ── STATUS CONFIG ─────────────────────────────────────────────
const COL_CONFIG: { id: Status; label: string; dot: string; count: string }[] = [
  { id: 'neu',        label: 'Neu',        dot: 'bg-gray-400',   count: 'bg-gray-100 text-gray-500' },
  { id: 'bereit',     label: 'Bereit',     dot: 'bg-blue-500',   count: 'bg-blue-50 text-blue-600' },
  { id: 'in_kontakt', label: 'In Kontakt', dot: 'bg-amber-500',  count: 'bg-amber-50 text-amber-600' },
  { id: 'ruckruf',    label: 'Rückruf',    dot: 'bg-purple-500', count: 'bg-purple-50 text-purple-600' },
  { id: 'uebergeben', label: 'Übergeben',  dot: 'bg-brand-500',  count: 'bg-brand-50 text-brand-700' },
  { id: 'erkrankt',   label: 'Erkrankt',   dot: 'bg-red-500',    count: 'bg-red-50 text-red-600' },
];

// ── BADGE ─────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const cls = type === 'Demontage'
    ? 'bg-red-50 text-red-600 border border-red-200'
    : 'bg-blue-50 text-blue-600 border border-blue-200';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{type}</span>;
}

// ── ATTEMPT DOTS ──────────────────────────────────────────────
function AttemptBar({ count }: { count: number }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Anrufversuche</span><span>{count}/4</span>
      </div>
      <div className="flex gap-1">
        {[1,2,3,4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= count ? (count >= 4 ? 'bg-red-400' : 'bg-amber-400') : 'bg-gray-200'}`} />
        ))}
      </div>
    </div>
  );
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
  const icon = { success: '✓', error: '✗', info: 'i' }[t.type];
  return (
    <div className={`flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium shadow ${cls} min-w-64`}>
      <span className="font-bold">{icon}</span> {t.msg}
    </div>
  );
}

// ── CARD ─────────────────────────────────────────────────────
function KanbanCard({ entry, onClick }: { entry: Entry; onClick: () => void }) {
  const isPastCb = entry.callback_time ? new Date(entry.callback_time) < new Date() : false;
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-3.5 cursor-pointer hover:border-brand-400 hover:shadow-md hover:shadow-brand-500/10 transition-all group"
    >
      <div className="flex items-center gap-2 mb-2">
        <TypeBadge type={entry.auftragstyp} />
      </div>
      <div className="font-semibold text-gray-900 text-sm">{entry.kundenname || <span className="text-gray-400 italic">Wird angereichert…</span>}</div>
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
      {entry.wahlversuche > 0 && <AttemptBar count={entry.wahlversuche} />}
      {entry.notiz && (
        <div className="mt-2 px-2 py-1.5 bg-amber-50 border border-amber-100 rounded text-xs text-amber-700">
          💬 {entry.notiz.substring(0, 70)}{entry.notiz.length > 70 ? '…' : ''}
        </div>
      )}
      {entry.status === 'ruckruf' && entry.callback_time && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${isPastCb ? 'text-red-500' : 'text-purple-600'}`}>
          <span className="material-icons-round" style={{fontSize:13}}>schedule</span>
          {fmtDT(entry.callback_time)}{isPastCb ? ' — ÜBERFÄLLIG' : ''}
        </div>
      )}
      {entry.status === 'uebergeben' && (
        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-600">
          <span className="material-icons-round" style={{fontSize:13}}>check_circle</span>
          {entry.abbruchgrund || 'An Dispo übergeben'}
        </div>
      )}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function Dashboard() {
  const router  = useRouter();
  const [view,      setView]      = useState<'kanban'|'archive'|'log'|'admin'>('kanban');
  const [entries,   setEntries]   = useState<Entry[]>([]);
  const [archive,   setArchive]   = useState<Entry[]>([]);
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [logs,      setLogs]      = useState<ActivityLog[]>([]);
  const [users,     setUsers]     = useState<User[]>([]);
  const [search,    setSearch]    = useState('');
  const [toasts,    setToasts]    = useState<ToastMsg[]>([]);
  const [toastId,   setToastId]   = useState(0);
  const [lastRefresh, setLR]      = useState('');
  const [username,  setUsername]  = useState('');
  const [role,      setRole]      = useState('user');
  const refreshRef = useRef<ReturnType<typeof setInterval>>();

  // — Detail Modal
  const [detailEntry,   setDetailEntry]   = useState<Entry | null>(null);
  const [detailNotiz,   setDetailNotiz]   = useState('');
  const [detailCb,      setDetailCb]      = useState('');
  const [detailTelefon, setDetailTelefon] = useState('');

  // — New Entry Modal
  const [showNew,      setShowNew]      = useState(false);
  const [newId,        setNewId]        = useState('');
  const [newErkrankt,  setNewErkrankt]  = useState(false);
  const [newLoading,   setNewLoading]   = useState(false);

  // — Admin form
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });

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

  // ── LOAD DATA ────────────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    try {
      const data = await api<{ entries: Entry[] }>('/api/entries');
      setEntries(data.entries.map(e => ({ ...e, status: deriveStatus(e) })));
      setLR(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }, []); // eslint-disable-line

  const loadStats = useCallback(async () => {
    try {
      const data = await api<{ stats: Stats }>('/api/stats');
      setStats(data.stats);
    } catch { /* silent */ }
  }, []); // eslint-disable-line

  // ── INIT ─────────────────────────────────────────────────────
  useEffect(() => {
    // Benutzerdaten aus Cookie lesen (optional: eigener /api/me endpoint)
    fetch('/api/auth/login', { method: 'GET' }).catch(() => {});
    loadEntries(); loadStats();
    refreshRef.current = setInterval(() => { loadEntries(); loadStats(); }, 20000);
    return () => clearInterval(refreshRef.current);
  }, []); // eslint-disable-line

  // ── NEW ENTRY ────────────────────────────────────────────────
  async function submitNew() {
    if (!newId.trim()) { toast('Bitte eine Praxedo ID eingeben.', 'error'); return; }
    setNewLoading(true);
    try {
      await api('/api/entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ praxedoId: newId.trim(), erkrankt: newErkrankt }),
      });
      toast(`ID ${newId} eingetragen.`, 'success');
      setShowNew(false); setNewId(''); setNewErkrankt(false);
      loadEntries(); loadStats();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
    finally { setNewLoading(false); }
  }

  // ── DETAIL SAVE ──────────────────────────────────────────────
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

  async function cancelEntry() {
    if (!detailEntry || !confirm(`"${detailEntry.kundenname || detailEntry.praxedo_id}" manuell abbrechen?`)) return;
    try {
      await api(`/api/entries/${detailEntry.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      toast('Kontakt abgebrochen.', 'info');
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

  function openDetail(e: Entry) {
    setDetailEntry(e); setDetailNotiz(e.notiz ?? '');
    setDetailCb(toInputDT(e.callback_time)); setDetailTelefon(e.telefon ?? '');
  }

  // ── ADMIN ────────────────────────────────────────────────────
  async function loadUsers() {
    try { const d = await api<{ users: User[] }>('/api/admin/users'); setUsers(d.users); }
    catch { /* nicht admin */ }
  }
  async function createUser() {
    if (!newUser.username || !newUser.password) { toast('Felder ausfüllen.', 'error'); return; }
    try {
      await api('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser) });
      toast(`Benutzer ${newUser.username} angelegt.`, 'success');
      setNewUser({ username: '', password: '', role: 'user' }); loadUsers();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }
  async function toggleUser(u: User) {
    try {
      await api('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, active: !u.active }) });
      toast(u.active ? 'Deaktiviert.' : 'Aktiviert.', 'info'); loadUsers();
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }
  async function resetPw(u: User) {
    const pw = prompt(`Neues Passwort für "${u.username}":`);
    if (!pw) return;
    try {
      await api('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, newPassword: pw }) });
      toast('Passwort geändert.', 'success');
    } catch (e) { if (e instanceof Error) toast(e.message, 'error'); }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // ── VIEW SWITCH ──────────────────────────────────────────────
  function switchView(v: typeof view) {
    setView(v);
    if (v === 'archive' && archive.length === 0) api<{ entries: Entry[] }>('/api/archive').then(d => setArchive(d.entries)).catch(() => {});
    if (v === 'log')   api<{ logs: ActivityLog[] }>('/api/logs').then(d => setLogs(d.logs)).catch(() => {});
    if (v === 'admin') loadUsers();
  }

  // ── FILTERED CARDS ────────────────────────────────────────────
  const filtered = search
    ? entries.filter(e => [e.praxedo_id, e.kundenname, e.telefon, e.techniker, e.email].some(v => v?.toLowerCase().includes(search.toLowerCase())))
    : entries;

  const activeCards = filtered.filter(e => e.status !== 'final');
  const navCount    = entries.filter(e => e.status !== 'final' && e.status !== 'uebergeben').length;

  // ── NAV ITEM ──────────────────────────────────────────────────
  function NavItem({ id, icon, label, badge }: { id: typeof view; icon: string; label: string; badge?: number }) {
    return (
      <button onClick={() => switchView(id)}
        className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition ${view === id ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
        <span className="material-icons-round text-[18px]">{icon}</span>
        {label}
        {badge !== undefined && <span className="ml-auto bg-brand-100 text-brand-700 text-xs font-bold px-2 py-0.5 rounded-full">{badge}</span>}
      </button>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">

      {/* ── TOP BAR ──────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center gap-4 px-6 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-[180px]">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white shadow">🔔</div>
          <span className="font-bold text-gray-900">Anna Weber</span>
        </div>

        {/* Stats */}
        {stats && (
          <div className="flex gap-2">
            {[
              { label: 'Neu',        val: stats.neu,        cls: 'bg-gray-100 text-gray-600 border-gray-200' },
              { label: 'Bereit',     val: stats.bereit,     cls: 'bg-blue-50 text-blue-700 border-blue-200' },
              { label: 'In Kontakt', val: stats.in_kontakt, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
              { label: 'Rückruf',    val: stats.ruckruf,    cls: 'bg-purple-50 text-purple-700 border-purple-200' },
              { label: 'Übergeben',  val: stats.uebergeben, cls: 'bg-brand-50 text-brand-700 border-brand-200' },
              { label: 'Heute',      val: stats.heute,      cls: 'bg-red-50 text-red-600 border-red-200' },
            ].map(s => (
              <span key={s.label} className={`text-xs font-semibold px-3 py-1 rounded-full border ${s.cls}`}>
                {s.val} {s.label}
              </span>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative ml-auto">
          <span className="material-icons-round absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
          <input
            className="pl-9 pr-3 py-2 bg-gray-100 border border-transparent rounded-lg text-sm focus:outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-400/20 transition w-52 focus:w-72"
            placeholder="Suche…" value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* User + Logout */}
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
          <NavItem id="kanban"  icon="view_kanban"          label="Kanban"  badge={navCount} />
          <NavItem id="archive" icon="inventory_2"          label="Archiv" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 mt-3 mb-1">System</p>
          <NavItem id="log"     icon="history"              label="Aktivitätslog" />
          {role === 'admin' && <NavItem id="admin" icon="admin_panel_settings" label="Admin" />}
          <div className="mt-auto pt-3 border-t border-gray-100 px-3 text-[11px] text-gray-400">
            {lastRefresh ? `↻ ${lastRefresh}` : 'Lade…'}
          </div>
        </nav>

        {/* ── CONTENT ──────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden flex flex-col">

          {/* KANBAN */}
          {view === 'kanban' && (
            <>
              <div className="flex items-center gap-3 px-6 pt-5 pb-0 flex-shrink-0">
                <h2 className="text-xl font-bold">Disposition Queue</h2>
                <span className="text-sm text-gray-400">{activeCards.length} Einträge</span>
                <div className="ml-auto flex gap-2">
                  <button onClick={loadEntries} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 transition">
                    <span className="material-icons-round text-[16px]">refresh</span> Aktualisieren
                  </button>
                  <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold shadow shadow-brand-500/30 transition">
                    <span className="material-icons-round text-[16px]">add</span> Neue Praxedo ID
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-3.5 p-6 pb-6">
                {COL_CONFIG.map(col => {
                  const colCards = activeCards.filter(e => e.status === col.id);
                  return (
                    <div key={col.id} className="flex-shrink-0 w-72 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                        <div className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                        <span className="text-sm font-bold text-gray-800">{col.label}</span>
                        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${col.count}`}>{colCards.length}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto scrollbar-thin p-2.5 flex flex-col gap-2">
                        {colCards.length === 0
                          ? <div className="text-center py-10 text-xs text-gray-400">Keine Einträge</div>
                          : colCards.map(e => <KanbanCard key={e.id} entry={e} onClick={() => openDetail(e)} />)
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
                <button onClick={() => api<{ entries: Entry[] }>('/api/archive').then(d => setArchive(d.entries)).catch(() => {})}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 transition">
                  <span className="material-icons-round text-[16px]">refresh</span> Aktualisieren
                </button>
              </div>
              <div className="flex-1 overflow-auto px-6 pb-6">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      {['Praxedo ID','Name','Telefon','Termin','Zeitraum','Techniker','Typ','Versuche','Abbruchgrund'].map(h => (
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
                        <td className="py-2.5 px-3"><TypeBadge type={e.auftragstyp} /></td>
                        <td className="py-2.5 px-3 text-gray-500">{e.wahlversuche}/4</td>
                        <td className="py-2.5 px-3 text-gray-500">{e.abbruchgrund || '—'}</td>
                      </tr>
                    ))}
                    {archive.length === 0 && (
                      <tr><td colSpan={9} className="py-10 text-center text-gray-400">Keine archivierten Einträge.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* LOG */}
          {view === 'log' && (
            <>
              <div className="flex items-center gap-3 px-6 pt-5 pb-4 flex-shrink-0">
                <h2 className="text-xl font-bold">Aktivitätslog</h2>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin px-6 pb-6">
                {logs.map(l => (
                  <div key={l.id} className="flex gap-4 py-2.5 border-b border-gray-100 text-sm">
                    <span className="text-xs font-mono text-gray-400 whitespace-nowrap min-w-[130px]">{fmtDT(l.created_at)}</span>
                    <span className="font-semibold text-brand-600 min-w-[90px]">{l.username}</span>
                    <span className="font-medium text-gray-700 min-w-[140px]">{l.action}</span>
                    <span className="text-gray-400">{l.details}</span>
                  </div>
                ))}
                {logs.length === 0 && <p className="py-10 text-center text-gray-400">Keine Einträge.</p>}
              </div>
            </>
          )}

          {/* ADMIN */}
          {view === 'admin' && (
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-xl font-bold mb-5">Benutzerverwaltung</h2>
              {/* Add user */}
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
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button onClick={createUser} className="w-full flex items-center justify-center gap-1.5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold transition shadow shadow-brand-500/20">
                      <span className="material-icons-round text-[16px]">add</span> Anlegen
                    </button>
                  </div>
                </div>
              </div>
              {/* User list */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 font-semibold text-sm flex items-center gap-2">
                  <span className="material-icons-round text-brand-500 text-[18px]">group</span> Benutzer
                </div>
                <div className="divide-y divide-gray-100">
                  {users.map(u => (
                    <div key={u.id} className={`flex items-center gap-3 px-5 py-3.5 ${!u.active ? 'opacity-50' : ''}`}>
                      <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-sm">{u.username[0].toUpperCase()}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{u.username}</div>
                        <div className="text-xs text-gray-400">{u.role === 'admin' ? '👑 Admin' : '👤 Mitarbeiter'} · {u.last_login ? fmtDT(u.last_login) : 'Noch nie'}</div>
                      </div>
                      <button onClick={() => resetPw(u)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 transition">🔑 PW</button>
                      <button onClick={() => toggleUser(u)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${u.active ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'}`}>
                        {u.active ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                    </div>
                  ))}
                  {users.length === 0 && <p className="py-6 text-center text-gray-400 text-sm">Keine Benutzer.</p>}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── MODAL: NEUER EINTRAG ──────────────────────────────── */}
      {showNew && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="bg-white rounded-2xl p-7 w-[440px] shadow-2xl border border-gray-100">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="material-icons-round text-brand-500">add_circle</span>
              <h3 className="text-lg font-bold">Neue Praxedo ID eintragen</h3>
              <button onClick={() => setShowNew(false)} className="ml-auto p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Praxedo ID *</label>
            <input
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-xl font-bold font-mono tracking-widest focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
              value={newId} onChange={e => setNewId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitNew()}
              placeholder="123456" autoFocus
            />
            {/* Erkrankt Toggle */}
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

            <div className="mt-3 p-3.5 bg-brand-50 border border-brand-100 rounded-xl text-xs text-brand-700 flex gap-2">
              <span className="material-icons-round text-brand-500 text-[15px] mt-0.5">info</span>
              <span>Die Automation holt automatisch alle Kundendaten aus Praxedo. Anna startet den Anruf beim nächsten Durchlauf.</span>
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

      {/* ── MODAL: DETAIL ─────────────────────────────────────── */}
      {detailEntry && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center" onClick={e => e.target === e.currentTarget && setDetailEntry(null)}>
          <div className="bg-white rounded-2xl p-7 w-[580px] max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100">
            {/* Header */}
            <div className="flex items-start gap-3 mb-6">
              <span className="material-icons-round text-brand-500 mt-0.5">assignment</span>
              <div>
                <h3 className="text-lg font-bold">{detailEntry.kundenname || `ID ${detailEntry.praxedo_id}`}</h3>
                <div className="text-xs text-gray-400">Praxedo ID: {detailEntry.praxedo_id}</div>
              </div>
              <button onClick={() => setDetailEntry(null)} className="ml-auto p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
                <span className="material-icons-round">close</span>
              </button>
            </div>

            {/* Info Grid */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">Kundendaten</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {[
                { label: 'Auftragstyp',   val: detailEntry.auftragstyp },
                { label: 'E-Mail',        val: detailEntry.email },
                { label: 'Termin',        val: fmtDate(detailEntry.termin) },
                { label: 'Zeitraum',      val: detailEntry.zeitraum },
                { label: 'Techniker',     val: detailEntry.techniker },
                { label: 'Erstellt',      val: fmtDate(detailEntry.erstellungsdatum) },
              ].map(({ label, val }) => (
                <div key={label} className="bg-gray-50 border border-gray-100 rounded-lg px-3.5 py-2.5">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
                  <div className="text-sm font-medium text-gray-900">{val || '—'}</div>
                </div>
              ))}
            </div>

            {/* Telefon editierbar */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Telefon</p>
            <input className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm mb-5 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
              type="tel" value={detailTelefon} onChange={e => setDetailTelefon(e.target.value)} placeholder="Telefonnummer" />

            {/* Anrufverlauf */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">Anrufverlauf</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {[
                { label: 'Anrufversuche',   val: `${detailEntry.wahlversuche} / 4` },
                { label: 'Letzter Versuch', val: fmtDT(detailEntry.letzter_wahlversuch) },
                { label: 'Abbruchgrund',    val: detailEntry.abbruchgrund },
                { label: 'Dispo-Info',      val: detailEntry.dispo_info },
                { label: 'Fehlergrund',     val: detailEntry.failure_reason },
                { label: 'Rückrufe',        val: String(detailEntry.ruckrufe) },
              ].map(({ label, val }) => (
                <div key={label} className="bg-gray-50 border border-gray-100 rounded-lg px-3.5 py-2.5">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
                  <div className="text-sm font-medium text-gray-900">{val || '—'}</div>
                </div>
              ))}
            </div>

            {/* Notiz */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Interne Notiz</p>
            <textarea className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition mb-4"
              rows={3} value={detailNotiz} onChange={e => setDetailNotiz(e.target.value)} placeholder="Notiz zum Kontakt…" />

            {/* Rückrufzeit */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Rückrufzeit</p>
            <input className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm mb-5 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
              type="datetime-local" value={detailCb} onChange={e => setDetailCb(e.target.value)} />

            {/* Danger Zone */}
            {detailEntry.status !== 'uebergeben' && (
              <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-500 mb-1.5">
                  <span className="material-icons-round text-[14px]">warning</span> Aktion
                </div>
                <p className="text-xs text-gray-500 mb-3">Kontakt manuell abbrechen und an Disposition übergeben.</p>
                <button onClick={cancelEntry} className="flex items-center gap-1.5 px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition">
                  <span className="material-icons-round text-[14px]">cancel</span> Kontakt abbrechen
                </button>
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

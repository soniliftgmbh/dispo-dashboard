'use client';
import { useState, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  async function login() {
    if (!username || !password) { setError('Alle Felder ausfüllen.'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) router.push('/dashboard');
      else setError(data.error ?? 'Anmeldung fehlgeschlagen.');
    } catch { setError('Netzwerkfehler.'); }
    finally   { setLoading(false); }
  }

  function onKey(e: KeyboardEvent) { if (e.key === 'Enter') login(); }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-brand-100 to-gray-50">
      <div className="bg-white border border-gray-200 rounded-2xl p-12 w-96 shadow-xl">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-9">
          <div className="w-11 h-11 bg-brand-500 rounded-xl flex items-center justify-center text-white text-xl shadow-md">🔔</div>
          <div>
            <div className="font-bold text-lg text-gray-900">Sonilift</div>
            <div className="text-xs text-gray-400">Dispositions-Dashboard</div>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-1">Anmelden</h1>
        <p className="text-sm text-gray-500 mb-7">Anna Weber — Wartungsplanung</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Benutzername</label>
            <input
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
              value={username} onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && document.getElementById('pw')?.focus()}
              placeholder="Benutzername" autoComplete="username" autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Passwort</label>
            <input id="pw"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={onKey} placeholder="••••••••" autoComplete="current-password"
            />
          </div>
        </div>

        <button
          onClick={login} disabled={loading}
          className="w-full mt-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg shadow-md shadow-brand-500/30 transition disabled:opacity-60"
        >
          {loading ? 'Anmelden…' : 'Anmelden'}
        </button>

        {error && (
          <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
        )}
      </div>
    </div>
  );
}

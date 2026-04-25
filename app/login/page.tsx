'use client';
import { useState, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Wordmark } from '@/lib/ui/Wordmark';
import { ThemeToggle } from '@/lib/ui/ThemeToggle';

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
      if (res.ok) {
        localStorage.setItem('session_info', JSON.stringify({
          username:    data.username,
          role:        data.role,
          permissions: data.permissions ?? [],
        }));
        router.push('/dashboard');
      } else setError(data.error ?? 'Anmeldung fehlgeschlagen.');
    } catch { setError('Netzwerkfehler.'); }
    finally   { setLoading(false); }
  }

  function onKey(e: KeyboardEvent) { if (e.key === 'Enter') login(); }

  return (
    <div className="min-h-screen bg-bg-subtle flex flex-col">
      {/* Top-right utilities */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] animate-slide-up">
          {/* Brand */}
          <div className="flex flex-col items-center gap-2 mb-10">
            <Wordmark className="h-9 text-ink" style={{ width: 'auto' }} />
            <div className="text-xs text-ink-faint tracking-wide">Sonilift Disposition</div>
          </div>

          <div className="card p-8">
            <h1 className="text-xl font-semibold text-ink mb-1">Anmelden</h1>
            <p className="text-sm text-ink-muted mb-6">Anna Weber, Wartungsplanung</p>

            <div className="space-y-4">
              <div>
                <label htmlFor="login-user" className="block text-xs font-medium text-ink-faint uppercase tracking-wide mb-1.5">
                  Benutzername
                </label>
                <input
                  id="login-user"
                  className="input"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && document.getElementById('pw')?.focus()}
                  placeholder="benutzername"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="pw" className="block text-xs font-medium text-ink-faint uppercase tracking-wide mb-1.5">
                  Passwort
                </label>
                <input
                  id="pw"
                  className="input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              onClick={login}
              disabled={loading}
              className="btn btn-primary btn-lg w-full mt-6"
            >
              {loading ? 'Anmelden …' : 'Anmelden'}
            </button>

            {error && (
              <div
                role="alert"
                className="mt-4 px-3.5 py-2.5 rounded-md text-sm border"
                style={{
                  backgroundColor: 'rgb(var(--status-cancelled) / 0.10)',
                  borderColor: 'rgb(var(--status-cancelled) / 0.30)',
                  color: 'rgb(var(--status-cancelled))',
                }}
              >
                {error}
              </div>
            )}
          </div>

          <p className="text-center text-xs text-ink-faint mt-6">
            Probleme beim Anmelden? Wende dich an die Admins.
          </p>
        </div>
      </div>
    </div>
  );
}

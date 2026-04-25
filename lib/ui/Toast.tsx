'use client';
import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';
export interface ToastMsg { id: number; msg: string; type: ToastType }

const ICON: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
};

const TOKEN: Record<ToastType, string> = {
  success: 'confirmed',
  error: 'cancelled',
  info: 'active',
};

export function ToastItem({ t, onDismiss }: { t: ToastMsg; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(t.id), 4000);
    return () => clearTimeout(timer);
  }, [t.id, onDismiss]);

  const tok = TOKEN[t.type];
  return (
    <div
      role="status"
      className="modal-panel floating animate-slide-in-right flex items-center gap-3 px-4 py-3 min-w-[280px] max-w-md"
    >
      <span
        className="pill-dot"
        style={{ width: 8, height: 8, backgroundColor: `rgb(var(--status-${tok}))` }}
      />
      <span className="material-icons-round" style={{ fontSize: 18, color: `rgb(var(--status-${tok}))` }}>
        {ICON[t.type]}
      </span>
      <span className="text-sm font-medium flex-1">{t.msg}</span>
      <button
        onClick={() => onDismiss(t.id)}
        className="text-ink-faint hover:text-ink transition-colors"
        aria-label="Schließen"
      >
        <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastMsg[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none [&>*]:pointer-events-auto">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

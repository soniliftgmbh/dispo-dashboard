'use client';
import { ReactNode, useEffect } from 'react';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** width in px desktop, defaults to 640 */
  width?: number;
  ariaLabel?: string;
}

export function SlidePanel({ open, onClose, children, width = 640, ariaLabel }: SlidePanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className="slide-panel floating absolute right-0 top-0 h-full flex flex-col animate-slide-from-right"
        style={{ width: `min(${width}px, 100vw)` }}
      >
        {children}
      </div>
    </div>
  );
}

export function SlidePanelHeader({
  title, subtitle, onClose, right,
}: {
  title: ReactNode; subtitle?: ReactNode; onClose: () => void; right?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-4 border-b-[1.5px] border-line flex-shrink-0">
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-semibold text-ink truncate">{title}</h3>
        {subtitle && <div className="mt-0.5 text-xs text-ink-faint">{subtitle}</div>}
      </div>
      {right}
      <button
        onClick={onClose}
        className="btn btn-ghost !h-8 !w-8 !p-0 -mr-2"
        aria-label="Schließen"
      >
        <span className="material-icons-round" style={{ fontSize: 18 }}>close</span>
      </button>
    </div>
  );
}

export function SlidePanelFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-5 py-3 border-t-[1.5px] border-line flex-shrink-0 bg-bg-elevated">
      {children}
    </div>
  );
}

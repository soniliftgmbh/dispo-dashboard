'use client';
import { ReactNode, useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** max-width in px. Default 720, detail uses 920. */
  maxWidth?: number;
  /** Optional title for the visually hidden a11y label. */
  ariaLabel?: string;
}

export function Modal({ open, onClose, children, maxWidth = 720, ariaLabel }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        ref={panelRef}
        className="modal-panel floating animate-slide-up w-full max-h-[92vh] overflow-y-auto"
        style={{ maxWidth: `${maxWidth}px` }}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({
  title, subtitle, onClose, right,
}: {
  title: string; subtitle?: ReactNode; onClose: () => void; right?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-6 py-4 border-b border-line">
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

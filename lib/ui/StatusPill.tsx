import { Status } from '@/lib/types';

const LABEL: Record<Status, string> = {
  ausstehend: 'Ausstehend',
  aktiv: 'Aktiv',
  nacharbeiten: 'Nacharbeiten',
  abgebrochen: 'Abgebrochen',
  bestaetigt: 'Bestätigt',
  final: 'Final',
};

const TOKEN: Record<Status, string> = {
  ausstehend: 'pending',
  aktiv: 'active',
  nacharbeiten: 'rework',
  abgebrochen: 'cancelled',
  bestaetigt: 'confirmed',
  final: 'confirmed',
};

export function StatusDot({ status, className = '' }: { status: Status; className?: string }) {
  const tok = TOKEN[status];
  return (
    <span
      className={`pill-dot ${className}`}
      style={{ backgroundColor: `rgb(var(--status-${tok}))` }}
      aria-hidden
    />
  );
}

export function StatusPill({ status, label }: { status: Status; label?: string }) {
  const tok = TOKEN[status];
  return (
    <span
      className="pill"
      style={{
        color: `rgb(var(--status-${tok}))`,
        backgroundColor: `rgb(var(--status-${tok}) / 0.12)`,
      }}
    >
      <StatusDot status={status} />
      {label ?? LABEL[status]}
    </span>
  );
}

export function StatusBar({ status, className = '' }: { status: Status; className?: string }) {
  const tok = TOKEN[status];
  return (
    <span
      className={`block h-0.5 w-full rounded-full ${className}`}
      style={{ backgroundColor: `rgb(var(--status-${tok}))` }}
      aria-hidden
    />
  );
}

export const STATUS_LABELS = LABEL;

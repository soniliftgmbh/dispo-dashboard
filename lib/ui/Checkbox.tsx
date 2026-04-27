'use client';

interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
  className?: string;
  /** stop propagation on click — useful on cards */
  stopProp?: boolean;
}

export function Checkbox({ checked, onChange, ariaLabel, className = '', stopProp }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => { if (stopProp) e.stopPropagation(); onChange(!checked); }}
      className={`checkbox ${checked ? 'checked' : ''} ${className}`}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="rgb(var(--primary-fg))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.5l2.5 2.5 4.5-5" />
        </svg>
      )}
    </button>
  );
}

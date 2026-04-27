'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, ariaLabel, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`toggle ${checked ? 'on' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className="knob" />
    </button>
  );
}

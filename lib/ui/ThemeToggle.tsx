'use client';
import { useTheme } from '@/lib/theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      className={`btn btn-ghost btn-sm !px-2 ${className}`}
      aria-label={isDark ? 'Light Mode aktivieren' : 'Dark Mode aktivieren'}
      title={isDark ? 'Light Mode' : 'Dark Mode'}
    >
      <span className="material-icons-round" style={{ fontSize: '18px' }}>
        {isDark ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  );
}

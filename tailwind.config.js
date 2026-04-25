/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic tokens — driven by CSS variables in globals.css
        bg: {
          base: 'rgb(var(--bg-base) / <alpha-value>)',
          subtle: 'rgb(var(--bg-subtle) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
          sunken: 'rgb(var(--bg-sunken) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--text) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
          faint: 'rgb(var(--text-faint) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--primary-base) / <alpha-value>)',
          hover: 'rgb(var(--primary-hover) / <alpha-value>)',
          press: 'rgb(var(--primary-press) / <alpha-value>)',
          fg: 'rgb(var(--primary-fg) / <alpha-value>)',
          soft: 'rgb(var(--primary-soft) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-base) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          fg: 'rgb(var(--accent-fg) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
        },
        status: {
          pending: 'rgb(var(--status-pending) / <alpha-value>)',
          active: 'rgb(var(--status-active) / <alpha-value>)',
          rework: 'rgb(var(--status-rework) / <alpha-value>)',
          cancelled: 'rgb(var(--status-cancelled) / <alpha-value>)',
          confirmed: 'rgb(var(--status-confirmed) / <alpha-value>)',
        },
        // Legacy brand alias — keep building until full migration
        brand: {
          50: '#f6fbe8', 100: '#ebf5d0', 200: '#d5eba1', 300: '#bbdc68',
          400: '#a5cf3a', 500: '#95c11e', 600: '#789a18', 700: '#5c7512',
          800: '#465a0f', 900: '#384a0d',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SF Mono', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.8125rem', { lineHeight: '1.5' }],
        base: ['0.9375rem', { lineHeight: '1.55' }],
        lg: ['1.0625rem', { lineHeight: '1.4', letterSpacing: '-0.005em' }],
        xl: ['1.3125rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        '2xl': ['1.625rem', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        '3xl': ['2rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        sm: '6px', md: '10px', lg: '14px', xl: '20px',
      },
      boxShadow: {
        sm: '0 1px 2px rgb(0 0 0 / 0.04)',
        md: '0 4px 12px rgb(0 0 0 / 0.06), 0 2px 4px rgb(0 0 0 / 0.04)',
        lg: '0 12px 32px rgb(0 0 0 / 0.10), 0 4px 12px rgb(0 0 0 / 0.06)',
        ring: '0 0 0 2px rgb(var(--bg-base)), 0 0 0 4px rgb(var(--primary-base) / 0.5)',
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        120: '120ms', 180: '180ms', 240: '240ms',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-up': 'slide-up 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 240ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

import { SVGProps } from 'react';

/**
 * Anna Wordmark — replaces the bell emoji.
 * Custom letter-spacing, lime accent dot on the second 'n' descender.
 * Sizes via className (font-size on the wrapper drives the SVG via em units would be overkill — we use fixed sizes).
 */
export function Wordmark({ className = '', ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 88 28"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="anna"
      {...rest}
    >
      <text
        x="0"
        y="22"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
        fontSize="24"
        letterSpacing="-0.04em"
        fill="currentColor"
      >
        anna
      </text>
      <circle cx="78" cy="22" r="3" fill="rgb(var(--accent-base))" />
    </svg>
  );
}

/**
 * Compact monogram for favicons / small avatars.
 */
export function WordmarkMark({ className = '', ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="anna"
      {...rest}
    >
      <rect width="32" height="32" rx="8" fill="rgb(var(--primary-base))" />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
        fontSize="18"
        letterSpacing="-0.04em"
        fill="rgb(var(--primary-fg))"
      >
        a
      </text>
      <circle cx="24" cy="9" r="2.5" fill="rgb(var(--accent-base))" />
    </svg>
  );
}

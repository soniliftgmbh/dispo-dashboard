'use client';
import { useEffect } from 'react';

export function PrintAutoTrigger() {
  useEffect(() => {
    const t = setTimeout(() => {
      try { window.print(); } catch { /* ignore */ }
    }, 350);
    return () => clearTimeout(t);
  }, []);
  return null;
}

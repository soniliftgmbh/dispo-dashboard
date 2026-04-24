import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireSession, requireAdmin } from '@/lib/auth';

// GET — alle Einstellungen (oder einzelne per ?key=)
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const key = url.searchParams.get('key');

    if (key) {
      const result = await pool.query(`SELECT key, value FROM settings WHERE key = $1`, [key]);
      return NextResponse.json({ ok: true, setting: result.rows[0] ?? null });
    }

    const result = await pool.query(`SELECT key, value FROM settings ORDER BY key`);
    return NextResponse.json({ ok: true, settings: result.rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

// PATCH — Einstellung setzen (nur Admin)
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const { key, value } = await req.json();
    if (!key) return NextResponse.json({ error: 'key fehlt.' }, { status: 400 });

    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, String(value)]
    );
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: msg === 'Keine Berechtigung' ? 403 : 500 });
  }
}

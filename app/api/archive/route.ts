import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Entry, deriveStatus } from '@/lib/types';

export async function GET() {
  try {
    await requireSession();
    const result = await pool.query<Entry>(
      `SELECT * FROM entries WHERE archived = true ORDER BY archived_at DESC LIMIT 500`
    );
    const entries = result.rows.map(e => ({ ...e, status: deriveStatus(e) }));
    return NextResponse.json({ ok: true, entries });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

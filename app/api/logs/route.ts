import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireSession } from '@/lib/auth';

export async function GET() {
  try {
    await requireSession();
    const result = await pool.query(
      `SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 300`
    );
    return NextResponse.json({ ok: true, logs: result.rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

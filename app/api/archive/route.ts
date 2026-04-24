import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireSession, canViewArchive } from '@/lib/auth';
import { Entry, deriveStatus } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    if (!canViewArchive(session)) {
      return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
    }

    const url   = new URL(req.url);
    const board = url.searchParams.get('board');

    let query  = `SELECT * FROM entries WHERE archived = true ORDER BY archived_at DESC LIMIT 500`;
    const params: string[] = [];

    if (board) {
      query  = `SELECT * FROM entries WHERE archived = true AND board_type = $1 ORDER BY archived_at DESC LIMIT 500`;
      params.push(board);
    }

    const result = await pool.query<Entry>(query, params);
    const entries = result.rows.map(e => ({ ...e, status: deriveStatus(e) }));
    return NextResponse.json({ ok: true, entries });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

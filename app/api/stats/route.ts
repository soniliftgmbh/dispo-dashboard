import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url   = new URL(req.url);
    const board = url.searchParams.get('board');

    const boardFilter = board ? `AND board_type = '${board}'` : '';

    const result = await pool.query(`
      SELECT
        COUNT(*)                                                                                        AS total,
        COUNT(*) FILTER (WHERE outcome IS NULL AND NOT is_calling AND NOT final ${boardFilter})        AS ausstehend,
        COUNT(*) FILTER (WHERE is_calling AND NOT final ${boardFilter})                                AS aktiv,
        COUNT(*) FILTER (WHERE outcome = 'nacharbeiten' AND NOT final ${boardFilter})                  AS nacharbeiten,
        COUNT(*) FILTER (WHERE outcome = 'bestaetigt' AND NOT final ${boardFilter})                    AS bestaetigt,
        COUNT(*) FILTER (WHERE DATE(termin AT TIME ZONE 'Europe/Berlin') = CURRENT_DATE AND NOT archived ${boardFilter}) AS heute
      FROM entries
      WHERE archived = false AND NOT final
      ${boardFilter}
    `);
    return NextResponse.json({ ok: true, stats: result.rows[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireSession, canViewStats } from '@/lib/auth';

export async function GET() {
  try {
    const session = await requireSession();
    if (!canViewStats(session)) {
      return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
    }

    // Gesamt-Zahlen
    const totals = await pool.query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE outcome = 'bestaetigt')       AS bestaetigt,
        COUNT(*) FILTER (WHERE outcome = 'nacharbeiten')     AS nacharbeiten,
        COUNT(*) FILTER (WHERE outcome IS NULL AND NOT final) AS ausstehend,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE outcome = 'bestaetigt') /
          NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0), 1
        ) AS success_rate,
        ROUND(
          AVG(wahlversuche) FILTER (WHERE outcome = 'bestaetigt'), 1
        ) AS avg_attempts,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE outcome = 'bestaetigt' AND wahlversuche = 1) /
          NULLIF(COUNT(*) FILTER (WHERE outcome = 'bestaetigt'), 0), 1
        ) AS first_attempt_rate
      FROM entries WHERE archived = false OR outcome = 'bestaetigt'
    `);

    // Ablehnungsgründe (abbruchgrund bei nacharbeiten)
    const reasons = await pool.query(`
      SELECT abbruchgrund AS reason, COUNT(*) AS count
      FROM entries
      WHERE outcome = 'nacharbeiten' AND abbruchgrund IS NOT NULL
      GROUP BY abbruchgrund
      ORDER BY count DESC
      LIMIT 10
    `);

    // Pro Board
    const byBoard = await pool.query(`
      SELECT
        board_type                                             AS board,
        COUNT(*)                                               AS total,
        COUNT(*) FILTER (WHERE outcome = 'bestaetigt')        AS bestaetigt
      FROM entries
      WHERE board_type IS NOT NULL
      GROUP BY board_type
      ORDER BY board_type
    `);

    return NextResponse.json({
      ok: true,
      overview: {
        ...totals.rows[0],
        rejection_reasons: reasons.rows,
        by_board:          byBoard.rows,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

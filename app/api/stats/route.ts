import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireSession } from '@/lib/auth';

export async function GET() {
  try {
    await requireSession();
    const result = await pool.query(`
      SELECT
        COUNT(*)                                                         AS total,
        COUNT(*) FILTER (WHERE kundenname IS NULL AND dispo_info IS DISTINCT FROM '-' AND dispo_info IS DISTINCT FROM 'Übergeben' AND NOT final) AS neu,
        COUNT(*) FILTER (WHERE kundenname IS NOT NULL AND wahlversuche = 0 AND callback_time IS NULL AND dispo_info IS DISTINCT FROM '-' AND dispo_info IS DISTINCT FROM 'Übergeben' AND NOT final) AS bereit,
        COUNT(*) FILTER (WHERE kundenname IS NOT NULL AND wahlversuche > 0 AND callback_time IS NULL AND dispo_info IS DISTINCT FROM '-' AND dispo_info IS DISTINCT FROM 'Übergeben' AND NOT final) AS in_kontakt,
        COUNT(*) FILTER (WHERE callback_time IS NOT NULL AND dispo_info IS DISTINCT FROM '-' AND dispo_info IS DISTINCT FROM 'Übergeben' AND NOT final) AS ruckruf,
        COUNT(*) FILTER (WHERE dispo_info IN ('-', 'Übergeben') AND NOT final)   AS uebergeben,
        COUNT(*) FILTER (WHERE DATE(termin AT TIME ZONE 'Europe/Berlin') = CURRENT_DATE AND NOT archived) AS heute
      FROM entries
      WHERE archived = false
    `);
    return NextResponse.json({ ok: true, stats: result.rows[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

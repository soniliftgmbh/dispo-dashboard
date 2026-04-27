import { NextResponse } from 'next/server';
import pool, { addLog } from '@/lib/db';
import { requireSession } from '@/lib/auth';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    if (session.role !== 'admin' && session.role !== 'power_user') {
      return NextResponse.json({ error: 'Keine Berechtigung.' }, { status: 403 });
    }

    // praxedo_id für Log holen
    const meta = await pool.query<{ praxedo_id: string }>(
      `SELECT praxedo_id FROM entries WHERE id = $1`,
      [params.id]
    );
    const praxedoId = meta.rows[0]?.praxedo_id ?? params.id;

    // Verwandte Daten löschen (falls keine FK CASCADE existiert).
    await pool.query(`DELETE FROM comments WHERE entry_id = $1`, [params.id]).catch(() => {});
    await pool.query(`DELETE FROM entries  WHERE id = $1`, [params.id]);

    await addLog(session.username, 'HARD_DELETE', `ID: ${praxedoId} unwiderruflich gelöscht`);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: msg === 'Nicht angemeldet' ? 401 : 500 });
  }
}

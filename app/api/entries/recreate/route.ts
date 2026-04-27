import { NextRequest, NextResponse } from 'next/server';
import pool, { addLog } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { deriveStatus, deriveBoard, auftragsTypFromId, Entry } from '@/lib/types';

// POST /api/entries/recreate
// Body: { praxedoId: string, erkrankt?: boolean }
// Erstellt einen neuen aktiven Eintrag für eine Praxedo-ID, deren vorherige
// Variante archiviert ist. Setzt voraus, dass der partielle Unique-Index
// `uniq_active_praxedo_id` (siehe Migration v4) angewendet wurde.
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { praxedoId, erkrankt } = await req.json();
    if (!praxedoId) return NextResponse.json({ error: 'Praxedo ID fehlt.' }, { status: 400 });

    const id            = String(praxedoId).trim();
    const detectedBoard = deriveBoard(id);

    if (session.role !== 'admin') {
      const allowed = (session.permissions ?? []).includes(`board:${detectedBoard}`);
      if (!allowed) {
        return NextResponse.json({ error: `Du hast keine Berechtigung für das Board "${detectedBoard}".` }, { status: 403 });
      }
    }

    // Sicherheitsnetz: existiert noch ein aktiver Eintrag für die ID?
    const active = await pool.query<{ id: string }>(
      `SELECT id FROM entries WHERE praxedo_id = $1 AND archived = false LIMIT 1`,
      [id]
    );
    if (active.rows.length > 0) {
      return NextResponse.json({
        error: 'duplicate_active',
        message: 'Es existiert bereits ein aktiver Eintrag mit dieser ID.',
      }, { status: 409 });
    }

    const auftragstyp = auftragsTypFromId(id);

    const result = await pool.query<Entry>(
      `INSERT INTO entries (praxedo_id, erkrankt, board_type, auftragstyp, erstellungsdatum, added_by)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       RETURNING *`,
      [id, !!erkrankt, detectedBoard, auftragstyp, session.username]
    );

    await addLog(session.username, 'NEU_BEHANDELT', `ID: ${id} [${detectedBoard}] aus Archiv reaktiviert`);

    const webhookUrl = process.env.MAKE_ENRICHMENT_WEBHOOK;
    if (webhookUrl) {
      fetch(webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ praxedoId: id, entryId: result.rows[0].id, erkrankt: !!erkrankt, addedBy: session.username, timestamp: new Date().toISOString() }),
      }).catch(() => {});
    }

    const entry = { ...result.rows[0], status: deriveStatus(result.rows[0]) };
    return NextResponse.json({ ok: true, entry });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: msg === 'Nicht angemeldet' ? 401 : 500 });
  }
}

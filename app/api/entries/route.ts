import { NextRequest, NextResponse } from 'next/server';
import pool, { addLog } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { deriveStatus, Entry } from '@/lib/types';

// GET — alle aktiven Einträge (Kanban)
export async function GET() {
  try {
    await requireSession();
    const result = await pool.query<Entry>(
      `SELECT * FROM entries WHERE archived = false ORDER BY created_at ASC`
    );
    const entries = result.rows.map(e => ({ ...e, status: deriveStatus(e) }));
    return NextResponse.json({ ok: true, entries });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

// POST — neue Praxedo ID eintragen
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { praxedoId, erkrankt } = await req.json();
    if (!praxedoId) return NextResponse.json({ error: 'Praxedo ID fehlt.' }, { status: 400 });

    // Präfix aus praxedo_id extrahieren (WARTUNG / DEMONTAGE / STÖRUNG)
    const prefix      = String(praxedoId).split('-')[0] ?? '';
    const auftragstyp = erkrankt ? `${prefix} erkrankt` : null;

    const result = await pool.query<Entry>(
      `INSERT INTO entries (praxedo_id, auftragstyp, erstellungsdatum, added_by)
       VALUES ($1, $2, NOW(), $3)
       RETURNING *`,
      [String(praxedoId), auftragstyp, session.username]
    );

    await addLog(session.username, 'NEUER_EINTRAG', `ID: ${praxedoId}${erkrankt ? ' [ERKRANKT]' : ''}`);

    // Make-Webhook für Praxedo-Anreicherung triggern
    const webhookUrl = process.env.MAKE_ENRICHMENT_WEBHOOK;
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ praxedoId, entryId: result.rows[0].id, erkrankt: !!erkrankt, addedBy: session.username, timestamp: new Date().toISOString() }),
      }).catch(() => {});
    }

    const entry = { ...result.rows[0], status: deriveStatus(result.rows[0]) };
    return NextResponse.json({ ok: true, entry });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    const status = msg.includes('unique') ? 409 : msg === 'Nicht angemeldet' ? 401 : 500;
    const error  = msg.includes('unique') ? `Praxedo ID bereits vorhanden.` : msg;
    return NextResponse.json({ error }, { status });
  }
}

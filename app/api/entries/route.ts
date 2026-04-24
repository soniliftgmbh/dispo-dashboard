import { NextRequest, NextResponse } from 'next/server';
import pool, { addLog } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { deriveStatus, deriveBoard, auftragsTypFromId, Entry } from '@/lib/types';

// GET — alle aktiven Einträge (Kanban)
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const url     = new URL(req.url);
    const board   = url.searchParams.get('board');

    let query = `SELECT * FROM entries WHERE archived = false ORDER BY created_at ASC`;
    const params: string[] = [];

    if (board) {
      query  = `SELECT * FROM entries WHERE archived = false AND board_type = $1 ORDER BY created_at ASC`;
      params.push(board);
    }

    const result = await pool.query<Entry>(query, params);

    // Auto-Archivierung von "Bestätigt"-Einträgen nach konfigurierten Tagen
    const settingRes = await pool.query(
      `SELECT value FROM settings WHERE key = 'auto_archive_days_bestaetigt'`
    );
    const archiveDays = parseInt(settingRes.rows[0]?.value ?? '2', 10);
    if (archiveDays > 0) {
      await pool.query(
        `UPDATE entries SET archived = true, archived_at = NOW(), updated_at = NOW()
         WHERE outcome = 'bestaetigt'
           AND archived = false
           AND updated_at < NOW() - ($1 || ' days')::INTERVAL`,
        [archiveDays]
      );
    }

    // Unread-Marker setzen: Einträge die seit letztem Login aktualisiert wurden
    const entries = result.rows.map(e => ({
      ...e,
      status:   deriveStatus(e),
      // Zeige unread-dot wenn session-user in unread_by Array
      has_unread: (e.unread_by ?? []).includes(session.username),
    }));

    return NextResponse.json({ ok: true, entries });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

// POST — neue Praxedo ID eintragen (einzeln)
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { praxedoId, erkrankt, board } = await req.json();
    if (!praxedoId) return NextResponse.json({ error: 'Praxedo ID fehlt.' }, { status: 400 });

    const id = String(praxedoId).trim();

    // Board-Typ aus ID ableiten
    const detectedBoard = deriveBoard(id);

    // Berechtigungs-Check: Darf der User in diesem Board eintragen?
    if (session.role !== 'admin') {
      const allowed = (session.permissions ?? []).includes(`board:${detectedBoard}`);
      if (!allowed) {
        return NextResponse.json({
          error: `Du hast keine Berechtigung für das Board "${detectedBoard}". Diese ID gehört nicht zu deinen zugewiesenen Auftragstypen.`
        }, { status: 403 });
      }
    }

    // Board-Kontext-Check: Wenn board-Parameter übergeben, muss ID dazu passen
    if (board && detectedBoard !== board) {
      return NextResponse.json({
        error: `Diese ID gehört nicht in das "${board}"-Board. Erkannter Typ: "${detectedBoard}".`
      }, { status: 400 });
    }

    // Auftragstyp automatisch aus ID ableiten
    const auftragstyp = auftragsTypFromId(id);

    const result = await pool.query<Entry>(
      `INSERT INTO entries (praxedo_id, erkrankt, board_type, auftragstyp, erstellungsdatum, added_by)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       RETURNING *`,
      [id, !!erkrankt, detectedBoard, auftragstyp, session.username]
    );

    await addLog(session.username, 'NEUER_EINTRAG', `ID: ${id} [${detectedBoard}]${erkrankt ? ' [ERKRANKT]' : ''}`);

    // Make-Webhook für Praxedo-Anreicherung triggern
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
    const msg    = e instanceof Error ? e.message : 'Fehler';
    const status = msg.includes('unique') ? 409 : msg.includes('Berechtigung') || msg.includes('Nicht angemeldet') ? 401 : 500;
    const error  = msg.includes('unique') ? 'Praxedo ID bereits vorhanden.' : msg;
    return NextResponse.json({ error }, { status });
  }
}

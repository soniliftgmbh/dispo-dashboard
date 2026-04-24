import { NextRequest, NextResponse } from 'next/server';
import pool, { addLog } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { deriveStatus, Entry } from '@/lib/types';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const body    = await req.json();
    const { action } = body;

    // Editierbare Felder: notiz, callbackTime, telefon
    if (action === 'update') {
      const { notiz, callbackTime, telefon } = body;
      const result = await pool.query<Entry>(
        `UPDATE entries
         SET notiz         = COALESCE($1, notiz),
             callback_time = $2,
             telefon       = COALESCE($3, telefon),
             updated_at    = NOW()
         WHERE id = $4
         RETURNING *`,
        [notiz ?? null, callbackTime || null, telefon ?? null, params.id]
      );
      await addLog(session.username, 'AKTUALISIERT', `ID: ${params.id}`);
      const entry = { ...result.rows[0], status: deriveStatus(result.rows[0]) };
      return NextResponse.json({ ok: true, entry });
    }

    // Im nächsten Lauf anrufen — setzt callback_time auf jetzt
    if (action === 'call_next_run') {
      const result = await pool.query<Entry>(
        `UPDATE entries
         SET callback_time = NOW(),
             updated_at    = NOW()
         WHERE id = $1
         RETURNING *`,
        [params.id]
      );
      await addLog(session.username, 'NAECHSTER_LAUF', `ID: ${params.id}`);
      const entry = { ...result.rows[0], status: deriveStatus(result.rows[0]) };
      return NextResponse.json({ ok: true, entry });
    }

    // Nacharbeiten abschließen — setzt Abschlussgrund und outcome → bestaetigt
    if (action === 'nacharbeiten_abschluss') {
      const { abschluss } = body;
      if (!abschluss) return NextResponse.json({ error: 'Abschlussgrund fehlt.' }, { status: 400 });
      const result = await pool.query<Entry>(
        `UPDATE entries
         SET nacharbeiten_abschluss = $1,
             outcome                = 'bestaetigt',
             updated_at             = NOW()
         WHERE id = $2
         RETURNING *`,
        [abschluss, params.id]
      );
      await addLog(session.username, 'NACHARBEITEN_ABGESCHLOSSEN', `ID: ${params.id} | ${abschluss}`);
      const entry = { ...result.rows[0], status: deriveStatus(result.rows[0]) };
      return NextResponse.json({ ok: true, entry });
    }

    // Als gelesen markieren — entfernt username aus unread_by
    if (action === 'mark_read') {
      await pool.query(
        `UPDATE entries
         SET unread_by  = array_remove(unread_by, $1),
             updated_at = NOW()
         WHERE id = $2`,
        [session.username, params.id]
      );
      return NextResponse.json({ ok: true });
    }

    // Manuell abbrechen → outcome = 'nacharbeiten', abbruchgrund gesetzt
    if (action === 'cancel') {
      const result = await pool.query<Entry>(
        `UPDATE entries
         SET outcome      = 'nacharbeiten',
             abbruchgrund = 'manuell abgebrochen',
             updated_at   = NOW()
         WHERE id = $1
         RETURNING *`,
        [params.id]
      );
      await addLog(session.username, 'ABGEBROCHEN', `ID: ${params.id}`);
      const entry = { ...result.rows[0], status: deriveStatus(result.rows[0]) };
      return NextResponse.json({ ok: true, entry });
    }

    // Archivieren
    if (action === 'archive') {
      await pool.query(
        `UPDATE entries SET archived = true, archived_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [params.id]
      );
      await addLog(session.username, 'ARCHIVIERT', `ID: ${params.id}`);
      return NextResponse.json({ ok: true });
    }

    // Bulk-Archivierung (Array von IDs)
    if (action === 'bulk_archive') {
      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'IDs fehlen.' }, { status: 400 });
      }
      await pool.query(
        `UPDATE entries SET archived = true, archived_at = NOW(), updated_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [ids]
      );
      await addLog(session.username, 'BULK_ARCHIVIERT', `${ids.length} Einträge archiviert`);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: msg === 'Nicht angemeldet' ? 401 : 500 });
  }
}

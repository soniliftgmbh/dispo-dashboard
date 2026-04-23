import { NextRequest, NextResponse } from 'next/server';
import pool, { addLog } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { deriveStatus, Entry } from '@/lib/types';

// PATCH — Karte aktualisieren
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const body    = await req.json();
    const { action } = body;

    if (action === 'update') {
      // Editierbare Felder: notiz, callbackTime, telefon
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

    if (action === 'cancel') {
      // Manuell abbrechen → dispo_info = '-', abbruchgrund = 'manuell abgebrochen'
      const result = await pool.query<Entry>(
        `UPDATE entries
         SET dispo_info   = '-',
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

    if (action === 'archive') {
      // In Archiv verschieben
      await pool.query(
        `UPDATE entries SET archived = true, archived_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [params.id]
      );
      await addLog(session.username, 'ARCHIVIERT', `ID: ${params.id}`);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: msg === 'Nicht angemeldet' ? 401 : 500 });
  }
}

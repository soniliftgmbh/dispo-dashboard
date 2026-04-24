import { NextRequest, NextResponse } from 'next/server';
import pool, { addLog } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { deriveBoard, auftragsTypFromId } from '@/lib/types';

// POST — Mehrere Praxedo IDs auf einmal eintragen
// Body: { ids: string (mehrzeilig oder kommagetrennt), board: string, erkrankt?: boolean }
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { raw, board, erkrankt } = await req.json();

    if (!raw?.trim()) {
      return NextResponse.json({ error: 'Keine IDs übergeben.' }, { status: 400 });
    }

    // IDs parsen: Zeilenumbrüche, Tabs, Kommas als Trennzeichen
    const ids = raw
      .split(/[\n\r\t,;]+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Keine gültigen IDs gefunden.' }, { status: 400 });
    }

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const rawId of ids) {
      try {
        const detectedBoard = deriveBoard(rawId);

        // Berechtigungs-Check
        if (session.role !== 'admin') {
          const allowed = (session.permissions ?? []).includes(`board:${detectedBoard}`);
          if (!allowed) {
            results.push({ id: rawId, ok: false, error: `Keine Berechtigung für Board "${detectedBoard}"` });
            continue;
          }
        }

        // Board-Kontext-Check
        if (board && detectedBoard !== board) {
          results.push({ id: rawId, ok: false, error: `Typ "${detectedBoard}" passt nicht zum Board "${board}"` });
          continue;
        }

        const auftragstyp = auftragsTypFromId(rawId);

        // Bestehenden nicht-archivierten Eintrag archivieren (Option A: sauberer Neustart)
        await pool.query(
          `UPDATE entries SET archived = true, updated_at = NOW()
           WHERE praxedo_id = $1 AND archived = false`,
          [rawId]
        );

        const insertResult = await pool.query(
          `INSERT INTO entries (praxedo_id, erkrankt, board_type, auftragstyp, erstellungsdatum, added_by)
           VALUES ($1, $2, $3, $4, NOW(), $5)
           RETURNING id`,
          [rawId, !!erkrankt, detectedBoard, auftragstyp, session.username]
        );
        const entryId = insertResult.rows[0]?.id ?? null;

        results.push({ id: rawId, ok: true });

        const webhookUrl = process.env.MAKE_ENRICHMENT_WEBHOOK;
        if (entryId && webhookUrl) {
          fetch(webhookUrl, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ praxedoId: rawId, entryId, erkrankt: !!erkrankt, addedBy: session.username, timestamp: new Date().toISOString() }),
          }).catch(() => {});
        }
      } catch {
        results.push({ id: rawId, ok: false, error: 'DB-Fehler beim Eintragen' });
      }
    }

    const ok      = results.filter(r => r.ok).length;
    const failed  = results.filter(r => !r.ok).length;

    await addLog(session.username, 'BULK_IMPORT', `${ok} von ${ids.length} IDs eingetragen, ${failed} Fehler`);

    return NextResponse.json({ ok: true, results, summary: { total: ids.length, imported: ok, failed } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: msg === 'Nicht angemeldet' ? 401 : 500 });
  }
}

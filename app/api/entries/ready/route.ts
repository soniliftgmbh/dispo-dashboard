import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Make ruft diesen Endpoint auf, um anrufbereite Kontakte abzurufen.
// Authorization: Bearer {WEBHOOK_SECRET}
//
// ── FILTERLOGIK ──────────────────────────────────────────────────────────────
// Ein Kontakt ist bereit für einen Anruf, wenn:
//   1. Nicht archiviert
//   2. Kundendaten vorhanden (kundenname gesetzt → Praxedo-Anreicherung erfolgt)
//   3. Nicht abgeschlossen (dispo_info ist nicht '-' oder 'Übergeben')
//   4. Kein manueller Abbruch (abbruchgrund ist NULL)
//   5. Unter dem Wahlversuch-Limit (aktuell: < 3)
//   6. Kein Rückruf ausstehend ODER Rückrufzeit ist erreicht (callback_time <= NOW())
// ─────────────────────────────────────────────────────────────────────────────

const MAX_WAHLVERSUCHE = 3;

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(req: Request) {
  // Webhook-Secret prüfen — selbes Secret wie beim Make-Webhook
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${process.env.WEBHOOK_SECRET}`) return unauthorized();

  try {
    const result = await pool.query(
      `SELECT
         praxedo_id,
         kundenname,
         telefon,
         email,
         termin,
         zeitraum,
         techniker,
         auftragstyp,
         wahlversuche,
         notiz,
         callback_time
       FROM entries
       WHERE
         archived      = false
         AND kundenname IS NOT NULL
         AND kundenname != ''
         AND (abbruchgrund IS NULL)
         AND (dispo_info  IS NULL OR dispo_info NOT IN ('-', 'Übergeben', 'uebergeben'))
         AND wahlversuche < $1
         AND (
           callback_time IS NULL
           OR callback_time <= NOW()
         )
       ORDER BY
         -- Rückrufe zuerst (callback_time gesetzt), dann nach Erstellungsdatum
         callback_time ASC NULLS LAST,
         created_at    ASC`,
      [MAX_WAHLVERSUCHE]
    );

    return NextResponse.json({
      ok:    true,
      count: result.rows.length,
      entries: result.rows,
    });
  } catch (e) {
    console.error('Ready-Endpoint Fehler:', e);
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 });
  }
}

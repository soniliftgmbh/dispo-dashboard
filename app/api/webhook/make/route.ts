import { NextRequest, NextResponse } from 'next/server';
import pool, { addLog } from '@/lib/db';

// Make ruft diesen Endpoint auf — statt direkt ins Google Sheet zu schreiben
// Authorization: Bearer {WEBHOOK_SECRET}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(req: NextRequest) {
  // Webhook-Secret prüfen
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${process.env.WEBHOOK_SECRET}`) return unauthorized();

  try {
    const body = await req.json();
    const { type, praxedo_id } = body;
    if (!praxedo_id) return NextResponse.json({ error: 'praxedo_id fehlt.' }, { status: 400 });

    // ── TYP 1: Praxedo-Anreicherung ──────────────────────────
    // Make holt Kundendaten aus Praxedo und sendet sie hier rein
    if (type === 'enrich') {
      const { kundenname, telefon, email, termin, zeitraum, techniker, auftragstyp } = body;
      await pool.query(
        `UPDATE entries SET
           kundenname  = $1,
           telefon     = $2,
           email       = $3,
           termin      = $4,
           zeitraum    = $5,
           techniker   = $6,
           auftragstyp = $7,
           updated_at  = NOW()
         WHERE praxedo_id = $8`,
        [kundenname, telefon, email, termin || null, zeitraum, techniker, auftragstyp, praxedo_id]
      );
      await addLog('make-webhook', 'ANGEREICHERT', `ID: ${praxedo_id} → ${kundenname}`);
      return NextResponse.json({ ok: true });
    }

    // ── TYP 2: Post-Call Update (nach Anruf von Anna) ────────
    // ElevenLabs Post-Call Webhook → Make → hier
    if (type === 'post_call') {
      const {
        status,           // confirmed | alternative_proposed | declined | callback_requested | no_data_found
        note,
        recall,           // Rückrufzeitpunkt als ISO-String (wenn callback_requested)
        direction,
        wahlversuche,
        letzter_wahlversuch,
        failure_reason,
        dispo_info,       // '-' wenn abgeschlossen
        abbruchgrund,
      } = body;

      await pool.query(
        `UPDATE entries SET
           abbruchgrund        = COALESCE($1, abbruchgrund),
           dispo_info          = COALESCE($2, dispo_info),
           failure_reason      = COALESCE($3, failure_reason),
           wahlversuche        = COALESCE($4, wahlversuche),
           letzter_wahlversuch = COALESCE($5::timestamptz, letzter_wahlversuch),
           callback_time       = $6,
           updated_at          = NOW()
         WHERE praxedo_id = $7`,
        [
          abbruchgrund ?? status,
          dispo_info ?? null,
          failure_reason ?? null,
          wahlversuche   ?? null,
          letzter_wahlversuch ?? null,
          recall         ?? null,
          praxedo_id,
        ]
      );
      await addLog('make-webhook', 'POST_CALL', `ID: ${praxedo_id} | ${status} | ${direction}`);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unbekannter Typ.' }, { status: 400 });
  } catch (e) {
    console.error('Webhook-Fehler:', e);
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 });
  }
}

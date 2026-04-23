import { NextRequest, NextResponse } from 'next/server';
import pool, { addLog } from '@/lib/db';

// Make ruft diesen Endpoint auf — statt direkt ins Google Sheet zu schreiben
// Authorization: Bearer {WEBHOOK_SECRET}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Nächsten Werktag 08:00 Uhr berechnen (überspringt Sonntage)
function nextWorkday8am(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  // Sonntag (0) → auf Montag schieben
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${process.env.WEBHOOK_SECRET}`) return unauthorized();

  try {
    const body = await req.json();
    const { type, praxedo_id } = body;
    if (!praxedo_id) return NextResponse.json({ error: 'praxedo_id fehlt.' }, { status: 400 });

    // ── TYP 1: Praxedo-Anreicherung ──────────────────────────
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

    // ── TYP 2: Fehlgeschlagener Anrufversuch ─────────────────
    // status = callback_requested (Voicemail / busy / no-answer)
    // Gesamte Timing-Logik läuft hier — Make schickt nur failure_reason
    if (type === 'failed_attempt') {
      const { failure_reason } = body;
      const now = new Date();
      const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

      // Aktuellen Stand aus DB lesen
      const { rows } = await pool.query(
        `SELECT tagesversuche, consecutive_failed_days, erster_anruftag, letzter_anruftag, wahlversuche
         FROM entries WHERE praxedo_id = $1`,
        [praxedo_id]
      );
      if (!rows.length) return NextResponse.json({ error: 'Eintrag nicht gefunden.' }, { status: 404 });

      let {
        tagesversuche,
        consecutive_failed_days,
        erster_anruftag,
        wahlversuche,
      } = rows[0];

      // Tageswechsel: falls letzter_anruftag nicht heute ist, reset tagesversuche
      const letzter = rows[0].letzter_anruftag
        ? new Date(rows[0].letzter_anruftag).toISOString().slice(0, 10)
        : null;
      if (letzter && letzter !== today) tagesversuche = 0;

      // Erster Anruf überhaupt
      const ersterAnruftag = erster_anruftag ?? today;

      const neueWahlversuche   = (wahlversuche ?? 0) + 1;
      const neueTagesversuche  = (tagesversuche ?? 0) + 1;

      // Maximale Versuche pro Tag: ab Tag 4 (consecutive >= 3) nur noch 2
      const maxHeute = consecutive_failed_days >= 3 ? 2 : 3;

      let callbackTime: Date;
      let neueConsecutive = consecutive_failed_days ?? 0;
      let resetTagesversuche = neueTagesversuche;

      if (neueTagesversuche >= maxHeute) {
        // Tag vollständig erfolglos → nächsten Werktag 08:00
        callbackTime      = nextWorkday8am();
        neueConsecutive   = (consecutive_failed_days ?? 0) + 1;
        resetTagesversuche = 0;
      } else {
        // Nächster Versuch heute
        // Tag 1 (consecutive = 0): Versuch 1→2: +1,5h | Versuch 2→3: +2h
        // Alle anderen Tage: immer +5h
        let minuten: number;
        if ((consecutive_failed_days ?? 0) === 0) {
          minuten = neueTagesversuche === 1 ? 90 : 120;
        } else {
          minuten = 300; // 5 Stunden
        }
        callbackTime = new Date(now.getTime() + minuten * 60 * 1000);
      }

      await pool.query(
        `UPDATE entries SET
           wahlversuche           = $1,
           tagesversuche          = $2,
           consecutive_failed_days = $3,
           erster_anruftag        = COALESCE(erster_anruftag, $4::date),
           letzter_anruftag       = $5::date,
           callback_time          = $6,
           failure_reason         = $7,
           updated_at             = NOW()
         WHERE praxedo_id = $8`,
        [
          neueWahlversuche,
          resetTagesversuche,
          neueConsecutive,
          ersterAnruftag,
          today,
          callbackTime.toISOString(),
          failure_reason ?? null,
          praxedo_id,
        ]
      );

      await addLog(
        'make-webhook',
        'FEHLVERSUCH',
        `ID: ${praxedo_id} | ${failure_reason} | Tag ${neueConsecutive}, Versuch ${neueTagesversuche}/${maxHeute} | nächster: ${callbackTime.toISOString()}`
      );
      return NextResponse.json({ ok: true, next_call: callbackTime.toISOString() });
    }

    // ── TYP 3: Post-Call — Abschluss (an Dispo übergeben) ────
    // confirmed | alternative_proposed | alternative_suggestion | declined | no_data_found
    // Setzt dispo_info → Kontakt verschwindet aus entries_ready
    if (type === 'post_call') {
      const { status, note, direction, dispo_info } = body;

      await pool.query(
        `UPDATE entries SET
           dispo_info   = COALESCE($1, dispo_info),
           abbruchgrund = COALESCE($2, abbruchgrund),
           updated_at   = NOW()
         WHERE praxedo_id = $3`,
        [
          dispo_info ?? '-',
          status ?? null,
          praxedo_id,
        ]
      );
      await addLog('make-webhook', 'POST_CALL_ABSCHLUSS', `ID: ${praxedo_id} | ${status} | ${direction ?? ''} | ${note ?? ''}`);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unbekannter Typ.' }, { status: 400 });
  } catch (e) {
    console.error('Webhook-Fehler:', e);
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 });
  }
}

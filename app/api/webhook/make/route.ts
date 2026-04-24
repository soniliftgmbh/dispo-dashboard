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
    // Kein Gespräch — failure_reason: voicemail | busy | no-answer
    // Gesamte Timing-Logik läuft hier
    if (type === 'failed_attempt') {
      const { failure_reason } = body;
      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      const { rows } = await pool.query(
        `SELECT tagesversuche, consecutive_failed_days, erster_anruftag, letzter_anruftag, wahlversuche, erkrankt
         FROM entries WHERE praxedo_id = $1`,
        [praxedo_id]
      );
      if (!rows.length) return NextResponse.json({ error: 'Eintrag nicht gefunden.' }, { status: 404 });

      let { tagesversuche, consecutive_failed_days, erster_anruftag, wahlversuche } = rows[0];

      const erkrankt = rows[0].erkrankt === true;

      // Tageswechsel erkennen → tagesversuche zurücksetzen
      const letzter = rows[0].letzter_anruftag
        ? new Date(rows[0].letzter_anruftag).toISOString().slice(0, 10)
        : null;
      if (letzter && letzter !== today) tagesversuche = 0;

      const ersterAnruftag  = erster_anruftag ?? today;
      const tageVergangen   = Math.floor((now.getTime() - new Date(ersterAnruftag).getTime()) / 86400000);
      const maxTage         = erkrankt ? 2 : 14;
      const maxTageErreicht = tageVergangen >= maxTage;

      const neueWahlversuche  = (wahlversuche ?? 0) + 1;
      const neueTagesversuche = (tagesversuche ?? 0) + 1;

      // Erkrankt: Tag 1 → max 8, Tag 2 → max 4
      // Regulär: immer max 3 (ab consecutive >= 3: max 2)
      let maxHeute: number;
      if (erkrankt) {
        maxHeute = (consecutive_failed_days ?? 0) === 0 ? 8 : 4;
      } else {
        maxHeute = (consecutive_failed_days ?? 0) >= 3 ? 2 : 3;
      }

      let callbackTime: Date;
      let neueConsecutive    = consecutive_failed_days ?? 0;
      let resetTagesversuche = neueTagesversuche;

      if (neueTagesversuche >= maxHeute) {
        callbackTime       = nextWorkday8am();
        neueConsecutive    = (consecutive_failed_days ?? 0) + 1;
        resetTagesversuche = 0;
      } else {
        // Erkrankt: zufällig 45–60 Min | Regulär Tag 1: 90/120 Min | ab Tag 2: 300 Min
        let minuten: number;
        if (erkrankt) {
          minuten = Math.floor(Math.random() * 16) + 45; // 45–60
        } else if ((consecutive_failed_days ?? 0) === 0) {
          minuten = neueTagesversuche === 1 ? 90 : 120;
        } else {
          minuten = 300;
        }
        callbackTime = new Date(now.getTime() + minuten * 60 * 1000);
      }

      await pool.query(
        `UPDATE entries SET
           wahlversuche            = $1,
           tagesversuche           = $2,
           consecutive_failed_days = $3,
           erster_anruftag         = COALESCE(erster_anruftag, $4::date),
           letzter_anruftag        = $5::date,
           callback_time           = $6,
           failure_reason          = $7,
           dispo_required          = CASE WHEN $9 THEN true ELSE dispo_required END,
           updated_at              = NOW()
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
          maxTageErreicht,
        ]
      );

      await addLog(
        'make-webhook',
        'FEHLVERSUCH',
        `ID: ${praxedo_id} | ${failure_reason} | Tag ${neueConsecutive}, Versuch ${neueTagesversuche}/${maxHeute} | nächster: ${callbackTime.toISOString()}${maxTageErreicht ? ' | DISPO REQUIRED' : ''}`
      );
      return NextResponse.json({ ok: true, next_call: callbackTime.toISOString() });
    }

    // ── TYP 3: Kunden-Rückruf ────────────────────────────────
    // Gespräch geführt — Kunde wünscht Rückruf zu festem Zeitpunkt
    // consecutive_failed_days reset, kein Fehlversuch
    if (type === 'callback_scheduled') {
      const { recall, ki_notiz, ki_naechste_aktion, ki_stimmung, ki_zusammenfassung } = body;
      if (!recall) return NextResponse.json({ error: 'recall fehlt.' }, { status: 400 });

      await pool.query(
        `UPDATE entries SET
           callback_time           = $1::timestamptz,
           consecutive_failed_days = 0,
           tagesversuche           = 0,
           failure_reason          = NULL,
           wahlversuche            = wahlversuche + 1,
           ki_notiz                = COALESCE($2, ki_notiz),
           ki_naechste_aktion      = COALESCE($3, ki_naechste_aktion),
           ki_stimmung             = COALESCE($4, ki_stimmung),
           ki_zusammenfassung      = COALESCE($5, ki_zusammenfassung),
           updated_at              = NOW()
         WHERE praxedo_id = $6`,
        [recall, ki_notiz ?? null, ki_naechste_aktion ?? null, ki_stimmung ?? null, ki_zusammenfassung ?? null, praxedo_id]
      );
      await addLog('make-webhook', 'RUECKRUF_GEPLANT', `ID: ${praxedo_id} | ${recall}`);
      return NextResponse.json({ ok: true });
    }

    // ── TYP 4: Abschluss — an Dispo übergeben ────────────────
    // confirmed | alternative_proposed | alternative_suggestion | declined
    // Setzt dispo_info → Kontakt verschwindet aus entries_ready
    if (type === 'post_call') {
      const {
        status, direction,
        ki_vorname, ki_nachname, ki_agent, ki_direction,
        ki_termin_ergebnis, ki_notiz, ki_naechste_aktion,
        ki_stimmung, ki_angehoeriger, ki_zuverlaessigkeit,
        ki_gespraechsqualitaet, ki_gespraechsende, ki_frage,
        ki_erklaerung_wiederholt, ki_zusammenfassung,
      } = body;

      await pool.query(
        `UPDATE entries SET
           dispo_info                = '-',
           abbruchgrund              = $1,
           ki_vorname                = COALESCE($2,  ki_vorname),
           ki_nachname               = COALESCE($3,  ki_nachname),
           ki_direction              = COALESCE($4,  ki_direction),
           ki_agent                  = COALESCE($5,  ki_agent),
           ki_termin_ergebnis        = COALESCE($6,  ki_termin_ergebnis),
           ki_notiz                  = COALESCE($7,  ki_notiz),
           ki_naechste_aktion        = COALESCE($8,  ki_naechste_aktion),
           ki_stimmung               = COALESCE($9,  ki_stimmung),
           ki_angehoeriger           = COALESCE($10, ki_angehoeriger),
           ki_zuverlaessigkeit       = COALESCE($11, ki_zuverlaessigkeit),
           ki_gespraechsqualitaet    = COALESCE($12, ki_gespraechsqualitaet),
           ki_gespraechsende         = COALESCE($13, ki_gespraechsende),
           ki_frage                  = COALESCE($14, ki_frage),
           ki_erklaerung_wiederholt  = COALESCE($15, ki_erklaerung_wiederholt),
           ki_zusammenfassung        = COALESCE($16, ki_zusammenfassung),
           updated_at                = NOW()
         WHERE praxedo_id = $17`,
        [
          status ?? null,
          ki_vorname ?? null, ki_nachname ?? null, ki_direction ?? null, ki_agent ?? null,
          ki_termin_ergebnis ?? null, ki_notiz ?? null, ki_naechste_aktion ?? null,
          ki_stimmung ?? null, ki_angehoeriger ?? null, ki_zuverlaessigkeit ?? null,
          ki_gespraechsqualitaet ?? null, ki_gespraechsende ?? null, ki_frage ?? null,
          ki_erklaerung_wiederholt ?? null, ki_zusammenfassung ?? null,
          praxedo_id,
        ]
      );
      await addLog('make-webhook', 'ABSCHLUSS', `ID: ${praxedo_id} | ${status} | ${direction ?? ''}`);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unbekannter Typ.' }, { status: 400 });
  } catch (e) {
    console.error('Webhook-Fehler:', e);
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 });
  }
}

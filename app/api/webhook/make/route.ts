import { NextRequest, NextResponse } from 'next/server';
import pool, { addLog } from '@/lib/db';
import { deriveBoard, auftragsTypFromId } from '@/lib/types';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function nextWorkday8am(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

// Rufnummer auf E.164 (+49...) normalisieren
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Alle Annotationen in Klammern entfernen — auch mitten in der Nummer
  let s = raw.replace(/\(.*?\)/g, '');

  // Alles außer Ziffern und + entfernen
  s = s.replace(/[^\d+]/g, '');

  if (!s) return null;

  // Führendes + entfernen (wird am Ende wieder gesetzt)
  let digits = s.startsWith('+') ? s.slice(1) : s;

  // Länderkennzahl normalisieren
  if (digits.startsWith('0049')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('049') && digits.length >= 12) {
    // Häufiger Eingabefehler: 049 statt 0049 (z.B. 04917612345678)
    // Nur als Ländervorwahl behandeln wenn genug Stellen für eine Mobilnummer
    digits = digits.slice(3);
  } else if (digits.startsWith('49') && digits.length >= 11) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Weniger als 7 Stellen → wahrscheinlich ungültig
  if (digits.length < 7) return null;

  return '+49' + digits;
}

// Anruflogik-Einstellungen aus settings-Tabelle laden
async function loadCallSettings() {
  const { rows } = await pool.query(
    `SELECT key, value FROM settings WHERE key LIKE 'regular_%' OR key LIKE 'erkrankt_%'`
  );
  const s: Record<string, number> = {};
  for (const row of rows) s[row.key] = parseInt(row.value, 10);
  return {
    regular: {
      maxDays:          s['regular_max_days']            ?? 14,
      maxPerDayEarly:   s['regular_max_per_day_early']   ?? 3,
      maxPerDayLate:    s['regular_max_per_day_late']    ?? 2,
      intervalFirstMin: s['regular_interval_first_min']  ?? 90,
      intervalSecondMin:s['regular_interval_second_min'] ?? 120,
      intervalLateMin:  s['regular_interval_late_min']   ?? 300,
    },
    erkrankt: {
      maxDays:      s['erkrankt_max_days']         ?? 2,
      maxDay1:      s['erkrankt_max_day1']          ?? 8,
      maxDay2:      s['erkrankt_max_day2']          ?? 4,
      intervalMin:  s['erkrankt_interval_min_min']  ?? 45,
      intervalMax:  s['erkrankt_interval_max_min']  ?? 60,
    },
  };
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
      const { kundenname, telefon, email, termin, zeitraum, techniker } = body;
      const auftragstyp    = auftragsTypFromId(praxedo_id);
      const telefonClean   = normalizePhone(telefon);
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
        [kundenname, telefonClean, email, termin || null, zeitraum, techniker, auftragstyp, praxedo_id]
      );
      await addLog('make-webhook', 'ANGEREICHERT', `ID: ${praxedo_id} → ${kundenname} | Tel: ${telefon} → ${telefonClean}`);
      return NextResponse.json({ ok: true });
    }

    // ── TYP 2: Anruf gestartet (von Make-Trigger-Automation) ─
    // Setzt is_calling = true + letzter_wahlversuch = NOW()
    if (type === 'call_started') {
      await pool.query(
        `UPDATE entries SET
           is_calling          = true,
           letzter_wahlversuch = NOW(),
           updated_at          = NOW()
         WHERE praxedo_id = $1`,
        [praxedo_id]
      );
      // Letzte Anrufschleife in Settings tracken
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ('last_call_run', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [new Date().toISOString()]
      );
      return NextResponse.json({ ok: true });
    }

    // ── TYP 3: Fehlgeschlagener Anrufversuch ─────────────────
    if (type === 'failed_attempt') {
      const { failure_reason } = body;
      const now   = new Date();
      const today = now.toISOString().slice(0, 10);

      const { rows } = await pool.query(
        `SELECT tagesversuche, consecutive_failed_days, erster_anruftag, letzter_anruftag, wahlversuche, erkrankt
         FROM entries WHERE praxedo_id = $1`,
        [praxedo_id]
      );
      if (!rows.length) return NextResponse.json({ error: 'Eintrag nicht gefunden.' }, { status: 404 });

      let { tagesversuche, consecutive_failed_days, erster_anruftag, wahlversuche } = rows[0];
      const erkrankt = rows[0].erkrankt === true;

      const letzter = rows[0].letzter_anruftag
        ? new Date(rows[0].letzter_anruftag).toISOString().slice(0, 10)
        : null;
      if (letzter && letzter !== today) tagesversuche = 0;

      const cs = await loadCallSettings();
      const cfg = erkrankt ? cs.erkrankt : cs.regular;

      const ersterAnruftag  = erster_anruftag ?? today;
      const tageVergangen   = Math.floor((now.getTime() - new Date(ersterAnruftag).getTime()) / 86400000);
      const maxTage         = erkrankt ? cs.erkrankt.maxDays : cs.regular.maxDays;
      const maxTageErreicht = tageVergangen >= maxTage;

      const neueWahlversuche  = (wahlversuche ?? 0) + 1;
      const neueTagesversuche = (tagesversuche ?? 0) + 1;

      let maxHeute: number;
      if (erkrankt) {
        maxHeute = (consecutive_failed_days ?? 0) === 0 ? cs.erkrankt.maxDay1 : cs.erkrankt.maxDay2;
      } else {
        maxHeute = (consecutive_failed_days ?? 0) >= 3 ? cs.regular.maxPerDayLate : cs.regular.maxPerDayEarly;
      }

      let callbackTime: Date;
      let neueConsecutive    = consecutive_failed_days ?? 0;
      let resetTagesversuche = neueTagesversuche;

      if (neueTagesversuche >= maxHeute) {
        callbackTime       = nextWorkday8am();
        neueConsecutive    = (consecutive_failed_days ?? 0) + 1;
        resetTagesversuche = 0;
      } else {
        let minuten: number;
        if (erkrankt) {
          const range = cs.erkrankt.intervalMax - cs.erkrankt.intervalMin + 1;
          minuten = Math.floor(Math.random() * range) + cs.erkrankt.intervalMin;
        } else if ((consecutive_failed_days ?? 0) === 0) {
          minuten = neueTagesversuche === 1 ? cs.regular.intervalFirstMin : cs.regular.intervalSecondMin;
        } else {
          minuten = cs.regular.intervalLateMin;
        }
        callbackTime = new Date(now.getTime() + minuten * 60 * 1000);
      }

      await pool.query(
        `UPDATE entries SET
           is_calling              = false,
           wahlversuche            = $1,
           tagesversuche           = $2,
           consecutive_failed_days = $3,
           erster_anruftag         = COALESCE(erster_anruftag, $4::date),
           letzter_anruftag        = $5::date,
           letzter_wahlversuch     = NOW(),
           callback_time           = $6,
           failure_reason          = $7,
           dispo_required          = CASE WHEN $9 THEN true ELSE dispo_required END,
           updated_at              = NOW()
         WHERE praxedo_id = $8`,
        [
          neueWahlversuche, resetTagesversuche, neueConsecutive,
          ersterAnruftag, today, callbackTime.toISOString(),
          failure_reason ?? null, praxedo_id, maxTageErreicht,
        ]
      );
      await addLog('make-webhook', 'FEHLVERSUCH',
        `ID: ${praxedo_id} | ${failure_reason} | Tag ${neueConsecutive}, Versuch ${neueTagesversuche}/${maxHeute} | nächster: ${callbackTime.toISOString()}${maxTageErreicht ? ' | DISPO REQUIRED' : ''}`
      );
      return NextResponse.json({ ok: true, next_call: callbackTime.toISOString() });
    }

    // ── TYP 4: Kunden-Rückruf ───────────────────────────────
    if (type === 'callback_scheduled') {
      const { recall, ki_notiz, ki_naechste_aktion, ki_stimmung, ki_zusammenfassung } = body;
      if (!recall) return NextResponse.json({ error: 'recall fehlt.' }, { status: 400 });

      await pool.query(
        `UPDATE entries SET
           is_calling              = false,
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

    // ── TYP 5: Post-Call — Ergebnis ──────────────────────────
    // status: confirmed → bestaetigt
    // status: alternative_proposed | declined | no_data_found → nacharbeiten
    // status: callback_requested → wie callback_scheduled
    if (type === 'post_call') {
      const {
        status, direction,
        ki_vorname, ki_nachname, ki_agent, ki_direction,
        ki_termin_ergebnis, ki_notiz, ki_naechste_aktion,
        ki_stimmung, ki_angehoeriger, ki_zuverlaessigkeit,
        ki_gespraechsqualitaet, ki_gespraechsende, ki_frage,
        ki_erklaerung_wiederholt, ki_zusammenfassung,
      } = body;

      // Outcome bestimmen
      let outcome: string | null = null;
      if (status === 'confirmed') {
        outcome = 'bestaetigt';
      } else if (['alternative_proposed', 'alternative_suggestion', 'declined', 'no_data_found'].includes(status)) {
        outcome = 'nacharbeiten';
      }
      // callback_requested → outcome bleibt null, callback_time wird gesetzt (s.u.)

      await pool.query(
        `UPDATE entries SET
           is_calling                = false,
           outcome                   = COALESCE($1, outcome),
           abbruchgrund              = $2,
           wahlversuche              = wahlversuche + 1,
           letzter_wahlversuch       = NOW(),
           ki_vorname                = COALESCE($3,  ki_vorname),
           ki_nachname               = COALESCE($4,  ki_nachname),
           ki_direction              = COALESCE($5,  ki_direction),
           ki_agent                  = COALESCE($6,  ki_agent),
           ki_termin_ergebnis        = COALESCE($7,  ki_termin_ergebnis),
           ki_notiz                  = COALESCE($8,  ki_notiz),
           ki_naechste_aktion        = COALESCE($9,  ki_naechste_aktion),
           ki_stimmung               = COALESCE($10, ki_stimmung),
           ki_angehoeriger           = COALESCE($11, ki_angehoeriger),
           ki_zuverlaessigkeit       = COALESCE($12, ki_zuverlaessigkeit),
           ki_gespraechsqualitaet    = COALESCE($13, ki_gespraechsqualitaet),
           ki_gespraechsende         = COALESCE($14, ki_gespraechsende),
           ki_frage                  = COALESCE($15, ki_frage),
           ki_erklaerung_wiederholt  = COALESCE($16, ki_erklaerung_wiederholt),
           ki_zusammenfassung        = COALESCE($17, ki_zusammenfassung),
           updated_at                = NOW()
         WHERE praxedo_id = $18`,
        [
          outcome,
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

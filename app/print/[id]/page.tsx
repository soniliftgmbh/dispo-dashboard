import pool from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Entry, auftragsTypFromId } from '@/lib/types';
import Link from 'next/link';
import { PrintAutoTrigger } from './PrintAutoTrigger';

export const dynamic = 'force-dynamic';

function fmtDateLong(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function PrintPage({ params }: { params: { id: string } }) {
  await requireSession();
  const result = await pool.query<Entry>(`SELECT * FROM entries WHERE id = $1`, [params.id]);
  const e = result.rows[0];
  if (!e) {
    return <div style={{ padding: 40 }}>Eintrag nicht gefunden.</div>;
  }

  const auftragstyp = e.auftragstyp || auftragsTypFromId(e.praxedo_id);
  const auftragsTypLower = auftragstyp.toLowerCase();
  const today = fmtDateLong(new Date());

  const recipientName = [e.anrede, e.kundenname].filter(Boolean).join(' ') || 'Sehr geehrte Kundin / Sehr geehrter Kunde';
  const lastName = e.kundenname?.split(' ').slice(-1)[0] || '';
  const greetingName = e.anrede && lastName ? `${e.anrede} ${lastName}` : 'Damen und Herren';

  return (
    <>
      <PrintAutoTrigger />
      <style>{`
        @page { size: A4; margin: 25mm 20mm; }
        html, body {
          background: white !important;
          color: #111;
          font-family: 'Helvetica', 'Arial', sans-serif;
          font-size: 11pt;
          line-height: 1.55;
          margin: 0;
          padding: 0;
        }
        .sheet {
          max-width: 170mm;
          margin: 0 auto;
          padding: 25mm 20mm;
          background: white;
          color: #111;
          min-height: 297mm;
          position: relative;
        }
        .header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8mm;
        }
        .return-line {
          font-size: 7pt;
          color: #333;
          border-bottom: 1px solid #999;
          padding-bottom: 1mm;
          margin-bottom: 2mm;
        }
        .recipient {
          margin-top: 4mm;
          line-height: 1.45;
        }
        .meta {
          display: flex;
          justify-content: space-between;
          margin: 12mm 0 6mm 0;
          font-size: 10pt;
        }
        .subject {
          font-weight: bold;
          margin-bottom: 6mm;
        }
        .body p { margin: 0 0 4mm 0; }
        .body strong { display: block; margin: 3mm 0; font-size: 12pt; }
        .footer {
          font-size: 8pt;
          color: #555;
          border-top: 1px solid #ccc;
          padding-top: 3mm;
          margin-top: 10mm;
        }
        .back-link {
          position: fixed;
          top: 12px;
          left: 12px;
          padding: 6px 10px;
          background: #154f9e;
          color: white;
          text-decoration: none;
          font-size: 12px;
          border-radius: 4px;
          font-family: sans-serif;
        }
        @media print {
          .back-link { display: none !important; }
          .sheet { padding: 0; max-width: none; }
        }
      `}</style>

      <Link href="/dashboard" className="back-link">← Zurück zum Dashboard</Link>

      <div className="sheet">
        <div className="header-row">
          <img src="/sonilift-logo.png" alt="Sonilift" style={{ maxHeight: 50, width: 'auto' }} />
        </div>

        {/* Return-address line for window envelope (DIN 5008) */}
        <div className="return-line">
          Sonilift GmbH · Büssinghook 33 · 46395 Bocholt
        </div>

        {/* Recipient block — sized for window envelope */}
        <div className="recipient" style={{ minHeight: '40mm' }}>
          <div>{recipientName}</div>
          {(e.strasse || e.hausnummer) && <div>{[e.strasse, e.hausnummer].filter(Boolean).join(' ')}</div>}
          {(e.plz || e.ort) && <div>{[e.plz, e.ort].filter(Boolean).join(' ')}</div>}
        </div>

        <div className="meta">
          <span>&nbsp;</span>
          <span>Bocholt, {today}</span>
        </div>

        <div className="subject">Ihre anstehende {auftragstyp}</div>

        <div className="body">
          <p>Sehr geehrte/r {greetingName},</p>

          <p>vielen Dank für Ihr Vertrauen in Sonilift. Wie Ihnen sicher bekannt ist, steht in Kürze Ihre {auftragsTypLower} an, für die wir gemeinsam mit Ihnen einen passenden Termin abstimmen möchten.</p>

          <p>Trotz mehrfacher Versuche konnten wir Sie in den vergangenen Tagen leider nicht persönlich erreichen. Damit wir die Wartung Ihres Treppenlifts wie gewohnt zuverlässig durchführen können, bitten wir Sie, sich kurz bei uns zu melden. Unser Team ist montags bis freitags von 8:00 bis 17:00 Uhr für Sie erreichbar.</p>

          <p>Sie erreichen uns kostenfrei unter:</p>

          <strong>0800 000 89 08</strong>

          <p>Alternativ können Sie uns auch eine kurze E-Mail an service@sonilift.de senden, wir melden uns dann zeitnah bei Ihnen zurück, um einen Termin zu vereinbaren, der für Sie ideal passt.</p>

          <p>Vielen Dank für Ihre Mithilfe und herzliche Grüße aus Bocholt</p>

          <p>Ihr Sonilift-Team</p>
        </div>

        <div className="footer">
          Sonilift GmbH · Büssinghook 33 · 46395 Bocholt · 0800 000 89 08 · service@sonilift.de
        </div>
      </div>
    </>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Comment } from '@/lib/types';

// GET — Kommentare für einen Eintrag
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url     = new URL(req.url);
    const entryId = url.searchParams.get('entry_id');
    if (!entryId) return NextResponse.json({ error: 'entry_id fehlt.' }, { status: 400 });

    const result = await pool.query<Comment>(
      `SELECT * FROM comments WHERE entry_id = $1 ORDER BY created_at ASC`,
      [entryId]
    );
    return NextResponse.json({ ok: true, comments: result.rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

// POST — neuen Kommentar hinzufügen
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { entry_id, body: commentBody } = await req.json();

    if (!entry_id || !commentBody?.trim()) {
      return NextResponse.json({ error: 'entry_id und Kommentartext erforderlich.' }, { status: 400 });
    }

    // @mentions extrahieren
    const mentions = (commentBody.match(/@(\w+)/g) ?? []).map((m: string) => m.slice(1));

    const result = await pool.query<Comment>(
      `INSERT INTO comments (entry_id, username, body, mentions)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [entry_id, session.username, commentBody.trim(), mentions]
    );

    // Eintrag als ungelesen markieren für alle erwähnten Nutzer (und alle außer Autor)
    if (mentions.length > 0) {
      // Erwähnte User in unread_by des Eintrags eintragen
      await pool.query(
        `UPDATE entries
         SET unread_by = array(
           SELECT DISTINCT unnest(unread_by || $1::text[])
         ),
         updated_at = NOW()
         WHERE id = $2`,
        [mentions, entry_id]
      );
    }

    return NextResponse.json({ ok: true, comment: result.rows[0] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

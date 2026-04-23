import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool, { addLog } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) return NextResponse.json({ error: 'Fehlende Felder.' }, { status: 400 });

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND active = true',
      [username]
    );
    const user = result.rows[0];
    if (!user) return NextResponse.json({ error: 'Benutzername oder Passwort falsch.' }, { status: 401 });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return NextResponse.json({ error: 'Benutzername oder Passwort falsch.' }, { status: 401 });

    // Session-Token erstellen
    const token = await createSessionToken({ username: user.username, role: user.role });

    // last_login aktualisieren
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    await addLog(user.username, 'LOGIN', 'Anmeldung erfolgreich');

    const res = NextResponse.json({ ok: true, username: user.username, role: user.role });
    res.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 Stunden
      path: '/',
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Serverfehler.' }, { status: 500 });
  }
}

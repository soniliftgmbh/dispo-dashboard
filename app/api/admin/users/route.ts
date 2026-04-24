import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool, { addLog } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET — alle Benutzer
export async function GET() {
  try {
    await requireAdmin();
    const result = await pool.query(
      `SELECT id, username, role, active, last_login, created_at, permissions FROM users ORDER BY created_at ASC`
    );
    return NextResponse.json({ ok: true, users: result.rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}

// POST — neuen Benutzer anlegen
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const { username, password, role, permissions } = await req.json();
    if (!username || !password) return NextResponse.json({ error: 'Fehlende Felder.' }, { status: 400 });

    const validRoles = ['user', 'power_user', 'admin'];
    const safeRole   = validRoles.includes(role) ? role : 'user';
    const safePerms  = Array.isArray(permissions) ? permissions : [];

    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users (username, password_hash, role, permissions) VALUES ($1, $2, $3, $4)`,
      [username, hash, safeRole, safePerms]
    );
    await addLog(session.username, 'USER_ERSTELLT', `${username} (${safeRole}) perms: ${safePerms.join(', ')}`);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg    = e instanceof Error ? e.message : 'Fehler';
    const status = msg.includes('unique') ? 409 : 500;
    const error  = msg.includes('unique') ? 'Benutzername bereits vergeben.' : msg;
    return NextResponse.json({ error }, { status });
  }
}

// PATCH — Benutzer aktualisieren (Passwort, Rolle, Status, Permissions)
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const { id, newPassword, role, active, permissions } = await req.json();

    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 12);
      await pool.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, id]);
    }
    if (role !== undefined) {
      const validRoles = ['user', 'power_user', 'admin'];
      if (validRoles.includes(role)) {
        await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, id]);
      }
    }
    if (active !== undefined) {
      await pool.query(`UPDATE users SET active = $1 WHERE id = $2`, [active, id]);
    }
    if (permissions !== undefined && Array.isArray(permissions)) {
      await pool.query(`UPDATE users SET permissions = $1 WHERE id = $2`, [permissions, id]);
    }

    await addLog(session.username, 'USER_AKTUALISIERT', `ID: ${id}`);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

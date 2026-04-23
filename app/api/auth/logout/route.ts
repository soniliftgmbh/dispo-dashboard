import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { addLog } from '@/lib/db';

export async function POST() {
  const session = await getSession();
  if (session) await addLog(session.username, 'LOGOUT', 'Abmeldung');
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('session');
  return res;
}

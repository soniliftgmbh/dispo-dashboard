import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Role, Permission } from './types';

export interface SessionPayload {
  username:    string;
  role:        Role;
  permissions: string[];
  iat?:        number;
  exp?:        number;
}

function secret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!);
}

export async function createSessionToken(payload: Omit<SessionPayload, 'iat' | 'exp'>) {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret());
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const token = cookies().get('session')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret());
    const p = payload as unknown as SessionPayload;
    // Rückwärtskompatibilität: alte Sessions ohne permissions-Feld
    if (!p.permissions) p.permissions = [];
    return p;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error('Nicht angemeldet');
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== 'admin') throw new Error('Keine Berechtigung');
  return session;
}

export async function requirePermission(perm: Permission): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role === 'admin') return session;
  if (!session.permissions.includes(perm)) throw new Error('Keine Berechtigung');
  return session;
}

export function canViewLogs(session: SessionPayload): boolean {
  return session.role === 'admin' || session.permissions.includes('view:logs');
}

export function canViewArchive(session: SessionPayload): boolean {
  return session.role === 'admin' || session.permissions.includes('view:archive');
}

export function canViewStats(session: SessionPayload): boolean {
  return session.role === 'admin' || session.permissions.includes('view:stats');
}

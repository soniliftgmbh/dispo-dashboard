import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { Role } from './types';

export interface SessionPayload {
  username: string;
  role:     Role;
  iat?:     number;
  exp?:     number;
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
    return payload as SessionPayload;
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

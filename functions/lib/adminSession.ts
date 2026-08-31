import type { AppEnv } from './env';

export const ADMIN_SESSION_COOKIE = 'my_app_admin_session';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

interface RequestLike {
  url: string;
  headers: Pick<Headers, 'get'>;
}

interface AdminSessionRow {
  id_hash: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(digest));
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

function getCookie(request: RequestLike, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    if (key !== name) {
      continue;
    }

    try {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

export async function verifyAdminCredentials(
  username: string,
  password: string,
  env: AppEnv,
): Promise<boolean> {
  if (!env.USER_NAME || !env.PASSWORD) {
    return false;
  }

  const [providedUsername, expectedUsername, providedPassword, expectedPassword] =
    await Promise.all([
      sha256(username),
      sha256(env.USER_NAME),
      sha256(password),
      sha256(env.PASSWORD),
    ]);

  return (
    constantTimeEqual(providedUsername, expectedUsername) &&
    constantTimeEqual(providedPassword, expectedPassword)
  );
}

export async function createAdminSession(
  env: AppEnv,
): Promise<{ token: string; expiresAt: number }> {
  const now = Date.now();
  const expiresAt = now + ADMIN_SESSION_MAX_AGE * 1000;
  const token = crypto.randomUUID();
  const tokenHash = await sha256(token);

  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now).run();
  await env.DB.prepare(
    'INSERT INTO admin_sessions (id_hash, created_at, expires_at) VALUES (?, ?, ?)',
  )
    .bind(tokenHash, now, expiresAt)
    .run();

  return { token, expiresAt };
}

export async function hasValidAdminSession(
  request: RequestLike,
  env: AppEnv,
): Promise<boolean> {
  const token = getCookie(request, ADMIN_SESSION_COOKIE);
  if (!token) {
    return false;
  }

  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    'SELECT id_hash FROM admin_sessions WHERE id_hash = ? AND expires_at > ? LIMIT 1',
  )
    .bind(tokenHash, Date.now())
    .first<AdminSessionRow>();

  return Boolean(row?.id_hash);
}

export async function revokeAdminSession(
  request: RequestLike,
  env: AppEnv,
): Promise<void> {
  const token = getCookie(request, ADMIN_SESSION_COOKIE);
  if (!token) {
    return;
  }

  const tokenHash = await sha256(token);
  await env.DB.prepare('DELETE FROM admin_sessions WHERE id_hash = ?').bind(tokenHash).run();
}

function secureCookieAttribute(request: RequestLike): string {
  return new URL(request.url).protocol === 'https:' ? '; Secure' : '';
}

export function createSessionCookie(request: RequestLike, token: string): string {
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${ADMIN_SESSION_MAX_AGE}; Path=/; HttpOnly; SameSite=Lax${secureCookieAttribute(request)}`;
}

export function clearSessionCookie(request: RequestLike): string {
  return `${ADMIN_SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secureCookieAttribute(request)}`;
}

import type { CashbookRequest } from './cashbookTypes';

export class CashbookApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'CashbookApiError';
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function badRequest(message: string): Response {
  return json({ message }, { status: 400 });
}

export function unauthorized(message = 'ログインが必要です。'): Response {
  return json({ message }, { status: 401 });
}

export function notFound(message = 'Not found'): Response {
  return json({ message }, { status: 404 });
}

export function methodNotAllowed(allow: string): Response {
  return json(
    { message: 'Method not allowed' },
    { status: 405, headers: { Allow: allow } },
  );
}

export function serverError(): Response {
  return json({ message: 'サーバーエラーが発生しました。' }, { status: 500 });
}

export function appError(error: CashbookApiError): Response {
  return json(
    {
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
    },
    { status: error.status },
  );
}

export function readCookie(request: CashbookRequest, name: string): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;

  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value) || null;
    } catch {
      return null;
    }
  }

  return null;
}

export function cookie(request: CashbookRequest, name: string, value: string, maxAgeSeconds: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAgeSeconds}`;
}

export function clearCookie(request: CashbookRequest, name: string): string {
  return cookie(request, name, '', 0);
}

export async function readJson<T>(request: CashbookRequest): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new CashbookApiError('JSON形式の入力が必要です。', 400, 'INVALID_JSON');
  }
}

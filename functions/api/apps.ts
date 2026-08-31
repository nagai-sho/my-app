import type { PagesFunction } from '@cloudflare/workers-types';

import { hasValidAdminSession } from '../lib/adminSession';
import type { AppEnv } from '../lib/env';
import { jsonResponse } from '../lib/http';
import { verifyGoogleIdToken } from '../lib/google';

interface AppRow {
  id: string;
  name: string;
  url: string;
  description: string | null;
  sort_order: number;
  icon_url: string | null;
  pinned: number;
  tags: string | null;
  created_at: number;
  updated_at: number;
}

function getAllowedEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function isAuthorized(
  request: { url: string; headers: Pick<Headers, 'get'> },
  env: AppEnv,
): Promise<boolean> {
  try {
    if (await hasValidAdminSession(request, env)) {
      return true;
    }
  } catch {
    return false;
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return false;
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    return false;
  }

  const claims = await verifyGoogleIdToken(token, env.GOOGLE_CLIENT_ID ?? '');
  const email = claims?.email?.trim().toLowerCase();
  return Boolean(email && getAllowedEmails(env.ALLOWED_GOOGLE_EMAILS).has(email));
}

function parseTags(value: string | null): string[] | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((tag) => typeof tag === 'string')) {
      return parsed;
    }
  } catch {
    // 不正な将来用タグは、一覧取得全体を壊さず未設定として扱う。
  }

  return undefined;
}

function parseHttpsUrl(value: string, fieldName: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname) {
    throw new Error(`${fieldName} must use https`);
  }
  return value;
}

function toApp(row: AppRow) {
  if (!row.id || !row.name || !row.url) {
    throw new Error('An app row is missing a required value');
  }

  const sortOrder = Number(row.sort_order);
  const createdAt = Number(row.created_at);
  const updatedAt = Number(row.updated_at);
  if (![sortOrder, createdAt, updatedAt].every(Number.isFinite)) {
    throw new Error('An app row contains an invalid number');
  }

  const iconUrl = row.icon_url ? parseHttpsUrl(row.icon_url, 'icon_url') : undefined;
  return {
    id: row.id,
    name: row.name,
    url: parseHttpsUrl(row.url, 'url'),
    ...(row.description ? { description: row.description } : {}),
    sortOrder,
    ...(iconUrl ? { iconUrl } : {}),
    pinned: row.pinned === 1,
    ...(parseTags(row.tags) ? { tags: parseTags(row.tags) } : {}),
    createdAt,
    updatedAt,
  };
}

export const onRequest: PagesFunction<AppEnv> = async ({ request, env }) => {
  if (request.method !== 'GET') {
    return jsonResponse<AppEnv>({ error: 'Method Not Allowed' }, 405, { Allow: 'GET' });
  }

  if (!(await isAuthorized(request, env))) {
    return jsonResponse<AppEnv>({ error: 'Unauthorized' }, 401);
  }

  try {
    const result = await env.DB.prepare(
      `SELECT id, name, url, description, sort_order, icon_url, pinned, tags, created_at, updated_at
       FROM apps
       ORDER BY pinned DESC, sort_order ASC, name COLLATE NOCASE ASC`,
    ).all<AppRow>();

    return jsonResponse<AppEnv>({ apps: result.results.map(toApp) });
  } catch {
    return jsonResponse<AppEnv>({ error: '予期せぬエラーが発生しました。' }, 500);
  }
};

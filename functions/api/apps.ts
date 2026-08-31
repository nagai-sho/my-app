import type { PagesFunction } from '@cloudflare/workers-types';

import { isAuthorized } from '../lib/authorization';
import type { AppEnv } from '../lib/env';
import { jsonResponse } from '../lib/http';

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

function parseAppUrl(value: string, fieldName: string): string {
  if (value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }

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

  const iconUrl = row.icon_url ? parseAppUrl(row.icon_url, 'icon_url') : undefined;
  return {
    id: row.id,
    name: row.name,
    url: parseAppUrl(row.url, 'url'),
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

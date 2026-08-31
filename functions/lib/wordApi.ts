import { isCardStatus } from '../../src/features/word/lib/cardStatus';
import type { Card, Folder } from '../../src/features/word/types';
import type { AppEnv } from './env';
import { jsonResponse as pagesJsonResponse } from './http';

interface WordRequest {
  method: string;
  url: string;
  json: () => Promise<unknown>;
}

type CardRow = Omit<Card, 'status'> & {
  status: string;
};

type FolderRow = Folder;
type WordResponse = ReturnType<typeof pagesJsonResponse<AppEnv>>;
type WordDatabase = AppEnv['DB'];

const ROOT_FOLDER_ID = 'root';
const ROOT_CREATED_AT = '1970-01-01T00:00:00.000Z';
const OWNER_ID = 'owner';

function jsonResponse(body: unknown, status = 200): ReturnType<typeof pagesJsonResponse<AppEnv>> {
  return pagesJsonResponse<AppEnv>(body, status);
}

function dbMissing(): WordResponse {
  return jsonResponse({ error: 'Shared D1 binding DB is not configured' }, 503);
}

function invalidPayload(message: string): WordResponse {
  return jsonResponse({ error: message }, 400);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

async function readBody(request: WordRequest): Promise<Record<string, unknown> | null> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === 'object' && body !== null ? body as Record<string, unknown> : null;
}

async function ensureRootFolder(db: WordDatabase): Promise<void> {
  await db.prepare(
    'INSERT OR IGNORE INTO word_folders (id, name, parentId, createdAt, owner_id) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(ROOT_FOLDER_ID, 'トップ', null, ROOT_CREATED_AT, OWNER_ID)
    .run();
}

async function folderBelongsToOwner(db: WordDatabase, folderId: string): Promise<boolean> {
  if (folderId === ROOT_FOLDER_ID) return true;

  const result = await db.prepare('SELECT id FROM word_folders WHERE id = ? AND owner_id = ? LIMIT 1')
    .bind(folderId, OWNER_ID)
    .all<{ id: string }>();
  return Boolean(result.results?.[0]);
}

export async function handleWordCards(request: WordRequest, env: AppEnv): Promise<WordResponse> {
  const db = env.DB;
  if (!db) return dbMissing();

  if (request.method === 'GET') {
    const { results } = await db.prepare(
      'SELECT id, frontText, backText, folderId, status, createdAt, updatedAt FROM word_cards WHERE owner_id = ? ORDER BY createdAt ASC',
    )
      .bind(OWNER_ID)
      .all<CardRow>();
    return jsonResponse({ cards: results ?? [] });
  }

  if (request.method === 'POST') {
    const body = await readBody(request);
    if (!body
      || !isNonEmptyString(body.id)
      || !isNonEmptyString(body.frontText)
      || !isNonEmptyString(body.backText)
      || !isNonEmptyString(body.folderId)
      || !isNonEmptyString(body.createdAt)
      || !isNonEmptyString(body.updatedAt)) {
      return invalidPayload('Invalid card payload');
    }
    if (body.status !== undefined && !isCardStatus(body.status)) {
      return invalidPayload('Invalid card status');
    }
    await ensureRootFolder(db);
    if (!(await folderBelongsToOwner(db, body.folderId))) {
      return invalidPayload('Invalid card folder');
    }

    const existing = await db.prepare('SELECT owner_id FROM word_cards WHERE id = ? LIMIT 1')
      .bind(body.id)
      .all<{ owner_id: string }>();
    if (existing.results?.[0] && existing.results[0].owner_id !== OWNER_ID) {
      return jsonResponse({ error: 'Card already belongs to another user' }, 409);
    }

    await db.prepare(
      `INSERT INTO word_cards (id, owner_id, frontText, backText, folderId, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         owner_id = excluded.owner_id,
         frontText = excluded.frontText,
         backText = excluded.backText,
         folderId = excluded.folderId,
         status = excluded.status,
         createdAt = excluded.createdAt,
         updatedAt = excluded.updatedAt`,
    )
      .bind(
        body.id,
        OWNER_ID,
        body.frontText,
        body.backText,
        body.folderId,
        body.status ?? 'new',
        body.createdAt,
        body.updatedAt,
      )
      .run();

    return jsonResponse({ ok: true });
  }

  if (request.method === 'DELETE') {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return invalidPayload('Missing card id');

    await db.prepare('DELETE FROM word_cards WHERE id = ? AND owner_id = ?')
      .bind(id, OWNER_ID)
      .run();
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

export async function handleWordFolders(request: WordRequest, env: AppEnv): Promise<WordResponse> {
  const db = env.DB;
  if (!db) return dbMissing();

  if (request.method === 'GET') {
    await ensureRootFolder(db);
    const { results } = await db.prepare(
      'SELECT id, name, parentId, createdAt FROM word_folders WHERE id = ? OR owner_id = ? ORDER BY createdAt ASC',
    )
      .bind(ROOT_FOLDER_ID, OWNER_ID)
      .all<FolderRow>();
    return jsonResponse({ folders: results ?? [] });
  }

  if (request.method === 'POST') {
    const body = await readBody(request);
    if (!body
      || !isNonEmptyString(body.id)
      || body.id === ROOT_FOLDER_ID
      || !isNonEmptyString(body.name)
      || !isNonEmptyString(body.createdAt)) {
      return invalidPayload('Invalid folder payload');
    }

    const parentId = body.parentId === null || body.parentId === undefined ? null : body.parentId;
    if (parentId !== null && (!isNonEmptyString(parentId) || parentId === body.id)) {
      return invalidPayload('Invalid folder parent');
    }
    await ensureRootFolder(db);
    if (parentId && !(await folderBelongsToOwner(db, parentId))) {
      return invalidPayload('Invalid folder parent');
    }

    const existing = await db.prepare('SELECT owner_id FROM word_folders WHERE id = ? LIMIT 1')
      .bind(body.id)
      .all<{ owner_id: string }>();
    if (existing.results?.[0] && existing.results[0].owner_id !== OWNER_ID) {
      return jsonResponse({ error: 'Folder already belongs to another user' }, 409);
    }

    await db.prepare(
      `INSERT INTO word_folders (id, owner_id, name, parentId, createdAt)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         owner_id = excluded.owner_id,
         name = excluded.name,
         parentId = excluded.parentId,
         createdAt = excluded.createdAt`,
    )
      .bind(body.id, OWNER_ID, body.name, parentId, body.createdAt)
      .run();
    return jsonResponse({ ok: true });
  }

  if (request.method === 'DELETE') {
    const id = new URL(request.url).searchParams.get('id');
    if (!id || id === ROOT_FOLDER_ID) return invalidPayload('Invalid folder id');

    const { results: userFolders = [] } = await db.prepare(
      'SELECT id, parentId FROM word_folders WHERE owner_id = ?',
    )
      .bind(OWNER_ID)
      .all<Pick<Folder, 'id' | 'parentId'>>();
    if (!userFolders.some((folder: Pick<Folder, 'id' | 'parentId'>) => folder.id === id)) {
      return jsonResponse({ ok: true, folderIds: [] });
    }

    const folderIds = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      userFolders.forEach((folder: Pick<Folder, 'id' | 'parentId'>) => {
        if (folder.parentId && folderIds.has(folder.parentId) && !folderIds.has(folder.id)) {
          folderIds.add(folder.id);
          changed = true;
        }
      });
    }

    const ids = Array.from(folderIds);
    const placeholders = ids.map(() => '?').join(', ');
    await db.prepare(`DELETE FROM word_cards WHERE owner_id = ? AND folderId IN (${placeholders})`)
      .bind(OWNER_ID, ...ids)
      .run();
    await db.prepare(`DELETE FROM word_folders WHERE owner_id = ? AND id IN (${placeholders})`)
      .bind(OWNER_ID, ...ids)
      .run();

    return jsonResponse({ ok: true, folderIds: ids });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

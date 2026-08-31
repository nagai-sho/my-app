import { badRequest, json, methodNotAllowed, notFound } from './collectionHttp';
import {
  baseName,
  isSameOrChildPath,
  normalizeFolderPath,
  parentPath,
  replacePathPrefix,
} from './collectionPaths';
import type { AppEnv } from './env';

export interface CollectionUser {
  ownerId: string;
  email: string;
}

export interface CollectionRequest {
  method: string;
  url: string;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  formData(): Promise<unknown>;
}

interface CollectionFormData {
  get(name: string): unknown;
}

interface UploadedFile {
  size: number;
  type: string;
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

const COLLECTION_API_PREFIX = "/api/v1/collection";
const DOCUMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

type DocumentRow = {
  id: string;
  owner_id: string;
  title: string;
  kind: "image" | "pdf";
  folder_path: string;
  page_count: number;
  bytes: number;
  mime: string;
  source_created_at: string;
  sort_order: number;
  original_r2_key: string;
  thumbnail_r2_key: string | null;
  legacy_original_r2_key: string | null;
  legacy_thumbnail_r2_key: string | null;
  created_at: string;
  updated_at: string;
};

type FolderRow = {
  id: string;
  owner_id: string;
  path: string;
  name: string;
  parent_path: string;
  manual_order_enabled: number;
  created_at: string;
  updated_at: string;
};

type JsonObject = Record<string, unknown>;

export function canonicalR2Key(documentId: string, variant: "original" | "thumbnail"): string {
  return `collection/owner/${documentId}/${variant}`;
}

export async function handleCollection(
  request: CollectionRequest,
  env: AppEnv,
  user: CollectionUser,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(COLLECTION_API_PREFIX.length) || "/";

  if (path === "/documents") {
    if (request.method === "GET") return listDocuments(env, user);
    if (request.method === "POST") return createDocument(request, env, user);
    return methodNotAllowed("GET, POST");
  }

  if (path === "/documents/move") {
    if (request.method === "POST") return moveDocuments(request, env, user);
    return methodNotAllowed("POST");
  }

  const documentMatch = path.match(/^\/documents\/([^/]+)$/);
  if (documentMatch) {
    const documentId = decodePathSegment(documentMatch[1]);
    if (!documentId) return badRequest("Invalid document id");
    if (request.method === "PATCH") return patchDocument(request, env, user, documentId);
    if (request.method === "DELETE") return deleteDocument(env, user, documentId);
    return methodNotAllowed("PATCH, DELETE");
  }

  if (path === "/folders") {
    if (request.method === "GET") return listFolders(env, user);
    if (request.method === "POST") return createFolder(request, env, user);
    if (request.method === "PATCH") return renameFolder(request, env, user);
    if (request.method === "DELETE") return deleteFolder(request, env, user);
    return methodNotAllowed("GET, POST, PATCH, DELETE");
  }

  if (path === "/files") {
    if (request.method === "GET") return getFile(request, env, user);
    if (request.method === "POST") return uploadFile(request, env, user);
    if (request.method === "DELETE") return cleanupUploadedFiles(request, env, user);
    return methodNotAllowed("GET, POST, DELETE");
  }

  return notFound();
}

export async function handleLegacyFile(
  request: CollectionRequest,
  env: AppEnv,
  user: CollectionUser,
): Promise<Response> {
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return badRequest("Missing key");

  const document = await env.DB.prepare(
    `select id, owner_id, title, kind, folder_path, page_count, bytes, mime,
            source_created_at, sort_order, original_r2_key, thumbnail_r2_key,
            legacy_original_r2_key, legacy_thumbnail_r2_key, created_at, updated_at
       from collection_documents
      where owner_id = ?
        and (original_r2_key = ? or thumbnail_r2_key = ?
          or legacy_original_r2_key = ? or legacy_thumbnail_r2_key = ?)
      limit 1`,
  ).bind(user.ownerId, key, key, key, key).first<DocumentRow>();
  if (!document) return notFound();

  return serveR2Object(env, key);
}

async function listDocuments(env: AppEnv, user: CollectionUser): Promise<Response> {
  const result = await env.DB.prepare(
    `select id, owner_id, title, kind, folder_path, page_count, bytes, mime,
            source_created_at, sort_order, original_r2_key, thumbnail_r2_key,
            legacy_original_r2_key, legacy_thumbnail_r2_key, created_at, updated_at
       from collection_documents
      where owner_id = ?
      order by folder_path asc, title collate nocase asc, sort_order asc,
               source_created_at asc, created_at asc
      limit 5000`,
  ).bind(user.ownerId).all<DocumentRow>();

  return json({ documents: (result.results ?? []).map(toPublicDocument) });
}

async function createDocument(
  request: CollectionRequest,
  env: AppEnv,
  user: CollectionUser,
): Promise<Response> {
  const input = await readJsonObject(request);
  if (!input) return badRequest("Invalid JSON");

  const id = typeof input.id === "string" ? input.id : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const kind = input.kind;
  const mime = typeof input.mime === "string" ? input.mime.trim() : "";
  const folderPath = normalizeFolderPath(
    typeof input.folder_path === "string" ? input.folder_path : "",
  );
  if (!isDocumentId(id)) return badRequest("Invalid document id");
  if (!title || title.length > 300 || !mime) return badRequest("Missing document fields");
  if (kind !== "image" && kind !== "pdf") return badRequest("Invalid document kind");

  const bytes = input.bytes;
  if (typeof bytes !== "number" || !Number.isSafeInteger(bytes) || bytes < 0) {
    return badRequest("Invalid document size");
  }
  const pageCount =
    typeof input.page_count === "number" && Number.isFinite(input.page_count)
      ? Math.max(1, Math.floor(input.page_count))
      : 1;
  const sourceCreatedAt = normalizeIsoDate(input.source_created_at, new Date().toISOString());
  const sortOrder =
    typeof input.sort_order === "number" && Number.isFinite(input.sort_order)
      ? Math.floor(input.sort_order)
      : Date.parse(sourceCreatedAt);

  const existing = await getDocument(env, user.ownerId, id);
  if (existing) return json({ document: toPublicDocument(existing) });

  if (folderPath) {
    const folder = await getFolder(env, user.ownerId, folderPath);
    if (!folder) return badRequest("Directory does not exist");
  }

  const originalKey = canonicalR2Key(id, "original");
  const original = await env.COLLECTION_R2.head(originalKey);
  if (!original) return badRequest("Original file must be uploaded first");
  const thumbnailKey = canonicalR2Key(id, "thumbnail");
  const thumbnail = await env.COLLECTION_R2.head(thumbnailKey);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `insert into collection_documents
      (id, owner_id, title, kind, folder_path, page_count, bytes, mime,
       source_created_at, sort_order, original_r2_key, thumbnail_r2_key,
       legacy_original_r2_key, legacy_thumbnail_r2_key, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, null, ?, ?)`,
  ).bind(
    id,
    user.ownerId,
    title,
    kind,
    folderPath,
    pageCount,
    bytes,
    mime,
    sourceCreatedAt,
    sortOrder,
    originalKey,
    thumbnail ? thumbnailKey : null,
    now,
    now,
  ).run();

  const document = await getDocument(env, user.ownerId, id);
  return json(
    { document: document ? toPublicDocument(document) : null },
    { status: 201 },
  );
}

async function patchDocument(
  request: CollectionRequest,
  env: AppEnv,
  user: CollectionUser,
  documentId: string,
): Promise<Response> {
  if (!isDocumentId(documentId)) return badRequest("Invalid document id");
  const input = await readJsonObject(request);
  if (!input) return badRequest("Invalid JSON");

  const fields: string[] = [];
  const values: unknown[] = [];
  if (typeof input.page_count === "number" && Number.isFinite(input.page_count)) {
    fields.push("page_count = ?");
    values.push(Math.max(1, Math.floor(input.page_count)));
  }
  const updatesSortOrder =
    typeof input.sort_order === "number" && Number.isFinite(input.sort_order);
  if (updatesSortOrder) {
    fields.push("sort_order = ?");
    values.push(Math.floor(input.sort_order as number));
  }
  if (fields.length === 0) return badRequest("No supported fields");

  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `update collection_documents
        set ${fields.join(", ")}, updated_at = ?
      where id = ? and owner_id = ?`,
  ).bind(...values, now, documentId, user.ownerId).run();

  if (updatesSortOrder && result.meta.changes > 0) {
    await env.DB.prepare(
      `update collection_folders
          set manual_order_enabled = 1, updated_at = ?
        where owner_id = ?
          and path = (select folder_path from collection_documents
                       where id = ? and owner_id = ?)`,
    ).bind(now, user.ownerId, documentId, user.ownerId).run();
  }

  return json({ ok: result.meta.changes > 0 });
}

async function deleteDocument(
  env: AppEnv,
  user: CollectionUser,
  documentId: string,
): Promise<Response> {
  if (!isDocumentId(documentId)) return badRequest("Invalid document id");
  const document = await getDocument(env, user.ownerId, documentId);
  await env.DB.prepare(
    "delete from collection_documents where id = ? and owner_id = ?",
  ).bind(documentId, user.ownerId).run();

  const keys = new Set<string>([
    canonicalR2Key(documentId, "original"),
    canonicalR2Key(documentId, "thumbnail"),
  ]);
  if (document?.original_r2_key) keys.add(document.original_r2_key);
  if (document?.thumbnail_r2_key) keys.add(document.thumbnail_r2_key);
  if (document?.legacy_original_r2_key) keys.add(document.legacy_original_r2_key);
  if (document?.legacy_thumbnail_r2_key) keys.add(document.legacy_thumbnail_r2_key);
  await Promise.all([...keys].map((key) => env.COLLECTION_R2.delete(key)));
  return json({ ok: true });
}

async function moveDocuments(
  request: CollectionRequest,
  env: AppEnv,
  user: CollectionUser,
): Promise<Response> {
  const input = await readJsonObject(request);
  const rawIds = input?.ids;
  const ids = Array.isArray(rawIds)
    ? rawIds.filter((id): id is string => typeof id === "string" && isDocumentId(id))
    : [];
  const folderPath = normalizeFolderPath(
    typeof input?.folder_path === "string" ? input.folder_path : "",
  );
  if (ids.length === 0) return badRequest("Document ids are required");
  if (!folderPath) return badRequest("Directory path is required");
  if (!(await getFolder(env, user.ownerId, folderPath))) {
    return badRequest("Directory does not exist");
  }

  const moved: string[] = [];
  const now = new Date().toISOString();
  for (const id of ids) {
    const result = await env.DB.prepare(
      `update collection_documents
          set folder_path = ?, updated_at = ?
        where id = ? and owner_id = ?`,
    ).bind(folderPath, now, id, user.ownerId).run();
    if (result.meta.changes > 0) moved.push(id);
  }
  return json({ moved });
}

async function listFolders(env: AppEnv, user: CollectionUser): Promise<Response> {
  const result = await env.DB.prepare(
    `select id, owner_id, path, name, parent_path, manual_order_enabled,
            created_at, updated_at
       from collection_folders
      where owner_id = ?
      order by path asc`,
  ).bind(user.ownerId).all<FolderRow>();
  return json({ folders: result.results ?? [] });
}

async function createFolder(
  request: CollectionRequest,
  env: AppEnv,
  user: CollectionUser,
): Promise<Response> {
  const input = await readJsonObject(request);
  const path = normalizeFolderPath(typeof input?.path === "string" ? input.path : "");
  if (!path) return badRequest("Directory path is required");
  await ensureFolderPath(env, user.ownerId, path);
  return json({ folder: await getFolder(env, user.ownerId, path) }, { status: 201 });
}

async function renameFolder(
  request: CollectionRequest,
  env: AppEnv,
  user: CollectionUser,
): Promise<Response> {
  const input = await readJsonObject(request);
  const oldPath = normalizeFolderPath(typeof input?.path === "string" ? input.path : "");
  const newPath = normalizeFolderPath(
    typeof input?.new_path === "string" ? input.new_path : "",
  );
  if (!oldPath || !newPath) return badRequest("Directory paths are required");
  if (oldPath === newPath) return json({ ok: true });
  if (isSameOrChildPath(newPath, oldPath)) {
    return badRequest("Cannot move a directory into itself");
  }

  const existing = await getFolder(env, user.ownerId, oldPath);
  if (!existing) return notFound("Directory not found");
  if (await getFolder(env, user.ownerId, newPath)) {
    return badRequest("Directory already exists");
  }
  await ensureFolderPath(env, user.ownerId, parentPath(newPath));

  const folders = await env.DB.prepare(
    `select id, path from collection_folders
      where owner_id = ? and (path = ? or path like ?)
      order by length(path) asc`,
  ).bind(user.ownerId, oldPath, `${oldPath}/%`).all<{ id: string; path: string }>();
  const documents = await env.DB.prepare(
    `select id, folder_path from collection_documents
      where owner_id = ? and (folder_path = ? or folder_path like ?)`,
  ).bind(user.ownerId, oldPath, `${oldPath}/%`).all<{ id: string; folder_path: string }>();

  const now = new Date().toISOString();
  for (const document of documents.results ?? []) {
    await env.DB.prepare(
      `update collection_documents set folder_path = ?, updated_at = ?
        where id = ? and owner_id = ?`,
    ).bind(
      replacePathPrefix(document.folder_path, oldPath, newPath),
      now,
      document.id,
      user.ownerId,
    ).run();
  }
  for (const folder of folders.results ?? []) {
    const path = replacePathPrefix(folder.path, oldPath, newPath);
    await env.DB.prepare(
      `update collection_folders
          set path = ?, name = ?, parent_path = ?, updated_at = ?
        where id = ? and owner_id = ?`,
    ).bind(path, baseName(path), parentPath(path), now, folder.id, user.ownerId).run();
  }

  return json({ ok: true });
}

async function deleteFolder(
  request: CollectionRequest,
  env: AppEnv,
  user: CollectionUser,
): Promise<Response> {
  const path = normalizeFolderPath(new URL(request.url).searchParams.get("path"));
  if (!path) return badRequest("Directory path is required");

  const document = await env.DB.prepare(
    `select id from collection_documents
      where owner_id = ? and (folder_path = ? or folder_path like ?)
      limit 1`,
  ).bind(user.ownerId, path, `${path}/%`).first<{ id: string }>();
  if (document) return badRequest("Directory is not empty");

  await env.DB.prepare(
    `delete from collection_folders
      where owner_id = ? and (path = ? or path like ?)`,
  ).bind(user.ownerId, path, `${path}/%`).run();
  return json({ ok: true });
}

async function uploadFile(
  request: CollectionRequest,
  env: AppEnv,
  user: CollectionUser,
): Promise<Response> {
  const formData = (await request.formData().catch(() => null)) as CollectionFormData | null;
  if (!formData) return badRequest("Invalid form data");
  const file = formData.get("file");
  const documentId = formData.get("document_id");
  const role = formData.get("role");
  if (!isUploadedFile(file)) return badRequest("Missing file");
  if (file.size > MAX_FILE_BYTES) return badRequest("File is too large");
  if (typeof documentId !== "string" || !isDocumentId(documentId)) {
    return badRequest("Invalid document id");
  }
  if (role !== "original" && role !== "thumbnail") {
    return badRequest("Invalid file role");
  }

  const key = canonicalR2Key(documentId, role);
  await env.COLLECTION_R2.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
    customMetadata: {
      owner_id: user.ownerId,
      document_id: documentId,
      variant: role,
      original_name: file.name,
    },
  });
  return json({ document_id: documentId, variant: role });
}

async function getFile(
  request: CollectionRequest,
  env: AppEnv,
  user: CollectionUser,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const documentId = params.get("document_id") ?? "";
  const variant = params.get("variant");
  if (!isDocumentId(documentId)) return badRequest("Invalid document id");
  if (variant !== "original" && variant !== "thumbnail") {
    return badRequest("Invalid file variant");
  }

  const document = await getDocument(env, user.ownerId, documentId);
  if (!document) return notFound();
  const keys = variant === "original"
    ? [document.original_r2_key, document.legacy_original_r2_key]
    : [document.thumbnail_r2_key, document.legacy_thumbnail_r2_key];
  for (const [index, key] of keys.entries()) {
    if (!key) continue;
    const response = await serveR2Object(env, key);
    if (response.status !== 404) {
      if (index > 0) {
        console.warn(
          JSON.stringify({
            level: "warn",
            feature: "collection",
            event: "legacy_r2_fallback",
            document_id: documentId,
            variant,
          }),
        );
      }
      return response;
    }
  }
  console.warn(
    JSON.stringify({
      level: "warn",
      feature: "collection",
      event: "r2_object_not_found",
      document_id: documentId,
      variant,
    }),
  );
  return notFound();
}

async function cleanupUploadedFiles(
  request: CollectionRequest,
  env: AppEnv,
  user: CollectionUser,
): Promise<Response> {
  const documentId = new URL(request.url).searchParams.get("document_id") ?? "";
  if (!isDocumentId(documentId)) return badRequest("Invalid document id");
  const document = await getDocument(env, user.ownerId, documentId);
  if (document) return badRequest("Cannot clean files for a registered document");
  await Promise.all([
    env.COLLECTION_R2.delete(canonicalR2Key(documentId, "original")),
    env.COLLECTION_R2.delete(canonicalR2Key(documentId, "thumbnail")),
  ]);
  return json({ ok: true });
}

async function serveR2Object(env: AppEnv, key: string): Promise<Response> {
  const object = await env.COLLECTION_R2.get(key);
  if (!object) return notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/octet-stream");
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-length", String(object.size));
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}

async function getDocument(
  env: AppEnv,
  ownerId: string,
  documentId: string,
): Promise<DocumentRow | null> {
  return env.DB.prepare(
    `select id, owner_id, title, kind, folder_path, page_count, bytes, mime,
            source_created_at, sort_order, original_r2_key, thumbnail_r2_key,
            legacy_original_r2_key, legacy_thumbnail_r2_key, created_at, updated_at
       from collection_documents
      where id = ? and owner_id = ?
      limit 1`,
  ).bind(documentId, ownerId).first<DocumentRow>();
}

async function getFolder(
  env: AppEnv,
  ownerId: string,
  path: string,
): Promise<FolderRow | null> {
  return env.DB.prepare(
    `select id, owner_id, path, name, parent_path, manual_order_enabled,
            created_at, updated_at
       from collection_folders
      where owner_id = ? and path = ?
      limit 1`,
  ).bind(ownerId, path).first<FolderRow>();
}

async function ensureFolderPath(env: AppEnv, ownerId: string, path: string): Promise<void> {
  const normalized = normalizeFolderPath(path);
  if (!normalized) return;
  const parts = normalized.split("/");
  let current = "";
  const now = new Date().toISOString();
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    await env.DB.prepare(
      `insert or ignore into collection_folders
        (id, owner_id, path, name, parent_path, manual_order_enabled,
         created_at, updated_at)
       values (?, ?, ?, ?, ?, 0, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      ownerId,
      current,
      baseName(current),
      parentPath(current),
      now,
      now,
    ).run();
  }
}

async function readJsonObject(request: CollectionRequest): Promise<JsonObject | null> {
  const value: unknown = await request.json().catch(() => null);
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function decodePathSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function isDocumentId(value: string): boolean {
  return DOCUMENT_ID_PATTERN.test(value);
}

function isUploadedFile(value: unknown): value is UploadedFile {
  if (!value || typeof value !== "object") return false;
  const file = value as Partial<UploadedFile>;
  return typeof file.size === "number"
    && typeof file.type === "string"
    && typeof file.name === "string"
    && typeof file.arrayBuffer === "function";
}

function normalizeIsoDate(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function toPublicDocument(document: DocumentRow) {
  return {
    id: document.id,
    owner_id: document.owner_id,
    title: document.title,
    kind: document.kind,
    has_thumbnail: Boolean(document.thumbnail_r2_key || document.legacy_thumbnail_r2_key),
    folder_path: document.folder_path,
    page_count: document.page_count,
    bytes: document.bytes,
    mime: document.mime,
    source_created_at: document.source_created_at,
    sort_order: document.sort_order,
    created_at: document.created_at,
    updated_at: document.updated_at,
  };
}

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const database = process.env.MY_APP_R2_DATABASE || 'my-app';
const bucket = process.env.MY_APP_COLLECTION_BUCKET || 'collection-app-image';
const apply = process.argv.includes('--apply') || process.env.MY_APP_R2_MIGRATION_APPLY === '1';
const workDir = mkdtempSync(join(tmpdir(), 'my-app-collection-r2-'));
const failures = [];
let planned = 0;
let copied = 0;
let alreadyCanonical = 0;
let updated = 0;
let documents = 0;

try {
  const rows = query(
    database,
    `SELECT id, mime, original_r2_key, thumbnail_r2_key,
            legacy_original_r2_key, legacy_thumbnail_r2_key
       FROM collection_documents
      WHERE owner_id = 'owner'
      ORDER BY id`,
  );
  documents = rows.length;

  for (const row of rows) {
    for (const variant of ['original', 'thumbnail']) {
      await migrateObject(row, variant);
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  database,
  bucket,
  mode: apply ? 'apply' : 'audit',
  documents,
  planned,
  copied,
  alreadyCanonical,
  updated,
  failures,
}, null, 2));
if (failures.length > 0) process.exitCode = 1;

async function migrateObject(row, variant) {
  const documentId = typeof row.id === 'string' ? row.id : '';
  if (!isSafeDocumentId(documentId)) {
    failures.push(`invalid document id: ${String(row.id)}`);
    return;
  }

  const canonical = `collection/owner/${documentId}/${variant}`;
  const currentKey = variant === 'original' ? row.original_r2_key : row.thumbnail_r2_key;
  const legacyKey = variant === 'original' ? row.legacy_original_r2_key : row.legacy_thumbnail_r2_key;
  const candidates = [...new Set([legacyKey, currentKey])]
    .filter(isSafeKey)
    .filter((key) => key !== canonical);

  // Thumbnails are optional for documents created without a preview. Do not
  // make an absent optional object look like a migration failure.
  if (candidates.length === 0 && variant === 'thumbnail' && currentKey == null && legacyKey == null) return;

  const canonicalFile = join(workDir, `${documentId}-${variant}-canonical`);
  if (download(canonical, canonicalFile)) {
    alreadyCanonical += 1;
    if (apply && currentKey !== canonical) {
      updateCanonicalKey(database, documentId, variant, canonical, candidates[0] || currentKey);
      updated += 1;
    }
    return;
  }

  planned += 1;
  let source;
  let sourceFile;
  for (const candidate of candidates) {
    const candidateFile = join(workDir, `${documentId}-${variant}-source`);
    if (download(candidate, candidateFile)) {
      source = candidate;
      sourceFile = candidateFile;
      break;
    }
  }

  if (!source || !sourceFile) {
    failures.push(`${documentId}/${variant}: no source R2 object found`);
    return;
  }
  if (!apply) {
    console.log(`[audit] ${source} -> ${canonical}`);
    return;
  }

  const contentType = variant === 'thumbnail' ? 'image/jpeg' : (typeof row.mime === 'string' && row.mime ? row.mime : 'application/octet-stream');
  run('wrangler', [
    'r2', 'object', 'put', `${bucket}/${canonical}`,
    '--remote', '--file', sourceFile,
    '--content-type', contentType,
    '--cache-control', 'private, no-store',
  ]);
  const verificationFile = join(workDir, `${documentId}-${variant}-verification`);
  if (!download(canonical, verificationFile)) {
    failures.push(`${documentId}/${variant}: canonical R2 object could not be verified`);
    return;
  }
  copied += 1;
  updateCanonicalKey(database, documentId, variant, canonical, source);
  updated += 1;
}

function query(databaseName, sql) {
  const output = run('wrangler', ['d1', 'execute', databaseName, '--remote', '--command', sql, '--json']);
  const value = parseJsonOutput(output, sql);
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry) => {
    if (entry && Array.isArray(entry.results)) return entry.results;
    if (entry && Array.isArray(entry.result)) return entry.result;
    return [];
  });
}

function updateCanonicalKey(databaseName, documentId, variant, canonical, legacyKey) {
  const canonicalColumn = variant === 'original' ? 'original_r2_key' : 'thumbnail_r2_key';
  const legacyColumn = variant === 'original' ? 'legacy_original_r2_key' : 'legacy_thumbnail_r2_key';
  const legacyValue = isSafeKey(legacyKey) && legacyKey !== canonical ? legacyKey : null;
  const sql = `UPDATE collection_documents
    SET ${canonicalColumn} = ${quote(canonical)},
        ${legacyColumn} = COALESCE(${legacyColumn}, ${quote(legacyValue)})
    WHERE id = ${quote(documentId)} AND owner_id = 'owner';`;
  run('wrangler', ['d1', 'execute', databaseName, '--remote', '--command', sql, '--yes']);
}

function download(key, output) {
  try {
    execFileSync('npx', ['wrangler', 'r2', 'object', 'get', `${bucket}/${key}`, '--remote', '--file', output], {
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function run(command, args) {
  return execFileSync('npx', [command, ...args], {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  });
}

function parseJsonOutput(output, sql) {
  const trimmed = output.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const indexes = [trimmed.indexOf('['), trimmed.indexOf('{')].filter((index) => index >= 0);
    const start = indexes.length > 0 ? Math.min(...indexes) : -1;
    const end = Math.max(trimmed.lastIndexOf(']'), trimmed.lastIndexOf('}'));
    if (start < 0 || end < start) throw new Error(`No JSON result for ${sql}`);
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function quote(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function isSafeDocumentId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isSafeKey(value) {
  return typeof value === 'string'
    && value.length > 0
    && !value.split('/').includes('..')
    && /^[A-Za-z0-9._/-]+$/.test(value);
}

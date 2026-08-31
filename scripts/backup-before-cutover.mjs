import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const database = process.env.MY_APP_BACKUP_DATABASE || 'my-app';
const bucket = process.env.MY_APP_COLLECTION_BUCKET || 'collection-app-image';
const root = resolve(process.env.MY_APP_BACKUP_DIR || join('backups', new Date().toISOString().replace(/[:.]/g, '-')));
const d1File = join(root, `${database}.sql`);
const manifestFile = join(root, 'collection-r2-keys.txt');

mkdirSync(root, { recursive: true });
run('wrangler', ['d1', 'export', database, '--remote', '--output', d1File]);

const query = [
  'SELECT original_r2_key AS key FROM collection_documents WHERE original_r2_key IS NOT NULL',
  'UNION SELECT thumbnail_r2_key AS key FROM collection_documents WHERE thumbnail_r2_key IS NOT NULL',
  'UNION SELECT legacy_original_r2_key AS key FROM collection_documents WHERE legacy_original_r2_key IS NOT NULL',
  'UNION SELECT legacy_thumbnail_r2_key AS key FROM collection_documents WHERE legacy_thumbnail_r2_key IS NOT NULL',
].join(' ');
const result = parseWranglerJson(run('wrangler', ['d1', 'execute', database, '--remote', '--command', query, '--json']));
const keys = [...new Set((result.flatMap((entry) => entry.results || [])).map((row) => row.key).filter(isSafeKey))].sort();
writeFileSync(manifestFile, `${keys.join('\n')}${keys.length ? '\n' : ''}`, 'utf8');

for (const key of keys) {
  const output = join(root, 'r2', key);
  mkdirSync(dirname(output), { recursive: true });
  run('wrangler', ['r2', 'object', 'get', `${bucket}/${key}`, '--remote', '--file', output]);
}

console.log(`D1 backup: ${d1File}`);
console.log(`R2 objects backed up: ${keys.length}`);
console.log(`R2 manifest: ${manifestFile}`);

function run(command, args) {
  return execFileSync('npx', [command, ...args], { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
}

function parseWranglerJson(output) {
  const value = parseJsonOutput(output);
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry) => {
    if (entry && Array.isArray(entry.results)) return [entry];
    if (entry && Array.isArray(entry.result)) return [{ results: entry.result }];
    return [];
  });
}

function parseJsonOutput(output) {
  const trimmed = output.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = Math.min(...[trimmed.indexOf('['), trimmed.indexOf('{')].filter((index) => index >= 0));
    const end = Math.max(trimmed.lastIndexOf(']'), trimmed.lastIndexOf('}'));
    if (!Number.isFinite(start) || end < start) throw new Error('Wrangler did not return JSON results');
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function isSafeKey(value) {
  return typeof value === 'string' && value.length > 0 && !value.split('/').includes('..') && /^[A-Za-z0-9._/-]+$/.test(value);
}

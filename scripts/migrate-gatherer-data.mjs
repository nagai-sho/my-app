import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const sourceDatabase = process.env.GATHERER_SOURCE_DATABASE || 'gatherer-app';
const targetDatabase = process.env.MY_APP_TARGET_DATABASE || 'my-app';
const output = resolve(process.env.GATHERER_MIGRATION_SQL || 'backups/gatherer-import.sql');
const tables = {
  sources: ['id', 'provider', 'endpoint', 'title', 'enabled', 'created_at', 'updated_at'],
  rules: ['id', 'source_id', 'include_keywords', 'exclude_keywords', 'regex', 'tags', 'created_at', 'updated_at'],
  items: ['id', 'source_id', 'rule_id', 'external_id', 'title', 'url', 'summary', 'published_at', 'day_key', 'score', 'created_at'],
  item_states: ['user_id', 'item_id', 'read', 'created_at', 'updated_at'],
  fetch_runs: ['id', 'ran_at', 'day_key', 'status', 'note'],
  tasks: ['id', 'label', 'color', 'enabled', 'created_at'],
  task_logs: ['task_id', 'day_key', 'count'],
};

const statements = [
  'INSERT OR IGNORE INTO app_users (id, created_at, updated_at) VALUES (\'owner\', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);',
];

for (const [table, columns] of Object.entries(tables)) {
  const rows = query(sourceDatabase, `SELECT ${columns.join(', ')} FROM ${table}`);
  for (const row of rows) statements.push(toInsert(table, row));
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${statements.join('\n')}\n`, 'utf8');
console.log(`Generated ${output}`);
console.log(`Apply only after review: npx wrangler d1 execute ${targetDatabase} --remote --file ${output}`);

function query(database, sql) {
  const output = execFileSync('npx', ['wrangler', 'd1', 'execute', database, '--remote', '--command', sql, '--json'], { encoding: 'utf8' });
  const value = parseJsonOutput(output, sql);
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry) => {
    if (entry && Array.isArray(entry.results)) return entry.results;
    if (entry && Array.isArray(entry.result)) return entry.result;
    return [];
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

function toInsert(table, row) {
  if (table === 'sources') {
    return `INSERT INTO gatherer_sources (id, owner_id, provider, endpoint, title, enabled, created_at, updated_at) VALUES (${q(row.id)}, 'owner', ${q(row.provider)}, ${q(row.endpoint)}, ${q(row.title)}, ${number(row.enabled)}, ${number(row.created_at)}, ${number(row.updated_at)}) ON CONFLICT(id) DO UPDATE SET owner_id = 'owner', provider = excluded.provider, endpoint = excluded.endpoint, title = excluded.title, enabled = excluded.enabled, updated_at = excluded.updated_at;`;
  }
  if (table === 'rules') {
    return `INSERT INTO gatherer_rules (id, source_id, include_keywords, exclude_keywords, regex, tags, created_at, updated_at) VALUES (${q(row.id)}, ${q(row.source_id)}, ${q(row.include_keywords)}, ${q(row.exclude_keywords)}, ${q(row.regex)}, ${q(row.tags)}, ${number(row.created_at)}, ${number(row.updated_at)}) ON CONFLICT(id) DO UPDATE SET source_id = excluded.source_id, include_keywords = excluded.include_keywords, exclude_keywords = excluded.exclude_keywords, regex = excluded.regex, tags = excluded.tags, updated_at = excluded.updated_at;`;
  }
  if (table === 'items') {
    return `INSERT INTO gatherer_items (id, owner_id, source_id, rule_id, external_id, title, url, summary, published_at, day_key, score, created_at, updated_at) VALUES (${q(row.id)}, 'owner', ${q(row.source_id)}, ${q(row.rule_id)}, ${q(row.external_id)}, ${q(row.title)}, ${q(row.url)}, ${q(row.summary)}, ${numberOrNull(row.published_at)}, ${q(row.day_key)}, ${number(row.score)}, ${number(row.created_at)}, ${number(row.created_at)}) ON CONFLICT(source_id, external_id) DO UPDATE SET owner_id = 'owner', rule_id = excluded.rule_id, title = excluded.title, url = excluded.url, summary = excluded.summary, published_at = excluded.published_at, day_key = excluded.day_key, score = excluded.score, updated_at = excluded.updated_at;`;
  }
  if (table === 'item_states') {
    return `INSERT INTO gatherer_item_states (owner_id, item_id, read, created_at, updated_at) VALUES ('owner', ${q(row.item_id)}, ${number(row.read)}, ${number(row.created_at)}, ${number(row.updated_at)}) ON CONFLICT(owner_id, item_id) DO UPDATE SET read = excluded.read, updated_at = excluded.updated_at;`;
  }
  if (table === 'fetch_runs') {
    const status = ['success', 'partial', 'fail'].includes(row.status) ? row.status : 'fail';
    return `INSERT OR IGNORE INTO gatherer_fetch_runs (id, owner_id, ran_at, day_key, trigger, status, started_at, finished_at, failures_json, note) VALUES (${q(row.id)}, 'owner', ${number(row.ran_at)}, ${q(row.day_key)}, 'manual', ${q(status)}, ${number(row.ran_at)}, ${number(row.ran_at)}, '[]', ${q(row.note || '')});`;
  }
  if (table === 'tasks') {
    return `INSERT INTO gatherer_tasks (id, owner_id, label, color, enabled, created_at) VALUES (${q(row.id)}, 'owner', ${q(row.label)}, ${q(row.color)}, ${number(row.enabled)}, ${number(row.created_at)}) ON CONFLICT(id) DO UPDATE SET owner_id = 'owner', label = excluded.label, color = excluded.color, enabled = excluded.enabled;`;
  }
  return `INSERT INTO gatherer_task_logs (task_id, day_key, count) VALUES (${q(row.task_id)}, ${q(row.day_key)}, ${number(row.count)}) ON CONFLICT(task_id, day_key) DO UPDATE SET count = excluded.count;`;
}

function q(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : '0';
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  return number(value);
}

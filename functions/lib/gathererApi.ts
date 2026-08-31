import { z } from 'zod';

import { collectGatherer } from './gathererCollect';
import { dayKeyJst, isDayKey, nowSeconds } from './gathererTime';
import type {
  GathererEnv,
  GathererProvider,
  GathererRuleRow,
  GathererSourceRow,
} from './gathererTypes';

type GathererRunRow = {
  id: string;
  owner_id: string;
  ran_at: number;
  day_key: string;
  trigger: string;
  status: string;
  started_at: number;
  finished_at: number | null;
  inserted_count: number;
  reused_count: number;
  skipped_count: number;
  credits_used: number;
  failures_json: string;
  note: string;
};

const PROVIDERS: [GathererProvider, ...GathererProvider[]] = [
  'rss',
  'json_api',
  'github_releases',
  'html',
  'tavily',
];
const OWNER_ID = 'owner';
const API_PREFIX = '/api/v1/gatherer';

const ruleSchema = z.object({
  include_keywords: z.array(z.string().trim().min(1)).default([]),
  exclude_keywords: z.array(z.string().trim().min(1)).default([]),
  regex: z.string().trim().max(500).nullable().default(null),
  tags: z.array(z.string().trim().min(1)).default([]),
});
const providerSchema = z.enum(PROVIDERS);
const sourceCreateSchema = z.object({
  provider: providerSchema,
  endpoint: z.string().trim().min(1).max(2_000),
  title: z.string().trim().min(1).max(200),
  rule: ruleSchema,
});
const sourcePatchSchema = z.object({
  provider: providerSchema.optional(),
  endpoint: z.string().trim().min(1).max(2_000).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  enabled: z.number().int().min(0).max(1).optional(),
});
const rulePatchSchema = ruleSchema.partial();
const taskCreateSchema = z.object({
  label: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2f5d50'),
});
const taskPatchSchema = taskCreateSchema.partial();
const taskLogSchema = z.object({
  day_key: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  delta: z.number().positive().max(10).default(0.5),
  reset: z.boolean().default(false),
});

class GathererInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GathererInputError';
  }
}

export async function handleGatherer(
  request: Request,
  env: GathererEnv,
  ownerId = OWNER_ID,
): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'GET, POST, PATCH, DELETE, OPTIONS' } });
  const path = new URL(request.url).pathname.slice(API_PREFIX.length).replace(/\/$/, '') || '/';

  try {
    if (path === '/collect' && request.method === 'POST') {
      const dayKey = new URL(request.url).searchParams.get('date') || dayKeyJst();
      if (!isDayKey(dayKey)) return errorResponse('Invalid date', 400);
      return jsonResponse(await collectGatherer(env, dayKey, 'manual'));
    }
    if (path === '/items' && request.method === 'GET') return listItems(request, env, ownerId);
    if (path === '/sources' && request.method === 'GET') return listSources(env, ownerId);
    if (path === '/sources' && request.method === 'POST') return createSource(request, env, ownerId);
    if (path === '/tasks' && request.method === 'GET') return listTasks(request, env, ownerId);
    if (path === '/tasks' && request.method === 'POST') return createTask(request, env, ownerId);
    if (path === '/runs' && request.method === 'GET') return listRuns(env, ownerId);

    const sourceRulesMatch = path.match(/^\/sources\/([^/]+)\/rules$/);
    if (sourceRulesMatch) {
      const sourceId = decodeSegment(sourceRulesMatch[1]);
      if (!sourceId) return errorResponse('Invalid source id', 400);
      if (request.method === 'GET') return listRules(env, ownerId, sourceId);
      if (request.method === 'POST') return createRule(request, env, ownerId, sourceId);
    }

    const sourceMatch = path.match(/^\/sources\/([^/]+)$/);
    if (sourceMatch) {
      const sourceId = decodeSegment(sourceMatch[1]);
      if (!sourceId) return errorResponse('Invalid source id', 400);
      if (request.method === 'PATCH') return patchSource(request, env, ownerId, sourceId);
      if (request.method === 'DELETE') return deleteSource(env, ownerId, sourceId);
    }

    const ruleMatch = path.match(/^\/rules\/([^/]+)$/);
    if (ruleMatch) {
      const ruleId = decodeSegment(ruleMatch[1]);
      if (!ruleId) return errorResponse('Invalid rule id', 400);
      if (request.method === 'PATCH') return patchRule(request, env, ownerId, ruleId);
      if (request.method === 'DELETE') return deleteRule(env, ownerId, ruleId);
    }

    const itemReadMatch = path.match(/^\/items\/([^/]+)\/read$/);
    if (itemReadMatch && request.method === 'PATCH') {
      const itemId = decodeSegment(itemReadMatch[1]);
      if (!itemId) return errorResponse('Invalid item id', 400);
      return setItemRead(request, env, ownerId, itemId);
    }

    const taskLogsMatch = path.match(/^\/tasks\/([^/]+)\/logs$/);
    if (taskLogsMatch && request.method === 'POST') {
      const taskId = decodeSegment(taskLogsMatch[1]);
      if (!taskId) return errorResponse('Invalid task id', 400);
      return updateTaskLog(request, env, ownerId, taskId);
    }

    const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
    if (taskMatch && request.method === 'PATCH') {
      const taskId = decodeSegment(taskMatch[1]);
      if (!taskId) return errorResponse('Invalid task id', 400);
      return patchTask(request, env, ownerId, taskId);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(error.issues[0]?.message || 'Invalid request', 400);
    if (error instanceof GathererInputError) return errorResponse(error.message, 400);
    console.error(JSON.stringify({
      level: 'error',
      feature: 'gatherer',
      event: 'api_request_failed',
      path,
      message: error instanceof Error ? error.message : String(error),
    }));
    return errorResponse('Request failed', 500);
  }
}

async function listSources(env: GathererEnv, ownerId: string): Promise<Response> {
  const sources = await env.DB.prepare(
    `SELECT * FROM gatherer_sources
     WHERE owner_id = ? ORDER BY updated_at DESC, created_at DESC`,
  ).bind(ownerId).all<GathererSourceRow>();
  const rules = await env.DB.prepare(
    `SELECT r.* FROM gatherer_rules r
     INNER JOIN gatherer_sources s ON s.id = r.source_id
     WHERE s.owner_id = ? ORDER BY r.created_at ASC`,
  ).bind(ownerId).all<GathererRuleRow>();
  const bySource = new Map<string, ReturnType<typeof serializeRule>[]>();
  for (const rule of rules.results ?? []) {
    const list = bySource.get(rule.source_id) ?? [];
    list.push(serializeRule(rule));
    bySource.set(rule.source_id, list);
  }
  const sourceRows: GathererSourceRow[] = sources.results ?? [];
  return jsonResponse({
    sources: sourceRows.map((source: GathererSourceRow) => ({
      ...source,
      rules: bySource.get(source.id) ?? [],
    })),
  });
}

async function createSource(request: Request, env: GathererEnv, ownerId: string): Promise<Response> {
  const body = sourceCreateSchema.parse(await readJson(request));
  validateEndpoint(body.provider, body.endpoint);
  const sourceId = crypto.randomUUID();
  const ruleId = crypto.randomUUID();
  const now = nowSeconds();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO gatherer_sources
       (id, owner_id, provider, endpoint, title, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    ).bind(sourceId, ownerId, body.provider, body.endpoint, body.title, now, now),
    env.DB.prepare(
      `INSERT INTO gatherer_rules
       (id, source_id, include_keywords, exclude_keywords, regex, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      ruleId,
      sourceId,
      JSON.stringify(body.rule.include_keywords),
      JSON.stringify(body.rule.exclude_keywords),
      body.rule.regex,
      JSON.stringify(body.rule.tags),
      now,
      now,
    ),
  ]);
  const result = await sourceById(env, ownerId, sourceId);
  return jsonResponse({ source: result }, 201);
}

async function patchSource(request: Request, env: GathererEnv, ownerId: string, sourceId: string): Promise<Response> {
  const body = sourcePatchSchema.parse(await readJson(request));
  const current = await sourceById(env, ownerId, sourceId);
  if (!current) return errorResponse('Source not found', 404);
  const provider = body.provider ?? current.provider;
  const endpoint = body.endpoint ?? current.endpoint;
  validateEndpoint(provider, endpoint);
  await env.DB.prepare(
    `UPDATE gatherer_sources SET provider = ?, endpoint = ?, title = ?, enabled = ?, updated_at = ?
     WHERE id = ? AND owner_id = ?`,
  ).bind(provider, endpoint, body.title ?? current.title, body.enabled ?? current.enabled, nowSeconds(), sourceId, ownerId).run();
  return jsonResponse({ source: await sourceById(env, ownerId, sourceId) });
}

async function deleteSource(env: GathererEnv, ownerId: string, sourceId: string): Promise<Response> {
  const current = await sourceById(env, ownerId, sourceId);
  if (!current) return errorResponse('Source not found', 404);
  await env.DB.prepare('DELETE FROM gatherer_sources WHERE id = ? AND owner_id = ?').bind(sourceId, ownerId).run();
  return jsonResponse({ deleted: true });
}

async function listRules(env: GathererEnv, ownerId: string, sourceId: string): Promise<Response> {
  const current = await sourceById(env, ownerId, sourceId);
  if (!current) return errorResponse('Source not found', 404);
  return jsonResponse({ rules: current.rules });
}

async function createRule(request: Request, env: GathererEnv, ownerId: string, sourceId: string): Promise<Response> {
  const current = await sourceById(env, ownerId, sourceId);
  if (!current) return errorResponse('Source not found', 404);
  const body = ruleSchema.parse(await readJson(request));
  const id = crypto.randomUUID();
  const now = nowSeconds();
  await env.DB.prepare(
    `INSERT INTO gatherer_rules
     (id, source_id, include_keywords, exclude_keywords, regex, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, sourceId, JSON.stringify(body.include_keywords), JSON.stringify(body.exclude_keywords), body.regex, JSON.stringify(body.tags), now, now).run();
  const rule = await env.DB.prepare('SELECT * FROM gatherer_rules WHERE id = ?').bind(id).first<GathererRuleRow>();
  return jsonResponse({ rule: rule ? serializeRule(rule) : null }, 201);
}

async function patchRule(request: Request, env: GathererEnv, ownerId: string, ruleId: string): Promise<Response> {
  const current = await ruleForOwner(env, ownerId, ruleId);
  if (!current) return errorResponse('Rule not found', 404);
  const body = rulePatchSchema.parse(await readJson(request));
  await env.DB.prepare(
    `UPDATE gatherer_rules SET include_keywords = ?, exclude_keywords = ?, regex = ?, tags = ?, updated_at = ?
     WHERE id = ?`,
  ).bind(
    JSON.stringify(body.include_keywords ?? parseArray(current.include_keywords)),
    JSON.stringify(body.exclude_keywords ?? parseArray(current.exclude_keywords)),
    body.regex === undefined ? current.regex : body.regex,
    JSON.stringify(body.tags ?? parseArray(current.tags)),
    nowSeconds(),
    ruleId,
  ).run();
  const updated = await env.DB.prepare('SELECT * FROM gatherer_rules WHERE id = ?').bind(ruleId).first<GathererRuleRow>();
  return jsonResponse({ rule: updated ? serializeRule(updated) : null });
}

async function deleteRule(env: GathererEnv, ownerId: string, ruleId: string): Promise<Response> {
  if (!(await ruleForOwner(env, ownerId, ruleId))) return errorResponse('Rule not found', 404);
  await env.DB.prepare('DELETE FROM gatherer_rules WHERE id = ?').bind(ruleId).run();
  return jsonResponse({ deleted: true });
}

async function listItems(request: Request, env: GathererEnv, ownerId: string): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const dayKey = params.get('day_key') || dayKeyJst();
  if (!isDayKey(dayKey)) return errorResponse('Invalid date', 400);
  const unreadOnly = params.get('unread_only') === '1';
  const limit = clampNumber(params.get('limit'), 1, 50, 10);
  const offset = clampNumber(params.get('offset'), 0, 10_000, 0);
  const unreadClause = unreadOnly ? 'AND COALESCE(st.read, 0) = 0' : '';
  const count = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM gatherer_items i
     INNER JOIN gatherer_sources s ON s.id = i.source_id AND s.owner_id = ?
     LEFT JOIN gatherer_item_states st ON st.item_id = i.id AND st.owner_id = ?
     WHERE i.owner_id = ? AND i.day_key = ? ${unreadClause}`,
  ).bind(ownerId, ownerId, ownerId, dayKey).first<{ total: number }>();
  const result = await env.DB.prepare(
    `SELECT i.*, s.title AS source_title, COALESCE(st.read, 0) AS read
     FROM gatherer_items i
     INNER JOIN gatherer_sources s ON s.id = i.source_id AND s.owner_id = ?
     LEFT JOIN gatherer_item_states st ON st.item_id = i.id AND st.owner_id = ?
     WHERE i.owner_id = ? AND i.day_key = ? ${unreadClause}
     ORDER BY COALESCE(st.read, 0) ASC, i.score DESC, COALESCE(i.published_at, i.created_at) DESC
     LIMIT ? OFFSET ?`,
  ).bind(ownerId, ownerId, ownerId, dayKey, limit, offset).all();
  return jsonResponse({ items: result.results ?? [], total: Number(count?.total ?? 0), limit, offset });
}

async function setItemRead(request: Request, env: GathererEnv, ownerId: string, itemId: string): Promise<Response> {
  const body = z.object({ read: z.boolean() }).parse(await readJson(request));
  const item = await env.DB.prepare(
    `SELECT i.id FROM gatherer_items i INNER JOIN gatherer_sources s ON s.id = i.source_id
     WHERE i.id = ? AND i.owner_id = ? AND s.owner_id = ? LIMIT 1`,
  ).bind(itemId, ownerId, ownerId).first<{ id: string }>();
  if (!item) return errorResponse('Item not found', 404);
  const now = nowSeconds();
  await env.DB.prepare(
    `INSERT INTO gatherer_item_states (owner_id, item_id, read, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(owner_id, item_id) DO UPDATE SET read = excluded.read, updated_at = excluded.updated_at`,
  ).bind(ownerId, itemId, body.read ? 1 : 0, now, now).run();
  return jsonResponse({ item: await itemById(env, ownerId, itemId) });
}

async function listTasks(request: Request, env: GathererEnv, ownerId: string): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const from = params.get('from') || dayKeyJst();
  const to = params.get('to') || from;
  if (!isDayKey(from) || !isDayKey(to) || from > to) return errorResponse('Invalid date range', 400);
  const tasks = await env.DB.prepare(
    `SELECT * FROM gatherer_tasks WHERE owner_id = ? AND enabled = 1 ORDER BY created_at ASC`,
  ).bind(ownerId).all();
  const logs = await env.DB.prepare(
    `SELECT l.* FROM gatherer_task_logs l INNER JOIN gatherer_tasks t ON t.id = l.task_id
     WHERE t.owner_id = ? AND l.day_key >= ? AND l.day_key <= ? ORDER BY l.day_key ASC`,
  ).bind(ownerId, from, to).all();
  return jsonResponse({ tasks: tasks.results ?? [], logs: logs.results ?? [] });
}

async function createTask(request: Request, env: GathererEnv, ownerId: string): Promise<Response> {
  const body = taskCreateSchema.parse(await readJson(request));
  const task = { id: crypto.randomUUID(), owner_id: ownerId, label: body.label, color: body.color, enabled: 1, created_at: nowSeconds() };
  await env.DB.prepare(
    `INSERT INTO gatherer_tasks (id, owner_id, label, color, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)`,
  ).bind(task.id, task.owner_id, task.label, task.color, task.created_at).run();
  return jsonResponse({ task }, 201);
}

async function patchTask(request: Request, env: GathererEnv, ownerId: string, taskId: string): Promise<Response> {
  const body = taskPatchSchema.parse(await readJson(request));
  const current = await env.DB.prepare(
    'SELECT * FROM gatherer_tasks WHERE id = ? AND owner_id = ? AND enabled = 1',
  ).bind(taskId, ownerId).first<Record<string, unknown>>();
  if (!current) return errorResponse('Task not found', 404);
  await env.DB.prepare('UPDATE gatherer_tasks SET label = ?, color = ? WHERE id = ? AND owner_id = ?')
    .bind(body.label ?? current.label, body.color ?? current.color, taskId, ownerId).run();
  return jsonResponse({ task: await env.DB.prepare('SELECT * FROM gatherer_tasks WHERE id = ?').bind(taskId).first() });
}

async function updateTaskLog(request: Request, env: GathererEnv, ownerId: string, taskId: string): Promise<Response> {
  const body = taskLogSchema.parse(await readJson(request));
  if (!isDayKey(body.day_key)) return errorResponse('Invalid date', 400);
  const task = await env.DB.prepare(
    'SELECT id FROM gatherer_tasks WHERE id = ? AND owner_id = ? AND enabled = 1',
  ).bind(taskId, ownerId).first<{ id: string }>();
  if (!task) return errorResponse('Task not found', 404);
  if (body.reset) {
    await env.DB.prepare('DELETE FROM gatherer_task_logs WHERE task_id = ? AND day_key = ?').bind(taskId, body.day_key).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO gatherer_task_logs (task_id, day_key, count) VALUES (?, ?, ?)
       ON CONFLICT(task_id, day_key) DO UPDATE SET count = count + excluded.count`,
    ).bind(taskId, body.day_key, body.delta).run();
  }
  return jsonResponse({ log: await env.DB.prepare(
    'SELECT task_id, day_key, count FROM gatherer_task_logs WHERE task_id = ? AND day_key = ?',
  ).bind(taskId, body.day_key).first() ?? { task_id: taskId, day_key: body.day_key, count: 0 } });
}

async function listRuns(env: GathererEnv, ownerId: string): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT id, owner_id, ran_at, day_key, trigger, status, started_at, finished_at,
            inserted_count, reused_count, skipped_count, credits_used, failures_json, note
     FROM gatherer_fetch_runs WHERE owner_id = ? ORDER BY ran_at DESC LIMIT 50`,
  ).bind(ownerId).all<GathererRunRow>();
  return jsonResponse({ runs: (result.results ?? []).map((run: GathererRunRow) => ({
    ...run,
    failures: parseArray(typeof run.failures_json === 'string' ? run.failures_json : '[]'),
  })) });
}

async function sourceById(env: GathererEnv, ownerId: string, sourceId: string) {
  const source = await env.DB.prepare(
    'SELECT * FROM gatherer_sources WHERE id = ? AND owner_id = ? LIMIT 1',
  ).bind(sourceId, ownerId).first<GathererSourceRow>();
  if (!source) return null;
  const rules = await env.DB.prepare('SELECT * FROM gatherer_rules WHERE source_id = ? ORDER BY created_at ASC')
    .bind(sourceId).all<GathererRuleRow>();
  return { ...source, rules: (rules.results ?? []).map(serializeRule) };
}

async function ruleForOwner(env: GathererEnv, ownerId: string, ruleId: string) {
  return env.DB.prepare(
    `SELECT r.* FROM gatherer_rules r INNER JOIN gatherer_sources s ON s.id = r.source_id
     WHERE r.id = ? AND s.owner_id = ? LIMIT 1`,
  ).bind(ruleId, ownerId).first<GathererRuleRow>();
}

async function itemById(env: GathererEnv, ownerId: string, itemId: string) {
  return env.DB.prepare(
    `SELECT i.*, s.title AS source_title, COALESCE(st.read, 0) AS read
     FROM gatherer_items i INNER JOIN gatherer_sources s ON s.id = i.source_id
     LEFT JOIN gatherer_item_states st ON st.item_id = i.id AND st.owner_id = ?
     WHERE i.id = ? AND i.owner_id = ? AND s.owner_id = ? LIMIT 1`,
  ).bind(ownerId, itemId, ownerId, ownerId).first();
}

function serializeRule(rule: GathererRuleRow) {
  return {
    ...rule,
    include_keywords: parseArray(rule.include_keywords),
    exclude_keywords: parseArray(rule.exclude_keywords),
    tags: parseArray(rule.tags),
  };
}

function validateEndpoint(provider: GathererProvider, endpoint: string): void {
  if (provider === 'tavily') return;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new GathererInputError('HTTP(S) URL is required');
  } catch (error) {
    if (error instanceof GathererInputError) throw error;
    throw new GathererInputError('HTTP(S) URL is required');
  }
}

function clampNumber(value: string | null, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
}

function parseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => { throw new GathererInputError('Invalid JSON body'); });
}

function decodeSegment(value: string): string | null {
  try { return decodeURIComponent(value); } catch { return null; }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

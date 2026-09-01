import type { AppEnv } from './env';
import { jsonResponse } from './http';

const API_PREFIX = '/api/v1/operations';
const OWNER_ID = 'owner';
const EXTERNAL_CHECK_TIMEOUT_MS = 5_000;
const RUN_STATUSES = ['running', 'success', 'partial', 'fail'] as const;
const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;

type AppCategory = 'integrated' | 'external';
type ServiceStatus = 'online' | 'degraded' | 'offline' | 'unknown';
type RunStatus = typeof RUN_STATUSES[number];
type TaskStatus = typeof TASK_STATUSES[number];

interface AppRow {
  id: string;
  name: string;
  url: string;
  description: string | null;
  category: string | null;
  icon_url: string | null;
  pinned: number;
}

interface TaskSummaryRow {
  total: number;
  pending: number;
  today: number;
  overdue: number;
  done: number;
}

interface SourceSummaryRow {
  total: number;
  enabled: number;
}

interface RunRow {
  id: string;
  status: string;
  ran_at: number;
  inserted_count: number;
  reused_count: number;
  skipped_count: number;
  failures_json: string;
}

interface RecentTaskRow {
  id: string;
  title: string;
  status: string;
  updated_at: number;
}

export async function handleOperations(
  request: Request,
  env: AppEnv,
  ownerId = OWNER_ID,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { Allow: 'GET, OPTIONS' },
    });
  }

  const path = new URL(request.url).pathname.slice(API_PREFIX.length).replace(/\/$/, '') || '/';
  if (path !== '/' || request.method !== 'GET') return operationsJsonResponse({ error: 'Not found' }, 404);

  try {
    return await listOperations(env, ownerId);
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      feature: 'operations',
      event: 'api_request_failed',
      path,
      message: error instanceof Error ? error.message : String(error),
    }));
    return operationsJsonResponse({ error: '運用状況の取得に失敗しました。' }, 500);
  }
}

async function listOperations(env: AppEnv, ownerId: string): Promise<Response> {
  const checkedAt = nowSeconds();
  const today = todayJst();
  const [appsResult, taskSummary, sourceSummary, latestRun, recentRunResult, recentTaskResult] = await Promise.all([
    env.DB.prepare(
      `SELECT id, name, url, description, category, icon_url, pinned
         FROM apps
        ORDER BY pinned DESC, sort_order ASC, name COLLATE NOCASE ASC`,
    ).all<AppRow>(),
    env.DB.prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status != 'done' THEN 1 ELSE 0 END), 0) AS pending,
         COALESCE(SUM(CASE WHEN status != 'done' AND due_date = ? THEN 1 ELSE 0 END), 0) AS today,
         COALESCE(SUM(CASE WHEN status != 'done' AND due_date IS NOT NULL AND due_date < ? THEN 1 ELSE 0 END), 0) AS overdue,
         COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS done
       FROM task_items
      WHERE owner_id = ?`,
    ).bind(today, today, ownerId).first<TaskSummaryRow>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END), 0) AS enabled
         FROM gatherer_sources
        WHERE owner_id = ?`,
    ).bind(ownerId).first<SourceSummaryRow>(),
    env.DB.prepare(
      `SELECT id, status, ran_at, inserted_count, reused_count, skipped_count, failures_json
         FROM gatherer_fetch_runs
        WHERE owner_id = ?
        ORDER BY ran_at DESC
        LIMIT 1`,
    ).bind(ownerId).first<RunRow>(),
    env.DB.prepare(
      `SELECT id, status, ran_at, inserted_count, reused_count, skipped_count, failures_json
         FROM gatherer_fetch_runs
        WHERE owner_id = ?
        ORDER BY ran_at DESC
        LIMIT 5`,
    ).bind(ownerId).all<RunRow>(),
    env.DB.prepare(
      `SELECT id, title, status, updated_at
         FROM task_items
        WHERE owner_id = ?
        ORDER BY updated_at DESC
        LIMIT 5`,
    ).bind(ownerId).all<RecentTaskRow>(),
  ]);

  const appRows = appsResult.results ?? [];
  const services = await Promise.all(appRows.map((app) => checkApp(app, checkedAt)));
  const recentActivity = buildRecentActivity(recentRunResult.results ?? [], recentTaskResult.results ?? []);

  return operationsJsonResponse({
    checkedAt,
    services,
    summary: {
      apps: summarizeServices(services),
      tasks: {
        total: Number(taskSummary?.total ?? 0),
        pending: Number(taskSummary?.pending ?? 0),
        today: Number(taskSummary?.today ?? 0),
        overdue: Number(taskSummary?.overdue ?? 0),
        done: Number(taskSummary?.done ?? 0),
      },
      gatherer: {
        totalSources: Number(sourceSummary?.total ?? 0),
        enabledSources: Number(sourceSummary?.enabled ?? 0),
        latestRun: latestRun ? serializeRun(latestRun) : null,
      },
    },
    recentActivity,
  });
}

async function checkApp(app: AppRow, checkedAt: number) {
  const category = normalizeCategory(app.category);
  if (category === 'integrated' && app.url.startsWith('/') && !app.url.startsWith('//')) {
    return {
      id: app.id,
      name: app.name,
      url: app.url,
      description: app.description || '',
      category,
      status: 'online' as const,
      responseTimeMs: 0,
      statusCode: 200,
      detail: '統合アプリ',
      checkedAt,
    };
  }

  if (category !== 'external') {
    return {
      id: app.id,
      name: app.name,
      url: app.url,
      description: app.description || '',
      category,
      status: 'unknown' as const,
      responseTimeMs: null,
      statusCode: null,
      detail: '監視対象外',
      checkedAt,
    };
  }

  if (!isCheckableExternalUrl(app.url)) {
    return {
      id: app.id,
      name: app.name,
      url: app.url,
      description: app.description || '',
      category,
      status: 'unknown' as const,
      responseTimeMs: null,
      statusCode: null,
      detail: '監視対象外のURL',
      checkedAt,
    };
  }

  const startedAt = Date.now();
  try {
    const response = await fetchWithTimeout(app.url);
    await response.body?.cancel();
    const responseTimeMs = Math.max(1, Date.now() - startedAt);
    const status: ServiceStatus = response.ok
      ? 'online'
      : response.status >= 500
        ? 'offline'
        : 'degraded';
    return {
      id: app.id,
      name: app.name,
      url: app.url,
      description: app.description || '',
      category,
      status,
      responseTimeMs,
      statusCode: response.status,
      detail: status === 'online' ? '応答あり' : `HTTP ${response.status}`,
      checkedAt,
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return {
      id: app.id,
      name: app.name,
      url: app.url,
      description: app.description || '',
      category,
      status: 'offline' as const,
      responseTimeMs: Math.max(1, Date.now() - startedAt),
      statusCode: null,
      detail: timedOut ? 'タイムアウト' : '接続できません',
      checkedAt,
    };
  }
}

function isCheckableExternalUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_CHECK_TIMEOUT_MS);
  try {
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeServices(services: Array<{ status: ServiceStatus }>) {
  return services.reduce(
    (summary, service) => {
      summary.total += 1;
      if (service.status === 'online') summary.online += 1;
      if (service.status === 'degraded' || service.status === 'offline') summary.attention += 1;
      if (service.status === 'unknown') summary.unknown += 1;
      return summary;
    },
    { total: 0, online: 0, attention: 0, unknown: 0 },
  );
}

function buildRecentActivity(runs: RunRow[], tasks: RecentTaskRow[]) {
  const activities = [
    ...runs.map((run) => ({
      id: `gatherer-${run.id}`,
      type: 'gatherer' as const,
      title: '記事収集を実行',
      detail: `${Number(run.inserted_count)}件追加・${Number(run.reused_count)}件更新`,
      at: Number(run.ran_at),
      status: normalizeRunStatus(run.status),
    })),
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      type: 'task' as const,
      title: task.title,
      detail: taskStatusLabel(normalizeTaskStatus(task.status)),
      at: Number(task.updated_at),
      status: normalizeTaskStatus(task.status),
    })),
  ];
  return activities.sort((left, right) => right.at - left.at).slice(0, 8);
}

function serializeRun(run: RunRow) {
  return {
    id: run.id,
    status: normalizeRunStatus(run.status),
    ranAt: Number(run.ran_at),
    inserted: Number(run.inserted_count),
    reused: Number(run.reused_count),
    skipped: Number(run.skipped_count),
    failureCount: parseFailures(run.failures_json).length,
  };
}

function normalizeCategory(value: string | null): AppCategory {
  return value === 'external' ? 'external' : 'integrated';
}

function normalizeRunStatus(value: string): RunStatus {
  return RUN_STATUSES.includes(value as RunStatus) ? value as RunStatus : 'fail';
}

function normalizeTaskStatus(value: string): TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus) ? value as TaskStatus : 'todo';
}

function taskStatusLabel(status: TaskStatus): string {
  if (status === 'done') return 'タスクを完了';
  if (status === 'in_progress') return 'タスクを進行中に変更';
  return 'タスクを更新';
}

function parseFailures(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function todayJst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function operationsJsonResponse(body: unknown, status = 200): Response {
  return jsonResponse<AppEnv>(body, status) as unknown as Response;
}

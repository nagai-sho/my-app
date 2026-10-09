import { z } from 'zod';

import type { AppEnv } from './env';
import { jsonResponse } from './http';
import { getRestrictionReleaseDate, isValidCalendarDate, type RestrictionDurationUnit } from '../../shared/taskRestrictions';

const API_PREFIX = '/api/v1/tasks';
const OWNER_ID = 'owner';
const STATUSES = ['todo', 'in_progress', 'done'] as const;
const PRIORITIES = ['low', 'medium', 'high'] as const;
const DEFAULT_CATEGORY = '未分類';
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '期限はYYYY-MM-DD形式で指定してください。');
const restrictionDateSchema = dateSchema.refine(isValidCalendarDate, '実施日が正しくありません。');

const taskCreateSchema = z.object({
  title: z.string().trim().min(1, 'タスク名を入力してください。').max(200),
  category: z.string().trim().min(1, 'カテゴリを入力してください。').max(40).default(DEFAULT_CATEGORY),
  description: z.string().trim().max(2_000).default(''),
  dueDate: z.union([dateSchema, z.literal(''), z.null()]).default(null),
  priority: z.enum(PRIORITIES).default('medium'),
  status: z.enum(STATUSES).default('todo'),
});
const taskPatchSchema = taskCreateSchema.partial();
const restrictionCreateSchema = z.object({
  name: z.string().trim().min(1, '制限名を入力してください。').max(200),
  eventDate: restrictionDateSchema,
  durationValue: z.number().int().min(1).max(1000),
  durationUnit: z.enum(['days', 'months', 'years']),
});
const restrictionPatchSchema = restrictionCreateSchema.partial().extend({
  notificationDismissed: z.boolean().optional(),
});

type TaskStatus = typeof STATUSES[number];
type TaskPriority = typeof PRIORITIES[number];

interface TaskRow {
  id: string;
  owner_id: string;
  title: string;
  category: string;
  description: string;
  due_date: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  sort_order: number;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

interface TaskRestrictionRow {
  id: string;
  owner_id: string;
  name: string;
  event_date: string;
  duration_value: number;
  duration_unit: RestrictionDurationUnit;
  release_date: string;
  notification_dismissed_at: number | null;
  created_at: number;
  updated_at: number;
}

class TasksInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TasksInputError';
  }
}

export async function handleTasks(
  request: Request,
  env: AppEnv,
  ownerId = OWNER_ID,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { Allow: 'GET, POST, PATCH, DELETE, OPTIONS' },
    });
  }

  const path = new URL(request.url).pathname.slice(API_PREFIX.length).replace(/\/$/, '') || '/';

  try {
    if (path === '/' && request.method === 'GET') return listTasks(env, ownerId);
    if (path === '/' && request.method === 'POST') return createTask(request, env, ownerId);

    if (path === '/restrictions' && request.method === 'GET') return listRestrictions(env, ownerId);
    if (path === '/restrictions' && request.method === 'POST') return createRestriction(request, env, ownerId);

    const restrictionMatch = path.match(/^\/restrictions\/([^/]+)$/);
    if (restrictionMatch) {
      const restrictionId = decodeSegment(restrictionMatch[1]);
      if (!restrictionId) return errorResponse('制限IDが正しくありません。', 400);
      if (request.method === 'PATCH') return patchRestriction(request, env, ownerId, restrictionId);
      if (request.method === 'DELETE') return deleteRestriction(env, ownerId, restrictionId);
    }

    const taskMatch = path.match(/^\/([^/]+)$/);
    if (taskMatch) {
      const taskId = decodeSegment(taskMatch[1]);
      if (!taskId) return errorResponse('タスクIDが正しくありません。', 400);
      if (request.method === 'PATCH') return patchTask(request, env, ownerId, taskId);
      if (request.method === 'DELETE') return deleteTask(env, ownerId, taskId);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0]?.message || '入力内容を確認してください。', 400);
    }
    if (error instanceof TasksInputError) return errorResponse(error.message, 400);
    if (error instanceof RangeError) return errorResponse(error.message || '入力内容を確認してください。', 400);
    console.error(JSON.stringify({
      level: 'error',
      feature: 'tasks',
      event: 'api_request_failed',
      path,
      message: error instanceof Error ? error.message : String(error),
    }));
    return errorResponse('タスクの処理に失敗しました。', 500);
  }
}

async function listTasks(env: AppEnv, ownerId: string): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT id, owner_id, title, category, description, due_date, status, priority, sort_order,
            created_at, updated_at, completed_at
       FROM task_items
      WHERE owner_id = ?
      ORDER BY sort_order ASC, created_at ASC, id ASC`,
  ).bind(ownerId).all<TaskRow>();

  return tasksJsonResponse({ tasks: (result.results ?? []).map(serializeTask) });
}

async function createTask(request: Request, env: AppEnv, ownerId: string): Promise<Response> {
  const body = taskCreateSchema.parse(await readJson(request));
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const dueDate = body.dueDate || null;
  const completedAt = body.status === 'done' ? now : null;

  await env.DB.prepare(
    `INSERT INTO task_items
      (id, owner_id, title, category, description, due_date, status, priority, sort_order, created_at, updated_at, completed_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1, ?, ?, ?
       FROM task_items
      WHERE owner_id = ?`,
  ).bind(
    id,
    ownerId,
    body.title,
    body.category,
    body.description,
    dueDate,
    body.status,
    body.priority,
    now,
    now,
    completedAt,
    ownerId,
  ).run();

  const task = await taskById(env, ownerId, id);
  return tasksJsonResponse({ task: task ? serializeTask(task) : null }, 201);
}

async function patchTask(
  request: Request,
  env: AppEnv,
  ownerId: string,
  taskId: string,
): Promise<Response> {
  const current = await taskById(env, ownerId, taskId);
  if (!current) return errorResponse('タスクが見つかりません。', 404);

  const body = taskPatchSchema.parse(await readJson(request));
  const nextStatus = body.status ?? current.status;
  const completedAt = nextStatus === 'done'
    ? current.status === 'done' && current.completed_at ? current.completed_at : nowSeconds()
    : null;

  await env.DB.prepare(
    `UPDATE task_items
        SET title = ?, category = ?, description = ?, due_date = ?, status = ?, priority = ?,
            updated_at = ?, completed_at = ?
      WHERE id = ? AND owner_id = ?`,
  ).bind(
    body.title ?? current.title,
    body.category ?? current.category,
    body.description ?? current.description,
    body.dueDate === undefined ? current.due_date : body.dueDate || null,
    nextStatus,
    body.priority ?? current.priority,
    nowSeconds(),
    completedAt,
    taskId,
    ownerId,
  ).run();

  const task = await taskById(env, ownerId, taskId);
  return tasksJsonResponse({ task: task ? serializeTask(task) : null });
}

async function deleteTask(env: AppEnv, ownerId: string, taskId: string): Promise<Response> {
  const current = await taskById(env, ownerId, taskId);
  if (!current) return errorResponse('タスクが見つかりません。', 404);

  await env.DB.prepare('DELETE FROM task_items WHERE id = ? AND owner_id = ?')
    .bind(taskId, ownerId)
    .run();
  return tasksJsonResponse({ deleted: true });
}

async function listRestrictions(env: AppEnv, ownerId: string): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT id, owner_id, name, event_date, duration_value, duration_unit, release_date,
            notification_dismissed_at, created_at, updated_at
       FROM task_restrictions
      WHERE owner_id = ?
      ORDER BY release_date ASC, created_at ASC, id ASC`,
  ).bind(ownerId).all<TaskRestrictionRow>();

  return tasksJsonResponse({ restrictions: (result.results ?? []).map(serializeRestriction) });
}

async function createRestriction(request: Request, env: AppEnv, ownerId: string): Promise<Response> {
  const body = restrictionCreateSchema.parse(await readJson(request));
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const releaseDate = getRestrictionReleaseDate(body.eventDate, body.durationValue, body.durationUnit);

  await env.DB.prepare(
    `INSERT INTO task_restrictions
      (id, owner_id, name, event_date, duration_value, duration_unit, release_date,
       notification_dismissed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
  ).bind(id, ownerId, body.name, body.eventDate, body.durationValue, body.durationUnit, releaseDate, now, now).run();

  const restriction = await restrictionById(env, ownerId, id);
  return tasksJsonResponse({ restriction: restriction ? serializeRestriction(restriction) : null }, 201);
}

async function patchRestriction(
  request: Request,
  env: AppEnv,
  ownerId: string,
  restrictionId: string,
): Promise<Response> {
  const current = await restrictionById(env, ownerId, restrictionId);
  if (!current) return errorResponse('制限記録が見つかりません。', 404);

  const body = restrictionPatchSchema.parse(await readJson(request));
  if (Object.keys(body).length === 0) return errorResponse('更新内容を指定してください。', 400);

  const nextName = body.name ?? current.name;
  const nextEventDate = body.eventDate ?? current.event_date;
  const nextDurationValue = body.durationValue ?? current.duration_value;
  const nextDurationUnit = body.durationUnit ?? current.duration_unit;
  const releaseDate = getRestrictionReleaseDate(nextEventDate, nextDurationValue, nextDurationUnit);
  const changedReleaseDate = releaseDate !== current.release_date;
  const dismissedAt = body.notificationDismissed === undefined
    ? changedReleaseDate ? null : current.notification_dismissed_at
    : body.notificationDismissed ? current.notification_dismissed_at ?? nowSeconds() : null;
  const now = nowSeconds();

  await env.DB.prepare(
    `UPDATE task_restrictions
        SET name = ?, event_date = ?, duration_value = ?, duration_unit = ?, release_date = ?,
            notification_dismissed_at = ?, updated_at = ?
      WHERE id = ? AND owner_id = ?`,
  ).bind(
    nextName,
    nextEventDate,
    nextDurationValue,
    nextDurationUnit,
    releaseDate,
    dismissedAt,
    now,
    restrictionId,
    ownerId,
  ).run();

  const restriction = await restrictionById(env, ownerId, restrictionId);
  return tasksJsonResponse({ restriction: restriction ? serializeRestriction(restriction) : null });
}

async function deleteRestriction(env: AppEnv, ownerId: string, restrictionId: string): Promise<Response> {
  const current = await restrictionById(env, ownerId, restrictionId);
  if (!current) return errorResponse('制限記録が見つかりません。', 404);

  await env.DB.prepare('DELETE FROM task_restrictions WHERE id = ? AND owner_id = ?')
    .bind(restrictionId, ownerId)
    .run();
  return tasksJsonResponse({ deleted: true });
}

async function taskById(env: AppEnv, ownerId: string, taskId: string): Promise<TaskRow | null> {
  return env.DB.prepare(
    `SELECT id, owner_id, title, category, description, due_date, status, priority, sort_order,
            created_at, updated_at, completed_at
       FROM task_items
      WHERE id = ? AND owner_id = ?
      LIMIT 1`,
  ).bind(taskId, ownerId).first<TaskRow>();
}

async function restrictionById(env: AppEnv, ownerId: string, restrictionId: string): Promise<TaskRestrictionRow | null> {
  return env.DB.prepare(
    `SELECT id, owner_id, name, event_date, duration_value, duration_unit, release_date,
            notification_dismissed_at, created_at, updated_at
       FROM task_restrictions
      WHERE id = ? AND owner_id = ?
      LIMIT 1`,
  ).bind(restrictionId, ownerId).first<TaskRestrictionRow>();
}

function serializeTask(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    category: row.category || DEFAULT_CATEGORY,
    description: row.description || '',
    dueDate: row.due_date,
    status: row.status,
    priority: row.priority,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    completedAt: row.completed_at === null ? null : Number(row.completed_at),
  };
}

function serializeRestriction(row: TaskRestrictionRow) {
  return {
    id: row.id,
    name: row.name,
    eventDate: row.event_date,
    durationValue: Number(row.duration_value),
    durationUnit: row.duration_unit,
    releaseDate: row.release_date,
    notificationDismissedAt: row.notification_dismissed_at === null ? null : Number(row.notification_dismissed_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => {
    throw new TasksInputError('JSON形式の入力が必要です。');
  });
}

function decodeSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function errorResponse(message: string, status: number): Response {
  return tasksJsonResponse({ error: message }, status);
}

function tasksJsonResponse(body: unknown, status = 200): Response {
  return jsonResponse<AppEnv>(body, status) as unknown as Response;
}

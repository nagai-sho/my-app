import { z } from 'zod';

import type { AppEnv } from './env';
import { jsonResponse } from './http';

const API_PREFIX = '/api/v1/tasks';
const OWNER_ID = 'owner';
const STATUSES = ['todo', 'in_progress', 'done'] as const;
const PRIORITIES = ['low', 'medium', 'high'] as const;
const DEFAULT_CATEGORY = '未分類';
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '期限はYYYY-MM-DD形式で指定してください。');

const taskCreateSchema = z.object({
  title: z.string().trim().min(1, 'タスク名を入力してください。').max(200),
  category: z.string().trim().min(1, 'カテゴリを入力してください。').max(40).default(DEFAULT_CATEGORY),
  description: z.string().trim().max(2_000).default(''),
  dueDate: z.union([dateSchema, z.literal(''), z.null()]).default(null),
  priority: z.enum(PRIORITIES).default('medium'),
  status: z.enum(STATUSES).default('todo'),
});
const taskPatchSchema = taskCreateSchema.partial();

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

async function taskById(env: AppEnv, ownerId: string, taskId: string): Promise<TaskRow | null> {
  return env.DB.prepare(
    `SELECT id, owner_id, title, category, description, due_date, status, priority, sort_order,
            created_at, updated_at, completed_at
       FROM task_items
      WHERE id = ? AND owner_id = ?
      LIMIT 1`,
  ).bind(taskId, ownerId).first<TaskRow>();
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

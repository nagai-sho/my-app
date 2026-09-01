export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface TaskInput {
  title: string;
  description?: string;
  dueDate?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`/api/v1/tasks${path}`, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
  const body = await response.json().catch(() => null) as { error?: string } & T;
  if (!response.ok) throw new Error(body?.error || `API request failed: ${response.status}`);
  return body as T;
}

export const tasksApi = {
  list: () => request<{ tasks: Task[] }>('/'),
  create: (input: TaskInput) => request<{ task: Task }>('/', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  update: (id: string, input: Partial<TaskInput>) => request<{ task: Task }>(`/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),
  remove: (id: string) => request<{ deleted: true }>(`/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }),
};

export function todayJst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

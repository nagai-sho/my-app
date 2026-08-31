const API_BASE = '/api/v1/gatherer';

export type Provider = 'rss' | 'json_api' | 'github_releases' | 'html' | 'tavily';

export type Rule = {
  id: string;
  source_id: string;
  include_keywords: string[];
  exclude_keywords: string[];
  regex: string | null;
  tags: string[];
  created_at: number;
  updated_at: number;
};

export type Source = {
  id: string;
  owner_id: string;
  provider: Provider;
  endpoint: string;
  title: string;
  enabled: number;
  created_at: number;
  updated_at: number;
  rules: Rule[];
};

export type Item = {
  id: string;
  source_id: string;
  source_title: string;
  title: string;
  url: string;
  summary: string;
  published_at: number | null;
  day_key: string;
  score: number;
  read: number;
};

export type Task = {
  id: string;
  owner_id: string;
  label: string;
  color: string;
  enabled: number;
  created_at: number;
};

export type TaskLog = { task_id: string; day_key: string; count: number };

export type FetchRun = {
  id: string;
  day_key: string;
  trigger: 'scheduled' | 'manual';
  status: 'running' | 'success' | 'partial' | 'fail';
  started_at: number;
  finished_at: number | null;
  inserted_count: number;
  reused_count: number;
  skipped_count: number;
  credits_used: number;
  failures: string[];
  note: string;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
  const body = await response.json().catch(() => null) as { error?: string } & T;
  if (!response.ok) throw new Error(body?.error || `API request failed: ${response.status}`);
  return body as T;
}

export const gathererApi = {
  items: (dayKey: string, unreadOnly: boolean, page: number, limit: number) => {
    const params = new URLSearchParams({
      day_key: dayKey,
      unread_only: unreadOnly ? '1' : '0',
      limit: String(limit),
      offset: String(Math.max(0, page - 1) * limit),
    });
    return request<{ items: Item[]; total: number; limit: number; offset: number }>(`/items?${params}`);
  },
  setRead: (id: string, read: boolean) => request<{ item: Item }>(`/items/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
    body: JSON.stringify({ read }),
  }),
  collect: (dayKey: string) => request<{
    runId: string;
    inserted: number;
    reused: number;
    skipped: number;
    status: string;
    failures: string[];
  }>(`/collect?date=${encodeURIComponent(dayKey)}`, { method: 'POST' }),
  sources: () => request<{ sources: Source[] }>('/sources'),
  createSource: (body: {
    provider: Provider;
    endpoint: string;
    title: string;
    rule: Omit<Rule, 'id' | 'source_id' | 'created_at' | 'updated_at'>;
  }) => request<{ source: Source }>('/sources', { method: 'POST', body: JSON.stringify(body) }),
  patchSource: (id: string, body: Partial<Pick<Source, 'provider' | 'endpoint' | 'title' | 'enabled'>>) =>
    request<{ source: Source }>(`/sources/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSource: (id: string) => request<{ deleted: true }>(`/sources/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  createRule: (sourceId: string, body: Omit<Rule, 'id' | 'source_id' | 'created_at' | 'updated_at'>) =>
    request<{ rule: Rule }>(`/sources/${encodeURIComponent(sourceId)}/rules`, { method: 'POST', body: JSON.stringify(body) }),
  patchRule: (id: string, body: Partial<Pick<Rule, 'include_keywords' | 'exclude_keywords' | 'regex' | 'tags'>>) =>
    request<{ rule: Rule }>(`/rules/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  tasks: (from: string, to: string) => request<{ tasks: Task[]; logs: TaskLog[] }>(`/tasks?from=${from}&to=${to}`),
  createTask: (body: { label: string; color: string }) => request<{ task: Task }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  patchTask: (id: string, body: Partial<Pick<Task, 'label' | 'color'>>) => request<{ task: Task }>(`/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }),
  updateTaskLog: (id: string, body: { day_key: string; delta?: number; reset?: boolean }) =>
    request<{ log: TaskLog }>(`/tasks/${encodeURIComponent(id)}/logs`, { method: 'POST', body: JSON.stringify(body) }),
  runs: () => request<{ runs: FetchRun[] }>('/runs'),
};

export function todayJst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function formatPublishedAt(value: number | null): string {
  if (!value) return '日付不明';
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(value * 1000);
}

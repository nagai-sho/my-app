export type AppCategory = 'integrated' | 'external';
export type ServiceStatus = 'online' | 'degraded' | 'offline' | 'unknown';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type RunStatus = 'running' | 'success' | 'partial' | 'fail';

export interface ServiceHealth {
  id: string;
  name: string;
  url: string;
  description: string;
  category: AppCategory;
  status: ServiceStatus;
  responseTimeMs: number | null;
  statusCode: number | null;
  detail: string;
  checkedAt: number;
}

export interface LatestRun {
  id: string;
  status: RunStatus;
  ranAt: number;
  inserted: number;
  reused: number;
  skipped: number;
  failureCount: number;
}

export interface OperationsResponse {
  checkedAt: number;
  services: ServiceHealth[];
  summary: {
    apps: { total: number; online: number; attention: number; unknown: number };
    tasks: { total: number; pending: number; today: number; overdue: number; done: number };
    gatherer: { totalSources: number; enabledSources: number; latestRun: LatestRun | null };
  };
  recentActivity: Array<{
    id: string;
    type: 'task' | 'gatherer';
    title: string;
    detail: string;
    at: number;
    status: TaskStatus | RunStatus;
  }>;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`/api/v1/operations${path}`, { credentials: 'same-origin' });
  const body = await response.json().catch(() => null) as { error?: string } & T;
  if (!response.ok) throw new Error(body?.error || `API request failed: ${response.status}`);
  return body as T;
}

export const operationsApi = {
  summary: () => request<OperationsResponse>('/'),
};

export function formatOperationTime(seconds: number | null | undefined): string {
  if (!seconds) return '未実行';
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(seconds * 1000);
}

export function formatActivityTime(seconds: number): string {
  return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(seconds * 1000);
}

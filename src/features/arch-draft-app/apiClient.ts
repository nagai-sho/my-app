const API_BASE = '/api/v1/arch-draft-app';

export interface TemplateVariable {
  key: string;
  label: string;
  type: 'string';
  required: boolean;
  default: string;
}

export interface ArchDraftTemplate {
  id: string;
  name: string;
  description: string;
  fileName: string;
  variables: TemplateVariable[];
  createdAt: number;
  updatedAt: number;
}

export type ArchDraftJobStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

export interface ArchDraftJob {
  id: string;
  drawingVersionId: string;
  targetFormat: 'dxf';
  status: ArchDraftJobStatus;
  outputFileId: string | null;
  outputFileName: string | null;
  downloadUrl: string | null;
  errorMessage: string | null;
  converterMode: 'mock' | string;
  createdAt: number;
  updatedAt: number;
}

export interface ArchDraftDrawingSummary {
  id: string;
  title: string;
  templateId: string | null;
  templateName: string | null;
  versionCount: number;
  latestVersion: number | null;
  latestFileName: string | null;
  latestJobStatus: ArchDraftJobStatus | null;
  createdAt: number;
  updatedAt: number;
}

export interface ArchDraftFile {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  downloadUrl: string;
}

export interface ArchDraftVersion {
  id: string;
  versionNo: number;
  sourceFile: ArchDraftFile;
  meta: Record<string, unknown>;
  createdAt: number;
  jobs: ArchDraftJob[];
}

export interface ArchDraftDrawingDetail extends ArchDraftDrawingSummary {
  versions: ArchDraftVersion[];
}

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
  const body = await response.json().catch(() => null) as { error?: string } & T | null;
  if (!response.ok) throw new Error(body?.error || `API request failed: ${response.status}`);
  if (!body) throw new Error('サーバーからの応答を読み取れませんでした。');
  return body as T;
}

export const archDraftApi = {
  listTemplates: () => request<{ templates: ArchDraftTemplate[] }>('/templates'),
  createTemplate: (input: { name: string; description: string; file: File }) => {
    const body = new FormData();
    body.set('name', input.name);
    body.set('description', input.description);
    body.set('file', input.file, input.file.name);
    return request<{ template: ArchDraftTemplate }>('/templates', { method: 'POST', body });
  },
  listDrawings: () => request<{ drawings: ArchDraftDrawingSummary[] }>('/drawings'),
  drawing: (id: string) => request<{ drawing: ArchDraftDrawingDetail }>(`/drawings/${encodeURIComponent(id)}`),
  createFromTemplate: (input: { templateId: string; title: string; variables: Record<string, string> }) =>
    request<{ drawing: { id: string; title: string }; version: { id: string; versionNo: number } }>('/drawings', {
      method: 'POST',
      body: JSON.stringify({
        templateId: input.templateId,
        title: input.title,
        variables: input.variables,
      }),
    }),
  uploadDrawing: (input: { file: File; title: string; drawingId?: string }) => {
    const query = new URLSearchParams({ title: input.title });
    if (input.drawingId) query.set('drawing_id', input.drawingId);
    return request<{ drawing: { id: string; title: string }; version: { id: string; versionNo: number } }>(
      `/drawings/upload?${query.toString()}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': input.file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(input.file.name),
        },
        body: input.file,
      },
    );
  },
  createConversion: (drawingVersionId: string) => request<{ job: ArchDraftJob }>('/jobs', {
    method: 'POST',
    body: JSON.stringify({ drawingVersionId, targetFormat: 'dxf' }),
  }),
};

export function formatArchDraftDate(timestamp: number): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

export function formatArchDraftBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

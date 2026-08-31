import type { Folder, StoredDocument } from '../types/document';

const API_BASE = '/api/v1/collection';

export type FileVariant = 'original' | 'thumbnail';

export type CreateDocumentInput = {
  id: string;
  title: string;
  kind: 'image' | 'pdf';
  folder_path: string;
  page_count: number;
  bytes: number;
  mime: string;
  source_created_at: string;
  sort_order: number;
};

export interface CollectionApi {
  readonly idToken: string | null;
  listDocuments: () => Promise<{ documents: StoredDocument[]; unauthorized?: boolean }>;
  createDocument: (input: CreateDocumentInput) => Promise<{ document: StoredDocument }>;
  uploadObject: (file: Blob, documentId: string, role: FileVariant, fileName: string) => Promise<unknown>;
  fileUrl: (documentId: string, variant: FileVariant) => string;
  fetchObject: (documentId: string, variant: FileVariant) => Promise<Blob>;
  deleteDocument: (id: string) => Promise<void>;
  cleanupUploadedFiles: (documentId: string) => Promise<void>;
  updateDocumentOrder: (id: string, sortOrder: number) => Promise<void>;
  listFolders: () => Promise<{ folders: Folder[]; unauthorized?: boolean }>;
  createFolder: (path: string) => Promise<{ folder: Folder | null }>;
  renameFolder: (path: string, newPath: string) => Promise<void>;
  deleteFolder: (path: string) => Promise<void>;
  moveDocuments: (ids: string[], folderPath: string) => Promise<{ moved: string[] }>;
}

export function createCollectionApi(idToken: string | null): CollectionApi {
  const request = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    if (idToken) headers.set('authorization', `Bearer ${idToken}`);
    return fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'same-origin',
      headers,
    });
  };

  const requireOk = async (response: Response, fallback: string): Promise<Response> => {
    if (response.ok) return response;
    const body = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new Error(body?.error ?? body?.message ?? fallback);
  };

  return {
    idToken,
    async listDocuments() {
      const response = await request('/documents');
      if (response.status === 401) return { documents: [], unauthorized: true };
      await requireOk(response, '一覧を取得できませんでした');
      return (await response.json()) as { documents: StoredDocument[] };
    },
    async createDocument(input) {
      const response = await request('/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      await requireOk(response, 'メタデータを保存できませんでした');
      return (await response.json()) as { document: StoredDocument };
    },
    async uploadObject(file, documentId, role, fileName) {
      const formData = new FormData();
      formData.set('file', file, fileName);
      formData.set('document_id', documentId);
      formData.set('role', role);
      const response = await request('/files', { method: 'POST', body: formData });
      await requireOk(response, 'ファイルをR2に保存できませんでした');
      return response.json();
    },
    fileUrl(documentId, variant) {
      const params = new URLSearchParams({ document_id: documentId, variant });
      return `${API_BASE}/files?${params.toString()}`;
    },
    async fetchObject(documentId, variant) {
      const response = await request(`/files?document_id=${encodeURIComponent(documentId)}&variant=${variant}`);
      await requireOk(response, 'ファイルを取得できませんでした');
      return response.blob();
    },
    async deleteDocument(id) {
      const response = await request(`/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await requireOk(response, '削除できませんでした');
    },
    async cleanupUploadedFiles(documentId) {
      const response = await request(`/files?document_id=${encodeURIComponent(documentId)}`, { method: 'DELETE' });
      await requireOk(response, '一時ファイルを削除できませんでした');
    },
    async updateDocumentOrder(id, sortOrder) {
      const response = await request(`/documents/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sort_order: sortOrder }),
      });
      await requireOk(response, '並び順を更新できませんでした');
    },
    async listFolders() {
      const response = await request('/folders');
      if (response.status === 401) return { folders: [], unauthorized: true };
      await requireOk(response, 'ディレクトリ一覧を取得できませんでした');
      return (await response.json()) as { folders: Folder[] };
    },
    async createFolder(path) {
      const response = await request('/folders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      await requireOk(response, 'ディレクトリを作成できませんでした');
      return (await response.json()) as { folder: Folder | null };
    },
    async renameFolder(path, newPath) {
      const response = await request('/folders', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path, new_path: newPath }),
      });
      await requireOk(response, 'ディレクトリ名を変更できませんでした');
    },
    async deleteFolder(path) {
      const response = await request(`/folders?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
      await requireOk(response, 'ディレクトリを削除できませんでした');
    },
    async moveDocuments(ids, folderPath) {
      const response = await request('/documents/move', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids, folder_path: folderPath }),
      });
      await requireOk(response, 'ファイルを移動できませんでした');
      return (await response.json()) as { moved: string[] };
    },
  };
}

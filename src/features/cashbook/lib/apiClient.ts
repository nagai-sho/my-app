import type {
  AppSettings,
  Category,
  CategoryCreateResponse,
  CategoryInput,
  GmailStarredResponse,
  Merchant,
  SummaryResponse,
  TransactionInput,
  TransactionsResponse,
} from './types';

export const gmailConnectUrl = '/api/v1/cashbook/gmail/connect';

export interface CashbookApi {
  idToken: string | null;
  gmailConnectUrl: string;
  startGmailConnect: () => Promise<string>;
  gmailStarred: () => Promise<GmailStarredResponse>;
  unstarGmailMessage: (id: string) => Promise<{ ok: true }>;
  categories: () => Promise<{ categories: Category[] }>;
  merchants: () => Promise<{ merchants: Merchant[] }>;
  createMerchant: (input: { name: string }) => Promise<{ merchant: Merchant; merchants: Merchant[] }>;
  updateMerchant: (id: string, input: { name: string }) => Promise<{ merchants: Merchant[] }>;
  deleteMerchant: (id: string) => Promise<{ merchants: Merchant[] }>;
  settings: () => Promise<AppSettings>;
  updateSettings: (input: AppSettings) => Promise<AppSettings>;
  resetSettings: () => Promise<AppSettings>;
  createCategory: (input: CategoryInput) => Promise<CategoryCreateResponse>;
  updateCategory: (id: string, input: { name: string }) => Promise<{ categories: Category[] }>;
  deleteCategory: (id: string) => Promise<{ categories: Category[] }>;
  summary: (params: { month: string; months?: number; scope?: 'month' | 'all' }) => Promise<SummaryResponse>;
  transactions: (params: { month: string; scope?: 'month' | 'all'; limit?: number; offset?: number }) => Promise<TransactionsResponse>;
  createTransaction: (input: TransactionInput) => Promise<{ id: string }>;
  updateTransaction: (id: string, input: TransactionInput) => Promise<{ ok: true }>;
  deleteTransaction: (id: string) => Promise<{ ok: true }>;
}

export function createCashbookApi(idToken: string | null): CashbookApi {
  const request = <T,>(path: string, init: RequestInit = {}) => requestJson<T>(path, init, idToken);

  return {
    idToken,
    gmailConnectUrl,
    startGmailConnect: async () => {
      const body = await request<{ url?: unknown }>(gmailConnectUrl);
      if (typeof body.url !== 'string' || !body.url) {
        throw new Error('Gmail連携URLを取得できませんでした。');
      }
      return body.url;
    },
    gmailStarred: () => request<GmailStarredResponse>('/api/v1/cashbook/gmail/starred?limit=10'),
    unstarGmailMessage: (id) => request<{ ok: true }>(`/api/v1/cashbook/gmail/messages/${encodeURIComponent(id)}/unstar`, { method: 'POST' }),
    categories: () => request<{ categories: Category[] }>('/api/v1/cashbook/categories'),
    merchants: () => request<{ merchants: Merchant[] }>('/api/v1/cashbook/merchants'),
    createMerchant: (input) => request<{ merchant: Merchant; merchants: Merchant[] }>('/api/v1/cashbook/merchants', { method: 'POST', body: JSON.stringify(input) }),
    updateMerchant: (id, input) => request<{ merchants: Merchant[] }>(`/api/v1/cashbook/merchants/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }),
    deleteMerchant: (id) => request<{ merchants: Merchant[] }>(`/api/v1/cashbook/merchants/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    settings: () => request<AppSettings>('/api/v1/cashbook/settings'),
    updateSettings: (input) => request<AppSettings>('/api/v1/cashbook/settings', { method: 'PUT', body: JSON.stringify(input) }),
    resetSettings: () => request<AppSettings>('/api/v1/cashbook/settings', { method: 'DELETE' }),
    createCategory: (input) => request<CategoryCreateResponse>('/api/v1/cashbook/categories', { method: 'POST', body: JSON.stringify(input) }),
    updateCategory: (id, input) => request<{ categories: Category[] }>(`/api/v1/cashbook/categories/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }),
    deleteCategory: (id) => request<{ categories: Category[] }>(`/api/v1/cashbook/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    summary: (params) => {
      const search = new URLSearchParams({
        month: params.month,
        months: String(params.months || 12),
        scope: params.scope || 'month',
      });
      return request<SummaryResponse>(`/api/v1/cashbook/summary?${search.toString()}`);
    },
    transactions: (params) => {
      const search = new URLSearchParams({
        month: params.month,
        scope: params.scope || 'month',
        limit: String(params.limit || 20),
        offset: String(params.offset || 0),
      });
      return request<TransactionsResponse>(`/api/v1/cashbook/transactions?${search.toString()}`);
    },
    createTransaction: (input) => request<{ id: string }>('/api/v1/cashbook/transactions', { method: 'POST', body: JSON.stringify(input) }),
    updateTransaction: (id, input) => request<{ ok: true }>(`/api/v1/cashbook/transactions/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }),
    deleteTransaction: (id) => request<{ ok: true }>(`/api/v1/cashbook/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
}

async function requestJson<T>(path: string, init: RequestInit, idToken: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (idToken) headers.set('Authorization', `Bearer ${idToken}`);

  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
      ? body.message
      : body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

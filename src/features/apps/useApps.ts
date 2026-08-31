import { useCallback, useEffect, useState } from 'react';

import { sortApps } from './sortApps';
import type { App } from '../../types/app';

interface AppsResponse {
  apps: App[];
}

interface UseAppsResult {
  apps: App[];
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

function isApp(value: unknown): value is App {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<App>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.url === 'string' &&
    typeof candidate.sortOrder === 'number' &&
    typeof candidate.pinned === 'boolean' &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.updatedAt === 'number'
  );
}

function parseAppsResponse(value: unknown): App[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as AppsResponse).apps)) {
    throw new Error('アプリ一覧の形式が正しくありません。');
  }

  const apps = (value as AppsResponse).apps;
  if (!apps.every(isApp)) {
    throw new Error('アプリ一覧のデータが正しくありません。');
  }

  return sortApps(apps);
}

async function fetchApps(): Promise<App[]> {
  const response = await fetch('/api/apps', {
    credentials: 'same-origin',
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    throw new Error('サーバーからの応答を読み取れませんでした。');
  }

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'アプリ一覧の取得に失敗しました。';
    throw new Error(message);
  }

  return parseAppsResponse(body);
}

export function useApps(idToken: string | null): UseAppsResult {
  const [apps, setApps] = useState<App[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setRetryCount((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchApps()
      .then((nextApps) => {
        if (cancelled) {
          return;
        }
        setApps(nextApps);
      })
      .catch((cause: unknown) => {
        if (cancelled) {
          return;
        }
        setApps([]);
        setError(cause instanceof Error ? cause.message : '予期せぬエラーが発生しました。');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [idToken, retryCount]);

  return { apps, isLoading, error, retry };
}

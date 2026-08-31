export type ApiMode = 'mock' | 'real';

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === 'true';
}

function readApiMode(value: string | undefined): ApiMode {
  if (value === 'real') {
    return 'real';
  }
  if (value === 'mock') {
    return 'mock';
  }

  // ローカル開発はモック、本番ビルドはPages Functions + D1を既定にする。
  return import.meta.env.PROD ? 'real' : 'mock';
}

export const appConfig = {
  apiMode: readApiMode(import.meta.env.VITE_API_MODE),
  enableDevLogin: readBoolean(import.meta.env.VITE_ENABLE_DEV_LOGIN, import.meta.env.DEV),
  devUser: import.meta.env.VITE_DEV_USER ?? 'admin@example.com',
  devPassword: import.meta.env.VITE_DEV_PASSWORD ?? 'password',
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
} as const;

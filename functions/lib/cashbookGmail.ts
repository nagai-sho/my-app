import type { AppEnv } from './env';
import { CashbookApiError } from './cashbookHttp';

export interface GoogleProfile {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}

interface GmailTokenRow {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

export async function exchangeGoogleCode(
  env: AppEnv,
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new CashbookApiError('Google OAuthが設定されていません。', 500, 'GOOGLE_OAUTH_NOT_CONFIGURED');
  }

  const response = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const token = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !token.access_token) {
    throw new CashbookApiError(token.error || 'Google OAuthに失敗しました。', 401, 'GOOGLE_TOKEN_EXCHANGE_FAILED');
  }
  return token;
}

export async function loadGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetchWithTimeout('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const profile = (await response.json()) as GoogleProfile;
  if (!response.ok || !profile.sub) {
    throw new CashbookApiError('Googleアカウント情報を取得できませんでした。', 401, 'GOOGLE_PROFILE_FAILED');
  }
  return profile;
}

export async function storeGmailToken(
  env: AppEnv,
  ownerId: string,
  userEmail: string | null,
  token: GoogleTokenResponse,
): Promise<void> {
  if (!token.access_token) {
    throw new CashbookApiError('Gmailトークンを取得できませんでした。', 401, 'GMAIL_TOKEN_MISSING');
  }

  const expiresAt = Math.floor(Date.now() / 1000) + (token.expires_in || 3600);
  await env.DB.prepare(
    `INSERT INTO cashbook_gmail_tokens
       (owner_id, user_email, access_token, refresh_token, expires_at, scope, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(owner_id) DO UPDATE SET
       user_email = COALESCE(excluded.user_email, cashbook_gmail_tokens.user_email),
       access_token = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, cashbook_gmail_tokens.refresh_token),
       expires_at = excluded.expires_at,
       scope = excluded.scope,
       updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(ownerId, userEmail, token.access_token, token.refresh_token || null, expiresAt, token.scope || null)
    .run();
}

export async function getGmailAccessToken(env: AppEnv, ownerId: string): Promise<string> {
  const record = await env.DB.prepare(
    `SELECT
       access_token AS accessToken,
       refresh_token AS refreshToken,
       expires_at AS expiresAt
     FROM cashbook_gmail_tokens
     WHERE owner_id = ?
     LIMIT 1`,
  )
    .bind(ownerId)
    .first<GmailTokenRow>();

  if (!record) {
    throw new CashbookApiError('Gmail連携がありません。Gmail連携を開始してください。', 409, 'GMAIL_NOT_CONNECTED');
  }

  if (record.expiresAt > Math.floor(Date.now() / 1000) + 60) {
    return record.accessToken;
  }

  if (!record.refreshToken) {
    throw new CashbookApiError('Gmailの再認証が必要です。', 409, 'GMAIL_REAUTH_REQUIRED');
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new CashbookApiError('Google OAuthが設定されていません。', 500, 'GOOGLE_OAUTH_NOT_CONFIGURED');
  }

  const response = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: record.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const token = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !token.access_token) {
    throw new CashbookApiError(token.error || 'Googleトークンの更新に失敗しました。', 502, 'GMAIL_TOKEN_REFRESH_FAILED');
  }

  await storeGmailToken(env, ownerId, null, {
    access_token: token.access_token,
    refresh_token: record.refreshToken,
    expires_in: token.expires_in,
    scope: token.scope,
  });
  return token.access_token;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 15_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new CashbookApiError('外部サービスへの接続がタイムアウトしました。', 504, 'EXTERNAL_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

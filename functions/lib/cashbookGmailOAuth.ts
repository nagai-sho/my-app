import { getAuthorizedUser } from './authorization';
import type { AppEnv } from './env';
import {
  CashbookApiError,
  clearCookie,
  cookie,
  json,
  methodNotAllowed,
  readCookie,
  unauthorized,
} from './cashbookHttp';
import { exchangeGoogleCode, loadGoogleProfile, storeGmailToken } from './cashbookGmail';
import type { CashbookRequest } from './cashbookTypes';

const GMAIL_CONNECT_PATH = '/api/v1/cashbook/gmail/connect';
const GMAIL_CALLBACK_PATH = '/api/v1/cashbook/gmail/callback';
const STATE_COOKIE = 'cashbook_oauth_state';
const STATE_TTL_SECONDS = 60 * 10;

interface OAuthStateRow {
  ownerId: string;
  redirectUri: string;
  expiresAt: number;
}

export async function handleCashbookGmailOAuth(
  request: CashbookRequest,
  env: AppEnv,
  pathname: string,
): Promise<Response | null> {
  if (pathname === GMAIL_CONNECT_PATH) {
    return startGmailConnect(request, env);
  }
  if (pathname === GMAIL_CALLBACK_PATH) {
    return completeGmailConnect(request, env);
  }
  return null;
}

async function startGmailConnect(request: CashbookRequest, env: AppEnv): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed('GET');

  const user = await getAuthorizedUser(request, env);
  if (!user) return unauthorized();
  const redirectUri = new URL(GMAIL_CALLBACK_PATH, request.url).toString();
  const state = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new CashbookApiError('Google OAuthが設定されていません。', 500, 'GOOGLE_OAUTH_NOT_CONFIGURED');
  }

  await env.DB.prepare('DELETE FROM cashbook_oauth_states WHERE expires_at <= ?').bind(now).run();
  await env.DB.prepare(
    `INSERT INTO cashbook_oauth_states (state_hash, owner_id, redirect_uri, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(await sha256(state), user.id, redirectUri, now + STATE_TTL_SECONDS, now)
    .run();

  const authorizationUrl = googleAuthorizationUrl(env.GOOGLE_CLIENT_ID, redirectUri, state);
  const stateCookie = cookie(request, STATE_COOKIE, state, STATE_TTL_SECONDS);

  if (request.headers.get('Authorization')?.startsWith('Bearer ')) {
    return json({ url: authorizationUrl }, { headers: { 'set-cookie': stateCookie } });
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: authorizationUrl,
      'set-cookie': stateCookie,
    },
  });
}

async function completeGmailConnect(request: CashbookRequest, env: AppEnv): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed('GET');

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = readCookie(request, STATE_COOKIE);
  if (url.searchParams.get('error')) {
    throw new CashbookApiError('Gmail連携がキャンセルされました。', 400, 'GMAIL_OAUTH_CANCELLED');
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    throw new CashbookApiError('Gmail OAuth stateが無効です。', 400, 'INVALID_GMAIL_OAUTH_STATE');
  }

  const stateRow = await env.DB.prepare(
    `SELECT owner_id AS ownerId, redirect_uri AS redirectUri, expires_at AS expiresAt
     FROM cashbook_oauth_states
     WHERE state_hash = ? AND expires_at > ?
     LIMIT 1`,
  )
    .bind(await sha256(state), Math.floor(Date.now() / 1000))
    .first<OAuthStateRow>();
  if (!stateRow) {
    throw new CashbookApiError('Gmail OAuth stateが期限切れです。', 400, 'EXPIRED_GMAIL_OAUTH_STATE');
  }

  await env.DB.prepare('DELETE FROM cashbook_oauth_states WHERE state_hash = ?')
    .bind(await sha256(state))
    .run();

  const token = await exchangeGoogleCode(env, code, stateRow.redirectUri);
  const profile = await loadGoogleProfile(token.access_token || '');
  if (!isAllowedGmailAccount(profile.email, env)) {
    throw new CashbookApiError('許可されていないGoogleアカウントです。', 403, 'GOOGLE_ACCOUNT_NOT_ALLOWED');
  }
  await storeGmailToken(env, stateRow.ownerId, profile.email?.trim().toLowerCase() || null, token);

  return new Response(null, {
    status: 302,
    headers: {
      location: `${url.origin}/cashbook/`,
      'set-cookie': clearCookie(request, STATE_COOKIE),
    },
  });
}

function googleAuthorizationUrl(clientId: string, redirectUri: string, state: string): string {
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.searchParams.set('client_id', clientId);
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', 'openid email profile https://www.googleapis.com/auth/gmail.modify');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('access_type', 'offline');
  authorizationUrl.searchParams.set('include_granted_scopes', 'true');
  authorizationUrl.searchParams.set('prompt', 'consent select_account');
  return authorizationUrl.toString();
}

function isAllowedGmailAccount(email: string | undefined, env: AppEnv): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return false;

  const allowedEmails = (env.ALLOWED_GOOGLE_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (allowedEmails.length > 0) return allowedEmails.includes(normalizedEmail);

  const ownerEmail = env.OWNER_GOOGLE_EMAIL?.trim().toLowerCase();
  return !ownerEmail || ownerEmail === normalizedEmail;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

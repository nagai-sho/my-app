import { hasValidAdminSession } from './adminSession';
import type { AppEnv } from './env';
import { verifyGoogleIdToken } from './google';

function getAllowedEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

interface AuthorizationRequest {
  headers: { get(name: string): string | null };
  url: string;
}

export interface AuthorizedUser {
  id: 'owner';
  email: string;
  name?: string;
}

export async function getAuthorizedUser(
  request: AuthorizationRequest,
  env: AppEnv,
): Promise<AuthorizedUser | null> {
  try {
    if (await hasValidAdminSession(request, env)) {
      return {
        id: 'owner',
        email: env.OWNER_GOOGLE_EMAIL?.trim() || firstAllowedEmail(env.ALLOWED_GOOGLE_EMAILS) || 'admin@example.com',
        name: '管理者',
      };
    }
  } catch {
    return null;
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    return null;
  }

  const claims = await verifyGoogleIdToken(token, env.GOOGLE_CLIENT_ID ?? '');
  const email = claims?.email?.trim().toLowerCase();
  if (!email || !getAllowedEmails(env.ALLOWED_GOOGLE_EMAILS).has(email)) {
    return null;
  }

  return {
    id: 'owner',
    email,
  };
}

export async function isAuthorized(request: AuthorizationRequest, env: AppEnv): Promise<boolean> {
  return Boolean(await getAuthorizedUser(request, env));
}

function firstAllowedEmail(value: string | undefined): string | null {
  return [...getAllowedEmails(value)][0] || null;
}

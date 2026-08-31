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

export async function isAuthorized(request: AuthorizationRequest, env: AppEnv): Promise<boolean> {
  try {
    if (await hasValidAdminSession(request, env)) {
      return true;
    }
  } catch {
    return false;
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return false;
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    return false;
  }

  const claims = await verifyGoogleIdToken(token, env.GOOGLE_CLIENT_ID ?? '');
  const email = claims?.email?.trim().toLowerCase();
  return Boolean(email && getAllowedEmails(env.ALLOWED_GOOGLE_EMAILS).has(email));
}

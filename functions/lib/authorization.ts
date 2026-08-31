import { getValidAppSession } from './adminSession';
import type { AppEnv } from './env';

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
    const session = await getValidAppSession(request, env);
    if (!session) return null;
    return session;
  } catch {
    return null;
  }
}

export async function isAuthorized(request: AuthorizationRequest, env: AppEnv): Promise<boolean> {
  return Boolean(await getAuthorizedUser(request, env));
}

export function isAllowedGoogleEmail(value: string | undefined, env: AppEnv): boolean {
  const email = value?.trim().toLowerCase();
  if (!email) return false;
  const allowed = getAllowedEmails(env.ALLOWED_GOOGLE_EMAILS);
  if (allowed.size > 0) return allowed.has(email);
  const ownerEmail = env.OWNER_GOOGLE_EMAIL?.trim().toLowerCase();
  return !ownerEmail || ownerEmail === email;
}

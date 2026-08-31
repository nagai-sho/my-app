import type { PagesFunction } from '@cloudflare/workers-types';

import { isAllowedGoogleEmail } from '../../lib/authorization';
import { createAdminSession, createSessionCookie } from '../../lib/adminSession';
import type { AppEnv } from '../../lib/env';
import { jsonResponse } from '../../lib/http';
import { verifyGoogleIdToken } from '../../lib/google';

export const onRequest: PagesFunction<AppEnv> = async ({ request, env }) => {
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  const credential = body && typeof body === 'object' && 'credential' in body && typeof body.credential === 'string'
    ? body.credential.trim()
    : '';
  if (!credential) return json({ error: 'Invalid request body' }, 400);

  const claims = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID ?? '');
  const email = claims?.email?.trim().toLowerCase();
  if (!claims?.sub || !email || !isAllowedGoogleEmail(email, env)) {
    return json({ error: 'Google account is not allowed' }, 401);
  }

  await env.DB.prepare(
    `UPDATE app_users
        SET google_sub = ?, email = ?, display_name = ?, picture_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 'owner'`,
  ).bind(claims.sub, email, claims.name?.trim() || null, claims.picture?.trim() || null).run();

  try {
    const session = await createAdminSession(env);
    return json(
      { authenticated: true },
      200,
      { 'Set-Cookie': createSessionCookie(request, session.token) },
    );
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      feature: 'auth',
      event: 'google_session_create_failed',
      message: error instanceof Error ? error.message : String(error),
    }));
    return json({ error: '予期せぬエラーが発生しました。' }, 500);
  }
};

type PagesResponse = Awaited<ReturnType<PagesFunction<AppEnv>>>;

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): PagesResponse {
  return jsonResponse<AppEnv>(body, status, extraHeaders);
}

import type { PagesFunction } from '@cloudflare/workers-types';

import {
  createAdminSession,
  createSessionCookie,
  verifyAdminCredentials,
} from '../../lib/adminSession';
import type { AppEnv } from '../../lib/env';
import { jsonResponse } from '../../lib/http';

interface LoginPayload {
  username?: unknown;
  password?: unknown;
}

export const onRequest: PagesFunction<AppEnv> = async ({ request, env }) => {
  if (request.method !== 'POST') {
    return jsonResponse<AppEnv>({ error: 'Method Not Allowed' }, 405, { Allow: 'POST' });
  }

  let payload: LoginPayload;
  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return jsonResponse<AppEnv>({ error: 'Invalid request body' }, 400);
  }

  if (typeof payload.username !== 'string' || typeof payload.password !== 'string') {
    return jsonResponse<AppEnv>({ error: 'Invalid request body' }, 400);
  }

  if (!(await verifyAdminCredentials(payload.username, payload.password, env))) {
    return jsonResponse<AppEnv>({ error: 'Unauthorized' }, 401);
  }

  try {
    const session = await createAdminSession(env);
    return jsonResponse<AppEnv>(
      { authenticated: true },
      200,
      { 'Set-Cookie': createSessionCookie(request, session.token) },
    );
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      feature: 'auth',
      event: 'admin_session_create_failed',
      message: error instanceof Error ? error.message : String(error),
    }));
    return jsonResponse<AppEnv>({ error: '予期せぬエラーが発生しました。' }, 500);
  }
};

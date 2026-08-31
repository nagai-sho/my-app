import type { PagesFunction } from '@cloudflare/workers-types';

import {
  clearSessionCookie,
  revokeAdminSession,
} from '../../lib/adminSession';
import type { AppEnv } from '../../lib/env';
import { jsonResponse } from '../../lib/http';

export const onRequest: PagesFunction<AppEnv> = async ({ request, env }) => {
  if (request.method !== 'POST') {
    return jsonResponse<AppEnv>({ error: 'Method Not Allowed' }, 405, { Allow: 'POST' });
  }

  try {
    await revokeAdminSession(request, env);
    return jsonResponse<AppEnv>(
      { authenticated: false },
      200,
      { 'Set-Cookie': clearSessionCookie(request) },
    );
  } catch {
    return jsonResponse<AppEnv>({ error: '予期せぬエラーが発生しました。' }, 500);
  }
};

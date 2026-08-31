import type { PagesFunction } from '@cloudflare/workers-types';

import { hasValidAdminSession } from '../../lib/adminSession';
import type { AppEnv } from '../../lib/env';
import { jsonResponse } from '../../lib/http';

export const onRequest: PagesFunction<AppEnv> = async ({ request, env }) => {
  if (request.method !== 'GET') {
    return jsonResponse<AppEnv>({ error: 'Method Not Allowed' }, 405, { Allow: 'GET' });
  }

  try {
    if (await hasValidAdminSession(request, env)) {
      return jsonResponse<AppEnv>({ authenticated: true });
    }
  } catch {
    return jsonResponse<AppEnv>({ error: '予期せぬエラーが発生しました。' }, 500);
  }

  return jsonResponse<AppEnv>({ error: 'Unauthorized' }, 401);
};

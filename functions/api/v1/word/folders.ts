import type { PagesFunction } from '@cloudflare/workers-types';

import { isAuthorized } from '../../../lib/authorization';
import { handleWordFolders } from '../../../lib/wordApi';
import type { AppEnv } from '../../../lib/env';
import { jsonResponse } from '../../../lib/http';

export const onRequest: PagesFunction<AppEnv> = async ({ request, env }) => {
  if (!(await isAuthorized(request, env))) {
    return jsonResponse<AppEnv>({ error: 'Unauthorized' }, 401);
  }

  return handleWordFolders(request, env);
};

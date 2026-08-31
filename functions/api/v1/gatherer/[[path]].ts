import type { PagesFunction } from '@cloudflare/workers-types';

import { getAuthorizedUser } from '../../../lib/authorization';
import { handleGatherer } from '../../../lib/gathererApi';
import type { AppEnv } from '../../../lib/env';
import { jsonResponse } from '../../../lib/http';

export const onRequest: PagesFunction<AppEnv> = async ({ request, env }) => {
  const gathererRequest = request as unknown as Request;
  if (request.method === 'OPTIONS') return asPagesResponse(await handleGatherer(gathererRequest, env));

  const user = await getAuthorizedUser(request, env);
  if (!user) return jsonResponse<AppEnv>({ error: 'Authentication required' }, 401);
  return asPagesResponse(await handleGatherer(gathererRequest, env, user.id));
};

type PagesResponse = Awaited<ReturnType<PagesFunction<AppEnv>>>;

function asPagesResponse(response: Response): PagesResponse {
  return response as unknown as PagesResponse;
}

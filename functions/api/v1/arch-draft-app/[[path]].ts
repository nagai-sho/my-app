import type { PagesFunction } from '@cloudflare/workers-types';

import { getAuthorizedUser } from '../../../lib/authorization';
import type { AppEnv } from '../../../lib/env';
import { handleArchDraftRequest } from '../../../lib/arch-draft-app/api';
import { jsonResponse } from '../../../lib/http';

export const onRequest: PagesFunction<AppEnv> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') {
    return asPagesResponse(await handleArchDraftRequest(request as unknown as Request, env, 'owner'));
  }

  const user = await getAuthorizedUser(request, env);
  if (!user) return jsonResponse<AppEnv>({ error: 'Authentication required' }, 401);

  // TODO: Add app-level role checks alongside my-app's shared session when permissions are introduced.
  return asPagesResponse(await handleArchDraftRequest(request as unknown as Request, env, user.id));
};

type PagesResponse = Awaited<ReturnType<PagesFunction<AppEnv>>>;

function asPagesResponse(response: Response): PagesResponse {
  return response as unknown as PagesResponse;
}

import type { PagesFunction } from '@cloudflare/workers-types';

import { getAuthorizedUser } from '../lib/authorization';
import { handleLegacyFile, type CollectionUser } from '../lib/collectionApi';
import { json } from '../lib/collectionHttp';
import type { AppEnv } from '../lib/env';

export const onRequestGet: PagesFunction<AppEnv> = async ({ request, env }) => {
  try {
    const user = await getAuthorizedUser(request, env);
    if (!user) return asPagesResponse(json({ error: 'Authentication required' }, { status: 401 }));
    return asPagesResponse(await handleLegacyFile(request, env, toCollectionUser(user)));
  } catch (error) {
    console.error(JSON.stringify({
      message: 'legacy collection file request failed',
      error: error instanceof Error ? error.message : String(error),
    }));
    return asPagesResponse(json({ error: 'Internal server error' }, { status: 500 }));
  }
};

function toCollectionUser(user: { id: string; email: string }): CollectionUser {
  return { ownerId: user.id, email: user.email };
}

type PagesResponse = Awaited<ReturnType<PagesFunction<AppEnv>>>;

function asPagesResponse(response: Response): PagesResponse {
  return response as unknown as PagesResponse;
}

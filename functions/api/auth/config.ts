import type { PagesFunction } from '@cloudflare/workers-types';

import type { AppEnv } from '../../lib/env';
import { jsonResponse } from '../../lib/http';

export const onRequestOptions: PagesFunction<AppEnv> = () => jsonResponse<AppEnv>(null, 204);

export const onRequestGet: PagesFunction<AppEnv> = ({ env }) =>
  jsonResponse<AppEnv>({ googleClientId: env.GOOGLE_CLIENT_ID ?? '' });

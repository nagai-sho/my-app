import type { PagesFunction } from '@cloudflare/workers-types';

import { getAuthorizedUser } from '../../../lib/authorization';
import { handleCashbookGmailOAuth } from '../../../lib/cashbookGmailOAuth';
import { CashbookApiError, appError, json, serverError } from '../../../lib/cashbookHttp';
import { handleCashbookRoute } from '../../../lib/cashbookApi';
import type { AppEnv } from '../../../lib/env';

export const onRequest: PagesFunction<AppEnv> = async ({ request, env }) => {
  const pathname = new URL(request.url).pathname;
  try {
    const oauthResponse = await handleCashbookGmailOAuth(request, env, pathname);
    if (oauthResponse) return asPagesResponse(oauthResponse);

    const user = await getAuthorizedUser(request, env);
    if (!user) return asPagesResponse(json({ message: 'ログインが必要です。' }, { status: 401 }));

    const response = (await handleCashbookRoute(request, env, user, pathname)) || json(
        { message: 'Cashbook APIが見つかりません。' },
        { status: 404 },
      );
    return asPagesResponse(response);
  } catch (error) {
    if (error instanceof CashbookApiError) return asPagesResponse(appError(error));
    console.error(JSON.stringify({ message: 'cashbook request failed', path: pathname, error: error instanceof Error ? error.message : String(error) }));
    return asPagesResponse(serverError());
  }
};

type PagesResponse = Awaited<ReturnType<PagesFunction<AppEnv>>>;

function asPagesResponse(response: Response): PagesResponse {
  return response as unknown as PagesResponse;
}

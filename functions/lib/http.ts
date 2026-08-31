import type { PagesFunction } from '@cloudflare/workers-types';

export const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

type PagesResponse<Environment> = Awaited<ReturnType<PagesFunction<Environment>>>;

export function jsonResponse<Environment>(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): PagesResponse<Environment> {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  }) as unknown as PagesResponse<Environment>;
}

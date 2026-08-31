import type { PagesFunction } from '@cloudflare/workers-types';

import { collectGatherer } from './lib/gathererCollect';
import { dayKeyJst } from './lib/gathererTime';
import type { AppEnv } from './lib/env';

// Keep the scheduled entry compatible with the source app. Pages deployments
// do not create a Cron Trigger from this file alone; a separate scheduler can
// reuse this function when automated collection is enabled in production.
export async function runScheduledGatherer(env: AppEnv): Promise<void> {
  await collectGatherer(env, dayKeyJst(), 'scheduled');
}

export const onScheduled: PagesFunction<AppEnv> = async ({ env }) => {
  await runScheduledGatherer(env);
  return new Response(null, { status: 204 }) as unknown as Awaited<ReturnType<PagesFunction<AppEnv>>>;
};

import { fetchSource } from './gathererProviders';
import { dayKeyDaysAgo, dayKeyJst, nowSeconds } from './gathererTime';
import type {
  GathererCollectResult,
  GathererEnv,
  GathererItemInput,
  GathererRule,
  GathererRuleRow,
  GathererSourceRow,
} from './gathererTypes';

const OWNER_ID = 'owner';
const RETAIN_ITEM_DAYS = 30;
const RETAIN_RUN_DAYS = 90;
const DEFAULT_TAVILY_DAILY_LIMIT = 30;
const DEFAULT_TAVILY_MONTHLY_LIMIT = 900;

export async function collectGatherer(
  env: GathererEnv,
  dayKey = dayKeyJst(),
  trigger: 'scheduled' | 'manual' = 'manual',
): Promise<GathererCollectResult> {
  const runId = crypto.randomUUID();
  const startedAt = nowSeconds();
  await env.DB.prepare(
    `INSERT INTO gatherer_fetch_runs
      (id, owner_id, ran_at, day_key, trigger, status, started_at)
     VALUES (?, ?, ?, ?, ?, 'running', ?)`,
  ).bind(runId, OWNER_ID, startedAt, dayKey, trigger, startedAt).run();

  let inserted = 0;
  let reused = 0;
  let skipped = 0;
  let creditsUsed = 0;
  const failures: string[] = [];

  try {
    const tavilyLimit = await getTavilyLimit(env, startedAt);
    const sources = await env.DB.prepare(
      `SELECT * FROM gatherer_sources
       WHERE owner_id = ? AND enabled = 1
       ORDER BY updated_at DESC, created_at DESC`,
    ).bind(OWNER_ID).all<GathererSourceRow>();

    for (const source of sources.results ?? []) {
      try {
        const rules = await loadRules(env, source.id);
        if (source.provider === 'tavily' && creditsUsed >= tavilyLimit) {
          throw new Error(`Tavily credit limit reached: ${tavilyLimit}`);
        }
        const fetched = await fetchSource(env, source);
        creditsUsed += fetched.credits;
        if (source.provider === 'tavily' && creditsUsed > tavilyLimit) {
          throw new Error(`Tavily credit limit exceeded: ${creditsUsed}/${tavilyLimit}`);
        }

        for (const item of fetched.items) {
          if (!isUsableItem(item)) {
            skipped += 1;
            continue;
          }
          const matched = bestRule(item, rules);
          if (!matched) {
            skipped += 1;
            continue;
          }

          const existing = await env.DB.prepare(
            `SELECT id FROM gatherer_items WHERE source_id = ? AND external_id = ? LIMIT 1`,
          ).bind(source.id, item.external_id).first<{ id: string }>();
          const itemId = existing?.id ?? crypto.randomUUID();
          await env.DB.prepare(
            `INSERT INTO gatherer_items
              (id, owner_id, source_id, rule_id, external_id, title, url, summary,
               published_at, day_key, score, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(source_id, external_id) DO UPDATE SET
               owner_id = excluded.owner_id,
               rule_id = excluded.rule_id,
               title = excluded.title,
               url = excluded.url,
               summary = excluded.summary,
               published_at = excluded.published_at,
               day_key = excluded.day_key,
               score = excluded.score,
               updated_at = excluded.updated_at`,
          ).bind(
            itemId,
            OWNER_ID,
            source.id,
            matched.rule.id,
            item.external_id,
            item.title,
            item.url,
            item.summary,
            item.published_at,
            dayKey,
            matched.score,
            startedAt,
            startedAt,
          ).run();
          if (existing) reused += 1;
          else inserted += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        failures.push(`${source.title}: ${message}`);
        console.error(JSON.stringify({
          level: 'error',
          feature: 'gatherer',
          event: 'source_collect_failed',
          source_id: source.id,
          message,
        }));
      }
    }

    await cleanupGathererData(env);
    const status = failures.length === 0 ? 'success' : inserted > 0 || reused > 0 ? 'partial' : 'fail';
    const finishedAt = nowSeconds();
    await env.DB.prepare(
      `UPDATE gatherer_fetch_runs
       SET status = ?, finished_at = ?, inserted_count = ?, reused_count = ?,
           skipped_count = ?, credits_used = ?, failures_json = ?, note = ?
       WHERE id = ? AND owner_id = ?`,
    ).bind(
      status,
      finishedAt,
      inserted,
      reused,
      skipped,
      creditsUsed,
      JSON.stringify(failures).slice(0, 20_000),
      failures.join('; ').slice(0, 1_000),
      runId,
      OWNER_ID,
    ).run();
    console.log(JSON.stringify({
      level: 'info',
      feature: 'gatherer',
      event: 'collect_finished',
      run_id: runId,
      trigger,
      day_key: dayKey,
      status,
      inserted,
      reused,
      skipped,
      failures: failures.length,
    }));
    return { runId, inserted, reused, skipped, status, failures };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    await markRunFailed(env, runId, message, creditsUsed);
    throw error;
  }
}

async function loadRules(env: GathererEnv, sourceId: string): Promise<GathererRule[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM gatherer_rules WHERE source_id = ? ORDER BY created_at ASC',
  ).bind(sourceId).all<GathererRuleRow>();
  const ruleRows: GathererRuleRow[] = result.results ?? [];
  return ruleRows.map((rule: GathererRuleRow) => ({
    ...rule,
    include: parseJsonArray(rule.include_keywords).map((item) => item.toLowerCase()),
    exclude: parseJsonArray(rule.exclude_keywords).map((item) => item.toLowerCase()),
    tagsArray: parseJsonArray(rule.tags),
  }));
}

async function getTavilyLimit(env: GathererEnv, now: number): Promise<number> {
  const daily = positiveLimit(env.TAVILY_DAILY_CREDIT_LIMIT, DEFAULT_TAVILY_DAILY_LIMIT);
  const monthly = positiveLimit(env.TAVILY_MONTHLY_CREDIT_LIMIT, DEFAULT_TAVILY_MONTHLY_LIMIT);
  const dailySince = now - 24 * 60 * 60;
  const monthlySince = now - 31 * 24 * 60 * 60;
  const [dailyUsage, monthlyUsage] = await Promise.all([
    env.DB.prepare(
      `SELECT COALESCE(SUM(credits_used), 0) AS credits
       FROM gatherer_fetch_runs
       WHERE owner_id = ? AND ran_at >= ?`,
    ).bind(OWNER_ID, dailySince).first<{ credits: number }>(),
    env.DB.prepare(
      `SELECT COALESCE(SUM(credits_used), 0) AS credits
       FROM gatherer_fetch_runs
       WHERE owner_id = ? AND ran_at >= ?`,
    ).bind(OWNER_ID, monthlySince).first<{ credits: number }>(),
  ]);
  return Math.max(0, Math.min(daily - Number(dailyUsage?.credits ?? 0), monthly - Number(monthlyUsage?.credits ?? 0)));
}

function positiveLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isUsableItem(item: GathererItemInput): boolean {
  return item.external_id.trim().length > 0
    && item.title.trim().length > 0
    && /^https?:\/\//i.test(item.url);
}

function bestRule(item: GathererItemInput, rules: GathererRule[]): { rule: GathererRule; score: number } | null {
  if (rules.length === 0) return null;
  const text = `${item.title} ${item.summary}`.toLowerCase();
  let best: { rule: GathererRule; score: number } | null = null;
  for (const rule of rules) {
    if (rule.exclude.some((keyword) => keyword && text.includes(keyword))) continue;
    const includeHits = rule.include.filter((keyword) => keyword && text.includes(keyword)).length;
    if (rule.include.length > 0 && includeHits === 0) continue;
    let regexHit = 0;
    if (rule.regex) {
      try { regexHit = new RegExp(rule.regex, 'i').test(text) ? 1 : 0; } catch { regexHit = 0; }
      if (regexHit === 0) continue;
    }
    const score = includeHits + regexHit;
    if (!best || score > best.score) best = { rule, score };
  }
  return best;
}

async function cleanupGathererData(env: GathererEnv): Promise<void> {
  const itemThreshold = dayKeyDaysAgo(RETAIN_ITEM_DAYS);
  const oldItems = await env.DB.prepare(
    'SELECT id FROM gatherer_items WHERE owner_id = ? AND day_key < ?',
  ).bind(OWNER_ID, itemThreshold).all<{ id: string }>();
  for (const item of oldItems.results ?? []) {
    await env.DB.prepare('DELETE FROM gatherer_item_states WHERE owner_id = ? AND item_id = ?')
      .bind(OWNER_ID, item.id).run();
  }
  await env.DB.prepare('DELETE FROM gatherer_items WHERE owner_id = ? AND day_key < ?')
    .bind(OWNER_ID, itemThreshold).run();
  await env.DB.prepare('DELETE FROM gatherer_fetch_runs WHERE owner_id = ? AND ran_at < ?')
    .bind(OWNER_ID, nowSeconds() - RETAIN_RUN_DAYS * 24 * 60 * 60).run();
}

async function markRunFailed(env: GathererEnv, runId: string, message: string, creditsUsed: number): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE gatherer_fetch_runs
       SET status = 'fail', finished_at = ?, credits_used = ?, failures_json = ?, note = ?
       WHERE id = ? AND owner_id = ?`,
    ).bind(nowSeconds(), creditsUsed, JSON.stringify([message]), message.slice(0, 1_000), runId, OWNER_ID).run();
  } catch (recordError) {
    console.error(JSON.stringify({
      level: 'error',
      feature: 'gatherer',
      event: 'run_failure_record_failed',
      run_id: runId,
      message: recordError instanceof Error ? recordError.message : String(recordError),
    }));
  }
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

import type { GathererEnv, GathererItemInput } from './gathererTypes';

type TavilyResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  published_date?: unknown;
};

type TavilyResponse = {
  results?: unknown;
  usage?: { credits?: unknown };
};

export type GathererFetched = { items: GathererItemInput[]; credits: number };

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

export async function fetchSource(
  env: GathererEnv,
  source: { provider: string; endpoint: string },
): Promise<GathererFetched> {
  if (source.provider === 'tavily') {
    return searchTavily(env, source.endpoint);
  }

  const response = await fetchWithRetry(source.endpoint, {
    headers: { 'User-Agent': 'my-app-gatherer/1.0' },
  });
  if (!response.ok) throw new Error(`fetch failed: ${response.status}`);

  if (source.provider === 'json_api' || source.provider === 'github_releases') {
    const payload = JSON.parse(await readResponseText(response));
    return { items: parseJsonApi(payload), credits: 0 };
  }
  const body = await readResponseText(response);
  if (source.provider === 'html') {
    return { items: parseHtml(body, source.endpoint), credits: 0 };
  }
  return { items: parseRss(body), credits: 0 };
}

export async function fetchWithRetry(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (response.status >= 500 || response.status === 429) {
        throw new Error(`upstream returned ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < MAX_ATTEMPTS) {
        await wait(Math.min(250 * 2 ** attempt, 1_000));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('fetch failed');
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function readResponseText(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error(`response exceeds ${MAX_RESPONSE_BYTES} bytes`);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function searchTavily(env: GathererEnv, query: string): Promise<GathererFetched> {
  if (!env.TAVILY_API_KEY) throw new Error('TAVILY_API_KEY is not configured');
  const response = await fetchWithRetry('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.TAVILY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      include_favicon: true,
      include_usage: true,
    }),
  });
  if (!response.ok) throw new Error(`Tavily search failed: ${response.status}`);
  const payload = JSON.parse(await readResponseText(response)) as TavilyResponse;
  const results = Array.isArray(payload.results) ? payload.results as TavilyResult[] : [];
  const credits = typeof payload.usage?.credits === 'number' ? payload.usage.credits : 1;
  return {
    credits,
    items: results.map((result) => {
      const url = asString(result.url);
      const title = asString(result.title) || url || 'Untitled';
      return {
        external_id: url || title,
        title,
        url,
        summary: asString(result.content),
        published_at: toSeconds(result.published_date),
      };
    }).filter((item) => item.url),
  };
}

export function parseJsonApi(payload: unknown): GathererItemInput[] {
  const items = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.items)
      ? payload.items
      : isRecord(payload) && Array.isArray(payload.results)
        ? payload.results
        : [];
  return items.filter(isRecord).map((record) => {
    const url = getString(record, ['url', 'link', 'html_url']);
    const title = getString(record, ['title', 'name']) || url || 'Untitled';
    return {
      external_id: getString(record, ['external_id', 'id', 'guid', 'url']) || title,
      title,
      url,
      summary: getString(record, ['summary', 'description', 'body', 'content']),
      published_at: toSeconds(getString(record, ['published_at', 'publishedAt', 'published', 'date', 'created_at'])),
    };
  }).filter((item) => item.url);
}

export function parseRss(xml: string): GathererItemInput[] {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((match) => match[0]);
  return blocks.map((block) => {
    const atomLink = block.match(/<link\b[^>]*href=["'][^"']+["'][^>]*\/?\s*>/i)?.[0];
    const link = textBetween(block, 'link') || (atomLink ? attrValue(atomLink, 'href') : '');
    const id = textBetween(block, 'guid') || textBetween(block, 'id') || link || textBetween(block, 'title');
    const published = textBetween(block, 'pubDate') || textBetween(block, 'published') || textBetween(block, 'updated');
    return {
      external_id: id,
      title: textBetween(block, 'title') || 'Untitled',
      url: link,
      summary: textBetween(block, 'description') || textBetween(block, 'summary') || textBetween(block, 'content'),
      published_at: published ? toSeconds(published) : null,
    };
  }).filter((item) => item.url && item.external_id);
}

export function parseHtml(html: string, pageUrl: string): GathererItemInput[] {
  const base = new URL(pageUrl);
  const seen = new Set<string>();
  const candidates: Array<GathererItemInput & { rank: number }> = [];
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decode(match[2]).trim();
    if (!href || /^(?:#|javascript:|mailto:|tel:)/i.test(href)) continue;
    let url: URL;
    try { url = new URL(href, base); } catch { continue; }
    url.hash = '';
    const normalized = url.toString();
    if (seen.has(normalized) || url.origin !== base.origin) continue;
    const title = cleanText(match[3]) || normalized;
    if (!isLikelyArticle(url, title, base)) continue;
    seen.add(normalized);
    candidates.push({ external_id: normalized, title, url: normalized, summary: '', published_at: null, rank: rankLink(url, title) });
  }
  return candidates.sort((left, right) => right.rank - left.rank).slice(0, 30).map((item) => ({
    external_id: item.external_id,
    title: item.title,
    url: item.url,
    summary: item.summary,
    published_at: item.published_at,
  }));
}

const ARTICLE_PATH_HINT = /\/(?:article|articles|blog|blogs|entry|entries|news|posts?|press|release|story|topics?)\b/i;
const DATE_PATH_HINT = /\/20\d{2}[/-](?:0?[1-9]|1[0-2])(?:[/-](?:0?[1-9]|[12]\d|3[01]))?\b/;
const SKIP_PATH_HINT = /\.(?:7z|avi|css|dmg|gif|gz|ico|jpeg|jpg|js|mov|mp3|mp4|pdf|png|svg|tar|webm|webp|zip)$/i;
const SKIP_TEXT = /^(about|account|advertising|archive|author|category|contact|help|home|login|menu|privacy|rss|search|sign in|sign up|terms)$/i;

function isLikelyArticle(url: URL, text: string, base: URL): boolean {
  if (url.hash && `${url.origin}${url.pathname}${url.search}` === `${base.origin}${base.pathname}${base.search}`) return false;
  if (SKIP_PATH_HINT.test(url.pathname) || SKIP_TEXT.test(text) || text.length < 4 || text.length > 180) return false;
  const segments = url.pathname.split('/').filter(Boolean);
  return ARTICLE_PATH_HINT.test(url.pathname) || DATE_PATH_HINT.test(url.pathname) || segments.length >= 2;
}

function rankLink(url: URL, text: string): number {
  return Math.min(text.length, 80) + (ARTICLE_PATH_HINT.test(url.pathname) ? 40 : 0) + (DATE_PATH_HINT.test(url.pathname) ? 30 : 0);
}

function textBetween(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return cleanText(match?.[1] ?? '');
}

function attrValue(xml: string, attr: string): string {
  return decode(xml.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'))?.[1] ?? '');
}

function cleanText(value: string): string {
  return decode(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function asString(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function getString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) { const value = asString(record[key]); if (value) return value; }
  return '';
}
function toSeconds(value: unknown): number | null {
  const timestamp = Date.parse(asString(value));
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

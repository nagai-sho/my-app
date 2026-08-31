import { describe, expect, it } from 'vitest';

import { parseHtml, parseJsonApi, parseRss } from './gathererProviders';

describe('parseRss', () => {
  it('parses RSS items', () => {
    const items = parseRss(`
      <rss><channel>
        <item>
          <title><![CDATA[Cloudflare D1 update]]></title>
          <link>https://example.com/d1</link>
          <guid>d1-update</guid>
          <description>SQLite at the edge</description>
          <pubDate>Tue, 10 Jun 2025 00:00:00 GMT</pubDate>
        </item>
      </channel></rss>
    `);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      external_id: 'd1-update',
      title: 'Cloudflare D1 update',
      url: 'https://example.com/d1',
      summary: 'SQLite at the edge',
    });
  });
});

describe('parseJsonApi', () => {
  it('accepts an items array and normalizes common fields', () => {
    expect(parseJsonApi({ items: [{ id: 'item-1', name: 'Release', html_url: 'https://example.com/release' }] })).toEqual([
      {
        external_id: 'item-1',
        title: 'Release',
        url: 'https://example.com/release',
        summary: '',
        published_at: null,
      },
    ]);
  });
});

describe('parseHtml', () => {
  it('extracts likely same-origin article links from an HTML page', () => {
    const items = parseHtml(
      `
        <main>
          <a href="/about">About</a>
          <article>
            <h2><a href="/news/2026/06/cloudflare-workers-update">Cloudflare Workers update shipped today</a></h2>
          </article>
          <a href="https://example.com/blog/building-with-react-server-components">
            Building with React Server Components in production
          </a>
          <a href="https://external.example.net/news/2026/06/external">External story</a>
          <a href="/assets/logo.png">Logo</a>
        </main>
      `,
      'https://example.com/news',
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      external_id: 'https://example.com/news/2026/06/cloudflare-workers-update',
      title: 'Cloudflare Workers update shipped today',
      url: 'https://example.com/news/2026/06/cloudflare-workers-update',
    });
    expect(items.map((item) => item.url)).not.toContain('https://example.com/about');
    expect(items.map((item) => item.url)).not.toContain('https://external.example.net/news/2026/06/external');
  });
});

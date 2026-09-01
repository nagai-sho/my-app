INSERT INTO apps (
  id,
  name,
  url,
  description,
  category,
  sort_order,
  icon_url,
  pinned,
  tags,
  created_at,
  updated_at
)
VALUES (
  'ip-expand-app',
  'IP Expand',
  'https://ip-expand-app.pages.dev/',
  'IP情報の展開・分析',
  'external',
  40,
  NULL,
  0,
  '["external"]',
  strftime('%s','now') * 1000,
  strftime('%s','now') * 1000
)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  url = excluded.url,
  description = excluded.description,
  category = excluded.category,
  sort_order = excluded.sort_order,
  icon_url = excluded.icon_url,
  pinned = excluded.pinned,
  tags = excluded.tags,
  updated_at = excluded.updated_at;

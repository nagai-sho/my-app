INSERT INTO apps (
  id,
  name,
  url,
  description,
  sort_order,
  icon_url,
  pinned,
  tags,
  created_at,
  updated_at
)
VALUES (
  'gatherer-app',
  'Gatherer',
  '/gatherer',
  '情報源から記事を定期収集して整理',
  8,
  '/icons/gatherer.svg',
  1,
  '["monitoring"]',
  strftime('%s','now') * 1000,
  strftime('%s','now') * 1000
)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  url = excluded.url,
  description = excluded.description,
  sort_order = excluded.sort_order,
  icon_url = excluded.icon_url,
  pinned = excluded.pinned,
  tags = excluded.tags,
  updated_at = excluded.updated_at;

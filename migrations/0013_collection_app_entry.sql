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
  'collection-app',
  'Collection',
  '/collection',
  '画像とPDFを本棚のように整理',
  7,
  '/icons/collection.svg',
  1,
  '["collection"]',
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

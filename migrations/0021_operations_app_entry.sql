PRAGMA foreign_keys = ON;

-- Replace the initial Dashboard placeholder with the integrated operations
-- overview. The page reads the shared D1 data and checks registered links.
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
  'app_5',
  'Dashboard',
  '/operations',
  'アプリと連携サービスの運用状況',
  'integrated',
  50,
  '/icons/operations.svg',
  0,
  '["monitoring"]',
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

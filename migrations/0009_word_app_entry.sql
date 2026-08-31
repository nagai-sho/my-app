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
  'word-app',
  'Word App',
  '/word',
  '単語カードの学習と管理',
  5,
  '/icons/icon-192.svg',
  1,
  '["learning"]',
  strftime('%s','now') * 1000,
  strftime('%s','now') * 1000
)
ON CONFLICT (id) DO NOTHING;

PRAGMA foreign_keys = ON;

ALTER TABLE apps ADD COLUMN category TEXT NOT NULL DEFAULT 'integrated'
  CHECK (category IN ('integrated', 'external'));

CREATE INDEX IF NOT EXISTS idx_apps_category_sort
  ON apps(category, sort_order ASC, name COLLATE NOCASE);

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
VALUES
  (
    'novel-koubou',
    'ノベル工房',
    'https://novel-koubou.com/',
    '小説制作・執筆支援',
    'external',
    10,
    NULL,
    0,
    '["external"]',
    strftime('%s','now') * 1000,
    strftime('%s','now') * 1000
  ),
  (
    'recipe-management-app',
    '商品管理',
    'https://recipe-management-app.pages.dev/',
    '商品の登録と管理',
    'external',
    20,
    NULL,
    0,
    '["external"]',
    strftime('%s','now') * 1000,
    strftime('%s','now') * 1000
  ),
  (
    'app-settings-creator',
    'アプリ案管理',
    'https://app-settings-creator.as-uland-dr.workers.dev/',
    'アプリ案と設定の管理',
    'external',
    30,
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

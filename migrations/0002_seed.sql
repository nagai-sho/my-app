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
VALUES
  ('app_1', 'Notes', 'https://notes.example.com', '個人メモ', 10, NULL, 1, '["tool"]', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('app_2', 'Tasks', 'https://tasks.example.com', 'タスク管理', 20, NULL, 1, '["productivity"]', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('app_3', 'Links', 'https://links.example.com', 'リンク集', 30, NULL, 0, '["utility"]', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('app_4', 'Calendar', 'https://calendar.example.com', '予定管理', 40, NULL, 0, '["productivity"]', strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('app_5', 'Dashboard', 'https://dashboard.example.com', '運用状況', 50, NULL, 0, '["monitoring"]', strftime('%s','now') * 1000, strftime('%s','now') * 1000)
ON CONFLICT (id) DO NOTHING;

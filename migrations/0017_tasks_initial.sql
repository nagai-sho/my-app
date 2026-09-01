PRAGMA foreign_keys = ON;

-- Tasks is a standalone personal task list.  It intentionally uses a
-- feature-specific table name so it cannot collide with Gatherer's habit
-- tracking tables.
CREATE TABLE IF NOT EXISTS task_items (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_task_items_owner_status_due
  ON task_items(owner_id, status, due_date, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_items_owner_updated
  ON task_items(owner_id, updated_at DESC);

-- Replace the launcher placeholder created by 0002_seed.sql with the
-- integrated Tasks app for existing installations as well as fresh ones.
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
  'app_2',
  'Tasks',
  '/tasks',
  '期限・優先度・進捗をまとめて管理',
  4,
  '/icons/tasks.svg',
  1,
  '["productivity"]',
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

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS task_restrictions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  duration_value INTEGER NOT NULL CHECK (duration_value > 0),
  duration_unit TEXT NOT NULL CHECK (duration_unit IN ('days', 'months', 'years')),
  release_date TEXT NOT NULL,
  notification_dismissed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_restrictions_owner_release
  ON task_restrictions(owner_id, release_date, notification_dismissed_at);

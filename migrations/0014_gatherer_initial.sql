PRAGMA foreign_keys = ON;

-- Gatherer is stored in the shared owner namespace.  The legacy Gatherer
-- database is migrated into these prefixed tables by the cutover script.
CREATE TABLE IF NOT EXISTS gatherer_sources (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('rss', 'json_api', 'github_releases', 'html', 'tavily')),
  endpoint TEXT NOT NULL,
  title TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gatherer_rules (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES gatherer_sources(id) ON DELETE CASCADE,
  include_keywords TEXT NOT NULL DEFAULT '[]',
  exclude_keywords TEXT NOT NULL DEFAULT '[]',
  regex TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gatherer_items (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES gatherer_sources(id) ON DELETE CASCADE,
  rule_id TEXT REFERENCES gatherer_rules(id) ON DELETE SET NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  published_at INTEGER,
  day_key TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (source_id, external_id)
);

CREATE TABLE IF NOT EXISTS gatherer_item_states (
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES gatherer_items(id) ON DELETE CASCADE,
  read INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, item_id)
);

CREATE TABLE IF NOT EXISTS gatherer_fetch_runs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  ran_at INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('scheduled', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'fail')),
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  reused_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  credits_used REAL NOT NULL DEFAULT 0,
  failures_json TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS gatherer_tasks (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gatherer_task_logs (
  task_id TEXT NOT NULL REFERENCES gatherer_tasks(id) ON DELETE CASCADE,
  day_key TEXT NOT NULL,
  count REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (task_id, day_key)
);

CREATE INDEX IF NOT EXISTS idx_gatherer_sources_owner_updated
  ON gatherer_sources(owner_id, updated_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gatherer_rules_source_created
  ON gatherer_rules(source_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_gatherer_items_owner_day
  ON gatherer_items(owner_id, day_key, score DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_gatherer_item_states_owner_read
  ON gatherer_item_states(owner_id, read, item_id);
CREATE INDEX IF NOT EXISTS idx_gatherer_fetch_runs_owner_ran
  ON gatherer_fetch_runs(owner_id, ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_gatherer_tasks_owner_created
  ON gatherer_tasks(owner_id, enabled, created_at ASC);

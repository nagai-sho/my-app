PRAGMA foreign_keys = ON;

-- collection-appのメタデータを共通のowner名前空間へ統合する。
-- 原本とサムネイルのR2キーは、既存データ移行時にそのまま保持する。
CREATE TABLE IF NOT EXISTS collection_documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'pdf')),
  folder_path TEXT NOT NULL DEFAULT '',
  page_count INTEGER NOT NULL DEFAULT 1,
  bytes INTEGER NOT NULL DEFAULT 0,
  mime TEXT NOT NULL,
  source_created_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  original_r2_key TEXT NOT NULL,
  thumbnail_r2_key TEXT,
  legacy_original_r2_key TEXT,
  legacy_thumbnail_r2_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collection_folders (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_path TEXT NOT NULL DEFAULT '',
  manual_order_enabled INTEGER NOT NULL DEFAULT 0 CHECK (manual_order_enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, path)
);

CREATE INDEX IF NOT EXISTS idx_collection_documents_owner_folder_order
  ON collection_documents(owner_id, folder_path, sort_order, source_created_at, created_at);

CREATE INDEX IF NOT EXISTS idx_collection_documents_owner_title
  ON collection_documents(owner_id, title);

CREATE INDEX IF NOT EXISTS idx_collection_folders_owner_path
  ON collection_folders(owner_id, path);

PRAGMA foreign_keys = ON;

-- arch-draft-app owns its tables and R2 key namespace while using my-app's
-- existing D1 database and dedicated ARCH_DRAFT_R2 binding.
CREATE TABLE IF NOT EXISTS arch_draft_files (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('source', 'converted', 'template')),
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  ext TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  r2_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS arch_draft_templates (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  template_file_id TEXT NOT NULL REFERENCES arch_draft_files(id),
  variables_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS arch_draft_drawings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  template_id TEXT REFERENCES arch_draft_templates(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS arch_draft_versions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  drawing_id TEXT NOT NULL REFERENCES arch_draft_drawings(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  source_file_id TEXT NOT NULL REFERENCES arch_draft_files(id),
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  UNIQUE (drawing_id, version_no)
);

CREATE TABLE IF NOT EXISTS arch_draft_jobs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  drawing_version_id TEXT NOT NULL REFERENCES arch_draft_versions(id) ON DELETE CASCADE,
  target_format TEXT NOT NULL CHECK (target_format IN ('dxf')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
  output_file_id TEXT REFERENCES arch_draft_files(id),
  error_message TEXT,
  converter_mode TEXT NOT NULL DEFAULT 'mock',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_arch_draft_files_owner_created
  ON arch_draft_files(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arch_draft_templates_owner_updated
  ON arch_draft_templates(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_arch_draft_drawings_owner_updated
  ON arch_draft_drawings(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_arch_draft_versions_drawing
  ON arch_draft_versions(drawing_id, version_no DESC);
CREATE INDEX IF NOT EXISTS idx_arch_draft_jobs_version_status
  ON arch_draft_jobs(drawing_version_id, status, updated_at DESC);

INSERT INTO apps (
  id, name, url, description, category, sort_order, icon_url, pinned, tags, created_at, updated_at
)
VALUES (
  'arch-draft-app',
  '図面ドラフト',
  '/arch-draft-app',
  '図面テンプレートとバージョンを管理',
  'integrated',
  60,
  NULL,
  0,
  '["design","cad"]',
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

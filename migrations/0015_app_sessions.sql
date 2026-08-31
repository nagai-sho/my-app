PRAGMA foreign_keys = ON;

-- All login methods issue the same HttpOnly session cookie. The old
-- admin_sessions table remains in migration history but is no longer used.
CREATE TABLE IF NOT EXISTS app_sessions (
  id_hash TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at
  ON app_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_app_sessions_owner_id
  ON app_sessions(owner_id);

ALTER TABLE folders ADD COLUMN userId TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE cards ADD COLUMN userId TEXT NOT NULL DEFAULT 'legacy';

CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(userId);
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(userId);

INSERT OR IGNORE INTO folders (id, name, parentId, createdAt, userId)
VALUES ('root', 'トップ', NULL, '1970-01-01T00:00:00.000Z', 'system');

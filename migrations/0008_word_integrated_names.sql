ALTER TABLE folders RENAME TO word_folders;
ALTER TABLE cards RENAME TO word_cards;
ALTER TABLE oauth_states RENAME TO app_oauth_states;
ALTER TABLE word_folders RENAME COLUMN userId TO owner_id;
ALTER TABLE word_cards RENAME COLUMN userId TO owner_id;

UPDATE word_folders SET owner_id = 'owner';
UPDATE word_cards SET owner_id = 'owner';

DROP INDEX IF EXISTS idx_cards_folder_id;
DROP INDEX IF EXISTS idx_cards_status;
DROP INDEX IF EXISTS idx_cards_user_id;
DROP INDEX IF EXISTS idx_folders_parent_id;
DROP INDEX IF EXISTS idx_folders_user_id;
DROP INDEX IF EXISTS idx_oauth_states_state_hash;
DROP INDEX IF EXISTS idx_oauth_states_expires_at;

CREATE INDEX IF NOT EXISTS idx_word_cards_folder_id ON word_cards(folderId);
CREATE INDEX IF NOT EXISTS idx_word_cards_status ON word_cards(status);
CREATE INDEX IF NOT EXISTS idx_word_cards_owner_id ON word_cards(owner_id);
CREATE INDEX IF NOT EXISTS idx_word_folders_parent_id ON word_folders(parentId);
CREATE INDEX IF NOT EXISTS idx_word_folders_owner_id ON word_folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_app_oauth_states_state_hash ON app_oauth_states(state_hash);
CREATE INDEX IF NOT EXISTS idx_app_oauth_states_expires_at ON app_oauth_states(expires_at);

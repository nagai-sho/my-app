PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parentId TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  frontText TEXT NOT NULL,
  backText TEXT NOT NULL,
  folderId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (folderId) REFERENCES folders(id)
);

CREATE INDEX IF NOT EXISTS idx_cards_folder_id ON cards(folderId);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parentId);

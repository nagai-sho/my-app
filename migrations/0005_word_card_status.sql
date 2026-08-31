ALTER TABLE cards ADD COLUMN status TEXT NOT NULL DEFAULT 'new';

CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);

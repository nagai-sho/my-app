PRAGMA foreign_keys = ON;

-- Cashbook data uses the shared owner namespace. The existing word migration
-- already owns app_oauth_states, so Cashbook keeps a separate transient state
-- table with its Gmail-specific callback contract.
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE,
  email TEXT,
  display_name TEXT,
  picture_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_users (id, created_at, updated_at)
VALUES ('owner', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS cashbook_categories (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES cashbook_categories(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, parent_id, name)
);

CREATE TABLE IF NOT EXISTS cashbook_merchants (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, name)
);

CREATE TABLE IF NOT EXISTS cashbook_transactions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  occurred_at TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  category_id TEXT NOT NULL REFERENCES cashbook_categories(id),
  memo TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  merchant_id TEXT REFERENCES cashbook_merchants(id),
  is_credit_card INTEGER NOT NULL DEFAULT 0 CHECK (is_credit_card IN (0, 1))
);

CREATE TABLE IF NOT EXISTS cashbook_settings (
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(owner_id, key)
);

CREATE TABLE IF NOT EXISTS cashbook_gmail_tokens (
  owner_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  user_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at INTEGER NOT NULL,
  scope TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cashbook_oauth_states (
  state_hash TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cashbook_categories_owner_kind
  ON cashbook_categories(owner_id, kind, parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_cashbook_merchants_owner_name
  ON cashbook_merchants(owner_id, name);
CREATE INDEX IF NOT EXISTS idx_cashbook_transactions_owner_occurred_at
  ON cashbook_transactions(owner_id, occurred_at DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cashbook_transactions_owner_category
  ON cashbook_transactions(owner_id, category_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_transactions_owner_merchant
  ON cashbook_transactions(owner_id, merchant_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_oauth_states_expires_at
  ON cashbook_oauth_states(expires_at);

INSERT OR IGNORE INTO cashbook_categories (id, owner_id, parent_id, kind, name, sort_order)
VALUES
  ('income', 'owner', NULL, 'income', '収入', 10),
  ('income-salary', 'owner', 'income', 'income', '給与', 10),
  ('income-other', 'owner', 'income', 'income', 'その他', 20),
  ('expense-food', 'owner', NULL, 'expense', '食費', 10),
  ('expense-food-eatout', 'owner', 'expense-food', 'expense', '外食', 10),
  ('expense-food-cooking', 'owner', 'expense-food', 'expense', '自炊', 20),
  ('expense-food-cafe', 'owner', 'expense-food', 'expense', 'カフェ', 30),
  ('expense-home', 'owner', NULL, 'expense', '住居', 20),
  ('expense-home-rent', 'owner', 'expense-home', 'expense', '家賃', 10),
  ('expense-home-supplies', 'owner', 'expense-home', 'expense', '備品', 20),
  ('expense-utilities', 'owner', NULL, 'expense', '光熱', 30),
  ('expense-utilities-electric', 'owner', 'expense-utilities', 'expense', '電気', 10),
  ('expense-utilities-gas', 'owner', 'expense-utilities', 'expense', 'ガス', 20),
  ('expense-utilities-water', 'owner', 'expense-utilities', 'expense', '水道', 30),
  ('expense-communication', 'owner', NULL, 'expense', '通信', 40),
  ('expense-communication-mobile', 'owner', 'expense-communication', 'expense', '携帯', 10),
  ('expense-communication-internet', 'owner', 'expense-communication', 'expense', 'ネット', 20),
  ('expense-transport', 'owner', NULL, 'expense', '交通', 50),
  ('expense-transport-train', 'owner', 'expense-transport', 'expense', '電車', 10),
  ('expense-transport-taxi', 'owner', 'expense-transport', 'expense', 'タクシー', 20),
  ('expense-social', 'owner', NULL, 'expense', '交際', 60),
  ('expense-social-meal', 'owner', 'expense-social', 'expense', '会食', 10),
  ('expense-social-gift', 'owner', 'expense-social', 'expense', '贈答', 20),
  ('expense-medical', 'owner', NULL, 'expense', '医療', 70),
  ('expense-medical-hospital', 'owner', 'expense-medical', 'expense', '病院', 10),
  ('expense-education', 'owner', NULL, 'expense', '教養', 80),
  ('expense-education-book', 'owner', 'expense-education', 'expense', '書籍', 10),
  ('expense-daily', 'owner', NULL, 'expense', '日用品', 90),
  ('expense-daily-supplies', 'owner', 'expense-daily', 'expense', '消耗品', 10),
  ('expense-subscription', 'owner', NULL, 'expense', 'サブスク', 100),
  ('expense-subscription-app', 'owner', 'expense-subscription', 'expense', 'アプリ', 10),
  ('expense-tax', 'owner', NULL, 'expense', '税金', 110),
  ('expense-tax-local', 'owner', 'expense-tax', 'expense', '住民税', 10),
  ('expense-other', 'owner', NULL, 'expense', 'その他', 120),
  ('expense-other-misc', 'owner', 'expense-other', 'expense', '雑費', 10),
  ('expense-payment', 'owner', NULL, 'expense', '支払い', 130),
  ('expense-payment-credit-card', 'owner', 'expense-payment', 'expense', 'クレジットカード', 10);

CREATE VIEW IF NOT EXISTS cashbook_monthly_summary AS
SELECT
  t.owner_id,
  strftime('%Y-%m', datetime(t.occurred_at, '+9 hours')) AS year_month,
  COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount ELSE 0 END), 0) AS income,
  COALESCE(SUM(CASE WHEN t.kind = 'expense' AND t.category_id != 'expense-payment-credit-card' THEN t.amount ELSE 0 END), 0) AS expense,
  COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount WHEN t.is_credit_card = 1 THEN 0 ELSE -t.amount END), 0) AS net
FROM cashbook_transactions t
GROUP BY t.owner_id, strftime('%Y-%m', datetime(t.occurred_at, '+9 hours'));

CREATE VIEW IF NOT EXISTS cashbook_monthly_with_balance AS
SELECT
  owner_id,
  year_month,
  income,
  expense,
  net,
  SUM(net) OVER (
    PARTITION BY owner_id
    ORDER BY year_month
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS balance_cumulative
FROM cashbook_monthly_summary;

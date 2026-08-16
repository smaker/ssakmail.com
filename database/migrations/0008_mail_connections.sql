CREATE TABLE IF NOT EXISTS mail_connections (
  id TEXT PRIMARY KEY,
  account_key TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'imap')),
  provider_account_id TEXT NOT NULL,
  mailbox_address TEXT NOT NULL,
  display_name TEXT NOT NULL,
  credentials_encrypted TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(account_key, provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS mail_connections_account
  ON mail_connections(account_key, connected_at DESC);

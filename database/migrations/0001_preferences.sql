CREATE TABLE IF NOT EXISTS ai_consents (
  user_key TEXT PRIMARY KEY,
  policy_version TEXT NOT NULL,
  consented_at TEXT NOT NULL,
  withdrawn_at TEXT
);

CREATE TABLE IF NOT EXISTS preference_feedback (
  id TEXT PRIMARY KEY,
  user_key TEXT NOT NULL,
  message_key TEXT NOT NULL,
  vector_id TEXT,
  sender_key TEXT NOT NULL,
  domain_key TEXT NOT NULL,
  category TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('preferred', 'unwanted', 'kept', 'trashed', 'deleted')),
  weight INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS feedback_user_sender
  ON preference_feedback(user_key, sender_key, created_at DESC);

CREATE INDEX IF NOT EXISTS feedback_user_domain
  ON preference_feedback(user_key, domain_key, created_at DESC);

CREATE TABLE IF NOT EXISTS recommendation_events (
  id TEXT PRIMARY KEY,
  user_key TEXT NOT NULL,
  message_key TEXT NOT NULL,
  category TEXT NOT NULL,
  preference_score INTEGER NOT NULL CHECK (preference_score BETWEEN 0 AND 100),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source TEXT NOT NULL CHECK (source IN ('ai', 'rules')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS recommendations_user_created
  ON recommendation_events(user_key, created_at DESC);

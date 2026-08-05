CREATE TABLE IF NOT EXISTS auto_organize_settings (
  user_key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  confidence_threshold INTEGER NOT NULL DEFAULT 70 CHECK (confidence_threshold BETWEEN 50 AND 100 AND confidence_threshold % 5 = 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auto_organize_exclusions (
  user_key TEXT NOT NULL,
  message_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_key, message_key)
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY,
  user_key TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED')),
  paid_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS payments_user_status ON payments (user_key, status);

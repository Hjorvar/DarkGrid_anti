-- 013_production_blaze_hardening.sql: Production Blaze upgrade schema additions
-- 1. Link Firebase Auth UIDs to local SQLite user accounts
ALTER TABLE users ADD COLUMN firebase_uid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid
  ON users(firebase_uid)
  WHERE firebase_uid IS NOT NULL;

-- 2. Persistent server-side session storage (survives container restarts & cold starts)
CREATE TABLE IF NOT EXISTS user_sessions (
  sid TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  sess TEXT NOT NULL CHECK (json_valid(sess)),
  expire INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions(expire);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);

-- 3. Idempotency log to prevent duplicate purchases, combat actions, loot, or rewards on network retries
CREATE TABLE IF NOT EXISTS action_idempotency_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  redirect_url TEXT,
  response_body TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_created ON action_idempotency_log(created_at);

-- 4. Durable sync & maintenance metadata
CREATE TABLE IF NOT EXISTS world_sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO world_sync_meta(key, value) VALUES
  ('revision', '0'),
  ('maintenance_mode', '0');

-- 5. Database-level monotonic state triggers (preventing stale-state resurrection or double payout)
CREATE TRIGGER IF NOT EXISTS enforce_permadeath_irreversible
BEFORE UPDATE OF is_alive ON characters
WHEN OLD.is_alive = 0 AND NEW.is_alive != 0
BEGIN
  SELECT RAISE(ABORT, 'Permadeath is final: a fallen character cannot be resurrected.');
END;

CREATE TRIGGER IF NOT EXISTS enforce_defeated_monster_irreversible
BEFORE UPDATE OF status ON monster_instances
WHEN OLD.status = 'DEFEATED' AND NEW.status != 'DEFEATED'
BEGIN
  SELECT RAISE(ABORT, 'Defeated persistent monster cannot be resurrected.');
END;

CREATE TRIGGER IF NOT EXISTS enforce_sold_listing_irreversible
BEFORE UPDATE OF status ON market_listings
WHEN OLD.status IN ('SOLD', 'CANCELLED') AND NEW.status = 'ACTIVE'
BEGIN
  SELECT RAISE(ABORT, 'Completed market listing cannot be reactivated.');
END;

CREATE TRIGGER IF NOT EXISTS enforce_completed_bounty_irreversible
BEFORE UPDATE OF status ON hunting_contracts
WHEN OLD.status IN ('COMPLETED', 'ABANDONED', 'FAILED') AND NEW.status IN ('AVAILABLE', 'ACTIVE', 'READY_TO_CLAIM')
BEGIN
  SELECT RAISE(ABORT, 'Concluded hunting contract cannot be reopened.');
END;

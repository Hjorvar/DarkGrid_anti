-- 012_watcher_board_bounties.sql: Add hunting_contracts table for The Watcher's Board and link encounters to character-specific bounty targets

CREATE TABLE IF NOT EXISTS hunting_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  base_monster_id INTEGER NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
  custom_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  region_name TEXT NOT NULL,
  target_terrain TEXT NOT NULL,
  threat_label TEXT NOT NULL DEFAULT 'Dangerous',
  boost_type TEXT NOT NULL CHECK(boost_type IN ('TOUGH', 'AGGRESSIVE', 'BRUTAL')),
  boost_label TEXT NOT NULL,
  boosted_max_hp INTEGER NOT NULL,
  attack_bonus_mod INTEGER NOT NULL DEFAULT 0,
  damage_bonus_mod INTEGER NOT NULL DEFAULT 0,
  reward_gold INTEGER NOT NULL CHECK(reward_gold > 0),
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE', 'ACTIVE', 'READY_TO_CLAIM', 'COMPLETED', 'ABANDONED', 'FAILED')),
  created_at_level INTEGER NOT NULL DEFAULT 1,
  created_at_encounters INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  claimed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_hunting_contracts_character_status
  ON hunting_contracts(character_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hunting_contracts_one_active_per_char
  ON hunting_contracts(character_id)
  WHERE status IN ('ACTIVE', 'READY_TO_CLAIM');

ALTER TABLE encounters ADD COLUMN bounty_contract_id INTEGER REFERENCES hunting_contracts(id);

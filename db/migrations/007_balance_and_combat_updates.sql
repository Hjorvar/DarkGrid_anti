-- 007_balance_and_combat_updates.sql: Schema updates for Primary Weapon preference and Ranger Opening Shot
-- Part of approved balance and combat updates

-- 1. Primary weapon preference for characters (MELEE or RANGED)
ALTER TABLE characters ADD COLUMN primary_weapon TEXT NOT NULL DEFAULT 'MELEE' CHECK (primary_weapon IN ('MELEE', 'RANGED'));

-- 2. Encounter ambush and stealth tracking
ALTER TABLE encounters ADD COLUMN spotted_by_hero INTEGER NOT NULL DEFAULT 1;
ALTER TABLE encounters ADD COLUMN is_ambush INTEGER NOT NULL DEFAULT 0;

-- 3. Ranger Opening Shot idempotency tracker
ALTER TABLE encounters ADD COLUMN opening_shot_resolved INTEGER NOT NULL DEFAULT 0;

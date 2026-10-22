# DARKGRID — PHASE 7A: FRESH START & DATA MIGRATION STRATEGY

## 1. Strategic Objective

When Darkgrid transitions to the unified `action-ui-lab/` adventure experience and **Balance V2** in Phase 7B/7C, all players must begin on a **level playing field with newly created Level-1 characters** in an uncorrupted world—**without** losing their user accounts, authentication credentials, or the historical record of fallen heroes in the Hall of the Fallen.

> [!IMPORTANT]
> **Phase 7A Safety Compliance:** This document is an architectural specification only. No database files, characters, accounts, or tables have been modified during Phase 7A.

---

## 2. Entity-by-Entity Disposition Matrix

We classify every SQLite table across `db/migrations/001..013` and `action-ui-lab/server/services/sandbox-db-service.js` into **four strict handling categories**:
1. **`PRESERVE_INTACT`** — Never delete or reset (accounts, auth, schema history).
2. **`ARCHIVE_AS_LEGACY_HISTORY`** — Preserve fallen character memorials (`is_alive = 0`), retire living pre-V2 characters into an honored *"Era I Veteran / Retired"* state so `one_living_character_per_user` is freed for a fresh Level 1 character.
3. **`RESET_AND_CLEAR`** — Clear active world/economy state that would contaminate Balance V2 (persistent monsters, global resale market listings, old inventories, active encounters, bounty contracts, lab adventure state).
4. **`RESEED_V2_DEFINITIONS`** — Update static catalog tables (`monsters`, `monster_terrains`, `item_definitions`, `loot_tables`, `loot_table_entries`, `map_tiles`, `game_config`) to Balance V2 values.

| Table Name | Schema Source | Fresh Start Action | Detailed Handling Rule |
| :--- | :--- | :---: | :--- |
| **`users`** | `001_initial_schema.sql`, `013_production_blaze_hardening.sql` | **`PRESERVE_INTACT`** | Keep all `id`, `username`, `password_hash`, `firebase_uid`, and `created_at` rows 100% untouched. |
| **`user_sessions`** | `013_production_blaze_hardening.sql` | **`PRESERVE_INTACT`** | Keep active login sessions so users do not get unexpectedly logged out during the Fresh Start cutover. |
| **`schema_migrations` & `schema_seeds`** | `src/db/migrate.js` | **`PRESERVE_INTACT`** | Keep existing migration history and append `014_phase7b_balance_v2_and_fresh_start.sql`. |
| **`characters` (`is_alive = 0`)** | `001_initial_schema.sql` | **`ARCHIVE_AS_LEGACY_HISTORY`** | Preserve all fallen heroes (`is_alive = 0`, `died_at`, `level`, `xp`, `class`, `name`, `killed_by_monster_instance_id`) for the Hall of the Fallen (`character_history` view). Add column `era INTEGER NOT NULL DEFAULT 1` so Era 1 memorials are badged as *"First Age Fallen"*. |
| **`characters` (`is_alive = 1`)** | `001_initial_schema.sql` | **`ARCHIVE_AS_LEGACY_HISTORY` (Retire to Hall of Legends)** | Because trigger `enforce_permadeath_irreversible` (`013_production_blaze_hardening.sql:49`) allows `is_alive: 1 -> 0` (and blocks `0 -> 1`) and index `one_living_character_per_user` requires `is_alive = 0` to allow creating a new character: set `is_alive = 0`, `era = 1`, `retirement_status = 'ERA_1_RETIRED'` (new nullable column), and `gold = 0` on all pre-V2 living characters. This preserves every player's old character in their account history while requiring every account to create a fresh **Era 2 Level-1 character**! |
| **`item_instances`** | `001_initial_schema.sql` | **`RESET_AND_CLEAR`** | `DELETE FROM item_instances;` (after `DELETE FROM market_listings;`). Clears all legacy character inventories, monster-held loot hoards, and market items so zero pre-V2 gear or gold enters Era 2. |
| **`market_listings`** | `001_initial_schema.sql` | **`RESET_AND_CLEAR`** | `DELETE FROM market_listings;` (Note: trigger `enforce_sold_listing_irreversible` only fires on `UPDATE OF status`, so `DELETE` is 100% permitted and clears the global resale market for a clean economy). |
| **`monster_instances`** | `001_initial_schema.sql` | **`ARCHIVE_AS_LEGACY_HISTORY` & Clear Active** | Set `status = 'DEFEATED'`, `held_gold = 0`, `defeated_at = CURRENT_TIMESTAMP` on all `'ACTIVE'` rows (permitted by trigger `enforce_defeated_monster_irreversible`, which only blocks `DEFEATED -> ACTIVE`). Preserves historical foreign keys from `characters.killed_by_monster_instance_id` for Hall of the Fallen memorials while ensuring **zero active persistent monsters** exist on the map at Fresh Start! |
| **`encounters` & `combat_events`** | `001_initial_schema.sql` | **`ARCHIVE_AS_LEGACY_HISTORY`** | Update any open encounters (`status IN ('DISCOVERED', 'IN_COMBAT')`) to `'ESCAPED'`. Preserve historical `combat_events` linked to fallen characters' final battles (`src/routes/game.js:269-276`). |
| **`hunting_contracts`** | `012_watcher_board_bounties.sql` | **`RESET_AND_CLEAR`** | `DELETE FROM hunting_contracts;` (Clears all Era 1 Watcher's Board contracts so fresh Era 2 characters generate V2 contracts). |
| **`lab_adventure_state` & `lab_travel_continuity_state`** | `action-ui-lab/adventure-engine.js:655-700` | **`RESET_AND_CLEAR`** | `DELETE FROM lab_adventure_state; DELETE FROM lab_travel_continuity_state;` and clear in-memory `scopedAdventureMaps` / `scopedContinuityMaps`. |
| **`action_idempotency_log`** | `013_production_blaze_hardening.sql` | **`RESET_AND_CLEAR`** | `DELETE FROM action_idempotency_log;` |

---

## 3. Pre-Cutover Backup & Atomic Execution Protocol

### 3.1 Mandatory Pre-Migration Snapshot
Before executing the Fresh Start migration in Phase 7B/7C:
1. Enable maintenance mode in `world_sync_meta` (`UPDATE world_sync_meta SET value = '1' WHERE key = 'maintenance_mode'`).
2. Perform a hot SQLite backup (`VACUUM INTO 'data/backups/darkgrid_pre_era2_YYYYMMDD_HHMMSS.sqlite'`) and verify checksum + row counts of `users` and `characters`.

### 3.2 Trigger-Safe Atomic SQL Execution Order
Because `013_production_blaze_hardening.sql` installed 4 monotonic `BEFORE UPDATE` triggers (`enforce_permadeath_irreversible`, `enforce_defeated_monster_irreversible`, `enforce_sold_listing_irreversible`, `enforce_completed_bounty_irreversible`) and foreign keys (`PRAGMA foreign_keys = ON`) are active, the Fresh Start migration **must** execute in the exact order below inside a single transaction:

```sql
-- 1. Add Era & Retirement tracking columns to characters
ALTER TABLE characters ADD COLUMN era INTEGER NOT NULL DEFAULT 1;
ALTER TABLE characters ADD COLUMN retirement_reason TEXT;

-- 2. Conclude any open encounters before retiring living characters
UPDATE encounters
SET status = 'ESCAPED', updated_at = CURRENT_TIMESTAMP
WHERE status IN ('DISCOVERED', 'IN_COMBAT');

-- 3. Clear active bounty contracts
DELETE FROM hunting_contracts;

-- 4. Clear global resale market listings and all item instances (inventories & monster hoards)
DELETE FROM market_listings;
DELETE FROM item_instances;

-- 5. Retire all active persistent monsters (allowed by enforce_defeated_monster_irreversible: ACTIVE -> DEFEATED)
--    Retains rows so characters.killed_by_monster_instance_id foreign keys for fallen memorials remain valid!
UPDATE monster_instances
SET status = 'DEFEATED',
    held_gold = 0,
    defeated_at = COALESCE(defeated_at, CURRENT_TIMESTAMP)
WHERE status = 'ACTIVE';

-- 6. Retire all Era 1 living characters into the Hall of Legends (allowed by enforce_permadeath_irreversible: 1 -> 0)
--    Frees the unique index `one_living_character_per_user` so every user account starts Era 2 at Level 1!
UPDATE characters
SET is_alive = 0,
    gold = 0,
    era = 1,
    retirement_reason = 'RETIRED_FOR_ERA_2_FRESH_START',
    died_at = COALESCE(died_at, CURRENT_TIMESTAMP)
WHERE is_alive = 1;

-- 7. Clear lab adventure & travel continuity tables (if present)
DELETE FROM lab_adventure_state WHERE 1 = 1;
DELETE FROM lab_travel_continuity_state WHERE 1 = 1;
DELETE FROM action_idempotency_log WHERE 1 = 1;

-- 8. Increment world_sync_meta revision and record Era 2 epoch
INSERT OR REPLACE INTO game_config (key, value, description)
VALUES ('current_era', '2', 'Darkgrid Balance V2 Fresh Start Era');
```

---

## 4. Verification Invariants After Fresh Start Execution

A Fresh Start verification script must assert all 7 post-cutover invariants before disabling maintenance mode:
1. `SELECT COUNT(*) FROM users` === pre-migration user count (`100%` account preservation).
2. `SELECT COUNT(*) FROM characters WHERE is_alive = 1` === `0` (all accounts ready for fresh Level 1 character creation).
3. `SELECT COUNT(*) FROM characters WHERE is_alive = 0 AND era = 1` === total pre-migration characters (both fallen memorials and retired Era 1 veterans preserved).
4. `SELECT COUNT(*) FROM monster_instances WHERE status = 'ACTIVE'` === `0` (world map 100% clear of persistent monsters).
5. `SELECT COUNT(*) FROM item_instances` === `0` and `SELECT COUNT(*) FROM market_listings` === `0` (economy 100% clean).
6. `SELECT COUNT(*) FROM hunting_contracts` === `0` (bounty board clean).
7. Creating a new character for an existing user account succeeds at Level 1 (`era = 2`, `xp = 0`, `gold = 25` [V2 starter gold], at Oakhaven `(7,7)`).

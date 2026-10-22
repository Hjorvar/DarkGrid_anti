# DARKGRID — PHASE 6: DATABASE & PERSISTENCE COMPATIBILITY

**Date:** 2026-10-22  
**Scope:** SQLite schema verification, non-destructive adapter strategy, referential integrity, and production safety guarantees.

---

## 1. Compatibility Strategy

Phase 6 follows a **strictly non-destructive, additive adapter strategy** (`ensureNonDestructiveLabAdapter` in `action-ui-lab/server/services/legacy-compatibility-service.js`). It operates directly on any database created by Darkgrid's canonical migrations (`db/migrations/001_initial.sql` through `004_phase4_depth_and_bounties.sql`) without dropping, resetting, or altering any existing legacy columns or records.

### 1.1 Verified Legacy Tables (14/14 Present)
All 14 core tables are verified via `GET /api/legacy-audit` (`verifyLegacyDatabaseCompatibility`):
1. `users` (`id`, `username`, `password_hash`, `created_at`)
2. `user_sessions` (`sid`, `user_id`, `sess`, `expire`, `updated_at`)
3. `action_idempotency_log` (`id`, `user_id`, `idempotency_key`, `method`, `path`, `status_code`, `redirect_url`, `response_body`, `created_at`)
4. `map_tiles` (`225` tiles on the 15×15 grid)
5. `terrain_artworks` (terrain and landmark artwork mappings)
6. `monsters` (`98` canonical monsters with CR, subtypes, damage dice, 9 health bracket descriptions, and special abilities)
7. `characters` (all canonical attributes, class, level, XP, gold, HP, `favored_enemy_type`, `favored_enemy_subtype`, `cleric_heal_uses`, `primary_weapon`, `killed_by_monster_instance_id`, `died_at`)
8. `item_definitions` (`29` canonical weapons, armor, shields, potions, and magical accessories)
9. `item_instances` (character and persistent-monster owned items with `equipped_slot` and `modifications` JSON)
10. `encounters` (`DISCOVERED`, `IN_COMBAT`, `VICTORY`, `DEFEAT`, `ESCAPED`, `IGNORED`)
11. `combat_events` (round-by-round narrative and structured event log)
12. `monster_instances` (persistent hero-slayer monsters with `+10%` max HP, `held_gold`, `kill_count`, `custom_title`)
13. `market_listings` (Shared Global Magical Resale Market listings with `AVAILABLE` / `SOLD` status and `resale_price`)
14. `hunting_contracts` (Watcher's Board contracts with `AVAILABLE`, `ACTIVE`, `READY_TO_CLAIM`, `COMPLETED`, `ABANDONED`, `FAILED`)

---

## 2. Additive Non-Destructive Schema Extensions

When `ensureNonDestructiveLabAdapter(db)` connects to a Darkgrid SQLite database, it checks `PRAGMA table_info(characters)` and applies only the following idempotent additions if not already present:

| Target | Additive Change | Purpose | Impact on Legacy Game |
|---|---|---|---|
| `characters.facing` | `TEXT NOT NULL DEFAULT 'NORTH'` | Persists 4-way first-person compass orientation (`NORTH`, `EAST`, `SOUTH`, `WEST`) | Ignored by legacy SSR app; safe default `'NORTH'` |
| `characters.pending_victory_encounter_id` | `INTEGER DEFAULT NULL` | Persists post-combat Victory banner across reloads until player steps forward or dismisses | Ignored by legacy SSR app; safe default `NULL` |
| `characters.scene_mode` | `TEXT NOT NULL DEFAULT 'C'` | Persists POV scene mode (`A`, `B`, `C`, `LEGACY`) | Ignored by legacy SSR app; safe default `'C'` |
| `trg_cleanup_market_listings_before_item_delete` | `BEFORE DELETE ON item_instances` trigger | Deletes historical `market_listings` rows referencing an `item_instance_id` before that item instance is destroyed during permadeath's 50% item destruction roll | Prevents `FOREIGN KEY constraint failed` during permadeath if a hero dies carrying a previously purchased resale relic |
| `scene_catalog` tables | `CREATE TABLE IF NOT EXISTS ...` | Stores read-only multi-variant POV scene catalog metadata | Completely independent of legacy tables |

---

## 3. Data Integrity & Safety Verification

- **Foreign Key Integrity:** `PRAGMA foreign_keys = ON` and `PRAGMA foreign_key_check` verified at `0` violations across the full lifecycle (registration, character creation, combat, market resale consignment/purchase, bounty completion, permadeath, and avenging).
- **Atomic Transactions:** All multi-step state mutations (`createCharacter`, `executeCombatRound`, `handlePlayerDeath`, `handleMonsterDefeat`, `buyItem`, `sellItem`, `acceptContract`, `autoClaimCompletedBounties`) execute inside `withTransaction(db, ...)` (`BEGIN IMMEDIATE ... COMMIT / ROLLBACK`).
- **Concurrency & WAL Mode:** `PRAGMA journal_mode = WAL` and `PRAGMA busy_timeout = 5000` are enforced on initialization.
- **Zero Production Data Touch:** Phase 6 tests run exclusively against isolated SQLite files (`action-ui-lab/data/test_phase6_legacy_integration.sqlite` and temporary OS directories), leaving production records and the legacy application untouched.

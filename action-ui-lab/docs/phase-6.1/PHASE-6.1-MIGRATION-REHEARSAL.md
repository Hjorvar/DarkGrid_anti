# DARKGRID — PHASE 6.1: PRODUCTION MIGRATION REHEARSAL & ROLLBACK GUIDE

**Date:** 2026-10-22  
**Branch:** `darkgrid_legacy_integration`  
**Scope:** Isolated Rehearsal of Legacy Database Upgrade, Data Retention, Integrity Verification, Gameplay Validation, and Rollback

---

## 1. Rehearsal Methodology (Zero Production Data Modification)

In compliance with Phase 6.1 rules, **no production database was modified**. First, an isolated synthetic legacy database was constructed and populated using the canonical `db/migrations/001_initial_schema.sql..013_production_blaze_hardening.sql` (13 migrations) and `db/seeds/001_seed_world.sql..010_seed_night_work_loot_and_30_monsters.sql` (10 seeds) scripts via `src/db/migrate.js`, then populated with representative legacy player state:
1. **Living Hero (`Sir Galen of Oakhaven`, ID `101`):** Level 4 Fighter, `6,500 XP`, `145 gp`, `34/38 HP`, positioned at wilderness tile `(7,6)` with equipped starter weapon in `item_instances`.
2. **Fallen Hero (`Lyra the Lost`, ID `102`):** Level 2 Ranger (`is_alive = 0`), slain at `(7,4)` by a persistent monster (`killed_by_monster_instance_id = 501`).
3. **Active Persistent Monster (`Bloodfang the Wolf`, ID `501`):** `22/22 HP`, `held_gold = 35` at tile `(7,4)` in `monster_instances`.
4. **Historical Encounter & Combat Event (`encounter_id = 901`):** Recorded event in `encounters` and `combat_events`.

*(Additionally, in Phase 6.2, isolated non-production copies of the actual legacy databases `data/darkgrid.sqlite`, `data/darkgrid.sqlite.backup-session-2-clean`, and `db/backups/production-backup-latest.json` were rehearsed end-to-end without touching the original files; see [`../phase-6.2/PHASE-6.2-SOURCE-OF-TRUTH-REPORT.md`](../phase-6.2/PHASE-6.2-SOURCE-OF-TRUTH-REPORT.md).)*

---

## 2. Step-by-Step Rehearsal Execution & Verification Results

The automated rehearsal (`action-ui-lab/tests/phase-6-1-hardening.test.js` — Test 6) executed the following sequence:

### Step 1: Pre-Cutover Backup & Checksum Verification
- Copied the legacy database to a rehearsal backup file (`test_phase6_1_legacy_backup.sqlite`) and computed SHA-256 hashes of both files:
  - `sha256(legacy_source) === sha256(legacy_backup)` verified (`100%` byte-for-byte match).

### Step 2: Run Adventure Lab Compatibility Adapter in Production Mode
- Mounted `createLabApp({ dbPath: TEST_MIGRATION_COPY_PATH, production: true, requireAuth: true, sessionSecret: '...' })` and `ensureNonDestructiveLabAdapter(rehearsalDb)`.
- Verified `ensureNonDestructiveLabAdapter(db)` added the optional Adventure Lab columns (`facing`, `pending_victory_encounter_id`, `scene_mode`), `user_sessions`, `action_idempotency_log`, `trg_cleanup_market_listings_before_item_delete`, and `initSceneCatalogTables(db)` (`scene_variants`, `tile_directional_overrides`) idempotently without modifying any canonical columns or rows.
- Verified `preserveExistingMap: true` preserved all 4 canonical wilderness tiles (`(6,5)`, `(8,6)`, `(8,8)`, `(9,7)`) and `seedSandboxHero: false` prevented any `action_hero` user or synthetic character from being inserted.

### Step 3: Database Integrity & Foreign Key Validation
- Executed `verifyLegacyDatabaseCompatibility(rehearsalDb)` and SQLite `PRAGMA` checks:
  - `PRAGMA integrity_check` $\rightarrow$ **`ok`**
  - `PRAGMA foreign_key_check` $\rightarrow$ **`0` violations**
  - Missing canonical tables $\rightarrow$ **`[]` (none)**
  - Missing character columns $\rightarrow$ **`[]` (none)**

### Step 4: 100% Legacy Data Retention Verification
- Verified `Sir Galen of Oakhaven` (`id = 101`) retained `level = 4`, `xp = 6500`, `gold = 145`, `current_hp = 34`, `tile_id = (7,6)`, `is_alive = 1`, and equipped `item_instances` row.
- Verified `Lyra the Lost` (`id = 102`) retained `is_alive = 0` and `killed_by_monster_instance_id = 501`.
- Verified persistent monster `Bloodfang the Wolf` (`id = 501`) retained `current_hp = 22` and `held_gold = 35` at `(7,4)`.
- Verified historical `encounters` (`id = 901`) and `combat_events` rows remained intact.

### Step 5: Backup Restore & Rollback Verification
- Restored `test_phase6_1_legacy_backup.sqlite` over the migrated database file and verified:
  - `sha256(post_rollback_db) === sha256(pre_migration_db)` (**exact cryptographic match**).

---

## 3. Production Cutover & Rollback Runbook

### 3.1 Pre-Cutover Backup Procedure
```bash
# 1. Stop application writes (or put maintenance banner up)
# 2. Flush WAL and create an atomic SQLite backup + SHA-256 checksum
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);"
cp -p "$DB_PATH" "${DB_PATH}.pre-cutover-$(date +%Y%m%d-%H%M%S).bak"
sha256sum "$DB_PATH" "${DB_PATH}".pre-cutover-*.bak > "${DB_PATH}.pre-cutover.sha256"
```

### 3.2 Cutover Startup Verification
Ensure environment variables are set before launching:
- `NODE_ENV=production`
- `SESSION_SECRET=<cryptographically-random-secret-at-least-32-chars>`
- `DB_PATH=<path-to-sqlite-db>`

### 3.3 Instant Rollback Procedure
Because `ensureNonDestructiveLabAdapter(db)` only adds defaulted/nullable columns (`facing`, `pending_victory_encounter_id`, `scene_mode`) to `characters` and leaves all 14 canonical tables (`users`, `user_sessions`, `action_idempotency_log`, `map_tiles`, `terrain_artworks`, `monsters`, `characters`, `item_definitions`, `item_instances`, `encounters`, `combat_events`, `monster_instances`, `market_listings`, `hunting_contracts`) 100% compatible with `src/`:
1. **Option A (Keep Post-Cutover Gameplay Progress):** Switch the process back to the legacy entrypoint (`node src/server.js`). The legacy EJS application ignores the extra `characters` columns and continues operating with all player progress intact.
2. **Option B (Full Point-in-Time Database Restore):**
   ```bash
   # Stop server process
   rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"
   cp -p "${DB_PATH}.pre-cutover-<timestamp>.bak" "$DB_PATH"
   sha256sum -c "${DB_PATH}.pre-cutover.sha256"
   # Restart legacy server process
   ```

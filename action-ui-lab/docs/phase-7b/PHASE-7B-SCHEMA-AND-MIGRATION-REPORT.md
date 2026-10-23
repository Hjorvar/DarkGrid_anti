# DARKGRID — PHASE 7B: SCHEMA AND MIGRATION REPORT

**Date:** 2026-10-22  
**Migration File:** [`db/migrations/014_phase7b_taxonomy_attributes_and_battle_experience.sql`](../../../db/migrations/014_phase7b_taxonomy_attributes_and_battle_experience.sql)  
**Migration Runner:** [`src/db/migrate.js`](../../../src/db/migrate.js)  
**Legacy Compatibility Adapter:** [`action-ui-lab/server/services/legacy-compatibility-service.js`](../../server/services/legacy-compatibility-service.js)

---

## 1. Schema Changes Overview

Migration `014_phase7b_taxonomy_attributes_and_battle_experience.sql` introduces the following schema additions safely and non-destructively:

### 1.1 `monsters` Table
- `monster_family TEXT NOT NULL DEFAULT 'ANIMALS'`
- Index: `CREATE INDEX IF NOT EXISTS idx_monsters_family ON monsters(monster_family);`
- **Deterministic Post-Migration & Post-Seed Backfill:**
  - Both `014_phase7b_taxonomy_attributes_and_battle_experience.sql` (by `LOWER(name)` and `creature_type` / `creature_subtype`) and `runMigrations()` in [`src/db/migrate.js`](../../../src/db/migrate.js) invoke `backfillMonsterTaxonomyInDb(db)` so that all 98 monsters receive their exact 22-family classification regardless of whether seeds run before or after migration `014`.

### 1.2 `characters` Table
- `attribute_points INTEGER NOT NULL DEFAULT 0` — Tracks unspent permanent attribute points awarded at milestone levels (`2, 4, 6, 8, 10`).
- `initial_attributes_json TEXT DEFAULT NULL` — Stores the character's Level 1 point-buy allocation (`{"strength":...}`) for auditability and lifetime point-buy invariant verification.
- `favored_enemy_family TEXT DEFAULT NULL` — Stores the canonical 22-family key for Rangers (while preserving `favored_enemy_type` and `favored_enemy_subtype` for backward compatibility with existing Rangers).
- **Legacy Ranger Backfill:** Existing Rangers with `favored_enemy_family IS NULL` are automatically mapped from their legacy `favored_enemy_type` / `favored_enemy_subtype` to the corresponding canonical family key (`GOBLINOIDS`, `ORCS`, `GNOLLS`, `REPTILIAN_HUMANOIDS`, `ANIMALS`, `TERRESTRIAL_MAGICAL_BEASTS`, `DANGEROUS_PLANTS`, `VERMIN_INSECTS`, `DRAGONS_DRAKES`, `GIANTS`, `FEY`, `ABERRATIONS`, `OOZES`, `CONSTRUCTS`).

### 1.3 `character_monster_knowledge` Table
```sql
CREATE TABLE IF NOT EXISTS character_monster_knowledge (
  character_id INTEGER NOT NULL,
  monster_id INTEGER NOT NULL,
  encounters INTEGER NOT NULL DEFAULT 0,
  victories INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_fought_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (character_id, monster_id),
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  FOREIGN KEY (monster_id) REFERENCES monsters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cmk_character ON character_monster_knowledge(character_id);
CREATE INDEX IF NOT EXISTS idx_cmk_monster ON character_monster_knowledge(monster_id);
```
- **Historical Encounter Backfill:** Existing `VICTORY`, `IN_COMBAT`, `ESCAPED`, and `DEFEAT` rows in `encounters` are aggregated into `character_monster_knowledge` using `INSERT OR IGNORE` so existing heroes retain credit for their past combat history. Stage 1 (`DISCOVERED` / `IGNORED`) encounters are strictly excluded.

### 1.4 `encounters` Table
- `second_wind_used INTEGER NOT NULL DEFAULT 0` — Tracks per-encounter Fighter Second Wind usage in SQLite alongside `combat_state_json.secondWindUsed`.

---

## 2. Idempotency & Legacy Database Safety

1. **Duplicate-Column Tolerance:** [`src/db/migrate.js`](../../../src/db/migrate.js) handles `duplicate column name` errors gracefully when applying migrations to databases that already had columns added by `ensureNonDestructiveLabAdapter`.
2. **Legacy Audit Verification (`/api/legacy-audit`):** [`verifyLegacyDatabaseCompatibility`](../../server/services/legacy-compatibility-service.js) verifies the presence of `favored_enemy_family`, `attribute_points`, `initial_attributes_json`, `character_monster_knowledge`, and `monsters.monster_family` with zero foreign-key violations (`foreignKeyViolations === 0`).

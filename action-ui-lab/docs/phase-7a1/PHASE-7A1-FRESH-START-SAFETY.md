# DARKGRID — PHASE 7A.1: SAFE FRESH START & ERA MIGRATION SPECIFICATION

> **Execution Constraint (§9):** **DO NOT EXECUTE ANY MIGRATION OR RESET DURING PHASE 7A.1.**
> This document specifies the corrected, data-safe Era 1 $\to$ Era 2 migration architecture for future implementation in Phase 7B after owner approval (`OD-7A1-05`).

---

## 1. Critical Flaws in the Phase 7A Fresh Start Strategy (Finding C3)

Phase 7A ([PHASE-7A-FRESH-START-STRATEGY.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a/PHASE-7A-FRESH-START-STRATEGY.md#L74-L80)) proposed retiring living characters with:
```sql
UPDATE characters SET is_alive = 0, died_at = COALESCE(died_at, CURRENT_TIMESTAMP);
DELETE FROM item_instances;
```
Our technical audit identified **four severe hazards** in that SQL:
1. **Hall of the Fallen Corruption:** [db/migrations/001_initial_schema.sql](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/db/migrations/001_initial_schema.sql#L191-L194) defines `CREATE VIEW character_history AS SELECT ... FROM characters c WHERE c.is_alive = 0;`, and [src/routes/game.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/routes/game.js#L244-L265) (`GET /game/fallen`) displays every row from `character_history` as a fallen casualty (`"Slain in the Wilds"` on `died_at`). Setting `is_alive = 0` and assigning `died_at` falsely lists every retired survivor as killed in action!
2. **Irreversible Permadeath Trigger Lock:** [db/migrations/013_production_blaze_hardening.sql](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/db/migrations/013_production_blaze_hardening.sql#L49-L54) enforces:
   ```sql
   CREATE TRIGGER enforce_permadeath_irreversible
   BEFORE UPDATE ON characters
   WHEN OLD.is_alive = 0 AND NEW.is_alive = 1
   BEGIN
     SELECT RAISE(ABORT, 'Permadeath is irreversible');
   END;
   ```
   Once `is_alive` is flipped to `0`, no SQL `UPDATE` can ever restore `is_alive = 1` without dropping the trigger or restoring the database file.
3. **Destruction of Historical Hero Panoply:** Executing `DELETE FROM item_instances;` deletes all equipped weapons and armor belonging to retired Era 1 veterans (`owner_type = 'CHARACTER'`), erasing their hard-won historical gear record.
4. **Phase 6.2 Archive Table Name Collision (Finding L3):** Commit `b459d99` (Phase 6/6.1) already introduced a `characters_legacy_v1_archive` table in `action-ui-lab`. Using the same table name in Phase 7B without namespace separation risks schema collisions.

---

## 2. Redesigned Three-State Character Lifecycle Model (`ALIVE`, `FALLEN`, `RETIRED`)

### 2.1 State Definitions & Invariants

| Lifecycle Status (`lifecycle_status`) | `is_alive` | `died_at` | `retired_at` | Meaning & UI Visibility |
| :--- | :---: | :---: | :---: | :--- |
| **`'ALIVE'`** | `1` | `NULL` | `NULL` | Active playable character in the current Era (`era = 2`). Enforced at max 1 per `user_id` via `idx_one_living_character_per_user`. |
| **`'FALLEN'`** | `0` | `<ISO Timestamp>` | `NULL` | Character who died in combat (permadeath). Displayed in the **Hall of the Fallen (`character_history`)** alongside their killer monster and epitaph. |
| **`'RETIRED'`** | `0` | `NULL` | `<ISO Timestamp>` | Character honorably retired intact during an Era transition (`retirement_reason = 'ERA_1_VETERAN_HONORABLE_RETIREMENT'`). **Excluded** from the *Hall of the Fallen*; displayed in the **Hall of Legends / Era I Archives (`retired_veterans_history`)** with their preserved level, stats, and equipped panoply. |

---

### 2.2 Compatibility Verification Matrix (§9 Requirement)

| System / Constraint | Existing Implementation | Compatibility with `ALIVE` / `FALLEN` / `RETIRED` Model |
| :--- | :--- | :--- |
| **One-Living-Character Constraint** | `CREATE UNIQUE INDEX idx_one_living_character_per_user ON characters(user_id) WHERE is_alive = 1;` (`001_initial_schema.sql:46`) | **100% Compatible.** Retired characters have `is_alive = 0` and `lifecycle_status = 'RETIRED'`, freeing the user's `is_alive = 1` slot to create a new Era 2 hero while keeping all historical rows in `characters`. |
| **Permadeath Trigger** | `enforce_permadeath_irreversible` (`013_production_blaze_hardening.sql:49-54`) | **100% Compatible.** Transitioning `'ALIVE'` (`is_alive = 1`) $\to$ `'RETIRED'` (`is_alive = 0`) is permitted by the trigger. In addition, we add trigger `enforce_fallen_vs_retired_integrity` so a `'FALLEN'` character can never be altered to `'RETIRED'` and `died_at` remains `NULL` for `'RETIRED'` heroes. |
| **Permadeath Combat Engine** | `handlePlayerDeath` ([src/domain/monsters/persistence.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/monsters/persistence.js#L155-L158)) | Update `handlePlayerDeath` to set `is_alive = 0, lifecycle_status = 'FALLEN', died_at = CURRENT_TIMESTAMP`. |
| **Hall of the Fallen (`character_history` View & `/game/fallen`)** | `CREATE VIEW character_history AS SELECT ... FROM characters c WHERE c.is_alive = 0;` (`001_initial_schema.sql:191`) | Recreate `character_history` with `WHERE c.is_alive = 0 AND c.lifecycle_status = 'FALLEN'`. Retired heroes will **never** appear as battle casualties. |
| **Hall of Legends (`retired_veterans_history` View)** | *New View* | `CREATE VIEW retired_veterans_history AS SELECT ... FROM characters c WHERE c.lifecycle_status = 'RETIRED';` so players can view their retired Era 1 heroes and equipped items. |
| **Inventory & Economy Isolation** | `item_instances` (`owner_type IN ('CHARACTER', 'MONSTER', 'MARKET')`) | Delete **only** `owner_type IN ('MONSTER', 'MARKET')` and unequipped consumables during Era transition. Preserve equipped `item_instances` owned by `'RETIRED'` and `'FALLEN'` characters (`owner_type = 'CHARACTER'`); because retired characters cannot log into active gameplay (`getLivingCharacterByUserId` checks `WHERE user_id = ? AND is_alive = 1`), their archived items can never leak into the Era 2 economy! |
| **Authentication & Session State** | `getLivingCharacterByUserId(db, userId)` ([src/domain/character/rules.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js#L492)) | Queries `WHERE user_id = ? AND is_alive = 1`. When an Era 1 user logs in after retirement, `getLivingCharacterByUserId` cleanly returns `null`, routing them to the **New Era II Hero Creation** screen with a banner honoring their retired Era I veteran. |

---

## 3. Proposed Schema Migration Blueprint (`db/migrations/014_character_lifecycle_and_era2.sql`)

This migration adds the lifecycle columns and views **without retiring any characters automatically** (schema-only migration):

```sql
-- 1. Add lifecycle and era tracking columns to characters
ALTER TABLE characters ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'ALIVE'
  CHECK (lifecycle_status IN ('ALIVE', 'FALLEN', 'RETIRED'));
ALTER TABLE characters ADD COLUMN era INTEGER NOT NULL DEFAULT 1;
ALTER TABLE characters ADD COLUMN retired_at TEXT;
ALTER TABLE characters ADD COLUMN retirement_reason TEXT;
ALTER TABLE characters ADD COLUMN unspent_attribute_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN hunter_doctrine TEXT;
ALTER TABLE characters ADD COLUMN secondary_doctrine TEXT;
ALTER TABLE characters ADD COLUMN active_buff_json TEXT;

-- 2. Backfill existing fallen characters accurately
UPDATE characters
SET lifecycle_status = 'FALLEN'
WHERE is_alive = 0 AND lifecycle_status = 'ALIVE';

-- 3. Update character_history view so Hall of the Fallen ONLY shows battle deaths
DROP VIEW IF EXISTS character_history;
CREATE VIEW character_history AS
SELECT
    c.id AS character_id,
    c.user_id,
    c.name AS character_name,
    c.class,
    c.level,
    c.xp,
    c.era,
    c.lifecycle_status,
    c.created_at,
    c.died_at,
    mi.id AS killer_monster_instance_id,
    COALESCE(mi.custom_name, m.name) AS killed_by_monster_name
FROM characters c
LEFT JOIN encounters e ON e.character_id = c.id AND e.status = 'DEFEAT'
LEFT JOIN monster_instances mi ON e.monster_instance_id = mi.id
LEFT JOIN monsters m ON e.base_monster_id = m.id
WHERE c.is_alive = 0 AND c.lifecycle_status = 'FALLEN';

-- 4. Create dedicated view for Honorably Retired Era Veterans
DROP VIEW IF EXISTS retired_veterans_history;
CREATE VIEW retired_veterans_history AS
SELECT
    c.id AS character_id,
    c.user_id,
    c.name AS character_name,
    c.class,
    c.level,
    c.xp,
    c.gold,
    c.era,
    c.lifecycle_status,
    c.created_at,
    c.retired_at,
    c.retirement_reason
FROM characters c
WHERE c.lifecycle_status = 'RETIRED';
```

---

## 4. Controlled Era 1 $\to$ Era 2 Cutover Protocol (`scripts/era2-cutover.js`)

Unlike normal schema migrations (`npm run setup:db`), retiring living Era 1 characters **must never run automatically on server boot**. It must be isolated in an explicit operator CLI script (`scripts/era2-cutover.js`) protected by seven mandatory safeguards:

### 4.1 Seven-Step Data Safety & Cutover Sequence
1. **Environment & Operator Confirmation Guard:**
   - Refuses to run unless `--confirm-era2-cutover` CLI flag AND `DARKGRID_CONFIRM_ERA2_MIGRATION="I_APPROVE_ERA2_RETIREMENT"` environment variable are both provided.
   - Supports `--dry-run` mode (default), which opens a read-only/rollback transaction, prints exact counts of `users`, `ALIVE` characters to be retired, `FALLEN` characters preserved, and `item_instances` archived vs cleared, and exits with zero mutations.
2. **Pre-Migration Physical Backup & SHA-256 Verification:**
   - Uses SQLite `VACUUM INTO 'backups/darkgrid_pre_era2_<ISO_TIMESTAMP>.sqlite'` to create an atomic physical snapshot.
   - Computes and logs the SHA-256 checksum of the backup file and verifies `PRAGMA integrity_check` before starting the transaction.
3. **Immutable Snapshot Tables (`era1_characters_snapshot` & `era1_items_snapshot`):**
   - Copies all rows of `characters` into `era1_characters_snapshot` (distinct from Phase 6.1's `characters_legacy_v1_archive`) and all character-owned `item_instances` into `era1_items_snapshot`.
4. **Honorable Retirement of Living Era 1 Heroes:**
   ```sql
   UPDATE characters
   SET is_alive = 0,
       lifecycle_status = 'RETIRED',
       retired_at = CURRENT_TIMESTAMP,
       retirement_reason = 'ERA_1_VETERAN_HONORABLE_RETIREMENT'
   WHERE is_alive = 1 AND era = 1;
   ```
   *(Notice `died_at` remains `NULL`!)*
5. **Selective World & Market Reset (Preserving Historical Hero Panoply):**
   - Clears active world encounters (`DELETE FROM encounters WHERE status IN ('DISCOVERED', 'IN_COMBAT');`), active persistent monsters (`UPDATE monster_instances SET status = 'DEFEATED' WHERE status = 'ACTIVE';`), active bounties, and global market listings (`DELETE FROM market_listings;`).
   - Deletes only `item_instances` with `owner_type IN ('MONSTER', 'MARKET')`, **preserving** `owner_type = 'CHARACTER'` rows so retired and fallen Era 1 heroes retain their historical equipment record.
6. **Post-Transaction Invariant Verification (Inside Transaction Before `COMMIT`):**
   - Asserts `SELECT COUNT(*) FROM users` matches pre-cutover count (`100%` account preservation).
   - Asserts `SELECT COUNT(*) FROM character_history` matches pre-cutover `FALLEN` count (**zero** retired heroes leaked into Hall of the Fallen).
   - Asserts `SELECT COUNT(*) FROM retired_veterans_history` equals the exact count of pre-cutover living Era 1 heroes.
   - If any assertion fails, executes `ROLLBACK` and aborts with non-zero exit code.
7. **Verified Rollback Procedure:**
   - Because `enforce_permadeath_irreversible` prevents `UPDATE characters SET is_alive = 1 WHERE is_alive = 0`, rollback is performed by stopping the server, restoring the verified `backups/darkgrid_pre_era2_<ISO_TIMESTAMP>.sqlite` snapshot (and re-syncing the Firestore durable state snapshot if running on Cloud Run), and verifying the SHA-256 checksum.

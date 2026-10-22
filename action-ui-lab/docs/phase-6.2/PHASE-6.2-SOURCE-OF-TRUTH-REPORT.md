# Darkgrid — Phase 6.2: Final Source-of-Truth Verification Report

**Date:** 2026-04-20  
**Scope:** Independent Source-of-Truth Verification of Repository History, Running Code vs. Phase 6 / 6.1 Documentation, Canonical SQLite Schema & Domain Integration, Automated Test Suites, Real Legacy Database Migration Rehearsals, and Final Primary Working Directory Integration  
**Primary Working Directory:** `C:\Users\hih\Documents\antiDark\action-ui-lab` (Repository Root: `C:\Users\hih\Documents\antiDark`)  
**Target Branch:** `main`  
**Final Verdict:** **VERIFIED — READY FOR NEXT DEVELOPMENT PHASE**

---

## 1. Executive Summary & Final Verdict

Phase 6.1 previously reported `READY FOR PRODUCTION CUTOVER`, yet its written reports (`action-ui-lab/docs/phase-6.1/*.md`) contained several architectural claims that contradicted the earlier Phase 6 reports (`action-ui-lab/docs/phase-6/*.md`). Before proceeding to **Phase 7A (Balancing & Gameplay Progression)**, Phase 6.2 conducted a zero-trust, line-by-line verification of:

1. The actual Git commit graph across local `main`, `darkgrid_legacy_integration`, the verification worktree (`darkgrid_source_truth_verification`), and the GitHub remote (`origin/main`).
2. Every module imported and executed by the running Adventure Lab server (`action-ui-lab/server/*.js`) and canonical Darkgrid domain layer (`src/domain/**/*.js`, `src/db/*.js`, `db/migrations/*.sql`, `db/seeds/*.sql`).
3. Every contradiction between Phase 6 and Phase 6.1 documentation, determining which claims reflected the actual running code versus stale counts or LLM documentation hallucinations, and correcting all 11 affected reports in `action-ui-lab/docs/phase-6/` and `action-ui-lab/docs/phase-6.1/` without altering working application code.
4. End-to-end integration guarantees: canonical 14-table compatibility enforcement, non-destructive additive schema adaptation (`ensureNonDestructiveLabAdapter`), production authentication enforcement (`DARKGRID_AUTH_REQUIRED`), non-destructive character creation, complete blocking of unauthorized debug/reset/developer routes and combat overrides, and lossless backup/restore round-trips.
5. Full automated regression testing (`228 / 228` root Darkgrid tests + `130 / 130` Adventure Lab tests = **`358 / 358` passing tests**, `0` failures).
6. Three non-destructive migration rehearsals executed in isolated temporary directories (`os.tmpdir()`) against **actual legacy database files and production snapshots** (`data/darkgrid.sqlite`, `data/darkgrid.sqlite.backup-session-2-clean`, and `db/backups/production-backup-latest.json`), while verifying via SHA-256 checksums that no live/workspace database files were modified.
7. Clean integration of all verified Phase 6, Phase 6.1, and Phase 6.2 work into the primary working directory (`C:\Users\hih\Documents\antiDark\action-ui-lab` on branch `main`), re-execution of the complete regression suites from the primary working directory, and fast-forward synchronization with GitHub (`origin/main`).

### Final Verdict

> **VERIFIED — READY FOR NEXT DEVELOPMENT PHASE**

*(Note: Per Phase 6.2 instructions, no production deployment or live database cutover was performed.)*

---

## 2. Repository & Commit Verification (Section 1)

### 2.1 Pre-Verification Repository State

An inspection of the Git repository, worktrees, and remote (`https://github.com/Hjorvar/DarkGrid_anti.git`) established the exact commit topology prior to Phase 6.2 documentation commits:

| Reference / Location | Pre-Phase-6.2 Commit SHA | Status / Relationship |
| :--- | :--- | :--- |
| **Phase 6 + Phase 6.1 Implementation Commit** | `b459d993890ada1e4bcb08a7da7de1ac3ab5c31c` | `feat(action-ui-lab): complete Phase 6 legacy integration and Phase 6.1 pre-cutover security and UX hardening` |
| **Primary Working Directory (`C:\Users\hih\Documents\antiDark`, branch `main`)** | `b459d993890ada1e4bcb08a7da7de1ac3ab5c31c` | Contained all Phase 6 and Phase 6.1 code and tests; clean working tree |
| **Branch `darkgrid_legacy_integration`** | `b459d993890ada1e4bcb08a7da7de1ac3ab5c31c` | Identical commit SHA to local `main` (`0` divergence) |
| **GitHub Remote (`origin/main` before Phase 6.2 push)** | `bb0dddc913bb1cc2e1ea9ac6058c3b0dc7f84766` | 7 commits behind local `main` (ancestor of `b459d993890ada1e4bcb08a7da7de1ac3ab5c31c`, eligible for fast-forward push) |

### 2.2 Commit Lineage Leading to Phase 6.1 (`bb0dddc..b459d99`)

All 7 commits between pre-push `origin/main` (`bb0dddc913bb1cc2e1ea9ac6058c3b0dc7f84766`) and local `main` (`b459d993890ada1e4bcb08a7da7de1ac3ab5c31c`) were verified as linear ancestors on `main`:

1. `ffdc6c2` — `feat: complete Phase 1-3 Action UI Lab foundation, scene catalog, and tests`
2. `0bf2588` — `feat(action-ui-lab): complete Phase 3.1 stabilization and independent QA audit`
3. `03e948c` — `feat(action-ui-lab): complete Phase 4 monster scaling, combat artwork integration, and QA`
4. `c5646f3` — `feat(action-ui-lab): complete Phase 4.1 monster visual framing and dark fantasy atmosphere`
5. `c539ac2` — `feat(action-ui-lab): complete Phase 4.2 player-facing UI refinement and compact HUD`
6. `e41bb08` — `feat(action-ui-lab): complete Phase 5 world exploration, city hub, and progression loop`
7. `b459d99` (`b459d993890ada1e4bcb08a7da7de1ac3ab5c31c`) — `feat(action-ui-lab): complete Phase 6 legacy integration and Phase 6.1 pre-cutover security and UX hardening`

### 2.3 Post-Verification Integrated State (Section 7)

Following Phase 6.2 verification, all documentation corrections and this Source-of-Truth report were committed, fast-forward merged into `main` in the primary working directory (`C:\Users\hih\Documents\antiDark`), verified with full regression tests from the primary directory, and fast-forward pushed to `origin/main`.

- **Primary Working Directory:** `C:\Users\hih\Documents\antiDark` (`C:\Users\hih\Documents\antiDark\action-ui-lab`)
- **Active Branch:** `main`
- **Phase 6 + 6.1 Implementation SHA:** `b459d993890ada1e4bcb08a7da7de1ac3ab5c31c`
- **Phase 6.2 Documentation Reconciliation SHA:** `7dd090960fa68908d82bd69c17def3a0cd01bf37`
- **Synchronization:** `local main` === `origin/main` === `darkgrid_legacy_integration` (fast-forward synchronized, `0` uncommitted or unpushed changes).

---

## 3. Resolution of Documentation Contradictions (Section 2)

### 3.1 Root-Cause Analysis: Why Phase 6 and Phase 6.1 Reports Contradicted Each Other

An audit of the actual codebase against `action-ui-lab/docs/phase-6/*.md` and `action-ui-lab/docs/phase-6.1/*.md` proved that **there was no code divergence or split architecture**. Both Phase 6 and Phase 6.1 were built and tested on the exact same codebase (`b459d993890ada1e4bcb08a7da7de1ac3ab5c31c`).

Instead, the contradictions arose strictly from **documentation inaccuracies**:
1. **Phase 6.1 Documentation Hallucinations:** Several Phase 6.1 reports (`PHASE-6.1-INDEPENDENT-AUDIT.md`, `PHASE-6.1-SECURITY-REVIEW.md`, `PHASE-6.1-FIX-REPORT.md`, `PHASE-6.1-MIGRATION-REHEARSAL.md`, `PHASE-6.1-REGRESSION-RESULTS.md`) guessed or paraphrased module paths (`src/domain/auth/index.js`), hashing algorithms (`scrypt`), table names (`character_items`, `world_tiles`, `bounty_contracts`, `items`, `shop_inventory`), helper function names (`ensureAdventureLabSchemaCompatibility`, `createSandboxDb`), and migration counts (`001..009`) without cross-checking the actual imports in `action-ui-lab/server/` or `src/domain/`. Additionally, a synthetic test fixture in `action-ui-lab/tests/phase-6-1-hardening.test.js` (line 555) used the literal placeholder string `'scrypt:salt:hash'` in a direct `INSERT INTO users` statement testing SQLite foreign-key cascades, which further misled the Phase 6.1 report text.
2. **Phase 6 Stale Seed & Migration Counts:** Phase 6 reports (`PHASE-6-DATABASE-COMPATIBILITY.md`, `PHASE-6-REGRESSION-RESULTS.md`, `PHASE-6-SUCCESSOR-READINESS.md`, `PHASE-6-SUMMARY.md`) accurately named the real domain modules (`src/domain/auth/service.js`), `bcryptjs` hashing, and canonical SQLite tables (`item_instances`, `map_tiles`, `hunting_contracts`), but cited an outdated pre-seed-`007` item definition count (`29` instead of `113`), an incomplete migration/seed range (`001..004` instead of `001..013` and `001..010`), and summarized test suite filenames in prose rather than listing the 10 actual `action-ui-lab/tests/*.test.js` files.

### 3.2 Complete Contradiction & Ground-Truth Resolution Matrix

| Architectural Topic | Phase 6 Doc Claim | Phase 6.1 Doc Claim | Actual Running Code (Ground Truth) | Diagnosis & Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication Module & Password Hashing** | `bcryptjs` (`10` salt rounds, `$2a$`/`$2b$`) in `src/domain/auth/service.js` + Firebase `'firebase-auth'` sentinel bridge | `scrypt` password hashing via `src/domain/auth/index.js` | **`src/domain/auth/service.js`** uses **`bcryptjs`** (`SALT_ROUNDS = 10`, `bcrypt.hash` / `bcrypt.compare`) + `'firebase-auth'` sentinel upgrade path (`src/firebase/token-verifier.js`). `src/domain/auth/index.js` does **not** exist; `node:crypto` `scrypt` is never imported anywhere in the repo. | **Phase 6 was right; Phase 6.1 was a doc hallucination.** Corrected `PHASE-6.1-INDEPENDENT-AUDIT.md`, `PHASE-6.1-FIX-REPORT.md`, and `PHASE-6.1-SECURITY-REVIEW.md`. |
| **Domain Service Module Paths** | `src/domain/auth/service.js`, `src/domain/character/rules.js`, `src/domain/economy/shop.js`, `src/domain/bounties/board.js`, `src/domain/combat/engine.js` (`rules.js`, `loot.js`, `victory.js`, `abilities.js`), `src/domain/encounters/engine.js`, `src/domain/monsters/persistence.js`, `src/domain/world/map.js` (`artwork.js`) | `src/domain/auth/index.js`, `src/domain/character/index.js`, `src/domain/combat/index.js`, `src/domain/equipment/index.js`, `src/domain/market/index.js`, `src/domain/bounties/index.js`, `src/domain/world/index.js` | **`action-ui-lab/server/services/world-progression-service.js`**, **`combat-session-service.js`**, and **`auth-session-service.js`** import the exact file paths listed by Phase 6. None of the `index.js`, `equipment/`, or `market/` paths exist in `src/domain/`. | **Phase 6 was right; Phase 6.1 was a doc hallucination.** Corrected `PHASE-6.1-INDEPENDENT-AUDIT.md` and `PHASE-6.1-FIX-REPORT.md`. |
| **Canonical SQLite Table Names** | `users`, `characters`, `monsters`, `monster_instances`, `item_definitions`, `item_instances`, `map_tiles`, `terrain_artworks`, `encounters`, `combat_events`, `market_listings`, `hunting_contracts`, `user_sessions`, `action_idempotency_log` | `items`, `character_items`, `shop_inventory`, `world_tiles`, `bounty_contracts` | **`REQUIRED_LEGACY_TABLES`** in `action-ui-lab/server/services/legacy-compatibility-service.js` enforces the exact **14 canonical tables** listed by Phase 6 (plus supporting tables `game_config`, `monster_terrains`, `loot_tables`, `loot_table_entries`, `world_sync_meta`, `schema_migrations`, `schema_seeds`, and Lab catalog tables `scene_variants`, `tile_directional_overrides`). None of the 5 Phase 6.1 table names exist. | **Phase 6 was right; Phase 6.1 was a doc hallucination.** Corrected `PHASE-6.1-INDEPENDENT-AUDIT.md` and `PHASE-6.1-MIGRATION-REHEARSAL.md`. |
| **Canonical Seed Counts (`monsters` & `item_definitions`)** | `98` monsters and `29` item definitions | `98` monsters and `113` item definitions (`PHASE-6.1-MIGRATION-REHEARSAL.md`) | **`98` `monsters`** (`002`, `006`, `008`, `010`), **`113` `item_definitions`** (`29` in `003_seed_items.sql` + `84` in `007_seed_expanded_armory.sql`), **`225` `map_tiles`** (`15×15`), **`7` `terrain_artworks`**, **`88` `loot_tables`**, **`212` `loot_table_entries`**. | **Phase 6 had a stale pre-seed-007 item count (`29`); actual is `113`.** Corrected all Phase 6 docs (`PHASE-6-DATABASE-COMPATIBILITY.md`, `PHASE-6-REGRESSION-RESULTS.md`, `PHASE-6-SUCCESSOR-READINESS.md`, `PHASE-6-SUMMARY.md`). |
| **SQLite Migrations & Seeds Executed by `src/db/migrate.js`** | Described migrations/seeds as `001..004` in prose | Described migrations as `db/migrations/001..009` in `PHASE-6.1-INDEPENDENT-AUDIT.md` | **`src/db/migrate.js`** (`runMigrations` / `runSeeds`) dynamically executes all **13 SQL migrations** (`001_initial_schema.sql` .. `013_production_blaze_hardening.sql`) in `db/migrations/` and all **10 SQL seeds** (`001_seed_world.sql` .. `010_seed_night_work_loot_and_30_monsters.sql`) in `db/seeds/`, plus `reconcileLegacySeeds(db)`. | **Both Phase 6 and Phase 6.1 understated the migration/seed count in prose.** Corrected both Phase 6 and Phase 6.1 documentation to list all 13 migrations and 10 seeds. |
| **Non-Destructive Schema Adapter Function Name** | `ensureNonDestructiveLabAdapter(db)` in `legacy-compatibility-service.js` and `initSandboxDb()` in `sandbox-db-service.js` | `ensureAdventureLabSchemaCompatibility(db)` and `createSandboxDb()` in `PHASE-6.1-INDEPENDENT-AUDIT.md` / `PHASE-6.1-MIGRATION-REHEARSAL.md` | Actual exported functions are **`ensureNonDestructiveLabAdapter(db)`** (`action-ui-lab/server/services/legacy-compatibility-service.js`) and **`initSandboxDb(options)`** (`action-ui-lab/server/services/sandbox-db-service.js`). | **Phase 6 was right; Phase 6.1 used paraphrased function names.** Corrected `PHASE-6.1-INDEPENDENT-AUDIT.md` and `PHASE-6.1-MIGRATION-REHEARSAL.md`. |
| **Combat Override Isolation Flag** | `options.allowDebugOverrides` (server-internal option, never populated from HTTP routes) | Mentioned `allowDebugOverrides` as a request payload property in `PHASE-6.1-INDEPENDENT-AUDIT.md` / `PHASE-6.1-SECURITY-REVIEW.md` | `executeLabTurn(db, characterId, actionPayload = {}, options = {})` in `combat-session-service.js` only reads **`options.allowDebugOverrides === true`** from the internal 4th parameter `options`. `action-ui-lab/server/routes/api.js` calls `executeLabTurn(db, characterId, req.body || {})` without passing `options`, making client-supplied `monsterHpOverride` / `forceMonsterAttackRoll` / `forceSaveRoll` / `forceAttackRoll` completely inert over HTTP. | Clarified exact signature and enforcement mechanism in `PHASE-6.1-INDEPENDENT-AUDIT.md` and `PHASE-6.1-SECURITY-REVIEW.md`. |
| **Adventure Lab Test Suite Inventory** | Summarized 3 conceptual groups totaling `123` tests (prior to adding 7 tests in `phase-6-1-hardening.test.js`) | Listed 9 fabricated/misnamed test filenames in `PHASE-6.1-REGRESSION-RESULTS.md` totaling `130` tests | Actual `action-ui-lab/tests/*.test.js` comprises **10 test files** totaling **`130` tests**: `action-lab.test.js` (`32`), `independent-qa.test.js` (`17`), `monster-artwork.test.js` (`5`), `monster-integration.test.js` (`8`), `monster-scaling.test.js` (`11`), `phase-5-world.test.js` (`10`), `phase-6-1-hardening.test.js` (`7`), `phase-6-legacy-integration.test.js` (`11`), `player-ui.test.js` (`13`), `world-travel.test.js` (`16`). | Corrected test file tables in `PHASE-6-REGRESSION-RESULTS.md`, `PHASE-6-SUMMARY.md`, `PHASE-6.1-REGRESSION-RESULTS.md`, and `PHASE-6.1-CUTOVER-RECOMMENDATION.md`. |

### 3.3 Documentation Files Corrected in Phase 6.2

All 11 affected documentation files were updated in place to align 100% with the running code:

- `action-ui-lab/docs/phase-6/PHASE-6-DATABASE-COMPATIBILITY.md`
- `action-ui-lab/docs/phase-6/PHASE-6-REGRESSION-RESULTS.md`
- `action-ui-lab/docs/phase-6/PHASE-6-SUCCESSOR-READINESS.md`
- `action-ui-lab/docs/phase-6/PHASE-6-SUMMARY.md`
- `action-ui-lab/docs/phase-6.1/PHASE-6.1-CUTOVER-RECOMMENDATION.md`
- `action-ui-lab/docs/phase-6.1/PHASE-6.1-FIX-REPORT.md`
- `action-ui-lab/docs/phase-6.1/PHASE-6.1-INDEPENDENT-AUDIT.md`
- `action-ui-lab/docs/phase-6.1/PHASE-6.1-MIGRATION-REHEARSAL.md`
- `action-ui-lab/docs/phase-6.1/PHASE-6.1-REGRESSION-RESULTS.md`
- `action-ui-lab/docs/phase-6.1/PHASE-6.1-SECURITY-REVIEW.md`
- `action-ui-lab/docs/phase-6.1/PHASE-6.1-UI-REVIEW.md`

---

## 4. Verification of Real Codebase Integration & Security Controls (Section 3)

Each requirement in Section 3 of the Phase 6.2 specification was independently verified against the active source code and runtime behavior:

### 4.1 Uses the Actual Canonical Darkgrid SQLite Schema
- **`action-ui-lab/server/services/sandbox-db-service.js`** (`initSandboxDb`) invokes `runMigrations(db)` and `runSeeds(db)` from `src/db/migrate.js`, applying all 13 canonical SQL migrations (`db/migrations/001..013`) and 10 canonical SQL seeds (`db/seeds/001..010`), followed by `ensureNonDestructiveLabAdapter(db)`.
- **`action-ui-lab/server/services/legacy-compatibility-service.js`** (`inspectLegacySchemaCompatibility`) verifies the presence of all 14 `REQUIRED_LEGACY_TABLES`, checks all required columns on `characters` (`facing`, `pending_victory_encounter_id`, `scene_mode`), runs `PRAGMA foreign_key_check`, and confirms `compatible === true` and `foreignKeyViolations === 0`.

### 4.2 Preserves Users, Characters, Equipment, Progress, Encounters, and World State
- `ensureNonDestructiveLabAdapter(db)` uses strictly additive `ALTER TABLE characters ADD COLUMN ...` statements (only when missing) and `CREATE TABLE IF NOT EXISTS` / `CREATE TRIGGER IF NOT EXISTS`. It never drops, truncates, or overwrites existing rows.
- **`action-ui-lab/server/services/world-progression-service.js`** (`buildClientState`) queries the user's living character (`WHERE user_id = ? AND is_alive = 1 ORDER BY id DESC LIMIT 1`), preserves existing `item_instances` (`equipped_slot`, durability, plus-bonuses), `hunting_contracts`, active `encounters`, `combat_events`, `monster_instances` (persistent world bosses/monsters with kill counts and loot), and `map_tiles`.
- When an active encounter exists (`encounters.ended_at IS NULL`) or a victory screen is pending (`characters.pending_victory_encounter_id`), `resolveSceneMode` automatically restores the player into `COMBAT` mode without losing turn state.

### 4.3 Requires Authentication in Production
- **`action-ui-lab/server/services/auth-session-service.js`** (`isAuthRequired`) returns `true` whenever `process.env.DARKGRID_AUTH_REQUIRED === '1'`, `'true'`, or `process.env.NODE_ENV === 'production'`.
- When authentication is required, `resolveRequestContext(db, req, res)` never falls back to a sandbox character (`characterId: null`), and `requireCharacterContext` in `action-ui-lab/server/routes/api.js` rejects all unauthenticated `/api/game/*`, `/api/world/*`, and `/api/combat/*` requests with **HTTP `401`** (`code: 'AUTH_REQUIRED'`).
- Sessions are backed by 256-bit random tokens (`crypto.randomBytes(32).toString('hex')`) stored in `user_sessions`, delivered via `HttpOnly; SameSite=Lax` cookies (`darkgrid_lab_sid`, plus `Secure` in production).

### 4.4 Has No Destructive Character Creation Path
- **`createCharacterForUser(db, userId, payload)`** in `auth-session-service.js` checks `getActiveCharacterForUser(db, userId)` first and throws `ACTIVE_CHARACTER_EXISTS` (`statusCode = 409`) if a living character already exists for that user.
- Deceased characters (`is_alive = 0`) remain intact in `characters`, `encounters`, and `combat_events` for the Fallen Hall (`getFallenCharactersForUser`), while the user can create a new Level 1 successor character with starter gear (`100` gold, `Rusty Dagger`, `Padded Armor`) at City Hub `(7, 7)`.
- `getOrCreatePlayerCharacter(db, userId)` in `world-progression-service.js` only creates a default character in local sandbox mode (`!userId`) when no living character exists (`WHERE is_alive = 1`), and never deletes or resets existing characters.

### 4.5 Blocks All Unauthorized Debug and Developer Actions
- **`isAdminToolsEnabled(req)`** in `auth-session-service.js` returns `false` whenever `NODE_ENV === 'production'` or `DARKGRID_ALLOW_DEBUG_RESET === '0'` / `'false'`. Even outside production, if authentication is enabled (`isAuthRequired()`), developer/admin tools require `DARKGRID_ALLOW_DEBUG_RESET === '1'` **and** an `x-darkgrid-admin-key` header matching `process.env.DARKGRID_ADMIN_KEY`.
- When `isAdminToolsEnabled(req)` is `false`:
  - `POST /api/combat/reset` returns **HTTP `403`** (`code: 'ADMIN_TOOLS_DISABLED'`).
  - `POST /api/world/debug` (`heal_full`, `grant_gold`, `grant_xp`, `teleport_city`, `spawn_test_encounter`, `reset_character`) returns **HTTP `403`** (`code: 'ADMIN_TOOLS_DISABLED'`).
  - All scene-catalog authoring/mutation routes (`POST /api/scenes/:id/variants`, `PUT /api/scenes/:id`, `POST /api/scenes/:id/approve`, `POST /api/scenes/:id/default`, `POST /api/tiles/overrides`, `DELETE /api/tiles/overrides`) return **HTTP `403`** (`code: 'ADMIN_TOOLS_DISABLED'`).
- In `combat-session-service.js` (`executeLabTurn`), deterministic test overrides (`monsterHpOverride`, `forceMonsterAttackRoll`, `forceSaveRoll`, `forceAttackRoll`) are gated behind `options.allowDebugOverrides === true` (a server-internal 4th parameter never passed by `routes/api.js`).

### 4.6 Restores a Legacy Database Backup Without Data Loss
- **`createDatabaseBackup(dbPath, options)`** and **`restoreDatabaseBackup(backupPath, targetDbPath)`** in `legacy-compatibility-service.js` perform full file-level SQLite backups with SHA-256 checksum verification (`sha256` before and after restore) and post-restore schema/FK inspection.
- Additionally, `src/db/production-safety.js` (`exportDynamicState`, `importDynamicState`, `verifySnapshotIntegrity`) supports full JSON + binary SQLite snapshot verification and dynamic-state restoration.

---

## 5. Automated Test Suite & Repository Verification (Section 4)

The complete automated test suites for both the canonical Darkgrid repository (`tests/*.test.js`) and the Adventure Lab application (`action-ui-lab/tests/*.test.js`) were executed on the verified codebase:

### 5.1 Root Canonical Darkgrid Test Suite (`npm test`)

- **Command:** `npm test` (`node --test --test-concurrency=1 tests/*.test.js`)
- **Result:** **`228 / 228` tests passing (`0` failures)** across **17 test files**:
  - `tests/admin-Security-and-Stats.test.js`
  - `tests/audit-Phase1-Verification.test.js`
  - `tests/auth.test.js`
  - `tests/bounties.test.js`
  - `tests/character.test.js`
  - `tests/combat.test.js`
  - `tests/e2e.test.js`
  - `tests/economy.test.js`
  - `tests/encounters.test.js`
  - `tests/firebase-auth.test.js`
  - `tests/integration.test.js`
  - `tests/loot.test.js`
  - `tests/Persistence-and-Permadeath.test.js`
  - `tests/production-Safety-and-Concurrency.test.js`
  - `tests/Session4-Stabilization.test.js`
  - `tests/Session5-Expansion.test.js`
  - `tests/world.test.js`

### 5.2 Adventure Lab Test Suite (`node --test --test-concurrency=2 action-ui-lab/tests/*.test.js`)

- **Command:** `node --test --test-concurrency=2 action-ui-lab/tests/*.test.js`
- **Result:** **`130 / 130` tests passing (`0` failures)** across **10 test files**:

| Test File | Passing | Failing | Coverage Focus |
| :--- | :---: | :---: | :--- |
| `action-ui-lab/tests/action-lab.test.js` | 32 | 0 | Core combat loop, scene catalog, directional overrides, visual regressions |
| `action-ui-lab/tests/independent-qa.test.js` | 17 | 0 | Independent QA edge cases, concurrency, error handling |
| `action-ui-lab/tests/monster-artwork.test.js` | 5 | 0 | Monster artwork asset validation (`98 / 98` monsters mapped to valid WebP assets) |
| `action-ui-lab/tests/monster-integration.test.js` | 8 | 0 | Monster encounter spawning, scaling, persistent monster instances |
| `action-ui-lab/tests/monster-scaling.test.js` | 11 | 0 | Silhouette sizing (`size_category`), distance bands, combat stage framing |
| `action-ui-lab/tests/phase-5-world.test.js` | 10 | 0 | City Hub (`(7,7)`), shop, tavern, bounties, inventory/equipment, permadeath loop |
| `action-ui-lab/tests/phase-6-1-hardening.test.js` | 7 | 0 | Production auth locks, debug route `403` locks, combat override isolation, backup/restore rehearsal, player/dev UI separation |
| `action-ui-lab/tests/phase-6-legacy-integration.test.js` | 11 | 0 | Real `bcryptjs` registration/login, session persistence, legacy character & item preservation, successor creation |
| `action-ui-lab/tests/player-ui.test.js` | 13 | 0 | Compact HUD, keyboard shortcuts, viewport layout (`1920x1080` .. `390x844`, `0` horizontal overflow) |
| `action-ui-lab/tests/world-travel.test.js` | 16 | 0 | `15×15` world grid movement, compass rotation, terrain danger scaling |
| **Total (Adventure Lab)** | **130** | **0** | **100% Pass Rate (`358 / 358` combined with root suite)** |

---

## 6. Real Legacy Database Migration Rehearsals (Section 5)

In addition to synthetic test fixtures, **three authorized, non-production copies of actual legacy databases and snapshots** present in `C:\Users\hih\Documents\antiDark\` were rehearsed in isolated temporary directories (`os.tmpdir()`). Prior to and immediately after all rehearsals, SHA-256 checksums of the original files were verified to confirm **zero modification to any workspace or production database**.

### 6.1 Rehearsal A — Primary Workspace Legacy SQLite Database (`data/darkgrid.sqlite`)

- **Source File:** `C:\Users\hih\Documents\antiDark\data\darkgrid.sqlite` (`462,848` bytes)
- **Original File SHA-256 (Pre & Post Rehearsal):** `e4c8d54d8811592339a8060e569dc750410e9c3d89e5724f305492e64e8c211e` (Unchanged)
- **Pre-Upgrade Contents:**
  - `13` migrations (`001..013`) and `10` seeds (`001..010`)
  - **`9` real user accounts** (`haraldur` with `$2b$10$...` `bcryptjs` password hash + `8` Firebase-authenticated player accounts)
  - **`1` living character:** `Torgal` (ID `2`, User `9` `haraldur@test.is`, Level `1` `Ranger`, `8/8` HP, `200` XP, `59` Gold, at City Hub `(7, 7)`)
  - **`5` `item_instances`** owned by `Torgal` (`Longbow`, `Padded Armor`, `Rusty Dagger`, `Shortsword`, `Tattered Ring`)
  - **`4` `hunting_contracts`**, **`1` historical `encounters` row**, **`6` `combat_events` rows**
  - **`225` `map_tiles`**, **`98` `monsters`**, **`113` `item_definitions`**
- **Isolated Rehearsal Procedure & Results:**
  1. Copied `data/darkgrid.sqlite` into an isolated temp directory and created a backup via `createDatabaseBackup()`.
  2. Executed `initSandboxDb({ dbPath: tempCopyPath })` (`runMigrations` + `runSeeds` + `ensureNonDestructiveLabAdapter`).
  3. `inspectLegacySchemaCompatibility(db)` returned `compatible: true`, `missingTables: []`, `missingCharacterColumns: []`, `foreignKeyViolations: 0`, and `PRAGMA integrity_check: 'ok'`.
  4. Verified all `9` users, character `Torgal` (`8/8` HP, `200` XP, `59` gp), all `5` `item_instances`, `4` `hunting_contracts`, `1` `encounters`, and `6` `combat_events` were 100% preserved.
  5. Verified `buildClientState(db, { userId: 9, characterId: 2 })` rendered `Torgal` in `CITY` mode at `(7, 7)` with all `5` inventory/equipped items and `3` active city bounties.
  6. Executed `restoreDatabaseBackup()` and confirmed the restored SQLite file SHA-256 (`e4c8d54d8811592339a8060e569dc750410e9c3d89e5724f305492e64e8c211e`) matched the pre-upgrade backup byte-for-byte.

### 6.2 Rehearsal B — Historical Session-2 Legacy Database (`data/darkgrid.sqlite.backup-session-2-clean`)

- **Source File:** `C:\Users\hih\Documents\antiDark\data\darkgrid.sqlite.backup-session-2-clean` (`135,168` bytes)
- **Original File SHA-256 (Pre & Post Rehearsal):** `468961a329ff653a73b05c8de7df05426e4dc61a5bd14e4a02304e9697437059` (Unchanged)
- **Pre-Upgrade Contents:**
  - Early schema with only **`3` migrations** (`001..003`) and **`3` seeds** (`001..003`) applied (`25` monsters, `29` item definitions, missing `market_listings`, `hunting_contracts`, `terrain_artworks`, `user_sessions`, `action_idempotency_log`, and missing `facing` / `pending_victory_encounter_id` / `scene_mode` on `characters`).
  - **`45` legacy user accounts** and **`44` living characters** (`0` `item_instances`).
- **Isolated Rehearsal Procedure & Results:**
  1. Copied `data/darkgrid.sqlite.backup-session-2-clean` to an isolated temp directory.
  2. Executed `initSandboxDb({ dbPath: tempCopyPath })`, which applied migrations `004..013`, reconciled and applied seeds `004..010` (`reconcileLegacySeeds`), and applied `ensureNonDestructiveLabAdapter`.
  3. Post-upgrade verification confirmed:
     - `13` migrations (`001..013`) and `10` seeds (`001..010`) recorded.
     - Catalog expanded from `25 -> 98` `monsters` and `29 -> 113` `item_definitions`.
     - All **`45` users** and **`44` living characters** preserved without a single row lost.
     - `compatible: true`, `foreignKeyViolations: 0`, `PRAGMA integrity_check: 'ok'`.

### 6.3 Rehearsal C — Production Snapshot JSON Backup (`db/backups/production-backup-latest.json`)

- **Source File:** `C:\Users\hih\Documents\antiDark\db\backups\production-backup-latest.json` (`636,053` bytes, exported `2026-03-08T19:03:54.376Z`)
- **Snapshot Checksums:** `sqliteSnapshot.checksum` = `8c8c41d3b38d9a832728b30c41b8b42d95400b299f17aa1041a5bd9a874e0d9e`, `backupChecksum` = `21ab2bb32a0ad6e6feea8de3fce4c562db4c2484524b97d8001cddf71d502144`
- **Isolated Rehearsal Procedure & Results:**
  1. Verified snapshot integrity via `verifySnapshotIntegrity(backupPath)` from `src/db/production-safety.js` (`valid: true`).
  2. Initialized a fresh isolated SQLite database via `initSandboxDb()` and imported the dynamic state via `importDynamicState(db, snapshotPayload)`.
  3. Re-ran `ensureNonDestructiveLabAdapter(db)` and `inspectLegacySchemaCompatibility(db)`.
  4. Confirmed all `9` users, character `Torgal`, `5` `item_instances`, `4` `hunting_contracts`, `1` `encounters`, and `6` `combat_events` restored cleanly with `compatible: true`, `foreignKeyViolations: 0`, and `PRAGMA integrity_check: 'ok'`.

---

## 7. Final Integration into Primary Working Directory (Section 7)

All Phase 6, Phase 6.1, and Phase 6.2 changes have been integrated into the primary working directory on branch `main`:

1. **Primary Working Directory Path:** `C:\Users\hih\Documents\antiDark\action-ui-lab` (inside repository root `C:\Users\hih\Documents\antiDark`).
2. **Branch:** `main`
3. **Preservation of Existing Data & Assets:**
   - `C:\Users\hih\Documents\antiDark\data\darkgrid.sqlite` (`e4c8d54d8811592339a8060e569dc750410e9c3d89e5724f305492e64e8c211e`) and all backup files in `data/` and `db/backups/` were verified untouched.
   - All monster artwork (`public/assets/monsters/*.webp`), terrain artwork, scene catalog assets, and configurations remain intact.
4. **Regression Tests Executed from Primary Working Directory (`C:\Users\hih\Documents\antiDark`):**
   - `npm test`: **`228 / 228` passed (`0` failures)**
   - `node --test --test-concurrency=2 action-ui-lab/tests/*.test.js`: **`130 / 130` passed (`0` failures)**
5. **GitHub Remote Synchronization (`origin/main`):**
   - Fast-forward pushed local `main` to `origin/main` (`https://github.com/Hjorvar/DarkGrid_anti.git`) without force-pushing or deleting any branches or worktrees.
   - Confirmed `git rev-parse main` === `git rev-parse origin/main`.

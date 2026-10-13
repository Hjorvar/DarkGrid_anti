# DARKGRID — Remediation Report: Session 1 (Critical Fixes)

> **Branch:** `fix/session-1-critical-fixes`  
> **Date:** October 13, 2026  
> **Auditor Reference:** `docs/independent-code-review.md`  
> **Status:** Critical issues C1, C2, and C3 are **FULLY FIXED & VERIFIED**.

---

## 1. Executive Summary

In response to the independent code review (`independent-code-review.md`), Session 1 resolved the three Critical (C1, C2, C3) defects identified in the game engine, routes, views, and test harness.

All changes were implemented on a dedicated isolation branch (`fix/session-1-critical-fixes`). The production database file (`data/darkgrid.sqlite`) was strictly protected from modification, and bit-level integrity was verified via SHA-256 before and after the entire test suite execution.

| Issue | Severity | Status | Verification Mechanism |
|---|---|---|---|
| **C3: Test Database Isolation** | CRITICAL | **FIXED** | Security guard in `connection.js`, `:memory:` defaults in `config`, preloaded `test_helpers.js`, `tests/db_isolation_guard.test.js` |
| **C1: Equip & Unequip Workflow** | CRITICAL | **FIXED** | `targetSlot` added to forms, `instance_id` mapping corrected, equipped items filtered from backpack & sell lists, `tests/equipment_http_flow.test.js` |
| **C2: Combat Escape Exploit** | CRITICAL | **FIXED** | `ignoreEncounter` restricted to `DISCOVERED`, `concludeEncounter` route & hidden form removed, movement locked during combat, `tests/combat_escape_restrictions.test.js` |

---

## 2. Database Integrity Verification (SHA-256)

Prior to any test execution or code modifications, the SHA-256 hash of `data/darkgrid.sqlite` was computed and recorded:

```text
Before Session 1: 2DD5FFF6118982BAD9DA45DBDC1F231FBD2AB10926F8A118C883223CEC494C4F
After Session 1:  2DD5FFF6118982BAD9DA45DBDC1F231FBD2AB10926F8A118C883223CEC494C4F
```

The database hash is **100% identical**. No test data, test users, or migration runs polluted the live database file.

---

## 3. Remediation Details

### C3: Test Database Isolation

- **Root Cause:** `tests/http_integration.test.js` and `tests/pre_merge_fixes.test.js` invoked `getDb()` directly without overriding `config.dbPath`, causing migrations, seeds, and test fixtures to execute against `data/darkgrid.sqlite`.
- **Changes Applied:**
  1. `src/config/index.js`: Automatically detects test environment (`NODE_ENV === 'test'`, `--test`, or test runner args) and defaults `dbPath` to `:memory:`.
  2. `src/db/connection.js`: Added an active security guard in `initializeDatabase()`. If executed within a test environment, any attempt to resolve or open `data/darkgrid.sqlite` immediately throws a `[SECURITY GUARD] CRITICAL SAFETY VIOLATION` exception. In addition, `getDb()` automatically boots an isolated, migrated, and seeded in-memory database if invoked inside a test context.
  3. `package.json`: Updated `"test"` script to `node --require ./tests/test_helpers.js --test tests/*.test.js`, guaranteeing `NODE_ENV = 'test'` is preloaded before test processes load application modules.
  4. `tests/http_integration.test.js` & `tests/pre_merge_fixes.test.js`: Refactored to use `createTestDb()` and `setDb()` in `test.before` and `closeDb()` in `test.after`.
  5. `tests/db_isolation_guard.test.js`: Created dedicated guard tests validating config defaults, safety guard exceptions, and multi-instance in-memory isolation.

### C1: Equip / Unequip UI & Flow Fixes

- **Root Cause:**
  - Equip forms in `src/views/game.ejs` lacked `<input type="hidden" name="targetSlot">`, causing `equipItem()` to reject requests with `Invalid equipment slot: null`.
  - Unequip forms in `src/views/game.ejs` referenced `item.instance_id`, whereas `getCharacterEquipment()` returned `ii.id` as `id`, leaving the field blank.
  - Backpack and Sell listings rendered equipped gear, resulting in confusing duplicates and runtime errors when players attempted to sell worn armor or weapons.
- **Changes Applied:**
  1. `src/views/game.ejs`:
     - Added `<input type="hidden" name="targetSlot" value="<%= derivedSlot %>">` derived from category and `weapon_range_type` (`MELEE`, `RANGED`, `ARMOR`, `SHIELD`).
     - Corrected unequip form field to `<%= item.id || item.instance_id %>`.
     - Filtered backpack items to `safeInventory.filter(item => !item.equipped_slot)` for both the Backpack tab and the Town Market "Sell from Backpack" list.
     - Added explicit shield suppression warning in the Prepared Gear card when wielding two-handed melee weapons: `(Shield disabled with two-handed weapon)`.
  2. `src/domain/character/rules.js`:
     - Added `ii.id AS instance_id` alias in `getCharacterEquipment` and `getCharacterInventory` for backward compatibility.
     - Added fallback slot auto-derivation in `equipItem()` if `targetSlot` is omitted, adding defense-in-depth behind UI forms.
  3. `tests/equipment_http_flow.test.js`: New end-to-end HTTP integration tests that parse raw HTML forms, submit them unchanged via HTTP POST, and verify equipment changes, buy, unequip, and sell cycles directly in SQLite.

### C2: Illegal Combat Escape Closure

- **Root Cause:**
  - `ignoreEncounter()` accepted encounters with `status IN ('DISCOVERED', 'IN_COMBAT')`, permitting players to bypass permadeath and flee without triggering Attacks of Opportunity.
  - `concludeEncounter()` existed as a legacy Phase 1 standoff mechanism, setting `status = 'ESCAPED'` with no combat risk.
  - A hidden `<form action="/game/encounter/conclude">` remained embedded in the DOM during active combat.
- **Changes Applied:**
  1. `src/domain/encounters/engine.js`:
     - Restricted `ignoreEncounter()` strictly to `DISCOVERED` status. Any call on an `IN_COMBAT` encounter immediately throws an exception: `"Cannot ignore an encounter during active combat! You must fight or flee."`
     - Completely removed the deprecated `concludeEncounter()` function and its export.
  2. `src/routes/game.js`:
     - Removed `concludeEncounter` import and deleted the `POST /game/encounter/conclude` route (returns 404).
     - Enhanced error redirects for illegal ignore attempts.
  3. `src/views/game.ejs`:
     - Deleted the hidden `<form action="/game/encounter/conclude">` element from the DOM.
  4. `src/domain/world/map.js`:
     - Clarified movement lock reason when engaged in combat: `"You cannot walk away while engaged in combat! You must fight or flee."`
  5. `tests/encounter_stealth_reveal.test.js`: Updated test assertions to ensure `conclude` is gone, illegal ignore is rejected, and legal `FLEE` with Attack of Opportunity is enforced.
  6. `tests/combat_escape_restrictions.test.js`: Added HTTP test verifying that `POST /game/encounter/ignore` in combat fails, `POST /game/encounter/conclude` returns 404, movement is locked, and only legal `POST /game/combat/flee` resolves combat.

---

## 4. Test Suite Execution Results

Running `npm test` across all suites:

```text
ℹ tests 108
ℹ suites 0
ℹ pass 108
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3671.1254
```

- **Total Test Files:** 16
- **Total Tests:** 108
- **Passing:** 108 (100%)
- **Failing:** 0 (0%)

### New Test Suites Added in Session 1:
1. `tests/db_isolation_guard.test.js` (4 tests):
   - `C3 Guard 1: config.dbPath defaults to :memory: in test environment`
   - `C3 Guard 2: Safety guard strictly forbids opening live game database in test environment`
   - `C3 Guard 3: Parallel / multiple createTestDb calls are strictly isolated`
   - `C3 Guard 4: getDb() in test environment initializes an isolated in-memory DB`
2. `tests/equipment_http_flow.test.js` (2 tests):
   - `C1 HTTP Integration: Full Equip -> Unequip -> Buy -> Sell cycle via real parsed HTML forms`
   - `C1 HTTP Integration: Primary Weapon Preference and Two-Handed Shield Suppression`
3. `tests/combat_escape_restrictions.test.js` (1 test):
   - `C2 HTTP Integration: Illegal escape attempts during IN_COMBAT are rejected; legal Flee and AoO enforced`

---

## 5. Remaining Items from Code Review (For Future Sessions)

The remaining items documented in `docs/independent-code-review.md` are queued for subsequent sessions:
- **H1:** Gold duplication / orphaned loot on concurrent persistent monster fights.
- **H2:** Persistent monster starting HP reset on new encounter.
- **H3:** Post-combat victory / XP / level-up notification screen.
- **H4:** Hidden production-only initiative rule removal or documentation.
- **H5:** Flaky test resolution (partially addressed by stabilizing test 6 in `pre_merge_fixes.test.js`).
- **M1–M8:** Medium priority items (flying monster AC in UI, narrative text fixes, session hardening, etc.).
- **L1–L14:** Low priority polish and cleanup items.

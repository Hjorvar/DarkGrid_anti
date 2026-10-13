# Darkgrid — Core Stabilization & Integration Report

**Date:** 2026-10-13  
**Branch:** `fix/core-stabilization` (based on `feature/defeated-monster-art` @ `9c70df4`)  
**Status:** Complete & Verified (197/197 automated unit, integration, and end-to-end tests passing)

---

## 1. Executive Summary

Following the independent Gemini 4 Argon audit, all feature expansion was paused to perform a targeted stabilization and integration pass across Darkgrid's combat, loot, character, equipment, encounter secrecy, UI/modal, economy, and database layers.

Every confirmed issue was resolved at the root cause, the newly approved **No Ambush at Level 1** gameplay rule was implemented across all encounter and combat entry points, and real end-to-end HTTP + VM script execution + full combat round tests were added in [`tests/core_stabilization_e2e.test.js`](../tests/core_stabilization_e2e.test.js).

The live game database (`data/darkgrid.sqlite`) was strictly preserved and never opened or modified during testing (verified via unchanged SHA-256 hash `4A5C06F252BDDFDC1C2052CCAD74D3FE612976F3E86A391D25BE0BBC9C3648C6`).

---

## 2. Confirmed Issues & Root-Cause Fixes

### 2.1 CR & Loot Metadata Propagation (Critical — Fixed)
- **Root Cause:** `startCombat`, `getCombatState`, and `executeCombatRound` in [`src/domain/combat/engine.js`](../src/domain/combat/engine.js) used three separate SQL `SELECT` queries with divergent column lists. `executeCombatRound` omitted `m.challenge_rating`, `m.treasure_type`, and `m.creature_subtype`, while `startCombat` and `getCombatState` omitted `m.treasure_type` and `m.creature_subtype`. When a monster was defeated during `executeCombatRound`, `handleMonsterDefeat` -> `generateMonsterLoot` fell back to `cr = monster.challenge_rating || 1` and `treasureType = 'Standard'`, causing CR 3–5 monsters to drop CR 1 gold/items and `treasure_type = 'None'` monsters to roll standard loot.
- **Fix:**
  - Consolidated all three queries in [`src/domain/combat/engine.js`](../src/domain/combat/engine.js) into a single shared helper `fetchEncounterWithMonster(db, encounterId, characterId)` that selects `m.challenge_rating`, `m.treasure_type`, `m.creature_type`, `m.creature_subtype`, `m.movement_type`, `m.xp_reward`, and all combat/art fields.
  - Updated `getEncounterById` in [`src/domain/encounters/engine.js`](../src/domain/encounters/engine.js) to include `m.challenge_rating`, `m.treasure_type`, and combat metadata.
  - Added defensive DB resolution in [`src/domain/monsters/persistence.js`](../src/domain/monsters/persistence.js) (`handleMonsterDefeat`) and [`src/domain/combat/loot.js`](../src/domain/combat/loot.js) (`generateMonsterLoot`), and replaced `monster.challenge_rating || 1` with `Number.isFinite(parsedCr) && parsedCr > 0 ? parsedCr : 1` so fractional CRs (`0.25`, `0.33`, `0.5`) are preserved accurately.

### 2.2 JavaScript & Modal System Escaping + HTML Attribute Corruption (Critical — Fixed)
- **Root Cause:**
  1. In [`src/views/game.ejs`](../src/views/game.ejs), `var initialModal = <%= JSON.stringify(safeActiveModal) %>;` HTML-escaped quotes into `&#34;backpack&#34;`, throwing a JavaScript `SyntaxError` in the browser whenever a POST action redirected to `/game?modal=backpack`, `/game?modal=market`, or `/game?modal=character`.
  2. Line 621 rendered `<span ...>(Shield disabled with ranged)</span>` inside `<%= ... %>`, outputting literal `&lt;span...&gt;` text in the UI.
  3. Multiple `<button>` tags interpolated `disabled title="..."` inside `<%= ... %>`, producing invalid HTML attributes (`disabled title=&#34;...&#34;`).
- **Fix:**
  - Sanitized `safeActiveModal` against the strict whitelist `['character', 'backpack', 'market', 'journal']` at the top of [`src/views/game.ejs`](../src/views/game.ejs) and serialized it safely with `<%- JSON.stringify(safeActiveModal) %>` (preventing any XSS vector while outputting valid JS string/null literals).
  - Added `is-active` class to `#game-modal-backdrop` on server render when `safeActiveModal` is set.
  - Replaced all string-interpolated HTML spans and button attributes inside `<%= ... %>` with clean EJS conditional blocks (`<% if (...) { %>...<% } %>`).

### 2.3 Ranger Favored Enemy & Opening Shot (High — Fixed)
- **Root Cause:**
  - Because `m.creature_subtype` was missing from the combat SQL queries in [`src/domain/combat/engine.js`](../src/domain/combat/engine.js), `getRangerFavoredEnemyBonus` always saw `monster.creature_subtype === undefined` during combat, causing all `HUMANOID:*` Favored Enemy selections (`goblinoid`, `orc`, `gnoll`, `drow`, `duergar`, `reptilian`) to return `+0` in real combat.
  - Additionally, `BEAST` vs `ANIMAL` and underscore vs space (`MAGICAL_BEAST` vs `MAGICAL BEAST`, `MONSTROUS_HUMANOID` vs `MONSTROUS HUMANOID`) needed consistent normalization across character creation and combat.
- **Fix:**
  - `fetchEncounterWithMonster` now passes `creature_subtype` into `startCombat`, `getCombatState`, and `executeCombatRound`.
  - Normalized creature categories and subtypes in `getRangerFavoredEnemyBonus` and `createCharacter` in [`src/domain/character/rules.js`](../src/domain/character/rules.js).
  - Preserved pre-existing Favored Enemy input values on initial load in [`public/js/character-builder.js`](../public/js/character-builder.js).
  - Verified all 4 Ranger Opening Shot requirements (Ranger class, spotted monster first `spotted_by_hero === 1`, not ambushed `is_ambush === 0`, prepared ranged weapon, once per combat).
- **World Coverage Note (Documented per Section 4):**
  - All `HUMANOID:*` subtypes selectable at character creation (`goblinoid`, `orc`, `gnoll`, `drow`, `duergar`, `reptilian`, plus `giant`/`boggard` in DB) have matching monsters in the `monsters` catalog.
  - Note that monsters whose primary habitats are exclusively underground/urban/aquatic (`D` Dungeon, `U` Urban, `W` Water) — such as `Drow` (`D`), `Duergar` (`D`), and `Aberration` (`D`/`W`) — do not spawn as random wilderness encounters on the current 15×15 surface map (`FOREST`/`SWAMP`/`JUNGLE`/`HILLS`/`PLAINS`/`RIVER`), though their Favored Enemy combat bonuses are fully wired and verified. Per project constraints, no map tiles or monsters were altered.

### 2.4 Magical Equipment, AC & Character Sheet Effective Stats (High — Fixed)
- **Root Cause:**
  - `calculateHeroAC` in [`src/domain/combat/rules.js`](../src/domain/combat/rules.js) only added `ring.armor_bonus` (`Ring of Protection +1`) and `neck.armor_bonus` (`Amulet of Natural Armor +1`) when the second argument was the full `equipment` object, whereas [`src/domain/combat/engine.js`](../src/domain/combat/engine.js) (`getCombatState`, `executeCombatRound`) and [`src/routes/game.js`](../src/routes/game.js) passed `(effectiveHero, equipment.armor, equipment.shield, ...)`.
  - `equipItem` in [`src/domain/character/rules.js`](../src/domain/character/rules.js) omitted `id.equip_slot` from its `SELECT` query, allowing non-equippable `OTHER` items (like treasures) to be equipped into accessory slots if a target slot was specified.
- **Fix:**
  - Updated [`src/domain/combat/engine.js`](../src/domain/combat/engine.js) and [`src/routes/game.js`](../src/routes/game.js) to pass `equipment` to `calculateHeroAC`, and enhanced `calculateHeroAC` + `getCharacterEquipment` + `getEffectiveStats` so `Ring of Protection +1` and `Amulet of Natural Armor +1` are always applied regardless of call signature (`(hero, equipment, ...)` or `(hero, armor, shield, ...)`).
  - Updated `equipItem` to select `id.equip_slot as def_equip_slot, id.equip_slot, id.subtype` and require a matching `equip_slot` for `RING`, `CLOAK`, `NECK`, `BELT`, and `FEET` slots.
  - Verified `Belt of Giant Strength +2` grants `+2` effective STR on the Character Sheet (`(+2 Belt)`) and in combat attack/damage rolls without mutating base `strength` in SQLite, and disappears immediately upon unequipping.

### 2.5 Encounter Secrecy & DISCOVERED State Locks (High — Fixed)
- **Root Cause:**
  - In `GET /game` ([`src/routes/game.js`](../src/routes/game.js)), `activeEncounter` was passed directly into `getActiveWeapon`, `calculateHeroAttackBonus`, and `calculateHeroAC` even when `activeEncounter.status === 'DISCOVERED'`. This leaked whether an uninvestigated monster was flying (auto-switching the Hero Panel to Ranged and disabling shield AC), Undead (adding Cleric Holy Radiance `+2 Atk` / `+2 AC`), or a Ranger's Favored Enemy (`+1 Atk`).
  - Furthermore, `equipItem`, `unequipItem`, `setPrimaryWeaponPreference`, `useConsumable`, `performClericSelfHeal`, and `performCityRest` only checked `status = 'IN_COMBAT'`, allowing players to swap gear, change weapon preference, or heal while an unresolved threat was `DISCOVERED`.
- **Fix:**
  - In `GET /game` ([`src/routes/game.js`](../src/routes/game.js)), defined `const revealedMonster = (activeEncounter && activeEncounter.status === 'IN_COMBAT') ? activeEncounter : null;` and passed `revealedMonster` into `getActiveWeapon`, `calculateHeroAttackBonus`, and `calculateHeroAC`.
  - Locked `equipItem`, `unequipItem`, `setPrimaryWeaponPreference`, `useConsumable`, `performClericSelfHeal`, and `performCityRest` on the server (and disabled buttons in [`src/views/game.ejs`](../src/views/game.ejs)) whenever an encounter has `status IN ('DISCOVERED', 'IN_COMBAT')`.

### 2.6 New Approved Rule: No Ambush at Level 1 (Implemented)
- **Rule:** Level 1 characters (`level <= 1`) can never be placed into an `Ambush` state (`is_ambush` is always `0`), while still being able to fail perception (`spotted_by_hero = 0`, preventing automatic Ranger Opening Shots on unspotted enemies) and still facing normal combat danger and permadeath. At Level 2+, normal Ambush rules apply.
- **Implementation:**
  - Added `resolveDetectionAndAmbush(character, monster, options, defaults)` in [`src/domain/encounters/engine.js`](../src/domain/encounters/engine.js) and applied it to both persistent and random encounters in `checkTileEncounter`.
  - Added `enforceNoAmbushAtLevel1` sanitization in `getEncounterById`, `ignoreEncounter`, `investigateEncounter`, `startCombat`, `getCombatState`, and `executeCombatRound` so even legacy DB encounter rows on Level 1 characters cannot trigger an Ambush.

### 2.7 Treasure Sell Prices & Database Reliability (Medium — Fixed)
- **Treasure Sell Prices:** Updated `sellItem` in [`src/domain/economy/shop.js`](../src/domain/economy/shop.js) and the Backpack/Market views in [`src/views/game.ejs`](../src/views/game.ejs) to use `item.sell_price` from `item_definitions` for non-magical and `TREASURE` items (falling back to `Math.floor(buy_price * 0.50)`), while keeping the `40%` payout / `125%` Global Resale Market rule for magical gear.
- **Seed Tracking (`schema_seeds`):** Updated `runSeeds` in [`src/db/migrate.js`](../src/db/migrate.js) and [`src/server.js`](../src/server.js) to track applied seed files in `schema_seeds` and reconcile legacy pre-seeded databases so new seed files (`007`, `008`, etc.) apply cleanly even when `map_tiles` is already populated.
- **Per-Connection Savepoint Depth:** Replaced the module-global `let transactionDepth = 0` in [`src/db/connection.js`](../src/db/connection.js) with a `WeakMap` (`transactionDepthByDb`) keyed by the `DatabaseSync` instance.
- **Runtime Documentation:** Updated [`AGENTS.md`](../AGENTS.md), [`README.md`](../README.md), and [`package.json`](../package.json) to document Node.js built-in `node:sqlite` (`DatabaseSync`, Node.js `>=22.5.0` / v24+).

---

## 3. Audit Findings Evaluated as Already Resolved / Outdated

1. **Treasure items `buy_price = 0` claim:** In `db/seeds/007_seed_expanded_items_and_loot_tables.sql`, all 14 `TREASURE` items already had positive `buy_price` and explicit `sell_price` values (`buy_price = 2 * sell_price`). However, `sellItem` in `src/domain/economy/shop.js` previously ignored the `sell_price` column and computed `Math.floor(buy_price * 0.50)`. Wiring `sell_price` directly into `sellItem` and `game.ejs` guarantees exact consistency for all current and future items.
2. **Inactive items (`Potion of Barkskin`, `Boots of Elvenkind`, etc.):** Already filtered out of shop stock (`getCityStoreStock`), loot drops (`generateMonsterLoot`), and combat potion lists (`getCharacterPotions(..., { combatOnly: true })`), and prevented from being consumed (`useConsumable`).

---

## 4. Modified Files & Test Summary

### Modified Files
- [`src/domain/combat/engine.js`](../src/domain/combat/engine.js)
- [`src/domain/combat/rules.js`](../src/domain/combat/rules.js)
- [`src/domain/combat/loot.js`](../src/domain/combat/loot.js)
- [`src/domain/monsters/persistence.js`](../src/domain/monsters/persistence.js)
- [`src/domain/encounters/engine.js`](../src/domain/encounters/engine.js)
- [`src/domain/character/rules.js`](../src/domain/character/rules.js)
- [`src/domain/economy/shop.js`](../src/domain/economy/shop.js)
- [`src/routes/game.js`](../src/routes/game.js)
- [`src/views/game.ejs`](../src/views/game.ejs)
- [`public/js/character-builder.js`](../public/js/character-builder.js)
- [`src/db/connection.js`](../src/db/connection.js)
- [`src/db/migrate.js`](../src/db/migrate.js)
- [`src/server.js`](../src/server.js)
- [`package.json`](../package.json), [`AGENTS.md`](../AGENTS.md), [`README.md`](../README.md)
- [`tests/core_stabilization_e2e.test.js`](../tests/core_stabilization_e2e.test.js) (new E2E & integration test suite)

### Verification Results
- **Automated Tests:** `198` tests (`191` existing + `7` new end-to-end tests in `tests/core_stabilization_e2e.test.js`) — **198 passing, 0 failing**.
- **Live Database Integrity:** `data/darkgrid.sqlite` SHA-256 verified unchanged (`4A5C06F252BDDFDC1C2052CCAD74D3FE612976F3E86A391D25BE0BBC9C3648C6`).

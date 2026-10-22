# DARKGRID — PHASE 6: FULL LEGACY SYSTEM AUDIT

**Date:** 2026-10-22  
**Branch:** `darkgrid_legacy_integration` (synced with `main` at commit `87ed6f3`)  
**Scope:** Complete code and database audit of the original Darkgrid RPG (`src/`, `db/`) and comparison against `action-ui-lab/` prior to Phase 6 integration.

---

## 1. Executive Summary

Before Phase 6, `action-ui-lab/` already reused the core Darkgrid SQLite migrations (`src/db/migrate.js`) and most domain engines (`src/domain/character/rules.js`, `src/domain/combat/engine.js`, `src/domain/encounters/engine.js`, `src/domain/economy/shop.js`, `src/domain/bounties/board.js`, `src/domain/monsters/persistence.js`). However, it operated as a single-user sandbox prototype (`userId = 1` hardcoded to `'action_hero'`) and lacked several player-facing legacy workflows and security/session layers required to replace the original SSR (`EJS`) application.

This audit cataloged every subsystem in `src/` and `db/` and verified its exact implementation status.

---

## 2. Subsystem-by-Subsystem Discovery

### 2.1 Authentication, Accounts & Sessions
- **Original Implementation (`src/domain/auth/service.js`, `src/db/session-store.js`, `src/routes/auth.js`):**
  - Username (`3–30` chars) + password (`>= 6` chars) registration and login using `bcrypt` (`10` salt rounds).
  - Transparent Firebase Authentication migration bridge: legacy accounts with `password_hash = 'firebase-auth'` are verified and automatically upgraded to a local `bcrypt` hash on first login.
  - Persistent SQLite-backed session store (`SqliteSessionStore` using table `user_sessions`) configured with Firebase Hosting's `__session` cookie name (`httpOnly`, `sameSite: 'lax'`).
- **Pre-Phase 6 Adventure Lab Status:**
  - Missing. Hardcoded single-user `action_hero` (`userId = 1`), no `express-session`, no login/register/logout endpoints or UI.

### 2.2 Character Creation, Classes & Progression
- **Original Implementation (`src/domain/character/rules.js`, `src/config/index.js`, `src/routes/character.js`):**
  - Strictly **one living character (`is_alive = 1`) per user account** (`idx_one_living_character_per_user`).
  - **3 Classes (`FIGHTER`, `RANGER`, `CLERIC`)** with class base attributes summing to `68` and **3 bonus points** (`totalSum = 71`, each attribute within `[base - 2, base + 4]` and `[8, 18]`).
  - **Ranger Favored Enemy:** Required at creation (`ANIMAL`/`BEAST`, `MAGICAL BEAST`, `MONSTROUS HUMANOID`, `ABERRATION`, `VERMIN`, `PLANT`, `GIANT`, `DRAGON`, or `HUMANOID:<subtype>`). `UNDEAD` is strictly forbidden (`0` bonus).
  - **Starting Gold & Starter Kit:** `10 gp` in canonical character creation plus 4 starter items (`modifications: '{"is_starter":true}'`) and 2 `Minor Healing Potion` instances.
  - **XP & Leveling (`LEVEL_XP_THRESHOLDS`):** Levels 1–20 (`0`, `1300`, `3300`, `6000`, `10000`, ...). Intelligence modifier scales combat XP by `±10%` per modifier point (minimum `50%`). Level-up grants class HP per level (`FIGHTER: 10`, `RANGER: 8`, `CLERIC: 8`) + CON modifier (minimum `+1 HP/level`) and restores full HP.
- **Pre-Phase 6 Adventure Lab Status:**
  - Partial. `ensureLivingHero` auto-seeded preset characters for `action_hero`, bypassing the 71-point point-buy character creation form and Ranger Favored Enemy selector.

### 2.3 Player Statistics, Saving Throws & Class Abilities
- **Original Implementation (`src/domain/character/rules.js`, `src/domain/combat/rules.js`):**
  - Effective attributes include `Belt of Giant Strength +2` (`+2 STR`, `is_str_boosted = true`).
  - Saving Throws (`getHeroSavingThrows`): Fortitude (`CON`), Reflex (`DEX`), Will (`WIS`), plus `Cloak of Resistance +1/+2` (`save_bonus`).
    - Fighter: Good Fort, Poor Ref/Will
    - Ranger: Good Fort/Ref, Poor Will
    - Cleric: Good Fort/Will, Poor Ref
  - Class Abilities:
    - **Fighter:** Weapon Training (`+1 Atk/Dmg` at Lv 5, `+2` at Lv 9), Armor Training (`+1 Max DEX in Armor` at Lv 3, `+2` at Lv 7).
    - **Ranger:** Keen Senses (Stage 1 pre-combat tracking clue), Ranged Opening Shot (1 pre-round shot before round 1 when Ranger spots enemy in Ranged stance and is not ambushed; leaves enemy at `>= 1 HP`), Favored Enemy (`+1 Atk/Dmg` Lv 1–4, `+2` Lv 5–9, `+3` Lv 10+).
    - **Cleric:** Holy Radiance vs. Undead (`+1 Atk/Dmg` Lv 1, `+2` Lv 5, `+3` Lv 9; Sacred AC `+2` Lv 1, `+3` Lv 4, `+4` Lv 8), Sacred Self-Heal outside combat (`1d6` Lv 1, `2d6` Lv 3, `3d6` Lv 5, `4d6` Lv 7, `5d6` Lv 9; `2 uses/rest`, recharged in Oakhaven Sanctuary).
- **Pre-Phase 6 Adventure Lab Status:**
  - Domain rules were active on the backend, but `savingThrows`, `xpForNextLevel`, `is_str_boosted`, and `classAbilities` were not surfaced in the `buildClientState` payload or Champion Sheet modal.

### 2.4 Equipment, Inventory, Loot & Economy
- **Original Implementation (`src/domain/character/rules.js`, `src/domain/combat/loot.js`, `src/domain/economy/shop.js`):**
  - **9 Equipment Slots:** `MELEE_WEAPON`, `RANGED_WEAPON`, `ARMOR`, `SHIELD`, `RING`, `CLOAK`, `NECK`, `BELT`, `FEET`.
  - **Primary Weapon Stance (`MELEE` vs `RANGED`):** Shield AC applies in Melee stance (if not using a 2H weapon) and is stowed (`0` shield AC) in Ranged stance. Equipment and stance changes are locked during `IN_COMBAT`.
  - **Oakhaven General Store & Shared Global Magical Resale Market:**
    - Standard non-magical items and `Minor Healing Potion` sold with Charisma price modifier (`-5%` per `+1 CHA`, capped at `±20%`). Zero-cost items (`Club`) capped at 2 per hero.
    - Starter gear (`is_starter: true`) cannot be sold.
    - Non-magical gear sells for `50%` base price (destroyed).
    - Magical items (`is_magical = 1`, excluding potions) sell for `40%` base price and are consigned into `market_listings` (`status = 'AVAILABLE'`, `resale_price = ceil(base_price * 1.25)`) for any player in the shared world to purchase via `listingId`.
- **Pre-Phase 6 Adventure Lab Status:**
  - Partial. Standard store buy and backpack sell existed, but the **Shared Global Magical Resale Market (`resaleListings` / `listingId`)**, category filters, and Sell Backpack Gear tab were missing from the Oakhaven Market modal.

### 2.5 World Map, Encounters, Combat, Bounties & Persistent Monsters
- **Original Implementation (`src/domain/world/map.js`, `src/domain/encounters/engine.js`, `src/domain/combat/engine.js`, `src/domain/bounties/board.js`, `src/domain/monsters/persistence.js`):**
  - 15×15 world grid (`225` tiles), Oakhaven Sanctuary at `(7, 7)`, distance-based CR safety caps (`dist 1 -> CR 1/3`, `dist 2 -> CR 1/2`, `dist 3 -> CR 1`).
  - Stage 1 (`DISCOVERED`) strict secrecy (never leaks species name, image, or stats; Ranger gets Keen Senses clue).
  - Stage 2 (`IN_COMBAT`) d20 combat with 9 monster health brackets, monster special abilities (auras, poison, disease, paralysis, grab, trip, bleed, energy drain), and hidden monster numbers.
  - **The Watcher's Board:** Section A (3 daily Named Hunting Contracts with `TOUGH`, `AGGRESSIVE`, or `BRUTAL` boost, auto-claimed on return to Oakhaven) and Section B (Wilderness Threats showing compass bearing and kill count of active persistent monsters without leaking species or coordinates).
  - **Permadeath & Persistent Monsters:** Dying (`current_hp = 0`) permanently ends the hero (`is_alive = 0`), promotes the killer into `monster_instances` (`+10%` max HP, `50%` hero gold + `50%` surviving items up to 20-item cap), and records `killed_by_monster_instance_id`. Slaying a persistent monster awards its held loot and records avenged fallen heroes.
- **Pre-Phase 6 Adventure Lab Status:**
  - Core engines were connected, but the Watcher's Board modal lacked Abandon Warrant and Section B (Wilderness Threats), the Victory banner lacked Level-Up / Bounty Slain / Avenged Heroes notices, and the Fallen screen lacked killer metadata, final battle chronicle, and Custom 71-Point Hero Forge integration.

### 2.6 Security & Idempotency
- **Original Implementation (`src/middleware/security.js`, `src/middleware/idempotency.js`):**
  - `antiTamperMiddleware` rejects any request containing `FORBIDDEN_CLIENT_FIELDS` (`gold`, `xp`, `level`, `current_hp`, `max_hp`, `damage`, `uid`, `character_id`, etc.) with HTTP `400`.
  - `idempotencyMiddleware` deduplicates repeated mutations via `action_idempotency_log`.
- **Pre-Phase 6 Adventure Lab Status:**
  - Missing from `action-ui-lab/server.js`. Added in Phase 6 as JSON-native middlewares (`labAntiTamperMiddleware` inspecting top-level `req.body`, nested `req.body.payload`, and `req.query`, plus `createLabIdempotencyMiddleware`).

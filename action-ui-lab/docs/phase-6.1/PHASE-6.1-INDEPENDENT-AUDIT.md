# DARKGRID — PHASE 6.1: INDEPENDENT CRITICAL AUDIT

**Date:** 2026-10-22  
**Branch:** `darkgrid_legacy_integration`  
**Scope:** Independent Pre-Cutover Code, API, Security, Database, and UX Audit of `action-ui-lab/`

---

## 1. Executive Summary

Before production cutover, an independent critical review of the Phase 6 `action-ui-lab/` codebase, API controllers, SQLite database mutations, session middleware, and real-browser screenshots was performed. Rather than accepting Phase 6 self-reports at face value, every route, controller, service, and UI modal was audited directly and exercised against isolated SQLite databases and real headless Chromium sessions.

While the core canonical rules (71-point ability allocation, d20 combat math, 9-slot equipment panoply, Oakhaven Market consignment pricing, Watcher's Board daily warrants, and 640-viewpoint first-person world rendering) were genuinely wired to `src/domain/`, **10 real pre-cutover defects and security gaps** were discovered and resolved during Phase 6.1:

| ID | Category | Severity | Defect Summary | Phase 6.1 Status |
|---|---|---|---|---|
| **F-01** | Character Rules / Data Safety | **CRITICAL** | Character Forge UI claimed creating a hero would *"retire"* the existing hero, and `executeCreateCharacterForUser` deleted the living character (`DELETE FROM characters WHERE id = ?`) BEFORE validating the new character's stats—destroying the existing character even if creation failed. | **FIXED & TESTED** |
| **F-02** | Production Auth | **CRITICAL** | Unauthenticated requests fell back to `defaultUserId` (`action_hero` sandbox account) unless the client explicitly sent `session.loggedOut = true`, allowing anonymous visitors to control and mutate the shared sandbox hero. | **FIXED & TESTED** |
| **F-03** | Production Privilege Escalation | **CRITICAL** | Normal players could invoke `LAB_SCENARIO`, `TELEPORT_TO_TILE`, `REVIVE`, `FORCE_DISCOVERY`, `SET_DETERMINISTIC_SEED`, `SET_ART_PREVIEW_MODE`, and `MOVE` with `testForceEncounter` in production. | **FIXED & TESTED** |
| **F-04** | Gameplay Bypass | **HIGH** | `START_EXPEDITION` and `RESET_EXPEDITION` allowed normal players to escape active combat encounters, teleport out of the wilderness, and restore full HP at any time. | **FIXED & TESTED** |
| **F-05** | Information Disclosure | **HIGH** | `GET /api/legacy-audit` was publicly accessible without authentication and exposed table row counts and schema details. | **FIXED & TESTED** |
| **F-06** | Session & Cookie Hardening | **HIGH** | `express-session` used a development fallback secret without failing closed in production. | **FIXED & TESTED** |
| **F-07** | Database Seed Safety | **HIGH** | `initSandboxDb` defaulted `preserveExistingMap = false` and `seedSandboxHero = true`, overwriting 4 canonical world tiles (`(6,5)`, `(8,6)`, `(8,8)`, `(9,7)`) and creating a synthetic sandbox hero unless explicitly overridden. | **FIXED & TESTED** |
| **F-08** | Cross-Account Ownership & Anti-Tamper | **MEDIUM** | Missing explicit `403 Forbidden` ownership checks on `EQUIP`, `UNEQUIP`, `SELL`, `POTION` (`potionInstanceId`), `ACCEPT_BOUNTY`, and `ABANDON_BOUNTY`, plus missing `startingGold`/`isAdmin` checks in `labAntiTamperMiddleware`. | **FIXED & TESTED** |
| **F-09** | Combat Replay / Stale Round | **MEDIUM** | Repeated or double-clicked combat requests (`ATTACK`, `POTION`, `FLEE`) lacked `expectedRound` validation to ignore stale combat rounds idempotently. | **FIXED & TESTED** |
| **F-10** | Player-Facing UI & Contracts | **MEDIUM** | Raw JSON `["FIGHTER","RANGER","CLERIC"]` rendered in Oakhaven Market; Watcher's Board warrants showed `undefined` titles/regions and `"a Assassin Vine"` grammar; top HUD truncated `"VAELEN IRONHAND"` into `"VAELEN IRONHA..."`. | **FIXED & TESTED** |

---

## 2. Independent Verification of Phase 6 Claims

### 2.1 Canonical Domain Integration (`src/domain/*`)
We inspected `action-ui-lab/server/controllers/*` and `action-ui-lab/server/services/*` to verify whether Adventure Lab uses canonical domain modules or mock stubs:
- **Authentication:** Uses canonical `registerUser` and `loginUser` from `src/domain/auth/service.js` (`bcryptjs` password hashing with 10 salt rounds and transparent upgrade bridge for legacy `'firebase-auth'` hashes via `src/firebase/token-verifier.js`).
- **Character Creation:** Uses canonical `createCharacter`, `validateCharacterCreation`, `getLivingCharacterByUserId`, `getEffectiveStats`, and `getHeroSavingThrows` from `src/domain/character/rules.js` together with `src/config/index.js` (`classBases` summing to 68 + 3 bonus points = strict 71-point pool, range `8..18`, class base HP, and `startingGold`).
- **Equipment & Market:** Uses canonical `equipItem`, `unequipItem`, `getCharacterEquipment`, and `getCharacterInventory` from `src/domain/character/rules.js` and `getCityStoreStock`, `buyItem`, and `sellItem` from `src/domain/economy/shop.js`.
- **Combat, Encounters & Permadeath:** Uses canonical `executeCombatRound` and `getCombatState` from `src/domain/combat/engine.js`, `checkTileEncounter`, `investigateEncounter`, and `ignoreEncounter` from `src/domain/encounters/engine.js`, and `handlePlayerDeath` / `handleMonsterDefeat` from `src/domain/monsters/persistence.js`.
- **Bounties & Rumors:** Uses canonical `getOrGenerateContracts`, `getActiveContractForCharacter`, `acceptContract`, `abandonContract`, `autoClaimCompletedBounties`, and `getWildernessThreats` from `src/domain/bounties/board.js`.

### 2.2 Investigation of the Critical Character Creation Contradiction
In Phase 6:
1. The Character Forge modal (`action-ui-lab/public/js/character/character-ui.js`) displayed the text: *"Submitting a new hero will retire the current active hero in this session."* and sent `retireCurrentHero: Boolean(char && char.is_alive)` in the `CREATE_CHARACTER` payload.
2. In `action-ui-lab/server/controllers/auth-character-controller.js`, `executeCreateCharacterForUser` checked `if (payload.retireCurrentHero)` and immediately ran `DELETE FROM characters WHERE id = ?` **before** calling `createCharacter(db, ...)`.
3. This caused two severe issues:
   - **Rule Violation:** Canonical `src/domain/character/rules.js` (`createCharacter`) enforces `One living character per account` (`HTTP 409 Conflict`) and has **no** retirement mechanic—heroes only leave active service through permadeath in combat.
   - **Destructive Bug:** If a player submitted invalid stats or an invalid name while `retireCurrentHero: true` was set, their existing living hero was permanently deleted from SQLite before `createCharacter` threw a `400 Bad Request` validation error!
4. **Resolution:** We removed the destructive `retireCurrentHero` deletion path from `executeCreateCharacterForUser` so the backend strictly enforces the canonical 1-living-character rule (`HTTP 409 Conflict`), and updated the Character Forge UI to display an explicit **Active Champion Lock Banner** with a disabled Forge button whenever the account already has a living champion.

---

## 3. Independent Reproduction of Baseline Suites

All baseline test suites and visual audits were executed independently and verified:
- **Legacy Test Suite (`npm test`):** `228/228` tests passing (`0` failures), confirming zero modifications or regressions in `src/` or `db/`.
- **Adventure Lab Test Suite (`node --test --test-concurrency=2 action-ui-lab/tests/*.test.js`):** `123/123` baseline tests + `7/7` new Phase 6.1 hardening tests = **`130/130` passing (`0` failures)**.
- **World Viewpoint Audit:** `640/640` viewpoints verified (`160` tiles × `4` directions), `Grade D = 0`, `Missing POV Assets = 0`.

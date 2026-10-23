# DARKGRID — PHASE 7C: IMPLEMENTATION REPORT

**Date:** 2026-10-23  
**Phase:** 7C — Cleric Divine Combat System  
**Playable Application:** `action-ui-lab` (`npm run start:lab`)

---

## 1. Architecture & Files Modified

Phase 7C was implemented across the canonical DarkGrid domain, database migrations, Express routes, and `action-ui-lab` client/server architecture without creating any duplicate standalone client:

### Database & Security
1. **[`db/migrations/015_phase7c_cleric_divine_combat.sql`](../../../../db/migrations/015_phase7c_cleric_divine_combat.sql)**
   - Added `divine_charges INTEGER DEFAULT NULL` to `characters`.
   - Backfilled existing living Clerics to $\max(1, 6 + \text{level} + \lfloor(\text{wisdom}-10)/2\rfloor)$ and non-Clerics/fallen characters to `0`.
2. **[`src/middleware/security.js`](../../../../src/middleware/security.js)**
   - Added `divine_charges` and `max_divine_charges` to `FORBIDDEN_CLIENT_FIELDS` to reject client tamper attempts with HTTP 400.
3. **[`action-ui-lab/server/services/legacy-compatibility-service.js`](../../server/services/legacy-compatibility-service.js)**
   - Added idempotent schema verification for `divine_charges` on startup.

### Domain Layer (`src/domain/`)
4. **[`src/domain/character/rules.js`](../../../../src/domain/character/rules.js)**
   - Implemented `calculateMaxDivineCharges`, `clampDivineCharges`, and `getClericDivineChargeInfo`.
   - Wired Divine Charge initialization into `createCharacter`, city-only recharge into `performCityRest` (alongside `cleric_heal_uses`), downward clamping into `equipItem` and `unequipItem`, and non-refill preservation into `reconcileCharacterHpOnLoad`, `spendAttributePoint`, and `applyCharacterLevelUp`.
5. **[`src/domain/combat/abilities.js`](../../../../src/domain/combat/abilities.js)**
   - Implemented `getClericBattlePrayerProfile`, `getClericSmiteProfile`, `getClericDivineShieldProfile`, and `applyDivineShieldMitigation`.
   - Extended `parseCombatStateJson` and `getPublicHeroStatusBadges` with `divineShieldTurns` and `divineShieldReduction`.
   - Integrated per-hit Divine Shield mitigation across monster special attacks (`elementalRider`, `rend`, `constrict`, `cooldownSpecial`, and stage-2 `calcify`), while ensuring stage-3 petrification (`calcifyInstantDeath`) is never prevented by Divine Shield.
6. **[`src/domain/combat/narrative.js`](../../../../src/domain/combat/narrative.js)**
   - Added `describeBattlePrayer`, `describeSmite`, and `describeDivineShield` using the exact required English descriptions and Hidden Math Policy prose.
7. **[`src/domain/combat/engine.js`](../../../../src/domain/combat/engine.js)**
   - Added `BATTLE_PRAYER`, `SMITE`, and `DIVINE_SHIELD` action execution to `executeCombatRound`.
   - Implemented `spendDivineChargesAtomically` using an atomic SQLite `UPDATE ... WHERE divine_charges >= ?`.
   - Enforced non-stacking (`DIVINE_SHIELD_ALREADY_ACTIVE`), class restriction (`CLERIC_ONLY_ACTION`), and mutual exclusion of Battle Prayer and Smite.
   - Applied Divine Shield damage reduction to monster multi-hit strikes (`getMonsterStrikeConfigs`) and Flee parting blows, decrementing `divineShieldTurns` once per monster turn.
8. **[`src/domain/combat/rules.js`](../../../../src/domain/combat/rules.js)**
   - Fixed 6-argument `calculateHeroAC(hero, equipment, isRangedActive, monster, activeWeapon, db)` parameter unpacking so `activeWeapon` is preserved when `db` is passed as the 6th argument.

### Server Controllers & Client State (`action-ui-lab/server/` & `src/routes/`)
9. **[`action-ui-lab/server/controllers/combat-controller.js`](../../server/controllers/combat-controller.js)** & **[`src/routes/game.js`](../../../../src/routes/game.js)**
   - Added `BATTLE_PRAYER`, `SMITE`, and `DIVINE_SHIELD` action routing, server-side charge & non-stacking validation, and combat sequence beat assembly.
10. **[`action-ui-lab/server/controllers/character-town-controller.js`](../../server/controllers/character-town-controller.js)**
    - Updated `handleRest` and `LAB_SCENARIO` handlers to report and reset Divine Charges accurately.
11. **[`action-ui-lab/server/services/combat-sequence-service.js`](../../server/services/combat-sequence-service.js)** & **[`action-ui-lab/server/services/client-state-service.js`](../../server/services/client-state-service.js)**
    - Added structured animation/FX cues (`DIVINE_PRAYER`, `DIVINE_SMITE`, `DIVINE_SHIELD`) and exposed `clericDivineInfo`, `divineCharges`, `maxDivineCharges`, and `divineShieldTurns` in the client state payload.

### Player UI (`action-ui-lab/public/` & `src/views/game.ejs`)
12. **[`action-ui-lab/public/index.html`](../../public/index.html)**, **[`action-ui-lab/public/js/character/character-ui.js`](../../public/js/character/character-ui.js)**, **[`action-ui-lab/public/js/combat/combat-ui.js`](../../public/js/combat/combat-ui.js)**, **[`action-ui-lab/public/js/world/navigation.js`](../../public/js/world/navigation.js)**, **[`action-ui-lab/public/js/combat/sequence.js`](../../public/js/combat/sequence.js)**, **[`action-ui-lab/public/js/ui/chronicle.js`](../../public/js/ui/chronicle.js)**, **[`action-ui-lab/public/js/ui/shortcuts.js`](../../public/js/ui/shortcuts.js)**, **[`action-ui-lab/public/js/app.js`](../../public/js/app.js)**, **[`action-ui-lab/public/css/combat.css`](../../public/css/combat.css)**, and **[`src/views/game.ejs`](../../../../src/views/game.ejs)**
    - Added Divine Charges display (`X / Y`) in the hero panel and combat deck, contextual Cleric combat buttons with clear cost badges (`1 Charge`, `2 Charges`), active Divine Shield duration indicator (`Active (2T)` / `Active (1T)`), disabled states when charges are insufficient or Divine Shield is already active, and radiant/healing/shield visual feedback.

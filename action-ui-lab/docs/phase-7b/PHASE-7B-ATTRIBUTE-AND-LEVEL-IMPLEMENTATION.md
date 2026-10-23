# DARKGRID — PHASE 7B: ATTRIBUTE AND LEVEL IMPLEMENTATION REPORT

**Date:** 2026-10-22  
**Authoritative Spec:** [`PHASE-7A4-FINAL-OWNER-DECISIONS.md`](../phase-7a4/PHASE-7A4-FINAL-OWNER-DECISIONS.md), [`PHASE-7A4-LEVELS-AND-CONSTITUTION.md`](../phase-7a4/PHASE-7A4-LEVELS-AND-CONSTITUTION.md)  
**Primary Modules:** [`src/config/index.js`](../../../src/config/index.js), [`src/domain/character/rules.js`](../../../src/domain/character/rules.js)

---

## 1. Free 72-Point Starting Attribute Allocation

Character Creation now uses the approved Phase 7A.3 / 7B free point-buy system:
- **Total Pool:** `72` attribute points (`config.statRules.totalSum = 72`, `requiredTotalSum = 72`).
- **Per-Attribute Creation Bounds:** Minimum `8`, Maximum `18` (`8 <= S_a <= 18`).
- **Class Presets (Default Starting Allocations summing to 72):**
  - **Fighter:** `STR 14, CON 14, DEX 12, INT 10, WIS 12, CHA 10` (`72` total)
  - **Ranger:** `STR 10, CON 12, DEX 16, INT 10, WIS 14, CHA 10` (`72` total)
  - **Cleric:** `STR 12, CON 12, DEX 10, INT 10, WIS 16, CHA 12` (`72` total)
- **Persistence:** On creation, [`createCharacter`](../../../src/domain/character/rules.js) persists the chosen 6 attributes, sets `attribute_points = 0`, and records `initial_attributes_json` on the `characters` row.

---

## 2. Milestone Attribute Growth (`Levels 2, 4, 6, 8, 10`)

- **Milestones:** `ATTRIBUTE_MILESTONE_LEVELS = [2, 4, 6, 8, 10]`.
- **Level-Up Award (`countMilestoneAttributePointsEarned` & `applyCharacterLevelUp`):**
  - Whenever a hero's level increases from `oldLevel` to `newLevel`, `countMilestoneAttributePointsEarned(oldLevel, newLevel)` counts every milestone crossed in `(oldLevel, newLevel]` and atomically adds that count to `characters.attribute_points`.
  - Handles multi-level jumps (e.g., `L2 -> L6` awards `+2` points for crossing `L4` and `L6`) and prevents duplicate awards if `applyCharacterLevelUp` is called again at the same level.
- **Spending Attribute Points (`spendAttributePoint`):**
  - Accepts any of the 6 attributes (`STR`, `DEX`, `CON`, `INT`, `WIS`, `CHA` or full lowercase names).
  - Enforces server-side guards inside a SQLite transaction:
    1. Living character check (`is_alive === 1`).
    2. Out-of-combat check (rejects with `409 COMBAT_LOCKED_ATTRIBUTES` if an encounter is `DISCOVERED` or `IN_COMBAT`).
    3. Positive balance check (`attribute_points > 0`) with atomic `WHERE id = ? AND is_alive = 1 AND attribute_points > 0` update to prevent race-condition double-spending.
  - **No Post-Creation 18 Cap:** The Level 1 creation maximum of `18` is strictly a creation-time validation rule; milestone points and equipment bonuses freely raise attributes to `19, 20, 21, 22, 23+` using standard modifier math $\lfloor(\text{score}-10)/2\rfloor$.

---

## 3. Open-Ended Level Progression (No Maximum Level)

- **Design Rule Preserved:** Darkgrid has **no approved maximum character level**. Levels `1–10` are the currently documented XP progression range in `FAST_XP_TABLE`, not a permanent level cap.
- **All Mathematical Functions Accept `level > 10`:**
  - `calculateCanonicalMaxHp(level, charClass, effectiveConMod)` scales linearly for any $L \ge 1$.
  - `getLevelAttackBonus(charClass, level)` uses `level` for `FIGHTER`/`RANGER` and `Math.ceil(level * 3 / 4)` for `CLERIC` for any $L \ge 1$.
  - `calculateSavingThrows` / `getHeroSavingThrows` uses $2 + \lfloor L/2 \rfloor$ (good save) and $\lfloor L/3 \rfloor$ (poor save) for any $L \ge 1$.
  - Class passives (`getFighterBattleHardenedBonus`, `getFighterWeaponTraining`, `getFighterArmorTrainingMaxDexBonus`, `getRangerFavoredEnemyBonus`, `getClericSacredKnowledgeBonus`, `getClericTurnUndeadProfile`) use open-ended `level >= threshold` checks with zero `level <= 10` ceilings.
- **Flat INT XP Scaling Disabled (`OD-7A4-05`):**
  - `calculateXpWithIntelligence(baseXp, intelligence)` returns flat `Math.max(1, Math.floor(baseXp))` so Intelligence governs tactical Battle Experience damage rather than inflating XP gain.

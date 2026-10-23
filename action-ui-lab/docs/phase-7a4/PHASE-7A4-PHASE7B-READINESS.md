# DARKGRID — PHASE 7A.4: PHASE 7B IMPLEMENTATION READINESS PLAN

**Date:** 2026-10-22  
**Scope:** Phase 7A.4 — Final Phase 7B Implementation Architecture, Dependency Checks, Test Plan, and Readiness Verdict  
**Status:** **100% LOCKED & READY FOR PHASE 7B IMPLEMENTATION (Zero Open Questions)**  
**Supersedes:** [`PHASE-7A3-PHASE7B-ROADMAP.md`](../phase-7a3/PHASE-7A3-PHASE7B-ROADMAP.md) and earlier drafts of `PHASE-7A4-PHASE7B-READINESS.md`

---

## 1. Phase 7B Readiness Verdict

**VERDICT: 100% READY FOR PHASE 7B IMPLEMENTATION — ZERO OPEN DESIGN QUESTIONS REMAINING.**

All owner decisions (`OD-7A4-01` through `OD-7A4-08`, including `OC-1` Option A, `OC-2` Option B, `OC-3` Option A, and the new Equipment CON vs. Permanent CON rule) are locked. All database schemas, formulas, and combat engine hooks are reconciled against the live codebase (`src/`, `action-ui-lab/`, `db/migrations/001`–`013`, `db/seeds/001`–`010`) with **zero** hardcoded Level 10 caps or global attribute ceilings.

---

## 2. Dependency & Pre-Flight Codebase Check

1. **Migration Sequence:**
   - Existing migrations in `db/migrations/` run from `001_initial_schema.sql` through `013_production_blaze_hardening.sql`.
   - The Phase 7B schema migration must be named:
     **`db/migrations/014_phase7b_taxonomy_attributes_and_battle_experience.sql`**
2. **Seed Sequence & Monster `#36 Mummy` Integrity:**
   - Existing seeds in `db/seeds/` run from `001_seed_world.sql` through `010_seed_night_work_loot_and_30_monsters.sql` (`98` monsters total).
   - Monster `#36 Mummy` retains 100% of its existing combat statistics per Owner Decision `OD-7A4-07 (P5)`.
3. **Open Level Progression Guardrails:**
   - `FAST_XP_TABLE` in [`src/domain/character/rules.js:7–18`](../../../src/domain/character/rules.js#L7-L18) remains the currently configured XP table (`L1–L10`), while all HP, BAB, saving throw, class passive, and combat formulas use open-ended `level >= threshold` checks with no `level <= 10` or `score <= 23/25` restrictions. No unapproved post-L10 milestones or abilities are added.

---

## 3. Step-by-Step Phase 7B Implementation Plan

### Step 1: SQLite Migration `014_phase7b_taxonomy_attributes_and_battle_experience.sql`
Create `db/migrations/014_phase7b_taxonomy_attributes_and_battle_experience.sql`:

1. **Monster Family Taxonomy Column (`monsters` table):**
   - Add `monster_family TEXT NOT NULL DEFAULT 'ANIMALS'`.
   - Populate all `98` monsters with their exact `monster_family` value across the 22 locked families (`ANIMALS`, `LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS`, `ARACHNIDS`, `VERMIN_INSECTS`, `DANGEROUS_PLANTS`, `DRAGONS_DRAKES`, `GOBLINOIDS`, `ORCS`, `GNOLLS`, `REPTILIAN_HUMANOIDS`, `AMPHIBIAN_HUMANOIDS`, `TROLLS`, `GIANTS`, `FEY`, `MONSTROUS_HUMANOIDS`, `ABERRATIONS`, `SUBTERRANEAN_HUMANOIDS`, `OOZES`, `CONSTRUCTS`, `UNDEAD`).
   - Add index `idx_monsters_family ON monsters(monster_family)`.
2. **Character Progression & Ranger Family Columns (`characters` table):**
   - Add `attribute_points INTEGER NOT NULL DEFAULT 0`.
   - Add `initial_attributes_json TEXT DEFAULT NULL`.
   - Add `favored_enemy_family TEXT DEFAULT NULL` (preserving `favored_enemy_type` and `favored_enemy_subtype` for legacy Rangers).
3. **Per-Character Battle Experience Table (`character_monster_knowledge`):**
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
   ```
4. **Combat Session Second Wind State (`combat_sessions` table):**
   - Add `second_wind_used INTEGER NOT NULL DEFAULT 0` to `combat_sessions` (and/or persist inside `combat_state_json`).

---

### Step 2: Open Level Progression, Equipment CON vs. Permanent CON & Level-Up Rules ([`src/domain/character/rules.js`](../../../src/domain/character/rules.js))
1. **Standardize Cleric BAB (`getBaseAttackBonus`, [`rules.js:84–94`](../../../src/domain/character/rules.js#L84-L94)):**
   - Update `CLERIC` branch to `Math.ceil(lvl * 3 / 4)` for any `lvl >= 1`.
2. **Generalize `getEffectiveStats(character, equipment)` ([`rules.js:918–958`](../../../src/domain/character/rules.js#L918-L958)):**
   - Sum `strength_bonus`, `dexterity_bonus`, `constitution_bonus`, `intelligence_bonus`, `wisdom_bonus`, and `charisma_bonus` across all 9 equipped slots (`MELEE`, `RANGED`, `ARMOR`, `SHIELD`, `RING`, `CLOAK`, `NECK`, `BELT`, `FEET`).
   - Recompute all 6 effective modifiers via `calculateModifier(score)` (`Math.floor((score - 10) / 2)`) with **no** upper score cap.
3. **Implement Closed-Form `calculateCanonicalMaxHp(level, charClass, effectiveConMod)`:**
   - Compute $\max\big(L,\; H_1(c) + (L - 1)H_{\text{lvl}}(c) + B_{\text{class}}(L, c) + L \times M_{\text{con}}\big)$ where Fighter $B_{\text{class}}(L) = 1 + L$ for $1 \le L \le 4$ and $2L$ for $L \ge 5$ (open-ended).
4. **Enforce Strict Separation of Equipment CON vs. Permanent CON (`OD-7A4-02`):**
   - **Rule A — Equipment CON (`equipItem`, `unequipItem`, slot swap):**
     - Guard that character is alive (`is_alive === 1`) and **not** in active combat (`COMBAT_LOCKED_EQUIPMENT`).
     - Recompute `newMaxHp = calculateCanonicalMaxHp(level, charClass, newEffectiveConMod)`.
     - Set `newCurrentHp = Math.max(1, Math.min(oldCurrentHp, newMaxHp))` (**never** increases `current_hp` on equip; clamps down to `newMaxHp` on unequip with `1 HP` floor).
   - **Rule B — Permanent CON (`spendAttributePoint` on `constitution`):**
     - Guard that character is alive (`is_alive === 1`) and `attribute_points > 0`.
     - Increment permanent `constitution` by `1` (no `18` or `23` ceiling), decrement `attribute_points` by `1`.
     - Recompute `newMaxHp = calculateCanonicalMaxHp(level, charClass, newEffectiveConMod)`.
     - Let `hpDelta = Math.max(0, newMaxHp - oldMaxHp)`.
     - Set `newCurrentHp = Math.max(1, Math.min(newMaxHp, oldCurrentHp + hpDelta))` (adds exact HP gain when $\Delta M_{\text{con}} > 0$; `+0 HP` when $\Delta M_{\text{con}} === 0$).
   - **Rule C — Level-Up (`checkAndApplyLevelUp`, [`rules.js:972–1053`](../../../src/domain/character/rules.js#L972-L1053)):**
     - Award `+1` `attribute_points` for each milestone level crossed in `{2, 4, 6, 8, 10}`.
     - Add $\Delta \text{MaxHP}_{\text{level}} = \text{newMaxHp} - \text{oldMaxHp}$ to both `max_hp` and `current_hp` without a full heal.
   - **Rule D — Login / Reload Reconciliation:**
     - Recompute `MaxHP_canonical`, set `max_hp = MaxHP_canonical`, and clamp `current_hp = Math.max(1, Math.min(oldCurrentHp, MaxHP_canonical))` for living heroes (`0` if `is_alive === 0`). Never add `+\Delta MaxHP` on login.

---

### Step 3: Ranger 14-Family Taxonomy (`OC-1` Option A) & Favored Enemy Bonuses (`OC-3` Option A) ([`src/domain/character/rules.js`](../../../src/domain/character/rules.js))
1. **Export Locked Taxonomy Constants (`OC-1` Option A):**
   - `INITIAL_SELECTABLE_RANGER_FAMILIES` (`14` families): `ANIMALS`, `LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS` (UI label: **"Other Magical Beasts"**), `ARACHNIDS`, `VERMIN_INSECTS`, `DANGEROUS_PLANTS`, `DRAGONS_DRAKES`, `GOBLINOIDS`, `ORCS`, `GNOLLS`, `REPTILIAN_HUMANOIDS`, `TROLLS`, `GIANTS`.
   - `RESERVED_RANGER_FAMILIES` (`5` families): `FEY`, `AMPHIBIAN_HUMANOIDS`, `MONSTROUS_HUMANOIDS`, `ABERRATIONS`, `SUBTERRANEAN_HUMANOIDS`.
   - `NON_SELECTABLE_RANGER_FAMILIES` (`2` families): `OOZES`, `CONSTRUCTS`.
   - `FORBIDDEN_RANGER_FAMILIES` (`1` family): `UNDEAD` (`RANGER_FAVORED_ENEMY_FORBIDDEN`).
2. **Update `getFavoredEnemyBonuses(character, monster)` (`OC-3` Option A):**
   - `level <= 3`: `{ attackBonus: 2, damageBonus: 2, acBonus: 0 }`
   - `level <= 7` (`4–7`): `{ attackBonus: 3, damageBonus: 3, acBonus: 0 }`
   - `level === 8`: `{ attackBonus: 4, damageBonus: 4, acBonus: 0 }`
   - `level >= 9`: `{ attackBonus: 4, damageBonus: 4, acBonus: 2 }`
   - Do **not** expand critical hit range.
3. **Backward-Compatible `doesMonsterMatchFavoredEnemy(character, monster)`:**
   - Match `monster.monster_family === character.favored_enemy_family` for new Rangers, or fall back to legacy `favored_enemy_type` / `favored_enemy_subtype` for existing Rangers (`favored_enemy_family IS NULL`).
4. **Implement Class Passive Knowledge Evaluators:**
   - Fighter `doesMonsterMatchKnowYourEnemy(monster)` (`25` monsters).
   - Ranger `doesMonsterMatchNaturalKnowledge(monster)` (`52` monsters across the 8 natural families).
   - Cleric `doesMonsterMatchSacredKnowledge(monster)` (`11` `UNDEAD` monsters).

---

### Step 4: INT/WIS Battle Experience Engine (`src/domain/combat/knowledge.js` & [`engine.js`](../../../src/domain/combat/engine.js))
1. **Create `src/domain/combat/knowledge.js`:**
   - Implement `computeBattleExperienceModifiers({ effectiveInt, effectiveWis, victories, hasClassExemption })` using the exact owner-approved table (`INT 18+` $\rightarrow$ `+2 Dmg` at 1–2 kills, `+4 Dmg` at 3+ kills; `WIS 18+` $\rightarrow$ `+2 AC` at 1–2 kills, `+3 AC` at 3+ kills; low-INT/WIS Tier 0 unfamiliar penalties cleared at 1 kill or bypassed by `hasClassExemption`).
2. **Wire into Combat Engine ([`src/domain/combat/engine.js`](../../../src/domain/combat/engine.js)):**
   - Increment `encounters` in `startCombat`; increment `victories` **only on lethal combat victory** (`monsterHp <= 0` and `playerHp > 0`).

---

### Step 5: Fighter *Second Wind* Automatic Trigger (`OC-2` Option B) ([`src/domain/combat/abilities.js`](../../../src/domain/combat/abilities.js) & [`engine.js`](../../../src/domain/combat/engine.js))
1. **Implement `evaluateAndApplySecondWind(combatState, character, effectiveStats, triggerSource, rng)` (`OC-2` Option B):**
   - Check `character.class === 'FIGHTER'`, `character.level >= 3`, `!combatState.secondWindUsed`, and `triggerSource !== 'CALCIFY'`.
   - Tier progression (Option B):
     - `level >= 3 && level <= 5` (Tier I): `1d10 + level + conMod`
     - `level >= 6 && level <= 9` (Tier II): `2d10 + level + conMod`
     - `level >= 10` (Tier III): `3d10 + level + conMod` + cleanse 1 physical status effect (`BLEED` or `POISON`, prioritizing `BLEED`).
   - Trigger when `playerHp <= 0` (lethal rescue: reset to `0` before adding heal roll) or `playerHp <= Math.floor(maxHp * 0.25)`.
   - Place hooks **after** the complete monster multi-hit/rider sequence ([`engine.js:835`](../../../src/domain/combat/engine.js#L835)) and inside `resolveEndOfRoundStatusTicks` ([`engine.js:892`](../../../src/domain/combat/engine.js#L892)) after Poison/Bleed DoT ticks.

---

## 4. Required Automated Verification Suite (`npm test`)

Phase 7B must add automated tests covering:
1. **All 10 Mandatory CON & Equipment Scenarios (per Owner Section 4.D):**
   - (1) Equip/unequip without free healing (`35/60 -> 35/67 -> heal 20 -> 55/67 -> unequip -> 55/60 -> re-equip -> 55/67`; `67/67 -> unequip -> 60/60 -> re-equip -> 60/67`).
   - (2) Equipment swap with unchanged CON modifier (`55/67 -> 55/67`).
   - (3) Removal when Current HP is very low (`1/67 -> 1/60` and `5/67 -> 5/60`; never `< 1 HP`).
   - (4) Removal when Current HP exceeds new Max HP (`65/67 -> 60/60`).
   - (5) Permanent CON increase (`35/60 -> 42/67` on modifier `+2 -> +3`; `35/60 -> 35/60` on even-to-odd `CON 14 -> 15`).
   - (6) Level-up (`L6 -> L7` adds $\Delta \text{MaxHP}_{\text{level}}$ to both `max_hp` and `current_hp` without full heal).
   - (7) Login/reload reconciliation without accidental healing (`35/67` and `60/67` stay `35/67` and `60/67` on reload).
   - (8) Permadeath and dead heroes (`is_alive = 0` keeps `current_hp = 0` and blocks equip/unequip/spendAttributePoint).
   - (9) Multiple CON items simultaneously across all 9 slots.
   - (10) No equipment changes during active combat (`COMBAT_LOCKED_EQUIPMENT`).
2. **No-Level-Cap & Open Formula Tests:** Verify formulas at Levels `1, 5, 10, 12, 15, 20` and attribute scores `18, 23, 25, 28`.
3. **Ranger 22-Family Taxonomy (`OC-1` Option A) & Favored Enemy Bonus (`OC-3` Option A) Tests:**
   - Verify all `98` monsters have a valid `monster_family`, `14` initial families (`FEY` and `AMPHIBIAN_HUMANOIDS` reserved), `"Other Magical Beasts"` UI label for `TERRESTRIAL_MAGICAL_BEASTS`, `UNDEAD` (`11` monsters) forbidden (`RANGER_FAVORED_ENEMY_FORBIDDEN`), legacy Ranger compatibility, and `OC-3` Option A bonuses (`+2/+2`, `+3/+3`, `+4/+4`, `+4/+4/+2 AC` with no crit expansion).
4. **Fighter Second Wind (`OC-2` Option B) Tests:**
   - Verify unavailable at `L1–2`, Tier I (`1d10`) at `L3–5`, Tier II (`2d10`) at `L6–9`, Tier III (`3d10` + cleanse) at `L10+`, post-sequence multi-hit ordering, lethal rescue from `0 HP`, DoT rescue, and `CALCIFY` exclusion.
5. **Battle Experience & Monster `#36 Mummy` Integrity Tests:**
   - Verify full INT/WIS table without nerfs, victories-only progression, class exemptions, permadeath isolation, and untouched `#36 Mummy` stats.

# DARKGRID — PHASE 7A.4: FINAL PHASE 7B READINESS & IMPLEMENTATION SPECIFICATION

**Date:** 2026-10-22  
**Scope:** Phase 7A.4 Final Corrections — Complete Blueprint of Required Phase 7B Code Changes, Database Migrations, Safety Guards, and Automated Tests  
**Status:** **100% READY FOR PHASE 7B IMPLEMENTATION**  
**Related Documents:**
- [`PHASE-7A4-FINAL-OWNER-DECISIONS.md`](./PHASE-7A4-FINAL-OWNER-DECISIONS.md)
- [`PHASE-7A4-FINAL-CONSISTENCY-AUDIT.md`](./PHASE-7A4-FINAL-CONSISTENCY-AUDIT.md)
- [`PHASE-7A4-PHASE7B-READINESS.md`](./PHASE-7A4-PHASE7B-READINESS.md)
- [`PHASE-7A4-RANGER-TAXONOMY.md`](./PHASE-7A4-RANGER-TAXONOMY.md)
- [`PHASE-7A4-LEVELS-AND-CONSTITUTION.md`](./PHASE-7A4-LEVELS-AND-CONSTITUTION.md)

---

## 1. Readiness Verdict

**FINAL VERDICT: 100% READY FOR PHASE 7B IMPLEMENTATION.**

- **Locked Decisions:** All owner decisions (`OC-1` Option A, `OC-2` Option B, `OC-3` Option A, Equipment CON vs. Permanent CON vs. Level-up, No Maximum Level, and preserved systems) are 100% locked.
- **Zero Open Questions:** No pending `P1`–`P5` or `OC-1`–`OC-3` design questions remain.
- **No Code/DB Changes Performed in Phase 7A.4:** Per owner instructions, Phase 7A.4 modified only design documentation in `action-ui-lab/docs/phase-7a4/`. All production code and SQLite migrations below are ready for execution in Phase 7B.

---

## 2. Exact Code & Database Changes Required in Phase 7B

### 2.1 Database Schema Migration (`db/migrations/014_phase7b_taxonomy_attributes_and_battle_experience.sql`)
1. **`monsters` Table:**
   - `ALTER TABLE monsters ADD COLUMN monster_family TEXT NOT NULL DEFAULT 'ANIMALS';`
   - Populate `monster_family` across all `98` monsters using the 22 locked family keys (`ANIMALS`, `LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS`, `ARACHNIDS`, `VERMIN_INSECTS`, `DANGEROUS_PLANTS`, `DRAGONS_DRAKES`, `GOBLINOIDS`, `ORCS`, `GNOLLS`, `REPTILIAN_HUMANOIDS`, `AMPHIBIAN_HUMANOIDS`, `TROLLS`, `GIANTS`, `FEY`, `MONSTROUS_HUMANOIDS`, `ABERRATIONS`, `SUBTERRANEAN_HUMANOIDS`, `OOZES`, `CONSTRUCTS`, `UNDEAD`).
   - Create index `CREATE INDEX IF NOT EXISTS idx_monsters_family ON monsters(monster_family);`.
2. **`characters` Table:**
   - `ALTER TABLE characters ADD COLUMN attribute_points INTEGER NOT NULL DEFAULT 0;`
   - `ALTER TABLE characters ADD COLUMN initial_attributes_json TEXT DEFAULT NULL;`
   - `ALTER TABLE characters ADD COLUMN favored_enemy_family TEXT DEFAULT NULL;` (retaining `favored_enemy_type` and `favored_enemy_subtype` for legacy Rangers).
3. **`character_monster_knowledge` Table:**
   - Create `character_monster_knowledge (character_id, monster_id, encounters, victories, first_seen_at, last_fought_at, PRIMARY KEY (character_id, monster_id))` with `ON DELETE CASCADE` foreign keys.
4. **`combat_sessions` Table:**
   - `ALTER TABLE combat_sessions ADD COLUMN second_wind_used INTEGER NOT NULL DEFAULT 0;`

---

### 2.2 Character Domain Logic ([`src/domain/character/rules.js`](../../../src/domain/character/rules.js))

1. **Open-Ended Formulas & Cleric BAB (`getBaseAttackBonus`, [`rules.js:84–94`](../../../src/domain/character/rules.js#L84-L94)):**
   - Update `CLERIC` BAB to `Math.ceil(lvl * 3 / 4)` for any `lvl >= 1`.
   - Ensure no formula clamps `level <= 10` or attribute scores `<= 23/25`.
2. **All-Slot Effective Attributes (`getEffectiveStats`, [`rules.js:918–958`](../../../src/domain/character/rules.js#L918-L958)):**
   - Aggregate `strength_bonus`, `dexterity_bonus`, `constitution_bonus`, `intelligence_bonus`, `wisdom_bonus`, and `charisma_bonus` across all 9 equipped slots (`MELEE`, `RANGED`, `ARMOR`, `SHIELD`, `RING`, `CLOAK`, `NECK`, `BELT`, `FEET`) and compute all 6 modifiers (`str_mod`, `dex_mod`, `con_mod`, `int_mod`, `wis_mod`, `cha_mod`).
3. **Closed-Form Canonical Max HP (`calculateCanonicalMaxHp(level, charClass, effectiveConMod)`):**
   - Implement $\max\big(L,\; H_1(c) + (L - 1)H_{\text{lvl}}(c) + B_{\text{class}}(L, c) + L \times M_{\text{con}}\big)$ where Fighter $B_{\text{class}}(L) = 1 + L$ for $1 \le L \le 4$ and $2L$ for $L \ge 5$.
4. **Equipment CON vs. Permanent CON vs. Level-Up vs. Login Reconciliation (`OD-7A4-02`):**
   - **`equipItem(db, characterId, inventoryItemId)` ([`rules.js:695`](../../../src/domain/character/rules.js#L695)) & `unequipItem(db, characterId, slot)` ([`rules.js:792`](../../../src/domain/character/rules.js#L792)):**
     - Reject if `character.is_alive === 0` (`CHARACTER_DEAD`).
     - Reject if character has an active combat session (`COMBAT_LOCKED_EQUIPMENT`).
     - Inside the atomic SQLite transaction, compute `newMaxHp = calculateCanonicalMaxHp(level, charClass, newEffectiveConMod)` after the equip/unequip/swap, and set:
       ```js
       const newCurrentHp = Math.max(1, Math.min(character.current_hp, newMaxHp));
       ```
       *(Never increases `current_hp` on equip; clamps down to `newMaxHp` on unequip with `1 HP` floor).*
   - **`spendAttributePoint(db, characterId, attributeName)` (New Function):**
     - Reject if `character.is_alive === 0` or `character.attribute_points <= 0`.
     - Increment permanent attribute column by `+1` and decrement `attribute_points` by `1`.
     - If `attributeName === 'constitution'`, compute `oldMaxHp` and `newMaxHp`, let `hpDelta = Math.max(0, newMaxHp - oldMaxHp)`, and set:
       ```js
       const newCurrentHp = Math.max(1, Math.min(newMaxHp, character.current_hp + hpDelta));
       ```
   - **`checkAndApplyLevelUp(db, characterId)` ([`rules.js:972–1053`](../../../src/domain/character/rules.js#L972-L1053)):**
     - Award `+1` `attribute_points` for each milestone level crossed in `{2, 4, 6, 8, 10}`.
     - Compute `newMaxHp` at `newLevel`, let `levelHpDelta = Math.max(0, newMaxHp - oldMaxHp)`, and set `newCurrentHp = Math.min(newMaxHp, character.current_hp + levelHpDelta)`.
   - **`reconcileCharacterHpOnLoad(db, character, equipment)` (Login / Reload Reconciliation):**
     - Compute `canonicalMaxHp = calculateCanonicalMaxHp(character.level, character.class, effectiveStats.con_mod)`.
     - Set `max_hp = canonicalMaxHp` and `current_hp = character.is_alive ? Math.max(1, Math.min(character.current_hp, canonicalMaxHp)) : 0` (**never** add `canonicalMaxHp - character.max_hp` to `current_hp`).
5. **Ranger Taxonomy (`OC-1` Option A) & Favored Enemy Bonuses (`OC-3` Option A):**
   - Export `INITIAL_SELECTABLE_RANGER_FAMILIES` (`14` Option A families, with `TERRESTRIAL_MAGICAL_BEASTS` labeled **"Other Magical Beasts"**; `FEY` and `AMPHIBIAN_HUMANOIDS` in `RESERVED_RANGER_FAMILIES`; `UNDEAD` in `FORBIDDEN_RANGER_FAMILIES`).
   - Update `getFavoredEnemyBonuses(character, monster)` ([`rules.js:150`](../../../src/domain/character/rules.js#L150)) to Option A:
     - `L1–3`: `+2 Atk / +2 Dmg / 0 AC`
     - `L4–7`: `+3 Atk / +3 Dmg / 0 AC`
     - `L8`: `+4 Atk / +4 Dmg / 0 AC`
     - `L9+`: `+4 Atk / +4 Dmg / +2 AC`
     - No expanded Critical Hit range.
   - Implement `doesMonsterMatchFavoredEnemy(character, monster)` (`favored_enemy_family` match with legacy fallback to `favored_enemy_type` / `favored_enemy_subtype`).
   - Implement class passive knowledge evaluators (`doesMonsterMatchKnowYourEnemy`, `doesMonsterMatchNaturalKnowledge`, `doesMonsterMatchSacredKnowledge`) and their level-scaled bonuses.

---

### 2.3 Combat Engine & Abilities (`src/domain/combat/knowledge.js`, [`abilities.js`](../../../src/domain/combat/abilities.js), [`engine.js`](../../../src/domain/combat/engine.js))

1. **INT/WIS Battle Experience (`src/domain/combat/knowledge.js` & [`engine.js`](../../../src/domain/combat/engine.js)):**
   - Implement `computeBattleExperienceModifiers({ effectiveInt, effectiveWis, victories, hasClassExemption })` with the full un-nerfed Phase 7A.3/7A.4 table (`INT 18+` $\rightarrow$ `+2 Dmg` at 1–2 kills, `+4 Dmg` at 3+ kills; `WIS 18+` $\rightarrow$ `+2 AC` at 1–2 kills, `+3 AC` at 3+ kills).
   - Increment `encounters` in `startCombat`; increment `victories` **only** when `monsterHp <= 0 && playerHp > 0`.
2. **Fighter *Second Wind* (`OC-2` Option B in [`abilities.js`](../../../src/domain/combat/abilities.js) & [`engine.js`](../../../src/domain/combat/engine.js)):**
   - Implement `evaluateAndApplySecondWind` for `FIGHTER` at `level >= 3`:
     - `level 3–5` (Tier I): `1d10 + level + conMod`
     - `level 6–9` (Tier II): `2d10 + level + conMod`
     - `level >= 10` (Tier III): `3d10 + level + conMod` + cleanse 1 active physical status (`BLEED` or `POISON`, prioritizing `BLEED`).
   - Hook **after** the complete monster multi-hit/rider loop ([`engine.js:835`](../../../src/domain/combat/engine.js#L835)) and inside `resolveEndOfRoundStatusTicks` ([`engine.js:892`](../../../src/domain/combat/engine.js#L892)) after Poison/Bleed DoT ticks.
   - If `playerHp <= 0`, reset to `0` before adding heal (`Math.min(maxHp, 0 + healRoll)`). Never trigger on `CALCIFY` petrification.

---

### 2.4 Controllers & UI (`action-ui-lab/server/controllers/` & `action-ui-lab/public/` / `src/views/`)
1. **`auth-character-controller.js`:** Accept `favored_enemy_family` from the 14 Option A initial categories (displaying `"Other Magical Beasts"` for `TERRESTRIAL_MAGICAL_BEASTS` and rejecting `UNDEAD` with `RANGER_FAVORED_ENEMY_FORBIDDEN`).
2. **`character-town-controller.js`:** Add `POST /api/character/attributes/spend` calling `spendAttributePoint`, and ensure `equip` / `unequip` endpoints reject mutations during active combat (`409 Conflict`).
3. **Player UI Secrecy:** Keep all exact numerical bonuses from *Know Your Enemy*, *Natural Knowledge*, *Sacred Knowledge*, *Favored Enemy*, *Battle Experience*, and *Second Wind* hidden from the player UI; display only English narrative prose, qualitative mastery tiers, and `Second Wind: Ready / Spent`.

---

## 3. Comprehensive Automated Test Suite Required for Phase 7B (`npm test`)

### 3.1 Ten Mandatory Constitution & Equipment Safety Tests (Owner Section 4.D)
1. **Test 1 — Equip / Unequip Without Free Healing:**
   - Level 7 Ranger (`CON 14`, mod `+2`) at `35/60 HP` equips `+2 CON` item $\rightarrow$ `35/67 HP`. Heals `20` $\rightarrow$ `55/67 HP`. Unequips $\rightarrow$ `55/60 HP`. Re-equips $\rightarrow$ `55/67 HP`.
   - At `67/67 HP`, unequips `+2 CON` item $\rightarrow$ `60/60 HP`. Re-equips $\rightarrow$ `60/67 HP`.
2. **Test 2 — Equipment Swap With Unchanged CON Modifier:**
   - Hero at `55/67 HP` swaps Belt A (`+2 CON`) directly for Belt B (`+2 CON`) $\rightarrow$ remains at `55/67 HP` (and at `67/67 HP` remains at `67/67 HP`).
3. **Test 3 — Removal When Current HP Is Very Low (`1 HP` Safety Floor):**
   - Hero at `1/67 HP` or `5/67 HP` unequips `+2 CON` item ($\text{newMaxHp} = 60$) $\rightarrow$ remains alive at `1/60 HP` or `5/60 HP` (never drops to `0 HP` or dies).
4. **Test 4 — Removal When Current HP Exceeds New Max HP:**
   - Hero at `65/67 HP` unequips `+2 CON` item ($\text{newMaxHp} = 60$) $\rightarrow$ clamped to `60/60 HP`; re-equipping gives `60/67 HP`.
5. **Test 5 — Permanent CON Increase (`spendAttributePoint`):**
   - Level 7 Ranger at `35/60 HP` (`CON 15 -> 16`, mod `+2 -> +3`) spends attribute point $\rightarrow$ **`42/67 HP`** (`+7` to both `Max HP` and `Current HP`, not a full heal).
   - Level 7 Ranger at `35/60 HP` (`CON 14 -> 15`, mod `+2 -> +2`) spends attribute point $\rightarrow$ **`35/60 HP`** (`+0 HP` when modifier does not change).
6. **Test 6 — Level-Up HP Gain:**
   - Wounded hero leveling from L6 to L7 gains $\Delta \text{MaxHP}_{\text{level}}$ on both `max_hp` and `current_hp` without receiving a free full heal.
7. **Test 7 — Login / Reload Without Accidental Healing:**
   - Hero at `35/67 HP` or `60/67 HP` (with `+2 CON` gear equipped) reloads/logs in repeatedly $\rightarrow$ remains at `35/67 HP` and `60/67 HP` (login reconciliation never mistakes equipment CON for permanent CON).
8. **Test 8 — Permadeath and Dead Heroes (`is_alive = 0`):**
   - Fallen hero (`is_alive = 0`, `current_hp = 0`) cannot equip, unequip, or spend attribute points, and login reconciliation keeps `current_hp === 0`.
9. **Test 9 — Multiple CON Items Simultaneously:**
   - Equipping `+1 CON` Ring + `+1 CON` Amulet + `+2 CON` Belt sums `+4 CON` across all slots before computing $M_{\text{con}}$; unequipping one item recalculates `newMaxHp` and clamps `current_hp` accurately.
10. **Test 10 — No Equipment Changes During Active Combat:**
    - Calling `equipItem` or `unequipItem` while character has an active `combat_sessions` row throws `COMBAT_LOCKED_EQUIPMENT`.

### 3.2 Taxonomy, Favored Enemy, Second Wind & Battle Experience Tests
11. **Ranger Taxonomy (`OC-1` Option A) & UI Name Tests:**
    - Verify all `98` monsters have a valid `monster_family`, `INITIAL_SELECTABLE_RANGER_FAMILIES` has exact `14` Option A keys (`FEY` and `AMPHIBIAN_HUMANOIDS` reserved; `TROLLS`, `GIANTS`, `DRAGONS_DRAKES` included), `TERRESTRIAL_MAGICAL_BEASTS` displays `"Other Magical Beasts"`, `UNDEAD` (`11` monsters) is rejected with `RANGER_FAVORED_ENEMY_FORBIDDEN`, and legacy Rangers remain compatible.
12. **Ranger Favored Enemy Bonus (`OC-3` Option A) Tests:**
    - Verify `L1–3` (`+2/+2/0`), `L4–7` (`+3/+3/0`), `L8` (`+4/+4/0`), `L9+` (`+4/+4/+2 AC`), no `19–20` Crit expansion, and additive stacking with *Natural Knowledge* and *Battle Experience*.
13. **Fighter Second Wind (`OC-2` Option B) Tests:**
    - Verify unavailable at `L1–2`, Tier I (`1d10+L+CON`) at `L3–5`, Tier II (`2d10+L+CON`) at `L6–9`, Tier III (`3d10+L+CON` + physical status cleanse) at `L10+`, post-sequence multi-hit ordering, lethal rescue from `0 HP`, end-of-round DoT rescue, and `CALCIFY` exclusion.
14. **Battle Experience & Monster `#36 Mummy` Integrity Tests:**
    - Verify full INT/WIS table without nerfs, victories-only progression, class specialization exemptions, permadeath isolation, open-ended level formulas (`L12, L15, L20`), and untouched `#36 Mummy` seed stats.

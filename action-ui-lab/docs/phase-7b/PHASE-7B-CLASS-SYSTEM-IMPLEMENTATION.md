# DARKGRID — PHASE 7B: CLASS SYSTEM IMPLEMENTATION REPORT

**Date:** 2026-10-22  
**Authoritative Spec:** [`PHASE-7A4-FINAL-OWNER-DECISIONS.md`](../phase-7a4/PHASE-7A4-FINAL-OWNER-DECISIONS.md) (`OC-1`, `OC-2`, `OC-3`, `OD-7A4-03`, `OD-7A4-04`), [`PHASE-7A4-RANGER-TAXONOMY.md`](../phase-7a4/PHASE-7A4-RANGER-TAXONOMY.md)  
**Primary Modules:** [`src/domain/character/rules.js`](../../../src/domain/character/rules.js), [`src/domain/combat/abilities.js`](../../../src/domain/combat/abilities.js), [`src/domain/combat/knowledge.js`](../../../src/domain/combat/knowledge.js), [`src/domain/combat/engine.js`](../../../src/domain/combat/engine.js)

---

## 1. Fighter Class System

### 1.1 Battle-Hardened (`getFighterBattleHardenedBonus`)
- **Levels 1–4:** `+(1 + Level)` Max HP, `+1` Fortitude Save.
- **Levels 5+:** `+(2 * Level)` Max HP, `+2` Fortitude Save, `+1` Will Save.

### 1.2 Weapon Training (`getFighterWeaponTraining`)
- **Levels 1–4:** `+0` Attack, `+0` Damage.
- **Levels 5–8:** `+1` Attack, `+1` Damage with all weapons.
- **Levels 9+:** `+2` Attack, `+2` Damage with all weapons.

### 1.3 Armor Training (`getFighterArmorTrainingMaxDexBonus`)
- **Levels 3–6:** Increases equipped armor's `max_dex_bonus` by `+1`.
- **Levels 7+:** Increases equipped armor's `max_dex_bonus` by `+2`.

### 1.4 Know Your Enemy (`getFighterKnowYourEnemyBonus`)
- Applies automatically against humanoid, giant, and martial humanoid families (`GOBLINOIDS`, `ORCS`, `GNOLLS`, `REPTILIAN_HUMANOIDS`, `TROLLS`, `GIANTS`, `AMPHIBIAN_HUMANOIDS`, `SUBTERRANEAN_HUMANOIDS`, `MONSTROUS_HUMANOIDS` excluding non-martial `Green Hag`, plus martial `Spriggan`).
- **Levels 1–4:** `+1` Attack, `+1` Damage.
- **Levels 5–8:** `+1` Attack, `+2` Damage, `+1` AC.
- **Levels 9+:** `+2` Attack, `+2` Damage, `+1` AC.

### 1.5 Second Wind — Option B (`tryTriggerFighterSecondWind` / `resolveFighterSecondWind`)
- **Trigger Condition:** Automatic once per combat (`secondWindUsed === false`) when Fighter's HP falls to `<= Math.floor(maxHp * 0.25)`, including `0 HP` lethal HP damage.
- **Tier Progression:**
  - **Levels 1–2:** Unavailable.
  - **Levels 3–5:** Heals `1d10 + Level + CON_mod`.
  - **Levels 6–9:** Heals `2d10 + Level + CON_mod`.
  - **Levels 10+:** Heals `3d10 + Level + CON_mod`, plus cleanses **1** active physical status condition (`BLEED` prioritized over `POISON`).
- **Combat Engine Integration (`src/domain/combat/engine.js`):**
  - Evaluates **after** the complete monster multi-hit and immediate damage-rider sequence (`resolveMonsterTurnSpecials` + all attacks + `resolveMonsterOnHitEffects`), and **after** end-of-round Poison/Bleed DoT ticks (`resolveEndOfRoundStatusTicks`).
  - Rescues the Fighter from `0 HP` (`currentHeroHp = Math.min(maxHp, healAmount)`) before permadeath triggers.
  - Strictly **does not** rescue non-HP instant petrification death from `CALCIFY` (`isCalcifiedKilled === true`).
  - Persists usage in `combat_state_json.secondWindUsed` and `encounters.second_wind_used`.

---

## 2. Ranger Class System

### 2.1 Favored Enemy Selection — 14 Initial Families (`OC-1` Option A)
- Character Creation presents the **14** approved initial monster families from [`src/domain/monsters/taxonomy.js`](../../../src/domain/monsters/taxonomy.js), including the 3 Magical Beast divisions (`LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, and `TERRESTRIAL_MAGICAL_BEASTS` labeled **"Other Magical Beasts"**).
- Enforces server-side rejection of the `5` reserved families (`FEY`, `AMPHIBIAN_HUMANOIDS`, `MONSTROUS_HUMANOIDS`, `ABERRATIONS`, `SUBTERRANEAN_HUMANOIDS`), the `2` non-selectable families (`OOZES`, `CONSTRUCTS`), and the `1` forbidden family (`UNDEAD`).
- Preserves backward compatibility for legacy Rangers via `normalizeRangerFavoredEnemy`.

### 2.2 Favored Enemy Bonuses — Option A (`getRangerFavoredEnemyBonus`)
- **Levels 1–3:** `+2` Attack, `+2` Damage, `+0` AC.
- **Levels 4–7:** `+3` Attack, `+3` Damage, `+0` AC.
- **Level 8:** `+4` Attack, `+4` Damage, `+0` AC.
- **Levels 9+:** `+4` Attack, `+4` Damage, `+2` AC.
- Critical hit range is **not** expanded (`20/x2` preserved).
- Stacks with Ranger *Natural Knowledge* and *INT/WIS Battle Experience*.

### 2.3 Natural Knowledge (`getRangerNaturalKnowledgeBonus`)
- Applies automatically against natural families (`ANIMALS`, `LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS`, `ARACHNIDS`, `VERMIN_INSECTS`, `DANGEROUS_PLANTS`, `DRAGONS_DRAKES`, `FEY`).
- **Levels 1–3:** `+1` Attack, `+1` Damage.
- **Levels 4–7:** `+1` Attack, `+2` Damage, `+1` AC.
- **Levels 8+:** `+2` Attack, `+2` Damage, `+1` AC.

### 2.4 Ranged Opening Shot & Keen Senses
- Preserves conditional Ranged Opening Shot (fires once before Round 1 when Ranger spots grounded enemy with ranged weapon equipped and is not ambushed; leaves monster at minimum `1 HP`).

---

## 3. Cleric Class System

### 3.1 Standardized Base Attack Bonus (`getLevelAttackBonus`)
- Standardized to `Math.ceil(level * 3 / 4)` across all levels (`L1: +1`, `L2: +2`, `L3: +3`, `L4: +3`, `L5: +4`, `L6: +5`, `L7: +6`, `L8: +6`, `L9: +7`, `L10: +8`).

### 3.2 Sacred Knowledge / Holy Radiance (`getClericSacredKnowledgeBonus`)
- Applies automatically against `UNDEAD`:
  - **Levels 1–4:** `+2` Attack, `+3` Damage, `+2` AC.
  - **Levels 5–8:** `+3` Attack, `+4` Damage, `+3` AC.
  - **Levels 9+:** `+4` Attack, `+5` Damage, `+4` AC.

### 3.3 Turn Undead (`getClericTurnUndeadProfile` & `resolveClericTurnUndead`)
- Automatic opening combat disruption against `UNDEAD` at combat start (`startCombat`):
  - **Levels 1–2:** `-1` Monster Attack on Round 1.
  - **Levels 3–6:** `-1` Monster Attack all rounds, `-1` Monster Damage on Round 1.
  - **Levels 7–9:** `1d6 + max(0, WIS_mod)` opening radiant disruption damage (minimum `1 HP` floor), `-2` Monster Attack all rounds.
  - **Levels 10+:** `2d6 + max(0, WIS_mod)` opening radiant disruption damage (minimum `1 HP` floor), `-3` Monster Attack on Round 1 (`-2` thereafter).

# DARKGRID — PHASE 7B: CONSTITUTION AND EQUIPMENT IMPLEMENTATION REPORT

**Date:** 2026-10-22  
**Authoritative Spec:** [`PHASE-7A4-FINAL-OWNER-DECISIONS.md`](../phase-7a4/PHASE-7A4-FINAL-OWNER-DECISIONS.md) (`OD-7A4-02`), [`PHASE-7A4-LEVELS-AND-CONSTITUTION.md`](../phase-7a4/PHASE-7A4-LEVELS-AND-CONSTITUTION.md)  
**Primary Module:** [`src/domain/character/rules.js`](../../../src/domain/character/rules.js)

---

## 1. Canonical Max HP Formula (`calculateCanonicalMaxHp`)

Implemented in [`src/domain/character/rules.js`](../../../src/domain/character/rules.js) as a pure, closed-form function of `level`, `charClass`, and `effectiveConMod`:

$$\text{MaxHP}_{\text{canonical}}(L, c, M_{\text{con}}^{\text{eff}}) = \max\!\Big(L,\; H_1(c) + (L - 1)\cdot H_{\text{lvl}}(c) + B_{\text{class}}(L, c) + L \cdot M_{\text{con}}^{\text{eff}}\Big)$$

Where:
- **Fighter:** $H_1 = 10$, $H_{\text{lvl}} = 6$, and Battle-Hardened $B_{\text{class}}(L) = (1 + L)$ for $1 \le L \le 4$, and $2L$ for $L \ge 5$.
- **Ranger:** $H_1 = 10$, $H_{\text{lvl}} = 6$, $B_{\text{class}}(L) = 0$.
- **Cleric:** $H_1 = 8$, $H_{\text{lvl}} = 5$, $B_{\text{class}}(L) = 0$.

Every change to `effectiveConMod` (whether permanent or from equipment) applies **retroactively across all $L$ levels**.

---

## 2. Strict Separation of Equipment CON vs. Permanent CON (`Rules A, B, C, D`)

### Rule A — Equipment CON (`equipItem`, `unequipItem`, & Direct Slot Swap)
- **Equipping a `+CON` item:**
  - Recalculates `newMaxHp = calculateCanonicalMaxHp(level, class, newEffectiveConMod)`.
  - **Does NOT increase `current_hp`:** `newCurrentHp = Math.max(1, Math.min(oldCurrentHp, newMaxHp))`.
  - The newly created HP capacity starts empty and must be filled through normal healing (potions, Cleric self-heal, or Oakhaven Sanctuary rest).
- **Unequipping or replacing a `+CON` item:**
  - Recalculates `newMaxHp`.
  - Clamps `newCurrentHp = Math.max(1, Math.min(oldCurrentHp, newMaxHp))`.
  - **1 HP Floor:** A living hero (`is_alive === 1`) can **never** die (`current_hp <= 0`) from unequipping or swapping gear.
  - **Zero Free Healing Exploit:** Repeatedly equipping and unequipping a `+CON` item can never increase `current_hp`.
  - **Atomic Slot Swap:** Replacing one item in a slot with another resolves in a single SQLite transaction and applies Rule A once to the final equipment state.

### Rule B — Permanent CON (`spendAttributePoint` on `constitution`)
- Permanently increments `characters.constitution` by `+1` and decrements `attribute_points` by `-1`.
- Recomputes `oldMaxHp` and `newMaxHp`.
- Let `hpDelta = Math.max(0, newMaxHp - oldMaxHp)`.
- Sets `newCurrentHp = Math.max(1, Math.min(newMaxHp, oldCurrentHp + hpDelta))`.
  - If the permanent CON increase raises `effectiveConMod` by $+1$ (even score boundary), both `max_hp` and `current_hp` increase by $+L$ (no full heal of prior missing HP).
  - If the permanent CON increase moves from an even score to an odd score ($\Delta M_{\text{con}} = 0$), `hpDelta = 0` and neither `max_hp` nor `current_hp` changes.

### Rule C — Level-Up (`applyCharacterLevelUp`)
- Recomputes `oldCanonicalMaxHp` at `oldLevel` and `newCanonicalMaxHp` at `newLevel` using current `effectiveConMod`.
- Adds `levelHpDelta = Math.max(0, newCanonicalMaxHp - oldCanonicalMaxHp)` to `current_hp` (`newCurrentHp = Math.max(1, Math.min(newCanonicalMaxHp, oldCurrentHp + levelHpDelta))`).
- Never performs an automatic full heal on level-up.

### Rule D — Login / Reload Reconciliation (`reconcileCharacterHpOnLoad`)
- If `is_alive === 0`, preserves permadeath (`current_hp = 0`, `is_alive = 0`).
- If `is_alive === 1`, sets `max_hp = canonicalMaxHp` and clamps `current_hp = Math.max(1, Math.min(oldCurrentHp, canonicalMaxHp))`.
- Never adds a positive `canonicalMaxHp - oldMaxHp` difference to `current_hp` on login or reload.

---

## 3. 9-Slot Equipment Attribute Aggregation & Combat Locks

- **All 9 Slots Aggregated (`getEffectiveStats`):**
  - Sums `strength`, `dexterity`, `constitution`, `intelligence`, `wisdom`, and `charisma` bonuses across `meleeWeapon` (`MELEE`), `rangedWeapon` (`RANGED`), `armor` (`ARMOR`), `shield` (`SHIELD`), `ring` (`RING`), `cloak` (`CLOAK`), `neck` (`NECK`), `belt` (`BELT`), and `feet` (`FEET`).
  - Verified that `Boots of Elvenkind` does not inject a synthetic DEX bonus unless an explicit `dexterity_bonus` attribute is present.
- **Equipment Restrictions:**
  - `equipItem` and `unequipItem` block changes during `DISCOVERED` or `IN_COMBAT` encounters (`409 COMBAT_LOCKED_EQUIPMENT`) and block dead characters (`is_alive !== 1`).

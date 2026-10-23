# DARKGRID — PHASE 7A.4: OPEN LEVEL PROGRESSION & CONSTITUTION HP RULES (EQUIPMENT VS. PERMANENT CON)

**Date:** 2026-10-22  
**Scope:** Phase 7A.4 — Explicit No-Level-Cap Architecture, Separation of Equipment CON vs. Permanent CON Increases, Level-Up HP Rule, and 10 Safety & Test Requirements  
**Status:** **LOCKED (Owner Directives `OD-7A4-01` & `OD-7A4-02`)**  
**Supersedes:** [`PHASE-7A3-ATTRIBUTES.md`](../phase-7a3/PHASE-7A3-ATTRIBUTES.md) and earlier drafts of `PHASE-7A4-LEVELS-AND-CONSTITUTION.md`

---

## 1. Owner Directive 1: No Maximum Character Level Has Been Decided (`OD-7A4-01`)

### 1.1 Canonical Design Principle (OWNER-APPROVED RULE)
There is **no approved maximum character level** in Darkgrid.

- **What Levels 1–10 Are:** Levels `1` through `10` represent the **currently documented class progression and simulation horizon**, NOT the game's permanent maximum character level.
- **What Attribute Scores `23` and `25` Are:** A natural attribute score of `23` (`18` creation cap + `5` milestone points across Levels 2, 4, 6, 8, 10) and an equipped score of `25` (`23` + `+2` item bonus) are **illustrative examples of values reachable by Level 10**, NOT permanent global attribute caps.
- **What Score `18` Is:** `MAX_ATTRIBUTE = 18` in [`src/domain/character/rules.js`](../../../src/domain/character/rules.js#L244) is strictly a **Level 1 Character Creation point-buy maximum** (`validatePointBuy`), never a post-creation ceiling.
- **Preserved Progression Milestones:** Currently approved attribute growth milestones at **Levels 2, 4, 6, 8, and 10** (`+1` attribute point each) and class feature unlocks across Levels 1–10 remain locked as specified. No unapproved post-Level-10 abilities, level-up rewards, or XP thresholds are invented without owner approval.

### 1.2 Audit of Level-10-Cap Misconceptions in Phase 7A.3 & Codebase

| Location | Previous Wording / Code | Phase 7A.4 Locked Correction |
| :--- | :--- | :--- |
| [`PHASE-7A3-ATTRIBUTES.md`](../phase-7a3/PHASE-7A3-ATTRIBUTES.md) (L51, L61–63) | Restricted attribute invariant to $L \in [1, 10]$ and labeled columns `"Base Score Ceiling (23 at Level 10)"` and `"Equipped Effective Ceiling (25 at Level 10)"`. | Replace bounded $L \in [1, 10]$ with open-ended $L \ge 1$. Relabel `23` and `25` as *"Example Score at Level 10 (Unbounded Above)"*. |
| [`PHASE-7A3-ATTRIBUTES.md`](../phase-7a3/PHASE-7A3-ATTRIBUTES.md) (L83) | Defined Fighter *Battle-Hardened* HP bonus as $2L$ for $L \in [5, 10]$. | Define as $2L$ for **$L \ge 5$** (open-ended for all future levels). |
| [`PHASE-7A3-EXECUTIVE-SUMMARY.md`](../phase-7a3/PHASE-7A3-EXECUTIVE-SUMMARY.md) (L36), [`PHASE-7A3-PHASE7B-ROADMAP.md`](../phase-7a3/PHASE-7A3-PHASE7B-ROADMAP.md) (L35), [`PHASE-7A3-SIMULATION-PLAN.md`](../phase-7a3/PHASE-7A3-SIMULATION-PLAN.md) (L49) | Referred to `"up to natural 23 / equipped 25"` as ceilings. | Attribute modifiers scale via $M_{\text{stat}} = \lfloor (\text{score} - 10) / 2 \rfloor$ for any integer score without an upper cap. |
| [`PHASE-7A3-SECOND-WIND.md`](../phase-7a3/PHASE-7A3-SECOND-WIND.md) (L32) | Listed Tier III *Greater Second Wind* at `"Level 10"` as the final upgrade. | Specify **`Level 10+` (`level >= 10`)** under Option B (`L1–2` none, `L3–5` Tier I, `L6–9` Tier II, `L10+` Tier III). |
| [`PHASE-7A2-CLASS-PROGRESSION.md`](../phase-7a2/PHASE-7A2-CLASS-PROGRESSION.md) (L25) | Labeled Level 10 *"Final Growth"*. | Relabel Level 10 as *"Level 10 Milestone (End of Currently Documented Scope; Post-L10 Open)"*. |
| [`src/domain/character/rules.js`](../../../src/domain/character/rules.js#L40-L55) | `getLevelForXp(xp)` loops from `10` down to `1`; `getXpForNextLevel(level)` has comment `"// or null if at max level (10)"`. | Document `FAST_XP_TABLE` as the *currently configured progression table (`L1–L10`)* rather than a permanent game cap, and ensure all combat/HP/BAB/save formulas accept any `level >= 1`. |

### 1.3 Open-Ended Mathematical Formulation of Currently Approved Milestones
To validate a character's spent and unspent milestone attribute points at any level $L \ge 1$ without assuming $L \le 10$ or inventing unapproved post-L10 milestones:

$$\text{ApprovedMilestonesReached}(L) = \sum_{m \in \{2, 4, 6, 8, 10\}} \mathbb{I}(L \ge m) = \min\big(5,\; \lfloor \max(0, L) / 2 \rfloor\big)$$

Let $S_i^{\text{base}}$ be the character's permanent (unequipped) attribute score for $i \in \{\text{STR, DEX, CON, INT, WIS, CHA}\}$, and let $u \ge 0$ be `character.attribute_points` (unspent points). Then for any $L \ge 1$:

$$\sum_{i} S_i^{\text{base}} + u = \sum_{i} S_i^{(1)} + \text{ApprovedMilestonesReached}(L)$$

---

## 2. Owner Directive 2: Separation of Equipment CON vs. Permanent CON (`OD-7A4-02`)

### 2.1 Canonical Maximum HP Formula (Closed-Form for Any $L \ge 1$)

For a character of class $c \in \{\text{FIGHTER}, \text{RANGER}, \text{CLERIC}\}$ at level $L \ge 1$ with effective Constitution score $\text{CON}_{\text{eff}} = \text{CON}_{\text{base}} + \sum_{\text{equipped items}} \text{bonus}_{\text{con}}$ and effective modifier $M_{\text{con}} = \lfloor (\text{CON}_{\text{eff}} - 10) / 2 \rfloor$:

$$\text{MaxHP}(L, c, M_{\text{con}}) = \max\Big(L,\; H_1(c) + (L - 1)\cdot H_{\text{lvl}}(c) + B_{\text{class}}(L, c) + L \cdot M_{\text{con}}\Big)$$

where the class constants and open-ended class HP bonuses are:

| Class $c$ | Level 1 Base $H_1(c)$ | Per-Level Base $H_{\text{lvl}}(c)$ | Class Passive HP Bonus $B_{\text{class}}(L, c)$ for any $L \ge 1$ |
| :--- | :---: | :---: | :--- |
| **`FIGHTER`** | `10` | `6` | $1 + L$ for $1 \le L \le 4$; $\quad 2L$ for **$L \ge 5$** (*Battle-Hardened I & II*) |
| **`RANGER`** | `10` | `6` | $0$ |
| **`CLERIC`** | `8` | `5` | $0$ |

> [!IMPORTANT]
> **Why Equipment CON and Permanent CON Must Treat `Current HP` Differently:**
> Both permanent `CON` and equipment `CON` contribute to $\text{CON}_{\text{eff}}$ and therefore recalculate `Max HP` retroactively across all levels ($L \times M_{\text{con}}$). However, their effect on **`Current HP`** is strictly distinct so that equipping/unequipping gear can never generate free healing, while spending a permanent attribute point on `CON` immediately rewards the hero with the gained HP.

---

### 2.2 Rule A: CON from Equipment (`equipItem`, `unequipItem`, and Direct Slot Swaps)

When equipping, unequipping, or swapping equipment changes a living hero's effective Constitution modifier ($\Delta M_{\text{con}} = M_{\text{con}}^{\text{new}} - M_{\text{con}}^{\text{old}}$):

1. **Retroactive `Max HP` Recalculation:**
   $$\text{newMaxHp} = \text{MaxHP}(L, c, M_{\text{con}}^{\text{new}})$$
2. **`Current HP` Rule (No Free Healing on Equip; Clamped on Unequip):**
   - When equipment increases `Max HP` ($\Delta M_{\text{con}} > 0$), **`Current HP` does NOT increase**. The hero must use healing (potions, town rest, *Lay on Hands*, etc.) to fill the newly added HP capacity.
   - When equipment is removed or replaced so `Max HP` decreases ($\Delta M_{\text{con}} < 0$), **`Current HP` remains unchanged unless it exceeds `newMaxHp`**.
   - A living hero (`is_alive = 1`) can **never die** from an equipment change (`1 HP` minimum floor).
   - Therefore, for **every** equipment change (positive $\Delta M_{\text{con}}$, negative $\Delta M_{\text{con}}$, or zero $\Delta M_{\text{con}}$, including direct item-for-item slot swaps) on a living hero:

   $$\boxed{\text{newCurrentHp} = \max\Big(1,\; \min\big(\text{oldCurrentHp},\; \text{newMaxHp}\big)\Big)}$$

#### Worked Examples for Equipment CON (Locked Owner Examples)

- **Example A1 (Wounded Hero Equips `+2 CON`, Heals, Unequips, Re-equips):**
  - Initial State (Level 7 Ranger, `CON 14`, mod `+2`): **`35 / 60 HP`**
  - Equip `+2 CON` item (`CON 16`, mod `+3`, `newMaxHp = 67`): **`35 / 67 HP`** *(Current HP does not increase)*
  - Heal `20 HP`: **`55 / 67 HP`**
  - Unequip `+2 CON` item (`newMaxHp = 60`, $\min(55, 60) = 55$): **`55 / 60 HP`**
  - Re-equip `+2 CON` item (`newMaxHp = 67`, $\min(55, 67) = 55$): **`55 / 67 HP`**

- **Example A2 (Full-HP Hero Unequips and Re-equips `+2 CON`):**
  - Initial State (Equipped at full HP): **`67 / 67 HP`**
  - Unequip `+2 CON` item (`newMaxHp = 60`, $\min(67, 60) = 60$): **`60 / 60 HP`**
  - Re-equip `+2 CON` item (`newMaxHp = 67`, $\min(60, 67) = 60$): **`60 / 67 HP`** *(No free healing back to 67)*

---

### 2.3 Rule B: Permanent CON Increases (`spendAttributePoint` on Constitution)

When a living hero spends a milestone attribute point to permanently increase base `CON` ($\text{CON}_{\text{base}}^{\text{new}} = \text{CON}_{\text{base}}^{\text{old}} + 1$):

1. Compute old and new effective CON modifiers (including any currently equipped CON items):
   $$M_{\text{con}}^{\text{old}} = \left\lfloor \frac{\text{CON}_{\text{eff}}^{\text{old}} - 10}{2} \right\rfloor, \qquad M_{\text{con}}^{\text{new}} = \left\lfloor \frac{\text{CON}_{\text{eff}}^{\text{new}} - 10}{2} \right\rfloor, \qquad \Delta M_{\text{con}} = M_{\text{con}}^{\text{new}} - M_{\text{con}}^{\text{old}} \in \{0, 1\}$$
2. Recalculate `Max HP` across all levels:
   $$\text{newMaxHp} = \text{MaxHP}(L, c, M_{\text{con}}^{\text{new}}), \qquad \Delta \text{MaxHP} = \text{newMaxHp} - \text{oldMaxHp} = L \times \Delta M_{\text{con}}$$
3. **Increase `Current HP` by the exact same HP gain** (only when $\Delta M_{\text{con}} > 0$; never a full heal beyond $\Delta \text{MaxHP}$):

   $$\boxed{\text{newCurrentHp} = \max\Big(1,\; \min\big(\text{newMaxHp},\; \text{oldCurrentHp} + L \times \Delta M_{\text{con}}\big)\Big)}$$

#### Worked Examples for Permanent CON (Locked Owner Examples)

- **Example B1 (Modifier Increases from `+2` to `+3`):**
  - Level 7 Ranger at **`35 / 60 HP`** with effective CON modifier `+2` (`CON 15`).
  - Spends 1 permanent attribute point on `CON` (`CON 15 -> 16`, modifier `+2 -> +3`, $\Delta M_{\text{con}} = +1$).
  - $\Delta \text{MaxHP} = 7 \times 1 = +7 \implies \text{newMaxHp} = 67$.
  - $\text{newCurrentHp} = 35 + 7 = 42$.
  - **Result:** **`42 / 67 HP`** *(Gains the exact `+7 HP` across all 7 levels without receiving a free full heal).*

- **Example B2 (Modifier Unchanged — Even-to-Odd `CON 14 -> 15`):**
  - Level 7 Ranger at **`35 / 60 HP`** with `CON 14` (modifier `+2`).
  - Spends 1 permanent attribute point on `CON` (`CON 14 -> 15`, modifier remains `+2`, $\Delta M_{\text{con}} = 0$).
  - $\Delta \text{MaxHP} = 0 \implies$ **Result:** **`35 / 60 HP`** *(No HP gained until the modifier changes).*

---

### 2.4 Rule C: Level-Up HP Gain (`checkAndApplyLevelUp`)

When a living hero levels up from $L_{\text{old}}$ to $L_{\text{new}}$:
1. Compute $\text{newMaxHp} = \text{MaxHP}(L_{\text{new}}, c, M_{\text{con}}^{\text{eff}})$.
2. Compute $\Delta \text{MaxHP}_{\text{level}} = \text{newMaxHp} - \text{oldMaxHp}$.
3. Add $\Delta \text{MaxHP}_{\text{level}}$ to both `Max HP` and `Current HP`, without granting an automatic full heal:
   $$\boxed{\text{newCurrentHp} = \min\Big(\text{newMaxHp},\; \text{oldCurrentHp} + \Delta \text{MaxHP}_{\text{level}}\Big)}$$

---

### 2.5 Rule D: Login / Reload Reconciliation (Strict Guard Against Equipment CON Healing)

> [!CAUTION]
> **Critical Architectural Guardrail:**
> Login or session reload reconciliation must **NEVER** add `MaxHP_canonical - character.max_hp` to `current_hp`. If a character's stored `max_hp` differed from `MaxHP_canonical` (or if someone recalculated `MaxHP` from equipment on login), adding `+\Delta MaxHP` on login would mistakenly treat an equipped CON item as a permanent CON increase and grant free healing!

- **Correct Login / Reload Reconciliation Rule (`reconcileCharacterStateOnLoad`):**
  1. Compute $\text{CON}_{\text{eff}} = \text{character.constitution} + \sum_{\text{equipped}} \text{constitution\_bonus}$ and $M_{\text{con}}^{\text{eff}} = \lfloor (\text{CON}_{\text{eff}} - 10)/2 \rfloor$.
  2. Compute $\text{MaxHP}_{\text{canonical}} = \text{MaxHP}(L, c, M_{\text{con}}^{\text{eff}})$.
  3. Set `max_hp = MaxHP_canonical`.
  4. For a living hero (`is_alive === 1`), clamp `current_hp` strictly without adding any delta:
     $$\boxed{\text{newCurrentHp} = \max\Big(1,\; \min\big(\text{oldCurrentHp},\; \text{MaxHP}_{\text{canonical}}\big)\Big)}$$
  5. For a fallen hero (`is_alive === 0`), `current_hp` remains `0` (`permadeath` invariant).

---

## 3. Ten Mandatory Safety & Phase 7B Verification Requirements

Phase 7B implementation and automated tests (`tests/`) must enforce and verify all 10 scenarios below:

| # | Scenario | Expected Rule & Formula Behavior | Concrete Test Assertion |
| :---: | :--- | :--- | :--- |
| **1** | **Equip / Unequip without free healing** | Equipping `+CON` raises `max_hp` only (`current_hp` unchanged). Unequipping lowers `max_hp` and caps `current_hp` at `newMaxHp`. | `35/60` $\xrightarrow{\text{equip +2 CON}}$ `35/67` $\xrightarrow{\text{heal 20}}$ `55/67` $\xrightarrow{\text{unequip}}$ `55/60` $\xrightarrow{\text{re-equip}}$ `55/67`; and `67/67` $\xrightarrow{\text{unequip}}$ `60/60` $\xrightarrow{\text{re-equip}}$ `60/67`. |
| **2** | **Equipment swap with unchanged CON modifier** | Direct slot replacement computes `newMaxHp` after the swap and applies `max(1, min(oldCurrentHp, newMaxHp))` atomically. | Swapping Belt A (`+2 CON`) for Belt B (`+2 CON`) at `55/67 HP` keeps hero at `55/67 HP` (and at `67/67 HP` keeps hero at `67/67 HP`). |
| **3** | **Removal when Current HP is very low** | `newCurrentHp = max(1, min(oldCurrentHp, newMaxHp))` leaves low `Current HP` untouched and enforces a `1 HP` floor. | Hero at `1/67 HP` or `5/67 HP` unequipping `+2 CON` ($\text{newMaxHp}=60$) stays at `1/60 HP` or `5/60 HP`; a living hero never drops to `0 HP`. |
| **4** | **Removal when Current HP exceeds new Max HP** | `newCurrentHp` is clamped down to `newMaxHp`; re-equipping does not restore the clamped HP. | Hero at `65/67 HP` unequips `+2 CON` ($\text{newMaxHp}=60$) $\rightarrow$ `60/60 HP` $\xrightarrow{\text{re-equip}}$ `60/67 HP`. |
| **5** | **Permanent CON increase** | Spending an attribute point on `CON` adds $\Delta \text{MaxHP} = L \times \Delta M_{\text{con}}$ to both `max_hp` and `current_hp` only when $\Delta M_{\text{con}} > 0$. | L7 Ranger at `35/60 HP` (`CON 15 -> 16`, mod `+2 -> +3`) $\rightarrow$ `42/67 HP`. Even-to-odd (`CON 14 -> 15`, mod `+2 -> +2`) $\rightarrow$ `35/60 HP`. |
| **6** | **Level-up** | Leveling up adds $\Delta \text{MaxHP}_{\text{level}} = \text{newMaxHp} - \text{oldMaxHp}$ to both `max_hp` and `current_hp` without a full heal. | Wounded L6 Ranger (`30/52 HP`, `CON 14` mod `+2`, $\Delta \text{MaxHP}_{\text{level}} = +8$) leveling to L7 $\rightarrow$ `38/60 HP`. |
| **7** | **Login / reload without accidental healing** | Login/reload reconciles `max_hp = MaxHP_canonical` and clamps `current_hp = max(1, min(oldCurrentHp, MaxHP_canonical))` without adding `+\Delta MaxHP`. | Reloading a hero at `35/67 HP` (with `+2 CON` item equipped) or `60/67 HP` preserves `35/67 HP` and `60/67 HP` across unlimited logins/reloads. |
| **8** | **Permadeath and dead heroes** | Dead heroes (`is_alive = 0`, `current_hp = 0`) cannot equip, unequip, spend attribute points, or be revived to `1 HP` by login reconciliation. | Calling `equipItem`, `unequipItem`, `spendAttributePoint`, or login reconciliation on `is_alive = 0` rejects mutation and keeps `current_hp === 0`. |
| **9** | **Multiple CON items simultaneously** | `getEffectiveStats` sums `constitution_bonus` across all 9 equipment slots before computing $M_{\text{con}} = \lfloor (\text{CON}_{\text{eff}} - 10)/2 \rfloor$. | Base `CON 14` + `+1 CON` Ring + `+1 CON` Amulet = `CON_eff 16` ($M_{\text{con}} = +3$). Removing one `+1 CON` item drops `CON_eff` to `15` ($M_{\text{con}} = +2$). |
| **10** | **No equipment changes during active combat** | `equipItem` and `unequipItem` must check for an active combat session (`status = 'ACTIVE'`) and reject equipment changes in combat. | Attempting `equipItem` or `unequipItem` while character is in active combat throws `COMBAT_LOCKED_EQUIPMENT` (`409 Conflict`). |

---

## 4. Required Codebase Touchpoints for Phase 7B Implementation

Auditing [`src/domain/character/rules.js`](../../../src/domain/character/rules.js) defines the exact functions for Phase 7B:

1. **`getEffectiveStats(character, equipment)` ([`src/domain/character/rules.js:918–958`](../../../src/domain/character/rules.js#L918-L958)):**
   - Generalize across all 9 equipped slots (`MELEE`, `RANGED`, `ARMOR`, `SHIELD`, `RING`, `CLOAK`, `NECK`, `BELT`, `FEET`) to sum `strength_bonus`, `dexterity_bonus`, `constitution_bonus`, `intelligence_bonus`, `wisdom_bonus`, and `charisma_bonus`, and recompute all 6 modifiers (`str_mod`, `dex_mod`, `con_mod`, `int_mod`, `wis_mod`, `cha_mod`).
2. **`calculateCanonicalMaxHp(level, charClass, effectiveConMod)`:**
   - Closed-form pure function implementing Section 2.1 for any `level >= 1` (`Battle-Hardened II` = `2 * level` for `level >= 5`).
3. **`applyEquipmentConHpClamp(oldCurrentHp, newMaxHp, isAlive)`:**
   - Implements Rule A (`isAlive ? Math.max(1, Math.min(oldCurrentHp, newMaxHp)) : 0`). Used by `equipItem`, `unequipItem`, and login/reload reconciliation.
4. **`applyPermanentConHpIncrease(oldCurrentHp, oldMaxHp, newMaxHp, isAlive)`:**
   - Implements Rule B (`const delta = Math.max(0, newMaxHp - oldMaxHp); return isAlive ? Math.max(1, Math.min(newMaxHp, oldCurrentHp + delta)) : 0;`). Used exclusively by `spendAttributePoint` when `attribute === 'constitution'`.

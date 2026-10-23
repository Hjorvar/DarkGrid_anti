# DARKGRID — PHASE 7C: CLERIC DIVINE ABILITIES & LEVEL SCALING SPECIFICATION

**Date:** 2026-10-23  
**Phase:** 7C — Cleric Divine Combat System  
**Primary Modules:**
- [`src/domain/character/rules.js`](../../../../src/domain/character/rules.js)
- [`src/domain/combat/abilities.js`](../../../../src/domain/combat/abilities.js)
- [`src/domain/combat/engine.js`](../../../../src/domain/combat/engine.js)
- [`src/domain/combat/narrative.js`](../../../../src/domain/combat/narrative.js)

---

## 1. Design Philosophy & Class Differentiation

Phase 7C establishes a distinct tactical identity for the **Cleric** alongside the **Fighter** and **Ranger**:

- **Fighter:** Durable frontline warrior with reliable, mostly automatic combat abilities (Battle-Hardened, Weapon Training, Armor Training, and automatic 1/combat Second Wind rescue at $\le 25\%$ Max HP).
- **Ranger:** Wilderness scout with specialized enemy knowledge (14-Family Favored Enemy Option A, Natural Knowledge, and Stage 1 Ranged Opening Shot).
- **Cleric:** Tactical holy warrior whose survival and burst potential depend on **intelligent resource management** of persistent **Divine Charges** across an expedition, combining active sacred techniques (**Battle Prayer**, **Smite**, **Divine Shield**) with preserved passive systems (**Sacred Knowledge**, **Turn Undead**, standardized BAB $\lceil 3L/4 \rceil$, and separate out-of-combat **Self-Healing**).

---

## 2. Divine Charges — Persistent Resource System

### 2.1 Capacity Formula
$$\text{Max Divine Charges} = \max\left(1,\; 6 + \text{Hero Level} + \text{WIS}_{\text{mod}}\right)$$
where $\text{WIS}_{\text{mod}} = \lfloor (\text{Effective WIS} - 10) / 2 \rfloor$, incorporating base Wisdom, milestone attribute investments, and all equipped item bonuses across the 9 equipment slots.

#### Capacity Progression Examples (with Effective WIS 16, $\text{WIS}_{\text{mod}} = +3$)
| Hero Level | Calculation | Max Divine Charges |
| :---: | :--- | :---: |
| **Level 1** | $\max(1, 6 + 1 + 3)$ | **10** |
| **Level 3** | $\max(1, 6 + 3 + 3)$ | **12** |
| **Level 5** | $\max(1, 6 + 5 + 3)$ | **14** |
| **Level 7** | $\max(1, 6 + 7 + 3)$ | **16** |
| **Level 10** | $\max(1, 6 + 10 + 3)$ | **19** |
| **Level 15** *(open-ended)* | $\max(1, 6 + 15 + 3)$ | **24** |

### 2.2 Resource Rules & Anti-Exploit Guarantees
1. **City-Only Recharge:** Divine Charges recharge **ONLY** when the hero rests in a safe city sanctuary (`performCityRest`).
2. **No Automatic Refill:** Combat victory, level-up (`applyCharacterLevelUp`), milestone attribute spending (`spendAttributePoint`), equipping `+WIS` items (`equipItem`), login, or page reload (`reconcileCharacterHpOnLoad`) **never** grant free Divine Charges or auto-refill spent charges.
3. **SQLite Persistence:** Stored in `characters.divine_charges` (`db/migrations/015_phase7c_cleric_divine_combat.sql`).
4. **Downward Clamping:** Whenever WIS or equipment changes reduce `Max Divine Charges`, `divine_charges` is immediately clamped to `[0, newMax]` (`clampDivineCharges`), preventing any equipment-toggling exploit.
5. **Atomic Server-Side Spending:** Every combat spend uses an atomic SQLite guard:
   ```sql
   UPDATE characters
   SET divine_charges = divine_charges - ?
   WHERE id = ? AND is_alive = 1 AND UPPER(class) = 'CLERIC' AND divine_charges >= ?
   ```
6. **Existing Hero Initialization:** Migration `015` safely backfills existing living Cleric rows where `divine_charges IS NULL` to their canonical starting pool $\max(1, 6 + \text{level} + \lfloor(\text{wisdom}-10)/2\rfloor)$ and non-Clerics to `0`.
7. **Separate Out-of-Combat Self-Healing Preserved:** `cleric_heal_uses` (`2` uses at L1–4, `3` uses at L5–8, `4` uses at L9+) remains an independent out-of-combat pool. City rest recharges both pools simultaneously.

---

## 3. Cleric Combat Abilities & Modest Open-Ended Level Scaling (Part 2 & Part 3)

All three divine combat abilities use open-ended mathematical formulas (`Math.floor`) with no hardcoded Level 10 cap, matching Phase 7B progression conventions while avoiding explosive scaling.

### 3.1 Ability 1 — BATTLE PRAYER (`BATTLE_PRAYER`)
- **Cost:** `1` Divine Charge
- **Player-Facing Description:**
  > *"He cries out a prayer as his weapon strikes, drawing strength from his faith."*
- **Mechanics:**
  - Uses the Cleric's normal prepared weapon and attack roll (counts as sacred/magical for incorporeal resistance).
  - **On Hit:** Deals normal weapon damage (subject to normal critical-hit rules) **and** heals the Cleric.
  - **On Miss:** No healing occurs, and the `1` Divine Charge is still consumed.
  - **Critical Hits:** Weapon damage multiplies as normal on a natural 20; **Battle Prayer healing is never multiplied on a critical hit**.
  - **HP Cap:** Healing cannot exceed `max_hp`.
  - **Mutual Exclusion:** Cannot be combined with Smite in the same attack.
- **Level Scaling Formula (`getClericBattlePrayerProfile`):**
  $$\text{Heal Dice} = \left(1 + \lfloor \text{Level} / 5 \rfloor\right)\text{d6}, \qquad \text{Flat Bonus} = \max(0, \text{WIS}_{\text{mod}}) + \lfloor (\text{Level} - 1) / 2 \rfloor$$

| Hero Level | Heal Dice | Flat Bonus (at WIS 16, $+3$) | Total Healing Formula | Avg Heal on Hit |
| :---: | :---: | :---: | :---: | :---: |
| **Level 1** | `1d6` | $+3 + 0 = +3$ | `1d6 + 3` | **6.5 HP** |
| **Level 3** | `1d6` | $+3 + 1 = +4$ | `1d6 + 4` | **7.5 HP** |
| **Level 5** | `2d6` | $+3 + 2 = +5$ | `2d6 + 5` | **12.0 HP** |
| **Level 7** | `2d6` | $+3 + 3 = +6$ | `2d6 + 6` | **13.0 HP** |
| **Level 10** | `3d6` | $+3 + 4 = +7$ | `3d6 + 7` | **17.5 HP** |

---

### 3.2 Ability 2 — SMITE (`SMITE`)
- **Cost:** `1` Divine Charge
- **Player-Facing Description:**
  > *"His weapon erupts with sacred light, punishing the enemy with divine wrath."*
- **Mechanics:**
  - Uses the Cleric's normal prepared weapon and attack roll (counts as sacred/magical).
  - **On Hit:** Deals regular weapon damage plus sacred radiant damage.
  - **Against Undead:** Adds an extra `+1d8` radiant damage die on top of base radiant dice.
  - **On Miss:** The `1` Divine Charge is consumed and no damage is dealt.
  - **Critical Hits:** Normal weapon damage is multiplied on a critical hit; **bonus radiant dice and flat radiant bonuses are NOT multiplied on a critical hit**.
  - **No Healing:** Smite never heals the Cleric and cannot be combined with Battle Prayer.
- **Level Scaling Formula (`getClericSmiteProfile`):**
  $$\text{Base Radiant Dice} = \left(1 + \lfloor (\text{Level} - 1) / 5 \rfloor\right)\text{d8}, \qquad \text{Undead Bonus} = +1\text{d8}, \qquad \text{Flat Radiant Bonus} = \lfloor (\text{Level} - 1) / 2 \rfloor$$

| Hero Level | Radiant vs Living | Avg Bonus vs Living | Radiant vs Undead | Avg Bonus vs Undead |
| :---: | :---: | :---: | :---: | :---: |
| **Level 1** | `1d8` | **+4.5** | `2d8` | **+9.0** |
| **Level 3** | `1d8 + 1` | **+5.5** | `2d8 + 1` | **+10.0** |
| **Level 5** | `1d8 + 2` | **+6.5** | `2d8 + 2` | **+11.0** |
| **Level 7** | `2d8 + 3` | **+12.0** | `3d8 + 3` | **+16.5** |
| **Level 10** | `2d8 + 4` | **+13.0** | `3d8 + 4` | **+17.5** |

---

### 3.3 Ability 3 — DIVINE SHIELD (`DIVINE_SHIELD`)
- **Cost:** `2` Divine Charges
- **Player-Facing Description:**
  > *"A radiant barrier surrounds the Cleric, shielding him from the enemy's assault."*
- **Mechanics:**
  - Activated manually by the player; consumes the Cleric's action for the current round without performing a weapon attack.
  - Grants a temporary sacred barrier lasting **2 monster turns** (including the monster's turn in the activation round).
  - Reduces incoming HP damage from each monster damaging hit (including multi-hit strikes, Rend/Constrict/Elemental riders, Breath/Volley specials, and Flee parting blows) to a minimum of `0`.
  - **Non-Stacking:** Cannot be activated while `divineShieldTurns > 0` (disabled in UI and rejected server-side with `DIVINE_SHIELD_ALREADY_ACTIVE`).
  - **No Retroactive / Automatic Behavior:** Does not heal damage already taken, does not auto-trigger at low HP, and **does not prevent non-HP instant death from stage-3 petrification (`CALCIFY`)**.
  - **Persistence:** `divineShieldTurns` and `divineShieldReduction` are persisted in `encounters.combat_state_json` across page reloads.
- **Level Scaling Formula (`getClericDivineShieldProfile`):**
  $$\text{Damage Reduction per Hit} = 2 + \max(0, \text{WIS}_{\text{mod}}) + \lfloor (\text{Level} - 1) / 3 \rfloor$$

| Hero Level | Duration | DR per Hit (at WIS 16, $+3$) |
| :---: | :---: | :---: |
| **Level 1** | 2 Monster Turns | **5 DR / hit** ($2 + 3 + 0$) |
| **Level 3** | 2 Monster Turns | **5 DR / hit** ($2 + 3 + 0$) |
| **Level 5** | 2 Monster Turns | **6 DR / hit** ($2 + 3 + 1$) |
| **Level 7** | 2 Monster Turns | **7 DR / hit** ($2 + 3 + 2$) |
| **Level 10** | 2 Monster Turns | **8 DR / hit** ($2 + 3 + 3$) |

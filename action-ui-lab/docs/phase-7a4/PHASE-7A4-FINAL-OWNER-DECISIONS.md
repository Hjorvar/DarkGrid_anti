# DARKGRID — PHASE 7A.4: FINAL OWNER DECISIONS (AUTHORITATIVE LOCKED SPECIFICATION)

**Date:** 2026-10-22  
**Scope:** Phase 7A.4 Final Corrections — Authoritative Record of All Locked Owner Decisions for Phase 7B  
**Status:** **100% LOCKED — ZERO PENDING DESIGN QUESTIONS**  
**Related Documents:**
- [`PHASE-7A4-FINAL-CONSISTENCY-AUDIT.md`](./PHASE-7A4-FINAL-CONSISTENCY-AUDIT.md)
- [`PHASE-7A4-FINAL-PHASE7B-READINESS.md`](./PHASE-7A4-FINAL-PHASE7B-READINESS.md)
- [`PHASE-7A4-OWNER-DECISIONS.md`](./PHASE-7A4-OWNER-DECISIONS.md)
- [`PHASE-7A4-RANGER-TAXONOMY.md`](./PHASE-7A4-RANGER-TAXONOMY.md)
- [`PHASE-7A4-LEVELS-AND-CONSTITUTION.md`](./PHASE-7A4-LEVELS-AND-CONSTITUTION.md)

---

## 1. Executive Summary of Locked Status

All design decisions for Phase 7A.4 have been formally decided and **LOCKED** by the project owner. Every previous open confirmation marker (`P1`–`P5` from Phase 7A.3 and `OC-1`–`OC-3` from initial Phase 7A.4) is now resolved. Phase 7B engineering can proceed with **zero** ambiguity or further design interpretation.

| Decision Key | Area | Final Owner Ruling | Status |
| :--- | :--- | :--- | :---: |
| **`OC-1` (`P1` & `P2`)** | Ranger Favored Enemy Categories & Magical Beast Split | **Option A Locked:** `14` initial categories at Character Creation; `FEY` and `AMPHIBIAN_HUMANOIDS` in Reserved/Advanced (`Tier 2`); `TROLLS`, `GIANTS`, and `DRAGONS_DRAKES` remain in Initial 14; `UNDEAD` (`11` monsters) strictly forbidden; Magical Beasts kept in 3 families (`LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS` labeled **"Other Magical Beasts"**) with no extra sub-categories. | **LOCKED** |
| **`OC-2` (`P4`)** | Fighter *Second Wind* Progression | **Option B Locked:** `L1–2` unavailable; `L3–5` Tier I (`1d10 + L + CON`); `L6–9` Tier II (`2d10 + L + CON`); `L10+` Tier III (`3d10 + L + CON` + cleanse 1 physical status effect). Automatic 1/combat trigger, preserving post-sequence ordering, lethal rescue (`0 + heal`), DoT rescue, and `CALCIFY` exclusion. | **LOCKED** |
| **`OC-3`** | Ranger *Favored Enemy* Bonuses | **Option A Locked:** `L1–3: +2 Atk / +2 Dmg / 0 AC`; `L4–7: +3 Atk / +3 Dmg / 0 AC`; `L8: +4 Atk / +4 Dmg / 0 AC`; `L9+: +4 Atk / +4 Dmg / +2 AC`. No expanded Crit range (`19–20`). Stacks with *Natural Knowledge* and full-strength INT/WIS *Battle Experience*. | **LOCKED** |
| **`NEW-CON` (`OD-7A4-02`)** | Equipment CON vs. Permanent CON vs. Level-Up | **Strict Separation Locked:** Equipment CON recalculates `Max HP` across all levels ($L \times M_{\text{con}}$) while **leaving `Current HP` unchanged on equip** and clamping via $\text{newCurrentHp} = \max(1, \min(\text{oldCurrentHp}, \text{newMaxHp}))$ (zero free healing). Permanent CON (attribute points) and Level-Ups add the gained HP delta ($\Delta \text{MaxHP}$) to both `Max HP` and `Current HP` without a full heal. | **LOCKED** |
| **`OD-7A4-01`** | Open Level Progression | **No Maximum Level Locked:** Level 10 is **not** a maximum character level; attribute scores `23` and `25` are illustrative L10 examples, not global caps; no unapproved post-L10 milestones, abilities, or XP curves are added. | **LOCKED** |
| **`OD-7A4-05 / 07`** | Preserved Core Systems | **Preserved Without Modification:** Fighter *Know Your Enemy*, Ranger *Natural Knowledge*, Cleric *Sacred Knowledge*, INT/WIS *Battle Experience* (victories-only, full strength without nerfs), class exemptions, permadeath, Monster `#36 Mummy` stats, and hidden internal numbers in player UI. | **LOCKED** |

---

## 2. Detailed Specification of Locked Owner Decisions

### 2.1 `OC-1` — Ranger Favored Enemy: Option A (`14` Initial Categories) & Magical Beast Classification

1. **14 Initial Character Creation Categories (Option A):**
   Character Creation for `RANGER` presents **exact 14 initial Favored Enemy families**:
   - `ANIMALS` — **Beasts & Wild Animals** (`12` monsters: `12` surface)
   - `LUPINE_CANINE_BEASTS` — **Magical Hounds & Wolves** (`4` monsters: `4` surface)
   - `AVIAN_CHIMERAS` — **Winged Chimeras & Great Raptors** (`5` monsters: `5` surface)
   - `TERRESTRIAL_MAGICAL_BEASTS` — **Other Magical Beasts** (`10` monsters: `9` surface, `1` non-surface `#15 Darkmantle`)
   - `ARACHNIDS` — **Spiders, Scorpions & Arachnids** (`4` monsters: `3` surface, `1` non-surface `#77 Cave Scorpion`)
   - `VERMIN_INSECTS` — **Giant Insects, Centipedes & Beetles** (`8` monsters: `7` surface, `1` non-surface `#20 Giant Centipede`)
   - `DANGEROUS_PLANTS` — **Carnivorous Plants & Fungal Horrors** (`6` monsters: `6` surface)
   - `DRAGONS_DRAKES` — **Drakes, Wyverns & Dragonkin** (`2` monsters: `2` surface)
   - `GOBLINOIDS` — **Goblinoids (Goblins, Hobgoblins & Bugbears)** (`4` monsters: `4` surface)
   - `ORCS` — **Orcs** (`2` monsters: `2` surface)
   - `GNOLLS` — **Gnolls** (`2` monsters: `2` surface)
   - `REPTILIAN_HUMANOIDS` — **Reptilian Humanoids (Kobolds, Lizardfolk & Troglodytes)** (`3` monsters: `3` surface)
   - `TROLLS` — **Trolls** (`1` monster: `1` surface)
   - `GIANTS` — **Giants & Ogres** (`1` monster: `1` surface)
2. **Reserved / Advanced Categories (`Tier 2`):**
   - `FEY` (`2` monsters: `#69 Mite`, `#82 Spriggan`) and `AMPHIBIAN_HUMANOIDS` (`2` monsters: `#23 Boggard`, `#74 Grippli Scout`) move to Reserved/Advanced (`Tier 2`) alongside `MONSTROUS_HUMANOIDS` (`9`), `ABERRATIONS` (`6`), and `SUBTERRANEAN_HUMANOIDS` (`2`).
   - `TROLLS`, `GIANTS`, and `DRAGONS_DRAKES` remain available at Character Creation.
3. **Non-Selectable & Strictly Forbidden Categories (`Tier 3`):**
   - `OOZES` (`1` monster: `#13 Gelatinous Cube`) and `CONSTRUCTS` (`1` monster: `#72 Gorgon`) are `NON_SELECTABLE`.
   - `UNDEAD` (**`11` monsters**: `10` surface, `1` non-surface `#36 Mummy`) is **always strictly forbidden** for Rangers (`RANGER_FAVORED_ENEMY_FORBIDDEN`).
4. **Magical Beast Classification Ruling:**
   - The owner approves the 3 Magical Beast families (`LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS`) and explicitly rejects creating additional biological sub-categories (`FELINE_MAGICAL_BEASTS`, `REPTILIAN_MAGICAL_BEASTS`, etc.).
   - `TERRESTRIAL_MAGICAL_BEASTS` uses the clear English player-facing UI name **"Other Magical Beasts"**.
5. **Backward Compatibility:**
   - Existing Ranger characters (`favored_enemy_family IS NULL`) retain full functionality via fallback to `favored_enemy_type` and `favored_enemy_subtype`.

---

### 2.2 `OC-2` — Fighter *Second Wind*: Option B Locked

1. **Tier Progression by Fighter Level (No Maximum Level):**
   - **Level 1–2:** Second Wind is **not available**.
   - **Level 3–5 (Tier I — *Second Wind*):** Heals $1\text{d}10 + \text{Level} + M_{\text{con}}$.
   - **Level 6–9 (Tier II — *Improved Second Wind*):** Heals $2\text{d}10 + \text{Level} + M_{\text{con}}$.
   - **Level 10+ (`level >= 10`, Tier III — *Greater Second Wind*):** Heals $3\text{d}10 + \text{Level} + M_{\text{con}}$ and cleanses **one active physical status effect** (`BLEED` or `POISON`, prioritizing `BLEED`).
2. **Automatic Execution & Trigger Ordering Invariants:**
   - Triggers automatically **once per combat** (`second_wind_used = 0 -> 1`).
   - **Trigger Condition:** Post-sequence Current HP is $\le \lfloor 0.25 \times \text{MaxHP} \rfloor$ OR drops to $\le 0\text{ HP}$ from standard attack damage, multi-hit sequences, damage riders, or end-of-round Poison/Bleed DoT ticks.
   - **Post-Sequence Resolution:** During a monster turn, Second Wind evaluates **only after** the monster's complete multi-hit and immediate rider sequence finishes.
   - **Lethal Rescue Floor:** If $\text{HP}_{\text{raw}} \le 0$ when Second Wind triggers, HP is reset to `0` before applying the heal roll:
     $$\text{newHp} = \min\big(\text{maxHp},\; 0 + \text{healRoll}\big)$$
   - **`CALCIFY` Exclusion:** Non-HP instant death from petrification (`CALCIFY`) is **never** rescued by Second Wind.

---

### 2.3 `OC-3` — Ranger *Favored Enemy* Bonuses: Option A Locked

1. **Approved Bonus Table (Open-Ended at `Level 9+`):**

| Ranger Level | Attack Bonus | Damage Bonus | AC Bonus | Critical Hit Range Expansion |
| :--- | :---: | :---: | :---: | :---: |
| **Level 1–3** | `+2` | `+2` | `0` | None (`20` only) |
| **Level 4–7** | `+3` | `+3` | `0` | None (`20` only) |
| **Level 8** | `+4` | `+4` | `0` | None (`20` only) |
| **Level 9+ (`level >= 9`)** | `+4` | `+4` | `+2` | None (`20` only) |

2. **Stacking & UI Rules:**
   - Do **not** add expanded Critical Hit range (`19–20`) from older Option B.
   - Stacks additively with Ranger *Natural Knowledge* and INT/WIS *Battle Experience* per approved rules.
   - Do **not** weaken INT/WIS *Battle Experience* (`INT 18+` up to `+4 Dmg`, `WIS 18+` up to `+3 AC`).
   - Internal numerical bonuses remain hidden in the player UI; English narrative prose describes the hero's specialized quarry knowledge.

---

### 2.4 New Constitution Rule — Equipment CON vs. Permanent CON vs. Level-Up (`OD-7A4-02`)

#### A. CON from Equipment (`equipItem`, `unequipItem`, and Direct Slot Swaps)
- When equipment changes effective CON modifier ($\Delta M_{\text{con}}$), recalculate `Max HP` retroactively across all levels ($L \times M_{\text{con}}$).
- **`Current HP` does NOT increase** when equipping `+CON` gear. The hero must use healing to fill the additional HP capacity.
- When equipment is removed or replaced so `Max HP` decreases, `Current HP` remains unchanged unless it exceeds `newMaxHp`.
- A living hero (`is_alive = 1`) can **never die** from an equipment change.
- **Canonical Formula for All Equipment Changes on Living Heroes:**
  $$\text{newCurrentHp} = \max\Big(1,\; \min\big(\text{oldCurrentHp},\; \text{newMaxHp}\big)\Big)$$
- **Canonical Examples:**
  - `35/60 HP` $\rightarrow$ equip `+2 CON` $\rightarrow$ `35/67 HP` $\rightarrow$ Heal `20` $\rightarrow$ `55/67 HP` $\rightarrow$ Unequip $\rightarrow$ `55/60 HP` $\rightarrow$ Re-equip $\rightarrow$ `55/67 HP`.
  - `67/67 HP` $\rightarrow$ unequip $\rightarrow$ `60/60 HP` $\rightarrow$ Re-equip $\rightarrow$ `60/67 HP`.
- Zero free healing may occur on any equipment change (positive, negative, or direct item-for-item swap).

#### B. Permanent CON Increases (Spending Attribute Point)
- When a hero spends an attribute point to permanently raise base `CON`:
  - Recalculate `Max HP` across all levels ($\Delta \text{MaxHP} = L \times \Delta M_{\text{con}}$).
  - **`Current HP` increases by the exact same HP gain** ($\Delta \text{HP} = L \times \Delta M_{\text{con}}$ when $\Delta M_{\text{con}} > 0$):
    $$\text{newCurrentHp} = \max\Big(1,\; \min\big(\text{newMaxHp},\; \text{oldCurrentHp} + L \times \Delta M_{\text{con}}\big)\Big)$$
  - Do **not** grant a full heal beyond this increase, and do **not** grant HP unless the CON modifier changes ($\Delta M_{\text{con}} > 0$).
- **Canonical Example:**
  - Level 7 Ranger with `35/60 HP` and CON modifier `+2` spends an attribute point raising permanent CON modifier from `+2` to `+3` ($\Delta \text{MaxHP} = +7$). Result: **`42/67 HP`**.

#### C. Level-Up
- When a hero levels up, the HP gain ($\Delta \text{MaxHP}_{\text{level}} = \text{newMaxHp} - \text{oldMaxHp}$) is added to both `Max HP` and `Current HP`, without granting an automatic full heal.

#### D. Login / Reload Reconciliation
- Login/reload reconciliation updates `max_hp = MaxHP_canonical` and clamps `current_hp = max(1, min(oldCurrentHp, MaxHP_canonical))` for living heroes (`0` if `is_alive === 0`). It **never** adds `+\Delta MaxHP` to `current_hp`, ensuring equipment CON is never mistaken for a permanent CON increase on login or reload.

---

## 3. What Changed From Earlier Documents

| Topic | Earlier State (`Phase 7A.2 / 7A.3 / Initial 7A.4`) | Final Locked Phase 7A.4 Rule |
| :--- | :--- | :--- |
| **`OC-1` (Ranger Initial 14)** | Pending choice between Option A (reserving `FEY` & `AMPHIBIAN_HUMANOIDS`) and Option B (reserving `TROLLS` & `GIANTS`). | **Option A Locked:** `FEY` and `AMPHIBIAN_HUMANOIDS` in Reserved/Advanced; `TROLLS`, `GIANTS`, and `DRAGONS_DRAKES` in Initial 14. |
| **Magical Beast Sub-Categories** | Included an optional note proposing a further split into `FELINE_MAGICAL_BEASTS` and `REPTILIAN_MAGICAL_BEASTS`, and labeled `TERRESTRIAL_MAGICAL_BEASTS` *"Terrestrial & Swamp Magical Beasts"*. | **3 Families Locked:** Keep `LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, and `TERRESTRIAL_MAGICAL_BEASTS` (UI label: **"Other Magical Beasts"**). Optional sub-split retired. |
| **`OC-2` (Second Wind Tiers)** | Pending choice between Option A (`L7` for Tier II `2d10`) and Option B (`L6` for Tier II `2d10`). | **Option B Locked:** `L1–2` none, `L3–5` Tier I (`1d10`), `L6–9` Tier II (`2d10`), `L10+` Tier III (`3d10` + cleanse). |
| **`OC-3` (Favored Enemy Bonuses)** | Pending choice between Option A (`+2/+3/+4/+4+2AC`) and Option B (`up to +6/+6/+3AC + 19–20 Crit`). | **Option A Locked:** `L1–3: +2/+2/0`, `L4–7: +3/+3/0`, `L8: +4/+4/0`, `L9+: +4/+4/+2 AC`. No `19–20` Crit expansion. |
| **Equipment CON vs. Permanent CON** | Phase 7A.3 had a `max(0, ...)` free-heal bug; initial Phase 7A.4 added/subtracted $L \times \Delta M_{\text{con}}$ to `Current HP` on equip/unequip and on login. | **Strict Separation Locked:** Equipment CON changes `Max HP` only and clamps `Current HP` via `max(1, min(oldCurrentHp, newMaxHp))` (zero Current HP gain on equip). Only permanent CON increases and level-ups add `+\Delta HP` to `Current HP`. |
| **`UNDEAD` Monster Count** | `PHASE-7A3-RANGER-FAMILIES.md` and one line in `PHASE-7A4-OWNER-DECISIONS.md` wrote `12` Undead. | **Corrected to `11` Undead** across all documents (`10` surface, `1` Underground-only `#36 Mummy`). |
| **Surface Monster Count (`88 / 87 / 86`)** | Earlier docs mixed `86`, `87`, and `88` without a single canonical definition of River (`R`). | **Canonical Definition Locked (`88` Surface / `10` Non-Surface):** River (`R`) is defined as a surface terrain (`#68 Sahuagin` is surface-active on `R`), while explaining `87` (`R` excluded for Sahuagin) and `86` (passable tiles `{F,S,P,J,H}` on `001_seed_world.sql`). |
| **Document Dates** | Initial Phase 7A.4 files had `2026-04-20`. | **Corrected to `2026-10-22`** across all Phase 7A.4 documents. |

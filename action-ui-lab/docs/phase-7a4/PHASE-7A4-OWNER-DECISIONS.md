# DARKGRID — PHASE 7A.4: DEFINITIVE OWNER DECISIONS RECORD

**Date:** 2026-10-22  
**Scope:** Phase 7A.4 — Final Owner Decisions & Locked Design Specification  
**Status:** **100% LOCKED (Zero Open Design Questions Remaining)**  
**Supersedes:** Pending owner-approval markers (`P1`–`P5`) in [`PHASE-7A3-DESIGN-DECISIONS.md`](../phase-7a3/PHASE-7A3-DESIGN-DECISIONS.md), earlier Phase 7A.4 pending confirmations (`OC-1`–`OC-3`), and any conflicting level-cap, attribute-ceiling, or equipment-CON healing claims across `action-ui-lab/docs/phase-7a2/` and `action-ui-lab/docs/phase-7a3/`.

---

## 1. Architectural Governance & Decision Classification

To maintain strict boundaries between authoritative game design and software engineering implementation, every item in Phase 7A.4 is classified into one of two categories (all previous open choices `OC-1`, `OC-2`, and `OC-3` have now been officially decided and locked by the project owner):

1. **OWNER-APPROVED RULE (LOCKED):** Confirmed directly by the project owner. Must be implemented faithfully in Phase 7B without alteration or silent rebalancing.
2. **ENGINEERING IMPLEMENTATION SPECIFICATION:** Technical database schema, function signature, or transaction-safety pattern required to realize owner-approved rules cleanly against the current SQLite / Node.js codebase.

---

## 2. Master Ledger of Locked Phase 7A.4 Owner Decisions

| Decision ID | Topic | Status | Core Ruling |
| :--- | :--- | :--- | :--- |
| **OD-7A4-01** | **No Maximum Character Level** | **LOCKED (Owner Directive)** | There is **no approved maximum character level** in Darkgrid. Levels 1–10 represent only the currently documented progression and simulation scope. Attribute scores of `23` (natural) and `25` (equipped) are illustrative examples within L1–10, not permanent global caps. No unapproved post-Level-10 milestones, abilities, or XP curves are invented. |
| **OD-7A4-02** | **Constitution — Equipment CON vs. Permanent CON vs. Level-Up** | **LOCKED (Owner Directive)** | **Equipment CON** recalculates `Max HP` retroactively across all levels ($L \times M_{\text{con}}$) while **leaving `Current HP` unchanged on equip** and clamping via $\text{newCurrentHp} = \max(1, \min(\text{oldCurrentHp}, \text{newMaxHp}))$ (zero free healing). **Permanent CON increases** (attribute points) and **Level-Ups** increase both `Max HP` and `Current HP` by the exact HP delta ($\Delta \text{HP} = L \times \Delta M_{\text{con}}$ or $\Delta \text{MaxHP}_{\text{level}}$) without granting a full heal. |
| **OD-7A4-03 (`P1` & `OC-1`)** | **Ranger Favored Enemy: 14 Initial Categories (Option A)** | **LOCKED (Owner Directive)** | Character Creation offers **14 initial Favored Enemy categories** per Option A: `ANIMALS`, `LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS` (*"Other Magical Beasts"*), `ARACHNIDS`, `VERMIN_INSECTS`, `DANGEROUS_PLANTS`, `DRAGONS_DRAKES`, `GOBLINOIDS`, `ORCS`, `GNOLLS`, `REPTILIAN_HUMANOIDS`, `TROLLS`, `GIANTS`. `FEY` and `AMPHIBIAN_HUMANOIDS` move to Reserved/Advanced (`Tier 2`). `UNDEAD` (`11` monsters) is strictly forbidden. Legacy Rangers remain backward-compatible. |
| **OD-7A4-04 (`P2`)** | **Magical Beast Kinship Split (3 Families, No Extra Sub-Splits)** | **LOCKED (Owner Directive)** | Retain the 3 Magical Beast families (`LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS`), with `TERRESTRIAL_MAGICAL_BEASTS` using the clearer player-facing UI name **"Other Magical Beasts"**. Do **not** create additional biological sub-categories (`FELINE_MAGICAL_BEASTS`, `REPTILIAN_MAGICAL_BEASTS`, etc.). |
| **OD-7A4-05 (`P3`)** | **Battle Experience: Keep Strong INT/WIS Bonuses** | **LOCKED (Owner Directive)** | Retain the full Phase 7A.3 INT/WIS Battle Experience table without nerfs (`INT 18+` grants `+2` Damage at 1 kill and `+4` at 3 kills; `WIS 18+` grants `+2` AC at 1 kill and `+3` at 3 kills), low-INT/WIS unfamiliar penalties, class specialization exemptions, victories-only progression, character-specific tracking (reset on permadeath), and no general INT XP multiplier. |
| **OD-7A4-06 (`P4` & `OC-2`)** | **Fighter Second Wind (Option B Tier Progression)** | **LOCKED (Owner Directive)** | Automatic once per combat. **Level 1–2:** Not available. **Level 3–5:** Tier I (`1d10 + Level + CON mod`). **Level 6–9:** Tier II (`2d10 + Level + CON mod`). **Level 10+:** Tier III (`3d10 + Level + CON mod` + cleanse 1 physical status effect). Preserves post-sequence trigger ordering, lethal HP rescue (`0 + heal`), DoT rescue, and `CALCIFY` exclusion. |
| **OD-7A4-07 (`P5`)** | **Monster #36 Mummy Remains Extremely Dangerous** | **LOCKED (Owner Directive)** | Preserve Monster `#36 Mummy` at its existing seeded combat stats (`L5`, `HP 60` / post-009 `45`, `AC 20`, `Atk +14`, `1d8+10`, `DR 5/-`, `DESPAIR`, `MUMMY_ROT`, `habitats = '["U"]'`). Flag as a potential future boss/elite tomb encounter; do not nerf or alter seed data. |
| **OD-7A4-08 (`OC-3`)** | **Ranger Favored Enemy Bonus Progression (Option A)** | **LOCKED (Owner Directive)** | **Level 1–3:** `+2 Atk / +2 Dmg / 0 AC`. **Level 4–7:** `+3 Atk / +3 Dmg / 0 AC`. **Level 8:** `+4 Atk / +4 Dmg / 0 AC`. **Level 9+:** `+4 Atk / +4 Dmg / +2 AC`. Do **not** add expanded Critical Hit range (`19–20`). Stacks with *Natural Knowledge* and INT/WIS *Battle Experience*. Internal numbers remain hidden in player UI. |

---

## 3. Detailed Record of Owner-Approved Rules

### 3.1 OD-7A4-01: Open Character Level Progression & No Global Attribute Ceilings
- **Rule:** Darkgrid has **no approved maximum character level**.
- **Scope of Levels 1–10:** Levels 1–10 represent the currently documented class progression and simulation horizon, **not** a permanent level cap.
- **Approved Milestones Preserved:** Even-level attribute milestones at **Levels 2, 4, 6, 8, and 10** (`+1` attribute point each, `5` points total across L1–10) are preserved exactly as specified. No unapproved abilities, level-up rewards, or XP progression tables beyond Level 10 are invented without owner approval.
- **No Global Post-Creation Attribute Caps:**
  - The score `18` is strictly a **Level 1 Character Creation allocation maximum** ([`src/domain/character/rules.js:244`](../../../src/domain/character/rules.js#L244)).
  - Scores of `23` (e.g., `18` creation + `5` milestone points at L10) and `25` (e.g., `23` + `+2` item bonus) are **illustrative examples at Level 10**, never hardcoded maximums in formulas or validation logic.
- **Formula Openness:** All combat, HP, Base Attack Bonus (BAB), saving throw, and ability tier formulas must use open-ended threshold comparisons (e.g., `level >= 10`, `level >= 9`, `level >= 6`, `level >= 5`) rather than `level === 10` or clamping `level <= 10`.
- **Full specification:** See [`PHASE-7A4-LEVELS-AND-CONSTITUTION.md`](./PHASE-7A4-LEVELS-AND-CONSTITUTION.md).

### 3.2 OD-7A4-02: Constitution — Equipment CON vs. Permanent CON vs. Level-Up
The owner has established a strict separation between temporary Constitution bonuses from equipment and permanent Constitution growth from spending attribute points:

#### A. Constitution from Equipment (Zero Free Healing)
- When equipping, unequipping, or swapping equipment changes a character's effective Constitution modifier ($\Delta M_{\text{con}}$), **Maximum HP** is recalculated retroactively across all levels ($L \times M_{\text{con}}$).
- **Current HP does NOT increase** when equipping `+CON` gear. The hero must use healing (potions, rest, *Lay on Hands*, etc.) to fill the newly added HP capacity.
- When removing or replacing gear reduces `Max HP`, `Current HP` remains unchanged unless it exceeds `newMaxHp`.
- A living hero (`is_alive = 1`) can **never die** from an equipment change (`1 HP` minimum floor).
- **Canonical Equipment CON Rule (Applies to All Equip, Unequip & Slot Swap Operations):**
  $$\text{newCurrentHp} = \max\Big(1,\; \min\big(\text{oldCurrentHp},\; \text{newMaxHp}\big)\Big)$$
- **Canonical Owner Examples:**
  - *Wounded Equip/Heal/Unequip/Re-equip:* `35/60 HP` $\rightarrow$ equip `+2 CON` $\rightarrow$ `35/67 HP` $\rightarrow$ Heal `20` $\rightarrow$ `55/67 HP` $\rightarrow$ Unequip $\rightarrow$ `55/60 HP` $\rightarrow$ Re-equip $\rightarrow$ `55/67 HP`.
  - *Full-HP Unequip/Re-equip:* `67/67 HP` $\rightarrow$ unequip $\rightarrow$ `60/60 HP` $\rightarrow$ Re-equip $\rightarrow$ `60/67 HP`.

#### B. Permanent Constitution Increases (Spending an Attribute Point)
- When a hero spends a milestone attribute point to permanently raise base `CON`:
  - Recalculate `Max HP` across all levels ($\Delta \text{MaxHP} = L \times \Delta M_{\text{con}}$).
  - If $\Delta M_{\text{con}} > 0$, **`Current HP` increases by the exact same HP gain** ($\Delta \text{HP} = L \times \Delta M_{\text{con}}$), without granting a full heal beyond that increase:
    $$\text{newCurrentHp} = \min\Big(\text{newMaxHp},\; \text{oldCurrentHp} + L \times \Delta M_{\text{con}}\Big)$$
  - If $\Delta M_{\text{con}} = 0$ (e.g., base `CON` increases from even `14` to odd `15`), neither `Max HP` nor `Current HP` changes (`+0 HP`).
- **Canonical Owner Example:**
  - Level 7 Ranger at `35/60 HP` with CON modifier `+2` spends an attribute point raising permanent CON modifier from `+2` to `+3` ($\Delta \text{MaxHP} = +7$). Result: **`42/67 HP`**.

#### C. Level-Up HP Gain
- When a hero gains a level ($L_{\text{old}} \rightarrow L_{\text{new}}$), the HP increase ($\Delta \text{MaxHP}_{\text{level}} = \text{newMaxHp} - \text{oldMaxHp}$) is added to both `Max HP` and `Current HP`, without granting an automatic full heal.

#### D. Login / Reload Reconciliation Safety
- Login or session reload must **never** confuse equipment CON `Max HP` with a permanent CON increase. Reconciliation updates `max_hp` to `MaxHP_canonical` and clamps `current_hp` via $\max(1, \min(\text{current\_hp}, \text{MaxHP}_{\text{canonical}}))$ for living heroes — never adding `+\Delta MaxHP` on login.
- **Full specification & 10 Phase 7B test requirements:** See [`PHASE-7A4-LEVELS-AND-CONSTITUTION.md`](./PHASE-7A4-LEVELS-AND-CONSTITUTION.md).

### 3.3 OD-7A4-03 (`P1` & `OC-1`) & OD-7A4-04 (`P2`): Ranger Favored Enemy Option A & Magical Beast Classification
- **Option A Locked (14 Initial Categories):** Ranger Character Creation offers **exact 14 initial Favored Enemy categories**:
  1. `ANIMALS` (*Beasts & Wild Animals*)
  2. `LUPINE_CANINE_BEASTS` (*Magical Hounds & Wolves*)
  3. `AVIAN_CHIMERAS` (*Winged Chimeras & Great Raptors*)
  4. `TERRESTRIAL_MAGICAL_BEASTS` (**"Other Magical Beasts"**)
  5. `ARACHNIDS` (*Spiders, Scorpions & Arachnids*)
  6. `VERMIN_INSECTS` (*Giant Insects, Centipedes & Beetles*)
  7. `DANGEROUS_PLANTS` (*Carnivorous Plants & Fungal Horrors*)
  8. `DRAGONS_DRAKES` (*Drakes, Wyverns & Dragonkin*)
  9. `GOBLINOIDS` (*Goblinoids: Goblins, Hobgoblins & Bugbears*)
  10. `ORCS` (*Orcs*)
  11. `GNOLLS` (*Gnolls*)
  12. `REPTILIAN_HUMANOIDS` (*Reptilian Humanoids: Kobolds, Lizardfolk & Troglodytes*)
  13. `TROLLS` (*Trolls*)
  14. `GIANTS` (*Giants & Ogres*)
- **Reserved / Advanced Categories (`Tier 2`):**
  - `FEY` and `AMPHIBIAN_HUMANOIDS` are placed in the Reserved/Advanced tier (`Tier 2`) alongside `MONSTROUS_HUMANOIDS`, `ABERRATIONS`, and `SUBTERRANEAN_HUMANOIDS`.
  - `TROLLS`, `GIANTS`, and `DRAGONS_DRAKES` remain available at Character Creation.
- **Magical Beast Classification Finalized:**
  - The owner approves the 3-way split (`LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS`) and recognizes that in a dark fantasy RPG, diverse chimeric magical beasts cannot all be subdivided into pure biological families.
  - `TERRESTRIAL_MAGICAL_BEASTS` is given the clear player-facing English UI label **"Other Magical Beasts"**.
  - No additional sub-categories (`FELINE_MAGICAL_BEASTS`, `REPTILIAN_MAGICAL_BEASTS`, etc.) are created.
- **Strict Constraints Enforced:**
  - `UNDEAD` (**`11` monsters** in the 98-monster taxonomy: `10` surface-active, `1` Underground-only `#36 Mummy`) is **always strictly forbidden** for Rangers (`RANGER_FAVORED_ENEMY_FORBIDDEN`).
  - Legacy Rangers with `favored_enemy_type` / `favored_enemy_subtype` remain 100% backward-compatible.
- **Full specification:** See [`PHASE-7A4-RANGER-TAXONOMY.md`](./PHASE-7A4-RANGER-TAXONOMY.md).

### 3.4 OD-7A4-05 (`P3`): Battle Experience Retained Without Nerfs
- **Rule:** Retain the complete Phase 7A.3 INT/WIS Battle Experience table without numerical reductions:

| Attribute Score | Tier 0 (`0` Kills — Unfamiliar) | Tier 1 (`1–2` Kills — Initiated) | Tier 2 (`3+` Kills — Mastered) |
| :--- | :--- | :--- | :--- |
| **`<= 7`** | **INT:** `-1` Atk / **WIS:** `-2` AC | `0` (Penalty Cleared) | `0` |
| **`8–9`** | **INT:** `0` / **WIS:** `-1` AC | `0` (Penalty Cleared) | `0` |
| **`10–11`** | `0` | `0` | **INT:** `+1` Dmg / **WIS:** `+1` AC |
| **`12–13`** | `0` | **INT:** `+1` Dmg / **WIS:** `+1` AC | **INT:** `+1` Dmg / **WIS:** `+1` AC |
| **`14–15`** | `0` | **INT:** `+1` Dmg / **WIS:** `+1` AC | **INT:** `+2` Dmg / **WIS:** `+2` AC |
| **`16–17`** | `0` | **INT:** `+2` Dmg / **WIS:** `+1` AC | **INT:** `+3` Dmg / **WIS:** `+2` AC |
| **`18+`** | `0` | **INT:** `+2` Dmg / **WIS:** `+2` AC | **INT:** `+4` Dmg / **WIS:** `+3` AC |

- **Invariants:**
  - **Victories Only:** Only lethal combat victories (`monsterHp <= 0` while hero survives) increment `victories` for `(character_id, monster_id)`. Fleeing, parley, and defeat grant `0` progress.
  - **Class Specialization Exemptions:** Fighters (`Know Your Enemy`), Rangers (`Natural Knowledge` and selected `Favored Enemy`), and Clerics (`Sacred Knowledge` vs. `UNDEAD`) are exempt from Tier 0 low-INT/low-WIS unfamiliar penalties against covered monsters and start at an effective floor of Tier 1 (`1` kill) when `victories === 0` (yielding `max(0, Tier1Bonus(score))`).
  - **Character-Specific & Permadeath-Bound:** Stored per `character_id`; never inherited by new characters after permadeath.
  - **No General INT XP Multiplier:** INT never multiplies XP earned.
  - **Hidden Math:** Internal numbers remain hidden from players; narrative descriptions and qualitative journal mastery states (*Unfamiliar*, *Initiated*, *Seasoned*, *Mastered*) communicate the hero's growing expertise.

### 3.5 OD-7A4-06 (`P4` & `OC-2`): Fighter Second Wind — Option B Locked
- **Tier Progression by Level (Option B Locked, No Maximum Level):**
  - **Level 1–2:** Second Wind is **not available**.
  - **Level 3–5 (Tier I — *Second Wind*):** Heals $1\text{d}10 + \text{Level} + M_{\text{con}}$.
  - **Level 6–9 (Tier II — *Improved Second Wind*):** Heals $2\text{d}10 + \text{Level} + M_{\text{con}}$.
  - **Level 10+ (`level >= 10`, Tier III — *Greater Second Wind*):** Heals $3\text{d}10 + \text{Level} + M_{\text{con}}$ and cleanses **one active physical status effect** (`BLEED` or `POISON`, prioritizing `BLEED`).
- **Trigger Conditions (Automatic, Once Per Combat):**
  1. **Critical Threshold Trigger:** Hero's post-sequence Current HP satisfies $0 < \text{HP} \le \lfloor 0.25 \times \text{MaxHP} \rfloor$.
  2. **Lethal HP Rescue Trigger:** Hero's post-sequence Current HP drops to $\le 0$ from standard physical/elemental attack damage, multi-hit sequences, damage riders, or end-of-round Poison/Bleed DoT ticks.
- **Strict Trigger Ordering & Exclusions Preserved:**
  - Resolves **only after** the monster's complete multi-hit/rider attack sequence finishes.
  - If $\text{HP}_{\text{raw}} \le 0$ after the full sequence, lethal rescue resets HP to `0` before applying the Second Wind heal (`newHp = min(maxHp, 0 + healRoll)`).
  - Does **not** trigger against non-HP instant death (`CALCIFY` petrification).
  - Internal math remains hidden in the player UI (`Second Wind: Ready` / `Second Wind: Spent` badge + narrative prose).

### 3.6 OD-7A4-07 (`P5`): Monster #36 Mummy Preserved at Full Lethality
- **Rule:** Monster `#36 Mummy` (`Undead`, `L5`, `AC 20`, `Atk +14`, `1d8+10`, `DR 5/-`, `DESPAIR`, `MUMMY_ROT`, Underground habitat) retains all of its current statistics and database seed values. Flagged as a potential future boss or elite tomb encounter; never nerfed or altered in `db/seeds/`.

### 3.7 OD-7A4-08 (`OC-3`): Ranger Favored Enemy Bonuses — Option A Locked
- **Rule:** Ranger *Favored Enemy* bonuses follow **Option A** (open-ended at `Level 9+`, with **no** expanded Critical Hit range):

| Ranger Level | Favored Enemy Attack Bonus | Favored Enemy Damage Bonus | Favored Enemy AC Bonus | Critical Hit Range Expansion |
| :--- | :---: | :---: | :---: | :---: |
| **Level 1–3** | `+2` | `+2` | `0` | None (`20` only) |
| **Level 4–7** | `+3` | `+3` | `0` | None (`20` only) |
| **Level 8** | `+4` | `+4` | `0` | None (`20` only) |
| **Level 9+ (`level >= 9`)** | `+4` | `+4` | `+2` | None (`20` only) |

- **Additive Stacking Preserved:** These bonuses stack additively with Ranger *Natural Knowledge* (when the Favored Enemy is also a natural creature family) and with INT/WIS *Battle Experience* per approved rules.
- **Hidden Numbers in UI:** Exact `+Atk / +Dmg / +AC` numbers remain hidden from the player UI, while combat log prose and journal descriptions highlight the Ranger's specialized quarry mastery.

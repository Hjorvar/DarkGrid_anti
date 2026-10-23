# DARKGRID — PHASE 7A.4: FINAL CONSISTENCY REPORT & CODEBASE AUDIT

**Date:** 2026-10-22  
**Scope:** Phase 7A.4 — Comprehensive Cross-Audit of Phase 7A.2, Phase 7A.3, Phase 7A.4, and Live Production Codebase (`src/`, `action-ui-lab/`, `db/`)  
**Status:** **100% RECONCILED (Zero Open Design Discrepancies Remaining)**  
**Supersedes:** [`PHASE-7A3-CONSISTENCY-AUDIT.md`](../phase-7a3/PHASE-7A3-CONSISTENCY-AUDIT.md) and earlier drafts of `PHASE-7A4-CONSISTENCY-REPORT.md`

---

## 1. Purpose & Methodology

This report audits every formula, monster count, SQLite schema reference, and function signature across `action-ui-lab/docs/phase-7a2/`, `action-ui-lab/docs/phase-7a3/`, `action-ui-lab/docs/phase-7a4/`, and the live codebase (`src/`, `action-ui-lab/server/`, `db/migrations/`, `db/seeds/`).

All findings are classified into:
1. **Owner-Approved Rules (LOCKED):** Authoritative game design decisions confirmed by the project owner.
2. **Engineering Implementation Specifications:** Concrete technical alignments required for Phase 7B against actual codebase symbols and SQLite schemas.

---

## 2. Discrepancies Resolved by Final Owner Directives

### 2.1 Level-10-Cap & Attribute-Ceiling Language Removed (`OD-7A4-01`)
- **Discrepancy:** [`PHASE-7A3-ATTRIBUTES.md`](../phase-7a3/PHASE-7A3-ATTRIBUTES.md) (L51, L61–63, L83), [`PHASE-7A3-SECOND-WIND.md`](../phase-7a3/PHASE-7A3-SECOND-WIND.md) (L32), [`PHASE-7A3-EXECUTIVE-SUMMARY.md`](../phase-7a3/PHASE-7A3-EXECUTIVE-SUMMARY.md) (L36), [`PHASE-7A3-PHASE7B-ROADMAP.md`](../phase-7a3/PHASE-7A3-PHASE7B-ROADMAP.md) (L35), and [`PHASE-7A3-SIMULATION-PLAN.md`](../phase-7a3/PHASE-7A3-SIMULATION-PLAN.md) (L49) framed Level 10 as the maximum level and `23` (natural) / `25` (equipped) as permanent attribute ceilings.
- **Resolution (LOCKED):**
  - Removed all claims that Level 10 is a maximum level or that `23` / `25` are global attribute caps.
  - Defined Fighter *Battle-Hardened II* (`+2L` HP) for **$L \ge 5$** (open-ended), Ranger *Favored Enemy* top tier (`+4/+4/+2 AC`) for **$L \ge 9$** (open-ended), and Fighter *Second Wind III* (`3d10 + L + CON` + cleanse) for **$L \ge 10$** (open-ended).
  - Defined approved attribute milestone validation for any $L \ge 1$ as $\sum_{m \in \{2,4,6,8,10\}} \mathbb{I}(L \ge m) = \min(5, \lfloor L/2 \rfloor)$ without inventing unapproved post-L10 milestones, abilities, or XP curves.

### 2.2 Separation of Equipment CON vs. Permanent CON Increases (`OD-7A4-02`)
- **Discrepancy:**
  - [`PHASE-7A3-ATTRIBUTES.md`](../phase-7a3/PHASE-7A3-ATTRIBUTES.md) (L96) specified `currentHp = max(1, min(newMaxHp, currentHp + max(0, L * \Delta M_con)))`, creating an infinite free-heal exploit on unequip/re-equip.
  - Earlier Phase 7A.4 drafts treated equipment CON and permanent CON identically (adding and subtracting $L \times \Delta M_{\text{con}}$ to `Current HP` on equip/unequip), and also added `+\Delta MaxHP` during login reconciliation.
- **Resolution (LOCKED):**
  - **Equipment CON (`equipItem`, `unequipItem`, slot swap):** Recalculates `Max HP` retroactively across all levels ($L \times M_{\text{con}}$), does **NOT** increase `Current HP` on equip, and clamps `Current HP` via:
    $$\text{newCurrentHp} = \max\Big(1,\; \min\big(\text{oldCurrentHp},\; \text{newMaxHp}\big)\Big)$$
  - **Permanent CON (`spendAttributePoint`):** Recalculates `Max HP` across all levels and increases `Current HP` by the exact same HP gain ($\Delta \text{HP} = L \times \Delta M_{\text{con}}$ when $\Delta M_{\text{con}} > 0$), without a full heal.
  - **Level-Up (`checkAndApplyLevelUp`):** Adds $\Delta \text{MaxHP}_{\text{level}} = \text{newMaxHp} - \text{oldMaxHp}$ to both `Max HP` and `Current HP` without a full heal.
  - **Login / Reload Reconciliation:** Recomputes `MaxHP_canonical`, updates `max_hp = MaxHP_canonical`, and clamps `current_hp = max(1, min(oldCurrentHp, MaxHP_canonical))` (never adding `+\Delta MaxHP` on login so equipment CON is never mistaken for a permanent CON increase).

### 2.3 Document Dates Standardized to Actual Project Work Date
- **Discrepancy:** Earlier drafts in `action-ui-lab/docs/phase-7a4/` carried `**Date:** 2026-04-20`.
- **Resolution:** All Phase 7A.4 documents are standardized to the actual project work date **`2026-10-22`**.

---

## 3. Monster Knowledge, `UNDEAD = 11` & Surface Count (`88 / 87 / 86`) Reconciliations

### 3.1 `UNDEAD` Count Standardized to `11` Monsters (Not `12`)
- **Discrepancy:**
  - [`PHASE-7A3-RANGER-FAMILIES.md`](../phase-7a3/PHASE-7A3-RANGER-FAMILIES.md) (L156) and line 69 of the earlier `PHASE-7A4-OWNER-DECISIONS.md` draft stated `12` Undead monsters, whereas [`PHASE-7A4-RANGER-TAXONOMY.md`](./PHASE-7A4-RANGER-TAXONOMY.md) listed `11` Undead monsters (`#53 Medusa` is `Monstrous Humanoid`).
- **Resolution (LOCKED):**
  - Standardized across **all** documents: **`UNDEAD` = `11` monsters** (`10` surface-active: `#37` Wight, `#44` Ghoul, `#54` Shadow, `#60` Ghast, `#61` Wraith, `#79` Crawling Hand, `#83` Skeletal Archer, `#91` Zombie, `#92` Skeleton, `#93` Huecuva; `1` Underground-only: `#36` Mummy).
  - Strictly forbidden as a Ranger Favored Enemy (`RANGER_FAVORED_ENEMY_FORBIDDEN`) and covered by Cleric *Sacred Knowledge* / *Turn Undead*.

### 3.2 Canonical Surface Monster Count (`88` vs. `87` vs. `86`)
- **Discrepancy:** Earlier documents cited `86` (Phase 7A.2 / 7A.3), `87` (`PHASE-7A4-RANGER-TAXONOMY.md` L159 subtotal), and `88` (`PHASE-7A4-RANGER-TAXONOMY.md` L287).
- **Resolution (LOCKED Canonical Definition):**
  - **Canonical Definition (`88` Surface / `10` Non-Surface):** River (`R` / `RIVER_LAKE`) is defined as a surface terrain alongside `{P, F, S, H, M, D, J}`. Because `#68 Sahuagin` has `habitats = ["C", "O", "R"]`, it is surface-active on River (`R`), yielding **exact `88` surface monsters and `10` strictly non-surface `{U, T}` monsters** (`#13, #15, #20, #36, #46, #47, #51, #57, #63, #77`).
  - **Why `87` appeared previously:** Treating `#68 Sahuagin` (`C, O, R`) as coastal/ocean non-surface reduced `88` by `1` to `87`.
  - **Why `86` appeared previously:** On the current `15×15` base world map (`db/seeds/001_seed_world.sql`), `RIVER_LAKE (R)` and `MOUNTAINS (M)` tiles currently have `is_passable = 0` and `DESERT (D)` has `0` tiles, so `86` monsters currently spawn on passable overworld tiles `{F, S, P, J, H}`.

### 3.3 Class Passive Knowledge Monster Counts (Under Canonical `88` Surface Definition)
- **Fighter *Know Your Enemy*:** **`25 / 98` total monsters** (`17` `Humanoid` + `7` armed/tactical `Monstrous Humanoid` `#32, #33, #34, #50, #51, #63, #68` + `1` martial `Fey` `#82 Spriggan`) = **`21 / 88` canonical surface monsters** (including `#68 Sahuagin` on River `R`) and **`4 / 10` non-surface `{U, T}` monsters** (`#46 Duergar`, `#47 Drow`, `#51 Doppelganger`, `#63 Morlock`).
- **Ranger *Natural Knowledge*:** **`52 / 98` total monsters** by `monster_family` (`ANIMALS [12]`, `LUPINE_CANINE_BEASTS [4]`, `AVIAN_CHIMERAS [5]`, `TERRESTRIAL_MAGICAL_BEASTS [10]`, `ARACHNIDS [4]`, `VERMIN_INSECTS [8]`, `DANGEROUS_PLANTS [6]`, `FEY [2]`) = **`49 / 88` canonical surface monsters** and **`3 / 10` non-surface `U` monsters** (`#15 Darkmantle`, `#20 Giant Centipede`, `#77 Cave Scorpion`). *(Or `51 / 98` total / `48 / 88` surface if evaluated strictly by raw `creature_type` excluding `#26 Ettercap`).*
- **Cleric *Sacred Knowledge*:** **`11 / 98` total `UNDEAD` monsters** = **`10 / 88` canonical surface monsters** and **`1 / 10` non-surface `U` monster** (`#36 Mummy`).

---

## 4. Class Progression & Locked `OC-1`, `OC-2`, `OC-3` Resolutions

### 4.1 `OC-1` Locked: Ranger 14 Initial Favored Enemy Categories (Option A)
- **Resolution:** Option A is locked. Character Creation offers `ANIMALS`, `LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS` (UI label: **"Other Magical Beasts"**), `ARACHNIDS`, `VERMIN_INSECTS`, `DANGEROUS_PLANTS`, `DRAGONS_DRAKES`, `GOBLINOIDS`, `ORCS`, `GNOLLS`, `REPTILIAN_HUMANOIDS`, `TROLLS`, and `GIANTS` (`64` total / `61` surface). `FEY` and `AMPHIBIAN_HUMANOIDS` are in Reserved/Advanced (`Tier 2`). No extra biological sub-splits are created.

### 4.2 `OC-2` Locked: Fighter *Second Wind* Progression (Option B)
- **Resolution:** Option B is locked:
  - **Level 1–2:** Not available.
  - **Level 3–5:** Tier I (`1d10 + Level + CON modifier`).
  - **Level 6–9:** Tier II (`2d10 + Level + CON modifier`).
  - **Level 10+ (`level >= 10`):** Tier III (`3d10 + Level + CON modifier` + cleanse 1 physical status effect `BLEED` or `POISON`).
  - Hooked into `executeCombatAction` after the monster's complete multi-hit/rider sequence and into `resolveEndOfRoundStatusTicks` ([`src/domain/combat/engine.js:892`](../../../src/domain/combat/engine.js#L892)) after Poison/Bleed DoT ticks.

### 4.3 `OC-3` Locked: Ranger *Favored Enemy* Bonus Progression (Option A)
- **Resolution:** Option A is locked:
  - `Level 1–3`: `+2` Attack, `+2` Damage, `0` AC
  - `Level 4–7`: `+3` Attack, `+3` Damage, `0` AC
  - `Level 8`: `+4` Attack, `+4` Damage, `0` AC
  - `Level 9+ (`level >= 9`)`: `+4` Attack, `+4` Damage, `+2` AC
  - No expanded Critical Hit range (`19–20`). Stacks with *Natural Knowledge* and INT/WIS *Battle Experience*.

### 4.4 Cleric Base Attack Bonus (BAB) Formula
- **Resolution:** Standardize [`src/domain/character/rules.js:90`](../../../src/domain/character/rules.js#L90) on `Math.ceil(lvl * 3 / 4)` for `CLERIC` (open-ended for any `lvl >= 1`), matching the Phase 7A.2 progression table (`+1` at L1 up to `+8` at L10).

---

## 5. Codebase vs. Documentation Symbol & Schema Audit

| # | Phase 7A.3 Claim | Actual Live Codebase Reality | Phase 7A.4 Engineering Fix |
| :---: | :--- | :--- | :--- |
| **E1** | Cited migration `db/migrations/009_*.sql` in [`PHASE-7A3-BATTLE-EXPERIENCE.md`](../phase-7a3/PHASE-7A3-BATTLE-EXPERIENCE.md) (L96) and [`PHASE-7A3-PHASE7B-ROADMAP.md`](../phase-7a3/PHASE-7A3-PHASE7B-ROADMAP.md) (L21). | `db/migrations/` already contains **`001` through `013`** (`009` is `009_item_equipment_loot_system.sql`; `013` is `013_production_blaze_hardening.sql`). | Renumber Phase 7B migration to **`db/migrations/014_phase7b_taxonomy_attributes_and_battle_experience.sql`**. |
| **E2** | Claimed `spendCharacterAttributePoint` exists at [`auth-character-controller.js:222`](../../../action-ui-lab/server/controllers/auth-character-controller.js#L222) and `characters.attribute_points` exists in DB. | `auth-character-controller.js:222` is inside `postLogout`. Neither `characters.attribute_points` nor `spendCharacterAttributePoint` exists in the repo yet. | Add `attribute_points INTEGER NOT NULL DEFAULT 0` and `initial_attributes_json TEXT DEFAULT NULL` to `characters` in migration `014`, implement `spendAttributePoint` in [`src/domain/character/rules.js`](../../../src/domain/character/rules.js), and expose `POST /api/character/attributes/spend` in [`character-town-controller.js`](../../../action-ui-lab/server/controllers/character-town-controller.js). |
| **E3** | Referred to `characters.favored_enemy` column in [`PHASE-7A3-RANGER-FAMILIES.md`](../phase-7a3/PHASE-7A3-RANGER-FAMILIES.md). | Actual columns in `006_progression_equipment_and_loot.sql` are **`favored_enemy_type`** and **`favored_enemy_subtype`**. | Preserve `favored_enemy_type` and `favored_enemy_subtype` for legacy Rangers and add **`favored_enemy_family TEXT DEFAULT NULL`** in migration `014`. |
| **E4** | Referred to `WAIST` equipment slot in [`PHASE-7A3-ATTRIBUTES.md`](../phase-7a3/PHASE-7A3-ATTRIBUTES.md). | Actual slot constant in [`src/domain/character/rules.js:630, 738`](../../../src/domain/character/rules.js#L630) is **`BELT`** (`equipment.belt`). | Use **`BELT`** (alongside `MELEE`, `RANGED`, `ARMOR`, `SHIELD`, `RING`, `CLOAK`, `NECK`, `FEET`) in `getEffectiveStats`. |
| **E5** | Referred to `initiateCombat` and `resolvePermadeath` in [`PHASE-7A3-CONSISTENCY-AUDIT.md`](../phase-7a3/PHASE-7A3-CONSISTENCY-AUDIT.md). | Actual functions are **`startCombat`** ([`src/domain/combat/engine.js:161`](../../../src/domain/combat/engine.js#L161)) and **`handlePlayerDeath`** ([`src/domain/monsters/persistence.js:22`](../../../src/domain/monsters/persistence.js#L22)). | Reference exact function names `startCombat`, `executeCombatAction`, and `handlePlayerDeath` in the Phase 7B readiness plan. |
| **E6** | `getEffectiveStats` in [`src/domain/character/rules.js:918–958`](../../../src/domain/character/rules.js#L918-L958) only checks `equipment.belt` for `strength_bonus`. | Items enhancing `CON`, `DEX`, `INT`, `WIS`, or `CHA` in any slot are currently ignored by `getEffectiveStats`. | Generalize `getEffectiveStats` in Phase 7B to aggregate all 6 attribute bonuses across all 9 equipped slots and recompute all 6 attribute modifiers. |
| **E7** | Monster IDs in Phase 7A.3/7A.4 design tables vs. raw SQLite seed rows (`db/seeds/002`–`010`). | Raw SQLite seeds (`002`–`010`) use slightly different ID ordering for several Pathfinder monsters (e.g., `#4 Ghoul`, `#11 Human Skeleton`, `#13 Human Zombie`, `#30 Shadow`, `#44 Skeletal Champion`, `#49 Wight`, `#56 Wraith`, `#61 Ghast`, `#73 Plague Zombie`, `#85 Draugr`, `#96 Barrow Wight`). | In migration `014`, populate `monster_family` using deterministic **`creature_type` + `creature_subtype` + `name` matching rules** (as well as explicit ID overrides where needed) so every seeded row in `monsters` receives its exact biological family regardless of seed file ID order. |

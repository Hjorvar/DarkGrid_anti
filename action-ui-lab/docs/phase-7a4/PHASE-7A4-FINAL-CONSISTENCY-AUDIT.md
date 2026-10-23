# DARKGRID — PHASE 7A.4: FINAL CONSISTENCY AUDIT

**Date:** 2026-10-22  
**Scope:** Phase 7A.4 Final Corrections — Cross-Audit of Phase 7A.2, Phase 7A.3, Phase 7A.4, SQLite Seeds (`001`–`010`), Migrations (`001`–`013`), and Live Codebase  
**Status:** **100% CONSISTENT Across All Phase 7A.4 Deliverables**  
**Related Documents:**
- [`PHASE-7A4-FINAL-OWNER-DECISIONS.md`](./PHASE-7A4-FINAL-OWNER-DECISIONS.md)
- [`PHASE-7A4-FINAL-PHASE7B-READINESS.md`](./PHASE-7A4-FINAL-PHASE7B-READINESS.md)
- [`PHASE-7A4-CONSISTENCY-REPORT.md`](./PHASE-7A4-CONSISTENCY-REPORT.md)
- [`PHASE-7A4-RANGER-TAXONOMY.md`](./PHASE-7A4-RANGER-TAXONOMY.md)
- [`PHASE-7A4-LEVELS-AND-CONSTITUTION.md`](./PHASE-7A4-LEVELS-AND-CONSTITUTION.md)

---

## 1. Audit Summary & Consistency Verdict

Every document in `action-ui-lab/docs/phase-7a4/` has been audited against:
1. The project owner's final locked directives (`OC-1` Option A, `OC-2` Option B, `OC-3` Option A, Equipment CON vs. Permanent CON vs. Level-up, Open Level Progression, and preserved core rules).
2. Earlier Phase 7A.2 (`action-ui-lab/docs/phase-7a2/`) and Phase 7A.3 (`action-ui-lab/docs/phase-7a3/`) documents.
3. The live SQLite migrations (`db/migrations/001`–`013`), seeds (`db/seeds/001`–`010`), and domain code (`src/domain/`, `action-ui-lab/server/`).

**Verdict:** **Zero unresolved design contradictions remain across the Phase 7A.4 documentation suite.** All formulas, monster counts, level brackets, and test requirements are unified under a single canonical specification.

---

## 2. Complete Ledger of Discrepancies Fixed in Phase 7A.4 Final Corrections

### 2.1 Fix 1: `UNDEAD` Count Standardized to `11` (Not `12`)
- **What Was Inconsistent:**
  - [`PHASE-7A3-RANGER-FAMILIES.md`](../phase-7a3/PHASE-7A3-RANGER-FAMILIES.md) (L156) and line 69 of the earlier draft of [`PHASE-7A4-OWNER-DECISIONS.md`](./PHASE-7A4-OWNER-DECISIONS.md) stated `UNDEAD (12 monsters)`, whereas the 98-monster taxonomy table in [`PHASE-7A4-RANGER-TAXONOMY.md`](./PHASE-7A4-RANGER-TAXONOMY.md) listed **`11` Undead monsters** (`#53 Medusa` is `Monstrous Humanoid`, giving `MONSTROUS_HUMANOIDS = 9` and `UNDEAD = 11`).
- **How It Was Fixed:**
  - Corrected [`PHASE-7A4-OWNER-DECISIONS.md`](./PHASE-7A4-OWNER-DECISIONS.md) and all companion Phase 7A.4 documents so **`UNDEAD = 11` monsters** (`10` surface-active: `#37` Wight, `#44` Ghoul, `#54` Shadow, `#60` Ghast, `#61` Wraith, `#79` Crawling Hand, `#83` Skeletal Archer, `#91` Zombie, `#92` Skeleton, `#93` Huecuva; `1` Underground-only: `#36` Mummy) is 100% consistent everywhere.

### 2.2 Fix 2: Surface Monster Count (`88` vs. `87` vs. `86`) & River (`R`) as Surface Terrain
- **What Was Inconsistent:**
  - Phase 7A.2 and Phase 7A.3 documents cited **`86` surface / `12` non-surface** monsters.
  - The earlier draft of [`PHASE-7A4-RANGER-TAXONOMY.md`](./PHASE-7A4-RANGER-TAXONOMY.md) cited **`87` surface / `11` non-surface** in the Section 4 subtotal table (L159), **`86` surface / `12` non-surface** in the Section 5 intro prose (L165), and **`88` surface / `10` non-surface** in the Section 5 habitat verification note (L287).
- **Exact Root Cause & Verified Reconciliation:**
  1. **`88` Surface / `10` Non-Surface (LOCKED CANONICAL DEFINITION — River `R` Included as Surface Terrain):**
     - Defining geographical surface terrains as **`{P (Plains), R (River/Lake), F (Forest), S (Swamp), H (Hills), M (Mountains), D (Desert), J (Jungle)}`** (where **River `R` is explicitly a surface terrain**), `#68 Sahuagin` (`habitats = ["C", "O", "R"]`) is surface-active on River (`R`).
     - Only **10 monsters** in the 98-monster table have habitats restricted exclusively to Underground/City (`{U, T}`):
       `#13 Gelatinous Cube (U)`, `#15 Darkmantle (U)`, `#20 Giant Centipede (U)`, `#36 Mummy (U)`, `#46 Duergar (U)`, `#47 Drow (U)`, `#51 Doppelganger (T, U)`, `#57 Choker (U)`, `#63 Morlock (U)`, and `#77 Cave Scorpion (U)`.
     - This yields **exact `88` Surface monsters and `10` Non-Surface monsters (`88 + 10 = 98`)**.
  2. **Why `87` Appeared in Earlier Phase 7A.4 Tables:**
     - `#68 Sahuagin` (`["C", "O", "R"]`) had been marked `Surf? = No` because its other two habitats are Coast (`C`) and Ocean (`O`), reducing `88` by `1` to `87` (`11` non-surface). Updating `#68 Sahuagin` to `Surf? = Yes (R)` aligns every table to **`88` Surface / `10` Non-Surface**.
  3. **Why `86` Appeared in Phase 7A.2 / 7A.3 & Map Simulation Docs:**
     - On the current `15×15` base overworld seed (`db/seeds/001_seed_world.sql`), only the 5 terrains **`{FOREST (F), SWAMP (S), PLAINS (P), JUNGLE (J), HILLS (H)}`** have passable unsafe wilderness tiles (`RIVER_LAKE (R)` and `MOUNTAINS (M)` have `is_passable = 0`, `CITY (T)` has `is_safe = 1`, and `DESERT (D)` has `0` tiles).
     - Exactly **`86` of `98` monsters** have at least one terrain in `{F, S, P, J, H}` (and adding `RIVER_LAKE (R)` to `{F, S, P, J, H, R}` in the raw SQLite seeds brings in `#25 Giant Crab ["C","R","A"]` and `#68 Sahuagin ["C","O","R"]`, raising `86` to **`88`**!).
- **How It Was Fixed:**
  - Standardized all tables and subtotals in [`PHASE-7A4-RANGER-TAXONOMY.md`](./PHASE-7A4-RANGER-TAXONOMY.md) and [`PHASE-7A4-CONSISTENCY-REPORT.md`](./PHASE-7A4-CONSISTENCY-REPORT.md) on the **single canonical definition (`88` Surface / `10` Non-Surface with River `R` included)**, while documenting the `86` passable-tile metric on `001_seed_world.sql` and the retired `87` count in an explicit reference table.

### 2.3 Fix 3: Separation of Equipment CON vs. Permanent CON vs. Level-Up (`OD-7A4-02`)
- **What Was Inconsistent:**
  - Phase 7A.3 (`PHASE-7A3-ATTRIBUTES.md` L96) had `max(0, L * \Delta M_con)` which failed to subtract HP on unequip (infinite heal exploit).
  - Initial Phase 7A.4 (`PHASE-7A4-LEVELS-AND-CONSTITUTION.md`) treated equipment CON and permanent CON identically (increasing `Current HP` by $+L \times \Delta M_{\text{con}}$ on equip and subtracting it on unequip) and also added `+\Delta MaxHP` on login reconciliation.
- **How It Was Fixed:**
  - Updated all Phase 7A.4 documents to enforce the owner's locked distinction:
    - **Equipment CON (`equipItem`, `unequipItem`, slot swap):** Recalculates `Max HP` retroactively across all levels ($L \times M_{\text{con}}$), **never increases `Current HP` on equip**, and clamps `Current HP` via $\text{newCurrentHp} = \max(1, \min(\text{oldCurrentHp}, \text{newMaxHp}))$ on all equipment changes (`1 HP` floor for living heroes).
    - **Permanent CON (`spendAttributePoint`):** Recalculates `Max HP` across all levels and increases `Current HP` by the exact same HP gain ($\Delta \text{HP} = L \times \Delta M_{\text{con}}$ when $\Delta M_{\text{con}} > 0$), without a full heal.
    - **Level-Up (`checkAndApplyLevelUp`):** Adds $\Delta \text{MaxHP}_{\text{level}}$ to both `Max HP` and `Current HP` without a full heal.
    - **Login / Reload Reconciliation:** Updates `max_hp = MaxHP_canonical` and clamps `current_hp = max(1, min(oldCurrentHp, MaxHP_canonical))` without ever adding `+\Delta MaxHP` on login.

### 2.4 Fix 4: Removal of All Pending `OC-1`, `OC-2`, `OC-3` Markers
- **What Was Inconsistent:**
  - Initial Phase 7A.4 files isolated `OC-1`, `OC-2`, and `OC-3` as pending owner confirmations.
- **How It Was Fixed:**
  - Removed all pending `OC-1`, `OC-2`, and `OC-3` markers across all 6 existing Phase 7A.4 documents and locked:
    - **`OC-1` = Option A** (`14` initial Ranger families; `FEY` and `AMPHIBIAN_HUMANOIDS` in Reserved/Advanced; `TERRESTRIAL_MAGICAL_BEASTS` UI label **"Other Magical Beasts"**; no extra biological sub-splits).
    - **`OC-2` = Option B** (Fighter *Second Wind*: `L1–2` unavailable, `L3–5` Tier I `1d10+L+CON`, `L6–9` Tier II `2d10+L+CON`, `L10+` Tier III `3d10+L+CON` + physical status cleanse).
    - **`OC-3` = Option A** (Ranger *Favored Enemy*: `L1–3: +2/+2/0`, `L4–7: +3/+3/0`, `L8: +4/+4/0`, `L9+: +4/+4/+2 AC`; no `19–20` Crit expansion).

### 2.5 Fix 5: Document Dates Corrected to `2026-10-22`
- **What Was Inconsistent:**
  - Initial Phase 7A.4 documents had `**Date:** 2026-04-20`.
- **How It Was Fixed:**
  - Updated all 6 existing Phase 7A.4 documents and all 3 new `PHASE-7A4-FINAL-*.md` documents to `**Date:** 2026-10-22`.

---

## 3. Codebase & SQLite Seed Verification Notes for Phase 7B Engineers

Are any inconsistencies still present between the documentation and the live repository?
- **Across Phase 7A.4 Design Documents:** **NONE (`0` contradictions).**
- **Between Historical Phase 7A.2/7A.3 Docs & Live Codebase (`src/`, `db/`):** All 7 engineering differences between older docs and the live repository have been audited and documented so Phase 7B engineers do not hit surprises:

| # | Repository Area | Live Codebase State | Phase 7B Engineering Action |
| :---: | :--- | :--- | :--- |
| **1** | `db/migrations/` | Migrations `001` through `013` already exist (`009` is `009_item_equipment_loot_system.sql`; `013` is `013_production_blaze_hardening.sql`). | Create **`db/migrations/014_phase7b_taxonomy_attributes_and_battle_experience.sql`**. |
| **2** | `characters` table & `rules.js` | `characters.attribute_points`, `characters.initial_attributes_json`, `characters.favored_enemy_family`, and `spendAttributePoint` do not yet exist in `src/` or `db/`. | Add columns in migration `014` and implement `spendAttributePoint` in [`src/domain/character/rules.js`](../../../src/domain/character/rules.js). |
| **3** | `getEffectiveStats` ([`rules.js:918–958`](../../../src/domain/character/rules.js#L918-L958)) | Currently only checks `equipment.belt` for `strength_bonus` and only recalculates `str_mod`. | Generalize across all 9 slots (`MELEE`, `RANGED`, `ARMOR`, `SHIELD`, `RING`, `CLOAK`, `NECK`, `BELT`, `FEET`) and all 6 attributes (`STR, DEX, CON, INT, WIS, CHA`). |
| **4** | `equipItem` / `unequipItem` ([`rules.js:695, 792`](../../../src/domain/character/rules.js#L695)) | Currently do not recalculate `max_hp`, clamp `current_hp`, or block equipment changes during active combat. | Add active-combat guard (`COMBAT_LOCKED_EQUIPMENT`), recalculate `newMaxHp`, and clamp `newCurrentHp = max(1, min(oldCurrentHp, newMaxHp))`. |
| **5** | `getFavoredEnemyBonuses` ([`rules.js:150–170`](../../../src/domain/character/rules.js#L150-L170)) | Currently returns `+1/+1` (`L1–3`), `+2/+2` (`L4–7`), `+3/+3` (`L8+`) and matches only `favored_enemy_type` / `favored_enemy_subtype`. | Update to `OC-3` Option A (`+2/+2/0`, `+3/+3/0`, `+4/+4/0` at L8, `+4/+4/+2 AC` at L9+) and match `favored_enemy_family` with legacy fallback. |
| **6** | `getBaseAttackBonus` ([`rules.js:84–94`](../../../src/domain/character/rules.js#L84-L94)) | `CLERIC` branch currently uses `Math.floor((lvl - 1) * 0.75) + 1`. | Update `CLERIC` branch to `Math.ceil(lvl * 3 / 4)` to match the Phase 7A.2 progression table. |
| **7** | `db/seeds/002`–`010` monster rows vs. design table IDs | In the live SQLite seeds (`002`–`010`), several monsters were inserted at different numeric IDs or names than the Phase 7A.3/7A.4 design table (e.g., `#2` is `Goblin` in `002_seed_monsters.sql`, `#11` is `Human Skeleton`, `#13` is `Human Zombie`, `#85` is `Draugr`, `#96` is `Barrow Wight`). | In migration `014`, populate `monsters.monster_family` using both **`creature_type` / `creature_subtype` / `name` rules** and explicit name/ID mappings so every seeded monster row in `db/seeds/002`–`010` is deterministically assigned to its valid 22-family `monster_family`. |

# DARKGRID — PHASE 7A.3: DESIGN & CODEBASE CONSISTENCY AUDIT

**Date:** 2026-10-22  
**Phase:** 7A.3 — Final Design Corrections, Monster Families & Battle Experience  
**Verified Against:** `action-ui-lab/docs/phase-7a2/*.md`, `src/domain/**`, `action-ui-lab/server/**`, `action-ui-lab/public/**`, and `db/**`

---

## 1. Overview of Audit Methodology

Every statement across all eight Phase 7A.2 documents was audited against:
1. The **actual production codebase and SQLite seed database** (`98` monsters, `225` tiles, `src/domain/character/rules.js`, `src/domain/combat/rules.js`, `src/domain/combat/engine.js`, `src/domain/monsters/persistence.js`).
2. The **owner's Phase 7A.3 directives** (Sections 1–9).

No contradiction was silently glossed over. Below are all **15 required audit areas**, detailing the exact discrepancy found between Phase 7A.2, the live code, and the authoritative Phase 7A.3 resolution.

---

## 2. The 15 Consistency Audit Findings & Authoritative Resolutions

### Audit 1: Ranger Favored Enemy Taxonomy & Legacy Compatibility
- **What Conflicted:**
  - **Phase 7A.2 (`PHASE-7A2-MONSTER-KNOWLEDGE.md` lines 42–67):** Proposed 7 artificial blended categories (`HUMANOID_SAVAGE_GIANTS` = *"Gnolls, Reptilians & Giants"*, `VERMIN_PLANT` = *"Arachnids, Vermin & Deadly Flora"*, `MONSTROUS_FEY_DRAGON` = *"Monstrous Humanoids, Fey & Drakes"*).
  - **Live Codebase (`src/config/index.js` lines 52–60, `src/domain/character/rules.js` line 102):** Uses raw Pathfinder `creature_type` strings (`'Animal'`, `'Magical Beast'`, `'Humanoid'`, `'Monstrous Humanoid'`, `'Vermin'`, `'Plant'`, `'Aberration'`).
- **Phase 7A.3 Authoritative Resolution:**
  - Reject all blended categories. Add a dedicated `monster_family` column to `monsters` (separate from Pathfinder `creature_type`) with 20 non-overlapping kinship families (`14` core Ranger-selectable natural families, `2` optional advanced families, `1` future Underdark family, `2` mindless non-selectable families, and `1` forbidden `UNDEAD` family).
  - Support existing Ranger saves via a non-destructive compatibility resolver in [`doesMonsterMatchFavoredEnemy`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-RANGER-FAMILIES.md#L168-L189).

### Audit 2: Character Creation Point Pool & Attribute Bounds
- **What Conflicted:**
  - **Phase 7A.2 (`PHASE-7A2-CHARACTER-CREATION.md` lines 25–72):** Replaced free point allocation with a rigid `66`-point class base plus two dropdown aptitudes (`+4` / `+2` = `72` total), forbidding manual adjustment of individual stats.
  - **Live Codebase (`src/config/index.js` lines 31–40, `src/domain/character/rules.js` lines 109–153):** Enforces a `71`-point pool (`68` base + `3` bonus) with class-specific minimums (`base - 2`, e.g., Fighter `STR >= 12`, `CON >= 12`).
- **Phase 7A.3 Authoritative Resolution:**
  - Free player allocation of **`72` total points** across `STR, DEX, CON, INT, WIS, CHA`, with universal creation minimum **`8`** and creation maximum **`18`**.
  - Validated optional class presets (`Fighter: 14/12/14/10/12/10 = 72`, `Ranger: 10/16/12/10/14/10 = 72`, `Cleric: 12/10/12/10/16/12 = 72`).

### Audit 3: Hidden Mathematics vs. Visible Attribute Allocation
- **What Conflicted:**
  - **Phase 7A.2 (`PHASE-7A2-DESIGN-PHILOSOPHY.md` line 53 & `PHASE-7A2-CHARACTER-CREATION.md` line 21):** Prohibited showing raw attribute integers (`14`, `16`) and remaining point counters even during character creation and level-up.
  - **Live Codebase (`action-ui-lab/public/js/character/character-ui.js` lines 82–120, 628–677 & `legacy-compatibility-service.js` lines 377–458):** Exposes both attribute numbers AND raw internal combat formulas (`Atk +4 • 1d8`, `+2 Attack, +3 Damage, +2 AC vs Undead`).
- **Phase 7A.3 Authoritative Resolution:**
  - **Pragmatic Split:** Raw attribute integers (`8–18+`) and remaining unspent point counts **are visible** during Character Creation and Level-Up allocation so players can make informed decisions.
  - All derived combat modifiers (`(+2)`), hit percentages, damage bonuses, AC formulas, and internal Battle Experience lookup tables remain **strictly hidden** across the entire UI, which uses descriptive attribute tiers (*Strong*, *Nimble*, *Wise*) and qualitative ability descriptions.

### Audit 4: `INT`/`WIS` Learned Bonuses (Battle Experience) vs. General `INT` XP Multiplier
- **What Conflicted:**
  - **Phase 7A.2 (`PHASE-7A2-CHARACTER-CREATION.md` line 82) & Live Codebase (`src/domain/character/rules.js` lines 155–162):** Granted a general `+10% Combat XP per +1 INT_mod` multiplier (`calculateXpWithIntelligence`) and had zero combat learning mechanics for `INT` or `WIS`.
- **Phase 7A.3 Authoritative Resolution:**
  - **Remove the general `INT` combat-XP multiplier** (`calculateXpWithIntelligence` returns flat `baseXp`).
  - Introduce **Battle Experience** (`character_monster_experience`), granting hidden `INT` learned damage (`0` to `+4`) and `WIS` learned AC (`0` to `+3`) after `1` (*Recognized*) and `3` (*Experienced*) confirmed victories against a specific `monster_id`, plus `-1 Dmg` (`INT 8–9`) / `-1 AC` (`WIS 8–9`) at `0` wins when not exempted by class specialization.

### Audit 5: Retroactive Constitution HP & Base HP Formula Discrepancy
- **What Conflicted:**
  - **Phase 7A.2 Internal Formula vs. Codebase:** `PHASE-7A2-CLASS-PROGRESSION.md` line 28 and `PHASE-7A2-CHARACTER-CREATION.md` line 134 specified `10 + 6*(L-1)` (Fighter) and `8 + 5*(L-1)` (Ranger/Cleric), whereas [`src/domain/character/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js#L62-L67) (`getHpPerLevel`) and [`legacy-compatibility-service.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/services/legacy-compatibility-service.js#L401) multiply full Lv1 Hit Die by level (`10 * L` / `8 * L`) and only apply `1 * conMod` on level-up ([`rules.js` line 229](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js#L229)) instead of recalculating retroactively when `CON` increases!
  - Furthermore, [`auth-character-controller.js` line 222](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/controllers/auth-character-controller.js#L222) (`spendCharacterAttributePoint`) adds `+1` to `constitution` without updating `max_hp` or `current_hp` at all!
- **Phase 7A.3 Authoritative Resolution:**
  - Enforce the canonical formula $\text{MaxHP}(L, M_{\text{con}}) = \max(L, H_1 + (L-1)H_{\text{lvl}} + B_{\text{class}}(L) + L \times M_{\text{con}})$ across both character creation, level-up, and attribute spending (`spendCharacterAttributePoint`).
  - Whenever `CON` modifier changes by $\Delta M_{\text{con}}$, adjust `max_hp` by $L \times \Delta M_{\text{con}}$ and `current_hp` by the exact same delta (clamped to `[1, newMaxHp]`, **never** granting a free full heal).

### Audit 6: Fighter Second Wind Lethal Rescue
- **What Conflicted:**
  - **Phase 7A.2 (`PHASE-7A2-CLASS-PROGRESSION.md` lines 39, 64):** Triggered *Second Wind* only when `0 < hp <= 30% Max HP`, failing to rescue a Fighter if a high-damage blow (`Ogre`, `Minotaur`, `Troll` Rend) dropped HP from `>30%` straight to `<= 0`.
  - **Live Codebase (`src/domain/combat/engine.js`):** *Second Wind* is mentioned only as a static string in `legacy-compatibility-service.js` (`line 402`) and is not implemented in `src/domain/combat/engine.js` at all.
- **Phase 7A.3 Authoritative Resolution:**
  - Implement server-authoritative *Second Wind* in `src/domain/combat/engine.js` with both **Critical-HP Recovery** (`0 < hp <= floor(0.30 * maxHp)`) and **Lethal Rescue** (`hp <= 0` clamped to `1 HP + healRoll` once per combat when `!secondWindUsed`), following the 10-step trigger order in [`PHASE-7A3-SECOND-WIND.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-SECOND-WIND.md).

### Audit 7: Ranger Opening Shot Kill Resolution Bug
- **What Conflicted:**
  - **Phase 7A.2 (`PHASE-7A2-CLASS-IDENTITIES.md` line 80 & `PHASE-7A2-PHASE7B-ROADMAP.md` line 23):** Falsely claimed that lethal *Opening Shot* was *"already wired in `src/domain/combat/engine.js`"*.
  - **Live Codebase (`src/domain/combat/engine.js` line 238):** Actually executes:
    ```js
    currentMonsterHp = Math.max(1, currentMonsterHp - openingDamage);
    ```
    This hard-clamps the monster to `1 HP`, making it **impossible** for Ranger *Opening Shot* to ever kill a monster before Round 1!
- **Phase 7A.3 Authoritative Resolution:**
  - Explicitly schedule the fix for `src/domain/combat/engine.js:238` in Phase 7B Stage 3: remove `Math.max(1, ...)`, allow `currentMonsterHp` to reach `0`, and when `currentMonsterHp <= 0`, immediately invoke `handleMonsterDefeat` inside `initiateCombat` (awarding full XP, loot, bounty credit, and `+1` Battle Experience victory).

### Audit 8: Cleric Out-of-Combat Healing Implementation & UI Leak
- **What Conflicted:**
  - **Live Codebase (`src/domain/character/rules.js` lines 168–202):** `performClericSelfHeal` is already restricted to out-of-combat (`2/3/4` max charges, scaling `1d6` to `5d6 + WIS_mod`), but [`legacy-compatibility-service.js` line 439](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/services/legacy-compatibility-service.js#L439) leaks the raw formula string `(${prayerState.diceCount}d6 + WIS mod, ${prayerState.remaining}/${prayerState.maxCharges} charges)`.
- **Phase 7A.3 Authoritative Resolution:**
  - Preserve `performClericSelfHeal` out-of-combat mechanics (`2/3/4` charges recharged in city sanctuaries), keep the `X / Y` remaining charge counter visible, and remove the raw `Xd6 + WIS mod` formula string from `legacy-compatibility-service.js`.

### Audit 9: Critical-Hit Rules (`19–20` Threat Range)
- **What Conflicted:**
  - **Phase 7A.2 (`PHASE-7A2-CLASS-PROGRESSION.md` lines 43, 86, 88):** Grants `19–20` critical threat range at Fighter Level 7 (*Weapon Mastery*), Ranger Level 7 (*Opening Shot*), and Ranger Level 9 (*Favored Enemy*).
  - **Live Codebase (`src/domain/combat/rules.js` lines 295–327):** `resolveAttackRoll(attackBonus, targetAC, rng)` hardcodes `if (roll === 20)` (`line 317`) and has no `critMinRoll` parameter.
- **Phase 7A.3 Authoritative Resolution:**
  - Extend `resolveAttackRoll(attackBonus, targetAC, rng, critMinRoll = 20)` in Phase 7B Stage 2:
    - Natural `20` is always an automatic hit and critical threat.
    - Natural `19` (when `critMinRoll <= 19`) is a critical threat **if and only if** `19 + attackBonus >= targetAC`, then rolls standard confirmation against `targetAC` for `2x` damage.

### Audit 10: Class Progression Levels 1–10 (Code vs. Specification)
- **What Conflicted:**
  - **Live Codebase (`src/domain/combat/rules.js` lines 78–178):** Currently implements only L5/L9 Fighter *Weapon Training* (`+1/+2`), L3/L7 Fighter *Armor Training* (`+1 AC` in Heavy), L1/L5/L9 Ranger *Favored Enemy* (`+2/+3/+4`), and L1/L6/L10 Cleric *Holy Radiance* (`+2/+3/+4`). It does **not** yet implement Fighter *Battle-Hardened*, Fighter *Know Your Enemy*, Fighter *Second Wind*, Ranger *Natural Knowledge*, Ranger *Evasive Retreat* scaling, or Cleric *Turn Undead* round-1 automatic disruption.
- **Phase 7A.3 Authoritative Resolution:**
  - Consolidate the complete Level 1–10 progression table into Phase 7B Stage 2 & Stage 3 (`src/domain/character/rules.js` and `src/domain/combat/rules.js`), ensuring every level 1–10 milestone is wired into server-side combat resolution.

### Audit 11: Ranger Natural Knowledge Monster Counts
- **What Conflicted:**
  - **Phase 7A.2 (`PHASE-7A2-EXECUTIVE-SUMMARY.md` line 25 & `PHASE-7A2-MONSTER-KNOWLEDGE.md` line 212):** Claimed Ranger *Natural Knowledge* (`Animal + Magical Beast + Vermin + Plant + Fey + Dragon`) covered **`61 / 98` monsters (`56 / 86` surface)**.
  - **Actual SQLite Database Count:** `12 (Animal) + 22 (Magical Beast) + 7 (Vermin) + 6 (Plant) + 2 (Fey) + 2 (Dragon)` = **`51 / 98` monsters** (`48 / 86` surface-active), or **`52 / 98` monsters** (`49 / 86` surface-active) when including `#26 Ettercap` via the `ARACHNIDS` family!
- **Phase 7A.3 Authoritative Resolution:**
  - Correct all documentation counts to **`51 / 98`** (by Pathfinder `creature_type`) / **`52 / 98`** (when including `#26 Ettercap` via the `ARACHNIDS` `monster_family`).

### Audit 12: Fighter, Ranger & Cleric Base Attack Progression Formula Discrepancy
- **What Conflicted:**
  - **Phase 7A.2 (`PHASE-7A2-CLASS-PROGRESSION.md` line 29):**
    - Listed Fighter/Ranger BAB as `+1` at L1 → `+10` at L10 (`level`), whereas [`src/domain/character/rules.js` line 80](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js#L76-L81) returns `lvl - 1` (`+0` at L1 → `+9` at L10).
    - Wrote the Cleric BAB formula as `floor(level * 3 / 4) + 1` right next to the explicit array `(+1 at L1, +2 at L2, +3 at L3–4, +4 at L5, +5 at L6, +6 at L7–8, +7 at L9, +8 at L10)`. At `L4`, `floor(4 * 3 / 4) + 1 = 4`, which contradicted its own `+3 at L3–4` text! Meanwhile, `src/domain/character/rules.js:78` uses `Math.floor(lvl * 0.75)` (`0, 1, 2, 3, 3, 4, 5, 6, 6, 7`).
- **Phase 7A.3 Authoritative Resolution:**
  - Standardize `getLevelAttackBonus(level, characterClass)` in Phase 7B to match the explicit Level 1–10 arrays without formula/table drift:
    - **Fighter & Ranger (`Full Martial Progression`):** `BAB = level` (`+1, +2, +3, +4, +5, +6, +7, +8, +9, +10` across L1–L10).
    - **Cleric (`Three-Quarter Progression`):** `BAB = Math.floor((level - 1) * 3 / 4) + 1` (`+1, +1, +2, +3, +4, +4, +5, +6, +7, +7`) **or** `Math.ceil(level * 3 / 4)` (`+1, +2, +3, +3, +4, +5, +6, +6, +7, +8` — matching the exact array in `PHASE-7A2-CLASS-PROGRESSION.md` line 29!). Using `Math.ceil(level * 3 / 4)` reproduces `+1, +2, +3, +3, +4, +5, +6, +6, +7, +8` with 100% mathematical precision.

### Audit 13: Monster Spawn Habitats & Future World Biomes
- **What Conflicted:**
  - **Phase 7A.2 (`PHASE-7A2-MONSTER-KNOWLEDGE.md` lines 76–174):** Listed wrong habitat codes for 10 monsters (`#6 Choker`, `#24 Death Dog`, `#27 Cockatrice`, `#28 Ankheg`, `#40 Dire Rat`, `#53 Giant Scorpion`, `#58 Peryton`, `#69 Mite`, `#70 Bog Strider`, `#92 Otyugh`) and wrongly classified `#51 Doppelganger` (`T, U`) as `Surface Active` even though `CITY` (`T`) is `is_safe = 1`.
- **Phase 7A.3 Authoritative Resolution:**
  - Corrected all 98 monster habitat strings in [`PHASE-7A3-RANGER-FAMILIES.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-RANGER-FAMILIES.md) and [`PHASE-7A3-WORLD-HABITATS.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-WORLD-HABITATS.md) to match SQLite `monsters.habitat` and `monster_terrains` (`86` surface-active, `12` non-surface). Removed the requirement that all 98 monsters spawn on the surface map.

### Audit 14: Permadeath & Character-Specific Persistence
- **What Conflicted:**
  - Phase 7A.2 did not define how per-species **Battle Experience** (`character_monster_experience`), unspent `attribute_points`, or in-combat `secondWindUsed` interact with permadeath and logout/login.
- **Phase 7A.3 Authoritative Resolution:**
  - `character_monster_experience` uses `FOREIGN KEY (character_id) REFERENCES characters(id)` and is queried strictly by the active living `character.id`. When a hero dies (`is_alive = 0`), their historical record remains tied to that fallen `character_id`, and any newly forged hero gets a new `character_id` with `0` victories across all species.

### Audit 15: Simulation Criteria & Retirement of Equal-Win-Rate Gates
- **What Conflicted:**
  - Phase 7A.2's simulation revision (`PHASE-7A2-SIMULATION-REVISION.md`) did not include test matrices for **Battle Experience** (`0 / 1 / 3` wins across low/average/high `INT` & `WIS`), **Second Wind Lethal Rescue**, `INT 8 / WIS 8` Level 1 beginner penalties, or `STR/DEX/CON` vs. `INT/WIS` investment trade-offs.
- **Phase 7A.3 Authoritative Resolution:**
  - Replaced with the comprehensive Phase 7A.3 simulation specification in [`PHASE-7A3-SIMULATION-PLAN.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-SIMULATION-PLAN.md).

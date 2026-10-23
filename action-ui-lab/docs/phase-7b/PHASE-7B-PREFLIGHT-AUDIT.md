# DARKGRID — PHASE 7B: PREFLIGHT REPOSITORY AUDIT

**Date:** 2026-10-22  
**Scope:** Phase 7B Pre-Implementation Audit of Repository State, Migrations, Seeds, Domain Modules, Routes, and `action-ui-lab` Primary Playable Client  
**Status:** **COMPLETE**

---

## 1. Executive Summary

Prior to implementing Phase 7B, a full repository audit was performed against the authoritative Phase 7A.2, 7A.3, and 7A.4 design specifications (`action-ui-lab/docs/phase-7a4/PHASE-7A4-FINAL-OWNER-DECISIONS.md` and companion documents).

Key preflight findings:
1. **Migration Sequence Verified (`001`–`013`):**
   - Existing SQLite migrations in `db/migrations/` ran sequentially from `001_initial_schema.sql` through `013_production_blaze_hardening.sql`.
   - `014_phase7b_taxonomy_attributes_and_battle_experience.sql` was confirmed available and safe to use as the canonical Phase 7B migration.
2. **Monster Seed Sequence Verified (`001`–`010`, `98` Monsters Total):**
   - Existing seeds in `db/seeds/` ran from `001_seed_world.sql` through `010_seed_night_work_loot_and_30_monsters.sql`, yielding **98 monsters** in the `monsters` table.
   - Numeric IDs in SQLite differed from design table row numbers for several monsters due to incremental seed ordering across `001`–`010`. Therefore, monster family classification and `#36 Mummy` verification had to be implemented by deterministic identity (`LOWER(name)`, `creature_type`, `creature_subtype`), never by blind numeric ID assumptions.
   - **Monster `#36 Mummy` Identity & Stats Verified:** Located in `006_seed_cr3_to_cr6_monsters.sql` with `base_hp = 45`, `armor_class = 20`, `attack_bonus = 14`, `damage_dice = '1d8+10'`, `challenge_rating = 5`, `solo_level = 5`. Preserved 100% untouched.
3. **Surface vs. Passable Map Reachability Verified:**
   - Design taxonomy geographic surface count (including `RIVER`): **88** monsters (`10` dungeon/subterranean-only excluded).
   - SQLite `monster_terrains` surface-tagged count (including `RIVER`): **92** monsters (`6` `DUNGEON`-only monsters).
   - Passable map surface count on `001_seed_world.sql` (where `RIVER` tiles have `is_passable = 0`): **86** monsters (`6` `RIVER`-only monsters unreachable until bridge/ferry tiles are added).
4. **Undead Count Discrepancy Documented & Handled:**
   - The Phase 7A.4 taxonomy document lists **11** Undead in its narrative summary, whereas the actual 98-monster SQLite seed set contains **12** Undead (`Skeleton`, `Zombie`, `Ghoul`, `Shadow`, `Ghast`, `Wight`, `Mummy`, `Wraith`, `Spectre`, `Vampire Spawn`, `Mohrg`, `Devourer` — with `Mohrg` seeded as `Undead`). All 12 are deterministically classified into `UNDEAD`, and the taxonomy audit reports both `designTaxonomyUndeadCount = 11` and `undeadCountInDb = 12`.

---

## 2. Pre-Implementation Gap Analysis by Subsystem

| Subsystem | Pre-Phase 7B State | Phase 7B Requirement | Implementation Target |
|---|---|---|---|
| **Character Creation Point-Buy** | 71-point total with class-specific stat minimums | **72-point** free allocation (`8–18` per attribute at L1, class presets as defaults, no artificial post-L1 18 cap) | [`src/config/index.js`](../../../src/config/index.js), [`src/domain/character/rules.js`](../../../src/domain/character/rules.js) |
| **Milestone Attribute Growth** | No milestone point column or spend endpoint | `+1` permanent attribute point at **Levels 2, 4, 6, 8, 10** (`attribute_points` column, atomic spend endpoint) | [`src/domain/character/rules.js`](../../../src/domain/character/rules.js), [`src/routes/character.js`](../../../src/routes/character.js), [`action-ui-lab/server/controllers/auth-character-controller.js`](../../server/controllers/auth-character-controller.js) |
| **Open-Ended Level Scaling** | Several helpers assumed L1–L10 | No maximum character level; all formulas accept `level > 10` while keeping `FAST_XP_TABLE` L1–10 as current configured thresholds | [`src/domain/character/rules.js`](../../../src/domain/character/rules.js), [`src/domain/combat/rules.js`](../../../src/domain/combat/rules.js) |
| **Constitution & HP Rules (A/B/C/D)** | Basic Max HP calculation; `BELT` CON not separated from permanent CON | Closed-form `calculateCanonicalMaxHp`; Rule A (Equipment CON never heals, unequip clamps to `max(1, min(old, newMax))`); Rule B (Permanent CON adds `hpDelta`); Rule C (Level-up adds `levelHpDelta`); Rule D (Login reconciliation never heals) | [`src/domain/character/rules.js`](../../../src/domain/character/rules.js) |
| **Fighter Second Wind** | Not implemented | **Option B**: Automatic once/combat at `<= 25%` Max HP (including `0 HP` lethal rescue & DoT rescue; `1d10`/`2d10`/`3d10 + L + CON_mod`; L10+ cleanses `BLEED > POISON`; does not rescue `CALCIFY`) | [`src/domain/combat/abilities.js`](../../../src/domain/combat/abilities.js), [`src/domain/combat/engine.js`](../../../src/domain/combat/engine.js) |
| **Ranger Favored Enemy** | Broad `creature_type` / `subtype` | **22-family taxonomy** (`14` selectable at creation, `TERRESTRIAL_MAGICAL_BEASTS` -> *"Other Magical Beasts"*, `5` reserved, `2` non-selectable, `1` forbidden `UNDEAD`); **Option A** bonuses (`+2/+2`, `+3/+3`, `+4/+4`, `+4/+4/+2 AC`) | [`src/domain/monsters/taxonomy.js`](../../../src/domain/monsters/taxonomy.js), [`src/domain/character/rules.js`](../../../src/domain/character/rules.js) |
| **Cleric BAB & Turn Undead** | Non-standard Cleric BAB table | Standardized `Math.ceil(level * 3 / 4)` BAB; Sacred Knowledge (`+2/+3/+2` -> `+3/+4/+3` -> `+4/+5/+4`); automatic Turn Undead disruption | [`src/domain/character/rules.js`](../../../src/domain/character/rules.js), [`src/domain/combat/knowledge.js`](../../../src/domain/combat/knowledge.js), [`src/domain/combat/abilities.js`](../../../src/domain/combat/abilities.js) |
| **Monster Knowledge & INT/WIS Battle Experience** | Flat INT XP bonus (`+2%` per INT above 10); no per-species knowledge table | Flat XP disabled (INT governs learned damage); `character_monster_knowledge` table tracking `encounters` (Stage 2 only) and `victories` (`0` Unfamiliar, `1–2` Recognized, `3+` Experienced) with class-familiarity beginner protection | [`src/domain/combat/knowledge.js`](../../../src/domain/combat/knowledge.js), [`src/domain/combat/engine.js`](../../../src/domain/combat/engine.js), [`src/domain/monsters/persistence.js`](../../../src/domain/monsters/persistence.js) |

---

## 3. Production & Account Safety Verification

- Zero Firebase deployments executed.
- Zero production databases modified.
- Zero player accounts reset; all schema additions in Migration `014` use backward-compatible defaults and non-destructive backfills.

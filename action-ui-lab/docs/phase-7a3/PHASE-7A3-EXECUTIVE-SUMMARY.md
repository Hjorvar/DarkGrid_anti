# DARKGRID — PHASE 7A.3: EXECUTIVE SUMMARY

**Date:** 2026-10-22  
**Phase:** 7A.3 — Final Design Corrections, Monster Families & Battle Experience (Design & Documentation Only)  
**Verified Codebase Baseline:** `main` commit `042d122` / branch `c33855d`  
**Status:** Authoritative Specification for Phase 7B (Supersedes Phase 7A.2 where updated)  
**Deliverables Directory:** [`action-ui-lab/docs/phase-7a3/`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/)

---

## 1. Executive Summary

Phase 7A.3 is the authoritative design specification for Phase 7B. It conducts a line-by-line audit of all eight Phase 7A.2 documents in [`action-ui-lab/docs/phase-7a2/`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/) against the live SQLite database (`98` seeded monsters, `225` map tiles) and production domain logic (`src/domain/`, `action-ui-lab/server/`), aligning every rule with the owner's final design decisions.

### Core Design Pillars Fixed in Phase 7A.3

1. **Asymmetric Class Identity ("Different, Not Equal"):**
   - **Fighter — *The Survivor*:** Strongest general combatant across all monster categories; proficient with all weapons, armor, and shields; high HP and AC; *Know Your Enemy* expertise against martial and humanoid foes; **Second Wind with Lethal Rescue** once per combat.
   - **Ranger — *The Hunter*:** Best at spotting enemies first (`DISCOVERED`) and avoiding ambushes; lethal **Opening Shot** when initiating combat with a readied ranged weapon; selects **ONE natural Favored Enemy family** (`monster_family`); **Natural Knowledge** across `51` wilderness creatures (`47` surface-active); superior retreat via **Evasive Retreat**.
   - **Cleric — *The Undead Hunter*:** Intentionally weaker in general mundane combat; overwhelming specialist against all `12` **Undead** monsters via *Undead Knowledge*, *Sacred Strike*, *Turn Undead*, and *Holy Protection*; **Divine Self-Healing** strictly outside combat (`2/3/4` prayer charges restored in city sanctuaries).
   - **No Numerical Win-Rate Parity:** Phase 7A.1's `Gate G2` ($\le 8\%$ inter-class win-rate spread) remains permanently retired.

2. **Ranger Natural Favored Enemy Families (`monster_family`):**
   - Rejects Phase 7A.2's 7 artificial blended buckets (such as `"Gnolls, Reptilians & Giants"` and `"Arachnids, Vermin & Deadly Flora"`).
   - Introduces a stable `monster_family` column on `monsters`, distinct from Pathfinder `creature_type`, classifying all `98` monsters into **20 non-overlapping biological/kinship families** (`14` primary Ranger-selectable natural families, `3` advanced/subterranean families, `2` mindless non-selectable families, and `1` strictly forbidden `UNDEAD` family).
   - Preserves backward compatibility for legacy Ranger save records (`Humanoid`, `Animal`, `Undead`, etc.) without data loss.

3. **World Habitats & Future Expansion:**
   - Prohibits modifying natural monster habitats just to force all `98` monsters onto the current surface map.
   - Verifies that **`86` of `98` monsters** spawn naturally on the `5` unsafe passable wilderness terrains of `001_seed_world.sql` (`FOREST`, `SWAMP`, `PLAINS`, `JUNGLE`, `HILLS`), **`10` underground/ruin monsters** spawn in the Adventure Lab's `UNDERGROUND_RUINS` tile `(9,7)`, and **`2` coastal/aquatic monsters** (`#25 Giant Crab`, `#68 Sahuagin`) await future coastal/river/aquatic map expansions.

4. **Free Attribute Allocation (72 Points, 8–18 Bounds, Visible Allocation Numbers):**
   - Replaces Phase 7A.2's restricted 2-dropdown aptitude concept and Phase 6's `71`-point class-locked bounds with **free player allocation of `72` total points** across `STR, DEX, CON, INT, WIS, CHA`, with universal creation minimum **`8`** and maximum **`18`**.
   - Validates the three optional class presets (`Fighter: 14/12/14/10/12/10 = 72`, `Ranger: 10/16/12/10/14/10 = 72`, `Cleric: 12/10/12/10/16/12 = 72`).
   - Grants **`+1` attribute point at Levels `2, 4, 6, 8, 10`** (player-chosen, bankable, allowed to exceed `18` up to natural `23` / equipped `25`, with retroactive `CON` Max HP and Current HP adjustment and no free full heal).
   - **Pragmatic Hidden Mathematics:** Attribute integers (`8–18+`) and unspent point counters **are visible** during Character Creation and Level-Up allocation; derived combat modifiers, hit chances, damage bonuses, AC formulas, and internal lookup tables remain strictly hidden.

5. **New System — Battle Experience (Learned Enemy Knowledge):**
   - Replaces the retired general `INT` combat-XP multiplier (`calculateXpWithIntelligence`) with a per-hero, per-monster-species (`monster_id`) combat learning system triggered only by **confirmed victories**.
   - **Milestones:** `1` victory = **Recognized**; `3` victories = **Experienced** (hard cap; no endless farming).
   - **Hidden Bonuses:** `INT` grants learned damage (`0` to `+4`); `WIS` grants learned AC (`0` to `+3`). Low `INT 8–9` (`-1 Damage`) and `WIS 8–9` (`-1 AC`) apply against un-defeated species (`0` wins) unless exempted by matching class specialization, and vanish permanently after the first victory.

6. **Fighter — Second Wind Lethal Rescue:**
   - Elevates *Second Wind* into a server-authoritative emergency survival mechanic that triggers once per combat either at critical HP (`0 < hp <= floor(0.30 * maxHp)`) **or** as a **Lethal Rescue** when a standard damage blow would reduce the Fighter to `<= 0 HP` while `secondWindUsed === false`.
   - Defines an exact 10-step resolution order covering critical hits, DR, multi-attack Rend (`Troll`, `Girallon`), elemental/acid riders (`Ankheg`, `Barrow Wight`), breath weapons (`Winter Wolf`, `Forest Drake`), DoT ticks, and non-HP instant-death effects (`Cockatrice`/`Basilisk` calcification).

---

## 2. Complete Index of Phase 7A.3 Deliverables

| # | Document | Scope |
|---:|---|---|
| 1 | [`PHASE-7A3-EXECUTIVE-SUMMARY.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-EXECUTIVE-SUMMARY.md) | High-level summary, architecture readiness, and index of Phase 7A.3 specifications. |
| 2 | [`PHASE-7A3-DESIGN-DECISIONS.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-DESIGN-DECISIONS.md) | Separation of owner-approved locked rules vs. tuning proposals requiring owner sign-off. |
| 3 | [`PHASE-7A3-RANGER-FAMILIES.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-RANGER-FAMILIES.md) | Natural `monster_family` taxonomy, full 98-monster table, future monster rules, and legacy save compatibility. |
| 4 | [`PHASE-7A3-ATTRIBUTES.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-ATTRIBUTES.md) | Free 72-point allocation (`8–18`), class presets, Level `2/4/6/8/10` progression, post-18 rules, and retroactive `CON`. |
| 5 | [`PHASE-7A3-BATTLE-EXPERIENCE.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-BATTLE-EXPERIENCE.md) | `INT` damage & `WIS` AC learned bonuses, victory tracking rules, low-stat penalties, SQLite schema, and stacking analysis. |
| 6 | [`PHASE-7A3-SECOND-WIND.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-SECOND-WIND.md) | Server-authoritative Lethal Rescue specification, 10-step trigger order, edge cases, and permadeath handoff. |
| 7 | [`PHASE-7A3-WORLD-HABITATS.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-WORLD-HABITATS.md) | Audit of `86` surface vs. `12` non-surface monsters, preservation of natural habitats, and future biome roadmap. |
| 8 | [`PHASE-7A3-CONSISTENCY-AUDIT.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-CONSISTENCY-AUDIT.md) | Detailed audit of all 15 consistency areas comparing Phase 7A.2 docs, live codebase, and Phase 7A.3 fixes. |
| 9 | [`PHASE-7A3-SIMULATION-PLAN.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-SIMULATION-PLAN.md) | Phase 7B simulation matrix, preliminary Monte Carlo verification data (`2,000` runs/cell), and acceptance gates. |
| 10 | [`PHASE-7A3-PHASE7B-ROADMAP.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-PHASE7B-ROADMAP.md) | Staged Phase 7B implementation plan, migration guardrails, and automated test suite requirements. |

---

## 3. Architecture & Implementation Readiness Summary

- **Battle Experience Compatibility:** Fits cleanly into [`src/domain/combat/engine.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js) and [`src/domain/monsters/persistence.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/monsters/persistence.js) via a single `character_monster_experience (character_id, monster_id, victories, first_victory_at, last_victory_at)` table updated transactionally inside `handleMonsterDefeat`.
- **Second Wind Lethal Rescue Feasibility:** Directly implementable inside the round resolution loop of [`src/domain/combat/engine.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js) (`lines 364–565`) before `resolvePermadeath` is called, tracked via a boolean `secondWindUsed` flag on the server combat session.
- **Zero Code/DB Mutations in Phase 7A.3:** All `src/`, `db/`, and `action-ui-lab/` runtime files remain untouched until the owner reviews and approves Phase 7A.3 for Phase 7B execution.

---

**Project Status:** **READY FOR OWNER REVIEW**

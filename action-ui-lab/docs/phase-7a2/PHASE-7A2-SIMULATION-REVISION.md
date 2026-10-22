# DARKGRID — PHASE 7A.2: REVISED SIMULATION PHILOSOPHY & ACCEPTANCE CRITERIA

**Date:** 2026-10-22  
**Phase:** 7A.2 — Class Identity & Thematic Progression (Design & Documentation Only)  
**Baseline Verified Against:** `main` commit `042d122`  
**Supersedes:** `PHASE-7A-SIMULATION-PLAN.md` Gate G2 & `PHASE-7A1-SIMULATION-CALIBRATION.md` Equal-Spread Targets

---

## 1. Why the Phase 7A.1 Simulation Philosophy Is Revised

In Phase 7A and Phase 7A.1, the Monte Carlo simulation suite enforced **Gate G2 (`Inter-Class Win-Rate Spread <= 8.0 percentage points`)** across Fighter, Ranger, and Cleric at every level.

That gate forced distorted design compromises:
- It penalized the **Cleric** for having lower general weapon damage against ordinary monsters, prompting Phase 7A.1 to propose turning the Cleric into a mid-combat self-healing tank.
- It penalized the **Ranger** for having a specialized **Favored Enemy** instead of broad, flat combat bonuses across the entire monster roster.
- It treated asymmetric class strengths as "balance defects" rather than the core appeal of a single-player dark-fantasy RPG.

### The Phase 7A.2 Simulation Principle
> **Simulations exist to detect broken mechanics, accidental stat regressions, ecological dead zones, and unavoidable early permadeath—NEVER to flatten Fighter, Ranger, and Cleric into numerical equality.**

**Gate G2 (`<= 8.0 pp` inter-class win-rate spread) is permanently REMOVED.**

---

## 2. Separation of Hard Invariants vs. Calibration Hypotheses

Phase 7A.2 divides verification into two distinct categories:

1. **Category A — Hard Safety & Mechanical Invariants (Must Pass 100%):**
   Deterministic and statistical rules protecting player fairness, permadeath integrity, progression monotonicity, and state machine correctness.
2. **Category B — Thematic Asymmetry & Playability Hypotheses (Calibration Targets):**
   Directional and range-based simulation checks confirming that each class excels in its intended domain and remains playable from Levels 1 to 10. Quantitative figures in Category B are treated as **initial calibration hypotheses**, not rigid homogenization quotas.

---

## 3. The 10 Phase 7A.2 Verification Criteria

Below is the complete mapping of the 10 mandatory requirements from Section 8 of the Phase 7A.2 specification:

### Criterion 1: No Unavoidable or Unfair Early Permadeath
- **Type:** **Hard Safety Invariant (`S1`)**
- **What We Verify:**
  - At **Level 1**, no standard Biome Tier 1 monster (`Wolf`, `Goblin`, `Kobold`, `Dire Rat`, `Human Skeleton`, `Human Zombie`, `Stirge`, `Mite`, `Vegepygmy`) can one-shot a full-HP Level 1 hero of any class (`Fighter`, `Ranger`, `Cleric`) on Round 1, even on a critical hit or ambush (`0.0%` Round 1 unavoidable instant death from full HP).
  - If a Level 1–2 player encounters a higher-tier threat, the player always has at least one actionable survival decision (`FLEE` before engagement when `DISCOVERED`, or `POTION` / `FLEE` after surviving Round 1).

### Criterion 2: Every Class Remains Playable from Levels 1–10
- **Type:** **Calibration Hypothesis (`H1`)**
- **What We Verify:**
  - Across simulated 5-encounter expeditions at Levels 1, 3, 5, 7, and 10 (using class-appropriate gear and tactical doctrine—Fighter using armor/Second Wind, Ranger using ranged initiation/Evasive Retreat, Cleric using between-battle *Divine Self-Healing*):
  - All three classes can reliably earn XP, complete bounties, and progress from Level 1 to Level 10 without hitting an unplayable mathematical wall against standard same-level world encounters.
  - *Calibration Hypothesis:* Against general non-boss encounters of equal level (`solo_level == hero.level`), Fighter wins comfortably (`~75%–88%`), prepared Ranger wins reliably (`~65%–82%`), and Cleric wins single fights at a lower raw margin (`~55%–72%`) or chooses to disengage from bad matchups while sustaining multi-fight expeditions via between-fight healing.

### Criterion 3: Fighter Has High General Combat Reliability
- **Type:** **Thematic Asymmetry Verification (`H2`)**
- **What We Verify:**
  - Across the full 98-monster roster (unfiltered by creature type), **Fighter** achieves the highest average direct-combat win rate and lowest HP volatility in toe-to-toe combat (`ENGAGE` without pre-combat ranged kiting or between-fight spell charges).
  - Against **Martial / Humanoid / Giant** enemies (`25` monsters in `FIGHTER_MARTIAL_EXPERTISE`), *Know Your Enemy* provides a measurable increase in Fighter win rate and remaining HP compared to non-martial monsters of identical CR, while Fighter remains strong (`> 70%` expected win rate vs equal-level foes) outside its specialization.

### Criterion 4: Ranger Is Significantly More Dangerous Against Its Favored Enemy
- **Type:** **Thematic Asymmetry Verification (`H3`)**
- **What We Verify:**
  - For each of the 7 curated **Favored Enemy** specializations, a Ranger fighting a monster belonging to their chosen Favored Enemy achieves a **substantially higher win rate, faster time-to-kill (fewer rounds), and lower HP loss** than the same Ranger fighting an equal-CR monster outside their Favored Enemy category.
  - *Calibration Hypothesis:* The Ranger's win-rate and damage-per-round advantage against their chosen Favored Enemy increases noticeably at the Level 1, 3, 5, 7, 9, and 10 milestones (e.g., `+12 to +25 percentage points` higher win rate or `25%–45%` faster kill speed against equal/higher-level Favored Enemies by mid-to-late levels).

### Criterion 5: Cleric Is Significantly More Effective Against Undead Than Against Ordinary Opponents
- **Type:** **Thematic Asymmetry Verification (`H4`)**
- **What We Verify:**
  - Against ordinary living monsters (`Animal`, `Magical Beast`, `Humanoid`, `Aberration`), the Cleric has a lower direct-combat win rate and slower kill speed than the Fighter (confirming intentional general combat weakness).
  - Against the **12 Undead monsters** (`Ghoul`, `Human Skeleton`, `Human Zombie`, `Plague Zombie`, `Skeletal Champion`, `Ghast`, `Shadow`, `Wight`, `Draugr`, `Mummy`, `Wraith`, `Barrow Wight`), the Cleric's *Sacred Strike*, *Turn Undead*, and *Holy Protection* make the Cleric **significantly more effective than against ordinary opponents of the same CR**, and give the Cleric the highest survival rate of any class against hazardous Undead (`Shadow`, `Wight`, `Mummy`, `Wraith`).

### Criterion 6: Cleric Out-of-Combat Healing Provides Meaningful Expedition Endurance
- **Type:** **Thematic Asymmetry Verification (`H5`)**
- **What We Verify:**
  - In sequential multi-encounter expedition simulations (`3` to `5` consecutive encounters between city rests, without consuming gold-purchased potions):
  - Expending **Divine Self-Healing** charges (`2` at L1–4, `3` at L5–8, `4` at L9–10) between fights allows the Cleric to enter subsequent encounters at high or full HP (`>= 85% Max HP` entering fights 2 and 3) and complete significantly more encounters per city trip than a Cleric without healing—while strictly running out of charges on over-extended trips so town rest remains essential.

### Criterion 7: Ranger Scouting and Opening Shot Matter
- **Type:** **Thematic Asymmetry Verification (`H6`)**
- **What We Verify:**
  - **Scouting (*Wilderness Instinct*):** Simulated encounter generation confirms that the Ranger achieves a significantly higher `DISCOVERED` rate and lower `SURPRISED` (ambush) rate than Fighter or Cleric across all wilderness biomes.
  - **Opening Shot:** Comparing a Ranger initiating from `DISCOVERED` with a prepared bow against a Ranger caught `SURPRISED` (or initiating with a melee weapon) demonstrates a major tactical gap:
    - Against Level 1–3 skirmishers (`Goblin`, `Kobold`, `Wolf`, `Stirge`, `Blood Hawk`), **Opening Shot** can score a **lethal one-shot kill before Round 1 begins**, taking `0` damage.
    - When `SURPRISED` (ambushed), the Ranger loses Opening Shot and suffers high attrition, validating the *"powerful when prepared, vulnerable when surprised"* identity.

### Criterion 8: Monster Encounters and Class Specialization Remain Ecologically Coherent
- **Type:** **Hard Ecological Invariant (`S2`)**
- **What We Verify:**
  - Every biome on the passable world map spawns an ecologically coherent mix of monsters matching its terrain code (`F, H, P, S, J, T`, plus Under-Delve/Ruins).
  - Every one of the 7 Ranger **Favored Enemy** choices, the Fighter's **Martial/Humanoid/Giant** domain, and the Cleric's **Undead** domain have active, reachable encounter populations across the progression curve.

### Criterion 9: Character Progression Never Creates Accidental Stat Regressions
- **Type:** **Hard Mathematical Invariant (`S3`)**
- **What We Verify:**
  - Automated property tests across Levels `1 → 10` for all 3 classes and all descriptive attribute growth paths verify monotonic non-decreasing progression:
    - $\text{MaxHP}(L+1) > \text{MaxHP}(L)$
    - $\text{BaseAttack}(L+1) \ge \text{BaseAttack}(L)$
    - $\text{ClassSpecialtyBonus}(L+1) \ge \text{ClassSpecialtyBonus}(L)$
  - Whenever `CON` modifier increases by `+1` at Level $L$, `Max HP` increases by $+L$ (retroactively) in addition to the new level's base HP gain, and `Current HP` increases by the exact same delta without full-healing prior damage.

### Criterion 10: Class Abilities Work Correctly With Fleeing, Loot, XP, Permadeath, and Monster Persistence
- **Type:** **Hard Engine Integration Invariant (`S4`)**
- **What We Verify:**
  - **Lethal Opening Shot:** Killing a monster on the pre-combat **Opening Shot** transitions the encounter to `VICTORY`, awards full XP (including INT modifier bonus), generates loot, updates/clears persistent monster records, and sets `pending_victory_encounter_id` so the Victory Modal displays properly.
  - **Evasive Retreat & Persistent Monsters:** When a Ranger (or any class) flees a wounded monster, the monster's remaining HP is persisted in `monster_instances` and the player returns safely to exploration mode.
  - **Permadeath & Fallen Corpses:** If any class falls to `0 HP` (after Fighter's *Second Wind* has already triggered or if a single blow exceeds remaining HP), permadeath executes cleanly: the hero is marked dead, equipment is transferred to the persistent monster (`+10% HP` boost), and the Hall of the Fallen records the death.
  - **Out-of-Combat Cleric Heal Guardrail:** Attempting to invoke `CLERIC_HEAL` during an active `IN_COMBAT` encounter is rejected by the server (`400 Bad Request`).

---

## 4. Summary Comparison: Phase 7A.1 vs. Phase 7A.2 Simulation Gates

| Gate ID | Phase 7A.1 Requirement | Phase 7A.2 Status | Phase 7A.2 Replacement / Rule |
| :---: | :--- | :---: | :--- |
| **G1** | Level 1–2 Round-1 One-Shot Rate `= 0%` | **Retained (`S1`)** | Hard safety invariant: no unavoidable Round-1 instant death at full HP against tier-appropriate L1 monsters. |
| **G2** | Inter-Class Win-Rate Spread `<= 8.0 pp` | **REMOVED** | **Replaced by Thematic Asymmetry (`H1–H6`):** Classes are intentionally different; Fighter leads general combat, Ranger dominates Favored Enemy & prepared initiation, Cleric dominates Undead & multi-fight recovery. |
| **G3** | Level 1–10 Progression Monotonicity | **Retained (`S3`)** | Hard mathematical invariant including retroactive `CON` HP recalculation. |
| **G4** | Spec-to-Code Ability Fidelity | **Retained (`S4`)** | Hard integration invariant covering *Opening Shot* kills, *Second Wind*, out-of-combat *Divine Self-Healing*, *Evasive Retreat*, and persistent monsters. |
| **G5** | Ecological & Favored Enemy Reachability | **Retained (`S2`)** | Hard ecological invariant across all 7 Favored Enemy choices, Fighter Martial targets, and Cleric Undead targets. |

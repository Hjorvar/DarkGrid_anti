# DARKGRID — PHASE 7A.3: PHASE 7B SIMULATION PLAN & VERIFICATION MATRIX

**Date:** 2026-10-22  
**Phase:** 7A.3 — Final Design Corrections, Monster Families & Battle Experience  
**Status:** Authoritative Specification (Supersedes `PHASE-7A2-SIMULATION-REVISION.md`)

---

## 1. Simulation Philosophy: Role Fulfillment Over Class Parity

Phase 7B simulations do **not** test whether Fighter, Ranger, and Cleric have equal win rates (`Gate G2` is permanently retired). Instead, the simulation suite verifies that:
1. **Every class is viable and fair in permadeath** across Levels `1, 3, 5, 7, and 10`.
2. **Each class excels inside its intended thematic domain** (Fighter vs. martial/humanoids and general survival; Ranger when prepared with *Opening Shot* and against their chosen `monster_family`; Cleric against `UNDEAD` and across multi-fight expeditions using out-of-combat *Divine Self-Healing*).
3. **Battle Experience (`INT` Damage & `WIS` AC)** provides a meaningful, measurable reward after `1` (*Recognized*) and `3` (*Experienced*) victories without eclipsing primary combat attributes (`STR`, `DEX`, `CON`).
4. **Fighter Second Wind Lethal Rescue** and **Ranger Lethal Opening Shot** operate deterministically without double-triggering or breaking victory/permadeath persistence.

---

## 2. Required Simulation Matrix (Dimensions & Parameters)

The Phase 7B automated simulation runner (`scripts/run_phase7b_simulations.js`) will execute Monte Carlo trials (`N >= 2,000` combats per cell) across the following dimensions:

### 2.1 Character Levels
- **Levels `1`, `3`, `5`, `7`, and `10`** (including explicit Level `1–2` early-game permadeath safety audits).

### 2.2 Attribute Profiles (72 Starting Points + `+1` at L2, 4, 6, 8, 10)
1. **Class Preset Baseline (Average `INT`/`WIS`):**
   - **Fighter Preset:** `STR 14, DEX 12, CON 14, INT 10, WIS 12, CHA 10` (`+1` at L2/4/6/8/10 into `STR`/`CON`).
   - **Ranger Preset:** `STR 10, DEX 16, CON 12, INT 10, WIS 14, CHA 10` (`+1` at L2/4/6/8/10 into `DEX`/`WIS`).
   - **Cleric Preset:** `STR 12, DEX 10, CON 12, INT 10, WIS 16, CHA 12` (`+1` at L2/4/6/8/10 into `WIS`/`STR`).
2. **Low `INT`/`WIS` ("Brute" Build — `INT 8, WIS 8`):**
   - Tests the `0`-win `-1 Damage` / `-1 AC` beginner penalty against unfamiliar non-specialized monsters, the class-specialization exemption, and the removal of the penalty after the 1st victory.
3. **High `INT` / High `WIS` ("Tactician / Scholar" Builds — `INT 16–18+`, `WIS 16–18+`):**
   - Tests the `1`-win (*Recognized*) and `3`-win (*Experienced*) learned bonuses stacked with class specialization, compared directly against pure `STR/DEX/CON` investment.

### 2.3 Prior Victory States (Battle Experience Tiers)
- **`0` Victories (*Unfamiliar*)**
- **`1` Victory (*Recognized*)**
- **`3` Victories (*Experienced* — Cap)**

### 2.4 Required Scenario Suites
1. **Suite S1 — Fighter vs. Humanoids & Martial Enemies** (`#10 Goblin`, `#12 Hobgoblin`, `#22 Bugbear`, `#86 Hobgoblin Captain`, `#29 Ogre`, `#3 Troll`, `#98 Orc Warchief`).
2. **Suite S2 — Ranger vs. Chosen Favored Enemy Family** (`GOBLINOIDS`, `ANIMALS`, `MAGICAL_BEASTS`, `ARACHNIDS`, `DANGEROUS_PLANTS`, `DRAGONS_DRAKES`) vs. non-favored enemies, both `DISCOVERED` (with *Opening Shot*) and `SURPRISED` (ambushed).
3. **Suite S3 — Cleric vs. Undead** (`#4 Ghoul`, `#11 Human Skeleton`, `#13 Human Zombie`, `#44 Skeletal Champion`, `#49 Wight`, `#85 Draugr`, `#56 Wraith`, `#96 Barrow Wight`, `#36 Mummy`) vs. mundane beasts (`#31 Owlbear`, `#8 Manticore`).
4. **Suite S4 — Fighter Second Wind Lethal Rescue** (comparing survival, remaining HP, and one-shot death rates with Lethal Rescue enabled vs. disabled, plus multi-hit `Troll` Rend, `POISON`/`BLEED` DoTs, and `Cockatrice`/`Basilisk` `CALCIFY` petrification).
5. **Suite S5 — Ranger Opening Shot Lethal Victory** (verifying pre-Round-1 kills against L1–L3 skirmishers and wounded persistent monsters, confirming XP, loot, bounty, and `+1` Battle Experience recording).
6. **Suite S6 — Level 1–2 Permadeath Fairness** (auditing Round-1 instant deaths and win rates across all Level 1–2 surface-active monsters).
7. **Suite S7 — Multi-Encounter Expedition, Persistence & Logout/Login** (`3`-to-`5` consecutive encounters per expedition with Cleric out-of-combat *Divine Self-Healing* between fights, persistent wounded monster state on `FLEE`, and SQLite reload verification).
8. **Suite S8 — Attribute Progression & Retroactive Constitution HP** (testing `+1` allocation at `L2, 4, 6, 8, 10`, scores above `18` up to `23`/`25`, and $\Delta \text{HP} = L \times \Delta M_{\text{con}}$ without full healing).

---

## 3. Required Metrics Recorded Per Simulation Cell

Every simulation cell must output the following 8 quantitative metrics:
1. **Win Rate (`%`)**
2. **Average Remaining HP (`HP` and `% of Max HP` among survivors)**
3. **Average Damage Dealt per Combat (`HP`)**
4. **Average Damage Received per Combat (`HP`)**
5. **AC Effectiveness (`Monster Miss Rate %` and `Damage Mitigated per Round`)**
6. **Average Rounds per Combat**
7. **Expedition Survivability (`%` surviving a 3-encounter wilderness loop before returning to Oakhaven)**
8. **Known vs. Unknown Enemy Delta ($\Delta \text{Win Rate}$, $\Delta \text{Remaining HP}$, and $\Delta \text{Rounds}$ between `0`, `1`, and `3` prior victories)**

---

## 4. Preliminary Monte Carlo Verification Results (`2,000` Trials/Cell)

During Phase 7A.3 design verification, we executed an in-memory Monte Carlo simulation (`2,000` trials per scenario) against the actual SQLite monster stats and ability profiles (`src/domain/combat/abilities.js`). Key verified results:

| Scenario | Build & Stat Profile | `0` Wins (*Unfamiliar*) | `1` Win (*Recognized*) | `3` Wins (*Experienced*) | Key Verification Takeaway |
|---|---|---:|---:|---:|---|
| **Fighter L3 vs. `#86 Hobgoblin Captain` (L3)** | **STR-Focused** (`STR 18, CON 14, INT 10, WIS 12`) | `86.7%` win (`4.16` rds) | `86.4%` win (`4.15` rds) | `87.2%` win (`4.17` rds) | Primary `STR` investment dominates from fight #1 (`86.7%`). |
| **Fighter L3 vs. `#86 Hobgoblin Captain` (L3)** | **INT-Focused** (`STR 14, CON 12, INT 18, WIS 10`) | `59.4%` win (`5.02` rds) | `68.5%` win (`4.47` rds) | `75.0%` win (`4.02` rds) | `INT 18` gains `+15.6%` win rate and cuts fight duration by `1.0` full round after `3` wins, yet never eclipses `STR 18` (`87.2%`). |
| **Fighter L5 vs. `#3 Troll` (L5 Regenerator)** | **INT-Focused** (`STR 14, CON 12, INT 18, WIS 12`) | `76.9%` win (`8.82` rds) | `88.3%` win (`7.17` rds) | `95.9%` win (`6.11` rds) | Learned `+4` damage directly counters Troll regeneration (`5 HP/rd`), matching Preset Fighter (`97.0%`) by win #3. |
| **Ranger L3 vs. `#86 Hobgoblin Captain` (Favored)** | **INT-Focused** (`DEX 14, INT 18, WIS 12`) | `18.8%` win (`2.46` rds) | `30.9%` win (`2.24` rds) | `44.4%` win (`2.16` rds) | High `INT` + *Favored Enemy* + *Opening Shot* yields a `+25.6%` learned lethality surge after 3 kills. |
| **Cleric L4 vs. `#31 Owlbear` (L4 Mundane)** | **High WIS/INT** (`STR 12, CON 12, WIS 18, INT 14`) | `64.6%` win (`35.2` dmg rec) | `82.1%` win (`27.7` dmg rec) | `90.3%` win (`22.7` dmg rec) | Learned `+3 AC` and `+2 Dmg` cuts damage received by `35%` (`35.2 -> 22.7 HP`) against recurring beasts. |
| **Fighter L1 (`INT 8, WIS 8`) vs. `#2 Wolf` (L1)** | **Low INT/WIS** (`STR 18, CON 16, DEX 14, INT 8, WIS 8`) | `96.7%` win (`0.0%` R1 death) | `98.3%` win (`2.41` rds) | `98.3%` win (`2.41` rds) | `-1 Dmg / -1 AC` at `0` wins is noticeable (`2.9` vs `2.0` dmg taken) without causing unfair L1 permadeath. |
| **Fighter L3 vs. `#29 Ogre` (L3 Brute)** | **Preset Fighter** (`Second Wind` WITHOUT vs. WITH Lethal Rescue) | `45.6%` win (`3.9%` R1 death) **without** Rescue | `63.4%` win (`0.0%` R1 death) **with** Rescue (`38%` rescue trigger rate) | — | **Lethal Rescue** eliminates Round-1 Ogre crit instakills (`3.9% -> 0.0%`) and boosts survival by `+17.8%`. |

> [!WARNING]
> **Monster Seed Outlier Flagged for Owner (`#36 Mummy`, Level 5 Undead):**
> In the current database (`002_seed_monsters.sql`), `#36 Mummy` has `armor_class = 20, attack_bonus = 14, damage_dice = '1d8+10', base_hp = 45` plus `DR 3/-` (`Ancient Wrappings`). Every other Level 5 monster in the database has `attack_bonus` between `+6` (`Wraith`) and `+10` (`Manticore`, `Phase Spider`, `Orc Warchief`). Because `#36 Mummy` attacks at `+14` for `1d8+10` (`14.5` avg dmg) behind `AC 20` and `DR 3/-`, a Level 5 Cleric wins only `2.9%` of solo fights against it (rising to `~84%` at Level 8–10). Per Phase 7A.3 guardrails, we have **not** altered the database seed, and flag `#36 Mummy` for optional owner review (either re-tagging `#36 Mummy` as an apex tomb boss or tuning its attack to `AB +10, 1d8+6` in a future monster pass).

---

## 5. Phase 7B Acceptance Criteria (Replacing Legacy Gates)

| Gate ID | Acceptance Criterion | Pass Threshold |
|---|---|---|
| **Gate C1 — Level 1–2 Permadeath Fairness** | A Level 1 Preset character of any class fighting an on-level (`solo_level = 1`) surface monster must not suffer unavoidable Round-1 one-shot deaths. | Round-1 instant death rate `<= 1.0%`; L1 win rate against standard L1 monsters `>= 80%`. |
| **Gate C2 — Primary Stat Supremacy (`STR/DEX/CON` vs. `INT/WIS`)** | At `0` wins, a hero investing in `STR/DEX/CON` must outperform an equal-level hero who sacrificed primary stats for `INT 18 / WIS 18`; at `3` wins (*Experienced*), the high-`INT/WIS` hero closes the gap without invalidating `STR/DEX/CON`. | Verified (`STR 18` L3 Fighter = `87.2%` vs `INT 18` L3 Fighter = `59.4% -> 75.0%`). |
| **Gate C3 — Measurable Battle Experience Payoff** | For a character with `INT >= 14` or `WIS >= 14`, reaching `3` victories (*Experienced*) against a non-trivial enemy (`L3–L5`) must measurably improve combat performance over `0` wins. | Average rounds-to-kill decreases or average remaining HP increases by `>= 10%` at `3` wins vs. `0` wins. |
| **Gate C4 — Fighter Second Wind Lethal Rescue** | Lethal Rescue triggers at most once per combat, prevents single-hit lethal blows when `secondWindUsed === false`, never exceeds `Max HP`, and does not block `CALCIFY` petrification. | `100%` deterministic unit & simulation pass rate. |
| **Gate C5 — Ranger Prepared Ambush & Favored Enemy Identity** | A `DISCOVERED` Ranger with a readied bow against their chosen `monster_family` deals significantly higher Round-0/Round-1 damage than when `SURPRISED` or fighting non-favored foes, and lethal *Opening Shots* resolve full victory + Battle Experience. | `100%` functional & simulation pass rate. |
| **Gate C6 — Cleric Undead Mastery & Expedition Sustain** | Cleric outperforms mundane baselines against `UNDEAD` targets and sustains multi-encounter expeditions via out-of-combat *Divine Self-Healing*. | Cleric win rate `>= 85%` across L1–L5 surface Undead (`Ghoul`, `Skeleton`, `Zombie`, `Plague Zombie`, `Ghast`, `Shadow`, `Wight`, `Draugr`, `Wraith`, `Barrow Wight`). |

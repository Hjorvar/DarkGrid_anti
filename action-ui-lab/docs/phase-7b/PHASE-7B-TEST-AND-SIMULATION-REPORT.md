# DARKGRID — PHASE 7B: TEST AND SIMULATION REPORT

**Date:** 2026-10-22  
**Test Suite:** [`tests/phase7b_full_systems.test.js`](../../../tests/phase7b_full_systems.test.js) + Full Repository Regression Suite (`npm test`, `action-ui-lab/tests/*.test.js`)  
**Simulation Runner:** [`scripts/run_phase7b_simulations.js`](../../../scripts/run_phase7b_simulations.js)  
**Raw Simulation Output:** [`phase7b_simulation_results.json`](./phase7b_simulation_results.json) (`2,000` trials per matchup)

---

## 1. Automated Test Suite Results

All automated unit, integration, API, and headless Chrome Visual QA test suites pass with **100% pass rate (0 failures)**:

| Test Suite | Tests | Passed | Failed | Coverage Highlights |
|---|---:|---:|---:|---|
| [`tests/phase7b_full_systems.test.js`](../../../tests/phase7b_full_systems.test.js) | `9` | `9` | `0` | 72-pt creation (`8..18`), milestones (`L2,4,6,8,10`), post-18 scaling, open-ended `level > 10` formulas, all 10 mandatory CON & Equipment scenarios (Rules A/B/C/D + 9-slot `BELT`), Fighter Second Wind Option B (`0 HP` rescue, DoT rescue, L10+ `BLEED > POISON` cleanse, `CALCIFY` non-rescue), Ranger 14-family Favored Enemy & Option A bonuses, 98-monster 22-family taxonomy & `#36 Mummy` preservation, INT/WIS Battle Experience & `action-ui-lab` HTTP/API integration |
| `npm test` (`tests/*.test.js`, `30` files) | `237` | `237` | `0` | Complete domain, route, database, combat, persistence, economy, bounty, and security regression suite |
| [`action-ui-lab/tests/phase-6-legacy-integration.test.js`](../../tests/phase-6-legacy-integration.test.js) | `11` | `11` | `0` | End-to-end multi-user journeys, legacy audit, and headless Chrome Visual QA |
| [`action-ui-lab/tests/phase-6-1-hardening.test.js`](../../tests/phase-6-1-hardening.test.js) | `7` | `7` | `0` | Pre-cutover security hardening, ownership checks, migration rehearsal, and desktop/laptop/mobile headless Chrome screenshots |

---

## 2. Mandatory Constitution & Equipment Scenarios Verified (`Phase 7B.4`)

All 10 mandatory Constitution and equipment scenarios from Prompt §8 passed in [`tests/phase7b_full_systems.test.js`](../../../tests/phase7b_full_systems.test.js):
1. **Equip `+CON` (`Belt of Mighty Constitution +2` at Level 5):** Increases `max_hp` from `54` to `64` (`+10`) without increasing `current_hp` (`40 -> 40`).
2. **Heal into new capacity, then unequip `+CON`:** Clamps `current_hp` down from `64` to `newMaxHp = 54`.
3. **Unequip `+CON` when `oldCurrentHp < newMaxHp`:** Preserves `current_hp = 35` unchanged (`min(35, 54) = 35`).
4. **Unequip `+CON` at `1 HP`:** Preserves `current_hp = 1` (`max(1, min(1, 54)) = 1`); living hero never dies from equipment changes.
5. **Repeated equip/unequip cycle:** Never produces free healing (`30 -> 30 -> 30`).
6. **Direct slot swap (`+2 CON` Belt -> `+4 CON` Belt -> `+2 STR` Belt):** Resolves atomically in a single transaction without free healing or death.
7. **Permanent CON increase (`14 -> 15`, modifier unchanged):** Grants `+0` Max HP and `+0` Current HP.
8. **Permanent CON increase (`15 -> 16`, modifier `+2 -> +3` at Level 5):** Grants `+5` Max HP and adds `+5` to Current HP (`30 -> 35`, no full heal).
9. **Level-up (`Level 5 -> Level 6` Fighter with `CON 16`):** Adds exact level-up HP gain to Current HP without full heal.
10. **Login / reload reconciliation (`reconcileCharacterHpOnLoad`):** Updates `max_hp` to canonical value without adding positive difference to `current_hp`, and preserves `current_hp = 0, is_alive = 0` for fallen heroes.

---

## 3. Monte Carlo Combat Simulation Results (`2,000` Trials / Matchup)

Executed via [`scripts/run_phase7b_simulations.js`](../../../scripts/run_phase7b_simulations.js) using the real domain modules (`src/domain/character/rules.js`, `src/domain/combat/rules.js`, `src/domain/combat/abilities.js`, `src/domain/combat/knowledge.js`).

### 3.1 Levels 1–10 Progression Matrix (Fighter, Ranger, Cleric)

| Level | Benchmark Monster (Family) | Fighter Win % | Fighter Avg Rnds | Fighter 2nd Wind % | Ranger Win % | Ranger Avg Rnds | Cleric Win % | Cleric Avg Rnds |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| **1** | Goblin (`GOBLINOIDS`) | `99.20%` | `2.99` | `0.0%` | `98.85%` | `2.16` | `89.25%` | `3.58` |
| **2** | Wolf (`LUPINE_CANINE_BEASTS`) | `98.40%` | `3.84` | `0.0%` | `99.40%` | `2.00` | `87.40%` | `4.25` |
| **3** | Bugbear (`GOBLINOIDS`) | `98.10%` | `4.39` | `15.8%` | `90.45%` | `2.88` | `56.00%` | `4.72` |
| **4** | Ogre (`GIANTS`) | `80.40%` | `4.97` | `50.5%` | `73.35%` | `2.73` | `6.30%` | `3.52` |
| **5** | Wight (`UNDEAD`) | `100.00%` | `3.34` | `0.0%` | `100.00%` | `3.34` | `100.00%` | `3.02` |
| **6** | Troll (`TROLLS`) | `99.55%` | `5.12` | `9.4%` | `87.55%` | `4.33` | `21.55%` | `6.34` |
| **7** | Manticore (`AVIAN_CHIMERAS`) | `99.95%` | `5.78` | `6.0%` | `99.95%` | `3.20` | `49.15%` | `6.67` |
| **8** | Wyvern (`DRAGONS_DRAKES`) | `100.00%` | `5.68` | `2.1%` | `100.00%` | `2.90` | `87.20%` | `9.45` |
| **9** | Wraith (`UNDEAD`) | `100.00%` | `3.49` | `0.0%` | `100.00%` | `4.34` | `100.00%` | `2.50` |
| **10** | Troll (`TROLLS`, High-HP Benchmark) | `100.00%` | `3.29` | `0.0%` | `100.00%` | `3.30` | `99.50%` | `6.00` |

### 3.2 Monster `#36 Mummy` Elite Benchmark (`45 HP, AC 20, +14 Atk, 1d8+10, CR 5, UNDEAD`)

Preserving `#36 Mummy`'s dangerous stats (`OD-7A4-07`) keeps it a lethal threat at Level 5 while demonstrating Cleric's Undead specialization and Fighter's durability as heroes advance to Levels 6–7:

| Hero Level | Fighter Win % (2nd Wind %) | Ranger Win % (Undead Forbidden) | Cleric Win % (Sacred Knowledge + Turn Undead) |
|---:|---:|---:|---:|
| **Level 5** | `11.40%` (`97.7%` 2nd Wind) | `0.75%` | `4.45%` |
| **Level 6** | `24.05%` (`94.0%` 2nd Wind) | `2.70%` | `25.10%` |
| **Level 7** | `66.05%` (`71.7%` 2nd Wind) | `9.15%` | `63.60%` (`5.36` avg rounds vs Fighter `8.23`) |

### 3.3 INT/WIS Battle Experience Progression (Level 4 Fighter vs. `Owlbear`, `INT 16 / WIS 16`)

| Mastery Tier (Victories) | Learned Bonuses (`INT 16 / WIS 16`) | Win Rate (`2,000` trials) | Avg Rounds | Avg Remaining HP % | Second Wind Trigger % |
|---|---|---:|---:|---:|---:|
| **Unfamiliar (`0` Victories)** | `+0` Dmg, `+0` AC | `93.00%` | `6.71` | `52.6%` | `37.0%` |
| **Recognized (`1` Victory)** | `+2` Dmg, `+1` AC | `97.65%` | `5.42` | `61.1%` | `21.3%` |
| **Experienced (`3+` Victories)** | `+3` Dmg, `+2` AC | `98.45%` | `4.97` | `66.9%` | `12.7%` |

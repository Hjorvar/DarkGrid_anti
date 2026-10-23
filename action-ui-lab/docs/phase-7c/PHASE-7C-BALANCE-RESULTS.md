# DARKGRID — PHASE 7C: MONTE CARLO COMBAT & EXPEDITION BALANCE RESULTS

**Date:** 2026-10-23  
**Simulation Script:** [`scripts/run_phase7c_simulations.js`](../../../../scripts/run_phase7c_simulations.js)  
**Raw Data Artifact:** [`action-ui-lab/docs/phase-7c/simulation-results.json`](./simulation-results.json)  
**Sample Size:** `2,000` trials per single-encounter matchup + `2,000` trials per expedition configuration (`316,000+` simulated combat bouts using the real `src/domain/` engine rules).

---

## 1. Preservation of `#36 Mummy`, Fighter, Ranger, and Monster Statistics

Before running the Monte Carlo suite, `scripts/run_phase7c_simulations.js` asserts that Monster `#36 Mummy` and all Fighter/Ranger/monster parameters remain untouched:

- **`#36 Mummy` Verified Database Row:**
  - `base_hp`: **45**
  - `armor_class`: **20**
  - `attack_bonus`: **+14**
  - `damage_dice`: **`1d8+10`**
  - `challenge_rating`: **5**
  - `monster_family`: **`UNDEAD`**
- **Zero Nerfs Applied:** Neither Fighter, Ranger, nor any of the 98 monsters were weakened.

---

## 2. Single-Encounter Matchup Benchmarks (`2,000` Trials / Matchup)

Comparison across **Levels 1, 3, 5, 7, and 10** between:
- **Legacy Cleric** (Pre-7C: Basic Attack + Sacred Knowledge + Turn Undead + Potions)
- **Phase 7C Cleric — Balanced Tactical** (Battle Prayer when $\le 58\%$ HP, Smite vs Undead or when charges $\ge 3$)
- **Phase 7C Cleric — Aggressive Smite** (Smite whenever charges $\ge 1$)
- **Phase 7C Cleric — Healing Battle Prayer** (Battle Prayer whenever $\le 72\%$ HP)
- **Phase 7C Cleric — Defensive Divine Shield** (Divine Shield when unshielded & charges $\ge 2$, Battle Prayer at $\le 45\%$ HP)
- **Fighter** & **Ranger** (Reference class benchmarks)

| Level | Monster (Family, CR) | Legacy Cleric Win % (Rnds) | 7C Balanced Win % (Rnds / Chg) | 7C Smite Win % (Rnds / Chg) | 7C Prayer Win % (Rnds / Chg) | 7C Shield Win % (Rnds / Chg) | Fighter Win % (Rnds) | Ranger Win % (Rnds) |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **L1** | **Goblin** (`GOBLINOIDS`, CR 1/3) | 97.50% (4.06r) | **93.30%** (3.66r / 1.08c) | **96.45%** (2.99r / 2.82c) | 92.65% (3.60r / 1.45c) | 92.90% (3.65r / 0.73c) | 100.0% (3.00r) | 99.65% (2.19r) |
| **L1** | **Human Skeleton** (`UNDEAD`, CR 1/3) | 99.80% (2.26r) | **99.30%** (2.18r / 2.17c) | **99.15%** (2.23r / 2.21c) | 99.30% (2.22r / 0.24c) | 99.40% (2.13r / 0.13c) | 99.80% (3.92r) | 97.10% (3.50r) |
| **L3** | **Bugbear** (`GOBLINOIDS`, CR 2) | 56.35% (5.46r) | **74.25%** (4.00r / 3.11c) | **75.90%** (3.52r / 3.00c) | 69.10% (4.99r / 2.87c) | 69.70% (7.54r / 6.11c) | 98.60% (4.66r) | 89.85% (3.30r) |
| **L3** | **Ghoul** (`UNDEAD`, CR 1) | 99.80% (2.66r) | **99.95%** (1.71r / 1.62c) | **100.0%** (1.65r / 1.56c) | 99.90% (2.63r / 0.37c) | 99.85% (4.46r / 3.35c) | 100.0% (3.98r) | 99.20% (3.70r) |
| **L5** | **Ogre** (`GIANTS`, CR 3) | 20.15% (4.73r) | **49.85%** (4.00r / 3.39c) | **49.20%** (3.45r / 2.80c) | 41.15% (4.79r / 2.72c) | 32.20% (6.48r / 6.44c) | 99.25% (3.29r) | 91.30% (2.62r) |
| **L5** | **Wight** (`UNDEAD`, CR 3) | 100.0% (3.21r) | **100.0%** (1.74r / 1.74c) | **100.0%** (1.75r / 1.75c) | 100.0% (3.12r / 0.04c) | 100.0% (5.96r / 5.29c) | 100.0% (3.42r) | 100.0% (3.57r) |
| **L5** | **#36 Mummy** (`UNDEAD`, CR 5) | 1.30% (4.96r) | **18.45%** (4.50r / 4.08c) | **19.65%** (4.41r / 2.85c) | 6.30% (5.11r / 3.51c) | 2.75% (6.47r / 6.72c) | 3.35% (8.12r) | 0.10% (5.64r) |
| **L7** | **Troll** (`TROLLS`, CR 5) | 16.50% (12.27r) | **94.05%** (6.06r / 5.53c) | **92.10%** (4.88r / 4.46c) | 83.90% (15.47r / 8.15c) | 18.75% (25.51r / 15.98c) | 100.0% (5.02r) | 94.95% (5.59r) |
| **L7** | **#36 Mummy** (`UNDEAD`, CR 5) | 21.70% (7.97r) | **77.15%** (4.56r / 4.42c) | **86.85%** (3.84r / 3.31c) | 60.90% (8.10r / 5.29c) | 44.40% (12.10r / 11.90c) | 44.85% (10.48r) | 1.40% (7.57r) |
| **L7** | **Minotaur** (`MONSTROUS`, CR 4) | 54.35% (6.40r) | **93.75%** (3.48r / 3.12c) | **91.85%** (2.94r / 2.56c) | 91.10% (5.77r / 3.47c) | 85.35% (8.91r / 9.26c) | 100.0% (3.28r) | 94.25% (3.44r) |
| **L10** | **Troll** (`TROLLS`, CR 5) | 91.50% (11.01r) | **99.95%** (3.55r / 3.08c) | **100.0%** (3.34r / 3.33c) | 99.95% (9.77r / 2.42c) | 98.75% (25.38r / 20.05c) | 100.0% (3.71r) | 100.0% (3.54r) |
| **L10** | **Wraith** (`UNDEAD`, CR 5) | 100.0% (3.36r) | **100.0%** (1.93r / 1.93c) | **100.0%** (1.94r / 1.94c) | 100.0% (3.36r / 0.00c) | 100.0% (6.28r / 5.84c) | 100.0% (3.14r) | 100.0% (3.62r) |
| **L10** | **#36 Mummy** (`UNDEAD`, CR 5) | 96.15% (6.29r) | **99.85%** (2.60r / 2.60c) | **100.0%** (2.46r / 2.44c) | 99.85% (5.77r / 1.99c) | 99.80% (11.29r / 10.72c) | 100.0% (4.97r) | 67.55% (8.64r) |

### Key Single-Encounter Takeaways
1. **Cleric Class Identity vs Undead:** Against `#36 Mummy` at Level 7, Legacy Cleric won only `21.70%` of fights (`7.97` rounds). With Phase 7C Divine Combat, Cleric becomes the premier Undead hunter (`77.15%` Balanced / `86.85%` Smite in `3.84` rounds), outperforming both Level 7 Fighter (`44.85%`) and Level 7 Ranger (`1.40%`), while at Level 5 the Mummy remains a lethal boss (`18.45%–19.65%` win rate, consuming `~4.1` charges).
2. **Living Brute Differentiation Preserved:** Against living brutes like the **Bugbear** (L3) and **Ogre** (L5), Phase 7C rescues Cleric from near-helplessness (`56.35% -> 74.25%` vs Bugbear; `20.15% -> 49.85%` vs Ogre) while **Fighter** (`98.60%` vs Bugbear, `99.25%` vs Ogre) and **Ranger** (`89.85%` vs Bugbear, `91.30%` vs Ogre) remain clearly stronger against non-Undead physical threats.
3. **Overcoming Regeneration at Mid-High Levels:** Against the **Troll** at Level 7, Legacy Cleric struggled at `16.50%` (`12.27` rounds) because 1d8 mace attacks barely outpaced regeneration. Spending `~5.5` Divine Charges on Smite and Battle Prayer allows Level 7 Cleric to defeat Trolls reliably (`94.05%` in `6.06` rounds).

---

## 3. Consecutive Wilderness Expedition Simulations (10, 15, and 20 Encounters Without City Rest)

Each expedition simulates `10`, `15`, or `20` consecutive wilderness encounters **without returning to a city**, tracking:
- Persistent HP loss across encounters
- Out-of-combat **Self-Healing** (`cleric_heal_uses`: 2 at L1–4, 3 at L5–8, 4 at L9+)
- Persistent **Divine Charges** (never refilling between encounters)
- `3` Healing Potions per expedition
- Permadeath & Safe Return Threshold (encounters survived before needing to return to a city)

### 3.1 10-Encounter Expedition Results (`2,000` Expeditions / Strategy)

| Level (Max Charges) | Strategy | 10-Enc Survival % | Avg Encounters Survived | Avg Safe Encounters Before City Return | Avg Divine Charges Spent | Avg Self-Heals Used | Avg Potions Used |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **L1** (10) | `LEGACY_CLERIC` | 83.25% | 9.12 | 9.06 | 0.00 | 1.56 | 1.38 |
| **L1** (10) | `AGGRESSIVE_SMITE` | **80.40%** | **8.99** | **8.97** | 9.77 | 1.54 | 0.88 |
| **L1** (10) | `ORDINARY_ATTACK_APPROPRIATE` | 77.55% | 8.64 | 8.64 | 1.19 | 1.37 | 0.78 |
| **L1** (10) | `BALANCED_TACTICAL` | 76.55% | 8.45 | 8.45 | 7.55 | 0.79 | 0.18 |
| **L3** (12) | `LEGACY_CLERIC` | 34.00% | 5.92 | 5.82 | 0.00 | 1.16 | 1.65 |
| **L3** (12) | `BALANCED_TACTICAL` | **50.90%** | **7.18** | **7.17** | 10.05 | 0.99 | 0.42 |
| **L3** (12) | `HEALING_BATTLE_PRAYER` | **49.10%** | **6.94** | **6.94** | 6.04 | 0.38 | 0.10 |
| **L3** (12) | `AGGRESSIVE_SMITE` | 46.05% | 7.14 | 7.09 | 10.57 | 1.20 | 0.93 |
| **L3** (12) | `DEFENSIVE_DIVINE_SHIELD` | 44.55% | 6.86 | 6.82 | 10.81 | 1.24 | 0.63 |
| **L3** (12) | `ORDINARY_ATTACK_APPROPRIATE` | 42.30% | 6.43 | 6.43 | 1.67 | 1.20 | 1.05 |
| **L5** (14) | `LEGACY_CLERIC` | 8.25% | 3.32 | 3.28 | 0.00 | 1.09 | 1.57 |
| **L5** (14) | `BALANCED_TACTICAL` | **18.70%** | **4.73** | **4.73** | 9.96 | 0.96 | 0.33 |
| **L5** (14) | `HEALING_BATTLE_PRAYER` | **16.90%** | 4.23 | 4.23 | 5.89 | 0.51 | 0.06 |
| **L5** (14) | `AGGRESSIVE_SMITE` | 16.45% | 4.65 | 4.63 | 9.45 | 1.29 | 1.11 |
| **L5** (14) | `ORDINARY_ATTACK_APPROPRIATE` | 11.50% | 3.65 | 3.65 | 1.69 | 1.10 | 1.18 |
| **L5** (14) | `DEFENSIVE_DIVINE_SHIELD` | 9.95% | 3.64 | 3.62 | 11.60 | 1.03 | 0.71 |
| **L7** (16) | `LEGACY_CLERIC` | 0.00% | 0.97 | 0.94 | 0.00 | 0.72 | 2.74 |
| **L7** (16) | `BALANCED_TACTICAL` | **2.60%** | **4.28** | **4.25** | 13.74 | 1.93 | 1.64 |
| **L7** (16) | `AGGRESSIVE_SMITE` | 2.10% | **4.44** | **4.38** | 12.65 | 2.30 | 2.37 |
| **L7** (16) | `ORDINARY_ATTACK_APPROPRIATE` | 2.30% | 2.81 | 2.79 | 7.91 | 1.58 | 2.45 |
| **L7** (16) | `HEALING_BATTLE_PRAYER` | 1.60% | 3.01 | 3.00 | 12.31 | 1.25 | 1.12 |
| **L7** (16) | `DEFENSIVE_DIVINE_SHIELD` | 0.05% | 1.42 | 1.40 | 14.63 | 1.02 | 1.77 |
| **L10** (21) | `LEGACY_CLERIC` | 24.25% | 6.43 | 6.06 | 0.00 | 3.39 | 2.85 |
| **L10** (21) | `ORDINARY_ATTACK_APPROPRIATE` | **98.95%** | **9.96** | **9.96** | 8.73 | 3.73 | 1.15 |
| **L10** (21) | `HEALING_BATTLE_PRAYER` | **98.80%** | **9.94** | **9.94** | 13.13 | 0.98 | 0.08 |
| **L10** (21) | `BALANCED_TACTICAL` | **96.95%** | **9.93** | **9.92** | 19.86 | 2.73 | 0.43 |
| **L10** (21) | `AGGRESSIVE_SMITE` | 94.55% | 9.91 | 9.88 | 20.08 | 3.31 | 0.79 |
| **L10** (21) | `DEFENSIVE_DIVINE_SHIELD` | 42.55% | 8.03 | 7.73 | 20.96 | 3.77 | 2.48 |

---

### 3.2 15- and 20-Encounter Marathon Expeditions (Resource Pacing Analysis)

| Level | Target Length | `LEGACY_CLERIC` Survival % (Avg Enc) | `AGGRESSIVE_SMITE` Survival % (Avg Enc) | `BALANCED_TACTICAL` Survival % (Avg Enc) | `HEALING_BATTLE_PRAYER` Survival % (Avg Enc) | `ORDINARY_ATTACK` Survival % (Avg Enc) | `DEFENSIVE_SHIELD` Survival % (Avg Enc) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **L3** | **15 Enc** | 17.45% (7.13) | 24.40% (8.74) | 30.05% (9.08) | **32.30%** (8.79) | 25.50% (8.19) | 21.70% (8.00) |
| **L3** | **20 Enc** | 8.15% (7.93) | 10.70% (9.55) | 15.05% (10.44) | **22.95%** (10.32) | 14.05% (8.98) | 9.95% (8.99) |
| **L5** | **15 Enc** | 1.50% (3.56) | 3.85% (5.03) | 5.25% (5.09) | **5.35%** (4.56) | 2.95% (3.88) | 2.45% (3.98) |
| **L5** | **20 Enc** | 0.30% (3.59) | 1.25% (5.24) | 1.25% (5.31) | **1.65%** (4.88) | 0.85% (4.27) | 0.25% (3.82) |
| **L10** | **15 Enc** | 3.45% (6.85) | 40.85% (13.13) | 56.70% (13.78) | **91.95%** (14.71) | **90.35%** (14.66) | 9.05% (9.11) |
| **L10** | **20 Enc** | 0.70% (7.03) | 7.50% (13.95) | 13.35% (15.14) | **66.75%** (18.65) | **62.00%** (18.34) | 1.10% (9.17) |

---

## 4. Balance Conclusions & Recommendations for Owner Review

1. **Resource Management Creates True Tactical Depth:**
   - In short expeditions (1–5 fights), **Aggressive Smite** and **Balanced Tactical** dominate by eliminating dangerous foes quickly.
   - In longer expeditions (15–20 fights without city rest), reckless Smite spamming burns through all Divine Charges by Encounter 6–8, causing survival at Level 10 (20 encounters) to drop to **`7.50%`**, whereas pacing charges with **Healing Battle Prayer** (**`66.75%`**) or **Ordinary Attack + Selective Divine Techniques** (**`62.00%`**) allows the Cleric to survive **`18.3–18.6` consecutive encounters**.
2. **Recommended Safe Expedition Length Before Returning to a City:**
   - **Levels 1–2:** `7–9` encounters before returning to Oakhaven Sanctuary.
   - **Levels 3–5:** `4–7` encounters in mid-tier zones (Bugbears/Ogres/Wights).
   - **Levels 6–7:** `3–4` encounters when hunting CR 4–5 threats (Trolls/Minotaurs/Mummies).
   - **Levels 8–10:** `9–14` encounters with balanced charge pacing.
3. **Optional Owner Balance Consideration — Divine Shield Action Economy:**
   - Because `DIVINE_SHIELD` costs `2` Divine Charges AND consumes the player's entire action for a 2-monster-turn buff, using it repeatedly in solo 1v1 combat trades 100% of the Cleric's offensive output on cast turns for `2 + WIS_mod + floor((L-1)/3)` DR (`5–8` DR/hit). Against regenerating enemies (Troll) or high-single-hit brutes, `BATTLE_PRAYER` (which attacks *and* heals for `1` charge) is usually more charge-efficient unless the Cleric is preparing to `FLEE`, enduring a multi-hit monster (`Troll` / `Minotaur`), or waiting out a debuff.
   - **Recommendation (No Immediate Change Required, Optional Future Tuning):** Keep `DIVINE_SHIELD` at its approved specification (`Cost 2, 2 monster turns, consumes action`) for Phase 7C, or if the owner wishes to make Divine Shield more competitive with Battle Prayer in future patches, consider either increasing its duration to `3` monster turns at Level 6+ or adding a modest `+2` sacred AC bonus while the barrier is active.
